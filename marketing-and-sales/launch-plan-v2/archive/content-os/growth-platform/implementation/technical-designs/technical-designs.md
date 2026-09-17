# Growth Platform — Consolidated Technical Designs

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

The authoritative engineering design for the **whole** Growth Platform. **Extends + consolidates** `../../../implementation/technical-design.md` (which holds the base flows §1–7) and `marketing-and-sales/launch-plan-v2/60-automation/README.md` — this doc is now the single source of truth; those link here. Grounded in the real stack: Express on AWS Lambda (`apps/crm/server/lambda-handler.js`, `apps/crm/server/server.js`), DynamoDB single-table (`PK/SK/GSIn`, `EntityType`, `TENANT#`) via `crmDynamodbService.js` + `notificationDynamodbService.js`, `tenantMiddleware.js`, `validateToken.js`, separate `services/ai-calling-service/` (Exotel+ElevenLabs). **Additive only.**

---

## 1. End-state component map

```
 INGEST (Lambda+APIGW)        CORE SERVICES                 DATA (single-table TENANT#)      READ (dashboards)
 ┌────────────────────┐       ┌─────────────────────┐      ┌───────────────────────────┐    ┌──────────────────┐
 │ webhooks/instagram │──sig─►│ marketingEvents     │─put─►│ LEAD (extended)           │    │ dashboard.js     │
 │ webhooks/whatsapp  │       │ Service (norm/dedup)│      │ MKT_EVENT  (GSI4 type)    │◄──┤ funnel/attrib/   │
 │ webhooks/meta-lead │       └─────────┬───────────┘      │ SEQUENCE_ENROLLMENT(GSI5) │    │ cohorts/effic/   │
 │ webhooks/blotato   │                 │enqueue           │ SCORE                      │    │ scores/north-star│
 │ POST /marketing/   │                 ▼                  │ REFERRAL   (GSI8 status)  │    └────────┬─────────┘
 │      events (JWT)  │          ┌─────────────┐           │ CAMPAIGN                   │             │
 └────────────────────┘          │ SQS + DLQ   │           │ SCHEDULED_NOTIFICATION(rb)│             ▼
                                  └──────┬──────┘           │ LEAD GSI6 source/GSI7 score│   React: pages/crm/
                                         ▼                  └───────────────────────────┘   dashboards/*.tsx
                              ┌──────────────────────┐         ▲      ▲       ▲                (GlassDataTable,
                              │ automationEngine     │─────────┘      │       │                 PermissionGuard)
                              │ (event→action rules) │   crmDynamodb   │  referralService
                              └──┬────┬────┬─────────┘   Service       │
                                 │    │    │                           │
            notificationService◄─┘    │    └─► scoringService (EventBridge nightly + on-event)
            (in-app/WA/email/seq)      └─► ai-calling-service (auto-qualify, async)
```

---

## 2. Entity catalog (single-table, all `TENANT#`-scoped)

| Entity | PK / SK | Key attrs | GSI | Source doc |
|---|---|---|---|---|
| **LEAD** (extended) | `TENANT#{t}#LEAD#{id}` / `LEAD#{id}` | +`leadSource,utm*,campaignId,contentRef,consent,leadScore,activationScore,firstTouchAt,lastTouchAt,dedupeHash` | GSI6 source, GSI7 stage-score | `database-requirements §1` |
| **MKT_EVENT** | `TENANT#{t}#EVENTS` / `EVENT#{occurredAt}#{id}` | `type,channel,leadRef,contentRef,campaignId,occurredAt,dedupeKey,payload,ttl?` | GSI4 EventType | `db-req §2` |
| **SEQUENCE_ENROLLMENT** | `TENANT#{t}#SEQ#{leadId}` / `SEQ#{seqId}` | `seqId,step,nextAt,status,channel,sentTokens` | GSI5 SeqDue | `db-req §2` |
| **SCORE** | `TENANT#{t}#SCORE#{id}` / `SCORE#{LEAD\|CUSTOMER}` | `leadScore,activationScore,healthScore,signals,computedAt,version` | — | `db-req §2` |
| **REFERRAL** | `TENANT#{t}#REF#{code}` / `REF#{code}` | `code,referrerId,refereeLeadId,status,reward,convertedAt` | GSI8 ReferralStatus | `db-req §2` |
| **CAMPAIGN** | `TENANT#{t}#CAMPAIGN#{id}` / `CAMPAIGN#{id}` | `name,channel,spend,utm,status` | — | `db-req §2` |
| **SCHEDULED_NOTIFICATION** (reuse) | `TENANT#{t}#SCHEDULED` / `DUE#{dueAt}#{id}` | existing typed-event timer | existing GSI1 | `notificationDynamodbService.js` |

**New GSIs** (start at GSI4, existing GSI1–3 untouched): GSI4 EventType, GSI5 SeqDue, GSI6 LeadSource, GSI7 LeadStageScore (zero-padded score SK), GSI8 ReferralStatus — all **sparse**. Full keys + access-pattern catalog in `../../../implementation/database-requirements.md §3-4`.

---

## 3. Service responsibilities

