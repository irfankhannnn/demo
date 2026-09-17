# PR Schedule — Day-wise Batches with File Ownership

## How to Use This

1. Each batch is a group of PRs that can be worked on **in parallel** — agents start at the same time
2. A batch starts only after ALL PRs from the previous batch are **merged to main**
3. Each PR has a precise file ownership list — agents only touch their owned files
4. `agency-app/api/server.js` and `App.tsx` are modified by multiple PRs — agents use tagged comment blocks (see `00-MASTER-BRIEF.md §11, §12`)
5. The Founder reviews and merges each batch before starting the next

---

## Pre-coding Setup (Founder does once before ANY agent starts)

The Founder must add placeholder extension blocks to 2 shared files so agents can insert without conflicts:

### agency-app/api/server.js — add these 2 tagged blocks (one at import section, one at routes section):

```js
// === [LAUNCH ROUTES IMPORTS] ===
// Agents add their imports here — one tagged line per PR
// === [/LAUNCH ROUTES IMPORTS] ===
```

and just before `// Error handling middleware`:
```js
// === [LAUNCH ROUTES MOUNTS] ===
// Agents add their route mounts here — one tagged block per PR
// Note: billing webhook MUST be first (before validateToken reaches it)
// === [/LAUNCH ROUTES MOUNTS] ===
```

### App.tsx — add these 3 tagged blocks inside the `<Routes>` element:

```tsx
{/* === [LAUNCH PUBLIC ROUTES] === */}
{/* Agents add public routes here */}
{/* === [/LAUNCH PUBLIC ROUTES] === */}

{/* === [LAUNCH PROTECTED ROUTES] === */}
{/* Agents add protected routes here */}
{/* === [/LAUNCH PROTECTED ROUTES] === */}
```

And inside the authenticated layout wrapper (around where `<TrialCountdownBanner />` will go):
```tsx
{/* === [LAUNCH LAYOUT COMPONENTS] === */}
{/* Agents add layout-level components here (banners, modals) */}
{/* === [/LAUNCH LAYOUT COMPONENTS] === */}
```

---

## BATCH 1 — Day 1 (4 parallel PRs)

### PR-A: Demo Environment
**Branch:** `cursor/pr-1a-demo-environment-8e67`
**Source tasks:** ZEE-001
**Parallel with:** PR-B, PR-C, PR-D

**Creates (new files only):**
```
agency-app/api/scripts/seed-demo-tenant.js
agency-app/api/scripts/reset-demo-tenant.js
cron/reset-demo.yaml
agency-app/web/src/components/DemoBanner.tsx
```

**Modifies (exact location):**
```
agency-app/web/src/App.tsx
  → Add <DemoBanner /> inside {/* === [LAUNCH LAYOUT COMPONENTS] === */} block
```

**Does NOT touch:** `agency-app/api/server.js`, any other existing file

---

### PR-B: Grievance Flow
**Branch:** `cursor/pr-1b-grievance-flow-8e67`
**Source tasks:** ZEE-002
**Parallel with:** PR-A, PR-C, PR-D

**Creates (new files only):**
```
agency-app/api/routes/grievance.js
agency-app/api/grievanceDynamodbService.js
agency-app/web/src/pages/public/Grievance.tsx
agency-app/web/src/pages/admin/GrievanceList.tsx
tests/grievance.spec.ts
```

**Modifies (exact location):**
```
agency-app/api/server.js
  → {LAUNCH ROUTES IMPORTS} block: add import
  → {LAUNCH ROUTES MOUNTS} block: add mount
agency-app/web/src/App.tsx
  → {LAUNCH PUBLIC ROUTES}: add /grievance route
  → {LAUNCH PROTECTED ROUTES}: add /admin/grievances route
```

---

### PR-C: Cookie Consent Banner
**Branch:** `cursor/pr-1c-cookie-consent-8e67`
**Source tasks:** ZEE-006
**Parallel with:** PR-A, PR-B, PR-D

**Creates (new files only):**
```
creative/landing-pages/_partials/cookie-banner.html
agency-app/web/src/components/CookieConsentBanner.tsx
tests/cookie-consent.spec.ts
```

**Modifies (exact location):**
```
agency-app/web/src/App.tsx
  → {LAUNCH LAYOUT COMPONENTS}: add <CookieConsentBanner /> (before DemoBanner)
```

---

### PR-D: LP Build Pipeline + SEO Stubs
**Branch:** `cursor/pr-1d-lp-build-pipeline-8e67`
**Source tasks:** ZEE-008-T1, ZEE-009-T4/T5 (stubs)
**Parallel with:** PR-A, PR-B, PR-C

