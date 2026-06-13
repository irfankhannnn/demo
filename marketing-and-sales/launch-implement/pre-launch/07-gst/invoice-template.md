# GST Invoice Template Spec — Razorpay

**HSN/SAC:** 998314 (IT software services)  
**GST rate:** 18%  
**Company:** {{COMPANY_LEGAL_NAME}}  
**Last updated:** 2026-06-11

---

## Header Block

```
[LOGO]
https://realestateflow.in/assets/logos/final/logo.png

{{COMPANY_LEGAL_NAME}}
CIN: {{COMPANY_CIN}}
GSTIN: {{COMPANY_GSTIN}}
PAN: {{COMPANY_PAN}}
Registered Office: {{COMPANY_ADDRESS}}, Mumbai, Maharashtra, India
Email: info@realestateflow.in
Website: realestateflow.in
```

---

## Invoice Metadata

| Field | Format | Example |
|-------|--------|---------|
| Invoice number | Auto-increment (Razorpay) | INV-2026-00042 |
| Invoice date | DD/MM/YYYY | 11/06/2026 |
| Due date | Same as invoice date (prepaid subscription) | 11/06/2026 |
| Billing cycle | Monthly / Annual | Monthly |
| Payment terms | Prepaid | Due on receipt |

---

## Customer Block

| Field | Required | Notes |
|-------|----------|-------|
| Customer name | Yes | Agency or individual name |
| Customer GSTIN | B2B: Yes | 15-character GSTIN |
| Billing address | Yes | Full address with state |
| Place of supply | Auto | State code from billing address |
| Customer email | Yes | Invoice delivery |

---

## Line Items Table

| # | Description | HSN | Qty | Unit price (excl. tax) | Taxable value |
|---|-------------|-----|-----|------------------------|---------------|
| 1 | RealEstateFlow Solo Plan — Monthly Subscription | 998314 | 1 | ₹999.00 | ₹999.00 |

**Variant descriptions:**
- `RealEstateFlow Team Plan — Monthly Subscription`
- `RealEstateFlow Team+ Plan — Monthly Subscription (Base 3 seats)`
- `RealEstateFlow Team+ — Additional Seat (Prorated)`
- `RealEstateFlow AI Employee Add-on — Monthly Subscription`
- `RealEstateFlow Solo Plan — Annual Subscription`
- `RealEstateFlow Team Plan — Annual Subscription`

---

## Tax Breakdown

### Maharashtra customer (Place of supply: Maharashtra / State code 27)

| Component | Rate | Amount |
|-----------|------|--------|
| Taxable value | — | ₹999.00 |
| CGST | 9% | ₹89.91 |
| SGST | 9% | ₹89.91 |
| **Total tax** | 18% | **₹179.82** |
| **Grand total** | — | **₹1,178.82** |

### Inter-state customer (Place of supply: other state)

| Component | Rate | Amount |
|-----------|------|--------|
| Taxable value | — | ₹999.00 |
| IGST | 18% | ₹179.82 |
| **Grand total** | — | **₹1,178.82** |

### Example — Team plan (Maharashtra)

| Component | Amount |
|-----------|--------|
| Taxable value | ₹1,999.00 |
| CGST 9% | ₹179.91 |
| SGST 9% | ₹179.91 |
| **Grand total** | **₹2,358.82** |

**Amount in words:** Indian Rupees Two Thousand Three Hundred Fifty Eight and Eighty Two Paise Only

---

## Reverse Charge

```
Reverse Charge Applicable: ☐ Yes  ☑ No
```

Default **No** for B2B SaaS. Flag manually only for unregistered B2B edge cases per CA guidance.

---

## Footer / Terms

```
Payment received via Razorpay. Thank you for your business.

Refund Policy: Solo, Team, and Team+ plans include a 30-day money-back guarantee
for first-time subscribers (terms apply). AI Employee add-on is non-refundable.
Full policy: https://realestateflow.in/legal/refund

This is a computer-generated invoice and is valid without physical signature.

Authorised Signatory:
{{FOUNDER_NAME}}
Founder & CEO, {{COMPANY_LEGAL_NAME}}
```

---

## Razorpay Template Fields Mapping

| Razorpay field | Value |
|----------------|-------|
| Company name | {{COMPANY_LEGAL_NAME}} |
| Company GSTIN | {{COMPANY_GSTIN}} |
| Company address | {{COMPANY_ADDRESS}} |
| HSN code | 998314 |
| Tax inclusive | No |
| Place of supply | Auto-detect |
| Invoice prefix | INV |
| Logo URL | https://realestateflow.in/assets/logos/final/logo.png |

---

## Credit Note (Refunds)

When refund processed, issue credit note referencing original invoice:

| Field | Value |
|-------|-------|
| Credit note number | CN-2026-XXXXX |
| Original invoice | INV-2026-XXXXX |
| Reason | Refund per Refund Policy |
| Amount | Match refunded amount incl. GST reversal |

---

## CA Notes

- Format complies with **CGST Rule 46**
- HSN 998314 confirmed for SaaS subscription services
- Annual plan: GST on full annual taxable value at issuance
- Seat proration: separate line item with prorated taxable value
