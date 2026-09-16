# Attribution Dashboards (Phase 3 — EP-7)

Role-based attribution surfaces served by `GET /api/marketing/dashboard/*` (read models over `MKT_EVENT`/`ATTRIBUTION_PATH`/`TOUCHPOINT` via GSIs) and rendered in `real-estate-crm-app/src/pages/crm/MarketingDashboard.tsx`. **Metric definitions are owned by `../../growth-dashboard.md`** (the metric dictionary) — this file specifies the *attribution-specific* panels, drill-downs, data sources, and RBAC. Layout shell → `growth-dashboard.md` §8.

> Every panel: date-range + tenant scope (`extractTenantId`); admin-gated via `PermissionGuard` (`real-estate-crm-app/src/utils/rbac.ts`). Model selector `first | last | multi` on attribution panels (`attribution-architecture.md` §3).

---

## 1. Dashboard inventory

| ID | Dashboard | Question answered | Primary source | RBAC |
|---|---|---|---|---|
| **D1** | Attribution by **channel** | Which channel creates demos/customers? | GSI4 (EventType) + GSI6 (LeadSource) | Admin |
| **D2** | Attribution by **content (`OPP-*`)** | Which content creates customers vs engagement? | GSI9 (TouchByContent) + ATTRIBUTION_PATH | Admin |
| **D3** | Attribution by **campaign** | ROAS/CAC per paid+organic campaign | CAMPAIGN.spend + GSI4 `paid` | Admin |
| **D4** | **Path / journey** view | Full multi-touch journey of a lead/cohort | TOUCHPOINT (base PK) + ATTRIBUTION_PATH | Admin / lead-owner |
| **D5** | **First vs Last touch** compare | Discovery channels vs closing channels | ATTRIBUTION_PATH `creditFirst`/`creditLast` | Admin |

---

## 2. D1 — Attribution by channel

`GET /api/marketing/dashboard/attribution?groupBy=source&model=last&from&to`

| Metric (per channel: instagram/whatsapp/linkedin/facebook/youtube/referral/organic/paid) | Formula | Source |
|---|---|---|
| Leads | `count(LEAD by leadSource)` | GSI6 |
| Demos booked | `count(demo_booked attributed)` | GSI4 |
| Paid | `count(paid attributed)` | GSI4 + ATTRIBUTION_PATH |
| Lead→Demo % · Demo→Paid % | ratios | derived |
| CAC by channel | `CAMPAIGN.spend(channel) ÷ paid(channel)` | `growth-dashboard.md` §5 |
| Effective CAC | `CPL ÷ trial→paid` | `channel-cac-analysis` skill |

**Viz:** stacked funnel bars per channel + sortable table; LTV:CAC badge (≥3:1 green). **Drill-down:** channel → list of contributing `OPP-*` (jumps to D2) → lead list (CRM `LeadList.tsx`). Default model = **last-touch**; toggle to first/multi.

---

## 3. D2 — Attribution by content (`OPP-*`) — the most important panel

`GET /api/marketing/dashboard/attribution?groupBy=content&model=multi&from&to`

Per `OPP-*` (and rollup by framework / character / hook — see `content-attribution.md`):

| Column | Formula | Source |
|---|---|---|
| Reach / impressions | `sum(impression by contentRef)` | GSI4/GSI9 |
| Engagements | `sum(engagement+comment)` | GSI9 |
| DMs | `count(dm by contentRef)` | GSI9 |
| Demos | `count(demo_booked by contentRef)` | GSI9 |
| Trials | `count(trial_started attributed)` | ATTRIBUTION_PATH |
| **Paid (customers)** | `Σ creditMulti for paid paths touching contentRef` | ATTRIBUTION_PATH |
| **Attributed revenue** | `Σ (path.revenue × credit[contentRef])` | ATTRIBUTION_PATH |
| Content-ROI rating | customer-maker / activation-contributor / engagement-only (`content-attribution.md` §4) | classifier |

**Viz:** ranked table (sort by attributed revenue or paid) + bubble chart (x=reach, y=paid, size=revenue) — separates viral-but-no-revenue from quiet-but-converts. **Drill-down:** `OPP-*` → its journey paths (D4) → leads. **Feedback loop:** "winners" badge feeds `oracle`/`ab-optimizer` (`growth-dashboard.md` §6).

