# Razorpay Configuration Checklist

**Dashboard:** https://dashboard.razorpay.com  
**Webhook URL:** `https://api.realestateflow.in/billing/webhook`  
**Last updated:** 2026-06-11

---

## Prerequisites

- [ ] Razorpay KYC complete (business entity verified)
- [ ] Bank account linked for settlements
- [ ] `pricing.json` and `razorpay-products.md` reviewed
- [ ] Legal pages live (ToS, Privacy, Refund)

---

## Step 1 — Tax Settings

| Action | Location | Expected result |
|--------|----------|-----------------|
| Enter GSTIN | Settings → Tax Settings | {{COMPANY_GSTIN}} saved |
| Set state | Tax Settings | Maharashtra (27) |
| Enable place-of-supply auto-detect | Tax Settings | ON |
| Default HSN | Tax Settings | 998314 |

**Verify:** Create test invoice → place of supply auto-populates from billing address.

---

## Step 2 — Branding

| Action | Location | Value |
|--------|----------|-------|
| Upload logo | Settings → Branding | logo.png from realestateflow.in |
| Company name | Branding | {{COMPANY_LEGAL_NAME}} |
| Address | Branding | {{COMPANY_ADDRESS}} |
| CIN | Branding | {{COMPANY_CIN}} |
| Signatory | Branding | {{FOUNDER_NAME}} |

---

## Step 3 — Create Products (4)

| Product name | HSN | Tax inclusive |
|--------------|-----|---------------|
| RealEstateFlow Solo | 998314 | No |
| RealEstateFlow Team | 998314 | No |
| RealEstateFlow Team+ | 998314 | No |
| RealEstateFlow AI Employee | 998314 | No |

---

## Step 4 — Create Plans (9)

| Plan ID | Product | Interval | Amount (paise) | INR |
|---------|---------|----------|----------------|-----|
| `solo_monthly` | Solo | monthly | 99900 | ₹999 |
| `solo_annual` | Solo | yearly | 959000 | ₹9,590 |
| `team_monthly` | Team | monthly | 199900 | ₹1,999 |
| `team_annual` | Team | yearly | 1919000 | ₹19,190 |
| `teamplus_monthly` | Team+ | monthly | 199900 | ₹1,999 |
| `teamplus_annual` | Team+ | yearly | 1919000 | ₹19,190 |
| `teamplus_seat_monthly` | Team+ | monthly | 50000 | ₹500/seat |
| `ai_employee_monthly` | AI Employee | monthly | 799900 | ₹7,999 |

**Capture plan IDs** → `razorpay-plan-ids.md` (test + live separately)

---

## Step 5 — Webhooks

| Setting | Value |
|---------|-------|
| URL | `https://api.realestateflow.in/billing/webhook` |
| Secret | Store in Lambda env `RAZORPAY_WEBHOOK_SECRET` |
| Events | `subscription.charged`, `subscription.completed`, `subscription.cancelled`, `subscription.paused`, `subscription.updated`, `payment.failed`, `payment.captured`, `refund.processed` |

**Verify:** Razorpay dashboard → Webhooks → send test event → 200 OK from API.

---

## Step 6 — Invoice Settings

- [ ] Auto-email invoice: **ON**
- [ ] Invoice template customised per `invoice-template.md`
- [ ] HSN 998314 on all line items
- [ ] CGST/SGST split for Maharashtra; IGST for inter-state

---

## Step 7 — Test Mode Validation

- [ ] Create test subscription on Solo monthly
- [ ] Pay with Razorpay test card
- [ ] Confirm `payment.captured` webhook received
- [ ] Confirm invoice PDF generated and emailed
- [ ] Download invoice → run through `ca-sign-off-checklist.md`
- [ ] Process test refund → confirm `refund.processed` webhook

---

## Step 8 — Live Mode

- [ ] Switch to live mode (KYC gated)
- [ ] Recreate products/plans in live (or activate live plans)
- [ ] Capture live plan IDs
- [ ] Process ₹1 live test payment on Solo
- [ ] Refund ₹1 test payment
- [ ] CA sign-off on live invoice PDF

---

## Step 9 — CRM Integration

- [ ] `GET /billing/invoices` returns tenant-scoped invoice list
- [ ] PDF download links open Razorpay-hosted PDF
- [ ] `subscription_started` PostHog event fires on webhook
- [ ] Seat increment triggers `subscription.updated` + prorated charge

---

## Step 10 — Env Vars (Lambda + CRM)

```
RAZORPAY_KEY_ID=rzp_live_XXXXX
RAZORPAY_KEY_SECRET=XXXXX
RAZORPAY_WEBHOOK_SECRET=XXXXX
RAZORPAY_PLAN_SOLO_MONTHLY=rzp_live_plan_XXXXX
... (all plan IDs)
```

---

## Sign-Off

| Milestone | Date | Signed |
|-----------|------|--------|
| Test invoice CA approved | | |
| Live mode activated | | |
| First real customer invoiced | | |

Log to `00-DECISIONS-LOG.md`.
