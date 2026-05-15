# Day 3 — Payment Testing (Live Mode)

## Objective
Run a real, low-value transaction through Razorpay in live mode using your own credit card — verify the entire payment-to-access-to-invoice-to-cancellation pipeline works end-to-end so that the first paying customer experiences zero surprises.

## Why This Matters for RealtyFlow
Payment is the moment a stranger becomes a customer. If anything breaks here — gateway error, webhook lag, missing invoice, access not granted — you've burned a hard-won prospect AND damaged trust. Test mode is not enough; live mode has subtle differences (webhooks, fraud checks, 3DS, GST capture). You must do this with your own card before any external user pays.

## User Story
As a founder, I want to execute a real ₹50 live-mode subscription transaction on RealtyFlow using my personal credit card, verify the full pipeline (payment → access granted → invoice emailed → cancellation → access revoked), and document any breaks, so that Day 4 onwards I can confidently invite users knowing the payment flow is bulletproof.

## Acceptance Criteria
- [ ] Razorpay account is in LIVE mode (not test)
- [ ] GST + HSN code configured (per `pre-launch-prep/07`)
- [ ] All legal docs published and linked on pricing/checkout page (per `pre-launch-prep/01`)
- [ ] A ₹50 (or ₹1 for Stripe) test plan exists, OR you use real pricing and refund yourself after
- [ ] You completed a real live-mode subscription purchase
- [ ] Subscription activated in your database within 60 seconds
- [ ] User access tier upgraded automatically (not manually flipped)
- [ ] Tax invoice email arrived within 10 minutes
- [ ] Invoice has correct GSTIN, HSN code, GST split, sequential invoice number
- [ ] You canceled the subscription via in-app flow
- [ ] Access reverted to free tier on next login (or immediately, per your design)
- [ ] Refund processed (if you went with real pricing)
- [ ] Webhook event log shows all expected events fired
- [ ] Customer support email received notification of new signup + cancellation

## Implementation Steps

### Step 1: Verify Razorpay live mode prerequisites
Before touching live mode:
- KYC complete (PAN, GSTIN, bank account, identity verification)
- Settlement bank account verified
- Live API keys generated and in `.env` (NOT committed)
- Webhook URL configured and tested
- Webhook secret matches between Razorpay dashboard and your server

### Step 2: Create a ₹50 test plan in Razorpay (optional)
Two options:
- **Option A:** Create a temporary "Test Plan ₹50/month" in Razorpay dashboard, use it for live testing, delete after.
- **Option B:** Use your actual Starter Plan (₹999) and refund yourself after test passes.

Recommendation: Option A (less paperwork, no real ₹999 sitting in books).

### Step 3: Set up monitoring before transaction
Open 3 tabs:
1. Razorpay dashboard → Payments
2. Your DynamoDB console → user subscription table
3. Server logs (CloudWatch or your log viewer) tailing webhook handler

### Step 4: Execute the live transaction
Use the same incognito session from Day 1 (or a fresh one with a different test email).

1. Navigate to `realtyflow.in/pricing`
2. Select your test plan
3. Click "Start Subscription"
4. Enter real credit/debit card details (your own)
5. Submit
6. Watch for 3DS prompt (Indian cards require this)
7. Complete OTP/PIN
8. Wait for redirect back to app

Log every screen and timing.

### Step 5: Verify subscription activation
Within 60 seconds of successful payment:
- [ ] User's subscription record in DB shows: `status: active`, `plan_id: ...`, `next_billing_date: ...`
- [ ] User's tier flag is correct (e.g., `tier: 'starter'`)
- [ ] Razorpay dashboard shows the subscription
- [ ] Webhook handler logged `subscription.activated` event
- [ ] Webhook handler logged `payment.captured` event

If any of these are missing → critical bug. Debug before proceeding.

### Step 6: Verify access granted
- Log into app with the same user
- Verify tier-specific features are unlocked (e.g., 50 AI call minutes available)
- Verify dashboard shows correct plan
- Verify upgrade CTAs are hidden / replaced with downgrade options

