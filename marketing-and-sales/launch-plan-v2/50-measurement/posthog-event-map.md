# PostHog event map

The single event vocabulary for the launch. If a metric in [`metric-dictionary.md`](./metric-dictionary.md) names an event, it names one from this page.

This replaces two competing event lists in the June 2026 growth-platform design (`archive/content-os/growth-platform/activation/events.md` and `.../attribution/events.md`). Both invented their own names (`trial_started`, `paid`, `churned`, `first_ai_call`) and both posted them to `POST /api/marketing/events`. **That route does not exist**, and neither does `marketingEventsService`. Do not fork a second vocabulary — extend this one.

Sources of truth in the code:
- `apps/crm/real-estate-crm-app/src/types/analytics.ts` — the declared `AnalyticsEvent` union and `UserTraits`.
- `apps/crm/real-estate-crm-app/src/lib/analytics.ts` — `trackEvent` / `identifyUser`, client side.
- `apps/crm/server/lib/posthog.js` — `serverTrack`, server side.
- `apps/landing-pages/_partials/head-analytics.hbs` — landing-page PostHog plus the consent-gated GA4 / Meta Pixel / LinkedIn / Hotjar tags.
- `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` §3.4 — the contract the union was written from.

---

## 1. Events fired today, client side

Eleven names, thirteen call sites. Every one verified in the SPA source.

| Event | Fired from | Properties |
|---|---|---|
| `signup_started` | `src/pages/PhoneLogin.tsx:47` | `utm_source` |
| `otp_verified` | `src/pages/PhoneLogin.tsx:129` | `isNewUser` |
| `onboarding_role_selected` | `src/pages/RoleSelection.tsx:24,44` | `role` (`admin` / `member`) |
| `onboarding_plan_buy_clicked` | `src/pages/onboarding/ChoosePlan.tsx:29` | `tier`, `billingCycle` |
| `onboarding_trial_started` | `src/pages/onboarding/ChoosePlan.tsx:34` | `plan_intent`, `billingCycle` |
| `agency_registered` | `src/pages/RegisterAdmin.tsx:65` | `plan_intent` |
| `buyer_added` | `src/pages/crm/BuyerDetails.tsx:197` | `source` |
| `trial_paywall_shown` | `src/components/PaywallModal.tsx:78` | paywall context |
| `trial_paywall_clicked` | `src/components/PaywallModal.tsx:93` | paywall context |
| `paywall_seat_limit_hit` | `src/pages/admin/InviteManagement.tsx:185` | seat context |
| `nps_response` | `src/components/NpsModal.tsx:102` | score, free text flag |

**User traits**, set once after login via `identifyUser`: `tenantId`, `role`, `plan`, `trialEndsAt`, `agencyName`, `utm_source`, `utm_campaign`, `utm_medium`. UTM is read off the signup URL in `PhoneLogin.tsx:36-47` and `RegisterAdmin.tsx:38`. This is the only UTM capture in the product — leads themselves carry no UTM.

## 2. Events fired today, server side

All through `serverTrack(distinctId, event, properties)`. Note that on the billing path the `distinctId` is the **tenant id**, not a user id, so billing events do not join to a user-level funnel without a mapping step.

| Event | Fired from | Meaning |
|---|---|---|
| `signup_completed` | `apps/crm/server/routes/auth.js:69` | account created |
| `subscription_started` | `routes/billing.js:270` | Razorpay subscription activated |
| `subscription_invoiced` | `routes/billing.js:281` | `subscription.charged` webhook |
| `subscription_paid` | `routes/billing.js:285` | money received for a subscription cycle |
| `razorpay_payment_succeeded` | `routes/billing.js:295` | `payment.captured` |
| `razorpay_payment_failed` | `routes/billing.js:360` | `payment.failed` |
| `razorpay_payment_refunded` | `routes/billing.js:412` | refund processed |
| `razorpay_payment_disputed` | `routes/billing.js:458` | chargeback |
| `subscription_cancelled` | `routes/billing.js:549` | cancellation |
| `subscription_paused` / `subscription_resumed` | `routes/billing.js:637,657` | pause lifecycle |
| `seat_added` / `seat_removed` | `routes/billing.js:571,596` | seat change (expansion / contraction signal) |
| `ai_employee_provisioned` | `routes/billing.js:247` | AI Employee add-on provisioned after payment |
| `paywall_seat_limit_hit` | `routes/subscriptions.js:87` | server-side twin of the client event |
| `grievance_received` | `routes/grievance.js:226` | grievance submitted |
| `ai_employee_escalated` | `apps/crm/server/scripts/escalation-cron.js:80` | follow-up escalated to a human |

