# Customer Health System (Phase 5 · EP-5)

Four post-conversion scores on every paying customer — **HEALTH, RISK/CHURN, EXPANSION, REFERRAL** — closing the gap "no customer health/risk/expansion scoring → churn invisible until too late" (`gap-analysis.md` §2 P2). This is the single source of truth for the four customer-scoring models; engineering lands them in `scoringService.js` (extending the lead path), persisted as `SCORE` entity variants (`implementation/technical-design.md` §2.4), `TENANT#`-scoped. Inputs are **product usage** (login events, AI-calling usage, feature breadth via `MKT_EVENT`), billing/payment status, and survey signals. The journey continues the one 0–100 spine: leadScore → activationScore (technical-design §4.2) → these four. Each score is tied to an **action**, a **dashboard**, and an **engineering task**.

> **Why four scores, not one:** HEALTH answers "is this account okay?", RISK answers "act now or lose them", EXPANSION answers "ask for more money", REFERRAL answers "ask for advocacy". They share signals but fire opposite automations. A customer can be Healthy **and** Expansion-ready **and** a Promoter simultaneously.

---

## 1. HEALTH score (0–100, higher = healthier)

Refines technical-design.md §4.3. Answers: is the account engaged + adopting + paying?

| Signal | Wt | Scoring | Source |
|---|---|---|---|
| Login frequency (28d) | 28 | `active_days/28`: ≥16d=28, 8–15=18, 3–7=9, <3=2 | login `MKT_EVENT` |
| Feature breadth (modules used of 9, business-memory §3) | 20 | ≥5 mods=20, 3–4=12, 2=6, 1=2 | feature `MKT_EVENT` |
| Activation milestones met (of 4) | 14 | 4/4=14, 3=10, 2=5, ≤1=0 | activationScore (§4.2 TD) |
| AI-calling usage trend (flagship, business-memory §3.6) | 16 | rising=16, flat=9, declining=3, never=0 | ai-calling-service usage |
| Support sentiment | 12 | positive/none=12, neutral=7, ≥1 objection flag=3, angry=0 | support/objection flags |
| Payment status | 10 | current=10, retrying=4, failed/overdue=0 | billing |

`HEALTH = Σ`, clamp 0–100.

| Band | Score | Action (auto) | Dashboard |
|---|---|---|---|
| 🟢 Healthy | ≥70 | candidate for EXPANSION/REFERRAL eval | health distribution → "Healthy" |
| 🟡 At-risk | 40–69 | CS check-in task + value-nudge sequence | watchlist panel |
| 🔴 Critical | <40 | **founder/CS early-warning alert** + win-back enroll | critical alert feed |

**Trigger fired:** band drop to Critical → `health_critical` event → CS alert (`notificationDynamodbService`) + `winback` sequence enroll.

---

## 2. RISK / CHURN score (0–100, higher = MORE likely to churn)

Inverse-lens of health, weighted to leading churn indicators (research §8.7 lock-in/cancel anxiety; retention is the P3 gap). Built to fire **before** cancellation.

| Signal | Wt | Scoring |
|---|---|---|
| Inactivity (days since last login) | 30 | ≥14d=30, 7–13=20, 3–6=10, <3=0 |
| Usage decline (28d vs prior 28d) | 22 | drop >50%=22, 25–50%=14, slight=6, stable/up=0 |
| Failed/declined payment | 20 | failed+unrecovered=20, retrying=10, current=0 |
| Low adoption (single-feature / never activated) | 16 | never activated=16, 1 module only=10, 2=4, ≥3=0 |
| NPS detractor (score 0–6) | 12 | detractor=12, passive=5, promoter/none=0 |

`RISK = Σ`, clamp 0–100. (Note: RISK and HEALTH are **not** strict complements — RISK over-weights involuntary churn signals like failed payment that HEALTH treats lightly.)

