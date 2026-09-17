# infra/cicd/public-app/property-pages

CI/CD wrapper for the public property-pages microservice (`public-app/property-pages/`
— server-rendered, tenant-branded listing/booking pages, served from Express
on Lambda behind API Gateway, optionally fronted by CloudFront). Same design
as the `backend_insta_sol_ms`, `server`, and `reality-flow-authentication`
wrappers in this folder.

## What this service is

`property-pages-ms` renders public property listing and booking pages for a
CRM tenant, addressed as `<agency-slug>.<PUBLIC_PAGES_BASE_DOMAIN>` (or
`/t/<agency-slug>/...` as a path fallback before DNS is wired). It talks to
the CRM's internal API for listing data and writes bookings back through it;
it owns no CRM tables of its own, only a small DynamoDB guard table for
rate-limit counters and single-use booking nonces.

Stack name: `<env>-realestateflow-pages-stack`. Every physical resource is
named `<env>-realestateflow-pages-<resource>` (e.g.
`dev-realestateflow-pages-lambda`). The artifact bucket is
`<env>-realestateflow-artifacts`.

Key stack outputs: `PagesRestApiId`, `PagesApiBaseUrl` (custom domain + base
path, bypasses CloudFront; present when `EnableCustomDomainMapping=true`), `PagesDistributionDomain` / `PagesDistributionId`
(only present when `EnableCloudFront=true`), `GuardTableName`,
`LambdaFunctionName`.

## What this adds over the raw deploy script

`public-app/property-pages/infra/deploy.sh` does the real work: test, install,
package, upload, generate `cfn-params.json`, `cloudformation deploy`, force
an API Gateway stage redeploy. This wrapper adds release bookkeeping around
it:

- a **global 4-digit build number** (one counter across dev and prod, so
  "build 0007" is unambiguous on its own)
- a `manifest.json` per build recording env, stack, status, git commit,
  branch, dirty flag, deployer, the exact S3 keys of the code and template
  that were deployed, and the CloudFront distribution ID at deploy time
- a **permanent S3 archive** of the template and params per build+env, at
  `<prefix>/builds/<build>/<env>/`, which is never overwritten
- S3 object tags `Branch`, `DeployDate`, `Status`, `CommitId` on every
  object this script touches — both the primary keys `infra/deploy.sh`
  actually uploaded and used (read back from
  `infra/.last-deploy-artifacts.json`) and the build-archive copies.
  `Status` is `deployed` or `failed` — the real outcome of the delegate
  script, which is only known after it returns, so tagging is always a
  follow-up `put-object-tagging` call rather than something set at upload
  time
- **CloudFront cache invalidation.** HTML is cached at the edge, so a code
  change is otherwise invisible to visitors until the cache naturally
  expires. `deploy`, `rollback-code`, and `rollback-full` all invalidate
  `/*` on the stack's distribution after they finish, and skip cleanly (no
  error) when the stack has none — CloudFront is optional here via the
  `EnableCloudFront` CFN parameter, and dev stacks may run without it
- `rollback-code` / `rollback-full` commands, same split as the other
  Lambda-backed wrappers: `rollback-code` is a fast Lambda-code-only
  update; `rollback-full` redeploys a previous build's exact template +
  params (which also restores its code, since the code's S3 key is itself a
  CFN parameter here)

A failed deploy is still recorded, with `status: failed`, so the attempt
stays auditable rather than vanishing.

## Prerequisites

- AWS CLI v2, Node.js, and `zip` on `PATH` (the inner `infra/deploy.sh`
  needs `zip`; this wrapper needs `aws` and `node`)
- `public-app/property-pages/.env.dev` and/or `.env.prod`, copied from
  `public-app/property-pages/.env.sample` and filled in — in particular
  `AWS_REGION`, `AWS_PROFILE`, `STACK_NAME`, `ARTIFACT_BUCKET`,
  `ARTIFACT_PREFIX`, `CRM_INTERNAL_API_DOMAIN_NAME` + `CRM_INTERNAL_API_BASE_PATH`,
  `PAGES_API_DOMAIN_NAME` + `PAGES_API_BASE_PATH` (with
  `ENABLE_CUSTOM_DOMAIN_MAPPING=true` and `ENABLE_BASE_PATH_STRIP=true`; the
  delegate script rejects empty values and raw execute-api hosts),
  `PUBLIC_PAGES_INTERNAL_API_KEY`,
  and a 32+ character `VISIT_SESSION_SECRET` (the delegate script refuses to
  run without these; see `.env.sample` for the full annotated list)
