# Comprehensive Analysis: Billing, Subscription & Credits System

**Date:** 2026-06-22  
**Scope:** Frontend UI, Backend API, Database Schema, Security, Data Consistency  
**Analysis Method:** 5 specialized agents examined codebase in parallel

---

## Executive Summary

The billing, subscription, and credits system has **strong foundational architecture** (atomic transactions, HMAC verification, idempotency) but suffers from **critical gaps** in:

1. **Subscription State Management** - No cancellation updates, missing grace period, inconsistent state
2. **Seat Management** - No downgrade handler, race conditions in seat updates
3. **Credits System** - Race conditions in deductions, non-blocking refunds, missing reconciliation
4. **Data Consistency** - Orphaned records, schema inconsistencies, missing foreign keys
5. **Security** - Webhook retry logic issues, missing rate limiting, incomplete audit trail
6. **Frontend UX** - No real-time updates, missing invoice history, confusing messaging

**Overall Risk Level:** 🔴 HIGH - Critical issues could lead to revenue loss, data corruption, and security vulnerabilities.

---

## 🔴 CRITICAL ISSUES (Immediate Action Required)

### 1. Missing Seat Downgrade Handler
**Location:** `agency-app/api/routes/billing.js:331-356`  
**Severity:** CRITICAL  
**Impact:** Customer downgrades from 3 seats to 1 seat, but `seatsPaid` stays at 3. Incorrect seat limit enforcement, billing discrepancies.

**Current Code:**
```javascript
if (newQuantity > previousQuantity) {
  const seatsAdded = newQuantity - previousQuantity;
  await incrementSeatsPaid(tenantId, seatsAdded);
}
// ❌ Missing: else if (newQuantity < previousQuantity)
```

**Fix:**
```javascript
} else if (newQuantity < previousQuantity) {
  const seatsRemoved = previousQuantity - newQuantity;
  try {
    await decrementSeatsPaid(tenantId, seatsRemoved);
    await serverTrack(tenantId, 'seat_removed', {
      seatsRemoved,
      newTotal: newQuantity,
    });
  } catch (err) {
    logger.error('subscription.updated.downgrade.failed', { tenantId, error: err.message });
  }
}
```

---

### 2. No Grace Period Implementation
**Location:** `agency-app/api/subscriptionService.js:121`, `agency-app/api/routes/billing.js`  
**Severity:** CRITICAL  
**Impact:** Failed payments immediately suspend AI Employee. No customer recovery window. Churn risk.

**Current State:**
```javascript
gracePeriodActive: false,  // ❌ Always false, never updated
```

**Missing Logic:**
- No handler for `payment.failed` to activate grace period
- No cron to expire grace period after N days
- No feature access checks based on grace period status

**Fix:**
```javascript
// On payment.failed:
case 'payment.failed': {
  const subscription = await getSubscription(tenantId);
  if (subscription?.isPaying) {
    await updateSubscription(tenantId, {
      gracePeriodActive: true,
      gracePeriodEndsAt: new Date(Date.now() + 7*24*60*60*1000).toISOString()
    });
  }
}

// Grace period expiry cron:
if (sub.gracePeriodActive && new Date() > new Date(sub.gracePeriodEndsAt)) {
  await suspendProvisioning(tenantId, 'grace_period_expired');
}
```

---

### 3. No Subscription Cancellation in Subscriptions Table
**Location:** `agency-app/api/routes/billing.js:306-328`  
**Severity:** CRITICAL  
**Impact:** Subscriptions table shows `isPaying=true` even after cancellation. Trial-status endpoint returns incorrect value. Credit resets continue for cancelled subscriptions.

**Current Code:**
```javascript
case 'subscription.cancelled':
case 'subscription.halted': {
  await suspendProvisioning(tenantId, eventType);
  // ❌ Missing: Update Subscriptions table
}
```

