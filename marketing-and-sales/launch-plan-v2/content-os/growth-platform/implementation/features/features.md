# Growth Platform — Features

Features decomposed from `../epics/epics.md`. Each `F-*` ties to one epic, names the **real files to change**, and links the metric it moves (`M-*` from `../../analytics/metric-dictionary.md`). Additive only — extends existing services, no rewrites.

---

## EP-1 — Attribution

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-1.1 | Lead attribution fields (source/UTM/campaign/`contentRef`/consent) | `crmDynamodbService.js`, `routes/leads.js`, `database-requirements §1` | M-AT1 |
| F-1.2 | Idempotent lead upsert by `dedupeHash` | `crmDynamodbService.js` | — |
| F-1.3 | Source chip + filters in lead UI | `pages/crm/LeadList.tsx`, `LeadDetails.tsx` | M-AT1 |
| F-1.4 | GSI6 LeadSource + backfill `unknown` | CloudFormation, backfill Lambda | M-AT1 |

## EP-2 — Event spine & engine

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-2.1 | `MKT_EVENT` entity + `marketingEventsService.js` (normalize/dedupe) | new service, single-table | M-O2 |
| F-2.2 | `POST/GET /api/marketing/events` | `routes/marketing/events.js` | — |
| F-2.3 | GSI4 EventType (funnel rollups) | CloudFormation | M-F* |
| F-2.4 | `automationEngine.js` rules (event→action) | new, extends scheduled worker | M-O2 |
| F-2.5 | SQS queue + DLQ + worker Lambda | INF | M-O4 |

## EP-3 — Inbound capture

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-3.1 | IG webhook (DM/comment → attributed lead) | `routes/webhooks/instagram.js` | M-F2 |
| F-3.2 | Keyword auto-reply (PRICE/DEMO) | `automationEngine.js` + IG Graph | M-C1 |
| F-3.3 | Meta Lead Ads + CAPI ingest | `routes/webhooks/meta-leadads.js` | M-AT2 |
| F-3.4 | AI auto-qualify trigger | `ai-calling-service/` async invoke | M-O1 |
| F-3.5 | WhatsApp + Blotato webhooks | `routes/webhooks/{whatsapp,blotato}.js` | M-F1 |

## EP-4 — Sequences

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-4.1 | `sequenceService.js` enroll/advance/cancel | new (thin) | M-A1 |
| F-4.2 | Due-scan worker on GSI5 + `SCHEDULED_NOTIFICATION` | `notificationDynamodbService.js` reuse | — |
| F-4.3 | Sequences: onboarding_7d, nurture, demo_reminder, winback, post_activation | `sequenceService.js` | M-A1, M-C7 |
| F-4.4 | WhatsApp Business API + opt-in templates | INT | M-C1 |
| F-4.5 | Sequences admin UI | `pages/crm/Sequences*.tsx` | — |

## EP-5 — Scoring

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-5.1 | `scoringService.js` lead score + on-event delta | new | M-S1 |
| F-5.2 | Nightly recompute (EventBridge cron) | INF | M-S1/S2/S3 |
| F-5.3 | GSI7 LeadStageScore (hottest-first) | CloudFormation | M-S1 |
| F-5.4 | Score badges + explainability (`signals`) | `LeadDetails.tsx`, `GET /leads/:id/score` | M-S1 |

## EP-6 — Referral

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-6.1 | `REFERRAL` entity + `referralService.js` (code gen) | new | M-F8 |
| F-6.2 | `GET/POST /api/referrals`, `/convert` | `routes/referrals.js` | M-F8 |
| F-6.3 | GSI8 ReferralStatus pipeline | CloudFormation | M-F8 |
| F-6.4 | Referral UI + reward ledger | `pages/crm/Referrals.tsx` | M-F8 |

## EP-7 — Dashboard read-models

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-7.1 | `/dashboard/funnel` read-model | `routes/marketing/dashboard.js` | M-F* |
| F-7.2 | `/dashboard/attribution?groupBy=source\|content` | same | M-AT*, M-CR* |
| F-7.3 | `/dashboard/cohorts` | same | M-A6 |
| F-7.4 | `/dashboard/efficiency` (CAC/LTV/payback/NRR) | same | M-EF*, M-R* |
| F-7.5 | `/dashboard/scores`, `/north-star`, `/activation`, `/engagement` | same | M-S*, M-NS*, M-A* |

## EP-8 — Activation

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-8.1 | Emit typed `milestone_hit` (login/data/AI-call/return) | `real-estate-crm-app` flows, `ai-calling-service` | M-A2 |
| F-8.2 | Activation score M-S2 + `customer_activated` event | `scoringService.js` | M-A1 |
| F-8.3 | Activation funnel read-model + onboarding nudge | `routes/marketing/dashboard.js`, EP-4 | M-A1 |

## EP-9 — Health & expansion

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-9.1 | Health score M-S3 + bands + Critical alert | `scoringService.js`, `notificationDynamodbService.js` | M-S3, M-A5 |
| F-9.2 | Expansion score M-S4 + upsell signal | `scoringService.js` | M-S4, M-R4 |
| F-9.3 | Referral score M-S5 (advocate detection) | `scoringService.js` | M-S5 |

## EP-10 — Campaigns

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-10.1 | `CAMPAIGN` entity + UTM taxonomy | new, single-table | M-AT4 |
| F-10.2 | meta-ads MCP spend sync → `CAMPAIGN.spend` | INT (meta-ads) | M-EF2 |
| F-10.3 | Effective-CAC compute (`channel-cac-analysis`) | `routes/marketing/dashboard.js` | M-EF3 |

## EP-11 — AI agents

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-11.1 | growth-strategist weekly brief over read-models | `../ai-agents/` | M-NS1 |
| F-11.2 | sdr/nurture-bot actions (enroll, message) | EP-4 wiring | M-O1 |
| F-11.3 | oracle/ab-optimizer content-ROI feedback | EP-7 attribution | M-CR6 |

## EP-12 — Dashboard suite

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-12.1 | 6 role dashboards | `pages/crm/dashboards/*` | all |
| F-12.2 | Shared widgets `<MetricCard/FunnelWidget/CohortGrid/ScoreBand>` | `components/` | all |
| F-12.3 | RBAC gating (admin + member-scoped sales) | `PermissionGuard`, `rbac.ts` | — |

## EP-13 / EP-14 — Runtime & consent (cross-cutting)

| ID | Feature | Real files | Metric |
|---|---|---|---|
| F-13.1 | Idempotency (dedupeKey/dedupeHash/stepToken) | services | M-O4 |
| F-13.2 | CloudWatch metrics + alarms (ingest/route/send/DLQ) | INF | M-O2/O4 |
| F-14.1 | Consent map + opt-out (≤1 cycle) | `LEAD.consent`, `sequenceService.js` | — |
| F-14.2 | PII-minimized payloads + raw-event TTL | `marketingEventsService.js` | — |
| F-14.3 | `TENANT#` isolation audit | all queries | — |

Cross-refs: `../user-stories/user-stories.md`, `../technical-designs/technical-designs.md`, `../coding-backlog/coding-backlog.md`.
