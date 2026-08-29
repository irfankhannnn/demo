# cfn-templates-cicd/backend_insta_sol_ms

CI/CD wrapper for the Instagram Solution backend microservice
(`backend_insta_sol_ms/`). Same design as the `server` and
`reality-flow-authentication` wrappers in this folder.

## What this adds over the raw deploy script

`backend_insta_sol_ms/infra/deploy.sh` does the real work: install, package,
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

Reads `backend_insta_sol_ms/.env.<env>`. `.env.prod` is filled in with values
verified live against account `532404260898`. `.env.dev` is placeholders: no dev
environment exists in this account yet.

`deploy-versions/` is gitignored.