**Fix:**
```javascript
await docClient.send(new UpdateCommand({
  TableName: 'Subscriptions',
  Key: { tenantId },
  UpdateExpression: 'SET isPaying = :false, paymentStatus = :status, cancelledAt = :now, updatedAt = :now',
  ExpressionAttributeValues: {
    ':false': false,
    ':status': eventType === 'subscription.cancelled' ? 'cancelled' : 'halted',
    ':now': new Date().toISOString(),
  },
}));
```

---

### 4. Webhook Retry Logic - Credits Could Be Lost
**Location:** `agency-app/api/routes/billing.js:363-368`  
**Severity:** CRITICAL  
**Impact:** If error occurs AFTER idempotency check but BEFORE credit grant, retry skips credit grant. Credits never granted.

**Scenario:**
1. Webhook received, idempotency check passes
2. Credit grant starts
3. Database connection fails mid-transaction
4. Returns 500
5. Razorpay retries
6. Idempotency check detects duplicate, returns 200
7. Credits never granted

**Fix:** Move idempotency check AFTER all operations:
```typescript
// Process webhook
// Then: await logEventIfNotProcessed(eventId, ...)
// This ensures duplicate detection happens after all side effects
```

---

### 5. Credit Reset Race Condition
**Location:** `agency-app/api/scripts/credit-reset-cron.js:85-101`  
**Severity:** CRITICAL  
**Impact:** If cron runs twice simultaneously (Lambda concurrency), both could pass the check. Credits doubled.

**Current Code:**
```javascript
if (!isDueForReset(sub, today)) {
  skipped++;
  continue;
}
// ❌ RACE CONDITION: Another cron instance could reset here
await resetMonthlyCredits(tenantId, allotment, 'monthly_reset');
```

**Fix:**
```javascript
UpdateExpression: 'SET lastCreditResetAt = :today, updatedAt = :now',
ConditionExpression: 'attribute_not_exists(lastCreditResetAt) OR lastCreditResetAt <> :today',
```

---

### 6. Balance vs Ledger Reconciliation Missing
**Location:** `agency-app/api/creditService.js:43-48`  
**Severity:** CRITICAL  
**Impact:** If BALANCE item is accidentally deleted, `getBalance()` returns 0 (silent failure). User cannot spend credits (data loss).

**Current Code:**
```javascript
return result.Item?.balance ?? 0;  // ❌ SILENT ZERO IF MISSING
```

**Fix:** Add reconciliation cron job:
```javascript
// Verify BALANCE item exists for all tenants
// Log warnings if BALANCE missing but LEDGER entries exist
// Implement recovery: rebuild BALANCE from latest LEDGER entry
```

---

### 7. Subscriptions Table in Wrong CloudFormation Stack
**Location:** `agency-app/api/infra/cfn-backend.yaml`, `agency-app/api/infra/launch-tables-cfn.yaml`  
**Severity:** CRITICAL  
**Impact:** Two separate CFN stacks must be deployed in correct order. Deployment fragility. Missing from main stack. No PITR on Credits table.

**Current State:**
- cfn-backend.yaml: References Subscriptions table (lines 1034, 1128, 1342, 1360, 1408, 1431, 1486)
- BUT it's NOT actually created in cfn-backend.yaml
- Only defined in `launch-tables-cfn.yaml` (separate stack)

**Fix:** Move Subscriptions table definition to cfn-backend.yaml. Add PITR to all billing-critical tables.

---

### 8. Case Sensitivity Mismatch (TenantId vs tenantId)
**Location:** `agency-app/api/agencyConfigService.js:42`  
**Severity:** CRITICAL  
**Impact:** AgencyConfigTable uses `TenantId` (PascalCase) but other tables use `tenantId` (camelCase). Query errors, type safety issues, maintenance burden.

**Evidence:**
- agencyConfigService.js line 42: `Key: { TenantId: tenantId }`
- subscriptionService.js line 20: `Key: { tenantId }`

**Fix:** Standardize all tables to use `tenantId` (camelCase). Update AgencyConfigTable schema.

---

