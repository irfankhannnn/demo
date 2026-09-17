# Metric dictionary

The one place a metric is defined. Every other file in this playbook references a metric by its `M-*` id and never restates the formula. If two documents disagree about what a number means, this file wins.

Each row gives the formula, the **source it can actually be read from today**, and a target. Targets are targets: RealEstateFlow is pre-launch with zero customers, so nothing here is a measurement of anything yet.

Rows marked **design only** cannot be computed with what is wired up. They are kept because they are the right definitions when the instrumentation arrives; their build triggers are in [`design-only-backlog.md`](./design-only-backlog.md).

Source shorthand: **PH** = PostHog ([`posthog-event-map.md`](./posthog-event-map.md)) · **RZP** = Razorpay webhooks via `apps/crm/server/routes/billing.js` · **NPS** = `NPSResponses` table via `apps/crm/server/routes/feedback.js` · **LOG** = the founder's manual weekly log ([`weekly-scorecard.md`](./weekly-scorecard.md)) · **IG** = Instagram app insights, read by hand.

---

## 0. North star

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-NS1** | Qualified demos booked per week | demos booked with a prospect scored HOT or WARM ([`prospect-lead-scoring.md`](./prospect-lead-scoring.md)) per ISO week | LOG (Cal.com bookings + the prospect sheet) | rising; no absolute target before the PMF gate |
| **M-NS2** | New paying customers per month | count of first `subscription_paid` per tenant per calendar month | PH + RZP | M1: 3-5 (`00-PLAN-OVERVIEW.md` §5) |

The June design set M-NS1 at "20+/week by month 3". That number was invented against a funnel that has never run. It is removed rather than restated.

## 1. Funnel

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-F1** | Landing-page views | `count(page_view)` on `apps/landing-pages` | PH | — |
| **M-F2** | Signups started | `count(signup_started)` | PH | — |
| **M-F3** | Trial signups | `count(signup_completed)` | PH (server) | M1: 30-50 |
| **M-F4** | Trials started (plan chosen) | `count(onboarding_trial_started)` | PH | — |
| **M-F5** | Activated trials | see [`activation-definition.md`](./activation-definition.md) | **design only** — the activation event is not fired | ≥40% of M-F3 |
| **M-F6** | Paying customers | distinct tenants with a `subscription_paid` | PH + RZP | M1: 3-5 |
| **M-F7** | Demos booked | Cal.com bookings | LOG | — |
| **M-F8** | Cold outreach replies | replies ÷ sends, across email / WhatsApp / LinkedIn | LOG + Instantly | ≥10% reply rate |
| **M-F9** | DMs and comments on our own Instagram | counted by hand in the Instagram app | IG / LOG | — |

M-F9 is manual because RealEstateFlow's own Instagram account is not connected to our own Instagram service — Meta App Review is still pending (`docs/pending-items/instagram-service-status.md`). Once it is, per-reel enquiry counts become automatic, exactly as they already are for tenants.

## 2. Conversion rates

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-C1** | Landing page → signup started | `M-F2 / M-F1` | PH | — |
| **M-C2** | Signup started → trial signup | `M-F3 / M-F2` | PH | — |
| **M-C3** | Demo → trial | `M-F3 attributable to a demo / demos completed` | LOG | — |
| **M-C4** | Trial → activation | `M-F5 / M-F3` | design only | ≥40% (PMF gate) |
| **M-C5** | Trial → paid | `M-F6 / M-F3` | PH + RZP | — |
| **M-C6** | Demo no-show rate | `no-shows / M-F7` | LOG | keep below 25% |

M-C4's ≥40% is the PMF-gate threshold in `00-PLAN-OVERVIEW.md` §4. The June activation framework asserted ≥60% with a 45% floor; those numbers had no basis and are dropped. The gate number is the only one.

## 3. Engagement (our own content)

All of these are read by hand from the Instagram app, weekly. The Instagram service can serve followers, reach and views for a **connected** account (`apps/instagram/backend_insta_sol_ms/routes/insights.js`) — ours is not connected yet.

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-E1** | Reach | reach per post and per week | IG | growing |
| **M-E2** | Hook rate | 3-second views ÷ impressions | IG (manual) | — |
| **M-E3** | Hold rate | average watch time ÷ video length | IG (manual) | — |
| **M-E4** | Saves and shares per reach | `saves / reach`, `shares / reach` | IG | — |
| **M-E5** | Follower growth | net new followers per week | IG | growing |
| **M-E6** | DM rate | DMs ÷ reach | IG / LOG | — |

No target percentages are set. The June dictionary carried ">45% hook rate", ">55% hold rate" and "+1k followers/month" as targets; they came from generic benchmarks, not from this account, which has no baseline.