**Creates (new files only):**
```
creative/landing-pages/build/package.json
creative/landing-pages/build/vite.config.js
creative/landing-pages/build/tailwind.config.js
creative/landing-pages/build/postcss.config.js
creative/landing-pages/build/README.md
creative/landing-pages/_partials/head.hbs
creative/landing-pages/_partials/header.hbs
creative/landing-pages/_partials/footer.hbs
creative/landing-pages/_partials/cta-block.hbs
creative/landing-pages/_partials/pricing-cards.hbs
creative/landing-pages/_partials/faq.hbs
creative/landing-pages/.env.example
creative/landing-pages/sitemap.xml          (stub — all 12 URLs with placeholder lastmod)
creative/landing-pages/robots.txt
creative/landing-pages/llms.txt             (stub)
```

**Modifies (exact location):**
```
creative/landing-pages/netlify.toml
  → Remove enterprise redirect
  → Add new page redirects for: /pricing, /legal/*, /vs/*, /about, /grievance, /demo
  → Add security headers (HSTS, CSP, X-Frame-Options)
```

**Does NOT touch:** Any LP HTML files (those are PR-I)

---

## BATCH 2 — Day 2 (3 parallel PRs — after ALL Batch 1 PRs merge)

### PR-E: Analytics Layer
**Branch:** `cursor/pr-2e-analytics-layer-8e67`
**Source tasks:** ZEE-003
**Parallel with:** PR-F, PR-G
**Depends on:** PR-C merged (CookieConsentBanner must exist)

**Creates (new files only):**
```
agency-app/web/src/lib/analytics.ts
creative/landing-pages/_partials/head-analytics.hbs
agency-app/api/lib/posthog.js
```

**Modifies (exact location):**
```
agency-app/web/src/main.tsx
  → Add PostHog init (import analytics.ts; call initAnalytics())
  → Add Sentry init
agency-app/web/src/App.tsx
  → In initAuth callback: add identifyUser(userId, traits) call after auth confirmed
```

**Does NOT touch:** `agency-app/api/server.js`, any pages

---

### PR-F: Billing Webhook + OpenClaw Concierge
**Branch:** `cursor/pr-2f-billing-webhook-8e67`
**Source tasks:** ZEE-004
**Parallel with:** PR-E, PR-G
**Depends on:** Batch 1 merged (server route patterns established)

**Creates (new files only):**
```
agency-app/api/routes/billing.js
agency-app/api/routes/aiEmployeeStatus.js
agency-app/api/aiEmployeeProvisioningService.js
agency-app/api/scripts/escalation-cron.js
cron/escalate-openclaw.yaml
agency-app/web/src/pages/crm/AIEmployeeStatus.tsx
agency-app/api/middleware/apiKeyAuth.js
```

**Modifies (exact location):**
```
agency-app/api/server.js
  → {LAUNCH ROUTES IMPORTS}: add billing + aiEmployeeStatus imports
  → {LAUNCH ROUTES MOUNTS}: add /api/billing/webhook mount (MUST be before validateToken)
  →                          add /api/ai-employee route mount (after auth middleware)
agency-app/web/src/App.tsx
  → {LAUNCH PROTECTED ROUTES}: add /integrations/ai-employee route
```

---

### PR-G: Security Audit
**Branch:** `cursor/pr-2g-security-audit-8e67`
**Source tasks:** ZEE-010
**Parallel with:** PR-E, PR-F
**Depends on:** Batch 1 merged (all routes must exist)

**Creates (new files only):**
```
tests/cross-tenant-pentest.spec.ts
marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv
marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md
marketing-and-sales/launch-implement/pre-launch/13-security/sentry-cloudwatch-alarms.md
```

**Does NOT touch:** Any source code files

---

## BATCH 3 — Day 3 (2 parallel PRs — after ALL Batch 2 PRs merge)

### PR-H: Seat-Cap Enforcement
**Branch:** `cursor/pr-3h-seat-cap-8e67`
**Source tasks:** ZEE-005
**Parallel with:** PR-I
**Depends on:** PR-F merged (billing.js must exist for seat webhook handler addition)

**Creates (new files only):**
```
agency-app/api/subscriptionService.js
agency-app/api/routes/subscriptions.js
agency-app/web/src/components/SeatCounter.tsx
agency-app/web/src/components/SeatUpgradeModal.tsx
agency-app/api/scripts/backfill-seats-paid.js
tests/seat-cap.spec.ts
```

