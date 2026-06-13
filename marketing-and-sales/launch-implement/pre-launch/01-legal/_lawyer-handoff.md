# Lawyer Handoff — RealEstateFlow Legal Documents

**Prepared:** 2026-06-11  
**Documents in package:** `tos.md`, `privacy.md`, `refund.md`, `cookies.md`, `dpa-template.md`  
**Brand:** RealEstateFlow · Domain: realestateflow.in · Jurisdiction: Mumbai, Maharashtra

---

## Cover Note for Counsel

Dear Counsel,

Please review the attached five draft legal documents for **{{COMPANY_LEGAL_NAME}}** (CIN: {{COMPANY_CIN}}, GSTIN: {{COMPANY_GSTIN}}), operator of the RealEstateFlow B2B SaaS CRM for Indian real estate brokers.

RealEstateFlow is preparing for commercial launch with Razorpay live-mode payments. These documents must be published at `realestateflow.in/legal/{terms,privacy,refund,cookies}` before accepting paid customers.

**Founder placeholders to replace before sign-off:**

| Placeholder | Value needed |
|-------------|--------------|
| `{{COMPANY_LEGAL_NAME}}` | Registered Pvt Ltd name |
| `{{COMPANY_CIN}}` | Corporate Identification Number |
| `{{COMPANY_GSTIN}}` | Active GST registration number |
| `{{COMPANY_ADDRESS}}` | Registered office, Mumbai |
| `{{FOUNDER_NAME}}` | Grievance Officer name |
| `{{LAWYER_REVIEWED_DATE}}` | Date of your sign-off |
| `{{EFFECTIVE_DATE}}` | Publication date |

**Grievance Officer (confirmed):** {{FOUNDER_NAME}} · info@realestateflow.in · 7 working day SLA · `/grievance` form live

---

## Priority Review Items

### 1. DPDP Act 2023 compliance (Privacy + ToS + DPA)

- [ ] Data Fiduciary identity block complete and prominent
- [ ] Grievance Officer disclosure meets Section 13 requirements
- [ ] Lawful basis mapping (consent / contract / legitimate interest) is accurate
- [ ] Data principal rights (access, correction, erasure, portability, grievance) are complete
- [ ] Children's data clause (under-18 prohibition) is adequate
- [ ] Retention periods (active + 3 years post-cancellation for some records; 30-day export window) are defensible
- [ ] Cross-border transfer disclosures for EU/US sub-processors are DPDP-compliant
- [ ] Sub-processor table is complete and accurate (see list below)

### 2. Mumbai jurisdiction (all documents)

- [ ] Exclusive jurisdiction clause: "Courts at Mumbai, Maharashtra" — confirm enforceability for B2B SaaS
- [ ] Governing law: Indian Contract Act, IT Act, DPDP Act — any additions needed?
- [ ] Consumer Protection Act 2019 applicability for B2B vs small-business customers

### 3. RBI Payment Aggregator / refund language (Refund + ToS)

- [ ] Refund timeline (7–10 working days via Razorpay to source) aligns with RBI PA guidelines
- [ ] 30-day money-back for Solo/Team/Team+ — defensible under Consumer Protection Act?
- [ ] **Anti-abuse clause:** refund denied if >100 records exported OR >50 outbound WhatsApp during trial — confirm enforceability and wording
- [ ] AI Employee **no trial / no refund** — confirm adequate disclosure at point of sale
- [ ] Annual plan pro-rata refund (full within 30 days; none after) — GST credit note implications
- [ ] Chargeback language — adequate?

### 4. Pricing and GST references

Confirm all amounts match canonical `pricing.json`:

| Plan | Price (excl. GST) | Trial | Refund |
|------|-------------------|-------|--------|
| Solo | ₹999/month | 14 days | 30-day money-back |
| Team | ₹1,999/month | 14 days | 30-day money-back |
| Team+ | ₹1,999 + ₹500/seat/month | 14 days | 30-day money-back |
| AI Employee | ₹7,999/month | None | Non-refundable |

- HSN **998314** cited correctly for SaaS
- GST **18%** disclosure on all pricing references

### 5. Sub-processor disclosures (Privacy + DPA)

Verify the following sub-processors are listed with purpose and region:

AWS · Razorpay · Brevo · AiSensy · Cloudflare · PostHog · Sentry · Crisp · BetterStack · Cal.com · ElevenLabs · Instantly

- [ ] Brevo (EU) — cross-border transfer safeguards adequate?
- [ ] Sentry (US) — error logs may contain user IDs; PII minimisation noted?
- [ ] ElevenLabs (US) — voice/AI calling feature disclosure adequate?
- [ ] PostHog (EU) — analytics consent linkage to Cookie Policy?
- [ ] Instantly — limited to founder cold-email; not customer CRM data — confirm scope

### 6. Cookie Policy + consent UX linkage

- [ ] Cookie inventory table matches actual trackers (PostHog, GA4, Meta Pixel, LinkedIn, Hotjar, Crisp, Cloudflare)
- [ ] LP 4-category consent (Essential / Functional / Analytics / Marketing) vs CRM 2-category (Essential / Analytics) — legally sufficient?
- [ ] Do Not Track handling — adequate for DPDP?
- [ ] Cross-reference between cookies.md and privacy.md is consistent

### 7. AI Employee specific clauses

- [ ] 24-hour concierge SLA — liability if missed?
- [ ] WhatsApp/Telegram compliance — broker remains responsible for RERA/TRAI messages?
- [ ] Conversation log retention (90 days post-cancellation) — adequate?

### 8. DPA template (enterprise)

- [ ] Processor vs Fiduciary role allocation correct for broker-entered buyer/tenant data
- [ ] Audit rights (once per year, 30 days' notice) — reasonable?
- [ ] Breach notification (72 hours) — aligned with expected DPDP rules?
- [ ] Sub-processor objection mechanism — workable?

### 9. Limitation of liability

- [ ] Cap at fees paid in preceding 12 months — standard for Indian B2B SaaS?
- [ ] Exclusion of indirect/consequential damages — enforceable?
- [ ] Carve-outs for fraud/wilful misconduct — sufficient?

### 10. SLA and uptime

- [ ] 99.5% monthly uptime target — any remedy obligations needed beyond status page?
- [ ] Support SLAs (24h email, 2h Crisp business hours) — adequate disclaimers?

---

## Documents NOT in This Package (separate workstreams)

| Item | Owner | Status |
|------|-------|--------|
| `/grievance` page + backend | Engineering (P9) | In progress |
| Cookie consent banner implementation | Engineering (P17) | In progress |
| HTML rendering of legal pages | LP build (P15) | Pending lawyer sign-off |
| Signup consent checkbox + timestamp | CRM engineering | Pending |

---

## Recommended Publication Checklist (Post Sign-off)

1. Replace all `{{PLACEHOLDER}}` values in the five MD files
2. Set `{{LAWYER_REVIEWED_DATE}}` and `{{EFFECTIVE_DATE}}`
3. Render to static HTML at `realestateflow.in/legal/{terms,privacy,refund,cookies}`
4. Add footer links on all LPs + CRM SPA
5. Wire signup checkbox: "I agree to Terms and Privacy Policy"
6. Log sign-off in `00-DECISIONS-LOG.md`
7. Unblock Razorpay live mode

---

## Contact for Questions

**{{FOUNDER_NAME}}**  
[info@realestateflow.in](mailto:info@realestateflow.in)  
{{COMPANY_ADDRESS}}, Mumbai

---

*This handoff note accompanies AI-drafted documents requiring qualified legal review. Do not publish without counsel sign-off.*
