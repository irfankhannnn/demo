# Zeeshan — Task Bifurcation
## Role: All Frontend, Backend & Complete Code Writing
## Phases: Pre-Launch (P1–P18) + Week 1 (Day 1–7)

> **How to use this file:**
> - Each Jira Story has an ID, phase, priority, source reference, and sub-tasks.
> - "Source File" = the exact `.md` file in `marketing-and-sales/launch-plan-v2/` to read before starting.
> - Work order follows the dependency chain in `pre-launch-prep/README.md` and `week-1-foundation/README.md`.
> - All code must follow existing patterns: `server/tenantMiddleware.js`, `server/crmDynamodbService.js`, `real-estate-crm-app/src/App.tsx`.

---

## EPIC 1 — Pre-Launch Code Deliverables

---

### ZEE-001 | Demo Environment — Seed Script + Cron
- **Phase:** Pre-Launch → T-7
- **Priority:** High
- **Source File:** `pre-launch-prep/P5-demo-environment.md`
- **Context:** Spin up `demo.realestateflow.in` with a fully populated fake-data tenant so prospects can self-tour the product. The demo tenant must reset itself daily at 2:00 AM IST so it's always clean and doesn't accumulate junk. This is the AI Employee wedge showcase environment.

#### Tasks
- [ ] **ZEE-001-T1** — Write `server/scripts/seed-demo-tenant.js`
  - Generates 1 agency, 3 agents, 5 buyers, 4 properties (Andheri/Bandra/Powai/Thane), 8 leads (mixed pipeline stages), 2 Khata entries, 1 pending commission
  - Uses Mumbai-realistic data (localities, property names, INR prices)
  - Idempotent: wipes existing demo-tenant DDB rows before re-seeding
  - Reads `DEMO_TENANT_ID` from env var
- [ ] **ZEE-001-T2** — Write `server/scripts/reset-demo-tenant.js`
  - Deletes all records for `DEMO_TENANT_ID` then calls `seed-demo-tenant.js`
  - Designed to be invoked by Lambda cron
- [ ] **ZEE-001-T3** — Write `cron/reset-demo.yaml` (EventBridge / Lambda cron definition)
  - Schedule: `cron(30 20 * * ? *)` = 2:00 AM IST daily
  - Wraps `reset-demo-tenant.js` in a Lambda handler
- [ ] **ZEE-001-T4** — Write `real-estate-crm-app/src/components/DemoBanner.tsx`
  - Sticky yellow banner: "You're viewing a demo account — data resets daily at 2 AM"
  - Reads `VITE_IS_DEMO` env flag; hides on production
- [ ] **ZEE-001-T5** — Unit test: run seed → confirm DDB has exactly the expected record counts
- **Acceptance:** Demo URL loads with populated data; cron verified in AWS EventBridge; banner shows on demo subdomain only.

---

### ZEE-002 | Grievance Flow — Backend + Frontend
- **Phase:** Pre-Launch → T-5
- **Priority:** High (DPDP compliance blocker)
- **Source File:** `pre-launch-prep/P9-grievance-flow.md`
- **Context:** DPDP Act 2023 mandates a public grievance portal. Build the `/grievance` public page (hCaptcha-gated form), a Lambda route to store submissions in DynamoDB, an admin UI in the CRM to view/resolve tickets, and auto-acknowledgement email via Brevo. No auth required to submit — this is a public form.

#### Tasks
- [ ] **ZEE-002-T1** — Write `server/grievanceDynamodbService.js`
  - `createGrievance({name, email, phone, description, category})` → stores in `Grievances` DDB table with `PK=grievanceId (ULID), status=open, createdAt, tenantId=null (public)`
  - `listGrievances({status, page})` → admin read (requires auth)
  - `updateGrievanceStatus(grievanceId, {status, resolution, resolvedBy})`
- [ ] **ZEE-002-T2** — Write `server/routes/grievance.js`
  - `POST /api/grievance` — public, rate-limited (6/hr per IP), hCaptcha verify, calls `createGrievance`, triggers Brevo auto-ack email
  - `GET /api/grievance` — admin-only (validateToken + role=ADMIN), calls `listGrievances`
  - `PUT /api/grievance/:id` — admin-only, updates status + resolution
  - Mount in `server/server.js`
- [ ] **ZEE-002-T3** — Write `real-estate-crm-app/src/pages/public/Grievance.tsx`
  - Public page at route `/grievance` (no auth wrapper)
  - Form fields: Name, Email, Phone, Category (dropdown), Description (textarea)
  - hCaptcha widget integration (key from env `VITE_HCAPTCHA_SITE_KEY`)
  - Success state: "Your grievance #GRIEVANCE-ID has been logged. We will respond within 7 working days."
  - Footer must show Grievance Officer name, email, address (provided by Founder — placeholder `{{GO_NAME}}`, `{{GO_EMAIL}}`, `{{GO_ADDRESS}}`)
