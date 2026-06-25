# Payment & Subscription System Documentation

## Overview

RealityFlow has a **complete payment and subscription system** built on:
- **Razorpay** for payment processing (subscriptions + one-time payments)
- **DynamoDB** for subscription state management
- **Brevo** for transactional emails
- **AiSensy** for WhatsApp notifications
- **Trial system** with 14-day default period
- **Seat-based pricing** (Solo, Team, Team+)

---

## Architecture

### System Components

```
Frontend (React)
    ↓
PaywallModal / SeatUpgradeModal (UI)
    ↓
Razorpay Checkout (Payment Gateway)
    ↓
Backend (Node.js/Express)
    ↓
Billing Webhook Handler
    ↓
DynamoDB (Subscriptions Table)
    ↓
Brevo (Email) + AiSensy (WhatsApp)
```

---

## Backend Implementation

### 1. **Subscription Service** (`server/subscriptionService.js`)

Core subscription management functions:

| Function | Purpose |
|----------|---------|
| `getSubscription(tenantId)` | Fetch subscription record from DynamoDB |
| `incrementSeatsPaid(tenantId, by)` | Increase paid seats (called on upgrade) |
| `decrementSeatsPaid(tenantId, by)` | Decrease paid seats (on downgrade) |
| `recomputeSeatsUsed(tenantId)` | Count active members via auth service |
| `createTrialSubscription(tenantId, plan)` | Create trial subscription for new tenant |
| `setConsentSignedAt(tenantId)` | Record DPDP consent timestamp |
| `updateSeatsUsed(tenantId, seatsUsed)` | Update member count |

**Subscription Record Schema:**
```javascript
{
  tenantId: string,                    // Primary key
  plan: 'solo' | 'team' | 'teamplus',  // Current plan
  seatsPaid: number,                   // Purchased seats (1, 3, 10)
  seatsUsed: number,                   // Active members
  trialEndsAt: ISO8601,                // Trial expiry timestamp
  isPaying: boolean,                   // True if subscription active
  gracePeriodActive: boolean,          // True during 7-day grace
  paymentStatus: string,               // 'trialing' | 'active' | 'expired'
  razorpaySubscriptionId: string,      // Razorpay subscription ID
  nextBillingDate: ISO8601,            // Next charge date
  consentSignedAt: ISO8601,            // DPDP consent timestamp
  createdAt: ISO8601,
  updatedAt: ISO8601
}
```

### 2. **Billing Webhook** (`server/routes/billing.js`)

Handles all Razorpay events with **HMAC signature verification** and **replay attack protection**:

**Security Features:**
- ✅ HMAC-SHA256 signature validation
- ✅ Constant-time comparison (timing-safe)
- ✅ 5-minute timestamp validation (prevents replay)
- ✅ Atomic idempotency check (no duplicate processing)

**Handled Events:**

| Event | Action |
|-------|--------|
| `subscription.activated` | Create AI Employee provisioning row, send Brevo email, AiSensy broadcast |
| `subscription.charged` | Track subscription invoice + payment via PostHog |
| `payment.captured` | Track successful payment |
| `payment.failed` | Track failed payment |
| `subscription.updated` | Increment seats if tier upgraded |
| `subscription.paused` | Mark subscription as paused |
| `subscription.cancelled` | Mark subscription as cancelled |

**Webhook Flow:**
```
1. Receive raw body + signature
2. Parse JSON
3. Verify HMAC signature (constant-time)
4. Check timestamp (< 5 minutes old)
5. Check idempotency (event_id not processed)
6. Route to handler
7. Send transactional emails (Brevo)
8. Send WhatsApp notifications (AiSensy)
9. Track events (PostHog)
10. Return 200 OK
```

### 3. **Subscriptions API** (`server/routes/subscriptions.js`)

**Endpoints:**

