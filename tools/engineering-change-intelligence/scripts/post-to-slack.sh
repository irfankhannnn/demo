#!/usr/bin/env bash
# post-to-slack.sh - build a Slack message from a release-readiness report.
#
# Local opt-in only. By default this prints the Slack payload and posts nothing.
#
# Usage:
#   post-to-slack.sh REPORT.md            preview the payload (no network)
#   post-to-slack.sh --send REPORT.md     POST to $SLACK_PR_WEBHOOK_URL
#
# Options:
#   --send            actually post (requires SLACK_PR_WEBHOOK_URL)
#   --context FILE    context.json to read the PR link from
#                     (default: context.json next to REPORT.md)
#
# REPORT.md must follow templates/release-readiness-report.md: the parser reads
# the "Risk Level" and "Release Readiness Score" table rows, the "## <Section>"
# headings and the bold line under "## Recommendation".
# The webhook decides the channel and bot name; they cannot be set from here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

usage() { sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

SEND=false
REPORT_FILE=""
CONTEXT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --send) SEND=true; shift ;;
    --context) eci_need_value "$1" $#; CONTEXT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) usage >&2; eci_die "Unknown option: $1" ;;
    *) REPORT_FILE="$1"; shift ;;
  esac
done

[[ -n "$REPORT_FILE" ]] || { usage >&2; eci_die "REPORT.md is required"; }
[[ -f "$REPORT_FILE" ]] || eci_die "Report file not found: $REPORT_FILE"
CONTEXT_FILE="${CONTEXT_FILE:-$(dirname "$REPORT_FILE")/context.json}"
eci_find_python

PAYLOAD="$("$PY" - "$(eci_pypath "$REPORT_FILE")" "$(eci_pypath "$CONTEXT_FILE")" <<'PYEOF'
import json
import os
import re
import sys

report_path, context_path = sys.argv[1], sys.argv[2]
with open(report_path, encoding="utf-8") as f:
    report = f.read()

pr_url = ""
label = "Change"
if os.path.exists(context_path):
    with open(context_path, encoding="utf-8") as f:
        ctx = json.load(f)
    pr_url = ctx.get("pr_url", "")
    if "/pull/" in pr_url:
        label = "PR #" + pr_url.split("/pull/")[-1].split("/")[0]
    elif ctx.get("target"):
        label = f"{ctx.get('mode', 'change')} {ctx['target']}"


def section(name):
    m = re.search(rf"^##\s+{re.escape(name)}\s*$\n(.*?)(?=^##\s|\Z)", report, re.M | re.S)
    return m.group(1).strip() if m else ""


def table_value(label_text):
    m = re.search(rf"^\|\s*{re.escape(label_text)}\s*\|\s*(.+?)\s*\|", report, re.M)
    return m.group(1).strip() if m else ""


risk = table_value("Risk Level") or "Unknown"
readiness = table_value("Release Readiness Score") or "Unknown"
rec_m = re.search(r"^##\s+Recommendation\s*$\s*^\*\*(.+?)\*\*", report, re.M)
recommendation = rec_m.group(1).strip() if rec_m else "Review Required"


def first_word(text):
    words = text.lower().split()
    return words[0] if words else ""


risk_emoji = {"low": ":large_green_circle:", "medium": ":large_yellow_circle:",
              "high": ":large_orange_circle:", "critical": ":red_circle:"}.get(first_word(risk), ":white_circle:")
rec_emoji = {"approve": ":white_check_mark:", "review": ":warning:",
             "block": ":no_entry:"}.get(first_word(recommendation), ":clipboard:")

blocks = [{
    "type": "header",
    "text": {"type": "plain_text", "text": f"{label} - Engineering Change Intelligence"[:150]},
}]
if pr_url:
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*<{pr_url}|View change>*"}})
blocks.append({
    "type": "section",
    "fields": [
        {"type": "mrkdwn", "text": f"*Risk:*\n{risk_emoji} {risk}"},
        {"type": "mrkdwn", "text": f"*Readiness:*\n{readiness}"},
        {"type": "mrkdwn", "text": f"*Recommendation:*\n{rec_emoji} {recommendation}"},
    ],
})

for name, title in [
    ("Features", "Features Impacted"),
    ("Services", "Services Impacted"),
    ("Infrastructure", "Infrastructure Changes"),
    ("Security", "Security Findings"),
    ("Cost Impact", "Cost Impact"),
    ("Observability", "Observability"),
    ("Rollback", "Rollback Complexity"),
    ("Top Risks", "Top Risks"),
    ("Recommended Monitoring", "Post-Deploy Monitoring"),
]:
    content = section(name)
    if not content:
        continue
    # GitHub markdown bold -> Slack mrkdwn bold
    content = re.sub(r"\*\*(.+?)\*\*", r"*\1*", content)
    if len(content) > 500:
        content = content[:497] + "..."
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*{title}*\n{content}"}})

blocks.append({"type": "divider"})
blocks.append({"type": "context", "elements": [
    {"type": "mrkdwn", "text": "Engineering Change Intelligence (local run)"}]})

payload = {"blocks": blocks, "text": f"{label} review: {risk} risk, {recommendation}"}
print(json.dumps(payload, indent=2))
PYEOF
)"

if [[ "$SEND" != "true" ]]; then
  echo "== Slack payload preview (nothing posted) =="
  printf '%s\n' "$PAYLOAD"
  echo ""
  echo "To post it, set SLACK_PR_WEBHOOK_URL and re-run with --send."
  exit 0
fi

WEBHOOK_URL="${SLACK_PR_WEBHOOK_URL:-}"
[[ -n "$WEBHOOK_URL" ]] || eci_die "--send needs SLACK_PR_WEBHOOK_URL (see .env.example)"
command -v curl >/dev/null 2>&1 || eci_die "curl is required for --send"

RESP="$(mktemp)"
trap 'rm -f "$RESP"' EXIT
HTTP_CODE="$(printf '%s' "$PAYLOAD" | curl -sS -o "$RESP" -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" --data-binary @-)"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "Posted to Slack."
else
  echo "ERROR: Slack returned HTTP $HTTP_CODE" >&2
  cat "$RESP" >&2
  exit 1
fi
