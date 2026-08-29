# Production Readiness — Remaining Tasks

This document tracks all issues from the pre-production audit that remain unfixed.
Last updated: 2026-06-11

> **NOTE:** This document is outdated (2026-06-11). For current deployment status, see `marketing-and-sales/launch-plan-v2/final-mvp-ready/zishan_docs/08-FINAL-IMPLEMENTATION-PLAN.md`. The `deploy.sh` script mentioned in CRIT-3 already exists, and cron jobs have been merged into `cfn-backend.yaml` (2026-06-21).

## CRITICAL (Must Fix Before Production)

### CRIT-5: Auth Service CORS is Completely Open
**File:** `reality-flow-authentication/src/app.ts:20`
**Why:** `app.use(cors())` with no origin restriction allows any website to call auth endpoints. A malicious site could embed your phone-auth flow, harvest OTPs, or abuse token exchange.
**Fix:** Replace with `cors({ origin: ALLOWED_ORIGINS.split(','), credentials: true })` and read origins from env.

### CRIT-6: Auth Service Error Handler Leaks Internal Details
**File:** `reality-flow-authentication/src/app.ts:48-50`
**Why:** `res.status(500).json({ error: 'Internal Server Error', message: err.message })` sends raw `err.message` to the client. A DB error could expose table names, credentials, or stack traces.
**Fix:** In production, return generic `"message": "An unexpected error occurred"`. Log the real error server-side only.