| Band | Score | Action (auto) | Dashboard |
|---|---|---|---|
| 🟢 Safe | <30 | none | — |
| 🟡 Watch | 30–59 | nurture value-content + usage-nudge sequence | at-risk cohort |
| 🔴 High-risk | ≥60 | **win-back sequence** (3-step: nudge→setup-call→founder), dunning if payment, CS escalation | early-warning feed |

**Trigger fired:** `risk_high` → `winback` enrollment (technical-design §3.2 flow) + failed-payment → dunning sequence (consent-gated WhatsApp/email). Ties to `churn-prevention` skill + `retention/`.

---

## 3. EXPANSION score (0–100, higher = upsell-ready)

Detects accounts ready to move up a plan tier (Free→Starter→Growth→Pro, business-memory §5) — the NRR engine.

| Signal | Wt | Scoring |
|---|---|---|
| Usage near plan limit (leads/users vs cap) | 30 | ≥90% of cap=30, 70–89%=20, 50–69%=8, <50%=0 |
| Team growth (seats added 28d) | 22 | ≥3 invites=22, 1–2=12, 0=0 |
| High adoption (HEALTH ≥70) | 18 | Healthy=18, At-risk=6, Critical=0 |
| Multi-feature use (paid-tier features touched: AI matching, analytics, API) | 18 | ≥2 gated features=18, 1=10, 0=0 |
| Tenure ≥60d + current payment | 12 | yes=12, 30–59d=6, <30d=0 |

