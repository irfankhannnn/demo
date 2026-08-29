# 05 — SEO / AEO / Content Strategy Delta

Maps to master-prompt **§5**. The existing `pre-launch-prep/P16-seo-aeo-master.md` and `month-2-plus/M2-content-engine.md` are strong. This file adds the genuine gaps: **explicit AI-bot robots.txt directives, VideoObject schema, the 90-day content calendar (India-adapted), YouTube strategy, and a consolidated KPI dashboard.**

---

## 5.1 — Technical SEO (🔁 CHANGE robots.txt; ➕ ADD VideoObject)

### robots.txt — make AI-bot access explicit (🔁)

P16's robots.txt is `User-agent: *  Allow: /` (functionally allows all bots, but not explicit). Adopt the master prompt's named stanzas so AI crawlers are unambiguously welcomed and the file is self-documenting. **Update the `robots.txt` block in `P16`** to:

```
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://realestateflow.in/sitemap.xml
```

> Rationale: Bing feeds ChatGPT search; GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Google-Extended govern AI training + answer crawling. Explicit `Allow` is the AEO best practice the master prompt calls for. Keep `Disallow /admin /api`.

### JSON-LD (✅ EXISTS — confirm)
P16 already specs `SoftwareApplication`, `Organization`, `WebSite/SearchAction`, `FAQPage`, `Product`×3, `LocalBusiness`, `Article`, `BreadcrumbList`, `ContactPoint`. The master prompt's homepage `SoftwareApplication` + `FAQPage` are already covered (in INR). **No change** except add the 7 localised FAQ entries from `04` §4.7 to the FAQPage blob.

### VideoObject schema (➕ ADD)
Not in P16's schema list. **Add `VideoObject`** to the P16 acceptance criteria for any page embedding a video:
- `/demo` (90-sec demo), `/` (hero demo embed), and every future YouTube embed (E06-04, E06-09).
- Fields: `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration` (ISO 8601), `contentUrl`/`embedUrl`, `transcript` where available.
- Why: AI engines index transcript text; VideoObject + transcript is the AEO move for video.

---

## 5.2 — Keyword strategy (✅ EXISTS — confirm, don't duplicate)

P16 already defines Mumbai-first primary keywords + programmatic `/ai-crm/[city]` for M2. The master prompt's UK keywords map directly to the India set already present:

| Master (UK) | RealEstateFlow (India) — already in P16 |
|---|---|
| AI CRM for real estate | `real estate CRM Mumbai` |
| Real estate AI employee | `AI employee for brokers` |
| Real estate lead automation | `WhatsApp CRM for real estate` |
| Programmatic `/ai-crm/[city]` | `[locality] property CRM` (Andheri, Bandra, Powai, Thane…) — already planned M2 |

**No change.** Optionally add `/ai-employee/[use-case]` programmatic pattern (lead-qualification, site-visit-booking) to the M2 programmatic list — low priority.

---

## 5.3 — AEO content rules (✅ EXISTS — reinforce)

P16 + M2-content-engine already encode: 40-word direct answer first, H2-as-question, ≥1 table/list, quarterly refresh, Bing submission, off-site mentions (G2/Capterra/Reddit). The master prompt's stat — *44.2% of LLM citations come from the first 30% of a page* — reinforces the **frontload-the-answer** rule. Add this one line to the P16/M2 AEO rules as the rationale. No structural change.

---

## 5.4 — 90-Day Content Calendar (➕ ADD — the main gap, India-adapted)

`M2-content-engine.md` has a light 12-week sketch but **no structured Month-1–3 calendar** with platform/format/keyword/goal columns. Add this calendar as a new file `month-2-plus/M2-content-calendar-90day.md` (or expand `M2-content-engine.md`). Localised from master §5.4 to India/Mumbai/WhatsApp/INR + the real v2 launch timing (Public launch = week-3 in this plan).

> Cadence (solo-founder realistic, ~5h/week per `M2-content-engine`): **1 blog/week + 2 LinkedIn/week + 1 Twitter thread/week + YouTube as capacity allows.** Backlog E06-08, E06-09.

### Month 1 — Foundation (authority)

| Wk | Platform | Content | Format | Target keyword / goal |
|---|---|---|---|---|
| 1 | Blog | "What is a Real Estate AI Employee? The 2026 guide for Indian brokers" | Long-form 2,000w | "AI employee real estate" |
| 1 | YouTube | Product demo: AI Employee qualifying a buyer on WhatsApp (3 min) | Video | Brand awareness |
| 1 | Instagram | Behind-the-scenes: building RealEstateFlow in Mumbai | Reel 30s | Engagement |
| 2 | Blog | "How to manage Mumbai broker WhatsApp leads (without losing the human touch)" | How-to 1,500w | "Mumbai broker WhatsApp leads" |
| 2 | LinkedIn | Founder post: why I built an AI for Indian brokers | Text | Founder credibility |
| 3 | Blog | "Best CRM for real estate brokers in India 2026: an honest comparison" | Comparison 2,500w | "best CRM real estate India 2026" |
| 3 | YouTube | Tutorial: connect your WhatsApp + 99acres to RealEstateFlow (5 min) | Video | "portal automation real estate" |
| 4 | Blog | "AEO vs SEO for real estate: what actually gets Indian brokers leads in 2026" | Thought leadership | AI-driven traffic |
| 4 | Instagram | Stat carousel: 5 AI real-estate stats that change how brokers work | Carousel | Shares/saves |

### Month 2 — Engagement & social proof (public launch lands here)

