# Engineering Change Intelligence (ECI)

PR review toolkit for this repo. Shell scripts collect the diff for a PR, branch or commit and decide which review agents it needs. Claude Code then runs those agents locally and writes one report per agent plus a Go/No-Go release report.

It is local-first. Nothing posts to GitHub or Slack unless you ask for it.

## How it runs

```
analyze-pr.sh --pr N            (bash: gather context + route agents, no AI)
        |
        v
reports/pr-N/                   diff.patch, files-changed.txt, commits.txt,
                                context.json, agent-routing.json
        |
        v
claude --agent pr-orchestrator "Review PR #N"      (Claude Code, local)
        |
        |-- pr-intelligence     always
        |-- architecture        CloudFormation, Dockerfile/docker-compose changed
        |-- cicd                .github/workflows, infra/cicd, */infra/*.sh changed
        |-- database            DynamoDB table/GSI definitions or access code changed
        |-- security            always
        |-- sre-observability   deployable code or infra under apps/, services/ changed
        |-- finops              CloudFormation/Dockerfile or cost-relevant diff lines
        |-- principal-engineer  JS/TS/Python under apps/, services/, tests/ changed
        `-- release-readiness   always, last: score, risk, Go/No-Go
```

The routing rules live only in [`config/agent-routing.json`](config/agent-routing.json). Patterns are whole-path globs, so `apps/*` matches `agency-app/api/routes/billing.js` and nothing under `docs/`. A PR that only touches docs, marketing files, Markdown or images runs just `pr-intelligence`, `security` and `release-readiness`.

## Prerequisites

- bash: Git Bash on Windows is fine
- git
- Python 3.8 or newer, as `python3` or `python`. The scripts force UTF-8 output and convert Git Bash paths, so a native Windows Python works.
- `gh`, authenticated with `gh auth login`. Only `--pr` mode needs it.
- Claude Code, with the agents installed into `.claude/`. Run this once, and again after agent files change:

  ```powershell
  .\tools\claude-skills\setup.ps1
  ```

`jq` is not needed.

## Quick start (Claude Code, local)

From the repo root:

```bash
# 1. Prepare context and routing (prints the orchestrator prompt)
bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --pr 42

# 2. Run the review
claude --agent pr-orchestrator "Review PR #42"
```

The orchestrator runs `analyze-pr.sh --agents-only` itself when the context is missing, so step 2 on its own also works. Other targets:

```bash
bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --branch feat/auth           # branch vs origin/main (or main)
bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --branch feat/auth --fetch   # fetch origin first
bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --commit abc1234
bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --range HEAD~3..HEAD

claude --agent pr-orchestrator "Review branch feat/auth"
claude --agent pr-orchestrator "Review commit abc1234"
```

`--pr N` asks `gh pr view` for the PR metadata. It then fetches `refs/heads/<base>` and `refs/pull/N/head` from origin and diffs `base...head`. This read-only fetch is the only network call. No local branch is created or changed.

## Scripts

| Script | What it does |
|--------|--------------|
| `scripts/analyze-pr.sh` | Entry point. Runs gather + route and prints the orchestrator prompt. `--agents-only` stops after routing. `--slack` adds an opt-in Slack preview step to the prompt. |
| `scripts/gather-pr-context.sh` | Writes `diff.patch`, `files-changed.txt`, `commits.txt`, `stat.txt`, `numstat.txt`, `context.json` (plus `pr-metadata.json` for `--pr`). Progress goes to stderr; stdout is only the output directory. |
| `scripts/route-agents.sh FILES [OUTDIR]` | Applies `config/agent-routing.json` and writes `agent-routing.json` (agents, trigger per agent, file groups, docs-only flag). |
| `scripts/post-to-slack.sh REPORT` | Builds a Slack message from `release-readiness.md` and prints it. It posts only when you add `--send`, with `SLACK_PR_WEBHOOK_URL` set. |
| `scripts/lib/common.sh` | Shared helpers: Python lookup, UTF-8, Windows path conversion. |

## Agents

Agent and skill files live in `tools/claude-skills/`. `setup.ps1` copies them into `.claude/` so Claude Code can find them.

| Agent | File | Runs when |
|-------|------|-----------|
| PR Orchestrator | `tools/claude-skills/agents/pr-orchestrator.md` | You invoke it |
| PR Intelligence | `tools/claude-skills/agents/pr-intelligence.md` | Always |
| Architecture | `tools/claude-skills/agents/architecture.md` | `*/infra/*.yaml`, `infra/cicd/common-infra/*`, CFN params, Dockerfile, docker-compose |
| CI/CD | `tools/claude-skills/agents/cicd.md` | `.github/workflows/*`, `infra/cicd/*`, `*/infra/*.sh`, `*/infra/lib/*` |
| Database | `tools/claude-skills/agents/database.md` | `launch-tables`, `*DynamodbService*` files, or table/GSI/TTL/Scan/`TENANT#` lines in the diff |
| Security | `tools/claude-skills/agents/security.md` | Always |
| SRE & Observability | `tools/claude-skills/agents/sre-observability.md` | Deployable files under `apps/`, `services/`, `infra/cicd/common-infra/` |
| FinOps | `tools/claude-skills/agents/finops.md` | CFN templates/params, Dockerfile, or Lambda memory, Fargate count, NAT, log retention, LLM/voice vendor lines in the diff |
| Principal Engineer | `tools/claude-skills/agents/principal-engineer.md` | JS/TS/Python and `package.json` under `apps/`, `services/`, `tests/` (not `*/infra/*`) |
| Release Readiness | `tools/claude-skills/agents/release-readiness.md` | Always, last |

### Who owns what

- **PR review:** these agents. The `security` agent covers the Cloudberry checks that `sentry` had (TENANT# isolation, `x-api-key`, Cognito authorizers, NoEcho, SSM). `principal-engineer` replaces the review role of `pr-commander`. `sentry` and `pr-commander` stay for ad-hoc audits and doc updates.
- **Deploy gate:** `.claude/agents/cfn-readiness-auditor.md`, via the `cfn-cicd-deploy` skill, checks naming, deploy-script safety, env files, CFN security posture, secrets and CI/CD wrapper design. `architecture` and `cicd` point to it and review only what changed in the diff.

## Reports

Every run writes to its own gitignored directory:

```
tools/engineering-change-intelligence/reports/
  pr-42/                  --pr 42
  branch-feat-auth/       --branch feat/auth
  commit-abc1234/         --commit abc1234
  range-HEAD-3..HEAD/     --range HEAD~3..HEAD
    context.json          mode, range, stats, URL
    diff.patch
    files-changed.txt
    commits.txt
    stat.txt / numstat.txt
    pr-metadata.json      --pr only
    agent-routing.json
    <agent>.md            one per agent that ran
    release-readiness.md  final report
```

A re-run of the same target replaces the gathered files and `agent-routing.json`. Agent reports from an earlier run stay until the agents overwrite them, so delete the directory if you want a clean run. `--output DIR` (relative to the repo root) picks another location.

## Slack (optional, local opt-in)

Slack is off by default. To use it:

1. Create a Slack app with an incoming webhook for your channel.
2. `export SLACK_PR_WEBHOOK_URL=...`, or put it in `tools/engineering-change-intelligence/.env` and load that file (see `.env.example`).
3. Preview the message, then send it:

```bash
bash tools/engineering-change-intelligence/scripts/post-to-slack.sh tools/engineering-change-intelligence/reports/pr-42/release-readiness.md
bash tools/engineering-change-intelligence/scripts/post-to-slack.sh --send tools/engineering-change-intelligence/reports/pr-42/release-readiness.md
```

The orchestrator only runs the `--send` step when you ask for Slack in the request and then confirm.

## GitHub Actions (manual)

`.github/workflows/pr-intelligence.yml` runs only through `workflow_dispatch`: Actions, then "PR Engineering Change Intelligence", then Run workflow, then enter the PR number. It gathers context with `GH_TOKEN: ${{ github.token }}`, routes the agents and uploads `reports/pr-N/` as an artifact. The token permissions are read-only. The workflow does not run the AI review, comment on the PR or post to Slack.

## Trust model

PR descriptions, commit messages, code comments and developer risk labels are untrusted input. Conclusions come from the diff and the changed files only.

## Environment variables

| Variable | Used by | Default |
|----------|---------|---------|
| `ECI_BASE_BRANCH` | `gather-pr-context.sh --branch` | `main` |
| `SLACK_PR_WEBHOOK_URL` | `post-to-slack.sh --send` | unset (no posting) |
| `GH_TOKEN` | `gh` in CI (set by the workflow) | local runs use `gh auth login` |

## File structure

```
tools/engineering-change-intelligence/
  README.md
  MASTER_SYSTEM_PROMPT.md          rules every agent follows + repo stack context
  .env.example
  config/agent-routing.json        routing rules (single source)
  scripts/
    analyze-pr.sh
    gather-pr-context.sh
    route-agents.sh
    post-to-slack.sh
    lib/common.sh
  templates/
    pr-intelligence-report.md
    release-readiness-report.md    parsed by post-to-slack.sh; keep headings and table labels
    slack-message.md               manual paste / preview only
  prompts/
    devin-cloud.md                 alternative runner (not the default)
  reports/                         generated, gitignored
```

## Related

- Agents: `tools/claude-skills/agents/{pr-orchestrator,pr-intelligence,architecture,cicd,database,security,sre-observability,finops,principal-engineer,release-readiness}.md`
- Skills: `tools/claude-skills/skills/{pr-change-routing,pr-intelligence,architecture-review,cicd-review,database-review,security-audit,sre-observability-review,finops-review,principal-engineer-review,release-readiness}/SKILL.md`
- Install into `.claude/`: `tools/claude-skills/setup.ps1`
- Deploy gate: `.claude/agents/cfn-readiness-auditor.md`, `.claude/skills/cfn-cicd-deploy/SKILL.md`
- Workflow: `.github/workflows/pr-intelligence.yml`
- Integrations: `tools/claude-skills/INTEGRATIONS.md` (Engineering Change Intelligence section)
