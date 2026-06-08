#!/bin/bash
# validate-readonly.sh
# PreToolUse hook that enforces read-only mode for research agents
# Blocks any command that could modify files or state
# Input: JSON from Claude Code hook system via stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block file modification commands
if echo "$COMMAND" | grep -iE '\b(rm|mv|cp|mkdir|touch|chmod|chown|ln|truncate)\b' > /dev/null; then
  echo "BLOCKED: File modification commands not allowed in read-only mode." >&2
  exit 2
fi

# Block write redirections
if echo "$COMMAND" | grep -E '(>>|>\s)' > /dev/null; then
  echo "BLOCKED: Write redirections not allowed in read-only mode." >&2
  exit 2
fi

# Block package managers
if echo "$COMMAND" | grep -iE '\b(npm\s+(install|uninstall|update|publish)|pip\s+install|yarn\s+add)\b' > /dev/null; then
  echo "BLOCKED: Package management not allowed in read-only mode." >&2
  exit 2
fi

# Block git write operations
if echo "$COMMAND" | grep -iE '\b(git\s+(push|commit|merge|rebase|reset|checkout|branch\s+-[dD]|stash\s+drop))\b' > /dev/null; then
  echo "BLOCKED: Git write operations not allowed in read-only mode." >&2
  exit 2
fi

# Allow read-only commands
exit 0
