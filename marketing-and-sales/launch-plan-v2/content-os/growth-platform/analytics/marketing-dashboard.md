# Marketing Dashboard

**Purpose:** answer "Which content (`OPP-*`) and channel creates customers — what do we make more of and spend more on?" **Audience:** growth/content lead + `growth-strategist` / `oracle` / `ab-optimizer` agents (ADMIN). **Decision supported:** the weekly Content Factory + media-buyer brief — scale winners, kill losers. Metrics by ID from `metric-dictionary.md`.

**Refresh:** near-real-time (≤5 min, event spine). **RBAC:** ADMIN-only; spend panels admin-gated. This dashboard owns the **Content-ROI loop** — the most important loop in the platform.

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | Acquisition funnel | M-F1→M-F7 + M-D drop-offs | `<FunnelWidget/>` (full, drop-off labels) |
| 2 | Attribution by source | M-AT1/2/3 leads/paid/conv by `leadSource` | `GlassDataTable` sortable + stacked bar |
| 3 | **Content ROI (`OPP-*`)** | M-CR1–CR6 per recipe/series/character/hook | `GlassDataTable` (leads, demos, paid, lead→demo, demo→paid, ROI rank) |
| 4 | Channel efficiency | M-EF1 CPL, M-EF2 CAC, M-EF3 effective CAC | `GlassDataTable` — lowest eff-CAC highlighted |
| 5 | Engagement/attention | M-E1 hook, M-E2 hold, M-E3–E6 ratios, M-E7 follower growth | multi-line trend |
| 6 | Conversation funnel | M-C1 DM→WA, M-C2 WA→demo | mini funnel |

---

## 2. Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ FUNNEL  reach 48k→dm 410→demo 38→trial 17→paid 6 (drop-off%) │
├──────────────────────────────┬──────────────────────────────┤
│ ATTRIBUTION BY SOURCE        │ CONTENT ROI  OPP-* (THE loop) │
│  ig_dm | lead_magnet | ads…  │  OPP-0142  120→14→4  rank #1  │
│  leads/paid/conv             │  OPP-0098   80→ 6→1  rank #7  │
├──────────────────────────────┴──────────────────────────────┤
│ CHANNEL EFFICIENCY  CPL | CAC | EFFECTIVE-CAC (lowest wins)  │
├──────────────────────────────┬──────────────────────────────┤
│ ENGAGEMENT  hook 46% hold 57%│ DM→WA 41%  WA→demo 26%        │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source / event |
|---|---|
| Funnel | GSI4 `EventType` by `[content_published, dm, demo_booked, trial_started, paid]` in range |
| Attribution source | events ⋈ `LEAD.leadSource` (GSI6) |
| Content ROI | `MKT_EVENT.contentRef = OPP-*` grouped per stage |
| Channel efficiency | `CAMPAIGN.spend` ÷ leads/paid by `campaignId`; eff-CAC = CPL ÷ M-C5 |
| Engagement | IG insights ingested as `content_published` enrichment + `comment`/`dm` |

---

## 4. Drill-downs

- `OPP-*` row ▸ → recipe detail: which hook/character/franchise, reel link, per-stage timeline → **export winner to oracle/ab-optimizer**.
- Source row ▸ → leads list filtered `leadSource=x` (GSI6).
- Channel row ▸ → campaign spend timeline + creative variants (meta-ads).
- Hook-rate dip ▸ → content_published events below threshold for fatigue check.

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | `GET …/funnel`, `…/attribution?groupBy=source\|content`, `…/efficiency?groupBy=channel`, `…/engagement` |
| BE | content-ROI aggregator joining events by `contentRef`; eff-CAC compute; `channel-cac-analysis` skill logic server-side |
| FE | `pages/crm/dashboards/MarketingDashboard.tsx`; reuse `GlassDataTable` (3 tables), `<FunnelWidget/>`, trend charts; CSV export for winners |
| Integrations | meta-ads MCP (spend sync to `CAMPAIGN.spend`); blotato `content_published` |
| Deps | EP-1, EP-2, EP-7; content map = Content OS `OPP-*` recipes |

---

## 6. The loop (why this dashboard matters)

```
OPP-* recipe ─► reel ─► reach ─► DMs ─► demos ─► paid
     ▲                                            │
     └── make more of what books demos ◄──────────┘
          (top M-CR6 rows → oracle / ab-optimizer)
```

## 7. Alert thresholds

| Condition | Metric | Action |
|---|---|---|
| Hook rate < 40% on a series | M-E1 | flag creative fatigue → rotate hook (ab-optimizer) |
| Effective-CAC of a channel > 1.5× best | M-EF3 | "reallocate budget" → media-buyer |
| `OPP-*` lead→demo drops below median | M-CR4 | candidate to retire from rotation |
| DM rate falling 3 wks | M-E6 | top-of-funnel weakening → distribution review |
| Source conversion 0 with leads>20 | M-AT3 | dead channel — investigate or cut |

## 8. Edge cases & empty states

- **Unattributed leads (`leadSource=unknown`):** shown as a distinct row, never silently dropped; backfill banner.
- **`contentRef` missing on event:** rolls into "uncredited content" bucket so funnel totals stay reconciled.
- **Sparse `OPP-*` (<30 reach):** excluded from ROI ranking (insufficient signal), listed separately.
- **No paid yet for a source:** show leads/demos with "no conversions yet", not 0% (avoids killing young channels early).

## 9. Agent handoffs

| Finding | Agent | Payload |
|---|---|---|
| Top M-CR6 `OPP-*` | oracle / ab-optimizer | recipe id + hook/character to scale |
| Best effective-CAC channel | media-buyer | channel + budget recommendation |
| Winning hook | landing-page-builder / ugc-planner | hook copy + angle |

Cross-refs: `metric-dictionary.md §8`, `growth-dashboard.md §6`, `../implementation/technical-designs/technical-designs.md §3.3`, `channel-cac-analysis`/`messaging-optimizer` skills.
