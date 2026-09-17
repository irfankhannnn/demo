# Attribution — Implementation Plan (Phases 3 + 8)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

Sequenced backend / database / API / UI / infrastructure changes to ship the attribution system, tied to existing epics **EP-1 (attribution)**, **EP-2 (events)**, **EP-7 (dashboard)** in `../../implementation/epics.md`. Additive only — no rewrite. Every task has an acceptance criterion and a metric. Real files to change are cited.

> Build order is fixed by `../gap-analysis.md` §7: **Attribution + Events (P0) first; never build scoring/dashboards before them.** Reuse map: `../../implementation/technical-design.md` §6 (timer = `SCHEDULED_NOTIFICATION`, calls = `ai-calling-service`, tenant = `tenantMiddleware`, auth = `validateToken`).

---

## 1. Workstreams → epics

| WS | Scope | Epic | New/Change |
|---|---|---|---|
| **WS-A** | LEAD attribution fields + capture + backfill | EP-1 | extend `crmDynamodbService.js`, `routes/leads.js`; new backfill Lambda |
| **WS-B** | `MKT_EVENT` ingest + identity stitch + resolver | EP-2 | new `marketingEventsService.js`, `attributionResolver.js`; webhooks |
| **WS-C** | Dashboards (channel/content/campaign/path/first-vs-last) | EP-7 | new dashboard API + `MarketingDashboard.tsx` |
| **WS-D** | Content-ROI (Phase 8) classifier + feedback | EP-7 (+EP-2) | new `contentRoiService.js`; D2 dim toggle |
| **WS-INF** | GSIs, SQS, EventBridge, secrets, observability | EP-1/2/7 | CloudFormation |

---

## 2. WS-A — LEAD attribution (EP-1) — **first**

| Task | File(s) | Acceptance | Metric |
|---|---|---|---|
| A1 Add attribution attrs to lead create/update | `agency-app/api/crmDynamodbService.js` `createLead@2205`, `updateLead@2330` | new leads persist `leadSource,utm*,campaignId,contentRef,consent,firstTouchAt(immutable),lastTouchAt,dedupeHash` | 100% new leads attributed |
| A2 Accept attribution on API + UTM capture | `agency-app/api/routes/leads.js` (POST/PUT); `real-estate-crm-app` signup/lead forms | source/UTM accepted + validated (enum) | % attributed |
| A3 Idempotent upsert-by-phone | `crmDynamodbService.js` | `dedupeHash` upsert; `if_not_exists(firstTouchAt)`; re-submit = no dup | 0 dup leads |
| A4 Source/score query helpers | `crmDynamodbService.js`; `getLeads@2273` filters | "leads by source" + "hottest in stage" return via GSI6/GSI7 | SDR queue works |
| A5 Backfill legacy leads | new `scripts/backfill-lead-attribution.js` (Lambda) | all legacy `EntityType=LEAD` set `leadSource='unknown'`, `firstTouch=lastTouch=createdAt`, `dedupeHash`; idempotent | 100% leads have leadSource |

**Definition of done (EP-1):** every new lead carries source/UTM/content; legacy backfilled; GSI6/GSI7 populated.

---

## 3. WS-B — Events, ingest, identity, resolver (EP-2)

| Task | File(s) | Acceptance | Metric |
|---|---|---|---|
| B1 `marketingEventsService.js` (normalize→dedupe→persist→enqueue) | new `agency-app/api/marketingEventsService.js` | provider payload → canonical `MKT_EVENT`; conditional put on `dedupeKey` | <1s ingest→routed (p95) |
| B2 REST ingest route | new `agency-app/api/routes/marketingEvents.js` (`POST /api/marketing/events`, JWT + `extractTenantId`) | authed event accepted, written, enqueued | events ingested |
| B3 Webhook routes (IG/WhatsApp/Meta Lead Ads/Blotato) | new `agency-app/api/routes/webhooks/*.js` | HMAC verify → tenant resolve → hand to B1; no business logic | signed webhooks only |
| B4 Identity stitch | in B1 + `attributionResolver.js` | event resolves to `LEAD` via `dedupeHash`/anonId; `firstTouchAt` immutable, `lastTouchAt` advances | stitch rate ≥80% |
| B5 `attributionResolver.js` (TOUCHPOINT + ATTRIBUTION_PATH + credit) | new `agency-app/api/attributionResolver.js` | on each touch: write TOUCHPOINT (GSI9), update PATH credit (first/last/U/linear/decay); revenue on `paid` | per-lead path renders |
| B6 Mount routes | `agency-app/api/lambda-handler.js` / `agency-app/api/server.js` | new routes registered behind API GW | 200s in prod |

