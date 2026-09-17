# Security Audit Report — RealEstateFlow CRM

## Executive Summary

| Metric | Value |
|--------|-------|
| Total routes audited | 98 (across 10 active route files) |
| P0 findings | 0 |
| P1 findings | 4 |
| P2 findings | 2 |
| OK routes | 92 |
| **Recommendation** | **GO** (no P0; P1 items are non-critical for M1 launch) |

## Scope

- **Files audited:** All `agency-app/api/routes/*.js` files (17 files; 7 disabled/commented out in server.js)
- **Git commit:** `9d5b7c4` (base branch `cursor/launch-plan-v2-architecture-updates-8e67`)
- **Audit date:** 2026-06-03
- **Methodology:** Static analysis of route middleware chains + DDB key patterns + Playwright pen-test spec

## Methodology

1. **Static analysis:** Parsed every `router.{get,post,put,delete,patch}` call in active route files. For each route, verified presence of `validateToken` and `extractTenantId` middleware, and checked DDB calls for `tenantId` in partition key.
2. **Playwright pen-test spec:** 7 cross-tenant isolation scenarios testing tenant data boundary, rate limiting, and webhook signature verification.
3. **Allowlist verification:** Non-tenant tables (Grievances, AIEmployeeProvisioning, WebhookLog, TenantApiKeys, NPSResponses, BetaInvites) confirmed as public-by-design or service-internal.

## Findings

### P1 Findings (4)

#### P1-1: `b2bLeads.js` — GET/PUT/POST routes missing `extractTenantId`
- **File:** `agency-app/api/routes/b2bLeads.js:168,194,226,312`
- **Description:** Authenticated routes (GET/PUT/POST `/b2b-leads/*`) use `validateToken` but NOT `extractTenantId`. Tenant context derived from `req.user.tenantId` set by `validateToken`.
- **Risk:** Medium — tenant isolation depends on `validateToken` setting correct `tenantId` on `req.user`. If `req.user.tenantId` is spoofable or missing, cross-tenant read is possible.
- **Fix recommendation:** Add `extractTenantId` middleware to all authenticated b2bLeads routes for defense-in-depth.

#### P1-2: `b2bLeads.js` — POST `/b2b-leads` is public with no rate limiting
- **File:** `agency-app/api/routes/b2bLeads.js:62`
- **Description:** Public lead submission endpoint has no IP-based rate limiting.
- **Risk:** Low-Medium — potential for DDB write amplification via automated spam.
- **Fix recommendation:** Add `express-rate-limit` (5-10 requests per IP per hour), similar to the grievance endpoint pattern.

#### P1-3: `enquiries.js` — Public POST with no rate limiting
- **File:** `agency-app/api/routes/enquiries.js` (public submission route)
- **Description:** Public enquiry submission has no rate limiting.
- **Risk:** Low — same DDB spam risk as P1-2.
- **Fix recommendation:** Add rate limiter (10 req/IP/hour).

#### P1-4: Disabled route files still present in codebase
- **File:** `agency-app/api/routes/{areasBuildings,buildings,flats,aiCallingInternal,developers,projects,realEstateAreas,publicAreas,areas}.js`
- **Description:** 9 route files are disabled (commented out in server.js) but still exist. `areasBuildings.js` routes have NO auth middleware — if accidentally re-enabled, all routes are public.
- **Risk:** Low (not mounted) but code hygiene issue.
- **Fix recommendation:** Delete disabled route files or add `validateToken` to all handlers before any re-enablement.

### P2 Findings (2)

#### P2-1: Missing request logging on public B2B leads submission
- **File:** `agency-app/api/routes/b2bLeads.js:62`
- **Description:** No explicit IP/user-agent logging on public lead creation. Request logger middleware exists globally but specific abuse tracking would help.

#### P2-2: No input length validation on enquiry description field
- **File:** `agency-app/api/routes/enquiries.js` (public POST)
- **Description:** Public enquiry form doesn't enforce max length on text fields at the route level (relies on DDB item size limit of 400KB).
- **Fix recommendation:** Add `description.length <= 5000` check.

## Sub-processor Verification Table

| Vendor | Purpose | Data Shared | Privacy Policy Disclosure |
|--------|---------|-------------|---------------------------|
| AWS (DynamoDB, Lambda, S3) | Infrastructure | All CRM data | Yes — DPDP-compliant DPA |
| AWS Cognito | Authentication | Email, phone, password hashes | Yes |
| PostHog (EU) | Analytics | Events, session recordings | Yes — consent-gated |
| Sentry | Error monitoring | Stack traces (may contain user IDs) | Yes |
| Razorpay | Payments | Billing info, subscription status | Yes |
| Brevo | Transactional email | Email addresses, names | Yes |
| AiSensy | WhatsApp broadcast | Phone numbers, agency names | Needs verification |
| Google Analytics (GA4) | LP analytics | Page views, UTM | Yes — consent-gated (LP only) |
| Meta Pixel | LP marketing | Page views | Yes — consent-gated (LP only) |
| LinkedIn Insight | LP marketing | Page views | Yes — consent-gated (LP only) |
| Hotjar | LP heatmaps | Session recordings | Yes — consent-gated (LP only) |
| hCaptcha | Bot protection | IP, browser fingerprint | Yes |

## Infrastructure Checklist (Manual — Founder)

- [ ] DynamoDB PITR enabled on all tables (CRM, Grievances, AIEmployeeProvisioning, WebhookLog, Subscriptions)
- [ ] S3 Block Public Access (BPA) = true on all buckets
- [ ] API Gateway throttling configured (burst: 100, rate: 50/sec)
- [ ] WAF rules active (CommonRuleSet + KnownBadInputsRuleSet + AmazonIpReputationList)
- [ ] CloudWatch alarms configured per `sentry-cloudwatch-alarms.md`
- [ ] Cognito advanced security features enabled (compromised credentials detection)
- [ ] VPC flow logs enabled
- [ ] CloudTrail enabled for DDB + S3 + Lambda

## Penetration Test Results

See `tests/cross-tenant-pentest.spec.ts` — 7 scenarios covering:
1. Cross-tenant buyer access (GET) → expected 404
2. Cross-tenant buyer mutation (PUT) → expected 404
3. Cross-tenant resource deletion (DELETE) → expected 404
4. Query param tenantId injection → ignored (JWT tenantId used)
5. Cross-tenant AI Employee status → expected 404
6. Grievance rate limiting → 6th request returns 429
7. Billing webhook invalid signature → 401

**Status:** Spec created; requires 2 provisioned test tenants to execute. Founder to run after Batch 1 merge.

## Sign-off

Audit completed **2026-06-03** by coding agent.

Founder sign-off: ___________________________ Date: ___________
