# Phase 2 — Code Validation Audit

**Branch:** `auth_rbac_feature` @ `5890183`
**Method:** static review of `server/`, `real-estate-crm-app/`, `reality-flow-authentication/`, `tests/`. Findings reference exact files/lines verified during the audit.

Legend: ✅ verified working · ⚠️ partial / risk · ❌ broken or missing.

---

## A. Authentication

| Area | Status | Evidence / Notes |
|---|---|---|
| Signup (self-serve) | ✅ | `PhoneLogin.tsx` → OTP → `RoleSelection` → `RegisterAdmin`; `reality-flow-authentication` `phoneAuthCustomController.onboard` registers admin/member. UTM captured to `sessionStorage`. |
| Signin | ✅ | Phone OTP via Cognito custom auth (`phoneAuthCustomController`). |
| Logout | ✅ | `resetAnalytics()` clears PostHog + `Sentry.setUser(null)` (`analytics.ts:39`). |
| Password reset / OAuth | ✅ | Delegated to Cognito-managed flows in auth microservice. |
| Tenant isolation | ✅ | `extractTenantId` (`tenantMiddleware.js`) + `validateToken` set `req.tenantId`; DDB queries scoped by tenant. `tests/playwright/api/cross-tenant-pentest.spec.ts` exists. |
| Session handling | ✅ | `validateToken` caches validated tokens 5s (`CACHE_TTL_MS`), 3s upstream timeout, fails closed on error → 401/500. |
| Token validation source | ✅ | `validateToken.js` calls `AUTH_SERVICE_URL/auth/me`; requires `Bearer`; rejects missing `tenantId`. |

**No auth blockers.** One note: token cache is per-Lambda-instance in-memory (acceptable; 5s TTL bounds revocation window).

---

## B. RBAC

| Area | Status | Evidence / Notes |
|---|---|---|
| Route protection | ✅ | `requireRole(...roles)` returns 401 if no `req.user`, 403 otherwise; logs `rbac.denied` with path/tenant (`requireRole.js`). |
| Role inheritance | ✅ | `requireAdmin = requireRole('ADMIN','FOUNDER','OWNER')`; `requireAdminOrManager`. Explicit role sets (no implicit hierarchy — acceptable and predictable). |
| API authorization | ✅ | Admin routes gate via `validateToken + requireAdmin` (e.g. grievance admin endpoints). |
| Permission checks | ✅ | Performed server-side after token validation; client role checks are UX-only. |
| Privilege escalation | ⚠️ | **BUG-009** — seat-cap is enforced only via opt-in `POST /api/subscriptions/check-seat`; the authoritative invite-creation handler (`reality-flow-authentication` `createInviteHandler`) checks ADMIN role but **not** seat cap. A scripted ADMIN can exceed paid seats. Not an auth-escalation, but a billing-integrity / defense-in-depth gap. P1. |

---

## C. Backend

| Area | Status | Evidence / Notes |
|---|---|---|
| Validation | ✅ | `middleware/validateBody.js` + `zod`; grievance/feedback validate inputs. |
| Error handling | ✅ | Central error middleware in `server.js`; routes return `{ error, message }`; `validateToken` catch → 500 with safe body. |
| Transaction safety | ⚠️ | DDB single-item writes are atomic; multi-step flows (webhook → provisioning → seat increment) are **not** wrapped in a transaction and rely on idempotency (`webhookLogService.logEventIfNotProcessed`). Acceptable for launch; documented. P2. |
| Logging | ✅ | `server/logger.js` structured logs; `requestLogger.js` correlation IDs from `x-request-id`. |
| Billing webhook integrity | ✅ (with hardening) | `routes/billing.js` mounted before `express.json()` (`server.js:70`); uses `express.raw`, HMAC-SHA256 over raw body, replay window 5 min. **Hardening applied in Phase 6:** signature compare changed from `!==` to `crypto.timingSafeEqual` to remove a timing side-channel. |

---

## D. Frontend

| Area | Status | Evidence / Notes |
|---|---|---|
| Broken pages | ✅ none found | All routed pages resolve to components; LAUNCH route blocks wired in `App.tsx`. |
| Missing routes | ⚠️ | Public marketing site has a `/grievance` redirect in `netlify.toml` with **no target page** (BUG-008) → 404 on LP deploy. P1. |
| Missing API integrations | ✅ | CRM pages call `VITE_API_URL`; auth via `VITE_AUTH_API_URL`. |
| Loading / error states | ✅ | Trial/paywall guards, grievance success/error states present. |
| Analytics instrumentation | ⚠️ | **BUG-007** — `trackEvent` present in only 4 pages; paywall/NPS/demo/`otp_verified` events missing. Funnel data incomplete. P1. |
| DPDP on marketing site | ❌ | **BUG-004** — LP `index.html` pages are standalone HTML and do **not** include `{{> cookie-banner}}` / `{{> head-analytics}}`. Built `dist/` has zero `posthog`/`cookieConsent`/`gtag`. No cookie consent on the public site. **P0 blocker.** |

