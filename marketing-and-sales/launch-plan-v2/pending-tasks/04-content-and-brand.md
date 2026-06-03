# 04 — Content & Brand (AI-Prompt Tasks + Human Review)

These tasks require running the AI prompts defined in the source files, then human review and sign-off. All are Madhu's responsibility unless noted.

---

## CONTENT-01: Legal Foundation Drafts (MAD-001)
**Priority:** Critical — Blocks lawyer review (LEGAL-02)

- Run AI Prompt from `pre-launch-prep/P1-legal-foundation.md` with all company details from LEGAL-01
- Outputs: `tos.md`, `privacy.md`, `refund.md`, `cookies.md`, `dpa-template.md`, `_lawyer-handoff.md`
- Review against DPDP checklist; hand to lawyer

**Output path:** `marketing-and-sales/launch-implement/pre-launch/01-legal/`
**References:** `team-work/MADHU-tasks.md` MAD-001 · `pre-launch-prep/P1-legal-foundation.md`

---

## CONTENT-02: Pricing Copy + Razorpay Products Checklist (MAD-002)
**Priority:** Critical — Blocks Razorpay product creation (ACCT-07) + LP pages (PR-I)

- Run AI Prompt from `pre-launch-prep/P2-pricing-strategy.md`
- Outputs: `page-copy.md` (full /pricing page copy + FAQs), `tiers.md` (rationale), `razorpay-products.md` (product/plan config checklist)
- Founder reviews: confirm all prices match `pricing.json`; hand `razorpay-products.md` to ACCT-07

**Output path:** `marketing-and-sales/launch-implement/pre-launch/02-pricing/`
**References:** `team-work/MADHU-tasks.md` MAD-002 · `pre-launch-prep/P2-pricing-strategy.md` · `pricing.json`

---

## CONTENT-03: Email Deliverability Docs (MAD-003)
**Priority:** Critical — DNS records needed before Cloudflare setup (INFRA-06)

- Run AI Prompt from `pre-launch-prep/P3-email-deliverability.md`
- Outputs: `dns-records.md` (exact Cloudflare records), `warmup-plan.md` (21-day ramp), `signature.html` (founder email signature), `warmup-progress.md` (tracker)
- Hand `dns-records.md` to Founder for Cloudflare entry; hand `signature.html` for Google Workspace setup

**Output path:** `marketing-and-sales/launch-implement/pre-launch/03-deliverability/`
**References:** `team-work/MADHU-tasks.md` MAD-003 · `pre-launch-prep/P3-email-deliverability.md`

---

