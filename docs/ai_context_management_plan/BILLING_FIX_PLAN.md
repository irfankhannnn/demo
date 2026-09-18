# Detailed Fix Plan: Billing, Subscription & Credits System

**Date:** 2026-06-22  
**Based on:** `BILLING_SUBSCRIPTION_CREDITS_ANALYSIS.md`  
**Branch:** `auth_rbac_feature` (create fix branch: `fix/billing-subscription-credits`)

---

## How to Use This Plan

Each fix is self-contained with:
- **File**: Exact path to modify
- **Lines**: Current code location
- **Change**: What to add/modify
- **Test**: How to verify the fix
- **Commit**: Suggested commit message

Work through fixes in order. Each fix can be committed independently.

---

## Phase 1: Critical Fixes (Week 1)

### Fix 1.1: Add Seat Downgrade Handler

**File:** `agency-app/api/routes/billing.js`  
**Lines:** 331-357  
**Issue:** Only handles seat upgrades (`newQuantity > previousQuantity`). Downgrades silently ignored.

**Current Code (line 337-355):**
```javascript
if (
  tenantId &&
  typeof newQuantity === 'number' &&
  typeof previousQuantity === 'number' &&
  newQuantity > previousQuantity
) {
  const seatsAdded = newQuantity - previousQuantity;
  await incrementSeatsPaid(tenantId, seatsAdded);
  await serverTrack(tenantId, 'seat_added', {
    seatsAdded,
    newTotal: newQuantity,
  });
} else if (tenantId && (typeof newQuantity !== 'number' || typeof previousQuantity !== 'number')) {
  logger.warn('subscription.updated.invalid_quantities', {
    tenantId,
    newQuantity,
    previousQuantity,
  });
}
```

**Replace With:**
```javascript
if (
  tenantId &&
  typeof newQuantity === 'number' &&
  typeof previousQuantity === 'number'
) {
  if (newQuantity > previousQuantity) {
    // Seat upgrade
    const seatsAdded = newQuantity - previousQuantity;
    await incrementSeatsPaid(tenantId, seatsAdded);
    await serverTrack(tenantId, 'seat_added', {
      seatsAdded,
      newTotal: newQuantity,
    });
  } else if (newQuantity < previousQuantity) {
    // Seat downgrade — reduce paid seats
    const seatsRemoved = previousQuantity - newQuantity;
    try {
      await decrementSeatsPaid(tenantId, seatsRemoved);
      await serverTrack(tenantId, 'seat_removed', {
        seatsRemoved,
        newTotal: newQuantity,
      });
      logger.info('subscription.updated.seats_downgraded', { tenantId, seatsRemoved, newTotal: newQuantity });
    } catch (downgradeErr) {
      // decrementSeatsPaid throws if seatsPaid < seatsRemoved (ConditionExpression fails)
      logger.error('subscription.updated.downgrade.failed', {
        tenantId,
        seatsRemoved,
        error: downgradeErr.message,
      });
    }
  }
  // newQuantity === previousQuantity: no change, no-op
} else if (tenantId && (typeof newQuantity !== 'number' || typeof previousQuantity !== 'number')) {
  logger.warn('subscription.updated.invalid_quantities', {
    tenantId,
    newQuantity,
    previousQuantity,
  });
}
```

**Test:**
```bash
# Simulate downgrade webhook (3 seats → 1 seat)
curl -X POST http://localhost:3001/api/billing/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: <valid-signature>" \
  -d '{"event":"subscription.updated","event_id":"evt_test_downgrade","created_at":<now>,"payload":{"subscription":{"entity":{"notes":{"tenantId":"<TENANT_ID>"},"quantity":1,"previousQuantity":3}}}}'

# Verify seatsPaid reduced from 3 to 1
aws dynamodb get-item --table-name Subscriptions \
  --key '{"tenantId":{"S":"<TENANT_ID>"}}' --region ap-south-1
```

**Commit:** `fix(billing): handle seat downgrades in subscription.updated webhook`

---

### Fix 1.2: Update Subscriptions Table on Cancellation

**File:** `agency-app/api/routes/billing.js`  
**Lines:** 306-328  
**Issue:** `subscription.cancelled` and `subscription.halted` only suspend AI Employee. Subscriptions table still shows `isPaying=true`.

**Current Code (line 306-328):**
```javascript
case 'subscription.cancelled':
case 'subscription.halted': {
  const subscription = payload?.subscription?.entity;
  const tenantId = subscription?.notes?.tenantId || 'unknown';
  const planId = subscription?.plan_id;
  const aiEmployeePlanId = process.env.RAZORPAY_PLAN_AI_EMPLOYEE || 'plan_test_ai_employee';

  if (tenantId !== 'unknown' && planId === aiEmployeePlanId) {
    try {
      await suspendProvisioning(tenantId, eventType);
      await updateAgencyConfig(tenantId, { aiEmployeeEnabled: false });
      logger.info('AI Employee suspended on subscription cancellation', { tenantId, event: eventType });
    } catch (suspendErr) {
      logger.error('AI Employee suspension failed (non-fatal)', { tenantId, error: suspendErr.message });
    }
  }

  // Subscription table update will be done by PR-H subscriptionService
  await serverTrack(tenantId, 'subscription_cancelled', {
    subscriptionId: subscription?.id,
    planId,
  });
  break;
}
```

**Replace With:**
```javascript
case 'subscription.cancelled':
case 'subscription.halted': {
  const subscription = payload?.subscription?.entity;
  const tenantId = subscription?.notes?.tenantId || 'unknown';
  const planId = subscription?.plan_id;
  const aiEmployeePlanId = process.env.RAZORPAY_PLAN_AI_EMPLOYEE || 'plan_test_ai_employee';

  // 1. Suspend AI Employee if this is an AI Employee plan
  if (tenantId !== 'unknown' && planId === aiEmployeePlanId) {
    try {
      await suspendProvisioning(tenantId, eventType);
      await updateAgencyConfig(tenantId, { aiEmployeeEnabled: false });
      logger.info('AI Employee suspended on subscription cancellation', { tenantId, event: eventType });
    } catch (suspendErr) {
      logger.error('AI Employee suspension failed (non-fatal)', { tenantId, error: suspendErr.message });
    }
  }

  // 2. Update Subscriptions table — mark as cancelled/halted
  if (tenantId !== 'unknown') {
    try {
      const { DynamoDBDocumentClient, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      // Reuse the subscriptionService's updateSubscription if available, else inline
      const { updateSubscriptionStatus } = await import('../subscriptionService.js');
      await updateSubscriptionStatus(tenantId, {
        isPaying: false,
        paymentStatus: eventType === 'subscription.cancelled' ? 'cancelled' : 'halted',
        cancelledAt: new Date().toISOString(),
        razorpaySubscriptionId: subscription?.id || null,
      });
      logger.info('subscription.cancelled.table_updated', { tenantId, eventType });
    } catch (subUpdateErr) {
      logger.error('subscription.cancelled.table_update_failed', {
        tenantId,
        error: subUpdateErr.message,
      });
    }
  }

  await serverTrack(tenantId, 'subscription_cancelled', {
    subscriptionId: subscription?.id,
    planId,
  });
  break;
}
```

