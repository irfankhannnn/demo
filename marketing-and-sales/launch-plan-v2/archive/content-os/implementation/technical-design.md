# Implementation — Technical Design

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

The authoritative engineering design for the in-product GTM layer. Grounded in the **real** RealEstateFlow stack: Express on **AWS Lambda** (`apps/crm/server/lambda-handler.js`, `apps/crm/server/server.js`), **DynamoDB single-table** (`PK`/`SK`/`GSIn`, `EntityType`, `TENANT#` prefix) accessed via `crmDynamodbService.js` and `notificationDynamodbService.js`, multi-tenancy via `tenantMiddleware.js` (`extractTenantId`), JWT auth (`middleware/validateToken.js`), and the separate `services/ai-calling-service/` Lambda (Exotel + ElevenLabs). Marketing MCPs (`higgsfield`, `meta-ads`, `blotato`) live in `.mcp.json`.

**Design stance:** additive only — no rewrite of existing services. We extend the single table with new `EntityType`s, add a thin set of Lambda routes, and reuse the existing **scheduled-notification** machinery (`EntityType: SCHEDULED_NOTIFICATION`, `PK = TENANT#{t}#SCHEDULED`, `SK = DUE#{dueAt}#{id}`) as the sequence/automation timer.

---

## 1. Architecture diagram

```
 EXTERNAL SOURCES                          INGEST (Lambda + API GW)              CORE (DynamoDB single-table, TENANT#-scoped)
 ┌───────────────────────────┐            ┌──────────────────────────────┐      ┌────────────────────────────────────────┐
 │ IG Graph (comments/DMs)   │ webhook    │ /api/webhooks/instagram      │      │  EntityType: LEAD (extended)             │
 │ WhatsApp Business API      │──────────► │ /api/webhooks/whatsapp       │──┐   │  EntityType: MKT_EVENT                    │
 │ Meta Lead Ads + CAPI       │            │ /api/webhooks/meta-leadads   │  │   │  EntityType: SEQUENCE_ENROLLMENT         │
 │ Blotato (post published)   │            │ /api/webhooks/blotato        │  │   │  EntityType: SCORE                        │
 │ Web signup (UTM)           │ REST       │ POST /api/marketing/events   │  │   │  EntityType: REFERRAL                     │
 └───────────────────────────┘            └──────────────┬───────────────┘  │   │  EntityType: CAMPAIGN                     │
        (JWT for REST; HMAC signature                    │ verify sig +     │   │  EntityType: SCHEDULED_NOTIFICATION (rmb)│
         verification for webhooks)                      │ extractTenantId  │   └────────────────────────────────────────┘
                                                         ▼                  │              ▲        ▲        ▲
                                              ┌────────────────────┐        │              │        │        │
                                              │ marketingEvents    │        │   write LEAD  │  write │  write │
                                              │ Service            │── put ─┼──► MKT_EVENT  │  SCORE │  REF   │
                                              │ (normalize+dedupe) │        │              │        │        │
                                              └─────────┬──────────┘        │              │        │        │
                                                        │ enqueue           │              │        │        │
                                                        ▼                   │              │        │        │
                                                 ┌─────────────┐  consume   │      ┌───────┴────┐   │   ┌────┴─────┐
                                                 │  SQS queue  │──────────► │      │ crmDynamodb│   │   │ referral │
                                                 │  (+DLQ)     │            │      │ Service    │   │   │ Service  │
                                                 └─────────────┘            │      └────────────┘   │   └──────────┘
                                                        ▼                   │                       │
                                              ┌────────────────────┐        │              ┌────────┴────────┐
                                              │ Automation Engine  │────────┘              │ scoringService  │
                                              │ (rules: event→act) │  ┌──────────────────► │ (nightly job)   │
                                              └───┬────┬────┬───────┘  │                    └─────────────────┘
                                                  │    │    │          │ EventBridge cron
              ┌───────────────────────────────────┘    │    └──────────┴───────────┐
              ▼                                          ▼                          ▼
   notificationDynamodbService              ai-calling-service Lambda      sequenceWorker (due-scan)
   (in-app + scheduled + WA/email)          (auto-qualify call)            scans GSI-SeqDue / SCHEDULED
              │                                          │                          │
              └──────────────────────────────────────────┴──────────────────────────┘
                                                  │
                                                  ▼
                              ┌──────────────────────────────────────────┐
                              │ Marketing Dashboard API (read models)     │
                              │ GET /api/marketing/dashboard/*            │
                              │ funnel · attribution · cohorts (via GSIs) │
                              └──────────────────────────────────────────┘
                                                  ▼
                              React UI: pages/crm/MarketingDashboard.tsx
```

