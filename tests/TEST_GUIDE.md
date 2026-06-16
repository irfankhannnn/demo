# Test Suite Guide

This project has **two separate test suites** that run independently:

1. **Original E2E Tests** — Real browser opens your app, logs in with phone/OTP, clicks buttons, fills forms, takes screenshots.
2. **New API Tests** — Direct HTTP calls to the backend, no browser, testing security, validation, and edge cases.

Plus a few smaller test layers (smoke tests, unit tests).

---

## Suite 1: Original E2E Browser Tests

**Location:** `tests/playwright/ui/`
**What they do:** Open Chrome, navigate to `localhost:3000`, log in as a real user, perform actions in the React UI, take screenshots.
**Auth:** Phone number + OTP (hardcoded in `.env`)
**Screenshots:** Saved to `tests/playwright/reports/screenshots/`
**Needs:** Frontend dev server running on `localhost:3000`

### How login works

All CRM tests share one login helper (`tests/playwright/helpers/auth.ts`):

1. Go to `/`
2. Click "Continue with Phone"
3. Enter phone: `8291537522`
4. Click "Send OTP"
5. Enter OTP: `123456` (6 single-character boxes)
6. Click "Verify"
7. Handle onboarding if it's a new user
8. Land on `/crm` — ready to test

The auth state is saved to `tests/playwright/.auth/user.json` so subsequent tests reuse the session without re-logging in.

### Available test commands

| Command | What it tests | Approx Time |
|---------|-------------|-------------|
| `npm run test:leads` | Creates 7 leads (buyer, seller, tenant, owner types) through the UI | ~2 min |
| `npm run test:khata` | Full Khata Book workflow: create owner → property → khata entry → settle → view analytics | ~3 min |
| `npm run test:buyers` | Create a buyer via `/crm/buyers/new`, verify in buyer list | ~1 min |
| `npm run test:tenants` | Create a tenant via `/crm/tenants/new`, verify in tenant list | ~1 min |
| `npm run test:dashboard` | Core dashboard CRUD operations (search, filters, entity cards) | ~2 min |
| `npm run test:crm-ops` | Calendar, analytics, team hierarchy, B2B leads pages | ~2 min |
| `npm run test:admin-ui` | Admin panel: invites, member management | ~3 min |
| `npm run test:public` | Public pages (login, cookie banner, grievance form) — no auth needed | ~1 min |
| `npm run test:crm` | Runs ALL CRM tests together (all of the above except public) | ~10 min |
| `npm run test:ui` | Runs ALL UI tests (public + CRM) | ~12 min |

### What each test does (high level)

