# Landing Pages Deployment (S3 + CloudFront)

Static hosting for `landing-pages` (the RealEstateFlow marketing site) on
S3, served through CloudFront. Follows the same
`<env>-realestateflow-<service>-<resource>` env-first naming convention as
the other frontend/backend services in this repo — see
`apps/crm/real-estate-crm-app/infra/README.md` for the sibling implementation this
one is modeled on.

This is a raw single-shot deploy script. For build/release tracking
(numbered builds, rollback), use the CI/CD wrapper one level up:
`infra/cicd/landing-pages/deploy.sh <dev|prod>` — it delegates to
this script and then records the build.

## Why this isn't just a copy of `apps/crm/real-estate-crm-app/infra/cfn-frontend.yaml`

`real-estate-crm-app` is a single-page app: one `index.html`, client-side
routing, hashed asset filenames. `landing-pages` is a **plain multi-page
static site** — 14 real pages, each its own `<page>/index.html`
(`build/scripts/process-partials.js` writes them out that way), no client
router, and fixed (non-hashed) asset filenames like `assets/main.css`. So:

- Routing is a `AWS::CloudFront::Function` (`UrlRewriteFunction` in
  `cfn-landing-pages.yaml`) that reimplements `apps/landing-pages/netlify.toml`'s
  `[[redirects]]` block at the edge: `/` → `/main/index.html`, `/legal` →
  301 to `/legal/terms`, `www.<domain>` → 301 to the apex, and every other
  extensionless path → `<path>/index.html`.
- 403/404 map to a real `/404/index.html` page (404 status), not an
  SPA-style 200 fallback.
- S3 sync (`deploy.sh` step 5) uses **short** `Cache-Control` on
  everything, not 1-year-immutable on `assets/` — the asset filenames don't
  change on every deploy the way a hashed SPA bundle's do, so long browser
  caching would mean a visitor's browser never picks up an updated
  `main.css` or logo even after a redeploy invalidates the CDN edge.
- Security headers (`ResponseHeadersPolicy`) reproduce
  `netlify.toml`'s `[[headers]]` block (CSP, HSTS, X-Frame-Options, etc.).

## Stack

- `cfn-landing-pages.yaml` — S3 bucket (private, OAC-only access) +
  CloudFront distribution + pretty-URL `CloudFront Function` + security
  `ResponseHeadersPolicy` + optional custom domain (apex + www) + optional
  Route53 alias records + optional WAF.
- `deploy.sh` — builds the site and deploys/updates the stack.

The S3 bucket is created in **ap-south-1 (Mumbai)**. CloudFront itself has
no region — it's a global edge network — but `PriceClass_200` (the
default) is required so requests are actually served from Indian edge
locations.

## One-time setup

1. Copy the sample env file for the environment you're deploying and fill
   in real values:
   ```
   cp ../.env.dev.sample ../.env.dev
   cp ../.env.prod.sample ../.env.prod
   ```
   Each file holds both the build-time `{{TOKEN}}` content config (read by
   `LP_ENV=<env> npm run build:lps`, via `build/scripts/process-partials.js`)
   and the deploy-time config (read by `infra/deploy.sh`) — one file per
   environment, one source of truth. `ENV` itself is never read from the
   file — it's forced from the `dev|prod` argument you pass on the command
   line, so a stale file can't silently deploy the wrong environment.

2. `FRONTEND_S3_BUCKET_NAME` is optional — leave it blank and `deploy.sh`
   derives it as `${ENV}-${SERVICE_NAME}` (e.g.
   `prod-realestateflow-landing-pages`), which must be globally unique
   across all of S3. Only set it explicitly if you need a different bucket
   name.

3. **Custom domain (realestateflow.in).** As of this writing there is no
   Route53 hosted zone for `realestateflow.in` in the target AWS account
   (`aws route53 list-hosted-zones` returns empty) — the domain's DNS is
   managed elsewhere. That means:
   - Request an ACM certificate for `realestateflow.in` +
     `www.realestateflow.in` **in `us-east-1`** (hard CloudFront
     requirement, regardless of the ap-south-1 stack region), using DNS
     validation. `aws acm request-certificate --region us-east-1
     --domain-name realestateflow.in --subject-alternative-names
     www.realestateflow.in --validation-method DNS`
   - ACM gives you two CNAME records to create at your domain's actual DNS
     provider (not Route53) to prove ownership. Add them there and wait
     for the cert status to become `ISSUED`.
   - Set `FRONTEND_ACM_CERTIFICATE_ARN` to that cert's ARN and
     `FRONTEND_CUSTOM_DOMAIN_NAME=realestateflow.in`, then deploy.
   - Leave `FRONTEND_HOSTED_ZONE_ID` blank (there's no zone to point it
     at). After the deploy, add a CNAME/ALIAS at your DNS provider for
     `realestateflow.in` and `www.realestateflow.in` pointing at the
     stack's `DistributionDomainName` output. If the zone is ever migrated
     into this account's Route53, set `FRONTEND_HOSTED_ZONE_ID` and
     redeploy — the stack will then manage those alias records itself.
   - Until the domain is wired up, the site is fully live and testable at
     the stack's `WebsiteURL` output (`https://<id>.cloudfront.net`).

4. Make sure the AWS CLI is configured with credentials that can manage
   S3, CloudFormation, CloudFront, and (if used) Route53/ACM in the target
   account.

## Deploying

```bash
# dev
./infra/deploy.sh dev

# prod
./infra/deploy.sh prod
```

Each run:
1. `npm ci` (in `build/`)
2. `LP_ENV=<env> npm run build:lps` (`vite build` compiles CSS, then
   `process-partials.js` expands partials, injects `{{TOKEN}}`s from
   `.env.<env>`, and copies pages/SEO files/assets into `dist/`)
3. Regenerates `infra/cfn-params.json` fresh (never hand-edit it — it's a
   build artifact, kept only as an archival/rollback snapshot)
4. `aws cloudformation deploy` for `cfn-landing-pages.yaml`
5. `aws s3 sync dist/ s3://<bucket>` — everything short-cached (see "Why
   this isn't just a copy..." above), HTML/SEO files explicitly `no-cache`
6. `aws cloudfront create-invalidation --paths "/*"`

## First deploy takes a few minutes

CloudFront distribution creation/update typically takes 5-15 minutes to
propagate globally. `aws cloudformation deploy` waits for the stack to
reach a terminal state before returning, so the script will appear to hang
during this — that's expected on the first deploy or whenever distribution
config (not just S3 content) changes.
