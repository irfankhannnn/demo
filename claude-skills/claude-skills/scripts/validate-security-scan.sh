#!/bin/bash
# validate-security-scan.sh
# PreToolUse hook for the Sentry agent
# Blocks potentially destructive commands while allowing read-only security scanning
# Input: JSON from Claude Code hook system via stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block destructive commands
if echo "$COMMAND" | grep -iE '\b(rm\s+-rf|rm\s+-r|rmdir|del\s+/|format|mkfs|dd\s+if|chmod\s+777|curl.*-X\s*(POST|PUT|DELETE|PATCH))\b' > /dev/null; then
  echo "BLOCKED by Sentry hook: Destructive or write command not allowed during security scan." >&2
  echo "The Sentry agent operates in read-only mode. Use read-only commands only." >&2
  exit 2
fi

# Block package installation
if echo "$COMMAND" | grep -iE '\b(npm\s+install|npm\s+i\s|pip\s+install|apt\s+install|brew\s+install|choco\s+install)\b' > /dev/null; then
  echo "BLOCKED by Sentry hook: Package installation not allowed during security scan." >&2
  exit 2
fi

# Block git write operations
if echo "$COMMAND" | grep -iE '\b(git\s+push|git\s+commit|git\s+merge|git\s+rebase|git\s+reset\s+--hard)\b' > /dev/null; then
  echo "BLOCKED by Sentry hook: Git write operations not allowed during security scan." >&2
  exit 2
fi

# Allow all other commands (grep, cat, find, npm audit, etc.)
exit 0
