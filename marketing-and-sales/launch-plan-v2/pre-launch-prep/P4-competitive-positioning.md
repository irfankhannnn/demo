# P4 — Competitive Positioning (Wedge + Battle Cards + /vs/* Drafts)

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-15
> **Skill(s):** `competitor-profiling` + `competitor-alternatives` + `brand-strategy`
> **Estimated time:** 0.5h founder · 4h AI

## Objective
Produce the wedge one-pager + 4 battle cards (Sell.do / Zoho CRM / LeadSquared / Excel-workflow) + 3 `/vs/*` competitor LP drafts so all outbound, sales, and SEO content draws from one positioning truth.

## Why This Matters for RealEstateFlow
Mumbai brokers evaluating CRMs default-compare to Sell.do (the local incumbent), Zoho (price anchor), or stay on Excel + WhatsApp (the actual workflow). A clear wedge + 4 battle cards lets the founder, AI Employee, cold sequences, and `/vs/*` SEO pages tell the same story.

## User Story
As a founder pitching Mumbai brokers cold (Day 17+), I want a wedge one-pager + 4 battle cards + 3 `/vs/*` competitor LP drafts, so my talk track + LP copy + AI Employee responses are consistent.

## Acceptance Criteria
- [ ] `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md` written (500-800 words)
- [ ] `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/sell-do.md`
- [ ] `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/zoho-crm.md`
- [ ] `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/leadsquared.md`
- [ ] `marketing-and-sales/launch-implement/pre-launch/04-positioning/battle-cards/excel-workflow.md`
- [ ] Each battle card includes: positioning, pricing, strengths, weaknesses, RealEstateFlow wedge response, 3 cold-outreach talking points, 5 objection handlers
- [ ] `/vs/sell-do` LP draft at `marketing-and-sales/launch-implement/pre-launch/04-positioning/vs-pages/vs-sell-do.md` (1500 words)
- [ ] `/vs/zoho-crm` LP draft at `vs-pages/vs-zoho-crm.md` (1500 words)
- [ ] `/vs/excel-spreadsheet` LP draft at `vs-pages/vs-excel-spreadsheet.md` (1500 words)
- [ ] Each `/vs/*` includes JSON-LD `Article` + `FAQPage` schema specs (full schema generated in P16)
- [ ] Wedge one-pager passes the "Ravi test": one Mumbai broker friend reads it in 90 seconds and can repeat the wedge

## AI Prompt (🤖)