#### `GET /api/subscriptions/current`
Returns full subscription object.
```javascript
{
  plan: 'team',
  seatsPaid: 3,
  seatsUsed: 2,
  trialEndsAt: '2026-07-04T10:30:00Z',
  isPaying: false,
  isTrialing: true,
  isTrialExpired: false,
  gracePeriodActive: false,
  paymentStatus: 'trialing'
}
```

#### `GET /api/subscriptions/trial-status`
Returns trial-specific fields + auto-creates trial if missing.
```javascript
{
  trialDaysLeft: 7,
  trialEndsAt: '2026-07-04T10:30:00Z',
  plan: 'solo',
  isPaying: false,
  isTrialing: true,
  isTrialExpired: false,
  gracePeriodActive: false,
  paymentStatus: 'trialing'
}
```

#### `POST /api/subscriptions/check-seat`
Pre-invite seat availability check. Returns 402 Payment Required if limit hit.
```javascript
// Success (can invite)
{
  canInvite: true,
  seatsUsed: 2,
  seatsPaid: 3,
  plan: 'team'
}

// Failure (paywall)
{
  error: 'paywall_seat_limit',
  currentSeats: 3,
  paidSeats: 3,
  tier: 'team',
  upgradeOptions: [
    {
      planId: 'plan_add_seat',
      label: 'Add 1 seat — ₹500/mo',
      price: 500
    }
  ]
}
```

### 4. **Auth Post-Registration Hook** (`server/routes/auth.js`)

Called after Cognito signup:
1. Create trial subscription (14 days)
2. Record DPDP consent
3. Add user to Brevo "Trial Signups" list
4. Track signup event in PostHog

---

## Frontend Implementation

### 1. **Subscription Context** (`real-estate-crm-app/src/contexts/SubscriptionContext.tsx`)

Provides subscription state globally:
```typescript
interface SubscriptionContextValue {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  refetch: () => void;
  isPaying: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
}
```

**Behavior:**
- Fetches `/api/subscriptions/trial-status` on mount
- Polls every 5 minutes
- Gracefully handles missing subscription (returns defaults)

### 2. **useSubscription Hook** (`real-estate-crm-app/src/hooks/useSubscription.ts`)

Simple wrapper around SubscriptionContext:
```typescript
const { isPaying, isTrialing, trialDaysLeft, isTrialExpired, refetch } = useSubscription();
```

### 3. **Paywall Modal** (`real-estate-crm-app/src/components/PaywallModal.tsx`)

**Triggers when:**
- Trial expired AND
- Not paying AND
- Grace period not active AND
- Not on whitelisted pages (`/profile`, `/billing`, `/legal`, `/grievance`, `/integrations/ai-employee`)

**Features:**
- 3-tier pricing display (Solo ₹999, Team ₹1,999, Team+ ₹4,999)
- Monthly/Annual toggle (20% discount)
- AI Employee add-on (₹7,999/mo)
- Razorpay checkout integration
- FAQ section

**Pricing Tiers:**
```javascript
{
  id: 'solo',
  name: 'Solo',
  monthly: 999,
  features: ['1 member', 'Unlimited properties', 'Full CRM + Khata', 'GST invoicing', 'Free onboarding'],
  popular: false
},
{
  id: 'team',
  name: 'Team',
  monthly: 1999,
  features: ['Up to 3 members', 'Everything in Solo', 'Multi-agent hierarchy', 'Shared Khata', 'Member reports'],
  popular: true
},
{
  id: 'teamplus',
  name: 'Team+',
  monthly: 4999,
  features: ['Up to 10 members', 'Everything in Team', 'Dedicated CSM', 'Priority support', 'Custom onboarding'],
  popular: false
}
```

### 4. **Seat Upgrade Modal** (`real-estate-crm-app/src/components/SeatUpgradeModal.tsx`)

Triggered when user tries to invite but seat limit reached (402 response).

**Messages:**
- Solo: "Upgrade to Team for 3 seats — ₹1,999/month"
- Team: "Add seats at ₹500/month (prorated)"

### 5. **Razorpay Integration** (`real-estate-crm-app/src/lib/razorpay.ts`)

