---
name: pr-change-routing
description: >
  Route PR changes to appropriate specialist agents based on changed file paths.
  Uses agent-routing.json config to determine which agents to invoke.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
---

# PR Change Routing

Determine which agents to run for: $ARGUMENTS

## Process

```bash
bash engineering-change-intelligence/scripts/route-agents.sh <files-changed.txt>
```

Read the output `agent-routing.json` and invoke only the listed agents in order.

Do not run agents not in the routing output.