| Wk | Platform | Content | Format | Goal |
|---|---|---|---|---|
| 5 | Blog | "How [Beta Agency] booked 3 extra site visits in a weekend using AI" | Case study | Conversion (ties to `day-25`) |
| 5 | YouTube | Beta agency testimonial interview | Video 4 min | Trust |
| 6 | Blog | "Real estate WhatsApp automation: the 2026 guide Indian brokers need" | How-to | "WhatsApp real estate automation" |
| 6 | LinkedIn | Data post: our AI's avg response time vs industry | Infographic | Engagement |
| 7 | Blog | "How to score and prioritise real-estate leads with AI" | How-to | "AI lead scoring real estate" |
| 7 | YouTube | Feature walkthrough: CRM pipeline + Khata book | Video 3 min | Product education |
| 8 | **LAUNCH WEEK** | All channels: launch campaign (LinkedIn posts 1–5, press, directories) | Multi-format | per `00-PLAN-OVERVIEW.md` M1 targets |

> 🇮🇳 Note: in this plan, public launch is **week-3 (day 15-21)**; the calendar's "launch week" aligns to that window, not master's literal week-8. Adjust week numbers to your actual start date.

### Month 3 — Scale & SEO momentum

| Wk | Platform | Content | Format | Goal |
|---|---|---|---|---|
| 9 | Blog | Market report: AI adoption among Indian brokers (original survey of beta + cold-outreach data) | Research | Backlinks/authority |
| 9 | YouTube | Webinar recording: AI in Indian real estate Q&A | Long-form | SEO + nurture |
| 10 | Blog | Programmatic: "AI CRM for Andheri / Bandra estate agents" | Location page | Local SEO |
| 10 | Instagram | Customer milestone (# site visits booked via AI) | Story + post | Community |
| 11 | Blog | Programmatic: "AI CRM for Thane / Navi Mumbai property teams" | Location page | Local SEO |
| 11 | LinkedIn | Thought leadership: the death of the Excel-and-WhatsApp workflow | Article | B2B authority |
| 12 | Blog | "What Mumbai brokers say about AI CRMs" (G2/review roundup) | Review aggregation | Trust + AEO |

---

## 5.5 — Platform tactics (🔁 LinkedIn ✅; ➕ YouTube gap; Instagram/Facebook adapt)

| Platform | Status | Action |
|---|---|---|
| **Google Search** | ✅ EXISTS | P16 covers structured data, CWV, internal linking, sitemap. Add **Google Business Profile** (category: Software / Real Estate Tech, Mumbai) — small ➕. |
| **YouTube** | ➕ **GAP** | New: channel "RealEstateFlow — AI for Indian Real Estate"; keyword titles; 300+ word descriptions; timestamped chapters; **uploaded transcripts (mandatory — AI indexes them)**; VideoObject on embed pages; 1 video/week target. (E06-09) |
| **Instagram** | 🔁 partial | Business account; bio per brand kit; keyword captions 100–150w; 5–8 hashtags (#RealEstateAI #PropTechIndia #RealEstateCRM #MumbaiRealEstate #PropTech #EstateAgent); Mumbai location tags; alt text. |
| **Facebook** | 🔁 light | Page; keyword-rich About; native posts (not just links); join Mumbai broker FB groups; alt text. (Lower priority for India B2B.) |
| **LinkedIn** | ✅ EXISTS | `linkedin-posts/` (5 founder posts) + `P6`. Maintain 2–3 founder posts/week; company page re-shares. |
| **AI assistants (AEO)** | ✅ EXISTS | P16 covers Bing submission, AI-bot robots (now explicit, §5.1), G2/Capterra/Crunchbase listings, PropTech-newsletter mentions. `/chatgpt-plugin` manifest = optional backlog ➕. |

---

## 5.6 — KPI dashboard (🔁 CHANGE: consolidate scattered metrics)

P16, M2-content-engine, and `00-PLAN-OVERVIEW.md` each carry partial metrics. Consolidate into **one KPI table** (add to `M2-content-engine.md` or the new calendar file). India-adapted targets, Month-3:

| Metric | Tool | Target (M3) |
|---|---|---|
| Organic search impressions | GSC | 5,000+/mo (per M2-content-engine M3) |
| AI Overview / AI-answer appearances | GSC AI section + manual | 5+ queries with citation |
| AI brand citations (ChatGPT/Perplexity/Brave) | `P16` aeo-citation-monitor (weekly) | 5+ consistent |
| YouTube watch time | YouTube Studio | growing baseline (set after channel launch) |
| Instagram profile reach | Meta Business Suite | baseline → grow |
| Blog sessions | GA4 | 500+ clicks/mo (per M2 M3) |
| Leads from organic | CRM source tracking (P10) | tie to PMF-gate metrics |
| Paying customers | Razorpay | per `00-PLAN-OVERVIEW.md` (PMF-gated; not master's 200) |

> Keep targets consistent with the existing M2-content-engine numbers and the PMF gate — **do not** import the master's UK volume targets (10,000 impressions, 200 customers) wholesale; they're aspirational ceilings (see `03` §2).

---

## 5.7 — Apply targets

| Change | Target | Backlog |
|---|---|---|
| Explicit AI-bot robots.txt | `P16` robots.txt block | E03-11 |
| VideoObject schema | `P16` AC + schema list | E06-04 |
| Frontload-answer rationale line | `P16`/`M2-content-engine` AEO rules | E06-07 |
| 90-day content calendar | new `month-2-plus/M2-content-calendar-90day.md` (or expand `M2-content-engine.md`) | E06-08 |
| YouTube channel strategy | new section in `M2-content-engine.md` | E06-09 |
| Google Business Profile | `P16` platform tactics | E06-05 |
| Consolidated KPI dashboard | `M2-content-engine.md` | E07-07 |
| 7 localised FAQ Q&As → FAQPage | `P16` FAQPage + `04` | E03-06 |
