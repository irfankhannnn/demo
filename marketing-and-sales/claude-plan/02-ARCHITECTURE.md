# System Architecture — Growth Intelligence Layer
> How the new layer integrates with the existing execution system

---

## Three-Layer Architecture

```
╔═══════════════════════════════════════════════════════════════════╗
║  LAYER 3: DECISION INTELLIGENCE                                   ║
║                                                                   ║
║  ┌──────────────────────┐   ┌────────────────┐  ┌─────────────┐  ║
║  │  growth-strategist   │   │ messaging-     │  │ experiment- ║  ║
║  │  (master brain)      │   │ optimizer      │  │ designer    ║  ║
║  └──────────┬───────────┘   └───────┬────────┘  └──────┬──────┘  ║
╚═════════════╪═══════════════════════╪══════════════════╪══════════╝
              │                       │                  │
╔═════════════╪═══════════════════════╪══════════════════╪══════════╗
║  LAYER 2: DATA INTELLIGENCE         │                  │           ║
║            │                        │                  │           ║
║  ┌─────────▼────────┐  ┌────────────▼──┐  ┌───────────▼────────┐  ║
║  │ funnel-analyzer  │  │ retention-    │  │ channel-cac-       │  ║
║  │ (product data)   │  │ analyst       │  │ analysis           │  ║
║  └─────────┬────────┘  └──────────────┘  └────────────────────┘  ║
╚════════════╪══════════════════════════════════════════════════════╝
             │
╔════════════╪══════════════════════════════════════════════════════╗
║  LAYER 1: EXECUTION (existing 20 agents)                         ║
║            │                                                      ║
║  ┌─────────▼─────┐ ┌────────────┐ ┌──────┐ ┌──────────────────┐  ║
║  │ media-buyer   │ │landing-pg  │ │ sdr  │ │ seo-content-     │  ║
║  │ ab-optimizer  │ │ builder    │ │nurture│ │ writer           │  ║
║  └───────────────┘ └────────────┘ └──────┘ └──────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Data Sources (Inputs)

### Product Analytics Data
- **Source:** PostHog (exported CSV or webhook) / application logs
- **What we extract:**
  - Signup → activation events (did user create first listing? first CRM entry?)
  - Day 1, 7, 30 retention rates by cohort
  - Feature adoption rates (which features do retained users use?)
  - Funnel drop points (where in onboarding do users abandon?)
- **Format:** CSV export from PostHog (free tier works)
- **Storage path:** `marketing-and-sales/reports/product-analytics/`

### Campaign Performance Data
- **Source:** Meta Ads Manager (downloadable CSV) + pipeline-manager Google Sheets
- **What we extract:**
  - CPL (cost per lead) by campaign, ad set, creative
  - CTR by creative angle and audience segment
  - Lead-to-demo conversion rate by source
  - Demo-to-paid conversion rate by ICP segment
- **Format:** Meta Ads CSV export + Google Sheets CSV
- **Storage path:** `marketing-and-sales/reports/campaign-performance/`

### Sales Pipeline Data
- **Source:** pipeline-manager (already tracked in Google Sheets)
- **What we extract:**
  - Lead → Demo → Trial → Paid conversion rates
  - Time-in-stage velocity (how long does a lead stay in Demo stage?)
  - Win/loss reasons (from SDR notes)
  - ICP match score vs. actual conversion
- **Format:** Google Sheets export / pipeline-manager daily summaries
- **Storage path:** `marketing-and-sales/leads/`

### Competitor & Market Data
- **Source:** trend-hunter outputs + deep-researcher outputs
- **What we extract:**
  - Competitor pricing changes
  - New competitor features
  - ICP pain points from Reddit/Twitter/G2
- **Storage path:** `marketing-and-sales/research/`

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  DATA INPUTS                                     │
│                                                  │
│  PostHog CSV ──────────────┐                     │
│  Meta Ads CSV ─────────────┤──► funnel-analysis  │
│  Google Sheets pipeline ───┤    skill             │
│  DynamoDB CRM export ──────┘         │            │
│                                      ▼            │
│  trend-hunter reports ─────────► competitive-    │
│  deep-researcher ICP data ──────  intel skill     │
│                                      │            │
└──────────────────────────────────────┼────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │  growth-strategist agent              │
                    │                                       │
                    │  Reads all intelligence reports and   │
                    │  produces:                            │
                    │  • Weekly Growth Brief                │
                    │  • ICP Conversion Analysis            │
                    │  • Channel Efficiency Report          │
                    │  • Retention Health Score             │
                    │  • Next Experiments to Run            │
                    └──────────────┬────────────────────────┘
                                   │
              ┌────────────────────┼───────────────────────┐
              │                    │                       │
              ▼                    ▼                       ▼
    messaging-optimizer    experiment-designer    retention-analyst
         │                        │                       │
         │                        │                       │
    ┌────▼────────────┐  ┌────────▼──────────┐  ┌────────▼─────────┐
    │ landing-page-   │  │ media-buyer       │  │ nurture-bot      │
    │ builder         │  │ ab-optimizer      │  │ sdr (win-back)   │
    │ seo-writer      │  │                   │  │                  │
    └─────────────────┘  └───────────────────┘  └──────────────────┘
```