`EXPANSION = Σ`, clamp 0–100. Gate: only score customers with `HEALTH ≥ 50` (don't upsell an unhappy account).

| Band | Score | Action (auto) | Dashboard |
|---|---|---|---|
| Ready | ≥65 | **in-app upgrade prompt** (`paywall-upgrade-cro`) + CS upsell task with the limit-hit data | expansion-ready list |
| Watch | 40–64 | feature-education sequence (show the gated value) | expansion pipeline |
| Not yet | <40 | none | — |

**Trigger fired:** `expansion_ready` → upgrade paywall surfaced at the limit-hit moment + CS task ("near 90% of 500-lead Starter cap → Growth"). Ties to `revops` / `pricing-strategy`.

---

## 4. REFERRAL score (0–100, higher = ask now)

Detects the moment to ask for a referral — RealEstateFlow's cheapest CAC channel (referrals 20–30% of leads, highest quality, research §5.7; `referrals/` engine). Peer validation is the #1 trust signal (market-research §2.2, §9.2).

| Signal | Wt | Scoring |
|---|---|---|
| NPS promoter (9–10) | 30 | promoter=30, passive(7–8)=10, detractor=0 |
| Activation win / value moment (recovered deal, 100+ AI calls, milestone) | 24 | strong win=24, mild=12, none=0 |
| Tenure (loyalty) | 18 | ≥6mo=18, 3–6mo=11, 1–3mo=5, <1mo=0 |
| Advocacy signals (testimonial given, shared content, WhatsApp forward) | 16 | any explicit=16, engaged-organic=8, none=0 |
| Health gate (HEALTH ≥70) | 12 | Healthy=12, else 0 |

`REFERRAL = Σ`, clamp 0–100. Hard gate: never trigger a referral ask if `RISK ≥ 30` (don't ask an unhappy/at-risk customer).

| Band | Score | Action (auto) | Dashboard |
|---|---|---|---|
| Advocate | ≥70 | **referral ask** (generate `REFERRAL` code, technical-design §2.5) at the value moment; founder-personal ask for top accounts | referral-ready list |
| Warm | 45–69 | satisfaction-nudge + soft "know other brokers?" sequence | referral pipeline |
| Not yet | <45 | none | — |

**Trigger fired:** `referral_ready` → `referralService.issueCode(customerId)` + post-value-moment ask sequence. Ties to `referral-program` skill + `referrals/`. Closes the gap-analysis §8 loop: …paid → **referral** → expansion.

---

## 5. How computed (event-driven + nightly)

```
EVENT-DRIVEN: login / feature_used / payment_failed / nps_submitted / limit_hit / seat_added
   → SQS → automationEngine → scoringService.recomputeCustomer(customerId)
   → writes all 4 SCORE values + signals; fires band-transition triggers (idempotent per id+score+day)

NIGHTLY (EventBridge cron):
   scoringService.recomputeCustomer(tenant, all=true)
   → recompute trends (usage 28d vs prior 28d), tenure, inactivity decay
   → daily SCORE snapshot per customer → cohort/NRR trend (dashboard EP-7 §7)
   → EARLY-WARNING SWEEP: collect HEALTH<40 ∪ RISK≥60 → single digest alert to CS/founder
```

Same `scoringService.js` + nightly pattern as lead scoring (`lead-scoring/lead-scoring-engine.md` §5) and technical-design §3.2. All signals persisted in `signals` map for explainability.

---

## 6. Data model (SCORE entity variants — extends technical-design.md §2.4)

One `SCORE` item per customer holds all four scores (single read for the CS view):

```jsonc
{
  "PK": "TENANT#t_123#SCORE#cust_456",
  "SK": "SCORE#CUSTOMER",
  "EntityType": "SCORE",
  "tenantId": "t_123",
  "healthScore": 78, "healthBand": "HEALTHY",
  "riskScore": 18,   "riskBand": "SAFE",
  "expansionScore": 71, "expansionBand": "READY",
  "referralScore": 82,  "referralBand": "ADVOCATE",
  "plan": "starter", "leadCapUsed": 0.92, "seats": 5,
  "signals": {
    "activeDays28": 19, "modulesUsed": 6, "aiCallTrend": "rising",
    "usageDeltaPct": 0.15, "paymentStatus": "current",
    "nps": 9, "tenureDays": 210, "advocacy": "testimonial",
    "lastLoginAt": "2026-06-17T20:00Z"
  },
  "computedAt": "...", "version": "cust-v1.0", "createdAt": "...", "updatedAt": "..."
}
```

### 6.1 GSIs / access patterns (the surfaces that didn't exist)

```
GSI-CustomerRisk (worst-first early-warning):
  GSI8PK = TENANT#{tenantId}#RISK
  GSI8SK = SCORE#{zeroPad(riskScore)}#{customerId}    // numeric-desc via 1000-pad → highest risk first

GSI-CustomerExpansion (upsell pipeline):
  GSI9PK = TENANT#{tenantId}#EXPANSION
  GSI9SK = SCORE#{zeroPad(1000-expansionScore)}#{customerId}

GSI-CustomerReferral (advocate pipeline):
  GSI10PK = TENANT#{tenantId}#REFERRAL
  GSI10SK = SCORE#{zeroPad(1000-referralScore)}#{customerId}
```

Access patterns: (1) top-N highest-risk customers (GSI8, CS triage), (2) expansion-ready list (GSI9), (3) referral-ready list (GSI10), (4) health distribution % (scan-light count by `healthBand` for dashboard §7), (5) score history (daily snapshot SK range for cohort/NRR). Denormalize `healthScore`/`riskBand` onto the Customer/Tenant record for list rendering.

---

## 7. Dashboards · monitoring · early-warning

**Health/Risk dashboard (EP-7, extends `growth-dashboard.md` §7):**
```
┌────────────────────────────────────────────────────────────┐
│ HEALTH DISTRIBUTION  🟢62% 🟡28% 🔴10%  (target: shift→🟢)  │
├──────────────────────────┬─────────────────────────────────┤
│ 🔴 EARLY-WARNING FEED    │ EXPANSION PIPELINE (₹ uplift)    │
│  worst-first (GSI8):     │  ready-list (GSI9) + limit hit   │
│  cust · risk · reason    │  cust · plan · %cap · → tier     │
├──────────────────────────┼─────────────────────────────────┤
│ REFERRAL-READY (GSI10)   │ NRR / churn / NPS trend          │
└──────────────────────────┴─────────────────────────────────┘
```

**Monitoring workflows / early-warning system:**
| Cadence | What | Owner |
|---|---|---|
| Real-time | `health_critical` / `risk_high` / `payment_failed` → instant CS+founder alert | automationEngine |
| Daily | nightly sweep digest (HEALTH<40 ∪ RISK≥60) → one message to founder/CS | pipeline-manager |
| Weekly | health-distribution shift, expansion-ready count, referral asks sent | growth-strategist |
| Monthly | churn %, NRR, NPS, cohort retention by signup week | growth-strategist/oracle |

Founder/CS alerts ride `notificationDynamodbService.js` in-app + scheduled (WhatsApp/email consent-gated). A Critical account with a failed payment is the highest-priority alert (involuntary churn is recoverable via dunning).

---

## 8. Engineering requirements (EP-5)

| # | Task | Component | Ties to |
|---|---|---|---|
| CS-1 | `scoringService.computeCustomerScores(signals)` → {health,risk,expansion,referral} | `scoringService.js` (extend) | §1–4 |
| CS-2 | Event hooks: login/feature/payment/nps/limit_hit/seat_added → recompute | `automationEngine.js` | §5 |
| CS-3 | Nightly recompute + daily snapshot + early-warning sweep | EventBridge + `scoringService` | §5, §7 |
| CS-4 | `SCORE#CUSTOMER` writes + denorm onto Customer/Tenant | `crmDynamodbService.js` | §6 |
| CS-5 | Provision GSI8/9/10 (risk/expansion/referral pipelines) | `database-requirements.md` | §6.1 |
| CS-6 | APIs: `GET /api/customers?sort=risk\|expansion\|referral`, `GET /api/customers/:id/score` | `routes/crm.js` (extend) | §6 |
| CS-7 | Triggers → sequences/referral/dunning/upgrade-prompt | `automationEngine.js`, `sequenceService.js`, `referralService.js` | §1–4 |
| CS-8 | FE: health badge on Customer/Tenant detail + Health Dashboard panel + early-warning feed | `CRMDashboard.tsx`, `BusinessAnalytics.tsx`, customer detail | business-memory §3.8 |
| CS-9 | NPS capture event + `nps` signal ingest | `MKT_EVENT(nps_submitted)` | §2,§4 |
| CS-10 | Admin-gated views (health/risk are sensitive) | `rbac.ts` / `PermissionGuard.tsx` | — |

**Reuse:** alerts/sequences → `notificationDynamodbService.js` + `SCHEDULED_NOTIFICATION`; win-back/dunning → `sequenceService.js`; referral codes → `referralService.js` + `REFERRAL` entity; AI-call usage → `ai-calling-service/`; multi-tenancy → `tenantMiddleware.js`.

---

## 9. Reporting + tie-ins

- **Customer Success:** HEALTH/RISK drive the CS triage queue + early-warning — productizes the human retention SOP (gap-analysis §2 P3 retention gap).
- **Referral system (`referrals/`):** REFERRAL score is the trigger that decides *who* and *when* to ask — gated on RISK<30 + HEALTH≥70, fired at a value moment, mirroring research §5.7 (systematize referrals = free lead machine).
- **Retention system (`retention/`) + `churn-prevention` skill:** RISK band → win-back/dunning sequences; feeds churn% + cohort retention (growth-dashboard §7).
- **RevOps / expansion:** EXPANSION score → upgrade prompts + NRR (the §5 pricing tiers ladder).
- **Continuity:** continues the lead→activation→customer 0–100 spine (`lead-scoring/lead-scoring-engine.md`, technical-design §4.2–4.3).
- **Cross-refs:** `gap-analysis.md` §2 P2/P3, `implementation/technical-design.md` §2.4/§4.3, `implementation/epics.md` EP-5, `growth-dashboard.md` §7.

**Build order (gap-analysis §7):** requires EP-1 attribution + EP-2 events + product usage instrumentation. Until shipped, track HEALTH/RISK/EXPANSION/REFERRAL manually using §1–4 weights so definitions never drift.
