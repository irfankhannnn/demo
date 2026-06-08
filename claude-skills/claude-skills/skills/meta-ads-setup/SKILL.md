---
name: meta-ads-setup
description: >
  Set up and manage Meta (Facebook/Instagram) ad campaigns. Generates campaign
  structures, audience targeting, budget allocation, Conversion API configuration,
  and creative deployment plans. Use for campaign creation and ad management.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Meta Ads Campaign Setup

Create a Meta Ads campaign plan for Cloudberry. Brief: $ARGUMENTS

## Campaign Architecture (2025 Best Practices)

### Structure
```
Campaign (Objective: OUTCOME_LEADS)
├── Advantage+ Shopping (ASC) — auto-optimized
├── Prospecting (Manual)
│   ├── Broad Interest (Real Estate + CRM)
│   ├── Lookalike 1% (converters)
│   ├── Lookalike 3-5% (engagers)
│   └── Competitor Audiences
├── Retargeting (Manual)
│   ├── Website Visitors 7d / 30d
│   ├── Video Viewers 50%+
│   └── Lead Form Abandoners
└── Retention (Manual)
    ├── Active Users (feature adoption)
    └── Churned Users (win-back)
```

### Naming: `[OBJECTIVE]_[AUDIENCE]_[GEO]_[DATE]_[VARIANT]`

## API Integration

Provide curl commands for:
1. Campaign creation (objective, bid strategy, special ad category)
2. Ad set creation (targeting, budget, optimization goal)
3. Custom audience creation (website, lookalike)
4. Conversion API (CAPI) event setup

## Budget Management

| Phase | Duration | Daily Budget | Strategy |
|-------|----------|-------------|----------|
| Test | Week 1 | $90-150 | 3-5 ad sets at $30/day |
| Optimize | Week 2 | $150-250 | Kill losers, scale winners 20% |
| Scale | Week 3-4 | $250-500 | Horizontal duplication |

## Housing Category Compliance
- Special Ad Category: HOUSING required
- No age/gender/zip targeting
- 15-mile minimum radius
- Use Special Ad Audiences (not lookalikes)

## KPI Targets

| Metric | Target | Kill Threshold |
|--------|--------|----------------|
| CPA | <$15 | >$45 (3x) |
| ROAS | >3:1 | <1.5:1 |
| CTR | >1.5% | <0.5% |
| Frequency | <3.0 | >5.0 |

## Output

Save to `marketing-and-sales/ads/campaigns/[campaign-name]/`:
```markdown
# Campaign Plan: [Name]
## Objective & KPIs
## Structure (tree diagram)
## Audiences (targeting per ad set)
## Creatives (mapped from Content Factory)
## Budget Allocation & Scaling Plan
## Launch Checklist
```
