# M2 — Paid Ads Readiness (Meta + Google)

> **Type:** 🤖 + 🧍
> **Phase:** Month 2 (Day 31-60)
> **Skill(s):** `paid-ads` + `ad-creative` + `analytics-tracking` + `landing-page`
> **Estimated time:** 2 weeks (founder + 4-6h/week ongoing)
> **Pre-requisites:** M1 PMF gate PASS or PARTIAL; Day-21/Day-29 channel ROI shows paid as next leverage

## Objective
Activate first paid acquisition: Meta retargeting (₹50k) + Google Search ads (₹50k) targeting Mumbai-broker keywords + retargeting cold-cohort + LP visitors. Goal: 10-25 additional paid customers M2 at CAC ≤ ₹1,500.

## Why This Matters for RealEstateFlow
M1 ran zero paid spend; M2 layers paid on top of validated organic + outbound. CAC budget is small but disciplined — a single learning loop, then scale or kill.

## Plan

### M2 Week 1 — Account setup + retargeting

- **Meta Business Manager**: verify pixel firing on all 12 LPs (P10 baseline)
- Build 3 audience pools:
  - **Cold cohort retargeting** — `Lead`/`signup_failed` events from M1 prospects (web visitors)
  - **LP-visitor retargeting** — visited /pricing or /demo, didn't sign up
  - **Lookalike** — 1% lookalike of M1 paying customers (seed audience N≥9 required by Meta)
- **3 retargeting campaigns** (₹50k Meta budget, ₹500-1000/day):
  - Campaign 1: cold-cohort retargeting → /demo (₹15k)
  - Campaign 2: LP-visitor retargeting → /pricing (₹20k)
  - Campaign 3: lookalike → /pricing (₹15k)
- **5 ad creatives** per campaign (use `ad-creative` skill + Day-14 testimonial videos)

### M2 Week 2 — Google Search activation

- **Google Ads** account verified
- 5 ad groups around long-tail keywords:
  - "real estate CRM Mumbai" (avg CPC ₹50-120)
  - "broker software Mumbai" (avg CPC ₹40-90)
  - "AI WhatsApp real estate" (avg CPC ₹30-70)
  - "real estate Excel alternative" (avg CPC ₹15-40)
  - "Sell.do alternative" (avg CPC ₹80-150 — competitor branded)
- Budget: ₹50k → ₹1,000-2,000/day
- Landing pages: each ad group → matched LP (+ /vs/* pages where applicable)
- Conversion tracking via GA4 → Google Ads conversion event `signup_completed`
- Negative keywords: developer, builder, internship (cleanup non-broker traffic)

### M2 Weeks 3-4 — Optimisation

- Daily budget review
- Pause underperforming ad sets (CPL > ₹500)
- Scale winners (CPL < ₹250) by 20% every 3 days
- Creative refresh every 7-10 days (creative fatigue typical at 100k impressions)

## Success metrics

| Metric | M2 Target |
|---|---|
| Total paid spend | ≤ ₹100k |
| Total paid signups | ≥ 30 |
| CPL (cost per lead) | ≤ ₹250 |
| CAC (cost per paying customer) | ≤ ₹1,500 |
| LTV / CAC ratio | ≥ 3:1 (using 12-mo retention assumption) |
| Channel ROI vs organic | comparable or better |

## Required AI Prompts (M2 Week 1 kickoff)

```
Use `paid-ads` skill. Read:
- M1 wedge-v2 + battle cards (Day 27)
- Day-14 testimonials
- Persona docs
- Channel ROI from Day-21 + Day-29

Produce:
1. M2 Meta campaign plan: audiences, ad sets, creative briefs, budget allocation
2. M2 Google Search keyword research + ad-group structure + negative-keyword list
3. 15 ad creatives (5 per Meta campaign) with copy + image briefs
4. Conversion event mapping in GA4 + Meta + Google Ads
5. Landing-page-to-ad mapping (which LP for which ad group)
6. Daily KPI dashboard (PostHog + Meta + Google) for monitoring
7. Kill/scale decision framework

Stop. Don't auto-launch campaigns.
```

## Risks
| Risk | Mitigation |
|---|---|
| CAC blows past ₹1,500 | Pause + diagnose Day 14 of M2; rebuild creative/audience |
| Lookalike audience too small | Need N≥9 paying customers; if M1 short, skip lookalike M2 |
| Click farms / low-quality clicks | Negative keywords + audience refinement |
| Lighthouse drop from analytics | Re-verify P16 + P17 after pixel-heavy adds |

## Connected files
- M2 Week-1 day-by-day plan (built from this template Day-30)
- `paid-ads` skill outputs land in `marketing-and-sales/launch-implement/m2/paid-ads/`