### 9. Non-Blocking Refund - Credits Can Be Lost
**Location:** `agency-app/api/routes/leads.js:311-316`  
**Severity:** CRITICAL  
**Impact:** If lead creation fails after credit deduction, refund is attempted (non-blocking). If refund fails, credits are lost.

**Current Code:**
```javascript
refundCredits(req.tenantId, leadAddCost, 'lead_add', {
  ledgerId: creditCharge.ledgerId,
}).catch(refundErr => logger.error(...));  // ❌ Non-blocking
```

**Fix:** Make refund blocking:
```javascript
try {
  await refundCredits(...);
} catch (refundErr) {
  logger.error('leads.refund.failed', {...});
  return res.status(500).json({ error: 'Failed to refund credits' });
}
```

---

### 10. Bailey Webhook Signature Skipped in Dev
**Location:** `agency-app/api/bailey.js:239-240`  
**Severity:** CRITICAL  
**Impact:** In development, skips signature verification if `BAILEY_WEBHOOK_SECRET` is not set. Allows unauthenticated webhooks.

**Fix:** Never skip signature verification, even in dev. Use a test secret instead.

---

## 🟠 HIGH-PRIORITY ISSUES (Should Fix Soon)

### 11. No Rate Limiting on Billing Webhook
**Location:** `agency-app/api/routes/billing.js`  
**Severity:** HIGH  
**Impact:** Could be abused to trigger credit grants or spam processing.

**Fix:**
```typescript
app.use('/api/billing', webhookRateLimit, billingRoutes);
```

---

### 12. No Validation for Razorpay Notes
**Location:** `agency-app/api/routes/billing.js:139-144`  
**Severity:** HIGH  
**Impact:** If Razorpay notes are malformed, `tenantId` becomes undefined, provisioning fails silently.

**Fix:**
```javascript
if (!tenantId) {
  logger.error('subscription.activated.missing_tenantId', { notes });
  return res.status(400).json({ error: 'missing_tenant_id' });
}
```

---

### 13. Missing `subscription.paused` and `subscription.resumed` Handlers
**Location:** `agency-app/api/routes/billing.js:131-361`  
**Severity:** HIGH  
**Impact:** If customer pauses/resumes subscription, system doesn't know. Continues charging or remains in paused state.

**Fix:** Add handlers for `subscription.paused` and `subscription.resumed`.

---

### 14. No Validation of Credit Amount
**Location:** `agency-app/api/routes/subscriptions.js:154-169`  
**Severity:** HIGH  
**Impact:** User could request 0 credits or negative credits.

**Fix:**
```javascript
if (!credits || credits <= 0 || credits > 1000000) {
  return res.status(400).json({ error: 'invalid_credit_amount' });
}
```

---

### 15. No Credit Admin Endpoint Input Validation
**Location:** `agency-app/api/routes/creditAdmin.js:24-42`  
**Severity:** HIGH  
**Impact:** Allows adding arbitrary new action types. No upper bound on cost values. Could set `lead_add: 1000000` to block feature.

**Fix:**
```javascript
const VALID_KEYS = ['lead_add', 'contact_add', 'property_add', ...];
for (const key of Object.keys(value)) {
  if (!VALID_KEYS.includes(key)) {
    throw new Error(`Invalid action type: ${key}`);
  }
}
```

---

### 16. No Rate Limiting on Credit-Charging Routes
**Location:** Multiple routes (leads.js, crm.js, khata.js)  
**Severity:** HIGH  
**Impact:** Attacker could create 1000 leads in rapid succession. Each deducts 10 credits → 10,000 credits consumed in seconds.

**Fix:** Add per-user rate limiting on credit-charging endpoints.

---

### 17. IP Spoofing via X-Forwarded-For
**Location:** `agency-app/api/middleware/rateLimiter.js`  
**Severity:** HIGH  
**Impact:** Rate limiting can be bypassed by spoofing X-Forwarded-For header.

**Fix:** Validate X-Forwarded-For header or use API Gateway IP.

---

