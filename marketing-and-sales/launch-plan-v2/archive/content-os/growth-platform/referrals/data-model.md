# Referrals — Data Model

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/referral-program.md`.

DynamoDB **single-table** (existing `CRM_TABLE_NAME`), `PK`/`SK`, `EntityType`, `TENANT#{tenantId}` prefix — consistent with `crmDynamodbService.js` / `notificationDynamodbService.js`. **Additive only.** This file extends the `REFERRAL` sketch in `implementation/technical-design.md §2.5` / `database-requirements.md §2` with the full **REFERRAL + REFERRAL_CODE + REWARD_LEDGER** triplet, GSIs, access patterns, Lead attribution linkage, and idempotency. New GSIs continue the existing numbering (existing `GSI1–3`; growth-platform `GSI4–8` already claimed) → referrals use **GSI8 (status)** + **GSI9 (by referrer)**.

---

## 1. Entities

### 1.1 REFERRAL (one per referral instance)
```
PK         = TENANT#{tenantId}#REF#{referralId}
SK         = REF#{referralId}
EntityType = REFERRAL
GSI8 (status):   GSI8PK = TENANT#{t}#REFSTATUS#{status}   GSI8SK = {createdAt}
GSI9 (referrer): GSI9PK = TENANT#{t}#REFERRER#{referrerId} GSI9SK = {createdAt}
```
| Attr | Type | Notes |
|---|---|---|
| `referralId` | S (uuid) | |
| `code` | S | FK → `REFERRAL_CODE.code` (the code used to create this instance) |
| `referrerId` | S | customerId who shares (the rewarded party) |
| `refereeLeadId` | S? | `LEAD#{id}` set on signup attribution |
| `refereeCustomerId` | S? | set on referee conversion |
| `status` | S enum | `issued \| clicked \| signed_up \| demod \| converted \| rewarded \| expired \| void` |
| `channel` | S enum | `whatsapp \| in_app \| community \| link \| founder` |
| `journey` | S enum | `happy \| community \| demod_not_bought` (§5 of engine) |
| `clickedAt`/`signedUpAt`/`convertedAt`/`rewardedAt` | S ISO? | timeline stamps |
| `abuseFlags` | SS? | e.g. `self_referral`, `velocity`, `same_instrument` |
| `signals` | M | explainability (score at ask, trigger, anti-abuse checks) |
| `createdAt`/`updatedAt` | S ISO | |
| `ttl` | N? | epoch sec — set only on `expired`/`void` for cost cleanup |

### 1.2 REFERRAL_CODE (one per shareable code; a code can yield many REFERRALs)
```
PK         = TENANT#{tenantId}#REFCODE#{code}
SK         = REFCODE#{code}
EntityType = REFERRAL_CODE
GSI9 (referrer): GSI9PK = TENANT#{t}#REFERRER#{referrerId}  GSI9SK = CODE#{createdAt}
```
| Attr | Type | Notes |
|---|---|---|
| `code` | S | short, human-shareable (e.g. `RAHUL4F2K`), unique per tenant |
| `referrerId` | S | owner |
| `status` | S enum | `active \| disabled` |
| `campaignId` | S? | FK → `CAMPAIGN#{id}` (e.g. a launch referral push) |
| `clicks` | N | counter (atomic ADD) |
| `signups` | N | counter |
| `conversions` | N | counter (drives leaderboard + Partner badge ≥3) |
| `maxUses` | N? | optional cap (anti-abuse) |
| `expiresAt` | S ISO? | default +90d from issue |
| `createdAt` | S ISO | |

**Code generation:** `referralService.issueCode(referrerId)` → `base32(firstName) + random4` → `PutItem` with `ConditionExpression: attribute_not_exists(PK)`; on collision, regenerate (bounded retries). One active code per (referrer, campaign).

### 1.3 REWARD_LEDGER (append-only; both sides + clawbacks)
```
PK         = TENANT#{tenantId}#REWARD#{beneficiaryId}
SK         = REWARD#{createdAt}#{rewardId}
EntityType = REWARD_LEDGER
GSI8 (status): GSI8PK = TENANT#{t}#REWARDSTATUS#{status}  GSI8SK = {createdAt}
```
| Attr | Type | Notes |
|---|---|---|
| `rewardId` | S (uuid) | |
| `beneficiaryId` | S | customerId receiving the reward |
| `referralId` | S | FK → REFERRAL |
| `side` | S enum | `referrer \| referee` |
| `type` | S enum | `free_month \| plan_credit \| trial_extension \| discount \| badge` |
| `amount` | N | ₹ (credit) or days (trial) — units in `unit` |
| `unit` | S | `INR \| days \| months \| flag` |
| `currency` | S | `INR` |
| `status` | S enum | `pending \| issued \| applied \| clawed_back` |
| `clawbackOf` | S? | rewardId this entry reverses (compensating entry) |
| `appliedInvoiceId` | S? | when credit lands on an invoice |
| `createdAt` | S ISO | |

