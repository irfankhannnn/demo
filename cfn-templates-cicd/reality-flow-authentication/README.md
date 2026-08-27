# Reality Flow Auth — CI/CD entry point

This folder no longer holds its own copy of the templates. `deploy.sh` here
delegates the actual packaging/CFN work to the real script:

```
reality-flow-authentication/infra/deploy.sh
```

Everything — `cfn-backend.yaml`, `auth-explicit-routes.yaml`,
`cfn-params.sample.json`, and the packaging/CFN deploy logic itself — lives
there now. This folder used to carry its own duplicate of all four files;
they went stale (see `cfn-templates-cicd/README.md`'s 2026-08-12 audit) and
were the source of two hard deploy blockers. Deleted rather than re-synced,
so there's only one copy to ever go stale again.

What this wrapper adds on top of delegating: **build/release tracking and
rollback** — see below. That's genuinely this folder's own concern (a CI/CD
front door), not something that belongs in the plain service-level script.

## Running it

```
cd cfn-templates-cicd/reality-flow-authentication
./deploy.sh dev                        # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list dev                   # list recorded builds for dev
./deploy.sh show dev 0003              # print one build's manifest.json
./deploy.sh rollback-code prod 0007    # fast: point the Lambda at old code
./deploy.sh rollback-full prod 0007    # full: redeploy that build's CFN + code
```

`dev`/`prod` is required for a deploy — the script refuses to run without
it.

## Build/release tracking (`deploy-versions/`)

Every `./deploy.sh <dev|prod>` run records a new, sequentially numbered
build under `deploy-versions/<env>/<0001, 0002, ...>/`, **gitignored** (see
this folder's `.gitignore` and the root README's ".gitignore best
practices" section — the durable source of truth for the actual artifacts
is the versioned S3 bucket, not this local folder). Each build directory
holds:

- `manifest.json` — build number, env, status (`deployed`/`failed`), UTC
  timestamp, git commit (full + short SHA), branch, whether the working
  tree was dirty at deploy time, the deployer (`git config user.name`), the
  CFN stack name, and the S3 bucket/key/**VersionId** of both the deployed
  code (`function.zip`) and the nested routes template — the VersionId is
  what makes rollback possible, since S3 versioning (not a build-numbered
  key scheme) is the actual code-history mechanism here.
  It also records `artifact.branchArtifactKey` / `artifact.branchTemplateKey`
  — a second, **stable, never-overwritten** S3 path scoped to the git
  branch + build number that produced this deploy:
  `${ServiceName}/branches/<branch>/builds/<build>/function.zip` (and the
  routes template alongside it). Every successful deploy server-side-copies
  (no re-upload) the just-deployed artifact there. This is a convenience —
  a human-browsable "what did branch X build N actually ship" path — the
  VersionId above is still the primary rollback mechanism.
- `cfn-backend.yaml`, `auth-explicit-routes.yaml`, `cfn-params.json` — a
  local snapshot of exactly what was deployed, so a full rollback doesn't
  depend on fetching anything back from S3 (which may be sitting in Deep
  Archive by the time you need it — see the retrieval-time note below).

A **failed** deploy is still recorded (status `failed`) — worth keeping for
debugging, but it's never a valid rollback target.

`deploy-versions/<env>/LATEST` holds the current build number;
`deploy-versions/<env>/history.jsonl` is an append-only, one-line-per-build
log (grep/tail-friendly) of every manifest ever written for that env.

## Rollback

**`rollback-code <env> <build>`** — fast path. Points the live Lambda
directly at that build's exact S3 object **version** via
`aws lambda update-function-code --s3-object-version` — bypasses
CloudFormation entirely, matching how this template already handles
routine code refreshes (the `Code.S3Key` in `cfn-backend.yaml` is a fixed
`${ServiceName}/function.zip` key that never changes across deploys, so CFN
itself can't detect a code-only change — that's why a direct Lambda API
call has always been the mechanism here, rollback included).

**`rollback-full <env> <build>`** — also redeploys that build's saved CFN
template + params (a normal `aws cloudformation deploy`, using the local
snapshot — not the possibly-archived S3 copy), then does the code rollback
above. Use this if the build you're rolling back to also had different
infrastructure (Cognito config, IAM, parameters), not just different code.

Either way, a rollback is recorded as **a new build**, tagged
`rollbackOf: "<original build>"` — consistent with standard CI/CD practice
(a rollback is a new forward release, not an edit to history).

**Deep Archive retrieval caveat:** the shared artifact bucket's noncurrent
(superseded) versions move to S3 Glacier Deep Archive after 60 days (see
`cfn-templates-cicd/common-infra/vpc-networking.yaml`). Deep Archive's
fastest retrieval tier is ~12 hours — there is no faster option for this
storage class. If `rollback-code` targets a build old enough to have
archived, it detects this, prints the exact `aws s3api restore-object`
command to run, and tells you to re-run once the restore completes. Local
CFN template/param snapshots are unaffected by this — `rollback-full`
doesn't need to wait on Deep Archive at all for the template side.

## What the `dev`/`prod` argument actually does

There is **one CloudFormation template** (`cfn-backend.yaml`), used
unchanged for both environments. Nothing about the template file itself
switches on the argument — only the *parameter values* passed into it do.
Concretely, `infra/deploy.sh <env>`:

1. Resolves `ENV_FILE = reality-flow-authentication/.env.<env>` — i.e. the
   argument selects **which env file gets read**, `.env.dev` or `.env.prod`.
   There's no `.env` fallback anymore; omitting the argument is an error.
2. `source`s that file, pulling every variable into the shell.
3. **Overwrites** `ENV` with the CLI argument regardless of what the file
   says — so a stale or copy-pasted `.env.prod` can never cause a "prod" run
   to silently deploy as "dev" (or vice versa). This is the one value the
   file is not trusted for.
4. Regenerates `infra/cfn-params.json` from scratch on every run, populated
   entirely from what was just sourced. This file is a build artifact, not
   something to hand-edit — it gets overwritten the next time either command
   runs.
5. Calls `aws cloudformation deploy` with those parameters against
   `STACK_NAME = ${ENV}-${SERVICE_NAME}-stack` — e.g. `dev-realestateflow-auth-stack`
   vs `prod-realestateflow-auth-stack`. Two distinct stacks, so a `prod` run
   never touches dev's resources and vice versa; both can exist in the
   account at the same time.

Every physical resource the template creates is named
`${Env}-${ServiceName}-<resource>` (Cognito pool, Lambdas, IAM roles,
DynamoDB tables, the REST API) — e.g. `prod-realestateflow-auth-lambda`.
This matches the `<env>-realestateflow-<component>` naming already live on
`prod-realestateflow-networking-common` in the prod account (532404260898,
profile `cloudberry-prod-new`), rather than putting the service name first.

## Important values in `.env.dev` / `.env.prod`

| Variable | dev | prod | Why it matters |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | dev-only Google OAuth client | **separate** prod client (GCP project `realestateflow-506712`) | Google requires the redirect URI to match the client that issued it — reusing dev's client against prod's Cognito domain will fail login |
| `COGNITO_DOMAIN_PREFIX_V2` | `dev-realestateflow-auth-v2` | `prod-realestateflow-auth-v2` | Must be globally unique per AWS region; also fixes the Google redirect URI (`https://<this>.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`) |
| `SUBSCRIPTIONS_TABLE` | `realestateflow-dev-subscriptions` | `realestateflow-prod-subscriptions` | Must exactly match what `server/infra/launch-tables-cfn.yaml` names the table for the *same* `EnvironmentName` — this stack only reads it, it doesn't create it. Note server/infra hasn't been flipped to the env-first convention yet, so this stays prefix-first until it is |
| `SERVER_STACK_NAME` | blank | blank (server stack not deployed to prod yet) | Leave blank on a stack's first deploy — setting it before the export exists fails the deploy. Once the matching server stack is live, set this to its real `StackName` to switch to the live cross-stack export instead of the static `SUBSCRIPTIONS_TABLE` value above |
| `TEST_OTP_ENABLED` | `true` (skips real SMS) | **must be `false`** | Bypasses SMS delivery with a fixed OTP — a real security hole if left on in prod |
| `IDENTITY_CALLBACK_URL` / `IDENTITY_LOGOUT_URL` | `localhost:3000` | `https://app.realestateflow.in` | Must match the frontend's actual origin for that environment |
| `ALLOWED_ORIGINS` | includes `localhost` | prod domain only | CORS — never include `localhost` in prod |
| `LAMBDA_PACKAGES_BUCKET_NAME` | `realestate-flow-lambda-packages` | `realestate-flow-lambda-packages-prod` | **Different bucket per environment** — verified live via `aws s3 ls`; dev and prod artifact buckets are NOT shared, unlike the auth README originally assumed |
| `SUBNET_IDS` / `SECURITY_GROUP_IDS` | blank (no VPC) | private app subnets + app SG from `prod-realestateflow-networking-common` | Only the main auth Lambda is placed in the prod VPC — the 3 Cognito trigger Lambdas deliberately are not (see the `VpcConfig` comment in `cfn-backend.yaml`) |

Everything else (`LAMBDA_MEMORY_SIZE`, `LOG_RETENTION_IN_DAYS`, etc.) can stay
identical across both files unless you have a specific reason to diverge.
