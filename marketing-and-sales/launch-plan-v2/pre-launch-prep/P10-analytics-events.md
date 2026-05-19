# P10 — Analytics Events (PostHog + GA4 + Meta Pixel + LinkedIn Tag + Sentry)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-8 (spec) → T-5 (PRs) → Day 4 (final wire-up + Playwright assertion)
> **Skill(s):** `analytics-tracking` + `codebase-analysis`
> **Estimated time:** 1h founder · 12h AI total across the multi-day window

## Objective
Wire a complete typed-event analytics layer covering all 5 LPs + the CRM SPA + the Lambda backend, fired into PostHog (primary funnel) + GA4 (Google ad conversions) + Meta Pixel (Meta ad conversions) + LinkedIn Insight Tag (LI ad conversions) + Sentry (errors), all gated by a cookie consent banner that blocks non-essential trackers until consent.

## Why This Matters for RealEstateFlow
By Day 21 we need to see the full funnel from cold email click → LP page-view → form submit → signup → activation → paid → AI-Employee-connected → activation. Without typed events firing into a single PostHog project, we are blind. Cookie consent is DPDP requirement (P1).

## User Story
As a founder reading the Day-21 metrics review, I want every conversion-critical action across LPs/SPA/server to be a typed event in PostHog with full identity tracking post-login, so I can see drop-off points and decide which fixes ship in Week-4 CRO.

