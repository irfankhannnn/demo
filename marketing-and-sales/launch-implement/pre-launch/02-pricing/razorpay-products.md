# Razorpay Products & Plans — RealEstateFlow

**Payment processor:** Razorpay  
**HSN/SAC:** 998314 (IT software services)  
**GST rate:** 18%  
**Canonical pricing:** `marketing-and-sales/launch-plan-v2/pricing.json`  
**Last updated:** 2026-06-11

---

## Product Overview

Create **4 Razorpay Products**, each with one or more **Plans**:

| Product ID | Display name | Base price (excl. GST) | Billing |
|------------|--------------|------------------------|---------|
| `ref_solo` | RealEstateFlow Solo | ₹999/mo | Monthly + Annual |
| `ref_team` | RealEstateFlow Team | ₹1,999/mo | Monthly + Annual |
| `ref_teamplus` | RealEstateFlow Team+ | ₹1,999/mo + seats | Monthly + Annual + seat add-on |
| `ref_ai_employee` | RealEstateFlow AI Employee | ₹7,999/mo | Monthly only |

**Tax settings:** `tax_inclusive = false` on all products. GST calculated at checkout.

---

## Plan Matrix

### Solo

| Plan ID | Interval | Amount (paise) | Amount (INR) | Notes |
|---------|----------|----------------|--------------|-------|
| `solo_monthly` | monthly | 99900 | ₹999 | 14-day trial via app logic |
| `solo_annual` | yearly | 959000 | ₹9,590 | 20% off (999 × 12 × 0.8) |

### Team

| Plan ID | Interval | Amount (paise) | Amount (INR) | Notes |
|---------|----------|----------------|--------------|-------|
| `team_monthly` | monthly | 199900 | ₹1,999 | 14-day trial via app logic |
| `team_annual` | yearly | 1919000 | ₹19,190 | 20% off |

### Team+

| Plan ID | Interval | Amount (paise) | Amount (INR) | Notes |
|---------|----------|----------------|--------------|-------|
| `teamplus_monthly` | monthly | 199900 | ₹1,999 | Base 3 seats |
| `teamplus_annual` | yearly | 1919000 | ₹19,190 | Base 3 seats |
| `teamplus_seat_monthly` | monthly | 50000 | ₹500/seat | Add-on plan; prorated on `subscription.updated` |

**Seat logic:** When member count exceeds 3, attach `teamplus_seat_monthly` with quantity = (members − 3). Prorate via Razorpay subscription update API.

### AI Employee

| Plan ID | Interval | Amount (paise) | Amount (INR) | Notes |
|---------|----------|----------------|--------------|-------|
| `ai_employee_monthly` | monthly | 799900 | ₹7,999 | No trial; no annual |

---

## Razorpay Dashboard Setup

### 1. Tax settings
- **Location:** Settings → Account & Settings → Tax Settings
- Enter GSTIN: `{{COMPANY_GSTIN}}`
- State: Maharashtra
- Place of supply: Auto-detect from billing address
- Default HSN: **998314**

### 2. Branding
- **Location:** Settings → Branding
- Logo: `https://realestateflow.in/assets/logos/final/logo.png`
- Company name: `{{COMPANY_LEGAL_NAME}}`
- Address: `{{COMPANY_ADDRESS}}`
- CIN: `{{COMPANY_CIN}}`

### 3. Create products
For each product:
1. Products → Create Product
2. Name: as per table above
3. HSN: 998314
4. Tax inclusive: **No**

### 4. Create plans
For each plan:
1. Plans → Create Plan on respective product
2. Billing cycle: monthly or yearly
3. Amount in paise (see matrix)
4. Description: include plan features (copy from `pricing.json`)

### 5. Webhooks
- **URL:** `https://api.realestateflow.in/billing/webhook`
- **Events to subscribe:**
  - `subscription.charged`
  - `subscription.completed`
  - `subscription.cancelled`
  - `subscription.paused`
  - `subscription.updated` (seat increments)
  - `payment.failed`
  - `payment.captured`
  - `refund.processed`

### 6. Invoice settings
- Auto-email invoice: **ON**
- Invoice template: per `pre-launch/07-gst/invoice-template.md`

---

## Test Mode Plan IDs

Capture after creation and store in `razorpay-plan-ids.md`:

```
TEST_SOLO_MONTHLY=rzp_test_plan_XXXXX
TEST_SOLO_ANNUAL=rzp_test_plan_XXXXX
TEST_TEAM_MONTHLY=rzp_test_plan_XXXXX
TEST_TEAM_ANNUAL=rzp_test_plan_XXXXX
TEST_TEAMPLUS_MONTHLY=rzp_test_plan_XXXXX
TEST_TEAMPLUS_ANNUAL=rzp_test_plan_XXXXX
TEST_TEAMPLUS_SEAT=rzp_test_plan_XXXXX
TEST_AI_EMPLOYEE_MONTHLY=rzp_test_plan_XXXXX
```

## Live Mode Plan IDs

Capture after KYC approval:

```
LIVE_SOLO_MONTHLY=rzp_live_plan_XXXXX
...
```

---

## Subscription Lifecycle

```
signup → 14-day trial (Solo/Team/Team+)
       → trial ends → select plan → Razorpay subscription created
       → payment.captured → subscription.charged → invoice emailed
       → seat added → subscription.updated → prorated charge
       → cancel → subscription.cancelled → access until period end
```

**AI Employee flow:**
```
purchase add-on → no trial → immediate charge
              → concierge SOP triggered
              → ai_employee_provisioned event
```

---

## Supported Payment Methods

UPI · Credit/debit card · Net banking · Wallet (per Razorpay India config)

---

## Compliance Notes

- All invoices must show HSN 998314
- Maharashtra customers: CGST 9% + SGST 9%
- Inter-state: IGST 18%
- Refund policy cross-linked in invoice terms footer
- AI Employee: disclose "non-refundable" at checkout checkbox