**Also add to `agency-app/api/subscriptionService.js` (append after `setBillingAnniversaryDay`):**
```javascript
/**
 * Update subscription status fields (paymentStatus, isPaying, cancelledAt, etc.)
 * Used by billing webhook on subscription.cancelled / subscription.halted.
 */
export async function updateSubscriptionStatus(tenantId, updates) {
  const now = new Date().toISOString();
  const setExpressions = ['updatedAt = :now'];
  const values = { ':now': now };

  for (const [field, value] of Object.entries(updates)) {
    if (value === null) {
      // Skip null values to avoid overwriting with null unintentionally
      continue;
    }
    setExpressions.push(`${field} = :${field}`);
    values[`:${field}`] = value;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(tenantId)',
  }));

  logger.info('subscription.status.updated', { tenantId, updates: Object.keys(updates) });
  return getSubscription(tenantId);
}
```

**Test:**
```bash
# Simulate cancellation webhook
curl -X POST http://localhost:3001/api/billing/webhook \
  -H "X-Razorpay-Signature: <valid>" \
  -d '{"event":"subscription.cancelled","event_id":"evt_test_cancel","created_at":<now>,"payload":{"subscription":{"entity":{"id":"sub_test","notes":{"tenantId":"<TENANT_ID>"}}}}}'

# Verify isPaying=false, paymentStatus=cancelled
aws dynamodb get-item --table-name Subscriptions \
  --key '{"tenantId":{"S":"<TENANT_ID>"}}' --region ap-south-1
```

**Commit:** `fix(billing): update Subscriptions table on subscription cancellation/halted`

---

### Fix 1.3: Implement Grace Period on Payment Failure

**File:** `agency-app/api/routes/billing.js`  
**Lines:** 294-304  
**Issue:** `payment.failed` only logs to PostHog. No grace period activated.

**Current Code (line 294-304):**
```javascript
case 'payment.failed': {
  const payment = payload?.payment?.entity;
  const tenantId = payment?.notes?.tenantId || 'unknown';
  await serverTrack(tenantId, 'razorpay_payment_failed', {
    paymentId: payment?.id,
    amount: payment?.amount,
    errorCode: payment?.error_code,
    errorDescription: payment?.error_description,
  });
  break;
}
```

**Replace With:**
```javascript
case 'payment.failed': {
  const payment = payload?.payment?.entity;
  const tenantId = payment?.notes?.tenantId || 'unknown';
  await serverTrack(tenantId, 'razorpay_payment_failed', {
    paymentId: payment?.id,
    amount: payment?.amount,
    errorCode: payment?.error_code,
    errorDescription: payment?.error_description,
  });

  // Activate 7-day grace period for paying subscribers
  if (tenantId !== 'unknown') {
    try {
      const { getSubscription, updateSubscriptionStatus } = await import('../subscriptionService.js');
      const sub = await getSubscription(tenantId);
      if (sub?.isPaying && !sub.gracePeriodActive) {
        const gracePeriodDays = Number(process.env.GRACE_PERIOD_DAYS) || 7;
        const gracePeriodEndsAt = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();
        await updateSubscriptionStatus(tenantId, {
          gracePeriodActive: true,
          gracePeriodEndsAt,
        });
        logger.warn('subscription.grace_period.activated', { tenantId, gracePeriodEndsAt });

        // Notify founder
        await sendBrevoEmail(
          process.env.BREVO_PAYMENT_FAILED_TEMPLATE_ID,
          process.env.FOUNDER_NOTIFICATION_EMAIL || 'info@realestateflow.in',
          { tenantId, gracePeriodEndsAt, paymentId: payment?.id }
        ).catch(err => logger.error('grace_period.email.failed', { error: err.message }));
      }
    } catch (graceErr) {
      logger.error('subscription.grace_period.activation_failed', { tenantId, error: graceErr.message });
    }
  }
  break;
}
```

**Add to `agency-app/api/subscriptionService.js` `createTrialSubscription` item (line 114-128):**
```javascript
// Add gracePeriodEndsAt field to schema (initially null)
gracePeriodEndsAt: null,
```

**Add env var to `agency-app/api/.env.example`:**
```bash
# Grace period for failed payments (days)
GRACE_PERIOD_DAYS=7
# Brevo template ID for payment failed notification
BREVO_PAYMENT_FAILED_TEMPLATE_ID=4
```

**Commit:** `fix(billing): activate grace period on payment.failed webhook`

---

### Fix 1.4: Add Grace Period Expiry Cron

**File:** `agency-app/api/scripts/grace-period-expiry-cron.js` (NEW FILE)  
**Issue:** No cron to expire grace period after N days and suspend features.

**Create:**
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { suspendProvisioning } from '../aiEmployeeProvisioningService.js';
import { updateAgencyConfig } from '../agencyConfigService.js';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

export async function handler() {
  const now = new Date().toISOString();
  let expired = 0;
  let skipped = 0;
  let failed = 0;

  // Scan for subscriptions with active grace period that has ended
  let lastKey;
  const expiredSubs = [];
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      FilterExpression: 'gracePeriodActive = :true AND attribute_exists(gracePeriodEndsAt) AND gracePeriodEndsAt < :now',
      ExpressionAttributeValues: { ':true': true, ':now': now },
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    expiredSubs.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  for (const sub of expiredSubs) {
    const tenantId = sub.tenantId;
    if (!tenantId) continue;

    try {
      // 1. Mark grace period as expired
      await docClient.send(new UpdateCommand({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { tenantId },
        UpdateExpression: 'SET gracePeriodActive = :false, paymentStatus = :status, gracePeriodExpiredAt = :now, updatedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':status': 'grace_period_expired',
          ':now': now,
        },
      }));

      // 2. Suspend AI Employee
      try {
        await suspendProvisioning(tenantId, 'grace_period_expired');
        await updateAgencyConfig(tenantId, { aiEmployeeEnabled: false });
      } catch (suspendErr) {
        logger.error('grace_period.suspend.failed', { tenantId, error: suspendErr.message });
      }

      logger.info('grace_period.expired', { tenantId });
      expired++;
    } catch (err) {
      failed++;
      logger.error('grace_period.expiry.failed', { tenantId, error: err.message });
    }
  }

  logger.info('grace_period.expiry_cron.completed', { expired, failed, total: expiredSubs.length });
  return { expired, failed, total: expiredSubs.length };
}