| Service | New/Reuse | Responsibility |
|---|---|---|
| `routes/webhooks/*.js` | new | HMAC verify, resolve tenant, hand raw payload to events service — no business logic |
| `marketingEventsService.js` | new | normalize provider → canonical `MKT_EVENT`; dedupe `dedupeKey`; persist; enqueue SQS |
| `automationEngine.js` | new (extends scheduled worker) | per-tenant rules `event→action[]`; idempotent; calls CRM/notify/AI-call/scoring/referral |
| `crmDynamodbService.js` | extend | attribution fields; query helpers by source(GSI6)/stage-score(GSI7); idempotent upsert |
| `notificationDynamodbService.js` | reuse | in-app + scheduled sends (the sequence timer) |
| `sequenceService.js` | new (thin) | enroll/advance/cancel; writes `SEQUENCE_ENROLLMENT` + paired `SCHEDULED_NOTIFICATION` |
| `scoringService.js` | new | lead/activation/health/expansion/referral scores; nightly + on-event delta |
| `referralService.js` | new | code gen, referee attribution, reward ledger |
| `routes/marketing/dashboard.js` | new | funnel/attribution/cohort/efficiency/scores read-models from GSIs |
| `services/ai-calling-service/` | reuse | auto-qualify call (async) |

---

## 4. Algorithms (implement in `scoringService.js`; weights tenant-overridable, `signals` persisted for explainability)

### 4.1 Lead score M-S1 (0–100)
| Signal | Weight | Scoring |
|---|---|---|
| Source quality | 25 | referral/demo_requested=25, lead_magnet=18, instagram_dm=15, ads=12, web=10, comment=8, unknown=0 |
| Engagement recency | 20 | <24h=20, <72h=12, <7d=6, else 0 |
| Engagement depth | 15 | #events: ≥5=15, 3–4=10, 1–2=5 |
| Intent keyword | 20 | PRICE/DEMO/BUY=20, soft=10 |
| ICP fit | 15 | agency size/city full=15, partial=8 |
| Contactability | 5 | valid phone + WA consent=5 |
`leadScore=Σ`. Bands Hot≥70 / Warm 40–69 / Cold<40. → GSI7 (zero-padded) for hottest-first.

### 4.2 Activation score M-S2 (trial wk-1)
login24h 20 + data-added 20 + profile 15 + first-AI-call 25 + day3-return 20. **Activated = ≥3/4 core** (login, data, AI-call, day3) → emit `customer_activated`.

### 4.3 Health score M-S3 (higher=healthier)
login-freq(28d) 30 + feature-breadth 20 + AI-usage-trend 20 − support-flags 15 − days-since-login 15. Bands Healthy≥70 / At-risk 40–69 / Critical<40. Critical → CS alert + win-back.

### 4.4 Expansion M-S4 / Referral M-S5 (derived)
- **M-S4** = usage-vs-plan-limit + feature-ceiling-hits + seat-growth + (health≥70). Ready≥70 → upsell to next tier (Free→Starter→Growth→Pro, `01-business-memory §5`).
- **M-S5** = health + NPS-promoter + tenure + prior-referrals. Advocate≥70 → referral ask.

### 4.5 Attribution rollup
```
GET /dashboard/attribution?groupBy=source|content
 → query GSI4 for each funnel type in [dm,demo_booked,trial_started,paid], PK=TYPE#{type}, SK between(from,to)
 → join LEAD.leadSource / event.contentRef (denormalized)
 → aggregate count by source AND contentRef(OPP-*) per stage
 → derive lead→demo→paid conversion → MarketingDashboard.tsx
```

---

## 5. Sequence flows (ASCII)

**5.1 Inbound DM → attributed lead → auto-qualify**
```
IG→/webhooks/instagram(sig,extractTenant)→marketingEvents.put(MKT_EVENT dm,dedupeKey)
 →SQS→automationEngine: upsert Lead(source=ig_dm,contentRef) [dedupeHash idempotent]
 →keyword auto-reply (IG Graph)
 →if intent+consent → ai-calling-service.placeCall(async,idempotent leadId+day) → notify SDR if Hot
```

**5.2 Trial-inactive → win-back**
```
EventBridge nightly → scoringService.recompute(tenant)
 → trial lead no-login 48h → sequenceService.enroll(winback,whatsapp[consent-gated])
   → writes SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION(nextAt=now)
 → due-scan worker(GSI5) → notificationService.send(WA template) step T0/T+2d/T+4d
 → on reply/login/convert → sequenceService.cancel(reason)
```

**5.3 Referral conversion**
```
referee uses code → POST /referrals/convert(code,refereeLeadId)
 → referralService: set REFERRAL.status=converted, refereeLeadId; reward ledger; idempotent code+referee
 → emit MKT_EVENT(referral_converted) → funnel M-F8
```

---

## 6. Idempotency & consistency
- Event ingest: conditional put on `dedupeKey` — duplicate deliveries no-op.
- Lead upsert: `dedupeHash` (tenant+phone); `firstTouchAt` immutable via `if_not_exists`, `lastTouchAt` advances.
- Sequence sends: `stepToken` in `sentTokens` SS guards SQS at-least-once double-send.
- Ordering: funnel uses `occurredAt` (provider time) so out-of-order delivery still rolls up.
- Read-models eventually consistent (seconds lag acceptable for dashboards).

---

## 7. Non-functional requirements

| NFR | Target | Metric |
|---|---|---|
| Event routing latency | p95 <1s | M-O2 |
| Speed-to-lead | <5 min | M-O1 |
| Multi-tenant isolation | 100% `TENANT#`; no cross-tenant path | — |
| Consent gating | no WA/email without `consent`; opt-out ≤1 cycle | — |
| Idempotency | dup webhooks/SQS → no dup leads/sends | — |
| PII | minimized payloads; raw-event TTL ~180d (keep funnel-critical) | — |
| Observability | CloudWatch ingest/route/send/DLQ/funnel | M-O4 |
| Cost | on-demand DynamoDB; sparse GSIs; SQS batching | — |

Cross-refs: `../architecture/architecture.md`, `../../../implementation/{database-requirements,api-requirements,technical-design}.md`, `../../analytics/metric-dictionary.md`, `../coding-backlog/coding-backlog.md`.