- [ ] **ZEE-002-T4** — Write `real-estate-crm-app/src/pages/admin/GrievanceList.tsx`
  - Admin-only page at `/admin/grievances`
  - Table: ID, name, email, category, date, status badge (open/in-review/resolved)
  - "Resolve" action opens inline form for resolution text + status update
  - Role-gate: ADMIN only (using existing auth context pattern)
- [ ] **ZEE-002-T5** — Write `tests/grievance.spec.ts` (Playwright)
  - Submit valid form → assert success message + DDB row created
  - Submit 7th request from same IP within 1h → assert 429
  - Submit with invalid hCaptcha token → assert 400
  - Admin can view + resolve submission
- **Acceptance:** `/grievance` page publicly accessible; form submits, DDB row created, Brevo auto-ack email fires; admin can resolve; rate-limit enforced.

---

### ZEE-003 | Analytics Events Layer
- **Phase:** Pre-Launch → T-8
- **Priority:** High
- **Source File:** `pre-launch-prep/P10-analytics-events.md`
- **Context:** Wire a fully typed analytics layer across all LPs, the CRM SPA, and the server. Gated by cookie consent banner (ZEE-006). Uses PostHog, GA4, Meta Pixel, LinkedIn Tag, Sentry. Every key user action must fire a named event with properties — this is the measurement backbone for all Week 2+ decisions.

#### Tasks
- [ ] **ZEE-003-T1** — Write `real-estate-crm-app/src/lib/analytics.ts`
  - `trackEvent(name: EventName, properties: Record<string, unknown>)` — dispatches to PostHog, GA4, Pixel, LinkedIn based on consent flags from `localStorage.cookieConsent`
  - Typed `EventName` union: `page_viewed | signup_started | signup_completed | otp_verified | onboarding_completed | feature_first_use | paywall_shown | subscription_started | trial_reminder_clicked | grievance_submitted | ai_employee_provisioned | seat_limit_hit`
  - `identifyUser(userId, traits)` — PostHog identify call (called once post-login)
  - No PII in event properties (email/phone go only in `identifyUser`)
- [ ] **ZEE-003-T2** — Instrument LP events in `creative/landing-pages/` pages
  - Inject `page_viewed` on each LP load (via inline script) with `{page_name, source, utm_*}`
  - `cta_clicked` on all primary CTA buttons with `{cta_label, page, position}`
  - `form_submitted` on Netlify form submits with `{form_name}`
  - `pricing_viewed` when `/pricing` page loads
- [ ] **ZEE-003-T3** — Instrument SPA events
  - `signup_started` in signup form first keystroke
  - `otp_verified` in OTP confirm handler
  - `onboarding_completed` after agency setup save
  - `feature_first_use` when first buyer/property/lead is created
  - `paywall_shown` when `PaywallModal` renders (ZEE-007)
  - `subscription_started` on Razorpay success callback
- [ ] **ZEE-003-T4** — Write `server/lib/posthog.js` (server-side PostHog)
  - PostHog Node SDK wrapper
  - `serverTrack(distinctId, event, properties)` — called from billing webhook, grievance route
  - Used by P11 (`ai_employee_provisioned`), P12 (`paywall_seat_limit_hit`)
- [ ] **ZEE-003-T5** — Write `tests/analytics.spec.ts` (Playwright)
  - Accept all cookies → walk full signup → assert PostHog events fire (via network intercept of PostHog API call)
  - Reject cookies → assert GA4/Pixel/LinkedIn scripts not loaded (network tab check)
  - PII safety: assert no event contains raw `email` or `phone` field
- **Acceptance:** PostHog Live Events feed shows all catalogue events in a single test session; cookie gating verified; Playwright suite 100% pass.

---

### ZEE-004 | Razorpay Billing Webhook + OpenClaw Concierge Backend
- **Phase:** Pre-Launch → T-3
- **Priority:** High
- **Source File:** `pre-launch-prep/P11-openclaw-concierge.md`
- **Context:** When an agency pays for AI Employee (₹7,999/mo), a Razorpay `subscription.activated` webhook must auto-create a provisioning row in DynamoDB, email the founder, add the tenant to an AiSensy broadcast list, and fire a PostHog event. A status page in the CRM shows the tenant their setup progress. A 6-hour escalation cron auto-escalates if 24h SLA is missed.

