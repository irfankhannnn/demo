# Pending Tasks — Detailed Checklist

## Must-do before MVP launch

### Infrastructure
- [ ] Run `cd server && npm ci && bash scripts/build.sh` — note: pre-existing syntax errors in `routes/aiCallingInternal.js`, `areasBuildings.js`, `developers.js`, `flats.js` (unrelated to MVP work; fix or exclude from gate)
- [ ] Deploy main stack: `cd server/infra && ./deploy.sh` with updated `cfn-params.json` including:
  - `CreditsTableName`, `CreditConfigTableName`
  - `SesFromEmail`, `EmailProviderPrimary`
  - `BaileyEnabled=false`, `AgentsEnabled=false`
- [ ] Deploy cron stacks: `LAMBDA_CODE_S3_BUCKET=<bucket> LAMBDA_CODE_S3_KEY=<key> server/infra/deploy-crons.sh all`
- [x] Cron CFN templates now have `Code`, `Role`, `Parameters` for all 4 cron stacks (fixed)
- [ ] Force API Gateway redeploy after Lambda update

### Credit System (E2)
- [ ] Run one-time config seed:
  ```bash
  cd server && node -e "import('./creditConfig.js').then(m => m.seedDefaultConfig())"
  ```
- [ ] Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Lambda env (for Orders API)
- [ ] Verify Razorpay webhook at `POST /api/billing/webhook` handles `payment.captured` with `notes.credits`
- [ ] Test credit purchase E2E: Buy Credits modal → Razorpay → balance increases
- [ ] Confirm `lastCreditResetAt` field exists on Subscriptions table (added at runtime by cron; no migration needed)

### Email SES (E3)
- [ ] Complete manual SES setup per `../notes/ses-aws-setup.md`
- [ ] Request SES production access (sandbox blocks non-verified recipients)
- [ ] Verify trial-reminder + escalation cron Lambda roles have `ses:SendEmail`
- [ ] Send test email; confirm SES primary + Brevo fallback in logs

### Onboarding (E1)
- [ ] Smoke test: Google OAuth → Role Selection → Register Admin → CRM (route now wired)
- [ ] Verify trial auto-creates subscription + initial credits on first `/trial-status` call
- [ ] Test `/crm/settings/billing` page loads plan + credit balance

### Bailey WhatsApp (E1 — optional)
- [ ] Obtain Bailey API credentials and WABA approval
- [ ] Set `BAILEY_ENABLED=true`, `BAILEY_API_KEY`, `BAILEY_WEBHOOK_SECRET`
- [ ] Add auth service internal endpoint `GET /internal/users/by-whatsapp?phone=` (referenced in webhooks.js but **not yet implemented**)
- [ ] Add GSI on UsersTable for `whatsAppPhoneNumber` reverse lookup
- [ ] Deploy `whatsapp-processor` EventBridge rule
- [ ] Register webhook URL: `https://<api>/api/webhooks/whatsapp`

### Team Analytics (E4)
- [ ] Verify `GET /api/admin/team-analytics` with admin token
- [ ] Test Excel export download
- [x] Team Analytics nav link added to admin menu in `CRMDashboard.tsx` (fixed)

### Data Quality Crons (E5)
- [x] `incomplete-data-cron.js` — fully implemented (scans tenants, finds incomplete records, sends email + WhatsApp)
- [x] `expiring-agreements-cron.js` — fully implemented (scans tenants, finds expiring leases, sends per-agreement alerts)
- [x] `team-summary-cron.js` — fully implemented (scans tenants, aggregates lead stats, sends daily summary)
- [ ] Deploy `incomplete-data.yaml` and `expiring-agreements.yaml` cron stacks (CFN templates are complete)
- [ ] Verify `Subscriptions` table items have `contactEmail` or `adminEmail` field set

### MCP + Agents (E6)
- [ ] Install MCP server deps: `cd server/mcp-server && npm install`
- [ ] Set `MCP_TENANT_ID` when running locally; register in `.mcp.json` (done)
- [ ] Set `AGENTS_ENABLED=true` only for pilot tenants after Bedrock model access confirmed
- [x] `lead.created` EventBridge publish added to `leads.js` POST handler (guarded by `AGENTS_ENABLED=true`)
- [ ] Complete `lead-followup-cron.js` and `lead-router-handler.js` (not created)
- [ ] Enable `lead-qualifier.yaml` EventBridge rule (currently `State: DISABLED`)
- [ ] Bedrock model access in `ap-south-1` for `anthropic.claude-3-haiku-20240307-v1:0`

### Auth Microservice
- [ ] Deploy `reality-flow-authentication` with WhatsApp fields on `UserItem`
- [ ] Implement `GET /internal/users/by-whatsapp` for webhook tenant resolution

### Frontend
- [ ] Set `VITE_BAILEY_ENABLED=true` only when Bailey is live
- [ ] Mount `AgentActivityLog` on admin dashboard or billing page

## Nice-to-have (post-MVP)
- [ ] E5-T4 UI badges for incomplete records
- [ ] SQS DLQ for failed webhooks (see `09-error-handling-recovery.md`)
- [ ] CloudWatch custom metrics + alarms
- [ ] Full Bedrock tool-use loop (current agentRuntime uses simplified text parsing)
- [ ] MCP Lambda HTTP transport (Phase 2)
- [ ] Per-member team analytics in team-summary cron (requires `GET /internal/users` auth service endpoint)
