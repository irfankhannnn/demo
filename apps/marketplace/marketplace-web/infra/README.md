# marketplace-web deployment (S3 + CloudFront)

Static hosting for RealEstateFlow Homes (`apps/marketplace/marketplace-web`)
on S3, served through CloudFront. Same `<env>-realestateflow-<service>-<resource>`
env-first naming as every other stack in this repo; mirrors
`apps/crm/real-estate-crm-app/infra/` closely.

This is a raw single-shot deploy. For build/release tracking (numbered
builds, rollback) use the CI/CD wrapper: `infra/cicd/marketplace-web/deploy.sh <dev|prod>`.

## Files

| File | Purpose |
|---|---|
| `cfn-marketplace-web.yaml` | Private S3 bucket (OAC only) + CloudFront + SPA 403/404 → `/index.html` rewrite + security headers policy. Custom domain is optional and a **placeholder** (domain TBD): `WebDomainName`, `AcmCertificateArn`, `HostedZoneId` default to `''`; the alias, certificate and Route53 A/AAAA records are only created when all three are set. |
| `deploy.sh <dev|prod> [--skip-build\|--skip-cfn]` | `npm ci` → `vite build --mode <env>` → CFN deploy → `s3 sync` (hashed assets `immutable`, `index.html`/`robots.txt`/`favicon.svg` `max-age=0`) → CloudFront invalidation. |
| `content-deploy.sh <env>` | VITE_*-only change: verifies no CFN parameter differs from the live stack, then `deploy.sh --skip-cfn`. |
| `config-deploy.sh <env>` | CFN-parameter-only change: diffs live params vs `.env.<env>`, refuses anything not in `config-only-allowed-params.json`, then `deploy.sh --skip-build`. |
| `config-only-allowed-params.json` | Fail-closed allowlist for `config-deploy.sh`. |
| `lib/params.sh` | Single source of truth for the CFN parameter set + the all-or-nothing custom-domain check. |
| `lib/env-guard.sh` | Validates `VITE_MARKETPLACE_API_URL` / `VITE_MARKETPLACE_AUTH_URL` (https, no trailing slash; raw execute-api is a warning on dev, an error on prod). |

## Env file

`deploy.sh dev` reads `.env.dev`; `deploy.sh prod` reads `.env.prod` (copy from
`.env.dev.sample` / `.env.prod.sample`). The env argument is the source of truth,
never the file. Keys:

- `AWS_REGION` (ap-south-1), `AWS_PROFILE` (optional), `SERVICE_NAME=realestateflow-marketplace-web`
- `WEB_S3_BUCKET_NAME` (blank = `<env>-realestateflow-marketplace-web`), `WEB_PRICE_CLASS`
- `WEB_DOMAIN_NAME`, `WEB_ACM_CERTIFICATE_ARN` (us-east-1!), `WEB_HOSTED_ZONE_ID` — all three or none
- `WEB_WAF_WEB_ACL_ARN` (optional), `ARTIFACT_BUCKET` (for the CI/CD wrapper)
- `VITE_*` — baked into the bundle at build time

## One-time setup

1. AWS CLI v2 + Node 20+ on PATH (Git Bash on Windows uses `aws.exe` / `npm.cmd` automatically).
2. Credentials that can manage S3, CloudFormation, CloudFront (and Route53 if a domain is set).
3. If/when the marketplace domain is decided: issue an ACM certificate **in us-east-1**, then fill the three `WEB_*` domain vars.

## Deploying

```bash
./infra/deploy.sh dev
./infra/deploy.sh prod
./infra/content-deploy.sh dev     # VITE_* change only
./infra/config-deploy.sh prod     # domain / cert / price class / WAF only
```

The first CloudFront distribution creation, and any later change to its
config, takes 5–15 minutes to propagate; `aws cloudformation deploy` waits.

## Rollback

Bucket versioning is on (30-day noncurrent expiry). For numbered builds and
`rollback-content` / `rollback-full`, use `infra/cicd/marketplace-web/deploy.sh`.
