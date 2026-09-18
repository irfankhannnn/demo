# Attribution Data Model — DynamoDB Single-Table (Phase 3)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

Complete `TENANT#`-scoped entities for attribution, **additive** to the existing CRM table (`CRM_TABLE_NAME`) accessed via `agency-app/api/crmDynamodbService.js`. No attribute is removed/repurposed. Naming follows the verified convention: `PK`/`SK`/`GSInPK`/`GSInSK`, `EntityType`, `TENANT#{tenantId}` prefix, ISO-8601 `createdAt`/`updatedAt`.

> **Single source of truth for the shared entities** (`LEAD` ext, `MKT_EVENT`, `SCORE`, `SEQUENCE_ENROLLMENT`, `REFERRAL`, `CAMPAIGN`, GSI4–GSI8) is `../../implementation/database-requirements.md`. This file **links** them and adds the two attribution-only projections (`TOUCHPOINT`, `ATTRIBUTION_PATH`) plus identity-resolution keys. Existing GSIs verified: `GSI1` owner/unread, `GSI2` status, `GSI3` search → new GSIs start at **GSI4**.

---

## 1. LEAD — attribution extensions (additive)

Existing item (`agency-app/api/routes/leads.js`, `agency-app/api/crmDynamodbService.js` `createLead@2205`/`updateLead@2330`): `name, phone, email, leadType, status, priority, assignedTo, createdBy, createdAt, updatedAt`. **Add** (full table in `database-requirements.md` §1 — do not fork; summary for self-containment):

```
PK = TENANT#{tenantId}#LEAD#{leadId}     SK = LEAD#{leadId}     EntityType = LEAD
```
| Attr | Type | Req | Default | Notes |
|---|---|---|---|---|
| `leadSource` | S enum | new path | `unknown` | source taxonomy (`attribution-architecture.md` §2) |
| `utmSource/utmMedium/utmCampaign/utmContent` | S | no | null | canonical 4-tuple; `utmContent`=`OPP-*`/variant |
| `campaignId` | S | no | null | FK → `CAMPAIGN#{id}` |
| `contentRef` | S | no | null | `OPP-*`/post id — Content-OS ROI link |
| `consent` | M | no | `{whatsapp:false,email:false}` | `{whatsapp:BOOL,email:BOOL,capturedAt:S,source:S}` |
| `leadScore` | N | no | 0 | denormalized from SCORE (hottest-first sort) |
| `activationScore` | N | no | null | trial users |
| `firstTouchAt` | S ISO | no | createdAt | **immutable** (`if_not_exists`) — first-touch model |
| `lastTouchAt` | S ISO | no | createdAt | advances every event — last-touch model |
| `firstTouchSource`/`lastTouchSource` | S | no | null | denormalized source for join-free attribution reads |
| `dedupeHash` | S | yes (new) | `sha1(tenantId+normPhone)` | idempotent upsert + identity key |
| `anonId` | S | no | null | pre-phone ad/web click id (stitch) |

---

## 2. MKT_EVENT — the spine (reuse, do not re-create)

Defined in `database-requirements.md` §2 / `technical-design.md` §2.2. The attribution system **consumes** it, adds no new write path.
```
PK = TENANT#{tenantId}#EVENTS          SK = EVENT#{occurredAt}#{eventId}    EntityType = MKT_EVENT
GSI4 (EventType): GSI4PK = TENANT#{t}#TYPE#{type}   GSI4SK = {occurredAt}
```
Key attrs for attribution: `type`, `channel`, `leadRef`, `contentRef`, `campaignId`, `occurredAt` (provider time — drives ordering), `dedupeKey` ({provider}:{providerEventId}), `payload` (PII-min), `ttl?`. Full type/channel enums → `events.md`.

---

## 3. TOUCHPOINT — raw per-channel touch (attribution-only, NEW)

One row per identity-resolved touch, optimized for **per-lead path reconstruction** without scanning the global event stream. Sparse — written only when an event resolves to a `leadRef` (or `anonId`).
```
PK = TENANT#{tenantId}#TP#{leadRef|anonId}     SK = TP#{occurredAt}#{eventId}
EntityType = TOUCHPOINT
GSI9 (TouchByContent): GSI9PK = TENANT#{t}#CONTENT#{contentRef}   GSI9SK = {occurredAt}
```
| Attr | Type | Notes |
|---|---|---|
| `eventId` | S | FK → MKT_EVENT |
| `leadRef` | S? | `LEAD#{leadId}` (null while anonymous) |
| `anonId` | S? | pre-resolution |
| `channel` | S enum | instagram/whatsapp/linkedin/facebook/youtube/web/ai_call/email |
| `leadSource` | S enum | resolved source |
| `contentRef` | S? | `OPP-*` |
| `campaignId` | S? | |
| `stage` | S enum | content/engagement/conversation/demo/trial/activation/paid/referral/expansion |
| `occurredAt` | S ISO | |
| `position` | N | 1..N order in path (set by resolver) |

**Access patterns:** (a) all touches for a lead, chronological → base `PK=TENANT#{t}#TP#{leadRef}`, SK range; (b) all touches for a content piece → **GSI9** (content-attribution per `OPP-*`). On phone-capture, `TP#{anonId}` rows are rewritten to `TP#{leadRef}` (back-merge).

---

## 4. ATTRIBUTION_PATH — resolved journey + credit (NEW)

