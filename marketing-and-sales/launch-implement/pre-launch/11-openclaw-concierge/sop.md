# AI Employee Concierge — 10-Step Setup SOP

> **SLA:** 24 hours from `paidAt` timestamp
> **Escalation:** Auto at 24h (cron); founder WhatsApp within 1h of escalation

---

## Step 1: Verify Paid Status
**Action:** Log into Razorpay Dashboard → Subscriptions → search by agency name or email.
**Expected output:** `subscription.status = active`, last invoice = `paid`.
**Time:** 2 min.
**Fallback:** If subscription not found, check WebhookLog DDB table for the event. If missing, ask customer for Razorpay receipt.

## Step 2: Clone OpenClaw Soul Template
**Action:** Copy `openclaw/templates/realestateflow-broker.md` to a new tenant-specific file. Customize:
- Agency/company name
- Agent names from CRM member list
- Common localities (from agency's property data)
- Brand voice (formal/casual based on agency profile)
**Expected output:** Tenant-specific `soul.md` file ready.
**Time:** 15 min.
**Fallback:** Use default template if insufficient data; refine after go-live.

## Step 3: Load CRM Context
**Action:** Use tenant-scoped API key (auto-issued on activation):
- Pull last 30 days of leads
- Pull last 14 days of properties
- Pull current owners and current agents
- Feed as warm-up context to OpenClaw
**Expected output:** OpenClaw knowledge base populated with tenant data.
**Time:** 10 min.
**Fallback:** If API key not issued yet, generate manually from DDB `TenantApiKeys`.

## Step 4: Provision WhatsApp
**Action:** Configure AiSensy WhatsApp Business number OR connect agency's existing WhatsApp Business number.
- Set up templates: greeting, qualification, follow-up, disqualification
- Test: send "Hi" and verify receive
**Expected output:** WhatsApp channel active, test message received.
**Time:** 20 min.
**Fallback:** If agency's existing number has issues, use a shared RealEstateFlow number temporarily.

## Step 5: Set Up Telegram Bot
**Action:** Create bot via @BotFather.
- Username: `realestateflow{agencyId}_bot`
- Wire to OpenClaw via webhook
**Expected output:** Telegram bot responds to test messages.
**Time:** 10 min.
**Fallback:** Skip Telegram if not required by customer (WhatsApp is primary).

## Step 6: Wire OpenClaw → CRM API
**Action:** Configure OpenClaw with:
- Tenant API key (from Step 3)
- Base URL: `https://api.realestateflow.in` (or staging)
- Test: ask OpenClaw "list buyers in Andheri" → should return 3-5 buyers scoped to tenant
**Expected output:** OpenClaw reads/writes CRM data correctly, tenant-scoped.
**Time:** 15 min.
**Fallback:** Check API key scopes, verify tenant isolation.

## Step 7: 3-Test-Message Smoke Check
**Action:** WhatsApp the bot from a test number. Trigger:
1. Lead qualification conversation
2. Owner update request
3. Calendar booking request
**Expected output:** All 3 update CRM correctly + no cross-tenant data leak.
**Time:** 15 min.
**Fallback:** If any test fails, debug OpenClaw logs and re-test. Do not proceed until all 3 pass.

## Step 8: Record 90-sec Loom Walkthrough
**Action:** Record Loom showing:
- The new WhatsApp number
- Demo: qualifying a sample lead via WhatsApp
- Show the lead appearing in their CRM dashboard
- How to escalate to a human agent
**Expected output:** Loom URL saved.
**Time:** 10 min.
**Fallback:** Re-record if quality is poor; max 2 attempts.

## Step 9: WhatsApp the Agency Owner
**Action:** Send activation message using template from `messages.md → activation`:
- Include: Loom URL, WhatsApp number, Telegram bot link
- Include: 7-day tips for getting the most out of AI Employee
**Expected output:** Owner acknowledges receipt.
**Time:** 5 min.
**Fallback:** If no acknowledgement in 2h, follow up via email + call.

## Step 10: Flip Status to Live
**Action:**
1. Update DDB `AIEmployeeProvisioning` row: `status=live`, `loomUrl={url}`, `liveAt={now}`
2. Send "live" email via Brevo (template: `BREVO_AI_EMPLOYEE_LIVE_TEMPLATE_ID`)
3. Post PostHog event: `ai_employee_connected`
4. Customer-facing status page now shows green ✅
**Expected output:** Status page at `/integrations/ai-employee` shows "Live" state.
**Time:** 3 min.
**Fallback:** If DDB update fails, retry manually via AWS Console.

---

## Total Estimated Time: ~105 min (1h 45min)

## Escalation Protocol
If any step is blocked for >2h:
1. Message founder immediately via WhatsApp
2. Update `internalNotes` in DDB with blocker details
3. If approaching 24h SLA, proactively email customer with status update
