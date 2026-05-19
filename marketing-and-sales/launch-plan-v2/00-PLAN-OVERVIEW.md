# RealEstateFlow — Plan Overview (condensed)

A Mumbai-first, founder-led, ₹0-paid-ads launch of RealEstateFlow positioned as an *AI Employee that runs your broking agency on WhatsApp + Telegram*, with English landing pages, ₹999/₹1,999+₹500/AI-Employee-₹7,999 pricing, and a 30-day execution sheet that 1 founder + 1 AI agent can complete end-to-end.

---

## 1. Wedge

**RealEstateFlow is an AI Employee that runs your broking agency on WhatsApp and Telegram.** It qualifies leads, follows up buyers, books site visits, and updates your Khata book — without you hiring another agent.

- **Audience M1:** Solo brokers + small teams (≤3 agents), Mumbai only.
- **Anti-positioning:** Sell.do · Zoho · LeadSquared · Excel + WhatsApp-only workflow.
- **Activation event:** owner connects WhatsApp + AI Employee handles ≥1 inbound lead end-to-end within 7 days.

---

## 2. Pricing (canonical: see `pricing.json`)

| Plan | Price (+18% GST) | Trial | Refund | Includes |
|---|---|---|---|---|
| Solo | ₹999/mo | 14-day, no card | 1 month | 1 member, full CRM |
| Team | ₹1,999/mo | 14-day, no card | 1 month | up to 3 members |
| Team+ | ₹1,999 + ₹500/extra/mo | 14-day, no card | 1 month | 4+ members, prorated |
| AI Employee add-on | ₹7,999/mo | **none** | **none** | 1 OpenClaw config per agency, 24h concierge setup |

Annual discount: 20% off Solo/Team/Team+ (not AI Employee). Free onboarding, training videos, chat & email support across all tiers.

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

| Metric | Target | Measurement source |
|---|---|---|
| Trial signups | 30-50 | PostHog `signup_completed` |
| Paying customers | 3-5 | Razorpay `subscription_charged` |
| Activation rate | ≥40% | PostHog `ai_employee_lead_handled` within 7d of signup |
| Cold reply rate | ≥10% | Manual log + Instantly metrics |
| NPS responses | ≥10 | DynamoDB `NPSResponses` |
| Promoters (9-10) | ≥3 | NPS report |

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
| Analytics | PostHog + GA4 + Meta Pixel + LinkedIn Tag + Hotjar |
| Transactional email | Brevo |
| Cold email | Instantly |
| WhatsApp warm | AiSensy (BSP) |
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
| In-app NPS + feedback (Day 28) | `week-4-optimize-convert/day-28-nps-feedback.md` |

---

## 9. What's already shipped (reuse — don't recreate)

See `cross-cutting/existing-asset-reuse-map.md`. Highlights:
- 4-week launch plan acceptance criteria already drafted in `marketing-and-sales/launch-plan/{pre-launch-prep,week-1..4}/`
- Brand kit + Mumbai launch creative briefs at `creative/realestateflow-launch/`
- ICP + Mumbai positioning + personas at `research/`
- Mumbai outreach templates + WhatsApp sequences at `outreach/`
- 4 broker-segment HTML mock-ups at `realestateflow/direction1..4.html`
- 6 existing landing pages at `creative/landing-pages/` (Hinglish, old pricing — to be rewritten in P15)
