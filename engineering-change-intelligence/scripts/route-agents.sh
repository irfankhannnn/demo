#!/usr/bin/env bash
# route-agents.sh — Determine which specialist agents to run based on changed files
# Usage:
#   ./route-agents.sh                          # uses reports/current/files-changed.txt
#   ./route-agents.sh path/to/files-changed.txt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECI_DIR="$(dirname "$SCRIPT_DIR")"
ROUTING_CONFIG="$ECI_DIR/config/agent-routing.json"
FILES_LIST="${1:-$ECI_DIR/reports/current/files-changed.txt}"
OUTPUT_DIR="${ECI_OUTPUT_DIR:-$ECI_DIR/reports/current}"

if [[ ! -f "$FILES_LIST" ]]; then
  echo "ERROR: File list not found: $FILES_LIST" >&2
  echo "Run gather-pr-context.sh first." >&2
  exit 1
fi

if [[ ! -f "$ROUTING_CONFIG" ]]; then
  echo "ERROR: Routing config not found: $ROUTING_CONFIG" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Use Python for JSON parsing and pattern matching
python3 - "$ROUTING_CONFIG" "$FILES_LIST" "$OUTPUT_DIR" <<'PYEOF'
import json, sys, os, fnmatch

routing_path, files_path, output_dir = sys.argv[1], sys.argv[2], sys.argv[3]

with open(routing_path) as f:
    config = json.load(f)

with open(files_path) as f:
    changed_files = [line.strip() for line in f if line.strip()]

def matches_pattern(filepath, pattern):
    if pattern.endswith("/"):
        return pattern.rstrip("/") in filepath or filepath.startswith(pattern)
    return fnmatch.fnmatch(filepath, f"*{pattern}*") or fnmatch.fnmatch(os.path.basename(filepath), pattern)

agents_to_run = set(config.get("always_run", []))
triggered_by = {a: [] for a in agents_to_run}

for cond_name, cond in config.get("conditional", {}).items():
    agent = cond["agent"]
    patterns = cond["patterns"]
    matched_files = []
    for fp in changed_files:
        for pat in patterns:
            if matches_pattern(fp, pat):
                matched_files.append(fp)
                break
    if matched_files:
        agents_to_run.add(agent)
        triggered_by[agent] = matched_files

# Principal engineer: run if app code changed (unless ONLY infra/cicd/db)
app_patterns = config["conditional"].get("principal-engineer", {}).get("patterns", [])
infra_only_agents = {"architecture", "kubernetes-helm", "cicd", "database"}
has_app_code = any(
    any(matches_pattern(fp, p) for p in app_patterns)
    for fp in changed_files
)
only_infra = agents_to_run - set(config["always_run"]) - {"principal-engineer"}
only_infra = only_infra <= infra_only_agents and not has_app_code

if has_app_code and "principal-engineer" not in agents_to_run:
    agents_to_run.add("principal-engineer")
    triggered_by["principal-engineer"] = [
        fp for fp in changed_files
        if any(matches_pattern(fp, p) for p in app_patterns)
    ]

# Categorize files
categories = config.get("file_categories", {})
file_groups = {cat: [] for cat in categories}
for fp in changed_files:
    for cat, patterns in categories.items():
        if any(matches_pattern(fp, p) for p in patterns):
            file_groups[cat].append(fp)

# Execution order
order = [
    "pr-intelligence",
    "architecture",
    "kubernetes-helm",
    "cicd",
    "security",
    "sre-observability",
    "finops",
    "database",
    "principal-engineer",
    "release-readiness",
]
ordered_agents = [a for a in order if a in agents_to_run]

result = {
    "agents": ordered_agents,
    "triggered_by": {a: triggered_by.get(a, []) for a in ordered_agents},
    "file_groups": {k: v for k, v in file_groups.items() if v},
    "total_files": len(changed_files),
    "skipped_agents": [a for a in order if a not in agents_to_run and a != "release-readiness"],
}

out_path = os.path.join(output_dir, "agent-routing.json")
with open(out_path, "w") as f:
    json.dump(result, f, indent=2)

print(f"Agents to run ({len(ordered_agents)}):")
for a in ordered_agents:
    files = triggered_by.get(a, [])
    trigger_note = f" ({len(files)} files)" if files else " (always)"
    print(f"  • {a}{trigger_note}")

print(f"\nRouting saved → {out_path}")
PYEOF