```typescript
export async function loadRazorpay(): Promise<void>
export async function openCheckout(opts: CheckoutOptions): Promise<void>
```

**Checkout Flow:**
1. Load Razorpay script
2. Create Razorpay instance with plan ID
3. Open checkout modal
4. On success: refetch subscription + close modal
5. On failure/dismiss: reset loading state

---

## Database Schema

### DynamoDB Table: `Subscriptions`

**Partition Key:** `tenantId` (String)

**Attributes:**
- `tenantId` (String, PK)
- `plan` (String) - 'solo', 'team', 'teamplus'
- `seatsPaid` (Number) - 1, 3, 10
- `seatsUsed` (Number) - Active member count
- `trialEndsAt` (String, ISO8601)
- `isPaying` (Boolean)
- `gracePeriodActive` (Boolean)
- `paymentStatus` (String) - 'trialing', 'active', 'expired', 'paused', 'cancelled'
- `razorpaySubscriptionId` (String)
- `nextBillingDate` (String, ISO8601)
- `consentSignedAt` (String, ISO8601)
- `createdAt` (String, ISO8601)
- `updatedAt` (String, ISO8601)

---

## Razorpay Configuration

### Environment Variables

```bash
# Razorpay
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
RAZORPAY_PLAN_AI_EMPLOYEE=plan_test_ai_employee

# Trial
TRIAL_DAYS=14

# Brevo (Email)
BREVO_API_KEY=your-brevo-api-key
BREVO_TRIAL_LIST_ID=1
BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID=1
BREVO_AI_EMPLOYEE_ESCALATED_FOUNDER_TEMPLATE_ID=2
BREVO_AI_EMPLOYEE_ESCALATED_CUSTOMER_TEMPLATE_ID=3
BREVO_FROM_EMAIL=no-reply@realestateflow.in
BREVO_FROM_NAME=RealEstateFlow
BREVO_SENDER_EMAIL=noreply@realestateflow.in

# AiSensy (WhatsApp)
AISENSY_API_KEY=your-aisensy-api-key

# Frontend
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
```

### Razorpay Plans

| Plan ID | Name | Price | Seats | Billing |
|---------|------|-------|-------|---------|
| `plan_solo_monthly` | Solo | ₹999 | 1 | Monthly |
| `plan_solo_annual` | Solo | ₹9,590 | 1 | Annual |
| `plan_team_monthly` | Team | ₹1,999 | 3 | Monthly |
| `plan_team_annual` | Team | ₹19,190 | 3 | Annual |
| `plan_teamplus_monthly` | Team+ | ₹4,999 | 10 | Monthly |
| `plan_teamplus_annual` | Team+ | ₹47,990 | 10 | Annual |
| `plan_add_seat` | Add Seat | ₹500 | 1 | Monthly |
| `plan_ai_employee_monthly` | AI Employee | ₹7,999 | N/A | Monthly |

---

## Payment Flow

### New User Signup → Trial

```
1. User signs up via Cognito
2. Frontend calls POST /auth/post-registration
3. Backend creates trial subscription (14 days)
4. Frontend shows countdown in UI
5. User gets 14 days free access
```

### Trial Expiry → Paywall

```
1. Trial ends
2. Frontend fetches /subscriptions/trial-status
3. isTrialExpired = true
4. PaywallModal renders
5. User clicks tier
6. Razorpay checkout opens
7. User enters payment details
8. Razorpay processes payment
9. Webhook received: subscription.activated
10. Backend updates subscription (isPaying = true)
11. Frontend refetches subscription
12. Paywall closes, user has access
```

### Invite Team Member → Seat Check

```
1. User clicks "Invite Member"
2. Frontend calls POST /subscriptions/check-seat
3. Backend counts active members (seatsUsed)
4. If seatsUsed >= seatsPaid:
   - Return 402 with upgradeOptions
   - Frontend shows SeatUpgradeModal
5. Else:
   - Return 200, allow invite
```

