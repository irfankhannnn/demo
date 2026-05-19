# P14 — Subscription Paywall + Trial Countdown UI

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-3
> **Skill(s):** `paywall-upgrade-cro` + `email-sequence` + `codebase-analysis`
> **Estimated time:** 0.5h founder · 6h AI

## Objective
Add a sticky trial-countdown banner + Day-15 paywall modal to the CRM SPA + Razorpay checkout integration + Brevo trial-day-10/12/14 emails so trial users have a frictionless path to upgrade — and lose access on Day 15 (with safe-guarded routes still accessible).

## Why This Matters for RealEstateFlow
Without an in-product paywall, trials silently lapse. With a clear countdown + Day-15 wall + 3 well-timed reminder emails, conversion rate climbs from ~5% to 15-25% in B2B SaaS benchmarks. Pricing reads off `pricing.json` so it stays in sync with LPs.

## User Story
As a trial user on Day 12 of my 14-day free trial, I want a clear in-product banner showing "2 days left — upgrade to keep your data flowing" + an upgrade flow that takes <30 seconds via Razorpay, so I convert before losing access.

## Acceptance Criteria
- [ ] Sticky top banner in CRM SPA when `tenant.trialDaysLeft <= 7`: "X days left on your trial — Upgrade to keep your data flowing" with "Upgrade now" CTA
- [ ] At `trialDaysLeft <= 3`: banner turns red with bolder CTA "Upgrade for ₹999/month"
- [ ] At `trialDaysLeft == 0`: full-page paywall (`PaywallModal`) blocks access except `/profile`, `/billing`, `/legal/*`, `/grievance`, `/integrations/ai-employee` (status read-only)
- [ ] Paywall renders 3 tier cards (Solo/Team/Team+) — pulls from `pricing.json` — annual toggle works
- [ ] CTA per tier opens Razorpay checkout for the selected plan
- [ ] "Add AI Employee +₹7,999" toggle on top of paywall — when enabled, on successful Solo/Team/Team+ payment, also subscribes to AI Employee plan + triggers concierge flow (P11)
- [ ] On payment success, fires PostHog `subscription_started`, refetches subscription, removes paywall, redirects to last-visited route
- [ ] All copy English; price source-of-truth is `pricing.json` (no hardcoded numbers)
- [ ] Trial-day-10 / day-12 / day-14 emails fire from Brevo with deep-link to `/billing?upgrade=true`
- [ ] Trial-expired Day-3 reactivation email with "7-day extension if you upgrade in 48h" offer
- [ ] Backend route `GET /api/subscriptions/trial-status` returns `{trialDaysLeft, trialEndsAt, plan, isPaying, gracePeriodActive}`
- [ ] Server-side computes `trialDaysLeft = ceil((trialEndsAt - now) / 1day)`; clamp to 0 if negative
- [ ] Paywall doesn't show during the 7-day grace window post-payment (in case of payment-confirmation lag)
- [ ] Tests: trial signup → banner appears Day 8 → banner red Day 12 → modal blocks Day 15 → upgrade clears modal Day 15

## AI Prompt (🤖)

