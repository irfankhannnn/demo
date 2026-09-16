# Agent Prompt — PR-D: LP Build Pipeline + Partials + SEO Stubs

**Branch to create:** `cursor/pr-1d-lp-build-pipeline-8e67`
**Base branch:** `main`
**Batch:** 1 (Day 1) — runs in parallel with PR-A, PR-B, PR-C

---

## MANDATORY: Read First

1. `marketing-and-sales/launch-plan-v2/coding-agent-brief/00-MASTER-BRIEF.md`
2. `creative/landing-pages/netlify.toml` (existing — you will modify this)
3. `creative/landing-pages/main/index.html` (existing structure to understand)
4. `marketing-and-sales/launch-plan-v2/pre-launch-prep/P15-landing-pages-rewrite.md`
5. `marketing-and-sales/launch-plan-v2/pricing.json`

---

## What to Build

### 1. LP Build Pipeline (`creative/landing-pages/build/`)

Create a Vite-based build pipeline that:
- Takes `.hbs` template partials + LP HTML files as input
- Outputs optimized HTML + single CSS file to `creative/landing-pages/dist/`
- Replaces Tailwind CDN with compiled CSS
- Injects env var values (GA4_ID, META_PIXEL_ID, etc.) at build time

```
creative/landing-pages/build/
├── package.json          — build dependencies + scripts
├── vite.config.js        — Vite config outputting to dist/
├── tailwind.config.js    — Tailwind config with brand colors
├── postcss.config.js     — PostCSS config
└── README.md             — How to run: npm install && npm run build:lps
```

`package.json` key scripts:
```json
{
  "scripts": {
    "build:lps": "vite build && node scripts/process-partials.js",
    "dev:lps": "vite preview --port 5000"
  }
}
```

The build process:
1. Compile `src/styles.css` (Tailwind) → `dist/assets/main.css`
2. Process each LP HTML: replace `{{> partial-name}}` includes with partial content
3. Inject `.env` variables into the HTML (`{{GA4_ID}}` → actual value)
4. Copy assets to `dist/assets/`

### 2. Shared Partials (`creative/landing-pages/_partials/`)

Create these partial files (used by LP-I when building pages):

#### `_partials/head.hbs`
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{page_title}}</title>
<meta name="description" content="{{page_description}}">
<link rel="canonical" href="https://realestateflow.in{{page_path}}">

<!-- OG Tags -->
<meta property="og:title" content="{{og_title}}">
<meta property="og:description" content="{{og_description}}">
<meta property="og:image" content="https://realestateflow.in/assets/og/{{og_image}}">
<meta property="og:url" content="https://realestateflow.in{{page_path}}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RealEstateFlow">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://realestateflow.in/assets/og/{{og_image}}">

<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/assets/manifest.json">
<meta name="theme-color" content="#22C55E">

<!-- Compiled CSS (replaces Tailwind CDN) -->
<link rel="stylesheet" href="/assets/main.css">

<!-- JSON-LD Schema (page-specific) -->
{{page_schema}}

<!-- Analytics (consent-gated) -->
{{> head-analytics}}
</head>
```

#### `_partials/head-analytics.hbs`
**Stub only** — PR-E creates the real content. Create this file with a comment:
```html
<!-- Analytics snippet — filled by PR-E -->
<!-- PostHog + GA4 + Meta Pixel + LinkedIn + Hotjar — all consent-gated -->
<!-- IDs from build-time env: POSTHOG_KEY, GA4_ID, META_PIXEL_ID, LINKEDIN_PARTNER_ID, HOTJAR_ID -->
```

#### `_partials/header.hbs`
```html
<nav class="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
  <div class="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
    <!-- Logo (inline SVG — placeholder until P8 SVG available) -->
    <a href="/" class="flex items-center gap-2.5 shrink-0">
      <svg width="36" height="36" viewBox="0 0 60 60" fill="none">
        <!-- Same house+wave SVG from existing index.html -->
      </svg>
      <span class="font-bold text-lg">RealEstateFlow</span>
    </a>
    <!-- Nav links -->
    <div class="flex items-center gap-3">
      <a href="https://app.realestateflow.in" class="text-sm text-slate-700">Login</a>
      <a href="https://app.realestateflow.in/signup?utm_source=lp-{{page_slug}}&utm_campaign=launch&utm_medium=nav"
         data-cta-id="nav-cta"
         class="bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg">
        Start Free Trial
      </a>
    </div>
  </div>
