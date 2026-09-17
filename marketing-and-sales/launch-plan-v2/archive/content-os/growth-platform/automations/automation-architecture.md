# Automation Architecture (Phase 9 — Production Runtime)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/60-automation/README.md`.

The **production automation runtime** for the RealEstateFlow Growth Platform: the event-driven engine that turns every funnel action into a `MKT_EVENT`, evaluates per-tenant rules, and fires consent-safe actions (notify, WhatsApp, AI call, enroll sequence, score, reward). This **supersedes and extends** `marketing-and-sales/launch-plan-v2/60-automation/README.md` (the additive integration sketch) and is grounded in the real stack and the data model in `../../implementation/technical-design.md`. Workflows live in `workflow-catalog.md`; agents that operate it in `../ai-agents/ai-agent-architecture.md`.

> **Stance:** additive only. No rewrite of existing services. New `EntityType`s + thin Lambda routes + reuse of `notificationDynamodbService.js` (`SCHEDULED_NOTIFICATION`) as the timer, `agency-app/ai-calling/` as the call channel, `tenantMiddleware.js`/`validateToken.js` for tenancy/auth, and the `meta-ads`/`blotato`/`higgsfield` MCPs for ad/publish/content actions. New infra: SQS, EventBridge, DLQ.

---

## 1. Runtime topology

```
 SOURCES                INGEST (Lambda+APIGW)        BACKBONE             RULES ENGINE              ACTIONS
 ┌──────────────┐  HMAC  ┌──────────────────┐  put   ┌──────────┐ poll  ┌────────────────┐       ┌──────────────────────────┐
 │ IG/FB Graph  │──────► │ /api/webhooks/*  │──────► │MKT_EVENT │─────► │ automationEngine│──────►│ actionLibrary (idempotent)│
 │ WhatsApp BA  │        │ (verify sig,     │ cond.  │ (single  │  SQS  │  loadRules()    │       │ ├ lead.upsert/update      │
 │ Meta LeadAds │        │  extractTenantId)│  put   │  table,  │  +DLQ │  match(on/if)   │       │ ├ notify (in-app)         │
 │ Blotato(MCP) │        ├──────────────────┤        │ TENANT#) │       │  guard(consent, │       │ ├ whatsapp.send (consent) │
 │ Web (UTM)    │  JWT   │ POST /api/       │        └────┬─────┘       │   idempotency,  │       │ ├ email.send (SES,consent)│
 │ Product app  │──────► │ marketing/events │             │             │   rate-limit)   │       │ ├ aiCall.place (Exotel)   │
 └──────────────┘        └────────┬─────────┘             │             │  do(actions[])  │       │ ├ sequence.enroll/cancel  │
                                  │ marketingEventsService │             └───────┬────────┘       │ ├ score.recompute         │
                                  │ normalize+dedupe+put   │                     │ emits           │ ├ referral.issue/reward   │
                                  └────────────────────────┘                     │ follow-up       │ └ mcp.adAction (HIL-gated)│
                                                                                  │ MKT_EVENT       └──────────┬───────────────┘
   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
   ▼ writes back to single table → feeds read models
 ┌──────────────┐   EventBridge cron (nightly/15m)   ┌──────────────────┐        ┌────────────────────────────┐
 │ scheduler    │◄───────────────────────────────────│ scoringService   │        │ Dashboard API (read models)│
 │ sequenceWkr  │  scans GSI-SeqDue / SCHEDULED       │ (lead/act/health)│        │ GET /api/marketing/dash/*  │
 └──────────────┘  → due steps → actionLibrary        └──────────────────┘        └────────────────────────────┘
```

Two clocks drive the runtime: **event-time** (webhook/REST → SQS → engine, p95 < 1s) and **wall-time** (EventBridge cron → scoring + due-sequence scan). Every action re-emits a `MKT_EVENT` so the audit trail, funnel, and dashboards are one event log.

---

## 2. Reuse vs new (component map)

