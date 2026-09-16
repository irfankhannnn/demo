# Activation — Implementation Spec

Backend, DB, UI, API, and infra changes to ship the activation system. Additive-only on the real stack (`technical-design.md` §6 reuse map). Ties to epics **EP-4 (Lifecycle Sequences)** and **EP-5 (Scoring)** (`implementation/epics.md`). Cross-refs: `database-requirements.md` (GSIs), `api-requirements.md` (contracts), `infrastructure-requirements.md` (cron/SQS), `ui-requirements.md` (screens).

---

## 1. Backend changes

| Component | New/Reuse | Work |
|---|---|---|
| Activation event emit | extend | Add emit calls in product surfaces (`events.md` §2): `routes/leads.js` (`leads_imported`), `notifications.js`/`ScheduleMeetingModal` (`followup_set`), `aiCallingInternal.js` callback (`first_ai_call`), `InviteManagement` (`team_invited`), Khata/Dashboard mounts. All via `POST /api/marketing/events` or service-internal put. |
| `marketingEventsService.js` | reuse | Normalize + dedupe by `dedupeKey`; persist `MKT_EVENT`; enqueue SQS (already specced). Add activation `type` enums. |
| `scoringService.js` | new (EP-5) | `computeActivation(entityId)`: implements `milestones-and-score.md` §2 formula; emit derived `milestone_hit` / `customer_activated` / `trial_inactive`. Event-delta + nightly modes. |
| `automationEngine.js` | extend (EP-4) | Map activation events → enroll WF-ACT-01..05 via `sequenceService`. Mutual-exclusion + priority logic (`workflows.md` §7). |
| `sequenceService.js` | new (EP-4) | enroll/advance/cancel `SEQUENCE_ENROLLMENT`; write paired `SCHEDULED_NOTIFICATION`. Seq configs for `onboarding_7d`, `winback`, `post_activation`. |
| `notificationDynamodbService.js` | reuse | WhatsApp/email/in-app sends; scheduled timer. |

---

## 2. Data model / DB

| Item | Change | Detail |
|---|---|---|
| `SCORE` entity | extend | Add `activationScore, band, activated, milestones{}, milestoneCountCore4, segment, signals{}, stuckAtStep, version` (`milestones-and-score.md` §4). |
| `GSI-ScoreBand` | **new GSI** | `GSI7PK=TENANT#{t}#ABAND#{band}`, `GSI7SK={activationScore}#{entityId}` — at-risk/activated queues, hottest-first. Add to `database-requirements.md`. |
| `MKT_EVENT` | reuse | activation `type`s already in §2.2 enum; add `milestone_hit, customer_activated, trial_inactive, first_ai_call, leads_imported, followup_set, team_invited, buyer_matched, khata_setup, dashboard_viewed, login`. |
| `SEQUENCE_ENROLLMENT` | reuse | `seqId` enum already covers needed seqs. |

All items `TENANT#`-scoped; on-demand DynamoDB; raw events TTL'd.

---

## 3. API

| Method/Path | Auth | Purpose |
|---|---|---|
| `POST /api/marketing/events` | JWT | Emit activation event (existing ingest; add activation types). |
| `GET /api/marketing/dashboard/activation?cohort&from&to` | JWT | Activation funnel + NSAM + at-risk queue read model (from `GSI-EventType` + `GSI-ScoreBand`). |
| `GET /api/marketing/score/{entityId}` | JWT | Single entity activation score + milestones (explainability). |
| `POST /api/marketing/sequences/{seqId}/cancel` | JWT/internal | Cancel enrollment on reply/login/convert. |

Contracts added to `api-requirements.md`. Responses follow `{ error, details? }` convention on failure.

---

## 4. UI — activation dashboard widget + in-app checklist hook

| Surface | File | Build |
|---|---|---|
| Activation dashboard widget | `pages/crm/MarketingDashboard.tsx` (or CRMDashboard tile) | NSAM tile (W1 activation rate), funnel bars (signup→setup→aha→habit), Day-2 AI-call rate, **at-risk trial queue** (from `GSI-ScoreBand`, hottest-first), median TTV-to-aha. |
| In-app checklist component | `components/activation/OnboardingChecklist.tsx` (new) | Reads `GET /api/marketing/score/{entityId}`; renders 4 core + breadth milestones with hit/at; deep-links to the feature; progress bar = `milestoneCountCore4`. Spec in `onboarding/onboarding-system.md`. |
| Empty states | LeadList / AICalling / Khata | CTA into the next milestone (drives M1/M3/M5). |

---

## 5. Infra

| Need | Reuse/New | Detail |
|---|---|---|
| Nightly recompute | reuse | EventBridge cron → `scoringService.recompute(tenant)` (`technical-design.md` §3.2). Off-peak; per-tenant batch. |
| Event-driven recompute | reuse | SQS consumer → `automationEngine` → `scoringService.computeActivation` on milestone events. < 5s p95. |
| Scheduled sends | reuse | `SCHEDULED_NOTIFICATION` due-scan worker (no new infra). |
| Observability | extend | CloudWatch: W1 activation rate, Day-2 AI-call rate, stuck rate, DLQ depth, recompute duration. |

---

## 6. Acceptance criteria

| ID | Criterion | Verifies |
|---|---|---|
| **AC-1** | Aha = `first_ai_call` fires from `ai-calling-service/` callback AND `leadCount≥10` → `aha=true` on SCORE | `activation-framework.md` §2 |
| **AC-2** | All milestone events (`leads_imported`,`followup_set`,`first_ai_call`,`team_invited`/`buyer_matched`,`login`) fire in staging, deduped, `TENANT#`-scoped | `events.md` §5 |
| **AC-3** | `scoringService.computeActivation` reproduces the §2 formula incl. worked example (agency Day-7 = 92) | `milestones-and-score.md` §2 |
| **AC-4** | `customer_activated` (core-4 + score≥70) cancels active drips and fires WF-ACT-05 once (idempotent) | `workflows.md` §6/§7 |
| **AC-5** | No WhatsApp/email send without stored `consent`; opt-out honored ≤1 cycle; mutual-exclusion priority WF-ACT-04>03>02 enforced | `workflows.md` §7, `technical-design.md` §7 |
| **AC-6** | `GET /dashboard/activation` returns NSAM + funnel + at-risk queue from GSIs in <500ms p95 | §3, §4 |
| **AC-7** | Nightly job sets `stuckAtStep` + emits `trial_inactive` for 48h-no-login trials | `milestones-and-score.md` §5 |

---

## 7. Epic mapping & sequencing

| Epic | Activation deliverable |
|---|---|
| **EP-4** Lifecycle Sequences | WF-ACT-01..05 via `sequenceService` on `SCHEDULED_NOTIFICATION`; WhatsApp + consent (`workflows.md`) |
| **EP-5** Scoring | `scoringService` activation score + nightly recompute; `GSI-ScoreBand`; derived events (`milestones-and-score.md`) |
| **EP-7** Dashboard | activation widget + in-app checklist (`§4`) |

**Build order:** instrument events (EP-5 prereq) → SCORE + `GSI-ScoreBand` + `scoringService` (EP-5) → sequences (EP-4) → dashboard widget + checklist (EP-7). Never ship scoring before activation events exist (`gap-analysis.md` §7). Each ships independently, multi-tenant, consent-safe.
