# 29 — Payment System Implementation

> **Phase:** 0 (gap fixes) + Phase 1 (UI) · **Infra:** CloudFormation only · **Status:** Implementation spec

---

## Overview

The payment system backbone exists (`server/routes/billing.js`, `server/subscriptionService.js`, `PaywallModal.tsx`) but has critical gaps that will cause revenue leakage and operational blind spots at scale. This document specifies every fix, ordered by risk.

---

## Gap 1: `subscription.cancelled` Webhook Never Updates DB (🔴 Critical)

### Location
`server/routes/billing.js` — `subscription.cancelled` handler

### Current behavior
```js
case 'subscription.cancelled':
  await logEventIfNotProcessed(eventId, eventType, payload);
  // TODO: handle cancellation
  break;
```
The event is logged, but the Subscriptions DynamoDB table is never updated. The tenant's `isPaying` stays `true` after cancellation.

### Fix

```js
case 'subscription.cancelled': {
  const processed = await logEventIfNotProcessed(eventId, eventType, payload);
  if (processed) break;

  const subscriptionId = payload.payload.subscription.entity.id;
  const tenantId = await getTenantByRazorpaySubscriptionId(subscriptionId);
  if (!tenantId) { console.error('Unknown subscriptionId', subscriptionId); break; }

  const cancelledAt = payload.payload.subscription.entity.cancelled_at;
  const endsAt = payload.payload.subscription.entity.current_end;  // billing period end

  await updateItem({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: `SET #status = :cancelled,
                           isPaying = :false,
                           gracePeriodActive = :true,
                           gracePeriodEndsAt = :endsAt,
                           cancelledAt = :cancelledAt,
                           updatedAt = :now`,
    ExpressionAttributeNames: { '#status': 'paymentStatus' },
    ExpressionAttributeValues: {
      ':cancelled': 'cancelled',
      ':false': false,
      ':true': true,
      ':endsAt': endsAt * 1000,       // epoch ms
      ':cancelledAt': cancelledAt * 1000,
      ':now': Date.now(),
    },
  });

  // notify via Brevo transactional email
  await sendCancellationEmail(tenantId, new Date(endsAt * 1000));
  break;
}
```

### New helper needed
```js
// server/subscriptionService.js
export async function getTenantByRazorpaySubscriptionId(razorpaySubscriptionId) {
  const result = await queryItems({
    TableName: SUBSCRIPTIONS_TABLE,
    IndexName: 'razorpay-subscription-index',  // GSI — see CFN change below
    KeyConditionExpression: 'razorpaySubscriptionId = :sid',
    ExpressionAttributeValues: { ':sid': razorpaySubscriptionId },
    Limit: 1,
  });
  return result.Items?.[0]?.tenantId ?? null;
}
```

### CFN change — add GSI to Subscriptions table

In `server/infra/cfn-backend.yaml`, add to the Subscriptions table resource:

```yaml
# In SubscriptionsTable GlobalSecondaryIndexes:
- IndexName: razorpay-subscription-index
  KeySchema:
    - AttributeName: razorpaySubscriptionId
      KeyType: HASH
  Projection:
    ProjectionType: KEYS_ONLY

# In AttributeDefinitions add:
- AttributeName: razorpaySubscriptionId
  AttributeType: S
```

---

## Gap 2: Grace Period Never Activated (🔴 Critical)

### Current state
The `gracePeriodActive` field exists in the Subscriptions table schema but is never set to `true` by any code path. The cancellation webhook fix above (Gap 1) activates it immediately on cancellation. But for payment failures, there's a separate flow.

### Fix: `payment.failed` → activate grace period

```js
case 'payment.failed': {
  const processed = await logEventIfNotProcessed(eventId, eventType, payload);
  if (processed) break;

  const subscriptionId = payload.payload.payment.entity.invoice?.subscription_id;
  if (!subscriptionId) break;

  const tenantId = await getTenantByRazorpaySubscriptionId(subscriptionId);
  if (!tenantId) break;

  const gracePeriodEndsAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  await updateItem({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: `SET gracePeriodActive = :true,
                           gracePeriodEndsAt = :ends,
                           #status = :failed,
                           updatedAt = :now`,
    ExpressionAttributeNames: { '#status': 'paymentStatus' },
    ExpressionAttributeValues: {
      ':true': true,
      ':ends': gracePeriodEndsAt,
      ':failed': 'payment_failed',
      ':now': Date.now(),
    },
  });

  await sendPaymentFailedEmail(tenantId, gracePeriodEndsAt);
  break;
}
```

