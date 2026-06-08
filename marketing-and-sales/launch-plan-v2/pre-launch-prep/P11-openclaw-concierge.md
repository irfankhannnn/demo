# P11 — OpenClaw Concierge (Razorpay Webhook + 24h Setup SOP + Status Page)

> **Type:** 🤖 AUTO + 🤝 HYBRID
> **Phase:** Pre-launch
> **Day / Block:** T-3
> **Skill(s):** `revops` + `codebase-analysis` + `copywriting`
> **Estimated time:** 1.5h founder · 6h AI

## Objective
When an agency owner pays for the AI Employee add-on (₹7,999/mo), automatically (a) trigger an internal "concierge ticket" workflow, (b) show the customer a read-only status page with 24h SLA, (c) hand the support team a 10-step SOP to provision OpenClaw + WhatsApp + Telegram + record a Loom + flip status to `live` — all without building any self-serve UI.

## Why This Matters for RealEstateFlow
The AI Employee is the wedge but actual provisioning is technical (OpenClaw config, WhatsApp BSP setup, Telegram bot, CRM API tenant scoping, smoke testing). M1 doesn't justify building a self-serve UI. A concierge flow with hard 24h SLA + Loom delivery delights customers without engineering capex.

## User Story
As an agency owner who just paid for AI Employee add-on, I want a clear status page showing "Setup in progress — your AI Employee will be live within 24h" + a Loom walkthrough delivered when ready, so I trust the process and don't open 5 support tickets.

## Acceptance Criteria
- [ ] Razorpay webhook `subscription.charged` (or `subscription.activated`) handler at `server/routes/billing.js` verifies signature + checks `plan_id == 'ai_employee_addon'`
- [ ] If true, creates row in DynamoDB `AIEmployeeProvisioning` with: `tenantId, agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, status='pending', expectedSLAEnd (paidAt + 24h), planId, razorpaySubscriptionId, internalNotes, loomUrl, liveAt, createdAt, updatedAt`
- [ ] Webhook also: emails `info@realestateflow.in` (CC support) with onboarding ticket details + adds tenant to AiSensy broadcast list `AI-Employee-Onboarding-Pending`
- [ ] Webhook posts PostHog event `ai_employee_provisioned` (status=`pending`)
- [ ] CRM SPA `pages/crm/AIEmployeeStatus.tsx` (route `/integrations/ai-employee`) shows tenant-scoped read-only status: 🟡 pending / 🟢 live / 🔴 escalated, expected SLA, last-updated timestamp, Loom embed (when live), contact-support CTA
- [ ] 10-step support SOP at `marketing-and-sales/launch-implement/pre-launch/11-openclaw-concierge/sop.md`
- [ ] 3 customer message templates at `marketing-and-sales/launch-implement/pre-launch/11-openclaw-concierge/messages.md`: paid-acknowledgement, activation, 24h-escalation
- [ ] Auto-escalation cron: every 6h, scans `AIEmployeeProvisioning` where `status==pending` and `now > expectedSLAEnd` → emails founder + customer apology + ₹500 credit (Razorpay credit note)
- [ ] M1 cap: max 3 new AI Employee signups per week (enforced at checkout via Razorpay plan availability flag toggled by support if cap reached)
- [ ] Tenant-scoped API key auto-issued on activation (used by OpenClaw to write back to CRM)

## AI Prompt (🤖)

