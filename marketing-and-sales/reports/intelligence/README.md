# Intelligence Reports — Shared Memory for All Agents

This directory is the **shared memory** of the Growth Intelligence System.
All decision-intelligence agents write reports here. Other agents read from here to make their decisions.

## Directory Map

```
intelligence/
├── weekly-growth-brief/    ← written by growth-strategist (Monday)
├── funnel-analysis/        ← written by funnel-analysis skill (Monday AM)
├── retention/              ← written by retention-analyst (Sunday)
│   └── cohorts/            ← detailed cohort tables
├── channel-efficiency/     ← written by channel-cac-analysis (Monday AM)
├── messaging/              ← written by messaging-optimizer (Monday)
├── icp-analysis/           ← written by growth-intel in ICP mode
└── competitive/            ← written by competitive-intel (Weekly)
```

## File Naming Convention

All weekly reports use: `YYYY-W##-<type>.md`
Example: `2026-W20-growth-brief.md`

Date-stamped artifacts (CSVs etc.) use: `YYYY-MM-DD`
Example: `churn-risk-2026-05-12.csv`

## Read Order (For growth-strategist Monday Run)

When growth-strategist runs Monday morning, it reads these files in order:
1. Previous week's `weekly-growth-brief/[last-week].md` — for narrative continuity
2. This week's `funnel-analysis/[latest].md`
3. This week's `retention/[latest].md`
4. This week's `channel-efficiency/[latest].md`
5. This week's `competitive/[latest].md`
6. Pipeline daily summaries from `../../leads/daily-summary-*.md` (last 7)

## Read Order (For Downstream Execution Agents)

After growth-strategist writes the brief Monday, these agents read:
- **messaging-optimizer** → reads brief + ad performance → writes `messaging/`
- **experiment-designer** → reads brief + funnel-analysis → writes `../experiments/briefs/`
- **media-buyer** → reads `../experiments/briefs/` for tests to launch
- **landing-page-builder** → reads `messaging/landing-page-recommendations-*` for copy updates
- **nurture-bot** → reads `../../leads/churn-risk-*.csv` (written by retention-analyst)
- **sdr** → reads `../../leads/winback-targets-*.csv` (written by retention-analyst)

## Confidence Markers

Every report should include a confidence section at the bottom. Read this BEFORE trusting numbers.

| Marker | Meaning |
|--------|---------|
| HIGH | >100 sample, >2 weeks data, all required inputs present |
| MEDIUM | 30-100 sample OR 1-2 weeks data OR one input source partial |
| LOW | <30 sample OR <1 week data OR multiple input sources missing |

## What Goes Where

| If you have... | Write to... |
|----------------|-------------|
| Strategic synthesis across data | `weekly-growth-brief/` |
| Activation/onboarding analysis | `funnel-analysis/` |
| Cohort + churn analysis | `retention/` |
| Channel/CAC analysis | `channel-efficiency/` |
| Copy/messaging analysis | `messaging/` |
| ICP segment analysis | `icp-analysis/` |
| Competitor analysis | `competitive/` |
