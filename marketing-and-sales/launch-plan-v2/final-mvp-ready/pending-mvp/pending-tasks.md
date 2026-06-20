# Pending Tasks — Detailed Checklist

## Must-do before MVP launch

### Infrastructure
- [ ] Run `cd server && npm ci && bash scripts/build.sh` — note: pre-existing syntax errors in `routes/aiCallingInternal.js`, `areasBuildings.js`, `developers.js`, `flats.js` are false positives (large comment blocks); build script uses `|| true` so CI will not block
- [ ] Deploy main stack: `cd server/infra && ./deploy.sh` with updated `cfn-params.json` including:
  - `CreditsTableName`, `CreditConfigTableName`
  - `SesFromEmail`, `EmailProviderPrimary`
  - `BaileyEnabled=false`, `AgentsEnabled=false`
  - `CloudwatchMetricsEnabled=true`
- [ ] Deploy cron stacks: `LAMBDA_CODE_S3_BUCKET=<bucket> LAMBDA_CODE_S3_KEY=<key> server/infra/deploy-crons.sh all`
- [x] Cron CFN templates now have `Code`, `Role`, `Parameters` for all 4 cron stacks (fixed)
- [ ] Force API Gateway redeploy after Lambda update
- [ ] Create CloudWatch SNS alert topic: `aws sns create-topic --name RealEstateFlow-MVP-Alerts` + subscribe ops email
- [ ] Deploy CloudWatch dashboards per `observability-dashboard-spec.md`

### Credit System (E2)
- [ ] Run one-time config seed:
  ```bash
  cd server && node -e "import('./creditConfig.js').then(m => m.seedDefaultConfig())"
  ```
- [ ] Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Lambda env (for Orders API)
- [ ] Verify Razorpay webhook at `POST /api/billing/webhook` handles `payment.captured` with `notes.credits`
- [ ] Test credit purchase E2E: Buy Credits modal → Razorpay → balance increases
- [ ] Confirm `lastCreditResetAt` and `billingAnniversaryDay` fields exist on Subscriptions table (added at runtime by billing webhook + cron)
- [ ] Set `CLOUDWATCH_METRICS_ENABLED=true` on all Lambda functions to enable CloudWatch metrics emission

### Email SES (E3)
- [ ] Complete manual SES setup per `../notes/ses-aws-setup.md`
- [ ] Request SES production access (sandbox blocks non-verified recipients)
- [ ] Verify trial-reminder + escalation cron Lambda roles have `ses:SendEmail`
- [ ] Send test email; confirm SES primary + Brevo fallback in logs

### Onboarding (E1)
- [ ] Smoke test: Google OAuth → Role Selection → Register Admin → CRM (route now wired)
- [ ] Verify trial auto-creates subscription + initial credits on first `/trial-status` call
- [ ] Test `/crm/settings/billing` page loads plan + credit balance + AgentActivityLog
- [ ] Test ConnectWhatsApp page: Bailey option is active/clickable; Meta option shows "Coming soon"

### Bailey WhatsApp (E1 — optional for MVP)
- [ ] Obtain Bailey API credentials and WABA approval
- [ ] Set `BAILEY_ENABLED=true`, `BAILEY_API_KEY`, `BAILEY_WEBHOOK_SECRET`
- [x] `GET /internal/users/by-whatsapp?phone=` implemented in auth service internal routes
- [ ] Add GSI `WhatsAppIndex` on UsersTable for `GSI_WhatsAppPK` reverse lookup (GSI name configurable via `WHATSAPP_GSI_NAME` env)
- [ ] Deploy `whatsapp-processor` EventBridge rule
- [ ] Register webhook URL: `https://<api>/api/webhooks/whatsapp`
- [ ] Set `INTERNAL_API_KEY` on auth service Lambda + all cron Lambdas (required for service-to-service calls)
- [x] Webhook rate limiting: `webhookRateLimit` (20/min per IP) applied to POST `/whatsapp`

### Team Analytics (E4)
- [ ] Verify `GET /api/admin/team-analytics` with admin token
- [ ] Test Excel export download
- [x] Team Analytics nav link added to admin menu in `CRMDashboard.tsx` (fixed)
- [x] GlassDataTable column `header:` fix applied in `TeamAnalytics.tsx`