---

## The Intelligence Reports System

All intelligence is stored as structured markdown reports in `marketing-and-sales/reports/intelligence/`.
This is the "shared memory" between agents — they write reports here so other agents can read them.

```
marketing-and-sales/reports/intelligence/
├── weekly-growth-brief/
│   ├── 2026-W20-growth-brief.md       ← written by growth-strategist
│   └── ...
├── funnel-analysis/
│   ├── 2026-W20-funnel-report.md      ← written by funnel-analysis skill
│   └── ...
├── retention/
│   ├── 2026-W20-retention-report.md   ← written by retention-analyst
│   └── ...
├── experiments/
│   ├── active-experiments.md          ← written by experiment-designer
│   ├── completed-experiments.md       ← written by experiment-designer
│   └── ...
└── messaging/
    ├── icp-copy-performance.md        ← written by messaging-optimizer
    └── ...
```

---

## Agent Ownership of New Directories

| Directory | Owned By |
|-----------|---------|
| `marketing-and-sales/reports/intelligence/` | growth-strategist, funnel-analysis, retention-analyst |
| `marketing-and-sales/reports/product-analytics/` | funnel-analysis skill (data inputs) |
| `marketing-and-sales/reports/campaign-performance/` | channel-cac-analysis skill (data inputs) |
| `marketing-and-sales/experiments/` | experiment-designer agent |

---

## Intelligence Report Spec (Standard Format)

Every intelligence report follows this structure so agents can read each other's outputs:

```markdown
# [Report Type] — Week [W##] [YYYY]
> Generated: [date] | Data range: [start] to [end] | Confidence: HIGH/MEDIUM/LOW

## TL;DR (3 bullets max)
- [Most important finding]
- [Second most important finding]
- [Recommended action this week]

## Key Metrics
| Metric | This Week | Last Week | Trend |
...

## Analysis
[Data-grounded analysis — no generic statements, only findings with numbers]

## Recommended Actions
Priority | Action | Expected Impact | Assign To
...

## Next Review
[When to update this report, what new data is needed]
```

---

## Integration with Existing Agents (No Breaking Changes)

The new layer calls existing agents — it does not modify them.

| Existing Agent | How New Layer Uses It |
|---------------|----------------------|
| `oracle` | growth-strategist calls oracle as sub-agent for feature prioritization |
| `trend-hunter` | growth-strategist calls trend-hunter for market context |
| `deep-researcher` | messaging-optimizer calls deep-researcher for ICP data |
| `media-buyer` | experiment-designer passes test parameters to media-buyer |
| `ab-optimizer` | experiment-designer reads ab-optimizer reports to declare winners |
| `landing-page-builder` | messaging-optimizer passes copy brief to landing-page-builder |
| `sdr` | retention-analyst passes win-back targets to sdr |
| `nurture-bot` | retention-analyst passes churn-risk segments to nurture-bot |
| `pipeline-manager` | All agents read pipeline-manager daily summaries for pipeline data |
