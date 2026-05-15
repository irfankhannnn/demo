# Pre-Launch Prep — 01: Legal Foundation

## Objective
Publish the four legal documents that India's DPDP Act 2023 and Consumer Protection Act require before RealtyFlow can legally accept payment or store customer PII.

## Why This Matters for RealtyFlow
RealtyFlow is a SaaS CRM that stores PII of real estate buyers, sellers, owners, and tenants. Under India's Digital Personal Data Protection Act 2023, you are a "Data Fiduciary" and must publish lawful basis for processing, give users rights (access, correction, erasure), and disclose data retention. Without these documents, Razorpay won't fully activate live mode, customers' CAs will refuse to claim input tax credit, and you risk penalties up to ₹250 crore for serious violations.

## User Story
As a founder launching a B2B SaaS in India, I want to publish ToS, Privacy Policy, Refund Policy, and Cookie Policy compliant with DPDP Act 2023 and Consumer Protection Act, so that I can lawfully accept payments and store customer data starting Day 3 of the launch.

## Acceptance Criteria
- [ ] Terms of Service published at `realtyflow.in/terms` (or your domain)
- [ ] Privacy Policy published at `realtyflow.in/privacy` with DPDP Act 2023 disclosures
- [ ] Refund & Cancellation Policy published at `realtyflow.in/refund`
- [ ] Cookie Policy published at `realtyflow.in/cookies` with consent banner on landing page
- [ ] Footer of every page links to all four documents
- [ ] Signup form has "I agree to ToS and Privacy Policy" checkbox (unchecked by default)
- [ ] Cookie consent banner appears on first visit (use Cookiebot, Osano, or simple custom banner)
- [ ] All documents reviewed by a legal professional or licensed CA (Indian context)
- [ ] Company entity formed and PAN/GSTIN displayed on invoices
- [ ] Data Processing Addendum (DPA) draft available for enterprise customers who ask

## Implementation Steps

### Step 1: Choose a legal document source
Three options, in order of recommendation:
1. **Hire an Indian SaaS lawyer** (₹15-40k for the package) — best for long term. Try LawSikho, LegalKart, or a local CA who handles SaaS.
2. **Use Termly.io or iubenda** with India + DPDP add-ons. Generates compliant docs with config wizard.
3. **Adapt open-source templates** from SaaS Pegasus or similar — only if you can read them carefully. Risk: misses India-specific clauses.

### Step 2: Terms of Service — required clauses
- Service definition (what RealtyFlow does)
- Subscription terms (monthly/annual, auto-renewal, price changes)
- Acceptable use (no spam, no illegal listings, no fake leads)
- Intellectual property (customer owns their data; you own the platform)
- Termination clauses (when you can suspend, when they can cancel)
- Limitation of liability (capped at fees paid in last 12 months)
- Indian jurisdiction (specify Mumbai/Bangalore/your city courts)
- SLA promise (e.g., 99.5% uptime, support response time)
- Data ownership clause (customer retains ownership of their leads/contacts data)

### Step 3: Privacy Policy — DPDP Act 2023 mandatory disclosures
- Identity of Data Fiduciary (your company name, address, contact)
- Categories of personal data collected (CRM data, payment data, usage data)
- Purpose of processing for each category
- Lawful basis (consent, contract, legitimate interest)
- Data retention period (e.g., "active customer + 3 years post-cancellation")
- Sub-processors disclosed (AWS, Razorpay, ElevenLabs, Exotel, Cloudflare, etc.)
- Cross-border transfer disclosure (if data leaves India — AWS Mumbai region preferred to avoid this)
- User rights: access, correction, erasure, grievance redressal
- Grievance Officer name + email (DPDP Act requirement — appoint someone, even if it's you)
- Cookie usage table

### Step 4: Refund Policy
- Specify trial period (e.g., 14-day free trial — no charge)
- Specify refund window for paid subscriptions (e.g., 7 days for first-time subscribers)
- Specify non-refundable items (setup fees, add-on services)
- Cancellation process (in-app + email)
- Pro-rata refund policy for annual plans
- Reference RBI's Payment Aggregator guidelines for digital payments

### Step 5: Cookie Policy + Consent Banner
- List each cookie (analytics, session, marketing)
- Reason and retention period
- How to opt out
- Install banner: Cookiebot (free tier), Osano, or custom (~50 lines of JS)
- Banner must NOT pre-tick non-essential cookies

### Step 6: Publish + Wire In
- Upload to landing page at `/terms`, `/privacy`, `/refund`, `/cookies`
- Footer link on every page (landing + in-app)
- Signup form: add unchecked checkbox "I have read and agree to Terms of Service and Privacy Policy"
- Block signup submission unless ticked

### Step 7: Entity & GST
- Confirm your company is registered (Pvt Ltd preferred; LLP acceptable; sole proprietorship has tax implications)
- Obtain GSTIN if turnover may exceed ₹20L/year (recommend obtaining anyway for B2B credibility)
- Display PAN + GSTIN on invoices (covered in `07-gst-invoicing-setup.md`)

## Tools / Stack Required
- Termly.io OR iubenda OR Indian SaaS lawyer (LawSikho / LegalKart / local CA)
- Cookiebot OR Osano OR custom cookie banner (vanilla JS)
- Your domain DNS for `/terms`, `/privacy`, `/refund`, `/cookies` routes
- DocuSign / signed PDF for DPA template if needed

## Time Estimate
- DIY with Termly + India review: 1-2 days
- With Indian SaaS lawyer: 5-7 days (their turnaround)

## Deliverables
- `realtyflow.in/terms` — live
- `realtyflow.in/privacy` — live
- `realtyflow.in/refund` — live
- `realtyflow.in/cookies` — live
- Signup form consent checkbox — deployed
- Cookie banner — deployed
- `marketing-and-sales/launch-plan/pre-launch-prep/assets/dpa-template.pdf` — drafted

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Generic template misses DPDP Act 2023 clauses | Have an Indian CA or SaaS lawyer review |
| Cookie banner blocks landing page UX | Use minimal "Accept / Customize" banner; don't gate content |
| Refund Policy too generous → churn loophole | Limit refund window to 7 days first-time only |
| Customer asks for DPA you don't have | Draft template now; you can sign in 24 hours when asked |

## India-Specific Notes
- DPDP Act 2023 supersedes IT Rules 2011 for personal data. Some rules notification staggered, but the act is in force.
- Appoint a Grievance Officer (can be you or your co-founder). Display name + email prominently.
- Cross-border data transfer requires extra notice — keep data in AWS Mumbai if possible.
- RBI Payment Aggregator guidelines apply to payment processing. Razorpay handles their side; you handle disclosure.
- "Data Fiduciary" = controller in GDPR terms. "Data Processor" = your sub-processors (AWS, Razorpay).

## Connected Days / Dependencies
- **Blocks:** Day 3 (payment go-live), Day 6 (landing page funnel)
- **Depends on:** company entity already registered

## Success Metric
- All 4 documents live, signup form blocked without consent, no support questions about "where's your refund policy" from beta testers in Week 2.
