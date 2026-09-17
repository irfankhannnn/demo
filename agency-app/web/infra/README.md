# CRM Frontend Deployment (S3 + CloudFront)

Static hosting for `real-estate-crm-app` on S3, served through CloudFront.
Follows the same `<env>-realestateflow-<service>-<resource>` env-first
naming convention as the backend services (`agency-app/api/`,
`platform/auth/`) — see `infra/cicd/platform/auth`
for the reference implementation.

This is a raw single-shot deploy script. For build/release tracking
(numbered builds, rollback), use the CI/CD wrapper one level up:
`infra/cicd/agency-app/web/deploy.sh <dev|prod>` — it delegates
to this script and then records the build.

## Stack

- `cfn-frontend.yaml` — S3 bucket (private, OAC-only access) + CloudFront
  distribution + SPA-friendly error handling (403/404 → `index.html`, 200).
- `deploy.sh` — builds the app and deploys/updates the stack.

The S3 bucket is created in **ap-south-1 (Mumbai)**. CloudFront itself has no
region — it's a global edge network — but `PriceClass_200` (the default) is
required so requests are actually served from Indian edge locations.

## One-time setup

1. Copy the sample env file for the environment you're deploying and fill in
   real values:
   ```
   cp .env.dev.sample .env.dev
   cp .env.prod.sample .env.prod
   ```
   Each file holds both the `VITE_*` build-time config (read by `vite build
   --mode <env>`) and the deploy-time config (read by `infra/deploy.sh`) —
   one file per environment, one source of truth. `ENV` itself is never read
   from the file — it's forced from the `dev|prod` argument you pass on the
   command line, so a stale file can't silently deploy the wrong environment.

   API endpoints are configured per API as a bare custom-domain host + a
   single-segment base path — `VITE_CRM_API_DOMAIN_NAME`/`VITE_CRM_API_BASE_PATH`,
   `VITE_AUTH_API_DOMAIN_NAME`/`VITE_AUTH_API_BASE_PATH`, and the optional
   `VITE_MCP_API_DOMAIN_NAME`/`VITE_MCP_API_BASE_PATH` (dev:
   `services-api.cloudberrysolutions.in` + `devrealestatecrm`/`devrealestateauth`/
   `devrealestatemcp`; prod: `services-api.realestateflow.in` + `prod…`).
   `src/config/apiConfig.ts` appends `/api` and `/mcp`. Every deploy script
   runs `lib/api-domain-guard.sh`, which refuses an empty domain or base path,
   a raw `execute-api`/`amazonaws.com` host, a value containing `://`, and the
   removed `VITE_API_URL`/`VITE_API_BASE_URL`/`VITE_AUTH_API_URL` vars.

2. `FRONTEND_S3_BUCKET_NAME` is optional — leave it blank and `deploy.sh`
   derives it as `${ENV}-${SERVICE_NAME}` (e.g. `dev-realestateflow-crm-frontend`),
   which must be globally unique across all of S3. Only set it explicitly if
   you need a different bucket name.

3. (Optional) Custom domain: set `FRONTEND_CUSTOM_DOMAIN_NAME` and
   `FRONTEND_ACM_CERTIFICATE_ARN`. **The ACM certificate must be requested in
   `us-east-1`** — this is a hard CloudFront requirement regardless of the
   ap-south-1 stack region. Set `FRONTEND_HOSTED_ZONE_ID` too if you want
   `deploy.sh` to also create the Route53 alias record.

4. Make sure the AWS CLI is configured with credentials that can manage S3,
   CloudFormation and CloudFront in the target account.

## Deploying

```bash
# dev
./infra/deploy.sh dev

# prod
./infra/deploy.sh prod
```

Each run:
1. `npm ci`
2. `vite build --mode <env>` (loads `.env.<env>`)
3. Regenerates `infra/cfn-params.json` fresh (never hand-edit it — it's a
   build artifact, kept only as an archival/rollback snapshot)
4. `aws cloudformation deploy` for `cfn-frontend.yaml`
5. `aws s3 sync dist/ s3://<bucket>` — hashed assets cached for 1 year,
   `index.html` set to `no-cache` so new deploys go live immediately
6. `aws cloudfront create-invalidation --paths "/*"`

## First deploy takes a few minutes

CloudFront distribution creation/update typically takes 5-15 minutes to
propagate globally. `aws cloudformation deploy` waits for the stack to
reach a terminal state before returning, so the script will appear to hang
during this — that's expected on the first deploy or whenever distribution
config (not just S3 content) changes.
