# Dashboard Strategy (Phase 11) — Which Dashboard for Whom

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/README.md`.

The decision layer of the RealEstateFlow Growth Platform. Six role-based dashboards sit on top of the **`MKT_EVENT` event spine + `SCORE` + attribution** (see `../gap-analysis.md`, `../implementation/technical-designs/technical-designs.md`). Every metric on every dashboard resolves to a single canonical definition in **`metric-dictionary.md`** — dashboards never redefine a metric, they only *reference* it by ID (`M-*`). The legacy `../../growth-dashboard.md` KPI doc is the seed; `metric-dictionary.md` is now its canonical superset.

**Design rule:** one event backbone, many lenses. The same `GET /api/marketing/dashboard/*` read-models power all six; each dashboard is a curated React view (`pages/crm/dashboards/*`) gated by `PermissionGuard` + `rbac.ts`.

---

## 1. The six dashboards

| # | Dashboard | File | Primary user | The decision it supports | Refresh |
|---|---|---|---|---|---|
| 1 | **Executive** | `executive-dashboard.md` | Agency Owner / Founder (ADMIN) | "Is the growth engine healthy and efficient? Where do I invest next ₹?" | Daily snapshot + weekly review |
| 2 | **Marketing** | `marketing-dashboard.md` | Growth/content lead, `growth-strategist` agent | "Which content (`OPP-*`) and channel creates customers? What to make/spend more of?" | Near-real-time (≤5 min) |
| 3 | **Sales** | `sales-dashboard.md` | Sales Manager + SDR (ADMIN/MEMBER) | "Which lead do I work next? Where is the pipeline stuck?" | Real-time work queue |
| 4 | **Customer Success** | `customer-success-dashboard.md` | CS / Founder | "Who will churn? Who is ready to expand?" | Daily (post nightly scoring) |
| 5 | **Product** | `product-dashboard.md` | Product/eng owner | "Are trials activating? Which milestone is the drop point?" | Daily |
| 6 | **Growth** | `growth-dashboard.md` | `growth-strategist` / oracle / founder | "Is the full loop content→…→expansion compounding? Where's the leverage?" | Weekly brief + on-demand |

---

## 2. Audience → decision → cadence matrix

| Dashboard | Watches | Acts by | Time horizon |
|---|---|---|---|
| Executive | North-star, MRR/ARR, LTV:CAC, payback, runway-of-leads | Capital allocation, channel go/kill | Month/quarter |
| Marketing | Funnel reach→DM→demo, CAC/eff-CAC per channel, content `OPP-*` ROI | Brief media-buyer + Content Factory | Day/week |
| Sales | Hottest-first queue, demos, no-shows, speed-to-lead | Who to call now | Hour/day |
| Customer Success | Health/risk/expansion/referral scores, churn, NRR | Win-back enroll, expansion play | Day/week |
| Product | Activation rate, week-1 milestone funnel, time-to-activate | Onboarding fixes, milestone nudges | Sprint |
| Growth | Whole loop, cohort retention, experiment lift | Reprioritize roadmap + experiments | Week/month |

---

## 3. Data sources (all behind the same read-models)

| Source | Entity / event | Feeds |
|---|---|---|
| Event spine | `MKT_EVENT` (GSI4 `EventType`) | funnel, attribution, cohorts (all dashboards) |
| Leads | `LEAD` (+ `leadSource`,`contentRef`,`campaignId`,`leadScore`; GSI6/GSI7) | source attribution, sales queue |
| Scores | `SCORE` (lead/activation/health) | sales, CS, product |
| Referrals | `REFERRAL` (GSI8) | growth, exec, CS |
| Campaigns | `CAMPAIGN.spend` (meta-ads MCP) | CAC/LTV/payback (exec, marketing) |
| Billing | `paid` event / billing | MRR/ARR/LTV (exec, growth) |
| Content map | `OPP-*` recipes (Content OS) | content ROI (marketing, growth) |

APIs (existing contracts, `../implementation/api-requirements.md` extended in `technical-designs.md`):
`GET /api/marketing/dashboard/funnel`, `…/attribution?groupBy=source|content`, `…/cohorts`, `…/efficiency` (new), `…/scores` (new), `…/north-star` (new). All `JWT (admin)` + `extractTenantId`.

---

## 4. RBAC gating (`rbac.ts` Admin/Member + `PermissionGuard`)

| Dashboard | ADMIN (Owner/Mgr) | MEMBER (Agent) |
|---|---|---|
| Executive | Full | Hidden (`403`) |
| Marketing | Full | Hidden |
| Sales | Full (all agents) | **Scoped to own assigned leads** (`assignedTo = me`) |
| Customer Success | Full | Hidden |
| Product | Full | Hidden |
| Growth | Full | Hidden |

- Member's Sales view filters server-side by `assignedTo`; never client-side (enforced in the read-model query, not the component).
- Financial panels (MRR/ARR/CAC/LTV) are **ADMIN-only** even within otherwise-visible dashboards — panel-level `PermissionGuard requiredRole="admin"`.
- Every panel carries a **date range + tenant scope** (server-derived `tenantId`, never client-supplied).

---

## 5. Refresh & freshness contract

| Tier | Latency | Mechanism |
|---|---|---|
| Real-time queues (Sales hottest-first) | seconds | GSI7 query on read |
| Near-real-time (Marketing funnel/attribution) | ≤5 min | event spine, eventually-consistent read-models |
| Daily (CS health, Product activation) | nightly | `scoringService` EventBridge cron → `SCORE` |
| Weekly (Growth brief, Exec review) | Monday | `growth-strategist` synthesis over read-models |

Until EP-1/EP-2/EP-7 ship, every metric is tracked **manually in a sheet using the exact `metric-dictionary.md` formulas** so definitions never drift (per legacy `growth-dashboard.md §10`).

---

## 6. Implementation footprint (reuse, don't rebuild)

- **Backend:** extend `apps/crm/server/routes/` with `routes/marketing/dashboard.js` read-models; aggregate from GSI4/6/7/8 via `crmDynamodbService.js` helpers. No new datastore.
- **Frontend:** `pages/crm/dashboards/{Executive,Marketing,Sales,CustomerSuccess,Product,Growth}Dashboard.tsx`; reuse **`GlassDataTable`** for all tabular panels, `PermissionGuard` for gating, existing chart primitives. New shared `<FunnelWidget/>`, `<MetricCard/>`, `<CohortGrid/>`, `<ScoreBand/>`.
- **Sequencing:** dashboards grow across EP-7 as EP-1/2/5/6 land (see `../implementation/roadmaps/roadmap-30-60-90-180.md`). Minimal funnel+sources ships Sprint 1; full suite by Day 90.

---

## 7. Cross-references

| Need | Doc |
|---|---|
| Canonical metric formulas | `metric-dictionary.md` |
| Why dashboards exist (gap) | `../gap-analysis.md` §2 P2, §5 |
| Entities/GSIs/APIs | `../implementation/technical-designs/technical-designs.md`, `database-requirements` |
| When each lands | `../implementation/roadmaps/roadmap-30-60-90-180.md` |
| Legacy KPI seed | `../../growth-dashboard.md` |
