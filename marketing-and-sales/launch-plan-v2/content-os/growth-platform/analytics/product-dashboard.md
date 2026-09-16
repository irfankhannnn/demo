# Product Dashboard

**Purpose:** answer "Are trials activating, and which milestone is the drop point?" **Audience:** Product / Eng owner (ADMIN). **Decision supported:** onboarding fixes, milestone nudges, where to invest product effort to lift activation (the single biggest trial→paid lever). Metrics by ID from `metric-dictionary.md`.

**Refresh:** daily (post nightly activation scoring). **RBAC:** ADMIN-only.

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | Activation rate | M-A1 (activated/trials) | `<MetricCard/>` vs 40% target + trend |
| 2 | **Wk-1 milestone funnel** | M-A2 per milestone (login → data → AI-call → day-3) | step funnel — drop point highlighted |
| 3 | Time-to-activate | M-A3 median hrs | histogram |
| 4 | Trial cohorts | M-A6 activation by signup week | `<CohortGrid/>` |
| 5 | Activation score dist | M-S2 (0–100, activated ≥3/4) | distribution bar |
| 6 | Feature adoption | feature-breadth from `SCORE.signals` (AI calling, khata, leads, properties) | bar by module |

---

## 2. Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ ACTIVATION RATE 38% (▲ vs 34%)   median time-to-activate 19h │
├─────────────────────────────────────────────────────────────┤
│ WK-1 MILESTONE FUNNEL (drop point = first AI call)          │
│  login 88% → data added 71% → AI call 44%◄ → day-3 ret 52%  │
├──────────────────────────────┬──────────────────────────────┤
│ TRIAL COHORTS (signup wk)    │ FEATURE ADOPTION              │
│  W20 42% · W21 38% · W22 36% │  leads ▇ props ▅ AIcall ▃ khata▂│
├──────────────────────────────┴──────────────────────────────┤
│ ACTIVATION SCORE DIST  0──40──70──100                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source / event |
|---|---|
| Activation rate | `customer_activated / trial_started` (events) |
| Milestone funnel | `milestone_hit` events typed per milestone (login, data_added, first_ai_call, day3_return) |
| Time-to-activate | `customer_activated.occurredAt − trial_started.occurredAt` |
| Cohorts | `/dashboard/cohorts?cohortBy=signup_week` |
| Score dist | `SCORE.activationScore` |
| Feature adoption | `SCORE.signals.featureBreadth` + module usage events |

The four core milestones map to verified product features (`01-business-memory §3`): login (auth), data added (Lead/Property), first AI call (`ai-calling-service`), day-3 return.

---

## 4. Drill-downs

- Milestone bar ▸ → list of trials stuck before that milestone → enroll `onboarding_7d` nudge sequence.
- Drop-point ▸ → onboarding-CRO recommendation (which empty-state/checklist step).
- Cohort cell ▸ → trials in cohort + their activation scores.
- Feature bar ▸ → adoption over time per module (esp. AI calling = flagship).

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | `GET …/activation` (rate + milestone funnel), `…/cohorts?cohortBy=signup_week`, `…/scores?type=activation` |
| BE | emit typed `milestone_hit` from product (login/data/AI-call/return); `scoringService` computes M-S2 nightly; activation funnel aggregator |
| FE | `pages/crm/dashboards/ProductDashboard.tsx`; reuse `<FunnelWidget/>` (vertical), `<CohortGrid/>`, `GlassDataTable` |
| Instrumentation | add `milestone_hit` emission in `real-estate-crm-app` flows + `ai-calling-service` first-call hook |
| Deps | EP-2 (events), EP-5 (activation score), EP-7 (cohorts), onboarding (`../onboarding/`) |

## 6. Alert thresholds (product-facing)

| Condition | Metric | Action |
|---|---|---|
| Activation rate < 40% | M-A1 | onboarding-CRO sprint on drop milestone |
| A single milestone < 50% completion | M-A2 | fix that step (empty-state / nudge) |
| Time-to-activate rising | M-A3 | friction added — review recent release |
| Cohort activation declining WoW | M-A6 | regression — investigate funnel |
| AI-call milestone lagging others | M-A2 | flagship feature under-adopted → in-app prompt |

## 7. Edge cases & empty states

- **Trial not yet 7 days old:** excluded from activation-rate denominator (still in window) to avoid understating.
- **Milestone event missing (instrumentation gap):** flagged as "untracked" so the funnel reconciles, not silently 0%.
- **Demo-mode / internal accounts:** excluded from activation cohorts via flag.
- **No trials in range:** zero-state with link to Marketing funnel (top-of-funnel issue, not activation).

## 8. Decision cadence

| Cadence | Product action |
|---|---|
| Daily | watch milestone drop point |
| Sprint | ship one activation fix; measure lift |
| Monthly | cohort trend review with Growth/oracle |

The four milestones map to verified features (`01-business-memory §3`): login, lead/property add, AI call (`ai-calling-service`), day-3 return.

Cross-refs: `metric-dictionary.md §6,§7 (M-S2)`, `../implementation/technical-designs/technical-designs.md §4.2` (activation weights), `onboarding-cro` skill.
