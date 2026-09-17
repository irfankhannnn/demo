# Referral programme

Brokers trust brokers, so referral is likely to be the cheapest acquisition channel we have. It is also, today, entirely manual.

> **Nothing of the referral system is built (17 Sep 2026).** There is no `apps/crm/server/routes/referral.js`, no `src/pages/ReferFriend.tsx`, no referral code generation, no redemption route, no `REFERRAL` record and no reward ledger. `month-2-plus/M2-referral-program-scale.md` described these as "live"; that line has been corrected. Assume nothing exists.

> Open decision D29b — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md — the timing and mechanics of the referral programme are open. This page describes the manual-first path that needs no decision to start, and lays out the three reward schemes that disagree so the decision can be made from one page.

Merged from `archive/content-os/growth-platform/referrals/referral-engine.md` and `.../workflows.md`.

---

## 1. The manual programme (needs no code)

Runs from Day 30, per `week-4-optimize-convert/day-30-month-2-strategy.md`.

1. **Eligibility.** A paying customer who answered NPS with a 9 or 10. Both halves matter — asking a customer who has not had a win yet burns the relationship, and the June rule "never ask before value is delivered" is the one part of that design worth keeping verbatim.
2. **The ask.** The founder sends it personally, on WhatsApp, in the customer's own language. The wording lives with the channel playbooks in [`../30-channels/whatsapp/referral.md`](../30-channels/whatsapp/referral.md).
3. **The code.** A Razorpay coupon per referrer, created by hand in the Razorpay dashboard. One row in the sheet: referrer · code · issued date · redemptions.
4. **The reward.** Applied by hand when the referred customer pays — not on signup. Rewarding on signup is how referral programmes fill with junk.
5. **Tracking.** Two columns in the weekly sheet: codes issued, referred customers who paid.

Automate nothing until roughly ten referred signups have come through this path. Below that number, the code to run it costs more than the founder's time to run it.

## 2. Three reward schemes disagree — pick one at D29b

| Source | Referrer gets | Referred gets | Extras |
|---|---|---|---|
| **Day-30 spec** (`week-4-optimize-convert/day-30-month-2-strategy.md`) | ₹500 account credit per referred-paid, capped ₹2,500/month | 1 month free, via a Razorpay coupon | promoters only; separate `ReferralCodes` / `ReferralRedemptions` tables |
| **Month-2 plan** (`month-2-plus/M2-referral-program-scale.md`) | as the day-30 spec | as the day-30 spec | adds an affiliate tier: ₹2,000 plus 25% of MRR for six months |
| **June growth platform** (archived) | one free month of their plan, capped at a plan price that does not exist | 50% off plus a 30-day extended trial | partner badge; an automated engine inside the CRM table |

**Recommendation on the page, not a decision:** the day-30 spec. It is the most recent, it is costed against plans that actually exist, and it is the only one a solo founder can run by hand. The June scheme's cap refers to a ₹5,999 "Pro" plan that has never existed, and its "30-day extended trial" contradicts the 14-day trial in `pricing.json` and in `apps/crm/server/subscriptionService.js`.

Whatever is chosen, the reward amounts are a pricing matter: they are constrained by `marketing-and-sales/launch-plan-v2/pricing.json` today and by `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` once that proposal is approved. Do not write a rupee figure into any other file.

## 3. Anti-abuse, for whenever it is built

Carried over because it is the part that is expensive to retrofit:

- Reward on the referred customer's **first payment**, never on signup or on a click.
- Block self-referral: same phone, same payment instrument, same device.
- Phone verification on the referred account — which the product already requires, since signup is phone OTP.
- Review the first twenty redemptions by hand.
- Any reward is a ledger entry, never a direct balance edit, so it can be reversed on a refund.

## 4. Measuring it

Two rows in [`metric-dictionary.md`](./metric-dictionary.md): referred customers as a share of new paying customers, and referral as a source in the prospect vocabulary (§8, where `referral` scores the maximum 20 points on the SOURCE dimension — see [`prospect-lead-scoring.md`](./prospect-lead-scoring.md)).

No referral target is set for M1. With zero customers there is no one to refer anyone.

## 5. What a built version would need

Listed so the backlog entry is concrete, not so it gets built now:

1. `?ref=CODE` captured at signup alongside the UTM capture that already exists in `src/pages/PhoneLogin.tsx`.
2. Two tables — codes and redemptions — separate from the CRM table, as the day-30 spec proposes.
3. Reward issued on the referred tenant's first `subscription_paid`, as a Razorpay coupon or a credit grant through `creditService`.
4. A referral widget for paying users, and a public `/refer-friend/{code}` landing variant.

**Build trigger: about ten referred signups handled manually.** Recorded in [`design-only-backlog.md`](./design-only-backlog.md).
