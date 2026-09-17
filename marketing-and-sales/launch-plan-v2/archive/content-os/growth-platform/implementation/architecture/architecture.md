# Growth Platform — End-State Architecture

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

The end-state architecture of the Growth Platform on the **real** RealEstateFlow AWS stack: Express on AWS Lambda behind API Gateway (`apps/crm/server/lambda-handler.js`), DynamoDB single-table (`PK/SK/GSIn`, `EntityType`, `TENANT#`), `crmDynamodbService.js` / `notificationDynamodbService.js`, separate `services/ai-calling-service/` Lambda, React/Vite frontend (`apps/crm/real-estate-crm-app/`), CloudFormation deploy. MCPs: `higgsfield`/`meta-ads`/`blotato`. **Additive** — consolidates `marketing-and-sales/launch-plan-v2/60-automation/README.md` (links here). Components/services detail in `../technical-designs/technical-designs.md`.

---

## 1. System diagram

```
                              EXTERNAL                                   AWS (existing account/stack)
 ┌──────────────────────────────────────────────┐   ┌───────────────────────────────────────────────────────────┐
 │ IG Graph · WhatsApp Business · Meta Lead Ads  │   │  API GATEWAY ──► LAMBDA (Express, lambda-handler.js)        │
 │ Blotato · Web signup(UTM) · meta-ads MCP spend│   │     │  validateToken(JWT) / HMAC verify / extractTenantId   │
 └───────────────┬───────────────┬───────────────┘   │     ▼                                                       │
          webhooks(HMAC)     REST(JWT)                │  ┌────────────────────────────────────────────────────┐    │
                 │               │                    │  │ routes/webhooks/*  routes/marketing/*  routes/leads  │    │
                 └───────┬───────┘────────────────────┼─►│ routes/referrals  routes/marketing/dashboard         │    │
                         ▼                            │  └───────┬───────────────────┬───────────────┬──────────┘    │
                ┌──────────────────┐                  │          │ marketingEvents   │ dashboard     │ referral      │
                │ marketingEvents  │── put MKT_EVENT ─┼──────────┤ Service           │ read-models   │ Service       │
                │ Service          │── enqueue ──┐    │          ▼                   ▼               ▼               │
                └──────────────────┘             │    │  ┌──────────────────────────────────────────────────────┐  │
                                                 ▼    │  │   DynamoDB SINGLE TABLE (CRM_TABLE_NAME, on-demand)    │  │
                                          ┌───────────┐│  │   LEAD MKT_EVENT SEQUENCE_ENROLLMENT SCORE REFERRAL    │  │
                                          │ SQS + DLQ ││  │   CAMPAIGN SCHEDULED_NOTIFICATION                      │  │
                                          └─────┬─────┘│  │   GSI4 type·GSI5 seqdue·GSI6 source·GSI7 score·GSI8 ref│  │
                                                ▼      │  └──────────────────────────────────────────────────────┘  │
                                   ┌──────────────────┐│          ▲          ▲            ▲                          │
                                   │ automationEngine ││  crmDynamodb     scoring      referral                      │
                                   │ (worker Lambda)  ││  Service         Service       Service                     │
                                   └──┬────┬────┬─────┘│      ▲                                                      │
                                      │    │    │      │      │ EventBridge cron (nightly scoring · due-scan)        │
              notificationService◄────┘    │    └──────┼──────┘                                                      │
              (in-app/WA/email/scheduled)  │           │                                                            │
                                           ▼           │   ai-calling-service Lambda (Exotel+ElevenLabs, async)     │
                                    (sequence sends)   │   CloudWatch (metrics/alarms) · Secrets Manager            │
                                                       └───────────────────────────────────────────────────────────┘
                                                                              │
                                                                              ▼
                                            React/Vite  pages/crm/dashboards/* (GlassDataTable · PermissionGuard)
```

---

## 2. Data flow (end-to-end)

```
1 Capture   external event → webhook/REST → marketingEventsService → MKT_EVENT (TENANT#) → SQS
2 Route     SQS → automationEngine: match per-tenant rules event→action[] (idempotent)
3 Act       upsert LEAD(attribution) · auto-reply · ai-call · enroll sequence · update SCORE · referral
4 Schedule  sequenceService → SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION; due-scan worker advances
5 Score     EventBridge nightly → scoringService → SCORE (lead/activation/health/expansion/referral)
6 Read      dashboard.js aggregates GSI4/6/7/8 → /api/marketing/dashboard/* → 6 React dashboards
```

---

## 3. Queues, schedulers, workers

| Component | Type | Role |
|---|---|---|
| Ingest SQS + DLQ | SQS | decouple ingest from processing; at-least-once; DLQ after N retries |
| automationEngine | Lambda (SQS consumer) | event→action router; idempotent; calls downstream services |
| due-scan worker | Lambda (EventBridge rate) | scans GSI5 `nextAt≤now` → advances sequences via `SCHEDULED_NOTIFICATION` |
| scoringService cron | Lambda (EventBridge nightly) | recompute scores per tenant; emit `customer_activated`/Critical alerts |
| spend-sync | scheduled/MCP | meta-ads → `CAMPAIGN.spend` |

---

## 4. Observability

| Signal | Metric (`M-*`) | Alarm |
|---|---|---|
| Ingest rate / errors | — | error spike |
| Routing latency | M-O2 p95<1s | p95>1s |
| Send success (WA/email/in-app) | — | failure rate |
| DLQ depth | M-O4 | DLQ>0 |
| Funnel counts | M-F* | anomaly drop |
| Scoring job | — | job failure / lag |

CloudWatch dashboards + alarms; structured logs carry `tenantId`+`eventId` (never raw PII).

---

## 5. Multi-tenancy & security

- Every item `TENANT#{tenantId}`-prefixed; `extractTenantId` (server-derived) wins over any client value — no cross-tenant query path exists.
- REST = JWT (`validateToken`); webhooks = provider HMAC, fail-closed `401`; unmapped provider account → `400`.
- RBAC via `rbac.ts` + `PermissionGuard`: ADMIN dashboards; MEMBER sales scoped `assignedTo=me` server-side.
- Consent: no WA/email send without stored `consent`; opt-out ≤1 cycle. PII-minimized payloads; raw-event TTL.
- Secrets (HMAC, WA, Exotel/ElevenLabs, meta-ads) in Secrets Manager; rotated.

---

## 6. Deploy & evolution

- CloudFormation/Lambda (existing). New GSIs added via online stack update (DynamoDB async backfill, no downtime); order: GSI4 before ingest, GSI5 before due-scan, GSI6/7 with lead backfill, GSI8 with referral launch (`database-requirements §5`).
- Each subsystem ships behind a **feature flag**, independently, multi-tenant, consent-safe.
- Backfill Lambda sets legacy leads `leadSource=unknown`, `firstTouch=lastTouch=createdAt`, `dedupeHash`, GSI6/7 keys (idempotent).

Cross-refs: `../technical-designs/technical-designs.md`, `marketing-and-sales/launch-plan-v2/60-automation/README.md`, `../../../implementation/{database,api,infrastructure}-requirements.md`, `../../analytics/dashboard-strategy.md`.
