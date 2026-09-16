---
name: Pipeline Tracker
description: Track RealtyFlow leads through conversion stages (LEAD → CONTACTED → DEMO_SCHEDULED → DEMO_COMPLETED → TRIAL → PAID) with local JSON storage, lead deduplication, stage updates, daily summaries, and funnel analytics. Targets 3,000-lead campaign with performance visibility.
---

# Pipeline Tracker Skill

## Overview
This skill enables real-time pipeline tracking for RealtyFlow's 3,000-agent outreach campaign. Since Google Sheets is unavailable in Cowork, uses JSON-based local storage with Node.js/Bash helpers for lead operations, stage management, summary generation, and funnel reporting.

---

## Pipeline Stages & Definitions

### Stage Flow Diagram

```
                         ┌─────────────┐
                         │    LEAD     │ (Scraped, not contacted)
                         └──────┬──────┘
                                │
                         ┌──────▼──────────┐
                         │    CONTACTED    │ (Email/WhatsApp sent)
                         └──────┬──────────┘
                    ┌───────────┼───────────┐
            ┌───────▼──────┐         ┌──────▼──────┐
            │  NO_RESPONSE │         │  DEMO_SCHED │
            │   (30 days)  │         │  (Accepted) │
            └──────────────┘         └──────┬──────┘
                                            │
                                     ┌──────▼───────┐
                                     │ DEMO_COMPLETE│
                        ┌────────────┤   (Attended) │
                        │            └──────┬───────┘
                   ┌────▼─────┐             │
                   │  NO_SHOW │    ┌────────▼────────┐
                   │          │    │  TRIAL_STARTED  │
                   └──────────┘    └────────┬────────┘
                                           │
                                    ┌──────▼──────┐
                                    │    PAID     │ (Subscription)
                                    └─────────────┘

Fallout Stages:
- COLD: No engagement after nurture (21+ days)
- NO_RESPONSE: No reply after 7+ touchpoints
- NO_SHOW: Missed scheduled demo
- LOST: Was TRIAL, but didn't convert
- CHURNED: Was PAID, but cancelled
```

### Stage Definitions

| Stage | Entry Condition | Exit Actions | Days in Stage |
|-------|-----------------|--------------|---------------|
| **LEAD** | Scraped from Google Maps/LinkedIn | Any contact attempt | 1-7 days |
| **CONTACTED** | Email/WhatsApp sent | Response received or 30 days elapsed | 1-30 days |
| **DEMO_SCHEDULED** | Meeting booked on calendar | Demo completed or no-show | 1-7 days |
| **DEMO_COMPLETED** | Demo call/video finished | Offer trial or lost | 0-1 days |
| **TRIAL_STARTED** | User signs up for free trial | Payment received or expires | 7-30 days |
| **PAID** | First payment received | Active subscription | Ongoing |
| **COLD** | No response after 21 days | Archive (no further outreach) | End |
| **NO_RESPONSE** | 7+ touchpoints, zero engagement | Archive | End |
| **NO_SHOW** | Missed scheduled demo 2x | Remove from campaign | End |
| **LOST** | Was in TRIAL, didn't pay | Archive for future nurture | End |
| **CHURNED** | Was PAID, cancelled | Analytics + win-back campaign | End |

---

## Lead Record Schema

### JSON Structure