---

## E. Database

| Area | Status | Evidence / Notes |
|---|---|---|
| Migrations / IaC | ✅ | `server/infra/launch-tables-cfn.yaml` defines all 7 launch tables (`Grievances`, `AIEmployeeProvisioning`, `WebhookLog`, `TenantApiKeys`, `Subscriptions`, `NPSResponses`, `BetaInvites`). |
| Indexes (GSIs) | ✅ | GSIs declared per table in the CFN template. |
| Constraints | ✅ | `BillingMode: PAY_PER_REQUEST`, PITR enabled, TTL on `WebhookLog`. |
| Seed scripts | ✅ | `server/scripts/seed-demo-tenant.js` / `reset-demo-tenant.js` (idempotent). |
| Provisioning | ⚠️ | Tables exist only as IaC — must be `cloudformation deploy`-ed (human, INFRA-01). Fresh env throws `ResourceNotFoundException` until deployed. P0 (ops). |

---

## F. Security

| Area | Status | Evidence / Notes |
|---|---|---|
| Secrets handling | ✅ | All secrets via env (`RAZORPAY_WEBHOOK_SECRET`, `BREVO_API_KEY`, `POSTHOG_KEY_SERVER`, `AUTH_SERVICE_URL`); none committed. `.env.example` documents them. |
| JWT / token validation | ✅ | Cognito tokens validated server-side via auth microservice; no client-trusted claims for authz. |
| RBAC bypasses | ⚠️ | Seat-cap bypass at invite API (BUG-009) — billing integrity, P1. No auth/role bypass found. |
| Webhook signature | ✅ (hardened) | HMAC verify present; timing-safe compare added in Phase 6. |
| XSS | ✅ | React escapes by default; grievance/admin render text, no `dangerouslySetInnerHTML` in audited paths. LP partials inject only build-time numeric/string IDs. |
| CSRF | ✅ | Token-based auth (Authorization header), not cookie-session — CSRF surface minimal. Webhook protected by HMAC. |
| Injection | ✅ | DynamoDB document client (parameterized); no string-built queries. |
| CORS | ✅ | `server.js:50` allowlist from `ALLOWED_ORIGINS`; commit `8079683` removed wildcard from app layer. Note: `utils/response.js` Lambda fallback still emits `*` for error responses — acceptable for non-credentialed API, flagged P2 to align with allowlist. |
| Rate limiting | ⚠️ | `middleware/rateLimiter.js` is in-memory per instance (100/min/IP); grievance route has its own 6/hr limiter. Under Lambda concurrency this is per-container, not global — recommend WAF / API Gateway throttling for production (INFRA-04). P2. |

---

## Verified-fixed (previously P0) items

These were P0 in `coding-agent-brief/bugs/` but are confirmed resolved on this branch:

- **BUG-001** billing webhook ordering — fixed (`server.js:70` before `express.json()` at `:72`).
- **BUG-002** `incrementSeatsPaid` stub — fixed (`billing.js:6` imports real service; called at `:258`).
- **BUG-003** `tests/analytics.spec.ts` — present and discovered by CI (`playwright.yml` runs `tests/*.spec.ts`).
- **BUG-005** 7 launch tables — present in `launch-tables-cfn.yaml` (deploy remains a human op).

## Open code defects (carried to Phase 6)

| Ref | Severity | Fix in this PR? |
|---|---|---|
| BUG-004 LP analytics + cookie consent | **High (P0)** | ✅ Yes |
| BUG-006 grievance PostHog stub | Medium (P1) | ✅ Yes |
| BUG-007 event instrumentation | Medium (P1) | ✅ Key funnel events |
| BUG-008 LP `/grievance` 404 | Medium (P1) | ✅ Yes |
| BUG-010 server Lambda Sentry | Medium (P1/P2) | ✅ Yes (env-guarded) |
| Billing timing-safe compare | Low | ✅ Yes |
| BUG-009 invite seat enforcement | High (P1) | ⚠️ Documented — cross-service, not safely testable here |