## 4. Revenue

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-R1** | MRR | sum of active subscription amounts | RZP | growing |
| **M-R2** | New MRR | sum of amounts for tenants paying for the first time this month | RZP + PH | growing |
| **M-R3** | Expansion signals | `count(seat_added)` and AI Employee add-on provisions | PH (`seat_added`, `ai_employee_provisioned`) | — |
| **M-R4** | Contraction signals | `count(seat_removed)`, `subscription_paused` | PH | — |
| **M-R5** | Churned MRR | sum of amounts for `subscription_cancelled` in the month | PH + RZP | — |
| **M-R6** | Failed payments | `count(razorpay_payment_failed)` | PH | act on each one |

Plan prices, trial length, refund window and the annual discount come from `marketing-and-sales/launch-plan-v2/pricing.json` and nowhere else. The pricing model is being re-planned; the proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` (status: proposed, awaiting founder approval). Do not copy a price into this file.

CAC, LTV, LTV:CAC and payback are deliberately absent. There is no paid spend in M1 (`00-DECISIONS-LOG.md`), so CAC has no denominator, and with zero customers there is no lifetime to measure. They return in Month 2 if the PMF gate passes — see `month-2-plus/M2-paid-ads-readiness.md`.

## 5. Activation, retention and satisfaction

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-A1** | Activation rate | `M-C4` | design only | ≥40% |
| **M-A2** | Time to activate | median time from `signup_completed` to the activation event | design only | falling |
| **M-A3** | Trial paywall pressure | `count(trial_paywall_shown)`, `trial_paywall_clicked` | PH | — |
| **M-A4** | Seat-limit hits | `count(paywall_seat_limit_hit)` | PH | an upgrade conversation each time |
| **M-A5** | NPS responses | count of rows in `NPSResponses` | NPS | M1: ≥10 |
| **M-A6** | Promoters | responses scoring 9-10 | NPS | M1: ≥3, and ≥1 for the PMF gate |
| **M-A7** | NPS score | `promoters% − detractors%` | NPS | report it, do not target it at this volume |

At ten responses an NPS *score* is noise. Count promoters and read the free text — `routes/feedback.js` requires free text for any score of 6 or below, which is the useful part.

## 6. Scores

There are three scoring models in play and they are not the same thing. Keeping them separate is deliberate.

| ID | Metric | What it scores | Where it is defined |
|---|---|---|---|
| **M-S1** | Tenant lead temperature | a *customer's* buyer leads, HOT / WARM / COLD | built, in code: `apps/crm/server/utils/leadRubric.js`; Instagram enquiries map very_hot/hot/cold → hot/warm/cold in `apps/instagram/backend_insta_sol_ms/services/leadAnalyst.js` |
| **M-S2** | Prospect score | *our* B2B prospects (brokers and agencies we are selling to) | [`prospect-lead-scoring.md`](./prospect-lead-scoring.md) — scored by hand in a sheet, same three bands |
| **M-S3** | Customer health | a paying customer's risk of churn | [`customer-health.md`](./customer-health.md) — **design only**, manual review at M1 volume |

The June documents carried a fourth band ("Cool") and three mutually contradictory weight tables for the same score. The three-band rubric in `leadRubric.js` is the house standard, and the contradictory copies are archived.

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — whether prospect scoring eventually merges into the CRM rubric (by running RealEstateFlow as its own tenant) or stays a separate sheet.

## 7. Content attribution

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-CR1** | Conversations per post | DMs and comments traceable to a post | LOG | — |
| **M-CR2** | Demos per post | demos where the prospect names a post or reel | LOG (ask in the demo) | — |
| **M-CR3** | Content → customer | paying customers who first touched us through a named post | LOG | — |

**Design only** beyond the manual log: there is no `OPP-*` ↔ Instagram `mediaId` ↔ revenue join anywhere in the code, no publish event, and no Blotato webhook. What exists is described in [`attribution-today.md`](./attribution-today.md).

## 8. Lead source vocabulary

For **tenant** leads inside the CRM, the source list is fixed in code and this dictionary does not get to invent values:

`Website · Referral · Walk-in · Google Ads · Social Media · Instagram · Property Portal · Broker Network · Other` (`apps/crm/real-estate-crm-app/src/utils/leadConstants.ts`), plus `sourceAdapter` (`instagram`, `manychat`, …) set by `apps/crm/server/leadIngestion.js`.

For **our own B2B prospects**, which live in a sheet and not in the CRM, use: `instagram_dm`, `instagram_comment`, `linkedin`, `cold_email`, `cold_whatsapp`, `referral`, `website`, `event`, `unknown`. This is a separate vocabulary on purpose — the two lists describe different populations, and the June documents conflated them throughout.

## 9. Operations

| ID | Metric | Formula | Source | Target |
|---|---|---|---|---|
| **M-O1** | Speed to first reply | time from an inbound DM or form to our first reply | LOG | under an hour during working days |
| **M-O2** | Escalations | `count(ai_employee_escalated)` | PH | investigate each one |
| **M-O3** | Outreach volume against the caps | sends per day vs 20 email / 15 WhatsApp / 10 LinkedIn | LOG | stay under the caps |

Cross-references: the scorecard that these feed is [`weekly-scorecard.md`](./weekly-scorecard.md); the gate they are judged against is `00-PLAN-OVERVIEW.md` §4.
