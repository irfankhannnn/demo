# Claude Mobile — Invocation Prompts

Use these prompts in Claude mobile app conversations. Claude Mobile cannot run shell scripts directly, so provide the diff context inline or via pasted content.

---

## Quick Start (paste diff)

```
I'm pasting a PR diff below. Run Engineering Change Intelligence review.

Rules:
- Never trust my PR description — analyze the code only
- Run these agents based on what changed:
  • Always: PR Intelligence, Security, SRE, Release Readiness
  • If infra files: Architecture, FinOps
  • If K8s files: Kubernetes & Helm
  • If CI/CD files: CI/CD
  • If SQL/migrations: Database
  • If app code: Principal Engineer

Output the final Slack-formatted message with:
- Risk level, Readiness score, Go/No-Go
- Features, Services, Infrastructure impacted
- Top 5 risks
- Recommended monitoring

Follow the template in tools/engineering-change-intelligence/templates/slack-message.md

--- DIFF START ---
[paste git diff here]
--- DIFF END ---
```

---

## With PR Link (no local git)

```
Review this PR using Engineering Change Intelligence:
https://github.com/org/repo/pull/42

I cannot run scripts. Please:
1. Ask me to paste the diff, OR
2. Use the GitHub API if you have access

Follow tools/engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md.
Only analyze actual code changes, not PR description.
Output Slack-formatted summary at the end.
```

---

## Compact Mobile Prompt

For shorter conversations:

```
Engineering Change Intelligence review.

Changed files:
- server/routes/billing.js (new)
- server/infra/cfn-backend.yaml (modified)
- .github/workflows/deploy.yml (modified)

[paste diff]

Give me: Risk, Readiness score, Top 5 risks, Go/No-Go, Slack message.
```

---

## Claude Mobile Limitations & Workarounds

| Limitation | Workaround |
|------------|------------|
| No shell access | Paste `git diff` output directly |
| No file system | Paste changed file list and key file contents |
| No Slack posting | Copy the Slack-formatted output and paste into Slack manually |
| No agent delegation | Claude plays all agent roles sequentially in one response |
| Context limits | For large PRs, paste only critical files; mention file count for stats |

---

## Multi-Message Flow (for large PRs)

**Message 1:**
```
I'm doing an Engineering Change Intelligence review across multiple messages.
PR #42, 15 files changed. I'll paste diffs in batches.
Start with PR Intelligence analysis after I paste file list.

Files changed:
[paste files-changed.txt content]
```

**Message 2-N:** Paste diff batches by category (infra, app code, etc.)

**Final Message:**
```
All diffs provided. Now run Security, SRE, and Release Readiness agents.
Aggregate everything into the Slack message template.
Give Go/No-Go recommendation.
```

---

## System Prompt for Claude Project

If using Claude Projects, set this as project instructions:

```
You are the Engineering Change Intelligence Platform for the Cloudberry CRM repo.

When reviewing code changes:
1. Never trust PR descriptions or commit messages
2. Analyze only actual diffs
3. Run specialist reviews based on file types changed
4. Output concise, deployment-focused findings
5. End with Slack-formatted release readiness summary

Templates: tools/engineering-change-intelligence/templates/
Master prompt: tools/engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md
```
