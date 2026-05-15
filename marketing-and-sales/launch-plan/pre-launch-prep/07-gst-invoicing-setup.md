# Pre-Launch Prep — 07: GST-Compliant Invoicing Setup

## Objective
Configure Razorpay (or your payment processor) to generate GST-compliant tax invoices the moment a customer pays — with GSTIN capture, HSN/SAC code, place of supply, and CGST/SGST or IGST split — so Indian B2B customers can claim input tax credit and don't churn over invoice issues.

## Why This Matters for RealtyFlow
Indian B2B customers buy SaaS through their company. Their CA needs a GST-compliant invoice to claim Input Tax Credit (ITC) — typically saving them 18% on the bill. Without this, their CA rejects the bill, they ask for a "proper invoice", you spend hours fixing it manually, and worst case they cancel. This is a Month 1 churn cause that's 100% preventable.

## User Story
As a founder, I want Razorpay to capture customer GSTIN at checkout and auto-generate a GST-compliant tax invoice (with HSN code 998314, place of supply, GST split, my GSTIN) within 10 minutes of payment, so that B2B customers can claim ITC without manual intervention and never churn over invoice issues.

## Acceptance Criteria
- [ ] Your company has a GSTIN (apply if not — takes 7-15 days)
- [ ] Razorpay account upgraded to "GST Invoice" support
- [ ] Razorpay checkout has "Add GSTIN (optional)" field
- [ ] Invoice template configured with required fields (see Step 4)
- [ ] HSN/SAC code set to 998314 (SaaS — Software as a Service)
- [ ] Place of supply logic correct (CGST+SGST for same-state, IGST for inter-state)
- [ ] Auto-email invoice triggers within 10 min of payment
- [ ] Test invoice generated and verified by a CA or accountant
- [ ] Customer-facing FAQ explains "Can I add GSTIN later?" (yes — within same fiscal year)
- [ ] Invoice retrievable from customer dashboard (self-serve)
- [ ] Failed payment / refund / cancellation flows update GST records correctly

## Implementation Steps

### Step 1: Obtain GSTIN (if not already done)
If your company turnover is/will be under ₹20 lakh/year, GSTIN is technically optional. But:
- B2B customers will NOT trust a "no GSTIN" vendor
- You can't claim ITC on your own purchases (Razorpay fees, AWS, Google Workspace, etc.)
- Once you cross ₹20L, you need it anyway