#### Tasks
- [ ] **ZEE-004-T1** — Write `server/routes/billing.js`
  - `POST /api/billing/webhook` — public, HMAC-SHA256 signature verify using `RAZORPAY_WEBHOOK_SECRET`
  - Idempotent: store each `event.id` in `WebhookLog` DDB table before processing; skip if already processed
  - Branches: `subscription.activated` (AI Employee plan) → create `AIEmployeeProvisioning` row + email + AiSensy + PostHog; `subscription.charged` → `subscription_paid` event; `payment.captured/failed` → PostHog events; `subscription.cancelled` → update `Subscriptions` + PostHog; `subscription.updated` (seat add) → call `incrementSeatsPaid`
  - Mount in `server/server.js` BEFORE auth middleware (must be public)
- [ ] **ZEE-004-T2** — Write `server/aiEmployeeProvisioningService.js`
  - DDB table: `AIEmployeeProvisioning` PK=`tenantId`
  - `createProvisioningRow({tenantId, agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, planId, razorpaySubscriptionId})`
  - `getProvisioningByTenant(tenantId)`
  - `updateProvisioning(tenantId, {status, internalNotes, loomUrl, liveAt})`
  - `listPendingProvisioning()` (for escalation cron)
- [ ] **ZEE-004-T3** — Write `server/routes/aiEmployeeStatus.js`
  - `GET /api/ai-employee/status` — validateToken + extractTenantId
  - Returns provisioning row for current tenant or 404 if tenant has not paid
- [ ] **ZEE-004-T4** — Write `real-estate-crm-app/src/pages/crm/AIEmployeeStatus.tsx`
  - Route: `/integrations/ai-employee`
  - Fetches `/api/ai-employee/status`
  - 3 states: 🟡 pending (progress bar + "we're setting up your AI Employee"), 🟢 live (Loom embed + WhatsApp/Telegram numbers), 🔴 escalated ("We missed our 24h SLA — ₹500 credited")
  - Read-only; no mutation buttons
  - Footer: "Need help? WhatsApp us" + Crisp trigger
- [ ] **ZEE-004-T5** — Write `server/scripts/escalation-cron.js` + `cron/escalate-openclaw.yaml`
  - Every 6h: scan `AIEmployeeProvisioning` where `status=pending` AND `now > expectedSLAEnd`
  - On breach: update `status=escalated`, send escalation email to founder + customer apology, Razorpay ₹500 credit note, PostHog `ai_employee_escalated`
  - Runs as scheduled Lambda (mirror P5 cron pattern)
- [ ] **ZEE-004-T6** — Write `server/middleware/apiKeyAuth.js`
  - Validates `Bearer` token from OpenClaw HTTP requests via `TenantApiKeys` DDB lookup
  - Sets `req.tenantId` on match; 401 on failure
- **Acceptance:** Test webhook → DDB row created + email sent + PostHog event fired in <60s; status page renders all 3 states correctly; escalation cron updates status.

---

### ZEE-005 | Seat-Cap Enforcement
- **Phase:** Pre-Launch → T-4
- **Priority:** High
- **Source File:** `pre-launch-prep/P12-seat-cap-enforcement.md`
- **Context:** Without seat enforcement, a Team plan (₹1,999 for 3 seats) can have 10 members for free — pure revenue leakage. Block invite creation at the API layer when `seatsUsed >= seatsPaid`. Show a clear upgrade modal. Handle the `subscription.updated` webhook to increment seats when ₹500/seat is paid.

#### Tasks
- [ ] **ZEE-005-T1** — Write `server/subscriptionService.js`
  - `getSubscription(tenantId)` → `{plan, seatsPaid, seatsUsed, nextBillingDate, razorpaySubscriptionId, status}`
  - `incrementSeatsPaid(tenantId, by=1)` (called by billing webhook on seat-add)
  - `decrementSeatsPaid(tenantId, by=1)`
  - `recomputeSeatsUsed(tenantId)` — counts active members in DDB
  - Write `server/routes/subscriptions.js` → `GET /api/subscriptions/current` (validateToken + extractTenantId)
- [ ] **ZEE-005-T2** — Update `server/routes/auth.js` invite-creation handler
  - Before invite: `getSubscription(tenantId)` → compute `seatsUsed`
  - If `seatsUsed >= seatsPaid`: return HTTP 402 `{error: "paywall_seat_limit", currentSeats, paidSeats, tier, upgradeOptions}` + fire PostHog `paywall_seat_limit_hit`
- [ ] **ZEE-005-T3** — Write `real-estate-crm-app/src/components/SeatCounter.tsx`
  - Fetches `/api/subscriptions/current`
  - Displays: `{seatsUsed} of {seatsPaid} seats used` with colour-coded progress bar (green <70%, yellow 70–90%, red ≥90%)
  - "Upgrade" CTA when at or near cap
- [ ] **ZEE-005-T4** — Write `real-estate-crm-app/src/components/SeatUpgradeModal.tsx`
  - Triggered on 402 response OR manual "Upgrade" CTA
  - Solo at-cap: "Upgrade to Team — ₹1,999/mo (3 seats)" CTA → Razorpay Team checkout
  - Team at-cap: "Add 1 seat — ₹500/month prorated" CTA → Razorpay add_seat checkout
  - On success: refetch subscription, close modal, retry invite
