# cfn-templates-cicd/ai-calling-service

CI/CD wrapper for the AI calling microservice (`ai-calling-service/`). Same
design as the `server`, `reality-flow-authentication` and
`backend_insta_sol_ms` wrappers in this folder.

## What this adds over the raw deploy script

`ai-calling-service/infra/deploy.sh` does the real work: install, package,
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
- `rollback-code` / `rollback-full` commands: `rollback-code` is a fast
  Lambda-code-only update; `rollback-full` redeploys a previous build's exact
  template + params (which also restores its code, since the code's S3 key is
  itself a CFN parameter here)

A failed deploy is still recorded, with `status: failed`, so the attempt stays
auditable rather than vanishing.

## Usage

```bash
./deploy.sh dev                      # deploy, record a new build
./deploy.sh list                     # all builds
./deploy.sh list prod                # just prod builds
./deploy.sh show 0003                # one build's manifest
./deploy.sh rollback-code prod 0002  # fast: point the Lambda at build 0002's code
./deploy.sh rollback-full prod 0002  # full: redeploy build 0002's template + params
```

Both rollback commands refuse to roll a prod stack back to a build that was
deployed to dev (or vice versa) -- the params carry table names and the
ElevenLabs agent id, and crossing them would point a stack at the wrong data
and the wrong voice agent.

## Environment

Reads `ai-calling-service/.env.<env>` (gitignored). Both `.env.dev` and
`.env.prod` exist with their non-secret config filled in and every credential
deliberately blank -- `infra/deploy.sh` refuses to run and names each missing
one until they are supplied. See `ai-calling-service/.env.example` for where
each value comes from.

## First deploy is a two-pass sequence

The service's public URL doesn't exist until the stack does, and ElevenLabs
needs that URL to call back into:

1. Deploy with `WEBHOOK_BASE_URL` blank. The stack comes up; note the
   `ApiEndpoint` output.
2. Put that value in `.env.<env>` as `WEBHOOK_BASE_URL`, then deploy again.

`infra/deploy.sh` prints a reminder after any deploy where it is still blank.

Enabling the custom domain (`services-api.realestateflow.in` for prod,
`services-api.cloudberrysolutions.in` for dev) is a third pass: set
`ENABLE_CUSTOM_DOMAIN_MAPPING=true` **and** `ENABLE_BASE_PATH_STRIP=true`
together -- API Gateway does not strip the base path from a Lambda proxy event,
so the handler does it, and enabling one without the other 404s every request.
`infra/deploy.sh` rejects that combination rather than letting it deploy.

## Secrets

`cfn-params.json` carries real credential values, because they are `NoEcho`
CloudFormation parameters that populate a Secrets Manager secret. It is
archived to S3 for rollback fidelity, so that bucket must stay private. The
local copies under `deploy-versions/` are gitignored, as is
`ai-calling-service/infra/cfn-params.json` itself.

The deployed Lambda never receives these as environment variables -- it
resolves them at cold start from `SECRETS_ARN`, so nobody with
`lambda:GetFunctionConfiguration` can read them back.

`deploy-versions/` is gitignored.
