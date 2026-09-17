# Agent Prompt — PR-H: Seat-Cap Enforcement

**Branch to create:** `cursor/pr-3h-seat-cap-8e67`
**Base branch:** `main` (after Batch 2 is merged)
**Batch:** 3 (Day 3) — runs in parallel with PR-I
**Hard dependencies:**
- PR-F merged (`agency-app/api/routes/billing.js` exists — you add to it)
- Batch 1 merged (`agency-app/api/routes/auth.js` extension point must exist)

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md` (§1.5 Subscriptions table)
3. `agency-app/api/routes/auth.js` (find the invite-creation handler)
4. `agency-app/api/routes/billing.js` (created by PR-F — understand the webhook structure to add seat increment)
5. `agency-app/web/src/pages/admin/InviteManagement.tsx` (you will modify this)
6. `agency-app/web/src/pages/admin/MemberManagement.tsx` (you will modify this)
7. `marketing-and-sales/launch-plan-v2/pricing.json` (seat limits + prices)
8. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P12-seat-cap-enforcement.md`

---

## What to Build

### 1. `agency-app/api/subscriptionService.js`

DDB service for `Subscriptions` table. Schema from `01-SHARED-CONTRACTS.md §1.5`.

```js
// Returns {plan, seatsPaid, seatsUsed, trialEndsAt, isPaying, gracePeriodActive, paymentStatus, razorpaySubscriptionId}
export async function getSubscription(tenantId)

// Increments seatsPaid by `by` (default 1). Called by billing webhook on subscription.updated.
export async function incrementSeatsPaid(tenantId, by = 1)

// Decrements seatsPaid (rare — only on tier downgrade)
export async function decrementSeatsPaid(tenantId, by = 1)

// Counts active members in existing CRM table — look for Members or Agency.agents count in crmDynamodbService.js
export async function recomputeSeatsUsed(tenantId)

// Creates a subscription row for new tenant on trial signup (called from auth.js register handler)
export async function createTrialSubscription(tenantId, plan = 'solo')
```

### 2. `agency-app/api/routes/subscriptions.js`

```js
// GET /api/subscriptions/current — validateToken + extractTenantId
// Returns full subscription object for current tenant (getSubscription result)

// GET /api/subscriptions/trial-status — validateToken + extractTenantId
// Returns: { trialDaysLeft, trialEndsAt, plan, isPaying, isTrialing, isTrialExpired, gracePeriodActive, paymentStatus }
// trialDaysLeft = Math.ceil((trialEndsAt - Date.now()) / 86400000), clamped to 0 if negative
```

### 3. Update `agency-app/api/routes/auth.js` — invite creation handler ONLY

Find the POST endpoint that creates an invite/team member. Add seat cap check before the invite is created:

```js
// At top: import getSubscription from '../subscriptionService.js'
// In invite-creation handler, BEFORE creating the invite:

const subscription = await getSubscription(req.tenantId);
const seatsUsed = await recomputeSeatsUsed(req.tenantId);

if (seatsUsed >= subscription.seatsPaid) {
  // Fire PostHog event (server-side stub)
  await serverTrack(req.tenantId, 'paywall_seat_limit_hit', {
    currentSeats: seatsUsed,
    paidSeats: subscription.seatsPaid,
    tier: subscription.plan,
  });
  return res.status(402).json({
    error: 'paywall_seat_limit',
    currentSeats: seatsUsed,
    paidSeats: subscription.seatsPaid,
    tier: subscription.plan,
    upgradeOptions: [
      subscription.plan === 'solo'
        ? { planId: 'plan_team_monthly', label: 'Upgrade to Team — ₹1,999/mo (3 seats)', price: 1999 }
        : { planId: 'plan_add_seat', label: 'Add 1 seat — ₹500/mo', price: 500 }
    ],
  });
}
// Existing invite creation code continues here...
```

**Only add to the invite creation handler. Do not touch any other function in auth.js.**

### 4. Update `agency-app/api/routes/billing.js` — subscription.updated branch ONLY

In the existing `subscription.updated` case in the billing webhook (created by PR-F), add the seat increment call:

```js
case 'subscription.updated':
  // Check if payload indicates seat addition
  // Razorpay subscription.updated fires when plan changes; check the plan change
  if (payload?.subscription?.entity?.quantity > previousQuantity) {
    const incrementBy = payload.subscription.entity.quantity - previousQuantity;
    await incrementSeatsPaid(tenantId, incrementBy);
    await serverTrack(tenantId, 'seat_added', { incrementBy, tenantId });
  }
  break;
```

At top of billing.js (created by PR-F), add import:
```js
import { incrementSeatsPaid } from '../subscriptionService.js';
```

**Only add to the subscription.updated case. Do not restructure billing.js.**

### 5. `agency-app/web/src/components/SeatCounter.tsx`