### Step 7: Verify invoice generation
Within 10 minutes:
- [ ] Email arrives at your test inbox
- [ ] Subject line: "RealtyFlow — Tax Invoice for [Plan] — [Invoice #]"
- [ ] PDF attached (or link to download)
- [ ] PDF contains: your GSTIN, customer GSTIN (if you provided), HSN 998314, place of supply, GST split (CGST+SGST or IGST), sequential invoice number
- [ ] Invoice also visible in customer dashboard at `/billing/invoices`
- [ ] Download PDF and verify all fields visually
- [ ] Email yourself the PDF to a non-test address — verify it survives forwarding

### Step 8: Test the cancellation flow
1. Navigate to your account → Subscriptions → Cancel
2. Note: is there a "Are you sure?" modal? A cancel reason survey? (Should be)
3. Submit cancellation
4. Verify:
   - [ ] Razorpay dashboard shows subscription as "cancelled" (or "will end on next renewal")
   - [ ] DB record shows `cancelled_at` timestamp
   - [ ] Webhook handler logged `subscription.cancelled` event
   - [ ] User receives "Subscription cancelled" email
   - [ ] If end-of-period model: access persists until paid period ends
   - [ ] If immediate model: access reverts to free/locked tier right away

### Step 9: Test edge cases
- **Failed payment retry:** simulate a declined card on a test plan — does the user see a helpful error?
- **3DS failure:** abandon OTP screen — does the user land back in checkout, not in limbo?
- **Reactivation after cancel:** can you re-subscribe? Does it create a new sub or revive the old one?
- **Card expiry:** Razorpay sends renewal failures — verify your webhook handles them

### Step 10: Refund yourself (if real money)
If you used real pricing:
- Issue refund via Razorpay dashboard
- Verify credit note generated
- Verify customer email received

Document all this in `payment-test-log.md`.

## Tools / Stack Required
- Razorpay live account (KYC complete)
- Live API keys + webhook secret in `.env`
- Your own credit/debit card (Visa/Mastercard/RuPay all OK; UPI also testable)
- DynamoDB console
- CloudWatch logs
- Email client to verify invoices
- Postman or curl for manual webhook simulation if needed

## Time Estimate
- Pre-test setup verification: 1 hour
- Live transaction execution + monitoring: 1-2 hours
- Cancellation + edge case testing: 1-2 hours
- Documentation: 30 min
- **Total: half a day**

## Deliverables
- `marketing-and-sales/launch-plan/week-1-foundation/assets/payment-test-log.md` — full test record
- Saved invoice PDF: `assets/test-invoices/test-01-starter-monthly.pdf`
- Webhook event log screenshots
- Any new bugs filed in `friction-backlog.md` (Day 12 retest)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Live mode webhook fires to localhost (dev) — production blind | Use a tunnel like ngrok if needed, but configure production webhook URL before testing |
| Real money charged and you forget to refund | Use ₹50 plan for testing OR set a 24h reminder to refund |
| Webhook arrives late (>60s) — looks broken | Razorpay webhooks usually <5s. If slow, check your webhook server health |
| Subscription not activating despite payment success | Check webhook secret matches; check `payment.captured` is being handled, not just `payment.authorized` |
| Invoice missing fields | Re-verify pre-launch-prep/07 configuration; CA-review template before going live |
| Cancellation doesn't revoke access | Confirm whether your model is "cancel-at-period-end" or "immediate"; document in customer FAQ |

## India-Specific Notes
- Indian cards REQUIRE 3DS (2-factor) — test this with real card
- RBI mandate: card details cannot be stored unless tokenized. Razorpay handles tokenization; verify "Save card for next payment" works correctly
- UPI Autopay limit: ₹15,000/month per transaction. Higher amounts need eMandate.
- For B2B plans, GSTIN capture is critical — test with and without GSTIN
- Razorpay charges 2% + GST per transaction — note this in your unit economics

## Connected Days / Dependencies
- **Blocks:** Day 6 (Landing Page Funnel — pricing CTAs need working payment), Day 14 (testimonials may include "smooth payment")
- **Depends on:** `pre-launch-prep/01` (legal docs), `pre-launch-prep/07` (GST), Day 2 (no friction blocking checkout)

## Success Metric
- Live payment + invoice + access provisioning + cancellation all work end-to-end in <15 minutes
- Zero manual intervention needed in DB or Razorpay dashboard
- Invoice passes CA review (already done in prep) and your own visual check
- You feel confident that the next person to pay (a real customer) will have a clean experience
