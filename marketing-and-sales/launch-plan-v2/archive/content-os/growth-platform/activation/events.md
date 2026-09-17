# Activation Event Taxonomy — RealEstateFlow

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/posthog-event-map.md`.

The canonical activation events: JSON schemas, where each fires from the **product**, and which feed the score / dashboard. All events are `MKT_EVENT` items (`technical-design.md` §2.2) — `PK=TENANT#{t}#EVENTS`, `SK=EVENT#{occurredAt}#{eventId}`, `EntityType=MKT_EVENT`, queryable by `GSI-EventType`. Events map to real features (`01-business-memory.md` §3). They feed the activation score (`milestones-and-score.md` §2) and the dashboard funnel (`activation-framework.md` §4). Consent-safe: payloads are PII-minimized.

---

## 1. Base envelope (every activation event)

```json
{
  "eventId": "uuid",
  "type": "first_ai_call",
  "channel": "ai_call",
  "tenantId": "TENANT#abc123",
  "entityId": "LEAD#l_789",            // trial user / brokerage account
  "leadRef": "LEAD#l_789",
  "occurredAt": "2026-06-18T07:42:11Z", // product/provider time — drives funnel
  "ingestedAt": "2026-06-18T07:42:12Z",
  "dedupeKey": "product:ai_call:l_789:2026-06-18",
  "source": "product",                  // product | ai-calling-service | scoringService
  "payload": { /* event-specific, PII-min */ },
  "ttl": 1781000000                     // optional epoch TTL on raw events
}
```

`dedupeKey` makes ingest idempotent (conditional PutItem, `technical-design.md` §5). `occurredAt` = product time so out-of-order delivery still rolls up.

---

## 2. Activation event catalogue

| `type` | Fired from (product surface / file) | When | Feeds | Milestone |
|---|---|---|---|---|
| `trial_started` | account create / plan=trial (`routes/auth`, RegisterAdmin) | trial begins | funnel entry, TTV clock | — |
| `login` | auth success (`validateToken` issue / session) | each login | RECENCY, distinct-day count | M7 (first) |
| `leads_imported` | bulk import / lead create (`routes/leads.js`, LeadList) | leads added (emit running count) | M1 when count≥10 | M1 |
| `followup_set` | reminder/meeting create (`ScheduleMeetingModal`, `notifications.js`) | first follow-up reminder | M2 | M2 |
| `first_ai_call` | **`agency-app/ai-calling/` callback** (`aiCallingInternal.js`) | first AI call placed/qualified | **AHA**, M3 | M3 |
| `team_invited` | invite sent + accepted (`InviteManagement`, RBAC role set) | member invited w/ role | M4 (agency) | M4 |
| `buyer_matched` | buyer↔property match action (PropertyDetails / BuyerList) | first match | M4′ (solo) | M4′ |
| `khata_setup` | khata entry / settlement (`KhataEntryForm`, `khata.js`) | first khata entry | M5, BREADTH | M5 |
| `dashboard_viewed` | CRM/Business dashboard mount (`CRMDashboard`, `BusinessAnalytics`) | first view | M6, BREADTH | M6 |
| `milestone_hit` | **`scoringService`** (derived) | any milestone flips 0→1 | dashboard, nudge triggers | — |
| `customer_activated` | **`scoringService`** (derived) | core-4 met + score≥70 | NSAM, aha-celebration | — |
| `trial_inactive` | **`scoringService` nightly** (derived) | no login 48h in trial | stuck/win-back triggers | — |

Derived events (`milestone_hit`, `customer_activated`, `trial_inactive`) are emitted by `scoringService`, not the UI — they are the automation triggers (`workflows.md`).

---

## 3. Schemas (key activation events)

**`leads_imported`** (M1 — pipeline exists):
```json
{ "type": "leads_imported", "channel": "web",
  "payload": { "addedCount": 12, "totalLeads": 12, "method": "bulk_import|manual",
               "crossedTen": true } }
```
Fire on every add with running `totalLeads`; `crossedTen` flips M1. No lead PII in payload (count only).

**`first_ai_call`** (M3 — AHA):
```json
{ "type": "first_ai_call", "channel": "ai_call", "source": "ai-calling-service",
  "payload": { "callId": "call_55", "outcome": "completed|qualified|no_answer",
               "durationSec": 64, "transcriptAvailable": true, "live_with_cs": true } }
```
Fired from the `agency-app/ai-calling/` outcome callback (Exotel+ElevenLabs). `live_with_cs` lets the dashboard separate self-serve aha vs assisted aha.

**`team_invited`** (M4 — agency):
```json
{ "type": "team_invited", "channel": "web",
  "payload": { "inviteeRole": "MEMBER|ADMIN", "accepted": true, "teamSizeNow": 3 } }
```
Role from `rbac.ts`; counts toward agency core-4 only when `accepted=true`.

**`customer_activated`** (derived — north-star):
```json
{ "type": "customer_activated", "channel": "ai_call|web", "source": "scoringService",
  "payload": { "activationScore": 92, "milestoneCountCore4": 4, "segment": "agency",
               "ttvHoursToAha": 28, "activatedAt": "2026-06-18T07:42:12Z" } }
```
Drives NSAM (`activation-framework.md` §6) and arms `WF-ACT-05` aha-celebration + post-win referral eligibility.

**`trial_inactive`** (derived — early warning):
```json
{ "type": "trial_inactive", "channel": "web", "source": "scoringService",
  "payload": { "hoursSinceLogin": 51, "stuckAtStep": "aha", "band": "at_risk" } }
```

---

## 4. Event → score → surface mapping

| Event | Updates on SCORE entity | Dashboard widget | Workflow armed |
|---|---|---|---|
| `leads_imported`(≥10) | M1 hit, MILESTONES +18 | setup-completion funnel | clears `WF-ACT-03` if stuck |
| `followup_set` | M2 hit +12, BREADTH | milestone heatmap | — |
| `first_ai_call` | M3 hit +25, aha=true | Day-2 AI-call rate | `WF-ACT-05` celebration |
| `team_invited`/`buyer_matched` | M4/M4′ +15 | core-4 completion | — |
| `login` | RECENCY, distinct-days | habit/return curve | clears win-back |
| `milestone_hit` | recompute band | progress bar | `WF-ACT-02` next-nudge |
| `customer_activated` | activated=true, band | NSAM tile | `WF-ACT-05` |
| `trial_inactive` | band→at_risk, stuckAtStep | at-risk queue | `WF-ACT-03/04` recovery |

---

## 5. Firing & consistency rules

1. **Where to instrument:** UI/route handlers emit raw events via `POST /api/marketing/events` (REST, JWT) or the `agency-app/ai-calling/` callback; `marketingEventsService` normalizes + dedupes (`technical-design.md` §1). UI never computes scores — it only emits facts.
2. **Idempotent:** `dedupeKey` includes the day for once-per-day events (`first_ai_call`, `login` collapses to first/day for distinct-day count).
3. **Consent-safe:** payloads carry counts/enums, never lead/buyer PII; raw events TTL'd. Sends triggered downstream are consent-gated (`technical-design.md` §7).
4. **Multi-tenant:** every event `TENANT#`-prefixed; no cross-tenant read path.
5. **Acceptance:** events `leads_imported`, `followup_set`, `first_ai_call`, `team_invited`/`buyer_matched`, `login` MUST fire in staging before EP-5 scoring ships (`implementation.md` AC-2).
