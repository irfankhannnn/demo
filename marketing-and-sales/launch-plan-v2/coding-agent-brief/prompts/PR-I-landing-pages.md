# Agent Prompt — PR-I: Landing Pages HTML (12 Pages + JSON-LD Schemas)

**Branch to create:** `cursor/pr-3i-landing-pages-8e67`
**Base branch:** `main` (after Batch 2 is merged)
**Batch:** 3 (Day 3) — runs in parallel with PR-H
**Hard dependencies:**
- PR-C merged (`_partials/cookie-banner.html` must exist)
- PR-D merged (LP build pipeline + `_partials/head.hbs`, `footer.hbs` must exist)

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md` (§2 Two-Codebase, §5 Analytics)
2. `marketing-and-sales/launch-plan-v2/coding-agent-brief/01-SHARED-CONTRACTS.md`
3. `creative/landing-pages/_partials/head.hbs` (created by PR-D — base head template)
4. `creative/landing-pages/_partials/footer.hbs` (created by PR-D — base footer template)
5. `creative/landing-pages/_partials/cookie-banner.html` (created by PR-C — inject in all pages)
6. `creative/landing-pages/main/index.html` (existing page — understand structure to rewrite)
7. `marketing-and-sales/launch-plan-v2/pricing.json` (ALL pricing comes from here)
8. `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
9. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P15-landing-pages-rewrite.md`
10. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P16-seo-aeo-master.md`
11. `marketing-and-sales/launch-plan-v2/vs-pages/vs-sell-do.md` (content source)
12. `marketing-and-sales/launch-plan-v2/vs-pages/vs-zoho-crm.md` (content source)
13. `marketing-and-sales/launch-plan-v2/vs-pages/vs-excel-spreadsheet.md` (content source)

---

## Architecture Rule

This PR owns ONLY the LP folder (`creative/landing-pages/`). Never touch `agency-app/web/` or `agency-app/api/`.

---

## What to Build

### CTA Convention (MANDATORY for ALL primary "Start Trial" buttons)

Every primary CTA button across all 12 pages must use this exact deep-link pattern:
```html
<a href="https://app.realestateflow.in/signup?utm_source=lp-{PAGE_SLUG}&utm_campaign=launch&utm_medium=cta"
   data-cta-id="hero-primary"
   class="btn-primary">
  Start 14-day Free Trial — no card
</a>
```

Page slugs: `main`, `agency-owners`, `agents`, `ai-employee`, `demo`, `pricing`.

The Netlify Forms lead-capture form is SECONDARY (below fold, for non-trial-ready visitors) and posts to Netlify Forms only — it is NOT the primary CTA.

### Page Build Pattern

Every page includes:
1. `_partials/head.hbs` (meta, OG, schema slot, analytics snippet reference)
2. `_partials/head-analytics.hbs` (analytics — injected by head.hbs via `{{> head-analytics}}`)
3. `_partials/cookie-banner.html` (cookie consent — injected just before `</body>`)
4. `_partials/header.hbs` (nav with logo + CTAs)
5. Page-specific content
6. `_partials/footer.hbs` (legal links, GO disclosure)

### Page Specifications

#### `main/index.html` (homepage — rewrite existing)
- H1: "Hire an AI Employee for Your Real Estate Agency."
- H2: "It runs your CRM, qualifies leads on WhatsApp, follows up buyers, and updates your Khata book — without hiring another agent."
- Trust strip: "Mumbai-built · GST invoices · 1-month money-back · Data stays in India"
- Sections: Hero | 3-feature row (CRM/AI Employee/Khata) | Demo video embed placeholder | Social proof strip "Mumbai-built · early-access launch" | Pricing teaser (3 tier cards → link to /pricing) | 3 testimonial placeholders (labeled "[TESTIMONIAL PENDING — replace Day 14]") | 5 FAQs | Footer
- JSON-LD schemas: `SoftwareApplication`, `Organization`, `WebSite`, `FAQPage`, `ContactPoint`

#### `agency-owners/index.html`
- H1: "Your AI Employee. Their workload."
- Target: agency owners, 2-3 agent teams
- Sections: Hero | Why-CRMs-fail-Mumbai (3 pains) | AI Employee 3-step | ROI calc placeholder | Pricing teaser | Testimonial placeholders | FAQ | Footer