Append-only: corrections are new `clawed_back` entries, never mutations. Balance = Σ(`applied`+`issued`) − Σ(`clawed_back`). Reward liability report sums `pending`+`issued`.

---

## 2. Lead attribution linkage (`referredBy`)

Extends the LEAD attribute set (`database-requirements.md §1`) — additive:
| Attr | Type | Notes |
|---|---|---|
| `referredBy` | S? | `referrerId` — **first-touch, immutable** (`SET if_not_exists(referredBy,:r)`) |
| `referralCode` | S? | the code used at signup |
| `leadSource` | S | set to `referral` when code present (taxonomy already includes `referral`) |

On referee signup with `?ref={code}`: resolve `REFERRAL_CODE` → create/upsert Lead with `referredBy`, `referralCode`, `leadSource=referral` → create `REFERRAL` (`status=signed_up`) → emit `referral_signup` MKT_EVENT. This makes **referral % of new customers** a single `referredBy IS NOT NULL` rollup over paid leads.

---

## 3. GSIs & access patterns

| GSI | PK | SK | Access pattern |
|---|---|---|---|
| **GSI8 — RefStatus** | `TENANT#{t}#REFSTATUS#{status}` | `{createdAt}` | Referral pipeline by status (issued→converted); reward queue by status |
| **GSI9 — Referrer** | `TENANT#{t}#REFERRER#{referrerId}` | `{createdAt}` | All referrals + codes by referrer; leaderboard tally; Partner-badge check |
| (reuse) **GSI4 — EventType** | `TENANT#{t}#TYPE#{type}` | `{occurredAt}` | Referral funnel counts (`referral_sent/_signup/_converted`) |

| # | Pattern | Index / key |
|---|---|---|
| 1 | Get referral by id | Base `PK=TENANT#{t}#REF#{id}` |
| 2 | Resolve code → referrer | Base `PK=TENANT#{t}#REFCODE#{code}` |
| 3 | Referrals by status (pipeline) | GSI8 `REFSTATUS#{status}` |
| 4 | All referrals/codes by referrer (leaderboard) | GSI9 `REFERRER#{id}` |
| 5 | Reward ledger for a beneficiary | Base `PK=TENANT#{t}#REWARD#{id}`, SK range |
| 6 | Pending rewards to issue | GSI8 `REWARDSTATUS#pending` |
| 7 | Referral funnel counts (date range) | GSI4 by `type` |
| 8 | Leads referred by X (attribution) | scan/filter `referredBy` or GSI6 `SOURCE#referral` |

GSI8/GSI9 are **sparse** — keys dropped on `expired`/`void`/terminal states (same REMOVE technique as unread-notifications). Counters (`clicks/signups/conversions`) use atomic `ADD` to avoid read-modify-write races.

---

## 4. Idempotency

| Operation | Guard |
|---|---|
| Code generation | `ConditionExpression: attribute_not_exists(PK)` on REFERRAL_CODE; regenerate on collision |
| Click tracking | dedupe by `{code}:{sessionId}` mirror item; counter ADD only on first |
| Signup attribution | `referredBy` immutable via `if_not_exists`; one REFERRAL per `{code}:{refereeLeadId}` (conditional put) |
| Conversion → reward | reward issuance keyed on `referralId` — `ConditionExpression: attribute_not_exists` for the reward item; redelivery is a no-op |
| Clawback | one `clawed_back` per `clawbackOf` (conditional) |
| MKT_EVENT emit | provider/internal `dedupeKey = referral:{referralId}:{status}` |

All writes carry `tenantId` + `TENANT#` keys → zero cross-tenant access path. Reward math is event-sourced and append-only → auditable and replay-safe.

Cross-refs: `referral-engine.md` (lifecycle, rewards, anti-abuse), `workflows.md` (automations writing these items), `backlog.md` (EP-6 tasks), `implementation/database-requirements.md` (LEAD attrs + GSI numbering).
