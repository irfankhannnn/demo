# Weekly scorecard

One table, filled every Monday morning, covering the previous week. It replaces eight custom dashboard specifications from the June 2026 design (executive, marketing, sales, customer success, product, growth, plus two near-duplicate "growth dashboard" documents). None of those dashboards exist and none is being built — see [`README.md`](./README.md) §D3 and [`design-only-backlog.md`](./design-only-backlog.md).

Where to keep it: one sheet, one row per week, columns exactly as below. The same file the founder already uses for the pipeline is fine. Do not build a page for this.

Every definition comes from [`metric-dictionary.md`](./metric-dictionary.md). Every number below is a **target**, not a result.

---

## The table

| # | Row | Metric | Where the number comes from | PMF-gate threshold |
|---|---|---|---|---|
| 1 | Landing-page views | M-F1 | PostHog: `page_view`, last 7 days | — |
| 2 | Trial signups | M-F3 | PostHog: `signup_completed`, last 7 days | 30-50 across M1 |
| 3 | Activated trials | M-F5 | **parameterised — see below** | ≥40% of row 2 |
| 4 | Paying customers (cumulative) | M-F6 | Razorpay subscriptions; cross-check PostHog `subscription_paid` | ≥3 by Day 30 |
| 5 | MRR | M-R1 | Razorpay | — |
| 6 | Demos booked / completed / no-show | M-F7, M-C6 | Cal.com + the prospect sheet | no-show under 25% |
| 7 | Cold outreach: sent / replied | M-F8 | Instantly + the manual WhatsApp and LinkedIn log | ≥10% reply rate |
| 8 | NPS responses / promoters | M-A5, M-A6 | `NPSResponses` table | ≥1 promoter |
| 9 | Instagram: reach, followers, DMs | M-E1, M-E5, M-E6 | Instagram app, read by hand | — |
| 10 | Content that produced a conversation | M-CR1 | the manual log in [`attribution-today.md`](./attribution-today.md) §3 | — |
| 11 | Failed payments and escalations | M-R6, M-O2 | PostHog `razorpay_payment_failed`, `ai_employee_escalated` | zero unactioned |
| 12 | One sentence: what changed, and what I am doing about it | — | the founder | — |

Rows 1-5 and 8 and 11 are read out of a system. Rows 6, 7, 9, 10 are counted by hand. Row 12 is the point of the exercise.

## Row 3 is parameterised on purpose

> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Two definitions of "activated" are live in the repo and they measure different populations. Both are written out in [`activation-definition.md`](./activation-definition.md). Until one is chosen, fill row 3 as:

```
activated = <count under definition in use> / <trial signups>   [definition: A | B | manual]
```

and write the definition you used in the cell. A number without its definition is worse than a blank.

There is also a hard blocker independent of the decision: the event the plan names for activation, `ai_employee_lead_handled`, is **not fired by any code** ([`posthog-event-map.md`](./posthog-event-map.md) §4). Until it is, row 3 is counted by hand from the customer list — which at three to five trials a week is perfectly workable.

## The monthly gate check

At Day 30, check the four PMF-gate conditions from `00-PLAN-OVERVIEW.md` §4 against rows 2, 3, 4, 7 and 8:

- ≥3 paying customers
- ≥40% trial-to-activation
- ≥10% reply rate on cold outreach
- ≥1 NPS promoter

If the gate is missed, `00-PLAN-OVERVIEW.md` says hold paid spend and run another 14-day Mumbai beta cycle. Month-2 planning, including the first paid spend, is gated on this — see `month-2-plus/README.md`.

## What this scorecard deliberately does not have

- **CAC, LTV, LTV:CAC, payback.** No paid spend in M1, no customer lifetimes yet. These come back in Month 2 if the gate passes.
- **Cohort retention curves.** Meaningless at this volume.
- **A health-score distribution.** At fewer than ten customers, read the list, do not score it ([`customer-health.md`](./customer-health.md)).
- **Mock numbers.** The June dashboards were full of illustrative figures that were not labelled as illustrative — a fabricated-proof hazard if anyone copied a screenshot into a deck. Nothing in this folder may be used as proof; see [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md).
