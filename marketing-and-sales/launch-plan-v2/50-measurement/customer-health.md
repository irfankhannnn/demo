# Customer health and retention

How we notice that a paying customer is drifting, and what we do about it. Merged from `archive/content-os/growth-platform/customer-scoring/customer-health-system.md` and `.../retention/retention-system.md`, which between them defined four scores with three mutually incompatible weight tables.

> **Design only — not built (17 Sep 2026).** There is no health score, no risk score, no expansion score and no referral score in the code. `scoringService` returns zero hits across `apps/` and `services/`. This file describes the signals that exist and how to read them by hand. The scored version is indexed in [`design-only-backlog.md`](./design-only-backlog.md).

At fewer than ten paying customers, a scored list would be a worse instrument than reading the list. This page is written for that reality and says what would change it.

---

## 1. Signals that exist today

| Signal | Where it comes from | Evidence |
|---|---|---|
| Payment status | `Subscriptions.paymentStatus`; `razorpay_payment_failed` on the webhook | `agency-app/api/routes/subscriptions.js`, `routes/billing.js` |
| Grace period after a failed payment | grace logic in the billing route; an expiry script exists | `agency-app/api/routes/billing.js`, `agency-app/api/scripts/grace-period-expiry-cron.js` |
| Cancellation, pause, resume | `subscription_cancelled`, `subscription_paused`, `subscription_resumed` | PostHog, from `routes/billing.js` |
| Seat pressure | `seat_added`, `seat_removed`, `paywall_seat_limit_hit` | PostHog |
| Trial pressure | `trial_paywall_shown`, `trial_paywall_clicked` | PostHog |
| AI usage | credits consumed; an AI call minute costs credits | `agency-app/api/creditConfig.js`, `aiCallBilling.js`, `middleware/meterCredits.js` |
| Satisfaction | NPS score plus mandatory free text for any score of 6 or below | `src/components/NpsModal.tsx`, `agency-app/api/routes/feedback.js` |
| Escalations | `ai_employee_escalated` when a follow-up needs a human | `agency-app/api/scripts/escalation-cron.js` |
| Session activity | PostHog, per identified user | `src/lib/analytics.ts` |

**Note on the grace cron:** `grace-period-expiry-cron.js` exists in the repo but is not registered as a scheduled rule in `agency-app/api/infra/cfn-backend.yaml` (the trial-reminder cron is). Until it is scheduled, read-only enforcement after grace does not happen on its own. This is already tracked as a pre-paid-launch action in the security decisions.

## 2. What is not there

- No stored health, risk, expansion or referral score. **Design only.**
- No login-frequency or feature-breadth metric. `feature_first_use` is declared in the event contract but never fired.
- No lead caps or plan-tier feature gates to measure usage against. The June documents scored "usage near the plan's 500-lead cap" — there is no such cap. The real limits are **seats** (`agency-app/api/subscriptionService.js`) and **AI credits** (`agency-app/api/creditConfig.js`).
- No Free / Starter / Growth / Pro ladder. The plans are Solo, Team, Team+ and the AI Employee add-on; prices live in `marketing-and-sales/launch-plan-v2/pricing.json` and are being re-planned in `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`.

## 3. The manual review, weekly

Ten minutes, alongside the [`weekly-scorecard.md`](./weekly-scorecard.md). For each paying customer, four questions:

1. **Did they pay?** Any `razorpay_payment_failed` or a subscription in grace is an immediate call, not an email.
2. **Are they in the product?** PostHog session activity in the last seven days. Silence in week two after signup is the strongest churn signal there is.
3. **Is the AI doing anything?** Credit burn near zero means the differentiator is not being used, whatever they say on a call.
4. **What did they last tell us?** NPS free text, the last support message, any escalation.

Any customer failing two of the four gets a founder call that week. Write the reason in the sheet — after ten customers, those reasons are the health score, derived from real churn rather than guessed weights.

## 4. Retention plays that already have machinery

| Play | What exists | What is missing |
|---|---|---|
| Trial drip | day 10, day 12, day 14 and a post-expiry reactivation offer, deployed as a scheduled Lambda | nothing; **extend this cron, do not build a parallel one** |
| Failed-payment dunning | `razorpay_payment_failed` event, grace-period logic in the billing route | the grace expiry cron is not scheduled; there is no customer-facing dunning message sequence |
| Seat-limit upgrade nudge | `paywall_seat_limit_hit` fires on both client and server | no automated follow-up — treat each event as a personal message from the founder |
| Win-back for a lapsed trial | the post-expiry reactivation offer in the trial cron | nothing beyond it |
| At-risk save flow | — | **design only**; at M1 volume this is a phone call |

## 5. Expansion

Two honest expansion signals exist today, and neither needs a score:

- `paywall_seat_limit_hit` on Solo — they tried to invite someone. That is a Team conversation, priced from `pricing.json`.
- Credit burn running out before month end — that is a credit-pack or AI Employee conversation.

The June design's expansion model ("Growth gives 15 users and AI matching, Pro gives API and advanced analytics") describes products that do not exist. It is archived.

## 6. When to build the scored version

Build a health score when **all three** are true: more than roughly 30 paying customers, at least one churn you did not see coming, and a week where reading the list stopped being feasible. Before that, the score would be fitted to no data.

Recorded as a backlog entry with that trigger in [`design-only-backlog.md`](./design-only-backlog.md).
