# Agent Prompt — PR-J: Paywall + Trial Countdown UI

**Branch to create:** `cursor/pr-4j-paywall-trial-8e67`
**Base branch:** `main` (after Batch 3 is merged)
**Batch:** 4 (Day 4) — runs in parallel with PR-K
**Hard dependency:** PR-H merged (`server/subscriptionService.js` + `subscriptions.js` must exist)

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§3.1 SubscriptionStatus, §4 Razorpay Plan IDs)
3. `server/routes/subscriptions.js` (created by PR-H — you add trial-status endpoint)
4. `server/subscriptionService.js` (created by PR-H — you call getSubscription)
5. `real-estate-crm-app/src/App.tsx` (authenticated layout structure)
6. `real-estate-crm-app/src/components/SeatCounter.tsx` (created by PR-H — component pattern to follow)
7. `marketing-and-sales/launch-plan-v2/pricing.json`
8. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P14-paywall-trial-countdown.md`

---

## What to Build

### 1. Update `server/routes/subscriptions.js` — add trial-status endpoint

PR-H created this file with `GET /current`. Add `GET /trial-status`:

```js
// GET /api/subscriptions/trial-status — validateToken + extractTenantId
router.get('/trial-status', validateToken, extractTenantId, async (req, res) => {
  const sub = await getSubscription(req.tenantId);
  
  const now = Date.now();
  const trialEndsAt = new Date(sub.trialEndsAt).getTime();
  const msLeft = trialEndsAt - now;
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  
  return res.json({
    plan: sub.plan,
    trialDaysLeft,
    trialEndsAt: sub.trialEndsAt,
    isPaying: sub.isPaying,
    isTrialing: !sub.isPaying && trialDaysLeft > 0,
    isTrialExpired: !sub.isPaying && trialDaysLeft === 0,
    gracePeriodActive: sub.gracePeriodActive,
    paymentStatus: sub.paymentStatus,
  });
});
```

**Only add this endpoint. Do not modify the GET /current endpoint from PR-H.**

### 2. `real-estate-crm-app/src/contexts/SubscriptionContext.tsx`

React context for subscription state:
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

### 3. `real-estate-crm-app/src/hooks/useSubscription.ts`

```typescript
// Fetches GET /api/subscriptions/trial-status on mount + every 5 minutes
// Caches in SubscriptionContext
// Exposes: { subscription, isPaying, isTrialing, trialDaysLeft, isTrialExpired, gracePeriodActive, refetch }
// Returns null/defaults when user not authenticated or endpoint returns 404
```

### 4. `real-estate-crm-app/src/components/TrialCountdownBanner.tsx`

```typescript
// Returns null if isPaying OR trialDaysLeft > 7
// Yellow (7 ≥ days > 3): "Your trial ends in {N} days — upgrade to keep your data. Upgrade now →"
// Red (3 ≥ days > 0): "⚠️ {N} days left — Upgrade for ₹999/month" (price from pricing.json Solo tier)
// "Upgrade now" button → opens PaywallModal
// Sticky below the main nav (not fixed position — flows with layout)
```

### 5. `real-estate-crm-app/src/components/PaywallModal.tsx`

```typescript
// Renders as a full-screen overlay when: isTrialExpired && !isPaying && !gracePeriodActive
// Blocks all navigation EXCEPT whitelist: /profile, /billing, /legal/*, /grievance, /integrations/ai-employee, /auth/logout
// Whitelist check: const isWhitelisted = WHITELIST.some(p => window.location.pathname.startsWith(p))

const PAYWALL_WHITELIST = ['/profile', '/billing', '/legal', '/grievance', '/integrations/ai-employee'];

// Modal content:
// - Header: "Your trial has ended — pick a plan to continue"
// - Annual/Monthly toggle (default: Monthly). Annual shows "Save 20%"
// - 3 tier cards from pricing.json:
//   - Solo: ₹{price}/mo — features list — "Start Solo"
//   - Team: ₹{price}/mo — features list — "Start Team" (Most Popular badge)
//   - Team+: ₹{price}/mo — features list — "Start Team+"
//   All prices from pricing.json; annual = monthly * 12 * 0.8
// - "Add AI Employee — ₹7,999/mo" toggle above cards
//   When ON: show concierge setup note; on successful payment, redirect to /integrations/ai-employee
// - Footer: "What happens to my data?" expandable FAQ + "WhatsApp us" link
// - CTA → openCheckout(planId) from razorpay.ts
// - On payment success: refetch() subscription, close modal, navigate to original route
```

### 6. `real-estate-crm-app/src/lib/razorpay.ts`

```typescript
declare global {
  interface Window { Razorpay: any; }
}

