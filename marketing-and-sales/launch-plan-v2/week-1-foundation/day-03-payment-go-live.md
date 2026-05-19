# Day 03 — Payment Go-Live (Razorpay Live Mode + ₹1 Test Invoice)

> **Type:** 🧍 MANUAL
> **Phase:** Week 1
> **Skill(s):** `revops`
> **Estimated time:** 4h founder

## Objective
Switch Razorpay from test mode to live mode, run a real ₹1 test transaction end-to-end (subscription → invoice → settlement), and confirm CA acceptance of the live invoice — so Day 4 onwards any signup can convert to paid without further blockers.

## Why This Matters for RealEstateFlow
Until live KYC clears + a real invoice prints + settlement lands in the bank account, "we accept payment" is theoretical. Day 3 burns this risk.

## User Story
As founder, I want Razorpay live mode confirmed working with a CA-acceptable ₹1 invoice, so the next paid signup (potentially Day 9 beta tester or Day 17 cold prospect) is automatically billed.

## Acceptance Criteria
- [ ] Razorpay KYC status = APPROVED
- [ ] Live mode active in Razorpay dashboard
- [ ] All 4 Products (Solo, Team, Team+, AI Employee) cloned from test → live with new live plan IDs
- [ ] All 9 Plans active in live (Solo monthly+annual, Team monthly+annual, Team+ monthly + add_seat, AI Employee monthly)
- [ ] Live plan IDs captured in `pricing.json.razorpayPlanIds.live` block
- [ ] Webhook URL `https://api.realestateflow.in/api/billing/webhook` registered in live mode + secret captured + env updated
- [ ] ₹1 test subscription created on Solo plan with founder's personal phone + Maharashtra GSTIN dummy
- [ ] Test payment captured; invoice PDF generated; auto-emailed to test customer
- [ ] CA reviews live invoice + signs off (email/WhatsApp confirmation)
- [ ] Settlement to founder's bank account confirmed (T+1 cycle)
- [ ] PostHog server event `subscription_started` fired (verifies P11 webhook chain)
- [ ] Refund initiated for the ₹1 test (since it's just a smoke test)
- [ ] Status: 🟢 LIVE in `00-DECISIONS-LOG.md`
- [ ] BetterStack monitor added for `/api/billing/webhook` 200 OK

## Manual Steps (🧍)

1. **Verify KYC** in Razorpay dashboard → Settings → Account & Settings. Status = APPROVED.
2. **Switch live mode** via the Test/Live toggle (top-right).
3. **Re-create products + plans** in live: copy from test mode using Razorpay's clone feature OR manually re-create per `pre-launch/02-pricing/razorpay-products.md` + `pre-launch/07-gst/razorpay-config-checklist.md`.
4. **Capture live plan IDs** into `pricing.json.razorpayPlanIds.live`. Update Lambda env vars + redeploy.
5. **Register live webhook** at Settings → Webhooks → Add webhook URL `https://api.realestateflow.in/api/billing/webhook`. Events: `subscription.activated, subscription.charged, subscription.cancelled, subscription.paused, subscription.updated, payment.captured, payment.failed, refund.processed`. Capture webhook secret to env `RAZORPAY_WEBHOOK_SECRET_LIVE`.
6. **Test the chain**:
   a. Open `realestateflow.in/pricing` → click "Solo / Start free trial" → register a real test user (founder's personal phone)
   b. Wait until paywall shows (or directly trigger upgrade flow)
   c. Pick Solo plan → Razorpay checkout opens in live mode
   d. Pay ₹1 (use UPI / netbanking) — it should be the discounted plan price; if Solo is ₹999 not ₹1, create a temporary ₹1 plan for the smoke test instead
   e. Verify invoice PDF generated + auto-emailed
   f. Verify webhook received: check CloudWatch logs for `subscription.charged` + DDB Subscriptions row updated + PostHog event landed
   g. Verify SPA: trial banner gone, paying customer state, billing history page shows the invoice
7. **Send invoice to CA**: WhatsApp/email the PDF; ask for sign-off using `pre-launch/07-gst/ca-sign-off-checklist.md`. Wait for confirmation (usually <1h).
8. **Settlement check**: T+1 next day, log into bank account, confirm settlement amount minus Razorpay fees.
9. **Refund the test ₹1** via Razorpay → Subscriptions → cancel + refund.
10. **BetterStack monitor**: add HTTP check on `/api/billing/webhook` (HEAD request returns 200 if endpoint healthy).
11. **Daily standup** in `daily-log/day03.md` with screenshot of live invoice.
12. **Tick ACs** + log "Razorpay live ₹1 invoice CA-approved YYYY-MM-DD" to `00-DECISIONS-LOG.md`.

## Inputs
- Razorpay live KYC complete (P18 dependency)
- P7 outputs (invoice template + checklist)
- Founder bank account
- Founder's CA contact

## Outputs
- Razorpay live mode active
- Updated `pricing.json` with live plan IDs
- Live webhook secret in env vars
- Signed-off live invoice PDF saved at `marketing-and-sales/launch-implement/week-1/day-03-live-invoice-signed.pdf`
- BetterStack monitor active
- `daily-log/day03.md`

## Success Criterion
Live invoice generated + CA approved + settlement confirmed; webhook chain verified end-to-end.

## Fallback / Plan B
If KYC still pending: defer payment go-live; soft launch Day 9 in trial-only mode (no paid plans available); revisit daily until KYC clears. Do NOT delay launch.

## Risks
| Risk | Mitigation |
|---|---|
| KYC not yet approved | Track daily via P18; Plan B = trial-only soft launch |
| Live webhook secret leaked | Rotate immediately; secret in 1Password only; CloudTrail audit |
| Settlement bank rejects | Verify IFSC + account name match entity name (not founder) |
| CA rejects invoice format | Iterate via P7 invoice template |
| Live mode plans missing fields | Cross-check vs test mode using `razorpay-config-checklist.md` |

## India / Mumbai-Specific Notes
- HSN 998314 must show on live invoice (CA-critical)
- Maharashtra GSTIN test customer: CGST+SGST split (verify on PDF)
- Settlement T+1 = next-business-day; allow weekends

## Dependencies
- **Blocks:** Day 9 paid beta invites (some testers may convert mid-trial), Day 26 trial-to-paid follow-up
- **Depends on:** P7 (Razorpay config), P11 (webhook), P14 (paywall), P18 (KYC)

## Connected Skills
- `revops` — payment ops
- `pr-review` — final webhook review (if any code fixed Day 3)
