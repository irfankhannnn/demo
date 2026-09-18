# RealEstateFlow Homes (marketplace-web) — CI/CD entry point

`deploy.sh` here delegates the actual build/CFN work to the real script:

```
apps/marketplace/marketplace-web/infra/deploy.sh
```

Everything — `cfn-marketplace-web.yaml`, the build/CFN-deploy logic, the
config-only and content-only gates — lives there. What this wrapper adds on
top: **build/release tracking and rollback**, identical in design to
`infra/cicd/real-estate-crm-app` (this file was adapted from it).

This is a **static site**, not a Lambda service — there is no single "latest"
code object to version. The live web S3 bucket (versioned, per
`cfn-marketplace-web.yaml`) IS the deployed artifact; this wrapper keeps a
permanent, build-numbered **archive** of each build's `dist/` output alongside
the CFN template it was deployed with, so a build can be inspected or restored
after later deploys have overwritten the live bucket.

## Running it

```
cd infra/cicd/marketplace-web
./deploy.sh dev                          # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list                         # list every recorded build (any env)
./deploy.sh list prod                    # only prod builds
./deploy.sh show 0003                    # print one build's manifest.json
./deploy.sh rollback-content prod 0007   # fast: re-sync old dist/ + invalidate CDN
./deploy.sh rollback-full prod 0007      # full: redeploy that build's CFN + content
./deploy.sh content-deploy dev           # VITE_*-only change (rebuild+sync, no CFN)
./deploy.sh config-deploy prod           # CFN-parameter-only change (no build)
./deploy.sh list-config [env]            # recorded config revisions
./deploy.sh show-config 0002
./deploy.sh rollback-config prod 0002
```

`dev`/`prod` is required for a deploy — the script refuses to run without it.

Before allocating a build number, `deploy`/`content-deploy` run
`apps/marketplace/marketplace-web/infra/lib/env-guard.sh` against `.env.<env>`:
`VITE_MARKETPLACE_API_URL` and `VITE_MARKETPLACE_AUTH_URL` must be `https://`
URLs with no trailing slash. A raw `execute-api` / `amazonaws.com` URL is a
**warning on dev** (the API contract allows it until the custom domain is
mapped — the domain is a placeholder) and an **error on prod**. Rollbacks
re-ship an archived bundle and are not re-checked.

## Build numbers are global, not per-environment

One counter across dev **and** prod — build #7 is unambiguous by itself.
Which env a build targeted is recorded *inside* it (`manifest.json`'s `env`
field, and as a path segment in S3). `rollback-*` refuse to roll back `dev`
using a `prod` build and vice versa.

## S3 layout

One artifact bucket **per environment** (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts`, from `infra/cicd/common-infra`), set as
`ARTIFACT_BUCKET` in `.env.<env>`:

```
realestateflow-marketplace-web/builds/0001/dev/dist.tar.gz
realestateflow-marketplace-web/builds/0001/dev/cfn-marketplace-web.yaml
realestateflow-marketplace-web/builds/0002/prod/dist.tar.gz
realestateflow-marketplace-web/builds/0002/prod/cfn-marketplace-web.yaml
```

Every uploaded object gets S3 tags `Branch`, `DeployDate`, `Status`
(`deployed|failed`), `CommitId`.

## Local history

`deploy-versions/` and `config-versions/` (gitignored) hold `manifest.json`,
`history.jsonl`, the template/params snapshot and the `dist.tar.gz` for each
build on this machine. S3 is the durable source of truth.

## Custom domain (placeholder)

The public domain for the marketplace is not decided yet. Leave
`WEB_DOMAIN_NAME`, `WEB_ACM_CERTIFICATE_ARN` and `WEB_HOSTED_ZONE_ID` blank in
`.env.<env>` and the site serves from `https://<id>.cloudfront.net`. Once
decided: issue the ACM cert in **us-east-1**, fill all three, then
`./deploy.sh config-deploy <env>` — it is an allowlisted parameter change and
needs no rebuild.