- [ ] **ZEE-005-T5** — Update `InviteManagement.tsx` and `MemberManagement.tsx`
  - Mount `<SeatCounter />` at top of each page
  - Disable "Invite Member" button + show tooltip when at cap
  - On 402 from POST invite → auto-open `<SeatUpgradeModal />`
- [ ] **ZEE-005-T6** — Write `tests/seat-cap.spec.ts` (Playwright)
  - Invite 1 on Solo → 200; invite 2 on Solo → 402 + modal opens
  - Invite 3 on Team → 200; invite 4 on Team → 402
  - Pay ₹500 test → seatsPaid increments → invite 4 → 200
  - Deactivate member → seatsUsed decrements → invite new member → 200
- [ ] **ZEE-005-T7** — Write `server/scripts/backfill-seats-paid.js`
  - Idempotent: for existing tenants, set `seatsPaid` based on plan (Solo=1, Team=3)
- **Acceptance:** All 5 Playwright scenarios pass; no agency can exceed seatsPaid; modal opens on 402.

---

### ZEE-006 | Cookie Consent Banner (DPDP-Compliant)
- **Phase:** Pre-Launch → T-8
- **Priority:** High
- **Source File:** `pre-launch-prep/P17-cookie-consent-banner.md`
- **Context:** DPDP Act 2023 requires explicit consent before non-essential trackers load. Build one banner used across all 5 LPs (plain HTML partial) and the CRM SPA (React component). Gates PostHog session recording, GA4, Meta Pixel, LinkedIn Insight Tag, Hotjar.

#### Tasks
- [ ] **ZEE-006-T1** — Write `creative/landing-pages/_partials/cookie-banner.html`
  - Plain HTML + inline JS + inline CSS; injected at end of LP `<body>`
  - 3 buttons: "Accept all" (green), "Reject non-essential" (outline), "Customize" (text link)
  - "Customize" opens a modal with 4 toggles: Essential (locked), Functional, Analytics, Marketing
  - Stores in `localStorage.cookieConsent = {essential, functional, analytics, marketing, version, timestamp}`
  - On Accept: initializes PostHog (full), GA4, Pixel, LinkedIn, Hotjar
  - On Reject: PostHog runs with `disable_session_recording: true`; no other trackers load
  - ARIA roles, keyboard-navigable (Tab/Enter/Esc), dark mode, mobile bottom-sheet
- [ ] **ZEE-006-T2** — Write `real-estate-crm-app/src/components/CookieConsentBanner.tsx`
  - React equivalent of the above, using same consent logic
  - Renders as bottom-fixed bar within `App.tsx` layout
  - Persists consent to `localStorage`; re-prompts only when `version` increments
  - "Cookie preferences" link in app footer → re-opens Customize modal
- [ ] **ZEE-006-T3** — Inject banner into all 5 LPs (`creative/landing-pages/*/index.html`) via the partial
- [ ] **ZEE-006-T4** — Mount `<CookieConsentBanner />` in `real-estate-crm-app/src/App.tsx`
- [ ] **ZEE-006-T5** — Write tests: first visit → banner renders; Accept → no banner on second visit; Reject → assert PostHog/GA4/Pixel not loaded (network intercept)
- **Acceptance:** All 5 LPs + SPA show banner on first visit; consent gates all non-essential trackers correctly; no dark patterns (reject same visual weight as accept).

---

### ZEE-007 | Subscription Paywall + Trial Countdown UI
- **Phase:** Pre-Launch → T-3
- **Priority:** High
- **Source File:** `pre-launch-prep/P14-paywall-trial-countdown.md`
- **Context:** Trials silently lapse without an in-product paywall. Add a sticky countdown banner (Day 8–14 of trial) that turns red at Day 12, then a full-page blocking modal at Day 15 (trial expired). The modal shows 3 plan tiers from `pricing.json` and opens Razorpay checkout. Wire 3 trial reminder emails via a daily cron. Paywall MUST NOT block: `/profile`, `/billing`, `/legal/*`, `/grievance`, `/integrations/ai-employee`.

#### Tasks
- [ ] **ZEE-007-T1** — Update `server/routes/subscriptions.js` — add `GET /api/subscriptions/trial-status`
  - Returns: `{trialDaysLeft, trialEndsAt, plan, isPaying, gracePeriodActive, paymentStatus}`
  - `trialDaysLeft = ceil((trialEndsAt - now) / 86400000)`, clamped to 0
