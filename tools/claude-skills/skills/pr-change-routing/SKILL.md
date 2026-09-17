---
name: pr-change-routing
description: >
  Route a change set to the specialist review agents, using the changed-path
  globs in tools/engineering-change-intelligence/config/agent-routing.json.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
---

# PR Change Routing

Determine which agents to run for: $ARGUMENTS

## Process

```bash
bash tools/engineering-change-intelligence/scripts/route-agents.sh <output_dir>/files-changed.txt <output_dir>
```

The script writes `<output_dir>/agent-routing.json`. When `<output_dir>/diff.patch` exists, the `diff_regex` rules in the config are applied to the added and removed lines as well.

Read the result and run only the agents in its `agents` array, in the order given. `triggered_by` says which pattern routed each one; pass that to the agent.

## Rules

- Routing lives only in `config/agent-routing.json`. Do not re-derive it, and do not run an agent that is not listed.
- Patterns are whole-path globs (`fnmatch.fnmatchcase`), never substrings: `apps/*` matches `apps/crm/server/x.js`, and `app/*` matches nothing under `apps/`.
- `pr-intelligence`, `security` and `release-readiness` always run. On a docs-only change set, only those three run.
