# Growth Dashboard — KPI System (Phase 13)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/weekly-scorecard.md`.

The single scoreboard for the whole GTM OS. Metrics flow Content → Attention → Distribution → Sales, instrumented by the Automation OS (`MKT_EVENT` events + scoring + attribution, all `TENANT#`-scoped). North-star first, then the funnel spine, then engagement, conversion, efficiency, retention, and the Content-ROI loop. Every metric below has a **formula**, a **target**, and a **data source/event** so it is buildable against `implementation/`.

---

## 1. North-Star Metric

> **Qualified demos booked per week.**
Leading indicator of revenue; an honest reflection of content → conversation → demo working end-to-end.

| | Definition |
|---|---|
| Formula | `count(MKT_EVENT.type = demo_booked AND lead.score ≥ 40) per ISO week` |
| Target (Mo3) | **20+/week** |
| Source | `MKT_EVENT(demo_booked)` joined to `SCORE` |

**Secondary (lagging) north-star:** New paying customers / month — `count(MKT_EVENT.type=paid per month)`; target predictable & growing.

---

## 2. The Funnel (the spine)

| Stage | Metric | Formula | Target (Mo3) | Source / event |
|---|---|---|---|---|
| Reach | reel reach, hook rate, hold rate | hook rate = `3s_views / impressions` (>45%); hold = `avg_watch / length` (>55%) | growing | IG / `content_published` |
| Engagement | saves, shares, comments, follows | per-reach ratios (below) | rising | IG metrics |
| Conversations | DMs started, DM→WhatsApp rate | DM→WA = `wa_optins / dms` | 40% rate; 40+/mo | `MKT_EVENT(dm)` |
| Demos | demos booked, no-show rate | no-show = `no_shows / demos_booked` (<25%) | 20+/mo | `demo_booked`,`demo_completed` |
| Trials | trials started, week-1 activation | activation = `activated / trials` (3 of 4 milestones) | 10+/mo | `trial_started`,`milestone_hit` |
| Paid | trial→paid, new customers | `paid / trials_started` (25–35%) | predictable | `paid` / billing |
| Referrals | referrals sent, referral % of new | `referral_paid / total_paid` (20%+) | 20%+ | `REFERRAL`, `referral_converted` |

Drop-off % computed between adjacent stages; surfaced as the funnel widget (`/api/marketing/dashboard/funnel`).

---

## 3. Engagement & Attention KPIs

| Metric | Formula | Target |
|---|---|---|
| Hook rate | 3s views ÷ impressions | >45% |
| Hold rate | avg watch time ÷ video length | >55% |
| Saves/reach | saves ÷ reach | >1.5% |
| Shares/reach | shares ÷ reach | >1% |
| Comments/reach | comments ÷ reach | >0.5% |
| DM rate | DMs ÷ reach | trending up |
| Follower growth | net new follows ÷ week | +1k/mo early |
| Returning-viewer % | repeat viewers ÷ total viewers | rising |

Source: IG insights ingested as `content_published` enrichment + `comment`/`dm` events.

---

## 4. Conversion KPIs

| Step | Formula | Target |
|---|---|---|
| DM → WhatsApp | wa_optins ÷ dms | 40% |
| WhatsApp → demo | demos_booked ÷ wa_conversations | 25% |
| Demo → trial | trials ÷ demos_completed | 45% |
| Trial → paid | paid ÷ trials | 25–35% |
| Paid → referral | referrals_sent ÷ new_customers | 50% sent |

(Stage-level targets mirrored in `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/customer-journey.md`.)

---

## 5. Efficiency KPIs

| Metric | Formula | Target |
|---|---|---|
| **CAC** | total acquisition spend ÷ new customers (by channel) | falling over time |
| **CAC by channel** | `CAMPAIGN.spend(channel) ÷ paid(channel)` | compare channels |
| **CPL** | spend ÷ leads (by channel) | benchmark |
| **Effective CAC by channel** | `CPL ÷ trial-to-paid rate` (see `channel-cac-analysis` skill) | lowest wins budget |
| **LTV** | avg revenue/customer × gross margin × avg lifetime (months) | grow |
| **LTV:CAC** | LTV ÷ CAC | **≥ 3:1** |
| **Payback period** | CAC ÷ monthly gross profit per customer | **< 6 mo** |

