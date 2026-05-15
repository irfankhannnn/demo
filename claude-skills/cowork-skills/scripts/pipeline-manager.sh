#!/bin/bash
# RealtyFlow — Pipeline Manager (JSON-based local storage)
# Manages lead pipeline stages and generates reports
# Usage: ./pipeline-manager.sh add --name "Agency" --phone "+919876543210" --email "a@b.com" --city "Mumbai"
# Usage: ./pipeline-manager.sh update --id "lead_001" --stage "DEMO_SCHEDULED"
# Usage: ./pipeline-manager.sh summary
# Usage: ./pipeline-manager.sh export --format csv

set -euo pipefail

PIPELINE_FILE="${PIPELINE_DIR:-./pipeline}/pipeline.json"
SUMMARY_DIR="${PIPELINE_DIR:-./pipeline}"

# Ensure pipeline directory and file exist
mkdir -p "$(dirname "$PIPELINE_FILE")"
if [ ! -f "$PIPELINE_FILE" ]; then
    echo '{"leads": [], "metadata": {"created": "'$(date -Iseconds)'", "total_added": 0}}' > "$PIPELINE_FILE"
fi

ACTION="${1:-help}"
shift || true

# Parse arguments
NAME="" PHONE="" EMAIL="" CITY="" SOURCE="" SCORE="" STAGE="" NOTES="" LEAD_ID="" FORMAT="json"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --name) NAME="$2"; shift 2 ;;
        --phone) PHONE="$2"; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        --city) CITY="$2"; shift 2 ;;
        --source) SOURCE="$2"; shift 2 ;;
        --score) SCORE="$2"; shift 2 ;;
        --stage) STAGE="$2"; shift 2 ;;
        --notes) NOTES="$2"; shift 2 ;;
        --id) LEAD_ID="$2"; shift 2 ;;
        --format) FORMAT="$2"; shift 2 ;;
        *) echo "Unknown: $1"; shift ;;
    esac
done

