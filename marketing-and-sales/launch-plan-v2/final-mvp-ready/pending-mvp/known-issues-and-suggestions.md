# Known Issues, Bugs & Suggestions

## Bugs / Gaps Found During Implementation

### 🔴 Critical (block production)

1. **Auth internal WhatsApp lookup missing**  
   `server/routes/webhooks.js` calls `GET /internal/users/by-whatsapp?phone=` but this endpoint does **not exist** in `reality-flow-authentication`. Bailey inbound cannot resolve tenants until implemented.

2. ~~**Cron CFN templates incomplete**~~  
   ✅ **FIXED** — All 4 cron YAML files (`credit-reset`, `incomplete-data`, `expiring-agreements`, `team-summary`) now include `Code` (S3 ref), `Role` (IAM), and `Parameters`. Deploy with `LAMBDA_CODE_S3_BUCKET` + `LAMBDA_CODE_S3_KEY` env vars via `deploy-crons.sh`.

3. ~~**Data quality cron handlers are stubs**~~  
   ✅ **FIXED** — `incomplete-data-cron.js` and `expiring-agreements-cron.js` now scan all tenants from Subscriptions table, call `dataQualityService`, and send email (+ WhatsApp if Bailey enabled). `team-summary-cron.js` also fully implemented.

4. **Pre-existing `build.sh` failures**  
   Syntax errors in `routes/aiCallingInternal.js`, `areasBuildings.js`, `developers.js`, `flats.js` predate this work. The extended `build.sh` gate will fail CI until those are fixed.

5. ~~**`lead.created` EventBridge not wired**~~  
   ✅ **FIXED** — `leads.js` POST handler now publishes `crm.leads` / `lead.created` event after `createLead()`, guarded by `process.env.AGENTS_ENABLED === 'true'` so it's safe with agents disabled.

### 🟡 Medium (degrade gracefully)

6. **Agent runtime is simplified**  
   `agents/agentRuntime.js` uses basic Haiku invoke + regex tool detection, not full Bedrock tool-use loop per spec. Works for pilot but not production-grade agent behavior.

7. **Agent activity scan is inefficient**  
   `agentAuditService.getAgentActivity` uses DynamoDB Scan with `begins_with` filter. Acceptable for MVP admin UI with low volume; should use proper PK/SK pattern (`PK=TENANT#t`, `SK=AGENTLOG#ts`) for production.

8. **Credit reset anniversary logic is approximate**  
   `credit-reset-cron.js` uses `trialEndsAt`/`createdAt` day-match, not true billing anniversary from Razorpay. May reset on wrong day for paid subscribers.

9. **MCP server cannot run standalone without CRM deps**  
   `mcp-server/index.js` imports `skillInvoker` which imports `crmDynamodbService` — requires full server `node_modules` and AWS credentials. Documented but fragile for local dev.

10. **`GlassDataTable` column API assumption**  
    `TeamAnalytics.tsx` passes `columns` with `render` fn — verify `GlassDataTable` supports this prop shape; may need adjustment if table renders incorrectly.

11. **Team summary cron uses aggregate stats, not per-member breakdown**  
    `team-summary-cron.js` computes aggregate lead counts (total active, new today, closed today) without per-member stats because the auth service has no internal `/users` endpoint callable from Lambda. Per-member breakdown can be added after `GET /internal/users` is implemented in `reality-flow-authentication`.

### 🟢 Low / Polish

12. ~~**No admin nav link to Team Analytics**~~ ✅ **FIXED** — Added Link to `/admin/team-analytics` with `BarChart3` icon in `CRMDashboard.tsx` admin block  
13. **`AgentActivityLog` not mounted** in any page yet  
14. **ConnectWhatsApp calls wrong API path** — uses `/api/auth/whatsapp/pairing-qr` but auth routes mount at `/api/auth` ✓ (correct)  
15. **E5-T4 UI badges** not implemented (optional per spec)  
16. **PaywallModal** `openCheckout` now requires `planId` OR `orderId` — existing subscription flow unchanged

---

## Suggestions for Post-MVP

### Architecture
- **Unify cron deploy**: ✅ Done — `deploy-crons.sh` now passes `--parameter-overrides LambdaCodeS3Bucket/Key` to all stacks
- **Credit reset**: Store `billingAnniversaryDay` on subscription from Razorpay webhook instead of guessing from `trialEndsAt`
- **Agent audit**: Migrate to `PK=TENANT#{id}`, `SK=AGENTLOG#{isoTs}` for efficient Query
- **Webhook DLQ**: Implement SQS DLQ per `09-error-handling-recovery.md`
- **Team summary per-member stats**: Add `GET /internal/users` to auth service; pass service token from cron env

### Security
- Add rate limiting specifically on `/api/webhooks/whatsapp`
- Add integration test for cross-tenant credit isolation
- Rotate `BAILEY_WEBHOOK_SECRET` procedure in runbook

### UX
- Show credit cost on lead create form ("This will use 10 credits")
- Add low-credit banner to `CRMDashboard` (not just `CreditBalanceCard` on billing page)
- Link "Learn More" on 402 modal to `/crm/settings/billing`

### Observability
- Emit CloudWatch metrics: `creditService.deductCredits.insufficient`, `emailService.fallback_to_brevo`
- Add structured logging for all cron per-tenant failures

### Bailey
- Confirm actual Bailey API signature header names against vendor docs (assumed `x-bailey-signature` + `x-bailey-timestamp`)
- Consider AiSensy for outbound only, Bailey for inbound-only to reduce vendor risk

### Testing
- Add Vitest unit tests for `creditService` atomic deduction (mock TransactWrite)
- Add concurrency test for parallel deducts
- Wire Playwright CI to run `tests/playwright/ui/**` glob (not just `tests/*.spec.ts`)

---

## What Was Implemented Successfully

- ✅ RegisterAdmin route (E1-T1) — unblocks signup funnel
- ✅ Trial banner → PaywallModal wiring (E1-T2)
- ✅ Billing settings page (E1-T3)
- ✅ Bailey wrapper + webhook + processor scaffold (E1-T4–T6, flagged off)
- ✅ Full credit system with atomic TransactWrite (E2)
- ✅ `@modelcontextprotocol/sdk` dependency added to `server/package.json` (E6 blocker fixed)
- ✅ `clearConfigCache()` called after all `updateConfig()` in `creditAdmin.js` (bug fixed)
- ✅ SES-first emailService with Brevo fallback (E3)
- ✅ Team analytics API + Excel export + frontend page (E4)
- ✅ Team Analytics nav link in admin header (E4 polish)
- ✅ dataQualityService logic (E5-T1)
- ✅ incomplete-data-cron.js fully implemented (E5)
- ✅ expiring-agreements-cron.js fully implemented (E5)
- ✅ team-summary-cron.js fully implemented (E5)
- ✅ All 4 cron CFN templates have Code + IAM Role + Parameters (E5/E6 infra)
- ✅ deploy-crons.sh passes `--parameter-overrides` with S3 bucket/key (deploy fix)
- ✅ EventBridge `lead.created` publish in leads.js POST handler (E6)
- ✅ skillInvoker + MCP server + agentRuntime scaffold (E6)
- ✅ CFN tables, IAM, env vars, deploy.sh agents/ zip
