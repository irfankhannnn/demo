#!/bin/bash
# run-lint-check.sh
# PostToolUse hook for PR Commander agent
# Runs linting after file edits to catch issues early
# Input: JSON from Claude Code hook system via stdin

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.target_file // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Determine file type and run appropriate linter
case "$FILE_PATH" in
  *.ts|*.tsx)
    # TypeScript files - run tsc check if available
    if command -v npx &> /dev/null; then
      cd "$(dirname "$FILE_PATH")"
      # Find nearest tsconfig.json
      TSCONFIG=$(find . -maxdepth 3 -name "tsconfig.json" -print -quit 2>/dev/null)
      if [ -n "$TSCONFIG" ]; then
        npx tsc --noEmit --pretty 2>&1 | head -20
      fi
    fi
    ;;
  *.js|*.jsx)
    # JavaScript files - basic syntax check
    if command -v node &> /dev/null; then
      node --check "$FILE_PATH" 2>&1
    fi
    ;;
  *.json)
    # JSON files - validate syntax
    if command -v node &> /dev/null; then
      node -e "JSON.parse(require('fs').readFileSync('$FILE_PATH', 'utf8'))" 2>&1
    fi
    ;;
esac

# Always allow the edit to proceed (exit 0)
# Lint errors are informational, not blocking
exit 0