```json
{
  "leadId": "LEAD_20250217_001",
  "sourceSystem": "google_maps",
  "basicInfo": {
    "firstName": "Priya",
    "lastName": "Sharma",
    "company": "Sharma Real Estate",
    "title": "Co-Founder",
    "city": "Mumbai",
    "area": "Bandra"
  },
  "contactInfo": {
    "email": "priya.sharma@sharmaerealestate.in",
    "phone": "+919876543210",
    "website": "https://sharmaerealestate.in",
    "linkedinUrl": "https://linkedin.com/in/priyasharma"
  },
  "sourceMetrics": {
    "googleRating": 4.7,
    "googleReviews": 45,
    "agencySize": "small_team",
    "yearsInBusiness": 8
  },
  "leadQualification": {
    "leadScore": 42,
    "leadTier": "HOT",
    "qualifyingFactors": ["email", "phone", "high_rating", "active"],
    "qualifyingDate": "2025-02-17T10:30:00Z"
  },
  "pipelineTracking": {
    "currentStage": "DEMO_SCHEDULED",
    "stageHistory": [
      {
        "stage": "LEAD",
        "enteredDate": "2025-02-17T09:00:00Z",
        "exitedDate": "2025-02-17T10:15:00Z",
        "daysInStage": 0.05
      },
      {
        "stage": "CONTACTED",
        "enteredDate": "2025-02-17T10:15:00Z",
        "exitedDate": "2025-02-17T13:45:00Z",
        "daysInStage": 0.15,
        "contactMethod": "email",
        "response": "positive"
      },
      {
        "stage": "DEMO_SCHEDULED",
        "enteredDate": "2025-02-17T13:45:00Z",
        "exitedDate": null,
        "daysInStage": null,
        "meetingDate": "2025-02-20T15:00:00Z",
        "meetingType": "zoom_call"
      }
    ]
  },
  "interactions": [
    {
      "date": "2025-02-17T10:15:00Z",
      "type": "email",
      "subject": "Apne leads ko 10x faster manage karo",
      "status": "sent",
      "trackingId": "email_001"
    },
    {
      "date": "2025-02-17T13:45:00Z",
      "type": "email_reply",
      "body": "This looks interesting! Can we schedule a demo?",
      "sentiment": "positive",
      "replyTime": "3h 30m"
    }
  ],
  "conversionData": {
    "decisionDrivers": ["pain_point", "team_size_match", "budget_range"],
    "objections": ["integration_with_existing_tools"],
    "nextSteps": ["address_integrations", "send_tech_specs"],
    "estimatedCloseDate": "2025-02-27T15:00:00Z",
    "closeProbability": 0.65
  },
  "metadata": {
    "createdDate": "2025-02-17T09:00:00Z",
    "lastModified": "2025-02-17T13:45:00Z",
    "assignedTo": "sales_team_1",
    "tags": ["hot", "demo_scheduled", "strong_interest"],
    "notes": "Team of 3 agents, looking to automate follow-ups. Budget: ₹5-10k/month."
  }
}
```

---

## Pipeline Operations

### 1. Add Lead (with Deduplication)

```bash
#!/bin/bash
# add-lead.sh

# Add a new lead to pipeline with automatic dedup check

LEADS_FILE="pipeline.json"
PHONE=$1
EMAIL=$2
FIRST_NAME=$3
COMPANY=$4

# Check if lead already exists (by phone or email)
EXISTING=$(jq --arg phone "$PHONE" --arg email "$EMAIL" \
  '.leads[] | select(.contactInfo.phone == $phone or .contactInfo.email == $email) | .leadId' \
  "$LEADS_FILE" 2>/dev/null)

if [ -n "$EXISTING" ]; then
  echo "Lead already exists: $EXISTING"
  exit 1
fi

# Generate new lead ID
LEAD_ID="LEAD_$(date +%Y%m%d_%H%M%S)_$(uuidgen | cut -c1-8)"

# Create lead JSON
cat > /tmp/new_lead.json << EOF
{
  "leadId": "$LEAD_ID",
  "sourceSystem": "manual_import",
  "basicInfo": {
    "firstName": "$FIRST_NAME",
    "lastName": "",
    "company": "$COMPANY",
    "title": "",
    "city": "",
    "area": ""
  },
  "contactInfo": {
    "email": "$EMAIL",
    "phone": "$PHONE",
    "website": "",
    "linkedinUrl": ""
  },
  "leadQualification": {
    "leadScore": 0,
    "leadTier": "COLD",
    "qualifyingDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "pipelineTracking": {
    "currentStage": "LEAD",
    "stageHistory": [
      {
        "stage": "LEAD",
        "enteredDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "exitedDate": null
      }
    ]
  },
  "interactions": [],
  "metadata": {
    "createdDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lastModified": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF

# Add to pipeline
jq '.leads += [input]' "$LEADS_FILE" /tmp/new_lead.json > "${LEADS_FILE}.tmp"
mv "${LEADS_FILE}.tmp" "$LEADS_FILE"

echo "Lead added: $LEAD_ID"
```

### 2. Update Lead Stage