- [ ] **ZEE-007-T2** — Write `real-estate-crm-app/src/hooks/useSubscription.ts`
  - Fetches `/api/subscriptions/trial-status` on mount + every 5 min
  - Exposes: `{subscription, isPaying, isTrialing, trialDaysLeft, isTrialExpired, refetch}`
  - Cached in React context (wrap in provider in `App.tsx`)
- [ ] **ZEE-007-T3** — Write `real-estate-crm-app/src/components/TrialCountdownBanner.tsx`
  - Returns null if `isPaying` OR `trialDaysLeft > 7`
  - Yellow (7≥days>3): neutral copy + "Upgrade now" CTA
  - Red (3≥days>0): bold copy + "Upgrade for ₹{Solo.price}/month"
  - Clicking CTA → opens `PaywallModal`
- [ ] **ZEE-007-T4** — Write `real-estate-crm-app/src/components/PaywallModal.tsx`
  - Renders when `isTrialExpired && !isPaying && !gracePeriodActive`
  - Route whitelist: allow `/profile`, `/billing`, `/legal/*`, `/grievance`, `/integrations/ai-employee`, `/auth/logout`
  - Content: Annual/Monthly toggle + 3 tier cards from `pricing.json` + "Add AI Employee ₹7,999/mo" toggle
  - "What happens to my data?" expandable FAQ + WhatsApp CTA
  - On CTA: call `openRazorpayCheckout(planId)` → on success: `refetch()` → close modal
  - If AI Employee toggle ON: chain second Razorpay subscription after main plan succeeds; redirect to `/integrations/ai-employee`
- [ ] **ZEE-007-T5** — Write `real-estate-crm-app/src/lib/razorpay.ts`
  - `openCheckout({planId, name, email, prefill, onSuccess, onFailure})` — loads Razorpay.js dynamically, wraps subscription checkout
  - Key from `import.meta.env.VITE_RAZORPAY_KEY_ID`
- [ ] **ZEE-007-T6** — Mount in `App.tsx`
  - `<TrialCountdownBanner />` at top of authenticated layout
  - `<PaywallModal />` at root level with route whitelist check
- [ ] **ZEE-007-T7** — Write `server/scripts/trial-reminder-cron.js` + `cron/trial-reminder.yaml`
  - Daily 09:00 IST: query `Subscriptions` for `isTrialing && trialEndsAt` within window
  - Sends Day-10, Day-12, Day-14 emails via Brevo; Day-3-post-expiry reactivation email
  - Idempotent via `last_email_sent` flag per user
- [ ] **ZEE-007-T8** — Write `tests/paywall.spec.ts` (Playwright)
  - `trialDaysLeft=8` → no banner; `=7` → yellow banner; `=3` → red banner; `=0` → modal blocks `/crm` but allows `/billing`
  - Mock Razorpay success → modal closes; subscription refetch shows `isPaying=true`
- **Acceptance:** Banner shows at correct days; modal blocks at Day 15 with whitelist respected; Razorpay flow completes E2E; 4 Brevo cron emails fire on schedule.

---

### ZEE-008 | Landing Pages Code Rewrite (HTML/CSS Pipeline)
- **Phase:** Pre-Launch → T-11 (draft) → T-2 (deploy)
- **Priority:** High
- **Source File:** `pre-launch-prep/P15-landing-pages-rewrite.md`
- **Context:** Existing LPs use Tailwind CDN (slow) + Hinglish copy + wrong pricing. Rewrite 5 retained pages in English + build 7 new pages. Replace CDN with a built CSS pipeline. Wire real analytics IDs, OG tags, JSON-LD schema (from ZEE-009), cookie banner (ZEE-006), Netlify Forms, inline SVG logo.

#### Tasks
- [ ] **ZEE-008-T1** — Set up built CSS pipeline (Vite or PostCSS) for `creative/landing-pages/`
  - Replace all `<script src="https://cdn.tailwindcss.com">` with compiled `<link rel="stylesheet" href="/assets/main.css">`
  - Add `npm run build:lps` script to `package.json`
- [ ] **ZEE-008-T2** — Rewrite 5 existing LPs: `main`, `agency-owners`, `agents`, `ai-employee`, `demo`
  - English copy (coordinate with Madhu for final copy text)
  - All pricing from `pricing.json` — no hardcoded numbers
  - Trial copy: "14-day free trial — no card" everywhere
  - Refund copy: "1 month money-back guarantee" (never "6-month")
  - Mumbai-first social proof until Day 14: "Mumbai-built · early-access launch"
  - Real analytics IDs in `<head>` (env-var driven: `GA4_ID`, `META_PIXEL_ID`, `LINKEDIN_INSIGHT_ID`, `HOTJAR_ID`)
  - `cal.com/{{FOUNDER_HANDLE}}` replacing placeholder
  - Real WhatsApp number `wa.me/{NUMBER}` + `tel:` links
  - Real email `info@realestateflow.in`
  - Inline SVG logo (from Madhu/P8 output)
  - OG meta tags per page with P8 OG image paths
  - `_partials/cookie-banner.html` injected in `<body>`
  - Netlify Forms: `lead-capture-main`, `demo-booking`, `agency-signup`, `agent-signup`, `ai-employee-interest`
