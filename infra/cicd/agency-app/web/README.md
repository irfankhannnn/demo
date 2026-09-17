# RealtyFlow CRM Frontend — CI/CD entry point

This folder no longer holds its own copy of the CFN template. `deploy.sh`
here delegates the actual build/CFN work to the real script:

```
agency-app/web/infra/deploy.sh
```

Everything — `cfn-frontend.yaml`, `cfn-params.sample.json` (if added), and
the build/CFN-deploy logic itself — lives there now. What this wrapper adds
on top: **build/release tracking and rollback.**

This is a **static site**, not a Lambda service — unlike
`infra/cicd/platform/auth` and `infra/cicd/agency-app/api`,
there's no single "latest" code object to version. The live frontend S3
bucket (versioned, per `cfn-frontend.yaml`) IS the deployed artifact; this
wrapper's job is to keep a permanent, build-numbered **archive** of each
build's `dist/` output alongside the CFN template it was deployed with, so a
build can be inspected or restored later even after later deploys have
overwritten the live bucket's content.

## Running it

```
cd infra/cicd/agency-app/web
./deploy.sh dev                          # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list                         # list every recorded build (any env)
./deploy.sh list prod                    # list only prod builds
./deploy.sh show 0003                    # print one build's manifest.json
./deploy.sh rollback-content prod 0007   # fast: re-sync old dist/ + invalidate CDN
./deploy.sh rollback-full prod 0007      # full: redeploy that build's CFN + content
```

`dev`/`prod` is required for a deploy — the script refuses to run without
it.

Before allocating a build number, `deploy`/`content-deploy` run
`agency-app/web/infra/lib/api-domain-guard.sh` against `.env.<env>`:
`VITE_CRM_API_DOMAIN_NAME`, `VITE_CRM_API_BASE_PATH`, `VITE_AUTH_API_DOMAIN_NAME`
and `VITE_AUTH_API_BASE_PATH` are required (plus `VITE_MCP_API_BASE_PATH` when
`VITE_MCP_API_DOMAIN_NAME` is set); a raw `execute-api`/`amazonaws.com` host or a
value containing `://` fails the deploy. Rollbacks re-ship an archived bundle
and are not re-checked.

## Build numbers are global, not per-environment

One counter across dev **and** prod — build #7 is unambiguous by itself.
Deploy dev, then prod, then dev again and you get builds `0001`, `0002`,
`0003` in that order, not two separate `0001, 0002...` sequences. Which env
a build targeted is recorded *inside* it (`manifest.json`'s `env` field,
and as a path segment in S3 — see below), not implied by which counter
produced it. `rollback-content`/`rollback-full` double-check this: if you
ask to roll back `dev` using a build that was actually a `prod` build, they
refuse rather than silently touching the wrong environment.

## S3 layout

