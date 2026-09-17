# Implementation — Database Requirements

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

DynamoDB **single-table** design (existing CRM table, `CRM_TABLE_NAME`). All items keyed on `PK`/`SK`, typed via `EntityType`, scoped with the `TENANT#{tenantId}` prefix — consistent with `crmDynamodbService.js` and `notificationDynamodbService.js`. **Additive only**: no existing attribute is removed or repurposed. New access patterns are served by new GSIs that follow the existing naming (`GSInPK`/`GSInSK`).

> Existing GSIs in use (verified): `GSI1` owner-property / unread-notifications, `GSI2` status-index, `GSI3` search-index. New GSIs start at `GSI4`.

---

## 1. LEAD — new attributes (additive)

Existing item (`routes/leads.js`, `crmDynamodbService.js`) has `name, phone, email, leadType, status, priority, assignedTo, createdBy, createdAt, updatedAt`. Add:

| Attribute | Type | Required | Default | Validation |
|---|---|---|---|---|
| `leadSource` | S (enum) | on create going forward | `unknown` (backfill) | one of the source taxonomy below |
| `utmSource` | S | no | `null` | ≤64 chars |
| `utmMedium` | S | no | `null` | ≤64 chars |
| `utmCampaign` | S | no | `null` | ≤128 chars |
| `utmContent` | S | no | `null` | ≤128 chars |
| `campaignId` | S | no | `null` | FK → `CAMPAIGN#{id}` |
| `contentRef` | S | no | `null` | `OPP-*` or post/reel id |
| `consent` | M | no | `{whatsapp:false,email:false}` | `{whatsapp:BOOL, email:BOOL, capturedAt:S, source:S}` |
| `leadScore` | N | no | `0` | 0–100, denormalized from `SCORE` |
| `activationScore` | N | no | `null` | 0–100 |
| `firstTouchAt` | S (ISO) | no | createdAt | immutable once set (`if_not_exists`) |
| `lastTouchAt` | S (ISO) | no | createdAt | advances on each event |
| `dedupeHash` | S | yes (new path) | `sha1(tenantId+normPhone)` | for idempotent upsert |

**Source enum (`leadSource`):**
`instagram_dm`, `instagram_comment`, `instagram_bio`, `facebook_ads`, `facebook_group`, `whatsapp`, `linkedin`, `youtube`, `referral`, `founder`, `lead_magnet`, `web`, `unknown`.

---

## 2. New entities

### MKT_EVENT
```
PK = TENANT#{tenantId}#EVENTS
SK = EVENT#{occurredAt}#{eventId}
EntityType = MKT_EVENT
```
| Attr | Type | Notes |
|---|---|---|
| `eventId` | S (uuid) | |
| `type` | S enum | content_published, comment, dm, lead_magnet_download, demo_requested, demo_booked, demo_completed, trial_started, milestone_hit, trial_inactive, customer_activated, referral_sent, referral_converted, paid |
| `channel` | S enum | instagram, facebook, whatsapp, linkedin, youtube, web, ai_call, email |
| `leadRef` | S? | `LEAD#{leadId}` |
| `contentRef` | S? | `OPP-*` / post id |
| `campaignId` | S? | |
| `occurredAt` | S ISO | provider event time |
| `ingestedAt` | S ISO | |
| `dedupeKey` | S | `{provider}:{providerEventId}` |
| `payload` | M | PII-minimized |
| `ttl` | N? | epoch sec (raw-event cost control) |

### SEQUENCE_ENROLLMENT
```
PK = TENANT#{tenantId}#SEQ#{leadId}
SK = SEQ#{seqId}
EntityType = SEQUENCE_ENROLLMENT
```
| Attr | Type | Notes |
|---|---|---|
| `seqId` | S enum | onboarding_7d, nurture, demo_reminder, winback, post_activation |
| `step` | N | current step |
| `nextAt` | S ISO | next fire time |
| `status` | S enum | active, completed, cancelled, opted_out |
| `channel` | S enum | whatsapp, email, in_app, ai_call |
| `enrolledAt`/`lastStepAt` | S ISO | |
| `cancelReason` | S? | replied, converted, opt_out, manual |
| `sentTokens` | SS | step tokens already sent (idempotency) |

### SCORE
```
PK = TENANT#{tenantId}#SCORE#{entityId}
SK = SCORE#{entityType}    (LEAD | CUSTOMER)
EntityType = SCORE
```
`leadScore`(N), `activationScore`(N), `healthScore`(N), `signals`(M), `computedAt`(S ISO), `version`(S).

### REFERRAL
```
PK = TENANT#{tenantId}#REF#{code}
SK = REF#{code}
EntityType = REFERRAL
```
`code`(S), `referrerId`(S), `refereeLeadId`(S?), `status`(S enum: issued|clicked|signed_up|converted|rewarded), `reward`(M), `createdAt`(S), `convertedAt`(S?).

