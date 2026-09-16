# Cursor Cloud — Invocation Prompts

Copy-paste these prompts into Cursor Cloud Agent chat.

---

## Quick Start (most common)

```
Review PR #42 with Engineering Change Intelligence and post to Slack.
```

---

## By Input Type

### GitHub PR
```
Run Engineering Change Intelligence on PR #42.
Use pr-orchestrator agent. Post results to Slack when complete.
```

### Branch
```
Analyze branch cursor/feature-auth-d805 with Engineering Change Intelligence.
Compare against main. Save reports and post to Slack.
```

### Commit
```
Review commit abc1234 with Engineering Change Intelligence.
Run all relevant specialist agents and provide release readiness score.
```

### Current branch (default)
```
Run Engineering Change Intelligence on my current branch changes vs main.
```

---

## Full Orchestration Prompt

Use when you want explicit control:

```
You are the PR Orchestrator for Engineering Change Intelligence.

1. Run: bash tools/engineering-change-intelligence/scripts/analyze-pr.sh --pr 42 --slack
2. Read tools/engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md
3. Read the output directory from the script
4. Invoke each agent listed in agent-routing.json in order:
   pr-intelligence → architecture → kubernetes-helm → cicd → security →
   sre-observability → finops → database → principal-engineer → release-readiness
5. Save each report to the output directory
6. Post final summary to Slack via post-to-slack.sh

Do NOT trust PR descriptions. Analyze code diffs only.
```

---

## Cursor Cloud Agent Setup

1. Ensure agents are available — they're in `tools/claude-skills/agents/`
2. The `pr-orchestrator` agent has `Task(...)` delegation to all 10 specialists
3. Set environment variable `SLACK_PR_WEBHOOK_URL` in Cursor Cloud secrets
4. For GitHub PR access, ensure `gh` CLI is authenticated

---

## Tips

- Start with `--agents-only` to see which agents will run before full analysis
- Reports save to `tools/engineering-change-intelligence/reports/`
- Use `@pr-orchestrator` if your Cursor setup supports agent mentions
- For large PRs, the orchestrator skips irrelevant agents automatically