### CRIT-7: Auth Service Has Zero Security Headers
**File:** `reality-flow-authentication/src/app.ts`
**Why:** No `helmet`, no CSP, no `X-Frame-Options`, no `X-Content-Type-Options`. The auth service is a prime phishing target (login pages, token endpoints) but has no clickjacking or MIME-sniffing protection.
**Fix:** Add `helmet` or at minimum set `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a strict CSP.

### CRIT-3: Server Still Missing `deploy.sh`
**File:** New `server/infra/deploy.sh`  
**Why:** Global rules (`.windsurfrules`) mandate a `deploy.sh` script. The server currently has no build or deploy automation.  
**Fix:** Create `deploy.sh` per global rules: validate env, `npm ci && npm run build`, zip, upload to S3, generate `cfn-params.json`, `aws cloudformation deploy`.

---

## HIGH (Should Fix Before Production)

### HIGH-1: RBAC Missing on CRM Routes
**Files:** `server/routes/crm.js`, `server/routes/contacts.js`, `server/routes/leads.js`, `server/routes/buyers.js`, etc.  
**Why:** Only `grievance.js` admin endpoints use `requireAdmin`. All other CRM endpoints (create property, delete contact, etc.) are accessible to any authenticated user with a valid token — including MEMBERs who should not be able to modify data.  
**Fix:** Audit every CRM route. Apply `requireAdmin` or `requireAdminOrManager` to destructive/mutating operations. Read-only endpoints can remain open to all authenticated users.

### HIGH-2: Cron YAML Files Use Invalid CloudFormation Syntax
**Files:** `cron/escalate-openclaw.yaml`, `cron/trial-reminder.yaml`, `cron/reset-demo.yaml`  
**Why:** `CodeUri: ../server/scripts/` is not valid CFN. `Environment` variables use wrong nesting. Deployment will fail.  
**Fix:** Rewrite each as valid CloudFormation YAML with S3 `Code` references, proper `Environment.Variables`, explicit IAM roles, and `!Ref` / `!GetAtt` where needed.

### HIGH-5: Auth Service Public Endpoints Have No Rate Limiting
**Files:** `reality-flow-authentication/src/routes/phoneAuth.ts`, `src/routes/auth.ts`
**Why:** `POST /auth/phone/start`, `POST /auth/phone/confirm`, and `POST /auth/token` have zero rate limiting. An attacker can spam OTP initiation (costing you Cognito SMS charges) or brute-force OTP confirmation.
**Fix:** Add `express-rate-limit` per IP. Stricter limits on `/auth/phone/start` (e.g., 3 per 15 min) and `/auth/phone/confirm` (e.g., 5 per 15 min).

### HIGH-6: Internal API Key Comparison Vulnerable to Timing Attack
**File:** `reality-flow-authentication/src/routes/internal.ts:20`
**Why:** `if (provided !== expected)` uses string comparison which short-circuits on first mismatch. An attacker measuring response times could brute-force the `INTERNAL_API_KEY` byte-by-byte.
**Fix:** Use `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))`.

### HIGH-7: Auth Service Uses `console.log` Instead of Structured Logger
**Files:** 15 auth service files, 81+ instances (worst: `phoneAuthCustomController.ts` with 21)
**Why:** `console.log`/`console.error` in Lambda → unstructured CloudWatch logs. No correlation IDs, no log levels, no filtering. Makes debugging and alerting impossible at scale.
**Fix:** Replace with the existing `src/utils/logger.ts` (or add `pino`/`winston`) and use `logger.info()` / `logger.error()` with context objects.

### HIGH-3: PostHog Lambda Flush Risk
**File:** `server/lib/posthog.js`  
**Why:** `flushAt: 1, flushInterval: 0` forces immediate flush, but Lambda may freeze/exit before async flush completes. Events are silently lost.  
**Fix:** Remove aggressive flush settings. Add `await shutdownPostHog()` in `lambda-handler.js` after each invocation. Consider buffering events in memory and flushing at end of handler.

---

## MEDIUM (Fix After Initial Deploy)

### MED-2: `rateLimiter.js` `setInterval` Wastes Lambda Resources
**File:** `server/middleware/rateLimiter.js`  
**Why:** The cleanup `setInterval` runs every 5 minutes in Lambda, keeping the container warm and using CPU for no reason. The `Map` also grows unbounded across invocations in the same container.  
**Fix:** Switch to a time-windowed cleanup in the middleware itself (check `resetAt` on every request) or use `express-rate-limit` package instead of custom implementation.

### MED-3: `countUsersByTenant` Counts Suspended Users
**File:** `reality-flow-authentication/src/models/usersModel.ts`  
**Why:** The query uses `Select: 'COUNT'` without `FilterExpression: '#status = :active'`. Suspended or inactive users still count against the seat cap. This is conservative but may confuse admins.  
**Fix:** Add `FilterExpression` to only count `ACTIVE` users, or document the behavior clearly.

### MED-7: Auth Service Error Response Format Inconsistent
**File:** `reality-flow-authentication/src/utils/http.ts`
**Why:** `forbidden()` returns `{ error, code, message }` but `badRequest()`, `unauthorized()`, `notFound()`, `conflict()`, `internalError()` return `{ error, message }`. Frontend error handling must special-case the `403` shape.
**Fix:** Standardize all helpers to `{ error, message, code? }` or adopt the same schema everywhere.

---

## LOW (Nice to Have)

### LOW-1: Add Sentry Node.js to Backend
**Why:** Frontend has Sentry React, but backend has no error tracking. Production crashes are invisible.  
**Fix:** Add `@sentry/node` to `server/package.json`, initialize in `server.js`, capture exceptions in `errorHandler`.

### LOW-2: Add Billing State Transition Audit Table
**Why:** No record of who/when subscription state changed. Hard to debug billing disputes.  
**Fix:** Create `AuditLog` table. Log every `incrementSeatsPaid`, `createTrialSubscription`, and webhook state change with before/after values.

### LOW-3: Add CloudWatch Alarms to CloudFormation
**Why:** No automated alerting for Lambda errors, high latency, or DynamoDB throttling.  
**Fix:** Add `AWS::CloudWatch::Alarm` resources to `server/infra/cfn-backend.yaml` for Lambda errors (>5 in 5 min) and API Gateway 5xx (>1% in 5 min).

### LOW-4: Standardize Error Response Format
**Why:** Some routes return `{ error: string }`, others return `{ error: string, details: string }`, others return `{ error: string, message: string }`. Inconsistent for frontend error handling.  
**Fix:** Adopt a single format: `{ error: string, message?: string, requestId?: string }`.

---

## Already Fixed (For Reference)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Missing `better-sqlite3` dependency | Deleted legacy `database.js` |
| 2 | Billing webhook after `express.json()` | Moved router mount before parser |
| 3 | Seat cap bypass in auth service | Added `countUsersByTenant` + `getSubscription` checks |
| 4 | Webhook idempotency race condition | `logEventIfNotProcessed` with `ConditionExpression` |
| 5 | Webhook returns 200 on internal errors | Returns 500; retry-safe duplicate check |
| 6 | Stale `recomputeSeatsUsed` | Added live auth-service call with fallback |
| 7 | Auth invite missing seat check | Same fix as #3 |
| 9 | `subscription.updated` NaN risk | Added `typeof === 'number'` validation |
| 10 | Demo reset destructive | Added tenant whitelist, no spawn in Lambda |
| 13 | `validateToken` named import crash | Changed to default import in `auth.js` |
| 14 | Legacy JWT middleware | Deleted `auth.js`, `check-jwt-config.js`, `update-jwt-secret.js` |
| 16 | Escalation email template misuse | Split founder vs customer template IDs |
| 17 | Missing env vars | Updated both `.env.example` files |
| 18 | `react-router-dom` type mismatch | Removed `@types/react-router-dom` v5 |
| 19 | CORS too permissive | Added origin allowlist |
| 20 | Grievance RBAC broken | Replaced broken inline check with `requireRole` |
| **CRIT-0** | Root-level `node_modules` / `package.json` | Deleted accidental root-level files |
| **CRIT-1** | `SUBSCRIPTIONS_TABLE` not in auth config | Added `SUBSCRIPTIONS_TABLE` to Zod schema in `config.ts` |
| **CRIT-2** | Auth service missing `/internal/users/count` | Created `src/routes/internal.ts` with API-key protected endpoint |
| **CRIT-4** | Server has no `build` script | Added `scripts/build.sh` + `"build"` to `package.json` |
| **HIGH-4** | `incrementSeatsPaid` lacks row existence check | Added `ConditionExpression: 'attribute_exists(tenantId)'` |
| **MED-1** | `console.error` in CRM routes unstructured | Replaced 30+ `console.error` with `logger.error()` in `crm.js` |
| **MED-4** | `recomputeSeatsUsed` no retry on network failure | Added 1 retry with 1-second backoff before fallback |
| **MED-5** | Trial reminder redundant FilterExpression | Simplified to `paymentStatus = :trialing` |
| **MED-6** | `escalation-cron` inline PostHog stub | Imported centralized `serverTrack` + `shutdownPostHog` from `lib/posthog.js` |
| **MED-8** | `validateToken.js` doesn't forward `x-request-id` | Added `x-request-id` header propagation to auth service axios call |

---

## Parallel Changes (Added During This Session — No Action Needed)

The following files were added in parallel and are good additions:
- `reality-flow-authentication/src/utils/logger.ts` — structured logger for auth service
- `reality-flow-authentication/src/utils/cookies.ts` — refresh token cookie helper
- `reality-flow-authentication/src/middleware/requireAuth.ts` — Cognito auth middleware
- `server/middleware/validateBody.js` — generic Zod body validation middleware
- `server/validation/crmSchemas.js` + `otherSchemas.js` — request validation schemas
- `server/middleware/csp.js` — Content Security Policy middleware
- `server/middleware/rateLimiter.js` — in-memory rate limiter (see MED-2 for Lambda concerns)

These files are compatible with all security fixes and don't require changes.

---

## How to Use This TODO

1. **Before production:** Fix all CRITICAL and HIGH items.
2. **Week 1 post-launch:** Fix all MEDIUM items.
3. **Month 1 post-launch:** Address LOW items during normal maintenance.
4. **After each fix:** Update this file — move items to "Already Fixed" and note the commit hash.