// CLI runner
if (process.argv[1]?.endsWith('grace-period-expiry-cron.js')) {
  handler().catch(err => {
    logger.error('grace_period.expiry_cron.fatal', { error: err.message });
    process.exit(1);
  });
}
```

**Test:**
```bash
# Set a subscription's gracePeriodEndsAt to past
aws dynamodb update-item --table-name Subscriptions \
  --key '{"tenantId":{"S":"<TENANT_ID>"}}' \
  --update-expression 'SET gracePeriodActive = :true, gracePeriodEndsAt = :past' \
  --expression-attribute-values '{
    ":true": {"BOOL": true},
    ":past": {"S": "2026-06-20T00:00:00Z"}
  }' --region ap-south-1

# Run cron
node agency-app/api/scripts/grace-period-expiry-cron.js

# Verify gracePeriodActive=false, paymentStatus=grace_period_expired
```

**Commit:** `feat(billing): add grace period expiry cron job`

---

### Fix 1.5: Add Idempotency Lock to Credit Reset Cron

**File:** `agency-app/api/scripts/credit-reset-cron.js`  
**Lines:** 93-101  
**Issue:** No `ConditionExpression` — concurrent cron runs could reset credits twice.

**Current Code (line 93-101):**
```javascript
await docClient.send(new UpdateCommand({
  TableName: SUBSCRIPTIONS_TABLE,
  Key: { tenantId },
  UpdateExpression: 'SET lastCreditResetAt = :today, updatedAt = :now',
  ExpressionAttributeValues: {
    ':today': today,
    ':now': new Date().toISOString(),
  },
}));
```

**Replace With:**
```javascript
try {
  await docClient.send(new UpdateCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: 'SET lastCreditResetAt = :today, updatedAt = :now',
    ConditionExpression: 'attribute_not_exists(lastCreditResetAt) OR lastCreditResetAt <> :today',
    ExpressionAttributeValues: {
      ':today': today,
      ':now': new Date().toISOString(),
    },
  }));
} catch (condErr) {
  if (condErr.name === 'ConditionalCheckFailedException') {
    // Another cron instance already reset this tenant today — skip
    logger.info('creditReset.skipped_already_done', { tenantId, today });
    skipped++;
    continue;
  }
  throw condErr;
}
```

**Note:** The `resetMonthlyCredits()` call happens BEFORE this update. To make it fully atomic, we should move the reset AFTER the conditional update succeeds. Reorder:

```javascript
// 1. Atomically claim the reset for today
try {
  await docClient.send(new UpdateCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { tenantId },
    UpdateExpression: 'SET lastCreditResetAt = :today, updatedAt = :now',
    ConditionExpression: 'attribute_not_exists(lastCreditResetAt) OR lastCreditResetAt <> :today',
    ExpressionAttributeValues: {
      ':today': today,
      ':now': new Date().toISOString(),
    },
  }));
} catch (condErr) {
  if (condErr.name === 'ConditionalCheckFailedException') {
    skipped++;
    continue;
  }
  throw condErr;
}

// 2. Now reset the credits (only one cron instance will reach here)
const allotment = getMonthlyAllotment(sub, freeTier, packs);
await resetMonthlyCredits(tenantId, allotment, 'monthly_reset');
await metrics.creditReset(tenantId);
reset++;
```

**Test:**
```bash
# Run cron twice in parallel
node agency-app/api/scripts/credit-reset-cron.js &
node agency-app/api/scripts/credit-reset-cron.js &
wait

# Verify only one reset ledger entry per tenant for today
```

**Commit:** `fix(credits): add idempotency lock to monthly credit reset cron`

---

### Fix 1.6: Make Refund Blocking in leads.js

**File:** `agency-app/api/routes/leads.js`  
**Lines:** 310-317  
**Issue:** Refund is non-blocking (`.catch()` only logs). Credits can be lost.

**Current Code (line 310-317):**
```javascript
} catch (error) {
  // If credits were charged but the handler subsequently failed, refund them
  if (creditCharge?.ledgerId && leadAddCost > 0) {
    refundCredits(req.tenantId, leadAddCost, 'lead_add', {
      ledgerId: creditCharge.ledgerId,
      reason: 'create_lead_failed_post_charge',
    }).catch(refundErr => logger.error('leads.refund.failed', { tenantId: req.tenantId, ledgerId: creditCharge?.ledgerId, error: refundErr.message }));
  }
  if (handleCreditError(error, res)) return;
  logger.error('leads.create.error', { tenantId: req.tenantId, error: error.message });
  if (error.message && error.message.startsWith('A lead with this phone number already exists')) {
    return res.status(409).json({ error: error.message });
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
}
```

**Replace With:**
```javascript
} catch (error) {
  // If credits were charged but the handler subsequently failed, refund them (blocking)
  if (creditCharge?.ledgerId && leadAddCost > 0) {
    try {
      await refundCredits(req.tenantId, leadAddCost, 'lead_add', {
        ledgerId: creditCharge.ledgerId,
        reason: 'create_lead_failed_post_charge',
      });
      logger.info('leads.refund.succeeded', { tenantId: req.tenantId, ledgerId: creditCharge.ledgerId, amount: leadAddCost });
    } catch (refundErr) {
      // Critical: refund failed — credits are lost. Log with high severity and alert.
      logger.error('leads.refund.failed.critical', {
        tenantId: req.tenantId,
        ledgerId: creditCharge.ledgerId,
        amount: leadAddCost,
        error: refundErr.message,
        // Flag for manual reconciliation
        requiresManualRefund: true,
      });
      // Still return error to client, but include refund failure info
      if (handleCreditError(error, res)) return;
      return res.status(500).json({
        error: 'Internal server error',
        details: 'Credit refund failed — please contact support',
        refundFailed: true,
        ledgerId: creditCharge.ledgerId,
      });
    }
  }
  if (handleCreditError(error, res)) return;
  logger.error('leads.create.error', { tenantId: req.tenantId, error: error.message });
  if (error.message && error.message.startsWith('A lead with this phone number already exists')) {
    return res.status(409).json({ error: error.message });
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
}
```

**Apply same pattern to other credit-charging routes:**
- `agency-app/api/routes/crm.js` (search for `refundCredits`)
- `agency-app/api/routes/khata.js` (if applicable)

**Commit:** `fix(credits): make refund blocking to prevent credit loss on handler failure`

---

### Fix 1.7: Fix Bailey Webhook Signature Skip in Dev

**File:** `agency-app/api/bailey.js`  
**Lines:** 234-241  
**Issue:** In dev, skips signature verification if `BAILEY_WEBHOOK_SECRET` not set.

**Current Code (line 234-241):**
```javascript
const secret = process.env.BAILEY_WEBHOOK_SECRET;
if (!secret) {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('bailey.verifySignature.rejected', { reason: 'BAILEY_WEBHOOK_SECRET not set in production' });
    return false;
  }
  logger.warn('bailey.verifySignature.skipped', { reason: 'BAILEY_WEBHOOK_SECRET not set' });
  return true;
}
```

**Replace With:**
```javascript
const secret = process.env.BAILEY_WEBHOOK_SECRET;
if (!secret) {
  // Always reject if secret is not configured — no exceptions for dev
  logger.error('bailey.verifySignature.rejected', {
    reason: 'BAILEY_WEBHOOK_SECRET not set',
    env: process.env.NODE_ENV,
  });
  return false;
}
```

**Also update `agency-app/api/.env.example`:**
```bash
# Bailey WhatsApp — REQUIRED in all environments (use a test secret in dev)
BAILEY_WEBHOOK_SECRET=generate-a-test-secret-for-local-dev
```

**Commit:** `fix(security): never skip Bailey webhook signature verification`

---

### Fix 1.8: Add Validation for Razorpay Notes (tenantId)

**File:** `agency-app/api/routes/billing.js`  
**Lines:** 139-144 (subscription.activated handler)  
**Issue:** `tenantId` from notes could be undefined, provisioning fails silently.

**Current Code (line 139-144):**
```javascript
const notes = subscription?.notes || {};
const tenantId = notes.tenantId;
const agencyOwnerId = notes.agencyOwnerId || notes.userId;
const agencyName = notes.agencyName || '';
const contactPhone = notes.contactPhone || '';
const contactEmail = notes.contactEmail || '';
```

**Add validation after line 144:**
```javascript
const notes = subscription?.notes || {};
const tenantId = notes.tenantId;
const agencyOwnerId = notes.agencyOwnerId || notes.userId;
const agencyName = notes.agencyName || '';
const contactPhone = notes.contactPhone || '';
const contactEmail = notes.contactEmail || '';