**Component responsibilities**

| Component | New/Reuse | Responsibility |
|---|---|---|
| Webhook routes (`routes/webhooks/*.js`) | new | Verify provider HMAC signature, resolve tenant, hand raw payload to `marketingEventsService`. No business logic. |
| `marketingEventsService.js` | new | Normalize provider payloads → canonical `MKT_EVENT`; dedupe by `dedupeKey`; persist; enqueue to SQS. |
| SQS + DLF | new (INF) | Decouple ingest from processing; at-least-once delivery; failures → DLQ. |
| Automation Engine (`automationEngine.js`) | new (extends scheduled worker) | Evaluate per-tenant rules `event → action[]`; idempotent; calls CRM / notification / AI-calling / scoring / referral. |
| `crmDynamodbService.js` (lead paths) | extend | Persist new attribution fields on Lead; new query helpers by source/stage/score. |
| `notificationDynamodbService.js` | reuse | In-app notifications + **scheduled** sends (the sequence timer). |
| `sequenceService.js` | new (thin) | enroll / advance / cancel; writes `SEQUENCE_ENROLLMENT` + a `SCHEDULED_NOTIFICATION` for the next step. |
| `scoringService.js` | new | Compute lead / activation / health scores; nightly recompute + on-event delta. |
| `referralService.js` | new | Code generation, referee attribution, reward ledger. |
| `services/ai-calling-service/` | reuse | Auto-qualify call on qualified inbound lead (invoked async). |
| Dashboard API | new | Funnel / attribution / cohort read models from GSIs. |
| `tenantMiddleware.js`, `validateToken.js` | reuse | Tenant resolution + auth for all REST routes. |

---

## 2. Data model (single-table, every item `TENANT#`-scoped)

Table: existing CRM table (`CRM_TABLE_NAME`). All new items carry `tenantId`, `EntityType`, and timestamps `createdAt`/`updatedAt` (ISO-8601), consistent with `crmDynamodbService.js` conventions.

### 2.1 LEAD (extended — additive attributes)

```
PK   = TENANT#{tenantId}#LEAD#{leadId}        (existing pattern family)
SK   = LEAD#{leadId}
EntityType = LEAD
```

| Attribute | Type | Notes |
|---|---|---|
| existing: `name,phone,email,leadType,status,priority,assignedTo` | — | unchanged (`routes/leads.js`) |
| `leadSource` | string (enum) | `instagram_dm \| instagram_comment \| instagram_bio \| facebook_ads \| facebook_group \| whatsapp \| linkedin \| youtube \| referral \| founder \| lead_magnet \| web \| unknown` |
| `utmSource` | string | e.g. `instagram` |
| `utmMedium` | string | e.g. `reel`, `cpc`, `organic` |
| `utmCampaign` | string | campaign slug, maps to `CAMPAIGN#{id}` |
| `utmContent` | string | creative/variant id |
| `campaignId` | string? | FK → `CAMPAIGN#{id}` |
| `contentRef` | string? | `OPP-*` recipe id or reel/post id — Content-OS ROI link |
| `consent` | map | `{ whatsapp: bool, email: bool, capturedAt: ISO, ip?: string, source: string }` |
| `leadScore` | number (0–100) | denormalized copy of latest `SCORE` for hottest-first sort |
| `activationScore` | number (0–100)? | for trial users |
| `firstTouchAt` | ISO | first attributed event |
| `lastTouchAt` | ISO | most recent attributed event |
| `dedupeHash` | string | `sha1(tenantId + normalizedPhone)` for idempotent upsert |

**GSI projections (Lead):** `GSI-LeadSource` (source reports), `GSI-LeadScore` (hottest-first within stage). See `database-requirements.md`.

### 2.2 MKT_EVENT (event-sourced funnel record — the spine)

