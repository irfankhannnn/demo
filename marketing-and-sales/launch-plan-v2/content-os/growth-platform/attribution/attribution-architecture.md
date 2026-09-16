# Attribution Architecture — RealEstateFlow Growth Platform (Phase 3)

**Single source of truth** for how a touch becomes a tracked, attributed customer. This document closes the **P0 "No attribution" gap** (`../gap-analysis.md` §2) and is the spine for content ROI (`content-attribution.md`), scoring, and dashboards. It is **additive** to the real stack — no rewrite.

> **Reads-from / source of truth (do not fork):** `../gap-analysis.md` (build order), `../../automation-os/architecture.md` (event backbone), `../../implementation/technical-design.md` (entities + flows), `../../implementation/database-requirements.md` (GSIs + access patterns), `../../growth-dashboard.md` (metric dictionary), `../../workspaces/realestateflow/01-business-memory.md` (product truth). This file links them; it does not re-derive their definitions.

**Real stack grounding:** Express on AWS Lambda (`server/lambda-handler.js`), DynamoDB single-table (`PK`/`SK`/`GSIn`, `EntityType`, `TENANT#` prefix) via `server/crmDynamodbService.js`; `server/notificationDynamodbService.js` (`SCHEDULED_NOTIFICATION` engine = the timer); `server/tenantMiddleware.js` (`extractTenantId`); JWT `server/middleware/validateToken.js`; `ai-calling-service/`; RBAC `real-estate-crm-app/src/utils/rbac.ts`. **Confirmed gap:** `server/routes/leads.js` leads carry `status/priority/leadType/assignedTo` but **no `leadSource/utm*/campaignId/contentRef/score/firstTouch/lastTouch`** — this is what we add (`data-model.md`).

---

## 1. The attribution chain (what we trace)

```
CONTENT ─► ENGAGEMENT ─► CONVERSATION ─► DEMO ─► TRIAL ─► ACTIVATION ─► PAID ─► REFERRAL ─► EXPANSION
 OPP-*     save/share/    DM→WhatsApp    booked   started  3/4 wk-1     billing  code used  upsell
 reel      comment/follow                 +completed         milestones            (REFERRAL)
   │           │              │             │        │          │          │          │
   ▼           ▼              ▼             ▼        ▼          ▼          ▼          ▼
content_   comment/      dm/lead_magnet  demo_*   trial_   milestone_  paid     referral_  paid
published   (IG insights) _download              started   hit/         (billing) converted (expansion
                          demo_requested          customer_activated     event)              MKT_EVENT)
```
Every arrow is **one `MKT_EVENT`** (`../../implementation/database-requirements.md` §2). Every event may carry `contentRef = OPP-*` (Content-OS ROI link) and `campaignId`. Stage targets live in `../../growth-dashboard.md` §2 — referenced, never duplicated.

---

## 2. Channel + source taxonomy

Tracked channels (per gap-analysis success def): **Instagram, WhatsApp, LinkedIn, Facebook, YouTube, Referrals, Organic, Paid.** These resolve to the canonical `leadSource` enum (frozen in `data-model.md` / `database-requirements.md` §1):

| Channel | `leadSource` values | `utmMedium` example | `channel` (MKT_EVENT) |
|---|---|---|---|
| Instagram | `instagram_dm`, `instagram_comment`, `instagram_bio` | `reel`, `story`, `bio` | `instagram` |
| Facebook | `facebook_ads`, `facebook_group` | `cpc`, `group` | `facebook` |
| WhatsApp | `whatsapp` | `chat`, `broadcast` | `whatsapp` |
| LinkedIn | `linkedin` | `post`, `dm`, `cpc` | `linkedin` |
| YouTube | `youtube` | `video`, `shorts` | `youtube` |
| Referral | `referral`, `founder` | `referral` | `web`/`whatsapp` |
| Organic | `web`, `lead_magnet` | `organic` | `web` |
| Paid | `facebook_ads` (+`campaignId`) | `cpc` | `facebook` |
| — | `unknown` (backfill default) | — | — |