// Validate required fields
if (!tenantId) {
  logger.error('subscription.activated.missing_tenantId', {
    subscriptionId: subscription?.id,
    notes,
  });
  break;
}
```

**Apply same validation to other webhook handlers that extract `tenantId` from notes:**
- `subscription.cancelled` / `subscription.halted` (line 309)
- `subscription.updated` (line 333) — already has `if (tenantId && ...)` check
- `payment.captured` (line 235)
- `payment.failed` (line 296)

**Commit:** `fix(billing): validate tenantId in Razorpay webhook notes`

---

### Fix 1.9: Add Balance Reconciliation Utility

**File:** `agency-app/api/scripts/credit-balance-reconcile.js` (NEW FILE)  
**Issue:** If BALANCE item deleted, `getBalance()` returns 0 silently.

**Create:**
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const CREDITS_TABLE = process.env.CREDITS_TABLE_NAME || 'cloudberry-real-estate-credits';
const BALANCE_SK = 'BALANCE';

/**
 * Reconcile credit balances for all tenants.
 * For each tenant:
 *   1. Check if BALANCE item exists
 *   2. If missing but LEDGER entries exist, rebuild from latest ledger entry
 *   3. Log warnings for inconsistencies
 */
export async function handler() {
  let checked = 0;
  let rebuilt = 0;
  let missing = 0;
  let failed = 0;

  // Get all unique tenantIds from credits table
  let lastKey;
  const tenantIds = new Set();
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: CREDITS_TABLE,
      ProjectionExpression: 'tenantId',
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    for (const item of result.Items || []) {
      if (item.tenantId) tenantIds.add(item.tenantId);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  for (const tenantId of tenantIds) {
    checked++;
    try {
      // 1. Check if BALANCE item exists
      const balanceResult = await docClient.send(new QueryCommand({
        TableName: CREDITS_TABLE,
        KeyConditionExpression: 'tenantId = :tid AND sk = :sk',
        ExpressionAttributeValues: { ':tid': tenantId, ':sk': BALANCE_SK },
        Limit: 1,
      }));

      if (balanceResult.Items?.length > 0) {
        // Balance exists — OK
        continue;
      }

      // 2. BALANCE missing — check for ledger entries
      const ledgerResult = await docClient.send(new QueryCommand({
        TableName: CREDITS_TABLE,
        KeyConditionExpression: 'tenantId = :tid AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':tid': tenantId, ':prefix': 'LEDGER#' },
        ScanIndexForward: false, // latest first
        Limit: 1,
      }));

      if (!ledgerResult.Items?.length) {
        // No ledger entries either — tenant has no credit history
        continue;
      }

      // 3. Rebuild BALANCE from latest ledger entry
      const latestLedger = ledgerResult.Items[0];
      const rebuiltBalance = latestLedger.balanceAfter ?? 0;

      await docClient.send(new PutCommand({
        TableName: CREDITS_TABLE,
        Item: {
          tenantId,
          sk: BALANCE_SK,
          balance: rebuiltBalance,
          updatedAt: new Date().toISOString(),
          reconciledAt: new Date().toISOString(),
          reconciledFrom: latestLedger.sk,
        },
      }));

      logger.warn('creditBalance.reconciled.rebuilt', {
        tenantId,
        rebuiltBalance,
        fromLedger: latestLedger.sk,
      });
      rebuilt++;
    } catch (err) {
      failed++;
      logger.error('creditBalance.reconcile.failed', { tenantId, error: err.message });
    }
  }

  logger.info('creditBalance.reconcile.completed', { checked, rebuilt, missing, failed });
  return { checked, rebuilt, missing, failed };
}

if (process.argv[1]?.endsWith('credit-balance-reconcile.js')) {
  handler().catch(err => {
    logger.error('creditBalance.reconcile.fatal', { error: err.message });
    process.exit(1);
  });
}
```