```
PK   = TENANT#{tenantId}#EVENTS
SK   = EVENT#{occurredAt}#{eventId}            (ISO ts sorts chronologically)
EntityType = MKT_EVENT
GSI-EventType:  GSI4PK = TENANT#{tenantId}#TYPE#{type}   GSI4SK = {occurredAt}
```

| Attribute | Type | Notes |
|---|---|---|
| `eventId` | uuid | |
| `type` | enum | `content_published, comment, dm, lead_magnet_download, demo_requested, demo_booked, demo_completed, trial_started, milestone_hit, trial_inactive, customer_activated, referral_sent, referral_converted, paid` |
| `channel` | enum | `instagram, facebook, whatsapp, linkedin, youtube, web, ai_call, email` |
| `leadRef` | string? | `LEAD#{leadId}` if resolved |
| `contentRef` | string? | `OPP-*` / post id |
| `campaignId` | string? | |
| `occurredAt` | ISO | provider event time (not ingest time) |
| `ingestedAt` | ISO | |
| `dedupeKey` | string | `{provider}:{providerEventId}` — conditional-put guard |
| `payload` | map | **PII-minimized** normalized fields only |
| `ttl` | number? | epoch seconds; optional TTL on raw events for cost |

Access patterns served: chronological event stream per tenant (PK + SK range); funnel/time rollups by type (`GSI-EventType`); attribution joins via `leadRef`/`contentRef` filters.

### 2.3 SEQUENCE_ENROLLMENT (lifecycle drip state)

```
PK   = TENANT#{tenantId}#SEQ#{leadId}
SK   = SEQ#{seqId}
EntityType = SEQUENCE_ENROLLMENT
GSI-SeqDue:  GSI5PK = TENANT#{tenantId}#SEQDUE   GSI5SK = {nextAt}#{leadId}#{seqId}
```

| Attribute | Type | Notes |
|---|---|---|
| `seqId` | enum | `onboarding_7d, nurture, demo_reminder, winback, post_activation` |
| `step` | number | current step index |
| `nextAt` | ISO | when next step fires (drives the worker / `SCHEDULED_NOTIFICATION`) |
| `status` | enum | `active, completed, cancelled, opted_out` |
| `channel` | enum | `whatsapp, email, in_app, ai_call` |
| `enrolledAt` / `lastStepAt` | ISO | |
| `cancelReason` | string? | `replied, converted, opt_out, manual` |

A live enrollment writes a paired `SCHEDULED_NOTIFICATION` (existing entity) for `nextAt`; the due-scan worker advances the step and reschedules. Cancellation removes the future scheduled notification (REMOVE pattern already used in `notificationDynamodbService.js` for `GSI1PK/GSI1SK`).

### 2.4 SCORE

```
PK   = TENANT#{tenantId}#SCORE#{entityId}      (entityId = leadId or customerId)
SK   = SCORE#{entityType}                       (LEAD | CUSTOMER)
EntityType = SCORE
```

| Attribute | Type | Notes |
|---|---|---|
| `leadScore` | 0–100 | fit + intent + engagement |
| `activationScore` | 0–100 | trial-user onboarding progress |
| `healthScore` | 0–100 | customer retention risk (higher = healthier) |
| `signals` | map | raw signal values used (audit/explainability) |
| `computedAt` | ISO | |
| `version` | string | scoring model version |

### 2.5 REFERRAL

```
PK   = TENANT#{tenantId}#REF#{code}
SK   = REF#{code}
EntityType = REFERRAL
GSI-ReferralStatus:  GSI6PK = TENANT#{tenantId}#REFSTATUS#{status}  GSI6SK = {createdAt}
```

| Attribute | Type | Notes |
|---|---|---|
| `code` | string | short shareable code |
| `referrerId` | string | customer who shares |
| `refereeLeadId` | string? | set when a lead uses the code |
| `status` | enum | `issued, clicked, signed_up, converted, rewarded` |
| `reward` | map | `{ type, amount, currency, issuedAt? }` |
| `convertedAt` | ISO? | |

### 2.6 CAMPAIGN

```
PK   = TENANT#{tenantId}#CAMPAIGN#{campaignId}
SK   = CAMPAIGN#{campaignId}
EntityType = CAMPAIGN
```

| Attribute | Type | Notes |
|---|---|---|
| `name` | string | |
| `channel` | enum | `meta_ads, instagram_organic, whatsapp, linkedin, referral, founder` |
| `spend` | number | for CAC; updated from meta-ads MCP |
| `utm` | map | canonical utm tuple |
| `status` | enum | `active, paused, ended` |

