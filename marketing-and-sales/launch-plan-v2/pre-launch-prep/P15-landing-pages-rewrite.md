# P15 — Landing Pages Rewrite (English + New Pricing + Mumbai-First)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-11 → T-2 (deploy)
> **Skill(s):** `landing-page` + `copywriting`
> **Estimated time:** 1h founder · 12h AI

## Architecture Context (read before implementing)

The public website (`realestateflow.in`) and the CRM app (`app.realestateflow.in`) are **two separate Netlify deployments**:
- LPs live in `creative/landing-pages/` → deployed to `realestateflow.in`
- CRM SPA lives in `apps/crm/real-estate-crm-app/` → deployed to `app.realestateflow.in`

All LP "Start trial" CTAs must deep-link to the CRM signup with UTM params so PostHog can stitch the LP session to the CRM signup session:
```
https://app.realestateflow.in/signup?utm_source=lp-{page}&utm_campaign=launch&utm_medium=cta
```
Page-specific values: `lp-main`, `lp-agency-owners`, `lp-agents`, `lp-ai-employee`, `lp-demo`, `lp-pricing`.

The LP also has a **secondary lead-capture Netlify Form** (for visitors not ready to sign up). This is separate from the "Start trial" CTA and posts to Netlify Forms only — it does NOT go to the CRM signup flow.

LP analytics (GA4, Meta Pixel, LinkedIn, Hotjar, PostHog) all live **on the LP only** — none of these go into the CRM SPA. See P10 for full analytics architecture.

## Objective
Rewrite the 5 retained landing pages (`main`, `agency-owners`, `agents`, `ai-employee`, `demo`) in English with the new ₹999/₹1,999+₹500/₹7,999 pricing, 14-day trial / 1-month refund / Mumbai-first social proof, analytics IDs from build env (P10 `_partials/head-analytics.hbs`), real Cal.com handle, real WhatsApp number, real `info@realestateflow.in`, OG image per page, JSON-LD schema (P16), inline SVG logo (P8), built-CSS pipeline (replacing Tailwind CDN), and add new pages (`/pricing`, `/legal/*`, `/grievance`, `/vs/*`, `/about`).

## Why This Matters for RealEstateFlow
Existing LPs at `creative/landing-pages/` are Hinglish + ₹3,000-based + Mumbai-Pune-Delhi-Dubai social proof. Conflicts with v2 plan locked decisions. Without rewrite, the launch would deliver mixed messaging, wrong pricing, GDPR compliance gaps, and broken share previews.

## User Story
As a Mumbai broker who clicked a Day-17 cold email link to `realestateflow.in`, I want a fast, clear, English landing page with current ₹999 pricing, real Mumbai social proof, and a 14-day-no-card CTA that takes me to signup in <30 seconds, so I trust the brand and start a trial.

## Acceptance Criteria
- [ ] 5 LPs at `creative/landing-pages/{main,agency-owners,agents,ai-employee,demo}/index.html` rewritten in English
- [ ] `creative/landing-pages/enterprise/` folder DELETED + removed from `netlify.toml`
- [ ] All pricing pulled from `pricing.json` via templating (no inline numbers anywhere)
- [ ] All trial copy says "14-day free trial — no card" (Solo/Team/Team+) and "Paid from day 1 — concierge setup" (AI Employee)
- [ ] All refund copy says "1 month money-back guarantee" (Solo/Team/Team+) — never 6-month
- [ ] Mumbai-first social proof until Day 14 (replaces "200+ Agencies · Mumbai · Delhi · Pune · Dubai" → "Mumbai-built · early-access launch")
- [ ] Analytics snippet from P10 `_partials/head-analytics.hbs` in `<head>` of all LPs (PostHog + GA4 + Pixel + LinkedIn + Hotjar, all gated by cookie consent, all IDs from build env vars — do NOT hardcode IDs)
- [ ] **No GA4, Meta Pixel, LinkedIn, Hotjar tags in the CRM SPA** — LP-only
- [ ] LP `.env.example` documents all required build-time IDs: `GA4_ID`, `META_PIXEL_ID`, `LINKEDIN_PARTNER_ID`, `HOTJAR_ID`, `POSTHOG_KEY`
- [ ] Real Cal.com handle (`cal.com/{{HANDLE}}`) replacing `YOUR_CALENDLY_USERNAME`
- [ ] Real WhatsApp number (`+91 9XXXXXXXXX`) replacing `919999999999` placeholder — `wa.me/{number}` and `tel:` links work
- [ ] Real email `info@realestateflow.in` replacing `hello@realestateflow.in` placeholder
- [ ] Inline SVG logo (P8) replacing ad-hoc inline SVG
- [ ] OG meta tags per page reference correct OG image from P8 (e.g., `og-default.png` on `/`, `og-pricing.png` on `/pricing`)
- [ ] JSON-LD schema (per P16 spec): `SoftwareApplication` on `/`, `Product` × 3 on `/pricing`, `FAQPage` on every LP, `Organization` everywhere, `LocalBusiness` on `/about`, `Article + FAQPage + BreadcrumbList` on `/vs/*`
- [ ] Cookie consent banner (P17) embedded in `<head>` of all LPs
- [ ] All LPs reference `/legal/{terms,privacy,refund,cookies}` + `/grievance` in footer
- [ ] Grievance Officer disclosure block in footer of all LPs (per P9)
- [ ] Real YouTube/Loom demo video embedded on `/`, `/agency-owners`, `/ai-employee`, `/demo`
- [ ] Tailwind CDN replaced with built CSS pipeline (Vite or PostCSS); LPs deploy with bundled CSS file
- [ ] Lighthouse mobile ≥90 (Performance, Accessibility, Best Practices, SEO) on each LP
- [ ] LCP <2.5s · INP <200ms · CLS <0.1
- [ ] LP forms post to Netlify Forms with names: `lead-capture-main`, `demo-booking`, `agency-signup`, `agent-signup`, `ai-employee-interest`
- [ ] New pages created:
  - `/pricing` — full tier comparison from P2 page-copy.md
  - `/legal/{terms,privacy,refund,cookies}` — content from P1
  - `/grievance` — form from P9 (already deployed; LP just links to it)
  - `/vs/sell-do`, `/vs/zoho-crm`, `/vs/excel-spreadsheet` — from P4 vs-pages drafts
  - `/about` — founder story + LocalBusiness schema
