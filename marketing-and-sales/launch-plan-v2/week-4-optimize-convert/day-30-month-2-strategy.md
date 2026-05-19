# Day 30 — Lock Month-2 Strategy + Referral Program Activation

> **Type:** 🧍 + 🤖
> **Phase:** Week 4
> **Skill(s):** `growth-intel` + `referral-program` + `launch-strategy`
> **Estimated time:** 4h founder + 4h AI

## Objective
Synthesize Day-29 audit + Day-27 messaging-v2 into a written Month-2 strategy doc, activate the referral program for NPS Promoters, write Founder LinkedIn Post 8 (M1 retrospective), and ship an automated playbook for Month-2 Week 1.

## Why This Matters for RealEstateFlow
Day 30 is the inflection point. M2 either compounds M1 momentum or stalls. A clear written plan + activated referral + retrospective post sets the next 30 days up to outperform.

## User Story
As founder finishing M1, I want a Month-2 strategy doc + referral program live + retrospective post published + first M2 Week 1 actions queued, so M2 starts running on Day 31 morning.

## Acceptance Criteria
- [ ] M2 strategy doc at `marketing-and-sales/launch-implement/week-4/day-30-month-2-strategy.md` (executive summary + 4-week plan + budget + targets)
- [ ] Referral program live: dual-sided incentive (referrer gets ₹500 credit / referred gets 1-month free), code generation per Promoter, tracking
- [ ] Referral landing page at `realestateflow.in/refer-friend/{code}` (or token query param)
- [ ] Email + WhatsApp blast to all 9-10 NPS Promoters with their unique referral code
- [ ] LinkedIn Post 8 published: "30 days, 8 Mumbai brokers, [N] paying customers — what we learned"
- [ ] M2 Week-1 day-by-day plan drafted at `marketing-and-sales/launch-implement/week-4/day-30-m2-week-1-plan.md`
- [ ] M2 budget approved: paid spend? hire? marketing tools? — written + signed
- [ ] All M2-Onwards files queued (see `month-2-plus/` folder)
- [ ] Decision logged: "M1 closed Day 30. M2 starts Day 31 with: {{strategy summary}}"
- [ ] Founder takes Day 31-32 as light recovery (no major launches)
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Read Day-29 audit + Day-27 wedge-v2 + Day-28 NPS** (1 hour).
2. **Run AI Prompt #1** to draft M2 strategy.
3. **Run AI Prompt #2** to design referral program.
4. **Run AI Prompt #3** to draft LinkedIn Post 8.
5. **Manual review** + edit (founder voice).
6. **Build referral**:
   - Backend: routes for code creation + redemption + credit issuance
   - Frontend: refer-friend page + dashboard widget for paying users
7. **Send Promoter emails** + WhatsApps with codes.
8. **Publish LinkedIn Post 8** (11am IST optimal).
9. **Cross-share** to broker WhatsApp groups + Indian SaaS Slack.
10. **Take Day 31-32 light** — recovery + maintenance only.
11. **Daily standup** + tick ACs + log decision.

## AI Prompt #1 (🤖) — Month-2 strategy

```
Read inputs:
- `marketing-and-sales/launch-implement/week-4/day-29-month-1-audit.md` (M1 results + 5 recs)
- `marketing-and-sales/launch-implement/week-4/day-27-wedge-v2.md` (refined messaging)
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md` (M2-M3 north stars)
- `marketing-and-sales/launch-plan-v2/cross-cutting/risks-mitigations.md`
- `marketing-and-sales/research/icp-report-mumbai-launch.md`

Produce `marketing-and-sales/launch-implement/week-4/day-30-month-2-strategy.md`:

# RealEstateFlow Month-2 Strategy

## Executive summary (1 paragraph)
Where we are + where we're going + how + budget + risks.

## M2 north star
- Paid customers target: M1 + N more (e.g., 8 → 25)
- MRR target
- NPS target (lift M1 baseline by Y points)
- Retention target

## M2 themes
1. Compound M1 wins (LP CRO + cold sequence v2 + LinkedIn presence)
2. First paid acquisition (₹50k Meta retargeting + ₹50k Google search ads)
3. Referral activation (NPS Promoters → 5 new paying)
4. Pune ramp prep (research + content localisation)
5. AI Employee growth (focus on add-on conversion of existing Solo/Team users)

## M2 budget
- Paid ads: ₹50k Meta + ₹50k Google (split per channel ROI from M1 — adjust if Day-21 said something specific)
- New hires: 1 part-time SDR / contractor (₹40k/mo for cold sequence ops)
- Tools: ahrefs ₹2.5k/mo + Loom Pro ₹500/mo (only if needed)
- Total M2: ~₹150-200k

## 4-week M2 plan
Week 5: deploy wedge-v2 LPs + cold sequence v2 + referral live
Week 6: launch first paid Meta retargeting + 1 SEO blog
Week 7: launch first paid Google search ads + Pune research
Week 8: M2 retrospective + M3 strategy

