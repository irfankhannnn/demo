# Phase 0 — Prerequisites (Must Complete Before Everything Else)

> **Status:** Foundational security & infrastructure work · **Duration:** 2–3 weeks · **Team:** 1–2 engineers · **Gate:** All Phase 1 work blocks on Phase 0 completion.

---

## Overview

Phase 0 is not an optional optimization — it is **day 1 work that unblocks the entire roadmap.** Skipping it means deploying agent code on an insecure, untestable, under-specified foundation.

---

## Mandatory Work Items

### 1. 🔴 Rotate & Remove Hardcoded Secrets (3 days)

**Status: CRITICAL**

**The fact:** Production secrets (Exotel API key/SID, ElevenLabs key, CRM internal API key, Bedrock KB id) are committed in `ai-calling-service/deploy-lambda.ps1` as default parameter values.

**The risk:** Anyone with access to the repo (or who clones it) has live credentials to Exotel, ElevenLabs, and Bedrock. Exotel can be abused to send charges to your account; ElevenLabs can consume your TTS quota; the CRM internal API key bypasses auth.

**Actions:**
1. Generate new credentials for **Exotel, ElevenLabs, Bedrock, CRM internal API** (Cognito for internal calls).
2. Move all secrets to AWS Secrets Manager (or Parameter Store).
3. Update `deploy-lambda.ps1` to fetch from Secrets Manager at deploy time (NO defaults).
4. Force-push git history to remove old secrets (or use BFG to scrub).
5. Rotate the old credentials (mark as inactive, set expiry, monitor for abuse).
6. Add `gitleaks` pre-commit hook + CI check to block any future secret commits.

**Definition of done:** Zero secrets in any `.ps1`, `.js`, `.ts`, `.json` config files. All infra uses Secrets Manager. `gitleaks` passes CI.

---

### 2. Fix CI/CD So Tests Actually Run (2 days)

**Status: BLOCKER FOR TESTING**

**The fact:** The only GitHub Actions workflow (`playwright.yml`) guards test execution on a path glob that doesn't match the actual test location:
```yaml
if: ls tests/*.spec.ts
# But tests live in tests/playwright/ui/**/*.spec.ts
# So the guard fails silently and tests NEVER run in CI
```

**The risk:** You can commit broken code, and CI won't catch it. Rewriting the data layer without executing test coverage is reckless.

**Actions:**
1. Fix the path glob in `.github/workflows/playwright.yml` to `tests/playwright/**/*.spec.ts`.
2. Verify tests actually execute on a PR.
3. Add unit test scaffolding (Jest or Vitest) for `server/` — even if empty, establish the pattern.
4. Add a `scripts/test.sh` that runs all test suites locally (pre-commit friendly).

**Definition of done:** `npm test` runs Playwright E2E + any new unit tests. CI runs the same. A PR cannot merge without passing tests.

---

### 3. Fix RBAC: Enforce Role Checks Uniformly (5 days)

**Status: SECURITY + ARCHITECTURE PREREQUISITE**

