---
name: channel-cac-analysis
description: >
  Cross-channel effective CAC analysis. Goes beyond CPL to compute EFFECTIVE CAC
  (CPL ÷ trial-to-paid conversion rate) per channel, then LTV:CAC ratios for budget
  reallocation recommendations. Reads Meta Ads, LinkedIn, cold email, and organic
  source data. Outputs channel efficiency report for growth-strategist. Use weekly
  before growth-strategist run, or whenever major budget reallocation is being decided.
allowed-tools: Read, Grep, Bash, Write
---

# Channel CAC Analysis

Cross-channel effective CAC + LTV:CAC + budget reallocation recommendations. Focus: $ARGUMENTS

## The Problem This Skill Solves

A typical mistake: optimizing for CPL (cost per lead).

- Meta Ads: ₹800 CPL → 2% lead-to-trial → 20% trial-to-paid → ₹20,000 CAC
- LinkedIn: ₹3,200 CPL → 12% lead-to-trial → 40% trial-to-paid → ₹6,667 CAC

LinkedIn looks 4x more expensive per LEAD but is actually 3x cheaper per CUSTOMER.
Most teams would scale Meta and cut LinkedIn — wrong direction.

This skill enforces effective-CAC thinking.

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Full report | `/channel-cac-analysis` | Full multi-channel report |
| Reallocation | `/channel-cac-analysis reallocate` | Specific "move ₹X from A to B" recommendations |
| Forecast | `/channel-cac-analysis forecast` | Project CAC at higher spend levels (diminishing returns) |
| ICP cut | `/channel-cac-analysis by-icp` | Channel performance per buyer persona |

## Required Inputs

| Input | Path | Required Fields |
|-------|------|-----------------|
| Meta Ads export | `marketing-and-sales/reports/campaign-performance/meta-*.csv` | spend, impressions, clicks, leads, campaign |
| LinkedIn Ads | `marketing-and-sales/reports/campaign-performance/linkedin-*.csv` | spend, clicks, leads, campaign |
| Pipeline data | `marketing-and-sales/leads/pipeline.csv` | lead_id, utm_source, stage, mrr_if_paid, conversion_date |
| Customer data | `marketing-and-sales/reports/product-analytics/customers-*.csv` | user_id, signup_date, plan, mrr, source |

UTM tracking is REQUIRED. If `utm_source` is missing on >30% of pipeline leads, halt and flag instrumentation gap.

## Output

Save to: `marketing-and-sales/reports/intelligence/channel-efficiency/YYYY-W##-channels.md`

## Core Metrics Formulas

### Cost Per Lead (CPL)
```
CPL = Total Spend / Total Leads
```

### Effective CAC (per channel)
```
Effective CAC = Spend / Paid Customers from this Channel
            = CPL / (Lead→Demo × Demo→Trial × Trial→Paid)
```

### LTV Estimate (assumption, refine over time)
```
LTV = ARPU × Gross Margin × Avg Customer Lifetime (months)

Default assumption for RealtyFlow:
  ARPU = ₹3,000/month (Pro plan)
  Gross Margin = 0.80 (SaaS typical)
  Avg Lifetime = 18 months (early estimate, refine as cohort data matures)
  
=> LTV ≈ ₹43,200
```

### LTV:CAC Ratio
```
LTV:CAC = LTV / Effective CAC
```
| Ratio | Interpretation |
|-------|----------------|
| >5:1 | Excellent — scale aggressively |
| 3-5:1 | Healthy — maintain or scale |
| 1.5-3:1 | Borderline — optimize before scaling |
| <1.5:1 | Unprofitable at current efficiency — cut or fix |

### Payback Period
```
CAC Payback (months) = Effective CAC / (ARPU × Gross Margin)
```
Target: <12 months for early-stage SaaS

## Output Template

