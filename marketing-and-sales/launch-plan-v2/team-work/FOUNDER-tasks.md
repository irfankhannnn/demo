# Founder — Task Bifurcation
## Role: Architecture Design + Team Management + All Remaining Work
## Phases: Pre-Launch (P1–P18) + Week 1 (Day 1–7)

> **Batch update 2026-06-11:** Signup funnel unblocked (self-serve trial). Deploy `apps/crm/server/infra/launch-tables-cfn.yaml` to unblock production. Fill `{{PLACEHOLDER}}` in legal docs before lawyer review. ~40% founder manual tasks complete (base CFN live).

> **How to use this file:**
> - Each Jira Story has an ID, phase, priority, source reference, and sub-tasks.
> - "Source File" = the exact `.md` file in `marketing-and-sales/launch-plan-v2/` to read before starting.
> - These are tasks ONLY the Founder can do: sign-offs, external account setup, cloud infra, legal decisions, product walk, money + bank, and managing Zeeshan + Madhu.
> - Team management checkpoints (blockers review, daily standups) are embedded in each story.

---

## EPIC 0 — Team Management (Ongoing)

---

### FND-000 | Daily Team Sync + Blocker Review
- **Phase:** Pre-Launch + Week 1 (every day)
- **Priority:** Critical
- **Source File:** `marketing-and-sales/launch-plan-v2/README.md` + `pre-launch-prep/README.md`

#### Daily Checks
- [ ] **Morning (9:00 AM IST):** Review Zeeshan's and Madhu's previous-day output; unblock any questions
- [ ] **Evening (7:00 PM IST):** Read Zeeshan's `daily-log/dayXX.md`; check Madhu's task status
- [ ] **Blockers to resolve same-day:**
  - Zeeshan waiting for env vars or AWS access → provide immediately
  - Madhu waiting for company details (GSTIN, CIN, lawyer contact) → provide within 2h
  - Legal docs pending sign-off → escalate to lawyer same day
- [ ] **Key decisions log:** Every decision (pricing, copy, legal, infra) → `marketing-and-sales/launch-plan-v2/00-DECISIONS-LOG.md`

---

## EPIC 1 — Architecture + System Design

---

### FND-001 | System Architecture Design for New Services
- **Phase:** Pre-Launch → T-14 (before Zeeshan starts coding)
- **Priority:** Critical
- **Source Files:** `pre-launch-prep/P9-grievance-flow.md`, `P11-openclaw-concierge.md`, `P12-seat-cap-enforcement.md`, `P14-paywall-trial-countdown.md`
- **Context:** Before Zeeshan writes any new service (Grievance, Billing Webhook, Seat-Cap, Paywall), the Founder must design the architecture: DynamoDB table schemas, IAM roles, route structure, cross-service dependencies, and how new services fit the existing `apps/crm/server/` + `apps/crm/real-estate-crm-app/` patterns. This prevents rework.

#### Tasks
- [ ] **FND-001-T1** — Design DynamoDB table schemas for all new tables
  - `Grievances` (PK=grievanceId, attrs: name, email, phone, description, category, status, tenantId=null, createdAt)
  - `AIEmployeeProvisioning` (PK=tenantId, attrs: agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, status, expectedSLAEnd, planId, razorpaySubscriptionId, internalNotes, loomUrl, liveAt)
  - `WebhookLog` (PK=webhookEventId, attr: processedAt — idempotency table)
  - `TenantApiKeys` (PK=tenantId, attrs: keyHash, createdAt, lastUsed, scopes)
  - `Subscriptions` (PK=tenantId, attrs: plan, seatsPaid, seatsUsed, trialEndsAt, isPaying, gracePeriodActive, razorpaySubscriptionId, status)
  - `NPSResponses` (PK=responseId, attrs: tenantId, score, comment, respondedAt)
  - `BetaInvites` (PK=email, attrs: invitedAt, usedAt, status)
  - Save schema doc to `marketing-and-sales/launch-implement/pre-launch/infra/dynamodb-schemas.md`
- [ ] **FND-001-T2** — Design route structure for new server routes
  - Confirm: `POST /api/billing/webhook` (public, before auth middleware), `GET /api/ai-employee/status` (auth), `GET/PUT /api/grievance` (mixed), `GET /api/subscriptions/current` + `/trial-status` (auth)
  - Hand route spec to Zeeshan as input for ZEE-004, ZEE-005, ZEE-007
- [ ] **FND-001-T3** — Design Lambda cron architecture for 3 new crons
  - Demo reset cron (P5), Trial reminder cron (P14), Escalation cron (P11)
  - Confirm: each cron = separate Lambda function + EventBridge rule; runs in `ap-south-1`; shares IAM role or separate per-function roles (security decision)
  - Document at `marketing-and-sales/launch-implement/pre-launch/infra/cron-architecture.md`
- [ ] **FND-001-T4** — Review Zeeshan's `ZEE-010` security audit CSV before Day 1
  - Sign off only if zero P0 rows in `route-tenant-coverage.csv`
  - If P0 found: block Zeeshan from other tasks until fixed; prioritize same-day
- **Acceptance:** Schema doc + route spec + cron architecture documented and handed to Zeeshan before T-14.

---

## EPIC 2 — Cloud Infrastructure Setup (P18)

---