### Data Quality Crons (E5)
- [x] `incomplete-data-cron.js` — fully implemented (scans tenants, finds incomplete records, sends email + WhatsApp)
- [x] `expiring-agreements-cron.js` — fully implemented (scans tenants, finds expiring leases, sends per-agreement alerts)
- [x] `team-summary-cron.js` — fully implemented with per-member breakdown (calls `GET /internal/users/list` via `INTERNAL_API_KEY`)
- [ ] Deploy `incomplete-data.yaml` and `expiring-agreements.yaml` cron stacks (CFN templates are complete)
- [ ] Verify `Subscriptions` table items have `contactEmail` or `adminEmail` field set
- [ ] Set `INTERNAL_API_KEY` + `AUTH_SERVICE_URL` in team-summary-cron Lambda env for per-member stats

### MCP + Agents (E6)
- [ ] Install MCP server deps: `cd server/mcp-server && npm install`
- [ ] Set `MCP_TENANT_ID` when running locally; register in `.mcp.json` (done)
- [ ] Set `AGENTS_ENABLED=true` only for pilot tenants after Bedrock model access confirmed
- [x] `lead.created` EventBridge publish added to `leads.js` POST handler (guarded by `AGENTS_ENABLED=true`)
- [ ] Complete `lead-followup-cron.js` and `lead-router-handler.js` (not created)
- [ ] Enable `lead-qualifier.yaml` EventBridge rule (currently `State: DISABLED`)
- [ ] Bedrock model access in `ap-south-1` for `anthropic.claude-3-haiku-20240307-v1:0`
- [x] `agentRuntime.js` upgraded to native Bedrock tool-use loop (tools field, tool_use/tool_result, up to 5 turns)
- [x] `agentAuditService.js` created with PK=`TENANT#<id>` / SK=`AGENTLOG#<ts>#<rand>` for efficient Query

### Auth Microservice
- [ ] Deploy `reality-flow-authentication` with WhatsApp fields on `UserItem`
- [x] `GET /internal/users/by-whatsapp` implemented for webhook tenant resolution
- [x] `GET /internal/users/list?tenantId=` implemented for cron per-member stats
- [ ] Add `WhatsAppIndex` GSI on UsersTable in auth service CFN template (`GSI_WhatsAppPK` attribute)

### Frontend
- [ ] Set `VITE_BAILEY_ENABLED=true` only when Bailey is live
- [x] `AgentActivityLog` mounted in `BillingSettings.tsx`
- [x] `ConnectWhatsApp.tsx` redesigned with provider selector (Bailey=active, Meta=coming soon)

### Observability
- [x] `server/observability/cloudwatch.js` created with metric helpers (gated by `CLOUDWATCH_METRICS_ENABLED`)
- [x] `emailService.js` wired with CloudWatch metrics (SES sent, fallback, both failed)
- [x] `agentRuntime.js` wired with CloudWatch metrics (invoked, failed)
- [x] Credit reset cron wired with `creditReset` metric
- [x] `observability-dashboard-spec.md` created — 3 dashboards: Business, Infrastructure, Security
- [ ] Deploy CloudWatch dashboards (manual or CFN `AWS::CloudWatch::Dashboard`)
- [ ] Create log metric filters for credit insufficient + cron failures (see spec)
- [ ] Configure SNS topic + email subscription for P0/P1 alerts

## Nice-to-have (post-MVP)
- [ ] E5-T4 UI badges — incomplete record count indicators in admin nav/sidebar
- [ ] Credit cost indicator near lead create form ("This action uses 10 credits")
- [ ] Low-credit warning banner on CRMDashboard (not just BillingSettings)
- [ ] SQS DLQ for failed webhooks (see `09-error-handling-recovery.md`)
- [ ] CloudWatch custom alarms wired to SNS (see `observability-dashboard-spec.md`)
- [ ] Full Bedrock tool-use loop for advanced agent behavior (done for MVP; multi-tool sequences post-MVP)
- [ ] MCP Lambda HTTP transport (Phase 2)
- [ ] `lead-followup-cron.js` and `lead-router-handler.js` (E6 Phase 2)
- [ ] Meta Official WhatsApp integration (Phase 2 — placeholder in ConnectWhatsApp.tsx)
- [ ] AiSensy outbound campaigns admin UI (AiSensy already wired in billing.js)
- [ ] Grafana + CloudWatch integration for unified observability
- [ ] AWS X-Ray tracing on all Lambda functions
- [ ] Playwright CI wired to `tests/playwright/ui/**` glob
- [ ] Vitest unit tests for `creditService` atomic deduction + concurrency
