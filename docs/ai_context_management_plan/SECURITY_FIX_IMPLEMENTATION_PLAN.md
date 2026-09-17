# Security Fix Implementation Plan

> Generated: Jun 11, 2026  
> Scope: All findings from the `auth_rbac_feature` branch security audit  
> Estimated Effort: 3–4 engineering days  
> Risk: HIGH — touches auth, billing, and data-access paths. Test thoroughly.

---

## Phase 1: Critical Auth & Security Fixes (Day 1)

### 1.1 CRIT-1 + CRIT-3 — Remove Production Auth Bypass + Add Global Middleware

**Files:**
- `platform/auth/src/utils/cognito.ts`
- `platform/auth/src/middleware/requireAuth.ts` (NEW)
- `platform/auth/src/app.ts`

**Actions:**
1. Create `requireAuth.ts` middleware that calls `extractClaims(req)` and returns 401 on failure.
2. Update `extractClaims` to only allow `x-cognito-claims` header fallback when `process.env.NODE_ENV === 'development'`.
3. In `app.ts`, add `requireAuth` to all protected routes (`/invites`, `/users`, and protected `/auth` sub-routes).

**Acceptance Criteria:**
- [ ] `curl -H "x-cognito-claims: {...}"` to prod protected routes returns 401
- [ ] Local dev with `x-cognito-claims` still works

---

### 1.2 CRIT-4 — Add Audience Validation to Local Auth Middleware

**File:** `platform/auth/src/middleware/authMiddleware.ts`

**Action:** Add `audience: config.COGNITO_CLIENT_ID` to `jwt.verify()` options.

**Acceptance Criteria:**
- [ ] Token for a different app client in the same pool is rejected

---

### 1.3 CRIT-2 — Fix Billing Webhook Body Parsing Order

**File:** `agency-app/api/server.js`

**Action:** Move `app.use('/api/billing', billingRoutes)` to **before** `app.use(express.json())`.

**Acceptance Criteria:**
- [ ] Razorpay HMAC verification succeeds on valid webhooks
- [ ] Other routes still receive parsed JSON

---

### 1.4 CRIT-5 — Move Refresh Tokens to httpOnly Cookies

**Files:**
- `platform/auth/src/controllers/tokenController.ts`
- `agency-app/web/src/utils/authStorage.ts`
- `agency-app/web/src/services/api.ts`

**Actions:**
1. In `exchangeToken` and `refreshToken`, set `res.cookie('refresh_token', ..., { httpOnly: true, secure: true, sameSite: 'strict' })`.
2. Do NOT return `refresh_token` in JSON response.
3. In frontend, remove `localStorage.setItem('auth_refresh_token', ...)`.
4. In `api.ts` refresh logic, use `credentials: 'include'` instead of sending refresh token in body.

**Acceptance Criteria:**
- [ ] `localStorage` contains no refresh token
- [ ] Token refresh works via cookie

---

### 1.5 CRIT-6 — Remove Hardcoded NPS HMAC Secret

**File:** `agency-app/api/routes/feedback.js`

**Action:** Change fallback to throw on startup:
```javascript
const NPS_HMAC_SECRET = process.env.NPS_HMAC_SECRET;
if (!NPS_HMAC_SECRET) throw new Error('NPS_HMAC_SECRET required');
```

---

### 1.6 CRIT-7 — Add Input Validation to CRM Update Endpoints

**Files:**
- `agency-app/api/routes/crm.js`
- `agency-app/api/crmDynamodbService.js`
- `agency-app/api/routes/buyers.js`, `agency-app/api/routes/khata.js`, `agency-app/api/routes/enquiries.js`, `agency-app/api/routes/notifications.js`

**Actions:**
1. `cd server && npm install zod`
2. Create `agency-app/api/validation/crmSchemas.js` with Zod schemas for each entity.
3. In each update route, parse `req.body` with Zod `.safeParse()` before passing to DB.
4. In DynamoDB service, reject updates to forbidden keys: `PK, SK, tenantId, EntityType, createdAt, createdBy`.

**Acceptance Criteria:**
- [ ] `PUT /api/crm/customers/:id` with `{"tenantId": "evil"}` returns 400
- [ ] Valid updates still work

---

### 1.7 CRIT-8 — Fix B2B Leads to Use Server-Derived TenantId

**File:** `agency-app/api/routes/b2bLeads.js:168-191`

**Action:** Replace `req.headers['x-tenant-id']` with `req.tenantId`.

**Acceptance Criteria:**
- [ ] Changing `x-tenant-id` header does not affect returned leads

---

### 1.8 CRIT-9 — Remove bodyTenantId Fallback in Post-Registration

**File:** `agency-app/api/routes/auth.js:16-21`

