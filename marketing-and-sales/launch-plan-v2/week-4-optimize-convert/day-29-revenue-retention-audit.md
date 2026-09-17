# Day 29 — Month-1 Revenue + Retention Audit

> **Type:** 🤖 AUTO
> **Phase:** Week 4
> **Skill(s):** `funnel-analysis` + `retention-analysis` + `revops` + `growth-intel`
> **Estimated time:** 1h founder + 5h AI
> **Script:** `../40-sales-and-conversion/customer-journey.md` (the funnel this audit measures) · `../40-sales-and-conversion/closing-script.md`

## Objective
Run a full Month-1 audit: revenue (gross MRR + invoice + GST + Razorpay-fees + bank settlement), retention (cohort active rate + NPS distribution + churn signals), CAC (zero paid spend; proxy via founder hours × ₹500/hr), customer-LTV proxy. Produce a comprehensive Month-1 report with verdict + Month-2 recommendations.

## Why This Matters for RealEstateFlow
M1 is over. Day 29 closes the books literally + figuratively, captures lessons, and feeds Day-30 strategy. Without this audit, M2 starts blind.

## User Story
As founder closing M1 books, I want a single Month-1 audit report covering revenue, retention, CAC, NPS, and Month-2 recommendations — signed off by founder + decision-logged.

## Acceptance Criteria
- [ ] Month-1 audit report at `marketing-and-sales/launch-implement/week-4/day-29-month-1-audit.md`
- [ ] Revenue snapshot: trials started, paid customers, gross MRR, invoice subtotal, GST collected, Razorpay fees, bank settlement, refund requests
- [ ] Retention snapshot: M1 cohort active-7d / active-14d / active-30d rates, NPS distribution, qualitative themes
- [ ] CAC proxy: founder hours × ₹500/hr / paid customers + breakdown by channel
- [ ] Channel ROI updated vs Day-21 brief
- [ ] Top-5 wins documented with quotes
- [ ] Top-5 misses documented with hypothesis
- [ ] Month-2 recommendations: 5 specific actions ranked by ICE
- [ ] Risks register updated based on M1 learnings
- [ ] Founder signs off the report
- [ ] Decision logged: "M1 results: {{MRR}} ₹/mo, {{N}} paid customers, NPS {{score}}, retention {{rate}}, M2 strategy: {{summary}}"

## AI Prompt (🤖)

```
You are a CFO + senior growth strategist running RealEstateFlow Month-1 books.

## Inputs
- Razorpay live dashboard: subscriptions, payments, invoices, refunds (filter Day 1-30)
- DDB Subscriptions table: all M1 subscriptions
- DDB Invoices table
- Bank statement: settlements credited
- PostHog: M1 events full export
- All `marketing-and-sales/launch-implement/week-3/day-21-weekly-growth-brief.md`
- Day-28 NPS data
- Daily-log/dayNN.md (founder hours per day for CAC proxy)
- `marketing-and-sales/launch-implement/week-4/day-27-wedge-v2.md` (M2 wedge)
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md` (PMF gates + M1 success metrics)

## Step 1 — Revenue audit

Output `marketing-and-sales/launch-implement/week-4/day-29-revenue.md`:

| Metric | M1 Actual | Target | Variance | Notes |
|---|---|---|---|---|
| Trials started | N | 30 | ... | |
| Paid customers (Solo / Team / Team+ / AI Employee) | a/b/c/d | ... | ... | |
| Gross MRR | ₹X | ₹15-25k | ... | |
| ARR proxy | ₹X×12 | ... | ... | |
| Invoice subtotal | ₹X | | | excl. GST |
| CGST + SGST collected | ₹Y | | | for Maharashtra customers |
| IGST collected | ₹Z | | | for non-Maharashtra |
| Razorpay fees | ₹W | | | 2% gross |
| Bank settlement | ₹V | | | T+1 cycle |
| Refund requests | N | 0-1 | | |

Reconcile invoice total vs Razorpay total vs bank settlement. Flag any discrepancy >₹100.

## Step 2 — Retention audit

Output `marketing-and-sales/launch-implement/week-4/day-29-retention.md`:

| Metric | M1 Actual | Target | Notes |
|---|---|---|---|
| 7-day retention (% active 7d after signup) | X% | 60% | |
| 14-day retention | X% | 50% | |
| 30-day retention | X% | 40% | |
| NPS Promoters (9-10) | N (X% of respondents) | | |
| NPS Detractors (0-6) | N (Y% of respondents) | | |
| NPS net score | X | ≥0 (M1 baseline) | |
| Detractor follow-ups completed | X/Y | 100% | within 48h |
| Sean Ellis proxy (willingness ≥8) | X% | ≥40% | |
| Cohort engagement curve | chart | | |

Identify:
- Top 3 retention drivers (what activated users keep using)
- Top 3 churn drivers (what stalled users gave up on)

## Step 3 — CAC proxy

Founder hours total in M1 (sum from daily-log mood + hours field; default 8h/day if not logged).
CAC proxy = (Founder hours × ₹500/hr) / # paid customers.
Per-channel breakdown if attributable.

## Step 4 — LTV proxy

Average plan ARPU × estimated months retained (12 if no churn, 6 if some).
LTV:CAC ratio.

## Step 5 — Wins + misses

Top 5 wins (with quote + data):
- e.g., "8 Mumbai brokers onboarded in 14 days, 0 paid spend"
- "First testimonial captured Day 14: 'AI Employee handled my last 5 enquiries' — Priya, Andheri"
- ...

Top 5 misses (with hypothesis):
- e.g., "Cold reply rate 4% (target 5%) — hypothesis: subject line didn't convey wedge clearly enough"
- "Trial-to-paid conversion 12% (target 15%) — hypothesis: ₹999 felt cheap, prompted skepticism"
- ...

## Step 6 — Month-2 recommendations

5 specific actions ranked by ICE × M2 leverage:

1. Action — owner — ICE — expected impact
2. ...

Examples (pick relevant):
- "Re-deploy LP with wedge-v2 + Day-29 testimonials (ICE 9.0; impact +5% conversion)"
- "Add Mumbai broker affiliate program for top NPS Promoters (ICE 8.5; impact +3 paying via referral M2)"
- "Run paid Meta ads ₹50k for AI Employee retargeting (ICE 7.5; first paid spend M2 Week 1)"
- "Hire 1 part-time SDR for cold outreach scale (ICE 7.0; impact 3x sequence volume M2)"
- "Pune ramp: replicate M1 playbook in Pune with localised content (ICE 6.5; M2-M3 expansion)"

## Step 7 — Risks register update

Read `cross-cutting/risks-mitigations.md`. Update probabilities + add 2-3 new risks discovered M1.

## Step 8 — Final report

Output `marketing-and-sales/launch-implement/week-4/day-29-month-1-audit.md` combining all above + Founder sign-off section.

## Step 9 — Decision log

Append to `00-DECISIONS-LOG.md`:
"M1 closed: MRR ₹X/mo from N paying customers, NPS Y, retention Z%. M2 strategy: {{summary from Step 6}}. Founder signed off Day 29."

Stop. Founder reviews + signs.
```

## Inputs
- Razorpay + bank + DDB + PostHog
- Day-21 brief + Day-28 NPS
- Founder daily-log
- Wedge-v2

## Outputs
- `day-29-revenue.md`
- `day-29-retention.md`
- `day-29-month-1-audit.md`
- Updated risks register
- `00-DECISIONS-LOG.md` updated

## Success Criterion
Comprehensive audit + 5 Month-2 recs + founder signs.

## Fallback / Plan B
If revenue numbers can't reconcile (Razorpay vs bank discrepancy), flag for CA review M2 Week 1; don't block Day-30 strategy on this.

## Risks
| Risk | Mitigation |
|---|---|
| Razorpay reconciliation discrepancy | CA review queued |
| Retention sample too small (N<10) | Mark as "directional"; revisit M2 |
| NPS response rate <30% | Send Day 30 WhatsApp follow-up |
| CAC proxy methodology debatable | Document assumptions; revise M2 with real spend data |

## India / Mumbai-Specific Notes
- GST split (CGST+SGST vs IGST) per customer state — verify
- Razorpay T+1 settlement may delay last 2 days of M1 → reconcile early M2
- Indian SaaS LTV unknown M1; rough proxy (12 months) until M2-M6 churn data

## Dependencies
- **Blocks:** Day 30 M2 strategy locked in
- **Depends on:** Day 28 NPS, all Month-1 data

## Connected Skills
- `funnel-analysis` — funnel + drop
- `retention-analysis` — cohort + NPS
- `revops` — revenue reconciliation
- `growth-intel` — Month-2 recs
