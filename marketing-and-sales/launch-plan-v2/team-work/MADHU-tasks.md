# Madhu — Task Bifurcation
## Role: All Marketing Work (Manual + Automation)
## Phases: Pre-Launch (P1–P18) + Week 1 (Day 1–7)

> **Batch update 2026-06-11:** AI content drafts generated for MAD-001/002/003/004/008/009/010/011 (~65% pre-launch marketing). Human review + Higgsfield assets (MAD-005) + founder LinkedIn (MAD-006) remain.

> **How to use this file:**
> - Each Jira Story has an ID, phase, priority, source reference, and sub-tasks.
> - "Source File" = the exact `.md` file in `marketing-and-sales/launch-plan-v2/` to read before starting.
> - Tools used: Brevo (email), Instantly (cold outreach warm-up), AiSensy (WhatsApp), PostHog (analytics config), Crisp (helpdesk), BetterStack (status page), Netlify (forms), LinkedIn, Google Search Console.
> - All content AI-generated first using the AI Prompts in the source files, then reviewed and published manually.

---

## EPIC 1 — Pre-Launch Marketing Deliverables

---

### MAD-001 | Legal Foundation — AI-Draft + Process Coordination
- **Phase:** Pre-Launch → T-14 (start) → T-7 (publish)
- **Priority:** High (DPDP compliance + Day 1 launch blocker)
- **Source File:** `pre-launch-prep/P1-legal-foundation.md`
- **Context:** DPDP Act 2023 mandates 4 legal documents before accepting any user data: Terms of Service, Privacy Policy, Refund Policy, and Cookie Policy. These must be published at `/legal/*` before Day 1. Madhu drives the AI-generation of drafts, coordinates external lawyer review, and ensures the final content is ready for Zeeshan to publish at the LP routes.

#### Tasks
- [x] **MAD-001-T1** — Run the AI Prompt from `P1-legal-foundation.md` — ✅ drafts at `launch-implement/pre-launch/01-legal/` (placeholders pending founder)
  - Inputs: company GSTIN, CIN, registered address, Grievance Officer name + email, all sub-processors list (AWS, Razorpay, Brevo, AiSensy, Cloudflare, PostHog, Sentry, Crisp, BetterStack, Cal.com, ElevenLabs, Instantly)
  - Output: draft ToS, Privacy Policy, Refund Policy, Cookie Policy at `marketing-and-sales/launch-implement/pre-launch/01-legal/`
- [ ] **MAD-001-T2** — Review AI drafts against DPDP Act checklist (provided in P1 source file)
  - Confirm: data fiduciary obligations, data principal rights, grievance officer disclosure, consent language, retention policy, sub-processor disclosures
- [ ] **MAD-001-T3** — Send drafts to lawyer for review (Founder will provide lawyer contact)
  - Track review status; follow up within 48h if no response
  - Incorporate lawyer feedback into final drafts
- [ ] **MAD-001-T4** — Finalize all 4 documents; hand off to Zeeshan for publishing at `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/cookies`
- [ ] **MAD-001-T5** — Verify final published pages are live and linked correctly in LP footer + CRM SPA footer
- [ ] **MAD-001-T6** — Confirm signup form consent checkbox text is legally accurate per the ToS draft
- **Acceptance:** 4 legal pages live at production domain; lawyer sign-off received; footer links on all 12 LPs work; DPDP checklist 100%.

---

### MAD-002 | Pricing Strategy — Copy, FAQs, Tier Rationale
- **Phase:** Pre-Launch → T-14
- **Priority:** High (blocks LP content + Razorpay config)
- **Source File:** `pre-launch-prep/P2-pricing-strategy.md`
- **Context:** Lock the canonical pricing data so that `pricing.json`, LP copy, Razorpay product names, and CRM paywall all say the same thing. Generate pricing page copy, tier comparison table, FAQ, and Razorpay product/plan checklist. Solo=₹999/mo, Team=₹1,999/mo, Team+=₹1,999+₹500/seat, AI Employee=₹7,999/mo. All plans include 14-day free trial + 1-month refund (except AI Employee).

