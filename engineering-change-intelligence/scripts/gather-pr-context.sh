#!/usr/bin/env bash
# gather-pr-context.sh — Collect PR/branch/commit context for agent analysis
# Usage:
#   ./gather-pr-context.sh                    # HEAD vs main
#   ./gather-pr-context.sh --branch feat/foo  # branch vs main
#   ./gather-pr-context.sh --pr 42            # GitHub PR (requires gh CLI)
#   ./gather-pr-context.sh --commit abc123    # single commit
#   ./gather-pr-context.sh --range main..HEAD # explicit range

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECI_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${ECI_OUTPUT_DIR:-$ECI_DIR/reports/current}"
BASE_BRANCH="${ECI_BASE_BRANCH:-main}"

mkdir -p "$OUTPUT_DIR"

MODE="branch"
TARGET=""
BASE="$BASE_BRANCH"
COMPARE_REF=""

usage() {
  cat <<EOF
Usage: gather-pr-context.sh [OPTIONS]

Options:
  --branch NAME     Analyze branch vs base (default: current branch)
  --pr NUMBER       Fetch GitHub PR diff via gh CLI
  --commit SHA      Analyze single commit
  --range REF       Analyze git range (e.g. main..HEAD)
  --base BRANCH     Base branch for comparison (default: main)
  --output DIR      Output directory (default: reports/current)
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) MODE="branch"; TARGET="${2:-}"; shift 2 ;;
    --pr) MODE="pr"; TARGET="$2"; shift 2 ;;
    --commit) MODE="commit"; TARGET="$2"; shift 2 ;;
    --range) MODE="range"; TARGET="$2"; shift 2 ;;
    --base) BASE="$2"; shift 2 ;;
    --output) OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

# Resolve compare refs
case "$MODE" in
  branch)
    COMPARE_REF="${TARGET:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)}"
  git fetch origin "$BASE" 2>/dev/null || true
  git fetch origin "$COMPARE_REF" 2>/dev/null || true
  DIFF_RANGE="origin/$BASE...$COMPARE_REF"
  if ! git rev-parse "$DIFF_RANGE" &>/dev/null; then
    DIFF_RANGE="$BASE...$COMPARE_REF"
  fi
  if ! git rev-parse "$DIFF_RANGE" &>/dev/null; then
    DIFF_RANGE="$BASE..HEAD"
  fi
    ;;
  pr)
    if ! command -v gh &>/dev/null; then
      echo "ERROR: gh CLI required for --pr mode. Install: https://cli.github.com/" >&2
      exit 1
    fi
    PR_DATA=$(gh pr view "$TARGET" --json number,title,url,baseRefName,headRefName,commits,files,additions,deletions,author,createdAt,updatedAt)
    echo "$PR_DATA" > "$OUTPUT_DIR/pr-metadata.json"
    COMPARE_REF=$(echo "$PR_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['headRefName'])" 2>/dev/null || echo "")
    BASE=$(echo "$PR_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['baseRefName'])" 2>/dev/null || echo "$BASE")
    gh pr diff "$TARGET" > "$OUTPUT_DIR/diff.patch" 2>/dev/null || true
    DIFF_RANGE="pr-$TARGET"
    ;;
  commit)
    DIFF_RANGE="$TARGET^..$TARGET"
    COMPARE_REF="$TARGET"
    ;;
  range)
    DIFF_RANGE="$TARGET"
    COMPARE_REF="${TARGET##*..}"
    ;;
esac

# Gather git metadata
if [[ "$MODE" != "pr" ]] || [[ ! -f "$OUTPUT_DIR/diff.patch" ]]; then
  git diff "$DIFF_RANGE" > "$OUTPUT_DIR/diff.patch" 2>/dev/null || git diff "$BASE..HEAD" > "$OUTPUT_DIR/diff.patch" 2>/dev/null || true
fi

git log --oneline --format="%h|%an|%ae|%ad|%s" --date=short "$DIFF_RANGE" 2>/dev/null > "$OUTPUT_DIR/commits.txt" || \
  git log --oneline --format="%h|%an|%ae|%ad|%s" --date=short -20 > "$OUTPUT_DIR/commits.txt" 2>/dev/null || true

git diff --stat "$DIFF_RANGE" 2>/dev/null > "$OUTPUT_DIR/stat.txt" || git diff --stat "$BASE..HEAD" > "$OUTPUT_DIR/stat.txt" 2>/dev/null || true

git diff --name-only "$DIFF_RANGE" 2>/dev/null > "$OUTPUT_DIR/files-changed.txt" || git diff --name-only "$BASE..HEAD" > "$OUTPUT_DIR/files-changed.txt" 2>/dev/null || true

git diff --numstat "$DIFF_RANGE" 2>/dev/null > "$OUTPUT_DIR/numstat.txt" || git diff --numstat "$BASE..HEAD" > "$OUTPUT_DIR/numstat.txt" 2>/dev/null || true

# Compute stats
FILES_CHANGED=$(wc -l < "$OUTPUT_DIR/files-changed.txt" | tr -d ' ')
LINES_ADDED=$(awk '{s+=$1} END {print s+0}' "$OUTPUT_DIR/numstat.txt" 2>/dev/null || echo 0)
LINES_REMOVED=$(awk '{s+=$2} END {print s+0}' "$OUTPUT_DIR/numstat.txt" 2>/dev/null || echo 0)
COMMIT_COUNT=$(wc -l < "$OUTPUT_DIR/commits.txt" | tr -d ' ')

# Detect repo remote for PR link
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
PR_URL=""
if [[ "$MODE" == "pr" && -f "$OUTPUT_DIR/pr-metadata.json" ]]; then
  PR_URL=$(python3 -c "import json; print(json.load(open('$OUTPUT_DIR/pr-metadata.json'))['url'])" 2>/dev/null || echo "")
elif [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  ORG="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]%.git}"
  if [[ "$MODE" == "pr" ]]; then
    PR_URL="https://github.com/$ORG/$REPO/pull/$TARGET"
  else
    PR_URL="https://github.com/$ORG/$REPO/compare/$BASE...$COMPARE_REF"
  fi
fi

# Write context manifest
cat > "$OUTPUT_DIR/context.json" <<EOF
{
  "mode": "$MODE",
  "target": "$TARGET",
  "base_branch": "$BASE",
  "compare_ref": "$COMPARE_REF",
  "diff_range": "$DIFF_RANGE",
  "pr_url": "$PR_URL",
  "stats": {
    "files_changed": $FILES_CHANGED,
    "lines_added": $LINES_ADDED,
    "lines_removed": $LINES_REMOVED,
    "commit_count": $COMMIT_COUNT
  },
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "output_dir": "$OUTPUT_DIR"
}
EOF

echo "Context gathered → $OUTPUT_DIR"
echo "  Mode:       $MODE"
echo "  Files:      $FILES_CHANGED"
echo "  Lines:      +$LINES_ADDED / -$LINES_REMOVED"
echo "  Commits:    $COMMIT_COUNT"
echo "  PR URL:     ${PR_URL:-N/A}"
echo "$OUTPUT_DIR"
