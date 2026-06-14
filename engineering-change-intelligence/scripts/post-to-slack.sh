#!/usr/bin/env bash
# post-to-slack.sh — Post PR intelligence report to Slack
# Usage:
#   ./post-to-slack.sh reports/current/release-readiness.md
#   ./post-to-slack.sh --dry-run reports/current/release-readiness.md
#
# Requires: SLACK_PR_WEBHOOK_URL environment variable
# Optional: SLACK_PR_CHANNEL (for display), SLACK_BOT_NAME

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECI_DIR="$(dirname "$SCRIPT_DIR")"
DRY_RUN=false
REPORT_FILE=""
CONTEXT_FILE="${ECI_CONTEXT:-$ECI_DIR/reports/current/context.json}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: post-to-slack.sh [--dry-run] <report-file.md>"
      exit 0
      ;;
    *) REPORT_FILE="$1"; shift ;;
  esac
done

if [[ -z "$REPORT_FILE" ]]; then
  REPORT_FILE="$ECI_DIR/reports/current/release-readiness.md"
fi

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "ERROR: Report file not found: $REPORT_FILE" >&2
  exit 1
fi

WEBHOOK_URL="${SLACK_PR_WEBHOOK_URL:-}"
if [[ -z "$WEBHOOK_URL" && "$DRY_RUN" == "false" ]]; then
  echo "WARNING: SLACK_PR_WEBHOOK_URL not set. Running in dry-run mode." >&2
  DRY_RUN=true
fi

# Parse context
PR_URL=""
PR_NUMBER=""
RISK=""
READINESS=""
RECOMMENDATION=""
if [[ -f "$CONTEXT_FILE" ]]; then
  PR_URL=$(python3 -c "import json; print(json.load(open('$CONTEXT_FILE')).get('pr_url',''))" 2>/dev/null || echo "")
fi

# Extract key fields from report
extract_field() {
  local field="$1"
  grep -i "^${field}:" "$REPORT_FILE" 2>/dev/null | head -1 | sed "s/^${field}:[[:space:]]*//i" || echo ""
}

RISK=$(extract_field "Risk" || extract_field "Risk Level")
READINESS=$(extract_field "Readiness" || extract_field "Release Readiness Score")
RECOMMENDATION=$(extract_field "Recommendation" || grep -i "Go / No-Go" "$REPORT_FILE" | head -1 | sed 's/.*: //' || echo "")

# Build Slack blocks from report
PAYLOAD=$(python3 <<PYEOF
import json, re, os

report_path = "$REPORT_FILE"
context_path = "$CONTEXT_FILE"

with open(report_path) as f:
    report = f.read()

pr_url = ""
pr_number = "N/A"
if os.path.exists(context_path):
    with open(context_path) as f:
        ctx = json.load(f)
    pr_url = ctx.get("pr_url", "")
    if "/pull/" in pr_url:
        pr_number = pr_url.split("/pull/")[-1].split("/")[0]

def extract_section(name):
    pattern = rf"(?i)^{re.escape(name)}:?\\s*\\n(.*?)(?=\\n[A-Z][a-z].*:|\\n## |\\Z)"
    m = re.search(pattern, report, re.DOTALL | re.MULTILINE)
    return m.group(1).strip() if m else ""

def extract_inline(name):
    m = re.search(rf"(?i)^{re.escape(name)}:?\\s*(.+)", report)
    return m.group(1).strip() if m else "N/A"

risk = extract_inline("Risk") or extract_inline("Risk Level") or "Unknown"
readiness = extract_inline("Readiness") or extract_inline("Release Readiness Score") or "Unknown"
recommendation = extract_inline("Recommendation") or extract_inline("Go / No-Go") or "Review Required"

# Risk emoji
risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🟠", "critical": "🔴"}.get(risk.lower().split()[0], "⚪")
rec_emoji = {"approve": "✅", "review": "⚠️", "block": "🚫"}.get(recommendation.lower().split()[0], "📋")

blocks = [
    {
        "type": "header",
        "text": {"type": "plain_text", "text": f"PR #{pr_number} — Engineering Change Intelligence", "emoji": True}
    },
]

if pr_url:
    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": f"*<{pr_url}|View Pull Request>*"}
    })

blocks.append({
    "type": "section",
    "fields": [
        {"type": "mrkdwn", "text": f"*Risk:*\\n{risk_emoji} {risk}"},
        {"type": "mrkdwn", "text": f"*Readiness:*\\n{readiness}"},
        {"type": "mrkdwn", "text": f"*Recommendation:*\\n{rec_emoji} {recommendation}"},
    ]
})

# Extract list sections
for section_name, block_title in [
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
    content = extract_section(section_name)
    if content:
        # Truncate long sections
        if len(content) > 500:
            content = content[:497] + "..."
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*{block_title}*\\n{content}"}
        })

blocks.append({"type": "divider"})
blocks.append({
    "type": "context",
    "elements": [{"type": "mrkdwn", "text": "🤖 Engineering Change Intelligence Platform | Cloudberry CRM"}]
})

payload = {
    "username": os.environ.get("SLACK_BOT_NAME", "PR Intelligence Bot"),
    "blocks": blocks,
    "text": f"PR #{pr_number} Review: {risk} risk, {recommendation}",
}

print(json.dumps(payload, indent=2))
PYEOF
)

if [[ "$DRY_RUN" == "true" ]]; then
  echo "=== DRY RUN — Slack payload ==="
  echo "$PAYLOAD"
  echo ""
  echo "To post for real, set SLACK_PR_WEBHOOK_URL and run without --dry-run"
  exit 0
fi

HTTP_CODE=$(curl -s -o /tmp/slack-response.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ Posted to Slack successfully"
else
  echo "ERROR: Slack returned HTTP $HTTP_CODE" >&2
  cat /tmp/slack-response.txt >&2
  exit 1
fi