### 18. Billing Anniversary Day Calculation Bug
**Location:** `agency-app/api/routes/billing.js:203`  
**Severity:** HIGH  
**Impact:** Uses `getUTCDate()` which returns 1-31, but doesn't handle month-end edge cases. Credit reset fails on Feb 28/29 for customers with anniversary on 31st.

**Fix:** Use day-of-month with month-end handling.

---

### 19. No PITR on Credits/AIEmployeeProvisioning Tables
**Location:** `agency-app/api/infra/cfn-backend.yaml`  
**Severity:** HIGH  
**Impact:** Critical billing data not protected. No point-in-time recovery.

**Fix:** Add PITR to all billing-critical tables.

---

### 20. Missing GSI on Subscriptions Table
**Location:** `agency-app/api/infra/cfn-backend.yaml`  
**Severity:** HIGH  
**Impact:** Trial reminder cron does full table SCAN. Cannot query by `paymentStatus`, `isPaying`, or `createdAt`.

**Fix:** Add GSI for `paymentStatus-createdAt` and `isPaying-updatedAt`.

---

## 🟡 MEDIUM-PRIORITY ISSUES (Should Address)

### 21. No Invoice/Receipt History in UI
**Location:** Frontend  
**Severity:** MEDIUM  
**Impact:** Users cannot view past invoices. Backend ledger API exists but no UI.

**Fix:** Add "Transaction History" tab to BillingSettings.

---

### 22. No Real-Time Subscription Updates
**Location:** Frontend polling (5-minute intervals)  
**Severity:** MEDIUM  
**Impact:** Subscription changes only visible after 5-minute delay. User can continue using features after expiry.

**Fix:** Implement WebSocket or reduce polling to 1 minute for trial users.

---

### 23. Plan Downgrade Not Implemented in UI
**Location:** Frontend  
**Severity:** MEDIUM  
**Impact:** Users must contact support to downgrade. Backend supports via Razorpay webhook.

**Fix:** Add "Downgrade plan" button for paid users.

---

### 24. No Schema Validation
**Location:** `agency-app/api/routes/subscriptions.js`, `agency-app/api/routes/billing.js`  
**Severity:** MEDIUM  
**Impact:** Uses ad-hoc validation instead of JSON schema. No length limits on strings.

**Fix:** Use JSON Schema or Zod for input validation.

---

### 25. No Foreign Key Relationships
**Location:** Database schema  
**Severity:** MEDIUM  
**Impact:** Can create Credits for non-existent tenantId. Subscription can be deleted while Credits remain. Orphaned records possible.

**Fix:** Add validation in services to check tenant existence before creating records.

---

### 26. Subscription State Inconsistency
**Location:** `agency-app/api/subscriptionService.js`  
**Severity:** MEDIUM  
**Impact:** Subscriptions table can be in inconsistent state (isPaying=true but paymentStatus='cancelled', etc.)

**Fix:** Add validation function to check subscription state consistency.

---

### 27. Seat Count Synchronization Failures
**Location:** `agency-app/api/subscriptionService.js:68-97`  
**Severity:** MEDIUM  
**Impact:** Auth service unavailability causes fallback to stale data. False positive paywalls.

**Fix:** Add retry logic with exponential backoff. Cache auth service response with short TTL.

---

### 28. No Audit Trail for Config Changes
**Location:** `agency-app/api/creditConfig.js:91-105`  
**Severity:** MEDIUM  
**Impact:** No logging of who changed the config. No timestamp of when change was made. No previous value stored.

**Fix:** Add audit logging for config changes.

---

### 29. No Distributed Rate Limiting
**Location:** `agency-app/api/middleware/rateLimiter.js`  
**Severity:** MEDIUM  
**Impact:** In-memory storage. Rate limits lost on server restart. Multiple server instances won't share limits.

**Fix:** Implement distributed rate limiting using DynamoDB or Redis.

---

### 30. No Grace Period Countdown in UI
**Location:** Frontend  
**Severity:** MEDIUM  
**Impact:** PaywallModal says "Your trial has ended" but doesn't show grace period clearly. Users don't know they have 7 days to upgrade.