One artifact bucket **per environment** (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts` — see
`infra/cicd/common-infra/vpc-networking.yaml`), the same bucket the
Lambda services archive their code into. Inside it:

```
realestateflow-crm-frontend/builds/0001/prod/dist.tar.gz          permanent,
realestateflow-crm-frontend/builds/0001/prod/cfn-frontend.yaml    build+env-
                                                                    scoped
realestateflow-crm-frontend/builds/0002/dev/dist.tar.gz            archive
realestateflow-crm-frontend/builds/0002/dev/cfn-frontend.yaml      (never
                                                                    overwritten)
```

There's no `${SERVICE_NAME}/dist.tar.gz` "latest" key the way the Lambda
services have `${SERVICE_NAME}/function.zip` — the actual live content
lives in the frontend bucket itself
(`dev-realestateflow-crm-frontend` / `prod-realestateflow-crm-frontend`),
not the artifact bucket.

**Every object this script uploads gets S3 tags:**

| Tag | Value |
|---|---|
| `Branch` | git branch that produced the build |
| `DeployDate` | UTC timestamp of the deploy attempt |
| `Status` | `deployed` or `failed` — the actual script outcome |
| `CommitId` | git commit SHA at deploy time |

Tags are applied via a `put-object-tagging` follow-up call after the deploy
attempt finishes, never at upload time — `Status` isn't knowable until then.

## Build/release tracking (`deploy-versions/`)

Every deploy also records locally under `deploy-versions/<build>/`
(gitignored — S3 above is the durable, shareable source of truth; this is
a local index plus instant-access template/param snapshots for rollback):

- `manifest.json` — build number, env, status, UTC timestamp, git
  commit/branch/dirty-flag, deployer, the CFN stack name, the artifact
  bucket + build-archive keys (`dist.tar.gz`, `cfn-frontend.yaml`), and the
  live frontend bucket name + CloudFront distribution ID.
- `dist.tar.gz`, `cfn-frontend.yaml`, `cfn-params.json` — local snapshots,
  so a full rollback never depends on fetching anything back from S3
  (which may be sitting in Deep Archive by the time you need it).

A **failed** deploy is still recorded (status `failed`, and tagged
`Status=failed` in S3 too) — worth keeping for debugging, never a valid
rollback target.

`deploy-versions/LATEST` holds the current global build number;
`deploy-versions/history.jsonl` is an append-only, one-line-per-build log of
every manifest ever written, across both envs.

## Rollback

**`rollback-content <env> <build>`** — fast path. Downloads that build's
archived `dist.tar.gz`, `aws s3 sync --delete`s it onto the live frontend
bucket (so files removed by a later build are also removed — matching what
a real deploy would have produced), then invalidates CloudFront. Bypasses
CloudFormation entirely.

**`rollback-full <env> <build>`** — also redeploys that build's saved CFN
template + params (a normal `aws cloudformation deploy`, using the local
snapshot — not the possibly-archived S3 copy), then does the content
rollback above.

Either way, a rollback is recorded as **a new build**, tagged
`rollbackOf: "<original build>"` — a rollback is a new forward release, not
an edit to history.

**Deep Archive retrieval caveat:** the artifact buckets' objects move to S3
Glacier Deep Archive after 60 days (see
`infra/cicd/common-infra/vpc-networking.yaml`). Deep Archive's
fastest retrieval tier is ~12 hours — no faster option exists for this
storage class. If `rollback-content` targets a build old enough to have
archived, it detects this, prints the exact `aws s3api restore-object`
command to run, and tells you to re-run once the restore completes. The
local template/params snapshots are unaffected — `rollback-full` doesn't
wait on Deep Archive at all for the template side.

## What the `dev`/`prod` argument actually does

There is **one CloudFormation template** (`cfn-frontend.yaml`), used
unchanged for both environments — only the *parameter values* passed into
it differ, and each environment deploys to its own stack, its own S3
bucket, and its own CloudFront distribution. `infra/deploy.sh <env>`:

1. Resolves `ENV_FILE = agency-app/web/.env.<env>` — the argument
   selects which env file gets read. No `.env` fallback.
2. `source`s that file.
3. **Overwrites** `ENV` with the CLI argument regardless of what the file
   says — a stale `.env.prod` can never cause a "prod" run to silently
   deploy as dev, or vice versa.
4. Regenerates `infra/cfn-params.json` fresh every run — a build artifact,
   never hand-edit it.
5. Deploys against `STACK_NAME = ${ENV}-${SERVICE_NAME}-stack` — e.g.
   `dev-realestateflow-crm-frontend-stack` vs
   `prod-realestateflow-crm-frontend-stack`. Two distinct stacks; a `prod`
   run never touches dev's resources.

Every physical resource is named `${Env}-${ServiceName}-<resource>` —
e.g. `prod-realestateflow-crm-frontend` (the S3 bucket) — matching the
`<env>-realestateflow-<component>` convention already live on
`prod-realestateflow-networking-common`.
