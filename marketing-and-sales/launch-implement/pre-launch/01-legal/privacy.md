# Privacy Policy — RealEstateFlow

**Version:** v1.0 — drafted 2026-06-11  
**Last reviewed by counsel:** {{LAWYER_REVIEWED_DATE}}  
**Effective date:** {{EFFECTIVE_DATE}}

---

## 1. Introduction

**{{COMPANY_LEGAL_NAME}}** ("**RealEstateFlow**", "**we**", "**us**", or "**our**") operates the RealEstateFlow CRM platform at [https://realestateflow.in](https://realestateflow.in) and [https://app.realestateflow.in](https://app.realestateflow.in).

This Privacy Policy explains how we collect, use, store, share, and protect personal data when you use our Service. It is designed to comply with the **Digital Personal Data Protection Act, 2023** (DPDP Act), the Information Technology Act, 2000, and applicable rules thereunder.

**Data Fiduciary:** {{COMPANY_LEGAL_NAME}}  
**Registered office:** {{COMPANY_ADDRESS}}, Mumbai, Maharashtra, India  
**GSTIN:** {{COMPANY_GSTIN}} | **CIN:** {{COMPANY_CIN}}

By using the Service, you consent to the practices described here. For marketing communications, we rely on separate opt-in consent where required.

---

## 2. Scope

This policy applies to:

- Visitors to our marketing website (`realestateflow.in`)
- Registered users of the CRM application (`app.realestateflow.in`)
- Agency administrators and team members invited to an Account
- Individuals whose data is entered into the CRM by our customers (e.g., buyers, owners, tenants)
- Grievance and support correspondents

If you are a **data principal** whose information was entered by a broker using RealEstateFlow, that broker is typically the primary controller of your deal-related data. RealEstateFlow processes such data on the broker's instructions as a data processor. Contact the broker first; you may also contact our Grievance Officer.

---

## 3. Personal Data We Collect

### 3.1 Account and agency data

| Data | Examples | Purpose |
|------|----------|---------|
| Identity | Name, mobile number, email | Account creation, OTP login, support |
| Agency profile | Agency name, address, GSTIN, RERA registration | Service delivery, invoicing |
| Role and permissions | Admin, agent, member | Access control |

### 3.2 CRM data (entered by you)

| Data | Examples | Purpose |
|------|----------|---------|
| Contact PII | Buyer/seller/owner/tenant names, phones, emails, addresses | CRM functionality |
| Property data | Listings, localities, pricing, status | Property management |
| Financial data | Khata book entries, settlements, commission | Brokerage accounting |
| Lead data | Source, preferences, follow-up history | Sales pipeline |

### 3.3 AI Employee data (when add-on is active)

| Data | Examples | Purpose |
|------|----------|---------|
| Conversation logs | WhatsApp/Telegram messages with leads | Lead qualification, follow-ups |
| AI metadata | Intent tags, extracted preferences | Automation |

### 3.4 Payment data

| Data | Examples | Purpose |
|------|----------|---------|
| Billing | Plan, billing cycle, transaction IDs | Subscription management |
| Tax | GSTIN, billing address, place of supply | GST invoicing (HSN 998314) |

**Note:** Card and UPI details are processed directly by **Razorpay**. We do not store full payment credentials.

### 3.5 Usage and technical data

| Data | Examples | Purpose |
|------|----------|---------|
| Device and browser | IP address, user agent, device type | Security, analytics |
| Product analytics | Feature usage, page views (PostHog) | Product improvement |
| Error logs | Stack traces (Sentry) | Reliability |
| Cookies | See [Cookie Policy](/legal/cookies) | Preferences, analytics |

### 3.6 Communications

| Data | Examples | Purpose |
|------|----------|---------|
| Support chats | Crisp conversation history | Customer support |
| Email | Transactional and drip emails (Brevo) | Onboarding, billing |
| Cold outreach replies | Instantly-tracked threads | Sales (founder mailbox only) |

### 3.7 Children's data

The Service is **not intended for individuals under 18**. We do not knowingly collect children's data. If we discover such data, we will delete it promptly.

---

## 4. Lawful Basis for Processing

Under the DPDP Act, we process personal data on the following bases:

| Basis | Use cases |
|-------|-----------|
| **Consent** | Marketing emails, non-essential cookies, optional analytics on landing pages |
| **Contract** | Providing the CRM, AI Employee, billing, and support you subscribed to |
| **Legitimate interest** | Fraud prevention, security monitoring, product analytics (balanced against your rights) |
| **Legal obligation** | GST record-keeping, responding to lawful government requests |

You may withdraw consent for marketing or non-essential cookies at any time without affecting contract-based processing necessary to deliver the Service.

---

## 5. How We Use Personal Data

We use personal data to:

1. Create and manage your Account and agency workspace
2. Deliver CRM features, Khata book, calendar, and analytics
3. Configure and operate the AI Employee on WhatsApp/Telegram
4. Process subscriptions and issue GST invoices
5. Send transactional emails (receipts, trial reminders, security alerts)
6. Provide customer support via chat and email
7. Monitor uptime, errors, and security (BetterStack, Sentry)
8. Improve the product through aggregated analytics (PostHog)
9. Comply with legal and regulatory obligations
10. Enforce our Terms of Service and prevent abuse

We do **not** sell your personal data. We do **not** use CRM buyer/tenant data for advertising to third parties.

---

## 6. Data Storage and Hosting

- **Primary hosting:** Amazon Web Services (AWS), region **ap-south-1 (Mumbai)**
- **CDN and security:** Cloudflare (global edge; traffic may transit international PoPs)
- **Backups:** Encrypted backups within AWS Mumbai region

Customer CRM data is stored in India. Some sub-processors listed below process data outside India; see Section 8.

---

## 7. Data Retention

| Data type | Retention period |
|-----------|------------------|
| Active customer CRM data | Duration of Subscription + 30 days post-cancellation (export window) |
| Cancelled account CRM data | Deleted within 30 days after cancellation unless legal hold applies |
| Billing and tax records | 8 years (statutory requirement under GST and Companies Act) |
| Support and grievance records | 3 years from resolution |
| Server logs | 90 days |
| Analytics (PostHog) | Per PostHog project settings; typically 12 months |
| AI Employee conversation logs | Duration of add-on + 90 days, then deleted or anonymised |

After retention periods expire, we securely delete or irreversibly anonymise data.

---

## 8. Sub-processors and Cross-Border Transfers

We engage the following sub-processors to operate the Service:

| Sub-processor | Purpose | Data processed | Primary region |
|---------------|---------|----------------|----------------|
| **AWS** | Cloud hosting, databases, backups | All CRM and account data | India (ap-south-1) |
| **Razorpay** | Payment processing, GST invoicing | Billing, payment metadata | India |
| **Brevo** | Transactional and marketing email | Email, name, list membership | EU (France) |
| **AiSensy** | WhatsApp Business API messaging | Phone numbers, message content | India |
| **Cloudflare** | CDN, DDoS protection, DNS | IP addresses, request metadata | Global edge |
| **PostHog** | Product analytics | Pseudonymous usage events | EU |
| **Sentry** | Error monitoring | Error context, user ID (no PII in events) | United States |
| **Crisp** | Live chat support | Chat messages, email, page context | EU |
| **BetterStack** | Uptime monitoring, status page | Endpoint health metadata | Global |
| **Cal.com** | Demo booking scheduling | Name, email, meeting time | Global |
| **ElevenLabs** | AI voice synthesis (calling features) | Voice prompts, call metadata | United States |
| **Instantly** | Email warm-up and cold outreach (founder mailbox) | Founder email metadata | Global |

### 8.1 Cross-border transfer notice

Personal data may be transferred to sub-processors located outside India (notably Brevo in the EU, Sentry and ElevenLabs in the US, PostHog in the EU). Such transfers are made:

- Pursuant to your consent and/or contractual necessity
- With appropriate safeguards including standard contractual terms, encryption in transit (TLS 1.2+), and access controls
- Only for the limited purposes described above

You may request details of safeguards by contacting our Grievance Officer.

---

## 9. Data Sharing

We share personal data only:

- With sub-processors listed in Section 8, under data-processing agreements
- With your authorisation (e.g., when you connect WhatsApp via AiSensy)
- To comply with law, court order, or government request
- To protect rights, safety, and security of RealEstateFlow, users, or the public
- In connection with a merger, acquisition, or asset sale (with notice)

We do not share CRM contact data with other customers or with advertisers.

---

## 10. Your Rights Under the DPDP Act

As a data principal, you have the right to:

| Right | How to exercise |
|-------|-----------------|
| **Access** | Request a copy of your personal data |
| **Correction** | Update inaccurate data in-app or via support |
| **Erasure** | Request deletion (subject to legal retention) |
| **Portability** | Export CRM data via Settings → Data Export (CSV) |
| **Withdraw consent** | Unsubscribe from marketing; adjust cookie preferences |
| **Grievance** | Contact our Grievance Officer (Section 12) |

We will respond within **7 working days** of a verifiable request. Complex requests may take up to 30 days with notice.

To exercise rights regarding data entered by a broker (e.g., you are a buyer in someone's CRM), contact that broker first. We will assist them in fulfilling your request.

---

## 11. Security Measures

We implement industry-standard safeguards:

- Encryption in transit (TLS) and at rest (AWS KMS)
- Role-based access control and multi-tenant isolation
- OTP-based authentication
- Rate limiting and abuse detection
- Regular dependency updates and security monitoring (Sentry)
- Employee access on least-privilege basis

No system is 100% secure. Report suspected breaches to [info@realestateflow.in](mailto:info@realestateflow.in) immediately.

---

## 12. Grievance Officer

| Field | Details |
|-------|---------|
| **Name** | {{FOUNDER_NAME}} |
| **Designation** | Grievance Officer, {{COMPANY_LEGAL_NAME}} |
| **Email** | [info@realestateflow.in](mailto:info@realestateflow.in) |
| **Postal address** | {{COMPANY_ADDRESS}}, Mumbai, Maharashtra, India |
| **Response SLA** | 7 working days |

Submit online: [https://realestateflow.in/grievance](https://realestateflow.in/grievance)

If you are unsatisfied with our response, you may escalate to the **Data Protection Board of India** once fully constituted under the DPDP Act.

---

## 13. Cookies and Tracking

We use cookies and similar technologies as described in our [Cookie Policy](/legal/cookies). Non-essential cookies (analytics, marketing) require your consent on the marketing website. The CRM application gates PostHog session recording behind consent.

---

## 14. Marketing Communications

We may send:

- **Transactional emails** (account, billing, security) — no separate consent required
- **Product onboarding emails** during trial — based on your Account relationship
- **Marketing emails** — only with opt-in; unsubscribe link in every message

Manage preferences via unsubscribe links or by emailing [info@realestateflow.in](mailto:info@realestateflow.in).

---

## 15. Automated Decision-Making

The AI Employee uses automated processing to qualify leads and suggest follow-ups. You may review, override, or disable automated actions in the CRM. We do not make solely automated decisions with legal or similarly significant effects without human review options.

---

## 16. Changes to This Policy

We may update this Privacy Policy. Material changes will be notified by email or in-app notice at least **14 days** before they take effect. The "Effective date" at the top will be updated.

---

## 17. Contact

**{{COMPANY_LEGAL_NAME}}**  
{{COMPANY_ADDRESS}}  
Mumbai, Maharashtra, India  
Email: [info@realestateflow.in](mailto:info@realestateflow.in)  
Grievance: [https://realestateflow.in/grievance](https://realestateflow.in/grievance)

**Related policies:** [Terms of Service](/legal/terms) · [Refund Policy](/legal/refund) · [Cookie Policy](/legal/cookies)

---

*This Privacy Policy was drafted for RealEstateFlow and requires review by qualified Indian legal counsel before publication.*
