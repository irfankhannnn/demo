# CA Sign-Off Checklist — Test Invoice

**Company:** {{COMPANY_LEGAL_NAME}}  
**GSTIN:** {{COMPANY_GSTIN}}  
**Test invoice date:** {{TEST_INVOICE_DATE}}  
**Prepared for:** Founder CA review before Razorpay live mode

---

## Invoice Identity

- [ ] Invoice number is sequential and unique (e.g., INV-2026-00001)
- [ ] Invoice date in **DD/MM/YYYY** format (Indian convention)
- [ ] Supplier name matches registered entity: {{COMPANY_LEGAL_NAME}}
- [ ] Supplier GSTIN matches GST portal: {{COMPANY_GSTIN}}
- [ ] Supplier PAN displayed: {{COMPANY_PAN}}
- [ ] Registered office address complete: {{COMPANY_ADDRESS}}, Mumbai
- [ ] CIN displayed: {{COMPANY_CIN}}

---

## Customer Block

- [ ] Customer legal name present
- [ ] Customer billing address with state
- [ ] Customer GSTIN present (for B2B test)
- [ ] Place of supply state code shown (e.g., 27 for Maharashtra)
- [ ] Customer email for delivery

---

## Line Items

- [ ] Description clearly states plan (e.g., "RealEstateFlow Solo Plan — Monthly Subscription")
- [ ] **HSN 998314** present and correct for SaaS/IT software services
- [ ] Quantity shown
- [ ] Unit price **exclusive of tax**
- [ ] Taxable value = unit price × quantity

---

## Tax Calculation

### Maharashtra test (intra-state)

- [ ] CGST @ 9% calculated correctly
- [ ] SGST @ 9% calculated correctly
- [ ] CGST + SGST = 18% of taxable value
- [ ] Example: ₹999 taxable → CGST ₹89.91 + SGST ₹89.91 = ₹179.82 tax

### Inter-state test (if applicable)

- [ ] IGST @ 18% calculated correctly (no CGST/SGST split)
- [ ] Place of supply reflects customer state

---

## Totals

- [ ] Subtotal (taxable value) correct
- [ ] Total tax amount correct
- [ ] Grand total = taxable value + tax
- [ ] Amount in words present and matches grand total (INR)
- [ ] Currency shown as INR / ₹

---

## Compliance Fields

- [ ] Reverse charge field present (even if "No")
- [ ] HSN summary at line level
- [ ] Format complies with **CGST Rule 46**
- [ ] Invoice is valid for **Input Tax Credit (ITC)** claim by registered B2B customer
- [ ] Credit note process documented for refunds

---

## Branding & Signatory

- [ ] Company logo renders correctly
- [ ] Authorised signatory name: {{FOUNDER_NAME}}
- [ ] Signatory title: Founder & CEO (or equivalent)
- [ ] "Computer-generated invoice" disclaimer present

---

## Razorpay Integration

- [ ] Invoice auto-emailed to customer on `subscription.charged`
- [ ] PDF downloadable from Razorpay-hosted URL
- [ ] Invoice appears in CRM **Settings → Billing**
- [ ] GSTR-1 export columns match CA filing requirements

---

## Plan-Specific Tests

| Plan | Taxable (excl.) | Expected total (Maharashtra, incl. 18%) | Tested? |
|------|-----------------|----------------------------------------|---------|
| Solo monthly | ₹999 | ₹1,178.82 | ☐ |
| Team monthly | ₹1,999 | ₹2,358.82 | ☐ |
| Team+ seat add-on | ₹500 | ₹590.00 | ☐ |
| AI Employee monthly | ₹7,999 | ₹9,438.82 | ☐ |
| Solo annual | ₹9,590 | ₹11,316.20 | ☐ |

---

## CA Sign-Off

| | |
|---|---|
| **CA name** | {{CA_NAME}} |
| **Firm** | {{CA_FIRM}} |
| **Date** | {{CA_SIGNOFF_DATE}} |
| **Approved for live invoicing?** | ☐ Yes ☐ No — corrections needed |
| **Notes** | |

---

**Send test invoice PDF to CA with this checklist. Capture approval via email/WhatsApp. Log to `00-DECISIONS-LOG.md`.**