## 3. Landing pages

`page_view` is captured for every landing-page view with `page`, `referrer` and `utm_source` (`head-analytics.hbs`). PostHog itself always initialises; session recording, GA4, Meta Pixel, LinkedIn Insight and Hotjar are each gated on the visitor's cookie-consent choice. Consent-gated tags mean landing-page numbers in GA4 and Pixel are **undercounts by design** — PostHog `page_view` is the honest denominator.

## 4. Declared in the contract but never fired

These names are in the `AnalyticsEvent` union and in Shared Contracts §3.4, but zero code fires them. Anyone who writes a PostHog insight against them gets an empty chart.

`owner_added` · `property_added` · `lead_added` · `lead_converted` · `khata_entry_created` · `khata_settled` · `meeting_scheduled` · `whatsapp_share_clicked` · `feature_first_use` · `ai_employee_connected` · `ai_employee_lead_handled` · `invite_accepted` · `grievance_submitted`

Two of these matter more than the rest:

- **`ai_employee_lead_handled`** is the event `00-PLAN-OVERVIEW.md` §5 names as the source for the activation rate in the PMF gate. It does not exist in code. Until it is emitted, the activation rate cannot be read from PostHog at all. See [`activation-definition.md`](./activation-definition.md).
- **`grievance_submitted`** was renamed to `grievance_received` on the server. One of the two should be retired so a single name is queryable.

**Smallest instrumentation that closes the gap** (not yet scheduled; this is the one build ask this layer makes):

1. `ai_employee_connected` when WhatsApp is linked (`src/pages/onboarding/ConnectWhatsApp.tsx`).
2. `ai_employee_lead_handled` when the AI Employee completes a lead end-to-end.
3. `lead_added` on lead creation, carrying `source` and `sourceAdapter` from `apps/crm/server/leadIngestion.js` so channel mix is queryable.
4. `meeting_scheduled` on meeting creation.

Everything else on the list can stay unfired until someone needs it.

## 5. Name mapping from the June design

Use this when reading an archived growth-platform document, so the old names do not creep back in.

| June design name | Live name | Note |
|---|---|---|
| `trial_started` | `onboarding_trial_started` | client, at plan choice |
| `paid` | `subscription_paid` | server, from Razorpay |
| `churned` | `subscription_cancelled` | server |
| `login` | — | no login event; PostHog session activity is the proxy |
| `first_ai_call` | — | not fired; AI call outcomes land in `apps/crm/server/routes/aiCallingInternal.js` and are metered in credits |
| `leads_imported` | — | would be `lead_added` once fired |
| `followup_set` | — | would be `meeting_scheduled` once fired |
| `team_invited` | `invite_accepted` (declared, unfired) | invite flow is `src/pages/admin/InviteManagement.tsx` |
| `khata_setup` | `khata_entry_created` (declared, unfired) | |
| `customer_activated` | — | derived, not an event — see [`activation-definition.md`](./activation-definition.md) |
| `content_published` | — | nothing logs a publish; see [`attribution-today.md`](./attribution-today.md) |

## 6. Known rough edges

- `apps/crm/server/routes/billing.js:51` defines a **local** `serverTrack` rather than importing `lib/posthog.js`. Two wrappers, one event stream. Worth collapsing, but it does not change any number today.
- Billing events use the tenant id as `distinctId` while product events use a user id. Joining revenue to a signup funnel in PostHog needs the tenant id on the user's traits (it is there: `UserTraits.tenantId`), so the join is possible but manual.

> Open decision D29 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — whether PostHog stays the only backbone, or a small custom store is added later for joins PostHog cannot do. Nothing in this file assumes the second option.
