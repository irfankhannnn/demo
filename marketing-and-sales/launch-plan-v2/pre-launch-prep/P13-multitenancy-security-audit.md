# P13 — Multi-Tenancy + Security Audit

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-1 (with re-scan on Day 7)
> **Skill(s):** `security-audit` + `codebase-analysis`
> **Estimated time:** 0.5h founder · 6h AI

## Objective
Static-analysis sweep of every server route + every DynamoDB call to confirm zero tenant data leakage paths, plus a Playwright pen-test that attempts cross-tenant access and confirms 403/404 (never 200 with leaked data). Publish a written audit report so we can cite "we audited" in enterprise due-diligence.

## Why This Matters for RealEstateFlow
Multi-tenancy is already implemented (`apps/crm/server/tenantMiddleware.js` + `extractTenantId` middleware on every route + `req.tenantId` passed to service layer). But "implemented" ≠ "uniformly applied". One missed route = full data breach for one agency. This audit confirms uniform coverage and produces evidence for legal defence.

## User Story
As a founder selling to multiple agencies, I want a written audit confirming no API route or DDB call can leak one agency's data to another, so I can pass DPDP enquiry, enterprise due-diligence, and sleep at night.

## Acceptance Criteria
- [ ] Static analysis CSV at `marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv` listing every route in `apps/crm/server/routes/*.js` with columns: `file, method, path, hasValidateToken, hasExtractTenantId, dynamoCallsCount, dynamoCallsWithTenantIdInKey, isPublic, securityNotes`
- [ ] Zero rows where `isPublic=false` AND (`hasValidateToken=false` OR `hasExtractTenantId=false`)
- [ ] Zero rows where `dynamoCallsCount > dynamoCallsWithTenantIdInKey` (allowing for legitimate non-tenant tables: Grievances, AIEmployeeProvisioning, WebhookLog, TenantApiKeys, NPSResponses, etc. — explicit allowlist)
- [ ] Playwright pen-test `tests/cross-tenant-pentest.spec.ts`: log in as Agency A, attempt 10+ API GETs/PUTs/DELETEs with Agency B's IDs in URL/body → assert 403/404 always, never 200 with B's data
- [ ] Audit report at `marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md` with: executive summary, scope, methodology, findings (P0/P1/P2 severity), fix PR links, sign-off
- [ ] DynamoDB Point-In-Time-Recovery (PITR) enabled on all tables — checklist row in report
- [ ] S3 bucket policies confirm `BlockPublicAccess=true` for any PII bucket; presigned URLs only
- [ ] Sentry + CloudWatch alarms on: 5xx rate >1%/min, cross-tenant 403 spike (>10/min from one IP)
- [ ] Rate-limiting confirmed on: `/grievance`, `/auth/phone-login`, `/billing/webhook`, public LP form endpoints
- [ ] DPDP sub-processor list cross-checked with P1 Privacy Policy: AWS, Razorpay, Brevo, AiSensy, Cloudflare, OpenClaw LLM provider, Sentry, PostHog, Crisp, BetterStack, Cal.com, ElevenLabs, Instantly
- [ ] Audit report signed off by founder; if any P0 finding, Day 1 launch is HOLD until fixed
- [ ] Day 7 re-scan executed (catches changes from Days 1-6)

## AI Prompt (🤖)

