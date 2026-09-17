#!/usr/bin/env bash
# gather-pr-context.sh - collect the diff, commits and stats for one change set.
#
# Usage (run from anywhere inside the repo):
#   gather-pr-context.sh                         current branch vs origin/main (or main)
#   gather-pr-context.sh --branch feat/foo       branch vs base
#   gather-pr-context.sh --pr 42                 GitHub PR (needs gh, authenticated; fetches refs)
#   gather-pr-context.sh --commit abc123         one commit
#   gather-pr-context.sh --range HEAD~3..HEAD    explicit range (A..B or A...B)
#
# Options:
#   --base BRANCH   base branch for --branch mode (default: $ECI_BASE_BRANCH or main)
#   --fetch         git fetch the base and branch from origin first (--branch mode)
#   --output DIR    output directory, relative to the repo root
#                   (default: tools/engineering-change-intelligence/reports/<pr-N|branch-X|commit-X|range-X>)
#
# Writes diff.patch, files-changed.txt, commits.txt, stat.txt, numstat.txt,
# context.json (and pr-metadata.json in --pr mode) into the output directory.
# Progress goes to stderr. The only stdout line is the output directory, so
# callers can do: OUT=$(gather-pr-context.sh --pr 42)
# Local modes never touch the network unless --fetch is given. No mode writes
# to GitHub.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

usage() { sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

MODE="branch"
TARGET=""
BASE="${ECI_BASE_BRANCH:-main}"
OUTPUT_DIR=""
DO_FETCH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) eci_need_value "$1" $#; MODE="branch"; TARGET="$2"; shift 2 ;;
    --pr)     eci_need_value "$1" $#; MODE="pr";     TARGET="$2"; shift 2 ;;
    --commit) eci_need_value "$1" $#; MODE="commit"; TARGET="$2"; shift 2 ;;
    --range)  eci_need_value "$1" $#; MODE="range";  TARGET="$2"; shift 2 ;;
    --base)   eci_need_value "$1" $#; BASE="$2"; shift 2 ;;
    --output) eci_need_value "$1" $#; OUTPUT_DIR="$2"; shift 2 ;;
    --fetch)  DO_FETCH=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; eci_die "Unknown option: $1" ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || eci_die "Not inside a git repository."
cd "$REPO_ROOT"
ECI_REL="tools/engineering-change-intelligence"
eci_find_python

slug() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-80; }

verify_commit() {
  git rev-parse --verify --quiet "$1^{commit}" >/dev/null || eci_die "Not a commit: $1"
}

PR_URL=""
COMPARE_REF=""
LOG_EXTRA=()

case "$MODE" in
  branch)
    COMPARE_REF="${TARGET:-$(git rev-parse --abbrev-ref HEAD)}"
    if [[ "$DO_FETCH" == "true" ]]; then
      eci_log "Fetching origin/$BASE and $COMPARE_REF ..."
      git fetch --quiet origin "$BASE" || eci_die "git fetch origin $BASE failed"
      git fetch --quiet origin "$COMPARE_REF" 2>/dev/null || true
    fi
    if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
      BASE_REF="origin/$BASE"
    else
      BASE_REF="$BASE"
    fi
    verify_commit "$BASE_REF"
    verify_commit "$COMPARE_REF"
    DIFF_RANGE="$BASE_REF...$COMPARE_REF"
    LOG_RANGE="$BASE_REF..$COMPARE_REF"
    DEFAULT_NAME="branch-$(slug "$COMPARE_REF")"
    ;;
  pr)
    [[ "$TARGET" =~ ^[0-9]+$ ]] || eci_die "--pr needs a PR number, got: $TARGET"
    command -v gh >/dev/null 2>&1 || eci_die "gh CLI is required for --pr (https://cli.github.com/, then gh auth login)"
    PR_DATA="$(gh pr view "$TARGET" --json number,title,url,baseRefName,headRefName,headRefOid,author,createdAt,updatedAt,additions,deletions,changedFiles)" \
      || eci_die "gh pr view $TARGET failed (is gh authenticated? in CI set GH_TOKEN)"
    PR_FIELDS="$(printf '%s' "$PR_DATA" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(d["baseRefName"]); print(d["headRefOid"]); print(d["url"])' | tr -d '\r')"
    BASE="$(printf '%s\n' "$PR_FIELDS" | sed -n 1p)"
    PR_HEAD_OID="$(printf '%s\n' "$PR_FIELDS" | sed -n 2p)"
    PR_URL="$(printf '%s\n' "$PR_FIELDS" | sed -n 3p)"
    eci_log "Fetching base '$BASE' and refs/pull/$TARGET/head from origin ..."
    git fetch --quiet --no-tags origin "refs/heads/$BASE" || eci_die "git fetch origin $BASE failed"
    BASE_SHA="$(git rev-parse FETCH_HEAD)"
    git fetch --quiet --no-tags origin "refs/pull/$TARGET/head" || eci_die "git fetch origin refs/pull/$TARGET/head failed"
    HEAD_SHA="$(git rev-parse FETCH_HEAD)"
    if [[ -n "$PR_HEAD_OID" && "$PR_HEAD_OID" != "$HEAD_SHA" ]]; then
      eci_log "WARNING: fetched PR head $HEAD_SHA differs from gh headRefOid $PR_HEAD_OID (PR updated during run?)"
    fi
    COMPARE_REF="$HEAD_SHA"
    DIFF_RANGE="$BASE_SHA...$HEAD_SHA"
    LOG_RANGE="$BASE_SHA..$HEAD_SHA"
    DEFAULT_NAME="pr-$TARGET"
    ;;
  commit)
    verify_commit "$TARGET"
    verify_commit "$TARGET^"
    COMPARE_REF="$TARGET"
    DIFF_RANGE="$TARGET^..$TARGET"
    LOG_RANGE="$TARGET"
    LOG_EXTRA=(-1)
    DEFAULT_NAME="commit-$(slug "$(git rev-parse --short "$TARGET")")"
    ;;
  range)
    if [[ "$TARGET" == *...* ]]; then
      RANGE_A="${TARGET%%...*}"; RANGE_B="${TARGET#*...}"
    elif [[ "$TARGET" == *..* ]]; then
      RANGE_A="${TARGET%%..*}"; RANGE_B="${TARGET#*..}"
    else
      eci_die "--range needs A..B or A...B, got: $TARGET"
    fi
    verify_commit "${RANGE_A:-HEAD}"
    verify_commit "${RANGE_B:-HEAD}"
    COMPARE_REF="${RANGE_B:-HEAD}"
    BASE="${RANGE_A:-HEAD}"
    DIFF_RANGE="$TARGET"
    LOG_RANGE="${RANGE_A:-HEAD}..${RANGE_B:-HEAD}"
    DEFAULT_NAME="range-$(slug "$TARGET")"
    ;;
