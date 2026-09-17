# Phase 0 — Prerequisites (Hardening Checklist)

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Several June "facts" are fixed (cancel webhook, grace on payment failure, secrets out of the deploy script, server jest in CI); the remaining items are now assigned to Phase A (before taking payment) or Phase B (hardening).

---

## Overview

In June 2026 "Phase 0" was a 2–3 week gate before any product work. Since then much of the product was built in parallel, so this doc is now a **checklist with status**. Each open item is assigned to a phase:

- **Phase A — M1 launch:** must be done before taking payment.
- **Phase B — Hardening:** before selling Team plans or scaling up.

No dates. See `QUICK-START.md` and `21-roadmap.md`.

## Summary

| # | Item | Done | Still open | Phase |
|---|---|---|---|---|
| 1 | Billing webhooks + grace period | Cancel/halt update DB; `payment.failed` starts grace | Clear grace on charge; schedule expiry cron in CFN; server-side read-only | A |
| 2 | Secrets | ai-calling deploy script removed; NoEcho params + Secrets Manager; SSM sync for the CRM | Confirm rotation; gitleaks in CI | A |
| 3 | CI | Server jest + MCP drift checks run | Playwright E2E not run in CI | B |
| 4 | RBAC | Most mounted DELETEs guarded | MANAGER role, own-leads scoping, 2 unguarded DELETEs, align auth roles | B |
| 5 | Pagination | limit/offset on leads/customers | Cursor pagination on all lists | B |
| 6 | IaC | 17 CFN templates, `infra/cicd/<service>/deploy.sh` wrappers with build tracking | GitHub Actions deploy to dev | B |
| 7 | Audit log | Agent audit table | CRM mutation audit; archive instead of TTL delete | B |
| 8 | API protection | App-level in-memory rate limiter; security headers | API Gateway throttling, access logs, CORS fix; WAF after first customers | A (WAF: B) |

---

## 1. Billing Webhooks and Grace Period — Phase A

**Done (in `agency-app/api/routes/billing.js`):**
- `subscription.cancelled` and `subscription.halted` update the Subscriptions table (`isPaying: false`, `paymentStatus`).
- `payment.failed` sets `gracePeriodActive: true` and `gracePeriodEndsAt` (default 7 days, `GRACE_PERIOD_DAYS`) for paying tenants and emails the founder.
- The frontend paywall respects grace (`agency-app/web/src/components/PaywallModal.tsx`).
- The expiry script exists: `agency-app/api/scripts/grace-period-expiry-cron.js` (sets `isPaying: false` once `gracePeriodEndsAt` has passed).

**Still open:**
1. `subscription.charged` does not clear grace; `subscription.resumed` sets `isPaying: true` but leaves grace fields untouched.
2. The expiry script is **not scheduled**: add `GracePeriodExpiryFunction` + an EventBridge rule to `agency-app/api/infra/cfn-backend.yaml`.
3. No server-enforced read-only mode after grace ends; today only the frontend paywall blocks.
4. The expiry script scans the Subscriptions table. There is no `razorpay-subscription-index` GSI; existing GSIs are `paymentStatus-createdAt-index` and `updatedAt-index` (`agency-app/api/infra/launch-tables-cfn.yaml`). A GSI is optional at pre-launch volume.

Full specs: `29-payment-system-implementation.md`.

**Definition of done:** failed payment → 7-day grace → read-only after expiry, enforced on the server; successful charge clears grace. Verified with Razorpay test events.

---

## 2. Secrets — Phase A

**Done:**
- `ai-calling-service/deploy-lambda.ps1` (which held Exotel, ElevenLabs, CRM internal API key and Bedrock KB id as defaults) is deleted. The AI calling stack now takes NoEcho parameters with no defaults into Secrets Manager (`agency-app/ai-calling/infra/cfn-ai-calling.yaml`, `src/config/secretsBootstrap.js`).
- The CRM server syncs SSM SecureStrings (`agency-app/api/infra/sync-ssm-params.sh`).
- The files that exposed Gemini and Baileys keys are untracked (`docs/security-key-rotation.md`).

