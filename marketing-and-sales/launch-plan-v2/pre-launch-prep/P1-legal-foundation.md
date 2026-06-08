# P1 — Legal Foundation (DPDP-compliant ToS / Privacy / Refund / Cookies)

> **Type:** 🤖 AUTO + 🧍 MANUAL
> **Phase:** Pre-launch
> **Day / Block:** T-19 to T-3 (drafts T-19, lawyer review T-19 to T-3, publish T-3)
> **Skill(s):** `copywriting`
> **Estimated time:** 3h founder · 6h AI · 5-7 days lawyer SLA

## Objective
Publish 4 legal documents (Terms of Service, Privacy Policy, Refund & Cancellation Policy, Cookie Policy) at `realestateflow.in/legal/{terms,privacy,refund,cookies}` — DPDP Act 2023 + Consumer Protection Act + RBI Payment Aggregator compliant — before Razorpay live mode and any paid customer.

## Why This Matters for RealEstateFlow
RealEstateFlow stores PII of buyers, sellers, owners, and tenants. Under India's **DPDP Act 2023** RealEstateFlow is a "Data Fiduciary" and must publish lawful basis, user rights (access/correction/erasure), and Grievance Officer disclosure. Razorpay won't fully activate live mode without ToS + Privacy live; customers' CAs will refuse input tax credit without a compliant invoice + Refund policy; non-compliance penalties reach ₹250 crore.

## User Story
As a founder launching a B2B SaaS in India, I want DPDP / RBI / Consumer-Protection compliant legal documents published at `/legal/*` before Day 3 (payment go-live), so RealEstateFlow can lawfully accept payments and store PII.

## Acceptance Criteria
- [ ] `realestateflow.in/legal/terms` returns 200 with full ToS, last-updated date stamp
- [ ] `realestateflow.in/legal/privacy` returns 200 with full DPDP-compliant Privacy Policy + Grievance Officer block
- [ ] `realestateflow.in/legal/refund` returns 200 with 1-month money-back terms (Solo/Team/Team+) + AI Employee no-refund clause + first-time-subscriber anti-abuse criteria
- [ ] `realestateflow.in/legal/cookies` returns 200 with cookie inventory table
- [ ] Footer of every LP + CRM page links to all 4 docs
- [ ] Signup form has unchecked "I agree to Terms and Privacy Policy" checkbox; submit blocked unless ticked
- [ ] Cookie consent banner appears on first visit (see P17); blocks PostHog/GA4/Pixel/Hotjar/LinkedIn until consent
- [ ] Indian SaaS lawyer (Vakilsearch or alternative) has reviewed and signed off on each doc
- [ ] Pvt Ltd entity name, registered office, PAN, GSTIN, CIN displayed in footer + invoices
- [ ] Data Processing Addendum (DPA) draft saved as `marketing-and-sales/launch-implement/pre-launch/01-legal/dpa-template.md` for enterprise asks
- [ ] Sub-processor table lists: AWS, Razorpay, Brevo, AiSensy, Cloudflare, OpenClaw LLM provider, Sentry, PostHog, Crisp, BetterStack, Cal.com, ElevenLabs, Instantly
- [ ] Mumbai jurisdiction clause specified
- [ ] All docs cross-link Grievance Officer page `/grievance` (built in P9)

## Manual Steps (🧍)

1. **Engage lawyer** — go to `https://vakilsearch.com/saas-legal-documents` (or LawSikho), pay ₹15-40k, hand them the AI-drafted MDs (output of AI Prompt below). Provide: company entity (Pvt Ltd) details, GSTIN, CIN, registered office (Mumbai address), founder name (= Grievance Officer), domain `realestateflow.in`, sub-processor list, payment processor (Razorpay).
2. **Review & sign-off** — accept or reject lawyer's redlines within 48h. Re-run AI prompt only for sections that change.
3. **Publish to LPs** — once signed, the AI-generated `tos.md`, `privacy.md`, `refund.md`, `cookies.md` get rendered into static HTML at `creative/landing-pages/main/legal/{slug}.html` (P15 includes this).
4. **Wire footer** — update footer partial in all 5 LPs to include `/legal/terms · /legal/privacy · /legal/refund · /legal/cookies · /grievance`.
5. **Add signup checkbox** — modify `real-estate-crm-app/src/components/auth/SignupForm.tsx` (or wherever signup lives) to add unchecked "I agree to ToS and Privacy" checkbox, block submit until ticked, log consent timestamp to DynamoDB `Users.consentSignedAt`.
6. **Smoke test** — open all 4 URLs incognito, confirm 200 + correct content + footer links resolve.
7. **Tick this ACs box** + log decision to `00-DECISIONS-LOG.md` with date.

