---
name: experiment-design
description: >
  Generates structured A/B test hypotheses from funnel data, computes sample sizes
  for statistical power, scores experiments by impact × confidence / effort, applies
  z-test significance to results, and produces ready-to-execute Experiment Briefs.
  The core capability of the experiment-designer agent. Use after growth-strategist
  weekly run, or whenever ab-optimizer signals a result that needs analysis.
allowed-tools: Read, Grep, Bash, Write
---

# Experiment Design

Generate hypothesis-driven A/B tests with statistical rigor. Focus: $ARGUMENTS

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Next experiments | `/experiment-design next` | Generate top 2 experiments to run this week |
| Score backlog | `/experiment-design score` | Re-score existing backlog by current data |
| Analyze winner | `/experiment-design analyze` | Apply statistical test to a completed experiment |
| Sample size | `/experiment-design sample-size` | Calculate sample needed for a specific test idea |
| Active check | `/experiment-design active-check` | Audit running experiments for early-stop signals |

## Required Inputs

| Input | Path |
|-------|------|
| Weekly Growth Brief | `marketing-and-sales/reports/intelligence/weekly-growth-brief/[latest].md` |
| Funnel analysis | `marketing-and-sales/reports/intelligence/funnel-analysis/[latest].md` |
| Active experiments | `marketing-and-sales/experiments/active-experiments.md` |
| Completed experiments | `marketing-and-sales/experiments/completed/` |
| ab-optimizer reports | `marketing-and-sales/ads/reports/` |
| Current creative inventory | `marketing-and-sales/ads/` |

## Outputs

| Output | Path |
|--------|------|
| Experiment Brief | `marketing-and-sales/experiments/briefs/exp-[slug]-[date].md` |
| Backlog | `marketing-and-sales/experiments/backlog.md` |
| Active register | `marketing-and-sales/experiments/active-experiments.md` |
| Winner analysis | `marketing-and-sales/experiments/completed/exp-[slug]-results.md` |

## Hypothesis Generation

### Step 1: Identify the biggest recoverable gap
From funnel-analysis report:
- Which step has the highest drop rate?
- How many users does that drop affect per week?
- What's the recoverable potential = (current_rate - target_rate) × volume × downstream_conversion

### Step 2: Generate 3-5 hypotheses for that gap
For each gap, brainstorm hypotheses across these dimensions:
- **Copy/Messaging:** Different headline, value prop, CTA
- **Visual:** Different image, layout, color, social proof type
- **Flow:** Different number of steps, different order, different fields
- **Timing:** Different time to show, different cadence
- **Audience:** Different segment, different exclusion, different intent signal

Each hypothesis must include:
- The change (specific, not "improve")
- The expected mechanism (why would this work?)
- The data supporting it (which signal in which report?)

### Step 3: Score each hypothesis
```
Priority Score = (Impact × Confidence) / Effort

Impact (1-3):
  3 = Affects primary conversion event (signup, paid, retained)
  2 = Affects upper-funnel that feeds primary
  1 = Affects vanity metric only

Confidence (1-3):
  3 = Multi-week trend, large sample, clear directional evidence
  2 = Recent signal, smaller sample, single source
  1 = Hunch, anecdote, competitor copy

Effort (1-3):
  3 = Trivial (copy change, button color) — <1 day
  2 = Medium (new variant of existing page/ad) — 1-3 days
  1 = High (new flow, new product surface) — >3 days

Score ≥3.0  → Run this week
Score 2-3   → Queue (next 2 weeks)
Score 1-2   → Backlog
Score <1    → Drop
```

## Sample Size Calculator

For two-proportion tests (most common):
```
N per variant = 16 × p × (1-p) / d²

where:
  p = baseline conversion rate (e.g., 0.05 for 5%)
  d = minimum detectable lift in absolute percentage points (e.g., 0.01 for 1pp)
  
(16 = constant for 80% power at 95% confidence two-sided)
```

### Quick Reference Table
| Baseline | Min Detectable Lift | N per variant | At 200 conversions/day per variant |
|----------|--------------------|--------------:|-----------------------------------:|
| 1% | 0.5pp | 6,300 | 32 days (too long) |
| 1% | 1pp | 1,580 | 8 days |
| 2% | 1pp | 3,150 | 16 days |
| 5% | 1pp | 7,600 | 38 days (too long) |
| 5% | 2pp | 1,900 | 10 days |
| 10% | 2pp | 3,600 | 18 days |
| 10% | 5pp | 580 | 3 days |
| 20% | 5pp | 1,020 | 5 days |
| 20% | 10pp | 250 | 2 days |

### Duration Rules
- If required N would take >21 days at current traffic → reject test (redesign with bigger expected effect)
- If required N would take <3 days → fine, but check for novelty effect (day-of-week variance)

