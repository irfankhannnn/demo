---
name: ab-testing
description: >
  Design, monitor, and optimize A/B tests for ad campaigns. Provides statistical
  significance calculations, winner/loser classification, scaling decisions, and
  creative fatigue detection. Use for campaign optimization and experimentation.
allowed-tools: Read, Grep, Bash, Write
---

# A/B Test Management

Design and manage A/B tests for Cloudberry campaigns. Focus: $ARGUMENTS

## Test Design Protocol

### 1. Hypothesis Template
"Changing [variable] from [A] to [B] will improve [metric] by [X%]
because [reasoning]."

### 2. Variables to Test

| Variable | Min Duration | Min Sample |
|----------|-------------|-----------|
| Hook (3s) | 3 days | 5000 impressions |
| CTA text | 3 days | 3000 clicks |
| Image vs Video | 5 days | 10000 impressions |
| Audience | 7 days | 5000 impressions |
| Bidding | 7 days | $200 spend |
| Landing page | 7 days | 500 visits |

### 3. Statistical Significance
Required sample (95% confidence, 80% power):
- 5% conversion → 1,500 per variant
- 2% conversion → 3,800 per variant
- 1% conversion → 7,700 per variant

## Performance Tiers

- **TIER 1 SCALE** (Top 20%): CPA < 0.8× target → +20% budget every 48h
- **TIER 2 MAINTAIN** (Middle 40%): CPA 0.8-1.5× target → Hold, test creatives
- **TIER 3 OPTIMIZE** (Next 20%): CPA 1.5-3× target → Swap creative, -30% budget
- **TIER 4 KILL** (Bottom 20%): CPA > 3× target → Pause immediately

## Creative Fatigue Detection
- Frequency > 3.0 → Prepare new creatives
- Frequency > 5.0 → Replace immediately
- CTR declining 3 days → Test new hooks
- CPA increasing 3 days → Check frequency, refresh

## Scaling Strategies
- **Vertical:** Max +20% budget per 48h
- **Horizontal:** Duplicate winners to new audiences at $30/day test budget
- **Creative:** 3 hook variations + 2 format variations of each winner

## Output
```markdown
# A/B Test: [Name]
## Hypothesis
## Test Design (variable, control, variant, metric, duration)
## Results (CPA, CTR, conversions, lift, confidence)
## Winner Declaration
## Scaling/Kill Action
```

Save to `marketing-and-sales/ads/reports/ab-test-[name]-[date].md`