**Recommendation:** Apply on Day -30 if not yet. It takes 7-15 days. Use [gst.gov.in](https://gst.gov.in).

Documents needed:
- Company PAN
- Director PAN + Aadhaar
- Bank account details
- Registered office address proof (rental agreement / utility bill)
- Director photos
- Authorized signatory ID

### Step 2: Understand SaaS GST treatment (10-minute education)
- **HSN/SAC code for SaaS:** 998314 ("Information technology (IT) design and development services" — also used for SaaS subscriptions)
- **GST rate for SaaS:** 18% (current as of 2026)
- **Place of supply logic:**
  - If your company state == customer state → CGST 9% + SGST 9% (split equally, totals 18%)
  - If different states → IGST 18%
- **For unregistered customers** (no GSTIN — like solo agents on Tier 1): charge GST same way based on their state, but they can't claim ITC
- **For export of services** (Dubai customer, etc.): zero-rated supply, no GST charged — needs LUT (Letter of Undertaking) filing

### Step 3: Configure Razorpay
Razorpay has built-in GST invoice support.

1. Razorpay Dashboard → Settings → Business → Update GSTIN
2. Settings → Tax Profile → Add HSN/SAC: 998314
3. Settings → Tax Profile → GST Rate: 18%
4. Settings → Invoices → Enable "Auto-generate GST invoice"
5. Settings → Invoices → Configure invoice template (next step)
6. Settings → Checkout → Enable "Capture GSTIN" field at checkout

### Step 4: Invoice template — required fields
A GST-compliant invoice must include:

| Field | Source |
|-------|--------|
| Invoice number (sequential) | Razorpay auto |
| Invoice date | Razorpay auto |
| Your company name + address + GSTIN + PAN | Configured in Razorpay |
| Customer name + address + GSTIN (if provided) | Captured at checkout |
| HSN/SAC code (998314) | Configured |
| Description ("RealtyFlow Professional Plan — Monthly") | Configured per plan |
| Taxable value (price before GST) | Auto |
| CGST / SGST / IGST breakup | Auto based on place of supply |
| Total payable | Auto |
| Place of supply (state code, e.g., "Maharashtra (27)") | From customer address |
| "Reverse charge: No" | Default |
| Signature (digital, your company stamp) | Upload to Razorpay |

### Step 5: Checkout flow — capture GSTIN
At Razorpay checkout, add (or enable) field: "GSTIN (optional, for tax invoice)"

UX recommendations:
- Optional, not required (don't lose Tier 1 solo agents who don't have GSTIN)
- Inline validation (15 chars, alphanumeric format)
- Tooltip: "Enter your GSTIN to claim Input Tax Credit on this purchase"
- Save on customer profile for future invoices

### Step 6: Place of supply logic
Razorpay auto-determines this from customer's billing address state. Verify:
- Customer in Maharashtra + you in Maharashtra → CGST 9% + SGST 9%
- Customer in Karnataka + you in Maharashtra → IGST 18%
- Customer in Dubai (foreign) → handle separately (zero-rated export of services)

If you operate cross-state, double-check this logic with test transactions.

### Step 7: Test transactions
Run 3 test transactions with different scenarios:
1. Customer in your home state with GSTIN → expect CGST+SGST split, invoice has both GSTINs
2. Customer in different state with GSTIN → expect IGST, invoice has both GSTINs
3. Customer with NO GSTIN → expect GST charged but only your GSTIN on invoice

For each test:
- Verify invoice number is sequential
- Verify HSN code 998314 present
- Verify all required fields present
- Save PDF to `marketing-and-sales/launch-plan/pre-launch-prep/assets/test-invoices/`
- Email a copy to a CA for review

### Step 8: Auto-email + customer dashboard
- Trigger: payment success webhook → fire invoice email
- Subject: "RealtyFlow — Tax Invoice for [Plan] — [Invoice #]"
- Attached PDF + body link to customer dashboard
- Customer dashboard route: `/billing/invoices` lists all past invoices, downloadable

### Step 9: Edge cases
- **Refund:** issue credit note with reference to original invoice number
- **Plan upgrade mid-cycle:** pro-rated invoice with adjustment line
- **Annual plan paid upfront:** single invoice for full year
- **Failed payment retry:** don't issue invoice until success
- **Customer adds GSTIN after invoice generated:** allow re-issue within same fiscal year (technically allowed, but mark as "Revised")

### Step 10: Document for customers
Add to your help docs / FAQ:
- "How to add my GSTIN" (during checkout OR via dashboard)
- "Where to download my invoices" (dashboard link)
- "Can I get a revised invoice?" (yes — email support within same financial year)
- "Do you charge GST?" (yes — 18% on SaaS subscriptions as per Indian law)

## Tools / Stack Required
- Razorpay account (live mode)
- Razorpay GST Invoice add-on (enabled in dashboard)
- Your GSTIN
- CA or accountant for invoice review (₹1-3k one-time consult)
- Test bank account with multiple states (for test transactions)

## Time Estimate
- GSTIN application (if needed): 7-15 days (separate)
- Razorpay configuration: 3-4 hours
- Test transactions + verification: 2-3 hours
- CA review: 1-2 days turnaround

## Deliverables
- GSTIN configured in Razorpay
- 3 test invoices PDFs in `assets/test-invoices/`
- CA approval email/document
- Customer FAQ section published
- Customer dashboard "Invoices" page live

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Wrong HSN code → invoice rejected by customer's CA | Use 998314, validated by CA review |
| Place of supply logic wrong → wrong GST split | Test with multiple states; rely on Razorpay's built-in logic |
| You don't have GSTIN by Day 3 | Apply on Day -30. Without it, accept payments but issue manual invoices and add GSTIN to all retroactively when received |
| First invoice has format errors | Run test transactions and CA review BEFORE first real customer |
| Customer pays without GSTIN, asks for revised invoice later | Build "revise invoice" admin function early |

## India-Specific Notes
- "Reverse charge" applies in some B2B scenarios (services from unregistered to registered). For SaaS, you're the supplier — reverse charge = No.
- E-invoicing mandatory for businesses with turnover >₹5 crore. Below that, regular invoice works. Plan to upgrade Razorpay when you cross that threshold.
- Dubai customers (zero-rated export) need a separate invoice format. Defer to Month 3 when expanding to UAE — for now, India only.
- TCS (Tax Collected at Source) may apply if you sell via marketplaces like AWS Marketplace. Not relevant for direct Razorpay billing.

## Connected Days / Dependencies
- **Blocks:** Day 3 (payment go-live)
- **Depends on:** GSTIN obtained, Razorpay live mode active

## Success Metric
- First 5 paying customers don't request invoice corrections
- 100% of test invoices pass CA review
- Customer "where's my invoice" support tickets = 0 in Month 1
