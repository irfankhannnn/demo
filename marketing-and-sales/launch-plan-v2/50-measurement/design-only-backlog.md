# Design-only backlog

Every growth-platform and marketing-engineering design that was archived under decision **D3**, with the condition that would justify building it.

This exists so that archiving is safe rather than lossy. None of these documents describes software that exists; several describe software that would duplicate something that does. If a trigger below fires, read the archived file first — most of the thinking in them is sound, and only the repo facts and the plan ladder have gone stale.

**Archive root:** `marketing-and-sales/launch-plan-v2/archive/content-os/`. Paths below are relative to it. Every archived file carries the archive banner and points at its successor.

**How to read the trigger column:** these are conditions, not dates. Nothing here is scheduled, and the coding budget in weeks 3-4 is capped at two hours a day (`00-PLAN-OVERVIEW.md` §6).

---

## 1. Event and attribution engine

| Archived file | What it designs | Build trigger |
|---|---|---|
| `growth-platform/attribution/attribution-architecture.md` *(superseded in place by [`attribution-today.md`](./attribution-today.md))* | multi-touch attribution on a custom event spine | only if PostHog cannot answer a question the founder actually needs |
| `growth-platform/attribution/data-model.md` | `MKT_EVENT`, `TOUCHPOINT`, `ATTRIBUTION_PATH` entities and their GSIs | when an `OPP-*` ↔ Instagram media id ↔ revenue join is needed and PostHog cannot do it |
| `growth-platform/attribution/events.md` · `growth-platform/activation/events.md` | two forked event vocabularies posting to `POST /api/marketing/events` | never as written — [`posthog-event-map.md`](./posthog-event-map.md) is the vocabulary; extend it |
| `growth-platform/attribution/implementation-plan.md` | the build plan for the above | with its parent |
| `growth-platform/attribution/dashboards.md` | attribution dashboards | with a real attribution store |
| `growth-platform/attribution/content-attribution.md` | content-to-revenue ROI chain | after our own Instagram account is connected (post Meta App Review) |
| `implementation/technical-design.md` · `api-requirements.md` · `database-requirements.md` · `infrastructure-requirements.md` · `ui-requirements.md` | the same engine, specified a second time at content-os root level | with the above; note `ui-requirements.md` correctly documents the **product** UI tokens, which differ from the marketing brand kit on purpose — see [`../10-audience-and-voice/brand-constants.md`](../10-audience-and-voice/brand-constants.md) |
| `implementation/epics.md` · `user-stories.md` · `engineering-tasks.md` · `backlog.md` · `README.md` | epics EP-1..EP-7 for that engine, several already delivered differently | reference only; EP-3 shipped as the Instagram service and lead adapters |

**The single line that collapses this whole group:** build a custom marketing event store only when PostHog demonstrably cannot join `OPP-*` ↔ Instagram `mediaId` ↔ revenue. Steps 1-3 in [`attribution-today.md`](./attribution-today.md) §4 come first and are much cheaper.

## 2. Activation and onboarding

| Archived file | What it designs | Build trigger |
|---|---|---|
| `growth-platform/activation/activation-framework.md` | the aha, funnel, segments and NSAM target | folded into [`activation-definition.md`](./activation-definition.md); the framework returns only if D27 picks a milestone model |
| `growth-platform/activation/milestones-and-score.md` | the weighted 0-100 activation score and `SCORE` entity | when activation is measured automatically **and** the binary definition stops being informative |
| `growth-platform/activation/implementation.md` | the engineering plan for the score | with its parent |
| `growth-platform/activation/workflows.md` | WF-ACT-01..05 nudge automations | extend `apps/crm/server/scripts/trial-reminder-cron.js` instead; a parallel drip is the failure mode here |
| `growth-platform/onboarding/onboarding-system.md` | a setup wizard in `onboarding-page/` | never as written — `apps/onboarding` is an internal tenant-provisioning tool, and the real in-app flow is RoleSelection → ConnectWhatsApp → ChoosePlan |

## 3. Scoring

| Archived file | What it designs | Build trigger |
|---|---|---|
| `growth-platform/customer-scoring/customer-health-system.md` *(superseded in place by [`customer-health.md`](./customer-health.md))* | health, risk, expansion and referral scores | ~30 paying customers **and** one unforeseen churn **and** the manual list becoming unreadable |
| `growth-platform/retention/retention-system.md` | lifecycle retention, dormancy, dunning, expansion ladder | dunning: when the grace-period cron is scheduled; the rest with the health score |
| `growth-platform/lead-scoring/lead-scoring-engine.md` *(superseded in place by [`prospect-lead-scoring.md`](./prospect-lead-scoring.md))* | a 0-100 four-dimension prospect score in code | ~200 live prospects arriving faster than they can be hand-scored |

## 4. Referrals

| Archived file | What it designs | Build trigger |
|---|---|---|
| `growth-platform/referrals/referral-engine.md` *(superseded in place by [`referral-program.md`](./referral-program.md))* | the full referral state machine and reward economics | ~10 referred signups handled manually |
| `growth-platform/referrals/data-model.md` | `REFERRAL`, `REFERRAL_CODE`, `REWARD_LEDGER` in the CRM table | with the above, but the day-30 spec's separate tables are the better starting point |
| `growth-platform/referrals/workflows.md` | referral ask and reward automations | with the above |
| `growth-platform/referrals/backlog.md` | EP-6 engineering backlog | with the above |

