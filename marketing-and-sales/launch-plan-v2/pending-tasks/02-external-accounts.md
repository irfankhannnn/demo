# 02 — External Account Setups

> **Scope:** Third-party vendor signups. All are **non-code** — the consuming code (LP analytics partial, billing webhook, grievance form, Sentry, Brevo) already ships and is env-gated, so each account just needs to be created and its key pasted into env (`01-infra-setup.md` INFRA-07).
> **Owner files to read:** `team-work/FOUNDER-tasks.md` (`FND-004/005/006`) and `team-work/MADHU-tasks.md` (`MAD-003/010`).
> All accounts can be created in parallel; **Razorpay KYC + Instantly warm-up are the long poles — start them first (3–21 day SLAs).**

---

## ACCT-01: PostHog — Product Analytics
**Why:** Single source of truth for the signup→paid funnel; the LP, CRM, and Lambda all emit events to the same project key. Nothing in the funnel is measurable until this exists.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- Sign up at posthog.com → **EU cloud** (`eu.i.posthog.com`) for DPDP data residency.
- Create project `RealEstateFlow`; enable session recording + funnels + cohorts.
- Capture `POSTHOG_KEY` → used in LP `.env`, CRM `VITE_POSTHOG_KEY`, Lambda `POSTHOG_KEY_SERVER` (same key all three).

## ACCT-02: GA4 — Google Analytics (LP only)
**Why:** Google-side conversion tracking for the marketing site + Google Ads attribution; CRM does not use GA4.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- Create GA4 property at analytics.google.com → capture `GA4_ID` (`G-XXXXXXXXXX`) → LP `.env` only.
- Mark `signup_completed` + `subscription_started` as conversions.

## ACCT-03: Meta Business Pixel (LP only)
**Why:** Facebook/Instagram ad attribution + retargeting audiences off the landing pages.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- Events Manager → create Pixel → capture `META_PIXEL_ID` → LP `.env` only.
- Map conversions: `Lead` (form submit), `Subscribe` (signup), `Purchase` (subscription).

## ACCT-04: LinkedIn Insight Tag (LP only)
**Why:** Attribution for LinkedIn outreach/ads — the primary B2B channel for brokers.
**Priority:** Medium (P2) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- campaignmanager → create Insight Tag → capture `LINKEDIN_PARTNER_ID` → LP `.env` only.

## ACCT-05: Sentry — Error Tracking (CRM + Server)
**Why:** The CRM and Lambda are blind without it (CloudWatch only shows logs, not grouped exceptions). Code is wired + env-guarded; just needs the two DSNs.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- Create 2 projects at sentry.io → capture `VITE_SENTRY_DSN` (CRM `.env`) + `SENTRY_DSN_SERVER` (Lambda env).
- Alert rule: any P0 error → immediate email + WhatsApp.

## ACCT-06: Hotjar — Session Recording (LP only)
**Why:** Heatmaps + recordings to debug LP drop-off before paid traffic arrives.
**Priority:** Medium (P2) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-005`
- Create project at hotjar.com → capture `HOTJAR_ID`, `HOTJAR_SV=6` → LP `.env` only.

## ACCT-07: Razorpay — Payments (KYC + Products + Plans)
**Why:** No revenue without it; the billing webhook + paywall are coded against live plan IDs. **KYC SLA is 3–7 business days and your website must be verified to issue live keys — start Day 1.**
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-004`
- Submit live KYC: company PAN, GST cert, cancelled cheque, director Aadhaar+PAN+selfie, registration cert.
- After approval: Tax Settings → GSTIN, state = Maharashtra, place-of-supply auto-detect, HSN `998314`.
- Create 4 Products + 9 Plans (config in `launch-implement/pre-launch/02-pricing/razorpay-products.md`); capture live plan IDs → `pricing.json.razorpayPlanIds.live`.
- Register webhook `https://api.realestateflow.in/api/billing/webhook` (all subscription + payment events) → capture `RAZORPAY_WEBHOOK_SECRET` → Lambda env.

## ACCT-08: Brevo — Transactional Email
**Why:** Sends grievance acknowledgements (DPDP requirement), trial reminders, and the welcome drip. The grievance/trial code calls Brevo by template ID.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-006`
- Verify domain `realestateflow.in` in sender settings; generate `BREVO_API_KEY` → Lambda env.
- Create "Trial Signups" contact list → `BREVO_TRIAL_LIST_ID`.
- Create the email templates and capture IDs: `BREVO_GRIEVANCE_ACK/NOTIFY_*`, `BREVO_TRIAL_DAY10/12/14/EXPIRED_*`, `BREVO_AI_EMPLOYEE_PAID/LIVE/ESCALATED_*`, `BREVO_WELCOME_T0_*`.

## ACCT-09: hCaptcha — Bot Protection
**Why:** Protects the public grievance form from spam/abuse (DPDP + cost control). The form verifies the token server-side.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-006`
- Sign up at hcaptcha.com (free 100k/mo) → add site `realestateflow.in`.
- Capture `VITE_HCAPTCHA_SITE_KEY` → CRM `.env` · `HCAPTCHA_SECRET_KEY` → Lambda env.

## ACCT-10: AiSensy — WhatsApp BSP
**Why:** Drives the AI-Employee onboarding broadcast; the billing webhook adds paid users to a broadcast list.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-006`
- Complete WhatsApp BSP onboarding; create broadcast list "AI-Employee-Onboarding-Pending".
- Capture `AISENSY_API_KEY`, `AISENSY_BROADCAST_LIST_ID` → Lambda env.

## ACCT-11: Instantly — Cold-Email Warm-up
**Why:** Gates Day-17 cold outreach — mailboxes need ~21 days of warm-up first, so this must start at **T-21**.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-003`
- Sign up at app.instantly.ai; connect `info@realestateflow.in` via OAuth.
- Enable warm-up ramp 5→10→15→25→40→50/day over 21 days; keep spam rate ≤0.1%.

## ACCT-12: Cal.com — Demo Booking
**Why:** Every LP CTA + email signature links to a booking page; without the handle those links 404.
**Priority:** High (P1) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-006`
- Create account; set handle `{{FOUNDER_HANDLE}}`; add "15-min RealEstateFlow Demo" (video, IST).
- Hand the handle to Madhu for LP copy + signatures.

## ACCT-13: Crisp — Helpdesk Chat
**Why:** In-app + LP live chat so Week-1 testers can reach the founder instantly; embed snippet goes in all LPs + CRM.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-010`
- Create workspace (Free, 2 seats); configure 6 saved replies + business hours + off-hours auto-reply.
- Copy the embed snippet → hand to dev for LP/CRM `index.html`; install mobile app + verify push <30s.

## ACCT-14: BetterStack — Status Page + Uptime
**Why:** Public status page + uptime alerts so outages are caught (and communicated) before customers complain.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-010`
- Create 6 monitors (`/`, `/pricing`, `/demo`, `api…/health`, `app…/`, `/api/billing/webhook`).
- Public status page → map `status.realestateflow.in` (CNAME in Cloudflare); alerts → founder email + WhatsApp.

## ACCT-15: Google Workspace — Business Inbox
**Why:** Professional `info@`/`founder@` inbox + the DKIM/MX backbone for email deliverability; outreach from a free inbox lands in spam.
**Priority:** Critical (P0) · **Read:** `team-work/MADHU-tasks.md` → `MAD-003`
- Create `info@realestateflow.in` (+ alias `founder@`); verify domain (TXT in Cloudflare).
- Generate DKIM → add TXT in Cloudflare → start authentication; set the email signature (`launch-implement/pre-launch/03-deliverability/signature.html`).