**The fact:** RBAC is binary (`ADMIN` / `MEMBER` only) and unevenly enforced:
- Frontend enforces "members can't delete" via UI (not secure).
- Backend `crm.js` has 10+ DELETE routes with **no `requireRole` check**.
- `requireRole` middleware references roles (`FOUNDER`, `OWNER`, `MANAGER`) that **don't exist** in the user model.
- The vision calls for agent-scoped data access (an agent can only see/modify data it's assigned to), but today there's no assignment/scoping at all.

**The risk:** Anyone with a `MEMBER` account can DELETE customer data (via direct API call, bypassing the UI). Agents have no scoping. The system can't enforce "agent can only access assigned leads."

**Actions:**
1. **Unify the role model.** Define: SUPER_ADMIN, ADMIN, AGENT, MEMBER. Update `usersModel.ts` in auth service.
2. **Add data-scoping columns:** `assigned_agent_id` on leads/contacts, `region` on user/agent, `team_id` on user/agent. Update CRM schema to include these.
3. **Enforce role checks on DELETE.** Add `requireAdmin` to all `router.delete()` in `server/routes/*.js`.
4. **Agent scoping middleware:** After `validateToken, extractTenantId`, add `validateAgentScope(req)` that ensures agent can only query `WHERE assigned_to = req.user.id OR assigned_to IS NULL`.
5. **Test:** Playwright tests that a MEMBER cannot DELETE, an AGENT can only see assigned leads, an ADMIN sees all.

**Definition of done:** No DELETE endpoint without role check. Agent queries are scoped. Playwright tests pass. Role model is consistent (no phantom roles in middleware).

---

### 4. Add Pagination to List Operations (4 days)

**Status: SCALABILITY PREREQUISITE**

**The fact:** Zero pagination in the current codebase. Every `getCustomers`, `getLeads`, `getMeetings` call reads the **entire tenant partition** from DynamoDB (via `ScanCommand` with no `Limit`).

At 10,000+ leads per tenant, a single "list leads" query scans 10k+ items. At 100k leads (your stated scale), it breaks.

**The risk:** The system cannot scale to the target (100k leads) without this.

**Actions:**
1. Add `limit` (default 50, max 1000) and `offset`/`cursor` support to all list endpoints.
2. In DynamoDB, use `Limit` parameter and `LastEvaluatedKey` (cursor-based pagination).
3. Return pagination metadata: `{ items: [...], nextCursor: "...", hasMore: true }`.
4. Update frontend to handle pagination (infinite scroll or pages).
5. Add Playwright tests for pagination edge cases (empty, single page, multi-page).

**Definition of done:** All list endpoints support pagination. A request to `GET /api/crm/leads?limit=50&cursor=...` returns at most 50 items. Pagination tests pass.

---

### 5. Consolidate & Publish IaC (3 days)

**Status: INFRASTRUCTURE CLARITY**

**The fact:** CloudFormation templates exist (`server/infra/cfn-backend.yaml`, plus separate templates for auth, AI calling), but:
- No centralized registry of what's deployed where.
- Deploy scripts are PowerShell (not cross-platform).
- No `terraform` or documented `sam` deployment.

**The risk:** Hard to reason about infrastructure; hard to replicate; hard to add new services.

**Actions:**
1. Create a `terraform/` or `sam/` directory with root module that imports all stacks.
2. Document which CF stack owns which table, function, role, and its dependencies.
3. Create a `scripts/deploy.sh` (bash) that wraps the existing deploy scripts and works on Linux/Mac/Windows (WSL).
4. Add a `Makefile` for `make deploy`, `make destroy`, `make validate-stack`.
5. Document the deploy path: code → git push → CI runs tests → manual approval → deploy.

**Definition of done:** One source of truth for infra. `make deploy` successfully deploys to staging. Documented.

---

### 6. Add Immutable Audit Log (2 days)

**Status: COMPLIANCE + DEBUGGING**

**The fact:** The vision requires audit trails (for billing, governance, compliance). Currently there's no audit log.

**The risk:** Cannot trace who did what, when, why. Compliance frameworks (DPDP, financial audit) require this.

**Actions:**
1. Create an `AuditLog` DynamoDB table: `{ id, tenantId, userId, action, entityType, entityId, before, after, timestamp }`.
2. Add middleware to log every state-changing operation (POST, PUT, DELETE) to the audit table (async, non-blocking).
3. Expose read-only audit log endpoint (admin-only).
4. Implement TTL on audit log (keep 1–2 years, then auto-delete per compliance).

**Definition of done:** Every CRM mutation is logged. Admin can query audit by date/user/entity. No test failures.

---

## Phase 0 Success Criteria

| Item | Pass/Fail |
|---|---|
| No secrets in version control | ✅ Pass |
| CI pipeline runs tests and they pass | ✅ Pass |
| All DELETE endpoints enforce `requireAdmin` | ✅ Pass |
| All list endpoints support pagination + cursor | ✅ Pass |
| IaC is documented and deployable via `make deploy` | ✅ Pass |
| Audit log captures all mutations | ✅ Pass |
| Playwright suite runs in CI and passes | ✅ Pass |

---

## Estimated Timeline

| Work | Duration | FTE |
|---|---|---|
| Secrets rotation | 3 days | 1 |
| Fix CI tests | 2 days | 0.5 |
| RBAC enforcement | 5 days | 1 |
| Pagination | 4 days | 1 |
| IaC consolidation | 3 days | 1 |
| Audit log | 2 days | 0.5 |
| **Total** | **~19 days** | **~5 FTE-days** |

If one engineer works full-time: **4 weeks**. If parallelized across two engineers: **2 weeks**.

---

## Why This Comes First

- **Secrets:** Can't ship anything insecure.
- **CI:** Can't refactor data layer without test coverage.
- **RBAC:** Agents need to know they can't see each other's data; users need to know deletions are protected.
- **Pagination:** Scale foundation; without it, the system fails at 100k leads.
- **IaC & Audit:** Enables safe, auditable deployments for everything after Phase 0.

---

## Gate: Proceed to Phase 1 Only After

- [ ] All committed secrets removed; Secrets Manager in use.
- [ ] Tests run in CI without false-negatives; local `npm test` passes.
- [ ] RBAC roles & scoping middleware added; agent queries scoped; DELETE endpoints protected.
- [ ] Pagination working on all list endpoints.
- [ ] IaC deployable via `make deploy`; documented.
- [ ] Audit log capturing mutations; tested.
- [ ] Security review passed (no CORS/XSS/SQLi/timing-attack regressions).

**Once all above are done, Phase 1 (WhatsApp wedge on DynamoDB) can begin.**
