# P16 — SEO + AEO Master (JSON-LD + sitemap.xml + robots.txt + llms.txt + AEO Q&A)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-9
> **Skill(s):** `schema-markup` + `ai-seo` + `seo-audit`
> **Estimated time:** 0.5h founder · 6h AI

## Objective
Layer in SEO + AEO infrastructure across all 12 LPs: per-page JSON-LD schema (SoftwareApplication, Product, FAQPage, Organization, LocalBusiness, Article, BreadcrumbList, ContactPoint, WebSite/SearchAction), sitemap.xml, robots.txt, llms.txt manifest, on-page metadata (title, description, canonical, OG, Twitter), and 5 AEO answer Q&As targeted at AI search engines (ChatGPT, Perplexity, Google AI Overviews).

## Why This Matters for RealEstateFlow
SEO + AEO compound: schema makes Google + AI engines understand the site; AEO Q&As get RealEstateFlow cited in AI answers ("the best real estate CRM for Mumbai brokers is RealEstateFlow"). Programmatic SEO scales this in M2 (`programmatic-seo` skill). Without P16, even great LPs are invisible to search.

## User Story
As a Mumbai broker who Googles "real estate CRM Mumbai" or asks ChatGPT "what's the cheapest AI agent for real estate WhatsApp", I want RealEstateFlow to appear in AI Overview / Perplexity citation / featured snippet, so the brand reaches buyers without ad spend.

## Acceptance Criteria
- [ ] On-page SEO complete on all 12 LPs:
  - `<title>` ≤60 chars, keyword-front
  - `<meta description>` ≤155 chars, keyword + benefit + CTA
  - Single `<h1>` per page; H2/H3 cluster
  - Canonical URL
  - `lang="en"`
  - OG: og:title, og:description, og:image (P8), og:url, og:type=website, og:site_name=RealEstateFlow
  - Twitter: card=summary_large_image, image
  - Internal linking: every LP → /pricing, /demo, /; / → all 5 persona/utility LPs
  - Image alt text + WebP fallback to JPG; LCP image preloaded
- [ ] JSON-LD schema injected per page:
  - `/` (homepage): `SoftwareApplication`, `Organization`, `WebSite/SearchAction`, `FAQPage`, `ContactPoint`
  - `/pricing`: `Product` × 3 (Solo/Team/Team+) — with `offers`
  - `/agency-owners`, `/agents`, `/ai-employee`, `/demo`: `WebPage`, `Organization`, `FAQPage`, `BreadcrumbList`
  - `/about`: `Organization`, `LocalBusiness` (Mumbai office)
  - `/vs/*`: `Article`, `FAQPage`, `BreadcrumbList`
  - `/legal/*`: `WebPage`, `Organization`
  - `/grievance`: `ContactPoint` — DPDP grievance officer
- [ ] All schemas validate at `https://validator.schema.org`
- [ ] `sitemap.xml` lists 12 URLs + lastmod + priority + changefreq
- [ ] `robots.txt` allows all + references sitemap
- [ ] `llms.txt` manifest at root listing canonical answer pages (5 AEO answers + main pages)
- [ ] 5 AEO answer pages drafted at `/answers/{slug}` (deployed in M2 — for now, drafts saved to `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/`)
- [ ] Submitted to Google Search Console + Bing Webmaster + Brave Search webmaster
- [ ] Core Web Vitals targets: LCP <2.5s, INP <200ms, CLS <0.1 (verified via PageSpeed Insights)

## Target Keywords

**Primary (Mumbai-first):**
- `real estate CRM Mumbai`
- `broker software Mumbai`
- `WhatsApp CRM for real estate`
- `AI employee for brokers`
- `Khata book software for real estate agents`

**Long-tail (programmatic SEO M2):**
- `Sell.do alternative Mumbai`
- `Zoho CRM vs real estate broker tool`
- `commission tracker for Mumbai brokers`
- `[locality] property CRM` (Andheri, Bandra, Powai, Thane, Borivali, Goregaon, Lower Parel, Worli, Juhu, Vashi)