**Modifies (exact location):**
```
agency-app/api/server.js
  → {LAUNCH ROUTES IMPORTS}: add subscriptions import
  → {LAUNCH ROUTES MOUNTS}: add /api/subscriptions mount
agency-app/api/routes/billing.js  ← PR-F created this; PR-H adds ONE branch to existing webhook handler
  → In subscription.updated branch: add call to incrementSeatsPaid()
  → Do NOT rewrite the file — add ONE case block only
agency-app/api/routes/auth.js    ← add seat check in invite creation handler ONLY
  → Find the invite-creation POST handler
  → Add getSubscription check BEFORE invite creation
  → Return 402 with upgradeOptions if seatsUsed >= seatsPaid
agency-app/web/src/pages/admin/InviteManagement.tsx
  → Add <SeatCounter /> import + mount at top of page
  → Wrap "Invite Member" button: disable when at cap + open SeatUpgradeModal on 402
agency-app/web/src/pages/admin/MemberManagement.tsx
  → Same SeatCounter mount
```

---

### PR-I: Landing Pages HTML (12 pages)
**Branch:** `cursor/pr-3i-landing-pages-8e67`
**Source tasks:** ZEE-008-T2/T3, ZEE-009-T1/T2/T3
**Parallel with:** PR-H
**Depends on:** PR-C merged (cookie banner partial), PR-D merged (build pipeline + partials)

**Creates (new files — all LP HTML):**
```
creative/landing-pages/main/index.html                       (rewrite existing)
creative/landing-pages/agency-owners/index.html              (rewrite existing)
creative/landing-pages/agents/index.html                     (rewrite existing)
creative/landing-pages/ai-employee/index.html                (rewrite existing)
creative/landing-pages/demo/index.html                       (rewrite existing)
creative/landing-pages/pricing/index.html                    (NEW)
creative/landing-pages/legal/terms/index.html                (NEW)
creative/landing-pages/legal/privacy/index.html              (NEW)
creative/landing-pages/legal/refund/index.html               (NEW)
creative/landing-pages/legal/cookies/index.html              (NEW)
creative/landing-pages/vs/sell-do/index.html                 (NEW)
creative/landing-pages/vs/zoho-crm/index.html                (NEW)
creative/landing-pages/vs/excel-spreadsheet/index.html       (NEW)
creative/landing-pages/about/index.html                      (NEW)
marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/schema/*.json  (12 JSON-LD files)
marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/per-page-meta.md
marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/*.md   (5 AEO answer drafts)
```

**Modifies (allowed):**
```
creative/landing-pages/sitemap.xml       (PR-D created stub; PR-I fills real URLs + lastmod)
creative/landing-pages/llms.txt          (PR-D created stub; PR-I fills AEO answer page links)
```

**Does NOT touch:** Any `agency-app/api/` or `agency-app/web/` files

---

## BATCH 4 — Day 4 (2 parallel PRs — after ALL Batch 3 PRs merge)

### PR-J: Paywall + Trial Countdown
**Branch:** `cursor/pr-4j-paywall-trial-8e67`
**Source tasks:** ZEE-007
**Parallel with:** PR-K
**Depends on:** PR-H merged (subscriptionService must exist)

**Creates (new files only):**
```
agency-app/web/src/hooks/useSubscription.ts
agency-app/web/src/contexts/SubscriptionContext.tsx
agency-app/web/src/components/TrialCountdownBanner.tsx
agency-app/web/src/components/PaywallModal.tsx
agency-app/web/src/lib/razorpay.ts
agency-app/api/scripts/trial-reminder-cron.js
cron/trial-reminder.yaml
marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md
tests/paywall.spec.ts
```

**Modifies (exact location):**
```
agency-app/api/routes/subscriptions.js  ← PR-H created this
  → Add GET /api/subscriptions/trial-status endpoint
agency-app/web/src/App.tsx
  → {LAUNCH LAYOUT COMPONENTS}: add <TrialCountdownBanner /> + <PaywallModal />
  → Wrap authenticated routes in <SubscriptionContext.Provider>
```

---

### PR-K: NPS Modal + Backend
**Branch:** `cursor/pr-4k-nps-modal-8e67`
**Source tasks:** Day-28 NPS (P10 partial)
**Parallel with:** PR-J
**Depends on:** Batch 3 merged

**Creates (new files only):**
```
agency-app/api/routes/feedback.js
agency-app/web/src/components/NpsModal.tsx
tests/nps.spec.ts
```

