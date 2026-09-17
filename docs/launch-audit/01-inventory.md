# Phase 1 — Launch Inventory

**Branch:** `auth_rbac_feature`
**Audit date:** 2026-06-13
**Auditor:** Devin (Launch Readiness Audit)
**HEAD:** `5890183` (Merge `pending-tasks-consolidation`: consent tracking, PostHog analytics, trial subscription guards)

> **NOTE:** This document reflects the state before cron jobs were merged into `cfn-backend.yaml` (2026-06-21). For current deployment, see `marketing-and-sales/launch-plan-v2/final-mvp-ready/zishan_docs/08-FINAL-IMPLEMENTATION-PLAN.md`. The cron files referenced here (`cron/*.yaml`) are now obsolete — all cron resources are in the unified template.

This inventory consolidates the launch-plan documentation (`team-work`, `pending-tasks`, `updated-files`, `coding-agent-brief`) with the actual state of the code on `auth_rbac_feature`. Every status is verified against the code, not just the docs — where docs and code disagree, the **code** is treated as ground truth and called out in the Evidence column.

## Status legend

| Status | Meaning |
|---|---|
| COMPLETE | Implemented and verified present in code on this branch |
| PARTIALLY_COMPLETE | Some sub-tasks done; launch-critical gap remains |
| NOT_STARTED | No implementation found |
| BLOCKED | Cannot be completed by a coding agent (human/vendor/infra dependency) |
| OBSOLETE | Superseded or no longer required for launch |

## Launch criticality

`P0` = launch blocker (must ship) · `P1` = should ship · `P2` = post-launch.

---

## 1. Engineering deliverables (PR-A … PR-M)

Source: `coding-agent-brief/02-PR-SCHEDULE.md`, `coding-agent-brief/AUDIT-REPORT.md`, `team-work/ZEESHAN-tasks.md`.

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| PR-A Demo environment (seed/reset/cron/DemoBanner) | Zeeshan | COMPLETE | `agency-app/api/scripts/seed-demo-tenant.js`, `reset-demo-tenant.js`, `cron/reset-demo.yaml`, `components/DemoBanner.tsx` present | Demo Cognito pool (INFRA-02, founder) | P1 |
| PR-B Grievance flow (public form + admin triage) | Zeeshan | PARTIALLY_COMPLETE | Route/service/UI present; `grievance.js` still uses a local PostHog **stub** (BUG-006) | `Grievances` table (INFRA-01) | P0 (DPDP) |
| PR-C Cookie consent banners (LP + CRM) | Zeeshan | PARTIALLY_COMPLETE | `CookieConsentBanner.tsx` + `_partials/cookie-banner.html` present; **LP banner not injected into LP pages** (BUG-004) | — | P0 (DPDP) |
| PR-D LP build pipeline + SEO stubs | Zeeshan | COMPLETE | `creative/landing-pages/build/*`, partials, `sitemap.xml`, `robots.txt`, `llms.txt`, `netlify.toml` present | — | P1 |
| PR-E Analytics layer (PostHog + Sentry) | Zeeshan | PARTIALLY_COMPLETE | `lib/analytics.ts`, `agency-app/api/lib/posthog.js`, CRM Sentry present; **server Lambda Sentry missing** (BUG-010); event coverage partial (BUG-007) | — | P1 |
| PR-F Razorpay billing webhook | Zeeshan | COMPLETE | `routes/billing.js` mounted **before** `express.json()` (`server.js:70`); real `incrementSeatsPaid` imported (`billing.js:6,258`) | `WebhookLog`/`Subscriptions`/`AIEmployeeProvisioning` tables | P0 |
| PR-G Security audit (CORS, rate-limit, error handling) | Zeeshan | COMPLETE | `middleware/{rateLimiter,csp,requestLogger,validateBody,apiKeyAuth}.js`; commit `8079683` security fixes | — | P0 |
| PR-H Seat-cap subscription service | Zeeshan | PARTIALLY_COMPLETE | `subscriptionService.js` + `POST /api/subscriptions/check-seat` present; **not enforced at invite API** (BUG-009) | `Subscriptions` table | P1 |
| PR-I Landing pages (14 pages + JSON-LD) | Zeeshan | PARTIALLY_COMPLETE | 14 `index.html` present, but **standalone HTML** — no analytics/consent partials (BUG-004); no `grievance/` LP page (BUG-008) | LP `.env` values (DEPLOY-02) | P0 (DPDP) |
| PR-J Paywall + trial cron | Zeeshan | PARTIALLY_COMPLETE | `PaywallModal.tsx`, `TrialCountdownBanner.tsx`, trial guards present; no `trackEvent` on paywall (BUG-007) | `Subscriptions` table | P1 |
| PR-K NPS modal + feedback route | Zeeshan | PARTIALLY_COMPLETE | `NpsModal.tsx`, `routes/feedback.js` present; no `trackEvent` on NPS (BUG-007) | `NPSResponses` table | P1 |
| PR-L Signup → Brevo post-registration | Zeeshan | COMPLETE | `routes/auth.js` post-registration with `serverTrack('signup_completed')` | Brevo API key | P1 |
| PR-M Analytics final + CI workflow | Zeeshan | COMPLETE | `.github/workflows/playwright.yml`; `tests/analytics.spec.ts` now present | — | P0 |

