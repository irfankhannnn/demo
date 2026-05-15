---
name: growth-intel
description: >
  Synthesizes pipeline, ad performance, funnel analysis, retention, and channel data
  into a Weekly Growth Brief with data-grounded findings and prioritized action
  recommendations. The core capability of the growth-strategist agent. Use weekly
  (Mondays) for full briefing, or on-demand for focused analysis (icp-analysis,
  channel-compare, what-changed).
allowed-tools: Read, Grep, Bash, Write
---

# Growth Intelligence Synthesis

Generate data-grounded weekly intelligence for RealtyFlow. Focus: $ARGUMENTS

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Weekly brief | `/growth-intel weekly` | Full Weekly Growth Brief |
| ICP analysis | `/growth-intel icp-analysis` | Deep dive on segment conversion |
| Channel compare | `/growth-intel channel-compare` | Cross-channel effectiveness |
| What changed | `/growth-intel what-changed` | Week-over-week deltas only |
| Funnel focus | `/growth-intel funnel` | Drop-point analysis only |

## Synthesis Protocol

### Step 1: Load Data
Read these files in order. If any is stale (>7 days old), flag in confidence section.

```
1. marketing-and-sales/leads/pipeline.csv (or latest export)
2. marketing-and-sales/leads/daily-summary-*.md (last 7)
3. marketing-and-sales/reports/intelligence/funnel-analysis/[latest].md
4. marketing-and-sales/reports/intelligence/retention/[latest].md
5. marketing-and-sales/reports/intelligence/channel-efficiency/[latest].md
6. marketing-and-sales/reports/campaign-performance/[latest].csv
7. marketing-and-sales/research/weekly-market-intel-*.md (latest)
8. marketing-and-sales/reports/intelligence/weekly-growth-brief/[previous-week].md
```

### Step 2: Compute Headline Metrics

From pipeline.csv, calculate for current week and previous week:
- Total leads (sum of new entries)
- Lead → Demo conversion rate
- Demo → Trial conversion rate
- Trial → Paid conversion rate
- Average days in each stage (velocity)

From campaign-performance.csv:
- Total spend
- CPL (blended) = spend / leads
- CTR by creative
- ROAS by ad set

From funnel-analysis:
- Activation rate (D1)
- D7 / D30 retention from latest cohort

### Step 3: Segment by ICP

Cross-reference every lead/customer with ICP classification:
- **Rajesh Bhai** = agency owner, 10+ employees
- **Priya Madam** = sales manager, 5-10 employees
- **Dev bhai** = solo agent, 1-4 employees

Compute for each segment:
- Lead count
- Trial→Paid rate
- Effective CAC = (spend allocated to segment) / (paid customers from segment)
- LTV:CAC ratio (assume ₹3,000 MRR × 18 months = ₹54k LTV for now)

### Step 4: Identify Top 3 Findings

Apply these filters to find the 3 most important things this week:

**Filter 1: Biggest Delta**
- Which metric changed most week-over-week (positive or negative)?
- Threshold: only flag if change is >15% AND statistically meaningful (sample >30)

**Filter 2: Biggest Funnel Gap**
- Which step in Lead→Demo→Trial→Paid has the lowest conversion rate?
- Recoverable potential = (target rate - current rate) × volume × downstream conversion

**Filter 3: Best ICP/Channel Combo**
- Which (ICP × Channel) cell has the best LTV:CAC?
- This is where to scale next week

### Step 5: Generate Recommended Actions

Each action must include:
- Specific change (not "improve onboarding" but "test 3-step onboarding vs current 7-step")
- Owner agent (who executes)
- Expected impact (quantified, e.g., "+5pp activation = ~30 more activated users/week")
- Data citation (which report file proved this matters)

### Step 6: Surface Experiment Candidates

Generate 2-3 testable hypotheses based on the data. Format for `experiment-designer`:
```
**Hypothesis:** If we [change X], then [metric Y] will improve by [Z%] because [data reason].
**Priority Score Estimate:** [N]
**Owner:** [media-buyer | landing-page-builder | sdr]
```

### Step 7: Write Output

Save to: `marketing-and-sales/reports/intelligence/weekly-growth-brief/YYYY-W##-growth-brief.md`

Use the template defined in `agents/growth-strategist.md`.

## Data Quality Checks

Before synthesizing, run these checks:

| Check | If Fails |
|-------|---------|
| Pipeline has >50 leads | Mark all conversion rates LOW confidence |
| Pipeline has ICP field populated for >80% of leads | Flag "ICP classification incomplete" |
| All UTM source values present | Flag "Source attribution incomplete" |
| Funnel report exists and <7 days old | Run funnel-analysis skill first |
| Retention report exists and <7 days old | Run retention-analysis skill first |
| At least 2 weeks of historical data | Mark week-over-week changes "INSUFFICIENT HISTORY" |

## Output Quality Standards

Every claim in the brief must:
1. Cite a specific number (not "growing" but "+18%")
2. Cite the source file ("from funnel-analysis/2026-W20.md")
3. Have confidence level if sample size is small
4. Be falsifiable (a future report could prove it wrong)

Forbidden patterns:
- "Trends suggest..." (vague)
- "Users seem to..." (no data)
- "Marketing should focus on..." (no specific action)
- "Consider trying..." (not a recommendation)

Required patterns:
- "Rajesh Bhai segment: 24% trial→paid (n=42, last 30 days) vs. solo agents at 8% (n=156). Confidence: HIGH."
- "Recommendation: Shift Meta Ads targeting to 10+ employee companies. Source: pipeline.csv:icp-breakdown."

## Special Mode: `icp-analysis`

When invoked with `icp-analysis`:
- Skip the channel/funnel sections
- Build a deep ICP comparison table with all available cuts:
  - Lead source × ICP
  - Time-in-stage × ICP
  - Feature adoption × ICP
  - Retention curve × ICP
- Output a separate doc: `marketing-and-sales/reports/intelligence/icp-analysis/YYYY-W##-icp.md`
- Recommend ICP-specific targeting changes for media-buyer

## Special Mode: `channel-compare`

When invoked with `channel-compare`:
- Skip the funnel section
- Build full channel comparison: Meta Ads vs LinkedIn vs Cold Email vs Organic
- Calculate effective CAC (not just CPL) for each
- Project: if we move ₹X from channel A to channel B, what's the expected delta?
- Output: `marketing-and-sales/reports/intelligence/channel-efficiency/YYYY-W##-channels.md`

## Special Mode: `what-changed`

When invoked with `what-changed`:
- Compare current week vs previous week
- Flag only metrics that changed >15%
- For each change, hypothesize cause (cite supporting data)
- Quick output, no recommendations — just diagnostic

## Strategic Memory

After each weekly run, append to the agent memory:
- Hypotheses generated this week
- Which previous hypotheses were validated/refuted by this week's data
- Calibration: was last week's recommended action correct?
- Emerging patterns worth deeper investigation
