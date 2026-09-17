---
name: cicd-review
description: >
  Review this repo's CI/CD changes: the manual infra/cicd/<service>/deploy.sh
  wrappers, the per-service infra/*.sh deploy scripts, and the GitHub Actions
  test workflows. No workflow deploys anything here.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# CI/CD Review

Review pipeline changes in: $ARGUMENTS

Reality of this pipeline: deploys are **manual**, through `infra/cicd/<service>/deploy.sh <dev|prod>`, which wraps `<service>/infra/{deploy,config-deploy,content-deploy}.sh`. GitHub Actions run tests only (`server-tests.yml`, `insta-sol-ms-tests.yml`, `playwright.yml`), plus the manual `pr-intelligence.yml`.

## Deploy scripts

- [ ] Positional `dev|prod` argument required; the script exits when it is missing or invalid
- [ ] Loads `.env.$ENV`, never a bare `.env`
- [ ] Env-name variable overwritten from the CLI argument **after** the `source` / `set -a` line
- [ ] `STACK_NAME` validated against the `${ENV}-realestateflow-` prefix, exit on mismatch
- [ ] No secret echoed; `NoEcho` parameters stay masked in config-deploy output
- [ ] No hardcoded account id, bucket name or `execute-api` URL

## Wrapper (`infra/cicd/<service>/deploy.sh`)

- [ ] Build counter stays global, not per-environment
- [ ] S3 layout stays `<prefix>/builds/<build>/<env>/...`; any `branches/` path is a regression
- [ ] Object tagging (`Branch`, `DeployDate`, `Status`, `CommitId`) still applied
- [ ] Rollback subcommands keep their environment guard
- [ ] `deploy-versions/` stays gitignored

Cross-reference `.claude/agents/cfn-readiness-auditor.md` sections 2 and 6 instead of repeating them.

## GitHub Actions

- [ ] No hardcoded secret; nothing echoes `secrets.*`
- [ ] Actions pinned to at least a major tag (this repo uses `@v4`), never `@main` or `@latest`
- [ ] Least-privilege `permissions:` block present
- [ ] `paths:` filters match the current layout (`apps/`, `services/`, `infra/cicd/`, `tools/`)
- [ ] `gh` used only in a step that sets `GH_TOKEN` in its own `env:`
- [ ] Dispatch inputs passed through `env:` and validated, not interpolated into the shell
- [ ] No `continue-on-error: true` on a test or security step
- [ ] Every `if:` can actually be true (a step's own `env:` is not visible to that step's `if:`)
- [ ] A step that adds deployment from CI is a new decision: flag it, do not wave it through

## Output

Save to `<output_dir>/cicd.md` with Finding / File:line / Risk / Recommendation.
