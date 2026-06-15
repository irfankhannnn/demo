# 06 — Env & Vendor Setup (India launch)

One place to copy every environment variable and see **where each secret comes from**.
Copy each block below into the matching `.env` file (the apps read per-service `.env`, not a single root file). Fill the blanks after you create the vendor accounts (see the vendor table at the bottom).

> Legend: **🔴 secret** = obtain from a vendor / generate; never commit. **🟢 config** = safe default shown, change per environment.

---

## A. `server/.env`  (backend Lambda / Express)

Copy from [`server/.env.example`](../server/.env.example). Launch-critical blanks to fill:

| Var | Type | Where to get it |
|---|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | 🔴 | Razorpay Dashboard → Settings → Webhooks (after KYC/live mode) |
| `RAZORPAY_PLAN_AI_EMPLOYEE` | 🟢/🔴 | Razorpay Dashboard → Subscriptions → Plans → plan id |
| `POSTHOG_KEY_SERVER` | 🔴 | PostHog → Project Settings → Project API Key |
| `SENTRY_DSN_SERVER` | 🔴 | Sentry → Project → Client Keys (DSN). Leave blank = error tracking off (safe no-op) |
| `BREVO_API_KEY` + `BREVO_*_TEMPLATE_ID` | 🔴 | Brevo → SMTP & API → API Keys; template IDs from Brevo → Templates |
| `AISENSY_API_KEY` | 🔴 | AiSensy → Manage → API Key (WhatsApp Business) |
| `HCAPTCHA_SECRET_KEY` | 🔴 | hCaptcha dashboard → secret key |
| `NPS_HMAC_SECRET` / `INTERNAL_API_KEY` | 🔴 | Generate yourself: `openssl rand -hex 32` |
| `S3_BUCKET_NAME` | 🟢 | Your AWS S3 bucket (created with the infra stack) |
| DynamoDB `*_TABLE*` names | 🟢 | Match the CloudFormation stack outputs (`server/infra/launch-tables-cfn.yaml`) |
| `GRIEVANCE_OFFICER_EMAIL`, `FOUNDER_*` | 🟢 | Your details |

## B. `real-estate-crm-app/.env`  (CRM SPA on Netlify — `app.realestateflow.in`)

Copy from [`real-estate-crm-app/.env.example`](../real-estate-crm-app/.env.example). Set these in **Netlify → Site settings → Environment variables** (all `VITE_*` are public/baked into the bundle — never put true secrets here):

| Var | Type | Where to get it |
|---|---|---|
| `VITE_API_URL` / `VITE_API_BASE_URL` | 🟢 | Your backend API Gateway URL + `/api` |
| `VITE_AUTH_API_URL`, `VITE_COGNITO_*` | 🟢/🔴 | From the `reality-flow-authentication` Cognito stack |
| `VITE_RAZORPAY_KEY_ID` | 🔴 | Razorpay → Settings → API Keys → **Key Id** (public, live) |
| `VITE_POSTHOG_KEY` | 🔴 | PostHog → Project API Key (client) |
| `VITE_GOOGLE_MAPS_API_KEY` | 🔴 | Google Cloud Console → Maps Platform |
| `VITE_TENANT_ID` | 🟢 | Your tenant id |

## C. `marketing-and-sales/creative/landing-pages/.env`  (LP site on Netlify — `realestateflow.in`)

Copy from [`landing-pages/.env.example`](../marketing-and-sales/creative/landing-pages/.env.example). Injected at build time by `build/scripts/process-partials.js`. Set in **Netlify → LP site → Environment variables**:

| Var | Type | Where to get it |
|---|---|---|
| `POSTHOG_KEY` | 🔴 | PostHog → Project API Key |
| `GA4_ID` | 🔴 | Google Analytics → Admin → Data Streams → Measurement ID (`G-…`) |
| `META_PIXEL_ID` | 🔴 | Meta Events Manager → Pixel ID |
| `LINKEDIN_PARTNER_ID`, `HOTJAR_ID` | 🔴 | LinkedIn Campaign Manager / Hotjar (optional) |
| `FOUNDER_NAME`, `COMPANY_LEGAL_NAME`, `GSTIN`, `CIN`, `WHATSAPP_NUMBER` | 🟢 | Your company details (also used to fill legal pages) |

---

## Vendor accounts checklist (manual — create these, then paste keys above)

| # | Vendor | Needed for | Account / KYC steps | Launch-critical |
|---|---|---|---|---|
| 1 | **Razorpay** | Payments, subscriptions | Sign up → KYC (PAN, GST, bank, business proof) → website verification (`realestateflow.in`) → live API keys + webhook secret. ~3–4 business days. | **Yes (P0)** |
| 2 | **PostHog** | Product + LP analytics | Create project → copy client + server keys → set host `eu.i.posthog.com` | Yes (P0 — DPDP analytics) |
| 3 | **GA4 + Meta Pixel** | Marketing attribution | Create GA4 property + Meta pixel → copy IDs | Yes (P1) |
| 4 | **Sentry** | Server/SPA error tracking | Create org/project → copy DSN | P1 (no-op until set) |
| 5 | **Brevo** | Transactional + trial emails | Verify sending domain (SPF/DKIM for `realestateflow.in`) → API key + template IDs | Yes (P1) |
| 6 | **AiSensy** | WhatsApp Business messaging | WhatsApp Business API onboarding → API key | Yes (P1) |
| 7 | **Google Maps** | CRM location picker | GCP project → enable Maps JS API → key | Yes (P1) |
| 8 | **hCaptcha** | Grievance/public form spam | Create site → secret key | P2 |

> All vendor data residency: prefer India/EU regions where offered (PostHog `eu`, AWS `ap-south-1`) to keep the DPDP "data stays in India" claim defensible.
