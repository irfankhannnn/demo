# CRM Backend (server) — CI/CD entry point

This folder no longer holds its own copy of the templates. `deploy.sh` here
delegates the actual packaging/CFN work to the real script:

```
server/infra/deploy.sh
```

Everything — `cfn-backend.yaml`, `launch-tables-cfn.yaml`,
`apigw-explicit-routes-part1/2.yaml`, `cfn-params.sample.json`,
`split-apigw-routes.py`, and the packaging/CFN deploy logic itself — lives
there now. This folder used to carry its own duplicate of all of these; they
predated the entire Call Intelligence pipeline, the dev/prod split, and the
security hardening done in `server/infra`. Deleted rather than re-synced, so
there's only one copy to ever go stale again (same reasoning as
`cfn-templates-cicd/reality-flow-authentication`).

## Running it

```
cd cfn-templates-cicd/server
./deploy.sh dev                        # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list                       # list every recorded build (any env)
./deploy.sh list prod                  # list only prod builds
./deploy.sh show 0003                  # print one build's manifest.json
./deploy.sh rollback-code prod 0007    # fast: point both Lambdas at old code
./deploy.sh rollback-full prod 0007    # full: redeploy that build's CFN(s) + code
```

`dev`/`prod` is required for a deploy.

## Build numbers are global, not per-environment

Same as `cfn-templates-cicd/reality-flow-authentication`: one counter across
dev **and** prod, so "build #7" is unambiguous by itself — which env it
targeted is recorded *inside* it (`manifest.json`'s `env` field, and as a
path segment in S3). `rollback-code`/`rollback-full` refuse to run if the
`<env>` you pass doesn't match what the target build actually recorded.

## How this differs from the auth wrapper

Same manifest shape, same global build counter, same S3 tagging
(`Branch`/`DeployDate`/`Status`/`CommitId` on every object touched), same
`builds/<build>/<env>/` S3 layout, and same rollback philosophy as
`cfn-templates-cicd/reality-flow-authentication` (a rollback is always a new,
numbered forward build — never an edit to history), but three structural
differences, all because `server` and `reality-flow-authentication` package
things differently:

1. **Code artifact key.** Auth uploads to a *fixed* S3 key
   (`${ServiceName}/function.zip`) that gets overwritten every deploy — old
   code is only reachable via S3 object **versioning** on that key. Server
   uploads to a **timestamped, unique-per-deploy key**
   (`${ARTIFACT_PREFIX}/function-<timestamp>.zip`) that is *never*
   overwritten — old code just sits at its own permanent key, no versioning
   needed. That timestamp is generated inside `server/infra/deploy.sh` at a
   point this wrapper can't independently reconstruct, so that script now
   writes the exact keys it used to `infra/.last-deploy-artifacts.json`
   (gitignored, a build artifact like `cfn-params.json`) right after
   uploading, and this wrapper reads it back after a successful delegate
   call.
2. **Two Lambdas share one code artifact** — the API Lambda and the
   call-recording worker (Call Intelligence pipeline). `rollback-code`
   updates both, matching the direct-update path already inside
   `server/infra/deploy.sh` (`DEPLOY_CFN=false` mode).
3. **Two nested route templates, plus the main template itself is also
   uploaded to S3** (it's over the 51.2KB inline limit, unlike auth's).
   `rollback-full` re-uploads all three from the local snapshot (not from
   S3 — the S3 copies may have moved to Deep Archive by the time you need
   them) before running `aws cloudformation deploy`.

## S3 layout

One artifact bucket **per environment** (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts`). Inside it, under `${ARTIFACT_PREFIX}`
(e.g. `prod-realestateflow`):

```
${ARTIFACT_PREFIX}/function-<timestamp>.zip                "latest" code —
${ARTIFACT_PREFIX}/cfn-backend.yaml                          the ONE set of
${ARTIFACT_PREFIX}/apigw-explicit-routes-part1.yaml           keys Lambda/CFN
${ARTIFACT_PREFIX}/apigw-explicit-routes-part2.yaml           actually read

${ARTIFACT_PREFIX}/builds/0001/prod/cfn-backend.yaml                permanent,
${ARTIFACT_PREFIX}/builds/0001/prod/apigw-explicit-routes-part1.yaml build+env-
${ARTIFACT_PREFIX}/builds/0001/prod/apigw-explicit-routes-part2.yaml scoped
${ARTIFACT_PREFIX}/builds/0001/prod/code/function-<timestamp>.zip    archive
```

`code/` is a directory (not a fixed filename) so the two Lambdas' shared zip
today can become two independently-named zips later with no structural
change.

**Every object this script touches — the "latest" keys and every
build-archive file — gets S3 tags:** `Branch`, `DeployDate`,
`Status` (`deployed`/`failed`, the actual script outcome), `CommitId`.
Applied via `put-object-tagging` after the deploy attempt finishes, same as
auth.

## Build/release tracking (`deploy-versions/`)

Same structure as auth's: `deploy-versions/<0001, 0002, ...>/` (build number
at the top level, no per-env split — env lives inside `manifest.json` and
in the S3 path), **gitignored** (see this folder's `.gitignore` and the root
README's ".gitignore best practices" section). Each build directory holds
`manifest.json` (build #, env, status, git commit/branch/dirty-flag,
deployer, timestamp, stack name, and the S3 bucket/keys — plus VersionIds
for the two nested templates and the main template, which do use S3
versioning since they're fixed keys, plus the four `builds/<build>/<env>/`
archive keys) and local snapshots of `cfn-backend.yaml`, both
`apigw-explicit-routes-part*.yaml` files, and `cfn-params.json`.
`deploy-versions/LATEST` and `deploy-versions/history.jsonl` work
identically to auth's (global, not per-env).

## Deep Archive retrieval caveat

Same as auth — see `cfn-templates-cicd/common-infra/vpc-networking.yaml`.
The shared artifact bucket's lifecycle now has **two** rules that matter
here: a current-version rule (`TierAndArchiveCurrentVersions`) that ages
server's never-overwritten timestamped code keys straight to Deep Archive
at 60 days and expires them at 365 days (since they never become
"noncurrent" — nothing ever overwrites them), and a noncurrent-version rule
that does the equivalent for auth's overwritten fixed keys. Either way, Deep
Archive's fastest retrieval tier is ~12 hours — `rollback-code` detects an
archived object and prints the exact `aws s3api restore-object` command to
run first.

## Naming convention

`server/infra` now uses the same `<env>-realestateflow-*` (env-first)
convention as `reality-flow-authentication` and
`prod-realestateflow-networking-common` — `STACK_NAME=dev-realestateflow-backend`
/ `prod-realestateflow-backend`, Lambdas `${ENVIRONMENT_NAME}-realestateflow-api`
and `${ENVIRONMENT_NAME}-realestateflow-call-recording-worker`, all ~20 table
names, `S3_BUCKET_NAME`, etc. This wrapper's `cmd_rollback_code` hardcodes
that same pattern for the two Lambda function names.
