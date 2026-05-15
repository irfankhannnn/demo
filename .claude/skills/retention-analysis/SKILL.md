---
name: retention-analysis
description: >
  Builds cohort retention tables, scores active users on churn risk, identifies
  behavioral predictors of retention, generates win-back target lists. Reads PostHog
  event exports and CRM customer data. Outputs churn-risk CSVs for nurture-bot and
  win-back CSVs for sdr. The core capability of the retention-analyst agent. Use
  weekly (Sundays) or when a churn spike is detected.
allowed-tools: Read, Grep, Bash, Write
---

# Retention Analysis

Cohort analysis, churn scoring, and behavioral predictor detection. Focus: $ARGUMENTS

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Weekly | `/retention-analysis weekly` | Full retention health report + risk lists |
| Cohort | `/retention-analysis cohort` | Just the cohort comparison table |
| At-risk | `/retention-analysis at-risk` | Just generate churn-risk CSV |
| Win-back | `/retention-analysis winback` | Just generate win-back target CSV |
| Predictors | `/retention-analysis predictors` | Identify behavioral retention predictors |

## Required Inputs

| Input | Path | Required Columns |
|-------|------|------------------|
| Event export | `marketing-and-sales/reports/product-analytics/events-*.csv` | user_id, event_name, timestamp |
| User properties | `marketing-and-sales/reports/product-analytics/users-*.csv` | user_id, signup_date, plan, icp_segment |
| Customer list | `marketing-and-sales/reports/product-analytics/customers-*.csv` | user_id, signup_date, plan, mrr, last_login, churn_date |

If files missing: halt, write error report, list what's needed. Do not fabricate data.

## Outputs

| Output | Path |
|--------|------|
| Retention Health Report | `marketing-and-sales/reports/intelligence/retention/YYYY-W##-retention.md` |
| Cohort Table | `marketing-and-sales/reports/intelligence/retention/cohorts/YYYY-W##-cohorts.md` |
| Churn Risk CSV | `marketing-and-sales/leads/churn-risk-YYYY-MM-DD.csv` |
| Win-Back CSV | `marketing-and-sales/leads/winback-targets-YYYY-MM-DD.csv` |
| Behavioral Predictors | `marketing-and-sales/reports/intelligence/retention/predictors-YYYY-MM-DD.md` |

## Cohort Analysis Protocol

### Step 1: Build cohorts by signup month
Group all users by signup month (e.g., 2026-02, 2026-03).

### Step 2: For each cohort, compute retention at intervals
For each user in cohort, check if they had a session event on:
- Day 1 (within 24h of signup): D1 retention
- Day 7 (between 6-8 days after signup): D7 retention
- Day 30 (between 28-32 days): D30 retention
- Day 60 (between 58-62 days): D60 retention
- Day 90 (between 88-92 days): D90 retention

### Step 3: Output cohort table
```
| Signup Cohort | Size | D1 | D7 | D30 | D60 | D90 |
|---------------|------|----|----|-----|-----|-----|
| 2026-02       | 124  | 78%| 52%| 38% | 32% | 28% |
| 2026-03       | 156  | 81%| 58%| 42% | 35% | -   |
| 2026-04       | 198  | 76%| 49%| 36% | -   | -   |
| 2026-05       | 245  | 79%| 55%| -   | -   | -   |
```

### Step 4: Identify best/worst cohorts
Flag cohort with highest D30 retention. What was different about that cohort?
- Different acquisition channel?
- Different onboarding flow version?
- Different ICP mix?
- Different seasonal context?

## Churn Risk Scoring

For every active customer (not yet churned), compute:

```
Base score = 0

# Activity signals
+ 3 if no login in last 7 days AND user used to log in daily/weekly
+ 2 if no login in last 14 days
+ 2 if session frequency dropped >50% week-over-week
+ 2 if total feature events dropped >50% week-over-week

# Engagement signals
+ 2 if last 3 sessions <2 minutes each (rushed check-ins)
+ 1 if last login at non-peak hour for this user
+ 1 if no feature exploration in last 14 days (using only one core feature)

# Support signals
+ 2 if open support ticket > 3 days unresolved
+ 1 if multiple support tickets in last 14 days

# Business signals
+ 1 if team member count dropped (someone left)
+ 2 if downgrade flow viewed in last 7 days
+ 3 if cancellation page viewed in last 7 days
+ 2 if competitor brand mentioned in support chat

# Positive signals (subtract)
- 2 if usage increased week-over-week
- 1 if new feature usage detected in last 7 days
- 1 if invited new team member recently
- 1 if increased data volume (more listings, more contacts)

Final score: max(0, min(10, score))
```

### Action by Score Tier
| Score | Risk | Action |
|-------|------|--------|
| 9-10 | CRITICAL | SDR personal call within 24h |
| 7-8 | HIGH | nurture-bot 3-email reactivation sequence |
| 5-6 | MEDIUM | Passive nurture + proactive feature tip |
| 0-4 | LOW | Standard nurture |

### Churn Risk CSV Format
```
user_id,name,company,plan,mrr,risk_score,top_signals,recommended_action,assigned_to
U-1234,Rajesh Sharma,Sharma Estates,Pro,3000,9,"No login 9d; Support ticket 5d unresolved",SDR call,sdr
U-5678,Priya Patel,Patel Realty,Pro,3000,7,"Session drop 60%; Downgrade page viewed",Reactivation email,nurture-bot
```