| Capability | Reuse (exists in repo) | New |
|---|---|---|
| Tenant resolution | `tenantMiddleware.js` / `extractTenantId` | — |
| REST auth | `middleware/validateToken.js` (JWT) | webhook HMAC verifier (`routes/webhooks/*`) |
| Event store | DynamoDB single table | `EntityType: MKT_EVENT` (+ `GSI-EventType`) |
| Timer / scheduled sends | `notificationDynamodbService.js` (`SCHEDULED_NOTIFICATION`, `SK=DUE#{dueAt}#{id}`) | `sequenceService.js` (thin enroll/advance/cancel layer) |
| In-app notify | `notificationDynamodbService.js` (`GSI1PK=TENANT#{t}#UNREAD`) | — |
| AI call channel | `agency-app/ai-calling/` (Exotel+ElevenLabs) | async trigger hook + outcome event |
| Lead CRUD | `crmDynamodbService.js` / `routes/leads.js` | attribution fields, `GSI-LeadSource`, `GSI-LeadScore` |
| Publish / ads / content | `blotato`, `meta-ads`, `higgsfield` MCPs | MCP action adapters (HIL-gated) |
| Decoupling | — | SQS main queue + DLQ (INF) |
| Wall-clock triggers | — | EventBridge rules (nightly scoring, 15-min due-scan) |
| Rule evaluation | — | `automationEngine.js` + `RULE` entity |
| Scoring | — | `scoringService.js` (`SCORE` entity) |
| Referral | — | `referralService.js` (`REFERRAL` entity) |
| Consent ledger | (consent map on LEAD) | consent gate in actionLibrary |
| Observability | CloudWatch (Lambda) | custom metrics + DLQ alarms + event audit |

Engineering epics: **E-AUTO-1** ingest+SQS, **E-AUTO-2** rules engine+RULE entity, **E-AUTO-3** action library, **E-AUTO-4** scheduler/sequences, **E-AUTO-5** observability/DLQ. (Land in `../../implementation/`.)

---

## 3. The rules engine

### 3.1 Rule schema (`EntityType: RULE`, per-tenant)

```
PK = TENANT#{tenantId}#RULE#{ruleId}   SK = RULE#{ruleId}   EntityType = RULE
GSI-RuleOn: GSI7PK = TENANT#{tenantId}#ON#{eventType}   GSI7SK = priority#{ruleId}
```

```json
{
  "ruleId": "WF-LEAD-CAPTURED",
  "tenantId": "TENANT#acme",
  "enabled": true,
  "priority": 100,                       // lower = first; deterministic ordering
  "on": "lead_magnet_download",          // MKT_EVENT.type this rule subscribes to
  "if": {                                // ALL must pass (AND); arrays = IN
    "channel": ["web","whatsapp"],
    "payload.consent.whatsapp": true,
    "lead.leadScore": { "gte": 0 }
  },
  "do": [
    {"action": "lead.upsert",   "args": {"source": "lead_magnet"}},
    {"action": "score.recompute","args": {"entity": "lead"}},
    {"action": "sequence.enroll","args": {"seqId": "nurture", "channel": "whatsapp"}},
    {"action": "notify",        "args": {"to": "owner_role", "template": "new_lead"}}
  ],
  "guardrails": {
    "idempotencyKey": "rule:WF-LEAD-CAPTURED:{leadRef}:{eventId}",
    "dedupeWindowSec": 86400,
    "rateLimit": {"perLeadPerDay": 1},
    "requiresConsent": ["whatsapp"],
    "hil": false                          // human-in-loop not required
  }
}
```

### 3.2 Evaluation algorithm

```
on MKT_EVENT e (consumed from SQS):
  1. resolve tenant (e.tenantId) and identity (e.leadRef via dedupeHash if absent)
  2. rules = query GSI-RuleOn[tenant, e.type] where enabled, ORDER BY priority,ruleId
  3. for rule in rules:
       if not match(rule.if, e, leadCtx):       continue      # condition fail
       if guard.requiresConsent unmet:           skip+emit consent_blocked
       if guard.rateLimit exceeded:              skip+emit rate_limited
       if seen(guard.idempotencyKey):            skip (no-op)   # already ran
       for action in rule.do:
            actionLibrary.run(action, e, leadCtx)               # each idempotent
       mark seen(guard.idempotencyKey, ttl=dedupeWindowSec)
  4. each action re-emits a follow-up MKT_EVENT (audit + chaining)
```

`match()` supports `eq` (scalar/IN-array), `gte/lte/gt/lt`, `exists`, `regex` (keyword intent), dot-paths into `payload`/`lead`. Conditions are pure (no side effects) so evaluation is safe to retry.

### 3.3 Idempotency

- **Ingest:** conditional `PutItem` on `dedupeKey = {provider}:{providerEventId}` — re-delivered webhook = no-op (`attribute_not_exists`).
- **Rule fire:** `idempotencyKey` written as a `RULE_RUN` marker (`PK=TENANT#{t}#RULERUN`, `SK={key}`, TTL); re-consumed SQS message finds the marker and skips.
- **Lead upsert:** keyed on `dedupeHash = sha1(tenant+normalizedPhone)`; `firstTouchAt` via `if_not_exists`, `lastTouchAt` always advances.
- **Sequence step:** each step carries `stepToken`; worker conditionally writes `SENT#{stepToken}` before send.
- SQS is at-least-once → **every** action MUST be idempotent. Ordering uses `occurredAt` (provider time), not delivery order.