**Test:**
```bash
# Delete a tenant's BALANCE item
aws dynamodb delete-item --table-name cloudberry-real-estate-credits \
  --key '{"tenantId":{"S":"<TENANT_ID>"},"sk":{"S":"BALANCE"}}' --region ap-south-1

# Run reconciliation
node agency-app/api/scripts/credit-balance-reconcile.js

# Verify BALANCE item rebuilt
aws dynamodb get-item --table-name cloudberry-real-estate-credits \
  --key '{"tenantId":{"S":"<TENANT_ID>"},"sk":{"S":"BALANCE"}}' --region ap-south-1
```

**Commit:** `feat(credits): add credit balance reconciliation cron job`

---

## Phase 2: High-Priority Fixes (Week 2-3)

### Fix 2.1: Add Rate Limiting to Billing Webhook

**File:** `agency-app/api/server.js`  
**Issue:** Billing webhook mounted before rate limiter.

**Find the billing route mount (around line 83):**
```javascript
// Current (example):
app.use('/api/billing', billingRoutes);
```

**Replace With:**
```javascript
import { webhookRateLimit } from './middleware/rateLimiter.js';
// ...
app.use('/api/billing', webhookRateLimit, billingRoutes);
```

**Note:** Razorpay retries are typically 3-5 times within an hour. 20 req/min is sufficient.

**Commit:** `fix(security): add rate limiting to billing webhook endpoint`

---

### Fix 2.2: Add subscription.paused and subscription.resumed Handlers

**File:** `agency-app/api/routes/billing.js`  
**Lines:** Add after `subscription.updated` case (line 357)  
**Issue:** Paused/resumed subscriptions not handled.

**Add:**
```javascript
case 'subscription.paused': {
  const subscription = payload?.subscription?.entity;
  const tenantId = subscription?.notes?.tenantId || 'unknown';
  if (tenantId !== 'unknown') {
    try {
      const { updateSubscriptionStatus } = await import('../subscriptionService.js');
      await updateSubscriptionStatus(tenantId, {
        paymentStatus: 'paused',
        pausedAt: new Date().toISOString(),
      });
      logger.info('subscription.paused', { tenantId });
    } catch (err) {
      logger.error('subscription.paused.update_failed', { tenantId, error: err.message });
    }
  }
  await serverTrack(tenantId, 'subscription_paused', { subscriptionId: subscription?.id });
  break;
}

case 'subscription.resumed': {
  const subscription = payload?.subscription?.entity;
  const tenantId = subscription?.notes?.tenantId || 'unknown';
  if (tenantId !== 'unknown') {
    try {
      const { updateSubscriptionStatus } = await import('../subscriptionService.js');
      await updateSubscriptionStatus(tenantId, {
        paymentStatus: 'active',
        isPaying: true,
        resumedAt: new Date().toISOString(),
      });
      logger.info('subscription.resumed', { tenantId });
    } catch (err) {
      logger.error('subscription.resumed.update_failed', { tenantId, error: err.message });
    }
  }
  await serverTrack(tenantId, 'subscription_resumed', { subscriptionId: subscription?.id });
  break;
}
```

**Commit:** `feat(billing): handle subscription.paused and subscription.resumed webhooks`

---

### Fix 2.3: Add Credit Amount Validation (Upper Bound)

**File:** `agency-app/api/routes/subscriptions.js`  
**Lines:** 171-173  
**Issue:** No upper bound on credit amount.

**Current Code (line 171-173):**
```javascript
if (!credits || credits <= 0) {
  return res.status(400).json({ error: 'Invalid credit amount' });
}
```

**Replace With:**
```javascript
const MAX_CREDIT_PURCHASE = 100000; // 100k credits max per purchase
if (!credits || credits <= 0) {
  return res.status(400).json({ error: 'Invalid credit amount' });
}
if (credits > MAX_CREDIT_PURCHASE) {
  return res.status(400).json({
    error: 'invalid_credit_amount',
    message: `Maximum ${MAX_CREDIT_PURCHASE} credits per purchase`,
    max: MAX_CREDIT_PURCHASE,
  });
}
```

**Commit:** `fix(credits): add upper bound validation for credit purchases`

---

### Fix 2.4: Add Credit Admin Endpoint Input Validation

**File:** `agency-app/api/routes/creditAdmin.js`  
**Lines:** 24-42  
**Issue:** Allows arbitrary action type keys. No upper bound on cost values.

**Current Code (line 24-42):**
```javascript
router.put('/costs', async (req, res) => {
  try {
    const costs = req.body;
    if (!costs || typeof costs !== 'object') {
      return res.status(400).json({ error: 'Invalid costs object' });
    }
    for (const [key, val] of Object.entries(costs)) {
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `Invalid cost for ${key}` });
      }
    }
    await updateConfig('COSTS', costs);
    await clearConfigCache();
    res.json({ success: true, costs });
  } catch (err) {
    logger.error('creditAdmin.costs.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});
```

**Replace With:**
```javascript
import { DEFAULTS } from '../creditConfig.js';

const VALID_COST_KEYS = Object.keys(DEFAULTS.COSTS);
const MAX_COST_VALUE = 1000; // No single action should cost more than 1000 credits

router.put('/costs', async (req, res) => {
  try {
    const costs = req.body;
    if (!costs || typeof costs !== 'object') {
      return res.status(400).json({ error: 'Invalid costs object' });
    }
    for (const [key, val] of Object.entries(costs)) {
      if (!VALID_COST_KEYS.includes(key)) {
        return res.status(400).json({
          error: `Invalid action type: ${key}`,
          validKeys: VALID_COST_KEYS,
        });
      }
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `Invalid cost for ${key}: must be non-negative number` });
      }
      if (val > MAX_COST_VALUE) {
        return res.status(400).json({
          error: `Cost for ${key} exceeds maximum (${MAX_COST_VALUE})`,
          max: MAX_COST_VALUE,
        });
      }
    }

    // Log the config change for audit trail
    logger.info('creditConfig.costs.updated', {
      updatedBy: req.user?.userId || 'unknown',
      changes: costs,
      timestamp: new Date().toISOString(),
    });

    await updateConfig('COSTS', costs);
    await clearConfigCache();
    res.json({ success: true, costs });
  } catch (err) {
    logger.error('creditAdmin.costs.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});
```

**Commit:** `fix(security): validate credit config keys and add audit logging`

---

### Fix 2.5: Fix IP Spoofing in Rate Limiter

**File:** `agency-app/api/middleware/rateLimiter.js`  
**Lines:** 15-16  
**Issue:** Uses first IP from `x-forwarded-for` without validation.

**Current Code (line 15-16):**
```javascript
const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
const key = typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip);
```