### Fix: `subscription.charged` → clear grace period (payment recovered)

```js
case 'subscription.charged': {
  const processed = await logEventIfNotProcessed(eventId, eventType, payload);
  if (processed) break;

  const subscriptionId = payload.payload.subscription.entity.id;
  const tenantId = await getTenantByRazorpaySubscriptionId(subscriptionId);
  if (!tenantId) break;

  const nextBillingDate = payload.payload.subscription.entity.current_end * 1000;

  await updateItem({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: `SET gracePeriodActive = :false,
                           gracePeriodEndsAt = :null,
                           isPaying = :true,
                           #status = :active,
                           nextBillingDate = :next,
                           updatedAt = :now`,
    ExpressionAttributeNames: { '#status': 'paymentStatus' },
    ExpressionAttributeValues: {
      ':false': false,
      ':null': null,
      ':true': true,
      ':active': 'active',
      ':next': nextBillingDate,
      ':now': Date.now(),
    },
  });
  break;
}
```

---

## Gap 3: Grace Period Expiry — No Enforcement Cron (🟠 High)

When `gracePeriodEndsAt` passes, the tenant should be locked out. There is no cron that enforces this.

### Fix: Grace Period Expiry Cron

**File:** `server/scripts/grace-period-expiry-cron.js`

```js
import { scanItems, updateItem } from '../dynamoService.js';

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE;

export async function handler() {
  const now = Date.now();

  // Scan for tenants in grace period where grace has expired
  // NOTE: Once pagination is fixed (Phase 0 item), replace with GSI query
  const { Items } = await scanItems({
    TableName: SUBSCRIPTIONS_TABLE,
    FilterExpression: 'gracePeriodActive = :true AND gracePeriodEndsAt < :now',
    ExpressionAttributeValues: { ':true': true, ':now': now },
  });

  for (const sub of Items ?? []) {
    await updateItem({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { tenantId: sub.tenantId },
      UpdateExpression: `SET gracePeriodActive = :false,
                             isPaying = :false,
                             #status = :expired,
                             updatedAt = :now`,
      ExpressionAttributeNames: { '#status': 'paymentStatus' },
      ExpressionAttributeValues: {
        ':false': false,
        ':expired': 'grace_expired',
        ':now': now,
      },
    });
    await sendGraceExpiredEmail(sub.tenantId);
  }
}
```

### CFN change — EventBridge rule for grace expiry cron

Add to `server/infra/cfn-backend.yaml`:

```yaml
GracePeriodExpiryRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "${AWS::StackName}-grace-period-expiry"
    ScheduleExpression: "rate(1 hour)"
    State: ENABLED
    Targets:
      - Id: GracePeriodExpiryLambda
        Arn: !GetAtt GracePeriodExpiryFunction.Arn

GracePeriodExpiryFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub "${AWS::StackName}-grace-period-expiry"
    Runtime: nodejs20.x
    Handler: grace-period-expiry-cron.handler
    Role: !GetAtt LambdaExecutionRole.Arn
    Environment:
      Variables:
        SUBSCRIPTIONS_TABLE: !Ref SubscriptionsTable
        BREVO_API_KEY: !Sub "{{resolve:secretsmanager:${AWS::StackName}/brevo:SecretString:apiKey}}"
    Code:
      S3Bucket: !Ref DeploymentBucket
      S3Key: !Sub "scripts/grace-period-expiry-cron.zip"

GracePeriodExpiryLambdaPermission:
  Type: AWS::Lambda::Permission
  Properties:
    Action: lambda:InvokeFunction
    FunctionName: !GetAtt GracePeriodExpiryFunction.Arn
    Principal: events.amazonaws.com
    SourceArn: !GetAtt GracePeriodExpiryRule.Arn

# GSI for efficient grace period queries (replaces Scan once added)
# Add to SubscriptionsTable GlobalSecondaryIndexes:
# - IndexName: grace-period-index
#   KeySchema:
#     - AttributeName: gracePeriodActive
#       KeyType: HASH
#     - AttributeName: gracePeriodEndsAt
#       KeyType: RANGE
#   Projection:
#     ProjectionType: KEYS_ONLY
```

---

## Gap 4: Read-Only Enforcement Not Coded (🟠 High)

`PaywallModal.tsx` FAQ says "your data is still accessible in read-only mode" but there is no middleware enforcing this.

### Fix: Read-only middleware

**File:** `server/middleware/requireActiveSubscription.js`

