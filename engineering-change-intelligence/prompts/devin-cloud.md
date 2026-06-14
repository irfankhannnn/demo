# Devin Cloud — Invocation Prompts

Copy-paste these into Devin session prompts.

---

## Quick Start

```
Analyze PR #42 using the Engineering Change Intelligence Platform in this repo.
Follow engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md.
Post the final release readiness report to Slack.
```

---

## Session Setup Prompt

Use at the start of a Devin session:

```
This repo has an Engineering Change Intelligence Platform at engineering-change-intelligence/.

When I give you a PR number, branch, or commit:
1. Run engineering-change-intelligence/scripts/analyze-pr.sh with appropriate flags
2. Read the agent-routing.json to see which specialists to invoke
3. Analyze the diff.patch — never trust PR descriptions
4. Produce reports for each routed agent in the output directory
5. Aggregate with release-readiness agent
6. Post to Slack if SLACK_PR_WEBHOOK_URL is set

Agent definitions: claude-skills/agents/pr-orchestrator.md
Master prompt: engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md
```

---

## Per-PR Prompts

### PR Review
```
PR #42 needs Engineering Change Intelligence review.

Steps:
1. bash engineering-change-intelligence/scripts/analyze-pr.sh --pr 42
2. Run each agent from agent-routing.json against the diff
3. Save reports to the output directory
4. Generate release-readiness.md with Go/No-Go recommendation
5. bash engineering-change-intelligence/scripts/post-to-slack.sh <output>/release-readiness.md
```

### Branch Review
```
Review branch feat/billing-v2 against main using Engineering Change Intelligence.
bash engineering-change-intelligence/scripts/analyze-pr.sh --branch feat/billing-v2 --slack
```

---

## Devin-Specific Notes

- Devin can run the shell scripts directly — start with `analyze-pr.sh`
- Devin should read each agent definition from `claude-skills/agents/` before producing that agent's report
- Save all intermediate reports — Devin can reference them across session steps
- For Slack posting, set `SLACK_PR_WEBHOOK_URL` in Devin environment secrets

---

## Knowledge Files to Load

Point Devin to these files for context:
- `engineering-change-intelligence/README.md`
- `engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md`
- `engineering-change-intelligence/config/agent-routing.json`
- `claude-skills/agents/pr-orchestrator.md`
