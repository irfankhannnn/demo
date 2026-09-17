# WhatsApp — referral

Brokers trust brokers — word of mouth is the cheapest acquisition and the strongest trust signal in this market (`../../10-audience-and-voice/market-research.md` §2.2, §9.2). Turn happy customers and community members into a referral engine. Pairs with `customer-success.md` (who is ready) and `community.md` (the warm pool).

> ## This playbook is gated
>
> **Nothing in this file runs until there are paying, activated customers.** Pre-launch there is nobody to ask, and a referral programme aimed at people who have not used the product is just spam with a coupon attached.
>
> There is also **no referral system in the product** — no codes, no tracking, no reward issuance. A spec exists in the archived growth-platform design; see `../../50-measurement/referral-program.md` and `../../50-measurement/design-only-backlog.md`. Until it ships, any referral is a manual, personal ask and a manually issued reward.
>
> **The rewards below are placeholders.** What a referrer and a referee actually get depends on the offer, which is being re-planned (`../../pricing.json` is the only source for today's prices; the proposal is `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md`), and on the referral mechanics themselves.
>
> Open decision D29b — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

> **Timing rule:** never ask before value is delivered. Ask **after an activation win** — a deal they tell you about, week-1 milestones hit, or unprompted positive feedback. A well-timed ask to a delighted customer converts; a premature one burns goodwill.

---

## 1. When to ask (trigger map)

| Trigger | Source | Readiness |
|---|---|---|
| A deal they tell you they closed | `customer-success.md` | 🟢 best moment |
| Week-1 milestones (≥3 of 4) hit | activation | 🟢 strong |
| Unprompted praise | any WhatsApp reply | 🟢 strike now |
| Demoed but not yet bought | `demo-followup.md` | 🟡 "refer a peer" angle |
| Engaged community member | `community.md` | 🟡 warm |
| Event or founder-network contact | `../founder-presence.md` | 🟡 personal ask |

## 2. The reward mechanics

| Party | Reward | Issued on |
|---|---|---|
| **Referrer** (existing customer) | `{{referrer_reward}}` | referee converts to paid |
| **Referee** (new) | `{{referee_reward}}` | signs up through the referrer |
| **Top referrers** (3+ conversions) | "RealEstateFlow Partner" badge + early features | milestone |

Both tokens are unresolved on purpose. `pricing.json` contains no referral reward, and the archived growth-platform spec proposed something different again (a free month for the referrer, half off for the referee) from what the day-30 plan assumed. Do not print a reward in any message until the offer is decided.

Two mechanics we already know we want: **double-sided rewards out-perform one-sided**, and the referrer is rewarded **on conversion, not on send**, which keeps referral quality high. Until codes exist, track the referral by hand so `pipeline-manager` can attribute referral → paid.

## 3. Verbatim asks (Hinglish)

**Post-win ask (warmest):**
> "{{name}}, khushi hui aapko RealEstateFlow pasand aaya 🙌 Ek chhoti request — aapke jaan-pehchaan mein koi broker/agency jo abhi WhatsApp/Excel pe struggle kar rahi ho? Unhe **{{referee_reward}}** milega, aur aapko **{{referrer_reward}}**. Bas naam/number bhej do, baaki main sambhal lunga 🤝"

Send it only with the referee's consent to be contacted — do not cold-add someone's contacts.

**1-tap share message (you write it for them):**
> "Bhai yeh CRM try kar — RealEstateFlow. Leads, follow-up, WhatsApp pe AI Employee, commission khata — sab ek jagah. Main use kar raha hoon, kaam ka hai. Yeh raha link 👉 {{ref-link}}."

This is the referrer's own message, so it says what *they* found useful. Do not put a claim in their mouth.

**Demoed-but-not-bought (peer angle):**
> "{{name}}, abhi aap decide kar rahe ho — koi baat nahi 🙂 Par aapke network mein koi broker jisko yeh abhi chahiye? Refer karo toh unhe {{referee_reward}}, aur jab aap join karo toh aapko bhi {{referrer_reward}}. Win-win 😄"

**Marathi variant (parked — Pune is out of M1 scope, D24):**
> "{{name}}, tumhala RealEstateFlow avadla, chhan! 🙌 Tumchya olakhitil koni broker jo ajun Excel var aahe? Tyala {{referee_reward}} deto, ani tumhala {{referrer_reward}}. Fakt naav/number sanga 🤝"

## 4. Make sharing effortless
- **1-tap WhatsApp share** with pre-written message + ref-link (above).
- **Ref-code** they can drop in their own broker groups.
- **Shareable win-card** (their result as an image) → shareable pride → organic referrals. The result has to be theirs and they have to approve the card before it exists.
- Public thanks, **with written consent** → real proof → later asks land better.

## 5. Sources (warm pools, ranked)
1. Paying + activated customers (highest convert).
2. Community members (`community.md`, once the Wins group exists).
3. Demo'd-but-not-yet (refer a peer angle).
4. Event / meetup + founder network.
5. Broadcast list repliers (`founder-broadcast.md`).

## 6. Amplify loop

Referred wins → CT-CASE content, **only with written permission** → more inbound and more referrals. Spotlight top referrers in the community as a status reward. Tie the referral ask into the monthly success review so it becomes a ritual rather than a one-off.

## 7. Rules & compliance
Ask once per win; do not nag. Reward only on genuine conversion. The referee must opt in — never cold-add someone's contacts. Keep the ask personal and human, never a mass blast, and honour any "abhi nahi".

## 8. Metrics

Referrals sent, referral → demo, referral → paid, **referral as a share of new customers** (target 20%+, `../../40-sales-and-conversion/customer-journey.md`), a top-referrer leaderboard, reward redemption. Definitions in `../../50-measurement/metric-dictionary.md`; the programme design sits in `../../50-measurement/referral-program.md`. A low referral share means the ask is not happening — enforce the post-win trigger in `customer-success.md`.