```js
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALWAYS_ALLOWED = [
  '/api/subscriptions',
  '/api/billing',
  '/api/auth',
  '/api/tenants/profile',
];

export function requireActiveSubscription(req, res, next) {
  // Skip non-write methods and always-allowed paths
  if (!WRITE_METHODS.has(req.method)) return next();
  if (ALWAYS_ALLOWED.some(p => req.path.startsWith(p))) return next();

  const sub = req.subscription; // populated by subscription loader middleware
  if (!sub) return res.status(403).json({ error: 'Subscription not found' });

  const isActive = sub.isPaying || sub.gracePeriodActive ||
    (sub.isTrialing && sub.trialEndsAt > Date.now());

  if (!isActive) {
    return res.status(402).json({
      error: 'subscription_required',
      message: 'Your trial has ended. Upgrade to continue.',
    });
  }

  next();
}
```

**Mount in `server/app.js` (or equivalent entry):**
```js
import { requireActiveSubscription } from './middleware/requireActiveSubscription.js';
// after auth + subscription loader middleware
app.use(requireActiveSubscription);
```

**Subscription loader middleware** (load once, attach to req):

**File:** `server/middleware/loadSubscription.js`
```js
import { getSubscription } from '../subscriptionService.js';

export async function loadSubscription(req, res, next) {
  if (!req.tenantId) return next();
  try {
    req.subscription = await getSubscription(req.tenantId);
  } catch (e) {
    console.error('Failed to load subscription', e);
  }
  next();
}
```

---

## Gap 5: No In-App Cancellation UI (🟡 Medium)

Tenants must go to Razorpay dashboard to cancel. This is poor UX and blocks self-service.

### Fix: Cancellation flow

**Backend endpoint** `server/routes/subscriptions.js`:

```js
router.post('/cancel', requireAuth, requireRole(['ADMIN', 'OWNER']), async (req, res) => {
  const { tenantId } = req;
  const sub = await getSubscription(tenantId);
  if (!sub?.razorpaySubscriptionId) return res.status(400).json({ error: 'No active subscription' });

  // Cancel at period end (not immediately) — Razorpay cancel_at_cycle_end
  const response = await razorpay.subscriptions.cancel(
    sub.razorpaySubscriptionId,
    { cancel_at_cycle_end: 1 }
  );

  await updateItem({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: 'SET cancellationScheduled = :true, updatedAt = :now',
    ExpressionAttributeValues: { ':true': true, ':now': Date.now() },
  });

  res.json({ success: true, endsAt: response.current_end });
});
```

**Frontend component** `real-estate-crm-app/src/components/CancelSubscriptionModal.tsx`:
- Show current period end date
- "Cancel at period end" (not immediate)
- Confirm with typed text input: "type CANCEL to confirm"
- Post to `/api/subscriptions/cancel`
- On success: show "Your plan will end on [date]. You can reactivate anytime."

**New Subscriptions table fields:**
```
cancellationScheduled: Boolean   # set when user schedules cancel
cancellationEndsAt: Number       # epoch ms when access ends
```

---

## Gap 6: AI Employee Manual Approval Needs UI (🟡 Medium)

`server/scripts/escalation-cron.js` contains `// ₹500 credit note needed (manual step)` — the founder must manually update DynamoDB rows. There is no admin UI.

### Fix: Admin approval dashboard endpoint

**Backend** `server/routes/admin.js`:

```js
// List pending AI Employee approvals (FOUNDER only)
router.get('/ai-employee/pending', requireRole(['FOUNDER']), async (req, res) => {
  const { Items } = await queryItems({
    TableName: AI_EMPLOYEE_TABLE,
    IndexName: 'status-index',
    KeyConditionExpression: '#s = :pending',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending' },
  });
  res.json({ items: Items });
});

// Approve or reject AI Employee request
router.post('/ai-employee/:requestId/decision', requireRole(['FOUNDER']), async (req, res) => {
  const { requestId } = req.params;
  const { decision, note } = req.body; // 'approved' | 'rejected'

  await updateItem({
    TableName: AI_EMPLOYEE_TABLE,
    Key: { requestId },
    UpdateExpression: `SET #s = :decision, founderNote = :note,
                           decidedAt = :now, updatedAt = :now`,
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':decision': decision,
      ':note': note ?? '',
      ':now': Date.now(),
    },
  });

  // Notify tenant via Brevo + AiSensy
  await sendAiEmployeeDecisionNotification(requestId, decision, note);
  res.json({ success: true });
});
```