**Still open:**
1. The old Exotel, ElevenLabs, Gemini, Baileys and CRM API keys are still in git history. **Rotation status is unconfirmed.** Rotate each one and record it in `docs/security-key-rotation.md`.
2. **No history rewrite** and never force-push. Rotation is what makes the leaked values useless.
3. Add `gitleaks` to CI (none today).

**Definition of done:** every leaked key rotated and recorded; gitleaks runs on every PR.

---

## 3. CI — Phase B

**Done:** four workflows exist: `playwright.yml`, `server-tests.yml`, `insta-sol-ms-tests.yml`, `pr-intelligence.yml`. `server-tests.yml` runs jest for `agency-app/api` (`agency-app/api/jest.config.js`) plus MCP tool-drift checks.

**Still open:** the Playwright suite (31 specs under `tests/playwright/api` and `tests/playwright/ui`, config `tests/playwright/playwright.config.ts`) is not run in CI. The `playwright.yml` guard `ls tests/*.spec.ts` never matches, and the specs need a live backend. Decide on a dev-backend target, then run the suite on PRs.

**Definition of done:** Playwright E2E runs in CI against dev and blocks merge on failure.

---

## 4. RBAC — Phase B

**Today:**
- The auth model has only `'ADMIN' | 'MEMBER'` (`platform/auth/src/models/usersModel.ts`).
- The server also accepts FOUNDER/OWNER/MANAGER (`agency-app/api/middleware/requireRole.js`); PLATFORM_OPERATOR/SUPER_ADMIN are used only for credit admin (`requirePlatformOperator.js`).
- Most mounted DELETE routes are guarded. Two mounted ones are not: `agency-app/api/routes/aiIntegrations.js` (`DELETE /:clientId`) and `agency-app/api/routes/notifications.js` (`DELETE /devices/:token`).
- No team/region/assigned-lead scoping; `assignedTo` is only a list filter (`agency-app/api/routes/leads.js`).

**Decision:** ADMIN/MEMBER is enough for M1. Before selling Team plans, add a MANAGER role and "members see only their own leads".

**Actions:**
1. Add MANAGER to the auth model so it matches the roles the server checks.
2. Scope lead reads and writes for MEMBER to `assignedTo = caller` (plus unassigned leads, if the agency allows).
3. Add role checks to the two unguarded DELETE routes.
4. Tests: a MEMBER cannot delete and sees only their own leads; a MANAGER and ADMIN see all.

**Definition of done:** no mounted DELETE without a role check; member scoping enforced on the server and tested.

---

## 5. Pagination — Phase B

**Today:** leads and customers accept `limit`/`offset`, but slice in memory after a scan (e.g. `agency-app/api/routes/crm.js`). Contacts, owners, properties and meetings are unpaginated scans. `TODO(MED-1)` (replace Scan + FilterExpression with a Query) is still open in `agency-app/api/crmDynamodbService.js`.

**Actions:**
1. Replace scans with Queries on the tenant partition (MED-1).
2. Cursor pagination using `LastEvaluatedKey`: `{ items, nextCursor, hasMore }`, default 50, max 1000.
3. Update the frontend lists and add tests for empty, single-page and multi-page cases.

**Definition of done:** every list endpoint is Query-based and cursor-paginated.

---

## 6. IaC and Deploys — Phase B

**Today:** CloudFormation only. 17 templates across `apps/*/infra`, `services/*/infra` and `infra/cicd/common-infra`. Each service deploys through a bash wrapper `infra/cicd/<service>/deploy.sh` with build tracking (`infra/cicd/README.md`). CRM backend resources live in `agency-app/api/infra/cfn-backend.yaml`. There is no Makefile and no PowerShell deploy.

