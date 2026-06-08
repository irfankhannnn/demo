# Day 25 — Beta Tester Case Study + SEO Blog Foundation

> **Type:** 🤖 AUTO + 🤝
> **Phase:** Week 4
> **Skill(s):** `copywriting` + `seo-blog` + `content-strategy` + `customer-research` + `schema-markup`
> **Estimated time:** 2h founder + 6h AI

## Objective
Publish 1 long-form case study (1,500-2,500 words) on a top-performing beta tester from Mumbai + 1 SEO foundation blog (e.g., "Best CRM for Real Estate Brokers in Mumbai 2026") + commit to a 12-week content calendar for ongoing SEO traffic.

## Why This Matters for RealEstateFlow
Case study = highest-credibility lead magnet. SEO blog = long-tail traffic that compounds. Day 25 plants seeds that bear fruit M2-M6.

## User Story
As founder building a content engine, I want 1 published case study + 1 published SEO blog + a 12-week content calendar by Day 25 EOD, so post-launch traffic comes from search + shares not just outbound.

## Acceptance Criteria
- [ ] Case study published at `realestateflow.in/case-studies/{tester-slug}` with: hero quote, before/after metrics, 3-paragraph story, 2 product screenshots, CTA "Start your 14-day free trial"
- [ ] Case study consent re-confirmed (extends Day-14 consent for case-study format)
- [ ] Schema: `Article` + `Review` JSON-LD added
- [ ] OG card: testimonial photo + quote (1200×630)
- [ ] SEO blog published at `realestateflow.in/blog/best-crm-real-estate-brokers-mumbai-2026` (1,500-2,000 words, target keyword "best CRM real estate brokers Mumbai")
- [ ] SEO blog includes: H1/H2/H3 hierarchy, target keyword density 1-1.5%, internal links to /pricing + /demo + /vs/zoho-crm + /ai-employee, FAQPage schema, table of contents
- [ ] 12-week content calendar at `marketing-and-sales/launch-implement/week-4/day-25-content-calendar.md` with topic, target keyword, est. monthly volume, owner, due date
- [ ] Both pages submitted to GSC for indexing
- [ ] Case study + blog shared on LinkedIn Post 7 + Twitter
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Re-confirm consent** with the chosen beta tester (text saying "still OK to publish your name + photo + quote in a case study format?").
2. **Run AI Prompt #1** to draft case study.
3. **Run AI Prompt #2** to draft SEO blog.
4. **Run AI Prompt #3** to draft 12-week content calendar.
5. **Manual review** + light edit of all 3.
6. **Build pages** in `marketing-and-sales/creative/landing-pages/`:
   - `case-studies/{tester-slug}/index.html` (use existing LP template)
   - `blog/best-crm-real-estate-brokers-mumbai-2026/index.html`
7. **Deploy** via Netlify CLI.
8. **Submit to GSC** for crawl.
9. **Share on LinkedIn + Twitter** (Post 7 + thread).
10. **Daily standup**.

## AI Prompt #1 (🤖) — Case study draft

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/testimonials/{tester-slug}/quote.txt` + photo
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{tester-slug}.md`
- PostHog usage data for this tester (sessions, records added, AI Employee transcripts)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`

Produce a 1,500-2,500-word case study at `marketing-and-sales/launch-implement/week-4/day-25-case-study-{slug}.md` (markdown):

# {{Tester Name}}: How a {{locality}} broker saved {{X}} hours/week with RealEstateFlow

## Background
- Tester profile (3 paragraphs): who they are, agency, what their week looked like before
- Specific Mumbai context: their localities, deal sizes, team size

## The challenge
- 3 specific pains they had (2 paragraphs each, with quotes from call notes)
- The cost in time / opportunity / stress

## The solution
- How RealEstateFlow worked for them: specific features used (3-4)
- What surprised them most
- Quotes from Day-10 call + Day-14 testimonial

## The results
- Quantitative: # records added / sessions / AI Employee usage / hours saved estimate
- Qualitative: their willingness-to-recommend score, what their team feedback was
- Direct quote: pull from testimonial

## What's next
- Their plans for Month 2-3
- 1-line note: "{{tester}} is one of {{N}} Mumbai brokers in our launch cohort"

## CTA
"Want to see if RealEstateFlow can do the same for your team? Start a 14-day free trial — no card needed."

## Schema markup
Add JSON-LD `Article` + `Review` blocks (output the JSON to embed).

Voice = founder narrating tester's story. Specific numbers + quotes + Mumbai locality detail. No buzzwords.

Stop.
```

## AI Prompt #2 (🤖) — SEO blog draft

```
Read inputs:
- `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/keyword-research.md`
- Top SERP results for "best CRM real estate brokers Mumbai" (use `firecrawl-search`)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/*.md`

