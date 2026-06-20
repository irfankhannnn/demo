# Known Issues, Bugs & Suggestions

## Bugs / Gaps Found During Implementation

### 🔴 Critical (block production)

1. ~~**Auth internal WhatsApp lookup missing**~~  
   ✅ **FIXED** — `GET /internal/users/by-whatsapp?phone=` implemented in `reality-flow-authentication/src/routes/internal.ts`. Queries `WhatsAppIndex` GSI on UsersTable (`GSI_WhatsAppPK = WHATSAPP#<phone>`). Protected by `x-internal-api-key`. Bailey webhook in `server/routes/webhooks.js` already calls this endpoint.

2. ~~**Cron CFN templates incomplete**~~  
   ✅ **FIXED** — All 4 cron YAML files (`credit-reset`, `incomplete-data`, `expiring-agreements`, `team-summary`) now include `Code` (S3 ref), `Role` (IAM), and `Parameters`. Deploy with `LAMBDA_CODE_S3_BUCKET` + `LAMBDA_CODE_S3_KEY` env vars via `deploy-crons.sh`.

3. ~~**Data quality cron handlers are stubs**~~  
   ✅ **FIXED** — `incomplete-data-cron.js` and `expiring-agreements-cron.js` now scan all tenants from Subscriptions table, call `dataQualityService`, and send email (+ WhatsApp if Bailey enabled). `team-summary-cron.js` also fully implemented with per-member breakdown.

4. **Pre-existing `build.sh` failures**  
   Investigated — the 4 flagged files (`routes/aiCallingInternal.js`, `areasBuildings.js`, `developers.js`, `flats.js`) have syntactically valid JS (large `/* */` comment blocks). Build script uses `2>/dev/null || true` so it won't block CI. No action needed for MVP.

5. ~~**`lead.created` EventBridge not wired**~~  
   ✅ **FIXED** — `leads.js` POST handler now publishes `crm.leads` / `lead.created` event after `createLead()`, guarded by `process.env.AGENTS_ENABLED === 'true'` so it's safe with agents disabled.

### 🟡 Medium (degrade gracefully)

6. ~~**Agent runtime is simplified**~~  
   ✅ **FIXED** — `agents/agentRuntime.js` now uses native Bedrock tool-use API (`tools` field, `tool_use`/`tool_result` messages, up to 5-turn loop). Regex-based tool detection removed.

7. ~~**Agent activity scan is inefficient**~~  
   ✅ **FIXED** — `agents/agentAuditService.js` created with `PK=TENANT#<tenantId>`, `SK=AGENTLOG#<isoTs>#<rand>` pattern. Uses `QueryCommand` with `ScanIndexForward: false` (newest first). No full table scan.

8. ~~**Credit reset anniversary logic is approximate**~~  
   ✅ **FIXED** — `billing.js` `subscription.activated` handler now extracts `billingAnniversaryDay = new Date(subscription.start_at * 1000).getUTCDate()` from Razorpay webhook and persists via `setBillingAnniversaryDay()` in `subscriptionService.js`. `credit-reset-cron.js` uses this field for exact monthly reset; falls back to `trialEndsAt` day-match only for trial accounts.

9. **MCP server cannot run standalone without CRM deps**  
   `mcp-server/index.js` imports `skillInvoker` which imports `crmDynamodbService` — requires full server `node_modules` and AWS credentials. Documented in `pending-tasks.md`. Acceptable for Lambda deployment; fragile for local dev without env.

10. ~~**`GlassDataTable` column API assumption**~~  
    ✅ **FIXED** — `TeamAnalytics.tsx` all 9 columns updated to use `header:` (not `label:`). `render` function signatures updated to `(_: unknown, item: MemberMetric)` two-arg form. `keyExtractor`, `emptyMessage`, `searchPlaceholder` added.

11. ~~**Team summary cron uses aggregate stats, not per-member breakdown**~~  
    ✅ **FIXED** — `team-summary-cron.js` now calls `GET /internal/users/list?tenantId=` (auth service internal endpoint, protected by `INTERNAL_API_KEY`) to fetch team members, then computes per-member active/closed-today counts. Falls back to aggregate-only if `INTERNAL_API_KEY` not set.

### 🟢 Low / Polish

12. ~~**No admin nav link to Team Analytics**~~ ✅ **FIXED** — Added Link to `/admin/team-analytics` with `BarChart3` icon in `CRMDashboard.tsx` admin block  
13. ~~**`AgentActivityLog` not mounted** in any page yet~~ ✅ **FIXED** — Mounted in `BillingSettings.tsx` below subscription card  
14. ~~**ConnectWhatsApp calls wrong API path**~~ ✅ **CONFIRMED CORRECT** — uses `/api/auth/whatsapp/pairing-qr` which is correct (auth routes mount at `/api/auth`). Also redesigned with provider selector (Bailey = Recommended/active, Meta Official = Coming soon/disabled).  
15. **E5-T4 UI badges** not implemented — incomplete record count badges in nav/sidebar. Post-MVP polish.  
16. ~~**PaywallModal** `openCheckout` now requires `planId` OR `orderId`~~ ✅ — existing subscription flow unchanged; auto-detects Orders vs Subscriptions

### 🔵 New — Added This Session

17. ~~**No rate limiting on `/api/webhooks/whatsapp`**~~  
    ✅ **FIXED** — `webhookRateLimit` (20 req/min per IP) applied to POST `/whatsapp` route in `webhooks.js`.

18. ~~**No CloudWatch metrics emitted**~~  
    ✅ **FIXED** — `server/observability/cloudwatch.js` created. Emits `creditService.deductCredits.insufficient`, `emailService.fallback_to_brevo`, `emailService.both_failed`, `emailService.sent_via_ses`, `webhooks.whatsapp.*`, `agentAction.*`, `cron.tenantFailed`, `creditService.creditReset`. Gated by `CLOUDWATCH_METRICS_ENABLED=true`. Wired into `emailService.js` and `agentRuntime.js`.