```
You are a senior B2B SaaS positioning strategist. Read these inputs:
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md` (wedge + audience)
- `marketing-and-sales/launch-plan-v2/pricing.json`
- `marketing-and-sales/research/icp-report-mumbai-launch.md`
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/research/mumbai-positioning-strategy.md`
- `marketing-and-sales/research/broker-branding-mumbai-pune-research.md`

Produce the following 8 markdown files. Use existing competitor research from public sources (no fabrication). All claims about competitors should be defensible from their websites or G2 reviews.

## File 1: `04-positioning/wedge.md` (500-800 words)
Sections:
- One-line wedge: "RealEstateFlow is an AI Employee that runs your broking agency on WhatsApp + Telegram."
- Why this wedge wins (3 reasons specific to Mumbai brokers + small teams)
- Anti-positioning: who we explicitly are NOT for (large enterprise teams, brokers who don't use WhatsApp, agents tied to a builder's CRM)
- "We're better than ___ because ___" sentences for Sell.do, Zoho, LeadSquared, Excel
- The "Bandra broker test": 90-second read + repeat-back

## File 2: `04-positioning/battle-cards/sell-do.md` (~1000 words)
Header table: company, founded, HQ, est. employees, est. revenue, primary market, parent company.
- 1-line positioning (from their site)
- Pricing (cite source URL + date checked)
- 3 things they do well
- 3 things they do poorly (specific to Mumbai brokers)
- RealEstateFlow wedge response (the 1 sentence to use in any conversation)
- 3 cold-outreach talking points (1-2 lines each)
- 5 objection handlers in Q&A format:
  1. "Sell.do is the industry standard, why switch?"
  2. "Sell.do has more integrations than you."
  3. "Sell.do has been around longer."
  4. "Sell.do has dedicated support."
  5. "Migration cost — we'd lose our setup."
- 3 quick comparison tweets/posts ready for LinkedIn

## File 3: `04-positioning/battle-cards/zoho-crm.md` (~1000 words)
Same structure. Zoho CRM is positioned as the budget choice (~₹720-1500/user/mo). Wedge response should hammer: "Zoho is built for sales pipelines. RealEstateFlow is built for brokers — Khata book, property listings, RERA fields, WhatsApp-first."

## File 4: `04-positioning/battle-cards/leadsquared.md` (~1000 words)
Same structure. LeadSquared (~₹3,500/user/mo) is positioned as enterprise-grade. Wedge response: "LeadSquared is built for enterprises. RealEstateFlow is built for solo brokers and small teams in Mumbai who can't afford ₹3,500 per seat."

## File 5: `04-positioning/battle-cards/excel-workflow.md` (~1000 words)
Same structure but the "competitor" is Excel + WhatsApp + paper Khata book. This is the actual default workflow of 70%+ Mumbai brokers (per `mumbai-positioning-strategy.md`). Wedge response: "Excel is free, but it doesn't follow up your buyers at 9pm. RealEstateFlow's AI Employee does." Pricing comparison should highlight: Excel = ₹0 + 6 hours/week of broker's time = ₹6,000+/month opportunity cost.

## File 6: `04-positioning/vs-pages/vs-sell-do.md` (1500 words)
SEO + AEO landing page draft. Structure:
- H1: "RealEstateFlow vs Sell.do: Which CRM is right for Mumbai brokers?"
- Meta description (155 chars max), keyword-targeted: `Sell.do alternative Mumbai`
- 60-second TL;DR
- Side-by-side table (10 rows: pricing, target user, AI Employee, WhatsApp-native, Khata book, Mumbai support, GST invoicing, trial, refund, free onboarding)
- "When Sell.do is the right choice" section (be honest)
- "When RealEstateFlow is the right choice" section
- 5 objection-style FAQs (for FAQPage JSON-LD)
- Migration section: "Bringing your data from Sell.do → RealEstateFlow"
- Founder quote
- 3 testimonial placeholders (replaced post-Day-14)
- CTA: "Start 14-day free trial" + "Book 15-min comparison demo"
- Schema spec at the bottom (Article + FAQPage + BreadcrumbList) to be implemented in P16

## File 7: `04-positioning/vs-pages/vs-zoho-crm.md` (1500 words)
Same structure, keyword: `Zoho CRM alternative real estate India`

## File 8: `04-positioning/vs-pages/vs-excel-spreadsheet.md` (1500 words)
Same structure, keyword: `excel to crm migration real estate`. This page leans into the time-cost argument + WhatsApp-native + AI Employee pitch.

After all 8 files: write 1 cross-cut summary at `04-positioning/cross-cut-summary.md` answering "Which 3 sentences should every cold email / LinkedIn DM / in-app sales chat lead with?"

Stop here. Do not generate JSON-LD schema (that's P16). Do not deploy LPs (that's P15).
```

## Inputs
- ICP report + personas + Mumbai positioning + broker branding research
- `pricing.json`
- Public competitor websites (AI fetches via skill `firecrawl-scrape` if needed)

## Outputs
- 8 markdown files in `marketing-and-sales/launch-implement/pre-launch/04-positioning/`

## Success Criterion
Wedge one-pager passes the "Bandra broker test" + 4 battle cards each have all 9 required sections + 3 `/vs/*` drafts have ≥1500 words and target keyword in H1/H2/meta.

## Fallback / Plan B
If competitor pricing not findable from public sites, leave a placeholder with citation `{{TODO: verify Sell.do pricing}}` and document in handoff note. Founder calls Sell.do sales line to confirm.

## Risks
| Risk | Mitigation |
|---|---|
| Battle card claims defamatory | All claims sourced from public sites + dated; AI prompt forbids fabrication |
| /vs/* pages get search-penalised for thin content | Min 1500 words; original side-by-side; FAQPage schema (P16) |
| Founder uses inconsistent wedge in calls | wedge.md becomes the script; cold-email + WhatsApp templates inherit |

## India / Mumbai-Specific Notes
- All comparisons anchor to Mumbai broker workflow (Khata book, RERA, WhatsApp)
- Pricing in INR with HSN reference where invoice format matters
- Cite RERA Maharashtra context where comparisons reference compliance

## Dependencies
- **Blocks:** Day 9 (cold-email templates use wedge), Day 17 (cold sequence wave 1), P15 (`/vs/*` deployed), P16 (JSON-LD schema)
- **Depends on:** ICP + persona research (already shipped)

## Connected Skills
- `competitor-profiling` — battle cards
- `competitor-alternatives` — `/vs/*` LPs
- `brand-strategy` — wedge + anti-positioning
- `firecrawl-scrape` — fetch competitor pricing if needed
