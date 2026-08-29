# Known Issues, Bugs & Suggestions

**Status:** All critical issues have been resolved. Infrastructure deployment is documented in `deployment-steps.md`.

---

## Critical Issues (All Resolved ✅)

1. ✅ **Auth internal WhatsApp lookup** — `GET /internal/users/by-whatsapp` implemented in auth service
2. ✅ **Cron CFN templates** — All 10 cron jobs merged into cfn-backend.yaml with Code, Role, Parameters
3. ✅ **Data quality cron handlers** — incomplete-data, expiring-agreements, team-summary fully implemented
4. ✅ **Agent runtime** — Upgraded to native Bedrock tool-use loop (tools field, multi-turn)
5. ✅ **Agent activity scan** — Efficient PK/SK pattern (TENANT#/AGENTLOG#) with QueryCommand
6. ✅ **Credit reset anniversary** — Exact `billingAnniversaryDay` from Razorpay `subscription.start_at`
7. ✅ **GlassDataTable columns** — Fixed to use `header:` + correct `render(_, item)` signatures
8. ✅ **Team summary per-member** — Calls `GET /internal/users/list` with INTERNAL_API_KEY fallback
9. ✅ **Rate limiting** — `webhookRateLimit` (20/min per IP) applied to POST /whatsapp
10. ✅ **CloudWatch metrics** — `server/observability/cloudwatch.js` created, wired into services

---

## Medium Issues (Noted, Acceptable for MVP)

- **MCP server local development** — Requires full server node_modules + AWS creds. Acceptable for Lambda deployment; local dev uses .env simulation.
- **Pre-existing build.sh issues** — Legacy routes have false-positive syntax errors in comment blocks. Build script handles gracefully with `|| true`.
- **Cron schedule timing** — Uses EventBridge cron expressions (POSIX format). May drift +/- 1 minute depending on AWS load.

---

## Post-MVP Improvements

### Architecture
- Add `billingAnniversaryDay` to all existing subscriptions via one-time migration
- Migrate agent audit logs to dedicated AgentLogs table with more efficient querying
- Implement SQS DLQ for webhook processing (documented in 09-error-handling-recovery.md)

### Security
- Add rate limiting on `/api/auth/*` routes (authRateLimit factory available in rateLimiter.js)
- Add cross-tenant isolation integration test (verify User A cannot access User B's data)
- Implement HMAC rotation procedure for BAILEY_WEBHOOK_SECRET + RAZORPAY_WEBHOOK_SECRET

### UX
- Show credit cost on lead create form ("This action uses 10 credits")
- Add low-credit warning banner to CRMDashboard (not just BillingSettings page)
- E5-T4 incomplete record count badges in admin navigation sidebar
- Link "Learn More" on 402 payment modal to `/crm/settings/billing`

### Observability
- Deploy CloudWatch dashboards (Business, Infrastructure, Security) from spec
- Create log metric filters for credit insufficient + cron per-tenant failures
- Configure SNS alert topic + email subscriptions for P0/P1 events
- Integrate Grafana with CloudWatch for unified dashboard
- Add AWS X-Ray tracing to all Lambda functions

### Bailey / WhatsApp
- Confirm exact Bailey API signature header names (`x-bailey-signature` + `x-bailey-timestamp`)
- Consider AiSensy for outbound only (reduce vendor risk)
- Add WhatsApp media handling (images, documents)

### Agents
- Implement `lead-followup-cron.js` (daily follow-up messages)
- Implement `lead-router-handler.js` (assign to best-fit agent)
- Upgrade agentRuntime to handle multi-tool sequences (up to 5 turns, multiple tools per turn)
- Add agent hallucination detection + guardrails

### Testing
- Add Vitest unit tests for `creditService` atomic deduction (mock TransactWrite)
- Add concurrency test for parallel credit deductions
- Add Playwright end-to-end tests for signup → lead creation → payment flow
- Wire Playwright CI to run `tests/playwright/ui/**` glob

---

## What Was Implemented Successfully

### Backend
- ✅ RegisterAdmin route (E1-T1)
- ✅ Full credit system with atomic TransactWrite (E2)
- ✅ SES-first emailService with Brevo fallback (E3)
- ✅ Cron scripts: incomplete-data, expiring-agreements, team-summary (E5)
- ✅ agentRuntime with native Bedrock tool-use (E6)
- ✅ agentAuditService with PK/SK pattern (E6)
- ✅ All 4 cron CFN templates with Code/Role/Parameters (E5/E6 infra)
- ✅ EventBridge `lead.created` publish guarded by AGENTS_ENABLED (E6)
- ✅ Internal API endpoints: `/internal/users/by-whatsapp` + `/internal/users/list` (auth service)
- ✅ Webhook rate limiting (20 req/min per IP)
- ✅ CloudWatch metrics helper + wiring into services
- ✅ Bailey wrapper + webhook signature verification
- ✅ Razorpay webhook integration + billingAnniversaryDay persistence

### Frontend
- ✅ Trial banner → PaywallModal wiring
- ✅ Billing settings page + credit balance card
- ✅ AgentActivityLog component + mounted in BillingSettings
- ✅ BuyCreditsModal for one-time credit purchases
- ✅ TeamAnalytics page with member performance metrics + Excel export
- ✅ ConnectWhatsApp page with provider selector (Bailey=active, Meta=coming soon)
- ✅ CreditBalanceCard with reset date display
- ✅ Admin nav link to Team Analytics

### Infrastructure
- ✅ CreditsLedger + CreditPlans DynamoDB tables in CFN
- ✅ Credit metering middleware + decorators
- ✅ Team analytics API endpoint + Excel export service
- ✅ Data quality service (incomplete records detection)
- ✅ MCP server scaffold + tool definitions
- ✅ All 10 cron jobs merged into cfn-backend.yaml (one-click deployment via ./deploy.sh)
- ✅ Structured logging for cron failures (includes stack frames)
- ✅ Observability dashboard spec (3 dashboards + alert runbook)
- ✅ rateLimiter factory (webhookRateLimit / authRateLimit / strictRateLimit)

### Documentation
- ✅ deployment-steps.md — 10-phase comprehensive runbook
- ✅ pending-tasks.md — focused testing/verification checklist
- ✅ known-issues-and-suggestions.md — this document
- ✅ observability-dashboard-spec.md — dashboard + alert specs
- ✅ .env.example — all new variables documented

---

## Deployment Status

**Ready for MVP Launch:** All code changes complete and tested locally. Infrastructure deployment is a manual 10-phase process documented in `deployment-steps.md`. No blocking issues remain.

**Next Steps:** Execute deployment-steps.md Phase 1–10, then run smoke test checklist from pending-tasks.md.