## Experiment Brief Template

```markdown
# Experiment: [Short Name]
**ID:** EXP-YYYY-W##-[NN]
**Status:** PROPOSED | READY | RUNNING | COMPLETED
**Created:** [date]
**Owner Agent:** [media-buyer | landing-page-builder | sdr | nurture-bot]

## Hypothesis
If we change [variable from A to B], then [primary metric] will [increase/decrease]
by [X%] because [reasoning grounded in data].

## Data Source
- Source report: `marketing-and-sales/reports/intelligence/funnel-analysis/[file].md`
- Specific finding: [exact number from report]
- Current baseline: [metric value]
- Target after change: [metric value]

## Primary Metric
- **Metric:** [e.g., Signup conversion rate]
- **Definition:** [exact calculation]
- **Current baseline:** [X%] (from [source])
- **Target:** [Y%]
- **Min detectable lift:** [Z pp] (smallest change worth detecting)

## Secondary Metrics (Monitor, Don't Optimize)
- [CTR]
- [Bounce rate]
- [Time on page]

## Variants
**Variant A (Control):** [Exact description of current state]
**Variant B (Test):** [Exact description of proposed change]

## Traffic Split
50/50 (default)

## Sample Size
- Required per variant: [N] (formula: 16 × p × (1-p) / d²)
- Total required: [N×2]
- Current daily traffic: [Y/day per variant]
- Estimated duration: [N/Y days]

## Priority Score
- Impact: [1-3] — [reason]
- Confidence: [1-3] — [reason]
- Effort: [1-3] — [reason]
- **Score: [N]**

## Stopping Rules
- **Win early (p<0.01):** if reached with >50% of required sample collected
- **Kill early (p<0.05 in wrong direction for 7+ days):** stop, declare loser
- **Inconclusive (after duration estimate × 1.5):** stop, mark inconclusive
- **Bug/data quality issue:** stop, fix, restart

## Pre-Registration
- ☑ Primary metric chosen BEFORE launch
- ☑ Definition of conversion fixed
- ☑ Stopping rules pre-defined
- ☑ Sample size calculated
- ☑ No mid-test changes allowed

## Implementation Brief
For [owner agent]:
1. [Specific change to make in code/copy]
2. [How to assign users to variants — e.g., 50/50 random split on user_id hash]
3. [Where to track variant assignment for analysis]
4. [Where to log results for analysis]

## Expected Outcomes
- **If hypothesis confirmed (winner declared):** [action — usually "scale variant B"]
- **If hypothesis refuted:** [next experiment to consider]
- **If inconclusive:** [whether to redesign or move on]

## Notes
[Any context, prior tests in this domain, related hypotheses]
```

## Statistical Analysis Protocol

### Two-Proportion Z-Test (Conversion Rates)

For an A/B test comparing conversion rates:
```
p_A = conversions_A / users_A
p_B = conversions_B / users_B
p_pooled = (conversions_A + conversions_B) / (users_A + users_B)

SE = sqrt(p_pooled × (1 - p_pooled) × (1/users_A + 1/users_B))

z = (p_B - p_A) / SE

p-value: lookup from z-table
  |z| > 1.96  → significant at p<0.05 (95% confidence)
  |z| > 2.58  → significant at p<0.01 (99% confidence)
  
Effect size: 
  Absolute lift = p_B - p_A
  Relative lift = (p_B - p_A) / p_A × 100%
  
95% Confidence Interval on lift:
  Lift ± 1.96 × SE
```

### Welch's t-test (Continuous Metrics)
Used for revenue per visitor, time-on-page, etc.
Use scipy.stats.ttest_ind with equal_var=False if running in Python.
Default to z-test for proportions; only use t-test for true continuous metrics.

### Winner Declaration Rules
A test produces a WINNER when ALL of the following are true:
1. Required sample size reached (or early-stop rule satisfied)
2. p-value <0.05 for the primary metric
3. Effect size is practically meaningful (not just statistically)
4. Direction matches hypothesis (if multivariate, no negative secondary effects)
5. No data quality issues during test (no broken tracking, no audience contamination)

### Winner Analysis Output
```markdown
# Experiment Results: [Name]
**Status:** WINNER / LOSER / INCONCLUSIVE
**Duration:** [N days] | **Total users:** [N]

## Outcome
- Variant A (Control): X% conversion (N=Y, conversions=Z)
- Variant B (Test): X% conversion (N=Y, conversions=Z)
- Absolute lift: +[X]pp
- Relative lift: +[X]%
- 95% CI on lift: [low, high]
- p-value: [X]
- Verdict: [WINNER / LOSER / INCONCLUSIVE]

## What Happened
[Plain-English explanation: did the hypothesis hold?]

## Decision
[Scale variant B / Keep variant A / Run follow-up experiment]

## Learning
[What did we learn about user behavior / our product / our market?]

## Next Experiment
[The next hypothesis in this domain — what's the logical follow-up?]
```

