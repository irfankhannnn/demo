# 02 — Jira Backlog (10 Epics + Import-Ready Stories)

Maps to master-prompt **§2**. This is the **net-new** deliverable: the existing plan has no tracker-importable backlog. Below, every story uses the master-prompt template (Fibonacci points; P0 = launch blocker, P1 = launch week, P2 = post-launch M1) and is **cross-linked to the existing `launch-plan-v2/` file** that already covers it — or tagged a true gap.

> **Scope note:** Stories are written at plan/story level (acceptance criteria), not as implementation. Stories tagged `🔧 FEATURE` imply product code that will be scoped in the separate feature conversation. Stories tagged `✅ specced` are already fully described in an existing `P*`/`day-*` file — import them as "Done-when-file-AC-met" and point the story at that file.

> **Brand/scale assumptions:** RealEstateFlow, INR, Mumbai-first, solo founder (per `01` and `03`). Razorpay (not Stripe), Indian portals (not Rightmove/Zoopla), DPDP (not GDPR).

---

## Import notes (for Jira CSV / API)

Suggested CSV columns: `Issue Type, Epic Name, Epic Link, Summary, Story Points, Priority, Description, Acceptance Criteria, Labels, Status, Linked File`.
- Map P0/P1/P2 → Jira priority (Highest/High/Medium).
- `Linked File` = repo path of the existing task that satisfies the story (traceability).
- Statuses below reflect plan coverage, not build status: `Specced` (plan exists), `Gap` (needs new plan/work).

---

## EPIC-01 — AI Employee Core Engine
*Goal: the autonomous WhatsApp/Telegram AI Employee that qualifies, follows up, schedules, and escalates.*
**Primary existing file:** `pre-launch-prep/P11-openclaw-concierge.md`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E01-01 | Lead intake webhook (web form, portal, WhatsApp) | P0 | 5 | backend, AI | Gap 🔧 | P11 |
| E01-02 | NL lead-qualification flow (LLM-powered) | P0 | 8 | AI | Gap 🔧 | P11 |
| E01-03 | Auto follow-up sequence engine (WhatsApp + email) | P0 | 8 | AI, backend | Gap 🔧 | P11, `outreach/whatsapp-broadcast-sequences.md` |
| E01-04 | Listing Q&A (property details, price, availability) | P1 | 5 | AI | Gap 🔧 | P11, P5 |
| E01-05 | Site-visit scheduler (Cal.com / calendar) | P1 | 5 | AI, backend | Partial ✅ | P11, Cal.com in `00-PLAN-OVERVIEW.md` |
| E01-06 | Sentiment flag on conversations → CRM | P2 | 5 | AI | Gap 🔧 | P11 |
| E01-07 | Escalation: AI → human handoff at confidence threshold | P1 | 5 | AI | Gap 🔧 | P11 |
| E01-08 | Conversation memory across sessions | P2 | 8 | AI, backend | Gap 🔧 | P11 |
| E01-09 | Concierge provisioning backend + 24h SLA SOP | P0 | 8 | backend, infra | Specced ✅ | **P11** |

**Sample full story (E01-03):**
```markdown
**Story ID:** E01-03
**Title:** Build auto follow-up sequence engine (WhatsApp + email)
**Epic:** AI Employee Core Engine
**Priority:** P0
**Story Points:** 8
**As a** Mumbai broker,
**I want** the AI Employee to send timed follow-ups to buyers on WhatsApp (and email fallback),
**So that** no lead goes cold after first contact while I'm showing a property.
**Acceptance Criteria:**
- [ ] Sequence triggers on lead intake (E01-01) and on qualification result (E01-02)
- [ ] WhatsApp send via AiSensy (BSP, warm) per templates in outreach/whatsapp-broadcast-sequences.md
- [ ] Respects DPDP consent + opt-out; stops on reply or human takeover (E01-07)
- [ ] Logged to CRM activity timeline (E02-05)
**Dependencies:** E01-01, E01-02, E02-05
**Labels:** AI, backend
**Note:** 🔧 FEATURE — implementation scoped separately; concierge-config covered by P11.
```