**Definition of done (EP-2):** events flow IG/FB/WhatsApp/web → `MKT_EVENT` → SQS; resolver builds path; dedupe + tenant isolation proven.

---

## 4. WS-C — Dashboards (EP-7)

| Task | File(s) | Acceptance | Metric |
|---|---|---|---|
| C1 Dashboard read API | new `agency-app/api/routes/marketingDashboard.js` (`GET /dashboard/attribution`, `/funnel`, `/path`) | groupBy=source/content/campaign + model=first/last/multi from GSIs | matches sheet formulas |
| C2 React dashboard | new `agency-app/web/src/pages/crm/MarketingDashboard.tsx` | renders D1–D5 (`dashboards.md`); date-range + tenant scope | live funnel + OPP-* ROI |
| C3 RBAC gate | reuse `agency-app/web/src/utils/rbac.ts`, `PermissionGuard.tsx` | Admin full; Member sees own-leads slice only | no cross-tenant read |
| C4 Path tab on lead detail | `agency-app/web/src/pages/crm/LeadDetails.tsx` | TOUCHPOINT timeline per lead | journey visible |

**Definition of done (EP-7):** D1–D5 live, model-switchable, RBAC-gated.

---

## 5. WS-D — Content-ROI (Phase 8)

| Task | File(s) | Acceptance | Metric |
|---|---|---|---|
| D1 Stamp `contentMeta` (OPP/FW/CT/HK/CTA) on publish | `marketingEventsService.js` + Blotato webhook | 100% `content_published` carry contentMeta | content rollup possible |
| D2 Carry `contentRef` through funnel | ingest normalizers (B1) | paid events trace to originating `OPP-*` ≥80% | content→customer traceable |
| D3 `contentRoiService.js` rollup + classify | new `agency-app/api/contentRoiService.js` (nightly via EventBridge) | per-`OPP-*` reach→paid; class = customer-maker/activation/engagement/dud | weekly content-ROI review |
| D4 D2 dashboard dim toggle | `MarketingDashboard.tsx` | toggle OPP/FW/CT/HK/CTA | winners visible |
| D5 Feedback export to oracle/ab-optimizer | `contentRoiService.js` export | winners list consumable by factory | "make more of what converts" |

---

## 6. WS-INF — infrastructure

| Task | Acceptance |
|---|---|
| INF1 Create GSI4(EventType) **before** ingest; GSI6/GSI7 with backfill; GSI9/GSI10 **before** resolver | CloudFormation online update, no downtime (`database-requirements.md` §5) |
| INF2 SQS queue + DLQ (decouple ingest→process) | at-least-once; failures→DLQ after N; idempotent consumers |
| INF3 EventBridge crons (nightly resolver + content-ROI + trial-inactive scan) | jobs fire per-tenant |
| INF4 Webhook secrets (IG/WhatsApp/Meta/Blotato HMAC) | secrets in env; signatures verified |
| INF5 Observability | CloudWatch: ingest rate, routing latency, DLQ depth, funnel counts, resolver lag |

---

## 7. Sequence & gates

```
WS-INF GSI4 ─► WS-A (EP-1) ─► WS-B (EP-2) ─► WS-D contentMeta ─┐
                  │ backfill        │ resolver+GSI9/10           │
                  └─────────────────┴──► WS-C (EP-7 D1/D3) ──────┴─► WS-C D2/D4/D5 + WS-D classify
```
**Gates (from gap-analysis §7):** do **not** start WS-C content/path panels (D2/D4/D5) before WS-B resolver ships; do **not** start scoring/referral dashboards before attribution+events exist. Each WS is independently shippable, multi-tenant, consent-safe, idempotent.

---

## 8. Cross-cutting acceptance (NFRs)

| NFR | Target | Where |
|---|---|---|
| Multi-tenant isolation | 100% — every key `TENANT#`; no cross-tenant query | all WS |
| Idempotency | duplicate webhook/SQS redelivery → 0 dup leads/events/sends | B1, A3, B5 |
| Consent/PII | no WhatsApp/email without `consent`; `payload` minimized; raw-event TTL ~180d | B1, events.md §5 |
| Latency | <1s ingest→routed p95; speed-to-lead <5min | B1, EP-3 |
| Attribution correctness | rollups use `occurredAt` (provider time) — out-of-order safe | B5 |

Cross-refs: `attribution-architecture.md` (model), `data-model.md` (entities/GSIs), `events.md` (taxonomy), `dashboards.md` (panels), `content-attribution.md` (Phase 8), `../../implementation/{epics,backlog,api-requirements,infrastructure-requirements}.md`.
