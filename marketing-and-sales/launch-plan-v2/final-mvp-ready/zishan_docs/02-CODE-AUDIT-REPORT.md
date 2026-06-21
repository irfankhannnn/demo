# MVP Code Audit Report — Plan vs Actual Implementation
## Verified Against `final-mvp-ready/` Plan (7 Parallel Agents)

> **NOTE:** This document reflects the state before cron jobs were merged into cfn-backend.yaml. For current deployment, see 08-FINAL-IMPLEMENTATION-PLAN.md. All 10 cron jobs are now deployed as part of the single cfn-backend.yaml template via one-click deployment (./deploy.sh).

**Audit Date:** 2026-06-20
**Method:** 7 parallel verification agents, each auditing one EPIC + infrastructure
**Scope:** Every file, function, route, table, and CFN resource mentioned in the plan
**Verdict:** Code is ~80% complete. **5 CRITICAL blockers** prevent deployment.

---

## Executive Summary

| EPIC | Status | Completion | Critical Issues |
|------|--------|------------|-----------------|
| **E1 Onboarding + WhatsApp** | ✅ PASS | 95% | 0 blockers, 2 minor |
| **E2 Credit System** | ⚠️ PARTIAL | 85% | 1 blocker (deploy.sh params) |
| **E3 Email SES** | ⚠️ PARTIAL | 70% | 2 blockers (syntax error, deploy.sh) |
| **E4 Team Analytics** | ✅ PASS | 100% | 0 issues |
| **E5 Data Quality Crons** | ⚠️ PARTIAL | 85% | 1 logic gap (member notifications) |
| **E6 MCP + Agents** | ⚠️ PARTIAL | 60% | 2 missing tasks, hardcoded score |
| **Infrastructure** | ⚠️ PARTIAL | 70% | 1 blocker (deploy.sh), 3 missing cron templates |

**Overall:** ~80% of planned code exists and is functionally correct. The remaining 20% is split between **deployment-blocking config issues** and **missing agent features (E6-T5, E6-T6)**.

---

## CRITICAL BLOCKERS (5 — Must Fix Before Deployment)

### 🔴 BLOCKER #1: `deploy.sh` missing 8 new CFN parameters
**Severity:** CRITICAL — Deployment will use defaults, not .env values  
**Files:** `server/infra/deploy.sh` (lines 147-183, 190-224)  
**Issue:** 8 new parameters defined in `cfn-backend.yaml` are NOT passed by `deploy.sh`:
- `CreditsTableName`, `CreditConfigTableName`
- `SesFromEmail`, `EmailProviderPrimary`
- `BaileyEnabled`, `BaileyApiKey`, `BaileyWebhookSecret`
- `AgentsEnabled`

**Impact:** CFN will use defaults (which happen to match for most), but secrets (BaileyApiKey, BaileyWebhookSecret) will be empty. Lambda cannot verify Bailey webhooks or connect to SES with custom sender.

**Fix:** Add these 8 parameters to both the `cfn-params.json` heredoc and the `PARAM_OVERRIDES` array in `deploy.sh`.

---

### 🔴 BLOCKER #2: `escalation-cron.js` syntax error
**Severity:** CRITICAL — Cron Lambda will fail to load  
**File:** `server/scripts/escalation-cron.js` (line 98)  
**Issue:** Handler function missing closing brace `}`. Code after line 98 is orphaned outside the function scope.

```javascript
// Line 92-98: Missing } after finally block
export async function handler(event) {
  try {
    await runEscalation();
    return { statusCode: 200, ... };
  } finally {
    await shutdownPostHog();
  }
// ← MISSING CLOSING BRACE HERE
```

**Fix:** Add `}` after line 98 to close the handler function.

---

### 🔴 BLOCKER #3: Cron YAML templates missing SES env vars + IAM
**Severity:** CRITICAL — Cron Lambdas cannot send email via SES  
**Files:** `cron/trial-reminder.yaml`, `cron/escalate-openclaw.yaml`  
**Issue:** Both templates are missing:
- `AWS_SES_FROM_EMAIL` environment variable
- `EMAIL_PROVIDER_PRIMARY=ses` environment variable
- `ses:SendEmail`, `ses:SendRawEmail` IAM permissions

**Impact:** Crons will fall back to Brevo (if API key present) or silently fail to send email. SES migration is incomplete for crons.

**Fix:** Add SES env vars + IAM permissions to both cron templates.

---