**Fix:** Show "7 days to upgrade" in main message.

---

### 31. Credit Balance Ambiguity in UI
**Location:** Frontend  
**Severity:** MEDIUM  
**Impact:** "Credits remaining" could mean monthly allotment or total balance. Confusing for users.

**Fix:** Clarify "Monthly credits" vs "One-time credits".

---

### 32. No Handling for Partial Payment Failures
**Location:** `agency-app/api/routes/billing.js:294-303`  
**Severity:** MEDIUM  
**Impact:** `payment.failed` only logs to PostHog, doesn't update subscription state. Subscription remains in `active` state.

**Fix:** Implement grace period on payment failure.

---

### 33. No Per-Tenant Rate Limiting
**Location:** `agency-app/api/middleware/rateLimiter.js`  
**Severity:** MEDIUM  
**Impact:** Could allow one tenant to DoS others.

**Fix:** Add per-tenant rate limiting.

---

### 34. Incomplete Redaction in Logs
**Location:** `agency-app/api/logger.js`  
**Severity:** MEDIUM  
**Impact:** Doesn't redact `razorpayPaymentId`, `razorpayOrderId`, `amountPaise`. Phone numbers, emails logged in plaintext.

**Fix:** Update logger to redact payment IDs, amounts, PII.

---

### 35. No Circuit Breaker for External Services
**Location:** `agency-app/api/routes/billing.js`  
**Severity:** MEDIUM  
**Impact:** If email service is down, every webhook tries and fails. No fallback mechanism.

**Fix:** Implement circuit breaker for external service calls.

---

### 36. No Alerting for Critical Failures
**Location:** Multiple files  
**Severity:** MEDIUM  
**Impact:** Critical failures (e.g., provisioning failed) only logged. No monitoring or alerting.

**Fix:** Add CloudWatch metrics and alerts for webhook success rate, credit operations.

---

### 37. DPDP Compliance Gaps
**Location:** `agency-app/api/routes/auth.js`  
**Severity:** MEDIUM  
**Impact:** No consent withdrawal mechanism. No consent audit trail. No consent version tracking. No consent for billing operations.

**Fix:** Add DPDP compliance features: consent withdrawal, audit trail, data export.

---

### 38. No Ledger Query Endpoints
**Location:** Backend  
**Severity:** MEDIUM  
**Impact:** No API to query ledger by tenant or action type. Cannot audit credit usage.

**Fix:** Add `/api/credits/ledger` and `/api/credits/analytics` endpoints.

---

### 39. No Credit Usage Analytics
**Location:** Frontend  
**Severity:** MEDIUM  
**Impact:** CreditBalanceCard shows monthly usage but no breakdown by feature (AI calls, WhatsApp, etc.)

**Fix:** Add detailed usage dashboard.

---

### 40. Trial Email Template IDs Not Configured
**Location:** `agency-app/api/scripts/trial-reminder-cron.js:29-46`  
**Severity:** MEDIUM  
**Impact:** All template IDs are `null`, so emails won't send.

**Fix:** Configure Brevo template IDs in `.env`.

---

## 🟢 LOW-PRIORITY ISSUES (Polish)

### 41. No Webhook Processing Time Metrics
**Location:** `agency-app/api/routes/billing.js`  
**Severity:** LOW  
**Impact:** No performance metrics for webhook processing.

**Fix:** Add timing logs.

---

### 42. No Handling for Subscription Quantity = 0
**Location:** `agency-app/api/routes/billing.js:334-355`  
**Severity:** LOW  
**Impact:** Subscription with 0 seats might be created.

**Fix:** Add validation for quantity > 0.

---

### 43. Mobile Responsiveness Issues
**Location:** Frontend modals  
**Severity:** LOW  
**Impact:** BuyCreditsModal has no responsive breakpoints. May overflow on small screens.

**Fix:** Add responsive breakpoints.

---

### 44. No Loading States in Billing UI
**Location:** Frontend  
**Severity:** LOW  
**Impact:** Shows "Loading subscription..." (generic). Doesn't indicate which data is loading.

