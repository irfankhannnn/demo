# P7 — GST Invoicing Setup (HSN 998314 + Razorpay Plans)

> **Type:** 🤖 AUTO + 🧍 MANUAL
> **Phase:** Pre-launch
> **Day / Block:** T-3
> **Skill(s):** `revops`
> **Estimated time:** 1h founder · 2h AI

## Objective
Configure Razorpay GST settings + invoice template (HSN 998314) so every paid customer gets a CA-acceptable Indian GST invoice automatically, with CGST/SGST split for Maharashtra customers and IGST for inter-state, place-of-supply auto-resolved.

## Why This Matters for RealEstateFlow
Indian B2B customers' CAs reject invoices that lack HSN, GSTIN, place-of-supply, or proper tax split. Without proper invoicing the customer cannot claim Input Tax Credit (ITC), which directly hits our renewal rate. Razorpay handles auto-invoice generation when configured — we just need to set HSN + GSTIN + place-of-supply correctly.

## User Story
As a Mumbai broker who paid for Solo or Team plan, I want a CA-acceptable GST invoice with HSN 998314 + my GSTIN + correct CGST/SGST split downloadable from `Settings → Billing`, so my CA claims input tax credit without back-and-forth.

## Acceptance Criteria
- [ ] Razorpay GST settings live: GSTIN entered, place-of-supply auto-resolution enabled, default HSN = 998314
- [ ] All 4 Razorpay Products (Solo, Team, Team+, AI Employee) configured with `tax_inclusive=false` and HSN 998314
- [ ] Razorpay invoice template customized with company logo + registered office + CIN + reverse-charge field for unregistered B2B
- [ ] Test ₹1 invoice rendered + downloaded + verified by founder's CA → 200 OK + acceptable to claim ITC
- [ ] Invoice includes:
  - Invoice number (auto-incremented Razorpay)
  - Invoice date
  - Customer name, GSTIN, billing address
  - Place of supply (state code)
  - Item description, HSN, quantity, taxable value
  - CGST/SGST (for Maharashtra) OR IGST (for outside Maharashtra), rate, amount
  - Total payable
  - Reverse-charge declaration if applicable
  - Company name, GSTIN, CIN, PAN, registered office, signatory
- [ ] CRM SPA `Settings → Billing` page lists all past invoices with download links (Razorpay-hosted PDF)
- [ ] Reverse-charge flag handled for unregistered B2B customers (rare for B2B SaaS but compliant)
- [ ] Founder's CA signs off on test invoice in writing (email/WhatsApp)

## Manual Steps (🧍)