### 🔴 BLOCKER #4: `lead-qualifier.yaml` incomplete (no Code/Role/Env)
**Severity:** HIGH — Cron stack deployment will fail  
**File:** `cron/lead-qualifier.yaml` (lines 17-24)  
**Issue:** Lambda function definition is missing:
- `Code` block (S3Bucket/S3Key) — required for deployment
- `Role` — Lambda cannot assume execution role
- `Environment.Variables` — cannot access DynamoDB/Bedrock

**Fix:** Add Code block, IAM role with DynamoDB+Bedrock+EventBridge permissions, and environment variables.

---

### 🔴 BLOCKER #5: 3 cron templates completely missing
**Severity:** HIGH — `deploy-crons.sh` will skip these stacks  
**Missing files:**
1. `cron/lead-followup.yaml` — daily follow-up agent (E6-T6)
2. `cron/lead-router.yaml` — qualified lead assignment (E6-T5)
3. `cron/whatsapp-processor.yaml` — EventBridge-triggered WhatsApp processing (E1-T7 infra)

**Note:** Handler scripts exist for whatsapp-processor.js, but NOT for lead-router-handler.js or lead-followup-cron.js.

**Fix:** Create the 3 missing YAML templates + 2 missing handler scripts.

---

## EPIC-BY-EPIC FINDINGS

### EPIC 1: Onboarding + Bailey WhatsApp Gateway — ✅ 95% PASS

| Task | Status | Notes |
|------|--------|-------|
| E1-T1 RegisterAdmin route | ✅ PASS | Route at App.tsx:322, component exists (224 lines) |
| E1-T2 Trial banner + upgrade | ✅ PASS | TrialCountdownBanner mounted, PaywallModal wired |
| E1-T3 Billing settings page | ✅ PASS | BillingSettings.tsx (185 lines), route at App.tsx:376 |
| E1-T4 Bailey gateway | ✅ PASS | bailey.js (112 lines), ConnectWhatsApp.tsx, usersModel.ts fields |
| E1-T5 Bailey webhook route | ✅ PASS | webhooks.js mounted before express.json(), HMAC verified |
| E1-T6 WhatsApp audit service | ✅ PASS | whatsappAuditService.js (60 lines), logMessage + logOutcome |
| E1-T7 WhatsApp processor | ✅ PASS | whatsapp-message-processor.js (118 lines), handler + parser |

**Minor issues (non-blocking):**
1. `gracePeriodActive` not in `SubscriptionContextValue` interface (works via hook workaround)
2. `BAILEY_API_ENDPOINT` not in CFN parameters (bailey.js defaults to `https://api.bailey.ai`)

---

### EPIC 2: Unified Credit System — ⚠️ 85% PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| E2-T1 Credit config + tables | ⚠️ PARTIAL | Tables + creditConfig.js correct; **deploy.sh missing params** |
| E2-T2 CreditService atomic | ✅ PASS | TransactWrite with ConditionExpression, InsufficientCreditsError inline |
| E2-T3 Metering middleware | ⚠️ PARTIAL | meterCredits.js exists but NOT used as middleware; manual pre/post pattern instead; **no refund on handler failure** |
| E2-T4 Credit purchase webhook | ✅ PASS | billing.js handles payment.captured → grantCredits, idempotent |
| E2-T5 Monthly credit reset | ✅ PASS | credit-reset-cron.js, billingAnniversaryDay, idempotent |
| E2-T6 Admin config UI | ✅ PASS | creditAdmin.js, CreditBalanceCard, BuyCreditsModal, CreditsContext |