case "$ACTION" in
    add)
        if [ -z "$NAME" ] || [ -z "$PHONE" ]; then
            echo "Error: --name and --phone are required"
            exit 1
        fi

        # Check duplicate by phone
        EXISTING=$(jq -r --arg phone "$PHONE" '.leads[] | select(.phone == $phone) | .lead_id' "$PIPELINE_FILE" | head -1)
        if [ -n "$EXISTING" ]; then
            echo "Duplicate: Lead with phone $PHONE already exists (ID: $EXISTING)"
            exit 1
        fi

        # Generate ID
        TOTAL=$(jq '.metadata.total_added' "$PIPELINE_FILE")
        NEW_TOTAL=$((TOTAL + 1))
        NEW_ID="lead_$(printf '%04d' $NEW_TOTAL)"
        NOW=$(date -Iseconds)

        # Add lead
        jq --arg id "$NEW_ID" --arg name "$NAME" --arg phone "$PHONE" \
           --arg email "${EMAIL:-}" --arg city "${CITY:-}" \
           --arg source "${SOURCE:-manual}" --arg score "${SCORE:-0}" \
           --arg now "$NOW" --arg notes "${NOTES:-}" \
           '.leads += [{
              lead_id: $id,
              name: $name,
              phone: $phone,
              email: $email,
              city: $city,
              source: $source,
              score: ($score | tonumber),
              stage: "LEAD",
              stage_date: $now,
              notes: $notes,
              created_at: $now,
              history: [{ stage: "LEAD", date: $now }]
           }] | .metadata.total_added = ($id | ltrimstr("lead_") | tonumber)' \
           "$PIPELINE_FILE" > "${PIPELINE_FILE}.tmp" && mv "${PIPELINE_FILE}.tmp" "$PIPELINE_FILE"

        echo "Added: $NEW_ID — $NAME ($PHONE) [Stage: LEAD]"
        ;;

    update)
        if [ -z "$LEAD_ID" ] || [ -z "$STAGE" ]; then
            echo "Error: --id and --stage are required"
            exit 1
        fi

        VALID_STAGES="LEAD CONTACTED DEMO_SCHEDULED DEMO_COMPLETED TRIAL PAID COLD NO_RESPONSE NO_SHOW LOST CHURNED"
        if ! echo "$VALID_STAGES" | grep -qw "$STAGE"; then
            echo "Error: Invalid stage '$STAGE'"
            echo "Valid: $VALID_STAGES"
            exit 1
        fi

        NOW=$(date -Iseconds)
        jq --arg id "$LEAD_ID" --arg stage "$STAGE" --arg now "$NOW" --arg notes "${NOTES:-}" \
           '(.leads[] | select(.lead_id == $id)) |= (
              .stage = $stage |
              .stage_date = $now |
              .notes = (if $notes != "" then $notes else .notes end) |
              .history += [{ stage: $stage, date: $now }]
           )' "$PIPELINE_FILE" > "${PIPELINE_FILE}.tmp" && mv "${PIPELINE_FILE}.tmp" "$PIPELINE_FILE"

        echo "Updated: $LEAD_ID → Stage: $STAGE"
        ;;

    summary)
        echo "# Pipeline Summary — $(date '+%Y-%m-%d')"
        echo ""

        TOTAL=$(jq '.leads | length' "$PIPELINE_FILE")
        echo "## Total Leads: $TOTAL"
        echo ""

        echo "## Funnel Stages"
        jq -r '.leads | group_by(.stage) | .[] | "  \(.[0].stage): \(length)"' "$PIPELINE_FILE"
        echo ""

        echo "## By City"
        jq -r '.leads | group_by(.city) | .[] | select(.[0].city != "") | "  \(.[0].city): \(length)"' "$PIPELINE_FILE"
        echo ""

        echo "## By Source"
        jq -r '.leads | group_by(.source) | .[] | "  \(.[0].source): \(length)"' "$PIPELINE_FILE"
        echo ""

        # Conversion rates
        LEADS=$(jq '[.leads[] | select(.stage == "LEAD")] | length' "$PIPELINE_FILE")
        CONTACTED=$(jq '[.leads[] | select(.stage == "CONTACTED")] | length' "$PIPELINE_FILE")
        DEMOS=$(jq '[.leads[] | select(.stage == "DEMO_SCHEDULED" or .stage == "DEMO_COMPLETED")] | length' "$PIPELINE_FILE")
        TRIALS=$(jq '[.leads[] | select(.stage == "TRIAL")] | length' "$PIPELINE_FILE")
        PAID=$(jq '[.leads[] | select(.stage == "PAID")] | length' "$PIPELINE_FILE")

        echo "## Conversion Funnel"
        echo "  Lead: $LEADS → Contacted: $CONTACTED → Demo: $DEMOS → Trial: $TRIALS → Paid: $PAID"
        if [ "$TOTAL" -gt 0 ]; then
            echo "  Contact Rate: $(( (CONTACTED + DEMOS + TRIALS + PAID) * 100 / TOTAL ))%"
        fi

        # 3K target
        echo ""
        echo "## 3K Lead Target Progress"
        echo "  Current: $TOTAL / 3000 ($(( TOTAL * 100 / 3000 ))%)"
        ;;

    export)
        if [ "$FORMAT" = "csv" ]; then
            CSV_FILE="${SUMMARY_DIR}/pipeline-export-$(date '+%Y%m%d').csv"
            echo "lead_id,name,phone,email,city,source,score,stage,stage_date,notes,created_at" > "$CSV_FILE"
            jq -r '.leads[] | [.lead_id,.name,.phone,.email,.city,.source,.score,.stage,.stage_date,.notes,.created_at] | @csv' \
              "$PIPELINE_FILE" >> "$CSV_FILE"
            echo "Exported to: $CSV_FILE"
        else
            echo "Pipeline JSON: $PIPELINE_FILE"
            jq '.leads | length' "$PIPELINE_FILE" | xargs -I{} echo "Total leads: {}"
        fi
        ;;

    search)
        if [ -n "$PHONE" ]; then
            jq --arg phone "$PHONE" '.leads[] | select(.phone | contains($phone))' "$PIPELINE_FILE"
        elif [ -n "$CITY" ]; then
            jq --arg city "$CITY" '.leads[] | select(.city == $city)' "$PIPELINE_FILE"
        elif [ -n "$STAGE" ]; then
            jq --arg stage "$STAGE" '[.leads[] | select(.stage == $stage)]' "$PIPELINE_FILE"
        else
            echo "Specify --phone, --city, or --stage to search"
        fi
        ;;

    help|*)
        echo "RealtyFlow Pipeline Manager"
        echo ""
        echo "Commands:"
        echo "  add       Add a new lead"
        echo "  update    Update lead stage"
        echo "  summary   Generate pipeline summary"
        echo "  export    Export pipeline (--format csv|json)"
        echo "  search    Search leads (--phone|--city|--stage)"
        echo ""
        echo "Examples:"
        echo "  $0 add --name 'Sharma Properties' --phone '+919876543210' --email 'rohit@sharma.com' --city 'Mumbai' --source 'scraping'"
        echo "  $0 update --id 'lead_0001' --stage 'DEMO_SCHEDULED' --notes 'Demo on March 20'"
        echo "  $0 summary"
        echo "  $0 export --format csv"
        ;;
esac
