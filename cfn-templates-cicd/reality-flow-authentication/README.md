# Reality Flow Auth — CI/CD entry point

This folder no longer holds its own copy of the templates. `deploy.sh` here
delegates the actual packaging/CFN work to the real script:

```
reality-flow-authentication/infra/deploy.sh
```

Everything — `cfn-backend.yaml`, `auth-explicit-routes.yaml`,
`cfn-params.sample.json`, and the packaging/CFN deploy logic itself — lives
there now. What this wrapper adds on top: **build/release tracking,
S3 object tagging, and rollback.**

## Running it

```
cd cfn-templates-cicd/reality-flow-authentication
./deploy.sh dev                        # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list                       # list every recorded build (any env)
./deploy.sh list prod                  # list only prod builds
./deploy.sh show 0003                  # print one build's manifest.json
./deploy.sh rollback-code prod 0007    # fast: point the Lambda at old code
./deploy.sh rollback-full prod 0007    # full: redeploy that build's CFN + code
```

`dev`/`prod` is required for a deploy — the script refuses to run without
it.

## Build numbers are global, not per-environment

One counter across dev **and** prod — build #7 is unambiguous by itself.
Deploy dev, then prod, then dev again and you get builds `0001`, `0002`,
`0003` in that order, not two separate `0001, 0002...` sequences. Which
env a build targeted is recorded *inside* it (`manifest.json`'s `env`
field, and as a path segment in S3 — see below), not implied by which
counter produced it. `rollback-code`/`rollback-full` double-check this: if
you ask to roll back `dev` using a build that was actually a `prod` build,
they refuse rather than silently touching the wrong environment.

## S3 layout