### 3.4 Cancellation

Sequences/automations are cancellable so we never spam a converted/opted-out lead:
- `sequence.cancel(leadId, seqId, reason)` sets enrollment `status=cancelled` and **REMOVEs the future `SCHEDULED_NOTIFICATION`** (same REMOVE-on-`GSI1` pattern `notificationDynamodbService.js` already uses).
- Cancel triggers (cross-cutting, evaluated as rules): `dm_replied`, `login`, `paid`, `opt_out`, `manual`. e.g. a `paid` event cancels all `nurture`/`winback` enrollments for that lead.
- Opt-out (`STOP` keyword / unsubscribe) sets `consent.whatsapp=false`/`consent.email=false`, cancels active enrollments, honored within ≤1 cycle (NFR).

---

## 4. The scheduler (EventBridge + SCHEDULED_NOTIFICATION reuse)

The sequence/automation timer is the **existing** scheduled-notification machinery — we do not build a new scheduler, we drive it.

| Clock | Mechanism | Job |
|---|---|---|
| **15-min due-scan** | EventBridge → `sequenceWorker` Lambda | scan `GSI-SeqDue (GSI5PK=TENANT#{t}#SEQDUE, SK={nextAt})` + `SCHEDULED_NOTIFICATION (SK=DUE#{dueAt})`; fire due step via actionLibrary; advance `step`+`nextAt` or complete |
| **Nightly (IST 02:00)** | EventBridge → `scoringService` | recompute lead/activation/health scores; emit `trial_inactive`/`at_risk` events that re-enter the engine |
| **Hourly** | EventBridge → insights puller | batched IG/Meta insights → `impression`/`engagement` events (TTL'd) |

Enroll flow: `sequenceService.enroll()` writes one `SEQUENCE_ENROLLMENT` **and** one paired `SCHEDULED_NOTIFICATION` for `nextAt=now`. The due-scan fires step 1, writes the next `SCHEDULED_NOTIFICATION`, repeat until `completed`/`cancelled`. This reuses the typed-event worker (`RENT_EXPIRY_SOON`, `MEETING_REMINDER_15M`…) verbatim, adding sequence step types.

---

## 5. Action library

Every action is idempotent, tenant-scoped, consent-aware, and emits a follow-up `MKT_EVENT`.

| Action | Impl (reuse/new) | Channel/Entity | Consent | HIL |
|---|---|---|---|---|
| `lead.upsert` | `crmDynamodbService` (extend) | LEAD (+attribution) | — | no |
| `lead.update` | `crmDynamodbService` | LEAD (status/stage/assign) | — | no |
| `notify` | `notificationDynamodbService` (reuse) | in-app (`GSI1 UNREAD`) | — | no |
| `whatsapp.send` | `notificationDynamodbService` + WA BA provider | WhatsApp | **requires `consent.whatsapp`** | no |
| `email.send` | SES (new adapter) | email | **requires `consent.email`** | no |
| `aiCall.place` | `agency-app/ai-calling/` (reuse, async) | Exotel+ElevenLabs | phone present + (intent OR consent) | no |
| `sequence.enroll` | `sequenceService` (new) | SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION | per channel | no |
| `sequence.cancel` | `sequenceService` | REMOVE scheduled | — | no |
| `score.recompute` | `scoringService` (new) | SCORE (+denorm LEAD.leadScore) | — | no |
| `referral.issue` / `referral.reward` | `referralService` (new) | REFERRAL (reward on `paid` only) | — | no |
| `mcp.publish` | `blotato` MCP | IG/FB/LI | — | **yes (publish)** |
| `mcp.adAction` | `meta-ads` MCP | campaign budget/lead-form | — | **yes (spend)** |
| `mcp.genAsset` | `higgsfield` MCP | content asset | — | **yes (publish path)** |

**Guardrails (system-wide):** consent-gating on every outbound message; per-lead/day rate caps on auto-DM and calls; spend + publish actions are **human-in-the-loop** (queued as `APPROVAL` items, not auto-executed); `quietHours` (no WhatsApp 21:00–09:00 IST) on scheduled sends.

---

## 6. Multi-tenancy, consent, observability, DLQ

**Multi-tenancy.** Every item keyed `TENANT#{tenantId}`; rules/scores/sequences are per-tenant; no cross-tenant query path exists (GSIs are tenant-prefixed). Webhook routes resolve tenant before any write via `extractTenantId` (mapped from provider page/account id → tenant).

**Consent.** `LEAD.consent = {whatsapp, email, capturedAt, source, ip?}`. actionLibrary refuses any `whatsapp.send`/`email.send` without a true flag and re-emits `consent_blocked` for audit. Opt-out flips the flag + cancels enrollments. WhatsApp uses opt-in templates only; PII in `payload` is minimized; raw provider bodies are TTL'd, not retained.

**Observability.** CloudWatch custom metrics: `ingest.count`, `ingest.dupeNoop`, `route.latencyMs` (p95 target <1s), `action.{type}.count/err`, `send.count`, `dlq.depth`, `funnel.{stage}.count`. Every action emits a follow-up `MKT_EVENT` → the event log **is** the audit trail (who/what/when/why-skipped). Alarms: DLQ depth > 0, route latency p95 > 1s, consent_blocked spike.

**DLQ.** SQS main queue → `maxReceiveCount=5` → DLQ. DLQ alarm pages on-call. Poison messages inspected via event id; reprocessed after fix using stored canonical `MKT_EVENT` (idempotency makes replay safe). Engine failures never lose events — the `MKT_EVENT` is persisted **before** enqueue, so the table is the durable source even if SQS drops.

---

## 7. Sequence diagrams

**A) Inbound IG DM → attributed lead → auto-qualify (event-time)**