```
You are a senior full-stack engineer + B2B SaaS conversion-rate-optimizer. Read inputs:
- `server/routes/auth.js`
- `server/routes/billing.js` (P11 created)
- `server/subscriptionService.js` (P12 created)
- `server/middleware/validateToken.js`
- `real-estate-crm-app/src/App.tsx` (auth context, route patterns)
- `real-estate-crm-app/src/pages/**/*.tsx`
- `real-estate-crm-app/src/components/Header.tsx` (or wherever the top bar lives)
- `marketing-and-sales/launch-plan-v2/pricing.json`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (P2 output — for FAQ snippets)

Produce:

## 1. Backend route `server/routes/subscriptions.js` — `GET /api/subscriptions/trial-status`
- validateToken + extractTenantId
- Reads Subscriptions row + computes trialDaysLeft
- Returns `{trialDaysLeft, trialEndsAt, plan, isPaying, gracePeriodActive, paymentStatus}`

## 2. Frontend hook `real-estate-crm-app/src/hooks/useSubscription.ts`
- Fetches /api/subscriptions/trial-status on mount + every 5 min
- Caches in React context
- Exposes `subscription, refetch, isPaying, isTrialing, trialDaysLeft, isTrialExpired`

## 3. `real-estate-crm-app/src/components/TrialCountdownBanner.tsx`
- Reads useSubscription
- Returns null if `isPaying` OR `trialDaysLeft > 7`
- Banner styles:
  - 7 ≥ days > 3: yellow background, neutral copy
  - 3 ≥ days > 0: red background, bold copy, "Upgrade for ₹{Solo.price}/month"
  - days == 0: don't render banner; PaywallModal handles
- "Upgrade now" → opens PaywallModal

## 4. `real-estate-crm-app/src/components/PaywallModal.tsx`
- Reads useSubscription
- Renders if `isTrialExpired && !isPaying && !gracePeriodActive`
- Modal blocks all routes EXCEPT (whitelist):
  - `/profile`
  - `/billing` (so they can see invoices)
  - `/legal/*`
  - `/grievance`
  - `/integrations/ai-employee` (read-only status)
  - `/auth/logout`
- Modal content:
  - Header: "Your trial has ended — pick a plan to continue"
  - Annual/Monthly toggle (default Monthly)
  - 3 tier cards from pricing.json (Solo/Team/Team+) — each with bullet features + CTA "Choose Solo / Team / Team+"
  - "Add AI Employee — ₹7,999/mo" toggle row above the 3 cards (with "Concierge setup, 24h SLA" badge)
  - Footer: "Need help? WhatsApp us" CTA + "What happens to my data if I don't upgrade?" expandable FAQ
- CTA click: Razorpay Checkout opens
  - On success: refetch subscription, close modal, navigate to previously-attempted route
  - On AI Employee toggle ON: chain a second Razorpay subscription for `ai_employee_addon` plan after main plan succeeds; on success, redirect to `/integrations/ai-employee` (concierge status page from P11)

## 5. Razorpay Checkout helper `real-estate-crm-app/src/lib/razorpay.ts`
- Loads Razorpay JS dynamically
- `openCheckout({planId, name, email, prefill, onSuccess, onFailure, onDismiss})` — wraps Razorpay subscription checkout
- Reads keys from `import.meta.env.VITE_RAZORPAY_KEY_ID`

## 6. Mount in `App.tsx`
- Render `<TrialCountdownBanner />` at top of authenticated layout
- Render `<PaywallModal />` at root, gated by route whitelist

## 7. Brevo trial reminder emails
Output `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md` with copy for:
- **trial-day-10** (T+10 from signup) — "4 days to go — here's what your team built so far" — usage stats interpolated, soft pitch + Solo plan link
- **trial-day-12** (T+12) — "2 days left — pick a plan to keep going" — 3-tier comparison + 1-month-refund reminder + Cal.com link "still deciding? talk to founder"
- **trial-day-14** (T+14) — "Your trial ends tomorrow — last chance for ₹999" — urgency tone, 3 tiers, annual-discount mention
- **trial-expired-day-3** (T+17 / Day 3 of expiry) — "Did we miss something? 7 days extra if you upgrade today" — reactivation + 7-day extension offer + founder direct WhatsApp

Each email has: subject line (≤50 chars), preheader (≤90), body markdown, CTA URL, expected open rate target (35-50% for trial cohort).

## 8. Backend cron `server/scripts/trial-reminder-cron.js` + `cron/trial-reminder.yaml`
- Daily 09:00 IST: queries Subscriptions where `isTrialing && trialEndsAt - now between 4d and 4d+24h` → sends day-10 email
- Same for day-12 (2d window) and day-14 (0-24h window)
- Day-3-expiry: queries `isTrialExpired && now - trialEndsAt between 3d and 3d+24h && !isPaying`
- Idempotent: stores `last_email_sent` per user

## 9. Tests `tests/paywall.spec.ts`
- Mock subscription state to `trialDaysLeft = 8` → assert banner not shown
- Mock to 7 → banner yellow shows
- Mock to 3 → banner red
- Mock to 0 → modal renders + blocks navigation to `/crm` but allows `/billing`
- Mock Razorpay payment success → modal closes + subscription refetch shows isPaying=true

## 10. Update `pricing.json`
After Razorpay plan IDs from P7 are captured, add:
```json
"razorpayPlanIds": {
  "solo_monthly": "plan_XXX",
  "solo_annual": "plan_XXX",
  "team_monthly": "plan_XXX",
  "team_annual": "plan_XXX",
  "teamplus_monthly": "plan_XXX",
  "teamplus_annual": "plan_XXX",
  "add_seat": "plan_XXX",
  "ai_employee_addon": "plan_XXX"
}
```
(Update the JSON; AI prompt should generate the patch but founder commits the live IDs.)

Stop here. Do not deploy. Do not run real Razorpay payments.
```

## Manual Steps (🧍)

1. **Capture live Razorpay plan IDs** (after P7 created plans in live mode) into `pricing.json.razorpayPlanIds`.
2. **Add Brevo template IDs** to env vars + create the 4 templates in Brevo dashboard from `trial-emails.md` content.
3. **Add env vars**: `VITE_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `BREVO_TRIAL_DAY10_TEMPLATE_ID`, etc.
4. **Deploy** SPA + cron Lambda. Run `tests/paywall.spec.ts`.
5. **End-to-end smoke**: register a test trial user with `trialEndsAt = now + 4d`, log in, see yellow banner. Manually advance trialEndsAt to `now`, refresh, see modal blocking `/crm/buyers` but allowing `/profile`. Click upgrade Solo, complete test-mode Razorpay payment, modal closes, redirected to /crm/buyers.
6. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- `pricing.json`
- `server/subscriptionService.js` (P12)
- React component patterns
- Razorpay test/live keys (P7)
- Brevo API key

## Outputs
- `server/routes/subscriptions.js`
- `real-estate-crm-app/src/hooks/useSubscription.ts`
- `real-estate-crm-app/src/components/TrialCountdownBanner.tsx`
- `real-estate-crm-app/src/components/PaywallModal.tsx`
- `real-estate-crm-app/src/lib/razorpay.ts`
- `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md`
- `server/scripts/trial-reminder-cron.js` + `cron/trial-reminder.yaml`
- `tests/paywall.spec.ts`
- Updated `pricing.json`

## Success Criterion
Trial cohort sees banner at correct days; modal blocks at Day 15; Razorpay flow completes E2E; 4 Brevo emails fire on schedule.

## Fallback / Plan B
If Razorpay subscription checkout integration is finicky, fall back to "Hosted Payment Page" + manual webhook reconciliation. If Brevo trial emails fail, send via SES with raw HTML.

## Risks
| Risk | Mitigation |
|---|---|
| Modal blocks legitimate user mid-task | Whitelist routes for billing + legal + profile |
| Trial dates timezone bug | Server-side compute in UTC; SPA reads server value |
| Race: payment succeeds but webhook delayed | gracePeriodActive flag for 7 days post-`subscription_started` |
| Email day-12 sent on day-13 due to cron lag | Tolerance window 0-24h per email; idempotency log |
| Annual discount math wrong | Pull from pricing.json `annualDiscount.rate` |

## India / Mumbai-Specific Notes
- All prices in INR
- Razorpay supports UPI, card, netbanking, wallet (Indian preference: UPI dominant)
- Annual discount messaging: "Save ₹{annualSaving}/year" calculated from pricing.json

## Dependencies
- **Blocks:** Day 22 CRO (paywall A/B variants), Day 26 trial-to-paid follow-up
- **Depends on:** P7 (Razorpay live + plan IDs), P11 (webhook handler), P12 (subscription service)

## Connected Skills
- `paywall-upgrade-cro` — modal copy + UX
- `email-sequence` — 4 trial emails
- `codebase-analysis` — backend route + cron
- `pr-review` — review before merge