#### Tasks
- [ ] **MAD-002-T1** — Run the AI Prompt from `P2-pricing-strategy.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (full pricing page copy, FAQ, tier comparison table, annual discount copy)
  - Output: `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-products.md` (product/plan config checklist for Razorpay)
- [ ] **MAD-002-T2** — Write the `/pricing` page copy in collaboration with P2 output
  - Hero headline + subheadline
  - 3-column tier table (Solo/Team/Team+) with feature list per tier
  - "AI Employee add-on" section below tiers
  - Annual/monthly toggle copy (Annual = "Save ₹X/year")
  - FAQ section (10 questions: billing, refund, seats, AI Employee, trial, GST invoice)
  - CTA per tier: "Start 14-day free trial — no card"
  - Note: AI Employee = "Paid from Day 1 — concierge setup, 24h SLA"
- [ ] **MAD-002-T3** — Review `pricing.json` for accuracy; update if any field is wrong
  - Verify: `soloMonthly`, `teamMonthly`, `teamPlusPerSeat`, `aiEmployeeMonthly`, `annualDiscount.rate`, `trialDays=14`, `refundDays=30`
- [ ] **MAD-002-T4** — Hand `razorpay-products.md` to Founder for Razorpay product/plan creation (P7 dependency)
- [ ] **MAD-002-T5** — Hand `page-copy.md` to Zeeshan for `/pricing` LP build (ZEE-008 dependency)
- **Acceptance:** `page-copy.md` complete; `pricing.json` verified; Razorpay products checklist delivered to Founder.

---

### MAD-003 | Email Deliverability Setup (DNS Warm-up + Tools)
- **Phase:** Pre-Launch → T-21 (DNS) → T-14 (warm-up start)
- **Priority:** High (blocks all cold outreach from Day 17)
- **Source File:** `pre-launch-prep/P3-email-deliverability.md`
- **Context:** Cold emails from a fresh domain = spam folder = zero replies. Must configure SPF/DKIM/DMARC, run a 21-day warm-up on Instantly, set up Brevo for transactional emails, and test deliverability to score ≥90 on Glockapps before Day-17 outreach starts.

#### Tasks
- [ ] **MAD-003-T1** — Run the AI Prompt from `P3-email-deliverability.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/03-deliverability/dns-records.md` (SPF, DKIM, DMARC, MX records for `realestateflow.in`)
  - Output: 21-day warm-up plan for Instantly
- [ ] **MAD-003-T2** — Hand `dns-records.md` to Founder for Cloudflare DNS configuration
- [ ] **MAD-003-T3** — Set up Google Workspace for `info@realestateflow.in` (with Founder's Google account access)
  - Verify DKIM in Google Workspace Admin console after Founder adds DNS records
  - Send test email from `info@realestateflow.in` to personal Gmail; check headers for DMARC pass
- [ ] **MAD-003-T4** — Set up Instantly account
  - Create sending account for `info@realestateflow.in`
  - Configure warm-up plan per 21-day schedule from P3 output
  - Monitor warm-up daily: check Instantly dashboard for daily send/reply stats
  - Start warm-up immediately (T-21 for it to be ready by T-0)
- [ ] **MAD-003-T5** — Set up Brevo account for transactional emails
  - Create API key (share with Founder for env vars)
  - Create sender `info@realestateflow.in`
  - Test transactional email: trigger a test OTP email, verify delivery
- [ ] **MAD-003-T6** — Run Glockapps test at T-1: send from `info@realestateflow.in` → spam test → confirm score ≥90
  - Screenshot result → save to `pre-launch/03-deliverability/glockapps-report.png`
- [ ] **MAD-003-T7** — Create HTML email signature for `info@realestateflow.in`
  - Logo (P8 asset), name, title, phone, website, `cal.com/{{FOUNDER_HANDLE}}` link
  - Save as `pre-launch/03-deliverability/email-signature.html`
- **Acceptance:** Glockapps score ≥90; SPF/DKIM/DMARC all pass; warm-up running on Instantly; Brevo transactional email verified.

---

### MAD-004 | Competitive Positioning — Battle Cards + Vs-Pages
- **Phase:** Pre-Launch → T-14
- **Priority:** High
- **Source File:** `pre-launch-prep/P4-competitive-positioning.md`
- **Context:** Generate the wedge one-pager (why RealEstateFlow for Mumbai brokers), 4 battle cards (Sell.do, Zoho CRM, Excel/WhatsApp, NoBroker), and 3 `/vs/` LP drafts. This content feeds into the VS landing pages (Zeeshan builds), LinkedIn posts (MAD-006), cold email copy, and sales calls.

#### Tasks
- [ ] **MAD-004-T1** — Run the AI Prompt from `P4-competitive-positioning.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/sell-do.md`, `zoho-crm.md`, `excel-spreadsheet.md`, `nobroker.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/04-positioning/vs-pages/vs-sell-do.md`, `vs-zoho-crm.md`, `vs-excel-spreadsheet.md`
- [ ] **MAD-004-T2** — Review wedge one-pager for accuracy
  - Test with a "Bandra broker test": send to Founder who shares with 1 real broker contact; get gut-check feedback
  - Refine if needed based on feedback
- [ ] **MAD-004-T3** — Review each battle card: 3 competitor weaknesses vs 3 RealEstateFlow wins, objection responses, deal-stopper fact
- [ ] **MAD-004-T4** — Hand `vs-pages/` drafts to Zeeshan for `/vs/*` LP build (ZEE-008-T3 dependency)
- [ ] **MAD-004-T5** — Save battle cards for use in Crisp saved replies + cold outreach scripts
- **Acceptance:** `wedge.md` + 4 battle cards + 3 VS-page drafts complete; Founder-reviewed; VS-page content handed to Zeeshan.

---

### MAD-005 | Logo + Brand Assets Generation
- **Phase:** Pre-Launch → T-14
- **Priority:** Medium
- **Source File:** `pre-launch-prep/P8-logo-and-favicons.md`
- **Context:** Generate all brand visual assets: SVG logo (light + dark variants), complete favicon set (16x16 to 512x512), Apple touch icon, and OG image templates (1200x630) for each LP. All generated via `nano-banana-pro`. Assets are used by Zeeshan in LP rewrite (ZEE-008) and OG meta tags (ZEE-009).

#### Tasks
- [ ] **MAD-005-T1** — Run the AI Prompt from `P8-logo-and-favicons.md` using `nano-banana-pro`
  - Generate: `real-estate-crm-app/public/logo-light.svg` + `logo-dark.svg`
  - Generate: favicon set (favicon.ico, favicon-16x16.png, favicon-32x32.png, favicon-96x96.png, apple-touch-icon.png, icon-192x192.png, icon-512x512.png)
  - Generate: OG templates — `og-default.png` (for `/`), `og-pricing.png`, `og-demo.png`, `og-ai-employee.png`, `og-about.png` (1200×630 each)
  - Generate: `site.webmanifest` with all icon entries
- [ ] **MAD-005-T2** — Review all generated assets for brand accuracy
  - Logo must feel premium, clean, real-estate-relevant
  - OG images must include: logo, page title, one-line value prop, brand colours
- [ ] **MAD-005-T3** — Save all assets:
  - LP assets: `creative/landing-pages/assets/brand/` (logos, favicons, OG images used by `realestateflow.in`)
  - CRM SPA assets: `real-estate-crm-app/public/` (favicon, manifest — for `app.realestateflow.in` browser tab)
  - Source assets: `marketing-and-sales/realestateflow/assets/` (canonical source, referenced by both)
- [ ] **MAD-005-T4** — Create LinkedIn banner (1584×396 px) for Founder's profile using brand kit (for MAD-006)
  - Use `nano-banana-pro` with brand kit colors + "Building RealEstateFlow — AI for Mumbai Brokers"
- [ ] **MAD-005-T5** — Hand all assets to Zeeshan with file paths + usage instructions for ZEE-008 + ZEE-009
- **Acceptance:** All assets at correct dimensions; SVG logo validates; favicons render in browser tab; OG images pass opengraph.xyz preview; LinkedIn banner ready.

---

### MAD-006 | Founder Personal Brand — LinkedIn + 5 Pre-launch Posts
- **Phase:** Pre-Launch → T-14 (post 1) → T-3 (post 5)
- **Priority:** High
- **Source File:** `pre-launch-prep/P6-founder-personal-brand.md`
- **Context:** Cold outreach replies double when prospects see a credible LinkedIn profile + 3–5 recent posts about the problem they have. Madhu writes all 5 posts + LinkedIn profile rewrite. Founder does the actual posting + engagement. Posts seed authority, position the wedge, warm up Mumbai broker audience before Day-17 outreach.

#### Tasks
- [ ] **MAD-006-T1** — Run the AI Prompt from `P6-founder-personal-brand.md` with Founder's details
  - Inputs: `{{FOUNDER_NAME}}`, `{{FOUNDER_BACKGROUND_2_LINES}}`, `{{FOUNDER_WHY}}`, `{{FOUNDER_HANDLE}}`
  - Output: Full LinkedIn rewrite (headline 220 chars, About section, Featured 4 items) at `pre-launch/06-branding/linkedin-profile.md`
  - Output: All 5 posts at `pre-launch/06-branding/posts-1-to-5.md`
- [ ] **MAD-006-T2** — Review all 5 posts for tone (founder voice, not corporate, direct, Mumbai-relevant):
  - Post 1 (T-14): "Why I quit X to build a WhatsApp CRM for Mumbai brokers" — problem-framing
  - Post 2 (T-12): "Mumbai brokers manage 40 leads on WhatsApp. Here's what I see." — ICP insight
  - Post 3 (T-9): "We built a Khata book inside a CRM. Here's why." — feature story (with founder photo)
  - Post 4 (T-6): "90-second demo: Andheri property → buyer matched → AI message sent" — Loom demo link
  - Post 5 (T-3): "We launch in 3 days. Here's what we're building + early access." — launch teaser
- [ ] **MAD-006-T3** — Prepare cross-posting plan for each post:
  - 3 Mumbai broker WhatsApp groups (Founder to share manually)
  - 1 Indian SaaS Slack/Discord (e.g., #saasin Slack)
  - Founder's Twitter/X as threads
- [ ] **MAD-006-T4** — Create engagement tracking sheet at `pre-launch/06-branding/engagement.csv`
  - Columns: post-id, date-posted, impressions, reactions, comments, shares, profile-visits, demo-link-clicks, calendar-bookings
  - Update within 24h of each post going live
- [ ] **MAD-006-T5** — Track: Post 1 target ≥10 reactions in 24h; Post 5 target ≥50 reactions + ≥5 booking-link clicks
- [ ] **MAD-006-T6** — Hand `linkedin-profile.md` to Founder to paste into LinkedIn profile editor (T-14)
- **Acceptance:** All 5 posts drafted + reviewed; engagement tracker active; Founder has everything needed to post on schedule.

---

### MAD-007 | SEO + AEO Content: Keywords, Answers, Schema Copy
- **Phase:** Pre-Launch → T-9
- **Priority:** Medium
- **Source File:** `pre-launch-prep/P16-seo-aeo-master.md`
- **Context:** Madhu owns the content and keyword strategy layer of SEO/AEO. Zeeshan injects the schema markup into the LPs (ZEE-009) — but the actual JSON-LD content, meta titles/descriptions, AEO Q&As, and `llms.txt` content must come from Madhu first.

#### Tasks
- [ ] **MAD-007-T1** — Run the AI Prompt from `P16-seo-aeo-master.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/seo-meta-per-page.md` — per-page `<title>`, `<meta description>`, canonical URL, H1 for all 12 LPs
  - Output: `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/json-ld-per-page.md` — full JSON-LD blocks per page (SoftwareApplication, Product, FAQPage, etc.)
  - Output: `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/` — 5 AEO answer page drafts
  - Output: `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/llms-txt-content.md`
- [ ] **MAD-007-T2** — Write per-page meta titles + descriptions (English, keyword-front)
  - Primary keywords: `real estate CRM Mumbai`, `broker software Mumbai`, `WhatsApp CRM for real estate`, `AI employee for brokers`, `Khata book software for real estate agents`
  - Every title ≤60 chars; every description ≤155 chars with benefit + CTA
- [ ] **MAD-007-T3** — Write 5 AEO Q&A answer drafts (saved for M2 `/answers/*` deployment; needed before launch for `llms.txt`)
  - "What is the best real estate CRM for Mumbai brokers?"
  - "How to manage WhatsApp leads for real estate in India?"
  - "What is an AI Employee for real estate brokers?"
  - "How does Khata book work for real estate commission tracking?"
  - "Sell.do vs RealEstateFlow — which is better for Mumbai brokers?"
- [ ] **MAD-007-T4** — Write `llms.txt` content listing canonical answer pages and main pages for AI search citation
- [ ] **MAD-007-T5** — Submit sitemap to Google Search Console, Bing Webmaster Tools, Brave Search Webmaster (after Zeeshan deploys LPs Day 6)
- [ ] **MAD-007-T6** — Set up Google Search Console property for `realestateflow.in`; verify ownership via DNS TXT record (Founder adds the TXT in Cloudflare)
- [ ] **MAD-007-T7** — Hand `seo-meta-per-page.md` + `json-ld-per-page.md` to Zeeshan as inputs for ZEE-008 + ZEE-009
- **Acceptance:** All meta + JSON-LD content ready before Zeeshan starts ZEE-008; GSC property verified; sitemap submitted post-deploy.

---

### MAD-008 | GST Invoicing — Razorpay Config + CA Coordination
- **Phase:** Pre-Launch → T-3
- **Priority:** High
- **Source File:** `pre-launch-prep/P7-gst-invoicing.md`
- **Context:** Indian B2B customers' CAs reject invoices without HSN 998314, GSTIN, place-of-supply, and CGST/SGST split. Madhu runs the AI prompt to produce the invoice template + CA verification checklist, and coordinates the CA sign-off process. Founder does the actual Razorpay dashboard configuration.

#### Tasks
- [ ] **MAD-008-T1** — Run the AI Prompt from `P7-gst-invoicing.md`
  - Output: `marketing-and-sales/launch-implement/pre-launch/07-gst/invoice-template.md` — Razorpay invoice template with HSN 998314, CGST/SGST/IGST split, all required fields
  - Output: `marketing-and-sales/launch-implement/pre-launch/07-gst/ca-sign-off-checklist.md` — checklist for CA to verify invoice acceptability
  - Output: `marketing-and-sales/launch-implement/pre-launch/07-gst/razorpay-config-checklist.md` — step-by-step Razorpay setup checklist for Founder
- [ ] **MAD-008-T2** — Hand `razorpay-config-checklist.md` to Founder for Razorpay GST setup
- [ ] **MAD-008-T3** — Coordinate CA sign-off: prepare CA email with test invoice PDF + `ca-sign-off-checklist.md`
  - Track CA response; follow up if not received in 24h
  - Save confirmation email/WhatsApp screenshot to `pre-launch/07-gst/ca-sign-off-confirmation.png`
- [ ] **MAD-008-T4** — Verify CRM SPA `Settings → Billing` page lists invoices correctly (coordinate with Zeeshan if any UI changes needed)
- **Acceptance:** CA sign-off received + saved; Razorpay config checklist handed to Founder; invoice template complete.

---

### MAD-009 | Cookie Consent Banner — Copy + Compliance Review
- **Phase:** Pre-Launch → T-8
- **Priority:** Medium
- **Source File:** `pre-launch-prep/P17-cookie-consent-banner.md`
- **Context:** Two banner variants exist — LP and CRM. Madhu writes copy for both variants. Zeeshan builds both components (ZEE-006). Copy must be plain English — no dark patterns.

**Architecture note:** The LP banner has 4 toggles (Essential, Functional, Analytics, Marketing). The CRM banner has only 2 (Essential + Analytics) because GA4/Pixel/LinkedIn/Hotjar are not loaded in the CRM.

#### Tasks
- [ ] **MAD-009-T1** — Run the AI Prompt from `P17-cookie-consent-banner.md` (copy output portion)
  - Output: **LP banner copy** — button labels + 4-toggle modal labels (Essential, Functional/Hotjar, Analytics/PostHog+GA4, Marketing/Pixel+LinkedIn)
  - Output: **CRM banner copy** — button labels + 2-toggle modal labels (Essential, Analytics/PostHog only — no Marketing toggle)
  - Output: Cookie inventory table for `/legal/cookies` (all trackers used across both surfaces)
  - Output: Hinglish version drafted (not deployed M1, ready for M2)
- [ ] **MAD-009-T2** — Review both banner variants: confirm no dark patterns
  - "Reject non-essential" must be same visual weight as "Accept all" (per DPDP guidance)
  - No "by continuing to use this site you accept cookies" language
  - LP Customize: 4 toggles with clear descriptions; CRM Customize: 2 toggles — Analytics description must NOT mention "ads" (PostHog is product analytics only)
- [ ] **MAD-009-T3** — Hand cookie inventory table to MAD-001 for inclusion in Privacy Policy
- [ ] **MAD-009-T4** — Hand both copy variants to Zeeshan (ZEE-006-T1 uses LP copy, ZEE-006-T2 uses CRM copy)
- [ ] **MAD-009-T5** — Verify published LP banner: first visit from incognito → banner appears; Reject → GA4/Pixel/LinkedIn/Hotjar scripts do NOT load in network tab
- [ ] **MAD-009-T6** — Verify published CRM banner: first visit → banner appears; Reject → PostHog session recording disabled; confirm zero GA4/Pixel/LinkedIn/Hotjar network calls (they should never appear in CRM regardless of consent)
- **Acceptance:** Both copy variants ready for Zeeshan; DPDP compliance verified; cookie inventory table in Privacy Policy.

---

## EPIC 2 — Week 1 Marketing Deliverables

---

### MAD-010 | Day 5 — Crisp Helpdesk + BetterStack Status Page Setup
- **Phase:** Week 1 → Day 5
- **Priority:** High
- **Source File:** `week-1-foundation/day-05-helpdesk-status.md`
- **Context:** Mumbai brokers hitting friction need a 1-click chat path. Crisp handles 2 seats free (enough for M1). Status page builds trust during incidents. Uptime monitors catch issues before customers complain. Madhu owns the full setup of Crisp + BetterStack + saved replies.

#### Tasks
- [ ] **MAD-010-T1** — Run the AI Prompt from `day-05-helpdesk-status.md`
  - Output: `marketing-and-sales/launch-implement/week-1/day-05-crisp-saved-replies.md` — 6 saved replies (pricing, demo, refund, AI Employee, technical issue, general)
  - Output: `marketing-and-sales/launch-implement/week-1/day-05-betterstack-monitors.md` — 6 monitor configs (URL, method, check interval, regions, thresholds)
  - Output: `marketing-and-sales/launch-implement/week-1/day-05-status-page-spec.md` — status page setup spec
- [ ] **MAD-010-T2** — Create Crisp account at https://crisp.chat
  - Workspace name: RealEstateFlow; Plan: Free (2 seats)
  - Configure 6 saved replies from step T1 output (shortcut keywords: `/pricing`, `/demo`, `/refund`, `/aiemployee`, `/tech`, `/general`)
  - Business hours: Mon–Fri 09:00–19:00 IST + Sat 10:00–14:00 IST
  - Off-hours auto-reply: "We're off the clock — we'll WhatsApp you within 12h. For urgent: info@realestateflow.in"
  - Install Crisp mobile app; confirm push notifications work
- [ ] **MAD-010-T3** — Get Crisp embed snippet from dashboard; hand to Zeeshan to embed in all 5 LPs + CRM SPA `index.html`
- [ ] **MAD-010-T4** — Create BetterStack account at https://uptime.betterstack.com
  - Create 6 monitors per `day-05-betterstack-monitors.md` spec
  - Configure incident notifications: founder email + WhatsApp
  - Set up public status page at custom domain `status.realestateflow.in`
  - CNAME: hand `status.realestateflow.in` CNAME target to Founder for Cloudflare
- [ ] **MAD-010-T5** — Test downtime simulation: stop dev API for 5 min → confirm incident raised on status page → restart → confirm auto-resolved
- [ ] **MAD-010-T6** — Send test message from incognito on mobile → confirm push notification lands on founder's mobile within 30s
- [ ] **MAD-010-T7** — Write `daily-log/day05.md` standup entry
- **Acceptance:** Crisp chat live on all surfaces; 6 monitors green 1h continuous; status page live at `status.realestateflow.in`; push notifications working on founder mobile.

---

### MAD-011 | Day 6 — Welcome Drip Emails + Brevo Automation Setup
- **Phase:** Week 1 → Day 6
- **Priority:** High
- **Source File:** `week-1-foundation/day-06-landing-pages-deploy.md`
- **Context:** Any signup after Day 6 must get auto-nurtured via a 4-email welcome drip. Madhu writes all 4 emails and configures the Brevo automation workflow. Zeeshan wires the signup → Brevo contact addition (ZEE-013). Madhu's job is the content + automation configuration inside Brevo.

#### Tasks
- [ ] **MAD-011-T1** — Run the AI Prompt from `day-06-landing-pages-deploy.md` for welcome drip content
  - Output: `marketing-and-sales/launch-implement/week-1/day-06-welcome-drip.md` — 4 email copy drafts
- [ ] **MAD-011-T2** — Write final versions of 4 welcome emails (founder voice, direct, Mumbai-specific):
  - **Email 1 (T+0)** — "Welcome to RealEstateFlow — add your first buyer in 90 seconds"
    - Subject ≤50 chars; 3 para body; CTA: "Start adding buyers →" `app.realestateflow.in/buyers/new`
  - **Email 2 (T+1, +24h)** — "Have you tried adding a property?"
    - Highlight property + AI match feature; CTA: "Add your first property →"
  - **Email 3 (T+3, +72h)** — "Mumbai broker quick wins — 5-min read"
    - 3 power-user tips; CTA: "See all features →" `realestateflow.in/agency-owners`
  - **Email 4 (T+7, +168h)** — "How are you finding it? Reply to this email"
    - Founder direct; ask for feedback; no designed CTA (replies expected)
- [ ] **MAD-011-T3** — Create automation workflow in Brevo
  - Go to Brevo → Automations → Create workflow
  - Trigger: "Contact added to list `Trial Signups`"
  - Email 1: immediate (T+0)
  - Email 2: +24h delay
  - Email 3: +72h delay
  - Email 4: +168h delay
  - Activation email: separate workflow triggered via Brevo webhook when PostHog `feature_first_use` fires
- [ ] **MAD-011-T4** — Create all 4 Brevo email templates from step T2 copy
  - Capture Brevo template IDs; hand to Founder for env vars
  - Create Brevo contact list "Trial Signups" (list ID → hand to Zeeshan for `BREVO_TRIAL_LIST_ID` env var)
- [ ] **MAD-011-T5** — Smoke test: register a test trial user → confirm T+0 email arrives in inbox (not spam) within 60s
  - Check from Gmail, Outlook, and a personal Yahoo/Hotmail (tri-client test)
  - If landing in spam: check Brevo sending domain + DNS configuration with MAD-003
- [ ] **MAD-011-T6** — Set open rate target ≥40% for trial cohort by Day 14 (track in Brevo campaign analytics)
- [ ] **MAD-011-T7** — Write `daily-log/day06.md` standup entry
- **Acceptance:** All 4 Brevo templates live; automation workflow active; smoke test T+0 email delivers in <60s and lands in inbox (not spam); template IDs handed to Founder.

---

### MAD-012 | Day 7 — Legal + Content Compliance Audit
- **Phase:** Week 1 → Day 7
- **Priority:** High (Go/No-Go contribution)
- **Source File:** `week-1-foundation/day-07-final-audit.md`
- **Context:** Day 7 is the Go/No-Go gate before Day 9 beta invites. Madhu owns the legal/content compliance section of the audit: verify all footer links work, Grievance Officer disclosure is on every page, and the `/grievance` form is live and correct.

#### Tasks
- [ ] **MAD-012-T1** — Check all 12 LP footers: 4 legal page links live (`/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/cookies`); Grievance Officer block present with correct name, email, address
- [ ] **MAD-012-T2** — Check signup form: consent checkbox present; form does not submit without tick; checkbox text links to correct ToS/Privacy pages
- [ ] **MAD-012-T3** — Test `/grievance` form: submit a test grievance → confirm auto-acknowledgement email arrives; confirm ticket appears in admin `GrievanceList` page
- [ ] **MAD-012-T4** — Verify welcome drip is live: register a test signup (incognito) → confirm T+0 email arrives; check Brevo automation dashboard shows workflow triggered
- [ ] **MAD-012-T5** — Write compliance section of `marketing-and-sales/launch-implement/week-1/day-07-go-no-go.md` (Legal/Content section): GO / NO-GO + findings
- **Acceptance:** All legal checks pass; grievance form live; welcome drip confirmed; legal section of Go/No-Go report completed.

---

### MAD-013 | Ongoing — Cold Outreach Infrastructure (Warm-up Monitoring)
- **Phase:** Pre-Launch (T-21) → Week 1 (Daily)
- **Priority:** High (blocks Day 17 cold email launch)
- **Source File:** `pre-launch-prep/P3-email-deliverability.md`
- **Context:** The 21-day email warm-up started at T-21 (MAD-003) must be monitored daily. By Day 17 of the product launch (= T+10 from launch), the email reputation must be strong enough for 50 cold emails/day without hitting spam.

#### Tasks
- [ ] **MAD-013-T1** — Monitor Instantly warm-up dashboard daily during pre-launch
  - Track: daily sends, reply rate, spam rate; ensure all metrics trending positively
  - Flag to Founder immediately if spam rate exceeds 0.1% or open rate below 20%
- [ ] **MAD-013-T2** — Increase warm-up volume progressively per P3's 21-day plan:
  - Days 1–7: 10 emails/day
  - Days 8–14: 25 emails/day
  - Days 15–21: 50 emails/day
- [ ] **MAD-013-T3** — At T-1 (day before launch): run final Glockapps test, capture report, confirm ≥90 score
- [ ] **MAD-013-T4** — Prepare cold email sequence draft for Day 17 outreach (based on battle cards from MAD-004 + wedge from MAD-004)
  - 5-email sequence: intro (Day 17), follow-up 1 (Day 19), follow-up 2 (Day 21), break-up (Day 24), re-engage (Day 28)
  - Save to `marketing-and-sales/launch-implement/outreach/cold-email-sequence.md`
- **Acceptance:** Warm-up completes Day 21 with spam rate ≤0.1%; Glockapps ≥90 at T-1; cold email sequence ready for Day 17.

---

## Reference: Key Files to Read Before Starting

| Task | Read First |
|------|------------|
| MAD-001 | `pre-launch-prep/P1-legal-foundation.md` |
| MAD-002 | `pre-launch-prep/P2-pricing-strategy.md` |
| MAD-003 | `pre-launch-prep/P3-email-deliverability.md` |
| MAD-004 | `pre-launch-prep/P4-competitive-positioning.md` |
| MAD-005 | `pre-launch-prep/P8-logo-and-favicons.md` |
| MAD-006 | `pre-launch-prep/P6-founder-personal-brand.md` |
| MAD-007 | `pre-launch-prep/P16-seo-aeo-master.md` |
| MAD-008 | `pre-launch-prep/P7-gst-invoicing.md` |
| MAD-009 | `pre-launch-prep/P17-cookie-consent-banner.md` |
| MAD-010 | `week-1-foundation/day-05-helpdesk-status.md` |
| MAD-011 | `week-1-foundation/day-06-landing-pages-deploy.md` |
| MAD-012 | `week-1-foundation/day-07-final-audit.md` |
| MAD-013 | `pre-launch-prep/P3-email-deliverability.md` |

## Dependency Order (Execution Sequence)

```
MAD-003 (email deliverability T-21) ──► MAD-013 (warm-up monitoring, ongoing)
MAD-002 (pricing copy)  ──►  MAD-008 (Razorpay config)
MAD-004 (positioning)   ──►  MAD-006 (LinkedIn posts)  ──►  MAD-013 (cold email)
MAD-005 (brand assets)  ──►  MAD-007 (SEO meta) & ZEE-008/009 (LP build)
MAD-001 (legal)         ──►  MAD-009 (cookie copy)     ──►  MAD-012 (Day 7 audit)
MAD-010 (Day 5 Crisp)
MAD-011 (Day 6 drip)
MAD-012 (Day 7 legal audit)
```

## Key Handoffs (What Madhu Delivers to Zeeshan)

| Madhu Output | Zeeshan Needs It For |
|---|---|
| `pre-launch/01-legal/` — 4 legal doc drafts | ZEE-008-T3 `/legal/*` pages |
| `pre-launch/02-pricing/page-copy.md` | ZEE-008-T3 `/pricing` page + ZEE-007 modal copy |
| `pre-launch/04-positioning/vs-pages/` | ZEE-008-T3 `/vs/*` LP pages |
| `pre-launch/08-brand/` — SVG + favicons + OG images | ZEE-008-T2 LP logo + ZEE-009 OG meta |
| `pre-launch/16-seo-aeo/seo-meta-per-page.md` | ZEE-009 per-page title/description/canonical |
| `pre-launch/16-seo-aeo/json-ld-per-page.md` | ZEE-009 JSON-LD injection |
| `pre-launch/17-cookie/banner-copy.md` | ZEE-006 banner text |
| Crisp embed snippet | ZEE-013 / Zeeshan adds to LPs + SPA |
| Brevo list ID + template IDs | ZEE-013 `BREVO_TRIAL_LIST_ID` env var |
