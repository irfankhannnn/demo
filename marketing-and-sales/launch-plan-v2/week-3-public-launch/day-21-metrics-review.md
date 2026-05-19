# Day 21 — Week 3 Metrics Review + PMF Gate Check

> **Type:** 🤖 AUTO
> **Phase:** Week 3
> **Skill(s):** `funnel-analysis` + `growth-intel` + `retention-analysis` + `messaging-optimizer`
> **Estimated time:** 1h founder + 5h AI

## Objective
Aggregate all data Days 1-21 (PostHog events, GA4 acquisition, Razorpay revenue, Brevo email, Instantly cold metrics, LinkedIn engagement, beta cohort health, NPS-equivalent willingness scores) into one Weekly Growth Brief. Decide: (a) which channel to scale Day 22-30, (b) which to pause, (c) PMF gate status.

## Why This Matters for RealEstateFlow
Day 21 is the mid-launch decision point. The data shows whether the wedge resonates + which channel converts. Day 22-30 strategy is decided here, not by gut.

## User Story
As founder on Day 21 evening, I want a single Weekly Growth Brief with channel ROI + PMF signal + Day-22-30 recommendation, so the next 9 days are data-driven not vibe-driven.

## Acceptance Criteria
- [ ] Weekly Growth Brief at `marketing-and-sales/launch-implement/week-3/day-21-weekly-growth-brief.md`
- [ ] Funnel breakdown Day 1-21: visitors → trial signups → activated → paying / pending paid
- [ ] Channel ROI: cold email vs WhatsApp vs LinkedIn vs LP organic vs LinkedIn post — each with reply rate, demo book rate, trial start rate, eff CAC (zero spend, but proxy)
- [ ] Beta cohort retention: 14-day cohort active rate + willingness-to-pay distribution
- [ ] AI Employee uptake: # of beta testers who added it / how many in concierge queue
- [ ] PMF gate status (per `00-PLAN-OVERVIEW.md` thresholds): activation ≥60% / Sean Ellis ≥40% / cold reply ≥5% / convert-to-paid ≥10%
- [ ] Day-22-30 recommendation: scale-X / pause-Y / iterate-Z
- [ ] If PMF gate missed: explicit fallback plan
- [ ] If gate met: explicit scale-up plan + first-paid customer celebration message
- [ ] Risks register (`cross-cutting/risks-mitigations.md`) reviewed + updated probabilities
- [ ] Decision logged to `00-DECISIONS-LOG.md`: "Day 21 PMF gate: PASS / FAIL / PARTIAL — Day 22-30 strategy: {{summary}}"

## AI Prompt (🤖)