---

## EPIC-02 — CRM Foundation & Data Layer
*Goal: the broker CRM (mostly built). Stories cover scoring/routing/dedupe gaps + launch-hardening.*
**Primary existing files:** product (`server/`, `real-estate-crm-app/`), `P5`, `P12`, `P13`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E02-01 | Contact/property data model + migrations (Mumbai) | P0 | 3 | backend | Built ✅ | `pricing.json` features, P5 |
| E02-02 | Lead pipeline view (Kanban + list, drag-drop) | P0 | 5 | frontend | Built ✅ | P5 (stages seeded) |
| E02-03 | AI lead scoring engine (0–100) | P1 | 8 | AI, backend | Gap 🔧 | `outreach/lead-scoring-template.md` |
| E02-04 | Smart routing (by speciality / locality / load) | P2 | 5 | backend | Gap 🔧 | — |
| E02-05 | Activity timeline (calls, WhatsApp, notes, AI) | P0 | 5 | frontend, backend | Built/verify ✅ | P5 |
| E02-06 | Bulk import (CSV, portal feeds) | P1 | 5 | backend | Gap 🔧 | E05 |
| E02-07 | Duplicate detection & merge | P2 | 5 | backend | Gap 🔧 | — |
| E02-08 | Khata book + settlement module | P0 | 3 | backend | Built ✅ | `pricing.json`, P5 |
| E02-09 | Multi-tenancy + security audit | P0 | 8 | backend, infra | Specced ✅ | **P13** |
| E02-10 | Seat-cap enforcement (Solo/Team/Team+) | P0 | 5 | backend | Specced ✅ | **P12** |

---

## EPIC-03 — Landing Page & Marketing Site
*Goal: fast, schema-rich, conversion-focused site. **Fully specced** in P15 + P16.*
**Primary existing files:** `P15`, `P16`, `P8`, `P17`, `vs-pages/`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E03-01 | Hero rewrite (new positioning, trust row) | P0 | 3 | content, frontend | Specced ✅ + see `04` | P15 |
| E03-02 | Problem/agitation section (3 pain cards) | P1 | 2 | content | **Gap ➕** see `04` | P15 (add) |
| E03-03 | Solution split (AI Employee \| CRM) | P0 | 3 | content, frontend | Specced/enhance ✅ | P15, `04` |
| E03-04 | Social-proof stat bar + testimonials | P1 | 3 | content | **Gap ➕** see `04` | P15 (add) |
| E03-05 | Pricing page (3 tiers + AI add-on) | P0 | 3 | frontend | Specced ✅ | P15 `/pricing`, pricing.json |
| E03-06 | FAQ page (AEO, FAQPage schema) | P0 | 3 | content, frontend | Specced ✅ + see `04`/`05` | P15, P16 |
| E03-07 | Demo / trial CTA flow | P0 | 3 | frontend | Specced ✅ | P15 `/demo`, P5 |
| E03-08 | JSON-LD (SoftwareApplication, FAQ, Article, LocalBusiness) | P0 | 5 | frontend, content | Specced ✅ | **P16** |
| E03-09 | OG + Twitter Card meta per page | P0 | 2 | frontend | Specced ✅ | P15, P16, P8 |
| E03-10 | Core Web Vitals green (Lighthouse ≥90) | P0 | 5 | frontend, infra | Specced ✅ | P15 |
| E03-11 | robots.txt with AI-bot directives | P0 | 1 | infra | **Change 🔁** see `05` | P16 |
| E03-12 | XML sitemap (auto-updated) + llms.txt | P0 | 2 | infra | Specced ✅ | P16 |
| E03-13 | Cookie consent banner (DPDP) | P0 | 3 | frontend | Specced ✅ | **P17** |
| E03-14 | `/vs/*` competitor pages × 3 | P1 | 5 | content | Specced ✅ | **P4**, vs-pages/, P15 |