```bash
#!/bin/bash
# update-stage.sh

# Move lead to next stage in pipeline

LEADS_FILE="pipeline.json"
LEAD_ID=$1
NEW_STAGE=$2
NOTES=$3

jq --arg leadId "$LEAD_ID" --arg stage "$NEW_STAGE" --arg notes "$NOTES" \
  '.leads[] |=
    if .leadId == $leadId then
      .pipelineTracking.currentStage = $stage |
      .pipelineTracking.stageHistory += [{
        "stage": $stage,
        "enteredDate": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "exitedDate": null
      }] |
      .metadata.lastModified = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'" |
      if $notes != "" then .metadata.notes = $notes else . end
    else . end' \
  "$LEADS_FILE" > "${LEADS_FILE}.tmp"

mv "${LEADS_FILE}.tmp" "$LEADS_FILE"
echo "Lead $LEAD_ID moved to $NEW_STAGE"
```

### 3. Bulk Update (CSV Import)

```bash
#!/bin/bash
# bulk-import-leads.sh

# Import leads from CSV (e.g., from lead scraper)

INPUT_CSV=$1
LEADS_FILE="pipeline.json"

# Initialize pipeline if not exists
[ ! -f "$LEADS_FILE" ] && echo '{"leads":[]}' > "$LEADS_FILE"

# Parse CSV and add leads
tail -n +2 "$INPUT_CSV" | while IFS=',' read -r name address phone website rating reviews city email; do
  FIRST_NAME=$(echo "$name" | cut -d' ' -f1)
  COMPANY=$(echo "$name")

  # Add lead
  ./add-lead.sh "$phone" "$email" "$FIRST_NAME" "$COMPANY"
done

echo "Bulk import complete"
```

---

## Daily Summary Template

### Summary Report Structure

