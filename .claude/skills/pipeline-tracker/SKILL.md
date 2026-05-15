---
name: pipeline-tracker
description: >
  Track and manage the lead/demo/trial/paid pipeline via Google Sheets MCP
  or Excel files. Supports adding leads, updating stages, generating daily
  summaries, and tracking progress toward the 3,000 lead target.
  Use for any pipeline management or reporting task.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Grep
---

# Pipeline Tracker — RealtyFlow

Manage the lead pipeline. Action: $ARGUMENTS

## Pipeline Stages
```
LEAD → CONTACTED → DEMO_SCHEDULED → DEMO_COMPLETED → TRIAL → PAID
  └→ COLD        └→ NO_RESPONSE    └→ NO_SHOW       └→ LOST  └→ CHURNED
```

## Sheet Schema
```
lead_id | agency_name | contact_name | phone | email | city | team_size |
source | campaign_id | stage | stage_date | lead_score | lead_grade |
assigned_to | demo_date | demo_outcome | trial_start | trial_end |
paid_date | plan | mrr | notes | last_contact | next_action | next_action_date |
utm_source | utm_medium | utm_campaign | created_at
```

## Operations

### Add Lead
- Check duplicates by phone/email
- Append row: Stage=LEAD, created_at=now
- Auto-assign SDR (round-robin)

### Update Stage
- Set new stage + stage_date
- Set stage-specific fields (demo_date, trial_start, etc.)
- Calculate next_action based on stage

### Generate Summary
```markdown
# Pipeline Summary — [Date]
## Funnel: Lead → Contacted → Demo → Trial → Paid (counts + percentages)
## Source Performance (leads/demos/paid by source)
## City Performance
## Alerts (overdue follow-ups, expiring trials)
## 3K Target Progress
```

## Google Sheets Integration
- MCP Server: google-sheets
- Spreadsheet ID: ${GOOGLE_SHEETS_PIPELINE_ID}
- Auth: Service Account

## Offline Excel Mode
```powershell
.\claude-skills\scripts\sheets-update.ps1 -Action "create|add-lead|update-stage|summary"
```

## Output

Save to `marketing-and-sales/leads/`:
- `pipeline.xlsx` — Master pipeline
- `daily-summary-[date].md` — Daily reports
