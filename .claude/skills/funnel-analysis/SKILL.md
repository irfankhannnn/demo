---
name: funnel-analysis
description: >
  Reads product analytics CSV exports (PostHog or equivalent) and CRM data to map
  the user journey from signup to activation to retention. Identifies drop points,
  activation failures, segment-specific friction, and generates onboarding fix
  recommendations. Use when funnel report is stale, when activation problems are
  suspected, or as a prerequisite for growth-strategist weekly run.
allowed-tools: Read, Grep, Bash, Write
---

# Funnel Analysis

Map the user journey and find where users drop. Focus: $ARGUMENTS

## Required Inputs

### File 1: events-YYYY-W##.csv
Expected columns:
```
user_id, event_name, timestamp, properties, source
```

Expected event names (must be instrumented in product):
- `user_signed_up` — registration completed
- `first_property_listed` — added their first property
- `crm_contact_added` — added their first contact/lead
- `team_member_invited` — invited a team member
- `whatsapp_connected` — connected WhatsApp integration
- `dashboard_viewed` — visited dashboard (used for engagement)
- `user_session_start` — session start (used for retention)

### File 2: users-YYYY-W##.csv
Expected columns:
```
user_id, signup_date, plan, company_size, icp_segment, source_utm
```

### Input Location
`marketing-and-sales/reports/product-analytics/`

### If Files Missing
Halt and write a clear error report telling the user:
1. Which file is missing
2. Where to upload it (path)
3. What PostHog query/export to run

Do NOT make up data. Better to fail loudly than fabricate.

## Output

Save to: `marketing-and-sales/reports/intelligence/funnel-analysis/YYYY-W##-funnel.md`

## Output Template

```markdown
# Funnel Analysis — Week [##], [YYYY]
> Data range: [first event date] to [last event date] | Total users: [N]

## Top-Line Funnel
| Step | Users | % of Signup | % Drop from Previous |
|------|-------|-------------|---------------------|
| Signup | X (100%) | — | — |
| Reached dashboard | X | X% | X% |
| Activation (created first listing OR contact) | X | X% | X% |
| Day 1 return | X | X% | X% |
| Day 7 return | X | X% | X% |
| Day 30 return | X | X% | X% |

## Activation Rate Definition
A user is considered "activated" if they did ONE OR MORE of:
- Added first property listing within 48 hours
- Added first CRM contact within 48 hours
- Invited a team member within 48 hours

**Current activation rate:** [X%]
**Target:** 60%+
**Status:** ✅ Healthy | ⚠️ Below target | 🔴 Critical (<40%)

## Biggest Drop Points (Ranked)
1. **[Step name]:** [X%] drop, [N] users affected per week
   - Likely cause: [hypothesis]
   - Recoverable potential: [N users × downstream conversion = $$ impact]
   - Recommendation: [Specific fix]
2. ...

## Time to Activation
- Median time to first listing: [X hours]
- 75th percentile: [X hours]
- 90th percentile: [X days]
- **% activated within first session:** [X%]
- **% activated within first 24 hours:** [X%]
- **% activated within 7 days:** [X%]

## Segment Comparison
| ICP Segment | Activation Rate | D7 Retention | D30 Retention | Sample |
|-------------|----------------|--------------|---------------|--------|
| Rajesh Bhai (agency owner) | X% | X% | X% | N |
| Priya Madam (sales mgr) | X% | X% | X% | N |
| Dev bhai (solo agent) | X% | X% | X% | N |

**Highest-converting segment:** [Persona] — flag to growth-strategist for targeting expansion
**Lowest-converting segment:** [Persona] — consider whether to deprioritize or fix UX

## Source Quality (UTM → Activation)
| Source | Signups | Activation Rate | Quality Score |
|--------|---------|----------------|---------------|
| Meta Ads | X | X% | HIGH/MED/LOW |
| LinkedIn | X | X% | HIGH/MED/LOW |
| Organic | X | X% | HIGH/MED/LOW |
| Direct | X | X% | HIGH/MED/LOW |
| Referral | X | X% | HIGH/MED/LOW |

**Best-converting source:** [Channel] — feed to channel-cac-analysis
**Worst-converting source:** [Channel] — possible audience mismatch

## Activation Failure Analysis
Of the [N] signups who did NOT activate:
- [X%] reached dashboard but did nothing — likely UX confusion
- [X%] did not return after signup — likely value-prop mismatch
- [X%] activated partially (1 of 3 activation events) — close to converting

**Top friction signals:**
1. [Event that activated users do that non-activated users don't]
2. [Page exits before activation event]
3. [Time-of-day signup → activation rate variation]

## Behavioral Predictors of Activation
Users who [behavior in first session] activate at [X%] vs. [Y%] for those who don't.

| First-Session Behavior | Activation Rate (Did) | Activation Rate (Didn't) | Lift |
|------------------------|----------------------|--------------------------|------|
| Watched onboarding video | X% | Y% | +Zpp |
| Used search/filter on dashboard | X% | Y% | +Zpp |
| Opened settings | X% | Y% | +Zpp |
| Clicked "Add Property" button | X% | Y% | +Zpp |

## Recommended Onboarding Fixes (Top 3)
1. **[Specific fix]** — addresses [drop point], expected lift [+X%]
2. **[Specific fix]** — addresses [drop point], expected lift [+X%]
3. **[Specific fix]** — addresses [drop point], expected lift [+X%]

## Experiment Candidates (for experiment-designer)
1. **Hypothesis:** If we [change X], activation rate will improve by [Y%] because [data reason]
2. ...

## Data Quality
- Total events analyzed: [N]
- Date range: [start] to [end]
- Missing data flags: [list any events/properties expected but not present]
- Sample size warnings: [any segment with <30 users marked LOW confidence]
```

