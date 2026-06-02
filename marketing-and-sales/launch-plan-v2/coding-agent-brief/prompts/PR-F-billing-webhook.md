# Agent Prompt — PR-F: Billing Webhook + OpenClaw Concierge

**Branch to create:** `cursor/pr-2f-billing-webhook-8e67`
**Base branch:** `main` (after Batch 1 is merged)
**Batch:** 2 (Day 2) — runs in parallel with PR-E, PR-G

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§1.2 AIEmployeeProvisioning, §1.3 WebhookLog, §1.4 TenantApiKeys, §2 API routes)
3. `server/routes/leads.js` (route pattern)
4. `server/crmDynamodbService.js` (DDB patterns, first 150 lines)
5. `server/server.js` (understand where billing webhook mount must go — BEFORE validateToken)
6. `real-estate-crm-app/src/pages/admin/InviteManagement.tsx` (page pattern)
7. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P11-openclaw-concierge.md`
8. `marketing-and-sales/launch-plan-v2/pricing.json` (AI Employee plan details)

---

## Critical: Webhook Route Placement

The billing webhook MUST be mounted **BEFORE** the `validateToken` middleware in `server.js`. It uses HMAC signature verification instead of auth tokens.

In the `// === [LAUNCH ROUTES MOUNTS] ===` block, the billing route should be at the TOP of the block with a comment:
```js
// PR-F — billing webhook MUST be before any auth middleware
app.use('/api/billing', billingRoutes);
```

---

## What to Build

### 1. `server/routes/billing.js`

Razorpay webhook handler. PUBLIC — no `validateToken`.

```js
import express from 'express';
import crypto from 'crypto';
import { createProvisioningRow, listPendingProvisioning } from '../aiEmployeeProvisioningService.js';
import { serverTrack } from '../lib/posthog.js';
// NOTE: server/lib/posthog.js stub exists from PR-B; PR-E replaces it

const router = express.Router();

// POST /webhook — Razorpay sends all subscription + payment events here
router.post('/webhook', async (req, res) => {
  // 1. Verify HMAC signature
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  if (signature !== expectedSig) return res.status(401).json({ error: 'invalid_signature' });

  // 2. Idempotency check — store event.id in WebhookLog DDB table
  const eventId = req.body.event_id || req.body.id;
  // [check WebhookLog; return 200 if already processed; write if new]

  // 3. Route to handler based on event type
  const eventType = req.body.event;
  const payload = req.body.payload;

  switch (eventType) {
    case 'subscription.activated':
      // Check if AI Employee plan
      // If yes: createProvisioningRow + email founder + AiSensy broadcast + PostHog
      break;
    case 'subscription.charged':
      // PostHog: subscription_invoiced + subscription_paid
      break;
    case 'payment.captured':
      // PostHog: razorpay_payment_succeeded
      break;
    case 'payment.failed':
      // PostHog: razorpay_payment_failed
      break;
    case 'subscription.cancelled':
      // Update Subscriptions table status + PostHog
      break;
    case 'subscription.updated':
      // If seat increment: call incrementSeatsPaid (stubbed; PR-H creates subscriptionService)
      break;
  }

  res.json({ received: true });
});

export default router;
```

**Email sending:** Use Brevo API (`axios.post('https://api.brevo.com/v3/transactional-emails', ...)`). Template IDs from `process.env.BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID`. Wrap in try/catch — email failure must NOT fail webhook (return 200 regardless).

**AiSensy broadcast:** `axios.post('https://backend.aisensy.com/campaign/t1/api', { apiKey: process.env.AISENSY_API_KEY, campaignName: 'AI-Employee-Onboarding-Pending', userName: agencyName, userPhoneNumber: '+91' + phone })`

**subscriptionService stub** (for `subscription.updated` seat increment — PR-H creates the real version):
```js
// Stub — PR-H creates the real subscriptionService
async function incrementSeatsPaid(tenantId, by) {
  console.log('[subscriptionService stub] incrementSeatsPaid', tenantId, by);
}
```

### 2. `server/aiEmployeeProvisioningService.js`

DDB service for `AIEmployeeProvisioning` table. Schema from `01-SHARED-CONTRACTS.md §1.2`.

```js
export async function createProvisioningRow({ tenantId, agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, planId, razorpaySubscriptionId })
// Returns the created row

export async function getProvisioningByTenant(tenantId)
// Returns null if not found

export async function updateProvisioning(tenantId, { status, internalNotes, loomUrl, liveAt })
// Updates attributes; sets updatedAt = now

export async function listPendingProvisioning()
// Returns all rows where status = 'pending'
```

### 3. `server/routes/aiEmployeeStatus.js`

```js
// GET /api/ai-employee/status — validateToken + extractTenantId
// Returns provisioning row for req.tenantId or 404
```