One artifact bucket **per environment** (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts` — see
`cfn-templates-cicd/common-infra/vpc-networking.yaml`), each already
versioned. Inside it:

```
realestateflow-auth/function.zip                        "latest" — the ONE key
realestateflow-auth/auth-explicit-routes.yaml            Lambda/CFN actually
                                                          read; every deploy
                                                          overwrites these two

realestateflow-auth/builds/0001/prod/cfn-backend.yaml          permanent,
realestateflow-auth/builds/0001/prod/auth-explicit-routes.yaml  build+env-
realestateflow-auth/builds/0001/prod/code/function.zip          scoped archive
                                                                 (never
realestateflow-auth/builds/0002/dev/cfn-backend.yaml            overwritten)
realestateflow-auth/builds/0002/dev/auth-explicit-routes.yaml
realestateflow-auth/builds/0002/dev/code/function.zip
```

`code/` is a directory, not a fixed filename — a service that ships more
than one Lambda artifact (see `cfn-templates-cicd/server/`, which has an
API Lambda and a call-recording worker sharing one zip today, but the path
supports adding a second named zip with no structural change) just adds
more files under it.

**Every object this script touches — the "latest" keys and every
build-archive file — gets S3 tags:**

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
  commit/branch/dirty-flag, deployer, the CFN stack name, and the S3
  bucket/key/**VersionId** of the "latest" code + routes template (the
  VersionId is what makes `rollback-code` possible — S3 versioning, not the
  build-numbered archive path, is the actual code-history mechanism) plus
  the three build-archive keys above.
- `cfn-backend.yaml`, `auth-explicit-routes.yaml`, `cfn-params.json` — local
  snapshots, so a full rollback never depends on fetching anything back
  from S3 (which may be sitting in Deep Archive by the time you need it).

A **failed** deploy is still recorded (status `failed`, and tagged
`Status=failed` in S3 too) — worth keeping for debugging, never a valid
rollback target.

`deploy-versions/LATEST` holds the current global build number;
`deploy-versions/history.jsonl` is an append-only, one-line-per-build log
of every manifest ever written, across both envs.

## Rollback

**`rollback-code <env> <build>`** — fast path. Points the live Lambda
directly at that build's exact S3 object **version** via
`aws lambda update-function-code --s3-object-version` — bypasses
CloudFormation entirely, matching how this template already handles
routine code refreshes (the `Code.S3Key` in `cfn-backend.yaml` is a fixed
`${ServiceName}/function.zip` key that never changes across deploys, so CFN
itself can't detect a code-only change).

**`rollback-full <env> <build>`** — also redeploys that build's saved CFN
template + params (a normal `aws cloudformation deploy`, using the local
snapshot — not the possibly-archived S3 copy), then does the code rollback
above.

Either way, a rollback is recorded as **a new build**, tagged
`rollbackOf: "<original build>"` — a rollback is a new forward release, not
an edit to history.

**Deep Archive retrieval caveat:** the artifact buckets' noncurrent
(superseded) versions on the "latest" keys move to S3 Glacier Deep Archive
after 60 days (see `cfn-templates-cicd/common-infra/vpc-networking.yaml`).
Deep Archive's fastest retrieval tier is ~12 hours — no faster option
exists for this storage class. If `rollback-code` targets a build old
enough to have archived, it detects this, prints the exact
`aws s3api restore-object` command to run, and tells you to re-run once
the restore completes. The build-archive copies and local template
snapshots are unaffected — `rollback-full` doesn't wait on Deep Archive at
all for the template side.

## What the `dev`/`prod` argument actually does

There is **one CloudFormation template** (`cfn-backend.yaml`), used
unchanged for both environments — only the *parameter values* passed into
it differ. `infra/deploy.sh <env>`:

1. Resolves `ENV_FILE = reality-flow-authentication/.env.<env>` — the
   argument selects which env file gets read. No `.env` fallback.
2. `source`s that file.
3. **Overwrites** `ENV` with the CLI argument regardless of what the file
   says — a stale `.env.prod` can never cause a "prod" run to silently
   deploy as dev, or vice versa.
4. Regenerates `infra/cfn-params.json` fresh every run — a build artifact,
   never hand-edit it.
5. Deploys against `STACK_NAME = ${ENV}-${SERVICE_NAME}-stack` — e.g.
   `dev-realestateflow-auth-stack` vs `prod-realestateflow-auth-stack`. Two
   distinct stacks; a `prod` run never touches dev's resources.

Every physical resource is named `${Env}-${ServiceName}-<resource>` —
e.g. `prod-realestateflow-auth-lambda` — matching the
`<env>-realestateflow-<component>` convention already live on
`prod-realestateflow-networking-common`.

## Important values in `.env.dev` / `.env.prod`

| Variable | dev | prod | Why it matters |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | dev-only Google OAuth client | **separate** prod client (GCP project `realestateflow-506712`) | Google requires the redirect URI to match the client that issued it |
| `COGNITO_DOMAIN_PREFIX_V2` | `dev-realestateflow-auth-v2` | `prod-realestateflow-auth-v2` | Must be globally unique per AWS region; also fixes the Google redirect URI |
| `SUBSCRIPTIONS_TABLE` | `dev-realestateflow-subscriptions` | `prod-realestateflow-subscriptions` | Must exactly match what `server/infra/launch-tables-cfn.yaml` names it for the *same* `EnvironmentName` — this stack only reads it |
| `SERVER_STACK_NAME` | blank | blank (server not deployed to prod yet) | Leave blank on a stack's first deploy — setting it before the export exists fails the deploy |
| `TEST_OTP_ENABLED` | `true` (skips real SMS) | **must be `false`** | Bypasses SMS delivery — a real security hole if left on in prod |
| `IDENTITY_CALLBACK_URL` / `IDENTITY_LOGOUT_URL` | `localhost:3000` | `https://app.realestateflow.in` | Must match the frontend's actual origin |
| `ALLOWED_ORIGINS` | includes `localhost` | prod domain only | CORS — never include `localhost` in prod |
| `LAMBDA_PACKAGES_BUCKET_NAME` | `dev-realestateflow-artifacts` | `prod-realestateflow-artifacts` | Separate bucket per environment, both CFN-managed (not imported/out-of-band) |
| `SUBNET_IDS` / `SECURITY_GROUP_IDS` | blank (no VPC) | private app subnets + app SG from `prod-realestateflow-networking-common` | Only the main auth Lambda is VPC-placed — the 3 Cognito trigger Lambdas deliberately are not |

Everything else (`LAMBDA_MEMORY_SIZE`, `LOG_RETENTION_IN_DAYS`, etc.) can
stay identical across both files unless you have a specific reason to
diverge.