Source: `CAMPAIGN.spend` (updated via `meta-ads` MCP) ÷ `MKT_EVENT(paid)` counts by `campaignId`/`leadSource`.

---

## 6. Content ROI — the Content-OS loop (`OPP-*`)

The loop that closes content to revenue:
```
OPP-* recipe ─► reel ─► reach ─► DMs ─► demos ─► trials ─► paid
     ▲                                                       │
     └────── make more of what books demos (oracle/ab) ◄─────┘
```
Per `OPP-*` / series / character / hook, compute: `reach → DMs → demos → paid` attributed via `MKT_EVENT.contentRef`. Output table (`/api/marketing/dashboard/attribution?groupBy=content`): `leads, demos, paid, leadToDemo, demoToPaid` per `OPP-*`. Winners feed `oracle`/`ab-optimizer` → produce more of that framework/character/hook. **This is the single most important loop in the dashboard** — it tells the Content OS what to make next.

---

## 7. Retention / health KPIs

| Metric | Formula | Target |
|---|---|---|
| Activation rate | activated ÷ trials (3 of 4 wk-1 milestones) | >40% |
| Week-1 milestones | login, data added, AI call, day-3 return | 3/4 |
| Login frequency | active days ÷ 28 | rising |
| Churn (monthly) | churned ÷ start-of-month customers | <5% |
| NPS | promoters% − detractors% | >40 |
| Health-score distribution | % Healthy / At-risk / Critical | shift to Healthy |

Source: product login events (`MKT_EVENT`/AI-call usage) + `SCORE.healthScore`.

---

## 8. Dashboard layout (maps to `implementation/ui-requirements.md`)

```
┌───────────────────────────────────────────────────────────────┐
│ 1. NORTH-STAR  [Qualified demos / wk: 18 ▲]   [New paid/mo: 6] │
├───────────────────────────────────────────────────────────────┤
│ 2. FUNNEL  reach→dm→demo→trial→paid→referral  (with drop-off%) │
├───────────────────────────┬───────────────────────────────────┤
│ 3. ATTRIBUTION by source  │ 3b. ATTRIBUTION by content OPP-*   │
├───────────────────────────┴───────────────────────────────────┤
│ 4. EFFICIENCY  [CAC] [LTV] [LTV:CAC ≥3:1] [Payback <6mo]       │
├───────────────────────────────────────────────────────────────┤
│ 5. COHORT RETENTION (trial→paid by signup week)               │
├───────────────────────────┬───────────────────────────────────┤
│ 6. CHANNEL EFFICIENCY     │ 7. THIS-WEEK OPS                   │
│    effective CAC table    │  demos / no-shows / at-risk trials │
└───────────────────────────┴───────────────────────────────────┘
```
Date range + tenant scope on every panel; admin-gated (`PermissionGuard`).

---

## 9. Reporting cadence

| Cadence | What | Owner |
|---|---|---|
| Daily | reach, DMs, demos booked, at-risk trials | founder / pipeline-manager |
| Weekly | full funnel + content-`OPP-*` ROI review (per `founder-engine`) | growth-strategist |
| Monthly | CAC / LTV / cohorts + roadmap re-prioritization | growth-strategist / oracle |

---

## 10. Instrumentation dependency

| Dashboard capability | Requires |
|---|---|
| Funnel counts | EP-2 events + GSI4 (EventType) |
| Attribution by source/content | EP-1 attribution fields + EP-2 events |
| CAC/LTV/payback | `CAMPAIGN.spend` (EP-7) + `paid` events |
| Cohorts/retention | EP-5 scoring + non-TTL funnel events |
| Live dashboard UI | EP-7 (`MarketingDashboard.tsx`) |

Until EP-1/EP-2/EP-7 ship, track every metric **manually in a sheet using these exact formulas** so the definitions never drift. Cross-refs: `implementation/epics.md`, `implementation/database-requirements.md` (GSIs), `automation-os/workflow-map.md` (event sources), `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` (when each lands).