```markdown
# Channel CAC Analysis — Week [##], [YYYY]
> Data range: [start] to [end] | LTV assumption: ₹[X]

## TL;DR
- Best LTV:CAC: [Channel] at [X:1]
- Worst LTV:CAC: [Channel] at [X:1]
- Recommended reallocation: Move ₹[X] from [Y] to [Z] → projected +[N] customers/month

## Full Channel Comparison
| Channel | Spend | Leads | CPL | Lead→Demo | Demo→Trial | Trial→Paid | Effective CAC | LTV:CAC | Payback | Action |
|---------|-------|-------|-----|-----------|-----------|-----------|--------------|---------|---------|--------|
| Meta Ads | ₹X | X | ₹X | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| LinkedIn | ₹X | X | ₹X | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| Cold Email | ₹X | X | ₹X | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| Organic/SEO | ₹0* | X | ₹0* | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| Referral | ₹0* | X | ₹0* | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| Google Ads | ₹X | X | ₹X | X% | X% | X% | ₹X | X:1 | X mo | Scale/Hold/Cut |
| Direct/Brand | ₹0* | X | ₹0* | X% | X% | X% | ₹X | X:1 | X mo | — |

* Organic/Referral/Direct/SEO carry indirect spend (salaries, content investment).
  For pure direct-attribution comparison, use $0. For true cost comparison, allocate proportional cost.

## Channel of the Week
**[Channel]** — Effective CAC: ₹[X], LTV:CAC: [X:1]
**Why it wins this week:** [Specific finding]

## Worst Performer
**[Channel]** — Effective CAC: ₹[X], LTV:CAC: [X:1]
**Why it's failing:** [Specific finding — wrong audience, high CPL, low lead quality, etc.]
**Recommendation:** [Cut entirely / Reduce by X% / Fix specific issue then retest]

## Channel × ICP Matrix
| Channel | Rajesh Bhai CAC | Priya Madam CAC | Dev Bhai CAC |
|---------|----------------|----------------|--------------|
| Meta Ads | ₹X | ₹X | ₹X |
| LinkedIn | ₹X | ₹X | ₹X |
| Cold Email | ₹X | ₹X | ₹X |
| Organic | ₹X | ₹X | ₹X |

**Best (Channel × ICP) combo:** [Combo] — focus next week's scale here
**Worst (Channel × ICP) combo:** [Combo] — diagnostic: is the channel wrong or the ICP target wrong?

## Budget Reallocation Recommendation

### Current Allocation
| Channel | Current Spend | % of Total |
|---------|---------------|------------|
| Meta Ads | ₹X | X% |
| LinkedIn | ₹X | X% |
| Cold Email | ₹X | X% |
| Other | ₹X | X% |
| **Total** | **₹X** | **100%** |

### Recommended Allocation (Next Week)
| Channel | New Spend | Change | Rationale |
|---------|-----------|--------|-----------|
| Meta Ads | ₹X | +/- | [data-based reason] |
| LinkedIn | ₹X | +/- | [data-based reason] |
| Cold Email | ₹X | +/- | [data-based reason] |
| **Total** | **₹X** | — | (constant total budget) |

### Expected Impact
- Additional customers/month: +[N]
- Blended CAC change: ₹[X] → ₹[Y] (-Z%)
- Risk: [What could go wrong]

## Diminishing Returns Watch
For channels currently scaling, watch for these warning signs:
- CPL increasing >20% week-over-week at higher spend → saturation
- Lead quality (lead-to-paid) dropping at higher spend → audience exhaustion
- Frequency >5 on top creatives → creative fatigue

| Channel | Current Spend | Saturation Signal? | Headroom Estimate |
|---------|---------------|--------------------|--------------------|
| Meta Ads | ₹X | Yes/No | Can grow to ₹X before CAC degrades |
| LinkedIn | ₹X | Yes/No | Can grow to ₹X |

## Recommendations to Growth Strategist
1. [Specific budget shift with expected impact]
2. [Channel-specific optimization that doesn't require budget change]
3. [Tests to run before committing to bigger shifts]

## Confidence & Caveats
- LTV assumption (₹43,200) is an estimate — actual LTV will refine as cohort data matures
- Sample size warnings for any channel with <30 paid customers
- Attribution model: last-touch UTM (no multi-touch attribution yet)
- Indirect channels (organic, referral) have zero direct cost in this analysis
```

