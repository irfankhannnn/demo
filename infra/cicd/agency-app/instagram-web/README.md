# infra/cicd/agency-app/instagram-web

CI/CD wrapper for the Instagram Solution frontend app
(`agency-app/instagram-web/`). Same design as the `server` and
`reality-flow-authentication` wrappers in this folder.

## What this adds over the raw deploy script

`agency-app/instagram-web/infra/deploy.sh` does the real work: install, package,
upload, generate `cfn-params.json`, `cloudformation deploy`. This wrapper adds
release bookkeeping around it:

- a **global 4-digit build number** (one counter across dev and prod, so
  "build 0007" is unambiguous on its own)
- a `manifest.json` per build recording env, stack, status, git commit, branch,
  dirty flag, deployer, and the exact S3 key of the code that was deployed
- a **permanent S3 archive** of the template and params per build+env, at
  `<prefix>/builds/<build>/<env>/`, which is never overwritten
- S3 object tags `Branch`, `DeployDate`, `Status`, `CommitId`. `Status` is
  `deployed` or `failed` -- the real outcome of the delegate script, which is
  only known after it returns, so tagging is always a follow-up
  `put-object-tagging` call rather than something set at upload time
- a `rollback` command that redeploys a previous build's exact template + params

A failed deploy is still recorded, with `status: failed`, so the attempt stays
auditable rather than vanishing.

## Usage

```bash
./deploy.sh prod                 # deploy, record a new build
./deploy.sh list                 # all builds
./deploy.sh list prod            # just prod builds
./deploy.sh show 0003            # one build's manifest
./deploy.sh rollback prod 0002   # redeploy build 0002's template + params
```

`rollback` refuses to roll a prod stack back to a build that was deployed to dev
(or vice versa) -- the params carry table names, and crossing them would point a
stack at the wrong data.

## Environment

Reads `agency-app/instagram-web/.env.<env>`. `.env.prod` targets account
`532404260898` (`cloudberry-prod-new`); `.env.dev` targets `730335176275`
(`cloudberry-main`).

The bundle calls the Instagram API at
`https://<VITE_INSTA_API_DOMAIN_NAME>/<VITE_INSTA_API_BASE_PATH>/api/insta`
(dev: services-api.cloudberrysolutions.in / devrealestateinsta; prod:
services-api.realestateflow.in / prodrealestateinsta). `VITE_API_BASE_URL` no
longer exists. `infra/lib/api-domain-guard.sh` makes `deploy.sh`,
`config-deploy.sh` and `content-deploy.sh` fail if the domain is empty, has a
scheme, or is a raw execute-api / amazonaws.com host, or if the base path is
empty. The app code rejects raw API Gateway hosts as well (`src/lib/serviceUrl.ts`).

`deploy-versions/` is gitignored.

## Static-site specifics

Unlike the Lambda wrappers, there is no single versioned code object to point at
-- the live S3 bucket *is* the deployed artifact, and `s3 sync --delete` removes
files a later build no longer ships. So each build additionally archives its
actual `dist/` output as `dist.tar.gz`, and `rollback` restores that content to
the bucket and invalidates `/insta/*`. Without it a CFN-only rollback would
change nothing a user could see.
