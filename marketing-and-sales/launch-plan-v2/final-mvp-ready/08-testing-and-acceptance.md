# 08 — Testing, Security Review & Acceptance

Every task lists its own tests; this doc defines the shared strategy, the E2E scenarios that gate release, and the security checklist. Bug-free + secure is a release requirement, not optional.

---

## A. Test layers & tooling

- **Server unit/integration:** Node test runner or the framework already present (check `server/package.json` scripts; if none, add `node --test` based tests under `server/test/`). Use `supertest` for route integration against the Express app with a mocked `@aws-sdk/lib-dynamodb` DocumentClient (use `aws-sdk-client-mock`).
- **Frontend:** Playwright UI specs already exist under `tests/playwright/ui/**`. Add component tests there (or Vitest+RTL if configured).
- **Syntax gate:** `server/scripts/build.sh` (`node --check`) must pass for all touched server dirs (extend it to `services config agents errors`).
- **CFN:** `aws cloudformation validate-template` for `cfn-backend.yaml` and every `cron/*.yaml`.

### Known CI gap to fix first
The Playwright CI workflow path glob does not match where tests live (`tests/playwright/ui/**/*.spec.ts`). Fix `.github/workflows/playwright.yml` so new specs actually run, otherwise UI tests are dead weight. (Verify the glob; align workflow `paths`/test command with the real directory.)

---

## B. Per-EPIC test focus

- **E1 Onboarding:** route reachability; PaywallModal opens from banner; Bailey flag off = no-op; webhook signature accept/reject; processor command-parse table.
- **E2 Credits (highest rigor):**
  - Atomic deduction **concurrency test** — two parallel deducts exceeding balance: exactly one succeeds (assert conditional cancel).
  - 402 contract shape.
  - Webhook grant **idempotency** (duplicate delivery grants once).
  - Config change reflects within cache TTL.
  - Monthly reset idempotency (double-run same day = no-op).
- **E3 Email:** SES success path; SES-fail → Brevo fallback; both-fail → throws; recipients unchanged per route.
- **E4 Analytics:** metric math; members-with-zero appear; date-range filter; **cross-tenant isolation**; admin-only (403 for member); xlsx round-trips.
- **E5 Crons:** completeness rules per entity; expiry window boundary; WhatsApp-vs-email selection; per-member grouping.
- **E6 MCP/Agents:** `tools/list` complete; tool call performs CRM action with tenant; agent gated by flag + credits; audit written; no autosend unless enabled.

---

## C. E2E release scenarios (must all pass)

1. **Signup → trial:** Google login (new) → RoleSelection → Admin → RegisterAdmin → tenant + trial created → dashboard shows trial banner with days left.
2. **Upgrade:** Trial user opens PaywallModal → completes Razorpay (test mode) → webhook `subscription.activated` → UI reflects paid plan.
3. **Credits lifecycle:** New tenant has free credits → create lead (−10) / contact (−5) → balance updates → exhaust → next create returns 402 → BuyCreditsModal → pack purchase (test mode) → webhook grants → create succeeds. Monthly reset refreshes allotment.
4. **Email:** Trigger a grievance/feedback/billing email → delivered via SES (Brevo fallback if SES sandbox).
5. **Team analytics:** Admin opens `/admin/team-analytics` → sees members + metrics → filters by range → downloads Excel → opens member drawer. Member (non-admin) is redirected.
6. **Data-quality crons:** Seed incomplete + soon-expiring records → run cron handlers locally → admin/member receive correct digests (assert message content).
7. **(Flagged) WhatsApp gateway:** With Bailey mocked, inbound "lead: ..." creates a lead for the right tenant + replies + deducts credits.
8. **(Flagged) Agents:** With agents enabled for a test tenant + funded, creating a lead yields a qualification score; qualified lead gets routed/assigned; activity log shows credit-attributed entries.

---

## D. Security review checklist (run before merge of each EPIC)

- [ ] **Tenant isolation:** every new query/command derives `tenantId` from `req.tenantId` (or an explicit server-resolved value for crons/webhooks). Add a negative test proving tenant A cannot read/modify tenant B (credits, analytics, leads).
- [ ] **AuthZ:** admin/owner-only routes use `requireRole('ADMIN','FOUNDER','OWNER')`; frontend gating is not the enforcement boundary.
- [ ] **Input validation:** request bodies validated (reuse `server/validation/`); credit amounts/costs validated server-side; never trust client-supplied cost/tenant.
- [ ] **Webhook integrity:** Bailey + credit-purchase webhooks HMAC-verified (timing-safe), raw body preserved, idempotent on message/payment id.
- [ ] **Secrets:** no hardcoded keys (regression of the `ai-calling-service/deploy-lambda.ps1` incident). All via env/CFN `NoEcho` params. Grep the diff for keys before commit.
- [ ] **Least privilege IAM:** new Lambda roles scoped to the exact tables/actions; SES/Bedrock scoped where feasible.
- [ ] **PII/logging:** do not log tokens, full message bodies, or API keys; cap logged fields.
- [ ] **Money safety:** credit deduction atomic (transaction + condition); refund on failed mutation; agent runs deduct before invoke with a daily cap.
- [ ] **Rate limiting:** inbound WhatsApp webhook rate-limited per source number; reuse the `express-rate-limit` pattern from the auth service.
- [ ] **Run `/security-review`** on the branch diff before final commit.

---

## E. Definition of Done (per task)
1. Code matches existing style (ESM server / RR-v7 + Tailwind frontend / SDK v3).
2. Unit + integration tests written and passing.
3. `build.sh` syntax gate passes; CFN templates validate.
4. Security checklist items relevant to the task are ticked.
5. No secrets in diff; tenant isolation test present where data is read/written.
6. Acceptance criteria in the task demonstrably met (manual or automated).

---

## F. Suggested implementation order (for the agent picking these up)
1. **Infra foundation:** `07` table/param/IAM/env scaffolding + `build.sh`/`deploy.sh` zip-include fix (unblocks everything).
2. **E1-T1..T3** (onboarding core) — fastest user-visible win.
3. **E2-T1..T8** (credits) — the core monetization; do the atomic service + tests first.
4. **E3** (SES) — independent, parallelizable.
5. **E4** (analytics) + **E5** (crons) — parallelizable, share `dataQualityService`/`teamAnalyticsService` patterns.
6. **E6** (MCP then agents) — last; flag-gated pilot.
7. **Flagged items** (Bailey E1-T4..T6) whenever WABA access is ready.