## 5. Dashboards

All eight are replaced by one sheet: [`weekly-scorecard.md`](./weekly-scorecard.md).

| Archived file | Build trigger |
|---|---|
| `growth-platform/analytics/executive-dashboard.md` | a team that is not one person |
| `growth-platform/analytics/marketing-dashboard.md` | paid spend running, i.e. Month 2 after the PMF gate |
| `growth-platform/analytics/sales-dashboard.md` | an SDR, i.e. MRR ≥ ₹2L |
| `growth-platform/analytics/customer-success-dashboard.md` | a customer-success function |
| `growth-platform/analytics/product-dashboard.md` | activation instrumented and a product owner to read it |
| `growth-platform/analytics/growth-dashboard.md` · `growth-dashboard.md` (root) | never both — they were near-duplicates of each other |
| `growth-platform/analytics/dashboard-strategy.md` | the "who reads what, how often" framing survives in [`README.md`](./README.md) §3 |

Every one of these carried unlabelled sample numbers. If a screenshot of one ever leaves the repo, it reads as a result. It is not — see [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md).

## 6. Automation runtime and campaigns

| Archived file | What it designs | Build trigger |
|---|---|---|
| `growth-platform/automations/automation-architecture.md` | a per-tenant rule engine (`RULE`, `RULE_RUN`, `SEQUENCE_ENROLLMENT`) on SQS | the surviving parts are in [`../60-automation/README.md`](../60-automation/README.md); the rule engine itself waits until manual workflows demonstrably do not scale |
| `automation-os/implementation-plan.md` · `automation-os/workflow-map.md` | phased build of the same, and the older 9-workflow map | superseded by [`../60-automation/workflow-catalog.md`](../60-automation/workflow-catalog.md) |
| `growth-platform/campaigns/campaign-system.md` | paid campaign tracking, Meta Lead Ads, CAPI | Month 2, only if the PMF gate passes — no paid ads in M1 |
| `growth-platform/integrations/integrations.md` · `automation-os/integrations.md` | integration registries | replaced by [`../60-automation/tooling-stack.md`](../60-automation/tooling-stack.md) |

## 7. Operating model and roadmaps

| Archived file | Note |
|---|---|
| `growth-platform/ai-agents/ai-agent-architecture.md` | a six-agent GTM operating model. Overlaps `docs/realestateflow-vision/internal-operations/`, which owns internal GTM ops from Phase 4. Several agents and skills it names do not exist (`growth-strategist`, `experiment-designer`, `channel-cac-analysis`, `growth-intel`, `funnel-analysis`, `experiment-design`, `competitive-intel`, `retention-analysis`, `messaging-optimizer`). **Trigger:** the internal-operations phase, not before. |
| `growth-platform/implementation/roadmaps/roadmap-30-60-90-180.md` | third competing roadmap, obsolete. Its 180-day tail is the only surviving part: it belongs after Phase C (growth) in the phase model, and is noted in `month-2-plus/README.md`. |
| `roadmap-30-60-90.md` (root) | folded into `month-2-plus/README.md` as phase rows, no dates. |
| `growth-platform/gap-analysis.md` | its central claim — leads have no source, score or attribution — became false. Kept as a record of what June believed. |
| `growth-platform/quality-review.md` | declared the 42 documents conflict-free; they were not. Superseded by the September reviews. |
| `growth-platform/README.md` | the entry point for the 42. Successor: [`README.md`](./README.md). |
| `growth-platform/implementation/*` (architecture, coding-backlog, epics, features, technical-designs, user-stories) | EP-8..EP-14 engineering set. Several items already shipped for tenants. Reference only. |

## 8. Not growth platform, archived alongside

| Archived file | Why |
|---|---|
| `workspaces/_TEMPLATE/*` (8 files) | business-agnostic workspace scaffolds. The playbook serves one brand. Restore note in that folder's README. |
| `workspaces/realestateflow/05-14-day-launch-plan.md` | obsolete June launch plan: founder on camera, testimonials, paid retargeting, a calculator that does not exist, and the old brand handle. Superseded by `marketing-and-sales/realestateflow/content-strategy-first-month/05-CALENDAR-30-DAY.md` and the week folders. |
| `explanation/*` (5 files) | explained a three-system split this merge removed. |
| `global/00-content-os-overview.md` · `global/01-workspace-system.md` | folder-system documentation for a folder system that no longer exists. |
| `GTM-OS-README.md` · `master-index.md` · `user-guide.md` · `content-os-README.md` | four competing entry points, absorbed into `launch-plan-v2/README.md`. |
| `attention-os/audience-research.md` | folded into `10-audience-and-voice/`. |

---

## How to un-archive something

1. Read the archived file **and** its September review notes (`scratchpad/reviews/contentos-B.md` for growth-platform, `contentos-C.md` for the rest) — the reviews list every stale fact in it.
2. Re-verify every repo path it cites. The 2026-09-17 reorganisation moved almost all of them.
3. Replace every plan name with a lookup into `pricing.json`, and check `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` for whether the pricing model has changed under it.
4. Write the live version into the layer it belongs to, and leave the archived copy where it is.