esac

OUTPUT_DIR="${OUTPUT_DIR:-$ECI_REL/reports/$DEFAULT_NAME}"
mkdir -p "$OUTPUT_DIR"
# Start clean so files from an earlier run of the same target are not mixed in.
rm -f "$OUTPUT_DIR"/diff.patch "$OUTPUT_DIR"/files-changed.txt "$OUTPUT_DIR"/commits.txt \
      "$OUTPUT_DIR"/stat.txt "$OUTPUT_DIR"/numstat.txt "$OUTPUT_DIR"/context.json \
      "$OUTPUT_DIR"/agent-routing.json
if [[ "$MODE" == "pr" ]]; then
  printf '%s\n' "$PR_DATA" > "$OUTPUT_DIR/pr-metadata.json"
fi

eci_log "Collecting $DIFF_RANGE ..."
GIT=(git -c core.quotepath=false --no-pager)
"${GIT[@]}" diff --no-color "$DIFF_RANGE" > "$OUTPUT_DIR/diff.patch"
"${GIT[@]}" diff --name-only "$DIFF_RANGE" > "$OUTPUT_DIR/files-changed.txt"
"${GIT[@]}" diff --stat --no-color "$DIFF_RANGE" > "$OUTPUT_DIR/stat.txt"
"${GIT[@]}" diff --numstat "$DIFF_RANGE" > "$OUTPUT_DIR/numstat.txt"
"${GIT[@]}" log ${LOG_EXTRA[@]+"${LOG_EXTRA[@]}"} --format="%h|%an|%ae|%ad|%s" --date=short "$LOG_RANGE" > "$OUTPUT_DIR/commits.txt"

FILES_CHANGED=$(grep -c . "$OUTPUT_DIR/files-changed.txt" || true)
LINES_ADDED=$(awk '{s+=$1} END {print s+0}' "$OUTPUT_DIR/numstat.txt")
LINES_REMOVED=$(awk '{s+=$2} END {print s+0}' "$OUTPUT_DIR/numstat.txt")
COMMIT_COUNT=$(grep -c . "$OUTPUT_DIR/commits.txt" || true)

if [[ "$MODE" != "pr" ]]; then
  REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/]+)$ ]]; then
    REPO_SLUG="${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    case "$MODE" in
      branch) PR_URL="https://github.com/$REPO_SLUG/compare/$BASE...$COMPARE_REF" ;;
      commit) PR_URL="https://github.com/$REPO_SLUG/commit/$(git rev-parse "$TARGET")" ;;
      range)  PR_URL="" ;;
    esac
  fi
fi

"$PY" - "$(eci_pypath "$OUTPUT_DIR/context.json")" \
  "$MODE" "$TARGET" "$BASE" "$COMPARE_REF" "$DIFF_RANGE" "$LOG_RANGE" "$PR_URL" \
  "$FILES_CHANGED" "$LINES_ADDED" "$LINES_REMOVED" "$COMMIT_COUNT" "$(eci_pypath "$OUTPUT_DIR")" <<'PYEOF'
import datetime
import json
import sys

(out, mode, target, base, compare_ref, diff_range, log_range, pr_url,
 files_changed, lines_added, lines_removed, commit_count, output_dir) = sys.argv[1:14]
ctx = {
    "mode": mode,
    "target": target,
    "base_branch": base,
    "compare_ref": compare_ref,
    "diff_range": diff_range,
    "log_range": log_range,
    "pr_url": pr_url,
    "stats": {
        "files_changed": int(files_changed),
        "lines_added": int(lines_added),
        "lines_removed": int(lines_removed),
        "commit_count": int(commit_count),
    },
    "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "output_dir": output_dir,
}
with open(out, "w", encoding="utf-8", newline="\n") as f:
    json.dump(ctx, f, indent=2)
    f.write("\n")
PYEOF

eci_log "Context gathered in $OUTPUT_DIR"
eci_log "  Mode:    $MODE"
eci_log "  Range:   $DIFF_RANGE"
eci_log "  Files:   $FILES_CHANGED"
eci_log "  Lines:   +$LINES_ADDED / -$LINES_REMOVED"
eci_log "  Commits: $COMMIT_COUNT"
eci_log "  URL:     ${PR_URL:-N/A}"
echo "$OUTPUT_DIR"