```markdown
# RealtyFlow Pipeline Summary
**Date:** 2025-02-17
**Report Period:** Feb 10 - Feb 17, 2025

## Executive Summary
- **Total Leads in Pipeline:** 847
- **New Leads This Week:** 156
- **Leads Qualified (HOT+WARM):** 287 (34%)
- **Conversion Rate (Contact → Trial):** 8.2%
- **Target 3K Leads:** 847/3000 (28.2% complete)

---

## Funnel Snapshot

| Stage | Count | % of Total | Trend | Avg Days |
|-------|-------|-----------|-------|----------|
| LEAD | 312 | 36.8% | ↑ 12% | 2.1 |
| CONTACTED | 198 | 23.4% | → | 8.3 |
| DEMO_SCHEDULED | 42 | 5.0% | ↑ 8% | 1.2 |
| DEMO_COMPLETED | 28 | 3.3% | ↑ 15% | 0.5 |
| TRIAL | 24 | 2.8% | ↑ 25% | 14.0 |
| **PAID** | **6** | **0.7%** | ✓ | - |
| (Fallout) | | | | |
| COLD | 187 | 22.1% | ↓ | - |
| NO_RESPONSE | 47 | 5.5% | → | - |
| LOST | 3 | 0.4% | ↓ | - |

---

## Key Metrics

### Conversion Rates
- **LEAD → CONTACTED:** 63.5% (198/312)
- **CONTACTED → DEMO:** 21.2% (42/198)
- **DEMO → TRIAL:** 85.7% (24/28)
- **TRIAL → PAID:** 25% (6/24) ⚠️ Low—needs improvement
- **Overall (LEAD → PAID):** 0.71% (6/847)

### Response Metrics
- **Avg Time to First Response:** 2.5 hours
- **Demos Scheduled (%):** 21.2% of contacted
- **No-Show Rate:** 8.3% (3/36 scheduled demos)
- **Trial Signup Rate:** 42.8% (12/28 demo completions)

### Velocity
- **Leads Added/Day:** 22.3
- **Stages Advanced/Day:** 34
- **Projected 3K Leads:** ~45 days (on track)

---

## Performance by City

| City | Total | HOT | WARM | CONTACTED % | Demo Rate | Paid |
|------|-------|-----|------|-------------|-----------|------|
| **Mumbai** | 198 | 42 | 65 | 68% | 28% | 2 |
| **Bangalore** | 156 | 28 | 52 | 64% | 22% | 1 |
| **Delhi** | 167 | 38 | 51 | 62% | 19% | 1 |
| **Pune** | 142 | 25 | 48 | 58% | 16% | 1 |
| **Hyderabad** | 98 | 18 | 31 | 56% | 14% | 1 |
| **Chennai** | 64 | 12 | 20 | 52% | 12% | 0 |
| **Dubai** | 22 | 4 | 7 | 48% | 8% | 0 |

**Insight:** Mumbai and Bangalore driving strongest performance. Dubai needs more leads.

---

## Performance by Source

| Source | Leads | Quality (Email/Phone) | Contact Rate | Demo Rate | Value |
|--------|-------|----------------------|--------------|-----------|-------|
| **Google Maps** | 654 | 82% | 66% | 22% | HIGH |
| **LinkedIn Scrape** | 142 | 71% | 54% | 15% | MEDIUM |
| **Instagram Scrape** | 51 | 45% | 28% | 8% | LOW |

**Insight:** Google Maps remains most reliable. Pause Instagram scraping; reallocate to LinkedIn.

---

## This Week's Highlights

### Wins
- ✓ 2 new customers signed up (PAID stage)
- ✓ 8 demos scheduled (best week yet)
- ✓ First-response time improved by 15%
- ✓ Mumbai outreach hit 68% contact rate

### Challenges
- ⚠️ Trial-to-paid conversion stuck at 25% (target: 35%)
- ⚠️ 3 no-shows this week (schedule reminder improvements needed)
- ⚠️ Email deliverability dipped to 92% (Mon/Tue)

### Pending Actions
- [ ] Debug trial-to-paid drop-off (send survey to 12 TRIAL leads)
- [ ] Add SMS reminders for scheduled demos
- [ ] Refresh Delhi lead pool (source quality declining)

---

## Forecasting

### Projected Close Rate
At current conversion rates (0.71% LEAD → PAID):
- **3K leads → ~21 customers**
- **Actual target:** 30-40 customers

**Action Required:** Improve TRIAL → PAID (need +50% conversion improvement)

### Velocity
- Current: 22 leads/day
- Needed: 66 leads/day to hit 3K in 45 days
- **Status:** Need to 3x lead scraping rate

---

## Alerts & Action Items

| Alert | Severity | Action |
|-------|----------|--------|
| Demo no-show rate 8.3% | MEDIUM | Add SMS reminder at T-24h + T-2h |
| Trial → Paid only 25% | HIGH | Run user survey to identify objections |
| Delhi quality declining | MEDIUM | Audit lead sources; reallocate budget |
| Email deliverability 92% | MEDIUM | Check DKIM/SPF; increase warmup |
| Below lead velocity target | HIGH | Scale Google Maps scraping to 2-3 cities/day |

---

## Next Week Goals

1. **Lead Generation:** Target 180+ new leads (from current 156)
2. **Conversion:** Schedule 12+ demos (from current 6)
3. **Customer Wins:** Close 2+ trials to paid (from current 0.43/day)
4. **Quality:** Maintain 65%+ contact rate on new leads
5. **Velocity:** Hit 500 leads cumulative (progress to 17% of 3K)

---

## Data Quality Checklist

- [x] Pipeline JSON synced and backed up
- [x] Duplicate leads removed (dedup: 12 flagged)
- [x] Phone numbers validated (+91/+971 format)
- [x] Emails verified (85% validation rate)
- [ ] LinkedIn URLs enriched for 100% of contacts
- [ ] All stage transitions logged with timestamps
- [ ] Notes added for all COLD/LOST/NO_RESPONSE

---

*Report Generated: 2025-02-17 | Next Update: 2025-02-24*
```

---

## Node.js Pipeline Manager

### Create Pipeline Manager Script