---

## 2. Authentication & RBAC

Source: branch name, `agency-app/api/middleware/`, `platform/auth/`.

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| Token validation middleware | Zeeshan | COMPLETE | `agency-app/api/middleware/validateToken.js` calls `AUTH_SERVICE_URL/auth/me`, 5s cache, sets `req.user`/`req.tenantId` | `AUTH_SERVICE_URL` env | P0 |
| RBAC role gate | Zeeshan | COMPLETE | `agency-app/api/middleware/requireRole.js` — `requireRole()`, `requireAdmin` (ADMIN/FOUNDER/OWNER), 401/403 + `rbac.denied` log | — | P0 |
| Tenant isolation | Zeeshan | COMPLETE | `extractTenantId` from `tenantMiddleware.js`; routes scope DDB by `tenantId`; pentest spec exists | — | P0 |
| Auth microservice (signup/signin/OTP/invites) | Zeeshan | COMPLETE | `platform/auth/src/controllers/{authController,phoneAuthCustomController,inviteController}.ts` | Cognito pool | P0 |
| Seat-cap at invite creation API | Zeeshan | NOT_STARTED | `inviteController.createInviteHandler` enforces ADMIN only — no seat check (BUG-009) | Subscriptions data access from auth svc | P1 |
| Password reset / OAuth | Zeeshan | COMPLETE | Cognito-managed flows in `reality-flow-authentication` | Cognito config | P1 |

---

## 3. Backend / API

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| Express entry + route mounting | Zeeshan | COMPLETE | `agency-app/api/server.js`; tagged LAUNCH ROUTES blocks present | — | P0 |
| Public routes rate-limited | Zeeshan | COMPLETE | `grievance.js` (6/hr/IP), `billing.js` webhook, `publicAreas.js`, `aiCallingInternal.js` | — | P0 |
| Input validation | Zeeshan | COMPLETE | `middleware/validateBody.js` + `zod` dep | — | P1 |
| Structured logging | Zeeshan | COMPLETE | `agency-app/api/logger.js`, `requestLogger.js` | — | P1 |
| Server error tracking (Sentry) | Zeeshan | NOT_STARTED | No Sentry in `lambda-handler.js`; `@sentry/node` not in `agency-app/api/package.json` (BUG-010) | `SENTRY_DSN_SERVER` env | P1 |

---

## 4. Frontend (CRM SPA)

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| Router + ProtectedRoute + auth state machine | Zeeshan | COMPLETE | `App.tsx` with LAUNCH route/layout tagged blocks | — | P0 |
| Self-serve signup funnel | Zeeshan | COMPLETE | `PhoneLogin.tsx`, `RegisterAdmin.tsx`, `RoleSelection.tsx`; consent checkbox + UTM capture | — | P0 |
| Cookie consent (CRM) | Zeeshan | COMPLETE | `CookieConsentBanner.tsx` (2-toggle) mounted in `App.tsx` | — | P0 (DPDP) |
| Analytics event instrumentation | Zeeshan | PARTIALLY_COMPLETE | `trackEvent` only in 4 pages; paywall/NPS/demo events missing (BUG-007) | — | P1 |
| Grievance public + admin pages | Zeeshan | COMPLETE | `pages/public/Grievance.tsx`, `pages/admin/GrievanceList.tsx` | — | P0 |