## Win-Back Target Scoring

For churned users in the last 6 months:

```
Win-back score = 0

# Recency
+ 3 if churned within last 60 days
+ 1 if churned within last 90 days
+ 0 if churned >90 days ago

# Engagement before churn
+ 2 if activated before churning (proved product fit)
+ 1 if had paid plan (not just trial)
+ 2 if used 3+ features before churn

# Reason for leaving
+ 2 if churned at trial end without converting (price-sensitive)
+ 2 if cited "wrong time" or "no budget" in exit survey
+ 1 if exited cleanly (no complaint, no support issues)

# Origin
+ 1 if originally referral or organic (high intent)

# Negative signals
- 2 if cited specific product complaint that's still unfixed
- 3 if signed up with direct competitor (LinkedIn check, public post check)
- 2 if had multiple support tickets that went unresolved

Final score: max(0, min(10, score))
```

### Action by Win-Back Score
| Score | Action |
|-------|--------|
| 7+ | HIGH-PRIORITY: SDR personal outreach with new-feature pitch |
| 4-6 | EMAIL CAMPAIGN: "What's new since you left" sequence |
| <4 | WAIT: 6+ months before re-contact |

### Win-Back CSV Format
```
user_id,name,company,churned_date,churn_reason,winback_score,recommended_pitch,assigned_to
U-9101,Dev Kumar,Solo,2026-04-15,Free trial expired,8,New WhatsApp integration,sdr
```

## Behavioral Retention Predictors

For each event the product fires, compute:
- % of D30-retained users who did this event in first 7 days
- % of D30-churned users who did this event in first 7 days
- Lift = retained% - churned%

Rank events by lift. Flag events with lift >15pp as "magic moments."

### Output Format
```markdown
| Event | First-7-Day % (Retained) | First-7-Day % (Churned) | Lift |
|-------|--------------------------|-------------------------|------|
| Added first property listing | 88% | 31% | +57pp |
| Invited team member | 72% | 18% | +54pp |
| Connected WhatsApp | 65% | 22% | +43pp |
| Used search/filter | 91% | 78% | +13pp |
| Visited settings | 45% | 41% | +4pp (not predictive) |
```

**The Magic Moment:** Behavior with highest predictive lift
**Recommendation:** Make this behavior happen in first session by:
- Adding contextual prompts
- Demo-data pre-population
- Onboarding flow change

## Health Score Formula

```
Retention Health Score (0-100) = 
  (Activation rate / 60%) × 30
+ (D7 retention / 50%) × 25
+ (D30 retention / 40%) × 25
+ (D90 retention / 30%) × 20

Capped at 100.
```

| Score | Status |
|-------|--------|
| 80-100 | Healthy |
| 60-79 | Acceptable, watch closely |
| 40-59 | Warning — retention is a blocker to growth |
| <40 | Critical — fix before scaling acquisition |

## Analysis Protocol

### Weekly Sunday Run
1. **Verify data freshness** — confirm events/users/customers CSVs are <7 days old
2. **Build cohort table** — group by signup month, compute D1/D7/D30/D60/D90
3. **Compute Health Score** — apply formula
4. **Score active users** — apply churn risk formula to every customer
5. **Score churned users** — apply win-back formula to last 6 months of churners
6. **Identify magic moments** — compute behavioral predictor lifts
7. **Write CSVs** — churn-risk and win-back files for downstream agents
8. **Write report** — full retention health markdown
9. **Flag urgent issues** — if Health Score dropped >10 points, urgent alert to growth-strategist

### Confidence Rules
- Cohort smaller than 30 users → mark LOW confidence
- Date range <30 days → some metrics (D30, D60, D90) unavailable
- Missing signup_date on >10% of users → flag data quality issue
- Missing event data on >5% of users → flag instrumentation gap

## Common Diagnostic Patterns

### Pattern: "Newer cohorts retain worse"
Likely cause: recent onboarding change broke something OR new ICP being acquired is wrong fit
Action: roll back recent product change OR review acquisition targeting

### Pattern: "Best ICP segment has worst retention"
Likely cause: acquisition is targeting "look-alikes" not actual ICP, OR pricing/positioning broken for this segment
Action: review acquisition definition vs. true ICP definition

### Pattern: "D1 high, D7 cliff"
Likely cause: onboarding success but no return reason — value not realized
Action: add Day 2-3 email with re-engagement hook OR add core feature push in onboarding

### Pattern: "Feature X correlates strongly with retention"
Action: prioritize that feature in onboarding, mention in marketing, gate it appropriately

## Strategic Memory

After each weekly run, append:
- Which churn signals had highest predictive accuracy (calibrate scoring)
- Win-back campaign results (how many came back?)
- New magic moments identified
- Cohort patterns worth investigating deeper

This makes scoring sharper over time.

## What This Skill Does NOT Do

- Does not connect to PostHog API in real-time (file-based only)
- Does not run interventions (nurture-bot and sdr do that)
- Does not predict individual user churn dates (too noisy at small N)
- Does not analyze revenue retention / NRR (that's a separate skill)