**Replace With:**
```javascript
function getClientIp(req) {
  // In production behind API Gateway, trust the API Gateway source IP
  if (process.env.NODE_ENV === 'production') {
    // API Gateway sets x-forwarded-for with the real client IP as first entry
    // But we should only trust this if the request came through API Gateway
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const ips = forwarded.split(',').map(s => s.trim());
      // Take the leftmost (client) IP, but validate it's a valid IP
      const clientIp = ips[0];
      if (clientIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clientIp)) {
        return clientIp;
      }
    }
    return req.socket.remoteAddress || 'unknown';
  }
  // In dev, use direct connection IP
  return req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

// In rateLimit function:
const ip = getClientIp(req);
const key = typeof ip === 'string' ? ip : String(ip);
```

**Commit:** `fix(security): validate X-Forwarded-For header to prevent IP spoofing`

---

### Fix 2.6: Fix Billing Anniversary Day Calculation

**File:** `agency-app/api/scripts/credit-reset-cron.js`  
**Lines:** 23-42 (`isDueForReset` function)  
**Issue:** Doesn't handle month-end edge cases (e.g., anniversary on 31st, but month has 28 days).

**Current Code (line 28-29):**
```javascript
if (sub.billingAnniversaryDay) {
  return new Date().getUTCDate() === sub.billingAnniversaryDay;
}
```

**Replace With:**
```javascript
if (sub.billingAnniversaryDay) {
  const today = new Date();
  const todayUtcDate = today.getUTCDate();
  const todayUtcMonth = today.getUTCMonth(); // 0-11
  const todayUtcYear = today.getUTCFullYear();
  const anniversaryDay = sub.billingAnniversaryDay;

  // Direct match
  if (todayUtcDate === anniversaryDay) return true;

  // Handle month-end: if anniversary is 29, 30, or 31 and current month
  // doesn't have that day, reset on the last day of the month
  if (anniversaryDay >= 29) {
    const lastDayOfMonth = new Date(Date.UTC(todayUtcYear, todayUtcMonth + 1, 0)).getUTCDate();
    if (todayUtcDate === lastDayOfMonth && lastDayOfMonth < anniversaryDay) {
      return true;
    }
  }

  return false;
}
```

**Test:**
```bash
# Set anniversary day to 31
# Test on Feb 28 (non-leap year) — should reset
# Test on Feb 29 (leap year) — should reset
# Test on March 31 — should reset
# Test on April 30 — should reset (April has 30 days, anniversary is 31)
```

**Commit:** `fix(credits): handle month-end edge cases in billing anniversary calculation`

---

### Fix 2.7: Add Per-Tenant Rate Limiting

**File:** `agency-app/api/middleware/rateLimiter.js`  
**Issue:** No per-tenant rate limiting. One tenant could DoS others.

**Add new function:**
```javascript
/**
 * Per-tenant rate limiter. Uses tenantId from req.tenantId (set by extractTenantId middleware).
 * Must be mounted AFTER extractTenantId.
 */
function createTenantRateLimit(windowMs = WINDOW_MS, maxRequests = 200) {
  const map = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of map.entries()) {
      if (now > record.resetAt + windowMs) map.delete(key);
    }
  }, Math.min(windowMs * 5, 10 * 60 * 1000)).unref?.();

  return function tenantRateLimit(req, res, next) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next(); // Skip if no tenant context

    const key = `tenant:${tenantId}`;
    const now = Date.now();

    let record = map.get(key);
    if (!record || now > record.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Tenant rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
    return next();
  };
}

export const tenantRateLimit = createTenantRateLimit(60 * 1000, 200);
export const creditActionRateLimit = createTenantRateLimit(60 * 1000, 30); // 30 credit-charging actions per minute
```

**Apply to credit-charging routes in `agency-app/api/routes/leads.js`:**
```javascript
import { creditActionRateLimit } from '../middleware/rateLimiter.js';
// ...
router.post('/', validateToken, extractTenantId, creditActionRateLimit, async (req, res) => {
```

**Commit:** `feat(security): add per-tenant rate limiting for credit-charging routes`

---

### Fix 2.8: Redact Sensitive Data in Logs

**File:** `agency-app/api/logger.js`  
**Issue:** Doesn't redact `razorpayPaymentId`, `razorpayOrderId`, `amountPaise`, phone numbers, emails.

**Find the redaction configuration and add:**
```javascript
// Add to existing redaction paths
const SENSITIVE_KEYS = [
  'authorization', 'password', 'token', 'secret',
  'razorpayPaymentId', 'razorpayOrderId', 'amountPaise',
  'razorpayKeySecret', 'razorpayWebhookSecret',
  'adminPasswordHash', 'jwtSecret',
  'contactPhone', 'contactEmail', 'adminEmail', 'adminPhone',
  'phone', 'email', // PII
];
```

**Commit:** `fix(security): redact payment IDs, amounts, and PII from logs`

---

## Phase 3: Medium-Priority Fixes (Week 4-6)

### Fix 3.1: Add Invoice/Transaction History UI

**Files:**
- `agency-app/web/src/pages/crm/BillingSettings.tsx` — Add "Transaction History" tab
- `agency-app/web/src/services/api.ts` — Add `getCreditLedger()` method

**API method (api.ts):**
```typescript
async getCreditLedger(params?: { limit?: number; startKey?: string }): Promise<{
  items: LedgerEntry[];
  nextKey: string | null;
}> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.startKey) query.set('startKey', params.startKey);
  return this.get(`/api/subscriptions/credits/ledger?${query.toString()}`);
}
```

**UI Component (BillingSettings.tsx):**
```tsx
// Add a new tab/section for transaction history
// Fetch ledger entries on tab click
// Display: date, action type, amount (+/-), balance after
// Pagination via nextKey
```

**Commit:** `feat(ui): add transaction history tab to billing settings`

---

### Fix 3.2: Reduce Polling Interval for Trial Users

**File:** `agency-app/web/src/contexts/SubscriptionContext.tsx`  
**Issue:** 5-minute polling too slow for trial users near expiry.

**Change:**
```typescript
// Dynamic polling interval: 1 min for trial users, 5 min for paid
const pollingInterval = subscription?.isTrialing ? 60 * 1000 : 5 * 60 * 1000;
```

**Commit:** `fix(ui): reduce polling interval for trial users to detect expiry faster`

---

### Fix 3.3: Add Grace Period Countdown in PaywallModal

**File:** `agency-app/web/src/components/PaywallModal.tsx`  
**Issue:** Doesn't show grace period remaining days.

**Add:**
```tsx
// If subscription.gracePeriodActive and gracePeriodEndsAt exists:
const graceDaysLeft = Math.ceil(
  (new Date(subscription.gracePeriodEndsAt).getTime() - Date.now()) / 86400000
);

// Show in main message:
{subscription.gracePeriodActive && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
    <p className="text-amber-800 font-medium">
      Your subscription entered a grace period. You have {graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} left to upgrade before features are suspended.
    </p>
  </div>
)}
```