- [ ] Sitemap.xml + robots.txt + llms.txt at LP root (P16 covers full schema)
- [ ] All LPs deployed to Netlify; `realestateflow.in` and `www.realestateflow.in` resolve

## AI Prompt (🤖)

```
You are a senior B2B SaaS landing-page engineer + copywriter. Read inputs:
- `marketing-and-sales/creative/landing-pages/main/index.html` (existing structure to preserve, copy to retire)
- `marketing-and-sales/creative/landing-pages/{agency-owners,agents,ai-employee,demo}/index.html`
- `marketing-and-sales/creative/landing-pages/netlify.toml`
- `marketing-and-sales/creative/landing-pages/README.md`
- `marketing-and-sales/launch-plan-v2/pricing.json`
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (P2 output)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md` (P4)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/vs-pages/vs-{sell-do,zoho-crm,excel-spreadsheet}.md` (P4)
- `marketing-and-sales/launch-implement/pre-launch/01-legal/{tos,privacy,refund,cookies}.md` (P1)
- `marketing-and-sales/realestateflow/assets/logos/final/logo.svg` (P8)
- `marketing-and-sales/realestateflow/assets/og/og-{default,pricing,...}.png` (P8)
- `marketing-and-sales/launch-implement/pre-launch/10-analytics/lp-head-snippet.html` (P10)
- `marketing-and-sales/research/icp-report-mumbai-launch.md`
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/realestateflow/direction1..4.html` (4 broker-segment design references)

Produce these outputs:

## 1. Build pipeline migration
- Create `creative/landing-pages/build/` folder with: `package.json` (Vite), `tailwind.config.js`, `postcss.config.js`, `src/styles.css` (Tailwind directives + custom utilities), `vite.config.js` outputting bundled CSS for LPs
- Each LP HTML imports the bundled CSS instead of Tailwind CDN
- Build command: `npm run build:lps` produces optimized HTML + CSS in `creative/landing-pages/dist/`
- Document in `creative/landing-pages/build/README.md`

## 2. Rewrite each LP — single template engine + per-page overrides

Use a simple Handlebars-like include system (or static partials). Create:
- `creative/landing-pages/_partials/head.hbs` (meta tags, canonical, OG tags, cookie banner, schema slot)
- `creative/landing-pages/_partials/head-analytics.hbs` (P10 analytics snippet — PostHog + GA4 + Pixel + LinkedIn + Hotjar, gated by cookie consent, IDs from build env vars)
- `_partials/header.hbs` (logo, nav, CTAs)
- `_partials/footer.hbs` (legal links, GO disclosure, social, contact)
- `_partials/cta-block.hbs`
- `_partials/pricing-cards.hbs` (reads pricing.json)
- `_partials/faq.hbs`

**CTA convention for ALL primary "Start Trial" buttons across all LPs:**
```html
<a href="https://app.realestateflow.in/signup?utm_source=lp-{PAGE_SLUG}&utm_campaign=launch&utm_medium=cta" 
   data-cta-id="hero-primary" class="btn-primary">
  Start 14-day Free Trial — no card
</a>
```
Replace `{PAGE_SLUG}` with: `main`, `agency-owners`, `agents`, `ai-employee`, `demo`, `pricing`.
This deep-links to the CRM signup page (not just the CRM root) so PostHog can attribute the conversion.

