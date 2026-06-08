# P10 — Analytics Events (PostHog + GA4 + Meta Pixel + LinkedIn Tag + Sentry)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-8 (spec) → T-5 (PRs) → Day 4 (final wire-up + Playwright assertion)
> **Skill(s):** `analytics-tracking` + `codebase-analysis`
> **Estimated time:** 1h founder · 12h AI total across the multi-day window

## Architecture: Two Surfaces, One PostHog Bridge

**CRITICAL — read before implementing:**

There are two completely separate deployments:
- **`realestateflow.in`** (Landing Pages) — `creative/landing-pages/` — static HTML, deployed to Netlify
- **`app.realestateflow.in`** (CRM SPA) — `real-estate-crm-app/` — React/Vite SPA, deployed separately

Analytics placement follows strict ownership:

| Tracker | LP (`realestateflow.in`) | CRM (`app.realestateflow.in`) | Server (Lambda) |
|---|---|---|---|
| **PostHog** | ✅ Anonymous session tracking | ✅ Identified post-login (`posthog.identify`) | ✅ Server events via Node SDK |
| **GA4** | ✅ Marketing funnel (LP only) | ❌ Never on authenticated CRM pages | ❌ |
| **Meta Pixel** | ✅ Ad conversion tracking (LP only) | ❌ Never on authenticated CRM pages | ❌ |
| **LinkedIn Insight Tag** | ✅ Ad conversion tracking (LP only) | ❌ Never on authenticated CRM pages | ❌ |
| **Hotjar** | ✅ Session recordings of anonymous visitors | ❌ Never on authenticated CRM pages | ❌ |
| **Sentry** | ❌ Not needed on static HTML LP | ✅ Error tracking in SPA | ✅ Error tracking in Lambda |

**PostHog is the only cross-domain bridge.** On the LP, PostHog runs in anonymous mode. When the user completes signup on `app.realestateflow.in`, `posthog.identify(userId, traits)` is called — PostHog stitches the anonymous LP session to the CRM user session, giving the full funnel `page_view → cta_click → form_submit → signup_completed → activation` in one project.