```javascript
// pipeline-manager.js

const fs = require('fs');
const path = require('path');

class PipelineManager {
  constructor(pipelineFile = 'pipeline.json') {
    this.pipelineFile = pipelineFile;
    this.initializePipeline();
  }

  initializePipeline() {
    if (!fs.existsSync(this.pipelineFile)) {
      const empty = { leads: [] };
      fs.writeFileSync(this.pipelineFile, JSON.stringify(empty, null, 2));
    }
  }

  getPipeline() {
    const data = fs.readFileSync(this.pipelineFile, 'utf8');
    return JSON.parse(data);
  }

  savePipeline(pipeline) {
    fs.writeFileSync(this.pipelineFile, JSON.stringify(pipeline, null, 2));
  }

  // Add lead with dedup check
  addLead(leadData) {
    const pipeline = this.getPipeline();

    // Check for duplicates
    const exists = pipeline.leads.some(l =>
      l.contactInfo.phone === leadData.contactInfo.phone ||
      l.contactInfo.email === leadData.contactInfo.email
    );

    if (exists) {
      throw new Error(`Lead already exists: ${leadData.contactInfo.email}`);
    }

    // Generate lead ID
    const leadId = `LEAD_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const newLead = {
      leadId,
      sourceSystem: leadData.sourceSystem || 'manual',
      basicInfo: leadData.basicInfo || {},
      contactInfo: leadData.contactInfo,
      leadQualification: leadData.leadQualification || {
        leadScore: 0,
        leadTier: 'COLD',
        qualifyingDate: new Date().toISOString()
      },
      pipelineTracking: {
        currentStage: 'LEAD',
        stageHistory: [{
          stage: 'LEAD',
          enteredDate: new Date().toISOString(),
          exitedDate: null
        }]
      },
      interactions: [],
      metadata: {
        createdDate: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };

    pipeline.leads.push(newLead);
    this.savePipeline(pipeline);
    return newLead;
  }

  // Update lead stage
  updateStage(leadId, newStage, notes = null) {
    const pipeline = this.getPipeline();
    const lead = pipeline.leads.find(l => l.leadId === leadId);

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Close previous stage
    const lastStage = lead.pipelineTracking.stageHistory[lead.pipelineTracking.stageHistory.length - 1];
    lastStage.exitedDate = new Date().toISOString();
    lastStage.daysInStage = (Date.now() - new Date(lastStage.enteredDate)) / (1000 * 60 * 60 * 24);

    // Add new stage
    lead.pipelineTracking.stageHistory.push({
      stage: newStage,
      enteredDate: new Date().toISOString(),
      exitedDate: null
    });

    lead.pipelineTracking.currentStage = newStage;
    lead.metadata.lastModified = new Date().toISOString();

    if (notes) {
      lead.metadata.notes = notes;
    }

    this.savePipeline(pipeline);
    return lead;
  }

  // Get leads by stage
  getLeadsByStage(stage) {
    const pipeline = this.getPipeline();
    return pipeline.leads.filter(l => l.pipelineTracking.currentStage === stage);
  }

  // Get funnel summary
  getFunnelSummary() {
    const pipeline = this.getPipeline();
    const stages = [
      'LEAD', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED',
      'TRIAL', 'PAID', 'COLD', 'NO_RESPONSE', 'NO_SHOW', 'LOST', 'CHURNED'
    ];

    const summary = {};
    stages.forEach(stage => {
      const leads = pipeline.leads.filter(l => l.pipelineTracking.currentStage === stage);
      summary[stage] = {
        count: leads.length,
        percentage: ((leads.length / pipeline.leads.length) * 100).toFixed(1)
      };
    });

    return summary;
  }

  // Calculate conversion rates
  getConversionRates() {
    const summary = this.getFunnelSummary();

    return {
      'LEAD_to_CONTACTED': (
        (parseInt(summary.CONTACTED.count) / parseInt(summary.LEAD.count)) * 100
      ).toFixed(1),
      'CONTACTED_to_DEMO': (
        (parseInt(summary.DEMO_SCHEDULED.count) / parseInt(summary.CONTACTED.count)) * 100
      ).toFixed(1),
      'DEMO_to_TRIAL': (
        (parseInt(summary.TRIAL.count) / parseInt(summary.DEMO_COMPLETED.count)) * 100
      ).toFixed(1),
      'TRIAL_to_PAID': (
        (parseInt(summary.PAID.count) / parseInt(summary.TRIAL.count)) * 100
      ).toFixed(1)
    };
  }

  // Generate daily summary
  generateDailySummary() {
    const pipeline = this.getPipeline();
    const summary = this.getFunnelSummary();
    const rates = this.getConversionRates();

    const report = {
      generatedDate: new Date().toISOString(),
      totalLeads: pipeline.leads.length,
      funnel: summary,
      conversionRates: rates,
      newLeadsToday: pipeline.leads.filter(l =>
        new Date(l.metadata.createdDate).toDateString() === new Date().toDateString()
      ).length
    };

    return report;
  }

  // Export to CSV
  exportToCSV(filename = 'pipeline_export.csv') {
    const pipeline = this.getPipeline();
    let csv = 'leadId,firstName,lastName,email,phone,company,currentStage,leadScore,createdDate\n';

    pipeline.leads.forEach(lead => {
      const row = [
        lead.leadId,
        lead.basicInfo.firstName || '',
        lead.basicInfo.lastName || '',
        lead.contactInfo.email || '',
        lead.contactInfo.phone || '',
        lead.basicInfo.company || '',
        lead.pipelineTracking.currentStage,
        lead.leadQualification.leadScore || 0,
        lead.metadata.createdDate
      ];
      csv += row.map(v => `"${v}"`).join(',') + '\n';
    });

    fs.writeFileSync(filename, csv);
    console.log(`Exported ${pipeline.leads.length} leads to ${filename}`);
  }
}