**Commit:** `feat(ui): show grace period countdown in paywall modal`

---

### Fix 3.4: Add Subscription State Validation

**File:** `agency-app/api/subscriptionService.js`  
**Issue:** No validation for inconsistent state.

**Add:**
```javascript
/**
 * Validate subscription state consistency.
 * Returns array of issues found (empty = valid).
 */
export function validateSubscriptionState(sub) {
  const issues = [];

  if (!sub) return ['Subscription not found'];

  // isPaying should match paymentStatus
  if (sub.isPaying && sub.paymentStatus === 'trialing') {
    issues.push('isPaying=true but paymentStatus=trialing');
  }
  if (!sub.isPaying && sub.paymentStatus === 'active') {
    issues.push('isPaying=false but paymentStatus=active');
  }

  // gracePeriodActive requires gracePeriodEndsAt
  if (sub.gracePeriodActive && !sub.gracePeriodEndsAt) {
    issues.push('gracePeriodActive=true but gracePeriodEndsAt is null');
  }

  // seatsUsed should not exceed seatsPaid
  if (sub.seatsUsed > sub.seatsPaid) {
    issues.push(`seatsUsed (${sub.seatsUsed}) > seatsPaid (${sub.seatsPaid})`);
  }

  // trialEndsAt should be in future if trialing
  if (sub.paymentStatus === 'trialing' && sub.trialEndsAt) {
    if (new Date(sub.trialEndsAt) < new Date()) {
      issues.push('paymentStatus=trialing but trialEndsAt is in the past');
    }
  }

  return issues;
}
```

**Commit:** `feat(subscriptions): add subscription state validation utility`

---

### Fix 3.5: Add Audit Logging for Config Changes

**File:** `agency-app/api/creditConfig.js`  
**Lines:** 91-105  
**Issue:** No audit trail for config changes.

**Modify `updateConfig`:**
```javascript
export async function updateConfig(key, value, updatedBy = 'system') {
  if (!['FREE_TIER', 'PACKS', 'COSTS'].includes(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }

  // Fetch previous value for audit
  const existing = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { configKey: key },
  }));
  const previousValue = existing.Item?.value ?? null;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      configKey: key,
      value,
      updatedAt: new Date().toISOString(),
      updatedBy,
      previousValue, // Store for audit
    },
  }));
  clearConfigCache();

  logger.info('creditConfig.updated', {
    key,
    updatedBy,
    previousValue: previousValue ? '[changed]' : '[initial]',
    timestamp: new Date().toISOString(),
  });

  return value;
}
```

**Commit:** `feat(credits): add audit logging for credit config changes`

---

## Phase 4: CloudFormation & Schema Fixes (Week 4-6)

### Fix 4.1: Add PITR to Billing Tables

**File:** `agency-app/api/infra/cfn-backend.yaml`  
**Issue:** No PITR on Credits, CreditConfig, AIEmployeeProvisioning.

**Add to each billing table definition:**
```yaml
CreditsTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  UpdateReplacePolicy: Retain
  Properties:
    TableName: cloudberry-real-estate-credits
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    # ... existing config

CreditConfigTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  UpdateReplacePolicy: Retain
  Properties:
    TableName: cloudberry-real-estate-credit-config
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    # ... existing config

AiEmployeeProvisioningTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  UpdateReplacePolicy: Retain
  Properties:
    TableName: AIEmployeeProvisioning
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    # ... existing config
```

**Commit:** `fix(infra): enable PITR on all billing-critical DynamoDB tables`

---

### Fix 4.2: Add GSI to Subscriptions Table

**File:** `agency-app/api/infra/launch-tables-cfn.yaml` (or wherever Subscriptions table is defined)  
**Issue:** No GSI — trial reminder cron does full table scan.

**Add to Subscriptions table definition:**
```yaml
GlobalSecondaryIndexes:
  - IndexName: paymentStatus-createdAt-index
    KeySchema:
      - AttributeName: paymentStatus
        KeyType: HASH
      - AttributeName: createdAt
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
  - IndexName: isPaying-updatedAt-index
    KeySchema:
      - AttributeName: isPaying
        KeyType: HASH
      - AttributeName: updatedAt
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
```

**Then update `agency-app/api/scripts/trial-reminder-cron.js` to use GSI:**
```javascript
// Replace ScanCommand with QueryCommand on GSI
const result = await docClient.send(new QueryCommand({
  TableName: SUBSCRIPTIONS_TABLE,
  IndexName: 'paymentStatus-createdAt-index',
  KeyConditionExpression: 'paymentStatus = :status',
  ExpressionAttributeValues: { ':status': 'trialing' },
}));
```

**Commit:** `perf(infra): add GSI to Subscriptions table for efficient trial-status queries`

---

### Fix 4.3: Add GSI to WebhookLog Table

**File:** `agency-app/api/infra/launch-tables-cfn.yaml`  
**Issue:** No GSI — cannot query webhook history by tenant or event type.

**Add:**
```yaml
GlobalSecondaryIndexes:
  - IndexName: tenantId-processedAt-index
    KeySchema:
      - AttributeName: tenantId
        KeyType: HASH
      - AttributeName: processedAt
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
  - IndexName: eventType-processedAt-index
    KeySchema:
      - AttributeName: eventType
        KeyType: HASH
      - AttributeName: processedAt
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
```

**Commit:** `feat(infra): add GSI to WebhookLog for tenant and event type queries`

---

## Phase 5: Testing (Ongoing)

### Test 5.1: Unit Tests

**File:** `server/tests/subscriptionService.test.js` (NEW)
```javascript
import { validateSubscriptionState } from '../subscriptionService.js';

describe('validateSubscriptionState', () => {
  it('returns empty array for valid subscription', () => {
    const sub = { isPaying: true, paymentStatus: 'active', seatsUsed: 1, seatsPaid: 3 };
    expect(validateSubscriptionState(sub)).toEqual([]);
  });

  it('detects isPaying/paymentStatus mismatch', () => {
    const sub = { isPaying: true, paymentStatus: 'trialing' };
    expect(validateSubscriptionState(sub)).toContain('isPaying=true but paymentStatus=trialing');
  });

  it('detects seatsUsed > seatsPaid', () => {
    const sub = { isPaying: true, paymentStatus: 'active', seatsUsed: 5, seatsPaid: 3 };
    expect(validateSubscriptionState(sub)).toContain('seatsUsed (5) > seatsPaid (3)');
  });
});
```