---

## EPIC-04 — Onboarding & User Activation  ➕ (largest net-new launch gap)
*Goal: signup → activation (AI handles ≥1 lead within 7 days). The plan has signup + analytics but **no setup-wizard / welcome-sequence / empty-state tasks**.*
**Primary existing files:** `P14` (paywall/trial), `P10` (events), `week-2` (onboarding calls)

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E04-01 | Signup flow (phone OTP / email) | P0 | 3 | frontend, backend | Built ✅ | pricing.json (Phone OTP auth) |
| E04-02 | Guided setup wizard (connect WhatsApp → import leads → configure AI) | P0 | 8 | frontend | **Gap ➕ 🔧** | — (new story; see `03`) |
| E04-03 | Welcome email/WhatsApp sequence (Day 0/3/7/14) | P1 | 5 | content, backend | **Gap ➕** | `P3` deliverability, Brevo; `day-13-checkin-drip.md` |
| E04-04 | In-app onboarding tooltips | P2 | 5 | frontend | **Gap ➕ 🔧** | — |
| E04-05 | Empty-state UX (helpful prompts when no data) | P1 | 3 | frontend | **Gap ➕ 🔧** | — |
| E04-06 | Activation event instrumented (`ai_employee_lead_handled` within 7d) | P0 | 2 | analytics | Specced ✅ | **P10**, `00-PLAN-OVERVIEW.md` §5 |
| E04-07 | Trial countdown + paywall UI | P0 | 5 | frontend | Specced ✅ | **P14** |

**Sample full story (E04-02):**
```markdown
**Story ID:** E04-02
**Title:** Build guided setup wizard (connect → import → configure)
**Epic:** Onboarding & User Activation
**Priority:** P0
**Story Points:** 8
**As a** new RealEstateFlow trial user,
**I want** a 3-step wizard that connects my WhatsApp, imports my existing leads, and configures my AI Employee preferences,
**So that** I reach my first AI-qualified lead within 7 days (the activation event).
**Acceptance Criteria:**
- [ ] Step 1: connect WhatsApp (AiSensy) / Telegram; show connection status
- [ ] Step 2: import leads (CSV + portal feed from E05); dedupe (E02-07)
- [ ] Step 3: configure AI tone, working hours, escalation contact (E01-07)
- [ ] Progress persists; resumable; skippable with empty-state fallbacks (E04-05)
- [ ] Fires PostHog events at each step + on completion (P10)
**Dependencies:** E01-09, E02-06, E05-01, E04-06
**Labels:** frontend, AI
**Note:** 🔧 FEATURE — route build to separate conversation; this story defines the launch requirement.
```

---

## EPIC-05 — Integrations  🇮🇳 (UK portals → Indian portals)
*Goal: connect the channels brokers actually use in India.*
**Primary existing files:** `00-PLAN-OVERVIEW.md` (stack), `P11`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E05-01 | Indian portal connectors (99acres, MagicBricks, Housing.com) | P1 | 8 | backend | **Gap ➕ 🔧** | — (replaces Rightmove/Zoopla) |
| E05-02 | WhatsApp Business API (AiSensy BSP) | P0 | 5 | backend | Specced ✅ | `00-PLAN-OVERVIEW.md`, P11 |
| E05-03 | Telegram integration | P1 | 5 | backend | Gap 🔧 | wedge in `00-PLAN-OVERVIEW.md` |
| E05-04 | Email sync (Brevo transactional; Gmail/Outlook two-way = P2) | P1 | 5 | backend | Partial ✅ | P3 |
| E05-05 | Calendar sync (Cal.com; Google/Outlook = P2) | P1 | 3 | backend | Specced ✅ | Cal.com in overview |
| E05-06 | Zapier / Make webhook endpoints | P2 | 5 | backend | Gap 🔧 | — |
| E05-07 | ~~IDX / MLS feed ingestion~~ | — | — | — | **Dropped (N/A India)** | see `00` |