#### `agents/index.html`
- H1: "An AI teammate that never sleeps. ₹999/month."
- Target: solo brokers
- Sections: Hero | Day-in-life vignette (Mumbai solo broker morning) | 3-feature | Demo video | Pricing (Solo emphasis) | Testimonials | FAQ | Footer

#### `ai-employee/index.html`
- H1: "₹7,999/month. Cheaper than a junior agent. Works 24×7 on WhatsApp."
- Target: agencies considering AI add-on
- Sections: Hero | How-it-works (concierge 24h SLA) | 3 sample WhatsApp transcript placeholders | AI vs junior agent comparison | Pricing | 5 FAQs (AI Employee specific) | CTA form (posts to Netlify Forms "ai-employee-interest") | Footer
- Note: "Paid from Day 1 — concierge setup" badge (NO "14-day trial" language on AI Employee tier)

#### `demo/index.html`
- H1: "See it qualify a buyer in under 90 seconds."
- Sections: Hero with video embed | Cal.com inline embed (placeholder `{{CAL_HANDLE}}`) | 3 "What you'll see" bullets | 1 testimonial placeholder | "Or start trial directly →" CTA
- CTA: `app.realestateflow.in/signup?utm_source=lp-demo&utm_campaign=launch`

#### `pricing/index.html` (NEW)
- Full pricing page
- H1: "Honest pricing for honest brokers."
- Annual/Monthly toggle (default Monthly)
- 4 tier cards (Solo, Team, Team+, AI Employee add-on)
- Prices read from `pricing.json` via template variables
- Comparison table (features × tiers)
- 5 FAQs from `pricing.json` FAQ section
- Trust badges
- JSON-LD: `Product` × 3 (Solo/Team/Team+), `FAQPage`

#### `legal/terms/index.html`, `legal/privacy/index.html`, `legal/refund/index.html`, `legal/cookies/index.html` (NEW)
- Plain HTML rendering of the legal markdown content (use placeholder text if actual signed docs not available)
- Placeholder: `[LEGAL CONTENT PENDING LAWYER SIGN-OFF — contact info@realestateflow.in]`
- Include TOC sidebar on desktop
- JSON-LD: `WebPage`, `Organization`

#### `vs/sell-do/index.html`, `vs/zoho-crm/index.html`, `vs/excel-spreadsheet/index.html` (NEW)
- Render the vs-pages markdown from `marketing-and-sales/launch-plan-v2/vs-pages/`
- H1 from each file's intro
- Side-by-side comparison table
- "When X is right" + "When RealEstateFlow is right" sections
- 5 FAQs
- JSON-LD: `Article`, `FAQPage`, `BreadcrumbList`

#### `about/index.html` (NEW)
- Founder story (use placeholders: `{{FOUNDER_NAME}}`, `{{FOUNDER_BACKGROUND}}`)
- "Mumbai-built" section
- Contact + CTA
- JSON-LD: `Organization`, `LocalBusiness`

### JSON-LD Schema Files

Generate one JSON-LD file per page at:
`marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/schema/{slug}.json`

Where `{slug}` = `main`, `pricing`, `agency-owners`, `agents`, `ai-employee`, `demo`, `about`, `grievance`, `vs-sell-do`, `vs-zoho-crm`, `vs-excel`, `legal-terms`, `legal-privacy`

Each file should be the raw JSON-LD blob to paste into `<script type="application/ld+json">` tags in the page `<head>`.

For the homepage (`main.json`):
```json
[
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RealEstateFlow",
    "description": "AI Employee that runs your real estate broking agency on WhatsApp + Telegram. CRM, lead qualification, Khata book.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": [
      { "@type": "Offer", "name": "Solo", "price": "999", "priceCurrency": "INR" },
      { "@type": "Offer", "name": "Team", "price": "1999", "priceCurrency": "INR" },
      { "@type": "Offer", "name": "AI Employee", "price": "7999", "priceCurrency": "INR" }
    ],
    "url": "https://realestateflow.in",
    "publisher": { "@type": "Organization", "name": "RealEstateFlow", "url": "https://realestateflow.in" }
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "RealEstateFlow",
    "url": "https://realestateflow.in",
    "logo": "https://realestateflow.in/assets/brand/logo.svg",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "info@realestateflow.in",
      "availableLanguage": ["English", "Hindi", "Marathi"]
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN"
    }
  }
]
```

### AEO Answer Page Drafts