**GA4/Pixel/LinkedIn on LP only — rationale:** These trackers serve ad platforms and measure marketing funnel performance. Authenticated CRM pages are product pages — putting ad-platform pixels on them violates user privacy expectations, pollutes marketing data with product-usage sessions, and adds no ad-platform value (you can't retarget authenticated paying customers with acquisition ads meaningfully).

## Objective
Wire a complete typed-event analytics layer covering:
1. **LP analytics snippet** (in `creative/landing-pages/_partials/head.hbs`) — PostHog + GA4 + Pixel + LinkedIn + Hotjar, all gated by cookie consent
2. **CRM analytics module** (`real-estate-crm-app/src/lib/analytics.ts`) — PostHog ONLY, with `posthog.identify()` post-login
3. **Server PostHog SDK** (`server/lib/posthog.js`) — server-side events for payments, grievances, provisioning
4. **Sentry** — SPA (`src/main.tsx`) + Server (`server/lambda-handler.js`) only

## Why This Matters for RealEstateFlow
By Day 21 we need to see the full funnel from cold email click → LP page-view → form submit → signup → activation → paid → AI-Employee-connected. Without typed PostHog events stitched cross-domain, we are blind. Cookie consent is DPDP requirement (P1).

## User Story
As a founder reading the Day-21 metrics review, I want every conversion-critical action across LPs/SPA/server to be a typed event in PostHog with full identity tracking post-login, so I can see drop-off points and decide which fixes ship in Week-4 CRO.

## Acceptance Criteria

### LP Surface (`realestateflow.in` — `creative/landing-pages/`)
- [ ] PostHog snippet in `_partials/head.hbs` — anonymous tracking, gated by cookie consent (`analytics` toggle)
- [ ] GA4 gtag.js in `_partials/head.hbs` — gated by cookie consent (`analytics` toggle); IDs from build-time env `{{GA4_ID}}`
- [ ] Meta Pixel in `_partials/head.hbs` — gated by cookie consent (`marketing` toggle); IDs from `{{META_PIXEL_ID}}`
- [ ] LinkedIn Insight Tag in `_partials/head.hbs` — gated by cookie consent (`marketing` toggle); ID from `{{LINKEDIN_PARTNER_ID}}`
- [ ] Hotjar in `_partials/head.hbs` — gated by cookie consent (`functional` toggle); ID from `{{HOTJAR_ID}}`
- [ ] Cookie consent banner controls all 5 LP trackers via `cookie-consent-analytics`, `cookie-consent-marketing`, `cookie-consent-functional` custom events
- [ ] LP build env vars documented in `creative/landing-pages/.env.example`: `GA4_ID`, `META_PIXEL_ID`, `LINKEDIN_PARTNER_ID`, `HOTJAR_ID`, `POSTHOG_KEY`

### CRM SPA Surface (`app.realestateflow.in` — `real-estate-crm-app/`)
- [ ] `posthog-js` added to `real-estate-crm-app/package.json`; initialised in `src/main.tsx`
- [ ] `posthog.identify(userId, {tenantId, role, plan, trialEndsAt, agencyName})` called in `App.tsx initAuth` post-login
- [ ] **GA4, Meta Pixel, LinkedIn Insight Tag, Hotjar are NOT present in the CRM SPA** — zero script tags for these in `index.html` or `main.tsx`
- [ ] Sentry DSN configured for SPA (`src/main.tsx`); `VITE_SENTRY_DSN` env var
- [ ] `CookieConsentBanner.tsx` in CRM **only gates PostHog session recording** — no GA4/Pixel/LinkedIn toggles (they are not loaded)
- [ ] All CRM events listed in §"CRM SPA events" catalogue below fire via `analytics.ts`
- [ ] `analytics.ts` exposes: `initAnalytics()`, `trackEvent(name, props)`, `identifyUser(userId, traits)`, `resetAnalytics()`
- [ ] SPA env vars: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`

### Server Surface (Lambda)
- [ ] PostHog Node SDK in `server/lib/posthog.js` for server-side events
- [ ] Sentry DSN configured in `server/lambda-handler.js`; `SENTRY_DSN_SERVER` env var
- [ ] 7 server events wired (billing webhook, grievance, provisioning — see catalogue)

### Cross-Domain Attribution (PostHog bridge)
- [ ] LP primary "Start trial" CTA links: `https://app.realestateflow.in/signup?utm_source=lp-{page}&utm_campaign=launch&utm_medium=cta`
- [ ] CRM `/signup` (phone-login) reads `utm_source`, `utm_campaign`, `utm_medium` from URL params on mount → passes to `signup_started` PostHog event as properties
- [ ] PostHog `posthog.identify(userId, {utm_source, ...})` on signup completion links anonymous LP session to CRM user session
- [ ] Activation event = `ai_employee_lead_handled` ≥1 within 7d of `subscription_started`

### Verification
- [ ] Spec written at `marketing-and-sales/launch-implement/pre-launch/10-analytics/analytics-spec.md`
- [ ] Funnel saved in PostHog: 8 ordered steps (page_view → cta_click → form_submit → signup_completed → agency_registered → subscription_started → ai_employee_connected → activation)
- [ ] Playwright test `tests/analytics.spec.ts` verifies events on both surfaces
- [ ] GA4 conversion events configured (founder-side, in GA4 dashboard): `signup_completed`, `subscription_started` — fired via LP PostHog → GA4 forwarding OR direct gtag call on LP
- [ ] Meta Pixel conversion events configured (founder-side): `Lead` on LP form submit, `Subscribe` on signup, `Purchase` on subscription_started — LP-only
- [ ] LinkedIn conversion events (founder-side): `signup_completed`, `subscription_started` — LP-only

## Event catalogue

### LP events (vanilla JS snippet in `_partials/head.hbs` — NOT React)
> These fire via inline JavaScript in the LP HTML. PostHog, GA4 `gtag()`, Meta Pixel `fbq()`, and LinkedIn `lintrk()` are all called from the same snippet after consent is granted.
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
You are a senior full-stack engineer specialised in product analytics. 

ARCHITECTURE RULE (enforce strictly):
- LP (`realestateflow.in`) analytics = PostHog + GA4 + Meta Pixel + LinkedIn + Hotjar — ALL in LP vanilla JS snippet only
- CRM SPA (`app.realestateflow.in`) analytics = PostHog ONLY — no GA4, no Pixel, no LinkedIn, no Hotjar in the CRM
- Sentry = CRM SPA + Server Lambda only — not on LP
- PostHog is the cross-domain bridge: anonymous on LP → identified post-login in CRM

Read these inputs:
- `real-estate-crm-app/src/App.tsx` (existing routes + initAuth logic)
- `real-estate-crm-app/src/main.tsx` (entry point)
- `real-estate-crm-app/src/pages/**/*.tsx` (enumerate user actions)
- `server/routes/*.js` (server actions)
- `server/lambda-handler.js` (Lambda entry)
- `creative/landing-pages/main/index.html` (existing analytics placeholders to replace)
- `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md` (this file — event catalogue)

Produce these outputs:

## 1. `marketing-and-sales/launch-implement/pre-launch/10-analytics/analytics-spec.md`
Complete event spec. For each event:
- Name (exact string)
- Surface (LP vanilla JS / CRM React / Server Node)
- Where it fires (file path)
- Properties (typed, no PII in event payload — PII goes only to `posthog.identify`)
- Mapping to GA4 conversion event (LP events only — not CRM)
- Mapping to Meta Pixel standard event (LP events only — not CRM)
- Mapping to LinkedIn conversion (LP events only — not CRM)
- Description (1 line)

## 2. `real-estate-crm-app/src/lib/analytics.ts` — CRM analytics module (PostHog ONLY)
TypeScript module exporting:
- `initAnalytics()` — call from `main.tsx`; initialise PostHog; reads `localStorage.cookieConsent.analytics` to determine session-recording mode
- `trackEvent(name: EventName, properties?: object)` — calls `posthog.capture(name, properties)` only; NO GA4/Pixel/LinkedIn calls here
- `identifyUser(userId: string, traits: UserTraits)` — `posthog.identify(userId, {...traits, utm_source: sessionStorage.utm_source})` — cross-domain bridge
- `resetAnalytics()` — `posthog.reset()` on logout
- `EventName` typed union covering all CRM SPA events in the catalogue
- Cookie-consent gate: if `localStorage.cookieConsent.analytics === false`, run PostHog with `disable_session_recording: true` only

## 3. `real-estate-crm-app/src/components/CookieConsentBanner.tsx` — CRM version (PostHog gate only)
Tailwind banner:
- First visit: shows at bottom with "Accept all" / "Reject non-essential" / "Customize"
- Customize: only 2 meaningful toggles: Essential (locked) + Analytics ("We measure product usage via PostHog — no ads")
- NO Marketing toggle in CRM (GA4/Pixel/LinkedIn are not loaded in the CRM)
- Stores: `localStorage.cookieConsent = {essential: true, analytics: bool, version: 1, timestamp}`
- On Accept: PostHog full mode (session recording enabled)
- On Reject: PostHog `disable_session_recording: true`
- ARIA, keyboard nav, mobile-friendly sticky bottom

## 4. CRM SPA instrumentation — `trackEvent()` calls across pages
For each page in the CRM SPA events catalogue, add `trackEvent(...)` at the firing condition:
- `src/pages/PhoneLogin.tsx` → `trackEvent('signup_started', {utm_source: readFromSessionStorage()})` on first mount if coming from LP
- `src/pages/RoleSelection.tsx` → `trackEvent('onboarding_role_selected', {role})`
- `src/pages/RegisterAdmin.tsx` → `trackEvent('agency_registered', {agencyId, plan_intent})`
- `src/pages/crm/BuyerList.tsx` (add buyer success) → first-time-only via localStorage → `trackEvent('buyer_added', {source})`
- `src/pages/crm/PropertyList.tsx` → `trackEvent('property_added', {locality, type})`
- `src/pages/crm/LeadList.tsx` → `trackEvent('lead_added', {leadType, source})`
- `src/pages/crm/KhataBook.tsx` → `trackEvent('khata_entry_created', {type, amount})`
- ... (all events in CRM SPA catalogue — use PostHog `trackEvent` only)
- On all `PaywallModal` render → `trackEvent('trial_paywall_shown', {days_left, tier_eligible})`
- On upgrade CTA click in `PaywallModal` → `trackEvent('trial_paywall_clicked', {days_left, target_tier})`
- On Razorpay success callback → `trackEvent('subscription_started', {tier, billing_cycle, amount})`

## 5. UTM parameter capture for cross-domain attribution
In `real-estate-crm-app/src/pages/PhoneLogin.tsx` (the CRM signup entry):
- On mount: read `utm_source`, `utm_campaign`, `utm_medium` from URL search params
- Store in `sessionStorage` (survives page refresh; cleared on tab close)
- Pass to `signup_started` event as properties
- Pass to `identifyUser(userId, {utm_source, utm_campaign, utm_medium})` after signup completes

## 6. `server/lib/posthog.js` — Server-side PostHog
- Wrapper around `posthog-node`
- `serverTrack(distinctId, event, properties)` — called from billing webhook, grievance route
- Initialise in `server/lambda-handler.js`
- Add to `server/routes/billing.js` (P11) for the 7 server payment/subscription events
- Add to `server/routes/grievance.js` (P9) for `grievance_received`

## 7. `creative/landing-pages/_partials/head-analytics.hbs` — LP analytics snippet
Produces the `<head>` snippet to include in ALL LP pages. The snippet:
- PostHog JS (gated by `cookie-consent-analytics` custom event)
- GA4 gtag.js (gated by `cookie-consent-analytics`)
- Meta Pixel base code (gated by `cookie-consent-marketing`)
- LinkedIn Insight Tag (gated by `cookie-consent-marketing`)
- Hotjar snippet (gated by `cookie-consent-functional`)
- LP-specific PostHog events: `page_view`, `cta_click`, `form_submit`, `pricing_toggle_annual`, `faq_open`, `video_play`, `whatsapp_click`, `calendly_open`
  → These fire PostHog AND the corresponding GA4 event AND Meta Pixel standard event simultaneously
- All IDs from build-time env vars: `{{GA4_ID}}`, `{{META_PIXEL_ID}}`, `{{LINKEDIN_PARTNER_ID}}`, `{{HOTJAR_ID}}`, `{{POSTHOG_KEY}}`
- Output also at: `marketing-and-sales/launch-implement/pre-launch/10-analytics/lp-head-analytics.html` (for review before build)

## 8. `creative/landing-pages/.env.example` — LP build env vars
```
POSTHOG_KEY=phc_...
GA4_ID=G-XXXXXXXXXX
META_PIXEL_ID=1234567890
LINKEDIN_PARTNER_ID=XXXX
HOTJAR_ID=XXXXXXX
HOTJAR_SV=6
```

## 9. `tests/analytics.spec.ts` — Playwright
Two test groups:
### LP tests (visit static HTML)
- Visit LP `/`, accept cookies → assert PostHog + GA4 + Pixel + LinkedIn + Hotjar snippets loaded (network intercept)
- Visit LP `/`, reject cookies → assert only PostHog loaded (in restricted mode); assert GA4/Pixel/LinkedIn/Hotjar NOT loaded
- Click primary CTA → assert network call to PostHog with event `cta_click` fired

### CRM tests (authenticated SPA)
- Sign up a test user → assert `signup_started` + `signup_completed` PostHog events fire; assert NO GA4/Pixel/LinkedIn calls in network
- Add a buyer → assert `buyer_added` fires once; second buyer does NOT re-fire
- `trial_paywall_shown` → assert PostHog event fires; assert NO Pixel/GA4 calls
- Reject CRM cookies → assert PostHog has `disable_session_recording: true`; assert no other tracking

## 10. `marketing-and-sales/launch-implement/pre-launch/10-analytics/posthog-dashboard.md`
PostHog dashboard configuration:
- Funnel "Mumbai launch funnel": 8 ordered events (page_view → cta_click → form_submit → signup_completed → agency_registered → subscription_started → ai_employee_connected → activation)
- Insights: weekly trial signups, activation rate, LP page-view → form-submit conversion
- Cohorts: "Mumbai trial users" (utm_source contains "lp-"), "AI Employee adopters", "Activated users"
- Alerts: signup_completed weekly drop >30%

## 11. `marketing-and-sales/launch-implement/pre-launch/10-analytics/setup-checklist.md`
Step-by-step founder checklist:
1. Create PostHog project at posthog.com → copy API key → goes into BOTH LP `.env` AND CRM `.env`
2. Create GA4 property → copy Measurement ID → goes into LP `.env` ONLY
3. Create Meta Pixel → copy Pixel ID → goes into LP `.env` ONLY
4. Create LinkedIn Insight Tag → copy Partner ID → goes into LP `.env` ONLY
5. Create Hotjar project → copy Hotjar ID + SV → goes into LP `.env` ONLY
6. Create Sentry projects (2: SPA + Server) → copy DSNs → goes into CRM `.env` + Lambda env ONLY
7. Run `npm run build:lps` for LP → verify IDs injected in built HTML
8. Deploy CRM + LP
9. Run `tests/analytics.spec.ts` — verify LP has full suite, CRM has PostHog only
10. Verify PostHog Live Events shows funnel events cross-domain for 1 test session

Stop here. Do not deploy or sign up for vendors (manual). Do not put GA4/Pixel/LinkedIn in the CRM SPA.
```

## Manual Steps (🧍)

1. Sign up for PostHog, GA4, Meta Pixel, LinkedIn Insight Tag, Hotjar, Sentry (2 projects). Capture all IDs in `setup-checklist.md`.
2. **LP env vars** → `creative/landing-pages/.env` (build-time, NOT deployed to git):
   - `POSTHOG_KEY` (shared PostHog project key)
   - `GA4_ID`
   - `META_PIXEL_ID`
   - `LINKEDIN_PARTNER_ID`
   - `HOTJAR_ID`, `HOTJAR_SV`
3. **CRM env vars** → `real-estate-crm-app/.env` (Vite, NOT deployed to git):
   - `VITE_POSTHOG_KEY` (same PostHog project key)
   - `VITE_POSTHOG_HOST`
   - `VITE_SENTRY_DSN` (SPA DSN — do NOT add GA4/Pixel/LinkedIn here)
4. **Server Lambda env vars** → Lambda config:
   - `POSTHOG_KEY_SERVER` (same PostHog project key)
   - `SENTRY_DSN_SERVER`
5. After AI prompt completes + PRs merge: run `npm run build:lps` for LP; deploy SPA + Lambda + LP.
6. Run `tests/analytics.spec.ts` — verify LP has all 5 trackers, CRM has PostHog only.
7. Configure GA4 + Meta + LinkedIn conversion events (founder-side in their dashboards).
8. Save PostHog funnel + insights per dashboard config md.
9. Tick ACs + log to `00-DECISIONS-LOG.md`.

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