1. **Login to Razorpay Dashboard** at `https://dashboard.razorpay.com`. Confirm KYC is complete (P18 covers KYC). If KYC pending, this task waits.
2. **Settings → Account & Settings → Tax Settings** → enter company GSTIN, state (Maharashtra), set "Place of supply auto-detect" = ON.
3. **Settings → Account & Settings → Branding** → upload logo, registered office address, CIN, signatory name. Use the SVG logo from P8 once available; PNG fallback meanwhile.
4. **Run AI Prompt below** to produce invoice template + CA verification checklist.
5. **Settings → Invoices → Templates** → paste the customized invoice template (or use Razorpay's default with updated HSN + branding fields).
6. **Products → Create** 4 products as per `pre-launch/02-pricing/razorpay-products.md` (output of P2):
   - Solo (HSN 998314, tax_inclusive=false)
   - Team
   - Team+ (with `add_seat` plan ₹500/seat/mo prorated)
   - AI Employee (HSN 998314, tax_inclusive=false, billing label "AI Employee Add-on")
7. **Plans → Create** monthly + annual plans for Solo/Team/Team+ (annual = 20% off). AI Employee monthly only.
8. **Capture plan IDs** and write into `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-plan-ids.md` (test mode + live mode IDs separately).
9. **Test ₹1 invoice:** Razorpay → Subscriptions → Create Test Subscription on Solo plan with a test customer + Maharashtra GSTIN dummy → process payment → download invoice PDF.
10. **Send invoice to CA** for sign-off. CA verifies: HSN, GSTIN, place-of-supply, tax split, signatory, format. Get email/WhatsApp confirmation.
11. **In CRM SPA:** Add `pages/admin/BillingHistory.tsx` (or extend an existing settings page) showing past invoices with Razorpay-hosted PDF download links.
12. **Tick ACs** + log CA sign-off + invoice number to `00-DECISIONS-LOG.md`.

## AI Prompt (🤖)

```
You are a senior Indian SaaS RevOps consultant familiar with GST + Razorpay invoicing. Read inputs:
- `marketing-and-sales/launch-plan-v2/pricing.json`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-products.md` (output of P2)
- `marketing-and-sales/launch-implement/pre-launch/01-legal/refund.md` (output of P1)

Produce 4 outputs:

## 1. `marketing-and-sales/launch-implement/pre-launch/07-gst/invoice-template.md`
A markdown spec for the Razorpay invoice template. Sections:
- Header: company logo (placeholder URL), legal name, CIN, GSTIN, PAN, registered office (Mumbai), signatory
- Invoice metadata: number, date, due date, billing cycle
- Customer block: name, GSTIN (mandatory for B2B), billing address, place of supply (state code)
- Line items table: description ("RealEstateFlow Solo Plan — Monthly Subscription"), HSN (998314), quantity, unit price (excl. tax), taxable value
- Tax breakdown:
  - If place-of-supply = Maharashtra: CGST 9% + SGST 9% (split of 18% GST)
  - Else: IGST 18%
  - Add reverse-charge field "Reverse Charge Applicable: ☐ Yes ☑ No" (default No for B2B SaaS)
- Total: subtotal + tax + grand total in INR, words ("Indian Rupees Two Thousand Three Hundred Fifty Eight only")
- Terms: 1-month refund (Solo/Team/Team+) cite Refund Policy URL; AI Employee non-refundable; payment terms; jurisdiction (Mumbai)
- Footer: signatory name + title + digital signature placeholder

## 2. `marketing-and-sales/launch-implement/pre-launch/07-gst/razorpay-config-checklist.md`
Step-by-step checklist for the founder to enable in Razorpay dashboard. Each step: action, location, expected screen, verification.

Steps:
1. Settings → Tax Settings → enter GSTIN, state Maharashtra
2. Settings → Branding → logo + address + CIN + signatory
3. Products → Create Product `Solo` with HSN 998314 ...
4. Plans → Create Plan `solo_monthly` (₹999) on Product `Solo`
5. ... (all 9 plans: Solo monthly + annual; Team monthly + annual; Team+ monthly + add_seat; AI Employee monthly)
6. Settings → Webhooks → register webhook URL `https://api.realestateflow.in/billing/webhook` for events: subscription.charged, subscription.completed, subscription.cancelled, subscription.paused, subscription.updated, payment.failed, payment.captured, refund.processed
7. Settings → Notifications → configure invoice auto-email to customer (default ON)
8. Test mode: create test subscription on Solo with test card → confirm invoice generated correctly + auto-emailed
9. Switch to live mode (gated by KYC) → repeat one ₹1 test invoice (will be refunded)
10. Capture plan IDs into `razorpay-plan-ids.md`

## 3. `marketing-and-sales/launch-implement/pre-launch/07-gst/ca-sign-off-checklist.md`
What the founder's CA must verify on the test invoice. Bullet list:
- HSN 998314 present and correct for SaaS
- GSTIN of seller matches company filing
- GSTIN of buyer (test) shown
- Place of supply state code shown
- CGST + SGST split for Maharashtra OR IGST for inter-state
- Total tax = 18% of taxable value
- Invoice number sequential and unique
- Date format DD/MM/YYYY (Indian convention)
- Reverse charge field present (even if "No")
- Signatory name + title visible
- Format complies with CGST Rule 46

## 4. `marketing-and-sales/launch-implement/pre-launch/07-gst/billing-history-spec.md`
React component spec for `agency-app/web/src/pages/admin/BillingHistory.tsx`:
- Fetch past invoices from `GET /billing/invoices` (server route to add — references Razorpay API)
- Table: invoice number, date, amount, status (Paid/Failed/Refunded), PDF download link (Razorpay-hosted URL)
- Empty state: "No invoices yet — your first invoice generates after Day-15 of trial when you upgrade"
- Acceptance: tenant-scoped (only show own invoices), download opens Razorpay-hosted PDF in new tab

Stop here. Do not edit Razorpay (manual). Do not generate the React component code (that's a P14 dependency).
```

## Inputs
- Razorpay Dashboard access (after KYC)
- Company GSTIN, CIN, PAN, registered office (founder)
- `pricing.json`
- `pre-launch/02-pricing/razorpay-products.md` (P2 output)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/07-gst/invoice-template.md`
- `.../razorpay-config-checklist.md`
- `.../ca-sign-off-checklist.md`
- `.../billing-history-spec.md`

## Success Criterion
Test ₹1 invoice generated + signed off by founder's CA in writing.

## Fallback / Plan B
If Razorpay native invoicing too restrictive, fall back to a manual invoice generator (e.g., Refrens.com or Vyapar) called from `subscription.charged` webhook to generate matching invoice + email customer. Slower but customizable.

## Risks
| Risk | Mitigation |
|---|---|
| HSN wrong code → CA reject | 998314 confirmed for SaaS at https://cbic-gst.gov.in/sac.html |
| Place of supply mis-detected | Razorpay auto-resolve from billing address; fallback manual override per invoice |
| Reverse charge mishandled | Default "No" for B2B SaaS — manual flag for any unregistered B2B edge case |
| Annual plan tax timing | GST applies on issuance; advance discount on annual reduces taxable value (verify with CA) |
| Razorpay live mode delayed by KYC | P18 tracks KYC; if not done by T-3, P7 holds and Day 3 launch slips |

## India / Mumbai-Specific Notes
- Maharashtra customers: CGST + SGST (9%+9%); rest of India: IGST 18%
- Invoice format must comply with CGST Rule 46
- Annual filing GSTR-1 + GSTR-3B impact — ensure Razorpay export gives the columns CA needs
- Reverse charge mechanism (RCM) rare for SaaS but flag handles edge case

## Dependencies
- **Blocks:** Day 3 (Razorpay live + first paid customer can be invoiced), P14 (paywall references plan IDs)
- **Depends on:** Razorpay KYC live (P18), `pricing.json` + P2 `razorpay-products.md`

## Connected Skills
- `revops` — invoice template + checklist
- `pr-review` — `BillingHistory.tsx` review when built
