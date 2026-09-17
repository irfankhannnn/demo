# CloudFront Integration — serving the app at `/insta/*`

The Instagram Solution frontend is served **same-origin** with the CRM, as a second
origin plus an `/insta/*` cache behavior on the existing CRM distribution. This was a
deliberate choice over a separate distribution: same origin means the CRM's stored
bearer token is readable by the app with no cross-domain handoff, and the API needs no
CORS for the browser path.

## What was changed

One existing file was edited — `agency-app/web/infra/cfn-frontend.yaml` — and every
addition is behind a condition, so the template behaves exactly as before when the new
parameter is left empty.

| Added | Type | Condition |
|---|---|---|
| `InstaFrontendBucketDomainName` | Parameter, default `''` | — |
| `InstaFrontendPathPattern` | Parameter, default `/insta/*` | — |
| `HasInstaFrontend` | Condition | set when the domain name is non-empty |
| `InstaSpaRewriteFunction` | `AWS::CloudFront::Function` | `HasInstaFrontend` |
| `InstaOriginAccessControl` | `AWS::CloudFront::OriginAccessControl` | `HasInstaFrontend` |
| `InstaS3Origin` | extra entry in `Origins` | `!If` / `AWS::NoValue` |
| `/insta/*` behavior | `CacheBehaviors` | `!If` / `AWS::NoValue` |
| `InstaAppURL` | Output | `HasInstaFrontend` |

Nothing else in that template was touched. Deploying it with the parameter unset is a
no-op change.

## The three moving parts that must agree

This is the part that breaks if someone changes one of them in isolation.

| Where | Value | Why |
|---|---|---|
| `agency-app/instagram-web/vite.config.ts` | `base: '/insta/'` | makes the build emit asset URLs under `/insta/` |
| `agency-app/instagram-web/infra/deploy.sh` | syncs to `s3://<bucket>/insta/` | the behavior forwards the **full** path (there is no `OriginPath`), so the S3 key must include `insta/` |
| `InstaSpaRewriteFunction` | rewrites to `/insta/index.html` | SPA deep links |

Change one and the app 404s.

## Why the rewrite function exists

CloudFront's `CustomErrorResponses` are **distribution-wide**, not per-behavior. The CRM
distribution already maps 403/404 to `/index.html` so React Router deep links work. Left
alone, a deep link like `/insta/enquiries` would miss in S3 and get served the **CRM's**
`index.html` — dropping the user into the wrong application with no error.

The viewer-request function fixes this at the edge: any `/insta/*` path with no file
extension is rewritten to `/insta/index.html`, so the Instagram app resolves its own
routes. Requests with an extension (`.js`, `.css`, `.png`) pass through untouched.

## Deploy order

The bucket and the distribution live in different stacks, and the bucket policy has to
name the distribution, so this is a three-step sequence. It only has to be done once per
environment; after that, content deploys are a single command.

```
1. agency-app/instagram-web/infra/deploy.sh prod        (CRM_DISTRIBUTION_ID empty)
   -> creates prod-realestateflow-insta-frontend bucket
   -> note the InstaFrontendBucketRegionalDomainName output
   -> bucket is private and unreadable. This is correct at this stage.

2. agency-app/web/infra/deploy.sh prod
   with InstaFrontendBucketDomainName=<that output>
   -> adds the origin, OAC, rewrite function and /insta/* behavior
   -> note the DistributionId output

3. set CRM_DISTRIBUTION_ID=<that id> in agency-app/instagram-web/.env.prod
   agency-app/instagram-web/infra/deploy.sh prod
   -> attaches the bucket policy scoped to exactly that distribution
   -> /insta/ now serves
```

Subsequent frontend deploys are just step 3's command — build, sync, invalidate.

## Current state in account 532404260898

**Step 2 cannot run yet.** As of 2026-08-29 there is no CloudFront distribution in this
account and the CRM frontend stack has never been deployed:

```
$ aws cloudfront list-distributions --profile cloudberry-prod-new
null
```

So the template change is committed and validated but **inert**. What has been deployed
is step 1 — the S3 bucket — which is exactly the safe intermediate state described above.

Finishing the wiring requires deploying the CRM frontend stack, which is outside the
scope of this branch: it would stand up the CRM's own production distribution, and that
is the CRM team's call, not something this feature should trigger as a side effect.

**To finish later:** deploy the CRM frontend stack with `InstaFrontendBucketDomainName`
set to `prod-realestateflow-insta-frontend.s3.ap-south-1.amazonaws.com`, then run step 3.

## Auth handoff

Because the app is same-origin, there is no token handoff to build: `localStorage` is
shared across the whole domain, so the app reads the CRM's existing token directly. The
`?token=` query-param path in `src/api/client.ts` is a fallback that only matters if the
app is ever moved to its own domain — it is deliberately kept so that move stays cheap.

The CRM links to the app at `https://<crm-domain>/insta/`, exposed as the `InstaAppURL`
stack output.