- [ ] **ZEE-008-T3** — Create 7 new pages
  - `/pricing` — full tier comparison (copy from Madhu P2 output: `pre-launch/02-pricing/page-copy.md`)
  - `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/cookies` — content from P1 output
  - `/vs/sell-do`, `/vs/zoho-crm`, `/vs/excel-spreadsheet` — from P4 vs-pages drafts
  - `/about` — founder story + LocalBusiness schema
- [ ] **ZEE-008-T4** — Add `sitemap.xml`, `robots.txt`, `llms.txt` at LP root
- [ ] **ZEE-008-T5** — Delete `enterprise/` folder + remove from `netlify.toml`
- [ ] **ZEE-008-T6** — Update `netlify.toml` with all 12 page routes + redirect rules
- [ ] **ZEE-008-T7** — Run Lighthouse mobile on all 12 pages; fix until all 4 categories ≥90
- **Acceptance:** All 12 pages return 200; Lighthouse mobile ≥90 all categories; LCP <2.5s, INP <200ms, CLS <0.1; no placeholder strings remain.

---

### ZEE-009 | SEO + AEO JSON-LD Schema + Sitemap
- **Phase:** Pre-Launch → T-9
- **Priority:** Medium
- **Source File:** `pre-launch-prep/P16-seo-aeo-master.md`
- **Context:** Schema markup makes Google + AI engines understand the site. Without JSON-LD, even great LPs are invisible to search. Inject per-page schema into all 12 LPs. The content/keywords come from Madhu (P16 AI prompts). Zeeshan owns the code injection, file structure, and build pipeline integration.

