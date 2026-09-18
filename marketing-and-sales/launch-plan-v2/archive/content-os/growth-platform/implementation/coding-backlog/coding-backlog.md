# Growth Platform — Coding Backlog

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/design-only-backlog.md`.

Granular, sprint-sequenced engineering backlog. Extends `../../../implementation/backlog.md` with task-level tickets across **BE / FE / INT / INF / QA**. Every item: acceptance · size (S/M/L) · epic link (`../epics/epics.md`) · metric (`M-*`). **DoD (all items):** multi-tenant isolation · consent/opt-out · idempotent · tested · observable · documented. Ordered Measure→Convert→Optimize. Each sprint ships behind a feature flag.

Legend: BE backend · FE React · INT integration · INF infra · QA tests.

---

## Sprint 1 — Attribution foundation (EP-1, EP-2 seed, EP-7 seed)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| BE-1 | BE | Lead attribution fields in `crmDynamodbService.js` + `routes/leads.js` | persist source/utm/campaign/contentRef/consent; invalid `leadSource`→400; backward compat | M | EP-1 |
| BE-2 | BE | `marketingEventsService.js` + `MKT_EVENT` write | normalize/dedupe by `dedupeKey`; PII-min payload | M | EP-2 |
| BE-3 | BE | `POST/GET /api/marketing/events` (JWT/HMAC) | 201 + `{deduped}`; query type/channel/range | M | EP-2 |
| INF-4a | INF | GSI4 EventType + GSI6 LeadSource (CloudFormation) | online stack update; sparse | M | EP-1 |
| INF-7 | INF | Backfill Lambda (legacy leads → `unknown`,dedupeHash,GSI keys) | idempotent; throttled BatchWrite | M | EP-1 |
| FE-1 | FE | Lead create form attribution inputs | UTM/source captured; optional | S | EP-1 |
| FE-2 | FE | `LeadList`/`LeadDetails` source chip + filters | filter by `leadSource`; chip renders | S | EP-1 |
| BE-9a | BE | Minimal `/dashboard/funnel` + sources read-model | counts by type + by source in range | M | EP-7 |
| FE-3a | FE | Minimal dashboard (funnel + sources) | `<FunnelWidget/>` + `GlassDataTable` | M | EP-7 |
| INT-4 | INT | Blotato publish webhook → `content_published` | HMAC verified; event written | S | EP-1 |
| QA-1 | QA | Attribution + idempotency tests | dup phone no-op; isolation | S | EP-1 |

**Gate:** 100% new leads attributed (M-AT1); funnel counts visible.

---

## Sprint 2 — Inbound capture + runtime (EP-3, EP-13)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| INF-1 | INF | SQS + DLQ + consumer Lambda | at-least-once; DLQ after N | M | EP-2 |
| BE-4 | BE | `automationEngine.js` rules (event→action) | idempotent; <1s route (M-O2) | M | EP-2 |
| INT-1 | INT | IG webhook (DM/comment → attributed lead) | HMAC; upsert Lead(ig_dm,contentRef) | L | EP-3 |
| BE-5 | BE | Keyword auto-reply (PRICE/DEMO) | template via IG Graph; consent-safe | M | EP-3 |
| INT-3 | INT | Meta Lead Ads + CAPI ingest | form → attributed lead; CAPI fired | M | EP-3 |
| BE-6 | BE | AI auto-qualify trigger → `ai-calling-service` | async, idempotent leadId+day; SDR notify | M | EP-3 |
| INF-6a | INF | CloudWatch metrics (ingest/route/DLQ) | M-O2/M-O4 dashboards + alarm | M | EP-13 |
| QA-2 | QA | Webhook signature + speed-to-lead tests | bad sig→401; first-touch<5min | S | EP-3 |

**Gate:** speed-to-lead <5 min (M-O1); DLQ depth 0 (M-O4).

---

## Sprint 3 — Sequences + consent (EP-4, EP-14)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| BE-7 | BE | `sequenceService.js` enroll/advance/cancel | writes SEQUENCE_ENROLLMENT + SCHEDULED_NOTIFICATION | L | EP-4 |
| INF-4b | INF | GSI5 SeqDue + due-scan worker | scans `nextAt≤now`; reschedules | M | EP-4 |
| BE-8 | BE | Sequences: onboarding_7d/nurture/demo_reminder/winback/post_activation | step tokens; idempotent sends | M | EP-4 |
| INT-2 | INT | WhatsApp Business API + opt-in templates | template approved; consent-gated | L | EP-4 |
| BE-14 | BE | Opt-out handling (`consent.whatsapp=false`, cancel) | honored ≤1 cycle | S | EP-14 |
| FE-5 | FE | Sequences admin UI | enroll/cancel; status view | M | EP-4 |
| INT-6 | INT | Demo scheduling (calendar) → `demo_booked` | event emitted; reminder enrolled | M | EP-4 |
| QA-3 | QA | Consent + double-send + opt-out tests | no send w/o consent; stepToken guard | S | EP-14 |

**Gate:** win-back live; opt-out honored; no double-send.

---

## Sprint 4 — Scoring + referral + activation (EP-5, EP-6, EP-8)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| BE-10 | BE | `scoringService.js` lead score + on-event delta | M-S1 weights; `signals` persisted | M | EP-5 |
| INF-8 | INF | EventBridge nightly scoring cron | per-tenant recompute; lag alarm | S | EP-5 |
| INF-4c | INF | GSI7 LeadStageScore (zero-padded) | hottest-first query works | S | EP-5 |
| FE-2b | FE | Score badges + explainability + hottest-first sort | `<ScoreBand/>`; `/leads/:id/score` | S | EP-5 |
| BE-11 | BE | `referralService.js` + `routes/referrals.js` + `/convert` | idempotent code+referee; GSI8 | M | EP-6 |
| FE-4 | FE | Referral UI + reward ledger | code gen; pipeline view | M | EP-6 |
| BE-12 | BE | `milestone_hit` emission + activation score (M-S2) | login/data/AI-call/day3; `customer_activated` ≥3/4 | M | EP-8 |
| QA-4 | QA | Scoring + referral attribution tests | bands correct; reward once | S | EP-5/6 |

**Gate:** scores on every lead/customer (M-S1/S2); referral % tracked (M-F8).

---

## Sprint 5 — Health/expansion + campaigns + full dashboard suite (EP-9, EP-10, EP-7, EP-12)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| BE-13 | BE | Health/expansion/referral scores (M-S3/4/5) + Critical alert | nightly; alert via notification | M | EP-9 |
| INT-5 | INT | meta-ads MCP spend sync → `CAMPAIGN.spend` | per-campaign spend updated | M | EP-10 |
| BE-15 | BE | `/dashboard/{attribution,cohorts,efficiency,scores,activation,north-star}` | CAC/LTV/payback/NRR + content `OPP-*` ROI | L | EP-7 |
| FE-6 | FE | 6 role dashboards + shared widgets | Exec/Mkt/Sales/CS/Prod/Growth; RBAC-gated | L | EP-12 |
| FE-7 | FE | `<CohortGrid/>` + content-ROI export | winners → oracle/ab | M | EP-7 |
| INF-6b | INF | Observability hardening + alarms (all) | funnel anomaly + scoring lag alarms | M | EP-13 |
| QA-5 | QA | Full E2E (isolation/consent/idempotency/attribution/RBAC) | reel→…→paid traceable | M | all |

**Gate:** 6 dashboards live; LTV:CAC≥3:1 (M-EF6); content-`OPP-*` ROI visible (M-CR6).

---

## Sprint 6+ — AI agent operating model (EP-11)

| ID | Track | Task | Acceptance | Size | Epic |
|---|---|---|---|---|---|
| BE-16 | BE | growth-strategist weekly brief over read-models | leverage finding + per-agent actions | M | EP-11 |
| BE-17 | BE | Agent action hooks (enroll/scale/issue-referral) | sdr/nurture-bot/media-buyer wired | M | EP-11 |
| QA-6 | QA | Agent-action idempotency + guardrails | budget guard; no dup enroll | S | EP-11 |

**Gate:** weekly brief shipped; system self-operates.

---

## Sequencing rule
Never start Sprint 4 (scoring) before Sprint 1 (attribution) + Sprint 2 (events) exist. Cross-refs: `../epics/epics.md`, `../features/features.md`, `../technical-designs/technical-designs.md`, `../roadmaps/roadmap-30-60-90-180.md`.