### Upgrade Plan

```
1. User clicks upgrade in SeatUpgradeModal
2. Frontend opens Razorpay checkout with new plan
3. User pays
4. Webhook: subscription.updated
5. Backend increments seatsPaid
6. Frontend refetches subscription
7. User can now invite more members
```

---

## AI Employee Provisioning

### Workflow

```
1. User adds AI Employee (₹7,999/mo) during checkout
2. Razorpay processes payment
3. Webhook: subscription.activated (planId = RAZORPAY_PLAN_AI_EMPLOYEE)
4. Backend extracts tenant info from subscription notes
5. Creates provisioning row in AiEmployeeProvisioning table
6. Sends Brevo email to founder
7. Sends AiSensy WhatsApp broadcast
8. PostHog tracks event
9. Frontend redirects to /integrations/ai-employee
10. User configures WhatsApp integration
```

### Subscription Notes (Razorpay)

```javascript
{
  tenantId: 'TENANT#abc123',
  agencyOwnerId: 'USER#xyz789',
  agencyName: 'Cloudberry Realty',
  contactPhone: '+919876543210',
  contactEmail: 'owner@cloudberry.in'
}
```

---

## Trial System

### Trial Lifecycle

```
Day 0:     User signs up → Trial subscription created (14 days)
Day 1-13:  Full access to all features
Day 14:    Trial ends at 00:00 UTC
           - isTrialing = false
           - isTrialExpired = true
           - gracePeriodActive = true (7 days)
Day 14-20: Grace period (read-only access)
Day 21+:   Account locked (read-only for 30 days)
           - After 30 days: data never deleted without explicit request
```

### Trial Configuration

```bash
TRIAL_DAYS=14  # Default trial period
```

---

## Seat Management

### Seat Calculation

```javascript
seatsUsed = count of active members (from auth service)
seatsPaid = purchased seats (1, 3, 10)
canInvite = seatsUsed < seatsPaid
```

### Seat Limits by Plan

| Plan | Seats | Price | Add Seat |
|------|-------|-------|----------|
| Solo | 1 | ₹999/mo | Upgrade to Team (₹1,999) |
| Team | 3 | ₹1,999/mo | Add 1 seat (₹500/mo) |
| Team+ | 10 | ₹4,999/mo | Add 1 seat (₹500/mo) |

---

## Email Notifications (Brevo)

### Templates

| Event | Template | Recipient |
|-------|----------|-----------|
| AI Employee paid | `BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID` | Founder |
| AI Employee escalated (founder) | `BREVO_AI_EMPLOYEE_ESCALATED_FOUNDER_TEMPLATE_ID` | Founder |
| AI Employee escalated (customer) | `BREVO_AI_EMPLOYEE_ESCALATED_CUSTOMER_TEMPLATE_ID` | Customer |

### Email Sending

- **Failure handling:** Non-fatal (webhook always returns 200)
- **Retry:** Brevo handles retries internally
- **Logging:** All attempts logged to CloudWatch

---

## WhatsApp Notifications (AiSensy)

### Campaigns

| Event | Campaign | Recipient |
|-------|----------|-----------|
| AI Employee onboarding | `AI-Employee-Onboarding-Pending` | Customer phone |

### Broadcast Flow

```
1. Webhook receives subscription.activated
2. Extract contactPhone from subscription notes
3. Format phone: ensure +91 prefix
4. Send AiSensy broadcast
5. Log result (non-fatal)
```

---

## Analytics & Tracking (PostHog)

### Events Tracked

| Event | Properties |
|-------|-----------|
| `signup_completed` | tenant_id, role, utm_source, utm_campaign, utm_medium |
| `subscription_started` | planId, subscriptionId |
| `subscription_invoiced` | subscriptionId, planId |
| `subscription_paid` | subscriptionId, amount |
| `razorpay_payment_succeeded` | paymentId, amount, method |
| `razorpay_payment_failed` | paymentId, amount, error_code |
| `ai_employee_provisioned` | tenantId, status, planId, razorpaySubscriptionId |
| `trial_paywall_shown` | plan, forced |
| `trial_paywall_clicked` | tier, billingCycle, includeAI |
| `paywall_seat_limit_hit` | currentSeats, paidSeats, tier |