**Action:** Remove `|| bodyTenantId` fallback. Return 400 if `req.tenantId` is missing.

---

## Phase 2: High Severity Fixes (Day 2)

### 2.1 HIGH-1 — Restrict CORS Origin

**File:** `agency-app/api/server.js`

**Action:** Replace `origin: '*'` with an allowlist from `ALLOWED_ORIGINS` env var.

---

### 2.2 HIGH-2 — Fix API Key Auth to Use Query

**File:** `agency-app/api/middleware/apiKeyAuth.js`

**Action:** Replace `ScanCommand` with `QueryCommand` on a `KeyHashIndex` GSI. Add rate limiting.

---

### 2.3 HIGH-3 — Add Rate Limiting to CRM Routes

**File:** `agency-app/api/server.js` (or new middleware)

**Action:** Add `express-rate-limit` at 200 req/min per IP for all `/api` routes.

---

### 2.4 HIGH-4 — Remove console.log from Auth Flows

**Files:**
- `platform/auth/src/controllers/tokenController.ts`
- `platform/auth/src/controllers/phoneAuthCustomController.ts`
- `agency-app/web/src/App.tsx`
- `agency-app/web/src/services/api.ts`

**Action:** Replace all `console.log` in auth flows with a masked logger. Mask tokens, codes, code_verifiers.

---

### 2.5 HIGH-5 — Add Request Size Limits

**File:** `agency-app/api/server.js`

**Action:** Add `express.json({ limit: '1mb' })`.

---

### 2.6 HIGH-6 — Fix Webhook Error Status Codes

**File:** `agency-app/api/routes/billing.js`

**Action:** Return `500` for internal processing errors so Razorpay retries. Return `200` only for confirmed duplicates.

---

### 2.7 HIGH-7 — Remove Duplicate Feedback Route Mount

**File:** `agency-app/api/server.js`

**Action:** Delete `app.use('/api/nps', feedbackRoutes);`. Keep only `/api/feedback`.

---

### 2.8 HIGH-8 — Standardize Token Storage Keys

**File:** `agency-app/web/src/services/api.ts`

**Action:** Replace all `localStorage.getItem('token')` with `getAuthToken()` from `authStorage.ts`.

---

### 2.9 HIGH-9 — Fix Admin Role Check Case

**File:** `agency-app/api/routes/grievance.js:162`

**Action:** Change `ADMIN_ROLES` to `new Set(['ADMIN', 'FOUNDER', 'OWNER'])`.

---

### 2.10 HIGH-10 — Fix Public Properties Endpoint

**File:** `agency-app/api/routes/crm.js`

**Action:** Remove or protect `/properties/public/list` with `apiKeyAuth`. Never trust `x-tenant-id` from unauthenticated callers.

---

### 2.11 HIGH-11 — Add Input Validation to Khata, Notifications, Enquiries

**Files:** `agency-app/api/routes/khata.js`, `agency-app/api/routes/notifications.js`, `agency-app/api/routes/enquiries.js`

**Action:** Apply Zod `.strict()` schemas to all write endpoints.

---

## Phase 3: Medium & Low Fixes (Day 3)

### 3.1 MED-1 — Replace Scan with Query in crmDynamodbService

**File:** `agency-app/api/crmDynamodbService.js`

**Action:** Replace `ScanCommand` + `FilterExpression` with `QueryCommand` on `tenant-index` GSI.

### 3.2 MED-2 — Gate PostHog Init Behind Consent

**File:** `agency-app/web/src/lib/analytics.ts`

**Action:** Only call `posthog.init()` if `consent.analytics === true`. Use `persistence: 'memory'`.

### 3.3 MED-3 — Add Auth Checks to Public S3 Endpoints

**File:** `agency-app/api/routes/crm.js`

**Action:** Require `apiKeyAuth` before generating signed S3 URLs in public endpoints.

### 3.4 MED-4 — Add Webhook Timestamp Validation

**File:** `agency-app/api/routes/billing.js`

**Action:** Reject Razorpay webhooks older than 5 minutes based on `x-razorpay-event-timestamp`.

### 3.5 MED-5 — Shorten Token Cache TTL

**File:** `agency-app/api/middleware/validateToken.js`

**Action:** Reduce `TOKEN_CACHE_TTL` from 60s to 5s.

### 3.6 MED-6 — Make extractTenantId Stricter

**File:** `agency-app/api/tenantMiddleware.js`

**Action:** Remove fallback to client `x-tenant-id` header. Only use server-derived `req.tenantId`. Return 400 if missing.

### 3.7 MED-7 — Validate lastEvaluatedKey Shape

**File:** `agency-app/api/routes/grievance.js`