**Frontend:** Simple admin page at `/admin/ai-employee` (FOUNDER role only), listing pending requests with Approve/Reject buttons and note field.

---

## Gap 7: Failed Payment In-App Alert (🟡 Medium)

Currently only a PostHog event fires on `payment.failed`. Agents don't see an in-app banner.

### Fix: Payment alert banner

The `SubscriptionContext.tsx` already polls `/api/subscriptions/trial-status`. Extend the response:

```js
// server/routes/subscriptions.js — GET /trial-status
{
  trialDaysLeft,
  isTrialing,
  isTrialExpired,
  gracePeriodActive,
  gracePeriodEndsAt,     // new
  paymentStatus,         // new: 'active' | 'payment_failed' | 'cancelled' | 'grace_expired'
  cancellationScheduled, // new
  cancellationEndsAt,    // new
}
```

Frontend `SubscriptionContext.tsx` adds:
- `paymentFailed` state → shows red banner: "Payment failed. Update your card to avoid losing access. [Update Card]"
- `cancellationScheduled` state → shows yellow banner: "Your plan ends on [date]. [Reactivate]"
- `gracePeriodActive` state → shows orange banner with days remaining

---

## Subscriptions Table — Complete Schema

After all fixes, the Subscriptions DynamoDB table has these fields:

```
tenantId              String (PK)
plan                  String          # 'solo' | 'team' | 'team_plus'
seatsPaid             Number
seatsUsed             Number
trialEndsAt           Number          # epoch ms
isPaying              Boolean
paymentStatus         String          # 'trialing' | 'active' | 'payment_failed' | 'cancelled' | 'grace_expired'
razorpaySubscriptionId String         # GSI: razorpay-subscription-index
nextBillingDate       Number          # epoch ms
gracePeriodActive     Boolean
gracePeriodEndsAt     Number          # epoch ms
cancelledAt           Number          # epoch ms (when Razorpay fired cancelled)
cancellationScheduled Boolean         # user scheduled end-of-period cancel
cancellationEndsAt    Number          # epoch ms (when access actually ends)
lastTrialEmail        String          # 'day10' | 'day12' | 'day14' | 'day17'
lastTrialEmailAt      Number          # epoch ms
aiEmployeeAddon       Boolean
createdAt             Number
updatedAt             Number
```

---

## CFN Summary — All Changes to `server/infra/cfn-backend.yaml`

| Change | Resource | Type |
|--------|----------|------|
| Add GSI `razorpay-subscription-index` to SubscriptionsTable | SubscriptionsTable | DynamoDB GSI |
| Add GSI `grace-period-index` to SubscriptionsTable | SubscriptionsTable | DynamoDB GSI |
| Add `GracePeriodExpiryFunction` Lambda | GracePeriodExpiryFunction | AWS::Lambda::Function |
| Add `GracePeriodExpiryRule` EventBridge schedule | GracePeriodExpiryRule | AWS::Events::Rule |
| Add `GracePeriodExpiryLambdaPermission` | GracePeriodExpiryLambdaPermission | AWS::Lambda::Permission |
| Add `TrialReminderFunction` Lambda (move from scripts) | TrialReminderFunction | AWS::Lambda::Function |
| Add `TrialReminderRule` EventBridge daily schedule | TrialReminderRule | AWS::Events::Rule |

> **Note:** All secrets (Brevo, Razorpay, etc.) are resolved via `{{resolve:secretsmanager:...}}` in CFN. Never hardcoded in template or Lambda env. Phase 0 prerequisite: rotate all secrets to Secrets Manager first.

---

## Implementation Order

| # | Task | Risk if skipped |
|---|------|----------------|
| 1 | Fix `subscription.cancelled` webhook | Revenue leaks (paying tenants show as active after cancel) |
| 2 | Fix `payment.failed` → grace period | Tenants locked out immediately on failed payment (churn) |
| 3 | Fix `subscription.charged` → clear grace | Recovered payments don't restore access |
| 4 | Add `razorpay-subscription-index` GSI | Required by gap 1 fix |
| 5 | Grace period expiry cron + CFN | Tenants with expired grace period retain access indefinitely |
| 6 | Read-only middleware | Promise in PaywallModal FAQ is false |
| 7 | In-app payment alert banner | Tenants don't know payment failed |
| 8 | In-app cancellation UI | Tenants must use Razorpay dashboard |
| 9 | AI Employee approval UI | Founder manages approvals via raw DynamoDB |

Items 1–5 are Phase 0 blockers. Items 6–9 are Phase 1 polish.