### CAMPAIGN
```
PK = TENANT#{tenantId}#CAMPAIGN#{campaignId}
SK = CAMPAIGN#{campaignId}
EntityType = CAMPAIGN
```
`name`(S), `channel`(S enum), `spend`(N), `utm`(M), `status`(S enum), `createdAt`(S).

---

## 3. New GSIs and the access pattern each serves

| GSI | PK | SK | Access pattern served |
|---|---|---|---|
| **GSI4 — EventType** | `TENANT#{t}#TYPE#{type}` | `{occurredAt}` | Funnel/time rollups: count events of a type in a date range (dashboard funnel, attribution). |
| **GSI5 — SeqDue** | `TENANT#{t}#SEQDUE` | `{nextAt}#{leadId}#{seqId}` | Due-sequence worker: scan enrollments where `nextAt ≤ now` (mirrors scheduled-notification due scan). |
| **GSI6 — LeadSource** | `TENANT#{t}#SOURCE#{source}` | `{createdAt}` | Source reports: list/count leads by `leadSource` over time. |
| **GSI7 — LeadStageScore** | `TENANT#{t}#STAGE#{status}` | `{leadScore padded}` | Hottest-first: leads in a stage ordered by score (SDR work queue). |
| **GSI8 — ReferralStatus** | `TENANT#{t}#REFSTATUS#{status}` | `{createdAt}` | Referral pipeline: list referrals by status (issued→converted). |

Notes:
- `leadScore` in GSI7 SK is **zero-padded** (e.g. `092`) so DynamoDB lexical sort matches numeric order; query `ScanIndexForward=false` for hottest-first.
- GSI4 sparse on `MKT_EVENT` only; GSI5 sparse on active `SEQUENCE_ENROLLMENT` only (drop GSI keys when `status≠active`, same REMOVE technique used for unread notifications).
- Reuse existing `SCHEDULED_NOTIFICATION` for the actual timed send; GSI5 is the enrollment index that feeds it.

---

## 4. Access pattern catalog (summary)

| # | Pattern | Index / key |
|---|---|---|
| 1 | Get lead by id | Base table `PK=TENANT#{t}#LEAD#{id}` |
| 2 | Upsert lead by phone (idempotent) | Base + `dedupeHash` condition |
| 3 | Leads by source over time | GSI6 |
| 4 | Hottest leads in a stage | GSI7 |
| 5 | Event stream (chronological) per tenant | Base `PK=TENANT#{t}#EVENTS`, SK range |
| 6 | Events of a type in range (funnel) | GSI4 |
| 7 | Due sequence steps | GSI5 (`nextAt ≤ now`) |
| 8 | Referrals by status | GSI8 |
| 9 | Score for lead/customer | Base `PK=TENANT#{t}#SCORE#{id}` |
| 10 | Campaign + spend (CAC) | Base `PK=TENANT#{t}#CAMPAIGN#{id}` |

---

## 5. Migration / backfill plan

1. **Schema is implicit** (DynamoDB) — no ALTER. New GSIs created via CloudFormation update (online, no downtime; back-fill is async per DynamoDB).
2. **Backfill leads:** one-off Lambda scans `EntityType=LEAD`, sets `leadSource='unknown'`, `firstTouchAt=lastTouchAt=createdAt`, computes `dedupeHash`, projects GSI6/GSI7 keys. Idempotent (skip if `leadSource` present). Batch with `BatchWriteItem`, throttle to stay within capacity.
3. **Dual-write window:** new lead-create path writes attribution from day 1; backfill covers history.
4. **Order:** create GSI4 (events) before ingest goes live; GSI5 before sequence worker; GSI6/7 with the lead backfill; GSI8 with referral launch.

---

## 6. TTL, retention & cost

- **Raw events TTL:** set `ttl` on high-volume low-value events (e.g. `comment`, `content_published`) at ~180 days; keep funnel-critical events (`demo_booked`, `trial_started`, `paid`) without TTL for cohort history.
- **Capacity:** on-demand billing (matches current posture) avoids hot-partition provisioning; partition keys are tenant-scoped so write distribution is even across tenants.
- **GSI cost:** each GSI is an extra write; keep them **sparse** (only project keys when needed) to minimize cost — GSI4/5/6/7/8 are all sparse by design.
- **Item size:** keep `payload` lean (PII-minimized) to control storage and RCU/WCU.

Cross-refs: `technical-design.md` (entity rationale + scoring), `api-requirements.md` (read/write contracts), `infrastructure-requirements.md` (GSI provisioning + backfill Lambda).
