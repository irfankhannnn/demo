#!/bin/bash
# validate-ad-budget.sh
# PreToolUse hook for Media Buyer agent
# Safety guard to prevent accidental overspending on ad campaigns
# Input: JSON from Claude Code hook system via stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Safety limits (in cents for Meta API)
DAILY_MAX_BUDGET=50000        # $500/day max
SINGLE_ADSET_MAX=10000        # $100/ad set max
LIFETIME_MAX_BUDGET=1500000   # $15,000 lifetime max

# Check for Meta Ads API budget-related calls
if echo "$COMMAND" | grep -i "graph.facebook.com" > /dev/null; then

  # Extract daily_budget value if present
  DAILY_BUDGET=$(echo "$COMMAND" | grep -oP '"daily_budget"\s*:\s*\K[0-9]+' 2>/dev/null)
  if [ -n "$DAILY_BUDGET" ] && [ "$DAILY_BUDGET" -gt "$SINGLE_ADSET_MAX" ]; then
    echo "BLOCKED by Budget Guard: daily_budget ($DAILY_BUDGET) exceeds safety limit ($SINGLE_ADSET_MAX cents = \$$(($SINGLE_ADSET_MAX / 100))/day)." >&2
    echo "Adjust budget to be within the safety limit or get manual approval." >&2
    exit 2
  fi

  # Extract lifetime_budget value if present
  LIFETIME_BUDGET=$(echo "$COMMAND" | grep -oP '"lifetime_budget"\s*:\s*\K[0-9]+' 2>/dev/null)
  if [ -n "$LIFETIME_BUDGET" ] && [ "$LIFETIME_BUDGET" -gt "$LIFETIME_MAX_BUDGET" ]; then
    echo "BLOCKED by Budget Guard: lifetime_budget ($LIFETIME_BUDGET) exceeds safety limit ($LIFETIME_MAX_BUDGET cents = \$$(($LIFETIME_MAX_BUDGET / 100)))." >&2
    exit 2
  fi

  # Block campaign deletion (safety)
  if echo "$COMMAND" | grep -iE '(-X\s*DELETE|method.*DELETE)' > /dev/null; then
    echo "BLOCKED by Budget Guard: Campaign deletion requires manual approval." >&2
    echo "Delete campaigns directly in Meta Ads Manager for safety." >&2
    exit 2
  fi
fi

# Block any accidental spending commands outside Meta API
if echo "$COMMAND" | grep -iE '\b(stripe|paypal|billing|charge|payment)\b' > /dev/null; then
  echo "BLOCKED by Budget Guard: Payment-related commands require manual approval." >&2
  exit 2
fi

exit 0