**Fix:** Show skeleton loaders for each section.

---

### 45. No Retry Buttons on Error
**Location:** Frontend  
**Severity:** LOW  
**Impact:** Error message shown, no retry button. User must manually refresh page.

**Fix:** Add "Retry" button on error states.

---

### 46. No Billing Address Collection
**Location:** Frontend  
**Severity:** LOW  
**Impact:** No billing address collection. GST invoices require address.

**Fix:** Add address form to PaywallModal.

---

### 47. No Payment Method Management
**Location:** Frontend  
**Severity:** LOW  
**Impact:** No UI to change payment method. User must update in Razorpay dashboard.

**Fix:** Link to Razorpay customer portal.

---

### 48. No Subscription Pause/Resume Option
**Location:** Frontend  
**Severity:** LOW  
**Impact:** No pause option for temporary suspension.

**Fix:** Add pause button for temporary suspension.

---

### 49. No Seat Management Dashboard
**Location:** Frontend  
**Severity:** LOW  
**Impact:** Only shows "Seats used / Seats paid". No UI to remove seats.

**Fix:** Add seat management dashboard for admins.

---

### 50. AI Employee Pricing Confusion
**Location:** Frontend  
**Severity:** LOW  
**Impact:** ₹7,999/mo add-on shown in checkbox, but not in plan pricing. Users don't know total cost.

**Fix:** Show total monthly cost after selecting AI.

---

## Security Summary

### ✅ Strong Security Practices
1. Timing-safe HMAC comparison for webhooks
2. Replay attack prevention with timestamp validation (5-min window)
3. Atomic idempotency with DynamoDB conditions
4. Tenant isolation via `extractTenantId` middleware
5. Role-based access control on sensitive endpoints
6. JWT validation via auth microservice

### ⚠️ Security Gaps
1. No rate limiting on billing webhook endpoint
2. Webhook signature logged in plaintext
3. IP spoofing via X-Forwarded-For
4. No distributed rate limiting
5. No audit logging for subscription changes
6. DPDP compliance gaps (consent withdrawal, audit trail)
7. Bailey webhook signature skipped in dev
8. No validation of webhook secret at startup

### 🔐 Security Recommendations
1. Add rate limiting to billing webhook
2. Redact sensitive data from logs (payment IDs, amounts, PII)
3. Validate X-Forwarded-For header or use API Gateway IP
4. Implement distributed rate limiting
5. Add audit logging for all subscription changes
6. Implement DPDP compliance features
7. Never skip signature verification, even in dev
8. Validate all secrets at startup

---

## Data Consistency Summary

### ❌ Critical Data Integrity Issues
1. Orphaned provisioning rows (if create succeeds but activate fails)
2. Inconsistent subscription state (isPaying vs paymentStatus contradictions)
3. Credit balance underflow (mitigated by ConditionExpression)
4. No foreign key constraints (orphaned records possible)
5. No consistency between Subscriptions and AgencyConfig
6. No ledger balance reconciliation mechanism

### ✅ Data Integrity Strengths
1. Atomic operations with DynamoDB transactions
2. Condition expressions prevent race conditions
3. TTL on ledger entries (12 months)
4. Idempotency checks for webhooks

### 🔧 Data Consistency Recommendations
1. Add validation function for subscription state consistency
2. Implement balance reconciliation cron job
3. Add foreign key validation before operations
4. Implement audit trail for subscription changes
5. Add consistency checks in cron jobs

---

## CloudFormation Summary

### ❌ CloudFormation Misconfigurations
1. Subscriptions table in wrong stack (launch-tables-cfn.yaml instead of cfn-backend.yaml)
2. Missing PITR on Credits, CreditConfig, AIEmployeeProvisioning tables
3. Missing GSI on Subscriptions (paymentStatus-createdAt, isPaying-updatedAt)
4. Missing GSI on WebhookLog (tenantId-processedAt, eventType-processedAt)
5. Missing GSI on Credits (createdAt for time-range queries)
6. Case mismatch in AgencyConfig (TenantId vs tenantId)

