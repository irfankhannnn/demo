# Engineering Change Intelligence Platform

Multi-agent PR review system that analyzes code changes across 10 specialist domains and posts actionable release readiness reports to Slack.

## Architecture

```
PR Opened / Updated / Manual Trigger
        │
        ▼
  analyze-pr.sh (gather context + route agents)
        │
        ▼
  PR Orchestrator
        │
        ├── PR Intelligence Agent      (always)
        ├── Architecture Agent         (if IaC changed)
        ├── Kubernetes & Helm Agent    (if K8s changed)
        ├── CI/CD Agent                (if pipelines changed)
        ├── Security Agent             (always)
        ├── SRE & Observability Agent  (always)
        ├── FinOps Agent               (if infra changed)
        ├── Database Agent             (if migrations changed)
        ├── Principal Engineer Agent   (if app code changed)
        └── Release Readiness Agent    (always — aggregates + Slack)
```

## Quick Start

### 1. Set up Slack webhook

```bash
cp engineering-change-intelligence/.env.example engineering-change-intelligence/.env
# Edit SLACK_PR_WEBHOOK_URL with your Slack incoming webhook
export SLACK_PR_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

[Create a Slack Incoming Webhook](https://api.slack.com/messaging/webhooks) in your workspace → `#engineering-reviews` channel.

### 2. Analyze a PR

```bash
# GitHub PR
bash engineering-change-intelligence/scripts/analyze-pr.sh --pr 42

# Branch vs main
bash engineering-change-intelligence/scripts/analyze-pr.sh --branch feat/auth

# Single commit
bash engineering-change-intelligence/scripts/analyze-pr.sh --commit abc1234

# With Slack posting
bash engineering-change-intelligence/scripts/analyze-pr.sh --pr 42 --slack
```

### 3. Invoke the orchestrator agent

The script prints an orchestrator prompt. Paste it into your AI platform, or use:

**Cursor Cloud:**
```
Review PR #42 with Engineering Change Intelligence and post to Slack.
```

**Devin Cloud:**
```
Analyze PR #42 using Engineering Change Intelligence Platform. Post to Slack.
```

**Claude Mobile:**
Paste the diff and ask for Engineering Change Intelligence review (see `prompts/claude-mobile.md`).

## Platform Guides

| Platform | Guide |
|----------|-------|
| Cursor Cloud | [`prompts/cursor-cloud.md`](prompts/cursor-cloud.md) |
| Devin Cloud | [`prompts/devin-cloud.md`](prompts/devin-cloud.md) |
| Claude Mobile | [`prompts/claude-mobile.md`](prompts/claude-mobile.md) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/analyze-pr.sh` | Main entry point — gather + route + print orchestrator prompt |
| `scripts/gather-pr-context.sh` | Collect diff, commits, stats, PR metadata |
| `scripts/route-agents.sh` | Determine which agents to run based on changed files |
| `scripts/post-to-slack.sh` | Post release readiness report to Slack |

## Agents

| Agent | File | Trigger |
|-------|------|---------|
| PR Orchestrator | `claude-skills/agents/pr-orchestrator.md` | User invocation |
| PR Intelligence | `claude-skills/agents/pr-intelligence.md` | Always |
| Architecture | `claude-skills/agents/architecture.md` | IaC files |
| Kubernetes & Helm | `claude-skills/agents/kubernetes-helm.md` | K8s manifests |
| CI/CD | `claude-skills/agents/cicd.md` | Pipeline files |
| Security | `claude-skills/agents/security.md` | Always |
| SRE & Observability | `claude-skills/agents/sre-observability.md` | Always |
| FinOps | `claude-skills/agents/finops.md` | Infra/cost files |
| Database | `claude-skills/agents/database.md` | Migrations/SQL |
| Principal Engineer | `claude-skills/agents/principal-engineer.md` | App code |
| Release Readiness | `claude-skills/agents/release-readiness.md` | Always (last) |

## GitHub Actions (Automated)

The workflow at `.github/workflows/pr-intelligence.yml` runs on every PR open/update:

1. Gathers PR context and routes agents
2. Uploads context artifacts
3. Comments on PR with agents to run
4. Posts to Slack if `SLACK_PR_WEBHOOK_URL` secret is set

**Setup:**
1. Add `SLACK_PR_WEBHOOK_URL` to GitHub repository secrets
2. Push a PR — workflow runs automatically
3. Complete analysis by invoking PR Orchestrator in Cursor Cloud

## Slack Output Example

```
PR #42 — Engineering Change Intelligence
🔗 View Pull Request

Risk: 🟡 Medium
Readiness: 72/100
Recommendation: ⚠️ Review Required

Features:
• Billing module — new Razorpay integration
• Subscription management API

Services:
• server/ (Backend API)
• real-estate-crm-app/ (Settings page)

Security:
• [HIGH] Webhook signature validation missing on billing endpoint

Top Risks:
1. Missing webhook auth on payment endpoint (Security)
2. No idempotency key on subscription creation (Principal Engineer)
3. DynamoDB GSI addition requires backfill (Database)

Recommended Monitoring:
• Lambda Errors on billing-handler
• API 5XX rate on /api/billing/*
• Razorpay webhook delivery failures

Recommendation: Review Required
```

## Reports

All reports save to `engineering-change-intelligence/reports/`:

```
reports/
  pr-42/                    # Per-PR directory
    context.json            # PR metadata and stats
    diff.patch              # Full diff
    files-changed.txt       # Changed file list
    agent-routing.json      # Which agents to run
    pr-intelligence.md      # Agent reports
    security.md
    release-readiness.md    # Final aggregated report
    slack-message.md        # Slack-formatted output
```

## Trust Model

The platform **never trusts**:
- PR descriptions
- Commit messages
- Developer risk labels
- Comments

All conclusions are derived from **actual code diffs** only.

## Configuration

| File | Purpose |
|------|---------|
| `config/agent-routing.json` | File pattern → agent mapping |
| `MASTER_SYSTEM_PROMPT.md` | Global system prompt for all platforms |
| `.env.example` | Environment variables |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_PR_WEBHOOK_URL` | For Slack | Incoming webhook URL |
| `SLACK_BOT_NAME` | No | Bot display name (default: PR Intelligence Bot) |
| `ECI_BASE_BRANCH` | No | Base branch for comparison (default: main) |
| `ECI_OUTPUT_DIR` | No | Report output directory |

## File Structure

```
engineering-change-intelligence/
├── README.md                    # This file
├── MASTER_SYSTEM_PROMPT.md      # Global system prompt
├── .env.example                 # Environment template
├── config/
│   └── agent-routing.json       # Agent routing rules
├── scripts/
│   ├── analyze-pr.sh            # Main entry point
│   ├── gather-pr-context.sh     # Context collection
│   ├── route-agents.sh          # Agent routing
│   └── post-to-slack.sh         # Slack integration
├── templates/
│   ├── slack-message.md         # Slack output template
│   ├── release-readiness-report.md
│   └── pr-intelligence-report.md
├── prompts/
│   ├── cursor-cloud.md          # Cursor invocation prompts
│   ├── devin-cloud.md           # Devin invocation prompts
│   └── claude-mobile.md         # Claude Mobile prompts
└── reports/                     # Generated reports (gitignored)
```

## Related

- Agent definitions: `claude-skills/agents/pr-*.md`
- Skills: `claude-skills/skills/*/SKILL.md`
- GitHub workflow: `.github/workflows/pr-intelligence.yml`
- Integrations: `claude-skills/INTEGRATIONS.md` (Slack section)