Then each LP = data file + template; build script renders.

For each page produce:

### 2.1 `creative/landing-pages/main/index.html` (homepage)
H1: "Hire an AI Employee for Your Real Estate Agency."
H2: "It runs your CRM, qualifies leads on WhatsApp, follows up buyers, and closes your Khata book — without hiring another agent. Built in Mumbai, for Mumbai brokers first."
Sections:
- Hero with:
  - Primary CTA → `app.realestateflow.in/signup?utm_source=lp-main&utm_campaign=launch&utm_medium=cta`
  - Secondary "Book a 15-min Demo" → `cal.com/{{FOUNDER_HANDLE}}`
  - Tertiary "Explore live demo (no signup)" → `demo.realestateflow.in`
- Trust strip "Mumbai-built · GST invoices · 1-month money-back · Data stays in India"
- 3-feature row (CRM, AI Employee, Khata Book)
- 90-sec demo video embed
- Persona-led "Made for Mumbai brokers" section (Priya/Arjun/Suresh from personas)
- Pricing teaser (3 tier cards, "Compare full pricing →" CTA to /pricing)
- 3 testimonial placeholders (Day-14 swap)
- 5 FAQs (consolidated from pricing FAQ + 2 about AI Employee)
- Final CTA + footer with GO + legal

### 2.2 `agency-owners/index.html`
H1: "Your AI Employee. Their workload."
Targets: agency owners 2-3 agents — paid-search funnel later
Sections: hero + Why-CRMs-fail-Mumbai-agencies + AI Employee 3-step + ROI calculator placeholder + pricing teaser + agency-specific testimonials + FAQ + CTA

### 2.3 `agents/index.html`
H1: "An AI teammate that never sleeps. ₹999/month."
Targets: solo brokers — LinkedIn/WhatsApp funnel
Sections: hero + Day-in-life-of-broker vignette + 3-feature + 90-sec demo + pricing teaser (Solo emphasis) + testimonials + FAQ + CTA

### 2.4 `ai-employee/index.html`
H1: "₹7,999/month. Cheaper than a junior agent. Works 24×7 on WhatsApp."
Targets: owners adopting OpenClaw add-on — Meta video ads
Sections: hero + How-it-works (concierge 24h SLA) + 3 sample WhatsApp transcripts (from demo seed) + comparison "AI Employee vs hiring junior agent" + pricing emphasis + 5 FAQs (mostly AI Employee specific: 24h SLA, no trial, refund logic, data privacy on conversation logs) + CTA "Add AI Employee" → contact form
Footer: "Powered by OpenClaw" small mention (allowed per master plan §0.1)

### 2.5 `demo/index.html`
H1: "See it qualify a buyer in under 90 seconds."
Targets: paid traffic for Cal.com booking
Sections: hero with embedded 90-sec demo video + Cal.com inline embed + "What you'll see" 3 bullets + 1 testimonial + CTA "Or start trial directly →"

### 2.6 `pricing/index.html` (NEW)
Full pricing page from P2 `page-copy.md` — 3 tier cards + AI Employee toggle + annual switcher + comparison table + 5 FAQs + final CTA. Uses pricing-cards partial.

### 2.7 `legal/{terms,privacy,refund,cookies}/index.html` (NEW)
Static rendering of the 4 markdown files from P1 → HTML. Plain typography, sticky TOC sidebar on desktop, mobile-friendly.

### 2.8 `vs/{sell-do,zoho-crm,excel-spreadsheet}/index.html` (NEW)
Render the P4 `/vs/*` markdown drafts as HTML. Each gets its own OG image (TODO: generate via P8 follow-up if not in original 6).

### 2.9 `about/index.html` (NEW)
Founder story + Mumbai-built badge + team (just founder) + LocalBusiness schema spec. ~600 words.

## 3. Sitemap + robots + llms
- `sitemap.xml` lists all 12 pages with lastmod, priority, changefreq
- `robots.txt` allows all + sitemap reference
- `llms.txt` (manifest for AI search) lists canonical answer pages — full file generated in P16 with AEO content; this task creates the stub with all paths

## 4. `netlify.toml` updates
- Drop `/enterprise` redirect
- Add redirects: `/legal` → `/legal/terms` (no trailing slash → trailing slash), `/help` → `/grievance`
- Security headers: HSTS, CSP (allowing PostHog/GA4/Pixel/LinkedIn/Hotjar/Razorpay), X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin
- Form spam protection: Akismet or honeypot

## 5. Replace placeholders
Search-and-replace across all rendered HTML:
- `YOUR_CALENDLY_USERNAME` → real handle
- `919999999999` → real WhatsApp
- `hello@realestateflow.in` → `info@realestateflow.in`
- `G-XXXXXXXXXX` → real GA4 ID (env-driven)
- Pixel `1234567890` → real Pixel ID
- Hotjar placeholder → real Hotjar ID
- LinkedIn Partner ID `XXXX` → real