19. ~~**Import path mismatch for agentAuditService**~~  
    ✅ **FIXED** — `server/routes/admin.js` updated to import from `'../agents/agentAuditService.js'` (was `'../agentAuditService.js'`).

20. **Structured cron logging** — Error logs in all three cron scripts now include `stack: err.stack?.split('\n')[1]` for first meaningful stack frame.

---

## Suggestions for Post-MVP

### Architecture
- **Unify cron deploy**: ✅ Done — `deploy-crons.sh` now passes `--parameter-overrides LambdaCodeS3Bucket/Key` to all stacks
- **Credit reset**: ✅ Done — `billingAnniversaryDay` stored from Razorpay `subscription.start_at`
- **Agent audit**: ✅ Done — Migrated to `PK=TENANT#{id}`, `SK=AGENTLOG#{isoTs}#{rand}` for efficient Query
- **Webhook DLQ**: Implement SQS DLQ per `09-error-handling-recovery.md`
- **Team summary per-member stats**: ✅ Done — `GET /internal/users/list` now callable from cron

### Security
- Add rate limiting on `/api/auth/*` routes (authRateLimit already exported from rateLimiter.js) — wire in auth service
- Add integration test for cross-tenant credit isolation
- Rotate `BAILEY_WEBHOOK_SECRET` procedure in runbook

### UX
- Show credit cost on lead create form ("This will use 10 credits") — Post-MVP
- Add low-credit banner to `CRMDashboard` (not just `CreditBalanceCard` on billing page) — Post-MVP
- Link "Learn More" on 402 modal to `/crm/settings/billing` — Post-MVP
- E5-T4 incomplete record count badges in admin nav — Post-MVP

### Observability
- ✅ CloudWatch metrics spec: see `observability-dashboard-spec.md`
- ✅ `creditService.deductCredits.insufficient` emitted from `meterCredits.js`
- ✅ `emailService.fallback_to_brevo` emitted from `emailService.js`
- ✅ Structured per-tenant failure logging in all crons (includes stack frame)
- Add CloudWatch Logs Insights queries to runbook (see `observability-dashboard-spec.md`)

### Bailey / WhatsApp
- ✅ Bailey = MVP primary inbound (QR pairing, webhook signature verified)
- ✅ AiSensy = outbound broadcasts (already used in billing.js)
- ✅ Meta Official = Phase 2 choice (placeholder in ConnectWhatsApp.tsx with "Coming soon")
- Confirm actual Bailey API signature header names against vendor docs (assumed `x-bailey-signature` + `x-bailey-timestamp`)

### Testing
- Add Vitest unit tests for `creditService` atomic deduction (mock TransactWrite)
- Add concurrency test for parallel deducts
- Wire Playwright CI to run `tests/playwright/ui/**` glob (not just `tests/*.spec.ts`)

---

## What Was Implemented Successfully

- ✅ RegisterAdmin route (E1-T1) — unblocks signup funnel
- ✅ Trial banner → PaywallModal wiring (E1-T2)
- ✅ Billing settings page (E1-T3) + AgentActivityLog mounted here
- ✅ Bailey wrapper + webhook + processor scaffold (E1-T4–T6, flagged off)
- ✅ ConnectWhatsApp redesigned: Bailey (Recommended) + Meta Official (Coming soon) provider selector
- ✅ Full credit system with atomic TransactWrite (E2)
- ✅ `@modelcontextprotocol/sdk` dependency added to `server/package.json` (E6 blocker fixed)
- ✅ `clearConfigCache()` called after all `updateConfig()` in `creditAdmin.js` (bug fixed)
- ✅ SES-first emailService with Brevo fallback (E3) + CloudWatch metrics wired
- ✅ Team analytics API + Excel export + frontend page (E4) — GlassDataTable column fix applied
- ✅ Team Analytics nav link in admin header (E4 polish)
- ✅ dataQualityService logic (E5-T1)
- ✅ incomplete-data-cron.js fully implemented (E5)
- ✅ expiring-agreements-cron.js fully implemented (E5)
- ✅ team-summary-cron.js fully implemented with per-member breakdown via internal users API (E5)
- ✅ All 4 cron CFN templates have Code + IAM Role + Parameters (E5/E6 infra)
- ✅ deploy-crons.sh passes `--parameter-overrides` with S3 bucket/key (deploy fix)
- ✅ EventBridge `lead.created` publish in leads.js POST handler (E6)
- ✅ skillInvoker + MCP server + agentRuntime scaffold (E6) — agentRuntime upgraded to native Bedrock tool-use
- ✅ agentAuditService.js created with efficient PK/SK pattern (E6)
- ✅ CFN tables, IAM, env vars, deploy.sh agents/ zip
- ✅ `GET /internal/users/by-whatsapp` endpoint in auth service (unblocks Bailey webhook)
- ✅ `GET /internal/users/list` endpoint in auth service (enables per-member cron stats)
- ✅ billingAnniversaryDay persisted from Razorpay `subscription.start_at` (E2 precision fix)
- ✅ Webhook rate limiting applied (20 req/min per IP)
- ✅ CloudWatch observability layer (`server/observability/cloudwatch.js`)
- ✅ Observability dashboard spec (`observability-dashboard-spec.md`)
- ✅ rateLimiter.js rewritten as factory (webhookRateLimit / authRateLimit / strictRateLimit)
- ✅ AgentActivityLog mounted in BillingSettings.tsx
- ✅ Admin.js import path corrected to `'../agents/agentAuditService.js'`