| Test File | Flow File | What happens in the browser |
|-----------|-----------|----------------------------|
| `lead-flows.spec.ts` | `flows/leadFlow.ts` | Navigates to Leads page, clicks "New Lead", fills name/phone/email for 7 different lead types (buyer/seller/tenant/owner), selects status/priority/source, fills type-specific fields (budget, area, BHK, etc.), saves each, then converts one lead to a buyer. Screenshots at each step. |
| `khata-flows.spec.ts` | `flows/khata/*.ts` | Phase 1: Create owner and property. Phase 2: Open Khata Book page. Phase 3: Create credit/debit entries. Phase 4: Settle an entry. Phase 5: View settlement analytics dashboard. |
| `buyer-flows.spec.ts` | inline | Go to `/crm/buyers/new`, fill name/phone/email/budget, click Save, go to buyer list, verify name appears. |
| `tenant-flows.spec.ts` | inline | Same as buyer but for tenants. |
| `dashboard-core-flows.spec.ts` | `flows/dashboardCoreFlow.ts` | Opens dashboard, verifies entity counts, tests search/filter, opens detail cards. |
| `crm-operations-flows.spec.ts` | `flows/crmOperationsFlow.ts` | Tests calendar page, analytics charts, team hierarchy, B2B leads list. |
| `admin-ui-flows.spec.ts` | `flows/adminUiFlow.ts` | Admin login, invite team member, verify member appears in list. |
| `unified-timeline-flows.spec.ts` | inline | Create a lead, add a note, schedule a meeting, convert the lead — verify all 4 events appear in the Unified Activity Timeline. |
| `paywall.spec.ts` | inline (mocked) | Mocks trial status API to test: banner hidden when >7 days left, yellow banner at 7 days, red at 3 days, paywall modal when expired, billing route still accessible, Razorpay checkout button works. |
| `nps.spec.ts` | inline (mocked) | Mocks user creation date to test NPS modal: shows after 14 days, hidden before, hidden if already asked within 90 days, score 5 requires feedback text, score 9 shows testimonial checkbox, submit stores timestamp. |
| `profile.spec.ts` | inline | Go to `/profile`, verify page loads, verify logout button visible. |
| `ai-employee.spec.ts` | inline | Go to `/integrations/ai-employee`, verify heading visible. |
| `auth.spec.ts` (public) | inline | Verify `/phone-login` has tel input, verify `/crm` redirects unauthenticated users to login, verify `/login` has "Continue with Phone" button, verify onboarding pages load. |
| `cookie-consent.spec.ts` (public) | inline | Tests landing page cookie banner: first visit shows banner, Accept All hides it, Reject sets analytics=false, Customize toggles persist. Tests React CRM banner similarly. |
| `grievance.spec.ts` (public) | inline | Fill public grievance form, submit, verify tracking ID starts with `GR-`. Test honeypot field blocks bots. Test rate limiting returns 429 after repeated submits. |

---

## Suite 2: New API Tests (No Browser)

**Location:** `tests/playwright/api/`
**What they do:** Send HTTP requests directly to the backend API. No Chrome, no clicking, no screenshots.
**Auth:** JWT bearer token (`TEST_TOKEN` env var)
**Screenshots:** None
**Needs:** Backend API reachable (hosted or local)
**Why they exist:** The E2E tests cover user flows but miss backend bugs like SQL injection, race conditions, state machine violations, cross-tenant leaks. These catch those.

### How they run

```bash
npm run test:api          # All API tests
npx playwright test api/   # Same thing
```

### What each suite checks

| Spec File | What it tests | Count |
|-----------|--------------|-------|
| `state-transitions.spec.ts` | Lead, Property, and Meeting state machines. Valid forward transitions allowed. Backward/reopening transitions blocked. Converted leads can't be deleted or updated. | ~10 |
| `validation-security.spec.ts` | Zod `.strict()` rejects unknown fields. DynamoDB PK/SK injection blocked. Phone normalization (10 digits). Khata settlement amount must match exactly. File upload MIME filter blocks `.exe`. | ~10 |
| `penetration-security.spec.ts` | SQL injection (8 payloads), XSS (7 payloads), NoSQL injection, path traversal in file uploads, command injection in property titles, header injection, mass assignment of internal fields, IDOR access to other tenant resources. | ~30 |
| `cors-public-endpoints.spec.ts` | CORS preflight returns proper headers. `x-tenant-id` must be in allowed headers. Tenant ID spoofing blocked. Auth required on protected routes. Admin endpoints require admin role. | ~11 |
| `data-integrity.spec.ts` | Creating property with non-existent owner handled. Delete owner with properties — what happens? Delete lead then GET — is it gone? GSI index consistency after updates. Khata settlement reflects in summary. | ~9 |
| `edge-cases-boundary.spec.ts` | Empty/null names rejected. Name length boundaries (100/101 chars). Phone length (10 vs 9 digits). Property price (0, negative, huge). Emojis/unicode/HTML in names. Past meetings. End time before start time. | ~19 |
| `concurrent-race.spec.ts` | Two simultaneous settle requests on same khata entry — only one succeeds. Two simultaneous lead updates — no corruption. Rapid API calls trigger rate limiting eventually. | ~4 |
| `cross-tenant-pentest.spec.ts` | Tenant A cannot read/write/delete Tenant B's buyers, owners, properties, leads. Query param `tenantId` spoofing fails. Grievance rate limit after 6 requests. Billing webhook rejects invalid signature. | ~7 |
| `seat-cap.spec.ts` | Solo tenant at seat cap returns 402 + upgrade options. Team tenant under limit can invite. Subscription object has required fields. Trial status returns days left and booleans. | ~5 |

