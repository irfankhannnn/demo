# M2 — Referral Program Scale + Affiliate Tier

> **Type:** 🤖 + 🧍
> **Phase:** Month 2-3
> **Skill(s):** `referral-program` + `revops` + `email-sequence` + `paywall-upgrade-cro`
> **Pre-requisites:** Day-30 referral program live + at least 8-10 NPS Promoters

## Objective
Scale the Day-30 referral program from "9 Promoters get codes" to a structured dual-incentive engine: ₹500 referrer credit + 1-month referred-free, plus an affiliate tier for top-2 referrers (₹2,000 credit + 25% recurring commission for 6 months). Target: 10+ referred-paid customers M2.

## Why this matters
Referrals = lowest CAC channel + highest LTV. M2 invests in making referral the dominant growth lever (not just paid + outbound). For Mumbai broker network, referrals carry more trust than ads.

## Plan

### M2 Week 1 — Programme polish
- Review Day-30 referral mechanics + redemption tracking
- Fix any issues observed in first 7 redemptions
- Add referral dashboard widget in user CRM (paying users see their code + redemptions + credit balance)
- Email Promoters who haven't shared their code yet (gentle nudge)

### M2 Week 2 — Affiliate tier
- Identify top-2 referrers (most active sharers from Day 30+ data)
- Convert them to "Affiliate Partners" with: ₹2,000 credit per signup + 25% MRR commission for 6 months on each referred customer
- Affiliate agreement: simple 1-page contract (DPDP-compliant); founder signs
- Build affiliate dashboard: their code, their redemptions, their commission accrual, payout schedule

### M2 Week 3 — Promotion engine
- LinkedIn Post 10 about referral mechanics: "How 8 Mumbai brokers brought 5 more to RealEstateFlow"
- WhatsApp shareable card: testimonial + referral code + clean CTA
- In-product "Refer a friend" prompt: shows after user adds 5+ records (engaged users) + after 30-day mark (committed users)

### M2 Week 4 — Optimisation
- Track redemption rate per Promoter
- Top-3 redeemers get a "thank you" call + extra credit (₹500 bonus for 3+ redemptions)
- Document patterns: what types of code-share content converted best

## Success metrics

| Metric | M2 Target |
|---|---|
| Referral signups (any plan trial) | ≥30 |
| Referral signups → paid | ≥10 |
| Affiliate Partners onboarded | 2-3 |
| Total referral-driven MRR | ₹15-30k |
| Effective CAC via referrals | ≤₹500 |
| Referrer NPS lift (do referrers love us more?) | +5 points |

## Required AI prompts

```
Use `referral-program` skill. Read:
- `marketing-and-sales/launch-implement/week-4/day-30-referral-program-spec.md`
- Day-28 NPS data + Promoter list
- M1 paying customer cohort

Produce:
1. M2 referral programme refinements (fix Day-30 issues, add affiliate tier)
2. Affiliate Partner agreement template (DPDP-compliant)
3. In-product "Refer a friend" UX spec (after activation milestone)
4. Email + WhatsApp + LinkedIn share templates (3 each, voice + persona variants)
5. Referrer dashboard wireframes
6. Affiliate dashboard wireframes
7. Tracking + payout SOP

Stop.
```

## Risks
| Risk | Mitigation |
|---|---|
| Referral fraud (same broker creates multiple accounts) | Phone verification + admin review for first 20 |
| Affiliate complexity for solo founder | Simple monthly payout via Razorpay; spreadsheet tracker |
| Cannibalisation of paid ads | Referral CAC should be lower → reallocate spend if so |
| Affiliate over-commits + can't deliver | Cap to 2-3 affiliates M2 |

## Connected files
- Referral mechanics live: `agency-app/api/routes/referral.js`, `agency-app/web/src/pages/ReferFriend.tsx`
- Day-30 spec at `launch-plan-v2/week-4-optimize-convert/day-30-month-2-strategy.md`
