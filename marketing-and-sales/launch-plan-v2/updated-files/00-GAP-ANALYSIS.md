# 00 — Gap Analysis: Master Prompt → Existing `launch-plan-v2/`

Section-by-section pass over `HappyProperties-MasterPrompt.md`, comparing each requirement against the existing plan. Every row is tagged: ✅ EXISTS / 🔁 CHANGE / ➕ ADD / 🔧 FEATURE / ⚠️ DECISION / 🇮🇳 ADAPTED (see README legend).

> **Naming correction:** the master prompt used **"Happy Properties"** as if it were the product. It is not. The product is **RealEstateFlow**; "Happy Properties" is the **first/pilot broker client** (and the sample agency name in the product's own signup/profile forms). All rows below assume RealEstateFlow as the product.

---

## Section 0 — Agent's four tasks (the spine)

The master prompt asks for four outputs. Here is where each stands in the existing plan:

| # | Master-prompt task | Status in existing plan | Where it lives now | This pack's response |
|---|---|---|---|---|
| 1 | Jira epics & stories | ❌ **Missing entirely** | — (plan is `P*`/`day-*` files) | `02-JIRA-BACKLOG.md` (net-new) |
| 2 | Launch plan update | ✅ Mature, different shape | `00-PLAN-OVERVIEW.md`, `pre-launch-prep/`, `week-1..4`, `month-2-plus/` | `03-LAUNCH-PLAN-DELTA.md` (reconcile + add) |
| 3 | Landing-page copy refresh | ✅ Specced (UK→India delta needed) | `pre-launch-prep/P15-landing-pages-rewrite.md` | `04-LANDING-PAGE-COPY-DELTA.md` |
| 4 | SEO / AEO / content | ✅ Strong, missing 90-day calendar | `pre-launch-prep/P16-seo-aeo-master.md`, `month-2-plus/M2-content-engine.md` | `05-SEO-AEO-CONTENT-DELTA.md` |

**Headline:** Task 1 is the only wholesale gap. Tasks 2–4 already exist at high quality for the India context — they need *deltas*, not rewrites.

---

## Section 1 — Company & product context

| Master-prompt element | Status | Notes |
|---|---|---|
| Two products: AI Employee + CRM | ✅ EXISTS / 🔁 CHANGE | Existing wedge leads with **AI Employee on WhatsApp/Telegram**; the CRM is the base. Master prompt gives them equal billing. Adopt the **dual "AI Employee + CRM" split** framing on the homepage (see `04`). |
| Market reality / 2026 stats ($303B, 89%, 67%, 58%) | ➕ ADD | These industry-benchmark stats are **not** in the plan. Add as a labelled "industry benchmark" stat bar on LP + as proof points in content (see `04` §Social Proof, `05`). 🇮🇳 Localise where India data differs. |
| Positioning statement ("AI-native OS for real estate teams") | 🔁 CHANGE / ⚠️ DECISION | Existing wedge is narrower & sharper ("AI Employee that runs your broking agency on WhatsApp + Telegram"). Keep the existing wedge as primary; the master statement can be a **secondary umbrella tagline**. See `01`. |
| Brand voice (confident, outcome-first, anti-jargon) | ✅ EXISTS / 🔁 CHANGE | Existing brand kit is **Hinglish-heavy** (`.brand/brand-kit.md`) but v2 locked **English website**. Master prompt's voice principles align with the v2 English direction — adopt them explicitly. See `01`. |
| 4 audience segments (solo / small team / brokerage / property mgr) | ✅ EXISTS / 🇮🇳 ADAPTED | Existing personas: Rajesh Bhai (owner), Priya (manager), Dev (agent) + Solo/Team/Team+ tiers. Master's "property managers" segment ≈ existing rental/tenant module users. Map master segments → existing tiers in `02` EPIC-09. |

---

## Section 2 — Jira epics & stories (the big gap)

The master prompt's 10 epics, mapped against what the plan already covers:

| Epic | Master-prompt intent | Coverage in existing plan | Tag |
|---|---|---|---|
| EPIC-01 AI Employee Core | intake → qualify → follow-up → Q&A → schedule → escalate → memory | Partially: `P11-openclaw-concierge.md` (concierge backend + SOP), `pricing.json` AI Employee add-on | 🔧 FEATURE + ➕ ADD stories |
| EPIC-02 CRM Foundation | data model, pipeline, lead scoring, routing, timeline, import, dedupe | CRM already built (server + SPA); plan touches it via `P5-demo-environment.md`, `P12-seat-cap`, `P13-security` | ✅ EXISTS (product) + ➕ ADD stories for scoring/routing if not built |
| EPIC-03 Landing Page & Marketing Site | hero, features, social proof, pricing, FAQ, schema, OG, speed, robots, sitemap | **Fully specced** in `P15` + `P16` | ✅ EXISTS → stories cross-link |
| EPIC-04 Onboarding & Activation | signup, setup wizard, welcome emails, tooltips, empty states | **Partial gap**: signup exists; **no setup-wizard / welcome-sequence / empty-state task** | ➕ ADD (see `03`) |
| EPIC-05 Integrations | portals, email sync, WhatsApp, calendar, Zapier, IDX/MLS | WhatsApp ✅ (AiSensy), Calendar ✅ (Cal.com). **Indian portal connectors (99acres/MagicBricks/Housing) = gap.** IDX/MLS = N/A India | 🇮🇳 ADAPTED + ➕ ADD |
| EPIC-06 SEO/AEO/Content Infra | blog CMS, FAQ hub, programmatic SEO, VideoObject, Bing/GSC, sitemap pipeline | **Strong**: `P16` + `M2-content-engine`. Missing: explicit AI-bot robots directives, VideoObject, 90-day calendar | 🔁 CHANGE (see `05`) |
| EPIC-07 Analytics & Reporting | agent perf dashboard, lead velocity, AI activity log, revenue forecast, GA4, GSC pull | Event tracking ✅ (`P10-analytics-events.md`). **In-product dashboards = gap** | ➕ ADD + 🔧 FEATURE |
| EPIC-08 Billing | Stripe sub+usage, tier flags, invoices, trial→paid | Razorpay ✅ (`P2`, `P14-paywall`), GST invoices ✅ (`P7`), seat caps ✅ (`P12`), trial→paid ✅ (`day-26`). **Stripe → Razorpay** | 🇮🇳 ADAPTED ✅ |
| EPIC-09 Launch Operations & GTM | beta recruit, checklist, press release, ProductHunt, social assets, referral | Beta ✅ (`week-2`), social/LinkedIn ✅ (`linkedin-posts/`, `P6`), referral ✅ (`M2-referral`). **Press release + ProductHunt assets = gap** | 🔁 CHANGE + ➕ ADD |
| EPIC-10 Post-Launch Growth | A/B LP, churn survey, affiliate, case studies, G2/Capterra | CRO ✅ (`day-22`), case study ✅ (`day-25`), G2/Capterra ✅ (`day-16`), NPS/churn ✅ (`day-28/29`), affiliate ✅ (`M2-referral/partnerships`) | ✅ EXISTS → stories cross-link |

**Conclusion:** Most epics are *already executed or specced* in the plan. The Jira backlog's job is (a) to give the work a tracker-importable shape, and (b) to surface the genuine net-new gaps: **onboarding wizard (E04), Indian portal connectors (E05), in-product analytics dashboards (E07), press/ProductHunt assets (E09).** Full backlog in `02`.

---

## Section 3 — Launch plan

| Master-prompt element | Status | Notes |
|---|---|---|
| Phase 0 Foundation (wks 1–3) | ✅ EXISTS | ≈ existing `pre-launch-prep/` (T-21→T-1) + `week-1-foundation/` |
| Phase 1 Closed Beta (wks 4–7) | ✅ EXISTS | ≈ existing `week-2-soft-launch/` (Mumbai beta, testimonials) |
| Phase 2 Public Launch (wk 8) | ✅ EXISTS / 🔁 CHANGE | ≈ existing `week-3-public-launch/`. Master adds **ProductHunt + press release + webinar** — partially gap |
| Phase 3 Growth (months 3–6) | ✅ EXISTS | ≈ existing `week-4` + `month-2-plus/` (case studies, G2, programmatic SEO, paid, affiliate) |
| **Scale targets** (10 beta, 50 paying launch week, 200 by M6) | ⚠️ DECISION | Existing targets are **3–5 paying M1**, solo-founder, ₹0 ads. Master's 50-in-a-week is unrealistic for this constraint set. **Recommend keeping existing conservative targets**; document the divergence. |
| Timeline shape (8 linear weeks) | 🔁 CHANGE | Existing is T-21 pre-launch + 30-day sprint + PMF-gated M2. Master's 8-week is a *simplification*; map don't replace. See `03`. |
| Onboarding tasks inside launch plan | ➕ ADD | Add setup-wizard + welcome-sequence tasks (Phase 0/1). See `03` + `02` E04. |

---

## Section 4 — Landing-page copy

| Master-prompt block | Status | Notes |
|---|---|---|
| 4.1 Hero | ✅ EXISTS / 🔁 CHANGE | `P15` has `main` H1 "Hire an AI Employee for Your Real Estate Agency." Keep RealEstateFlow H1; **adopt master's trust-signal row pattern** (✓ no setup fee · ✓ works with portals · ✓ live in 48h → 🇮🇳 "live in 24h concierge"). |
| 4.2 Problem/Agitation (3 pain cards) | ➕ ADD | `P15` has no explicit problem/agitation section with 3 pain cards. **Add it** (5-min-lead stat, "CRM graveyard", disconnected tools). See `04`. |
| 4.3 Solution split (AI Employee \| CRM) | 🔁 CHANGE | Adopt the **two-column AI-Employee/CRM split** explicitly on homepage. See `04`. |
| 4.4 Social proof (stat bar + testimonial) | ➕ ADD | Add labelled "industry benchmark" stat bar (67% / 89% / <60s / 24–48h). `P15` only has testimonial placeholders. See `04`. |
| 4.5 How It Works (3 steps) | 🔁 CHANGE / 🇮🇳 | Adapt: Connect WhatsApp + portals (99acres/MagicBricks) → Train AI → Watch it work. See `04`. |
| 4.6 Pricing | ✅ EXISTS / 🇮🇳 ADAPTED | `pricing.json` + `P15` `/pricing` page already exist (INR tiers). Master's £ table → already INR. No change beyond confirming the trust line. |
| 4.7 FAQ (AEO) | ✅ EXISTS / 🔁 CHANGE | `P16` already requires FAQPage schema + AEO answers. **Add the 7 master-prompt FAQ Q&As, localised** (WhatsApp, 24h setup, DPDP not GDPR, Indian portals). See `04` + `05`. |
| 4.8 CTA/Footer | 🔁 CHANGE | Adopt "Your competitors are already using AI" urgency CTA. Keep 14-day trial wording from `pricing.json`. See `04`. |

---

## Section 5 — SEO / AEO / content

| Master-prompt element | Status | Notes |
|---|---|---|
| robots.txt with explicit AI-bot user-agents (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Bingbot) | 🔁 CHANGE | `P16` robots.txt is `User-agent: *  Allow: /` (functionally allows all, but **not explicit**). Add the named AI-bot stanzas for clarity + future-proofing. See `05`. |
| Homepage SoftwareApplication JSON-LD | ✅ EXISTS | `P16` already specs it (INR offers). |
| FAQPage JSON-LD | ✅ EXISTS | `P16` already specs it. |
| Keyword strategy (primary/secondary/programmatic) | ✅ EXISTS / 🇮🇳 ADAPTED | `P16` has Mumbai-first keywords + programmatic `/ai-crm/[city]` planned in M2. Master's UK keywords → India equivalents already present. |
| AEO content rules (40-word answer, H2 questions, tables, quarterly refresh, Bing) | ✅ EXISTS | `P16` + `M2-content-engine` already encode these. Reinforce in calendar. |
| **90-day content calendar** (week-by-week, platform, format, keyword) | ➕ ADD | **Genuine gap.** `M2-content-engine` has a light 12-week sketch; there's no structured Month 1–3 calendar with platform+format+goal columns. **Add it, India-adapted.** See `05`. |
| Platform tactics (YouTube, Instagram, Facebook, LinkedIn, AI assistants) | 🔁 CHANGE / ➕ ADD | LinkedIn ✅ (`linkedin-posts/`, `P6`), Instagram partial. **YouTube channel strategy + VideoObject schema = gap.** See `05`. |
| KPIs & measurement table | 🔁 CHANGE | `P16` + `M2-content-engine` have scattered metrics. **Consolidate into one KPI dashboard** (impressions, AI Overview appearances, citations, watch time, leads-from-organic). See `05`. |
| VideoObject schema on video embeds | ➕ ADD | Not in `P16` schema list. Add for `/demo` + future YouTube embeds. See `05`. |
| `/chatgpt-plugin` manifest | ➕ ADD (low priority) | Optional; note in `05` as backlog. |

---

## Section 6 — Branding & positioning

| Master-prompt element | Status | Notes |
|---|---|---|
| Company name "Happy Properties" | ✅ RESOLVED | Prompt error. Product = **RealEstateFlow**; Happy Properties = first/pilot broker client. No decision. See `01`. |
| Tagline "AI-Native OS for Real Estate Teams" | 🔁 CHANGE | Can serve as **secondary** tagline under the existing wedge. See `01`. |
| Colour palette (navy #0D1B2A + amber #F4A261) | ⚠️ DECISION | Conflicts with locked green `#22C55E` + navy `#0F3A66`. **Recommend keeping RealEstateFlow palette**; do not adopt amber. See `01`. |
| Typography (Sora / DM Sans / JetBrains Mono) | 🔁 CHANGE / ⚠️ DECISION | `.brand` uses Inter. Optional upgrade; low priority, founder call. See `01`. |
| Logo mark concept (house + neural node) | ✅ EXISTS | `P8-logo-and-favicons.md` already owns logo. Master's concept can inform P8 brief; not a plan change. |
| Photography style (real agents, real product, warm light) | ✅ EXISTS | Aligns with existing creative briefs; no change. |
| Messaging hierarchy (L1/L2/L3 pitch) | ➕ ADD | **Useful net-new.** Adopt as the canonical pitch ladder for cold email/LP/sales. 🇮🇳 localise. See `01`. |

---

## Section 7 — Agent execution checklist

The master prompt's final checklist is re-expressed as an **apply-order checklist** in `06-EXECUTION-CHECKLIST.md`, pointing each item to the target existing file + the delta file in this pack.

---

## Summary: the change list at a glance

**Net-new (➕ ADD):**
1. Jira backlog (10 epics + stories) — `02`
2. Onboarding setup-wizard + welcome-email-sequence tasks — `02` E04, `03`
3. Indian portal connectors (99acres / MagicBricks / Housing) — `02` E05
4. In-product analytics dashboards (agent perf, lead velocity, AI activity, revenue forecast) — `02` E07
5. Press release + ProductHunt launch assets — `02` E09, `03`
6. Landing-page problem/agitation + social-proof stat-bar sections — `04`
7. 90-day content calendar (India-adapted) — `05`
8. YouTube channel strategy + VideoObject schema — `05`
9. Consolidated KPI dashboard — `05`
10. L1/L2/L3 messaging hierarchy — `01`

**Change existing (🔁 CHANGE):**
- `P15`: hero trust row, AI/CRM split, How-It-Works localisation, master FAQ set, urgency CTA
- `P16`: explicit AI-bot robots.txt stanzas, VideoObject schema, KPI consolidation
- `00-PLAN-OVERVIEW.md`: add secondary umbrella tagline + AI/CRM dual framing note
- `linkedin-posts/` + content: weave in 2026 market-reality stats

**Resolved (no longer a decision):**
- Product name = **RealEstateFlow** (master prompt's "Happy Properties" was a mislabel; it is the first/pilot broker client).

**Decisions required (⚠️ DECISION):**
- D1: Brand palette/typography — adopt master's navy+amber/Sora or keep existing (**recommend: keep existing green/navy + Inter**)
- D2: Launch-scale targets — 50-in-launch-week vs existing 3–5 M1 (**recommend: keep existing conservative targets**)

**Out of scope for India M1 (drop from master prompt):**
- Rightmove/Zoopla/OnTheMarket connectors (UK portals) → replace with Indian portals
- IDX / MLS feed ingestion (US/UK construct; not the Indian broker workflow)
- GBP pricing / GDPR framing → INR / DPDP
- Stripe → Razorpay (already the plan's choice)