```
You are a senior full-stack engineer + RevOps specialist. Read these inputs:
- `server/routes/leads.js` (route conventions)
- `server/tenantMiddleware.js`
- `server/crmDynamodbService.js` (DDB patterns)
- `server/server.js` (where to mount)
- `server/awsClientWrapper.js`
- `real-estate-crm-app/src/App.tsx` (route patterns + role gates)
- `marketing-and-sales/launch-plan-v2/pricing.json` (AI Employee plan)
- `marketing-and-sales/launch-plan-v2/pre-launch-prep/P10-analytics-events.md` (event spec)

Produce:

## 1. `server/routes/billing.js` — Razorpay webhook handler
- POST `/api/billing/webhook` (PUBLIC route, verifies signature via `crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)`)
- Parse `event.entity`, `event.payload.subscription.entity`, `event.payload.payment.entity`
- Branches:
  - `subscription.activated` AND plan_id matches AI Employee plan → create AIEmployeeProvisioning row + email + AiSensy broadcast + PostHog event
  - `subscription.charged` for any plan → emit `subscription_paid` PostHog server event + `subscription_invoiced`
  - `payment.captured` → `razorpay_payment_succeeded`
  - `payment.failed` → `razorpay_payment_failed`
  - `subscription.cancelled` → update Subscription record + PostHog `subscription_cancelled`
  - `subscription.updated` (seat increment for Team+) → update seatsPaid + PostHog `seat_added`
- Idempotent: store every webhook `event.id` in DDB `WebhookLog` to avoid reprocessing on retries
- Mount in server.js

## 2. `server/aiEmployeeProvisioningService.js` — DDB service
Functions:
- `createProvisioningRow({tenantId, agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, planId, razorpaySubscriptionId})` returns row
- `getProvisioningByTenant(tenantId)`
- `updateProvisioning(tenantId, {status, internalNotes, loomUrl, liveAt})`
- `listPendingProvisioning()` (used by escalation cron)
- DDB schema: `AIEmployeeProvisioning` PK=`tenantId`, sort=`createdAt`, attrs as listed in ACs

## 3. `real-estate-crm-app/src/pages/crm/AIEmployeeStatus.tsx`
Tailwind page, route `/integrations/ai-employee`:
- Fetches `GET /api/ai-employee/status` (tenant-scoped via existing auth)
- Status states with copy:
  - **pending (🟡)**: "Setup in progress — our team will message your WhatsApp ({maskedPhone}) within 24h. Last update: {ts}." Show progress bar (visual only). Show "What we're doing right now" bullet list.
  - **live (🟢)**: "🎉 Your AI Employee is live since {ts}. Send a test message to {phone}. Watch the 90-sec walkthrough below." Embed Loom video.
  - **escalated (🔴)**: "We missed our 24h SLA. We've credited ₹500 to your account. Founder will WhatsApp you within 1 hour. Apologies."
- Footer: contact info, Crisp chat trigger
- Read-only — no buttons that mutate

## 4. `server/routes/aiEmployeeStatus.js` — read endpoint
- GET `/api/ai-employee/status` (validateToken + extractTenantId)
- Returns provisioning row for current tenant or 404 if not paid

## 5. `server/scripts/escalation-cron.js` + `cron/escalate-openclaw.yaml`
- Every 6h: list pending rows, if `now > expectedSLAEnd`, update status=`escalated`, send escalation email to founder + customer apology + Razorpay credit note for ₹500 + PostHog event `ai_employee_escalated`
- Deploy as scheduled Lambda (mirror P5 reset-cron approach)

## 6. `marketing-and-sales/launch-implement/pre-launch/11-openclaw-concierge/sop.md`
10-step support SOP:
1. **Verify paid status** in Razorpay dashboard → Subscriptions → confirm `subscription.status=active` and last invoice paid
2. **Clone OpenClaw soul.md template** from internal `openclaw/templates/realestateflow-broker.md`. Customize per agency: company name, agent names, common Mumbai localities, brand voice
3. **Load CRM context** via tenant-scoped API key (auto-issued on activation): pull last 30 days of leads, last 14 days of properties, current owners, current agents. Feed to OpenClaw as warm-up context
4. **Provision AiSensy WhatsApp** OR connect agency's existing WhatsApp Business number. Configure templates: greeting, qualification, follow-up, disqualification. Test via "Hi" send-receive
5. **Telegram bot** via @BotFather. Set bot username `realestateflow{agencyId}_bot`. Wire to OpenClaw via webhook
6. **Wire OpenClaw → CRM API**: configure OpenClaw with the tenant API key + base URL. Test: ask OpenClaw "list buyers in Andheri" — should return 3-5 buyers from CRM scoped to tenant
7. **3-test-message smoke check**: WhatsApp the new bot from a test number. Trigger: lead-qualification, owner-update, calendar-booking. Verify all 3 update CRM correctly + tenant-scoped (no cross-tenant leak)
8. **Record 90-sec Loom walkthrough**: show owner the new WhatsApp number, demonstrate qualifying a sample lead, show the lead appearing in their CRM, show how to escalate to a human. Save Loom URL
9. **WhatsApp the agency owner** with creds (using template `messages.md → activation`): Loom URL, WhatsApp/Telegram numbers, 7-day tips
10. **Flip status to live**: update DDB row (loomUrl, liveAt, status=live), send "live" email, post PostHog `ai_employee_connected`. Customer-facing status page now shows green

Each step has: action, expected output, time estimate, fallback if step fails.

## 7. `marketing-and-sales/launch-implement/pre-launch/11-openclaw-concierge/messages.md`
Three customer-facing message templates (English):
- **Paid acknowledgement** (sent immediately after webhook): subject "Welcome to AI Employee — setup starts now"; body explains 24h SLA, what we're doing, what to expect, contact for urgent issues
- **Activation** (sent after status flips to live): subject "🎉 Your AI Employee is live"; body has Loom URL, WhatsApp/Telegram numbers, 5 quick tips for first 7 days, how to add team members, how to disable
- **24h escalation** (sent if SLA missed): subject "We missed our 24h SLA — sorry. Here's a ₹500 credit"; body apologizes, gives ETA, shows founder direct WhatsApp number, mentions credit applied

## 8. Tenant-scoped API key issuance
- On activation (status flip to live): generate ULID, store in DDB `TenantApiKeys` table (PK=tenantId, attrs: keyHash, createdAt, lastUsed, scopes=['ai-employee']). Send raw key once via WhatsApp; show first/last 4 chars in CRM admin
- Server middleware `apiKeyAuth.js` to validate Bearer token from OpenClaw HTTP requests; sets req.tenantId

## 9. M1 cap enforcement at checkout
- Manual flag in DDB `Settings` table: `aiEmployeeAvailable` (boolean). When 3 new signups/week, support team flips to false. Razorpay plan disabled when flag false.
- SPA pricing-page hides AI Employee toggle when flag false (or shows "Waitlist — back next week" CTA)

## 10. PostHog dashboard
Update `pre-launch/10-analytics/posthog-dashboard.md` to add:
- Insight: AI Employee provisioning time distribution (paidAt → liveAt)
- Alert: any provisioning row exceeds 22h SLA budget (early warning before 24h)

Stop here. Do not deploy. Do not test in live (founder triggers manual test).
```