---

## 3. Key flow designs

### 3.1 Inbound DM → attributed lead → auto-qualify (ASCII sequence)

```
IG user        IG Graph      /webhooks/instagram   marketingEvents   Automation      crmDynamodb    ai-calling      SDR
  │  DM "PRICE"   │                 │                    │             Engine            │            service        │
  │──────────────►│  webhook(sig)   │                    │               │               │              │           │
  │               │────────────────►│ verify HMAC        │               │               │              │           │
  │               │                 │ extractTenantId    │               │               │              │           │
  │               │                 │────normalize──────►│ put MKT_EVENT │               │              │           │
  │               │                 │                    │ (type=dm,     │               │              │           │
  │               │                 │                    │ dedupeKey)    │               │              │           │
  │               │                 │                    │──enqueue SQS─►│ consume       │              │           │
  │               │                 │                    │               │ upsert Lead   │              │           │
  │               │                 │                    │               │ (source=ig_dm,│              │           │
  │               │                 │                    │               │  contentRef)──►│              │           │
  │◄──auto-reply (keyword template via IG Graph)─────────┤               │               │              │           │
  │               │                 │                    │               │ if qualified ─┼─invoke async►│ place call│
  │               │                 │                    │               │               │              │──────────►│ notify
```

Idempotency: the upsert keys on `dedupeHash = sha1(tenant+phone)`; a re-delivered webhook with the same `dedupeKey` is a no-op conditional put.

### 3.2 Trial-inactive → win-back

```
EventBridge cron (nightly)
        │
        ▼
scoringService.recompute(tenant)
        │  reads product login events (MKT_EVENT) + trial start
        ▼
  for each trial lead with no login in 48h:
        │
        ▼
sequenceService.enroll(leadId, seqId=winback, channel=whatsapp [consent-gated])
        │  writes SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION(nextAt=now)
        ▼
sequenceWorker (due-scan) → notificationDynamodbService.send(WhatsApp template)
        │  step 1: personal nudge · step 2 (T+2d): offer setup call · step 3 (T+4d): founder escalation
        ▼
on reply/login/convert → sequenceService.cancel(reason)
```

### 3.3 Attribution rollup (dashboard read)

```
GET /api/marketing/dashboard/attribution?from&to&groupBy=source|content
        │
        ▼
query GSI-EventType for each funnel type in [dm, demo_booked, trial_started, paid]
   PK=TENANT#{t}#TYPE#{type}, SK between(from,to)
        │
        ▼
join to LEAD.leadSource / LEAD.contentRef (already denormalized on event)
        │
        ▼
aggregate: count by source AND by contentRef(OPP-*) per funnel stage
        │  derive: leads→demo→paid conversion per source/content
        ▼
return funnel matrix + content-ROI rows  → MarketingDashboard.tsx
```

### 3.4 AI auto-qualify decision

```
inbound lead created
   │
   ▼
intent signals present? (keyword in [PRICE, DEMO, BUY, "kitna"], or lead_magnet=high-intent)
   │ yes                                   │ no
   ▼                                       ▼
consent.whatsapp || phone present?     enroll nurture (no call)
   │ yes
   ▼
invoke ai-calling-service (async, idempotent by leadId+day)
   │
   ▼
on call outcome event → update leadScore, notify SDR if "hot"
```

---

## 4. Scoring algorithms (explicit weights — implement in `scoringService.js`)

All scores 0–100, clamped. Weights are tenant-overridable defaults; `signals` map is persisted for explainability.

### 4.1 Lead score (intent + fit + engagement)

| Signal | Weight | Scoring |
|---|---|---|
| Source quality | 25 | referral=25, demo_requested=25, lead_magnet=18, instagram_dm=15, ads=12, comment=8, web=10, unknown=0 |
| Engagement recency | 20 | event in <24h=20, <72h=12, <7d=6, else 0 |
| Engagement depth | 15 | #MKT_EVENTs tied to lead: ≥5=15, 3–4=10, 1–2=5 |
| Explicit intent keyword | 20 | matched buying keyword (PRICE/DEMO/BUY)=20, soft intent=10 |
| ICP fit | 15 | agency size / city match (from enrichment) — full=15, partial=8 |
| Contactability | 5 | valid phone + WhatsApp consent=5 |

