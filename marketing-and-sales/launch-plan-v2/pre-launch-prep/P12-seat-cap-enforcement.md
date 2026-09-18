# P12 — Seat-Cap Enforcement (Solo=1 / Team=3 / Team+ scales)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-4
> **Skill(s):** `codebase-analysis` + `revops`
> **Estimated time:** 0.5h founder · 4h AI

## Objective
Enforce seat limits at the invite-creation layer (Solo=1, Team=3, Team+ scales at ₹500/extra-member, prorated) so revenue isn't leaked when an agency invites more team members than they paid for.

## Why This Matters for RealEstateFlow
Without enforcement, a Team subscription (₹1,999) lets an agency invite 10 members and pay nothing extra — pure margin loss. The pricing model only works if seat caps are honoured at the invite layer, with a clear in-product upgrade path that converts the seat-add to revenue.

## User Story
As a Team-plan agency owner trying to invite a 4th team member, I want a clear "you've reached your seat cap" message + a one-click upgrade-to-Team+ flow that adds the seat for ₹500 prorated, so I don't get blocked from growing my team and don't have to call support.

## Acceptance Criteria
- [ ] DynamoDB attribute `Subscriptions.seatsPaid` and `Subscriptions.seatsUsed` (or extend Agency record). Default: Solo=1, Team=3, Team+=variable
- [ ] `agency-app/api/routes/auth.js` invite-creation logic returns HTTP 402 + `{ error: 'paywall_seat_limit', currentSeats, paidSeats, upgradePlanId }` when `seatsUsed >= seatsPaid`
- [ ] `agency-app/web/src/pages/admin/InviteManagement.tsx` (and `MemberManagement.tsx`) show seat counter at top: "Used 3 of 3 seats. Upgrade to add more →"
- [ ] When at cap, "Invite member" button is disabled with tooltip; primary CTA replaces with "Upgrade to add seat → ₹500/mo"
- [ ] CTA opens Razorpay checkout for `add_seat` SKU (₹500 prorated for current billing cycle)
- [ ] On successful payment, Razorpay webhook `subscription.updated` increments `seatsPaid` by 1
- [ ] PostHog event `paywall_seat_limit_hit` fires when 402 is returned (with current/paid/attempted seats)
- [ ] PostHog event `seat_added` fires when seatsPaid increments
- [ ] Edge case: when a member is removed (deactivated), `seatsUsed` decrements; the "freed" seat can be used for next invite (no refund of the ₹500 — they paid for the seat slot)
- [ ] Tests: invite 1 on Solo = 200; invite 2 on Solo = 402. Invite 3 on Team = 200; invite 4 on Team = 402. Pay ₹500 → invite 4 on Team+ = 200. Deactivate member 4 → invite member 5 (since slot freed) = 200.
- [ ] Solo plan upgrade flow: when at cap, CTA = "Upgrade to Team — ₹1,999/mo (3 seats)" instead of `add_seat`
- [ ] Team plan upgrade flow: when at cap, CTA = "Upgrade to Team+ — ₹500/seat" + immediately add 1 seat
- [ ] Refund-cancellation interaction: if subscription cancelled, all seats deactivate; if reactivated within 30 days, seats restore

## AI Prompt (🤖)

