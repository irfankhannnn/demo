# Trigger Map — What Calls What, When, and Why
> The operational schedule: how all agents and skills connect into a running system.

---

## Weekly Intelligence Cycle

This is the backbone of the system. Everything runs on a weekly rhythm.

```
SUNDAY EVENING
├── retention-analyst runs
│   ├── Reads: PostHog export CSV (upload by Sunday)
│   ├── Reads: pipeline-manager weekly summary
│   ├── Writes: retention/2026-W##-retention.md
│   └── Writes: churn-risk-[date].csv → triggers nurture-bot on Monday
│
MONDAY 8am
├── funnel-analysis skill runs
│   ├── Reads: PostHog CSV exports
│   ├── Writes: funnel-analysis/2026-W##-funnel.md
│
├── channel-cac-analysis skill runs
│   ├── Reads: Meta Ads CSV export + pipeline data
│   ├── Writes: channel-efficiency/2026-W##-channels.md
│
├── trend-hunter runs (existing agent, now feeds growth-strategist)
│   ├── Scrapes: competitor sites, Twitter, Reddit
│   ├── Writes: research/weekly-market-intel-[date].md
│
MONDAY 9am
├── growth-strategist runs
│   ├── Reads: ALL reports from Sunday + Monday 8am
│   ├── Reads: pipeline-manager daily summaries (last 7 days)
│   ├── Reads: .brand/positioning.md, buyer personas
│   ├── Writes: weekly-growth-brief/2026-W##-growth-brief.md
│   └── Writes: experiments/pending/candidates-[date].md
│
MONDAY 10am
├── experiment-designer runs
│   ├── Reads: Weekly Growth Brief
│   ├── Reads: funnel analysis report
│   ├── Reads: active-experiments.md (to avoid duplicating running tests)
│   ├── Writes: experiments/backlog.md (updated priority ranking)
│   ├── Writes: experiments/briefs/exp-[name].md (for new tests to launch)
│   └── Calls: media-buyer (to set up winning experiment as ad variant)
│
├── messaging-optimizer skill runs
│   ├── Reads: Weekly Growth Brief
│   ├── Reads: ab-optimizer latest report (creative performance)
│   ├── Reads: ICP data + brand-kit
│   ├── Writes: messaging/icp-copy-performance.md
│   └── Writes: messaging/landing-page-recommendations-[date].md
│
MONDAY 11am
├── nurture-bot runs (triggered by retention-analyst churn-risk output)
│   ├── Reads: churn-risk-[date].csv
│   └── Activates: intervention sequence for at-risk users
│
├── landing-page-builder reviews messaging recommendations (optional, if major changes)
│
├── media-buyer reviews experiment briefs → sets up new ad variants
│
ONGOING (existing system continues)
├── ab-optimizer monitors active ad campaigns daily
├── pipeline-manager updates Google Sheets daily
├── sdr runs outreach sequences
├── nurture-bot handles automated follow-ups
```

---

## Event-Based Triggers (Not Scheduled)

These fire based on conditions, not the weekly clock.

### Trigger 1: Conversion Rate Drop Alert
**Condition:** pipeline-manager detects lead→demo rate drops >20% week-over-week  
**Action:** growth-strategist runs an emergency mini-brief  
**Assigns to:** messaging-optimizer (check if messaging is the issue), media-buyer (check targeting)

### Trigger 2: ab-optimizer Declares Test Winner
**Condition:** ab-optimizer pauses a losing ad set (ROAS < threshold for 3+ days)  
**Action:** experiment-designer reads the result, adds to completed-experiments.md,
  generates next experiment in that domain  
**Assigns to:** media-buyer (scale winner), experiment-designer (design next test)

### Trigger 3: Churn Spike
**Condition:** retention-analyst flags 30-day retention drops below 55%  
**Action:** retention-analyst generates emergency cohort analysis  
**Assigns to:** nurture-bot (activate win-back), sdr (personal outreach to churned high-value users),
  growth-strategist (root cause analysis)