Reusable component:
- Fetches `GET /api/subscriptions/current` (wrapped in `useEffect`)
- Shows: `{seatsUsed} / {seatsPaid} seats used`
- Tailwind progress bar: green <70%, yellow 70-89%, red ≥90%
- "Add seats →" CTA button when at cap or 1 seat remaining
- CTA triggers `SeatUpgradeModal`

### 6. `agency-app/web/src/components/SeatUpgradeModal.tsx`

Modal triggered when: (a) 402 received from invite POST, (b) "Add seats" CTA in SeatCounter.

Tier-aware copy:
- `solo` at cap: "You've reached your 1-seat Solo limit. Upgrade to Team for 3 seats — ₹1,999/month." CTA: "Upgrade to Team"
- `team` at cap: "You've reached your 3-seat Team limit. Add seats at ₹500/month (prorated)." CTA: "Add 1 seat"
- On CTA click: call Razorpay checkout (use `window.Razorpay` — the `razorpay.ts` module from PR-J handles the actual checkout; for now, show a `<a href="/billing">Manage billing →</a>` fallback)
- On success: refetch subscription, close modal

### 7. Update `InviteManagement.tsx` and `MemberManagement.tsx`

Add at the top of each page's content area:
```tsx
import SeatCounter from '../components/SeatCounter';
import SeatUpgradeModal from '../components/SeatUpgradeModal';

// Inside the component, add:
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
const [upgradeOptions, setUpgradeOptions] = useState(null);

// Wrap the "Invite Member" button:
// - Disable button + show tooltip when at cap
// - In the invite POST error handler: if error.status === 402, setUpgradeOptions(error.upgradeOptions) + setShowUpgradeModal(true)

// Mount: <SeatCounter onUpgradeClick={() => setShowUpgradeModal(true)} />
// Mount: <SeatUpgradeModal open={showUpgradeModal} options={upgradeOptions} onClose={() => setShowUpgradeModal(false)} />
```

### 8. `agency-app/api/scripts/backfill-seats-paid.js`

Idempotent one-off script. For existing tenants, set `seatsPaid` based on plan:
- `solo` → `seatsPaid = 1`
- `team` → `seatsPaid = 3`
- If `Subscriptions` row doesn't exist → create with `createTrialSubscription`

### 9. `tests/seat-cap.spec.ts`

5 Playwright scenarios:
1. Solo tenant: invite 1 member → 200
2. Solo tenant: invite 2nd member → 402 + SeatUpgradeModal opens
3. Team tenant: invite 3 → 200; invite 4th → 402
4. Team tenant: mock billing webhook with seat add → seatsPaid increments → invite 4th → 200
5. Deactivate member → seatsUsed decrements → invite new member → 200

---

## agency-app/api/server.js Modification

In `// === [LAUNCH ROUTES IMPORTS] ===`:
```js
// PR-H
import subscriptionsRoutes from './routes/subscriptions.js';
```

In `// === [LAUNCH ROUTES MOUNTS] ===`:
```js
// PR-H
app.use('/api/subscriptions', subscriptionsRoutes);
```

---

## App.tsx Modification

In `{/* === [LAUNCH PROTECTED ROUTES] === */}`:
```tsx
{/* PR-H — no new routes; InviteManagement and MemberManagement already exist */}
```

(No new routes needed — just component modifications to InviteManagement + MemberManagement.)

---

## What NOT to Touch

- `agency-app/api/aiEmployeeProvisioningService.js` (PR-F created this)
- `src/lib/razorpay.ts` (PR-J creates this; use window.Razorpay or link to /billing as fallback)
- Any LP files

---

## Acceptance Criteria

- [ ] Solo tenant: 2nd invite → 402 + SeatUpgradeModal shows tier-aware copy
- [ ] Team tenant: 4th invite → 402
- [ ] Billing webhook seat add → seatsPaid increments via subscriptionService
- [ ] SeatCounter renders progress bar + correct colors
- [ ] Playwright test 100% pass for all 5 scenarios

---

## PR Description Template

```
PR-H: Seat-cap enforcement — subscription service + seat UI + auth.js update

Batch 3 | Day 3 | Parallel with PR-I
Depends on: PR-F merged (billing.js exists)

Files created:
- agency-app/api/subscriptionService.js — Subscriptions DDB service
- agency-app/api/routes/subscriptions.js — GET /current + GET /trial-status
- agency-app/web/src/components/SeatCounter.tsx
- agency-app/web/src/components/SeatUpgradeModal.tsx
- agency-app/api/scripts/backfill-seats-paid.js
- tests/seat-cap.spec.ts

Files modified:
- agency-app/api/routes/auth.js — seat check in invite-creation handler (invite POST only)
- agency-app/api/routes/billing.js — seat increment in subscription.updated case (one case only)
- agency-app/web/src/pages/admin/InviteManagement.tsx — SeatCounter + SeatUpgradeModal mount
- agency-app/web/src/pages/admin/MemberManagement.tsx — SeatCounter mount
- agency-app/api/server.js — subscriptions route mount

Source task: ZEE-005 (pre-launch-prep/P12-seat-cap-enforcement.md)
```
