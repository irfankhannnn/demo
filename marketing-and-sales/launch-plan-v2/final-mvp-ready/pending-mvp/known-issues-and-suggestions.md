# Known Issues, Bugs & Suggestions

## Bugs / Gaps Found During Implementation

### 🔴 Critical (block production)

1. **Auth internal WhatsApp lookup missing**  
   `server/routes/webhooks.js` calls `GET /internal/users/by-whatsapp?phone=` but this endpoint does **not exist** in `reality-flow-authentication`. Bailey inbound cannot resolve tenants until implemented.

2. **Cron CFN templates incomplete**  
   New cron YAML files (`incomplete-data`, `expiring-agreements`, `team-summary`, `lead-qualifier`) define Lambda functions without `Code` property pointing to S3 artifact. They will deploy empty shells. Mirror the full `trial-reminder.yaml` pattern including S3 code reference and execution role with table permissions.

3. **Data quality cron handlers are stubs**  
   `incomplete-data-cron.js` and `expiring-agreements-cron.js` log start but do not iterate tenants or send messages. E5 acceptance not met until completed.

4. **Pre-existing `build.sh` failures**  
   Syntax errors in `routes/aiCallingInternal.js`, `areasBuildings.js`, `developers.js`, `flats.js` predate this work. The extended `build.sh` gate will fail CI until those are fixed.

5. **`lead.created` EventBridge not wired**  
   EPIC 6 lead qualifier expects EventBridge event on lead create, but `leads.js` POST handler does not publish `crm.leads` / `lead.created` yet.

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

### 🟢 Low / Polish

11. **No admin nav link to Team Analytics** — route exists but not in sidebar  
12. **`AgentActivityLog` not mounted** in any page yet  
13. **ConnectWhatsApp calls wrong API path** — uses `/api/auth/whatsapp/pairing-qr` but auth routes mount at `/api/auth` ✓ (correct)  
14. **E5-T4 UI badges** not implemented (optional per spec)  
15. **PaywallModal** `openCheckout` now requires `planId` OR `orderId` — existing subscription flow unchanged

---

## Suggestions for Post-MVP

### Architecture
- **Unify cron deploy**: Single `deploy-crons.sh` should pass S3 bucket/key params to all cron stacks via `--parameter-overrides`
- **Credit reset**: Store `billingAnniversaryDay` on subscription from Razorpay webhook instead of guessing from `trialEndsAt`
- **Agent audit**: Migrate to `PK=TENANT#{id}`, `SK=AGENTLOG#{isoTs}` for efficient Query
- **Webhook DLQ**: Implement SQS DLQ per `09-error-handling-recovery.md`

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
- ✅ SES-first emailService with Brevo fallback (E3)
- ✅ Team analytics API + Excel export + frontend page (E4)
- ✅ dataQualityService logic (E5-T1)
- ✅ skillInvoker + MCP server + agentRuntime scaffold (E6)
- ✅ CFN tables, IAM, env vars, deploy.sh agents/ zip
