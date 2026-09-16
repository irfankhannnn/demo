# Phase 6 — Referral Engine (broker-refers-broker)

Productizes the human referral playbook in `distribution-os/whatsapp/referral.md` into an in-product acquisition system. **Brokers trust brokers** — referral is the cheapest CAC and the #1 trust signal in this market. This file owns the *system*; the WhatsApp playbook owns the *human asks (verbatim Hinglish)*. Grounded in the real stack: `REFERRAL` + `REFERRAL_CODE` + `REWARD_LEDGER` entities on the DynamoDB single-table (`TENANT#`, `crmDynamodbService.js`), reward issuance via `notificationDynamodbService.js` (`SCHEDULED_NOTIFICATION`), ask-triggers off `MKT_EVENT` + the customer/activation score.

> **Timing rule (inherited, enforced in code):** never ask before value is delivered. The ask-trigger fires only on an activation win or a high health/activation score — see §4. A premature ask burns goodwill; a well-timed one converts.

Cross-refs: data model → `data-model.md` · automations → `workflows.md` · backlog → `backlog.md` (EP-6) · entity rationale → `implementation/technical-design.md §2.5` · scoring trigger → `activation/milestones-and-score.md`, `customer-scoring/` · canonical pricing → `workspaces/realestateflow/01-business-memory.md §5`.

---

## 1. Referral lifecycle (state machine)

```
   ASK-TRIGGER (score/event)              referrer shares code/link
        │                                         │
        ▼                                         ▼
   [issued] ──── share (1-tap WA) ────► [clicked] ──── referee signup ───► [signed_up]
        │                                                                      │
        │ expires (90d, no click) ──► [expired]                    referee books demo
        │                                                                      ▼
        │                                                                 [demo'd]
        │                                                                      │
        └── abuse flag ──► [void]                          referee converts to PAID plan
                                                                               ▼
                                                                        [converted]
                                                                               │
                                              reward issued to BOTH parties    ▼
                                                                        [rewarded]
```

| State | Set by | MKT_EVENT emitted | Reward |
|---|---|---|---|
| `issued` | ask-trigger → `referralService.issueCode` | `referral_sent` | — |
| `clicked` | landing/redirect `/r/{code}` hit | `referral_clicked` | — |
| `signed_up` | referee creates account w/ `referredBy` | `referral_signup` | — |
| `demod` | referee `demo_completed` | — | — |
| `converted` | referee → paid plan | `referral_converted` | unlocks rewards |
| `rewarded` | `rewardService` issues both ledger entries | `referral_rewarded` | referrer + referee |
| `expired` / `void` | TTL sweep / anti-abuse | `referral_voided` | none |

**Rule:** reward the referrer on **referee conversion to paid**, never on send/signup — keeps lead quality high (double-sided, conversion-gated). Tie every state transition to a `REFERRAL.status` write + `MKT_EVENT` so the funnel is measurable.

---

## 2. Reward structure (tied to real pricing — `01-business-memory §5`)

Pricing: Free ₹0 · Starter ₹999 · Growth ₹2,999 · Pro ₹5,999 · Enterprise custom.

| Party | Reward | Issued on | Implementation |
|---|---|---|---|
| **Referrer** (paying customer) | **1 free month** of their current plan (credit = plan MRR, capped ₹5,999) | referee → paid | `REWARD_LEDGER` credit, applied to next invoice |
| **Referrer** (alt for Free/Starter) | **Plan credit ₹999** (upgrade fuel toward Growth) | referee → paid | ledger credit |
| **Referee** (new signup) | **Free setup + 30-day extended trial** (vs default 14d) of Growth-tier features | signup via code | trial flag on account, `consent`-gated |
| **Referee** (on convert) | **First month 50% off** any paid plan | referee → paid | one-time discount code |
| **Top referrer** (≥3 conversions) | **"RealEstateFlow Partner" badge** + 3 months Pro free + early features | milestone | badge attr + ledger |

Reward economics: 1 referred Growth customer (₹2,999/mo) costs ~₹2,999 (one free month) → effective CAC well below paid (Meta CPL ₹150–400 × low trial→paid). Cap total referrer credit at **₹17,997 (6 months)** per rolling year to bound liability. All rewards are `REWARD_LEDGER` entries (idempotent, auditable) — never direct balance mutations.

---

## 3. Anti-abuse rules (enforced server-side)

| Rule | Check | Action |
|---|---|---|
| **Self-referral** | `referee.phone/email/deviceHash == referrer's` OR same `dedupeHash` | void, no reward |
| **Same payment instrument** | referee card fingerprint == referrer's | hold reward, manual review |
| **Velocity cap** | referrer issues > 10 active codes OR > 5 conversions/30d | throttle + flag |
| **Reward only on genuine paid** | conversion = real paid invoice cleared, not trial | gate reward on `paid` event w/ payment confirmation |
| **Reattribution lock** | `referredBy` is **first-touch, immutable** (`if_not_exists`) | last-click can't overwrite |
| **Min-tenure** | referee must stay paid ≥ 7 days before reward releases | delayed issuance (clawback window) |
| **Consent** | referee must opt in; no cold-adding contacts (inherits WA rule) | block if no `consent` |
| **Code uniqueness** | one active code per (referrer, campaign) | dedupe on issue |