**Modifies (exact location):**
```
agency-app/api/server.js
  → {LAUNCH ROUTES IMPORTS}: add feedback import
  → {LAUNCH ROUTES MOUNTS}: add /api/feedback mount
agency-app/web/src/App.tsx
  → {LAUNCH LAYOUT COMPONENTS}: add <NpsModal /> (triggers after 14 days)
  → {LAUNCH PUBLIC ROUTES}: add /nps (email link NPS landing page)
```

---

## BATCH 5 — Day 5 (1 PR — after ALL Batch 4 PRs merge)

### PR-L: Signup → Brevo Wire-up
**Branch:** `cursor/pr-5l-signup-brevo-8e67`
**Source tasks:** ZEE-013-T1 + ZEE-003-T3 (UTM capture)
**Depends on:** Batch 4 merged

**Creates (new files only):**
```
(none — all modifications to existing files)
```

**Modifies (exact location):**
```
agency-app/api/routes/auth.js
  → In the register/signup success handler: add Brevo contact POST (list: BREVO_TRIAL_LIST_ID)
  → Add PostHog server-side signup_completed event via agency-app/api/lib/posthog.js
agency-app/web/src/pages/PhoneLogin.tsx
  → On mount: read utm_source, utm_campaign, utm_medium from window.location.search
  → Store to sessionStorage keys: 'utm_source', 'utm_campaign', 'utm_medium'
  → Pass utm_source as property to trackEvent('signup_started')
agency-app/web/src/pages/RegisterAdmin.tsx (or wherever final registration completes)
  → After successful registration: call identifyUser(userId, {...traits, utm_source: sessionStorage.getItem('utm_source')})
  → Clear sessionStorage UTM keys after identify
```

---

## BATCH 6 — Day 6 (1 PR — final verification pass)

### PR-M: Day 4 Analytics Final + CI Gate
**Branch:** `cursor/pr-6m-analytics-final-ci-8e67`
**Source tasks:** ZEE-012
**Depends on:** Batch 5 merged

**Creates (new files only):**
```
.github/workflows/playwright.yml   (add analytics.spec.ts as required CI check)
marketing-and-sales/launch-implement/week-1/day-04-event-coverage.csv
```

**Modifies (exact location):**
```
tests/analytics.spec.ts   ← from PR-E; PR-M adds missing event coverage
  → Add any events from audit that aren't yet tested
```

---

## Summary Table

| PR | Batch | Day | Source Task | Key files created | Shared file touches |
|---|---|---|---|---|---|
| PR-A | 1 | 1 | ZEE-001 | seed scripts, DemoBanner | App.tsx layout block |
| PR-B | 1 | 1 | ZEE-002 | grievance route+service+pages+test | server.js + App.tsx |
| PR-C | 1 | 1 | ZEE-006 | cookie banner (LP+CRM) + test | App.tsx layout block |
| PR-D | 1 | 1 | ZEE-008-T1 | LP build pipeline + partials | netlify.toml |
| PR-E | 2 | 2 | ZEE-003 | analytics.ts + LP snippet + posthog.js | main.tsx + App.tsx |
| PR-F | 2 | 2 | ZEE-004 | billing webhook + concierge + cron | server.js + App.tsx |
| PR-G | 2 | 2 | ZEE-010 | pentest spec + audit docs | none |
| PR-H | 3 | 3 | ZEE-005 | subscriptionService + seat UI + test | server.js + billing.js + auth.js + InviteManagement + MemberManagement |
| PR-I | 3 | 3 | ZEE-008-T2+ | 12 LP HTML pages + JSON-LD schemas | sitemap.xml + llms.txt |
| PR-J | 4 | 4 | ZEE-007 | paywall + trial + cron + test | subscriptions.js + App.tsx |
| PR-K | 4 | 4 | Day-28 NPS | NPS modal + feedback route + test | server.js + App.tsx |
| PR-L | 5 | 5 | ZEE-013 | — | auth.js + PhoneLogin.tsx + RegisterAdmin.tsx |
| PR-M | 6 | 6 | ZEE-012 | CI workflow + event coverage csv | analytics.spec.ts |

---

## Merge Order Within Each Batch

Within Batch 1: Merge in this order to avoid App.tsx conflicts:
1. PR-D first (only touches netlify.toml)
2. PR-A next (adds DemoBanner to App.tsx layout block)
3. PR-C next (adds CookieConsentBanner to App.tsx layout block)  
4. PR-B last (adds Grievance routes to App.tsx)

Within Batch 2: Any order (different file areas)

Within Batch 3:
1. PR-H first (modifies billing.js and auth.js)
2. PR-I can merge anytime (no shared file touches)

Within Batch 4: Any order (different file areas)