**Decision:** deploys stay manual through the wrappers. A GitHub Actions deploy to dev comes later. The June plan's `make deploy`, `scripts/deploy.sh` and `cfn-aurora.yaml` are dropped.

**Definition of done (later):** merge to main deploys to dev via GitHub Actions using the same wrappers.

---

## 7. Audit Log — Phase B

**Today:** agent actions go to `AgentAuditTable` (`agency-app/api/infra/cfn-backend.yaml`, `agency-app/api/agents/agentAuditService.js`) with a 90-day TTL. WhatsApp audit rows go to the CRM table (`agency-app/api/whatsappAuditService.js`). There is **no audit of general CRM mutations**.

**Actions:**
1. Add an audit record for every CRM mutation (POST/PUT/PATCH/DELETE): `{ tenantId, userId, action, entityType, entityId, before, after, timestamp }`, written async.
2. Admin-only read endpoint, filterable by date, user and entity.
3. **Archive old rows (e.g. export to S3) instead of TTL delete.** Apply the same rule to the agent audit table.

**Definition of done:** every CRM mutation audited; admins can query it; nothing is deleted by TTL.

---

## 8. API Protection — Phase A (WAF in Phase B)

**Today:** app-level rate limiter is in-memory per Lambda instance (`agency-app/api/middleware/rateLimiter.js`), so it does not hold across concurrent invocations. API Gateway gateway responses still return `Access-Control-Allow-Origin: '*'` (`agency-app/api/infra/cfn-backend.yaml`). No API Gateway access logs, no stage throttling, no WAF. PITR is on for all CRM tables.

**Actions before paid launch:** API Gateway stage throttling, access logs, restrict gateway-response CORS to allowed origins. **WAF** after the first customers.

---

## Success Criteria

| Item | Target | Status today |
|---|---|---|
| Billing webhooks update DB (cancel, failed, charged) | All three | Cancel + failed done; charged does not clear grace |
| Grace expiry enforced | Scheduled cron + server read-only | Script exists, not scheduled; no server read-only |
| Leaked keys | Rotated + gitleaks in CI | Rotation unconfirmed; no gitleaks |
| Unit tests in CI | Run on every PR | Done (server jest) |
| Playwright E2E in CI | Run on every PR | Not run |
| DELETE routes guarded | All | 2 mounted routes unguarded |
| Member lead scoping | Enforced on server | Not built |
| Cursor pagination | All list endpoints | Partial limit/offset only |
| All infra in CFN, scripted deploys | Yes | Done (manual wrappers) |
| CRM mutation audit, archived not deleted | Yes | Agent audit only (TTL) |
| API throttling, access logs, CORS | Yes | Not done |

---

## Why These Come First

- **Billing:** a failed payment must give grace, then read-only, without relying on the browser.
- **Keys:** leaked keys stay valid until rotated.
- **API protection:** the in-memory limiter does not protect a Lambda fleet.
- **RBAC and scoping:** a team plan is not sellable if every member sees every lead.
- **Pagination:** scans get slower and costlier as tenants grow.
- **Audit:** needed to trace who changed what, for DPDP and support.

---

## Gate Checklists

**Before taking payment (Phase A):**
- [ ] `subscription.charged` clears grace; tested with Razorpay test events.
- [ ] Grace expiry Lambda + rule deployed via CFN; tested by setting `gracePeriodEndsAt` in the past.
- [ ] Server-enforced read-only after grace.
- [ ] Leaked keys rotated and recorded; gitleaks in CI.
- [ ] API Gateway throttling, access logs, CORS fix deployed.

**Before selling Team plans (Phase B):**
- [ ] MANAGER role in the auth model; member lead scoping enforced and tested.
- [ ] Both unguarded DELETE routes protected.
- [ ] Cursor pagination on all list endpoints.
- [ ] CRM mutation audit with archiving.
- [ ] Playwright E2E running in CI.