**Issues:**
1. **deploy.sh missing `CreditsTableName` + `CreditConfigTableName` params** (BLOCKER #1)
2. **meterCredits not used as middleware** — routes use manual `precheckCredits` + `chargeCreditsForAction` pattern instead. Functionally works but doesn't match documented architecture.
3. **No refund on handler failure** — if handler throws after `chargeCreditsForAction`, credits are NOT refunded. Plan explicitly mentions refund logic.

---

### EPIC 3: Email SES Migration — ⚠️ 70% PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| E3-T1 emailService.js | ✅ PASS | SES primary + Brevo fallback, 5s timeout each, @aws-sdk/client-sesv2 |
| E3-T2 Migrate routes | ✅ PASS | billing.js, grievance.js, feedback.js all use sendEmail; auth.js correctly left on Brevo |
| E3-T3 Migrate crons | ⚠️ PARTIAL | **escalation-cron.js syntax error**; both cron YAMLs missing SES env + IAM |
| E3-T4 Config + IAM + doc | ⚠️ PARTIAL | .env.example + cfn-backend.yaml correct; **deploy.sh missing SES params** |

**Issues:**
1. **escalation-cron.js syntax error** (BLOCKER #2) — missing closing brace
2. **Cron YAMLs missing SES env vars + IAM** (BLOCKER #3)
3. **deploy.sh missing `SesFromEmail` + `EmailProviderPrimary` params** (part of BLOCKER #1)

---

### EPIC 4: Team Analytics — ✅ 100% PASS

| Task | Status | Notes |
|------|--------|-------|
| E4-T1 Backend aggregation | ✅ PASS | admin.js, teamAnalyticsService.js, correct middleware chain |
| E4-T2 Excel export | ✅ PASS | excel.js, xlsx dependency, correct headers |
| E4-T3 Frontend page | ✅ PASS | TeamAnalytics.tsx, GlassDataTable, date filter, export, drawer |
| E4-T4 WhatsApp summary cron | ✅ PASS | team-summary-cron.js, team-summary.yaml, Bailey + email fallback |

**Issues:** None. This is the only EPIC with zero issues.

---

### EPIC 5: Data Quality Crons — ⚠️ 85% PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| E5-T1 Incomplete-record detector | ✅ PASS | dataQualityService.js, all completeness rules correct |
| E5-T2 Incomplete-data cron | ✅ PASS | Tenant iteration implemented, WhatsApp/email delivery |
| E5-T3 Expiring-agreements cron | ⚠️ PARTIAL | **Missing member grouping + individual notifications** |
| E5-T4 UI badges (optional) | ⏭️ SKIPPED | Optional, acceptable for MVP |

**Issues:**
1. **E5-T3 missing member notifications** — Plan requires grouping expiring agreements by `assignedTo` and messaging each member + admin roll-up. Current implementation only sends to admin. No member contact lookup, no grouping logic.

---

### EPIC 6: MCP + Agents — ⚠️ 60% PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| E6-T1 Skill invoker | ⚠️ PARTIAL | Works but **missing 10 of 22 tools**; **no input validation** |
| E6-T2 MCP server | ✅ PASS | index.js, tools.js, .mcp.json registered, stdio transport |
| E6-T3 Agent runtime | ✅ PASS | Bedrock tool-use loop, credit gating, audit logging |
| E6-T4 Lead qualifier | ⚠️ PARTIAL | Handler exists but **hardcoded score='WARM'**; no idempotency |
| E6-T5 Lead router | ❌ FAIL | **Completely missing** (handler + YAML) |
| E6-T6 Lead followup | ❌ FAIL | **Completely missing** (handler + YAML) |
| E6-T7 Agent activity log | ✅ PASS | admin.js endpoint + AgentActivityLog.tsx |

**Issues:**
1. **E6-T5 lead-router-handler.js MISSING** — no handler script, no YAML template
2. **E6-T6 lead-followup-cron.js MISSING** — no handler script, no YAML template
3. **skillInvoker.js incomplete tool map** — only 12 of 22 planned tools mapped. Missing: `get_contact`, `update_contact`, `get_property`, `update_property`, `get_tenant`, `update_tenant`, `search_buyers`, `get_buyer`, `update_buyer`, `convert_lead`
4. **No input validation in skillInvoker.js** — plan requires validation against `crmSchemas.js` before mutations; not implemented
5. **Lead qualifier hardcoded score** — always sets `score='WARM'` instead of extracting from agent response
6. **No idempotency in lead qualifier** — will re-score leads if triggered multiple times
7. **Duplicate agentAuditService.js** — root-level `server/agentAuditService.js` is unused; `server/agents/agentAuditService.js` is the correct one

---

### Infrastructure — ⚠️ 70% PARTIAL

| Item | Status | Notes |
|------|--------|-------|
| DynamoDB tables (CFN) | ✅ PASS | CreditsTable + CreditConfigTable correctly defined |
| IAM permissions | ✅ PASS | DynamoDB, SES, EventBridge, Bedrock all present |
| Lambda env vars | ✅ PASS | All 8 new env vars in cfn-backend.yaml |
| Cron templates (8 total) | ⚠️ PARTIAL | 5 exist, 3 missing, 1 incomplete (lead-qualifier) |
| server.js route mounts | ✅ PASS | webhooks before json(), admin + creditAdmin after |
| deploy.sh params | ❌ FAIL | **8 new params NOT wired** (BLOCKER #1) |
| build.sh | ✅ PASS | Checks root *.js + agents/ dir |
| deploy-crons.sh | ✅ PASS | Helper exists, references correct paths |

**Missing cron templates:**
- `cron/lead-followup.yaml` (E6-T6)
- `cron/lead-router.yaml` (E6-T5)
- `cron/whatsapp-processor.yaml` (E1-T7 infra)

**Incomplete cron template:**
- `cron/lead-qualifier.yaml` — missing Code block, IAM role, environment variables

**Schedule mismatch (minor):**
- `cron/credit-reset.yaml` uses `cron(0 19 * * ? *)` but plan says `cron(30 18 * * ? *)` (30 min difference)

---

## COMPLETE ISSUE LIST (Sorted by Severity)

### 🔴 CRITICAL (5 — Block deployment)

| # | Issue | File | EPIC |
|---|-------|------|------|
| 1 | deploy.sh missing 8 CFN parameters | server/infra/deploy.sh | Infra/E2/E3 |
| 2 | escalation-cron.js syntax error (missing `}`) | server/scripts/escalation-cron.js:98 | E3 |
| 3 | Cron YAMLs missing SES env vars + IAM | cron/trial-reminder.yaml, cron/escalate-openclaw.yaml | E3 |
| 4 | lead-qualifier.yaml incomplete (no Code/Role/Env) | cron/lead-qualifier.yaml | E6/Infra |
| 5 | 3 cron templates missing | cron/lead-followup.yaml, cron/lead-router.yaml, cron/whatsapp-processor.yaml | E6/Infra |

### 🟡 HIGH (5 — Functional gaps)

| # | Issue | File | EPIC |
|---|-------|------|------|
| 6 | E6-T5 lead-router-handler.js + YAML missing | server/scripts/lead-router-handler.js | E6 |
| 7 | E6-T6 lead-followup-cron.js + YAML missing | server/scripts/lead-followup-cron.js | E6 |
| 8 | E5-T3 missing member grouping + notifications | server/scripts/expiring-agreements-cron.js | E5 |
| 9 | skillInvoker.js missing 10 of 22 tools | server/skillInvoker.js:18-32 | E6 |
| 10 | No input validation in skillInvoker.js | server/skillInvoker.js | E6 |

### 🟠 MEDIUM (5 — Logic issues)

| # | Issue | File | EPIC |
|---|-------|------|------|
| 11 | Lead qualifier hardcoded score='WARM' | server/scripts/lead-qualifier-handler.js:19 | E6 |
| 12 | No refund on handler failure (credit metering) | server/routes/leads.js | E2 |
| 13 | meterCredits not used as middleware (manual pattern) | server/routes/leads.js | E2 |
| 14 | No idempotency in lead qualifier | server/scripts/lead-qualifier-handler.js | E6 |
| 15 | Duplicate agentAuditService.js (unused root copy) | server/agentAuditService.js | E6 |

### 🔵 LOW (3 — Cosmetic/minor)

| # | Issue | File | EPIC |
|---|-------|------|------|
| 16 | gracePeriodActive not in SubscriptionContextValue interface | real-estate-crm-app/src/contexts/SubscriptionContext.tsx:24 | E1 |
| 17 | BAILEY_API_ENDPOINT not in CFN params (hardcoded default) | server/infra/cfn-backend.yaml | E1 |
| 18 | credit-reset.yaml schedule mismatch (30 min off) | cron/credit-reset.yaml:55 | Infra |

---

## WHAT'S ACTUALLY WORKING (Verified Correct)

### ✅ Backend Services (all verified line-by-line)
- `server/creditService.js` — atomic TransactWrite, InsufficientCreditsError, all 5 functions
- `server/creditConfig.js` — 60s cache, fallback defaults, seed function
- `server/emailService.js` — SES primary + Brevo fallback, 5s timeout, @aws-sdk/client-sesv2
- `server/bailey.js` — getPairingQr, sendWhatsAppMessage, verifyBaileySignature, feature-flagged
- `server/teamAnalyticsService.js` — cross-service join, all memberMetrics fields
- `server/dataQualityService.js` — all completeness rules, expiring agreements
- `server/whatsappAuditService.js` — logMessage, logOutcome
- `server/razorpayOrders.js` — createOrder
- `server/agents/agentRuntime.js` — Bedrock tool-use loop, credit gating, audit logging
- `server/agents/agentAuditService.js` — logAgentAction, getAgentActivity
- `server/skillInvoker.js` — invokeSkill (partial tool map)
- `server/middleware/meterCredits.js` — factory + helpers (not used as middleware though)

### ✅ Routes (all verified)
- `server/routes/admin.js` — team-analytics, export, agent-activity (admin-gated)
- `server/routes/creditAdmin.js` — GET config, PUT costs/packs/free-tier
- `server/routes/webhooks.js` — POST /whatsapp (HMAC verified, idempotent)
- `server/routes/billing.js` — payment.captured → grantCredits, HMAC verified
- `server/routes/subscriptions.js` — GET /credits, /credits/ledger, POST /credits/purchase
- `server/routes/leads.js` — EventBridge publish (guarded by AGENTS_ENABLED)

### ✅ Cron Handlers (verified)
- `server/scripts/credit-reset-cron.js` — tenant iteration, billingAnniversaryDay, idempotent
- `server/scripts/incomplete-data-cron.js` — tenant iteration, WhatsApp/email
- `server/scripts/expiring-agreements-cron.js` — tenant iteration (but missing member grouping)
- `server/scripts/team-summary-cron.js` — per-member breakdown, Bailey + email
- `server/scripts/trial-reminder-cron.js` — uses emailService.sendEmail
- `server/scripts/whatsapp-message-processor.js` — parseWhatsAppCommand, handler

### ✅ Frontend (all verified)
- `RegisterAdmin.tsx` — form submits to /auth/register-admin
- `TrialCountdownBanner.tsx` — trial days + upgrade button
- `BillingSettings.tsx` — plan info, CreditBalanceCard, BuyCreditsModal, AgentActivityLog
- `ConnectWhatsApp.tsx` — Bailey QR, provider selector, skip option
- `TeamAnalytics.tsx` — GlassDataTable, date filter, Excel export, member drawer
- `CreditBalanceCard.tsx` — balance, progress bar, low-credit warning
- `BuyCreditsModal.tsx` — pack options, Razorpay integration
- `AgentActivityLog.tsx` — agent action log display

### ✅ Infrastructure (verified)
- `cfn-backend.yaml` — CreditsTable, CreditConfigTable, IAM (DynamoDB/SES/EventBridge/Bedrock), env vars
- `deploy.sh` — zip includes agents/, excludes mcp-server/* (but missing params)
- `build.sh` — checks root *.js + agents/
- `deploy-crons.sh` — helper for individual cron deployment
- `.mcp.json` — nabi-crm stdio server registered

---

## RECOMMENDED FIX ORDER

### Phase 1: Fix Deployment Blockers (1-2 days)
1. Fix `deploy.sh` — add 8 missing CFN parameters
2. Fix `escalation-cron.js` — add missing closing brace
3. Fix `cron/trial-reminder.yaml` + `cron/escalate-openclaw.yaml` — add SES env + IAM
4. Fix `cron/lead-qualifier.yaml` — add Code, Role, Environment

### Phase 2: Complete Missing Agent Features (2-3 days)
5. Create `server/scripts/lead-router-handler.js` + `cron/lead-router.yaml`
6. Create `server/scripts/lead-followup-cron.js` + `cron/lead-followup.yaml`
7. Create `cron/whatsapp-processor.yaml`
8. Add missing 10 tools to `skillInvoker.js` TOOL_MAP
9. Add input validation to `skillInvoker.js` using `crmSchemas.js`

### Phase 3: Fix Logic Issues (1-2 days)
10. Fix `lead-qualifier-handler.js` — extract score from agent response (not hardcoded)
11. Add idempotency check to lead qualifier
12. Fix `expiring-agreements-cron.js` — add member grouping + individual notifications
13. Add refund mechanism for credit metering on handler failure
14. Delete duplicate `server/agentAuditService.js`

### Phase 4: Minor Fixes (0.5 day)
15. Add `gracePeriodActive` to `SubscriptionContextValue` interface
16. Add `BAILEY_API_ENDPOINT` to CFN parameters
17. Fix `credit-reset.yaml` schedule (if 30 min difference matters)

---

## VERDICT

**Can the MVP launch today?** No. 5 critical blockers prevent deployment.

**Can the MVP launch after Phase 1 fixes (1-2 days)?** Yes, if you accept:
- E6-T5 (lead router) and E6-T6 (lead followup) are not implemented — agents disabled by default anyway (`AGENTS_ENABLED=false`)
- E5-T3 member notifications not implemented — admin-only alerts work
- skillInvoker has partial tool map — agents disabled by default anyway
- No refund on handler failure — low risk for MVP volume

**Recommended path:** Fix Phase 1 (deployment blockers) → Deploy with agents disabled → Fix Phase 2-3 in parallel post-launch.

---

**Audit completed:** 2026-06-20  
**Agents used:** 7 parallel verification agents  
**Files verified:** 40+ source files, 8 CFN templates, 6 frontend pages  
**Issues found:** 18 total (5 critical, 5 high, 5 medium, 3 low)