#### Tasks
- [ ] **ZEE-009-T1** — Inject JSON-LD blocks into each LP (from Madhu's `pre-launch/16-seo-aeo/` output)
  - `/` → `SoftwareApplication`, `Organization`, `WebSite/SearchAction`, `FAQPage`, `ContactPoint`
  - `/pricing` → `Product` × 3 (Solo/Team/Team+) with `offers`
  - `/agency-owners`, `/agents`, `/ai-employee`, `/demo` → `WebPage`, `Organization`, `FAQPage`, `BreadcrumbList`
  - `/about` → `Organization`, `LocalBusiness`
  - `/vs/*` → `Article`, `FAQPage`, `BreadcrumbList`
  - `/legal/*` → `WebPage`, `Organization`
  - `/grievance` → `ContactPoint` (DPDP Grievance Officer)
- [ ] **ZEE-009-T2** — Add per-page `<title>` ≤60 chars, `<meta description>` ≤155 chars, `<link rel="canonical">`, `lang="en"`, OG meta, Twitter card (from Madhu's SEO spec)
- [ ] **ZEE-009-T3** — Add internal linking across pages per SEO spec: `/` → all 5 persona pages; every LP → `/pricing` + `/demo`
- [ ] **ZEE-009-T4** — Build `sitemap.xml` (12 URLs, `lastmod`, `priority`, `changefreq`) and `robots.txt` (allow all, reference sitemap)
- [ ] **ZEE-009-T5** — Build `llms.txt` manifest listing canonical answer pages
- [ ] **ZEE-009-T6** — Verify all schemas at `https://validator.schema.org` (programmatic or manual list)
- **Acceptance:** All schemas validate; sitemap accessible at `/sitemap.xml`; on-page SEO meta correct on all 12 pages.

---

### ZEE-010 | Multi-Tenancy + Security Audit (Code Layer)
- **Phase:** Pre-Launch → T-1
- **Priority:** Critical (Day 1 launch blocker)
- **Source File:** `pre-launch-prep/P13-multitenancy-security-audit.md`
- **Context:** "Implemented" ≠ "uniformly applied". One missed `extractTenantId` on a route = full data breach. Run a static analysis of every route and DDB call, produce the coverage CSV, write the cross-tenant Playwright pen-test, and fix every P0 finding before Day 1. The Founder signs off the report after Zeeshan delivers the artefacts.

#### Tasks
- [ ] **ZEE-010-T1** — Static analysis: walk every `server/routes/*.js` file
  - For each route: note `hasValidateToken`, `hasExtractTenantId`, `isPublic`, DDB call count, DDB calls with `tenantId` in key
  - Produce `marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv`
  - Mark severity: P0 if non-public + missing validateToken or extractTenantId; P1 if missing rate limit on public endpoint
- [ ] **ZEE-010-T2** — Write `tests/cross-tenant-pentest.spec.ts` (Playwright)
  - Provision Tenant A and Tenant B; seed each with 1 buyer + 1 owner + 1 property
  - Login as A → attempt 10+ cross-tenant GET/PUT/DELETE with B's IDs → assert 403 or 404 always, never 200 with B data
  - Public routes: submit 7 grievances from same IP in 1h → assert 429; billing webhook with bad signature → assert 401
- [ ] **ZEE-010-T3** — Fix ALL P0 findings from coverage CSV immediately
  - Add `extractTenantId` to any route missing it
  - Add rate-limiting middleware to any unprotected public route
- [ ] **ZEE-010-T4** — Produce `security-audit-report.md` with executive summary, findings table, fix PR links
- [ ] **ZEE-010-T5** — Day 7 re-scan: re-run static analysis diff vs T-1 baseline; cover any new routes added Days 1–6
- **Acceptance:** Zero P0 findings in CSV; pen-test 100% pass; report signed by Founder.

---

## EPIC 2 — Week 1 Code Deliverables

---

### ZEE-011 | Day 2 — Fix All P0 Friction Points
- **Phase:** Week 1 → Day 2
- **Priority:** Critical
- **Source File:** `week-1-foundation/day-02-fix-friction-points.md`
- **Context:** Founder walks the product cold on Day 1 and logs every friction point (ZEE-012 is the context). Day 2 is the only dedicated block to ship P0 fixes before payments go live Day 3 and beta invites Day 9. Goal: signup → first record in ≤8 min desktop, ≤10 min mobile.

#### Tasks
- [ ] **ZEE-011-T1** — Read `marketing-and-sales/launch-implement/week-1/day-01-backlog.md` (Founder's output from Day 1 walkthrough)
- [ ] **ZEE-011-T2** — For each P0 item: root-cause analysis → minimal fix → diff → PR
  - Constraint: no new dependencies; preserve tenant scoping; TypeScript strict; mobile-first Tailwind; match existing component patterns
- [ ] **ZEE-011-T3** — For each P0 fix: manual smoke test to verify resolution
- [ ] **ZEE-011-T4** — Re-walkthrough full flow after all P0 fixed; time the run — must be ≤8 min desktop
- [ ] **ZEE-011-T5** — Ship top 3 P1 items by ICE score (if time allows after P0s)
- [ ] **ZEE-011-T6** — Update `day-01-backlog.md` with status + PR link per item
- [ ] **ZEE-011-T7** — Write `daily-log/day02.md` standup entry
- **Acceptance:** Zero P0 outstanding; re-walkthrough time ≤8 min desktop / ≤10 min mobile; no regression on existing flows.

---

### ZEE-012 | Day 4 — Analytics Events Final Wire-up + CI Gate
- **Phase:** Week 1 → Day 4
- **Priority:** High
- **Source File:** `week-1-foundation/day-04-analytics-events-final.md`
- **Context:** Days 1–3 introduced new code. Day 4 locks down analytics: confirm every event in the P10 catalogue fires correctly across all surfaces, ensure cookie consent gating still works, add the Playwright analytics test to CI as a required check.

#### Tasks
- [ ] **ZEE-012-T1** — Run event coverage audit: for each event in P10 catalogue, locate `trackEvent(...)` call in codebase
  - Produce `marketing-and-sales/launch-implement/week-1/day-04-event-coverage.csv` with: event, file:line, properties_match (Y/N), missing_properties
  - Generate fix-PR diffs for any missing or misnamed events
- [ ] **ZEE-012-T2** — Cookie consent verification audit: trace `CookieConsentBanner → analytics.ts → trackEvent`
  - Confirm: with `cookieConsent.analytics=false`, GA4/Pixel/LinkedIn NOT loaded; PostHog in `disable_session_recording` mode
  - If any tracker leaks past consent gate: fix-PR diff
- [ ] **ZEE-012-T3** — PII safety scan: grep all `trackEvent(...)` calls for email/phone/gstin/full-name in properties
  - Generate fix-PR diffs for violations (move PII to `identifyUser`)
- [ ] **ZEE-012-T4** — Run `npx playwright test tests/analytics.spec.ts` — 100% pass
- [ ] **ZEE-012-T5** — Add `tests/analytics.spec.ts` to GitHub Actions CI as required check on all PRs
- [ ] **ZEE-012-T6** — Write `daily-log/day04.md` standup entry
- **Acceptance:** 100% event coverage; cookie gating airtight; Playwright 100% pass; CI gate active.

---

### ZEE-013 | Day 6 — Wire Signup → Brevo + LP Deploy Support
- **Phase:** Week 1 → Day 6
- **Priority:** High
- **Source File:** `week-1-foundation/day-06-landing-pages-deploy.md`
- **Context:** Day 6 deploys all 12 LPs to production and activates the welcome drip. Zeeshan owns the backend code change that fires signup events to Brevo + the final deploy pipeline execution.

#### Tasks
- [ ] **ZEE-013-T1** — Update `server/routes/auth.js` registration success handler
  - On successful signup: `POST https://api.brevo.com/v3/contacts` with list ID `BREVO_TRIAL_LIST_ID` (env var)
  - Fields: `email`, `firstName`, `phone`, `SIGNUP_DATE` (Brevo contact attribute)
  - Fire PostHog `signup_completed` server-side event here
- [ ] **ZEE-013-T2** — Run final LP build: `npm run build:lps` — confirm no warnings, no placeholder strings (`grep -r "XXXX\|YOUR_\|hello@\|9999999999"`)
- [ ] **ZEE-013-T3** — Deploy to Netlify: `netlify deploy --prod --dir=creative/landing-pages/dist`
- [ ] **ZEE-013-T4** — Verify all 12 URLs return 200 and Lighthouse mobile ≥90
- [ ] **ZEE-013-T5** — Smoke test: register a real test trial → confirm T+0 welcome email arrives within 60s
- [ ] **ZEE-013-T6** — Write `daily-log/day06.md` standup entry
- **Acceptance:** All 12 LPs live; signup → Brevo contact added; T+0 welcome email fires within 60s.

---

### ZEE-014 | Day 7 — Security Re-scan + Playwright Suite Run
- **Phase:** Week 1 → Day 7
- **Priority:** Critical (Go/No-Go gate)
- **Source File:** `week-1-foundation/day-07-final-audit.md`
- **Context:** Days 1–6 added new code. Day 7 re-scans everything to catch drift before beta invites go out Day 9. Zeeshan runs the security diff vs T-1 baseline, re-runs all Playwright suites, and hands the results to Founder for Go/No-Go sign-off.

#### Tasks
- [ ] **ZEE-014-T1** — Re-run static route analysis (diff vs `route-tenant-coverage.csv` T-1 baseline)
  - Any new route added in Days 1–6 missing tenant scope = P0 — fix immediately
  - Any new public route missing rate limit = P1
- [ ] **ZEE-014-T2** — Re-run `tests/cross-tenant-pentest.spec.ts` — 100% pass
- [ ] **ZEE-014-T3** — Run all Playwright suites: `analytics.spec.ts`, `paywall.spec.ts`, `seat-cap.spec.ts`, `grievance.spec.ts`
- [ ] **ZEE-014-T4** — Check: every LP footer has GO disclosure + 4 legal links; signup form has consent checkbox
- [ ] **ZEE-014-T5** — Write results into `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md` (security + analytics + legal sections); hand to Founder for sign-off
- **Acceptance:** Zero P0 findings; all Playwright suites pass; Go/No-Go report sections completed.

---

## Reference: Key Files to Read Before Starting

| Task | Read First |
|------|------------|
| ZEE-001 | `pre-launch-prep/P5-demo-environment.md` |
| ZEE-002 | `pre-launch-prep/P9-grievance-flow.md` |
| ZEE-003 | `pre-launch-prep/P10-analytics-events.md` |
| ZEE-004 | `pre-launch-prep/P11-openclaw-concierge.md` |
| ZEE-005 | `pre-launch-prep/P12-seat-cap-enforcement.md` |
| ZEE-006 | `pre-launch-prep/P17-cookie-consent-banner.md` |
| ZEE-007 | `pre-launch-prep/P14-paywall-trial-countdown.md` |
| ZEE-008 | `pre-launch-prep/P15-landing-pages-rewrite.md` |
| ZEE-009 | `pre-launch-prep/P16-seo-aeo-master.md` |
| ZEE-010 | `pre-launch-prep/P13-multitenancy-security-audit.md` |
| ZEE-011 | `week-1-foundation/day-02-fix-friction-points.md` |
| ZEE-012 | `week-1-foundation/day-04-analytics-events-final.md` |
| ZEE-013 | `week-1-foundation/day-06-landing-pages-deploy.md` |
| ZEE-014 | `week-1-foundation/day-07-final-audit.md` |

## Dependency Order (Execution Sequence)

```
ZEE-006 (cookie banner)  ──►  ZEE-003 (analytics)  ──►  ZEE-012 (analytics final)
ZEE-002 (grievance)       ──►  ZEE-010 (security audit)
ZEE-001 (demo env)        ──►  [Founder deploys demo infra]
ZEE-004 (billing webhook) ──►  ZEE-005 (seat cap)  ──►  ZEE-007 (paywall)
ZEE-009 (SEO/schema)      ──►  ZEE-008 (LP rewrite)  ──►  ZEE-013 (LP deploy)
                                                           ZEE-011 (Day 2 fixes)
                                                           ZEE-014 (Day 7 audit)
```