Produce a 1,500-2,000-word SEO blog at `marketing-and-sales/launch-implement/week-4/day-25-blog-mumbai-crm.md`:

# Best CRM for Real Estate Brokers in Mumbai (2026): A Hands-On Comparison

## Table of contents
- Why Mumbai brokers need a different CRM
- The 7 we evaluated
- Comparison: features, pricing, fit-for-Mumbai
- Our criteria
- The verdict
- FAQs

## Content structure
- Intro (200 words): Mumbai broker context + why generic CRMs fall short + what we evaluated
- "Why Mumbai brokers need a different CRM" (300 words): WhatsApp-first reality + 4 specific Mumbai broker pain points
- The 7 CRMs (each 100-150 words): Sell.do, Zoho CRM, Pipedrive, HubSpot, Salesforce, Excel, RealEstateFlow — fair coverage of each
- Comparison table (HTML): features × pricing × Mumbai-fit × WhatsApp-native
- "Our criteria" (200 words): how we evaluated
- The verdict (300 words): 3 use-case-based recommendations (solo broker / 2-3 agency / 5+ agency) — RealEstateFlow recommended for first 2
- FAQ (5 questions): pricing in INR, GST included?, AI Employee what is it?, free trial works?, refund policy?

## SEO requirements
- H1/H2/H3 hierarchy with target keyword variants
- Keyword density 1-1.5%: "CRM real estate Mumbai", "real estate broker software India", "AI Employee real estate"
- Internal links: 5+ links to /pricing, /demo, /vs/sell-do, /vs/zoho-crm, /ai-employee, /case-studies/*
- 1 link to authoritative external (RERA Mumbai)
- Image alt-text per image
- Meta description (155 chars)
- FAQPage JSON-LD schema (5 Q&A)
- Article schema with author = founder + datePublished

Voice = honest, balanced (don't over-promote RealEstateFlow), Mumbai-specific. Aim for E-E-A-T signals (founder bylines, real comparison data).

Stop.
```

## AI Prompt #3 (🤖) — 12-week content calendar

```
Read inputs:
- `marketing-and-sales/launch-implement/pre-launch/16-seo-aeo/keyword-research.md`
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/launch-implement/week-3/day-21-weekly-growth-brief.md` (channel ROI)

Produce `marketing-and-sales/launch-implement/week-4/day-25-content-calendar.md`:

| Week | Date | Topic | Target Keyword | Search Volume (est) | Word Count | Skill(s) | Owner |
|---|---|---|---|---|---|---|---|

12 weeks (Week 1 = published Day-25). Mix:
- 4 SEO comparison/listicle posts
- 4 SEO how-to / tactical posts (e.g., "How to manage Mumbai broker WhatsApp leads")
- 2 case studies (use beta cohort)
- 2 thought-leadership (industry trends)

Each entry:
- Topic + target keyword + est volume
- Word-count target
- Skills involved (`seo-blog` + `copywriting` + `schema-markup` + `image`)
- Owner (founder writes Week 1-4 + AI-drafts + founder-edits Week 5-12)

Cadence: 1 post/week M2-M3 + 2 posts/week M4 onwards.

## Promotion plan per post
- LinkedIn post (founder)
- Twitter thread
- WhatsApp broker group share (where appropriate)
- Backlink ask: 3 directories + 1 broker friend per post

Stop.
```

## Inputs
- Day-14 testimonials + call notes
- Keyword research from P16
- Wedge + battle cards
- Channel ROI from Day-21

## Outputs
- 1 case study published
- 1 SEO blog published
- 12-week content calendar
- Schemas + OG cards
- LinkedIn Post 7 + Twitter share

## Success Criterion
Both pages live + GSC accepted + ≥1 organic search impression by Day 30.

## Fallback / Plan B
If beta tester revokes consent, swap to a different testimonial. If SEO blog underperforms, focus M2 on long-tail (volume 50-200 monthly) — easier to rank quickly.

## Risks
| Risk | Mitigation |
|---|---|
| Case study tester revokes | 2nd-choice testimonial ready |
| SEO blog targets too-competitive keyword | Pick long-tail variants |
| Comparison blog seen as biased | Honest + balanced tone; cite competitor strengths |
| Schema validation fails | Validate before publish |

## India / Mumbai-Specific Notes
- Comparison blog must include INR pricing + GST mention
- Case study uses Mumbai locality + tester's real photo + agency name (with consent)
- Content calendar prioritises Indian real-estate keywords

## Dependencies
- **Blocks:** M2 organic traffic, brand authority
- **Depends on:** Day-14 testimonials, P16 keyword research, P15 LP framework

## Connected Skills
- `copywriting` — case study + blog
- `seo-blog` — SEO structure
- `content-strategy` — calendar
- `customer-research` — case study source
- `schema-markup` — JSON-LD