---

## 5. Database / migrations

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| 7 launch DDB tables (IaC) | Zeeshan | COMPLETE | `agency-app/api/infra/launch-tables-cfn.yaml` — all 7 tables, PITR, GSIs, WebhookLog TTL | Founder `cloudformation deploy` (INFRA-01) | P0 |
| Single-table conventions | Zeeshan | COMPLETE | `awsClientWrapper.js`, `crmDynamodbService.js` | — | P0 |
| Tables provisioned in AWS | Founder | BLOCKED | IaC ready; deploy is a human AWS task | AWS account | P0 |

---

## 6. Infrastructure / CI-CD / deployment

| Task | Owner | Status | Evidence | Blocking dependency | Criticality |
|---|---|---|---|---|---|
| Backend CFN stack | Zeeshan | COMPLETE | `agency-app/api/infra/cfn-backend.yaml`, `launch-tables-cfn.yaml`, `deploy.sh` | AWS creds | P0 |
| Netlify config (LP + CRM) | Zeeshan | PARTIALLY_COMPLETE | `netlify.toml` redirects incl. `/grievance` but no target page (BUG-008) | Netlify env vars (DEPLOY-02) | P1 |
| CI workflow (Playwright) | Zeeshan | COMPLETE | `.github/workflows/playwright.yml` builds CRM + runs specs | — | P0 |
| Server lint/test scripts | Zeeshan | NOT_STARTED | `agency-app/api/package.json` has no `lint`/`test` scripts | — | P2 |
| Demo cron deploy / WAF / CloudWatch / DNS | Founder | BLOCKED | `pending-tasks/01-infra-setup.md` INFRA-02–07 human tasks | AWS/Cloudflare consoles | P1 |

---

## 7. Documentation / launch-plan files

| Task | Owner | Status | Evidence | Criticality |
|---|---|---|---|---|
| Coding-agent brief + PR schedule | Zeeshan | COMPLETE | `coding-agent-brief/**` | n/a |
| Post-merge bug backlog | Zeeshan | COMPLETE | `coding-agent-brief/bugs/BUG-001…010.md` | n/a |
| Pending-tasks execution report | Zeeshan | COMPLETE | `PENDING-TASKS-EXECUTION-REPORT.md` | n/a |
| Team-work trackers (FOUNDER/MADHU/ZEESHAN) | All | PARTIALLY_COMPLETE | Some checkboxes ahead of code (BUG-003/007/009/010 noted) | n/a |

---

## Summary of open launch-critical items (carried into Phases 2–6)

| Ref | Item | Status | Criticality |
|---|---|---|---|
| BUG-001 | Billing webhook before `express.json()` | **FIXED on branch** | P0 |
| BUG-002 | `incrementSeatsPaid` wired to real service | **FIXED on branch** | P0 |
| BUG-003 | `tests/analytics.spec.ts` exists + in CI | **FIXED on branch** | P0 |
| BUG-005 | 7 launch tables in CFN | **FIXED on branch** (deploy = human) | P0 |
| BUG-004 | LP pages missing analytics + cookie consent | **OPEN** | P0 |
| BUG-008 | LP `/grievance` redirect has no page (404) | **OPEN** | P1 |
| BUG-006 | `grievance.js` PostHog stub | **OPEN** | P1 |
| BUG-007 | Incomplete P10 event instrumentation | **OPEN** | P1 |
| BUG-010 | Server Lambda Sentry missing | **OPEN** | P1/P2 |
| BUG-009 | Seat-cap not enforced at invite API | **OPEN** | P1 |

The single remaining **P0 code blocker** is BUG-004 (DPDP cookie consent + analytics absent from the public marketing site). All other P0 bugs from the original backlog were resolved by the `pending-tasks-consolidation` merge and are re-verified in Phase 2.