## Founders weekly cadence
- Mon: cold outreach 50/day + LinkedIn + standup
- Tue: demos + customer support
- Wed: shipping (CRO + features) + content
- Thu: cold outreach + research
- Fri: weekly review + plan next week
- Sat: low-key (community + content)
- Sun: off

## Risks for M2
- Top 3 from Day-29 risks register

## Success metric tracking
- Daily-log/dayNN.md continues
- Weekly Growth Brief every Monday
- Monthly close on Day 60

Stop.
```

## AI Prompt #2 (🤖) — Referral program

```
Read inputs:
- `marketing-and-sales/launch-implement/week-4/day-28-nps-email.md` (NPS data — Promoter list)
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (pricing context)
- `marketing-and-sales/launch-implement/pre-launch/14-paywall/...` (subscription mechanics)

Produce:

## 1. `marketing-and-sales/launch-implement/week-4/day-30-referral-program-spec.md`

### Mechanics
- Eligibility: paying customer (any plan) + NPS Promoter (9-10) auto-enrolled
- Referrer reward: ₹500 account credit per referred-paid (max ₹2,500/mo)
- Referred reward: 1 month free on any plan (Solo/Team/Team+) — applied via coupon
- Anti-fraud: same payment method blocked; phone verification required
- Tracking: unique code per referrer (e.g., `MUMBAIBHARAT2026`)

### Backend
- Route: POST /api/refer/create-code (creates per-user)
- Route: POST /api/refer/redeem (validates + applies)
- DDB: ReferralCodes (referrer_user_id, code, created_at, expires_at), ReferralRedemptions (code, redeemed_user_id, status: pending/paid, credited_at)
- On signup with `?ref=CODE`: tag user with referral_code; on first paid: trigger reward to both
- Razorpay coupon LAUNCH-REF-XYZ generated per code

### Frontend
- Component: `real-estate-crm-app/src/pages/ReferFriend.tsx` (paying user dashboard widget)
- Public landing: `realestateflow.in/refer-friend/{code}` (LP variant with referrer attribution)
- Email/WhatsApp share buttons + pre-filled message

### Promoter outreach
- Email blast to NPS Promoters: "You scored us 9/10 — share your love + earn ₹500 per friend"
- Body: 80 words. Coupon code prominently displayed. CTA "Share with broker friends"
- WhatsApp variant + voice (60s) for high-promoter Promoters

## 2. `marketing-and-sales/launch-implement/week-4/day-30-referral-tracker.csv`
Initial template: referrer, code, sent_at, redeems_count, total_credit_issued

## 3. `marketing-and-sales/launch-implement/week-4/day-30-promoter-outreach.md`
Personalised messages per Promoter (9-10 scorers from Day-28 NPS).

Stop.
```

## AI Prompt #3 (🤖) — LinkedIn Post 8

```
Read:
- `marketing-and-sales/launch-implement/week-4/day-29-month-1-audit.md`
- `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-pre-launch-posts.md` (Posts 1-5 voice)
- All testimonial quotes

Produce `marketing-and-sales/launch-implement/week-4/day-30-linkedin-post-8.md`:

# Post 8 — "30 days, 8 Mumbai brokers, [N] paying customers — what we learned"

≤300 words. Format:
- Hook (curiosity + numbers)
- 5 specific lessons in 1-line bullets each
- 1 founder lesson personally (vulnerability + insight)
- 1 testimonial quote (verbatim)
- "Month 2 starts tomorrow with {{summary}}" CTA
- Soft close

Cross-postable as Twitter thread (8-tweet variant).

Stop.
```

## Inputs
- Day-29 audit
- Day-27 wedge-v2
- NPS Promoter list

## Outputs
- M2 strategy doc
- Referral program live (backend + frontend + landing)
- Promoter outreach emails sent
- LinkedIn Post 8 published
- M2 Week-1 plan
- Decision log entry

## Success Criterion
M2 strategy doc signed; referral live + 9+ Promoters notified; Post 8 published; M2 Week-1 plan ready Day 31.

## Fallback / Plan B
If referral system not built in 1 day, ship manual referral (founder issues credits via admin) + queue automated referral M2 Week 1. Don't delay Day 30 publish.

## Risks
| Risk | Mitigation |
|---|---|
| Referral fraud | Anti-fraud logic + manual review for first 10 |
| Founder skips recovery Day 31-32 | Document mood; defer non-essential |
| LinkedIn Post 8 underperforms | Cross-share to all channels |
| M2 budget overspend | Pre-defined caps + weekly review |

## India / Mumbai-Specific Notes
- ₹500 referral feels meaningful in Indian SaaS (vs $50 in US)
- WhatsApp share = primary referral medium for Mumbai brokers
- Founder retrospective post = trust signal for M2 prospects

## Dependencies
- **Blocks:** M2 onwards
- **Depends on:** Day-29 audit, Day-28 NPS, Day-27 messaging-v2

## Connected Skills
- `growth-intel` — strategy
- `referral-program` — design + ship
- `launch-strategy` — Post 8 + cross-promo
- `marketing-psychology` — incentive design
