# infra/cicd/marketplace-api

CI/CD wrapper for the consumer marketplace API
(`apps/marketplace/marketplace-api/` — Express on Lambda behind API Gateway,
optionally fronted by CloudFront). Same design as the `property-pages-ms`,
`backend_insta_sol_ms`, `server`, and `reality-flow-authentication` wrappers
in this folder.

## What this service is

`marketplace-api` is the backend of the AI property-matching portal: cross-
agency catalogue reads, Hinglish-aware AI search, saved homes, buyer↔agency
threads, pings and site-visit booking. It reads every listing from the CRM's
internal marketplace API at request time and owns exactly one DynamoDB table
(profiles, saved items, searches, threads, messages, rate-limit counters).
It never copies property data.

Stack name: `<env>-realestateflow-marketplace-api-stack`. Every physical
resource is named `<env>-realestateflow-marketplace-api-<resource>` (e.g.
`dev-realestateflow-marketplace-api-lambda`); the table is
`<env>-realestateflow-marketplace` (PITR, `DeletionPolicy: Retain`). The
artifact bucket is `<env>-realestateflow-artifacts`.

Key stack outputs: `MarketplaceRestApiId`, `MarketplaceExecuteApiUrl` (raw
invoke URL, for dev until the domain is mapped), `MarketplaceApiBaseUrl`
(custom domain + base path; present when `EnableCustomDomainMapping=true`),
`MarketplaceDistributionDomain` / `MarketplaceDistributionId` (only when
`EnableCloudFront=true`), `MarketplaceTableName`, `LambdaFunctionName`.

## What this adds over the raw deploy script

`apps/marketplace/marketplace-api/infra/deploy.sh` does the real work:
test, install, package, upload, generate `cfn-params.json`,
`cloudformation deploy`, force an API Gateway stage redeploy. This wrapper
adds release bookkeeping around it:

- a **global 4-digit build number** (one counter across dev and prod)
- a `manifest.json` per build recording env, stack, status, git commit,
  branch, dirty flag, deployer, the exact S3 keys of the code and template
  deployed, and the CloudFront distribution ID at deploy time
- a **permanent S3 archive** of the template and params per build+env at
  `<prefix>/builds/<build>/<env>/`, never overwritten
- S3 object tags `Branch`, `DeployDate`, `Status`, `CommitId` on every
  object this script touches — the primary keys `infra/deploy.sh` uploaded
  (read back from `infra/.last-deploy-artifacts.json`) and the archive
  copies. `Status` is the real outcome of the delegate, so tagging is always
  a follow-up `put-object-tagging` call
- **CloudFront cache invalidation** after `deploy`, `rollback-code`,
  `rollback-full` and `config-deploy`, skipped cleanly when the stack has no
  distribution (`EnableCloudFront=false` is the expected state until the
  custom domain exists)
- `rollback-code` / `rollback-full`, plus `config-deploy` /
  `rollback-config` on their own numbering track (`config-versions/`)

A failed deploy is still recorded, with `status: failed`, so the attempt
stays auditable.

## Prerequisites

- AWS CLI v2, Node.js, and `zip` on `PATH`
- `apps/marketplace/marketplace-api/.env.dev` and/or `.env.prod`, copied
  from `.env.sample` and filled in — in particular `AWS_REGION`,
  `AWS_PROFILE`, `STACK_NAME`, `ARTIFACT_BUCKET`, `ARTIFACT_PREFIX`,
  `CRM_INTERNAL_API_DOMAIN_NAME` + `CRM_INTERNAL_API_BASE_PATH`,
  `MARKETPLACE_INTERNAL_API_KEY`, `CRM_CALLER_API_KEY`,
  `AUTH_CALLER_API_KEY` (32+ chars each, and the two caller keys must
  differ), `COGNITO_USER_POOL_ID`. `MARKETPLACE_API_DOMAIN_NAME` may stay
  empty while `ENABLE_CUSTOM_DOMAIN_MAPPING=false`; a raw execute-api host
  there is refused
- An AWS profile with permission to deploy the stack's Lambda, API Gateway,
  DynamoDB table, IAM role, and (if enabled) CloudFront distribution

## Usage

```bash
cd infra/cicd/marketplace-api

./deploy.sh dev                        # deploy, record a new build
./deploy.sh prod                       # deploy, record a new build
./deploy.sh list                       # all builds
./deploy.sh list prod                  # just prod builds
./deploy.sh show 0003                  # one build's manifest
./deploy.sh rollback-code prod 0002    # fast: point the Lambda at build 0002's code
./deploy.sh rollback-full prod 0002    # full: redeploy build 0002's template + params
./deploy.sh config-deploy dev          # CFN params only (allowlisted), no build
./deploy.sh list-config                # config revisions
./deploy.sh rollback-config dev 0004   # reapply an old config revision
```

Both rollback commands refuse to roll a prod stack back to a build that was
deployed to dev (or vice versa). `deploy.sh` with no arguments prints usage
rather than defaulting to any environment.

## Environment

Reads `apps/marketplace/marketplace-api/.env.<env>`. There is no plain
`.env` fallback — deliberate, so a stale generic file can never be picked up
for either environment by accident.

`deploy-versions/` and `config-versions/` are gitignored — local indexes
plus instant-access snapshots for rollback; S3 is the durable source of
truth.

## Troubleshooting

- **"env file not found"** — copy `.env.sample` to `.env.dev` / `.env.prod`
  in `apps/marketplace/marketplace-api/` and fill in the required values.
- **"MARKETPLACE_API_DOMAIN_NAME=... is a raw API Gateway host"** — leave
  it empty (mapping off) until the marketplace domain exists; the stack's
  `MarketplaceExecuteApiUrl` output is the dev URL meanwhile.
- **"CRM_CALLER_API_KEY and AUTH_CALLER_API_KEY must differ"** — generate
  two keys; one per caller so either can be rotated alone.
- **"no recorded build" on rollback** — run `./deploy.sh list`; builds are
  global across both environments.
- **Rollback's code is in Glacier/Deep Archive** — the command prints the
  exact `s3api restore-object` call; re-run once the restore completes.
- **CloudFront invalidation prints a WARNING** — the stack update is not
  gated on it; re-run `aws cloudfront create-invalidation` by hand.
