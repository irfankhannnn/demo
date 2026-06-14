---
name: release-readiness
description: >
  Aggregate all specialist agent findings into release readiness score, risk level,
  top 5 risks, monitoring recommendations, and Go/No-Go decision. Final agent
  in the Engineering Change Intelligence pipeline.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Release Readiness Assessment

Aggregate findings from all agents for: $ARGUMENTS

## Process

1. Read all agent reports from output directory
2. Count findings by severity (Critical/High/Medium/Low)
3. Calculate readiness score (base 100, deduct per finding)
4. Determine risk level and Go/No-Go
5. Rank top 5 risks
6. Consolidate monitoring recommendations
7. Format Slack message

## Scoring

- Critical: -25 | High: -15 | Medium: -5 | Low: -1
- Approve: ≥80, no critical/high
- Review Required: 60-79 or medium findings
- Block: <60 or any critical

## Output

1. `<output_dir>/release-readiness.md` — Full report
2. `<output_dir>/slack-message.md` — Slack-formatted summary

Use templates in `engineering-change-intelligence/templates/`