module.exports = PipelineManager;

// Usage example:
const pm = new PipelineManager();

// Add lead
const newLead = pm.addLead({
  sourceSystem: 'google_maps',
  basicInfo: { firstName: 'Priya', lastName: 'Sharma', company: 'Sharma Realty' },
  contactInfo: {
    email: 'priya@sharmaerealty.com',
    phone: '+919876543210'
  }
});

// Update stage
pm.updateStage(newLead.leadId, 'CONTACTED', 'Sent initial email');

// Get summary
console.log('Funnel Summary:', pm.getFunnelSummary());
console.log('Conversion Rates:', pm.getConversionRates());

// Export
pm.exportToCSV();
```

---

## Python Pipeline Helper (Alternative)

```python
# pipeline_manager.py

import json
from datetime import datetime
from typing import List, Dict, Optional

class PipelineManager:
    def __init__(self, pipeline_file='pipeline.json'):
        self.pipeline_file = pipeline_file
        self.initialize_pipeline()

    def initialize_pipeline(self):
        try:
            with open(self.pipeline_file, 'r') as f:
                json.load(f)
        except FileNotFoundError:
            with open(self.pipeline_file, 'w') as f:
                json.dump({'leads': []}, f)

    def get_pipeline(self) -> Dict:
        with open(self.pipeline_file, 'r') as f:
            return json.load(f)

    def save_pipeline(self, pipeline: Dict):
        with open(self.pipeline_file, 'w') as f:
            json.dump(pipeline, f, indent=2)

    def add_lead(self, lead_data: Dict) -> Dict:
        pipeline = self.get_pipeline()

        # Check for duplicates
        for lead in pipeline['leads']:
            if (lead['contactInfo']['phone'] == lead_data['contactInfo']['phone'] or
                lead['contactInfo']['email'] == lead_data['contactInfo']['email']):
                raise ValueError('Lead already exists')

        lead_id = f"LEAD_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        new_lead = {
            'leadId': lead_id,
            'basicInfo': lead_data.get('basicInfo', {}),
            'contactInfo': lead_data['contactInfo'],
            'pipelineTracking': {
                'currentStage': 'LEAD',
                'stageHistory': [{
                    'stage': 'LEAD',
                    'enteredDate': datetime.utcnow().isoformat() + 'Z',
                    'exitedDate': None
                }]
            },
            'metadata': {
                'createdDate': datetime.utcnow().isoformat() + 'Z',
                'lastModified': datetime.utcnow().isoformat() + 'Z'
            }
        }

        pipeline['leads'].append(new_lead)
        self.save_pipeline(pipeline)
        return new_lead

    def update_stage(self, lead_id: str, new_stage: str, notes: Optional[str] = None):
        pipeline = self.get_pipeline()
        lead = next((l for l in pipeline['leads'] if l['leadId'] == lead_id), None)

        if not lead:
            raise ValueError(f'Lead not found: {lead_id}')

        lead['pipelineTracking']['currentStage'] = new_stage
        lead['pipelineTracking']['stageHistory'].append({
            'stage': new_stage,
            'enteredDate': datetime.utcnow().isoformat() + 'Z',
            'exitedDate': None
        })
        lead['metadata']['lastModified'] = datetime.utcnow().isoformat() + 'Z'

        if notes:
            lead['metadata']['notes'] = notes

        self.save_pipeline(pipeline)
        return lead

    def get_funnel_summary(self) -> Dict:
        pipeline = self.get_pipeline()
        stages = ['LEAD', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED',
                  'TRIAL', 'PAID', 'COLD', 'NO_RESPONSE', 'NO_SHOW', 'LOST']
        total = len(pipeline['leads'])

        summary = {}
        for stage in stages:
            count = len([l for l in pipeline['leads'] if l['pipelineTracking']['currentStage'] == stage])
            summary[stage] = {
                'count': count,
                'percentage': round((count / total * 100) if total > 0 else 0, 1)
            }

        return summary

    def export_csv(self, filename='pipeline_export.csv'):
        pipeline = self.get_pipeline()
        import csv

        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['leadId', 'email', 'phone', 'company', 'stage', 'createdDate'])

            for lead in pipeline['leads']:
                writer.writerow([
                    lead['leadId'],
                    lead['contactInfo'].get('email', ''),
                    lead['contactInfo'].get('phone', ''),
                    lead['basicInfo'].get('company', ''),
                    lead['pipelineTracking']['currentStage'],
                    lead['metadata']['createdDate']
                ])

        print(f'Exported {len(pipeline["leads"])} leads to {filename}')

