# infra/cicd/backend_insta_sol_ms

CI/CD wrapper for the Instagram Solution backend microservice
(`apps/instagram/backend_insta_sol_ms/`). Same design as the `server` and
`reality-flow-authentication` wrappers in this folder.

## What this adds over the raw deploy script

`apps/instagram/backend_insta_sol_ms/infra/deploy.sh` does the real work: install, package,
upload, generate `cfn-params.json`, `cloudformation deploy`. This wrapper adds
release bookkeeping around it:

- a **global 4-digit build number** (one counter across dev and prod, so
  "build 0007" is unambiguous on its own)
- a `manifest.json` per build recording env, stack, status, git commit, branch,
  dirty flag, deployer, and the exact S3 keys of the code and template that
  were deployed
- a **permanent S3 archive** of the template and params per build+env, at
  `<prefix>/builds/<build>/<env>/`, which is never overwritten
- S3 object tags `Branch`, `DeployDate`, `Status`, `CommitId` on every object
  this script touches -- both the primary keys `infra/deploy.sh` actually
  uploaded and used (read back from `infra/.last-deploy-artifacts.json`) and
  the build-archive copies. `Status` is `deployed` or `failed` -- the real
  outcome of the delegate script, which is only known after it returns, so
  tagging is always a follow-up `put-object-tagging` call rather than
  something set at upload time
- `rollback-code` / `rollback-full` commands, same split as `server` and
  `reality-flow-authentication`: `rollback-code` is a fast Lambda-code-only
  update; `rollback-full` redeploys a previous build's exact template +
  params (which also restores its code, since the code's S3 key is itself a
  CFN parameter here)

A failed deploy is still recorded, with `status: failed`, so the attempt stays
auditable rather than vanishing.

## Usage

```bash
./deploy.sh prod                      # deploy, record a new build
./deploy.sh list                      # all builds
./deploy.sh list prod                 # just prod builds
./deploy.sh show 0003                 # one build's manifest
./deploy.sh rollback-code prod 0002   # fast: point the Lambda at build 0002's code
./deploy.sh rollback-full prod 0002   # full: redeploy build 0002's template + params
```

Both rollback commands refuse to roll a prod stack back to a build that was
deployed to dev (or vice versa) -- the params carry table names, and crossing
them would point a stack at the wrong data.

## Environment

Reads `apps/instagram/backend_insta_sol_ms/.env.<env>`. `.env.prod` targets account
`532404260898` (`cloudberry-prod-new`); `.env.dev` targets `730335176275`
(`cloudberry-main`).

### Custom domains (no raw execute-api URLs)

Every API is reached as `https://<DOMAIN_NAME>/<BASE_PATH>`:

| var pair | dev | prod |
|---|---|---|
| `INSTA_API_DOMAIN_NAME` / `INSTA_API_BASE_PATH` (this stack's own mapping) | services-api.cloudberrysolutions.in / devrealestateinsta | services-api.realestateflow.in / prodrealestateinsta |
| `AUTH_SERVICE_DOMAIN_NAME` / `AUTH_SERVICE_BASE_PATH` | ... / devrealestateauth | ... / prodrealestateauth |
| `CRM_INTERNAL_API_DOMAIN_NAME` / `CRM_INTERNAL_API_BASE_PATH` | ... / devrealestatecrm | ... / prodrealestatecrm |

`infra/lib/params.sh` (`assert_custom_domain_vars`) fails both the full and
config-only deploy if a domain is empty, contains a scheme, or is a raw
execute-api / amazonaws.com host, or if a base path is empty. The CFN params
`AuthServiceUrl` and `CrmInternalApiUrl` were replaced by `AuthServiceDomainName`
+ `AuthServiceBasePath` and `CrmInternalApiDomainName` + `CrmInternalApiBasePath`,
so the first deploy after that rename must be a full deploy (config-deploy
refuses because the live stack lacks the new params). `rollback-full` to a build
from before the rename redeploys that build's own template + params and still works.

`deploy-versions/` is gitignored.
