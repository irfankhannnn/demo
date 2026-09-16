---
name: cfn-cicd-deploy
description: >
  Deploy a RealtyFlow/Cloudberry microservice through its infra/cicd (formerly
  cfn-templates-cicd) CI/CD wrapper, but only after checking it against this repo's CFN/CI-CD
  best-practices checklist (env-first naming, deploy-script safety, secrets
  hygiene, CFN security posture, build-tracking/S3-tagging design). Passes
  everything blocking → deploys directly, no further confirmation. Anything
  blocking fails → stops, shows the full report, and asks for human
  approval before fixing and/or deploying. Use when the user names a
  infra/cicd/<service> path (or a bare service name) and an
  environment, and asks to deploy it.
---

# CFN CI/CD Deploy

You are the orchestrator for a gated deploy. You never deploy blind — you always get a real readiness report from the `cfn-readiness-auditor` subagent first, and you only skip asking the human when that report says every blocking check passed.

**Custom domain convention (BLOCKING, checked by the auditor's checklist item 7):** every backend microservice must route through its environment's shared API Gateway custom domain via an `AWS::ApiGateway::BasePathMapping`, not just its raw execute-api invoke URL — `services-api.realestateflow.in` for prod, `services-api.cloudberrysolutions.in` for dev/nonprod. If the service uses an `AWS_PROXY`/Lambda-proxy integration, its Lambda entry point must also strip the base path itself (API Gateway's base path mapping only affects routing selection, not what's in `event.path`). `apps/crm/server/lambda-handler.js`, `services/reality-flow-authentication/src/index.ts`, and `apps/instagram/backend_insta_sol_ms/lambda.js` are the reference implementations.

## Step 0 — Parse the request

Expect something like `infra/cicd/server prod`, `infra\cicd\reality-flow-authentication dev`, or just a bare service name (`server`, `auth`). Accept both `/` and `\` path separators (Windows).

- `WRAPPER_DIR` = the given `infra/cicd/<service>` path (resolve a bare name against `infra/cicd/*` — if more than one matches, or none do, list what exists and ask which one).
- `SERVICE_NAME` = `basename(WRAPPER_DIR)`.
- `SERVICE_DIR` = the path the wrapper itself resolves — read the `SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../<path>" ...` line in `WRAPPER_DIR/deploy.sh` and resolve it against `WRAPPER_DIR` (e.g. `infra/cicd/server` → `apps/crm/server`, `infra/cicd/reality-flow-authentication` → `services/reality-flow-authentication`). The wrapper folder name matches the service folder's basename, but services live under `apps/<product>/` or `services/`, not at the repo root. Verify `SERVICE_DIR` exists. If it doesn't, or if `WRAPPER_DIR/deploy.sh` doesn't reference `SERVICE_DIR/infra/deploy.sh` anywhere, **stop and ask** which real microservice folder this wrapper is supposed to delegate to — do not guess a mapping.
- `ENV` = `dev` or `prod` from the arguments. **If not given, ask** (AskUserQuestion or a direct question) — never default silently. Deploying to the wrong environment is exactly the kind of mistake this whole checklist exists to prevent.

## Step 1 — Run the audit

Dispatch the `cfn-readiness-auditor` subagent (Agent tool, `subagent_type: cfn-readiness-auditor`) with a prompt that states plainly, in its own words:
- `SERVICE_DIR`, `WRAPPER_DIR`, and `ENV` (the exact resolved paths from Step 0)
- that it should run its full checklist and return the structured report exactly as its own instructions define

Wait for the real report. Never write the report yourself, never assume a pass — you have no basis for a verdict until the subagent returns one.

## Step 2a — Verdict is READY_TO_DEPLOY

Show the user a one-line summary of what passed (not the full report — they don't need the play-by-play for a clean pass), e.g. "Readiness check passed (9/9 blocking checks) — deploying server to prod." Then run the deploy directly:

```
cd WRAPPER_DIR && ./deploy.sh <ENV>
```

This is a `Bash` call in your own context (not the read-only subagent) — this is the one place this skill is explicitly pre-authorized to run a real, state-changing AWS deploy without a further confirmation prompt, because passing the full checklist **is** the approval gate the user designed this skill around. Report the outcome plainly: build number, stack status, and the S3 build-archive path it recorded, pulled from the wrapper's own output and `deploy-versions/<build>/manifest.json`.

If the delegate script exits non-zero despite a clean readiness report (a real deploy failure, e.g. an AWS-side error the audit couldn't have caught — throttling, a transient service issue, a stack already mid-update), report the failure plainly with the actual error output. Do not retry silently, and do not treat a failed deploy as anything other than what it is.

## Step 2b — Verdict is NOT_READY

Show the user the **full report** verbatim — every blocking and advisory line, not a paraphrase. Then ask (AskUserQuestion), roughly:

- **Fix the gaps, then deploy** (recommended) — you fix every blocking item yourself, following this repo's established conventions (the same ones the auditor checked against — env-first naming, SDK v3, tagging, etc.; `infra/cicd/reality-flow-authentication` is the reference implementation if you need a concrete example of "done right"), then re-run Step 1 from scratch to confirm before deploying. Never skip the re-check after fixing.
- **Show me the gaps only** — stop here, do nothing further.
- **Deploy anyway, skip the gate** — an explicit override. Only take this path if the user picks it explicitly in this response, never infer it. If `ENV` is `prod`, restate concretely what's still broken and its real consequence (e.g. "this will deploy a retired Lambda runtime that AWS will reject" or "this stack name doesn't match the env-first convention every other prod stack uses") before running the deploy, so the override is informed, not blind.

Never auto-fix and redeploy without the user picking the first option — a NOT_READY verdict is exactly the case this skill exists to slow down.