### 🔧 CloudFormation Recommendations
1. Move Subscriptions table to cfn-backend.yaml
2. Add PITR to all billing-critical tables
3. Add GSI to Subscriptions, WebhookLog, Credits tables
4. Standardize all PKs to camelCase (tenantId)
5. Add missing IAM permissions for cross-table transactions

---

## Performance Summary

### ⚠️ Performance Bottlenecks
1. Redundant GetCommand before TransactWriteCommand (deductCredits)
2. Full table scan in monthly reset cron (listAllSubscriptions)
3. Full table scan in trial reminder cron
4. Full table scan in agency config scan
5. 5-minute polling interval (not real-time)
6. No caching strategy beyond context

### 🔧 Performance Recommendations
1. Remove redundant pre-check in deductCredits
2. Add GSI for efficient queries (replace Scans)
3. Implement WebSocket or reduce polling to 1 minute
4. Implement cache with stale-while-revalidate pattern
5. Memoize expensive UI components

---

## Testing Recommendations

### Unit Tests Needed
- subscriptionService.test.js (createTrialSubscription, incrementSeatsPaid, decrementSeatsPaid)
- billing.test.js (webhook signature verification, idempotency, timestamp validation)
- creditService.test.js (grantCredits, deductCredits, resetMonthlyCredits)
- creditConfig.test.js (updateConfig validation)

### Integration Tests Needed
- Full subscription lifecycle (Trial → Paid → Cancelled)
- Upgrade/Downgrade (1 seat → 3 seats → 1 seat)
- Payment failure → Grace period → Reactivation
- Credit purchase → Grant → Deduction
- Webhook retry scenarios

### Load Tests Needed
- Concurrent webhook events
- Concurrent trial subscription creation
- Credit deduction under high load
- Monthly reset cron under load

---

## Action Plan

