# Cookie Policy — RealEstateFlow

**Version:** v1.0 — drafted 2026-06-11  
**Last reviewed by counsel:** {{LAWYER_REVIEWED_DATE}}  
**Effective date:** {{EFFECTIVE_DATE}}

---

## 1. Introduction

This Cookie Policy explains how **{{COMPANY_LEGAL_NAME}}** ("**RealEstateFlow**", "**we**", "**us**") uses cookies and similar technologies on:

- **Marketing website:** [https://realestateflow.in](https://realestateflow.in)
- **CRM application:** [https://app.realestateflow.in](https://app.realestateflow.in)

This policy supplements our [Privacy Policy](/legal/privacy) and complies with the **Digital Personal Data Protection Act, 2023** (DPDP Act) and applicable e-privacy principles.

**Contact:** [info@realestateflow.in](mailto:info@realestateflow.in)  
**Grievance Officer:** {{FOUNDER_NAME}} — [info@realestateflow.in](mailto:info@realestateflow.in)

---

## 2. What Are Cookies?

Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, session storage, and pixel tags.

Cookies help us:

- Keep you logged in
- Remember your preferences
- Understand how visitors use our site
- Measure marketing campaign performance

---

## 3. How We Use Consent

### 3.1 Marketing website (`realestateflow.in`)

On your **first visit**, a cookie banner offers:

- **Accept all** — enables all cookie categories
- **Reject non-essential** — only strictly necessary cookies
- **Customize** — choose categories individually

Non-essential cookies (functional, analytics, marketing) are **not set** until you consent.

### 3.2 CRM application (`app.realestateflow.in`)

The CRM banner has two meaningful categories:

- **Essential** (always on) — authentication and security
- **Analytics** — PostHog product usage (no ad trackers in the CRM)

Marketing cookies (Meta Pixel, LinkedIn, GA4) are **not loaded** in the CRM.

### 3.3 Managing preferences

- Click **"Cookie preferences"** in the website footer to reopen the consent modal
- Clear cookies in your browser settings
- Email [info@realestateflow.in](mailto:info@realestateflow.in) to request deletion of consent records

Consent choices are stored in `localStorage` under the key `cookieConsent` and persist across sessions on the same device.

---

## 4. Cookie Categories

| Category | Purpose | Consent required? |
|----------|---------|-------------------|
| **Strictly necessary** | Login, security, CSRF protection, load balancing | No — required for Service |
| **Functional** | Remember layouts, language, session recordings (Hotjar) | Yes |
| **Analytics** | Measure site performance (PostHog, Google Analytics) | Yes |
| **Marketing** | Ad attribution (Meta Pixel, LinkedIn Insight Tag) | Yes |

---

## 5. Cookie Inventory

### 5.1 First-party cookies (RealEstateFlow)

| Cookie / key | Provider | Purpose | Category | Retention | Third-party? |
|--------------|----------|---------|----------|-----------|--------------|
| `auth_token` | RealEstateFlow | Session authentication (CRM) | Strictly necessary | 7 days | No |
| `csrf_token` | RealEstateFlow | Cross-site request forgery protection | Strictly necessary | Session | No |
| `cookieConsent` | RealEstateFlow | Stores your consent choices | Strictly necessary | 1 year | No |
| `ph_*` | PostHog (first-party) | Product analytics distinct ID | Analytics | 1 year | No (self-hosted key) |
| `feature_first_use_*` | RealEstateFlow | Tracks first-time feature usage flags | Functional | 1 year | No |

### 5.2 Third-party cookies — Analytics

| Cookie | Provider | Purpose | Category | Retention | Third-party? |
|--------|----------|---------|----------|-----------|--------------|
| `_ga` | Google Analytics 4 | Distinguishes users | Analytics | 2 years | Yes |
| `_ga_*` | Google Analytics 4 | Session state | Analytics | 2 years | Yes |
| `_gid` | Google Analytics 4 | Distinguishes users | Analytics | 24 hours | Yes |
| `ph_phc_*` | PostHog | Analytics session | Analytics | 1 year | Yes (EU) |

*PostHog and GA4 load on the marketing website only when analytics consent is granted. CRM loads PostHog only.*

### 5.3 Third-party cookies — Marketing

| Cookie | Provider | Purpose | Category | Retention | Third-party? |
|--------|----------|---------|----------|-----------|--------------|
| `_fbp` | Meta (Facebook) Pixel | Ad attribution | Marketing | 90 days | Yes |
| `_fbc` | Meta Pixel | Click ID from Facebook ads | Marketing | 90 days | Yes |
| `li_sugr` | LinkedIn | Ad conversion tracking | Marketing | 90 days | Yes |
| `bcookie` | LinkedIn | Browser identifier | Marketing | 1 year | Yes |
| `lidc` | LinkedIn | Routing | Marketing | 24 hours | Yes |

*Marketing cookies load on the marketing website only when marketing consent is granted. Never loaded in CRM.*

### 5.4 Third-party cookies — Functional

| Cookie | Provider | Purpose | Category | Retention | Third-party? |
|--------|----------|---------|----------|-----------|--------------|
| `_hjSessionUser_*` | Hotjar | Session recording user ID | Functional | 1 year | Yes |
| `_hjSession_*` | Hotjar | Session recording | Functional | 30 minutes | Yes |
| `__hssc` | Hotjar | Session cookie | Functional | 30 minutes | Yes |
| `__hssrc` | Hotjar | Session cookie | Functional | Session | Yes |
| `__hstc` | Hotjar | Visitor tracking | Functional | 13 months | Yes |

### 5.5 Support and infrastructure

| Cookie / storage | Provider | Purpose | Category | Retention | Third-party? |
|------------------|----------|---------|----------|-----------|--------------|
| `crisp-client/*` | Crisp | Live chat session | Functional | Session | Yes (EU) |
| `__cf_bm` | Cloudflare | Bot management | Strictly necessary | 30 minutes | Yes |

---

## 6. Local Storage and Session Storage

In addition to cookies, we use browser storage:

| Key | Surface | Purpose | Category |
|-----|---------|---------|----------|
| `cookieConsent` | LP + CRM | Consent record JSON | Strictly necessary |
| `utm_source`, `utm_campaign`, `utm_medium` | CRM | Attribution from landing page | Analytics (consent-gated) |
| `feature_first_use_*` | CRM | First-use event deduplication | Functional |

---

## 7. Do Not Track

Some browsers send a "Do Not Track" (DNT) signal. We currently **honour DNT** by treating it as a rejection of non-essential cookies on the marketing website. Essential cookies required for security still apply.

---

## 8. How to Disable Cookies in Your Browser

You can block or delete cookies via browser settings:

| Browser | Instructions |
|---------|--------------|
| Chrome | Settings → Privacy and security → Cookies |
| Firefox | Settings → Privacy & Security → Cookies |
| Safari | Preferences → Privacy → Manage Website Data |
| Edge | Settings → Cookies and site permissions |

Blocking all cookies may prevent you from logging into the CRM.

---

## 9. Third-Party Privacy Policies

| Provider | Privacy policy |
|----------|----------------|
| Google Analytics | https://policies.google.com/privacy |
| Meta | https://www.facebook.com/privacy/policy |
| LinkedIn | https://www.linkedin.com/legal/privacy-policy |
| Hotjar | https://www.hotjar.com/legal/policies/privacy |
| PostHog | https://posthog.com/privacy |
| Crisp | https://crisp.chat/en/privacy |
| Cloudflare | https://www.cloudflare.com/privacypolicy |

---

## 10. Updates to This Policy

We may update this Cookie Policy when we add or remove trackers. Material changes trigger a consent version bump — you will be re-prompted if the `cookieConsent.version` changes.

---

## 11. Contact

**{{COMPANY_LEGAL_NAME}}**  
{{COMPANY_ADDRESS}}  
Mumbai, Maharashtra, India  
Email: [info@realestateflow.in](mailto:info@realestateflow.in)  
Grievance Officer: {{FOUNDER_NAME}}

**Related:** [Privacy Policy](/legal/privacy) · [Terms of Service](/legal/terms)

---

*This Cookie Policy was drafted for RealEstateFlow and requires review by qualified Indian legal counsel before publication.*