## Acceptance Criteria
- [ ] PostHog project created + project API key in env vars
- [ ] `posthog-js` added to `real-estate-crm-app/package.json`; initialised in `src/main.tsx`; identifies user post-login in `App.tsx initAuth` with `posthog.identify(userId, {tenantId, role, plan, trialEndsAt, agencyName})`
- [ ] PostHog snippet added to `<head>` of all 5 LPs (currently has placeholder GA4/Pixel/Hotjar — extend, don't replace)
- [ ] Cookie consent banner blocks PostHog/GA4/Pixel/LinkedIn/Hotjar until consent; only essential cookies pre-allowed (auth, CSRF)
- [ ] All events listed in §"Event catalogue" below fire correctly
- [ ] Server-side PostHog SDK installed in `server/lambda-handler.js` for server events
- [ ] Sentry DSN configured for SPA + server (separate DSNs)
- [ ] GA4 conversion events: `signup_completed`, `subscription_started`
- [ ] Meta Pixel conversion events: `Lead` (form_submit), `Subscribe` (signup_completed), `Purchase` (subscription_started)
- [ ] LinkedIn Insight Tag conversion events: `signup_completed`, `subscription_started`
- [ ] Playwright test `tests/analytics.spec.ts` walks the funnel + asserts every event landed in PostHog Live events feed (use PostHog API to verify)
- [ ] Activation event = `ai_employee_lead_handled` ≥1 within 7d of `subscription_started`
- [ ] Spec written at `marketing-and-sales/launch-implement/pre-launch/10-analytics/analytics-spec.md`
- [ ] Funnel saved in PostHog with the 8 ordered steps (page_view → cta_click → form_submit → signup_completed → agency_registered → subscription_started → ai_employee_connected → activation)

## Event catalogue

### LP events (snippet in 5 LPs)
| Event | Properties | Firing condition |
|---|---|---|
| `page_view` | path, referrer, utm_*, device, viewport | every LP load |
| `cta_click` | cta_id, cta_label, page, position | any button with `data-cta-id` |
| `form_submit` | form_name (`lead-capture` / `demo` / `agency` / `agent` / `ai-employee` / `grievance`) | form submit success |
| `pricing_toggle_annual` | from_billing, to_billing | toggle clicked |
| `faq_open` | faq_question, page | accordion expanded |
| `video_play` | video_id, page, position | first 1s of video |
| `whatsapp_click` | source_section, page | wa.me link clicked |
| `calendly_open` | source_section, page | Cal.com modal opened |
| `calendly_booked` | event_type, attendee_email | Cal.com webhook → server-forwarded |

### CRM SPA events
| Event | Properties | Firing condition |
|---|---|---|
| `signup_started` | source (utm_source) | landed on signup with utm |
| `signup_completed` | userId, tenantId, role | `POST /auth/register` 200 |
| `otp_verified` | phone, attempts | OTP success |
| `onboarding_role_selected` | role | role-picker submit |
| `agency_registered` | agencyId, plan_intent | agency creation success |
| `invite_accepted` | invitedBy, role | invite-accept link clicked + auth |
| `buyer_added` | source (form/import/api) | first-success |
| `owner_added` | same | first-success |
| `property_added` | locality, type | first-success |
| `lead_added` | leadType, source | first-success |
| `lead_converted` | leadId, daysToConvert | status → converted |
| `khata_entry_created` | type (paid/pending), amount | first-success |
| `khata_settled` | settlementId, totalAmount | first-success |
| `meeting_scheduled` | source (calendar/lead) | first-success |
| `whatsapp_share_clicked` | entity_type, entity_id | "Share on WhatsApp" buttons |
| `feature_first_use` | feature_name | each feature first-time-used (set via flag in localStorage) |
| `trial_paywall_shown` | days_left, tier_eligible | banner/modal render |
| `trial_paywall_clicked` | days_left, target_tier | upgrade CTA click |
| `subscription_started` | tier, billing_cycle, amount, planId | Razorpay webhook → server → SPA |
| `subscription_cancelled` | tier, reason | cancellation form submit |
| `ai_employee_connected` | tenantId, status | AI Employee status flips to `live` |
| `ai_employee_lead_handled` | tenantId, leadId, conversation_length | server-side, AI Employee end-to-end qualified |
| `nps_response` | score, reason | NPS modal submit |
| `paywall_seat_limit_hit` | seats_paid, seats_attempted | invite at cap |

### Server events (PostHog Node SDK in Lambda)
| Event | Trigger |
|---|---|
| `razorpay_payment_succeeded` | Razorpay webhook `payment.captured` |
| `razorpay_payment_failed` | Razorpay webhook `payment.failed` |
| `subscription_invoiced` | Razorpay webhook `subscription.charged` (invoice generated) |
| `subscription_paid` | Razorpay webhook `subscription.charged` after payment_captured = true |
| `ai_employee_provisioned` | OpenClaw concierge SOP step 10 (status flips to `live`) |
| `grievance_received` | `POST /api/grievance` success |
| `seat_added` | Razorpay webhook `subscription.updated` with seat increment |

## AI Prompt (🤖)

```
You are a senior full-stack engineer specialised in product analytics. Read these inputs:
- `real-estate-crm-app/src/App.tsx` (existing routes + initAuth logic)
- `real-estate-crm-app/src/main.tsx` (entry point)
- `real-estate-crm-app/src/pages/**/*.tsx` (enumerate user actions)
- `server/routes/*.js` (server actions)
- `server/lambda-handler.js` (Lambda entry)
- `creative/landing-pages/main/index.html` (existing analytics placeholders)
- `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md` (this file — for the event catalogue)

Produce these outputs:

## 1. `marketing-and-sales/launch-implement/pre-launch/10-analytics/analytics-spec.md`
Complete event spec extending the catalogue in this file. For each event:
- Name (exact string)
- Where it fires (file path + line)
- Properties (typed)
- Mapping to GA4 conversion event (if any)
- Mapping to Meta Pixel standard event (if any)
- Mapping to LinkedIn conversion (if any)
- Description (1 line)

## 2. PR draft 1: `real-estate-crm-app/src/lib/analytics.ts`
TypeScript module exporting:
- `initAnalytics(userId?: string, traits?: object)` — call from main.tsx + initAuth
- `trackEvent(name: string, properties?: object)` — wraps PostHog + GA4 + Pixel + LinkedIn calls
- `setIdentity(userId, traits)` — post-login
- `reset()` — on logout
- Cookie-consent gate: reads from `localStorage.cookieConsent`; if not granted, only runs PostHog with `disable_session_recording: true` and skips GA4/Pixel/LinkedIn entirely
- Type definitions for every event in the catalogue

## 3. PR draft 2: `real-estate-crm-app/src/components/CookieConsentBanner.tsx`
Tailwind banner:
- First visit: shows at bottom of screen with "Accept all" / "Customize" / "Reject non-essential" buttons
- Customize: 4 toggles (essential locked-on, functional, analytics, marketing)
- Stores choice in `localStorage.cookieConsent = {essential: true, functional: bool, analytics: bool, marketing: bool, version: 1, timestamp}`
- Re-prompts if version increments
- Accessible (ARIA, keyboard nav)
- Mobile-friendly (sticky bottom)

## 4. PR draft 3: instrumentation across CRM pages
For each page listed in the catalogue, add a `trackEvent(...)` call at the firing condition. Examples:
- `src/pages/auth/Signup.tsx` form-submit-success → `trackEvent('signup_completed', {userId, tenantId, role})`
- `src/pages/onboarding/RolePicker.tsx` submit → `trackEvent('onboarding_role_selected', {role})`
- `src/pages/crm/buyers/AddBuyer.tsx` create-success → first-time-only via localStorage flag → `trackEvent('buyer_added', {source})`
- ... (do this for ALL events in the catalogue)

## 5. PR draft 4: server-side PostHog
- `server/lib/posthog.js` — wrapper around `posthog-node`
- Initialise in `server/lambda-handler.js`
- Add to webhook handler in `server/routes/billing.js` (P11 will create this) for the 7 server events
- Add to `server/routes/grievance.js` (P9 created this) for `grievance_received`

## 6. PR draft 5: LP snippet
Edit each of the 5 LP `index.html` files (P15 will rewrite them; for now, prepare the snippet to inject into `<head>`):
- PostHog JS snippet (gated by cookie consent — wrap init in a function only fired post-consent)
- GA4 gtag.js (gated)
- Meta Pixel base code (gated)
- LinkedIn Insight Tag (gated)
- Hotjar (gated, already exists in placeholders)
Output: `marketing-and-sales/launch-implement/pre-launch/10-analytics/lp-head-snippet.html`

## 7. `tests/analytics.spec.ts` — Playwright
Test scenarios:
- Visit `/`, accept cookies, click pricing card CTA → assert `cta_click` and `pricing_toggle_annual` events fire (verify via PostHog Capture API mock OR PostHog Live events feed query)
- Sign up a test user (call `/auth/register`) → assert `signup_completed` fires with correct properties
- Add a buyer in CRM → assert `buyer_added` fires once + does NOT fire again on second buyer
- Decline cookies → assert PostHog `disable_session_recording=true` + GA4/Pixel/LinkedIn snippets NOT loaded

## 8. PostHog dashboard config
Output `marketing-and-sales/launch-implement/pre-launch/10-analytics/posthog-dashboard.md` with:
- Funnel "Mumbai launch funnel": 8 ordered events
- Insights: weekly trial signups, activation rate, LP page-view → form-submit conversion, paywall_shown → subscription_started conversion
- Cohorts: "Mumbai trial users" (utm_city=Mumbai), "AI Employee adopters", "Activated users"
- Alerts: signup_completed weekly drop >30%, error rate spike (forwarded from Sentry)

## 9. `marketing-and-sales/launch-implement/pre-launch/10-analytics/setup-checklist.md`
Step-by-step founder checklist:
1. Create PostHog project at posthog.com → copy API key + Project ID
2. Create GA4 property → copy Measurement ID
3. Create Meta Business Manager Pixel → copy Pixel ID + Conversion API access token
4. Create LinkedIn Insight Tag → copy Partner ID + Conversion IDs
5. Create Sentry projects (SPA + server) → copy 2 DSNs
6. Add all to `.env` (founder) and Lambda env vars
7. Run `npm run build` + deploy
8. Run `tests/analytics.spec.ts`
9. Verify Live Events in PostHog show all funnel events for 1 test user
10. Configure GA4 + Meta + LinkedIn conversion events from event catalogue
11. Save funnel + insights in PostHog

Stop here. Do not deploy or sign up for vendors (manual). Do not execute the LP edits to deploy (that's P15).
```

## Manual Steps (🧍)

1. Sign up for PostHog (`https://posthog.com/signup`), GA4 (`https://analytics.google.com`), Meta Business Manager Pixel, LinkedIn Insight Tag, Sentry (2 projects). Capture all IDs in `setup-checklist.md`.
2. Add env vars to `.env` (SPA) and Lambda config:
   - `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
   - `VITE_GA4_MEASUREMENT_ID`
   - `VITE_META_PIXEL_ID`
   - `VITE_LINKEDIN_PARTNER_ID`
   - `VITE_SENTRY_DSN_SPA`
   - `SENTRY_DSN_SERVER`
   - `POSTHOG_KEY_SERVER`
3. After AI prompt completes + PRs merge: deploy SPA + Lambda. Run `tests/analytics.spec.ts`. Confirm 100% pass.
4. Open PostHog Live Events feed in a browser; trigger events from incognito; confirm landing.
5. Configure conversion events in GA4 / Meta / LinkedIn dashboards using the event names.
6. Save the funnel + insights in PostHog per the dashboard config md.
7. Tick ACs + log to `00-DECISIONS-LOG.md`.

## Inputs
- All vendor accounts (PostHog, GA4, Meta, LinkedIn, Sentry)
- SPA + server source
- Cookie consent banner spec
- Master event catalogue (above)

## Outputs
- `real-estate-crm-app/src/lib/analytics.ts`
- `real-estate-crm-app/src/components/CookieConsentBanner.tsx`
- `server/lib/posthog.js`
- `tests/analytics.spec.ts`
- `marketing-and-sales/launch-implement/pre-launch/10-analytics/{analytics-spec.md, lp-head-snippet.html, posthog-dashboard.md, setup-checklist.md}`
- Instrumentation calls inserted across all CRM page files

## Success Criterion
Playwright test green; PostHog Live Events shows all 8 funnel events for a single test session; cookie banner blocks GA4/Pixel/LinkedIn until consent.

## Fallback / Plan B
If PostHog is overkill for M1, downgrade to PostHog free tier (1M events/mo) — sufficient for M1. If GA4 setup is delayed, ship PostHog + Pixel only on Day 4 and add GA4 by Day 7.

## Risks
| Risk | Mitigation |
|---|---|
| Events double-fire | First-time-only flag via localStorage for `_added` events; idempotency check |
| PII in event properties | Schema enforces no email/phone in standard events; PostHog has $set-once for traits |
| Cookie banner reduces conversion | "Accept all" prominent + reject is one-click; no dark patterns |
| Sentry quota exceeded | Set sample rate 0.1 for transactions, 1.0 for errors |
| LinkedIn Tag double-counts | Use deduplication by event_id |

## India / Mumbai-Specific Notes
- DPDP Act consent UX: explicit opt-in for non-essential trackers
- PostHog EU region used (data residency disclosure in P1 Privacy)
- All PII (email, phone, GSTIN) marked `set_once: true` so PostHog doesn't replicate it across events

## Dependencies
- **Blocks:** Day 21 metrics review (needs all events in PostHog), Day 22 CRO (funnel analysis), Day 28 NPS, Day 29 revenue audit
- **Depends on:** P9 (grievance event), P11 (subscription webhooks)

## Connected Skills
- `analytics-tracking` — spec + cookie banner + LP snippet
- `codebase-analysis` — instrumentation across SPA pages + server
- `pr-review` — review the 5 PRs before merge
- `funnel-analysis` — used Day 22 once events flow