### Trigger 4: New ICP Segment Discovered
**Condition:** growth-strategist identifies a new segment converting significantly better  
**Action:** messaging-optimizer generates ICP-specific messaging for that segment  
**Assigns to:** landing-page-builder (new landing page), media-buyer (new targeted campaign)

### Trigger 5: Competitor Major Move
**Condition:** trend-hunter detects competitor pricing drop or major feature launch  
**Action:** competitive-intel runs comparison analysis  
**Assigns to:** brand-strategist (update positioning), messaging-optimizer (add competitive copy)

---

## Manual Invocation Map

When a human types these commands, here's what fires:

| Command | What Runs | Output |
|---------|-----------|--------|
| `/growth-intel weekly` | growth-strategist → reads all reports | Weekly Growth Brief |
| `/growth-intel icp-analysis` | growth-intel skill → focuses on ICP segments | ICP Conversion Analysis |
| `/funnel-analysis` | funnel-analysis skill | Funnel Report |
| `/retention-analysis weekly` | retention-analyst agent | Retention Health Report |
| `/experiment-design next` | experiment-designer → reads funnel + growth brief | Next 2 experiment briefs |
| `/messaging-optimizer weekly` | messaging-optimizer skill | Copy recommendations |
| `/channel-cac-analysis` | channel-cac-analysis skill | Channel efficiency report |
| `/competitive-intel` | competitive-intel skill | Competitor positioning gaps |

---

## Data Upload Protocol (Human Steps Required)

The system needs data inputs that require human action. This is the data handoff protocol:

### Weekly Data Uploads (Every Sunday)
1. **PostHog export:** PostHog → Insights → Export events as CSV  
   → Save to: `marketing-and-sales/reports/product-analytics/events-[YYYY-W##].csv`

2. **Meta Ads export:** Meta Ads Manager → Reports → Export (last 7 days, breakdown by ad set)  
   → Save to: `marketing-and-sales/reports/campaign-performance/meta-[YYYY-W##].csv`

3. **Pipeline export:** Google Sheets → Export as CSV  
   → Save to: `marketing-and-sales/leads/pipeline-[YYYY-W##].csv`
   (pipeline-manager may automate this step)

### Monthly Data Uploads
4. **Customer list with plan + ICP:** DynamoDB export → CSV  
   → Save to: `marketing-and-sales/reports/product-analytics/customers-[YYYY-MM].csv`

5. **LinkedIn Ads export (if running):** LinkedIn Campaign Manager → Export  
   → Save to: `marketing-and-sales/reports/campaign-performance/linkedin-[YYYY-MM].csv`

---

## Intelligence Flow (What Each Agent Reads From Whom)

```
pipeline-manager ──writes──► leads/daily-summary-*.md
                                   │
trend-hunter ────writes──► research/weekly-market-intel.md
                                   │
retention-analyst ─writes──► reports/intelligence/retention/*.md
                                   │
funnel-analysis ───writes──► reports/intelligence/funnel-analysis/*.md
                                   │
channel-cac-analysis writes► reports/intelligence/channel-efficiency/*.md
                                   │
                    ALL of these ──►  growth-strategist
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                    messaging-optimizer      experiment-designer
                              │                         │
                    ┌─────────┴────┐           ┌───────┴──────────┐
                    ▼              ▼           ▼                  ▼
             landing-page-   media-buyer  media-buyer         nurture-bot
             builder         (copy brief) (test setup)        (churn risk)
```

---

## Avoiding Circular Dependencies

The system is designed to be strictly directional (DAG, no cycles):

- **Data Collection Layer** → writes to `reports/` → never reads from execution agents
- **Decision Layer** → reads from `reports/` → writes to `experiments/` and `messaging/` → never reads from execution agent outputs
- **Execution Layer** → reads from `experiments/` and `messaging/` → never writes to `reports/` (except ab-optimizer which writes ad performance, which is a DATA output, not decision output)

The one allowed feedback loop: ab-optimizer → experiment-designer. This is intentional and bounded.