## 6. Lighthouse + 4G test
- Run Lighthouse mobile in CI (GitHub Actions or local) on each page; capture report; fix blockers until ≥90 across all 4 categories
- Test on real iPhone + low-end Android over throttled 4G; capture screenshots

## 7. Acceptance test
- Open `realestateflow.in` in incognito → loads in <2.5s on 4G → all CTAs route correctly → cookie banner shows → form submits → analytics events fire (P10)
- Test all 12 page URLs return 200
- Test OG previews via opengraph.xyz

## 8. Deploy
- Connect Netlify to git (or push manually): `netlify deploy --prod --dir=creative/landing-pages/dist`
- Map custom domain `realestateflow.in` + `www.realestateflow.in` (CNAME via Cloudflare)

Stop here. Do NOT replace placeholders with values you don't have — leave `{{HANDLE}}` etc. and document in the output README which placeholders need founder-supplied values before final deploy.
```

## Manual Steps (🧍)

1. **Provide placeholder values**: Cal.com handle, WhatsApp number, founder name, GSTIN/CIN, real GA4/Pixel/Hotjar/LinkedIn IDs. Add to `marketing-and-sales/launch-implement/pre-launch/15-lps/placeholders.env`.
2. **Run AI Prompt**, then run `npm run build:lps` to render dist.
3. **Verify locally**: `npx serve dist` → click through all 12 URLs → confirm Lighthouse ≥90.
4. **Connect Netlify** to git or upload dist folder. Map domain.
5. **Configure Cloudflare DNS** for `realestateflow.in` to point to Netlify.
6. **Test in production** from incognito: 12 URLs, all return 200, all CTAs work, all analytics events fire (P10), cookie banner shows.
7. **Submit sitemap** to Google Search Console + Bing Webmaster.
8. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- All P1-P12 outputs (legal MDs, pricing copy, wedge, vs-pages, logo, OG, analytics snippet, cookie banner)
- `pricing.json`
- Existing LPs (structure to preserve)
- Founder-supplied placeholders

## Outputs
- 12 LPs at `creative/landing-pages/{main,agency-owners,agents,ai-employee,demo,pricing,legal/*,vs/*,about}/index.html`
- `creative/landing-pages/build/` (Vite pipeline)
- `creative/landing-pages/dist/` (deploy artefacts)
- `creative/landing-pages/_partials/` (head, head-analytics, header, footer, cta-block, pricing-cards, faq, cookie-banner)
- `creative/landing-pages/.env.example` (documents all build-time IDs: `GA4_ID`, `META_PIXEL_ID`, `LINKEDIN_PARTNER_ID`, `HOTJAR_ID`, `POSTHOG_KEY`)
- Updated `netlify.toml`
- `sitemap.xml`, `robots.txt`, `llms.txt` (stub — P16 fills llms.txt)

**Not in outputs (lives in CRM, not LP):** `apps/crm/real-estate-crm-app/src/lib/analytics.ts`, `CookieConsentBanner.tsx` — those are CRM-only and built by P10/ZEE-003/ZEE-006.

## Success Criterion
12 URLs return 200; Lighthouse mobile ≥90 across all 4 categories; OG previews render correctly; analytics fires; cookie banner blocks until consent.

## Fallback / Plan B
If Vite build pipeline is brittle, fall back to direct HTML edits with shared partials via `<include>` macros. Keep Tailwind CDN in dev; only migrate to built CSS when Lighthouse blocked.

## Risks
| Risk | Mitigation |
|---|---|
| Pricing drift LP vs SPA | All pricing from `pricing.json`; build script verifies |
| Placeholder leak to production | Pre-deploy grep for `XXXX` / `YOUR_` / `hello@` patterns |
| Lighthouse <90 from Tailwind CDN | Migrate to bundled CSS in build |
| OG image broken | Pre-deploy opengraph.xyz check on all 12 URLs |
| Form spam | Honeypot + Akismet + rate limit |
| Mobile breaks | Real-device test on iPhone + low-end Android |

## India / Mumbai-Specific Notes
- All copy English with occasional Mumbai locality names (Andheri, Bandra, Powai, Thane, Worli)
- All prices INR ₹ symbol
- WhatsApp + UPI + GST badges in trust strip
- Cookie banner DPDP-compliant per P17

## Dependencies
- **Blocks:** Day 6 (LP deploy), Day 17 (cold outreach links resolve)
- **Depends on:** P1, P2, P4, P8, P10, P17

## Connected Skills
- `landing-page` — primary
- `copywriting` — copy refinement
- `seo-audit` — Lighthouse + tech-SEO sweep
- `schema-markup` — JSON-LD via P16