---

## Security Considerations

### Webhook Security

✅ **HMAC-SHA256 signature verification** (constant-time comparison)
✅ **Timestamp validation** (5-minute window)
✅ **Idempotency check** (event_id deduplication)
✅ **Replay attack prevention**
✅ **Non-fatal email/WhatsApp failures** (webhook always succeeds)

### Payment Security

✅ **Razorpay handles PCI compliance**
✅ **No card data stored in backend**
✅ **Subscription IDs used for recurring charges**
✅ **Tenant isolation** (tenantId in subscription notes)

### Data Privacy

✅ **DPDP consent tracking** (consentSignedAt)
✅ **Grace period** (7 days after trial expiry)
✅ **Data retention** (30 days read-only, then never deleted without request)

---

## Related Files

| File | Purpose |
|------|---------|
| `server/subscriptionService.js` | Subscription CRUD operations |
| `server/routes/subscriptions.js` | Subscription API endpoints |
| `server/routes/billing.js` | Razorpay webhook handler |
| `server/routes/auth.js` | Post-registration hook |
| `server/aiEmployeeProvisioningService.js` | AI Employee provisioning |
| `real-estate-crm-app/src/contexts/SubscriptionContext.tsx` | Global subscription state |
| `real-estate-crm-app/src/hooks/useSubscription.ts` | Subscription hook |
| `real-estate-crm-app/src/components/PaywallModal.tsx` | Trial expiry paywall |
| `real-estate-crm-app/src/components/SeatUpgradeModal.tsx` | Seat limit paywall |
| `real-estate-crm-app/src/lib/razorpay.ts` | Razorpay checkout integration |
| `server/.env.example` | Environment variables |

---

## Testing Checklist

- [ ] Trial subscription created on signup
- [ ] Trial countdown displays correctly
- [ ] Paywall shows on trial expiry
- [ ] Razorpay checkout opens with correct plan
- [ ] Webhook processes payment correctly
- [ ] Subscription updated after payment
- [ ] Paywall closes after successful payment
- [ ] Seat check prevents invite when limit hit
- [ ] Seat upgrade modal shows correct options
- [ ] AI Employee provisioning triggers correctly
- [ ] Brevo emails sent on AI Employee payment
- [ ] AiSensy WhatsApp sent on AI Employee payment
- [ ] PostHog events tracked correctly
- [ ] Grace period works after trial expiry
- [ ] HMAC signature validation works
- [ ] Replay attack prevention works
- [ ] Idempotency check prevents duplicates

---

## Troubleshooting

### Issue: Paywall not showing

**Check:**
1. `isTrialExpired` is true
2. `isPaying` is false
3. `gracePeriodActive` is false
4. Page is not whitelisted

### Issue: Webhook not processing

**Check:**
1. `RAZORPAY_WEBHOOK_SECRET` is set
2. Signature verification passes
3. Event timestamp is recent (< 5 minutes)
4. Event ID not already processed

### Issue: Seats not updating

**Check:**
1. Auth service is reachable
2. `seatsUsed` count is accurate
3. Subscription record exists in DynamoDB
4. `seatsPaid` updated after payment

### Issue: Emails not sending

**Check:**
1. `BREVO_API_KEY` is set
2. Template IDs are correct
3. Email address is valid
4. Brevo account has sufficient credits

---

## Future Enhancements

- [ ] Dunning management (failed payment retries)
- [ ] Subscription pause/resume
- [ ] Proration for mid-cycle upgrades
- [ ] Usage-based billing (API calls, AI minutes)
- [ ] Annual discount codes
- [ ] Enterprise custom pricing
- [ ] Subscription analytics dashboard
- [ ] Churn prevention workflows