Create 5 markdown drafts at `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/`:
- `best-crm-india.md` — Q: "What's the best CRM for real estate brokers in India?" — 1500-2000 words
- `whatsapp-leads-mumbai.md` — Q: "How do real estate agents in Mumbai manage WhatsApp leads?"
- `cost-of-real-estate-crm-india.md` — Q: "How much does a real estate CRM cost in India?"
- `cheapest-ai-agent-realestate.md` — Q: "What's the cheapest AI agent for real estate WhatsApp?"
- `khata-book-software.md` — Q: "Can a CRM handle Khata book for property brokers?"

Each: 80-word direct answer at top → 1000+ word expansion → comparison table → FAQ (5 Q&A).

### Update `sitemap.xml` and `llms.txt`

PR-D created stubs. Update:

`sitemap.xml` — fill real URLs with priorities:
```xml
<url><loc>https://realestateflow.in/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>
<url><loc>https://realestateflow.in/pricing</loc><priority>0.9</priority></url>
<!-- ... all 12 pages ... -->
```

`llms.txt` — fill with AEO answer pages:
```
# RealEstateFlow
> AI Employee for real estate broking agencies. ₹999 to start. Mumbai-built.

## Core
- [Homepage](https://realestateflow.in)
- [Pricing](https://realestateflow.in/pricing)

## AEO Answers
- [Best CRM India](https://realestateflow.in/answers/best-crm-india)
...
```

---

## SEO Requirements for Every Page

- `<title>` ≤60 chars, keyword-front
- `<meta description>` ≤155 chars with primary keyword + benefit + CTA
- Single `<h1>` per page
- `<link rel="canonical" href="https://realestateflow.in/{page}/">`
- `lang="en"`
- OG tags: `og:title`, `og:description`, `og:image` (placeholder path `/assets/og/og-{page}.png`), `og:url`, `og:type=website`
- `<meta name="twitter:card" content="summary_large_image">`
- Internal links: every page → /pricing, /demo; / → all 5 persona LPs

---

## What NOT to Touch

- `agency-app/web/` — never
- `agency-app/api/` — never
- `creative/landing-pages/_partials/*.hbs` — created by PR-D; include them but don't rewrite
- `creative/landing-pages/_partials/cookie-banner.html` — created by PR-C; inject via template but don't modify

---

## Acceptance Criteria

- [ ] All 12 URLs return 200 when built and served
- [ ] No hardcoded prices — all from pricing.json references
- [ ] All primary CTAs use `app.realestateflow.in/signup?utm_source=lp-{page}...` deep-link
- [ ] No `YOUR_CALENDLY_USERNAME` or `YOUR_PIXEL_ID` or `hello@realestateflow.in` strings in built HTML
- [ ] Placeholder markers `{{FOUNDER_HANDLE}}`, `{{WHATSAPP_NUMBER}}`, `{{GA4_ID}}` documented in `.env.example`
- [ ] All 12 JSON-LD files created and valid JSON
- [ ] sitemap.xml lists all 12 pages
- [ ] `enterprise/` folder deleted (and netlify.toml redirect removed — PR-D did this)

---

## PR Description Template

```
PR-I: Landing pages rewrite — 12 HTML pages + JSON-LD schemas + AEO answer drafts

Batch 3 | Day 3 | Parallel with PR-H
Depends on: PR-C (cookie-banner.html), PR-D (build pipeline + partials)

Files created:
- creative/landing-pages/main/index.html — English rewrite, new pricing, UTM CTAs
- creative/landing-pages/agency-owners/index.html
- creative/landing-pages/agents/index.html
- creative/landing-pages/ai-employee/index.html
- creative/landing-pages/demo/index.html
- creative/landing-pages/pricing/index.html (NEW)
- creative/landing-pages/legal/{terms,privacy,refund,cookies}/index.html (NEW ×4)
- creative/landing-pages/vs/{sell-do,zoho-crm,excel-spreadsheet}/index.html (NEW ×3)
- creative/landing-pages/about/index.html (NEW)
- marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/schema/*.json (12 JSON-LD files)
- marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/per-page-meta.md
- marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/*.md (5 AEO drafts)

Files modified:
- creative/landing-pages/sitemap.xml — filled real URLs (PR-D created stub)
- creative/landing-pages/llms.txt — filled AEO answer links

Source tasks: ZEE-008, ZEE-009 (pre-launch-prep/P15, P16)
```