**UTM standard (canonical 4-tuple):** `utmSource` (platform, e.g. `instagram`), `utmMedium` (format, e.g. `reel`/`cpc`), `utmCampaign` (slug → `CAMPAIGN#{id}`), `utmContent` (`OPP-*` or creative variant id). Stored on LEAD and echoed on every MKT_EVENT for join-free rollups. Metric → `growth-dashboard.md` §5 CAC-by-channel.

---

## 3. Attribution models (first vs last vs multi-touch)

All three are computed from the **same** event stream (`MKT_EVENT` ordered by `occurredAt`) — no separate pipelines.

| Model | Definition | Stored where | Primary use | Metric fed |
|---|---|---|---|---|
| **First-touch** | Credit 100% to the **first** attributed event for the lead. | `LEAD.firstTouchAt` + first event's `leadSource`/`contentRef` (immutable, `if_not_exists`). | "What *creates* demand / discovers us." | Channel discovery, content-that-starts-journeys |
| **Last-touch** | Credit 100% to the **last** event before the conversion (paid/demo). | `LEAD.lastTouchAt` + latest event's source. | "What *closes*." Default dashboard view. | Last-touch CAC, demo/paid by source |
| **Multi-touch (position/linear)** | Distribute fractional credit across the ordered touch path. | `ATTRIBUTION_PATH` entity (`data-model.md`). Default model **U-shaped** (40% first, 40% last, 20% middle); linear and time-decay (7-day half-life) selectable per query. | "Full-journey ROI; which content *assists*." | Content-attribution `content-attribution.md` |

**Why all three:** Indian RE buyers cycle through reels → DMs → WhatsApp → demo over days/weeks; last-touch alone under-credits the reel that started it (`OPP-*` content ROI needs multi-touch). Model selectable at query time (`?model=first|last|multi&weighting=u|linear|decay`) on `GET /api/marketing/dashboard/attribution` (`dashboards.md`).

---

## 4. Identity stitching (anonymous → lead → customer)

Identity resolution keys (full schema in `data-model.md` §Identity):

```
ANONYMOUS                 LEAD                       CUSTOMER
 anonId (cookie/click id)  dedupeHash=sha1(tenant+   customerId (billing)
 utm capture on first      normalizedPhone)          stitched on first paid event
 touch (web/ad click)      leadRef=LEAD#{leadId}      keeps full lead path
       │                          ▲                         ▲
       │  resolve on form/DM      │  resolve on signup      │
       └──── phone OR IG handle ──┴──── email/phone ────────┘
```

| Stage | Identity key | Stitch trigger | Idempotency |
|---|---|---|---|
| Anonymous | `anonId` (ad click id / web cookie) + UTM blob | first instrumented touch | event `dedupeKey = {provider}:{providerEventId}` |
| Lead | `dedupeHash = sha1(tenantId + normalizedPhone)`; aliases: IG handle, email | first DM / form / lead-ad / comment-with-contact | upsert `if_not_exists(firstTouchAt)` — first-touch immutable, `lastTouchAt` always advances |
| Customer | `customerId` (billing) joined to `leadRef` | first `paid` event | same dedupeHash carries through |

**Cross-channel merge:** when the same `normalizedPhone` appears on Instagram DM and later WhatsApp, both events resolve to one LEAD via `dedupeHash`; the `ATTRIBUTION_PATH` records both touches with their channels. Anonymous web/ad touches pre-phone are held against `anonId` and back-merged onto the LEAD when phone is captured (UTM blob copied to LEAD if `firstTouch` empty). Multi-tenant: every key prefixed `TENANT#{tenantId}`; **no cross-tenant merge path exists**.

---

## 5. Architecture diagram (plug into event backbone + CRM)

