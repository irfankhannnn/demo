# Shared Contracts — DynamoDB Schemas, API Routes, TypeScript Interfaces

**Every agent reads this. No agent should define their own table schemas or interface types — use these definitions.**

---

## 1. New DynamoDB Tables (7 tables — all to be created by Founder in AWS Console)

### 1.1 `Grievances`
```
PK: grievanceId (string, ULID)
Attributes:
  name (string, required)
  email (string, required)
  phone (string, optional)
  category (string) — enum: data_access | data_correction | data_deletion | data_export | account_security | billing | service_complaint | other
  description (string, required, 10-2000 chars)
  status (string) — enum: new | acknowledged | in_progress | resolved | escalated
  assignedTo (string, optional)
  resolvedAt (string, ISO timestamp, optional)
  resolutionNotes (string, optional)
  internalNotes (string, optional)
  ip (string)
  userAgent (string)
  trackingId (string) — GR-{first-6-chars-of-grievanceId}
  createdAt (string, ISO timestamp)
  updatedAt (string, ISO timestamp)
  tenantId (null) — deliberately null, this is a public table

GSI: status-createdAt-index (PK=status, SK=createdAt)
GSI: email-createdAt-index (PK=email, SK=createdAt)
BillingMode: PAY_PER_REQUEST
PITR: enabled
```

### 1.2 `AIEmployeeProvisioning`
```
PK: tenantId (string)
SK: createdAt (string, ISO timestamp)
Attributes:
  agencyOwnerId (string)
  agencyName (string)
  contactPhone (string)
  contactEmail (string)
  paidAt (string, ISO timestamp)
  status (string) — enum: pending | live | escalated
  expectedSLAEnd (string, ISO timestamp) — paidAt + 24h
  planId (string)
  razorpaySubscriptionId (string)
  internalNotes (string, optional)
  loomUrl (string, optional)
  liveAt (string, optional)
  createdAt (string, ISO timestamp)
  updatedAt (string, ISO timestamp)

GSI: status-createdAt-index (PK=status, SK=createdAt) — for escalation cron
BillingMode: PAY_PER_REQUEST
PITR: enabled
```

### 1.3 `WebhookLog` (idempotency log)
```
PK: webhookEventId (string) — Razorpay event.id
Attributes:
  processedAt (string, ISO timestamp)
  eventType (string)
  tenantId (string, optional)

TTL: 30 days (set TTL attribute on processedAt + 30d)
BillingMode: PAY_PER_REQUEST
```

### 1.4 `TenantApiKeys`
```
PK: tenantId (string)
Attributes:
  keyHash (string) — SHA-256 hash of the raw key
  rawKeyPrefix (string) — first 4 + last 4 chars only (for display)
  createdAt (string, ISO timestamp)
  lastUsed (string, ISO timestamp, optional)
  scopes (string[]) — ['ai-employee']
  isActive (boolean)

BillingMode: PAY_PER_REQUEST
```

### 1.5 `Subscriptions`
```
PK: tenantId (string)
Attributes:
  plan (string) — enum: solo | team | teamplus | free
  seatsPaid (number) — default: Solo=1, Team=3, TeamPlus=variable
  seatsUsed (number) — computed; updated on member add/remove
  trialEndsAt (string, ISO timestamp)
  isPaying (boolean)
  gracePeriodActive (boolean) — true for 7 days after subscription_started (webhook lag buffer)
  paymentStatus (string) — enum: trialing | active | cancelled | past_due
  razorpaySubscriptionId (string, optional)
  nextBillingDate (string, ISO timestamp, optional)
  consentSignedAt (string, ISO timestamp, optional) — DPDP ToS/Privacy consent at signup
  createdAt (string, ISO timestamp)
  updatedAt (string, ISO timestamp)

BillingMode: PAY_PER_REQUEST
PITR: enabled
```