</nav>
```

#### `_partials/footer.hbs`
```html
<footer class="bg-slate-900 text-slate-400 text-sm py-12">
  <div class="max-w-6xl mx-auto px-5">
    <!-- Legal links row -->
    <div class="flex flex-wrap gap-4 mb-6">
      <a href="/legal/terms" class="hover:text-white">Terms</a>
      <a href="/legal/privacy" class="hover:text-white">Privacy</a>
      <a href="/legal/refund" class="hover:text-white">Refunds</a>
      <a href="/legal/cookies" class="hover:text-white">Cookies</a>
      <a href="/grievance" class="hover:text-white">Grievance</a>
      <button onclick="window.openCookiePreferences && window.openCookiePreferences()" class="hover:text-white underline">
        Cookie preferences
      </button>
    </div>
    <!-- Grievance Officer disclosure (DPDP requirement) -->
    <p class="text-xs text-slate-500 mb-4">
      Grievance Officer: {{FOUNDER_NAME}} — info@realestateflow.in — Response SLA 7 working days per DPDP Act 2023.
    </p>
    <!-- Legal entity -->
    <p class="text-xs text-slate-500">
      {{COMPANY_LEGAL_NAME}} · GSTIN: {{GSTIN}} · CIN: {{CIN}} · Registered: Mumbai, Maharashtra, India
    </p>
    <p class="text-xs text-slate-500 mt-2">© 2026 RealEstateFlow. All rights reserved.</p>
  </div>
</footer>
```

#### `_partials/cta-block.hbs`
```html
<section class="py-20 px-5 text-center bg-slate-900">
  <h2 class="font-bold text-3xl text-white mb-4">{{cta_headline}}</h2>
  <p class="text-slate-400 mb-8">14 days free · No card · Cancel anytime</p>
  <a href="https://app.realestateflow.in/signup?utm_source=lp-{{page_slug}}&utm_campaign=launch&utm_medium=cta-bottom"
     data-cta-id="bottom-cta"
     class="bg-green-500 text-white font-bold px-8 py-4 rounded-xl text-lg inline-block">
    Start 14-day Free Trial — no card
  </a>
</section>
```

#### `_partials/pricing-cards.hbs`
Renders 3 tier cards. Pricing values injected from `pricing.json` at build time.
```html
<section class="py-20 px-5">
  <div class="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
    <!-- Solo card -->
    <div class="border border-slate-200 rounded-2xl p-6">
      <h3 class="font-bold text-xl mb-2">Solo</h3>
      <div class="text-3xl font-black mb-1">₹{{SOLO_MONTHLY_PRICE}}<span class="text-sm font-normal">/mo</span></div>
      <p class="text-slate-500 text-sm mb-4">+ 18% GST · 14-day free trial</p>
      <a href="https://app.realestateflow.in/signup?utm_source=lp-{{page_slug}}&utm_campaign=launch&utm_medium=pricing-card-solo"
         data-cta-id="pricing-solo"
         class="block text-center bg-green-500 text-white font-bold py-3 rounded-lg mb-4">
        Start free trial
      </a>
      <ul class="text-sm space-y-2">
        <li>✓ 1 team member</li>
        <li>✓ Full CRM</li>
        <li>✓ Unlimited properties</li>
        <li>✓ Khata book</li>
      </ul>
    </div>
    <!-- Team card (Most Popular) -->
    <!-- Team+ card -->
  </div>
  <p class="text-center text-sm text-slate-500 mt-6">
    <a href="/pricing" class="underline">Compare full pricing →</a>
  </p>