```
You are a senior application security auditor. Perform a static + dynamic security audit of RealEstateFlow's backend, specifically multi-tenancy isolation.

Read these inputs:
- `apps/crm/server/routes/*.js` (every file — auth, leads, owners, buyers, properties, tenants, b2bLeads, khata, calendar, hierarchy, analytics, rentedProperties, notifications, areas, developers, projects, grievance (P9), billing (P11), aiEmployeeStatus (P11), subscriptions (P12))
- `apps/crm/server/tenantMiddleware.js`
- `apps/crm/server/middleware/*.js` (validateToken, etc.)
- `apps/crm/server/crmDynamodbService.js` (108KB — find each function's DDB key conditions)
- `apps/crm/server/grievanceDynamodbService.js` (P9)
- `apps/crm/server/aiEmployeeProvisioningService.js` (P11)
- `apps/crm/server/subscriptionService.js` (P12)
- `apps/crm/server/server.js` (route mounting)
- `infra/dynamodb/*.tf` (table schemas)
- `marketing-and-sales/launch-implement/pre-launch/01-legal/privacy.md` (sub-processor list)

Produce these artefacts:

## 1. `marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv`
Header: `file, method, path, mountedAt, hasValidateToken, hasExtractTenantId, isPublic (boolean), dynamoCallsCount, dynamoCallsWithTenantIdInKey, dynamoCallsMissingTenantId, securityNotes, severity`

For every `router.{get,post,put,delete,patch}` in every routes file:
- Walk the function body (or its called service functions) to count DDB calls
- Mark `dynamoCallsWithTenantIdInKey` when the DDB call's KeyConditionExpression includes `tenantId` OR the table is in the allowlist of legitimately-non-tenant tables: `Grievances, AIEmployeeProvisioning, WebhookLog, TenantApiKeys, NPSResponses, Settings, BetaInvites`
- `isPublic=true` for: `/api/grievance` POST, `/api/billing/webhook` POST (signature-verified), `/api/auth/phone-login` POST (rate-limited), LP form endpoints
- `severity` = P0 if isPublic=false AND (no validateToken OR no extractTenantId OR DDB calls missing tenantId); P1 if missing rate limit on public endpoint; P2 = nice-to-have improvement

## 2. `marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md`
Sections:
### Executive Summary
1-2 paragraphs. Total routes audited, P0/P1/P2 counts, recommendation (proceed / fix-and-rescan / hold launch).

### Scope
List of files audited + version (commit hash) + audit date.

### Methodology
- Static analysis (route enumeration + DDB call extraction)
- Pen-test (Playwright cross-tenant scenarios)
- Sub-processor cross-check (against P1 Privacy)
- Infrastructure audit (PITR, S3 BPA, IAM least-privilege, Cognito MFA optional)

### Findings
Per finding: ID, file:line, severity, description, evidence, fix recommendation, fix PR link (when fixed).

### Sub-processor verification
Table: name, P1 Privacy disclosed (Y/N), purpose, region, contractually DPA-signed (Y/N — to track over Q1).

### Infra checklist
- [ ] DynamoDB PITR enabled on all CRM tables + Grievances + AIEmployeeProvisioning + Subscriptions + NPSResponses + WebhookLog
- [ ] S3 buckets `cloudberry-real-estate-launch` + (any PII bucket) BPA=true
- [ ] Lambda functions least-privilege IAM (no `*` resource on DDB)
- [ ] Cognito User Pool: MFA optional flag confirmed; password policy ≥10 chars
- [ ] API Gateway: throttling 1000 req/min/IP default; per-route overrides for /webhook + /grievance + /phone-login
- [ ] Sentry DSN-rotation policy documented
- [ ] Webhook signature verification on Razorpay (P11) + idempotency log
- [ ] CORS allow-list: `realestateflow.in, demo.realestateflow.in, *.realestateflow.in` only

### Penetration test results
Output of Playwright `tests/cross-tenant-pentest.spec.ts` — pass/fail per scenario.

### Sign-off
"Audit completed YYYY-MM-DD by [Cascade agent]. Founder sign-off: ___."

## 3. `tests/cross-tenant-pentest.spec.ts` — Playwright
Scenarios:
- Provision Tenant A (agency1@test) and Tenant B (agency2@test); seed each with 1 buyer, 1 owner, 1 property
- Log in as A. Get A's buyer ID. Try `GET /api/buyers/{B_buyer_id}` → assert 404 (not 200 with B's data)
- Log in as A. Try `PUT /api/buyers/{B_buyer_id}` with body — assert 404
- Log in as A. Try `DELETE /api/owners/{B_owner_id}` — assert 404
- Log in as A. Try `GET /api/properties/{B_property_id}` — assert 404
- Log in as A. Try `POST /api/leads/{B_lead_id}/notes` — assert 404
- Log in as A. Try `GET /api/khata?tenantId=TENANT_B` — assert response only has A's data (tenantId from JWT, not query)
- Public route smoke: `POST /api/grievance` 6 times in 1 hr same IP → 6th = 429
- Public route smoke: `POST /api/billing/webhook` with invalid signature → 401

## 4. `marketing-and-sales/launch-implement/pre-launch/13-security/sentry-cloudwatch-alarms.md`
Markdown spec:
- Sentry: 5xx error rate >1%/min for 5 min → email founder
- Sentry: any P0 issue auto-pages founder
- CloudWatch: cross-tenant 403 spike (>10/min from same IP) → potential pen-test → SNS to founder + auto-IP-block via WAF rule
- CloudWatch: Lambda error count >5/5min → SNS
- CloudWatch: DDB throttle events → SNS
- CloudWatch: Cognito sign-in failure spike → potential brute-force → SNS

## 5. `marketing-and-sales/launch-implement/pre-launch/13-security/audit-rescan-day7.md`
Day-7 re-scan checklist + diff vs T-1 baseline.

Stop here. Do not fix any P0 findings — flag them in the report and create issue tickets in your tracker for the founder to assign. (Founder may run a second AI prompt to fix specific findings.)
```

## Manual Steps (🧍)

1. **Run AI Prompt above** — produces CSV + report + Playwright + alarm spec.
2. **Review CSV**: confirm zero P0 rows. If P0 exists, fix immediately (file an issue, run a fix-and-rescan AI prompt, then re-run audit).
3. **Enable DDB PITR** on all listed tables: AWS Console → DynamoDB → Tables → Each table → Backups → Enable PITR.
4. **Verify S3 bucket policies**: `cloudberry-real-estate-launch` and any PII buckets have `BlockPublicAccess=true`.
5. **Configure Cognito MFA optional** in user pool settings (if not done).
6. **Configure API Gateway throttling** + per-route overrides.
7. **Configure Sentry + CloudWatch alarms** per `sentry-cloudwatch-alarms.md`.
8. **Run Playwright pen-test**: `npx playwright test tests/cross-tenant-pentest.spec.ts`. Confirm 100% pass.
9. **Sign off the report** at the bottom (founder name + date).
10. **Schedule Day 7 re-scan** (in calendar) — picks up any new routes added in Week 1.
11. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- All server source
- DDB schemas
- P1 Privacy (sub-processor list)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/13-security/route-tenant-coverage.csv`
- `.../security-audit-report.md`
- `.../sentry-cloudwatch-alarms.md`
- `.../audit-rescan-day7.md`
- `tests/cross-tenant-pentest.spec.ts`

## Success Criterion
Zero P0 findings; pen-test 100% pass; report signed off by founder.

## Fallback / Plan B
If P0 found within 24h of launch: HOLD launch. Run focused fix → re-scan within 4h. Day-1 friction walkthrough (Week-1 day-01) can run on the fixed branch.

## Risks
| Risk | Mitigation |
|---|---|
| Static analysis misses dynamic routes | Manual review by founder of any non-trivial dynamic mounting in `server.js` |
| Pen-test scenarios incomplete | Add scenarios as new entities are added in Week 1 (Day 7 re-scan covers) |
| PITR unintentionally disabled | CloudWatch alarm on PITR config drift |
| Sub-processor list drifts from P1 | Quarterly review; cross-cut with `00-DECISIONS-LOG.md` |
| Founder skips sign-off | Block Day 1 launch via go/no-go gate (Day 7) |

## India / Mumbai-Specific Notes
- DPDP Act § 8(5): Data Fiduciary must protect personal data — this audit demonstrates due care
- Mumbai jurisdiction: defensible audit reports help in any court proceedings
- AWS ap-south-1 region — confirm all DDB tables in Mumbai region (no replicas elsewhere unless in P1 disclosure)

## Dependencies
- **Blocks:** Day 1 launch (no-go without sign-off), Day 7 re-scan
- **Depends on:** P9 (grievance route exists), P11 (billing webhook), P12 (seat-cap routes)

## Connected Skills
- `security-audit` — primary
- `codebase-analysis` — route enumeration
- `pr-review` — for any fix PRs that come out