- An AWS profile with permission to deploy the stack's Lambda, API Gateway,
  DynamoDB table, and (if `EnableCloudFront=true`) CloudFront distribution

## Usage

```bash
cd infra/cicd/public-app/property-pages

./deploy.sh dev                        # deploy, record a new build
./deploy.sh prod                       # deploy, record a new build
./deploy.sh list                       # all builds
./deploy.sh list prod                  # just prod builds
./deploy.sh show 0003                  # one build's manifest
./deploy.sh rollback-code prod 0002    # fast: point the Lambda at build 0002's code
./deploy.sh rollback-full prod 0002    # full: redeploy build 0002's template + params
```

Both rollback commands refuse to roll a prod stack back to a build that was
deployed to dev (or vice versa) — the params carry table/bucket names, and
crossing them would point a stack at the wrong data.

`deploy.sh` (with no arguments) refuses to run and prints usage rather than
defaulting to any environment — `dev` or `prod` must always be typed
explicitly.

### First CloudFront distribution

When `EnableCloudFront=true` and this is the stack's first deploy, expect
`cloudformation deploy` to take **5-15 minutes** while the distribution
propagates globally — this is normal CloudFront provisioning time, not a
hang. Subsequent deploys that don't change the distribution's configuration
are fast; only the invalidation (a minute or two) runs on every deploy.

## Environment

Reads `public-app/property-pages/.env.<env>`. There is no plain `.env` fallback —
this is deliberate, so a stale generic file can never be picked up for
either environment by accident.

`deploy-versions/` is gitignored — it's a local index plus instant-access
template/param snapshots for rollback; S3 is the durable, shareable source
of truth and can rebuild it on demand.

## Rollback

- **`rollback-code <env> <build>`** — fast path. Points the Lambda directly
  at a previously uploaded `function.zip` in S3, then invalidates
  CloudFront. No CFN change, so it doesn't touch the DynamoDB table, API
  Gateway routes, or any other resource shape — only what the Lambda runs.
- **`rollback-full <env> <build>`** — redeploys that build's exact saved CFN
  template and parameters (restoring its code too, since the code's S3 key
  is itself a template parameter), then invalidates CloudFront. Use this
  when the rollback needs to undo a template change (new parameter, changed
  resource), not just a code change.

Both commands pull the build's manifest from S3 if it isn't cached locally,
and both verify the manifest's recorded environment matches the one you
passed before touching anything — this check runs unconditionally, never
skipped just because a template/params snapshot happened to already be on
disk.

## Troubleshooting

- **"env file not found"** — copy `public-app/property-pages/.env.sample` to
  `.env.dev` or `.env.prod` in `public-app/property-pages/` and fill in the
  required values; this wrapper (via the delegate script) refuses to guess.
- **"no recorded build" on rollback** — run `./deploy.sh list` to see what
  build numbers actually exist; builds are global across both environments,
  so a number from a dev deploy will fail `verify_build_env` against prod
  (and vice versa) even if the number itself exists.
- **Rollback's code is in Glacier/Deep Archive** — the command prints the
  exact `s3api restore-object` call to run and the head-object check to
  poll; re-run the rollback once the restore completes (~12h for Deep
  Archive standard tier).
- **CloudFront invalidation prints a WARNING but the deploy still
  succeeded** — the stack update itself is not gated on invalidation
  succeeding; re-run `aws cloudfront create-invalidation --distribution-id
  <id> --paths "/*"` by hand once whatever transient issue caused the
  failure (permissions, throttling) is resolved.
- **Stale HTML after a deploy despite invalidation succeeding** — check the
  browser/CDN edge cache-control headers the app is sending
  (`PAGE_CACHE_SECONDS` / `ASSET_CACHE_SECONDS` in `.env.<env>`); an
  invalidation clears CloudFront's cache but not a client's own.