```
You are a senior full-stack engineer specialised in B2B SaaS billing. Read these inputs:
- `agency-app/api/routes/auth.js` (invite/registration logic)
- `agency-app/api/routes/leads.js` (route patterns)
- `agency-app/api/tenantMiddleware.js`
- `agency-app/api/crmDynamodbService.js` (Agency / Subscription / Members entities)
- `agency-app/api/awsClientWrapper.js`
- `agency-app/web/src/pages/admin/InviteManagement.tsx`
- `agency-app/web/src/pages/admin/MemberManagement.tsx`
- `agency-app/web/src/App.tsx` (auth context)
- `marketing-and-sales/launch-plan-v2/pricing.json`

Produce:

## 1. `agency-app/api/subscriptionService.js` — DDB service
- `getSubscription(tenantId)` returns `{tenantId, plan, seatsPaid, seatsUsed, nextBillingDate, razorpaySubscriptionId, status}`
- `incrementSeatsPaid(tenantId, by=1)` (called on `subscription.updated` webhook)
- `decrementSeatsPaid(tenantId, by=1)` (rare — only on tier downgrade or cancellation)
- `recomputeSeatsUsed(tenantId)` — counts active members in Agency/Members table

## 2. Update `agency-app/api/routes/auth.js` invite-creation handler
- Before creating invite: fetch subscription via `getSubscription(req.tenantId)`
- Compute `seatsUsed = countActiveMembers(req.tenantId)`
- If `seatsUsed >= seatsPaid`: return 402 with body
  ```json
  {
    "error": "paywall_seat_limit",
    "currentSeats": 3,
    "paidSeats": 3,
    "tier": "team",
    "upgradeOptions": [
      { "planId": "{TEAMPLUS_ADDSEAT_PLAN_ID}", "label": "Add 1 seat (Team+)", "price": 500, "billing": "monthly_prorated" }
    ]
  }
  ```
  Also fire PostHog `paywall_seat_limit_hit` server-side
- Else: proceed with invite creation. After invite-acceptance, recompute seatsUsed.

## 3. Update Razorpay webhook (P11 created the file)
- Branch: `subscription.updated` AND payload includes plan with `add_seat` semantics → call `incrementSeatsPaid(tenantId, 1)`
- For Team+ subscription `subscription.charged` events with seat-line-items, increment based on payload

## 4. `agency-app/web/src/components/SeatCounter.tsx`
Reusable React component:
- Fetches `/api/subscriptions/current` (new endpoint to add — wraps getSubscription)
- Shows: `{seatsUsed} of {seatsPaid} seats used` with progress bar (green <70%, yellow 70-90%, red ≥90%)
- "Upgrade" CTA when at-cap or 1 seat remaining
- Used in InviteManagement.tsx + MemberManagement.tsx

## 5. `agency-app/web/src/components/SeatUpgradeModal.tsx`
- Triggered when 402 received OR when "Upgrade" CTA clicked
- Shows tier-aware copy:
  - Solo at-cap: "Solo limited to 1 member. Upgrade to Team for 3 seats — ₹1,999/mo" with "Upgrade to Team" CTA → Razorpay checkout for Team plan + cancel-Solo flow (Razorpay subscription change)
  - Team at-cap: "Team limited to 3 members. Add seats at ₹500/month — prorated" with "Add 1 seat" CTA → Razorpay checkout for `add_seat` SKU
  - Team+: shouldn't reach the cap (it's variable) — but if API says yes, show contact-support
- On Razorpay checkout success, refetch subscription, close modal, retry invite

## 6. Update `InviteManagement.tsx` and `MemberManagement.tsx`
- Mount SeatCounter at top
- Wrap "Invite Member" button: disable + show tooltip "Seat cap reached" when at cap; clicking opens SeatUpgradeModal
- On invite-create POST 402: open SeatUpgradeModal automatically

## 7. Tests `tests/seat-cap.spec.ts` — Playwright
Scenarios listed in the AC list. Use a test tenant with each tier; manipulate seatsPaid in DDB directly for some scenarios.

## 8. Migration script `agency-app/api/scripts/backfill-seats-paid.js`
For existing tenants: set seatsPaid based on plan (Solo=1, Team=3) — handles edge case of users who signed up before this rollout. Idempotent.

Stop here. Do not deploy or run Razorpay test transactions (manual).
```

## Manual Steps (🧍)

1. **Confirm Razorpay `add_seat` plan exists** (P7 was meant to create this; if not, create now: ₹500/mo, prorated, label "Additional seat — RealEstateFlow Team+").
2. **Run backfill script** for any test tenants pre-existing.
3. **Deploy + smoke test**: create new tenant on Solo, invite 1, verify success; invite 2, verify 402 + SeatUpgradeModal opens.
4. **Test add_seat flow**: pay ₹500 in Razorpay test → confirm seatsPaid increments via webhook within 60s → retry invite, verify success.
5. **Test member deactivation**: deactivate a member → recomputeSeatsUsed runs → seatsUsed decrements.
6. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- Server route + DDB conventions
- React UI conventions (`InviteManagement.tsx`, `MemberManagement.tsx`)
- `pricing.json` (Team+ extraSeatPrice = 500)
- Razorpay add_seat plan ID (P7)

## Outputs
- `agency-app/api/subscriptionService.js`
- Updated `agency-app/api/routes/auth.js`
- Updated `agency-app/api/routes/billing.js` (P11 created the file)
- New `agency-app/api/routes/subscriptions.js` (for `/api/subscriptions/current`)
- `agency-app/web/src/components/SeatCounter.tsx`
- `.../SeatUpgradeModal.tsx`
- Updated `InviteManagement.tsx` and `MemberManagement.tsx`
- `tests/seat-cap.spec.ts`
- `agency-app/api/scripts/backfill-seats-paid.js`

## Success Criterion
All 5 test scenarios pass end-to-end; no agency can have more active members than seatsPaid.

## Fallback / Plan B
If Razorpay add_seat plan creation is messy, fall back to a manual upgrade flow: customer requests via in-product CTA → email founder → founder bumps Subscriptions.seatsPaid manually + sends Razorpay invoice for ₹500. Not scalable but works for M1 if needed.

## Risks
| Risk | Mitigation |
|---|---|
| Race condition: 2 invites at the same moment | Use DDB conditional write `seatsUsed < seatsPaid` |
| Cap-bypass via direct API | All invite endpoints go through middleware that checks seats |
| Customer confused by 402 | UX immediately opens upgrade modal — doesn't surface as raw error |
| Member deactivation doesn't free seat | recomputeSeatsUsed runs on deactivate hook |
| Refund interaction | Cancellation hooks deactivate seats; refund within 30 days re-activates |

## India / Mumbai-Specific Notes
- ₹500 add-seat is per-Indian-Rupee mental anchor (less than chai-cost-per-day)
- GST 18% applied via Razorpay automatically; covered in P7 invoicing
- "Member deactivation" UX should be in Hindi-friendly: "Remove from team" not "Terminate user"

## Dependencies
- **Blocks:** Day 14+ team-onboarding flows, Day 22 CRO ranking
- **Depends on:** P7 (Razorpay add_seat plan), P11 (webhook handler), P14 (paywall modal can reuse)

## Connected Skills
- `codebase-analysis` — write the service + middleware
- `revops` — billing + plan logic
- `paywall-upgrade-cro` — modal copy + UX
- `pr-review` — race-condition review
