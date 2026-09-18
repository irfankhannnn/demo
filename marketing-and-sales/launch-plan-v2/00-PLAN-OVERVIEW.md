# RealEstateFlow — Plan Overview (condensed)

> **Status (17 Sep 2026):** Checked against the code on `main` and against the September merge. Telegram removed (no code, dropped by decision), the inline pricing table replaced by a pointer to `pricing.json`, measurement sources pointed at the event map, and the stack table brought up to date.

A Mumbai-first, founder-led, ₹0-paid-ads launch of RealEstateFlow positioned as an *AI Employee that runs your broking agency on WhatsApp*, with English landing pages, current pre-launch pricing held in `pricing.json`, and a 30-day execution sheet that one founder plus AI agents can complete end to end.

---

## 1. Wedge

**RealEstateFlow is an AI Employee that runs your broking agency on WhatsApp.** It qualifies leads, follows up buyers, books site visits, and updates your Khata book — without you hiring another agent.

> Telegram was dropped: there is no Telegram code in the repo. Remove it from any copy where it survives.

- **Audience M1:** Solo brokers + small teams (≤3 agents), Mumbai only.
- **Anti-positioning:** Sell.do · Zoho · LeadSquared · Excel + WhatsApp-only workflow.
- **Activation event:** owner connects WhatsApp + AI Employee handles ≥1 inbound lead end-to-end within 7 days.
  - ⚠️ A Solo/Team **trial** user cannot reach this event — the AI Employee is a paid add-on with no trial (`pricing.json`). The definition and its ≥40% target are therefore unsettled, and they conflict with the milestone-based definition in the archived activation specs. Working definition and options: `50-measurement/activation-definition.md`.
  - > Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 2. Pricing — pointer only

**`pricing.json` is the only source of prices, trial length and refund terms.** `README.md` forbids restating a price anywhere else, and the table that used to sit here did exactly that — and had drifted (it said a "1 month" refund where `pricing.json` says a **30-day money-back window for first-time subscribers, with anti-abuse terms**).

What a reader needs to know without opening the file:

- Tiers are Solo, Team, Team+ and the **AI Employee add-on**, which has **no trial and no refund**. Any creative that names the AI Employee carries that disclosure.
- Everything is quoted **+18% GST**. Annual billing carries a discount on the CRM tiers, not the add-on.
- These are **current pre-launch prices, under review.** `pricing.json` and the CRM's own `agency-app/web/src/lib/plans.ts` disagree on Team+. Both are being replaced by the proposal at `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` (plans limited by number of properties plus AI credits, with a new "Contacts" billable unit). Do not treat today's numbers as final.
- The brand kit states a **different offer** (2 months free, 6-month money-back, AI Employee +₹5,000). That conflict is unresolved — see `10-audience-and-voice/brand-constants.md` §5.

---

## 3. Roadmap

```
T-21..T-1   PRE-LAUNCH    DNS · warm-up · legal · demo · pricing · branding · GST · audits · LP rewrite
DAY 1-7     WEEK 1        Friction → fixes → payments → analytics → helpdesk → LP deploy → audit
DAY 8-14    WEEK 2        Mumbai beta: 30-40 prospects → 8-12 testers → 5+ testimonials
DAY 15-21   WEEK 3        Public launch · directories · 50 Mumbai cold prospects × 3 channels
DAY 22-30   WEEK 4        Optimize · follow-up · reactivate · case study · NPS · M2 plan · referral
DAY 31-60   MONTH 2 (PMF) First paid spend · programmatic SEO · webinar 1
DAY 61+     MONTH 3-6     Pune → Bangalore → Delhi → Hyderabad
```

---

## 4. PMF gate (must be met before any Month-2 paid spend)

- ≥3 paying customers
- ≥40% trial-to-activation rate
- ≥10% reply rate on cold outreach
- ≥1 NPS promoter (score 9-10)

If gate is missed by Day 30, hold paid spend; iterate the Mumbai beta cycle for another 14 days before retrying.

---

## 5. Success metrics M1 (Day 30)

Event names are **not** restated here. Every row's exact source is defined once, in `50-measurement/posthog-event-map.md`, which is built from the live contract in `agency-app/web/src/types/analytics.ts`, `agency-app/api/lib/posthog.js`, `agency-app/landing-pages/_partials/head-analytics.hbs` and `coding-agent-brief/01-SHARED-CONTRACTS.md` §3.4.