---

## Suite 3: Smoke Tests (Node.js)

**Location:** `tests/api-smoke-test-runner.js`
**What:** Standalone Node.js script using native `fetch()`. No Playwright needed.
**Run:** `node tests/api-smoke-test-runner.js` (or `npm run test:smoke`)
**Checks:** CORS headers, public endpoint tenant protection, auth enforcement (401 without token), admin RBAC (403 without admin), grievance rate limiting, billing webhook signature validation.

---

## Suite 4: Backend Unit Tests

**Location:** `tests/backend-unit/`
**What:** Jest tests for isolated functions.
**Run:** `npm run test:unit`
**Checks:** Phone normalization logic, Zod schema strict mode, lead status transition rules, khata amount validation, enum casing.

---

## Environment Variables

All env vars are read from `tests/playwright/.env`:

| Variable | Used By | What it is |
|----------|---------|------------|
| `PLAYWRIGHT_BASE_URL` | E2E tests | Frontend URL, e.g. `http://localhost:3000` |
| `PLAYWRIGHT_API_URL` | All tests | Backend URL, e.g. `https://services-api.../api` |
| `TEST_PHONE` | E2E login | Phone number for OTP login (e.g. `8291537522`) |
| `TEST_OTP` | E2E login | Hardcoded OTP (e.g. `123456`) |
| `TEST_TOKEN` / `TENANT_A_TOKEN` | API tests | JWT bearer token for authenticated API calls |
| `TENANT_B_TOKEN` | Cross-tenant tests | Second tenant's token |
| `SOLO_TENANT_TOKEN` | Seat-cap tests | Token for a solo-tier tenant |
| `TEAM_TENANT_TOKEN` | Seat-cap tests | Token for a team-tier tenant |

---

## Quick Command Cheat Sheet

```bash
# --- Original E2E (browser, login, screenshots) ---
npm run test:leads         # Lead creation flow
npm run test:khata         # Khata book full workflow
npm run test:buyers        # Buyer CRUD
npm run test:tenants       # Tenant CRUD
npm run test:dashboard     # Dashboard core operations
npm run test:crm-ops       # Calendar, analytics, hierarchy
npm run test:admin-ui      # Admin invite/member flows
npm run test:public        # Public pages (no auth)
npm run test:crm           # All CRM tests together
npm run test:ui            # All UI tests (public + CRM)

# --- New API tests (HTTP only, no browser) ---
npm run test:api           # All backend API tests

# --- Other ---
npm run test:smoke         # Node.js smoke test script
npm run test:unit          # Jest backend unit tests
npx playwright test --ui   # Interactive Playwright mode
```

---

## Test Coverage Summary

| Concern | E2E Browser | API HTTP | Smoke | Unit |
|---------|:-----------:|:--------:|:-----:|:----:|
| User login / onboarding | X | | | |
| CRUD through UI (leads, buyers, tenants) | X | | | |
| Khata workflow (owner → property → entry → settle) | X | | | |
| Dashboard / analytics UI | X | | | |
| Paywall / trial banners | X | | | |
| NPS modal logic | X | | | |
| Cookie consent | X | | | |
| Auth enforcement | | X | X | |
| CORS configuration | | X | X | |
| State machine (lead/property/meeting) | | X | | X |
| Input validation (Zod strict) | | X | | X |
| SQL / XSS / NoSQL injection | | X | | |
| Path traversal / file upload | | X | | |
| Cross-tenant isolation | | X | | |
| Race conditions / concurrency | | X | | |
| Rate limiting | | X | X | |
| Data integrity / cascade delete | | X | | |
| Seat cap / billing webhooks | | X | | |
| Phone normalization | | X | | X |
| Edge cases (empty, too long, negative, unicode) | | X | | |