---

## EPIC-06 — SEO / AEO / Content Infrastructure
*Goal: discoverable in Google + AI search. **Strong** in P16; gaps = AI-bot robots, VideoObject, calendar.*
**Primary existing files:** `P16`, `M2-content-engine.md`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E06-01 | Blog CMS (headless, schema-ready) | P1 | 5 | content, infra | Partial ✅ | M2-content-engine, P15 `/blog` |
| E06-02 | FAQ hub page (LLM-crawlable) | P1 | 3 | content | Specced ✅ | P16, P15 |
| E06-03 | Programmatic SEO pages (city × use-case) | P2 | 8 | content, infra | Specced (M2) ✅ | P16, `M2`, `day-25` |
| E06-04 | VideoObject schema on video embeds | P2 | 2 | content | **Gap ➕** see `05` | P16 (add) |
| E06-05 | Bing Webmaster + GSC + Brave verification | P0 | 2 | infra | Specced ✅ | P16 |
| E06-06 | Sitemap auto-submission pipeline | P1 | 3 | infra | Specced ✅ | P16 |
| E06-07 | 5 AEO answer pages | P1 | 5 | content | Specced ✅ | **P16** answers/ |
| E06-08 | 90-day content calendar (M1–M3) | P1 | 3 | content | **Gap ➕** see `05` | M2-content-engine (expand) |
| E06-09 | YouTube channel + transcripts strategy | P2 | 5 | content | **Gap ➕** see `05` | — |

---

## EPIC-07 — Analytics & Reporting Dashboard  ➕ (event tracking ✅, in-product dashboards = gap)
**Primary existing files:** `P10` (events), `day-04`, `day-21` (metrics review)

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E07-01 | Analytics events (SPA + LP + server) | P0 | 5 | analytics | Specced ✅ | **P10**, day-04 |
| E07-02 | Agent performance dashboard (in-product) | P2 | 8 | frontend, backend | **Gap ➕ 🔧** | — |
| E07-03 | Lead velocity & conversion funnel report | P1 | 5 | frontend | **Gap ➕ 🔧** | day-21 (manual now) |
| E07-04 | AI activity log (what AI did, when, outcome) | P1 | 5 | frontend, AI | **Gap ➕ 🔧** | P11 |
| E07-05 | Revenue forecast view (pipeline × conv. rate) | P2 | 5 | frontend | Partial ✅ | P5 (demo shows ₹ pipeline) |
| E07-06 | GA4 + event tracking live | P0 | 3 | analytics | Specced ✅ | P10, P15 |
| E07-07 | Search Console AI-Overview-appearance pull | P2 | 3 | analytics | Specced ✅ | P16 aeo-citation-monitor |

---

## EPIC-08 — Billing & Subscription  🇮🇳 (Stripe → Razorpay; mostly specced)
**Primary existing files:** `P2`, `P14`, `P7`, `P12`, `day-26`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E08-01 | Razorpay subscription integration | P0 | 8 | backend | Specced ✅ | **P2**, day-03 payment-go-live |
| E08-02 | Plan tier enforcement (feature flags / seat caps) | P0 | 5 | backend | Specced ✅ | **P12** |
| E08-03 | GST invoice generation & download | P0 | 5 | backend | Specced ✅ | **P7** |
| E08-04 | Trial → paid conversion prompt | P0 | 3 | frontend | Specced ✅ | **P14**, day-26 |
| E08-05 | AI Employee add-on billing (no trial, no refund) | P0 | 3 | backend | Specced ✅ | pricing.json, P11 |

---

