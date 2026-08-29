# Deployment

Two deployable stacks plus a laptop app. Both stacks follow the repo's established
pattern: the real work lives in `<service>/infra/deploy.sh`, and
`cfn-templates-cicd/<service>/deploy.sh` wraps it with build tracking.

## Ground truth for this account

Verified live on 2026-08-29, not read from a checked-in doc — this repo has a history of
audit docs that disagreed with reality.

| Thing | Value |
|---|---|
| Account | `532404260898` (profile `cloudberry-prod-new`, also the default profile) |
| Region | `ap-south-1` |
| Artifact bucket | `prod-realestateflow-artifacts` |
| Auth service | `https://0e40r6uwoh.execute-api.ap-south-1.amazonaws.com/prod` |
| VPC / subnets / SG | exist, but this service does not use them (see below) |
| CloudFront | **none exists yet** — the CRM frontend stack has never been deployed |

`dev` does not exist in this account. Every `.env.dev` in this feature is placeholders
with the correct naming, marked `REPLACE_ME_*`. Per the project memory, `cloudberry-main`
(`730335176275`) is **not** the target account, so do not point dev at it without asking.

## Why no VPC

The Lambda talks to DynamoDB (a public AWS API endpoint) and to the auth service over
HTTPS. Nothing it touches is inside the VPC. Per the repo's CFN checklist, pure AWS-API
Lambdas do not belong in a VPC — it only buys ENI cold-start latency and a NAT
dependency. If a future phase needs private access, wire `VpcConfig` conditionally on
non-empty subnet/SG parameters rather than unconditionally.

## Backend

```bash
cd backend_insta_sol_ms
./infra/deploy.sh prod                            # direct
# or, with build tracking (preferred):
../cfn-templates-cicd/backend_insta_sol_ms/deploy.sh prod
```

The script refuses to run without an explicit `dev`/`prod` argument, sources
`.env.<env>`, then **forces** `ENVIRONMENT_NAME` from the CLI argument rather than
trusting the file — that is what stops a stale env file deploying dev as prod. It then
validates required vars, asserts `STACK_NAME` and both table names start with
`<env>-realestateflow-`, prints the resolved AWS account before doing anything, and
regenerates `cfn-params.json` from scratch.

It also cross-checks the generated params against the template's declared parameters and
**hard-fails** if it would pass a parameter the template does not declare (that failure
mode has bitten this repo before, with `CognitoUserPoolId`/`CognitoClientId`), while
warning about template parameters never passed, which silently fall back to defaults.

Creates:

| Resource | Name |
|---|---|
| Stack | `prod-realestateflow-insta-stack` |
| Lambda | `prod-realestateflow-insta-lambda` (nodejs20.x) |
| API Gateway | `prod-realestateflow-insta-api`, stage `v1` |
| Table | `prod-realestateflow-insta-data` (Retain, PITR, GSI1) |
| Table | `prod-realestateflow-insta-audit` (TTL only, no Retain) |
| Role | `prod-realestateflow-insta-lambda-role` |
| Log group | `/aws/lambda/prod-realestateflow-insta-lambda`, 30-day retention |

The IAM role can reach exactly those two table ARNs and its own log group. No CRM table
is reachable from this service at all — the isolation is enforced by IAM, not by
convention or code review.

## Frontend

```bash
cd frontend_insta_sol_ms
./infra/deploy.sh prod
```

Builds with Vite, deploys the bucket stack, syncs `dist/` to `s3://<bucket>/insta/`, and
invalidates `/insta/*` if a distribution is configured. Hashed assets get a one-year
immutable cache header; `index.html` gets `no-cache` so a deploy is visible immediately.

Full CloudFront wiring is a three-step sequence documented in
`09-CLOUDFRONT-INTEGRATION.md`. Only step 1 can be completed today because no CloudFront
distribution exists in the account yet.

## Laptop agent

Not deployed — installed. See `05-LOCAL-AGENT.md` and `07-META-APP-SETUP.md`.

## Build tracking and rollback

```bash
./deploy.sh list             # every recorded build
./deploy.sh list prod        # filtered
./deploy.sh show 0003        # manifest: env, stack, status, commit, deployer, code S3 key
./deploy.sh rollback prod 0002
```

Build numbers are global across environments, so "build 0007" is unambiguous. Each build
archives its template, params and manifest permanently to
`s3://<artifact-bucket>/<prefix>/builds/<build>/<env>/`, tagged `Branch`, `DeployDate`,
`Status`, `CommitId`. Failed deploys are recorded with `status: failed` rather than
disappearing.

`rollback` refuses to roll a prod stack back to a build deployed to dev, or vice versa —
the params carry table names and crossing them would point a stack at the wrong data.

The frontend wrapper additionally archives each build's `dist.tar.gz`, because for a
static site the live bucket *is* the artifact and `s3 sync --delete` destroys what an
older build shipped. Its `rollback` restores that content and re-invalidates; a CFN-only
rollback would change nothing a user could see.

## Teardown

Both DynamoDB tables and both S3 buckets are `DeletionPolicy: Retain`. Deleting the
stacks leaves the data behind on purpose. Removing it is a deliberate manual step.

## Known gaps

| Gap | Why | To finish |
|---|---|---|
| `/insta/*` behavior not live | no CloudFront distribution exists in the account | deploy the CRM frontend stack with `InstaFrontendBucketDomainName` set, then re-run the frontend deploy with `CRM_DISTRIBUTION_ID` |
| `VITE_API_BASE_URL` in `.env.prod` | filled in from the real stack output after the backend deploy | already set post-deploy; re-check if the API is recreated |
| `.env.dev` files | no dev environment exists in this account | replace the `REPLACE_ME_*` values once a dev account is chosen |
| Custom domain for the API | no ACM cert or domain configured for this service | add `EnableCustomDomainMapping`-style params if the API should sit behind `api.realestateflow.in` |