### 1.6 `NPSResponses`
```
PK: responseId (string, ULID)
Attributes:
  tenantId (string)
  userId (string)
  score (number, 0-10)
  freeText (string, optional)
  shareTestimonial (boolean, optional)
  respondedAt (string, ISO timestamp)
  channel (string) — enum: in_app | email

GSI: tenantId-respondedAt-index
BillingMode: PAY_PER_REQUEST
```

### 1.7 `BetaInvites`
```
PK: email (string)
Attributes:
  invitedAt (string, ISO timestamp)
  usedAt (string, ISO timestamp, optional)
  status (string) — enum: invited | used | expired
  invitedBy (string) — founderId

BillingMode: PAY_PER_REQUEST
```

---

## 2. API Route Specifications

### PR-B: Grievance Routes (`agency-app/api/routes/grievance.js`)
```
POST   /api/grievance              — PUBLIC, rate-limit 5/IP/hour, hCaptcha, creates Grievances row
GET    /api/admin/grievances       — validateToken + role=founder/admin
PATCH  /api/admin/grievances/:id   — validateToken + role=founder/admin
```

### PR-F: Billing Routes (`agency-app/api/routes/billing.js`)
```
POST   /api/billing/webhook        — PUBLIC, no validateToken, HMAC-SHA256 sig verify
                                     MUST be mounted BEFORE auth middleware in server.js
```

### PR-F: AI Employee Status (`agency-app/api/routes/aiEmployeeStatus.js`)
```
GET    /api/ai-employee/status     — validateToken + extractTenantId
```

### PR-H: Subscription Routes (`agency-app/api/routes/subscriptions.js`)
```
GET    /api/subscriptions/current      — validateToken + extractTenantId
GET    /api/subscriptions/trial-status — validateToken + extractTenantId
```

### PR-K: Feedback Routes (`agency-app/api/routes/feedback.js`)
```
POST   /api/feedback/nps           — validateToken (auth required for NPS)
GET    /api/nps                    — PUBLIC, HMAC token validation (email link NPS)
```

---

## 3. TypeScript Interfaces (for CRM SPA)

### 3.1 Subscription (for `useSubscription.ts`)
```typescript
export interface SubscriptionStatus {
  plan: 'solo' | 'team' | 'teamplus' | 'free';
  seatsPaid: number;
  seatsUsed: number;
  trialDaysLeft: number;
  trialEndsAt: string;  // ISO
  isPaying: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  gracePeriodActive: boolean;
  paymentStatus: 'trialing' | 'active' | 'cancelled' | 'past_due';
}
```

### 3.2 Grievance (for `Grievance.tsx` and `GrievanceList.tsx`)
```typescript
export type GrievanceCategory = 
  'data_access' | 'data_correction' | 'data_deletion' | 
  'data_export' | 'account_security' | 'billing' | 
  'service_complaint' | 'other';

export type GrievanceStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'escalated';

export interface Grievance {
  grievanceId: string;
  trackingId: string;    // GR-XXXXXX
  name: string;
  email: string;
  phone?: string;
  category: GrievanceCategory;
  description: string;
  status: GrievanceStatus;
  assignedTo?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}
```

### 3.3 AIEmployeeProvisioning (for `AIEmployeeStatus.tsx`)
```typescript
export type ProvisioningStatus = 'pending' | 'live' | 'escalated';

export interface AIEmployeeProvisioningStatus {
  tenantId: string;
  status: ProvisioningStatus;
  expectedSLAEnd: string;  // ISO
  loomUrl?: string;
  liveAt?: string;
  createdAt: string;
}
```

### 3.4 Analytics Event Names (for `analytics.ts`)
```typescript
export type AnalyticsEvent =
  | 'signup_started'
  | 'signup_completed'
  | 'otp_verified'
  | 'onboarding_role_selected'
  | 'agency_registered'
  | 'buyer_added'
  | 'owner_added'
  | 'property_added'
  | 'lead_added'
  | 'lead_converted'
  | 'khata_entry_created'
  | 'khata_settled'
  | 'meeting_scheduled'
  | 'whatsapp_share_clicked'
  | 'feature_first_use'
  | 'trial_paywall_shown'
  | 'trial_paywall_clicked'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'ai_employee_connected'
  | 'ai_employee_lead_handled'
  | 'nps_response'
  | 'paywall_seat_limit_hit'
  | 'seat_added'
  | 'invite_accepted'
  | 'grievance_submitted';

export interface UserTraits {
  tenantId: string;
  role: string;
  plan: string;
  trialEndsAt?: string;
  agencyName?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
}
```