### Test 5.2: Integration Tests

**File:** `server/tests/billing.webhook.test.js` (NEW)
```javascript
describe('Billing Webhook', () => {
  it('handles subscription.cancelled — updates Subscriptions table', async () => {
    // 1. Create test subscription with isPaying=true
    // 2. Send subscription.cancelled webhook
    // 3. Verify isPaying=false, paymentStatus=cancelled
  });

  it('handles subscription.updated downgrade — reduces seatsPaid', async () => {
    // 1. Create test subscription with seatsPaid=3
    // 2. Send subscription.updated with quantity=1, previousQuantity=3
    // 3. Verify seatsPaid=1
  });

  it('handles payment.failed — activates grace period', async () => {
    // 1. Create test subscription with isPaying=true
    // 2. Send payment.failed webhook
    // 3. Verify gracePeriodActive=true, gracePeriodEndsAt set
  });

  it('prevents duplicate credit reset on same day', async () => {
    // 1. Run credit-reset-cron
    // 2. Run again immediately
    // 3. Verify second run skips all tenants (ConditionalCheckFailedException)
  });
});
```

**Commit:** `test(billing): add unit and integration tests for billing fixes`

---

## Implementation Checklist

### Phase 1: Critical (Week 1)
- [ ] Fix 1.1: Add seat downgrade handler
- [ ] Fix 1.2: Update Subscriptions table on cancellation
- [ ] Fix 1.3: Implement grace period on payment failure
- [ ] Fix 1.4: Add grace period expiry cron
- [ ] Fix 1.5: Add idempotency lock to credit reset cron
- [ ] Fix 1.6: Make refund blocking in leads.js
- [ ] Fix 1.7: Fix Bailey webhook signature skip
- [ ] Fix 1.8: Add validation for Razorpay notes
- [ ] Fix 1.9: Add balance reconciliation utility

### Phase 2: High Priority (Week 2-3)
- [ ] Fix 2.1: Add rate limiting to billing webhook
- [ ] Fix 2.2: Add subscription.paused/resumed handlers
- [ ] Fix 2.3: Add credit amount validation (upper bound)
- [ ] Fix 2.4: Add credit admin endpoint validation
- [ ] Fix 2.5: Fix IP spoofing in rate limiter
- [ ] Fix 2.6: Fix billing anniversary day calculation
- [ ] Fix 2.7: Add per-tenant rate limiting
- [ ] Fix 2.8: Redact sensitive data in logs

### Phase 3: Medium Priority (Week 4-6)
- [ ] Fix 3.1: Add invoice/transaction history UI
- [ ] Fix 3.2: Reduce polling interval for trial users
- [ ] Fix 3.3: Add grace period countdown in PaywallModal
- [ ] Fix 3.4: Add subscription state validation
- [ ] Fix 3.5: Add audit logging for config changes

### Phase 4: CloudFormation (Week 4-6)
- [ ] Fix 4.1: Add PITR to billing tables
- [ ] Fix 4.2: Add GSI to Subscriptions table
- [ ] Fix 4.3: Add GSI to WebhookLog table

### Phase 5: Testing (Ongoing)
- [ ] Test 5.1: Unit tests for subscriptionService
- [ ] Test 5.2: Integration tests for billing webhook

---

## Deployment Notes

### Pre-Deployment
1. Create fix branch: `git checkout -b fix/billing-subscription-credits`
2. Deploy CloudFormation changes (Fix 4.1-4.3) FIRST — tables must exist before code changes
3. Run `npm run build` to verify no TypeScript errors

### Post-Deployment
1. Run credit balance reconciliation: `node agency-app/api/scripts/credit-balance-reconcile.js`
2. Verify webhook endpoint accepts requests: `curl -X POST <api-url>/api/billing/webhook -d '{}'`
3. Monitor CloudWatch for webhook processing errors
4. Run grace period expiry cron manually first time: `node agency-app/api/scripts/grace-period-expiry-cron.js`

### Rollback Plan
- Each fix is a separate commit — can revert individually
- CloudFormation changes use `DeletionPolicy: Retain` — tables won't be deleted on rollback
- Database schema changes are additive (new fields) — backward compatible

---

## Environment Variables to Add

Add to `agency-app/api/.env.example`:
```bash
# Grace period for failed payments (days)
GRACE_PERIOD_DAYS=7

# Brevo template IDs
BREVO_PAYMENT_FAILED_TEMPLATE_ID=4

# Credit purchase limits
MAX_CREDIT_PURCHASE=100000

# Credit cost limits
MAX_CREDIT_COST=1000
```

---

## Files Modified Summary

| File | Fixes | Phase |
|------|-------|-------|
| `agency-app/api/routes/billing.js` | 1.1, 1.2, 1.3, 1.8, 2.2 | 1, 2 |
| `agency-app/api/subscriptionService.js` | 1.2, 1.3, 3.4 | 1, 3 |
| `agency-app/api/scripts/credit-reset-cron.js` | 1.5, 2.6 | 1, 2 |
| `agency-app/api/scripts/grace-period-expiry-cron.js` | 1.4 (NEW) | 1 |
| `agency-app/api/scripts/credit-balance-reconcile.js` | 1.9 (NEW) | 1 |
| `agency-app/api/routes/leads.js` | 1.6 | 1 |
| `agency-app/api/bailey.js` | 1.7 | 1 |
| `agency-app/api/server.js` | 2.1 | 2 |
| `agency-app/api/routes/subscriptions.js` | 2.3 | 2 |
| `agency-app/api/routes/creditAdmin.js` | 2.4 | 2 |
| `agency-app/api/middleware/rateLimiter.js` | 2.5, 2.7 | 2 |
| `agency-app/api/logger.js` | 2.8 | 2 |
| `agency-app/api/creditConfig.js` | 3.5 | 3 |
| `agency-app/api/infra/cfn-backend.yaml` | 4.1 | 4 |
| `agency-app/api/infra/launch-tables-cfn.yaml` | 4.2, 4.3 | 4 |
| Frontend components | 3.1, 3.2, 3.3 | 3 |
| `agency-app/api/.env.example` | All env vars | All |

---

## Next Steps

1. **Review this plan** with the team
2. **Create fix branch**: `git checkout -b fix/billing-subscription-credits`
3. **Start with Phase 1** (Critical fixes) — implement in order
4. **Test each fix** before moving to the next
5. **Commit each fix** separately for easy rollback
6. **Deploy CloudFormation changes** (Phase 4) before code changes that depend on new GSIs
7. **Run reconciliation scripts** after deployment
