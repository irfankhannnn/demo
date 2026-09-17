---
name: release-readiness
description: >
  Aggregate the specialist agent findings into a release readiness score, risk
  level, top 5 risks, post-deploy monitoring and a Go/No-Go recommendation.
  Final agent in the Engineering Change Intelligence pipeline.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Release Readiness Assessment

Aggregate the agent reports for: $ARGUMENTS

## Process

1. Read `context.json`, `agent-routing.json` and every `<agent>.md` in the output directory. An agent that was not routed is Skipped, not a gap; an agent that was routed but wrote nothing is a problem, and must be reported rather than scored as clean.
2. Count findings by severity, counting a finding reported by two agents once.
3. Calculate the readiness score: base 100, Critical -25, High -15, Medium -5, Low -1, floor 0.
4. Set the risk level, rollback complexity and deployment complexity. Deploys are manual and per service (`infra/cicd/<service>/deploy.sh <dev|prod>`), so deployment complexity is mostly how many stacks in what order, and rollback complexity is Hard whenever the wrapper's `rollback-code` / `rollback-full` path cannot undo the change (a replaced DynamoDB table, a one-way data change).
5. Rank the top 5 risks by severity x likelihood, each with its source agent and a `path:line`.
6. Consolidate the post-deploy monitoring list.
7. Decide Go/No-Go.

## Go / No-Go

Apply in this order:

- **Block** — any Critical finding, or score below 60
- **Review Required** — any High or Medium finding, or score 60-79
- **Approve** — no Critical, High or Medium finding, and score 80 or above

`{{GO_NO_GO}}` must read exactly `Approve`, `Review Required` or `Block`.

## Output

`<output_dir>/release-readiness.md`, from `tools/engineering-change-intelligence/templates/release-readiness-report.md`.

Keep the template's `## ...` headings, the `Risk Level` and `Release Readiness Score` table labels, and the `## Recommendation` + `**{{GO_NO_GO}}**` shape exactly as they are: `scripts/post-to-slack.sh` parses them, and a renamed heading silently empties the Slack message.

This skill writes files only. Posting to Slack is opt-in, belongs to the orchestrator, and runs through `scripts/post-to-slack.sh --send` after the user asks and confirms.