</section>
```

#### `_partials/faq.hbs`
Accordion FAQ component (vanilla JS, no dependencies):
```html
<section class="py-20 px-5" id="faq">
  <div class="max-w-3xl mx-auto">
    <h2 class="font-bold text-3xl mb-10 text-center">Frequently Asked Questions</h2>
    {{#each faqs}}
    <div class="faq-item border-b border-slate-200 py-4">
      <button class="w-full text-left flex justify-between items-center font-semibold" onclick="this.parentElement.classList.toggle('open')">
        {{question}}
        <span class="faq-icon text-xl">+</span>
      </button>
      <div class="faq-answer pt-3 text-slate-600">{{answer}}</div>
    </div>
    {{/each}}
  </div>
</section>
<style>.faq-answer{display:none}.faq-item.open .faq-answer{display:block}.faq-item.open .faq-icon{transform:rotate(45deg)}</style>
```

### 3. `.env.example` for LP Build

```
# LP Build Environment Variables
# Never commit real values — these are injected at build time

# Analytics (LP-only — do NOT use in CRM SPA)
POSTHOG_KEY=phc_...
GA4_ID=G-XXXXXXXXXX
META_PIXEL_ID=1234567890
LINKEDIN_PARTNER_ID=XXXX
HOTJAR_ID=XXXXXXX
HOTJAR_SV=6

# Founder-supplied placeholders (fill before first deploy)
FOUNDER_HANDLE=your-cal-handle
WHATSAPP_NUMBER=919XXXXXXXXX
FOUNDER_NAME=Founder Name
COMPANY_LEGAL_NAME=Company Pvt Ltd
GSTIN=27XXXXX
CIN=UXXXXXXXX
```

### 4. `sitemap.xml` (stub — PR-I fills real content)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- PR-I fills these with real lastmod and all 12 page URLs -->
  <url>
    <loc>https://realestateflow.in/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 5. `robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://realestateflow.in/sitemap.xml
```

### 6. `llms.txt` (stub — PR-I fills AEO answer links)

```
# RealEstateFlow

> AI Employee for real estate broking agencies on WhatsApp + Telegram. ₹999 to start. Mumbai-built.

## Core
- [Homepage](https://realestateflow.in)
- [Pricing](https://realestateflow.in/pricing)

## AEO Answers
- [Coming in M2]

## Legal
- [Privacy Policy](https://realestateflow.in/legal/privacy)
- [Grievance](https://realestateflow.in/grievance)
```

### 7. Update `netlify.toml`

```toml
[build]
  publish = "dist"
  command = "npm run build:lps"

# Remove enterprise redirect (delete that block)
# Add new page redirects
[[redirects]]
  from = "/agency-owners"
  to = "/agency-owners/index.html"
  status = 200

[[redirects]]
  from = "/pricing"
  to = "/pricing/index.html"
  status = 200

[[redirects]]
  from = "/legal/terms"
  to = "/legal/terms/index.html"
  status = 200

# ... (add all 12 page redirects) ...

[[redirects]]
  from = "/legal"
  to = "/legal/terms"
  status = 301

[[redirects]]
  from = "/help"
  to = "/grievance"
  status = 301

[headers]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-XSS-Protection = "1; mode=block"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://js.hcaptcha.com https://www.googletagmanager.com https://connect.facebook.net https://snap.licdn.com https://static.hotjar.com https://eu.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://eu.i.posthog.com https://api.realestateflow.in https://app.realestateflow.in;"
```

---

## What NOT to Touch

- Any LP HTML content files (those are PR-I's job)
- `apps/crm/real-estate-crm-app/` — never
- `apps/crm/server/` — never
- `creative/landing-pages/_partials/cookie-banner.html` — PR-C creates this; you reference it

---

## Acceptance Criteria

- [ ] `npm run build:lps` runs without errors in `creative/landing-pages/build/`
- [ ] All partials exist as `.hbs` files
- [ ] `.env.example` documents all required build-time IDs
- [ ] `netlify.toml` updated: enterprise redirect removed; new page redirects added; security headers present
- [ ] `sitemap.xml` stub + `robots.txt` + `llms.txt` stub exist at LP root
- [ ] `head-analytics.hbs` stub created (even if empty — PR-E fills it)

---

## PR Description Template

```
PR-D: LP build pipeline — Vite config + shared partials + netlify.toml + SEO stubs

Batch 1 | Day 1 | Parallel with PR-A, PR-B, PR-C

Files created:
- creative/landing-pages/build/ (Vite pipeline + package.json)
- creative/landing-pages/_partials/{head,head-analytics,header,footer,cta-block,pricing-cards,faq}.hbs
- creative/landing-pages/.env.example
- creative/landing-pages/sitemap.xml (stub)
- creative/landing-pages/robots.txt
- creative/landing-pages/llms.txt (stub)

Files modified:
- creative/landing-pages/netlify.toml — remove enterprise; add new page redirects + security headers

Source task: ZEE-008-T1 (pre-launch-prep/P15-landing-pages-rewrite.md)
```
