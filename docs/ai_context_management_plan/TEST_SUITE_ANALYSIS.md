# Test Suite Analysis & Cleanup Report

## Executive Summary

Your test suite has **3 major waste items** that should be deleted:

1. **`tests/backend-unit/run-tests.cjs`** — Mock functions, doesn't test actual backend code
2. **`tests/api-smoke-test-runner.js`** — Duplicate of existing API tests, never run
3. **`tests/analytics.spec.ts`** — Stale, not integrated into Playwright config

After cleanup: **189 tests → 189 tests** (same coverage, less waste)

---

## Detailed Analysis

### 1. ❌ WASTE: `tests/backend-unit/run-tests.cjs`

**Status:** USELESS — Tests mock functions, not actual backend code

**What it does:**
- Tests 23 mock functions (state transitions, phone normalization, etc.)
- These functions exist ONLY in the test file
- Your actual backend code in `agency-app/api/` has different implementations
- No connection between test and production code

**Why it's waste:**
- If your backend has a bug, this test won't catch it
- Tests test code, not production code
- Maintenance burden with zero value
- You already have API tests that validate the same logic via real endpoints

**Recommendation:** **DELETE**

**Replacement:** Use existing API tests:
- `tests/playwright/api/state-transitions.spec.ts` — Tests lead/property/meeting state machines via API
- `tests/playwright/api/validation-security.spec.ts` — Tests phone normalization via API

---

### 2. ❌ WASTE: `tests/api-smoke-test-runner.js`

**Status:** DUPLICATE — Same tests already exist in Playwright suite

**What it does:**
- Standalone Node.js script that hits production API
- Tests CORS, auth enforcement, rate limiting, tenant protection
- Never integrated into CI/CD pipeline
- Never run (no npm script for it)

**Duplication analysis:**

| Test | Smoke Runner | Playwright | Status |
|------|--------------|-----------|--------|
| CORS preflight | ✅ | `cors-public-endpoints.spec.ts` | DUPLICATE |
| CORS headers on GET | ✅ | `cors-public-endpoints.spec.ts` | DUPLICATE |
| Invalid tenantId → 400 | ✅ | `cors-public-endpoints.spec.ts` | DUPLICATE |
| SQL injection tenantId | ✅ | `cors-public-endpoints.spec.ts` | DUPLICATE |
| Missing token → 401 | ✅ | `cors-public-endpoints.spec.ts` | DUPLICATE |
| Rate limiting (grievance) | ✅ | `cross-tenant-pentest.spec.ts` | DUPLICATE |
| Webhook signature validation | ✅ | `cross-tenant-pentest.spec.ts` | DUPLICATE |

**Why it's waste:**
- All tests already exist in Playwright suite
- Playwright tests are more robust (retry logic, better error handling)
- Not integrated into CI/CD
- Not run by any npm script
- Maintenance burden with zero value

**Recommendation:** **DELETE**

**Replacement:** Playwright API tests already cover everything:
- `tests/playwright/api/cors-public-endpoints.spec.ts`
- `tests/playwright/api/cross-tenant-pentest.spec.ts`
- `tests/playwright/api/validation-security.spec.ts`

---

### 3. ⚠️ QUESTIONABLE: `tests/analytics.spec.ts`

**Status:** STALE — Not integrated into Playwright config, may not be maintained

**What it does:**
- Tests cookie consent + analytics tracking
- Validates landing page analytics setup
- Tests PostHog-only enforcement in CRM

**Issues:**
- Not in `playwright.config.ts` projects
- Not run by any npm script
- Not in CI/CD pipeline
- Tests landing page files that may not be actively maintained
- Separate from main Playwright suite

**Recommendation:** **MOVE or DELETE**

**Options:**
1. **DELETE** if analytics testing is not a priority
2. **MOVE** to `tests/playwright/ui/public/analytics.spec.ts` and add to config if it is

**For now:** DELETE (can be recovered from git if needed)

---

## Test Suite Structure (After Cleanup)

```
tests/
├── playwright/                          # Main Playwright test suite (189 tests)
│   ├── setup/
│   │   └── auth.setup.ts               # Login once, save state
│   │
│   ├── ui/
│   │   ├── public/                     # No login required (13 tests)
│   │   │   ├── auth.spec.ts
│   │   │   ├── cookie-consent.spec.ts
│   │   │   ├── grievance.spec.ts
│   │   │   └── public-endpoints-security.spec.ts
│   │   │
│   │   └── crm/                        # Logged-in user (102 tests)
│   │       ├── lead-flows.spec.ts
│   │       ├── lead-conversion-flows.spec.ts
│   │       ├── buyer-flows.spec.ts
│   │       ├── tenant-flows.spec.ts
│   │       ├── dashboard-core-flows.spec.ts
│   │       ├── khata-flows.spec.ts
│   │       ├── crm-operations-flows.spec.ts
│   │       ├── admin-ui-flows.spec.ts
│   │       ├── unified-timeline-flows.spec.ts
│   │       ├── profile.spec.ts
│   │       ├── ai-employee.spec.ts
│   │       ├── paywall.spec.ts
│   │       └── nps.spec.ts
│   │
│   └── api/                            # Backend API tests (74 tests)
│       ├── cors-public-endpoints.spec.ts
│       ├── cross-tenant-pentest.spec.ts
│       ├── data-integrity.spec.ts
│       ├── concurrent-race.spec.ts
│       ├── edge-cases-boundary.spec.ts
│       ├── penetration-security.spec.ts
│       ├── seat-cap.spec.ts
│       ├── state-transitions.spec.ts
│       └── validation-security.spec.ts
│
└── backend-unit/                       # ❌ DELETE
    └── run-tests.cjs                   # Mock functions, no value
```

---

## Cleanup Checklist

- [ ] Delete `tests/backend-unit/run-tests.cjs`
- [ ] Delete `tests/backend-unit/` directory (if empty)
- [ ] Delete `tests/api-smoke-test-runner.js`
- [ ] Delete `tests/analytics.spec.ts`
- [ ] Delete `tests/api-smoke-output.txt` (generated output file)
- [ ] Update `tests/playwright/package.json` to remove any references to deleted tests
- [ ] Verify all 189 tests still pass: `cd tests/playwright && npm test`
- [ ] Commit cleanup: "refactor: remove stale/duplicate tests (backend-unit, smoke-runner, analytics)"

---

## Test Coverage After Cleanup

| Category | Tests | Purpose |
|----------|-------|---------|
| **Public UI** | 13 | Auth, cookies, grievance, public endpoints |
| **CRM UI** | 102 | Lead creation, conversion, buyer/tenant flows, Khata, admin |
| **API** | 74 | Security, data integrity, state transitions, edge cases |
| **Total** | **189** | Full end-to-end coverage |

---

## Commands to Run Tests

```bash
cd tests/playwright

# All tests (189)
npm test

# Just public UI tests
npm run test:public

# Just CRM UI tests
npm run test:crm

# Just API tests
npm run test:api

# Specific features
npm run test:leads
npm run test:buyers
npm run test:tenants
npm run test:khata
npm run test:dashboard
```

---

## Notes

- **No test count reduction** — We're removing waste, not functionality
- **All 189 tests still run** — Just with better organization
- **Better maintainability** — No duplicate/stale code to maintain
- **CI/CD unaffected** — Playwright config unchanged
