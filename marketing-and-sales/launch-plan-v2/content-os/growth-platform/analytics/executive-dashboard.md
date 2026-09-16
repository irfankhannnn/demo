# Executive Dashboard

**Purpose:** answer "Is the growth engine healthy and efficient, and where does the next ₹ go?" in one glance. **Audience:** Agency Owner / Founder (ADMIN only). **Decision supported:** capital allocation across channels, go/kill on spend, hiring/runway calls. All metrics reference `metric-dictionary.md` by ID — no redefinitions here.

**Refresh:** daily snapshot, weekly review (`growth-strategist` Monday brief). **RBAC:** ADMIN-only; every financial panel is `PermissionGuard requiredRole="admin"`. Members get `403`.

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | North-star band | M-NS1 (qualified demos/wk), M-NS2 (new paid/mo) | two big `<MetricCard/>` with WoW ▲▼ sparkline |
| 2 | Revenue | M-R1 MRR, M-R2 ARR, M-R3 new MRR, M-R6 NRR | stacked area (new/expansion/churn) + MRR number |
| 3 | Unit economics | M-EF6 LTV:CAC (gauge vs 3:1), M-EF7 payback (vs 6mo), M-EF4 blended CAC, M-EF5 LTV | gauge + 4 `<MetricCard/>` |
| 4 | Channel mix | M-AT4 paid-by-channel, M-EF3 effective CAC per channel | donut + `GlassDataTable` |
| 5 | Funnel summary | M-F1→M-F8 reach→referral with M-D drop-offs | `<FunnelWidget/>` (compact) |
| 6 | Growth health | M-A5 churn, M-R7 quick ratio, referral % (M-F8/M-F7) | trend lines |

---

## 2. Layout (ASCII)

```
┌────────────────────────────────────────────────────────────┐
│ NORTH-STAR  [Qual demos/wk 18 ▲]   [New paid/mo 6 ▲]        │
├──────────────────────────────┬─────────────────────────────┤
│ REVENUE  MRR ₹X ARR ₹Y       │ UNIT ECON                   │
│  ▁▃▅▇ new/expansion/churn     │  LTV:CAC 3.4:1 ◔  payback 5m│
│  NRR 108%                     │  CAC ₹—  LTV ₹—             │
├──────────────────────────────┴─────────────────────────────┤
│ CHANNEL MIX (donut) │ EFFECTIVE CAC TABLE (GlassDataTable)  │
├─────────────────────┴───────────────────────────────────────┤
│ FUNNEL  reach→dm→demo→trial→paid→referral (drop-off%)       │
├─────────────────────────────────────────────────────────────┤
│ GROWTH HEALTH  churn 4% · quick-ratio 4.2 · referral 22%    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source |
|---|---|
| North-star | `MKT_EVENT(demo_booked)` ⋈ `SCORE`, `MKT_EVENT(paid)` |
| Revenue | billing ⋈ `paid`/upgrade/cancel |
| Unit econ | `CAMPAIGN.spend` (meta-ads MCP) ÷ `paid` by `campaignId`; billing for LTV |
| Channel mix | events ⋈ `LEAD.leadSource`/`campaignId` (GSI6) |
| Funnel | GSI4 by type, range |

---

## 4. Drill-downs

- North-star ▸ → Growth dashboard full loop.
- Channel row ▸ → Marketing dashboard filtered to that channel (effective-CAC breakdown).
- MRR ▸ → cohort retention (`/dashboard/cohorts`).
- Churn ▸ → Customer Success at-risk list.

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | `GET /api/marketing/dashboard/north-star`, `…/efficiency` (CAC/LTV/payback/NRR), reuse `…/funnel` |
| BE | `routes/marketing/dashboard.js` exec read-model; LTV/CAC aggregation joining `CAMPAIGN.spend` + billing; cache 5–15 min |
| FE | `pages/crm/dashboards/ExecutiveDashboard.tsx`; `<MetricCard/>`, `<Gauge/>`, `<FunnelWidget/>`, `GlassDataTable` (channel) |
| RBAC | route-level admin guard + panel `PermissionGuard requiredRole="admin"` |
| Deps | EP-1, EP-2, EP-6, EP-7 (`../implementation/epics/epics.md`); needs `CAMPAIGN.spend` live |

## 6. Alert thresholds (founder-facing)

| Condition | Metric | Action surfaced |
|---|---|---|
| LTV:CAC < 3:1 for 2 wks | M-EF6 | "Unit economics breaking — review channel spend" → Growth dashboard |
| Payback > 6 mo | M-EF7 | "Acquisition too expensive — pause weakest channel" |
| NRR < 100% | M-R6 | "Net contraction — CS expansion/win-back push" → CS dashboard |
| Churn > 5% (mo) | M-A5 | "Retention leak — investigate cohort" → CS/Product |
| New paid stalled WoW | M-NS2 | "Pipeline flat — check funnel drop-off" → Marketing |

Thresholds are tenant-overridable; alerts post as in-app notifications (`notificationDynamodbService`) to ADMIN only.

## 7. Edge cases & empty states

- **Pre-instrumentation (EP-1/2/7 not live):** panels render from the manual sheet using `metric-dictionary.md` formulas; banner "Estimated — instrumentation pending".
- **No spend data (`CAMPAIGN.spend` empty):** CAC/LTV panels show "Connect meta-ads MCP" CTA instead of `NaN`.
- **Thin data (<10 customers):** unit-econ panels show ranges, not point estimates, to avoid false precision.
- **New tenant:** zero-state with onboarding checklist linking to attribution setup.

## 8. Decision cadence

| Cadence | Founder action |
|---|---|
| Daily | glance north-star + at-risk count |
| Weekly | review with `growth-strategist` brief; channel reallocation |
| Monthly | LTV/CAC/cohort review + roadmap re-prioritization (`oracle`) |

Cross-refs: `metric-dictionary.md`, `dashboard-strategy.md`, `growth-dashboard.md`.