### 3.5 CookieConsent (for `CookieConsentBanner.tsx` and `analytics.ts`)
```typescript
export interface CookieConsent {
  essential: true;
  analytics: boolean;
  marketing?: boolean;   // LP only — not present in CRM consent object
  functional?: boolean;  // LP only
  version: number;
  timestamp: string;     // ISO
}

// Stored at:
const CONSENT_KEY = 'cookieConsent';
const CONSENT_VERSION = 1;

// Read pattern:
const consent: CookieConsent | null = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
const analyticsAllowed = consent?.analytics ?? false;
```

---

## 4. Razorpay Plan IDs

Coding agents use these placeholder plan IDs. The founder will replace with live IDs after Razorpay KYC.

```json
{
  "razorpayPlanIds": {
    "test": {
      "solo_monthly": "plan_test_solo_monthly",
      "solo_annual": "plan_test_solo_annual",
      "team_monthly": "plan_test_team_monthly",
      "team_annual": "plan_test_team_annual",
      "teamplus_monthly": "plan_test_teamplus_monthly",
      "add_seat": "plan_test_add_seat",
      "ai_employee_addon": "plan_test_ai_employee"
    },
    "live": {}
  }
}
```

Use `process.env.RAZORPAY_PLAN_*` env vars or read from `pricing.json` — do NOT hardcode plan IDs.

---

## 5. Brevo Email Template IDs

```
BREVO_TRIAL_DAY10_TEMPLATE_ID   (trial reminder Day 10)
BREVO_TRIAL_DAY12_TEMPLATE_ID   (trial reminder Day 12)
BREVO_TRIAL_DAY14_TEMPLATE_ID   (trial reminder Day 14)
BREVO_TRIAL_EXPIRED_TEMPLATE_ID  (reactivation Day 3 post-expiry)
BREVO_GRIEVANCE_ACK_TEMPLATE_ID  (grievance auto-acknowledgement)
BREVO_GRIEVANCE_NOTIFY_TEMPLATE_ID (internal notification to founder)
BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID (concierge start notification)
BREVO_AI_EMPLOYEE_LIVE_TEMPLATE_ID (AI Employee activation)
BREVO_AI_EMPLOYEE_ESCALATED_TEMPLATE_ID (SLA breach + ₹500 credit)
BREVO_WELCOME_T0_TEMPLATE_ID     (signup T+0 welcome)
```

Use `process.env.BREVO_*_TEMPLATE_ID` pattern. Set to `undefined` in code — server falls back to hardcoded subject/body if template ID not set.

---

## 6. Demo Tenant Constants

```
DEMO_TENANT_ID = process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW'
DEMO_USER_EMAIL = 'demo@realestateflow.in'
```

---

## 7. Pricing Reference

All pricing logic reads from `marketing-and-sales/launch-plan-v2/pricing.json`. Never hardcode prices.

Key values (for type-safe code):
```typescript
const SEAT_LIMITS = { solo: 1, team: 3 };  // teamplus is variable
const EXTRA_SEAT_PRICE = 500;  // INR/month
const TRIAL_DAYS = 14;
const REFUND_DAYS = 30;
```

---

## 8. Error Response Shape

All API errors must use this shape:
```js
res.status(400).json({ error: 'error_code_snake_case', details: 'human-readable message' });
res.status(402).json({ error: 'paywall_seat_limit', currentSeats: N, paidSeats: N, tier: 'team', upgradeOptions: [] });
res.status(429).json({ error: 'rate_limit_exceeded', retryAfter: 3600 });
```
