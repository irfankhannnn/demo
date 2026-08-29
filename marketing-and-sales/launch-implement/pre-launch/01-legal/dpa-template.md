# Data Processing Addendum (DPA) — Template

**Version:** v1.0 — drafted 2026-06-11  
**Status:** Draft for enterprise / agency customers — requires counsel review before execution

---

This Data Processing Addendum ("**DPA**") is entered into between:

**Data Fiduciary / Controller ("Customer"):**  
{{CUSTOMER_LEGAL_NAME}}  
{{CUSTOMER_ADDRESS}}  
GSTIN: {{CUSTOMER_GSTIN}} (if applicable)  
("**Customer**")

**Data Processor ("Processor"):**  
**{{COMPANY_LEGAL_NAME}}**  
{{COMPANY_ADDRESS}}  
Mumbai, Maharashtra, India  
GSTIN: {{COMPANY_GSTIN}} | CIN: {{COMPANY_CIN}}  
("**RealEstateFlow**" or "**Processor**")

This DPA supplements the RealEstateFlow [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy) dated {{EFFECTIVE_DATE}} (collectively, the "**Agreement**"). Capitalised terms not defined here have the meanings in the Agreement.

**Effective date:** {{DPA_EFFECTIVE_DATE}}

---

## 1. Purpose and Scope

1.1. Customer uses the RealEstateFlow CRM platform (the "**Service**") to process personal data relating to buyers, sellers, owners, tenants, leads, and agency personnel ("**Personal Data**").

1.2. Customer is the **Data Fiduciary** under the Digital Personal Data Protection Act, 2023 (DPDP Act). RealEstateFlow processes Personal Data on Customer's documented instructions as a **Data Processor**.

1.3. This DPA applies to processing of Personal Data submitted to the Service during the term of the Agreement.

---

## 2. Subject Matter and Duration

| Field | Details |
|-------|---------|
| **Subject matter** | Provision of cloud CRM and optional AI Employee services |
| **Duration** | Term of the Agreement plus 30-day data export window post-termination |
| **Nature of processing** | Storage, retrieval, organisation, analysis, transmission, deletion |
| **Purpose** | Real estate brokerage CRM, lead management, Khata book, AI-assisted messaging |

---

## 3. Categories of Data and Data Subjects

### 3.1 Data subjects

- Customer's employees and agents
- Buyers, sellers, owners, and tenants entered into the CRM
- Leads and prospects
- Individuals communicating via WhatsApp/Telegram through AI Employee

### 3.2 Categories of personal data

| Category | Examples |
|----------|----------|
| Identity | Name, phone, email, address |
| Property | Preferences, budget, locality interest |
| Financial | Khata entries, commission, settlement amounts |
| Communications | WhatsApp/Telegram message content (AI Employee) |
| Technical | IP address, device metadata (security logs) |

Special category data (health, biometric, etc.) is **not intended** to be processed. Customer warrants it will not upload such data without prior written agreement.

---

## 4. Customer Obligations

Customer shall:

4.1. Ensure it has a lawful basis under the DPDP Act to collect and process Personal Data uploaded to the Service.

4.2. Provide privacy notices to data principals (buyers, tenants, etc.) explaining that data is processed via RealEstateFlow.

4.3. Not instruct Processor to process Personal Data in violation of applicable law.

4.4. Configure access controls appropriately within the Service.

4.5. Promptly notify Processor of any data principal rights requests that require Processor assistance.

---

## 5. Processor Obligations

RealEstateFlow shall:

5.1. Process Personal Data **only on documented instructions** from Customer (the Agreement, this DPA, and in-app configurations), unless required by Indian law.

5.2. Ensure persons authorised to process Personal Data are bound by confidentiality.

5.3. Implement appropriate technical and organisational measures per Section 7.

5.4. Not engage sub-processors without Customer's general authorisation (Section 6). Customer authorises the sub-processors listed in Annex A.

5.5. Assist Customer in responding to data principal rights requests (access, correction, erasure, portability) within **7 working days** of a verifiable request.

5.6. Notify Customer without undue delay (and within **72 hours** where feasible) upon becoming aware of a personal data breach, including nature of breach, categories affected, and remediation steps.

5.7. Delete or return Personal Data within **30 days** of Agreement termination, unless law requires retention. Customer may export via Settings → Data Export before deletion.

5.8. Make available information necessary to demonstrate compliance and allow audits upon **30 days' written notice**, no more than once per year, during business hours, subject to confidentiality and minimal disruption.

---

## 6. Sub-processors

6.1. Customer provides **general written authorisation** for Processor to engage sub-processors in Annex A.