## AI Prompt (🤖)

```
You are a senior Indian SaaS legal-content drafter. Draft 4 markdown documents for RealEstateFlow:
1. `tos.md` — Terms of Service
2. `privacy.md` — Privacy Policy
3. `refund.md` — Refund & Cancellation Policy
4. `cookies.md` — Cookie Policy

Company facts to use:
- Brand: RealEstateFlow
- Legal entity: [Pvt Ltd name from founder] (placeholder `{{COMPANY_LEGAL_NAME}}`)
- CIN: `{{COMPANY_CIN}}`
- GSTIN: `{{COMPANY_GSTIN}}`
- Registered office: `{{COMPANY_ADDRESS}}` (Mumbai, Maharashtra)
- Domain: realestateflow.in
- Founder + Grievance Officer name: `{{FOUNDER_NAME}}`
- Grievance Officer email: info@realestateflow.in
- Grievance Officer SLA: 7 working days
- Hosting region: AWS ap-south-1 (Mumbai). No data transferred outside India.
- Payment processor: Razorpay (sub-processor)
- Sub-processors: AWS, Razorpay, Brevo, AiSensy, Cloudflare, OpenClaw LLM provider, Sentry, PostHog, Crisp, BetterStack, Cal.com, ElevenLabs, Instantly
- Pricing tiers (canonical, see `pricing.json`):
  - Solo ₹999/mo + 18% GST · 14-day trial · 1-month refund (first-time subscribers only)
  - Team ₹1,999/mo + 18% GST · 14-day trial · 1-month refund (first-time subscribers only)
  - Team+ ₹1,999 + ₹500/extra-member/mo + 18% GST · 14-day trial · 1-month refund (first-time subscribers only)
  - AI Employee add-on ₹7,999/mo + 18% GST · NO trial · NO refund (manual-config cost is sunk)
- Annual discount: 20% off Solo/Team/Team+ (not AI Employee)
- Data classes stored: agency contact, agent users, buyers/owners/tenants/properties/leads (PII), Khata book entries (financial), WhatsApp/Telegram conversation logs (when AI Employee active)
- Jurisdiction: Mumbai courts

Required for each document:

# tos.md
- Definitions
- Service description (CRM + AI Employee)
- Subscription, billing cycle, trial, auto-renewal, price-change notice
- Acceptable use (no spam, no fake leads, no illegal listings, no prohibited content)
- Intellectual property (customer owns their data; we own platform; license grant)
- Customer data ownership + export rights (CSV export within 30 days of cancellation)
- Termination (when we may suspend; when customer may cancel)
- Limitation of liability (cap = fees paid in last 12 months)
- Indemnity
- SLA: 99.5% uptime monthly, support response <24h email / <2h Crisp business hours
- Force majeure
- Mumbai jurisdiction + governing law (Indian Contract Act, IT Act, DPDP Act)
- Last-updated date stamp + version

# privacy.md (DPDP Act 2023 mandatory disclosures)
- Identity of Data Fiduciary (company name, address, contact)
- Categories of personal data collected (CRM PII, payment data, usage data, conversation logs)
- Purpose for each category
- Lawful basis (consent for marketing; contract for service delivery; legitimate interest for fraud prevention)
- Retention period: active customer + 3 years post-cancellation, then deletion within 30 days
- Sub-processor table with name + purpose + region (AWS Mumbai, Razorpay India, Brevo EU [disclose], AiSensy India, Cloudflare global edge, OpenClaw LLM provider [disclose region], Sentry US [disclose], PostHog EU [disclose], Crisp EU [disclose], BetterStack global, Cal.com global, ElevenLabs US [disclose], Instantly global)
- Cross-border transfer notice (Brevo EU, Sentry US, OpenClaw LLM, ElevenLabs US, PostHog EU) with DPDP-compliant safeguards
- User rights: access, correction, erasure, portability, withdrawal of consent, grievance
- Grievance Officer block (name, email, postal address, SLA)
- Children's data: service not intended for under-18; we delete if discovered
- Cookie usage table (link to cookies.md)
- Last-updated date stamp + version

# refund.md
- Trial period: 14-day free trial, no card required, applies to Solo/Team/Team+ (NOT AI Employee)
- Paid refund window: 30 days from first paid charge, first-time subscribers only
- Anti-abuse: refund DENIED if customer exported >100 records OR sent >50 outbound WhatsApp messages during trial OR signed up multiple times for refund
- Cancellation process: in-app `Settings → Billing → Cancel` + automatic acknowledgement email
- Pro-rata refund for annual plans: refund = annual fee × (unused months / 12) within first 30 days; no refund after 30 days
- Non-refundable: setup fees (none currently), AI Employee add-on (manual-config cost is sunk), payment-gateway charges
- Reference RBI Payment Aggregator guidelines for digital payments
- Refund timeline: 7-10 working days to source account
- Mumbai jurisdiction
- Last-updated date stamp + version

# cookies.md
- Definition + purpose
- Categories: strictly necessary (auth, CSRF) · functional (preferences) · analytics (PostHog, GA4) · marketing (Meta Pixel, LinkedIn Tag) · session recording (Hotjar)
- Per-cookie table: name · provider · purpose · category · retention · third-party flag
- Consent UX: banner on first visit, opt-in for non-essential, opt-out anytime via `/cookies/preferences`
- How to opt out via browser settings + Do-Not-Track signal honoured
- Last-updated date stamp + version

Output 4 files at:
- `marketing-and-sales/launch-implement/pre-launch/01-legal/tos.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/privacy.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/refund.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/cookies.md`

Each file: 1500-3000 words, plain English (Grade-9 reading level where possible, legalese only where required), markdown with H1/H2/H3 headings, version line "v1.0 — drafted YYYY-MM-DD", placeholder `{{LAWYER_REVIEWED_DATE}}` to be filled post-review.

After drafting, write a 1-paragraph cover note at `marketing-and-sales/launch-implement/pre-launch/01-legal/_lawyer-handoff.md` explaining what the lawyer must verify (Mumbai jurisdiction wording, DPDP sub-processor disclosures, RBI refund language, anti-abuse clause defensibility).

Do NOT use generic Termly placeholders. All clauses must be specific to RealEstateFlow + Mumbai + the pricing/refund model above.
```

