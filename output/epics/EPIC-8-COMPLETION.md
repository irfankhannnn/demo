# EPIC-8 Completion Report — PR-H: Seat-Cap Enforcement

## Implemented Features
- `subscriptionService.js` — DDB CRUD for Subscriptions table (get, increment/decrement seatsPaid, recomputeSeatsUsed, createTrialSubscription, updateSeatsUsed)
- `routes/subscriptions.js` — GET /current, GET /trial-status, POST /check-seat (402 paywall response with upgrade options)
- `SeatCounter.tsx` — progress bar (green/yellow/red), seat count display, upgrade CTA
- `SeatUpgradeModal.tsx` — tier-aware copy (solo → "Upgrade to Team"; team → "Add 1 seat"), /billing fallback
- `InviteManagement.tsx` — pre-invite seat check (POST /check-seat before auth API invite), auto-open modal on 402
- `MemberManagement.tsx` — SeatCounter mounted at top
- `backfill-seats-paid.js` — idempotent script to set seatsPaid based on plan for existing tenants
- `seat-cap.spec.ts` — 5 Playwright scenarios

## APIs Added
- `GET /api/subscriptions/current` — full subscription object (validateToken + extractTenantId)
- `GET /api/subscriptions/trial-status` — trialDaysLeft, isTrialing, isTrialExpired, gracePeriodActive
- `POST /api/subscriptions/check-seat` — pre-invite seat availability check, returns 402 with upgradeOptions if at cap

## Database Changes
- New table: `Subscriptions` (PK=tenantId, PAY_PER_REQUEST, PITR enabled)

## Infrastructure Changes
None (backfill script is manual one-off)

## Security Enhancements
- All subscription routes require validateToken + extractTenantId
- Seat check fires PostHog `paywall_seat_limit_hit` event for analytics

## Testing Performed
- vite build: 1550 modules, 992.75 kB JS — zero new errors
- Playwright spec: 5 scenarios covering solo/team cap enforcement + subscription endpoints

## Known Constraints
- Auth.js on this server is empty (Cognito handles invites externally). Seat check is frontend-orchestrated via POST /check-seat before calling AUTH_API_URL/invites
- Razorpay checkout integration deferred to PR-J (SeatUpgradeModal links to /billing as fallback)
- billing.js subscription.updated seat increment not wired in this PR (will be added when PR-F is merged to base)