---

## 4. D3 — Attribution by campaign

`GET /api/marketing/dashboard/attribution?groupBy=campaign&from&to`

| Metric | Formula | Source |
|---|---|---|
| Spend | `CAMPAIGN.spend` (meta-ads MCP sync) | CAMPAIGN |
| Leads / CPL | `spend ÷ leads(campaignId)` | GSI6 + CAMPAIGN |
| Paid / CAC | `spend ÷ paid(campaignId)` | GSI4 + CAMPAIGN |
| ROAS | `attributed revenue ÷ spend` | ATTRIBUTION_PATH |
| Payback | `CAC ÷ monthly gross profit` | `growth-dashboard.md` §5 |

**Viz:** table + CAC-vs-LTV scatter. **Drill-down:** campaign → ad sets (paid) / posts (organic) → leads. **Budget action:** lowest effective-CAC campaign flagged for scaling (`ab-optimizer`).

---

## 5. D4 — Path / journey view

`GET /api/marketing/dashboard/path?leadId=` (single) or `?cohort=paid&from&to` (aggregate)

- **Single lead:** horizontal timeline of `TOUCHPOINT` rows — channel + `OPP-*` + stage at each step, first/last flagged, credit % per touch. Renders on `LeadDetails.tsx` as an "Attribution" tab.
- **Cohort (Sankey):** common journeys for an outcome (e.g. `paid`) — `instagram reel → DM → WhatsApp → demo → trial → paid` with volume on each edge; reveals the dominant winning path and where paths leak.

**Source:** TOUCHPOINT base PK (single) / GSI10 PathByOutcome (cohort). **Drill-down:** edge → leads following that path. **RBAC:** Admin sees all; a Member sees only own-assigned leads' paths (lead ownership from `assignedTo`).

---

## 6. D5 — First vs Last touch comparison

`GET /api/marketing/dashboard/attribution?groupBy=source&model=compare`

Two side-by-side bars per channel: **first-touch credit** (discovery) vs **last-touch credit** (closing), from `ATTRIBUTION_PATH.creditFirst` / `creditLast`. Surfaces the classic gap: e.g. *Instagram reels discover, WhatsApp closes* → don't cut reel budget on last-touch CAC alone. **Viz:** diverging bar + "discovery index" = firstTouch% − lastTouch% per channel. **Drill-down:** channel → the `OPP-*` doing the discovering (D2).

---

## 7. Data sources, refresh, RBAC

| Panel | API | GSI / source | Refresh |
|---|---|---|---|
| D1 channel | `/dashboard/attribution?groupBy=source` | GSI4 + GSI6 | near-real-time (event lag s) |
| D2 content | `/dashboard/attribution?groupBy=content` | GSI9 + ATTRIBUTION_PATH | on resolver run + nightly |
| D3 campaign | `/dashboard/attribution?groupBy=campaign` | CAMPAIGN + GSI4 | spend sync daily (meta-ads) |
| D4 path | `/dashboard/path` | TOUCHPOINT / GSI10 | on event |
| D5 first/last | `/dashboard/attribution?model=compare` | ATTRIBUTION_PATH | nightly resolver |

**RBAC:** all dashboards Admin-gated (`PermissionGuard`); Members get a read-only "my leads' source" slice only. Every query forced through `extractTenantId` — no cross-tenant read path. Eventual consistency (seconds) acceptable; read models tolerate lag (`technical-design.md` §5).

---

## 8. Cadence & dependencies

Cadence (`growth-dashboard.md` §9): **daily** demos/DMs by source; **weekly** D2 content-`OPP-*` ROI review (drives Content OS); **monthly** D3 CAC/LTV. **Dependency (`growth-dashboard.md` §10):** D1/D3 need EP-1+EP-2; D2/D4/D5 additionally need the resolver (TOUCHPOINT/ATTRIBUTION_PATH, this `attribution/` build) + EP-7 UI. Until shipped, compute these exact formulas in a sheet so definitions never drift. Build sequence → `implementation-plan.md`.