# Usage
if __name__ == '__main__':
    pm = PipelineManager()
    pm.add_lead({
        'basicInfo': {'company': 'Test Realty'},
        'contactInfo': {'email': 'test@realty.com', 'phone': '+919876543210'}
    })
    print(pm.get_funnel_summary())
    pm.export_csv()
```

---

## Bash Cron Job for Daily Summary

```bash
#!/bin/bash
# daily-summary-cron.sh

# Run daily at 9 AM IST (no Google Sheets, so generates markdown summary)

PIPELINE_FILE="pipeline.json"
SUMMARY_DIR="./summaries"
SUMMARY_DATE=$(date +%Y-%m-%d)
SUMMARY_FILE="${SUMMARY_DIR}/daily-summary-${SUMMARY_DATE}.md"

mkdir -p "$SUMMARY_DIR"

# Generate summary using Node.js
node << 'EOF'
const PipelineManager = require('./pipeline-manager.js');
const fs = require('fs');

const pm = new PipelineManager();
const summary = pm.generateDailySummary();
const funnel = pm.getFunnelSummary();
const rates = pm.getConversionRates();

const report = `# RealtyFlow Pipeline Summary
Date: ${new Date().toLocaleDateString()}

## Snapshot
- Total Leads: ${summary.totalLeads}
- New Leads Today: ${summary.newLeadsToday}

## Funnel
${Object.entries(funnel).map(([stage, data]) =>
  `- ${stage}: ${data.count} (${data.percentage}%)`
).join('\n')}

## Conversion Rates
${Object.entries(rates).map(([rate, value]) =>
  `- ${rate}: ${value}%`
).join('\n')}

Generated: ${new Date().toISOString()}
`;

fs.writeFileSync(process.env.SUMMARY_FILE, report);
console.log('Summary generated');
EOF

# Send email notification (optional)
if [ -f "$SUMMARY_FILE" ]; then
  echo "Daily summary generated: $SUMMARY_FILE"
  # mail -s "RealtyFlow Pipeline Summary - $SUMMARY_DATE" team@realtyflow.io < "$SUMMARY_FILE"
fi
```

---

## Output Files to Generate

1. `pipeline.json` — Main JSON database (leads + stage history)
2. `daily-summary-YYYY-MM-DD.md` — Daily markdown report
3. `pipeline_export.csv` — CSV export for analysis
4. `funnel_snapshot.json` — JSON snapshot of funnel metrics
5. `conversion_metrics.json` — Conversion rate analytics

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| **Total Leads** | 3,000 | In progress |
| **Contact Rate** | 60%+ | 63.5% ✓ |
| **Demo Rate** | 15%+ | 21.2% ✓ |
| **Trial Conversion** | 30%+ | 42.8% ✓ |
| **Paid Conversion** | 25%+ | 25% (need to improve) |
| **Overall Lead → Paid** | 2-3% | 0.71% (target: 2%+) |
| **Lead Generation Velocity** | 70/day | 22/day (behind target) |

---

## Usage Instructions

1. **Initialize Pipeline:** `node pipeline-manager.js` (creates pipeline.json)
2. **Add Leads:** Bulk import from CSV using `bulk-import-leads.sh`
3. **Track Progress:** Update stages via API or script
4. **Daily Reports:** Cron job generates `daily-summary-YYYY-MM-DD.md`
5. **Export Data:** `pipeline-manager.js exportToCSV()` for analysis

All data stored locally in JSON. No external dependencies required.
