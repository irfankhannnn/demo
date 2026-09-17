# Activation Framework — RealEstateFlow Growth Platform (Phase 4)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/50-measurement/activation-definition.md`.

The product-led definition of "activated" for an Indian real-estate brokerage on RealEstateFlow. This file defines the *what* (aha, funnel, targets, segments, north-star). Milestones + score math → [`milestones-and-score.md`](./milestones-and-score.md); event JSON → [`events.md`](./events.md); automations → [`workflows.md`](./workflows.md); engineering → [`implementation.md`](./implementation.md). Grounds on the real stack (`technical-design.md` §2.4 SCORE, §4.2 activation score) and reuses the Sales-OS [`onboarding-script.md`](../../../../40-sales-and-conversion/onboarding-script.md) + WhatsApp [`customer-success.md`](../../../../30-channels/whatsapp/customer-success.md). Features per [`01-business-memory.md`](../../../../10-audience-and-voice/product-truth.md) §3.

---

## 1. What "activated" means

> A brokerage is **activated** when it has (a) an **organized pipeline** of real leads inside RealEstateFlow and (b) experienced the **AI calling aha** on a real lead — and returns to do it again. Activation is a *behaviour state*, not a payment state; it is the single biggest predictor of trial→paid and of retention (`customer-journey.md`).

Activation is computed, not declared: an `activationScore` (0–100) + a **milestone count** stored on the `SCORE` entity (`EntityType: SCORE`, `SK = SCORE#LEAD`). Threshold = **3 of 4 core milestones in week 1** → `activated = true` (matches `technical-design.md` §4.2 and `growth-dashboard.md`).

---

## 2. The aha-moment

| | Detail |
|---|---|
| **Primary aha** | The broker watches **AI place + qualify a real follow-up call** on *their own* lead (AI Calling, business-memory §3.6 — flagship differentiator). |
| **Supporting aha** | An **organized pipeline exists** — 10+ real leads imported with a follow-up reminder set (business-memory §3.1, §3.4). |
| **Why this pair** | Pipeline alone = "another CRM". AI call alone = a demo trick. Together = "the system works *for me* on *my* leads" — the emotional flip from chaos to control ("Agency ki Growth, Aapke Control Mein"). |
| **Event that marks it** | `first_ai_call` MKT_EVENT (`channel=ai_call`) fired from `agency-app/ai-calling/` callback, while ≥10 leads exist. |
| **Engineering** | Instrument `first_ai_call` + `leads_imported` events (see `events.md`); aha = both true. Acceptance: `implementation.md` AC-1, AC-3. |

**Aha-engineering rule (from `onboarding-script.md`):** do the first AI call *live with the broker watching* (screen-share / WhatsApp call), on a pre-staged real lead. If Day-2 AI call hasn't fired → it is the **#1 escalation** (workflow `WF-ACT-04`).

---

## 3. Time-to-value (TTV) targets

| Milestone | Target | Stretch | Metric source |
|---|---|---|---|
| First login after trial start | < 2 h | < 30 min | `trial_started` → `login` events |
| Pipeline exists (10+ leads) | Day 0 (close call) | Day 1 | `leads_imported` event count |
| First follow-up reminder set | Day 1 | Day 0 | `followup_set` event |
| **Aha: first AI call** | **Day 2** | Day 0–1 | `first_ai_call` event |
| 3/4 milestones (activated) | **Day 7** | Day 3 | milestone count on `SCORE` |
| Habit (return on ≥3 distinct days wk1) | Day 7 | — | distinct-day `login` count |

North-star TTV = **time from `trial_started` to `customer_activated`**; target median **≤ 48 h**, P75 ≤ 7 days.

---

## 4. The activation funnel

```
 SIGNUP ─────► SETUP ─────────► AHA ───────────► HABIT ─────────► (→ PAID, retention/)
 trial_started  leads_imported   first_ai_call    return ≥3 days
 + login        followup_set     (pipeline ≥10)   feature breadth ≥3
   │              │                 │                │
   ▼              ▼                 ▼                ▼
 score 0–20     score 20–45       score 45–70      score 70–100
 "logged in"    "pipeline built"  "ACTIVATED"      "habit formed"
```

| Stage | Entry event | Exit event | Target conv. | Drop-off cause | Recovery automation |
|---|---|---|---|---|---|
| Signup→Setup | `trial_started` | `leads_imported` | 80% | never logs in / no data | `WF-ACT-01` drip + `WF-ACT-03` stuck-at-import |
| Setup→Aha | `leads_imported` | `first_ai_call` | 65% | scared of AI call / friction | `WF-ACT-04` aha-recovery (live call offer) |
| Aha→Habit | `first_ai_call` | `customer_activated` | 75% | one-and-done | `WF-ACT-02` milestone-nudge |
| Habit→Paid | `customer_activated` | `paid` | 25–35% | value not in ₹ | Day-30 ROI review (retention-system) |

Funnel rolls up via `GSI-EventType` (`technical-design.md` §2.2) — counts by `type` per cohort. Dashboard widget: `implementation.md` §UI.

---

## 5. Segment variants

| | **Solo broker** (Free/Starter, 1–2 users) | **Agency** (Growth/Pro, 5–15+ users) |
|---|---|---|
| Activated def. | 3/4: leads, follow-up, **AI call**, buyer↔property match | 3/4: leads, follow-up, **AI call**, **team invited + RBAC** |
| Aha emphasis | AI call + property/buyer matching depth | AI call + team adoption (≥2 members active) |
| Day-3 path | Add properties + match a buyer (skip team) | Invite team + set RBAC roles (`onboarding-script.md` §7-day) |
| Extra milestone | `buyer_matched` weighted up | `team_invited` + `member_active` weighted up |
| Key risk | one-person bottleneck → low return frequency | owner-active-team-dormant (`WF-ACT-02` team variant) |
| Detection | `tenant.userCount ≤ 2` OR plan ∈ {Free,Starter} | `userCount ≥ 3` OR plan ∈ {Growth,Pro} |

Segment is read from tenant config at scoring time; milestone weights branch on it (`milestones-and-score.md` §2).

---

## 6. North-star activation metric (NSAM)

**NSAM = % of trials that reach `customer_activated` within 7 days** (W1 Activation Rate).

```
W1_Activation_Rate = activated_trials_w1 / trials_started_in_cohort
target: ≥ 60%   ·   floor (alert): < 45%
```

Supporting (leading) metrics, all event-derived:

| Metric | Formula | Target | Event source |
|---|---|---|---|
| Day-2 AI-call rate | first_ai_call≤48h / trials | ≥ 70% | `first_ai_call` |
| Median TTV-to-aha | median(first_ai_call − trial_started) | ≤ 48 h | both events |
| Avg milestones / trial (wk1) | Σ milestones / trials | ≥ 3.0 | milestone events |
| Setup completion | leads_imported / trials | ≥ 80% | `leads_imported` |
| Stuck rate | trials stalled >48h at a step | < 20% | step events + recency |

NSAM and leading metrics are computed nightly by `scoringService` (EP-5) and surfaced in the activation dashboard widget (EP-7). Every recommendation here ties to an event (`events.md`) and an engineering task (`implementation.md`).