### Phase 1: Immediate (Week 1) - Critical Fixes
1. ✅ Add seat downgrade handler (Issue #1)
2. ✅ Implement grace period logic (Issue #2)
3. ✅ Update Subscriptions table on cancellation (Issue #3)
4. ✅ Fix webhook retry logic (Issue #4)
5. ✅ Add idempotency lock to credit reset (Issue #5)
6. ✅ Add balance reconciliation check (Issue #6)
7. ✅ Make refund blocking (Issue #9)
8. ✅ Fix Bailey webhook signature (Issue #10)

### Phase 2: Short-term (Week 2-3) - High Priority
9. ✅ Add rate limiting to billing webhook (Issue #11)
10. ✅ Add validation for Razorpay notes (Issue #12)
11. ✅ Add subscription.paused/resumed handlers (Issue #13)
12. ✅ Add credit amount validation (Issue #14)
13. ✅ Add credit admin endpoint validation (Issue #15)
14. ✅ Add rate limiting to credit-charging routes (Issue #16)
15. ✅ Fix IP spoofing in rate limiter (Issue #17)
16. ✅ Fix billing anniversary day calculation (Issue #18)
17. ✅ Add PITR to billing tables (Issue #19)
18. ✅ Add GSI to Subscriptions table (Issue #20)

### Phase 3: Medium-term (Week 4-6) - Medium Priority
19. ✅ Add invoice history UI (Issue #21)
20. ✅ Implement real-time updates (Issue #22)
21. ✅ Add plan downgrade UI (Issue #23)
22. ✅ Add schema validation (Issue #24)
23. ✅ Add foreign key validation (Issue #25)
24. ✅ Add subscription state validation (Issue #26)
25. ✅ Fix seat count sync (Issue #27)
26. ✅ Add audit logging for config changes (Issue #28)
27. ✅ Implement distributed rate limiting (Issue #29)
28. ✅ Show grace period countdown (Issue #30)
29. ✅ Clarify credit balance UI (Issue #31)
30. ✅ Implement grace period on payment failure (Issue #32)
31. ✅ Add per-tenant rate limiting (Issue #33)
32. ✅ Redact sensitive data from logs (Issue #34)
33. ✅ Implement circuit breaker (Issue #35)
34. ✅ Add monitoring/alerting (Issue #36)
35. ✅ Add DPDP compliance features (Issue #37)
36. ✅ Add ledger query endpoints (Issue #38)
37. ✅ Add credit usage analytics (Issue #39)
38. ✅ Configure Brevo email templates (Issue #40)

### Phase 4: Long-term (Month 2+) - Low Priority & Polish
39. ✅ Add webhook processing time metrics (Issue #41)
40. ✅ Add subscription quantity validation (Issue #42)
41. ✅ Fix mobile responsiveness (Issue #43)
42. ✅ Add loading states (Issue #44)
43. ✅ Add retry buttons (Issue #45)
44. ✅ Add billing address collection (Issue #46)
45. ✅ Add payment method management (Issue #47)
46. ✅ Add pause/resume option (Issue #48)
47. ✅ Add seat management dashboard (Issue #49)
48. ✅ Clarify AI Employee pricing (Issue #50)
49. ✅ Move Subscriptions table to cfn-backend.yaml (Issue #7)
50. ✅ Standardize PK case (Issue #8)

---

## Key Files Requiring Changes

| File | Issues | Severity |
|------|--------|----------|
| `agency-app/api/routes/billing.js` | #1, #2, #3, #4, #11, #12, #13, #18, #32, #41, #42 | 🔴🟠🟡🟢 |
| `agency-app/api/subscriptionService.js` | #2, #26, #27 | 🔴🟡 |
| `agency-app/api/creditService.js` | #5, #6 | 🔴 |
| `agency-app/api/routes/subscriptions.js` | #14 | 🟠 |
| `agency-app/api/routes/creditAdmin.js` | #15 | 🟠 |
| `agency-app/api/middleware/rateLimiter.js` | #16, #17, #29, #33 | 🟠🟡 |
| `agency-app/api/infra/cfn-backend.yaml` | #7, #8, #19, #20 | 🔴🟠 |
| `agency-app/api/routes/leads.js` | #9 | 🔴 |
| `agency-app/api/bailey.js` | #10 | 🔴 |
| `agency-app/api/creditConfig.js` | #28 | 🟡 |
| `agency-app/api/logger.js` | #34 | 🟡 |
| `agency-app/api/routes/auth.js` | #37 | 🟡 |
| `agency-app/api/scripts/credit-reset-cron.js` | #5 | 🔴 |
| `agency-app/api/scripts/trial-reminder-cron.js` | #40 | 🟡 |
| Frontend components | #21, #22, #23, #30, #31, #43, #44, #45, #46, #47, #48, #49, #50 | 🟡🟢 |

---

## Conclusion

The billing, subscription, and credits system has **strong foundational architecture** but suffers from **critical gaps** that could lead to:

- **Revenue loss** (seat downgrades not handled, credits lost on webhook failures)
- **Data corruption** (race conditions in credit reset, balance reconciliation missing)
- **Security vulnerabilities** (webhook retry logic, missing rate limiting)
- **User experience issues** (no real-time updates, confusing messaging, missing features)

**Priority:** Fix all 🔴 CRITICAL issues (1-10) immediately before handling production traffic. Address 🟠 HIGH issues (11-20) within 2 weeks. Plan 🟡 MEDIUM issues (21-40) for the next sprint.

**Estimated Effort:**
- Phase 1 (Critical): 40 hours
- Phase 2 (High): 60 hours
- Phase 3 (Medium): 80 hours
- Phase 4 (Low): 40 hours

**Total Estimated Effort:** 220 hours (~5-6 weeks with 1 developer)

---

**Analysis completed by:** 5 specialized subagents (Billing Backend, Frontend UI, Credits System, Security, Data Consistency)  
**Analysis date:** 2026-06-22  
**Next steps:** Review this analysis with the team, prioritize issues based on business impact, and create detailed implementation tickets for Phase 1.
