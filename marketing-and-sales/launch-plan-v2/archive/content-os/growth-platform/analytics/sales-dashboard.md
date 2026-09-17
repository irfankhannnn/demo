# Sales Dashboard

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/weekly-scorecard.md`.

**Purpose:** answer "Which lead do I work next, and where is the pipeline stuck?" **Audience:** Sales Manager (ADMIN, all agents) + SDR / Agent (MEMBER, own leads only). **Decision supported:** the SDR work queue — who to call now, which demos to confirm, which no-shows to recover. Metrics by ID from `metric-dictionary.md`.

**Refresh:** real-time (GSI7 hottest-first query on load). **RBAC:** ADMIN sees all `assignedTo`; **MEMBER is server-side scoped to `assignedTo = me`** (enforced in the read-model query, never client-side).

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | **Hottest-first queue** | M-S1 lead score (Hot/Warm/Cold bands) | `GlassDataTable` sorted by `leadScore` desc (GSI7) + `<ScoreBand/>` chips |
| 2 | Today's demos | M-F3 booked, M-F4 completed, M-C7 no-show | `GlassDataTable` (time, lead, agent, status) |
| 3 | Conversation funnel | M-F2 DMs, M-C1 DM→WA, M-C2 WA→demo | mini funnel |
| 4 | Speed-to-lead | M-O1 (median first-touch) | `<MetricCard/>` vs 5-min SLA |
| 5 | Pipeline by stage | leads count per `status` + value | bar / kanban counts |
| 6 | Stuck leads | leads with no event >7d in mid-funnel | `GlassDataTable` (age, last touch) |

---

## 2. Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ SPEED-TO-LEAD 4m12s ✔   |  TODAY: 5 demos · 1 no-show        │
├─────────────────────────────────────────────────────────────┤
│ HOTTEST-FIRST QUEUE (GSI7, ScoreBand)                        │
│  ● 92 Rahul   ig_dm  OPP-0142  "PRICE"   [Call][WA]          │
│  ● 78 Priya   referral          demo set [Confirm]           │
│  ○ 41 Aman    web                                            │
├──────────────────────────────┬──────────────────────────────┤
│ TODAY'S DEMOS (table)        │ CONVERSATION FUNNEL           │
│  10:00 Rahul ✔  11:30 Aman ⏳ │  DM 410 →WA 168 →demo 38     │
├──────────────────────────────┴──────────────────────────────┤
│ STUCK LEADS  (>7d no event, mid-funnel)  age | last-touch    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source |
|---|---|
| Queue | `LEAD` via GSI7 `LeadStageScore` (`STAGE#{status}` SK=padded `leadScore`, `ScanIndexForward=false`) |
| Demos | `MKT_EVENT(demo_booked/demo_completed)` for date |
| Conversation | `dm`, WA opt-in, `demo_booked` counts |
| Speed-to-lead | first auto-touch event − inbound event per lead |
| Stuck | `LEAD.lastTouchAt` vs now, filtered by `status` |

---

## 4. Drill-downs

- Lead row ▸ → existing `LeadDetails.tsx` (now shows attribution block + `signals` from `SCORE`).
- Demo row ▸ → reschedule/confirm (reuse `ScheduleMeetingModal.tsx`).
- No-show ▸ → enroll `demo_reminder` / `winback` sequence (`POST /api/marketing/sequences/enroll`).
- Score chip ▸ → `GET /api/leads/:id/score` explainability (`signals` breakdown).

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | `GET /api/leads?stage=&minScore=&sort=score` (extended), `GET /api/leads/:id/score`, `…/funnel?stage=conversation` |
| BE | GSI7 query helper in `crmDynamodbService.js`; **MEMBER filter `assignedTo` applied in query**, not response |
| FE | `pages/crm/dashboards/SalesDashboard.tsx`; reuse `GlassDataTable`, `<ScoreBand/>`, `LeadDetails`, `ScheduleMeetingModal`, `PermissionGuard` |
| RBAC | `rbac.ts`: ADMIN all leads; MEMBER `assignedTo=me` (server-enforced) |
| Deps | EP-1 (attribution), EP-5 (scoring → GSI7), EP-4 (sequences for no-show/winback) |

## 6. Alert thresholds (SDR/manager)

| Condition | Metric | Action |
|---|---|---|
| Hot lead (≥70) unworked > 30 min | M-S1 | escalate / reassign |
| Speed-to-lead > 5 min | M-O1 | check automation/auto-qualify health |
| No-show rate > 25% | M-C7 | tighten demo-reminder sequence |
| Lead in mid-funnel, no event > 7d | — | "stuck" badge → nurture enroll |
| Member queue empty but unassigned Hot leads exist | M-S1 | manager reassigns |

## 7. Edge cases & empty states

- **Tie scores:** GSI7 SK breaks ties by `createdAt` (older first) so the queue is deterministic.
- **No phone / no consent:** lead still queued but Call/WA actions disabled with reason chip (consent-gated, EP-14).
- **Score not yet computed (new lead):** shows as Warm-provisional until `scoringService` runs; never blocks the queue.
- **MEMBER with zero assigned leads:** zero-state "no leads assigned — ask your manager", not the full-pipeline view (RBAC).

## 8. Decision cadence

| Cadence | Action |
|---|---|
| Hourly | work hottest-first queue top-down |
| Daily | confirm today's demos, recover no-shows |
| Weekly (manager) | rebalance assignment, review stuck leads |

Cross-refs: `metric-dictionary.md §2,§7`, `01-business-memory.md §3.1` (LeadList/Details), `../implementation/technical-designs/technical-designs.md §4.1`, `sdr`/`nurture-bot` skills.