### FND-002 | AWS Infrastructure Setup
- **Phase:** Pre-Launch → T-21 (start) → T-7 (complete)
- **Priority:** Critical
- **Source File:** `pre-launch-prep/P18-cloud-infra-checklist.md` (Track A)
- **Status:** ✅ **Existing CFN deployed — base infra is live.** Remaining items are config-only (CloudWatch alarms, WAF rules, new DDB tables for new services) and Lambda cron deployments (blocked on Zeeshan's YAML files).

#### Tasks — ✅ DONE (existing CFN deployed)
- [x] **FND-002-T1** — AWS account confirmed in `ap-south-1`; MFA enabled; IAM roles active
- [x] **FND-002-T2** — Existing Lambda service roles active; existing API Lambda deployed
- [x] **FND-002-T4** — Production Cognito user pool active; existing DDB CRM tables live
- [x] **FND-002-T5** — S3 bucket `cloudberry-real-estate-launch` confirmed (ap-south-1, BPA=true, versioning=on)
- [x] **FND-002-T8 (partial)** — API Gateway domain `api.realestateflow.in` mapped

#### Tasks — 🔲 REMAINING (config-only, run in parallel with coding)
- [x] **FND-002-T3-NEW** — DynamoDB: CloudFormation template ready (`apps/crm/server/infra/launch-tables-cfn.yaml`) — **deploy to AWS Console/CLI**
- [ ] **FND-002-T3-DEPLOY** — Run CloudFormation deploy (was FND-002-T3-NEW manual console steps):
  - `Grievances` (PK=grievanceId, from P9)
  - `AIEmployeeProvisioning` (PK=tenantId, from P11)
  - `WebhookLog` (PK=webhookEventId, from P11 idempotency)
  - `TenantApiKeys` (PK=tenantId, from P11)
  - `Subscriptions` (PK=tenantId, from P12)
  - `NPSResponses` (PK=responseId, from Day-28)
  - `BetaInvites` (PK=email, from Week-2)
  - For each: on-demand billing, PITR enabled, encryption at rest
- [ ] **FND-002-T4-DEMO** — Cognito: create `realestateflow-demo` user pool (separate from production, for P5 demo env); capture `DEMO_USER_POOL_ID`, `DEMO_CLIENT_ID`
- [ ] **FND-002-T6** — Lambda cron functions (⚠️ **blocked on Zeeshan's ZEE-001/004/007 YAML files being written first**):
  - `demo-reset` cron Lambda (from ZEE-001 `cron/reset-demo.yaml`)
  - `trial-reminder` cron Lambda (from ZEE-007 `cron/trial-reminder.yaml`)
  - `escalation-openclaw` cron Lambda (from ZEE-004 `cron/escalate-openclaw.yaml`)
- [ ] **FND-002-T7** — EventBridge: create 3 rules (one per cron) — ⚠️ **blocked on T6**
- [ ] **FND-002-T8-THROTTLE** — API Gateway per-route throttling: 100 req/5min for `/api/grievance` + `/api/auth/phone-login` + `/api/billing/webhook` (config-only, independent)
- [ ] **FND-002-T9** — WAF: managed rule sets (Common, Bad Inputs, IP Reputation) + custom rate-limit rule for grievance + phone-login (config-only, independent)
- [ ] **FND-002-T10** — CloudWatch alarms (config-only, independent — spec in P13):
  - 5xx rate >1%/min → SNS → founder email
  - Lambda error count >5/5min → SNS
  - DDB throttle events → SNS
  - Cognito sign-in failure spike → SNS
  - Cross-tenant 403 spike >10/min → WAF auto-block + SNS
- [ ] **FND-002-T11** — Smoke test new tables: `aws dynamodb describe-table --table-name Grievances` + 6 other new tables → all pass
- **Acceptance:** 7 new DDB tables with PITR; 3 cron Lambdas + EventBridge rules active (after Zeeshan delivers YAMLs); WAF + CloudWatch alarms configured.

---

### FND-003 | Cloudflare DNS + Security Setup
- **Phase:** Pre-Launch → T-21
- **Priority:** Critical
- **Source File:** `pre-launch-prep/P18-cloud-infra-checklist.md` (Track B) + `pre-launch-prep/P3-email-deliverability.md`
- **Context:** Cloudflare is the DNS, CDN, and WAF layer. All DNS records (email + API + subdomains) must be set before any other service works. Email deliverability (MAD-003) depends on SPF/DKIM/DMARC being published here.

#### Tasks
- [ ] **FND-003-T1** — Add `realestateflow.in` to Cloudflare zone; update registrar nameservers; wait for propagation
- [ ] **FND-003-T2** — Add DNS records from Madhu's `pre-launch/03-deliverability/dns-records.md`:
  - SPF TXT record for `realestateflow.in`
  - DKIM CNAME records for Google Workspace
  - DMARC TXT record (`v=DMARC1; p=quarantine; rua=mailto:dmarc@realestateflow.in`)
  - MX records for Google Workspace
  - A/CNAME: `realestateflow.in` → Netlify, `www` → Netlify, `api` → API Gateway, `demo` → demo Netlify site, `app` → SPA Netlify
  - TXT: Google Search Console verification (from Madhu MAD-007)
  - CNAME: `status.realestateflow.in` → BetterStack (from Madhu MAD-010)
- [ ] **FND-003-T3** — Cloudflare zone settings:
  - SSL/TLS: Full (strict); Always Use HTTPS: ON; Min TLS 1.2
  - HSTS: max-age=31536000, include subdomains, preload (after 14-day clean run)
  - Bot Fight Mode: ON
  - Email DNS records: DNS-only (orange cloud OFF for MX records)
  - Cache rules: bypass `/api/*`; aggressive cache `/assets/*`
- [ ] **FND-003-T4** — Verify after 24h: `nslookup realestateflow.in` resolves; email headers show DMARC pass; `https://realestateflow.in` loads without cert error
- **Acceptance:** All DNS records propagated; HTTPS valid; DMARC pass; bot protection on.

---

## EPIC 3 — Razorpay + Billing Setup

---

### FND-004 | Razorpay KYC + Products/Plans + GST Config
- **Phase:** Pre-Launch → T-7 (KYC) → T-3 (products/plans)
- **Priority:** Critical
- **Source File:** `pre-launch-prep/P7-gst-invoicing.md` + `pre-launch-prep/P18-cloud-infra-checklist.md` (Track C)
- **Context:** Until live KYC clears, there is no revenue. KYC can take 3–7 business days — start immediately. Once KYC approved, create all 4 Products + 9 Plans in live mode, configure GST, and capture all live plan IDs into `pricing.json`.

#### Tasks
- [ ] **FND-004-T1** — Submit Razorpay live KYC immediately at T-21
  - Required: company PAN, GST certificate, cancelled cheque, director Aadhar, company registration
  - Track status daily in Razorpay dashboard → Settings → KYC
- [ ] **FND-004-T2** — After KYC approved: Settings → Tax Settings
  - Enter company GSTIN, state = Maharashtra
  - Enable "Place of supply auto-detect"
  - Default HSN = 998314
- [ ] **FND-004-T3** — Settings → Branding: upload SVG logo (from Madhu P8), registered office address, CIN, signatory name
- [ ] **FND-004-T4** — Run Madhu's invoice template from `pre-launch/07-gst/invoice-template.md` in Razorpay → Settings → Invoices → Templates
- [ ] **FND-004-T5** — Create 4 Products per `pre-launch/02-pricing/razorpay-products.md`:
  - Solo (HSN 998314, tax_inclusive=false)
  - Team (HSN 998314, tax_inclusive=false)
  - Team+ with add_seat plan (₹500/seat/mo, prorated)
  - AI Employee (HSN 998314, tax_inclusive=false, billing label "AI Employee Add-on")
- [ ] **FND-004-T6** — Create 9 Plans: Solo monthly/annual, Team monthly/annual, Team+ monthly, add_seat ₹500, AI Employee monthly; annual = 20% off
- [ ] **FND-004-T7** — Capture all live plan IDs → update `pricing.json.razorpayPlanIds.live`; hand to Zeeshan for env var update
- [ ] **FND-004-T8** — Register live webhook:
  - Settings → Webhooks → Add: `https://api.realestateflow.in/api/billing/webhook`
  - Events: all subscription + payment events (see P11 for full list)
  - Copy webhook secret → add as `RAZORPAY_WEBHOOK_SECRET_LIVE` env var
- [ ] **FND-004-T9** — Test ₹1 invoice: create test subscription on Solo plan → download invoice PDF → send to CA for sign-off
  - Save CA sign-off confirmation to `pre-launch/07-gst/ca-sign-off-confirmation.png`
- **Acceptance:** KYC approved; 4 products + 9 plans in live mode; webhook registered; CA sign-off received; plan IDs in `pricing.json`.

---

## EPIC 4 — Third-Party Account Setup + API Keys

---

### FND-005 | Analytics Vendor Account Setup
- **Phase:** Pre-Launch → T-14
- **Priority:** High
- **Source File:** `pre-launch-prep/P10-analytics-events.md`
- **Context:** Zeeshan needs API keys to wire the events layer. **Critical:** GA4/Pixel/LinkedIn/Hotjar keys go into the LP build env ONLY — not the CRM. PostHog and Sentry keys go to CRM + Server. This task can run in parallel with all coding (code uses placeholder env vars until keys are available).

**Env var routing (where each key lives):**
| Key | LP `.env` | CRM `.env` | Server Lambda |
|---|---|---|---|
| `POSTHOG_KEY` | ✅ | ✅ (`VITE_POSTHOG_KEY`) | ✅ (`POSTHOG_KEY_SERVER`) |
| `GA4_ID` | ✅ | ❌ | ❌ |
| `META_PIXEL_ID` | ✅ | ❌ | ❌ |
| `LINKEDIN_PARTNER_ID` | ✅ | ❌ | ❌ |
| `HOTJAR_ID` + `HOTJAR_SV` | ✅ | ❌ | ❌ |
| `VITE_SENTRY_DSN` | ❌ | ✅ | ❌ |
| `SENTRY_DSN_SERVER` | ❌ | ❌ | ✅ |

#### Tasks
- [ ] **FND-005-T1** — Create **PostHog** project at https://posthog.com (free tier, EU region for DPDP)
  - Capture: `POSTHOG_KEY` (used as both `VITE_POSTHOG_KEY` and `POSTHOG_KEY_SERVER`), `POSTHOG_HOST`
  - Enable session recording, funnel analysis, cohorts
  - Hand to Zeeshan: add to LP `.env`, CRM `.env`, Lambda env
- [ ] **FND-005-T2** — Create **GA4** property at https://analytics.google.com
  - Capture: `GA4_ID` (format: G-XXXXXXXXXX)
  - Hand to Zeeshan: add to LP `.env` ONLY
- [ ] **FND-005-T3** — Create **Meta Pixel** at https://business.facebook.com (Events Manager)
  - Capture: `META_PIXEL_ID`
  - Hand to Zeeshan: add to LP `.env` ONLY
- [ ] **FND-005-T4** — Create **LinkedIn Insight Tag** at https://linkedin.com/campaignmanager
  - Capture: `LINKEDIN_PARTNER_ID`
  - Hand to Zeeshan: add to LP `.env` ONLY
- [ ] **FND-005-T5** — Create **Sentry** projects (one for CRM SPA, one for server Lambda) at https://sentry.io
  - Capture: `VITE_SENTRY_DSN` (for CRM `.env`), `SENTRY_DSN_SERVER` (for Lambda env)
  - Configure alerts: any P0 issue → founder email + WhatsApp
  - Hand to Zeeshan: add to CRM `.env` + Lambda env; do NOT add to LP `.env`
- [ ] **FND-005-T6** — Create **Hotjar** project at https://hotjar.com
  - Capture: `HOTJAR_ID`, `HOTJAR_SV`
  - Hand to Zeeshan: add to LP `.env` ONLY
- [ ] **FND-005-T7** — Write all IDs to `marketing-and-sales/launch-implement/pre-launch/env-config.md` (reference doc; do NOT commit raw keys to git)
  - Populate real values in: LP `creative/landing-pages/.env`, CRM `apps/crm/real-estate-crm-app/.env`, Lambda env vars
- **Acceptance:** All 6 vendor accounts active; keys in correct env files (GA4/Pixel/LinkedIn/Hotjar LP-only; PostHog all 3; Sentry CRM+Server only); ZEE-003 can run with real IDs.

---

### FND-006 | Brevo + AiSensy + hCaptcha + Instantly Account Setup
- **Phase:** Pre-Launch → T-14 (Brevo/hCaptcha) → T-7 (AiSensy)
- **Priority:** High
- **Source Files:** `pre-launch-prep/P9-grievance-flow.md`, `P11-openclaw-concierge.md`, `P3-email-deliverability.md`
- **Context:** Several services require account setup by the Founder before Zeeshan + Madhu can use them. Keys must be in env before code goes live.

#### Tasks
- [ ] **FND-006-T1** — Confirm **Brevo** account active (Madhu may have set up in MAD-003)
  - Capture API key: `BREVO_API_KEY`
  - Create contact list "Trial Signups" → capture `BREVO_TRIAL_LIST_ID`
  - Note: Madhu will create all email templates; Founder captures template IDs for env vars
- [ ] **FND-006-T2** — Create **hCaptcha** account at https://hcaptcha.com
  - Add site for `realestateflow.in`
  - Capture: `VITE_HCAPTCHA_SITE_KEY` (frontend) + `HCAPTCHA_SECRET_KEY` (backend)
  - Hand keys to Zeeshan for ZEE-002 (grievance form)
- [ ] **FND-006-T3** — Set up **AiSensy** account for WhatsApp Business API
  - Create broadcast list "AI-Employee-Onboarding-Pending"
  - Capture: `AISENSY_API_KEY` + `AISENSY_BROADCAST_LIST_ID`
  - Hand to Zeeshan for ZEE-004 (billing webhook → AiSensy notification)
- [ ] **FND-006-T4** — Confirm **Instantly** account active + warm-up running (Madhu manages warm-up; Founder just ensures account/billing is set up)
- [ ] **FND-006-T5** — Create **Cal.com** account at https://cal.com; set up `{{FOUNDER_HANDLE}}` handle
  - Create 1 booking type: "15-min RealEstateFlow Demo" (video call)
  - Capture: Cal.com URL → hand to Madhu for email signatures + LP copy
- [ ] **FND-006-T6** — Add all captured keys to Lambda env vars + `apps/crm/server/.env` + `apps/crm/real-estate-crm-app/.env`
- **Acceptance:** All accounts active; all keys in env; Zeeshan can complete ZEE-002 and ZEE-004.

---

## EPIC 5 — Demo Environment Provisioning

---

### FND-007 | Demo Environment — AWS Infrastructure
- **Phase:** Pre-Launch → T-7
- **Priority:** High
- **Source File:** `pre-launch-prep/P5-demo-environment.md`
- **Context:** Zeeshan writes the seed scripts (ZEE-001). Founder provisions the remaining infra. Most AWS infra is already live (existing CFN); the demo-specific items are the only outstanding pieces.

#### Tasks — 🔲 REMAINING

- [ ] **FND-007-T1** — Create `realestateflow-demo` Cognito user pool (separate from production — config-only, no code dependency)
  - Configure: MFA optional, SRP_AUTH, password policy ≥10 chars
  - Capture: `DEMO_USER_POOL_ID`, `DEMO_CLIENT_ID`
  - Add both IDs to Lambda env vars (as demo-specific env vars)
- [ ] **FND-007-T2** — Generate `DEMO_TENANT_ID` (a fixed ULID, e.g. `01J...`) → add to Lambda env vars
  - All seed data from ZEE-001 uses this fixed tenant ID — no code changes needed, just env var
- [ ] **FND-007-T3** — ⚠️ **Blocked on ZEE-001 being complete.** Once Zeeshan's `apps/crm/server/scripts/seed-demo-tenant.js` exists:
  - Deploy seed script as a one-off Lambda invocation (or run locally with production DDB access)
  - Verify data in DDB console: check buyer count, property count, lead count
- [ ] **FND-007-T4** — ⚠️ **Blocked on ZEE-001 being complete.** Register EventBridge cron for daily reset from Zeeshan's `cron/reset-demo.yaml`
  - Schedule: `cron(30 20 * * ? *)` (2:00 AM IST)
  - Manually trigger once to verify reset runs without error
- [ ] **FND-007-T5** — Deploy demo SPA to Netlify
  - Separate Netlify site pointing to demo Cognito pool env vars
  - Custom domain: `demo.realestateflow.in` (add CNAME in Cloudflare)
  - Env vars: `VITE_IS_DEMO=true`, `VITE_COGNITO_USER_POOL_ID=$DEMO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID=$DEMO_CLIENT_ID`
- [ ] **FND-007-T6** — Smoke test: visit `demo.realestateflow.in` → login → populated data + DemoBanner visible
- **Acceptance:** Demo URL live; DemoBanner shows; daily reset cron active; data verified in DDB console.

---

## EPIC 6 — Legal + Compliance Sign-offs

---

### FND-008 | Legal Documents Sign-off + Lawyer Engagement
- **Phase:** Pre-Launch → T-14 (engage lawyer) → T-7 (publish)
- **Priority:** Critical
- **Source File:** `pre-launch-prep/P1-legal-foundation.md`
- **Context:** Founder must provide all company details to Madhu for AI draft generation, engage the lawyer for review, and give final sign-off before Zeeshan publishes the pages. The Grievance Officer must be a named individual (usually the Founder) — this is a legal decision.

#### Tasks
- [ ] **FND-008-T1** — Provide to Madhu (for MAD-001 AI prompt inputs):
  - Company full legal name, GSTIN, CIN, registered office address
  - Grievance Officer name, email, phone, address (usually Founder)
  - Sub-processor list (all vendors used — see P1 source file)
  - Contact email: `info@realestateflow.in`
- [ ] **FND-008-T2** — Engage lawyer: share Madhu's AI-generated drafts for review
  - Briefing: "DPDP Act 2023 compliance, B2B SaaS, Mumbai entity, Indian customers only"
  - Timeline expectation: 48h turnaround
- [ ] **FND-008-T3** — Review lawyer feedback; confirm or override any changes with Madhu
- [ ] **FND-008-T4** — Give final sign-off on all 4 legal documents; confirm to Madhu to hand to Zeeshan for publishing
- [ ] **FND-008-T5** — Sign off security audit report (Zeeshan's ZEE-010 output)
  - Zero P0 findings required; if P0 exists → block Zeeshan from other tasks until fixed
  - Sign the report at `marketing-and-sales/launch-implement/pre-launch/13-security/security-audit-report.md`
- **Acceptance:** All 4 legal docs published; lawyer sign-off received; security audit report signed by Founder.

---

## EPIC 7 — Product + Pricing Decisions

---

### FND-009 | Pricing Decisions Lock + Founder Details for Copy
- **Phase:** Pre-Launch → T-14
- **Priority:** High
- **Source File:** `pre-launch-prep/P2-pricing-strategy.md` + `00-PLAN-OVERVIEW.md`
- **Context:** Madhu generates pricing copy (MAD-002) but the pricing decisions themselves are Founder calls. Lock these before anything else — all LPs, the paywall modal, Razorpay products, and trial email copy depend on these numbers being fixed.

#### Tasks
- [ ] **FND-009-T1** — Confirm and lock all pricing in `marketing-and-sales/launch-plan-v2/pricing.json`:
  - Solo: ₹999/mo, ₹9,588/year (20% off)
  - Team: ₹1,999/mo (3 seats), ₹19,188/year
  - Team+: ₹1,999/mo base + ₹500/extra seat/mo
  - AI Employee add-on: ₹7,999/mo (paid from Day 1, no trial)
  - Trial: 14 days, no card
  - Refund: 30 days (Solo/Team/Team+ only)
- [ ] **FND-009-T2** — Provide founder details for LP copy (to Madhu):
  - Cal.com handle (for booking links)
  - WhatsApp number (for `wa.me/` links in LP + paywall)
  - Founder name + 2-line background (for LinkedIn + about page)
  - YouTube/Loom demo video URL (for embedding on LPs)
- [ ] **FND-009-T3** — Review Madhu's `pricing-page-copy.md` (MAD-002 output) before handing to Zeeshan
  - Confirm all price numbers are correct; no "6-month refund" language; AI Employee "no trial" language is clear
- [ ] **FND-009-T4** — Review Madhu's competitive positioning wedge (MAD-004) and do "Bandra broker test"
  - Send wedge to 1 real Mumbai broker contact; ask: "Does this describe your problem?"
  - Feed back to Madhu for refinement if needed
- **Acceptance:** `pricing.json` locked; all founder details provided to Madhu; wedge validated with at least 1 real broker.

---

## EPIC 8 — Week 1 Founder Actions

---

### FND-010 | Day 1 — Friction Walkthrough (Founder-as-User)
- **Phase:** Week 1 → Day 1
- **Priority:** Critical
- **Source File:** `week-1-foundation/day-01-friction-walkthrough.md`
- **Context:** Day 1 is the only chance to experience the product cold before paying customers do. A 30-min walkthrough typically surfaces 10–20 fixable issues. Zeeshan ships fixes Day 2. The Founder must walk the product as a brand-new "Bandra agency owner" with no prior knowledge.

#### Tasks
- [ ] **FND-010-T1** — Test setup: incognito Chrome (desktop), iPhone Safari, low-end Android Chrome; throttle to 4G in DevTools; start Loom recording (desktop)
- [ ] **FND-010-T2** — Walk the full flow and log every friction point in `marketing-and-sales/launch-implement/week-1/day-01-friction-log.md`:
  - LP arrival: load time, hero clarity, CTA visibility, cookie banner UX
  - Signup: form fields, OTP delay, error states
  - Onboarding: role pick, agency setup, copy clarity, defaults
  - First buyer: required fields, validation, save speed
  - First property: form length, photo upload, locality auto-complete
  - First lead: pipeline stages, save behaviour
  - AI Employee status: empty state copy, CTA clarity
  - Khata book: entry form complexity
  - Logout + re-login: session persistence, OTP on re-login
- [ ] **FND-010-T3** — Mobile walkthrough: repeat Steps above on iPhone + Android; log mobile-specific issues separately
- [ ] **FND-010-T4** — Time the full flow: target <8 minutes desktop signup → first record
- [ ] **FND-010-T5** — Run AI Prompt from `day-01-friction-walkthrough.md` on the raw log → produce `day-01-backlog.md` with P0/P1/P2 triage + ICE scores
- [ ] **FND-010-T6** — Hand `day-01-backlog.md` to Zeeshan for Day 2 fixes (ZEE-011)
- [ ] **FND-010-T7** — Log to `00-DECISIONS-LOG.md`: "Day 1 walkthrough done — X P0 items found"
- **Acceptance:** Friction log complete (≥10 entries); backlog triaged; P0 items queued for Zeeshan; Loom URL saved.

---

### FND-011 | Day 3 — Payment Go-Live (Razorpay Live Mode)
- **Phase:** Week 1 → Day 3
- **Priority:** Critical
- **Source File:** `week-1-foundation/day-03-payment-go-live.md`
- **Context:** This is a 100% Founder-only task. Nobody else can execute live payment configuration. Switch Razorpay from test → live, run a real ₹1 transaction, get CA sign-off, verify settlement reaches bank account. After this, any signup can convert to paid.

#### Tasks
- [ ] **FND-011-T1** — Verify KYC = APPROVED in Razorpay dashboard → Settings → Account
- [ ] **FND-011-T2** — Switch to live mode (top-right toggle in Razorpay dashboard)
- [ ] **FND-011-T3** — Clone all test Products + Plans to live (or manually re-create per `razorpay-products.md`)
  - Capture ALL live plan IDs → update `pricing.json.razorpayPlanIds.live`
  - Redeploy Lambda with new env vars (live plan IDs)
- [ ] **FND-011-T4** — Register live webhook:
  - Settings → Webhooks → `https://api.realestateflow.in/api/billing/webhook`
  - All events checked; copy secret to `RAZORPAY_WEBHOOK_SECRET_LIVE` env var; redeploy
- [ ] **FND-011-T5** — Execute ₹1 test:
  - Create test subscription on Solo plan with founder's personal phone + dummy GSTIN
  - Pay via UPI; confirm invoice PDF generated + auto-emailed
  - Verify in CloudWatch logs: `subscription.charged` webhook processed + DDB `Subscriptions` row updated + PostHog event fired
  - Verify SPA: billing history page shows the invoice
- [ ] **FND-011-T6** — Send invoice PDF to CA (WhatsApp/email); wait for sign-off using `ca-sign-off-checklist.md`
  - Save CA confirmation to `marketing-and-sales/launch-implement/week-1/day-03-live-invoice-signed.pdf`
- [ ] **FND-011-T7** — Verify T+1 bank settlement: log into bank account; confirm settlement amount minus Razorpay fees
- [ ] **FND-011-T8** — Refund the ₹1 test via Razorpay → cancel + refund
- [ ] **FND-011-T9** — Add BetterStack monitor for `/api/billing/webhook` (HEAD check returns 200)
- [ ] **FND-011-T10** — Log to `00-DECISIONS-LOG.md`: "Razorpay live ₹1 invoice CA-approved YYYY-MM-DD"
- [ ] **FND-011-T11** — Write `daily-log/day03.md` standup entry
- **Acceptance:** Live invoice PDF generated; CA sign-off received; settlement confirmed in bank; webhook chain verified end-to-end.

---

### FND-012 | Day 4 — Analytics Vendor Configuration (Manual)
- **Phase:** Week 1 → Day 4
- **Priority:** High
- **Source File:** `week-1-foundation/day-04-analytics-events-final.md`
- **Context:** Zeeshan runs the technical analytics audit (ZEE-012). Founder does the manual vendor-side configuration: marking events as conversions in GA4, Meta Events Manager, and LinkedIn Campaign Manager.

#### Tasks
- [ ] **FND-012-T1** — GA4: Admin → Events → mark `signup_completed` + `subscription_started` as conversions
- [ ] **FND-012-T2** — Meta Business Manager → Events Manager → mark `Lead`, `Subscribe`, `Purchase` as conversions in the correct ad account
- [ ] **FND-012-T3** — LinkedIn Campaign Manager → Insight Tag → configure conversion tracking for `signup_completed` + `subscription_started`
- [ ] **FND-012-T4** — Verify cookie consent gating manually: incognito → reject all cookies → open network tab → confirm GA4/Pixel/LinkedIn scripts are NOT loaded
- [ ] **FND-012-T5** — Write `daily-log/day04.md` standup entry (include PostHog funnel screenshot)
- **Acceptance:** All 3 platforms have conversions configured; cookie gating manually verified.

---

### FND-013 | Day 7 — Go/No-Go Sign-off for Beta Invites
- **Phase:** Week 1 → Day 7
- **Priority:** Critical
- **Source File:** `week-1-foundation/day-07-final-audit.md`
- **Context:** Day 7 is the launch-readiness gate. Zeeshan delivers code audit results (ZEE-014). Madhu delivers legal/content compliance (MAD-012). Founder reads both, does the payments reconciliation check + ops check, and either signs GO or declares NO-GO (which delays Day 9 beta invites).

#### Tasks
- [ ] **FND-013-T1** — Read ZEE-014 security + Playwright results; confirm zero P0 findings
- [ ] **FND-013-T2** — Read MAD-012 legal + content compliance results; confirm all legal links live + grievance form working
- [ ] **FND-013-T3** — Payments reconciliation:
  - Verify ₹1 Day-3 test transaction in Razorpay + bank settlement + CA sign-off all complete
  - Trigger manual test webhook event → confirm idempotent (duplicate event doesn't double-process)
  - Confirm webhook signature verification still active (not accidentally disabled in a Day 1–6 deploy)
- [ ] **FND-013-T4** — Ops health check:
  - Send test message in Crisp from mobile → confirm push notification arrives on founder mobile within 30s
  - BetterStack: all 6 monitors green; `status.realestateflow.in` loads correctly
  - Sentry: 0 unresolved P0/P1 issues
- [ ] **FND-013-T5** — Write Go/No-Go verdict in `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md`
  - Section: Payments ✓/✗ + Ops ✓/✗ + overall GO / NO-GO
- [ ] **FND-013-T6** — If GO: sign off full report + log to `00-DECISIONS-LOG.md`: "Day 7 audit GO YYYY-MM-DD"
- [ ] **FND-013-T7** — If NO-GO: ticket every blocker with owner + fix-by-Day-8 deadline; re-evaluate Day 8
- [ ] **FND-013-T8** — Schedule Day 9 beta invite send (if GO) — Madhu handles actual invite sending
- **Acceptance:** Go/No-Go report complete + signed by Founder; if GO, beta invites cleared for Day 9.

---

---

## Manual Tasks → Parallel Execution Guide

> **How to read this:** The AI agent (Zeeshan) runs all coding in parallel with your manual tasks. Your manual task outputs go into config/env files — they do NOT block code writing (code uses placeholder env vars). Only DEPLOYMENT is blocked until real keys exist.

### Group A — Run Immediately (Zero Code Dependency)
These can and should start on Day 1 (T-21):

| Task | Output | Where output lands |
|---|---|---|
| FND-002-T3-NEW | Create 7 new DDB tables | AWS DDB console → no code change needed |
| FND-002-T4-DEMO | Create demo Cognito pool | AWS → `DEMO_USER_POOL_ID` env var |
| FND-002-T8-THROTTLE | API Gateway throttling overrides | AWS API Gateway console |
| FND-002-T9 | WAF rules | AWS WAF console |
| FND-002-T10 | CloudWatch alarms | AWS CloudWatch console |
| FND-003 | Cloudflare DNS records | Cloudflare dashboard |
| FND-004 | Razorpay KYC + Products/Plans | Razorpay → plan IDs → `pricing.json.razorpayPlanIds` |
| FND-005 | All analytics vendor accounts | Keys → LP `.env` + CRM `.env` + Lambda env vars |
| FND-006-T2 | hCaptcha account | `VITE_HCAPTCHA_SITE_KEY` + `HCAPTCHA_SECRET_KEY` → env vars |
| FND-006-T3 | AiSensy account | `AISENSY_API_KEY` + `AISENSY_BROADCAST_LIST_ID` → env vars |
| FND-006-T5 | Cal.com booking setup | `{{FOUNDER_HANDLE}}` → hand to Madhu for LP copy |
| FND-008-T1 | Company legal details to Madhu | Madhu runs P1 AI prompt |
| FND-009 | Pricing lock + founder details | `pricing.json` already done; hand Cal.com/WhatsApp/Loom to Madhu |

### Group B — Blocked on Zeeshan's YAML/Code (start after code is written)

| Task | Blocked on | What to do after unblocked |
|---|---|---|
| FND-002-T6 | ZEE-001, ZEE-004, ZEE-007 cron YAML files | Deploy cron Lambdas from YAML definitions |
| FND-002-T7 | FND-002-T6 | Register EventBridge rules |
| FND-007-T3 | ZEE-001 seed script | Run seed script once |
| FND-007-T4 | ZEE-001 cron YAML | Register EventBridge reset cron |
| FND-011 | ZEE-004 (billing webhook) + ZEE-007 (paywall) deployed | Switch Razorpay to live mode + ₹1 test |

### Group C — Human-only (cannot be coded or config-paralleled)

| Task | Why manual-only |
|---|---|
| FND-004 Razorpay KYC | Requires human identity documents + bank account |
| FND-008-T2/T3 Lawyer engagement | Requires human legal review + sign-off |
| FND-010 Day 1 product walkthrough | Requires founder physically using the product |
| FND-011 Day 3 payment go-live | Requires founder paying with real card + CA sign-off |
| FND-013 Day 7 Go/No-Go | Requires founder review + sign-off decision |

### Config Flow Summary
All manual task outputs funnel into 4 config locations (no git commits for secrets):

```
AWS Console actions           → AWS DDB tables + Lambda env vars (via AWS Console)
Vendor account signups        → creative/landing-pages/.env  (LP build-time IDs)
                              → apps/crm/real-estate-crm-app/.env     (CRM runtime IDs)
                              → Lambda env vars              (Server IDs)
Founder details (Cal, phone)  → hands to Madhu for LP copy + ZEE-008 placeholders
Razorpay live plan IDs        → marketing-and-sales/launch-plan-v2/pricing.json (razorpayPlanIds.live)
```

---

## Reference: Key Files to Read Before Starting

| Task | Read First |
|------|------------|
| FND-001 | `pre-launch-prep/P9, P11, P12, P14` (architecture for new services) |
| FND-002 | `pre-launch-prep/P18-cloud-infra-checklist.md` |
| FND-003 | `pre-launch-prep/P18-cloud-infra-checklist.md` + `P3-email-deliverability.md` |
| FND-004 | `pre-launch-prep/P7-gst-invoicing.md` |
| FND-005 | `pre-launch-prep/P10-analytics-events.md` |
| FND-006 | `pre-launch-prep/P9, P11, P3` |
| FND-007 | `pre-launch-prep/P5-demo-environment.md` |
| FND-008 | `pre-launch-prep/P1-legal-foundation.md` |
| FND-009 | `pre-launch-prep/P2-pricing-strategy.md` + `00-PLAN-OVERVIEW.md` |
| FND-010 | `week-1-foundation/day-01-friction-walkthrough.md` |
| FND-011 | `week-1-foundation/day-03-payment-go-live.md` |
| FND-012 | `week-1-foundation/day-04-analytics-events-final.md` |
| FND-013 | `week-1-foundation/day-07-final-audit.md` |

## Critical Path (What Blocks Everything Else)

```
FND-009 (pricing lock, T-14)            ──► MAD-002 (pricing copy) ──► ZEE-007 (paywall)
FND-008 (legal inputs, T-14)            ──► MAD-001 (legal drafts) ──► ZEE-008 (LP publish)
FND-001 (architecture, T-14)            ──► ZEE-002/004/005/007 (all new services)
FND-002-T3-NEW (new DDB tables, T-14)   ──► ZEE-002/004/005 deploy (need tables to exist)
FND-005 + FND-006 (accounts, T-14)      ──► ZEE-003 + ZEE-006 (fill env vars; code proceeds with placeholders)
FND-004 (Razorpay KYC, T-21)           ──► FND-011 (Day 3 payment go-live)
ZEE-001/004/007 YAML files             ──► FND-002-T6/T7 (Lambda cron deploy)
FND-010 (Day 1 walkthrough)            ──► ZEE-011 (Day 2 P0 fixes)
FND-011 (Day 3 payment live)           ──► FND-013 (Day 7 go/no-go)
FND-013 (Day 7 go/no-go = GO)          ──► Day 9 beta invites

✅ NOT on critical path (existing CFN live):
  FND-002-T1/T2/T4/T5/T8 (base AWS infra — already done)
  FND-003 (Cloudflare DNS — can proceed in parallel)
  FND-002-T9/T10 (WAF + CloudWatch alarms — config-only, non-blocking)
```

## Key Handoffs (What Founder Delivers to Zeeshan + Madhu)

| Founder Delivers | Goes To |
|---|---|
| DynamoDB schema doc (`FND-001-T1`) | Zeeshan — all new service DDB tables |
| Route structure + cron architecture (`FND-001-T2/T3`) | Zeeshan — ZEE-002/004/005/007 |
| All analytics vendor IDs (`FND-005`) | Zeeshan — ZEE-003 env vars |
| hCaptcha site + secret key (`FND-006-T2`) | Zeeshan — ZEE-002 grievance form |
| AiSensy API key + broadcast list ID (`FND-006-T3`) | Zeeshan — ZEE-004 billing webhook |
| Company details (GSTIN, CIN, GO name) (`FND-008-T1`) | Madhu — MAD-001 legal drafts |
| Cal.com handle + WhatsApp + founder background (`FND-009-T2`) | Madhu — MAD-006 LinkedIn + LP copy |
| Live Razorpay plan IDs (`FND-004-T7`) | Zeeshan — pricing.json + ZEE-007 paywall |
| Day 1 backlog (`FND-010-T5`) | Zeeshan — ZEE-011 Day 2 P0 fixes |
| Go/No-Go verdict (`FND-013`) | Both — Day 9 beta invite clearance |
