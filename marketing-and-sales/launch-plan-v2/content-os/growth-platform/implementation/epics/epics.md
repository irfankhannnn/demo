# Growth Platform — Consolidated Epics

The single epic register for the **whole** Growth Platform. Extends and supersedes `../../../implementation/epics.md` (EP-1…EP-7) — those keep their IDs and goals; this doc adds **EP-8…EP-14** for the subsystems the gap analysis surfaced (activation, health scoring, referral campaigns, AI agents, dashboards-as-a-suite). Every epic: goal · success metric (by `M-*` ID from `../../analytics/metric-dictionary.md`) · dependencies. Grounded in the real stack (Express+Lambda, DynamoDB single-table, `crmDynamodbService.js`, `notificationDynamodbService.js`, `ai-calling-service/`, React/Vite).

---

## 1. Epic register

| ID | Epic | Goal | Success metric | Depends on |
|---|---|---|---|---|
| **EP-1** | Lead Attribution & Source Tracking | Every lead carries source/UTM/campaign/`contentRef(OPP-*)` | 100% new leads attributed (M-AT1) | — |
| **EP-2** | Marketing Event Ingest & Automation Engine | `MKT_EVENT` spine + ingest route + rules engine + SQS | events ingested, <1s routing (M-O2) | EP-1 |
| **EP-3** | Inbound Capture & Auto-Response | DMs/comments/lead-ads → attributed leads + keyword reply + AI auto-qualify | speed-to-lead <5 min (M-O1) | EP-1, EP-2 |
| **EP-4** | Lifecycle Sequences | Nurture/onboarding/win-back/demo-reminder on scheduled engine | wk-1 activation +X% (M-A1) | EP-2 |
| **EP-5** | Scoring (lead/activation/health) | Prioritise leads; predict activation/churn | scores on every lead/customer (M-S1/S2/S3) | EP-1, EP-2 |
| **EP-6** | Referral System | Codes, attribution, reward ledger | referral % of new (M-F8) | EP-1, EP-2 |
| **EP-7** | Marketing/Growth Dashboard | Funnel, attribution, CAC/LTV, cohorts, content ROI | live funnel + `OPP-*` ROI (M-CR6) | EP-1, EP-2 (grows w/ 5,6) |
| **EP-8** | **Activation System** | Milestones, activation score, aha-moment instrumentation | activation rate >40% (M-A1, M-A2) | EP-2, EP-5 |
| **EP-9** | **Customer Health & Expansion Scoring** | Health/risk/expansion/referral scores + CS alerts | NRR >100% (M-R6), churn <5% (M-A5) | EP-2, EP-5 |
| **EP-10** | **Campaign & Channel System** | `CAMPAIGN` entity, UTM taxonomy, meta-ads spend sync | CAC + effective-CAC per channel (M-EF2/EF3) | EP-1, EP-2 |
| **EP-11** | **AI Agent Operating Model** | Agents (growth-strategist/sdr/nurture-bot/oracle) run the platform | system self-operates; weekly brief shipped | EP-5, EP-7, EP-10 |
| **EP-12** | **Dashboard Suite (6 role views)** | Executive/Marketing/Sales/CS/Product/Growth on read-models | 6 dashboards live, RBAC-gated | EP-7 |
| **EP-13** | **Automation Runtime & Observability** | Rules engine hardening, SQS/DLQ, EventBridge crons, CloudWatch | DLQ depth 0 (M-O4), routing p95<1s | EP-2 |
| **EP-14** | **Consent, Multi-tenancy & Compliance** | WhatsApp opt-in, PII minimization, tenant isolation, opt-out | 100% isolation; no send without consent | EP-2, EP-4 |

---

## 2. Dependency order (ASCII)

```
EP-1 ─► EP-2 ─┬─► EP-3 (inbound)
              ├─► EP-4 (sequences) ─► EP-8 (activation) ─┐
              ├─► EP-5 (scoring) ───► EP-9 (health/expand)┤
              ├─► EP-6 (referral)                         ├─► EP-11 (AI agents)
              ├─► EP-10 (campaigns) ──────────────────────┘
              └─► EP-13 (runtime/obs) · EP-14 (consent/tenancy) [cross-cutting]
EP-7 (dashboard read-models) grows across all ─► EP-12 (6-view suite)
```

**Rule (gap-analysis §7):** never build scoring/dashboards before attribution + events exist. Each epic ships independently behind a feature flag, multi-tenant, consent-safe.

---