| Metric | Target | Measurement source |
|---|---|---|
| Trial signups | 30-50 | PostHog — see `50-measurement/posthog-event-map.md` |
| Paying customers | 3-5 | Razorpay billing webhook (`agency-app/api/routes/billing.js`) |
| Activation rate | ≥40% | PostHog, within 7d of signup — definition open, see D27 |
| Cold reply rate | ≥10% | Manual log + Instantly metrics |
| NPS responses | ≥10 | DynamoDB `NPSResponses` (`agency-app/api/routes/feedback.js`) |
| Promoters (9-10) | ≥3 | NPS report |

The weekly version of this table, with the exact query behind each number, is `50-measurement/weekly-scorecard.md`.

---

## 6. Founder constraints

- **Solo founder**, 6-day week, Sunday off
- Demo windows: Tue-Fri 11:00-17:00 IST
- Daily outbound caps Days 17-21: 20 cold emails / 15 cold WhatsApps / 10 LinkedIn DMs
- Coding capped at 2h/day during Weeks 3-4
- All AI artefacts under `marketing-and-sales/launch-implement/`
- All decisions logged to `00-DECISIONS-LOG.md`
- End-of-day standup at `marketing-and-sales/launch-implement/daily-log/dayXX.md`

---

## 7. Stack

| Concern | Choice |
|---|---|
| Cloud | AWS `ap-south-1` |
| Payments | Razorpay (live KYC in flight) |
| DNS | Cloudflare |
| Analytics | **PostHog is the canonical event store** (wired in the SPA, the server and the landing pages) + GA4 + Meta Pixel + LinkedIn Tag + Hotjar |
| Social scheduling | Blotato MCP — configured in `.mcp.json`, usage pending **D22** |
| Property-page chat | ManyChat — live (`docs/public-app/property-pages/02-MANYCHAT-SETUP.md`) |
| Transactional email | Brevo |
| Cold email | Instantly |
| WhatsApp warm | AiSensy (BSP) — **planned**. Note the distinction: the *product's* WhatsApp is self-hosted Baileys (`platform/whatsapp-platform/`), QR-linked, not a BSP. The official WhatsApp Business Cloud API direction is `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`. Which number talks to prospects is **D29c**. |
| WhatsApp cold | personal number ≤15/day |
| Helpdesk | Crisp |
| Status + uptime | BetterStack |
| Booking | Cal.com |
| Error tracking | Sentry |
| Voice-overs | ElevenLabs |
| Image gen | Nano-Banana-Pro (Higgsfield) |
| Lead scraping | Firecrawl |
| Legal | Termly draft → Vakilsearch review |

---

## 8. New build-needed gaps (cross-references to task files)

| Gap | File |
|---|---|
| Retired design specs, with the condition that would justify building each | `50-measurement/design-only-backlog.md` |
| Logo SVG + dark + favicons + OG | `pre-launch-prep/P8-logo-and-favicons.md` |
| Grievance flow + `/grievance` page | `pre-launch-prep/P9-grievance-flow.md` |
| Analytics events SPA+LP+server | `pre-launch-prep/P10-analytics-events.md` |
| OpenClaw concierge backend + SOP | `pre-launch-prep/P11-openclaw-concierge.md` |
| Seat-cap enforcement | `pre-launch-prep/P12-seat-cap-enforcement.md` |
| Multi-tenancy + security audit | `pre-launch-prep/P13-multitenancy-security-audit.md` |
| Subscription paywall UI + trial countdown | `pre-launch-prep/P14-paywall-trial-countdown.md` |
| Landing pages rewrite ×5 (English + new pricing) | `pre-launch-prep/P15-landing-pages-rewrite.md` |
| SEO + AEO + JSON-LD on every page | `pre-launch-prep/P16-seo-aeo-master.md` |
| Cookie consent banner | `pre-launch-prep/P17-cookie-consent-banner.md` |
| In-app NPS + feedback (Day 28) | `week-4-optimize-convert/day-28-nps-feedback-loops.md` |

---

## 9. What's already shipped (reuse — don't recreate)

See `cross-cutting/existing-asset-reuse-map.md`, and `archive/content-os/README.md` for what was retired in the September merge. Highlights:
- 4-week launch plan acceptance criteria already drafted in `marketing-and-sales/launch-plan/{pre-launch-prep,week-1..4}/`
- Brand kit + Mumbai launch creative briefs at `creative/realestateflow-launch/`
- ICP + Mumbai positioning + personas at `research/`
- Mumbai outreach templates + WhatsApp sequences at `outreach/`
- 4 broker-segment HTML mock-ups at `realestateflow/direction1..4.html`
- 6 existing landing pages at `creative/landing-pages/` (Hinglish, old pricing — to be rewritten in P15)