6.2. Processor will notify Customer of material sub-processor changes at least **14 days** in advance via email or in-app notice. Customer may object on reasonable grounds within 14 days. If unresolved, either party may terminate the affected Service.

6.3. Processor imposes data protection obligations on sub-processors substantially similar to this DPA.

### Annex A — Authorised Sub-processors

| Sub-processor | Purpose | Location |
|---------------|---------|----------|
| Amazon Web Services (AWS) | Cloud hosting, databases | India (ap-south-1) |
| Razorpay | Payment processing | India |
| Brevo | Transactional email | EU |
| AiSensy | WhatsApp Business API | India |
| Cloudflare | CDN, security | Global |
| PostHog | Product analytics | EU |
| Sentry | Error monitoring | United States |
| Crisp | Customer support chat | EU |
| BetterStack | Uptime monitoring | Global |
| Cal.com | Demo scheduling | Global |
| ElevenLabs | AI voice synthesis | United States |
| Instantly | Email infrastructure (Processor's own outreach only) | Global |

---

## 7. Security Measures

Processor maintains:

- Encryption in transit (TLS 1.2+) and at rest (AWS KMS)
- Multi-tenant data isolation with tenant-scoped access controls
- OTP-based authentication
- Role-based access for Customer users
- Regular security patching and vulnerability monitoring (Sentry)
- Encrypted backups in AWS Mumbai
- Rate limiting and abuse detection
- Incident response procedures

Detailed security documentation available on request at [info@realestateflow.in](mailto:info@realestateflow.in).

---

## 8. Cross-Border Transfers

8.1. Primary CRM data is stored in **India** (AWS ap-south-1).

8.2. Personal Data may be transferred to sub-processors outside India (Annex A). Such transfers are made with appropriate safeguards including encryption, access controls, and contractual data protection terms consistent with the DPDP Act.

8.3. Customer acknowledges cross-border transfers necessary for email (Brevo), analytics (PostHog), error monitoring (Sentry), and voice (ElevenLabs).

---

## 9. Data Principal Rights

Processor will assist Customer in fulfilling data principal requests under the DPDP Act:

| Right | Processor assistance |
|-------|---------------------|
| Access | Export tools, admin API on request |
| Correction | In-app edit or support-assisted update |
| Erasure | Deletion within 30 days post-termination; earlier on instruction |
| Portability | CSV export via Settings → Data Export |
| Grievance | Forward to Customer; Processor Grievance Officer for Processor-held account data |

Data principals may contact Customer first. For Processor account data, contact: **{{FOUNDER_NAME}}**, [info@realestateflow.in](mailto:info@realestateflow.in).

---

## 10. Breach Notification

Upon discovering a personal data breach affecting Customer's Personal Data, Processor will notify Customer at {{CUSTOMER_SECURITY_CONTACT_EMAIL}} with:

1. Description of the breach
2. Categories and approximate number of data subjects affected
3. Likely consequences
4. Measures taken or proposed
5. Contact point for further information

Notification within **72 hours** of confirmation where feasible.

---

## 11. Audit

11.1. Customer may audit Processor's compliance once per 12-month period with 30 days' notice.

11.2. Audits will be conducted remotely unless a material breach is suspected.

11.3. Processor may satisfy audit requests by providing SOC 2 / ISO reports or security questionnaire responses when available.

---

## 12. Liability

Liability under this DPA is subject to the limitation of liability in the Agreement (fees paid in the preceding 12 months), except where prohibited by law.

---

## 13. Term and Termination

13.1. This DPA remains in effect for the duration of the Agreement.

13.2. Upon termination, Processor deletes Customer Personal Data per Section 5.7 unless Customer requests earlier export.

---

## 14. Governing Law

This DPA is governed by the laws of **India**. Courts at **Mumbai, Maharashtra** have exclusive jurisdiction.

---

## 15. Signatures

**CUSTOMER — {{CUSTOMER_LEGAL_NAME}}**

| | |
|---|---|
| Name | {{CUSTOMER_SIGNATORY_NAME}} |
| Title | {{CUSTOMER_SIGNATORY_TITLE}} |
| Date | {{CUSTOMER_SIGN_DATE}} |
| Signature | _________________________ |

**PROCESSOR — {{COMPANY_LEGAL_NAME}}**

| | |
|---|---|
| Name | {{FOUNDER_NAME}} |
| Title | Founder & CEO |
| Date | {{PROCESSOR_SIGN_DATE}} |
| Signature | _________________________ |

---

*Template prepared for RealEstateFlow enterprise customers. Engage qualified counsel before execution.*
