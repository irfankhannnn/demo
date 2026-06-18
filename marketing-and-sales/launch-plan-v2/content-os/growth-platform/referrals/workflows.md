# Referrals — Workflows (automations)

Five referral automations on the **real engine**: `automationEngine.js` (rules `event→action[]`), `referralService.js`, `rewardService.js`, `sequenceService.js` + `notificationDynamodbService.js` (`SCHEDULED_NOTIFICATION` timer), `crmDynamodbService.js`. Every automation = trigger → conditions → actions → notifications → metrics → outcome. All idempotent, multi-tenant (`TENANT#`), consent-gated. Verbatim Hinglish copy lives in `distribution-os/whatsapp/referral.md §3`; entities in `data-model.md`.

```
MKT_EVENT (activation/NPS) ─► automationEngine ─► referralService.issueCode ─► REFERRAL_CODE + REFERRAL(issued)
        │                                                        │
   /r/{code} hit ─► click track                                 ▼
        │                                          notificationDynamodbService (WA + in-app ask)
   signup ?ref= ─► attribution ─► REFERRAL(signed_up) + LEAD.referredBy
        │
   paid event ─► rewardService.issue(both) ─► REWARD_LEDGER ×2 ─► invoice credit + notify
        │
   nudge timer (SCHEDULED_NOTIFICATION) ─► sequenceWorker ─► reminder if not shared/converted
```

---

## RW-1 — Ask-trigger (issue code on activation/NPS)

| | |
|---|---|
| **Trigger** | `MKT_EVENT` ∈ {`customer_activated`, `milestone_hit`, NPS≥9, positive-reply keyword} |
| **Conditions** | `activationScore ≥ 70 OR healthScore ≥ 70`; not asked in last 30d; `consent.whatsapp` for WA channel; referrer on a paying state for referrer-reward eligibility |
| **Actions** | `referralService.issueCode(referrerId)` → write `REFERRAL_CODE` (active, +90d) + `REFERRAL(status=issued, journey=happy)`; build `/r/{code}` + pre-written share message |
| **Notifications** | In-app "Refer & earn 1 free month" card (`notificationDynamodbService`); WA ask (template, consent-gated) with 1-tap share |
| **Metrics** | ask-fire rate (asks/activation wins, target ≥80%), codes issued, `referral_sent` count |
| **Outcome** | Referrer holds a shareable, attributable code; `referral_sent` MKT_EVENT logged. Idempotent: one active code per (referrer, campaign). |

## RW-2 — Code generation & click attribution

| | |
|---|---|
| **Trigger** | `/r/{code}` redirect endpoint hit (or code entered) |
| **Conditions** | code resolves to `active` REFERRAL_CODE, not expired, under `maxUses` |
| **Actions** | atomic `ADD clicks 1`; set REFERRAL `status=clicked`,`clickedAt`; drop cookie/param `ref={code}` for signup capture; emit `referral_clicked` |
| **Notifications** | none (silent) |
| **Metrics** | clicks, click→signup rate |
| **Outcome** | Click attributed; redirect to signup with `?ref={code}`. Dedupe by `{code}:{sessionId}` so refreshes don't double-count. |

## RW-3 — Referee attribution on signup

| | |
|---|---|
| **Trigger** | account signup carrying `?ref={code}` (or code field) |
| **Conditions** | code valid; anti-abuse pass (not self-referral: `referee.dedupeHash ≠ referrer's`, distinct device/instrument) |
| **Actions** | upsert LEAD with `referredBy=referrerId` (**immutable** `if_not_exists`), `referralCode`, `leadSource=referral`; create `REFERRAL(status=signed_up)`; grant referee **30-day extended trial + free setup** flag; `ADD signups 1`; emit `referral_signup` |
| **Notifications** | Referee welcome (extended-trial framing); referrer in-app "{name} joined via your link 🎉" |
| **Metrics** | referral→signup rate, signups by referrer (leaderboard), abuse-flag rate |
| **Outcome** | Referee attributed for life (first-touch lock); referrer sees progress. Abuse → REFERRAL `void`, no trial perk. |

## RW-4 — Reward issuance on conversion

| | |
|---|---|
| **Trigger** | `MKT_EVENT type=paid` for a lead/customer with `referredBy` set |
| **Conditions** | payment cleared (real invoice, not trial); referee past 7-day **clawback/min-tenure** window NOT yet required for *issue* but reward `status=pending` until window passes; velocity cap not exceeded |
| **Actions** | `rewardService.issue(referralId)` → 2 `REWARD_LEDGER` entries (referrer: free-month credit = plan MRR capped ₹5,999; referee: 50%-off first month); set REFERRAL `status=converted→rewarded`; `ADD conversions 1`; if `conversions≥3` set Partner badge; emit `referral_converted`+`referral_rewarded` |
| **Notifications** | Referrer WA+in-app "Aapko 1 free month mil gaya 🙌 next invoice pe credit"; referee discount confirmation |
| **Metrics** | referral→paid (target ≥15%), referral % of new customers (≥20%), reward redemption, viral coefficient K, reward liability ₹ |
| **Outcome** | Both sides rewarded, conversion-gated, idempotent (reward keyed on `referralId`). Clawback if referee refunds in window → compensating ledger entry. |

## RW-5 — Nudge sequence (un-shared / un-converted)

| | |
|---|---|
| **Trigger** | `referralService.enroll(referrer, seq=referral_nudge)` after RW-1 |
| **Conditions** | code `issued` but `clicks=0` after 3d (share nudge) OR `clicked/signed_up` but no `converted` after 14d (referee-warm nudge); respect "abhi nahi", max 2 nudges, 30-day ask cap |
| **Actions** | writes `SEQUENCE_ENROLLMENT` + `SCHEDULED_NOTIFICATION(nextAt)`; sequenceWorker (GSI5 due-scan) sends step; cancel on click/convert/opt-out |
| **Notifications** | Step 1 (T+3d): "share reminder + win-card"; Step 2 (T+14d): demo'd-not-bought peer angle |
| **Metrics** | nudge→click lift, nudge→conversion lift, opt-out rate |
| **Outcome** | Dormant codes reactivated without nagging; `stepToken` idempotency prevents double-send under SQS at-least-once. |

---

## Shared guarantees

- **Idempotency:** all writes conditional (`attribute_not_exists` / `if_not_exists`); reward keyed on `referralId`; MKT_EVENT `dedupeKey=referral:{id}:{status}`.
- **Consent:** no WA/email send without stored `consent`; opt-out honored ≤1 cycle (reuses sequence cancel).
- **Multi-tenant:** every key `TENANT#`-prefixed; no cross-tenant path.
- **Anti-abuse:** RW-3/RW-4 enforce `referral-engine.md §3` checks; flags → CS review queue.
- **Observability:** CloudWatch metrics on each automation (fires, sends, DLQ depth, reward issuance) per `technical-design.md §7`.

Cross-refs: `referral-engine.md` (lifecycle/rewards/triggers), `data-model.md` (entities/GSIs), `backlog.md` (EP-6 INT/BE tasks), `automations/` (engine), `activation/` + `customer-scoring/` (score inputs to RW-1).
