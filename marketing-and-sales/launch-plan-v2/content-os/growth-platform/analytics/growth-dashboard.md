# Growth Dashboard

> Not to be confused with the legacy KPI doc `../../growth-dashboard.md` (now the metric seed, superseded by `metric-dictionary.md`). **This** is the agent-facing strategic loop view.

**Purpose:** answer "Is the full loop content→DM→demo→trial→activation→paid→referral→expansion compounding, and where is the highest-leverage intervention?" **Audience:** `growth-strategist` (AI Growth VP) + `oracle` + Founder (ADMIN). **Decision supported:** weekly roadmap + experiment reprioritization; the synthesis surface that tells media-buyer / landing-page-builder / experiment-designer what to do. Metrics by ID from `metric-dictionary.md`.

**Refresh:** weekly brief (Monday) + on-demand. **RBAC:** ADMIN-only.

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | Full-loop funnel | M-NS1, M-F1→M-F9 (incl. expansion) | end-to-end `<FunnelWidget/>` with eff-CAC overlay |
| 2 | Leverage finder | biggest drop-off stage (max M-D), lowest M-EF3 channel | callout cards "fix this next" |
| 3 | Content→revenue | M-CR6 ROI rank, top/bottom `OPP-*` | `GlassDataTable` |
| 4 | Cohort compounding | M-A6 retention by signup week (improving?) | `<CohortGrid/>` trend |
| 5 | Unit-econ trend | M-EF6 LTV:CAC, M-EF7 payback over time | trend lines |
| 6 | Experiment lift | active experiments + measured lift (ICE) | `GlassDataTable` (hypothesis, stage, lift, decision) |

---

## 2. Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ FULL LOOP  content→dm→demo→trial→activate→paid→referral→exp  │
│            48k  410  38   17    11      6      2       1      │
├──────────────────────────────┬──────────────────────────────┤
│ LEVERAGE FINDER              │ UNIT-ECON TREND               │
│  ► biggest drop: demo→trial  │  LTV:CAC 2.8→3.4  payback 5m  │
│  ► best channel: referral    │                              │
├──────────────────────────────┴──────────────────────────────┤
│ CONTENT→REVENUE  top OPP-* (scale) / bottom (kill)          │
├──────────────────────────────┬──────────────────────────────┤
│ COHORT COMPOUNDING (improving?)│ EXPERIMENTS  lift · decision │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source |
|---|---|
| Full loop | GSI4 all funnel types in range + `referral_converted` + upgrade |
| Leverage | derived drop-offs (M-D) + M-EF3 per channel |
| Content→revenue | `contentRef=OPP-*` rollup (M-CR6) |
| Cohorts | `/dashboard/cohorts` week-over-week |
| Unit-econ | `CAMPAIGN.spend` + billing time series |
| Experiments | experiment registry (ab-optimizer / experiment-designer output) |

---

## 4. Drill-downs & agent actions

- Leverage callout ▸ → generates `growth-strategist` recommendation → routed to the right agent (media-buyer / landing-page-builder / experiment-designer).
- Top `OPP-*` ▸ → `oracle`/`ab-optimizer`: make more of this framework/character/hook.
- Bottom `OPP-*` ▸ → retire from rotation.
- Drop-off stage ▸ → corresponding role dashboard (e.g. demo→trial → Sales/Product).
- Experiment row ▸ → declare winner, scale, or kill.

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | reuse `…/funnel`, `…/attribution`, `…/cohorts`, `…/efficiency`; new `…/experiments` registry read |
| BE | `growth-strategist` synthesis job writes weekly brief artifact; leverage-finder = derived rules over read-models |
| FE | `pages/crm/dashboards/GrowthDashboard.tsx`; reuse all shared widgets; weekly-brief export |
| Agents | feeds `growth-strategist`, `oracle`, `experiment-designer`, `ab-optimizer` (`../ai-agents/`) |
| Deps | EP-1, EP-2, EP-5, EP-6, EP-7 (all loop stages instrumented) |

---

## 6. The compounding thesis

```
Cheapest channel (content + founder engine + referral) compounds.
Growth dashboard finds the weakest link each week →
  one targeted fix → measure lift → bank it → find next link.
"Done" (gap-analysis §8): trace a reel → … → expansion, all measured/scored/automatable.
```

## 7. Weekly leverage-finder logic

The dashboard computes "the one thing to fix this week" deterministically, then routes it:

```
1 compute drop-off (M-D) at every funnel stage → pick max
2 compute effective-CAC (M-EF3) per channel → pick worst-performing with spend
3 rank OPP-* by M-CR6 → top (scale) + bottom (kill)
4 check cohort trend (M-A6) → improving / flat / declining
5 emit ONE primary recommendation + owner agent
```

| Weakest link | Owner agent | Typical play |
|---|---|---|
| reach→dm | Content Factory / ugc-planner | stronger hook/CTA |
| dm→demo | sdr / landing-page-builder | better qualification + booking page |
| demo→trial | sales / onboarding | demo→trial nurture |
| trial→activation | product | onboarding-CRO fix |
| trial→paid | pricing / paywall | upgrade play |
| paid→referral | CS / referral | referral ask |

## 8. Edge cases

- **Multiple stages tie on drop-off:** break tie by revenue impact (stage closer to `paid` wins).
- **Insufficient data (<30 in a stage):** skip that stage, flag "need more volume".
- **Experiment running on the same lever:** defer new recommendation until result lands (avoid thrash).

Cross-refs: `metric-dictionary.md` (all), `dashboard-strategy.md`, `../gap-analysis.md §7-8`, `growth-intel`/`experiment-design`/`funnel-analysis` skills.
