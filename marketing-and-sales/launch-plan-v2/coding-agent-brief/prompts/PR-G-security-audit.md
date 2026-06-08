# Agent Prompt — PR-G: Security Audit + Multi-Tenancy Pentest

**Branch to create:** `cursor/pr-2g-security-audit-8e67`
**Base branch:** `main` (after Batch 1 is merged)
**Batch:** 2 (Day 2) — runs in parallel with PR-E, PR-F
**Dependency:** Batch 1 merged (all routes from PR-B and existing server routes must exist)

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. All existing `server/routes/*.js` files — enumerate every route
3. `server/tenantMiddleware.js` — understand extractTenantId
4. `server/middleware/validateToken.js`
5. `server/server.js` — all mounted routes
6. `server/crmDynamodbService.js` — understand how DDB calls use tenantId
7. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P13-multitenancy-security-audit.md`

---

## What to Build

### 1. Static Analysis CSV

`marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv`

Walk every `router.{get,post,put,delete,patch}` in every `server/routes/*.js` file.

Columns:
```
file, method, path, mountedAt, hasValidateToken (Y/N), hasExtractTenantId (Y/N), isPublic (Y/N), dynamoCallsCount, dynamoCallsWithTenantIdInKey, dynamoCallsMissingTenantId, severity (P0/P1/P2/OK), securityNotes
```

Severity rules:
- **P0**: `isPublic=N` AND (`hasValidateToken=N` OR `hasExtractTenantId=N`) — data breach risk
- **P0**: route returns DDB data without tenantId in key (except allowlisted non-tenant tables)
- **P1**: public route with no rate limiting
- **P2**: missing logging, missing input validation
- **OK**: route properly secured

Non-tenant tables allowlist (these don't need tenantId in key — by design):
`Grievances, AIEmployeeProvisioning, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites`

### 2. Security Audit Report

`marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md`

Sections:
- **Executive Summary**: total routes audited, P0/P1/P2 counts, recommendation (GO / FIX-AND-RESCAN / HOLD)
- **Scope**: files audited, git commit hash, audit date
- **Methodology**: static analysis + Playwright pen-test + allowlist verification
- **Findings**: per P0/P1 finding — file:line, description, evidence, fix recommendation
- **Sub-processor verification table**: list all vendors, check against P1 Privacy Policy disclosures
- **Infrastructure checklist** (manual verification items for Founder):
  - [ ] DDB PITR enabled on all tables
  - [ ] S3 BPA=true
  - [ ] API Gateway throttling configured
  - [ ] WAF rules active
  - [ ] CloudWatch alarms active
- **Penetration test results**: output of Playwright spec
- **Sign-off**: "Audit completed {DATE} by Cascade agent. Founder sign-off: ___."

### 3. Playwright Pen-Test

`tests/cross-tenant-pentest.spec.ts`

```typescript
// Test: Tenant A cannot access Tenant B's data
// Setup: provision 2 test tenants; seed each with 1 buyer, 1 owner, 1 property via API

// Scenarios:
// 1. Login as Tenant A. GET /api/crm/buyers/{B_buyer_id} → assert 404 (not 200 with B's data)
// 2. Login as Tenant A. PUT /api/crm/buyers/{B_buyer_id} → assert 404
// 3. Login as Tenant A. DELETE /api/crm/{resource}/{B_id} for owners, properties, leads → assert 404 each
// 4. Login as Tenant A. GET /api/khata?tenantId=TENANT_B_ID → assert response only contains A's data
//    (tenantId from JWT, NOT from query param — query param should be ignored)
// 5. Login as Tenant A. GET /api/ai-employee/status with B's Authorization header — assert 404 or A's data only
// 6. Rate limit: POST /api/grievance × 6 from same IP in 1h → 6th = 429
// 7. Billing webhook: POST /api/billing/webhook with invalid signature → 401

// Assertion patterns:
// - 404: tenant-isolated resource not found (correct)
// - 403: auth denied (also acceptable)
// - 200 with B's data: FAIL (security breach)
```

### 4. CloudWatch + Sentry Alarms Spec

`marketing-and-sales/launch-implement/pre-launch/13-security/sentry-cloudwatch-alarms.md`

Markdown spec for Founder to configure:

**Sentry alerts:**
- Any P0 (fatal) error → immediate email + WhatsApp to founder
- Error rate >1% over 5 min window → email founder

**CloudWatch alarms:**
- Lambda 5xx response rate >1%/min for 5 min → SNS → founder email
- Lambda error count >5/5min → SNS → founder email
- DDB `SystemErrors` count >0 → SNS (DDB internal error)
- DDB `ThrottledRequests` count >0 for 3 consecutive periods → SNS
- Cognito sign-in failure count >10/5min same IP → SNS (brute force)
- API Gateway 4xx rate >5%/min (cross-tenant 403 spike indicator) → SNS

**WAF rule spec:**
- Rate limit rule: >100 req/5min per IP on `/api/grievance` → BLOCK
- Rate limit rule: >50 req/5min per IP on `/api/auth/phone-login` → BLOCK
- AWS managed rules: CommonRuleSet + KnownBadInputsRuleSet + AmazonIpReputationList

### 5. Day-7 Rescan Template

`marketing-and-sales/launch-implement/pre-launch/13-security/audit-rescan-day7.md`

```markdown
# Day-7 Security Rescan

Run on Day 7 (after Week 1 code changes). Diff vs T-1 baseline.

## Scope
All routes added in Days 1-6 that weren't in the T-1 baseline scan.

## Process
1. Re-run static analysis CSV for any new route files
2. Re-run Playwright pen-test suite
3. Compare new routes against T-1 coverage CSV
4. Note any new P0 findings
5. Founder sign-off required before Day 9 beta invites

## Checklist
- [ ] Re-run route-tenant-coverage.csv for new files
- [ ] npx playwright test tests/cross-tenant-pentest.spec.ts
- [ ] Zero new P0 findings
- [ ] Report appended to security-audit-report.md with "Day 7 rescan" section
```

---

## What NOT to Touch

This PR creates ONLY documentation and test files. It MUST NOT:
- Modify any source code (`server/routes/*.js`, `src/**/*.tsx`)
- Fix any security findings it discovers — document them with P0/P1/P2 severity and leave fixing to a dedicated PR (founder assigns)

---

## Acceptance Criteria

- [ ] `route-tenant-coverage.csv` covers every route in `server/routes/*.js`
- [ ] Zero P0 rows (all routes either properly secured or allowlisted)
- [ ] If P0 found: document in report with fix recommendation; set executive summary to "FIX-AND-RESCAN"
- [ ] Playwright pen-test: all 7 scenarios pass (cross-tenant attempts all return 403/404)
- [ ] CloudWatch alarm spec complete; all alarm metrics specified

---

## PR Description Template

```
PR-G: Security audit — multi-tenancy static analysis + Playwright pen-test

Batch 2 | Day 2 | Parallel with PR-E, PR-F
Depends on: Batch 1 merged (all routes exist for analysis)

Files created:
- tests/cross-tenant-pentest.spec.ts — Playwright cross-tenant scenarios
- marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv
- marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md
- marketing-and-sales/launch-implement/pre-launch/13-security/sentry-cloudwatch-alarms.md
- marketing-and-sales/launch-implement/pre-launch/13-security/audit-rescan-day7.md

No source code modified (audit-only PR).

Source task: ZEE-010 (pre-launch-prep/P13-multitenancy-security-audit.md)
```
