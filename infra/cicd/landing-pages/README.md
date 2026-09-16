# RealEstateFlow Landing Pages — CI/CD entry point

This folder doesn't hold its own copy of the CFN template. `deploy.sh` here
delegates the actual build/CFN work to the real script:

```
apps/landing-pages/infra/deploy.sh
```

Everything — `cfn-landing-pages.yaml`, `cfn-params.json` (regenerated every
run), and the build/CFN-deploy logic itself — lives there. What this
wrapper adds on top: **build/release tracking and rollback**, same design
as `infra/cicd/real-estate-crm-app` (see that folder's README for
the fuller write-up — this one only calls out what differs).

This is a **static site**, not a Lambda service — there's no single
"latest" code object to version. The live site S3 bucket (versioned, per
`cfn-landing-pages.yaml`) IS the deployed artifact; this wrapper's job is
to keep a permanent, build-numbered **archive** of each build's `dist/`
output alongside the CFN template it was deployed with, so a build can be
inspected or restored later even after later deploys have overwritten the
live bucket's content.

## What's different from `real-estate-crm-app`'s wrapper

`landing-pages` is a multi-page static site (14 pages, one `index.html`
per page directory), not a single-page app — see
`apps/landing-pages/infra/README.md` for what that changes in the CFN template
and the S3 cache-control strategy. This wrapper only mirrors that
difference where it actually matters: the archived/restored file is
`cfn-landing-pages.yaml` (not `cfn-frontend.yaml`), and `rollback-content`
re-applies the same short `Cache-Control` values `infra/deploy.sh` uses
(see there) rather than the CRM frontend's "hashed assets = 1 year
immutable" scheme — this site's asset filenames aren't content-hashed, so
long browser caching would leave a redeployed page's visitors stuck on a
stale `main.css`/logo even after the CDN edge is invalidated.

## Running it

```
cd infra/cicd/landing-pages
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

## Build numbers are global, not per-environment

One counter across dev **and** prod — build #7 is unambiguous by itself.
Which env a build targeted is recorded *inside* it (`manifest.json`'s `env`
field, and as a path segment in S3 — see below), not implied by which
counter produced it. `rollback-content`/`rollback-full` double-check this:
if you ask to roll back `dev` using a build that was actually a `prod`
build, they refuse rather than silently touching the wrong environment.

## S3 layout

One artifact bucket **per environment** (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts` — see
`infra/cicd/common-infra/vpc-networking.yaml`), the same bucket the
other services archive into. Inside it:

```
realestateflow-landing-pages/builds/0001/prod/dist.tar.gz             permanent,
realestateflow-landing-pages/builds/0001/prod/cfn-landing-pages.yaml   build+env-
realestateflow-landing-pages/builds/0002/dev/dist.tar.gz               scoped
realestateflow-landing-pages/builds/0002/dev/cfn-landing-pages.yaml    archive
                                                                        (never
                                                                        overwritten)
```

**Every object this script uploads gets S3 tags:** `Branch`, `DeployDate`,
`Status` (`deployed`|`failed`), `CommitId` — applied via a
`put-object-tagging` follow-up call after the deploy attempt finishes,
never at upload time (`Status` isn't knowable until then).

## Build/release tracking (`deploy-versions/`)

Every deploy also records locally under `deploy-versions/<build>/`
(gitignored — S3 above is the durable, shareable source of truth; this is
a local index plus instant-access template/param snapshots for rollback):

- `manifest.json` — build number, env, status, UTC timestamp, git
  commit/branch/dirty-flag, deployer, the CFN stack name, the artifact
  bucket + build-archive keys (`dist.tar.gz`, `cfn-landing-pages.yaml`),
  and the live site bucket name + CloudFront distribution ID.
- `dist.tar.gz`, `cfn-landing-pages.yaml`, `cfn-params.json` — local
  snapshots, so a full rollback never depends on fetching anything back
  from S3 (which may be sitting in Deep Archive by the time you need it).

A **failed** deploy is still recorded (status `failed`, tagged
`Status=failed` in S3 too) — worth keeping for debugging, never a valid
rollback target.

`deploy-versions/LATEST` holds the current global build number;
`deploy-versions/history.jsonl` is an append-only, one-line-per-build log
of every manifest ever written, across both envs.

## Rollback

**`rollback-content <env> <build>`** — fast path. Downloads that build's
archived `dist.tar.gz`, `aws s3 sync --delete`s it onto the live site
bucket (so files removed by a later build are also removed — matching what
a real deploy would have produced), then invalidates CloudFront. Bypasses
CloudFormation entirely.

**`rollback-full <env> <build>`** — also redeploys that build's saved CFN
template + params (a normal `aws cloudformation deploy`, using the local
snapshot — not the possibly-archived S3 copy), then does the content
rollback above.

Either way, a rollback is recorded as **a new build**, tagged
`rollbackOf: "<original build>"` — a rollback is a new forward release,
not an edit to history.

**Deep Archive retrieval caveat:** the artifact buckets' objects move to S3
Glacier Deep Archive after 60 days (see
`infra/cicd/common-infra/vpc-networking.yaml`). If
`rollback-content` targets a build old enough to have archived, it detects
this, prints the exact `aws s3api restore-object` command to run, and
tells you to re-run once the restore completes (~12h for Deep Archive
Standard tier). The local template/params snapshots are unaffected —
`rollback-full` doesn't wait on Deep Archive at all for the template side.

## What the `dev`/`prod` argument actually does

There is **one CloudFormation template** (`cfn-landing-pages.yaml`), used
unchanged for both environments — only the *parameter values* passed into
it differ, and each environment deploys to its own stack, its own S3
bucket, and its own CloudFront distribution. `infra/deploy.sh <env>`:

1. Resolves `ENV_FILE = apps/landing-pages/.env.<env>` — the argument selects
   which env file gets read. No `.env` fallback.
2. `source`s that file.
3. **Overwrites** `ENV` with the CLI argument regardless of what the file
   says — a stale `.env.prod` can never cause a "prod" run to silently
   deploy as dev, or vice versa.
4. Regenerates `infra/cfn-params.json` fresh every run — a build artifact,
   never hand-edit it.
5. Deploys against `STACK_NAME = ${ENV}-${SERVICE_NAME}-stack` — e.g.
   `prod-realestateflow-landing-pages-stack`. Two distinct stacks; a `prod`
   run never touches dev's resources.

Every physical resource is named `${Env}-${ServiceName}-<resource>` — e.g.
`prod-realestateflow-landing-pages` (the S3 bucket) — matching the
`<env>-realestateflow-<component>` convention already live across the rest
of this repo.