`leadScore = Σ(weighted)`. Bands: `Hot ≥70`, `Warm 40–69`, `Cold <40`.

### 4.2 Activation score (trial user, week-1)

| Signal | Weight |
|---|---|
| Logged in within 24h of trial start | 20 |
| Added ≥1 lead/property | 20 |
| Completed profile / agency config | 15 |
| Made/triggered first AI call | 25 |
| Returned on ≥3 distinct days (week 1) | 20 |

Activation threshold = **3 of 4 core milestones** (login, data added, AI call, day-3 return) → `activated=true` (matches `growth-dashboard.md` definition).

### 4.3 Customer health score (retention risk)

| Signal | Weight | Direction |
|---|---|---|
| Login frequency (28-day) | 30 | higher = healthier |
| Feature breadth (modules used) | 20 | higher = healthier |
| AI-calling usage trend | 20 | rising = healthier |
| Support/objection flags | 15 | more = lower |
| Days since last login | 15 | more = lower (decay) |

Bands: `Healthy ≥70`, `At-risk 40–69`, `Critical <40` → `Critical` triggers CS alert + win-back.

---

## 5. Idempotency & consistency

- **Event ingest:** conditional `PutItem` with `attribute_not_exists(dedupeKey)` mirror item or `ConditionExpression` on the event PK/SK; duplicate provider deliveries are no-ops.
- **Lead upsert:** keyed on `dedupeHash` (tenant+phone); `UpdateItem` with `SET ... if_not_exists(firstTouchAt, :now)` so first-touch is immutable while `lastTouchAt` always advances. Same pattern style as existing services.
- **Sequence sends:** each scheduled step carries a `stepToken`; the worker conditionally marks `SENT#{stepToken}` to avoid double-send under SQS at-least-once.
- **Delivery:** at-least-once via SQS; DLQ after N retries; consumers are idempotent. Eventual consistency acceptable for dashboards (read models tolerate seconds of lag).
- **Ordering:** funnel correctness uses `occurredAt` (provider time), not ingest order, so out-of-order delivery still rolls up correctly.

---

## 6. Reuse map (don't rebuild)

| Need | Reuse |
|---|---|
| Sequence timer / scheduled sends | `notificationDynamodbService.js` → `SCHEDULED_NOTIFICATION` (`PK=TENANT#{t}#SCHEDULED`, `SK=DUE#{dueAt}#{id}`), existing due-scan + typed events |
| Auto-qualify call | `services/ai-calling-service/` Lambda (Exotel + ElevenLabs) |
| Multi-tenancy | `tenantMiddleware.js` / `extractTenantId` |
| Auth | `middleware/validateToken.js` (JWT) |
| In-app notifications + unread GSI | `notificationDynamodbService.js` (`GSI1PK=TENANT#{t}#UNREAD`) |
| Lead CRUD | `crmDynamodbService.js` (`createLead/getLeads/updateLead`) + `routes/leads.js` |
| Publishing / ad ops | `blotato`, `meta-ads` MCPs |

---

## 7. Non-functional requirements

| NFR | Target |
|---|---|
| Event routing latency | < 1s ingest→routed (p95) |
| Speed-to-lead | inbound qualified lead → first auto-touch < 5 min |
| Multi-tenant isolation | 100% — every key prefixed `TENANT#`; no cross-tenant query path |
| Consent gating | no WhatsApp/email send without stored `consent`; opt-out honored ≤ 1 cycle |
| Idempotency | duplicate webhooks / SQS redeliveries produce no duplicate leads or sends |
| Availability | rides existing Lambda/API-GW SLA; webhooks tolerate provider retries |
| PII | event payloads minimized; raw provider bodies not persisted long-term (TTL) |
| Observability | CloudWatch metrics on ingest, routing, sends, DLQ depth, funnel counts |
| Cost | on-demand DynamoDB; raw-event TTL; SQS batching |

Cross-refs: `database-requirements.md` (GSIs + access patterns), `api-requirements.md` (contracts), `infrastructure-requirements.md` (Lambda/SQS/EventBridge/secrets), `ui-requirements.md` (screens). Epics in `epics.md`; sequencing in `backlog.md`.
