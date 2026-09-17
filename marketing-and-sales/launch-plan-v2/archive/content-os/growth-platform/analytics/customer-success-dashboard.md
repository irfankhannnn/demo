# Customer Success Dashboard

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/weekly-scorecard.md`.

**Purpose:** answer "Who will churn, and who is ready to expand or refer?" **Audience:** CS / Founder (ADMIN). **Decision supported:** win-back enrollment for at-risk accounts, expansion plays for ready accounts, referral asks for advocates. Metrics by ID from `metric-dictionary.md`.

**Refresh:** daily (post nightly `scoringService` recompute). **RBAC:** ADMIN-only; revenue panels admin-gated.

---

## 1. Panels & metrics

| # | Panel | Metrics | Viz |
|---|---|---|---|
| 1 | Health distribution | M-S3 health (Healthy/At-risk/Critical %) | stacked bar / donut |
| 2 | **At-risk list** | M-S3 <40 + M-O3 (no-login 48h) | `GlassDataTable` (account, score, days-since-login, action) |
| 3 | Expansion-ready | M-S4 expansion score ≥70 | `GlassDataTable` (usage vs plan limit, suggested tier) |
| 4 | Referral advocates | M-S5 referral score ≥70 | `GlassDataTable` (NPS, tenure, prior referrals, ask CTA) |
| 5 | Retention/NRR | M-A5 churn, M-R6 NRR, M-R4 expansion, M-R5 churned MRR | trend lines + `<MetricCard/>` |
| 6 | Cohort retention | M-A6 by signup week | `<CohortGrid/>` |

---

## 2. Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ HEALTH  Healthy 62% · At-risk 26% · Critical 12%            │
│ NRR 108%  churn 4%  expansion MRR ₹—                        │
├──────────────────────────────┬──────────────────────────────┤
│ AT-RISK (action: win-back)   │ EXPANSION-READY (action:upsell)│
│  ⚠ Sharma 34  no-login 6d    │  ↑ Mehta  hit lead-limit →Pro │
│  ⚠ Khan   28  support-flag×2  │  ↑ Verma  15 users →seat add  │
├──────────────────────────────┴──────────────────────────────┤
│ REFERRAL ADVOCATES (action: ask)  NPS9 · tenure 8mo          │
├─────────────────────────────────────────────────────────────┤
│ COHORT RETENTION (signup-week × D7/D30/D90)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data sources & events

| Panel | Source |
|---|---|
| Health | `SCORE.healthScore` (nightly) + `signals` |
| At-risk | `SCORE` <40 ⋈ login events (M-O3) |
| Expansion | `SCORE.signals` usage-vs-`plan` (pricing tiers, `01-business-memory §5`) |
| Referral | `SCORE` (M-S5) ⋈ `REFERRAL` history (GSI8) |
| Retention/NRR | billing ⋈ `paid`/cancel/upgrade |
| Cohorts | `/dashboard/cohorts?cohortBy=signup_week` |

---

## 4. Drill-downs

- At-risk row ▸ → enroll `winback` sequence (`POST /sequences/enroll seqId=winback`) → feeds `nurture-bot`.
- Expansion row ▸ → paywall/upgrade play; create `CAMPAIGN` expansion offer.
- Advocate row ▸ → issue referral code (`POST /api/referrals`) → feeds `sdr`/`nurture-bot`.
- Critical band ▸ → CS alert (in-app notification via `notificationDynamodbService`).
- Cohort cell ▸ → list of accounts in that cohort + their health.

---

## 5. Implementation requirements

| Layer | Item |
|---|---|
| API | `GET …/scores?type=health&band=critical`, `…/scores?type=expansion`, `…/scores?type=referral`, `…/cohorts`, `…/efficiency?metric=nrr` |
| BE | `scoringService.js` computes health/expansion/referral nightly (EventBridge cron); writes `SCORE`; Critical → notification |
| FE | `pages/crm/dashboards/CustomerSuccessDashboard.tsx`; reuse `GlassDataTable`, `<CohortGrid/>`, `<ScoreBand/>`, `NotificationCenter` hook |
| Deps | EP-5 (scoring), EP-6 (referral), EP-4 (win-back sequence), EP-7 (cohorts) |

## 6. Alert thresholds (CS-facing)

| Condition | Metric | Action |
|---|---|---|
| Health drops into Critical (<40) | M-S3 | in-app alert + auto win-back enroll |
| Health falling 2 cycles (trend) | M-S3 | proactive check-in before Critical |
| Expansion score ≥70 | M-S4 | upsell play to next tier |
| Referral score ≥70 | M-S5 | issue referral code |
| Churned MRR spike WoW | M-R5 | root-cause review → Product |

## 7. Edge cases & empty states

- **New customer (<28d tenure):** health shown as provisional (insufficient login history) — not flagged Critical prematurely.
- **Score gap (nightly job lag):** stale-badge with `computedAt`; never shows blank.
- **Plan = Free:** excluded from expansion-ready and NRR (no MRR) but kept in health for conversion play.
- **No survey data:** referral score computes without NPS term, flagged lower-confidence.

## 8. Decision cadence

| Cadence | CS action |
|---|---|
| Daily | clear at-risk list (enroll win-back / call) |
| Weekly | expansion + advocate outreach batch |
| Monthly | NRR + cohort review with Founder |

Cross-refs: `metric-dictionary.md §6,§7`, `../implementation/technical-designs/technical-designs.md §4.3` (health algorithm), `churn-prevention`/`retention-analysis` skills.