## Manual Steps (🧍 — after AI Prompt + deploy)

1. **Add env vars**: `RAZORPAY_WEBHOOK_SECRET`, `AISENSY_API_KEY`, `AISENSY_BROADCAST_LIST_ID`.
2. **Configure Razorpay webhook** (P7 already lists this). Endpoint: `https://api.realestateflow.in/api/billing/webhook`. Secret: copy to env.
3. **Configure AiSensy broadcast list** `AI-Employee-Onboarding-Pending` in AiSensy dashboard.
4. **Deploy backend** (server + cron) + SPA changes. Verify webhook URL responds 200 to test event.
5. **Test happy path**: in Razorpay Test mode, create a test subscription on AI Employee plan → confirm row created + email landed at `info@realestateflow.in` + PostHog event fired.
6. **Test SLA escalation**: artificially set `expectedSLAEnd = now - 1 hour` on a test row, run escalation cron → confirm escalation email + credit note + status update.
7. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- AWS DDB + Lambda
- Razorpay live (P7) + webhook secret
- Brevo API key (for emails)
- AiSensy account + broadcast list (P3 deps)
- OpenClaw soul.md template (founder maintains separately — internal repo)

## Outputs
- `server/routes/billing.js`
- `server/routes/aiEmployeeStatus.js`
- `server/aiEmployeeProvisioningService.js`
- `server/scripts/escalation-cron.js` + `cron/escalate-openclaw.yaml`
- `real-estate-crm-app/src/pages/crm/AIEmployeeStatus.tsx`
- `infra/dynamodb/AIEmployeeProvisioning.tf` + `WebhookLog.tf` + `TenantApiKeys.tf`
- `marketing-and-sales/launch-implement/pre-launch/11-openclaw-concierge/sop.md`
- `.../messages.md`

## Success Criterion
Test webhook → row + email + PostHog event in <60s; SOP doc ready for support team; status page renders correctly for `pending`/`live`/`escalated`.

## Fallback / Plan B
If concierge SOP can't be done in 24h consistently, soften the SLA copy to "within 48h" temporarily and reduce M1 cap to 2 signups/week. If Razorpay webhook unreliable, add a daily reconciliation cron that lists Razorpay subscriptions via API and back-fills missing rows.

## Risks
| Risk | Mitigation |
|---|---|
| Webhook signature verification fails | Idempotency log + manual reconciliation cron + alert |
| 24h SLA missed | Auto-escalation + ₹500 credit + founder direct intervention |
| OpenClaw config wrong → cross-tenant leak | Smoke-test step 7 in SOP requires tenant-scoped query test |
| Customer doesn't trust 24h SLA | Status page transparent + founder-direct contact CTA |
| WhatsApp Business number provisioning delays | Pre-provision pool of 5 numbers in AiSensy |
| OpenClaw LLM provider downtime | Switch to fallback provider; document in SOP |

## India / Mumbai-Specific Notes
- AiSensy is India-based BSP — supports WhatsApp Business API + GST invoices for our spend
- Telegram less common in Mumbai brokers but present (10-15% per ICP) — both channels supported
- 24h SLA + ₹500 credit is generous for Indian market and earns word-of-mouth
- OpenClaw is internal name — never say "OpenClaw" to a customer; only "AI Employee"

## Dependencies
- **Blocks:** Day 1+ launch (any AI Employee paid customer triggers this), Razorpay live (P7)
- **Depends on:** P7 (Razorpay plans), P10 (PostHog server SDK), P9 (Brevo + email infra)

## Connected Skills
- `revops` — webhook + concierge lifecycle
- `codebase-analysis` — write the route + DDB service
- `copywriting` — SOP + 3 message templates
- `pr-review` — security-review the webhook before deploy