## EPIC-09 — Launch Operations & GTM
*Goal: beta → public launch. Mostly specced; press release + ProductHunt = gaps.*
**Primary existing files:** `week-2`, `week-3`, `linkedin-posts/`, `P6`, `cross-cutting/`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E09-01 | Beta recruitment & onboarding (8–12 Mumbai agencies) | P0 | 5 | gtm | Specced ✅ | week-2 (day-08..10) |
| E09-02 | Launch checklist (pre-execution) | P0 | 2 | gtm | Specced ✅ | **cross-cutting/pre-execution-checklist.md** |
| E09-03 | Press release to PropTech / India real-estate press | P1 | 3 | content | **Gap ➕** see `03` | — |
| E09-04 | ProductHunt launch assets | P1 | 5 | content, design | **Gap ➕** (low priority for India) | day-16 (directories) |
| E09-05 | LinkedIn launch campaign (5 founder posts) | P0 | 3 | content | Specced ✅ | **linkedin-posts/**, P6 |
| E09-06 | Instagram launch assets | P1 | 3 | content, design | Partial ✅ | brand kit specs |
| E09-07 | Cold outreach × 3 channels (50 Mumbai prospects) | P0 | 5 | gtm | Specced ✅ | week-3 (day-17..20) |
| E09-08 | Directory submissions (G2, Capterra, etc.) | P1 | 3 | gtm | Specced ✅ | **day-16** |
| E09-09 | Referral programme mechanics | P2 | 5 | gtm | Specced ✅ | **M2-referral-program-scale.md** |
| E09-10 | Launch webinar / live demo (record for YouTube) | P2 | 3 | gtm | **Gap ➕** | M2-content-engine (webinar noted) |

---

## EPIC-10 — Post-Launch Growth & Iteration
*Goal: M1→M3 momentum. Mostly specced across week-4 + month-2-plus.*
**Primary existing files:** `week-4`, `month-2-plus/`

| Story ID | Title | Pri | Pts | Labels | Status | Linked file |
|---|---|---|---|---|---|---|
| E10-01 | A/B test LP hero variants | P2 | 5 | growth | Specced ✅ | day-22 CRO, M2-paid-ads |
| E10-02 | Churn survey + offboarding flow | P2 | 5 | product | Specced ✅ | day-29 retention audit |
| E10-03 | Affiliate / partner programme | P2 | 5 | gtm | Specced ✅ | M2-partnerships, M2-referral |
| E10-04 | Case study template + first 2–3 case studies | P1 | 5 | content | Specced ✅ | **day-25**, M2-content-engine |
| E10-05 | G2 / Capterra profiles (reviews) | P1 | 3 | gtm | Specced ✅ | day-16 |
| E10-06 | In-app NPS + feedback loop | P1 | 5 | product | Specced ✅ | **day-28** |
| E10-07 | First paid search/social campaign (PMF-gated) | P2 | 5 | growth | Specced ✅ | M2-paid-ads-readiness |
| E10-08 | Pune ramp (M2–M3) | P2 | 8 | gtm | Specced ✅ | M2-pune-ramp |

---

## Backlog summary

| Epic | Stories | True gaps (➕/🔧) | Already specced (✅) |
|---|---|---|---|
| E01 AI Employee | 9 | 7 | 2 |
| E02 CRM | 10 | 4 | 6 |
| E03 Landing/Site | 14 | 2 | 12 |
| **E04 Onboarding** | 7 | **4** | 3 |
| E05 Integrations | 6 (+1 dropped) | 3 | 3 |
| E06 SEO/AEO | 9 | 3 | 6 |
| **E07 Analytics** | 7 | **3** | 4 |
| E08 Billing | 5 | 0 | 5 |
| E09 Launch Ops | 10 | 3 | 7 |
| E10 Post-Launch | 8 | 0 | 8 |
| **Total** | **85** | **29** | **56** |

**Read:** ~66% of the backlog is already specced in the existing plan; the real new work concentrates in **AI Employee internals (E01)**, **Onboarding (E04)**, **Integrations (E05)**, and **in-product Analytics (E07)** — all `🔧 FEATURE`, i.e. routed to the separate feature-implementation conversation. The launch-plan deltas (copy, content, SEO, GTM assets) are in `03`–`05`.
