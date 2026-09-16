# Referrals — Engineering Backlog (EP-6)

Epic **EP-6: Referral Engine** — productize broker-refers-broker on the real stack. Additive only; reuses `crmDynamodbService.js`, `notificationDynamodbService.js` (SCHEDULED_NOTIFICATION), `automationEngine`, `tenantMiddleware`/`validateToken`, meta-ads/CAPI for paid-referral attribution. Sizes: **S** ≤1d · **M** 2–3d · **L** 4–6d. Lanes: **BE** backend · **FE** frontend · **INT** integration · **INF** infra. Tracks: lifecycle (`referral-engine.md`), entities (`data-model.md`), automations (`workflows.md`).

> Dependency gate (gap-analysis §7): MKT_EVENT backbone + attribution + activation/customer scoring must exist first (EP-1/EP-4). EP-6 consumes their events/scores.

---

## Backend (BE)

| ID | Story | Size | Acceptance criteria |
|---|---|---|---|
| **EP6-BE1** | `referralService.issueCode(referrerId)` | M | Generates unique per-tenant code (`ConditionExpression attribute_not_exists`, bounded retries on collision); writes `REFERRAL_CODE(active,+90d)` + `REFERRAL(issued)`; one active code per (referrer,campaign); emits `referral_sent`. Unit tests cover collision + idempotent re-issue. |
| **EP6-BE2** | Code resolve + click tracking | S | `GET /r/{code}` resolves active code, atomic `ADD clicks`, sets `clicked`, emits `referral_clicked`, 302 → signup `?ref=`; dedupe `{code}:{sessionId}`; expired/disabled → graceful fallback page. |
| **EP6-BE3** | Referee attribution on signup | M | Signup w/ `?ref=` upserts LEAD `referredBy` (immutable `if_not_exists`), `referralCode`, `leadSource=referral`; creates `REFERRAL(signed_up)`; grants extended-trial flag; emits `referral_signup`. Re-signup is no-op. |
| **EP6-BE4** | `rewardService` (issue + ledger) | L | On `paid` event w/ `referredBy`: writes 2 `REWARD_LEDGER` entries (referrer free-month capped ₹5,999, referee 50%-off), idempotent on `referralId`; sets `converted→rewarded`; `ADD conversions`; Partner badge at ≥3. Liability sum query works. |
| **EP6-BE5** | Clawback + min-tenure window | M | Reward `status=pending` until referee 7-day tenure; refund/churn in window → compensating `clawed_back` entry (never delete); balance recomputes correctly. |
| **EP6-BE6** | Anti-abuse engine | M | Enforces self-referral, same-instrument, velocity, reattribution-lock, consent checks (`referral-engine.md §3`); flags → `abuseFlags` + CS review queue; rewards held on flag. Tests per rule. |
| **EP6-BE7** | Referral funnel read model | S | `GET /api/marketing/dashboard/referrals` returns sent/signup/converted, referral %, K, leaderboard, liability — via GSI4/GSI8/GSI9. Tenant-scoped. |
| **EP6-BE8** | Nudge sequence (RW-5) | S | `enroll(referral_nudge)` writes SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION; worker sends/cancels; `stepToken` prevents double-send; 30-day ask cap + opt-out honored. |

## Frontend (FE)

| ID | Story | Size | Acceptance criteria |
|---|---|---|---|
| **EP6-FE1** | "Refer & earn" in-app card | M | Shows on activation win (score-gated); displays code, `/r/{code}`, 1-tap WA share (pre-filled msg), reward terms (1 free month). Copy in Hinglish. Mobile-first. |
| **EP6-FE2** | Referral dashboard widget | M | Referrer sees their referrals (clicked/signed_up/converted), earned credits, Partner-badge progress (x/3). Reads EP6-BE7. |
| **EP6-FE3** | Referee signup banner | S | Signup detects `?ref=` → shows "Free setup + 30-day trial via {referrer}" framing; passes code through OTP/Google auth flow (`PhoneLogin/AuthCallback`). |
| **EP6-FE4** | Admin referral console | M | Admin views leaderboard, liability, abuse-review queue; can void/approve flagged referrals (RBAC: Admin only, `PermissionGuard`). |

## Integration (INT)

| ID | Story | Size | Acceptance criteria |
|---|---|---|---|
| **EP6-INT1** | WhatsApp ask delivery | M | Consent-gated WA template send for ask + reward confirmation via WhatsApp Business API integration; opt-in + 24h window respected; falls back to in-app if no consent. |
| **EP6-INT2** | Invoice credit application | M | `REWARD_LEDGER` free-month credit applied to next invoice in billing; `appliedInvoiceId` recorded; status `issued→applied`. Idempotent. |
| **EP6-INT3** | Paid-referral campaign attribution | S | Referral pushes run as `CAMPAIGN` (channel=referral); link code→campaign; conversions roll into `campaigns/` dashboard + meta CAPI if paid-amplified. |

## Infrastructure (INF)

| ID | Story | Size | Acceptance criteria |
|---|---|---|---|
| **EP6-INF1** | GSI8 (RefStatus) + GSI9 (Referrer) | S | CloudFormation online add; sparse (keys dropped on terminal states); backfill not needed (new entities). Created before referral launch (db-req §5 order). |
| **EP6-INF2** | `/r/*` redirect + rate limit + WAF | S | Public redirect route HMAC-free but rate-limited + WAF; no PII in URL; abuse-resistant. |
| **EP6-INF3** | Reward-liability alarm + metrics | S | CloudWatch metrics: codes issued, conversions, K, liability ₹; alarm when liability > cap or clawback spike. |

---

## Definition of done (EP-6)
Trace: **activation win → code issued → share → referee signup (`referredBy`) → demo → paid → both rewarded (idempotent, capped, clawback-safe) → leaderboard/liability visible**, multi-tenant, consent-gated, anti-abuse enforced. Referral % of new customers measurable (≥20% target). Every story ties to a metric in `referral-engine.md §6` and an entity/GSI in `data-model.md`.

Cross-refs: `referral-engine.md`, `data-model.md`, `workflows.md`, `implementation/backlog.md` (master sequencing), `gap-analysis.md §7` (build order).