Clawback: if referee refunds/churns inside the clawback window (7d), reverse the `REWARD_LEDGER` entry (compensating entry, never delete). All flags write `signals` for explainability and surface to the CS/Admin review queue.

---

## 4. The referral-score ask-trigger (who/when to ask)

The ask is automated off scores + events — not manual. Pulls readiness from `activation/milestones-and-score.md` (activationScore) and `customer-scoring/` (healthScore).

| Trigger | Source signal | Readiness | Channel |
|---|---|---|---|
| Deal closed via app | `customer_activated` + khata/deal event | 🟢 best | WhatsApp (consent) + in-app |
| Week-1 milestones ≥3/4 | `activationScore ≥ 70` | 🟢 strong | in-app card + WA |
| Unprompted praise / 👍 | NPS ≥ 9 or positive WA reply (keyword) | 🟢 strike now | WA personal |
| Healthy customer | `healthScore ≥ 70`, 28-day active | 🟢 | monthly review ritual |
| Demo'd-not-bought | `demo_completed` + no paid in 7d | 🟡 "refer a peer" angle | WA |
| Community member | community Wins-group engagement | 🟡 warm | community spotlight |

**Trigger logic:** `automationEngine` listens for `customer_activated` / `milestone_hit` / NPS events → checks `activationScore≥70 || healthScore≥70` → checks not-asked-in-30d → issues code + sends the matching Hinglish ask (verbatim copy lives in `whatsapp/referral.md §3`). Ask **once per win**, honor "abhi nahi", max 1 ask / 30 days / customer. Metric: % of activation wins that fire an ask (target ≥ 80%) — low = the trigger isn't firing.

---

## 5. Customer journeys (productized)

**A. Happy/activated customer (highest convert)**
```
activation win → ask-trigger → in-app "Refer & earn 1 free month" card + WA ask
  → 1-tap share (pre-written msg + /r/{code}) → referee signs up (extended trial)
  → referee activates → converts to paid → BOTH rewarded → referrer sees credit on invoice
  → referrer prompted again at next win (ritual, not nag)
```

**B. Community member (warm pool)**
```
community Wins engagement → personal ask in group/DM → drops ref-code in own broker groups
  → multiple signups attributed to one code → leaderboard status → Partner badge at 3 conversions
```

**C. Demo'd-but-not-bought (peer angle)**
```
demo_completed, no paid 7d → "you're deciding — refer a peer who needs this now" ask
  → referee converts → original prospect earns reward → reward becomes a re-engagement hook
  (refer-first often warms the original prospect back into their own purchase)
```

Each journey is one or more automations in `workflows.md`; each step emits an `MKT_EVENT` for funnel rollup.

---

## 6. Reporting & metrics (→ `analytics/` metric dictionary)

| Metric | Formula | Source | Target |
|---|---|---|---|
| Referrals sent | count `referral_sent` | MKT_EVENT GSI4 | trend ↑ |
| Referral→signup | `referral_signup / referral_sent` | REFERRAL status | ≥ 30% |
| Referral→paid | `referral_converted / referral_sent` | REFERRAL status | ≥ 15% |
| **Referral % of new customers** | referred paid / all new paid | LEAD.referredBy | **≥ 20%** |
| **Viral coefficient (K)** | invites/customer × signup-rate × paid-rate | derived | track toward >0.3 |
| Reward redemption rate | rewarded / converted | REWARD_LEDGER | ~100% |
| Reward liability (₹) | Σ open ledger credits | REWARD_LEDGER | within cap |
| Top-referrer leaderboard | conversions by `referrerId` | GSI-Referrer | status reward |
| Ask-fire rate | asks sent / activation wins | automation logs | ≥ 80% |

Low referral % ⇒ the ask isn't happening ⇒ enforce/inspect the §4 trigger. K rising ⇒ compounding low-CAC growth. Every metric maps to a GSI access pattern in `data-model.md` and a dashboard tile in `campaigns/campaign-system.md` (organic) / `analytics/`.

---

## 7. Amplify loop (referral → content → more referral)

Referred wins → (with consent) `CT-CASE` / `CT-PROOF` content (`OPP-*`) → more inbound + social proof → more asks land. Spotlight top referrers in community (status reward, costs nothing). Tie the ask into the **monthly success review** so it's a ritual, not a one-off. This closes the gap-analysis loop: reel (`OPP-*`) → … → paid → **referral → expansion**.