### 4. `server/scripts/escalation-cron.js` + `cron/escalate-openclaw.yaml`

Cron that runs every 6h. Scans `AIEmployeeProvisioning` where `status=pending` and `now > expectedSLAEnd`.

On breach:
- `updateProvisioning(tenantId, { status: 'escalated' })`
- Send escalation email to founder (Brevo template `BREVO_AI_EMPLOYEE_ESCALATED_TEMPLATE_ID`)
- Send customer apology email
- PostHog: `serverTrack(tenantId, 'ai_employee_escalated', { tenantId })`
- NOTE: Razorpay credit note (₹500) is a manual step for M1; cron just sends email

`escalate-openclaw.yaml`:
```yaml
# Schedule: rate(6 hours)
# = EventBridge rule, invokes escalation Lambda
# Target: Lambda function that runs this script
# Timeout: 60s, Memory: 128MB
```

### 5. `server/middleware/apiKeyAuth.js`

Bearer token auth for OpenClaw HTTP requests:
```js
// GET TenantApiKeys row by SHA-256 hash of provided key
// If found + isActive: set req.tenantId = row.tenantId; call next()
// Else: 401 unauthorized
```

### 6. `real-estate-crm-app/src/pages/crm/AIEmployeeStatus.tsx`

Route: `/integrations/ai-employee`. Protected (requires auth).

Three states based on `GET /api/ai-employee/status`:
- **404 (not paid)**: "AI Employee is not active on your plan. Upgrade to add it." with link to `/billing`
- **pending** 🟡: "Setup in progress — our team will WhatsApp you within 24h. Expected by: {date}." Show animated progress bar (no actual progress tracking — visual only). "What we're setting up" bullet list.
- **live** 🟢: "🎉 Your AI Employee is live! Send a test message to {phone}." Loom embed if `loomUrl` exists. Show WhatsApp number.
- **escalated** 🔴: "We missed our 24h SLA. A ₹500 credit has been applied. Our founder will WhatsApp you within 1 hour."

Read-only page — no action buttons. Footer has Crisp chat trigger.

---

## server/server.js Modification

In `// === [LAUNCH ROUTES IMPORTS] ===`:
```js
// PR-F
import billingRoutes from './routes/billing.js';
import aiEmployeeStatusRoutes from './routes/aiEmployeeStatus.js';
```

In `// === [LAUNCH ROUTES MOUNTS] ===` — billing webhook MUST be FIRST in this block:
```js
// PR-F — billing webhook BEFORE any auth middleware
app.use('/api/billing', billingRoutes);
// PR-F — AI Employee status (after auth)
app.use('/api/ai-employee', aiEmployeeStatusRoutes);
```

---

## App.tsx Modification

In `{/* === [LAUNCH PROTECTED ROUTES] === */}`:
```tsx
{/* PR-F */}
<Route path="/integrations/ai-employee" element={<ProtectedRoute><AIEmployeeStatus /></ProtectedRoute>} />
```

Import:
```tsx
import AIEmployeeStatus from './pages/crm/AIEmployeeStatus';
```

---

## What NOT to Touch

- `server/subscriptionService.js` — created by PR-H; use stubs for seat increment
- `server/lib/posthog.js` — PR-B created stub; PR-E creates real version; call it regardless
- Any LP files

---

## Acceptance Criteria

- [ ] Webhook with valid Razorpay signature → 200 + DDB row created for AI Employee activation
- [ ] Webhook with invalid signature → 401
- [ ] Duplicate event ID → 200 (idempotent, not reprocessed)
- [ ] `/integrations/ai-employee` renders all 3 states correctly
- [ ] Escalation cron: sets status=escalated for rows past SLA + sends email
- [ ] Founder gets email on new AI Employee signup (Brevo)

---

## PR Description Template

```
PR-F: Billing webhook + OpenClaw concierge backend + AI Employee status page

Batch 2 | Day 2 | Parallel with PR-E, PR-G

Files created:
- server/routes/billing.js — Razorpay webhook handler (HMAC sig verify + idempotency)
- server/routes/aiEmployeeStatus.js — GET /api/ai-employee/status
- server/aiEmployeeProvisioningService.js — AIEmployeeProvisioning DDB service
- server/scripts/escalation-cron.js — 6h SLA escalation cron
- cron/escalate-openclaw.yaml — EventBridge cron spec
- server/middleware/apiKeyAuth.js — Bearer token auth for OpenClaw requests
- real-estate-crm-app/src/pages/crm/AIEmployeeStatus.tsx — 3-state status page

Files modified:
- server/server.js — billing webhook mount (BEFORE auth) + AI Employee status mount
- real-estate-crm-app/src/App.tsx — /integrations/ai-employee route

Source task: ZEE-004 (pre-launch-prep/P11-openclaw-concierge.md)
```