**Action:** Validate parsed `lastEvaluatedKey` object only contains allowed keys (`grievanceId`, `SK`).

### 3.8 MED-8 — Fix incrementSeatsPaid Import

**File:** `agency-app/api/routes/billing.js`

**Action:** Remove the stub function. Import `incrementSeatsPaid` from `../subscriptionService.js`.

### 3.9 MED-9 — HTML Escape Email Content

**File:** `agency-app/api/routes/grievance.js`

**Action:** Add `escapeHtml()` helper and use it for all user-submitted fields in Brevo email templates.

### 3.10 LOW Fixes

| # | File | Action |
|---|------|--------|
| LOW-1 | `agency-app/api/subscriptionService.js:78` | Make trial days configurable via env var |
| LOW-2 | `agency-app/api/package.json` | `npm uninstall bcryptjs jsonwebtoken` |
| LOW-3 | `agency-app/web/package.json` | `npm uninstall @types/react-router-dom` |
| LOW-4 | `platform/auth/package.json` | Move `dotenv` from `devDependencies` to `dependencies` |
| LOW-5 | `server/update-jwt-secret.js` | Delete the file |

---

## Phase 4: Merge Regression Fixes (Day 3–4)

### 4.1 REG-1 — Fix Billing Route Ordering
See **1.3 CRIT-2**.

### 4.2 REG-2 — Remove Duplicate Route Mount
See **2.7 HIGH-7**.

### 4.3 REG-3 — Remove Legacy Auth Middleware

**Files:** `agency-app/api/middleware/auth.js`, all imports

**Action:** Delete `agency-app/api/middleware/auth.js`. Replace all `authenticateToken` imports/usages with `validateToken`.

### 4.4 REG-4 — Standardize api.ts Token Keys
See **2.8 HIGH-8**.

---

## Phase 5: Long-Term Improvements (Post-Launch)

### 5.1 Local JWT Validation in CRM Backend
Eliminate `/auth/me` network call by validating Cognito JWTs locally using JWKS. Cache JWKS, not user objects.

### 5.2 Service-to-Service Auth
Add `X-Internal-Api-Key` header for CRM → auth microservice calls.

### 5.3 WAF Rules
Add AWS WAF to CloudFormation for rate limiting, SQLi, and XSS protection at the edge.

### 5.4 Structured Logging with PII Masking
Replace all `console.*` with a logger that automatically masks tokens, emails, phone numbers.

### 5.5 Encryption-at-Rest
Explicitly configure `SSESpecification` on all DynamoDB tables and S3 buckets in CloudFormation.

### 5.6 Health Check Dependency Validation
Make `/health` verify DynamoDB, auth service, and S3 connectivity before returning 200.

---

## Testing Checklist

### Unit Tests
- [ ] Zod schemas reject forbidden keys (tenantId, PK, SK)
- [ ] `extractClaims` rejects spoofed headers in production
- [ ] `requireAuth` middleware blocks unauthenticated requests
- [ ] `apiKeyAuth` uses Query, not Scan
- [ ] Rate limiter returns 429 after threshold

### Integration Tests
- [ ] Full login → token refresh → logout flow works with cookies
- [ ] Billing webhook HMAC verification succeeds for valid events
- [ ] Billing webhook returns 500 for processing errors (triggers retry)
- [ ] CORS blocks requests from unknown origins
- [ ] Mass assignment payloads are rejected on all CRM endpoints

### End-to-End Tests
- [ ] Playwright: Login, navigate CRM, perform CRUD operations
- [ ] Playwright: Verify no refresh token in localStorage
- [ ] Manual: Razorpay webhook end-to-end with test event
- [ ] Manual: XSS payload in grievance form does not execute in email

---

## Deployment Rollout Plan

1. **Stage 1 (Auth Service):** Deploy `reality-flow-authentication` fixes first (CRIT-1, CRIT-3, CRIT-4).
2. **Stage 2 (CRM Backend):** Deploy `agency-app/api/` fixes (CRIT-2, CRIT-7, CRIT-8, CRIT-9, HIGH fixes).
3. **Stage 3 (Frontend):** Deploy `real-estate-crm-app` fixes (CRIT-5, HIGH-4, HIGH-8, MED-2).
4. **Stage 4 (Verification):** Run full Playwright suite, manual webhook test, security scan.
5. **Stage 5 (Monitoring):** Watch error rates for 48 hours after each stage.

---

## Rollback Plan

- Each stage is independently deployable.
- If auth service changes break login, rollback to previous Lambda version immediately.
- If CRM backend changes break webhooks, revert `server.js` ordering first.
- Frontend is static (S3/CloudFront); rollback via cache invalidation.

---

*End of Implementation Plan*