## Analysis Protocol

### Step 1: Load and validate
```bash
# Find latest event file
ls marketing-and-sales/reports/product-analytics/events-*.csv

# Verify expected events are present (run grep on event_name column)
# If a required event is missing → flag in output and continue with what's available
```

### Step 2: Build the top-line funnel
For each user in users.csv:
1. Find their signup event
2. Find their first dashboard view (= reached dashboard)
3. Find their first activation event (listing/contact/invite)
4. Find their Day 1, Day 7, Day 30 session events
5. Tally counts at each stage

### Step 3: Compute drop rates
For each step, compute:
- `% from signup` = (users at this step) / (total signups)
- `% drop from previous` = ((users at previous) - (users at this)) / (users at previous)

Flag the step with the highest absolute drop.

### Step 4: Activation segmentation
Join users.csv with the activation events to compute:
- Activation rate by `icp_segment` (column from users.csv)
- Activation rate by `source_utm` (channel attribution)
- Activation rate by `signup hour/day` (timing patterns)
- Activation rate by `company_size`

### Step 5: Time-to-activation
For activated users only:
- Compute `time_to_first_activation = first_activation_timestamp - signup_timestamp`
- Sort and report median, p75, p90

### Step 6: Behavioral predictors
Compare activated vs. non-activated users:
- What % of activated users did event X in first session?
- What % of non-activated users did event X in first session?
- Lift = activated_pct - non_activated_pct
- Flag any behavior with lift >15pp as a "magic moment" candidate

### Step 7: Failure analysis
For non-activated users, classify the failure mode:
- "Dashboard-only": reached dashboard but no activation event
- "No return": no session after signup session
- "Partial activation": did 1 of 3 activation events but not enough to count

### Step 8: Generate recommendations
For the top 3 drop points, generate specific fixes:
- If activation fails because "no listing added" → recommend pre-populated demo listing OR shorter listing form
- If dashboard reached but no action → recommend prominent CTA OR contextual tooltip
- If no return after signup → recommend Day 1 email with magic-link to resume

### Step 9: Write output
Save report. If activation rate dropped vs. last week, flag urgent to growth-strategist.

## Confidence Rules

| Condition | Confidence |
|-----------|-----------|
| Sample <30 users in any segment | LOW for that segment |
| Sample 30-100 | MEDIUM |
| Sample >100 | HIGH |
| Missing >20% of expected events | LOW overall |
| Date range <7 days | LOW |
| Date range 7-30 days | MEDIUM |
| Date range >30 days | HIGH |

## What This Skill Does NOT Do

- It does not connect to PostHog API in real-time (file-based only — uses CSV exports)
- It does not segment by cohort over time (that's retention-analysis skill)
- It does not generate copy/messaging fixes (that's messaging-optimizer)
- It does not run statistical significance tests (that's experiment-design)

## When Funnel Data Is Insufficient

If the CSVs are missing or have <30 users, write a placeholder report with:
1. Clear "INSUFFICIENT DATA" status
2. What's needed: specific event instrumentation + minimum sample size
3. Instructions for the product team: which events to add and where

Do NOT generate fake numbers to fill the template.