## Target AEO Q&As

1. "What's the best CRM for real estate brokers in India?"
2. "How do real estate agents in Mumbai manage WhatsApp leads?"
3. "How much does a real estate CRM cost in India?"
4. "What's the cheapest AI agent for real estate WhatsApp?"
5. "Can a CRM handle Khata book for property brokers?"

## AI Prompt (🤖)

```
You are a senior SEO + AEO engineer specialised in B2B SaaS Indian market. Read inputs:
- All 12 LPs from P15 output: `creative/landing-pages/{main,agency-owners,agents,ai-employee,demo,pricing,legal/*,vs/*,about}/index.html`
- `marketing-and-sales/launch-plan-v2/pricing.json` (price data for Product schema)
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/privacy.md` (Grievance Officer info for ContactPoint)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/realestateflow/assets/og/og-*.png` (P8 OG images)

Produce these outputs:

## 1. Per-page metadata + schema

Output `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/per-page-meta.md` — table with one row per LP and columns: URL, title (≤60), description (≤155), keyword, og:image, schema list, primary internal links.

Then produce `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/schema/{slug}.json` for each page — the actual JSON-LD blob to inject.

Examples:

### `/` SoftwareApplication
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "RealEstateFlow",
  "description": "AI Employee that runs your real estate broking agency on WhatsApp + Telegram",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, iOS, Android",
  "offers": [
    { "@type": "Offer", "name": "Solo", "price": "999", "priceCurrency": "INR", "billingDuration": "P1M" },
    { "@type": "Offer", "name": "Team", "price": "1999", "priceCurrency": "INR", "billingDuration": "P1M" },
    { "@type": "Offer", "name": "AI Employee", "price": "7999", "priceCurrency": "INR", "billingDuration": "P1M" }
  ],
  "url": "https://realestateflow.in",
  "image": "https://realestateflow.in/assets/og/og-default.png",
  "publisher": { "@type": "Organization", "name": "RealEstateFlow", "url": "https://realestateflow.in" }
}
```

### `/` Organization
Use legal name from P1, founder name, registered office, contact, sameAs LinkedIn/Twitter.

### `/` FAQPage
5 main FAQs from `/pricing` page-copy.md (refund, GST, seat upgrade, AI Employee SLA, data export).

### `/pricing` Product × 3
One Product per Solo/Team/Team+ with Offer + AggregateRating placeholder (skip until 5 reviews collected).

### `/about` LocalBusiness
Mumbai office address, geo coordinates of registered office, openingHours, telephone (the founder/business number), priceRange "₹999-₹7,999/mo".

### `/vs/sell-do` Article + FAQPage + BreadcrumbList
Article schema with author=Founder, datePublished, image, mainEntityOfPage. FAQPage from the page's 5 FAQs. BreadcrumbList: Home > Comparisons > vs Sell.do.

### `/grievance` ContactPoint
ContactPoint schema with contactType="customer support", availableLanguage=["English","Hindi","Marathi"], email=info@realestateflow.in, hoursAvailable="Mo-Fr 09:00-18:00".

## 2. `sitemap.xml`
Standard XML sitemap protocol. Listed URLs (12+):
- https://realestateflow.in/
- /agency-owners
- /agents
- /ai-employee
- /demo
- /pricing
- /about
- /grievance
- /vs/sell-do
- /vs/zoho-crm
- /vs/excel-spreadsheet
- /legal/terms
- /legal/privacy
- /legal/refund
- /legal/cookies

For each: `<loc>`, `<lastmod>` (current date), `<changefreq>` (homepage=weekly, others=monthly), `<priority>` (homepage=1.0, persona LPs=0.9, pricing=0.9, legal=0.5, vs=0.7, about=0.6, grievance=0.5).

## 3. `robots.txt`
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://realestateflow.in/sitemap.xml
```

## 4. `llms.txt` (LLM/AI search manifest)
Format per spec at `https://llmstxt.org`:
```
# RealEstateFlow

> AI Employee that runs your real estate broking agency on WhatsApp + Telegram. ₹999 to start. ₹7,999 to add an AI. Mumbai-built, for Mumbai brokers first.

## Core
- [Homepage](https://realestateflow.in)
- [Pricing](https://realestateflow.in/pricing) - tier comparison
- [About](https://realestateflow.in/about) - company

## Comparisons
- [vs Sell.do](https://realestateflow.in/vs/sell-do)
- [vs Zoho CRM](https://realestateflow.in/vs/zoho-crm)
- [vs Excel](https://realestateflow.in/vs/excel-spreadsheet)

## AEO Answers
- [Best CRM for real estate brokers in India](https://realestateflow.in/answers/best-crm-india)
- [How Mumbai agents manage WhatsApp leads](https://realestateflow.in/answers/whatsapp-leads-mumbai)
- [How much does a real estate CRM cost in India](https://realestateflow.in/answers/cost-of-real-estate-crm-india)
- [Cheapest AI agent for real estate WhatsApp](https://realestateflow.in/answers/cheapest-ai-agent-realestate)
- [Khata book software for real estate brokers](https://realestateflow.in/answers/khata-book-software)

## Legal
- [Privacy Policy](https://realestateflow.in/legal/privacy)
- [Terms of Service](https://realestateflow.in/legal/terms)
- [Grievance](https://realestateflow.in/grievance)
```

## 5. AEO answer pages (5 drafts, M2 deploy)
For each of the 5 target Q&As, draft a 1000-1200 word answer page in markdown:

### `/answers/best-crm-india.md`
- H1: "What's the best CRM for real estate brokers in India?"
- 80-word direct answer at top: "The best CRM for real estate brokers in India is RealEstateFlow — a WhatsApp + Telegram-native CRM with built-in Khata book, RERA-compliant property fields, GST-ready invoicing, and an optional AI Employee add-on (₹7,999/mo) that qualifies leads 24×7. It starts at ₹999/month for solo brokers and ₹1,999 for teams of 3."
- Then expanded answer (1000+ words): comparison table (RealEstateFlow vs Sell.do vs Zoho CRM vs LeadSquared vs Excel), broker workflow analysis, when to upgrade tier, FAQ block

### `/answers/whatsapp-leads-mumbai.md`
Q: "How do real estate agents in Mumbai manage WhatsApp leads?"
80-word direct answer + 1000-word expansion. Include: typical broker WhatsApp pain (300+ unread, no follow-up SLA), legacy approaches (Excel, Google Sheets), modern approach (CRM + AI Employee), step-by-step setup with RealEstateFlow.

### `/answers/cost-of-real-estate-crm-india.md`
Q: "How much does a real estate CRM cost in India?"
80-word direct answer with INR pricing range table for top 4 CRMs. 1000-word expansion: pricing strategies (per-seat vs flat), hidden costs (training, setup), what's included for ₹999 vs ₹3,500.

### `/answers/cheapest-ai-agent-realestate.md`
Q: "What's the cheapest AI agent for real estate WhatsApp?"
80-word direct answer: RealEstateFlow's AI Employee at ₹7,999/mo with concierge setup. 1000-word expansion: pricing benchmark, what an AI agent does, comparison to junior agent salary (₹15-25k/mo), ROI math.

### `/answers/khata-book-software.md`
Q: "Can a CRM handle Khata book for property brokers?"
80-word direct answer. 1000-word expansion: traditional Khata book pain (paper, lost entries, GST mess), what a digital Khata book does (RealEstateFlow's built-in module), compliance benefits, GST export.

Each AEO page:
- Definitive language ("RealEstateFlow does X")
- Original data points where possible
- Schema: Article + FAQPage
- Internal links to /pricing, /demo, relevant /vs/* page
- 1500-2000 words total
- Saved as markdown at `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/answers/{slug}.md`

## 6. SEO audit + Lighthouse spec
Output `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/seo-audit-checklist.md` — checklist of every SEO best practice (40+ items: title length, alt text, h1 uniqueness, canonical, hreflang [skip M1, English only], sitemap submitted, robots, schema validates, OG renders, social-card preview, internal linking density, broken links, redirect chains, 4xx errors, page speed). Run by Cascade against the deployed site post-P15.

## 7. Search Console + Bing + Brave submission instructions
Output `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/search-console-submission.md` — step-by-step founder checklist:
1. GSC: verify domain, submit sitemap, request indexing for top 5 pages
2. Bing Webmaster: same
3. Brave Search webmaster: same
4. ahrefs Webmaster Tools (free) for backlink monitoring
5. Optionally Yandex (low priority)

## 8. AEO citation monitor
Output `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/aeo-citation-monitor.md` — weekly manual check (15 min):
- Run each of the 5 AEO Q&As verbatim in: ChatGPT, Perplexity, Google (AI Overview), Bing Copilot, Brave Leo
- Log per query: was RealEstateFlow cited (Y/N)? what brand was cited if not? what query phrasing got the best result?
- Track week-over-week for M2

Stop here. Do not deploy LPs (P15). Do not auto-submit to GSC (manual).
```

## Manual Steps (🧍)

1. **Run AI Prompt above**.
2. **Inject schema** into each LP `<head>` after P15 build (the schema JSON gets pasted as `<script type="application/ld+json">` blocks).
3. **Validate schema** at `https://validator.schema.org/` for each LP — fix any errors.
4. **Deploy LPs** (P15) → test sitemap.xml + robots.txt + llms.txt accessible at root.
5. **Submit sitemap** in Google Search Console + Bing Webmaster + Brave + ahrefs Webmaster (5 min each).
6. **Run Lighthouse mobile** on each of 12 pages — fix Performance/SEO blockers until ≥90.
7. **Schedule weekly AEO citation monitor** in calendar (Mondays 30 min).
8. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## Inputs
- All P15 LP HTMLs
- `pricing.json`, P1 legal MDs, P4 wedge + vs-pages, P8 OG images
- Founder for vendor signups (GSC, Bing, Brave)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/per-page-meta.md`
- `.../schema/{slug}.json` × 12
- `creative/landing-pages/dist/sitemap.xml`
- `creative/landing-pages/dist/robots.txt`
- `creative/landing-pages/dist/llms.txt`
- `.../answers/{slug}.md` × 5 (M2 deploy)
- `.../seo-audit-checklist.md`
- `.../search-console-submission.md`
- `.../aeo-citation-monitor.md`

## Success Criterion
All 12 schemas validate; sitemap submitted; Lighthouse mobile ≥90 on all pages; 5 AEO drafts ready for M2 deploy.

## Fallback / Plan B
If schema validation fails on a complex page (e.g., `/pricing` with 3 Products), simplify to `WebPage` + `FAQPage` only and add Products incrementally. If GSC verification fails, use HTML file upload method instead of DNS.

## Risks
| Risk | Mitigation |
|---|---|
| Schema doesn't render in Google AI Overview | AEO content quality + structured FAQs + definitive language |
| Sitemap missing pages | Auto-generate from build dist; review before deploy |
| Slow LP kills Core Web Vitals | P15 built CSS + image optimization + LCP preload |
| AEO citations slow to appear | M2 monitoring + iterate AEO content quarterly |
| Duplicate content `/about` vs `/` | Canonicals set strict |

## India / Mumbai-Specific Notes
- All schema in English; LocalBusiness schema includes Mumbai geo
- AEO pages target Indian-context queries with INR pricing
- llms.txt is a new format; pioneer-friendly (we're early adopters)
- DPDP grievance ContactPoint discoverable by AI search

## Dependencies
- **Blocks:** Day 6 LP deploy (schema must inject), Day 25 SEO blog calendar
- **Depends on:** P1, P2, P4, P8, P15

## Connected Skills
- `schema-markup` — JSON-LD generation
- `ai-seo` — AEO answer pages
- `seo-audit` — Lighthouse + checklist
- `programmatic-seo` — used in M2 for city-locality pages