## 3. Epic detail (new EP-8+ only; EP-1–7 detailed in legacy doc)

- **EP-8 Activation** — emit typed `milestone_hit` (login, data_added, first_ai_call, day3_return) from `real-estate-crm-app` + `ai-calling-service`; `scoringService` computes M-S2; activation funnel read-model; onboarding nudge sequences (links EP-4). Product dashboard consumer.
- **EP-9 Health/Expansion** — `scoringService` nightly health (M-S3), expansion (M-S4), referral (M-S5) scores; Critical→CS alert via `notificationDynamodbService`; feeds win-back (EP-4) + referral asks (EP-6). CS dashboard consumer.
- **EP-10 Campaigns** — `CAMPAIGN` entity + UTM taxonomy + `meta-ads` MCP spend sync into `CAMPAIGN.spend`; enables CAC/effective-CAC. Marketing/Exec dashboards consume.
- **EP-11 AI Agents** — operating model wiring `growth-strategist`/`oracle`/`sdr`/`nurture-bot`/`experiment-designer` to read-models + actions (enroll sequence, scale campaign, issue referral). Weekly brief artifact.
- **EP-12 Dashboard Suite** — 6 React views (`pages/crm/dashboards/*`) on the EP-7 read-models, `PermissionGuard`/`rbac.ts` gated, shared widgets (`<MetricCard/>`,`<FunnelWidget/>`,`<CohortGrid/>`,`<ScoreBand/>`, reuse `GlassDataTable`).
- **EP-13 Runtime/Obs** — `automationEngine.js` idempotency, SQS+DLQ, EventBridge crons (nightly scoring, due-scan), CloudWatch metrics/alarms (ingest, routing, sends, DLQ, funnel).
- **EP-14 Consent/Tenancy** — consent map on `LEAD`, opt-out honored ≤1 cycle, PII-minimized payloads + raw-event TTL, `TENANT#` isolation audited end-to-end.

## 4. Epic acceptance (done = shippable)

| ID | Done when |
|---|---|
| EP-1 | new lead create persists full attribution; legacy backfilled `unknown`; GSI6 live |
| EP-2 | `MKT_EVENT` written + routed <1s; SQS/DLQ healthy; dedupe verified |
| EP-3 | inbound DM→attributed lead + auto-reply + AI auto-qualify; speed-to-lead <5min |
| EP-4 | 5 sequences enroll/advance/cancel on scheduled engine; opt-out honored |
| EP-5 | M-S1/S2/S3 on every lead/customer; GSI7 hottest-first works; `signals` explainable |
| EP-6 | code gen + `/convert` idempotent; reward ledger; GSI8 pipeline |
| EP-7 | funnel/attribution/cohorts/efficiency read-models return correct aggregates |
| EP-8 | `milestone_hit` emitted; activation funnel + M-A1 computed |
| EP-9 | M-S3/S4/S5 nightly; Critical alert fires; CS lists populated |
| EP-10 | `CAMPAIGN.spend` synced; CAC + effective-CAC computed per channel |
| EP-11 | weekly brief auto-generated; agent actions wired + guardrailed |
| EP-12 | 6 dashboards live, RBAC-gated, member sales scoped server-side |
| EP-13 | CloudWatch alarms on routing/DLQ/scoring; idempotency verified |
| EP-14 | no send without consent; opt-out ≤1 cycle; tenant isolation audited |

## 5. Epic sizing & risk

| ID | Size | Top risk | Mitigation |
|---|---|---|---|
| EP-1/2 | M/M | core dependency for all | ship first, behind flag, backfill async |
| EP-3 | L | Meta/WhatsApp app review delay | submit Day 1 |
| EP-4 | L | WA template approval | submit in Phase 0–30 |
| EP-5/8/9 | M | scoring drift | persist `signals`, version model |
| EP-6 | M | reward abuse | idempotent + status state-machine |
| EP-7/12 | M/L | metric drift across views | reference `metric-dictionary.md` only |
| EP-10 | M | spend-sync gaps | reconcile + "connect MCP" empty-state |
| EP-11 | L | agent runaway actions | budget guards + idempotent action hooks |
| EP-13/14 | M | cross-cutting, easy to defer | bake into every sprint DoD |

Cross-refs: `../features/features.md`, `../user-stories/user-stories.md`, `../technical-designs/technical-designs.md`, `../coding-backlog/coding-backlog.md`, `../roadmaps/roadmap-30-60-90-180.md`, `../../analytics/metric-dictionary.md`.