## Analysis Protocol

### Step 1: Validate UTM attribution
Check pipeline.csv for `utm_source` field completeness.
- If >70% have UTM → proceed with confidence
- If 30-70% have UTM → proceed with WARNING in confidence section
- If <30% have UTM → halt and recommend instrumentation fix

### Step 2: Aggregate spend by channel
For each paid channel (Meta, LinkedIn, Google), sum total spend in the date range.
For unpaid channels (organic, referral, direct), set spend = ₹0 (or allocate indirect cost if requested).

### Step 3: Aggregate funnel per channel
For each channel, count:
- Leads (entries with that UTM source)
- Demos (leads that progressed to demo stage)
- Trials (demos that became trials)
- Paid customers (trials that converted)

### Step 4: Compute funnel conversion rates per channel
- Lead → Demo %
- Demo → Trial %
- Trial → Paid %
- Overall Lead → Paid %

### Step 5: Compute Effective CAC per channel
```
Effective CAC = Spend / Paid Customers
```

### Step 6: Compute LTV:CAC ratio per channel
Using default LTV of ₹43,200 (or override from arguments).

### Step 7: Segment by ICP (if classification exists)
For each channel, break down by ICP segment.
Compute effective CAC per (channel, ICP) combination.

### Step 8: Generate reallocation recommendation
Logic:
- Channels with LTV:CAC > 3 and headroom for scale → recommend increased budget
- Channels with LTV:CAC < 2 → recommend cuts
- Hold channels in 2-3 range pending optimization tests

Constraints:
- Don't move more than 30% of total budget in one week (rule)
- Don't reduce any channel to zero in one move (rule)
- Always have at least 3 active channels (concentration risk)

### Step 9: Diminishing returns analysis
For top-spending channels, look at week-over-week trend:
- Is CPL increasing as spend increases? (saturation signal)
- Is lead quality (lead-to-paid) dropping as spend increases? (audience exhaustion)

Flag any channel showing both signals — it has hit saturation.

### Step 10: Write report
Save with full data tables and specific reallocation recommendations.

## Decision Heuristics

### When to recommend "Scale"
- LTV:CAC > 3:1 sustained for 2+ weeks
- Lead quality stable or improving at current spend
- Headroom signals positive (no saturation)
- Concentration risk acceptable (channel still <50% of total)

### When to recommend "Cut"
- LTV:CAC < 1.5:1 for 2+ weeks
- Lead quality consistently low (lead-to-paid <5%)
- Better alternative exists with capacity to absorb the spend

### When to recommend "Hold + Optimize"
- LTV:CAC in 1.5-3:1 range (borderline)
- Or: LTV:CAC > 3:1 but lead quality degrading (don't scale yet, fix first)
- Or: Strong potential but sample size still small (<30 paid customers)

### When confidence should be LOW
- Sample size <30 paid customers in any channel being scored
- Date range <30 days (not enough time for trial→paid to fully convert)
- LTV assumption based on <3 months of churn data
- UTM data <70% complete

## What This Skill Does NOT Do

- Does not run multi-touch attribution (last-touch only, until we have data warehouse)
- Does not adjust ad campaigns (media-buyer does that)
- Does not optimize within a channel (ab-optimizer does that)
- Does not analyze creative-level performance (ab-optimizer + messaging-optimizer do that)

## Strategic Memory

Track:
- Whether reallocation recommendations panned out (validation loop)
- Per-channel LTV vs. blended LTV (do certain channels acquire higher-LTV customers?)
- Saturation thresholds discovered (e.g., "Meta starts to saturate at ₹3L/month")
- Seasonal patterns per channel

Over time, this lets you predict saturation before you hit it.