```
You are a senior growth strategist. Run the Day-21 Weekly Growth Brief for RealEstateFlow.

## Inputs
- PostHog: full event export Day 1-21 (use saved Day-4 dashboard)
- GA4: acquisition + behavior reports
- Brevo: email engagement (welcome drip)
- Instantly: cold-email campaign metrics
- AiSensy: WhatsApp metrics (if available)
- LinkedIn campaign manager: post engagement metrics for Posts 1-6
- Razorpay live dashboard: subscriptions count, MRR, churn (none yet but record)
- `marketing-and-sales/launch-implement/week-2/day-11-cohort-health.md`
- `marketing-and-sales/launch-implement/week-3/day-18-eod-metrics.md`
- `marketing-and-sales/launch-implement/week-3/day-19-eod-metrics.md`
- `marketing-and-sales/launch-implement/week-3/day-20-engagement-log.csv`
- `marketing-and-sales/launch-implement/week-3/demos/*.md`
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md` (PMF gate thresholds)

## Step 1 — Funnel reconstruction

Build the canonical funnel for Day 1-21:
| Stage | Count | Rate vs prev |
|---|---|---|
| LP visitors (unique) | N | — |
| Pricing-page visitors | N | %|
| Trial signups | N | % |
| Activated (PostHog `feature_first_use`) | N | % |
| Demo booked | N | % of trials |
| Demo attended | N | % of booked |
| Paid started | N | % of trials |
| AI Employee comp/paid | N | % of paid |

For each transition, list top 3 drop-causes with PostHog event evidence.

## Step 2 — Channel ROI

For each channel:
| Channel | Sends/Posts | Direct trial signups attributed | LP visits attributed | Demos booked | Trials → Paid | Effective CAC (₹) |
|---|---|---|---|---|---|---|

Channels: Day-9 warm invites · Day-17/18 cold email · WhatsApp outreach · LinkedIn DM · LinkedIn Posts 1-6 · Group/Slack/Reddit shares · LP organic · Directory referrals (if any live yet).

## Step 3 — Beta cohort retention

| Tester | First seen | Last active | Sessions | Days active | Willingness-to-pay |
|---|---|---|---|---|---|

Cohort active rate = active in last 7 days / total beta testers.

## Step 4 — AI Employee uptake

- Beta testers who added (paid or comp): N
- In concierge queue: M
- Avg time-to-onboard: X hours
- Customer-facing wow score (from Day-13 voice replies): rough ★/5

## Step 5 — PMF gate evaluation

Per `00-PLAN-OVERVIEW.md`:
- Activation rate ≥60% — current: X% — PASS/FAIL
- Sean Ellis (very-disappointed-if-can't-use) ≥40% — current: X% — proxy via "willingness ≥8/10"
- Cold reply ≥5% — current: X% — PASS/FAIL
- Trial-to-paid ≥10% — current: X% (early; partial — flag)

Verdict: PASS · PARTIAL · FAIL.

## Step 6 — Day-22-30 recommendations

Based on the verdict + channel ROI, produce 5-7 specific recommendations. Each: action, owner, ICE score, expected impact.

Examples (pick relevant per data):
- "Scale cold email Touch-1 to next 80 prospects (ICE 8.4)"
- "Pause LinkedIn DM (low ROI vs WhatsApp); reallocate to community comments (ICE 7.0)"
- "Ship Day-22 LP CRO based on top-3 drop points (ICE 8.8)"
- "Day-25 case study from highest-willingness tester (ICE 8.2)"
- "Day-26 trial-to-paid follow-up wave (ICE 9.0)"

## Step 7 — Risks update

Read `cross-cutting/risks-mitigations.md`. For each risk, update probability based on Day 1-21 data. Append new risks discovered.

## Step 8 — Founder mood + bandwidth check

Pull from daily-log/dayNN.md "founder mood" field. If avg mood ≤4/10 for 5+ days → flag burnout risk + recommend Day-22 lighter day.

## Output

`marketing-and-sales/launch-implement/week-3/day-21-weekly-growth-brief.md`:

# RealEstateFlow Weekly Growth Brief — Day 21

## Verdict
PMF gate: **PASS / PARTIAL / FAIL**
Day-22-30 strategy: **{{1-paragraph}}**

## Funnel
{{table from Step 1}}

## Channel ROI
{{table from Step 2}}

## Beta cohort
{{Step 3-4 summary}}

## PMF gate detail
{{Step 5}}

## Top 5 actions for Day 22-30
1. ...
2. ...

## Risks update
{{Step 7}}

## Founder
{{Step 8}}

## Decision log entry
"Day 21 PMF gate: ... — Day 22-30 strategy: ..."

Stop. Founder reviews + signs.
```

## Inputs
- All Day 1-21 data sources
- PMF gate thresholds
- Founder mood from daily standups

## Outputs
- `day-21-weekly-growth-brief.md`
- Updated risks register
- `00-DECISIONS-LOG.md` entry

## Success Criterion
Brief delivered with verdict + 5-7 actionable recommendations + founder signs off.

## Fallback / Plan B
If data is insufficient (events not firing for some channel), fix attribution Day 22 first, re-run Day 22 evening.

## Risks
| Risk | Mitigation |
|---|---|
| Wrong attribution skews channel ROI | Day-4 verification + Day-21 cross-check; if uncertain, mark as "directional" |
| Sample sizes too small | Mark as "directional"; don't make irreversible decisions |
| Founder rejects verdict | Discuss + re-run with different lens; commit to one decision in 24h |
| Cohort too small for Sean Ellis | Use willingness-to-pay 8+/10 as proxy until N≥30 |

## India / Mumbai-Specific Notes
- Channel ROI must reflect Indian context (WhatsApp expected to dominate)
- Currency = ₹ everywhere; CAC in ₹ (zero paid M1, so proxies via founder time × ₹500/h)
- Demo time = founder's only constraint (cap 4/day) — flag if Day-22-30 demand exceeds capacity

## Dependencies
- **Blocks:** Day 22-30 strategy
- **Depends on:** P10 events, all Days 1-20

## Connected Skills
- `funnel-analysis` — drop points
- `growth-intel` — strategic synthesis
- `retention-analysis` — beta cohort
- `messaging-optimizer` — channel ROI