## Backlog Format

```markdown
# Experiment Backlog
> Last updated: [date]

## Active (Running Now)
| ID | Name | Owner | Days Running | Status |
|----|------|-------|-------------|--------|
| EXP-2026-W20-01 | Hero headline test | landing-page | 5 | RUNNING — 60% sample collected |

## Ready to Launch (Top 5)
| Rank | ID | Name | Score | Why Now |
|------|-----|------|-------|---------|
| 1 | EXP-2026-W21-01 | Onboarding step reduction | 4.5 | Activation rate dropped to 38% |
| 2 | ... | | | |

## Queue (Next 2 Weeks)
| Rank | ID | Name | Score |
|------|-----|------|-------|
| 6 | EXP-2026-W21-06 | ... | 2.3 |

## Backlog (Defer)
| ID | Name | Score | Reason Deferred |
|----|------|-------|------------------|
| EXP-2026-W22-XX | ... | 1.1 | Low impact OR low confidence |

## Completed (Last 4 Weeks)
| ID | Name | Result | Lift | Action Taken |
|----|------|--------|------|--------------|
| EXP-2026-W19-03 | CTA color test | INCONCLUSIVE | - | Moved on |
| EXP-2026-W19-01 | Pricing anchor | WINNER | +12% | Scaled |
```

## Common Experiment Templates

### Template 1: Hero Headline Test
- **Variable:** Hero headline text
- **Metric:** Signup conversion (visitor → signup)
- **Min sample:** Calculate based on baseline (typically 500-3000/variant)
- **Duration:** 7-14 days
- **Common variants:** Pain-led vs. benefit-led vs. social-proof-led

### Template 2: CTA Test
- **Variable:** CTA button text / color / position
- **Metric:** Click-through to signup page
- **Min sample:** Smaller (CTR is upper-funnel, faster signal)
- **Duration:** 3-7 days

### Template 3: Onboarding Step Reduction
- **Variable:** Number of steps in onboarding
- **Metric:** Activation rate (Day 1)
- **Min sample:** 300+ signups per variant
- **Duration:** 7-14 days
- **Watch:** Don't over-shorten; activation requires some commitment

### Template 4: Ad Creative Hook
- **Variable:** First 3 seconds of video / first line of copy
- **Metric:** CTR initially, then lead-to-trial downstream
- **Min sample:** 5,000+ impressions per variant
- **Duration:** 3-5 days

### Template 5: Audience Targeting
- **Variable:** Audience segment (e.g., agency owner vs. solo agent)
- **Metric:** Effective CAC
- **Min sample:** ₹50k spend per variant
- **Duration:** 14 days
- **Note:** Slower signal; needs trial→paid time

### Template 6: Pricing Test
- **Variable:** Anchor pricing, annual discount %, tier structure
- **Metric:** Trial→Paid conversion
- **Min sample:** 200+ trials per variant
- **Duration:** 30+ days (paid conversion takes time)
- **Caveats:** Customer perception risk, regulatory considerations

## Decision Heuristics

### When to KILL early
- p<0.01 reached with >50% sample → declare winner
- p<0.05 in wrong direction for 7 days → kill loser
- Frequency >5 corrupting ad results → kill, restart with fresh creative
- Bug in variant assignment → kill, fix, restart

### When to ABANDON
- Required sample would take >21 days → redesign
- Two consecutive tests in same domain inconclusive → that variable doesn't matter
- External shock (competitor launch, seasonality) distorting data → pause

### When to NOT propose a test
- No data signal supporting the hypothesis (vibes-based)
- Variable being tested already had clear winner in past test
- Would conflict with currently-running test (interaction effects)
- Sample size impossible at current traffic

## What This Skill Does NOT Do

- Does not execute the test (passes brief to media-buyer/landing-page-builder)
- Does not change a test mid-flight (invalidates statistical validity)
- Does not analyze multi-variate interaction effects (single-variable tests only)
- Does not adjust for multiple comparisons across simultaneous tests (be conservative)
- Does not run Bayesian analysis (frequentist z-test only, until we need more)

## Strategic Memory

After each completed experiment:
- Was the priority score predictive of impact? (calibrate scoring)
- Pattern detected: e.g., "Hook tests on agency-owner audience consistently outperform tests on solo-agent audience"
- Variables that don't matter (stop testing them)
- Variables that matter more than expected (test more of them)
- Sample-size calibration: were our baseline estimates correct?
