# CRM Frontend Deployment (S3 + CloudFront)

Static hosting for `real-estate-crm-app` on S3, served through CloudFront,
following the same `cfn-*.yaml` + `deploy*.ps1` pattern used by
`ai-calling-service/`.

## Stack

- `cfn-frontend.yaml` — S3 bucket (private, OAC-only access) + CloudFront
  distribution + SPA-friendly error handling (403/404 → `index.html`, 200).
- `deploy.ps1` — builds the app and deploys/updates the stack.

The S3 bucket is created in **ap-south-1 (Mumbai)**. CloudFront itself has no
region — it's a global edge network — but `PriceClass_200` (the default) is
required so requests are actually served from Indian edge locations.

## One-time setup

1. Copy the sample env file for the environment you're deploying and fill in
   real values:
   ```
   cp .env.nonprod.sample .env.nonprod
   cp .env.prod.sample .env.prod
   ```
   Each file holds both the `VITE_*` build-time config (read by `vite build
   --mode <env>`) and the `FRONTEND_*` deploy-time config (read by
   `deploy.ps1`) — one file per environment, one source of truth.

2. `FRONTEND_S3_BUCKET_NAME` must be globally unique across all of S3 — pick
   something like `cloudberry-nonprod-crm-frontend` / `cloudberry-prod-crm-frontend`
   (already the sample defaults) or your own name.

3. (Optional) Custom domain: set `FRONTEND_CUSTOM_DOMAIN_NAME` and
   `FRONTEND_ACM_CERTIFICATE_ARN`. **The ACM certificate must be requested in
   `us-east-1`** — this is a hard CloudFront requirement regardless of the
   ap-south-1 stack region. Set `FRONTEND_HOSTED_ZONE_ID` too if you want
   `deploy.ps1` to also create the Route53 alias record.

4. Make sure the AWS CLI is configured with credentials that can manage S3,
   CloudFormation and CloudFront in the target account.

## Deploying

Run from `cfn-templates-cicd/real-estate-crm-app/` (this script builds and
deploys the `real-estate-crm-app/` project two levels up):

```powershell
# nonprod
.\deploy.ps1 -Environment nonprod

# prod
.\deploy.ps1 -Environment prod
```

Note: any `npm run deploy:*` scripts in `real-estate-crm-app/package.json`
that point at the old `infra/deploy.ps1` path need updating to this new
location as well — this repo's copy of `package.json` predates that wiring,
so it wasn't found to fix here.

Each run:
1. `npm ci`
2. `vite build --mode <Environment>` (loads `.env.<Environment>`)
3. `aws cloudformation deploy` for `cfn-frontend.yaml`
4. `aws s3 sync dist/ s3://<bucket>` — hashed assets cached for 1 year,
   `index.html` set to `no-cache` so new deploys go live immediately
5. `aws cloudfront create-invalidation --paths "/*"`

Useful flags: `-SkipInstall`, `-SkipBuild`, `-SkipCfnDeploy`, `-SkipSync`,
`-SkipInvalidate` — e.g. re-sync a build without touching the CFN stack:

```powershell
.\deploy.ps1 -Environment prod -SkipCfnDeploy
```

## First deploy takes a few minutes

CloudFront distribution creation/update typically takes 5-15 minutes to
propagate globally. `aws cloudformation deploy` waits for the stack to
reach a terminal state before returning, so the script will appear to hang
during this — that's expected on the first deploy or whenever distribution
config (not just S3 content) changes.