```
IG user   IG Graph   /webhooks/instagram  marketingEvents  SQS   automationEngine  crmDynamodb  ai-calling  SDR
  │ "PRICE"  │              │                   │            │          │              │            │         │
  │─────────►│  webhook+sig │                   │            │          │              │            │         │
  │          │─────────────►│ verify HMAC       │            │          │              │            │         │
  │          │              │ extractTenantId   │            │          │              │            │         │
  │          │              │──normalize+put───►│ MKT_EVENT  │          │              │            │         │
  │          │              │                   │ (dm,dedupe)│          │              │            │         │
  │          │              │                   │──enqueue──►│──poll───►│ match WF-DM  │            │         │
  │          │              │                   │            │          │ upsert Lead─►│            │         │
  │◄── auto-reply (keyword template, rate-limited) ──────────┼──────────┤(ig_dm,OPP-*) │            │         │
  │          │              │                   │            │          │ if INTENT &  │            │         │
  │          │              │                   │            │          │ consent ─────┼──async────►│ place   │
  │          │              │                   │            │          │ notify ──────┼────────────┼────────►│ "hot"
  │          │              │                   │            │          │ emit dm+call_placed MKT_EVENT       │
```

**B) Trial-inactive → win-back (wall-time, cancellable)**

```
EventBridge(nightly)→ scoringService.recompute(tenant)
        │ reads login MKT_EVENTs + trial_started
        ▼ for each trial lead, no login 48h:
   emit MKT_EVENT(trial_inactive) ─► automationEngine: match WF-TRIAL-INACTIVE
        ▼ guard: consent.whatsapp? rateCap? not-converted?
   sequence.enroll(winback, whatsapp) → SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION(now)
        ▼ EventBridge(15m due-scan) → sequenceWorker
   step1 personal nudge → (T+2d) setup-call offer → (T+4d) founder escalation
        ▼ on login│reply│paid event
   automationEngine: match cancel-rule → sequence.cancel(reason) → REMOVE scheduled
```

**C) Attribution rollup (read model)**

```
GET /api/marketing/dashboard/attribution?from&to&groupBy=source|content
        ▼ for type in [dm, demo_booked, trial_started, paid]:
   query GSI-EventType (GSI4PK=TENANT#{t}#TYPE#{type}, SK between from..to)
        ▼ join denormalized leadSource / contentRef(OPP-*) on each event
   aggregate count by source AND by OPP-* per funnel stage
        ▼ derive leads→demo→paid per source/content → content-ROI rows
   return funnel matrix → MarketingDashboard.tsx
```

---

## 8. Cross-links

- Workflows (12, WF-*): `workflow-catalog.md`
- Operating agents (6, AG-*): `../ai-agents/ai-agent-architecture.md`
- Event taxonomy + dedupe keys: `../attribution/events.md`
- Data model (LEAD/MKT_EVENT/SEQUENCE_ENROLLMENT/SCORE/REFERRAL/CAMPAIGN + GSIs): `../../implementation/technical-design.md` §2
- Scores consumed as conditions: `../lead-scoring/lead-scoring-engine.md`, `../activation/milestones-and-score.md`, `../customer-scoring/` (health/risk/expansion)
- Superseded sketch: `marketing-and-sales/launch-plan-v2/60-automation/README.md` (keep as pointer)