```
 EXTERNAL TOUCHPOINTS                INGEST (Lambda + API GW)            CORE (DynamoDB single-table, TENANT#)
 ┌──────────────────────────┐       ┌───────────────────────────┐      ┌──────────────────────────────────────┐
 │ IG (DM/comment/insights) │webhook│ /api/webhooks/instagram   │      │ LEAD (extended: leadSource,utm*,      │
 │ WhatsApp Business API     │──────►│ /api/webhooks/whatsapp    │──┐   │      campaignId,contentRef,           │
 │ Meta Lead Ads + CAPI      │       │ /api/webhooks/meta-leadads│  │   │      firstTouchAt,lastTouchAt,score)  │
 │ LinkedIn / YouTube         │       │ /api/webhooks/blotato     │  │   │ MKT_EVENT  (the spine)               │
 │ Blotato (post published)  │ REST  │ POST /api/marketing/events│  │   │ TOUCHPOINT (raw per-channel touch)   │
 │ Web signup + UTM (anonId) │──────►│  (JWT) │ (HMAC for hooks) │  │   │ ATTRIBUTION_PATH (ordered touches)   │
 │ Referral link (?ref=code) │       └────────────┬──────────────┘  │   │ CAMPAIGN (spend → CAC)               │
 └──────────────────────────┘                    │ verify+tenant   │   │ SCORE · SEQUENCE_ENROLLMENT (reuse)  │
                                                  ▼                 │   └──────────────────────────────────────┘
                                    ┌──────────────────────────┐    │            ▲          ▲          ▲
                                    │ marketingEventsService.js│    │   write     │  write   │  build   │
                                    │ normalize→dedupe→identity│────┼──► MKT_EVENT │  LEAD    │  PATH    │
                                    │ stitch→persist→enqueue   │    │             │ (upsert) │ (async)  │
                                    └────────────┬─────────────┘    │             │          │          │
                                                 ▼ SQS              │      ┌──────┴───┐  ┌───┴────┐ ┌──┴────────┐
                                    ┌──────────────────────────┐    │      │crmDynamo │  │scoring │ │attribution│
                                    │ Automation Engine        │────┘      │Service   │  │Service │ │Resolver   │
                                    │ (event→rule; idempotent) │            └──────────┘  └────────┘ └───────────┘
                                    └────────────┬─────────────┘                                          │
                                                 ▼                                                        ▼
                              Dashboard API GET /api/marketing/dashboard/attribution ──► MarketingDashboard.tsx
```

**How it plugs in:**
- **Event backbone:** every touch is a `MKT_EVENT` (`../../automation-os/architecture.md`); attribution is a **read model** over that stream + the `ATTRIBUTION_PATH` projection — it adds no new write path beyond entities in `data-model.md`.
- **CRM:** attribution lives **on the existing LEAD** (`server/crmDynamodbService.js` `createLead`/`updateLead`/`getLeads`), so SDR work queues, lead detail (`real-estate-crm-app/src/pages/crm/LeadDetails.tsx`), and reports inherit source/score with zero new join.
- **Timer reuse:** no new scheduler — sequences ride `SCHEDULED_NOTIFICATION` (`notificationDynamodbService.js`).

---

## 6. Consent, PII & idempotency (non-negotiable)

| Concern | Rule | Metric/Task |
|---|---|---|
| Consent | No WhatsApp/email touch without stored `LEAD.consent.{channel}=true`; opt-out honored ≤1 cycle. | EP-1 acceptance |
| PII | `MKT_EVENT.payload` minimized; raw provider bodies TTL'd (~180d); phone stored normalized + hashed for keys. | DB §6 TTL |
| Idempotency | Event: conditional put on `dedupeKey`. Lead: upsert on `dedupeHash`, `firstTouchAt` immutable. Re-delivered webhook = no-op. | NFR (technical-design §5) |
| Multi-tenant | Every PK `TENANT#{tenantId}`; attribution queries can never cross tenants. | tenantMiddleware |

---

## 7. Tie to epics & build order

Per `../gap-analysis.md` §7: **Attribution + Events are P0 — built first; never build scoring/dashboards before them.** This file → **EP-1** (attribution fields) + **EP-2** (events) in `../../implementation/epics.md`; dashboards → **EP-7**. Sequenced acceptance criteria in `implementation-plan.md`. Next: `data-model.md` (entities) → `events.md` (taxonomy) → `dashboards.md` → `content-attribution.md` (Phase 8) → `implementation-plan.md`.