export async function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay load failed'));
    document.head.appendChild(script);
  });
}

interface CheckoutOptions {
  planId: string;
  name: string;
  email: string;
  phone?: string;
  onSuccess: (response: any) => void;
  onFailure: (error: any) => void;
  onDismiss?: () => void;
}

export async function openCheckout(opts: CheckoutOptions): Promise<void> {
  await loadRazorpay();
  const rzp = new window.Razorpay({
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    subscription_id: opts.planId,  // planId is actually the subscription plan ID
    name: 'RealEstateFlow',
    description: 'Subscription',
    prefill: { name: opts.name, email: opts.email, contact: opts.phone },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  rzp.on('payment.failed', opts.onFailure);
  rzp.open();
}
```

### 7. Mount in `App.tsx`

In `{/* === [LAUNCH LAYOUT COMPONENTS] === */}`:
```tsx
{/* PR-J */}
<SubscriptionContext.Provider value={subscriptionContext}>
  {/* (authenticated layout content) */}
  <TrialCountdownBanner />
  <PaywallModal />
</SubscriptionContext.Provider>
```

Actually — the SubscriptionContext.Provider should wrap the authenticated Routes. Find where `<ProtectedRoute>` routes are rendered and wrap them.

### 8. `server/scripts/trial-reminder-cron.js` + `cron/trial-reminder.yaml`

Daily cron at 09:00 IST (03:30 UTC):

```js
// Queries Subscriptions where isTrialing=true
// Day-10: trialEndsAt - now between 3d and 4d → send trial-day-10 Brevo email
// Day-12: between 1d and 2d → send trial-day-12 email
// Day-14: between 0 and 24h → send trial-day-14 email
// Day-3 post-expiry: now - trialEndsAt between 3d and 4d && !isPaying → reactivation email
// Idempotent: Subscriptions.lastTrialEmail stores last email type sent; skip if already sent
```

`trial-reminder.yaml`:
```yaml
# Schedule: cron(30 3 * * ? *) UTC = 9:00 AM IST
# EventBridge rule → Lambda invocation
# Timeout: 60s, Memory: 128MB
```

### 9. `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md`

4 email copy drafts:
- **trial-day-10**: Subject "4 days left on your RealEstateFlow trial", soft pitch
- **trial-day-12**: Subject "2 days left — pick a plan to keep going", 3 tiers + annual discount
- **trial-day-14**: Subject "Your trial ends tomorrow — last chance for ₹999", urgency
- **trial-expired-day-3**: Subject "We miss you — 7 extra days if you upgrade today", reactivation offer

Each email: subject ≤50 chars, preheader ≤90, body markdown, deep-link CTA to `app.realestateflow.in/billing?upgrade=true`.

### 10. `tests/paywall.spec.ts`

```
- Mock subscription state trialDaysLeft=8 → assert banner NOT shown
- Mock trialDaysLeft=7 → yellow banner shows
- Mock trialDaysLeft=3 → red banner shows
- Mock trialDaysLeft=0, !isPaying → PaywallModal blocks /crm (assert redirect to modal)
- Mock trialDaysLeft=0, !isPaying → /billing route still accessible
- Mock Razorpay success callback → modal closes + subscription refetches
```

---

## What NOT to Touch

- `server/subscriptionService.js` functions (PR-H created them — only use `getSubscription`)
- `server/routes/subscriptions.js` GET /current endpoint (PR-H created; only ADD trial-status)
- `src/components/SeatCounter.tsx`, `SeatUpgradeModal.tsx` (PR-H created)
- Any LP files

---

## PR Description Template

```
PR-J: Paywall + trial countdown — banner, modal, Razorpay checkout, trial reminder cron

Batch 4 | Day 4 | Parallel with PR-K
Depends on: PR-H merged (subscriptionService + subscriptions route exist)

Files created:
- real-estate-crm-app/src/contexts/SubscriptionContext.tsx
- real-estate-crm-app/src/hooks/useSubscription.ts
- real-estate-crm-app/src/components/TrialCountdownBanner.tsx
- real-estate-crm-app/src/components/PaywallModal.tsx
- real-estate-crm-app/src/lib/razorpay.ts
- server/scripts/trial-reminder-cron.js + cron/trial-reminder.yaml
- marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md
- tests/paywall.spec.ts

Files modified:
- server/routes/subscriptions.js — added GET /trial-status (new endpoint, no touch to /current)
- real-estate-crm-app/src/App.tsx — SubscriptionContext.Provider + TrialCountdownBanner + PaywallModal

Source task: ZEE-007 (pre-launch-prep/P14-paywall-trial-countdown.md)
```