## CONTENT-04: Competitive Positioning + Battle Cards + VS-Pages (MAD-004)
**Priority:** High — Required by PR-I (LP /vs/* pages) + cold outreach (Day 17+)

- Run AI Prompt from `pre-launch-prep/P4-competitive-positioning.md`
- Outputs: `wedge.md`, 4 battle cards (Sell.do, Zoho, LeadSquared, Excel), 3 VS-page drafts
- Founder does "Bandra broker test" on wedge.md with 1 real broker contact
- Hand VS-page drafts to PR-I agent as input for `/vs/*` LP pages

**Output path:** `marketing-and-sales/launch-implement/pre-launch/04-positioning/`
**References:** `team-work/MADHU-tasks.md` MAD-004 · `pre-launch-prep/P4-competitive-positioning.md`

---

## CONTENT-05: Logo SVG + Favicons + OG Images (MAD-005)
**Priority:** High — Required by PR-I (LP pages reference logo + OG images)

- Run AI Prompt from `pre-launch-prep/P8-logo-and-favicons.md` using nano-banana-pro (Higgsfield MCP)
- Generate: `logo.svg` (light + dark), favicon set (9 sizes), 6 OG PNGs (1200×630 each), `manifest.json`, `meta-tag-snippet.html`
- Save to `marketing-and-sales/realestateflow/assets/` + copy to `creative/landing-pages/assets/brand/` + `real-estate-crm-app/public/`
- Create LinkedIn banner (1584×396) for founder profile

**References:** `team-work/MADHU-tasks.md` MAD-005 · `pre-launch-prep/P8-logo-and-favicons.md`
**Blocker:** Requires Higgsfield MCP auth (check `.mcp.json`)

---

## CONTENT-06: Founder LinkedIn Profile + 5 Pre-launch Posts (MAD-006)
**Priority:** High — Required before Day-17 outreach (warm reply rate)

- Run AI Prompt from `pre-launch-prep/P6-founder-personal-brand.md` with founder details from LEGAL-01
- Outputs: `linkedin-profile.md` (headline, about, featured), `posts-1-to-5.md`, `posting-cadence.md`
- Founder pastes LinkedIn profile into LinkedIn editor at T-14
- Schedule 5 posts (T-14, T-12, T-9, T-6, T-3) via LinkedIn native scheduler
- Post 4 requires recording a 90-sec Loom of the CRM demo (Andheri property → buyer → AI Employee transcript)

**Output path:** `marketing-and-sales/launch-implement/pre-launch/06-branding/`
**References:** `team-work/MADHU-tasks.md` MAD-006 · `pre-launch-prep/P6-founder-personal-brand.md` · `linkedin-posts/post-1-why-im-building.md` (existing drafts to cross-reference)

---

## CONTENT-07: SEO/AEO Meta + JSON-LD + AEO Answer Drafts (MAD-007)
**Priority:** High — Required as input for PR-I (LP pages inject JSON-LD)

- Run AI Prompt from `pre-launch-prep/P16-seo-aeo-master.md`
- Outputs: `seo-meta-per-page.md` (title/description for 12 pages), `json-ld-per-page.md` (JSON-LD blobs), 5 AEO answer page drafts, `llms-txt-content.md`
- Hand `seo-meta-per-page.md` + `json-ld-per-page.md` to PR-I agent as inputs

**Output path:** `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/`
**References:** `team-work/MADHU-tasks.md` MAD-007 · `pre-launch-prep/P16-seo-aeo-master.md`

---

## CONTENT-08: GST Invoice Template + CA Checklist (MAD-008)
**Priority:** Critical — Required for ACCT-07 Razorpay config + LEGAL-03 CA sign-off

- Run AI Prompt from `pre-launch-prep/P7-gst-invoicing.md`
- Outputs: `invoice-template.md` (Razorpay invoice config), `ca-sign-off-checklist.md`, `razorpay-config-checklist.md`
- Hand `razorpay-config-checklist.md` to Founder for Razorpay GST configuration

**Output path:** `marketing-and-sales/launch-implement/pre-launch/07-gst/`
**References:** `team-work/MADHU-tasks.md` MAD-008 · `pre-launch-prep/P7-gst-invoicing.md`

---

## CONTENT-09: Cookie Consent Banner Copy (MAD-009)
**Priority:** High — Required as input for PR-C agent (banner copy text)

- Run AI Prompt from `pre-launch-prep/P17-cookie-consent-banner.md` (copy portion)
- Outputs: LP banner copy (4-toggle labels), CRM banner copy (2-toggle labels), cookie inventory table, Hinglish draft
- Hand both variants to PR-C agent before that PR starts

**Output path:** `marketing-and-sales/launch-implement/pre-launch/17-cookie-banner/`
**References:** `team-work/MADHU-tasks.md` MAD-009 · `pre-launch-prep/P17-cookie-consent-banner.md`

---

## CONTENT-10: Welcome Drip Emails (MAD-011)
**Priority:** High — Required for Brevo automation setup on Day 6

- Run AI Prompt from `week-1-foundation/day-06-landing-pages-deploy.md` for email content
- Write 4 welcome emails (T+0, T+1, T+3, T+7) in founder voice, Mumbai-specific
- Create automation workflow in Brevo: Trigger on "Contact added to Trial Signups list" → 4 email steps
- Capture 4 Brevo template IDs → hand to Founder for Lambda env vars

**Output path:** `marketing-and-sales/launch-implement/week-1/day-06-welcome-drip.md`
**References:** `team-work/MADHU-tasks.md` MAD-011 · `week-1-foundation/day-06-landing-pages-deploy.md`