## Inputs
- Company legal name, CIN, GSTIN, registered office (Mumbai address) — founder provides
- Founder name (Grievance Officer)
- `pricing.json` (canonical pricing)
- Master plan v2 §0 (decisions context)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/01-legal/tos.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/privacy.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/refund.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/cookies.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/dpa-template.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/_lawyer-handoff.md`
- HTML versions deployed at `realestateflow.in/legal/{slug}` (via P15 LP rewrite)

## Success Criterion
All 4 URLs return 200 with lawyer-signed-off content; signup form blocks submit without consent ticked; Razorpay live mode unblocked.

## Fallback / Plan B
If Vakilsearch is delayed past T-3, use Termly.io with India + DPDP add-on (₹4-8k/year), publish v0.9 docs with banner "Reviewed by external counsel; full sign-off pending — questions: info@realestateflow.in". Schedule lawyer review for Day 7-10 post-launch as catch-up.

## Risks
| Risk | Mitigation |
|---|---|
| Generic template misses DPDP clauses | Lawyer review + AI prompt enforces DPDP-specific disclosures |
| Cookie banner gates LP UX too aggressively | "Accept / Customize" with sensible defaults; banner doesn't block content |
| Refund policy invites abuse | Anti-abuse criteria explicit + first-time-subscribers-only |
| Customer asks for DPA we don't have | Draft template now; sign in 24h when asked |
| Mumbai jurisdiction rejected by enterprise prospect | Negotiate to Maharashtra arbitration on individual deals; default stays Mumbai courts |
| GST disclosure missing | Footer + invoices show CIN/PAN/GSTIN; covered in P7 |

## India / Mumbai-Specific Notes
- **DPDP Act 2023** is in force; some rules notification staggered but Data Fiduciary obligations apply now.
- **Grievance Officer** is mandatory; can be founder. Display name + email prominently.
- **Cross-border data transfer** disclosure required for EU/US sub-processors (Brevo EU, Sentry US, ElevenLabs US, PostHog EU, OpenClaw LLM if hosted abroad).
- **RBI Payment Aggregator** rules apply to Razorpay; we disclose in Refund + Privacy.
- **GST HSN 998314** for SaaS; CGST/SGST split for Maharashtra customers, IGST inter-state — covered in P7.
- **Consumer Protection Act 2019** + e-commerce rules apply — refund timelines must be honoured.

## Dependencies
- **Blocks:** Day 3 (Razorpay live), P15 (LP rewrite includes legal pages), P9 (Grievance flow), Signup form deployment
- **Depends on:** Company entity registered + GSTIN active (founder pre-requisite)

## Connected Skills
- `copywriting` — drafts the 4 docs
- `pr-review` — sanity-check legal MDs against checklist
- `revops` — invoice GST template (P7) cross-references this
