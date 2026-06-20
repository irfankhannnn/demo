# Pending Tasks — Testing & Verification Checklist

**All deployment, configuration, and infrastructure tasks are in `deployment-steps.md` with full details.**

This file tracks only the testing and verification items needed before MVP launch.

---

## Pre-Launch Verification

### Code Complete ✅

- [x] `incomplete-data-cron.js` — fully implemented
- [x] `expiring-agreements-cron.js` — fully implemented
- [x] `team-summary-cron.js` — fully implemented with per-member breakdown
- [x] `agentRuntime.js` — upgraded to native Bedrock tool-use loop
- [x] `agentAuditService.js` — created with efficient PK/SK pattern
- [x] `emailService.js` — wired with CloudWatch metrics
- [x] TeamAnalytics.tsx — GlassDataTable fixes applied
- [x] BillingSettings.tsx — AgentActivityLog mounted
- [x] ConnectWhatsApp.tsx — redesigned with provider selector
- [x] `GET /internal/users/by-whatsapp` — implemented in auth service
- [x] `GET /internal/users/list` — implemented in auth service
- [x] Webhook rate limiting — applied to POST /whatsapp
- [x] observability/cloudwatch.js — created with metric helpers
- [x] observability-dashboard-spec.md — created with 3-dashboard spec

---

## Testing Checklist

### Smoke Test — E2E Happy Path

- [ ] **Onboarding (E1)**
  - [ ] Google OAuth signup → role selection → RegisterAdmin form → CRM loads
  - [ ] Trial banner shows "14 days remaining"
  - [ ] Credit balance shows "1000 / 1000"

- [ ] **Credit System (E2)**
  - [ ] Create lead → 5 credits deducted → balance shows "995 / 1000"
  - [ ] Create contact → 3 credits deducted → balance updates
  - [ ] Trigger 402: exhaust credits → next action blocked
  - [ ] Buy Credits modal → complete Razorpay flow → balance increases
  - [ ] Monthly credit reset: confirm `billingAnniversaryDay` used for exact date

- [ ] **Email (E3)**
  - [ ] Trial reminder cron sends via SES
  - [ ] SES fails → fallback to Brevo succeeds
  - [ ] BillingSettings page renders without errors
  - [ ] Cron failure logs include structured error + stack frame

- [ ] **Team Analytics (E4)**
  - [ ] Navigate to `/admin/team-analytics`
  - [ ] Table loads with team member metrics (active leads, deals closed, conversion rate)
  - [ ] Click "Download Excel" → file downloads with correct data
  - [ ] Per-member stats show breakdown: "John: 5 active, 2 closed today"

- [ ] **Data Quality (E5)**
  - [ ] incomplete-data-cron triggers → email + WhatsApp sent with alert
  - [ ] expiring-agreements-cron triggers → assigned member notified
  - [ ] team-summary-cron triggers → admin receives summary with per-member breakdown

- [ ] **Agents (E6 — if enabled)**
  - [ ] Create lead → lead.created event published to EventBridge
  - [ ] lead-qualifier agent invoked → lead scored (HOT/WARM/COLD)
  - [ ] Agent action logged in audit trail
  - [ ] Agent credit cost deducted from tenant's balance

- [ ] **Bailey WhatsApp (E1 optional — if credentials obtained)**
  - [ ] ConnectWhatsApp page shows Bailey as "Recommended"
  - [ ] Scan QR code → WhatsAppPhoneNumber saved in auth service
  - [ ] Send WhatsApp message → webhook received
  - [ ] Tenant resolved via internal users/by-whatsapp endpoint
  - [ ] Message routed to MCP skill → response sent back via WhatsApp

---

## Backend API Verification

- [ ] `GET /api/subscriptions/credits` → returns balance + plan info
- [ ] `GET /api/subscriptions/credits/ledger` → returns transaction history
- [ ] `POST /api/subscriptions/credits/purchase` → creates Razorpay order
- [ ] `GET /api/admin/team-analytics` → returns team member metrics
- [ ] `GET /api/admin/team-analytics/export` → returns Excel file
- [ ] `POST /api/webhooks/whatsapp` → accepts Bailey webhook + publishes EventBridge event
- [ ] `POST /api/billing/webhook` → handles `payment.captured` + `subscription.activated`
- [ ] `POST /api/leads` + meterCredits middleware → deducts credits, returns 402 if insufficient
- [ ] Internal auth endpoints:
  - [ ] `GET /internal/users/by-whatsapp?phone=` → returns tenant + role
  - [ ] `GET /internal/users/list?tenantId=` → returns team members for cron

---

## CloudWatch Observability Verification

- [ ] CloudWatch dashboard loads (Business Metrics)
- [ ] Credit deduction metric: `creditService.deductCredits.count` appears after lead creation
- [ ] Email metric: `emailService.sent_via_ses` appears after trial reminder
- [ ] Webhook metric: `webhooks.whatsapp.received` appears after message received
- [ ] SNS topic subscribed → test alert received in email
- [ ] Log metric filters working:
  - [ ] Credit insufficient events captured
  - [ ] Cron per-tenant failures captured with stack frames

---

## Security & Compliance

- [ ] Rate limiter works: curl webhook endpoint 21 times → 21st returns 429
- [ ] Cross-tenant isolation: User A cannot access User B's leads/credits via API
- [ ] Webhook signature validation: Invalid Bailey signature → returns 401
- [ ] Internal API key validation: Missing or wrong key → returns 401
- [ ] 402 payment required response: Insufficient credits → correct error message

---

## Performance & Load

- [ ] Team analytics query: < 3 seconds for 1000+ team members
- [ ] Credit ledger query: < 1 second for 10000+ transactions
- [ ] Cron execution: credit-reset completes within 30 seconds for 100 tenants
- [ ] Webhook processing: WhatsApp message processed within 2 seconds

---

## Documentation & Runbook

- [ ] `deployment-steps.md` complete with all 10 phases + verification steps
- [ ] `observability-dashboard-spec.md` includes all 3 dashboards + alert runbook
- [ ] `known-issues-and-suggestions.md` updated with resolved items + new items
- [ ] All env vars documented in `.env.example` + deployment-steps.md
- [ ] Rollback procedures documented for SES, Bailey, Agents

---

## Nice-to-Have (Post-MVP)

- [ ] E5-T4 UI badges — incomplete record count in admin nav
- [ ] Credit cost indicator near lead creation form
- [ ] Low-credit warning banner on CRMDashboard
- [ ] SQS DLQ for failed webhooks
- [ ] AWS X-Ray tracing on all Lambda functions
- [ ] Grafana + CloudWatch integration
- [ ] Vitest unit tests for creditService
- [ ] Playwright UI tests in CI pipeline
- [ ] Meta Official WhatsApp integration (Phase 2)
- [ ] lead-followup-cron.js + lead-router-handler.js (Phase 2)
- [ ] Advanced Bedrock agent sequences (multi-tool, reasoning)
