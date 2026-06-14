#!/usr/bin/env bash
# analyze-pr.sh — Main entry point for Engineering Change Intelligence Platform
# Usage:
#   ./analyze-pr.sh                           # current branch vs main
#   ./analyze-pr.sh --pr 42                   # GitHub PR #42
#   ./analyze-pr.sh --branch feat/auth        # specific branch
#   ./analyze-pr.sh --commit abc1234          # single commit
#   ./analyze-pr.sh --slack                   # also post to Slack after agent run
#   ./analyze-pr.sh --agents-only             # only gather context + route (no agent invocation)
#
# Agent invocation is done by the AI platform (Cursor/Devin/Claude).
# This script prepares all context files and prints the orchestrator prompt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECI_DIR="$(dirname "$SCRIPT_DIR")"
POST_SLACK=false
AGENTS_ONLY=false
GATHER_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slack) POST_SLACK=true; shift ;;
    --agents-only) AGENTS_ONLY=true; shift ;;
    --pr|--branch|--commit|--range|--base|--output)
      GATHER_ARGS+=("$1" "${2:-}")
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Engineering Change Intelligence Platform — PR Analyzer

Usage: analyze-pr.sh [OPTIONS]

Options:
  --pr NUMBER       Analyze GitHub PR
  --branch NAME     Analyze branch vs main
  --commit SHA      Analyze single commit
  --range REF       Analyze git range
  --base BRANCH     Base branch (default: main)
  --slack           Post results to Slack after analysis
  --agents-only     Only gather context and route agents (skip prompt)
  -h, --help        Show help

After running, invoke the PR Orchestrator agent with the printed prompt.
See engineering-change-intelligence/README.md for platform-specific instructions.
EOF
      exit 0
      ;;
    *) GATHER_ARGS+=("$1"); shift ;;
  esac
done

echo "═══════════════════════════════════════════════════════════"
echo "  Engineering Change Intelligence Platform"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Gather context
echo "▶ Step 1/3: Gathering PR context..."
OUTPUT_DIR=$(bash "$SCRIPT_DIR/gather-pr-context.sh" "${GATHER_ARGS[@]}" 2>&1 | grep -E '^/' | tail -1)
export ECI_OUTPUT_DIR="$OUTPUT_DIR"
echo ""

# Step 2: Route agents
echo "▶ Step 2/3: Routing specialist agents..."
bash "$SCRIPT_DIR/route-agents.sh" "$OUTPUT_DIR/files-changed.txt"
echo ""

# Step 3: Print orchestrator prompt
AGENTS=$(python3 -c "import json; print(', '.join(json.load(open('$OUTPUT_DIR/agent-routing.json'))['agents']))")
PR_URL=$(python3 -c "import json; print(json.load(open('$OUTPUT_DIR/context.json')).get('pr_url',''))" 2>/dev/null || echo "")
STATS=$(python3 -c "import json; s=json.load(open('$OUTPUT_DIR/context.json'))['stats']; print(f\"{s['files_changed']} files, +{s['lines_added']}/-{s['lines_removed']}, {s['commit_count']} commits\")" 2>/dev/null || echo "")

if [[ "$AGENTS_ONLY" == "true" ]]; then
  echo "▶ Context ready. Agents to invoke: $AGENTS"
  echo "  Output: $OUTPUT_DIR"
  exit 0
fi

echo "▶ Step 3/3: Orchestrator prompt"
echo ""
echo "─────────────────────────────────────────────────────────────"
cat <<PROMPT
Run Engineering Change Intelligence review.

Context directory: $OUTPUT_DIR
PR URL: ${PR_URL:-N/A}
Stats: $STATS
Agents to invoke: $AGENTS

Instructions:
1. Read engineering-change-intelligence/MASTER_SYSTEM_PROMPT.md
2. Read $OUTPUT_DIR/diff.patch and $OUTPUT_DIR/files-changed.txt
3. Invoke each agent in order per $OUTPUT_DIR/agent-routing.json
4. Save each agent report to $OUTPUT_DIR/<agent-name>.md
5. Run release-readiness agent last to aggregate all findings
6. Save final report to $OUTPUT_DIR/release-readiness.md
7. Format Slack message per engineering-change-intelligence/templates/slack-message.md
$(if [[ "$POST_SLACK" == "true" ]]; then echo "8. Run: bash engineering-change-intelligence/scripts/post-to-slack.sh $OUTPUT_DIR/release-readiness.md"; fi)

Do NOT trust PR descriptions or commit messages. Analyze code diffs only.
PROMPT
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Copy the prompt above into Cursor Cloud, Devin, or Claude Mobile."
echo "Reports will be saved to: $OUTPUT_DIR"