One row per lead summarizing the **ordered path** and **fractional credit** under each model — the read model that powers multi-touch dashboards and content ROI without recomputing on every query.
```
PK = TENANT#{tenantId}#PATH#{leadId}     SK = PATH#{leadId}     EntityType = ATTRIBUTION_PATH
GSI10 (PathByOutcome): GSI10PK = TENANT#{t}#OUTCOME#{outcome}   GSI10SK = {convertedAt|updatedAt}
```
| Attr | Type | Notes |
|---|---|---|
| `leadId` | S | |
| `outcome` | S enum | open/demo/trial/paid/churned |
| `touches` | L<M> | ordered `[{seq,channel,leadSource,contentRef,campaignId,occurredAt}]` (PII-min) |
| `firstTouch` | M | `{channel,leadSource,contentRef,occurredAt}` |
| `lastTouch` | M | same shape |
| `creditFirst` | M | `{ "<contentRef|source>": 1.0 }` (100% first) |
| `creditLast` | M | `{ ...: 1.0 }` (100% last) |
| `creditU` | M | U-shaped 40/40/20 split across touches |
| `creditLinear` | M | equal split |
| `creditDecay` | M | 7-day half-life weights |
| `revenue` | N? | LTV/MRR attributed when `outcome=paid` (for content ROI) |
| `computedAt` | S ISO | resolver version stamp |

**Access patterns:** (a) one lead's full credited path → base PK; (b) all paths with a given outcome in range → **GSI10** (e.g. all `paid` paths this month → roll up credit per `OPP-*`/source for `content-attribution.md`). Recomputed by `attributionResolver` on each new touch (delta) and nightly (full).

---

## 5. CAMPAIGN, SCORE, SEQUENCE_ENROLLMENT, REFERRAL (reuse)

All defined in `database-requirements.md` §2 — referenced here for completeness; **do not re-create**:
- **CAMPAIGN** `PK=TENANT#{t}#CAMPAIGN#{id}` — `name, channel, spend, utm, status`. `spend` (updated via `meta-ads` MCP) ÷ attributed `paid` = CAC (`growth-dashboard.md` §5).
- **SCORE** `PK=TENANT#{t}#SCORE#{entityId}` — leadScore/activationScore/healthScore (denormalized onto LEAD).
- **SEQUENCE_ENROLLMENT** `PK=TENANT#{t}#SEQ#{leadId}` — rides `SCHEDULED_NOTIFICATION` timer; not attribution-owned.
- **REFERRAL** `PK=TENANT#{t}#REF#{code}` — referral-channel attribution (closes referral loop in the chain).

---

## 6. GSI catalog (attribution view)

| GSI | PK | SK | Access pattern | Sparse? |
|---|---|---|---|---|
| GSI4 EventType (reuse) | `TENANT#{t}#TYPE#{type}` | `{occurredAt}` | funnel/time rollups by event type | MKT_EVENT only |
| GSI6 LeadSource (reuse) | `TENANT#{t}#SOURCE#{source}` | `{createdAt}` | leads by source over time | LEAD |
| GSI7 LeadStageScore (reuse) | `TENANT#{t}#STAGE#{status}` | `{leadScore padded}` | hottest-first work queue | LEAD |
| **GSI9 TouchByContent (NEW)** | `TENANT#{t}#CONTENT#{contentRef}` | `{occurredAt}` | all touches for an `OPP-*` (content ROI) | TOUCHPOINT |
| **GSI10 PathByOutcome (NEW)** | `TENANT#{t}#OUTCOME#{outcome}` | `{convertedAt}` | all paths by outcome (multi-touch rollup) | ATTRIBUTION_PATH |

`leadScore` in GSI7 SK zero-padded (`092`) for lexical=numeric sort; query `ScanIndexForward=false`. GSI9/10 sparse (keys projected only on resolved touches/paths) to control write cost (`database-requirements.md` §6).

---

## 7. Identity resolution keys (the stitching contract)

| Layer | Primary key | Aliases (resolve to primary) | Set when |
|---|---|---|---|
| Anonymous | `anonId` | ad click id, web cookie | first instrumented touch |
| Lead | `dedupeHash = sha1(tenantId + normalizedPhone)` | IG handle, email, `anonId` | first phone/handle/email captured |
| Customer | `customerId` (billing) | `leadRef`, `dedupeHash` | first `paid` event |

**Normalization:** phone → E.164 (India `+91` default), lowercase email, lowercase IG handle. **Merge rule:** matching `dedupeHash` ⇒ same LEAD; conflicting aliases logged for manual review, never silently merged across tenants. Resolver writes/updates `TOUCHPOINT` + `ATTRIBUTION_PATH` and denormalizes `firstTouch*`/`lastTouch*`/`leadScore` onto LEAD.

---

## 8. Migration / backfill

Per `database-requirements.md` §5: implicit schema (no ALTER); GSIs via CloudFormation (online). Backfill Lambda scans `EntityType=LEAD`: set `leadSource='unknown'`, `firstTouchAt=lastTouchAt=createdAt`, compute `dedupeHash`, project GSI6/7; idempotent (skip if `leadSource` present). Create **GSI4 before ingest**, **GSI9/GSI10 before the resolver** goes live. ATTRIBUTION_PATH/TOUCHPOINT are forward-only (built from events from launch); historical leads show `unknown` until re-touched. Tasks → `implementation-plan.md`.
