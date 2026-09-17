#!/usr/bin/env bash
# route-agents.sh - decide which review agents run for a list of changed files.
#
# Usage:
#   route-agents.sh FILES_CHANGED_TXT [OUTPUT_DIR]
#
# FILES_CHANGED_TXT  one repo-relative path per line (git diff --name-only output)
# OUTPUT_DIR         where agent-routing.json is written (default: the directory
#                    of FILES_CHANGED_TXT). If OUTPUT_DIR/diff.patch exists,
#                    diff_regex rules in the config are applied to it.
#
# Rules live only in config/agent-routing.json. Patterns are whole-path globs
# (fnmatch.fnmatchcase), never substrings.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECI_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

case "${1:-}" in
  -h|--help|"")
    sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    [[ -n "${1:-}" ]] && exit 0 || exit 1
    ;;
esac

FILES_LIST="$1"
OUTPUT_DIR="${2:-$(dirname "$FILES_LIST")}"
ROUTING_CONFIG="$ECI_DIR/config/agent-routing.json"

[[ -f "$FILES_LIST" ]] || eci_die "File list not found: $FILES_LIST (run gather-pr-context.sh first)"
[[ -f "$ROUTING_CONFIG" ]] || eci_die "Routing config not found: $ROUTING_CONFIG"
mkdir -p "$OUTPUT_DIR"
eci_find_python

"$PY" - "$(eci_pypath "$ROUTING_CONFIG")" "$(eci_pypath "$FILES_LIST")" "$(eci_pypath "$OUTPUT_DIR")" <<'PYEOF'
import fnmatch
import json
import os
import re
import sys

routing_path, files_path, output_dir = sys.argv[1], sys.argv[2], sys.argv[3]

with open(routing_path, encoding="utf-8") as f:
    config = json.load(f)

with open(files_path, encoding="utf-8", errors="replace") as f:
    changed_files = [line.strip().replace("\\", "/") for line in f if line.strip()]


def matches(path, pattern):
    return fnmatch.fnmatchcase(path, pattern)


def matches_any(path, patterns, exclude=()):
    return any(matches(path, p) for p in patterns) and not any(matches(path, e) for e in exclude)


docs_globs = config.get("docs_only_globs", [])
docs_only = bool(changed_files) and all(
    any(matches(fp, g) for g in docs_globs) for fp in changed_files
)

always = list(config.get("always_run", []))
agents_to_run = set(always)
triggered_by = {a: ["always"] for a in always}

if not docs_only:
    # 1. Path globs
    for agent, rule in config.get("conditional", {}).items():
        hits = [fp for fp in changed_files
                if matches_any(fp, rule.get("patterns", []), rule.get("exclude", []))]
        if hits:
            agents_to_run.add(agent)
            triggered_by.setdefault(agent, []).extend(hits)

    # 2. Diff content (only +/- lines of files that are not docs)
    diff_path = os.path.join(output_dir, "diff.patch")
    if os.path.exists(diff_path):
        with open(diff_path, encoding="utf-8", errors="replace") as f:
            diff_text = f.read()
        skip_globs = docs_globs + config.get("diff_regex_ignore_globs", [])
        changed_lines = []
        current_is_docs = False
        for line in diff_text.splitlines():
            if line.startswith("diff --git "):
                m = re.match(r"diff --git a/(\S+) b/(\S+)", line)
                target = m.group(2) if m else ""
                current_is_docs = any(matches(target, g) for g in skip_globs)
                continue
            if line.startswith(("+++", "---")):
                continue
            if not current_is_docs and line[:1] in ("+", "-"):
                changed_lines.append(line[1:])
        body = "\n".join(changed_lines)
        for agent, rule in config.get("conditional", {}).items():
            rx = rule.get("diff_regex")
            if not rx:
                continue
            m = re.search(rx, body)
            if m:
                agents_to_run.add(agent)
                triggered_by.setdefault(agent, []).append("diff:" + m.group(0))

# File categories (informational only)
file_groups = {}
for cat, patterns in config.get("file_categories", {}).items():
    hits = [fp for fp in changed_files if matches_any(fp, patterns)]
    if hits:
        file_groups[cat] = hits

order = config.get("order", [])
unknown = sorted(agents_to_run - set(order))
ordered = [a for a in order if a in agents_to_run] + unknown

result = {
    "agents": ordered,
    "docs_only": docs_only,
    "triggered_by": {a: triggered_by.get(a, []) for a in ordered},
    "file_groups": file_groups,
    "total_files": len(changed_files),
    "skipped_agents": [a for a in order if a not in agents_to_run],
}

out_path = os.path.join(output_dir, "agent-routing.json")
with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    json.dump(result, f, indent=2)
    f.write("\n")

print(f"Changed files: {len(changed_files)}{' (docs only)' if docs_only else ''}")
print(f"Agents to run ({len(ordered)}):")
for a in ordered:
    reasons = triggered_by.get(a, [])
    if reasons == ["always"]:
        note = "always"
    else:
        files = [r for r in reasons if not r.startswith("diff:")]
        diffs = [r for r in reasons if r.startswith("diff:")]
        parts = []
        if files:
            parts.append(f"{len(files)} files, e.g. {files[0]}")
        if diffs:
            parts.append(diffs[0])
        note = "; ".join(parts)
    print(f"  - {a} ({note})")
print(f"Skipped: {', '.join(result['skipped_agents']) or 'none'}")
print("Routing saved to " + out_path.replace(os.sep, "/"))
PYEOF
