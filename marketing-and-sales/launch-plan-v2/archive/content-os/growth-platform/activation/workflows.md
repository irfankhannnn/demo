# Activation Automations — RealEstateFlow

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md`.

The activation automation catalogue. Every workflow runs on the existing **scheduled-notification engine** (`SCHEDULED_NOTIFICATION`, `PK=TENANT#{t}#SCHEDULED`, `SK=DUE#{dueAt}#{id}`) via `sequenceService` + `SEQUENCE_ENROLLMENT` (`technical-design.md` §2.3, §6). Triggers are activation events (`events.md`); state is the activation score/band (`milestones-and-score.md`). Channels: WhatsApp Business API + email + in-app + AI-call, all **consent-gated** (`technical-design.md` §7). Copy reuses Sales-OS [`onboarding-script.md`](../../../../40-sales-and-conversion/onboarding-script.md) + WhatsApp [`customer-success.md`](../../../../30-channels/whatsapp/customer-success.md). Epic: EP-4.

---

## 1. Catalogue

| ID | Name | seqId | Trigger | Primary channel |
|---|---|---|---|---|
| **WF-ACT-01** | Trial-Started onboarding drip (7-day) | `onboarding_7d` | `trial_started` | WhatsApp + in-app |
| **WF-ACT-02** | Milestone-nudge (next-best-action) | `onboarding_7d` (branch) | `milestone_hit` / partial band | WhatsApp + in-app |
| **WF-ACT-03** | Stuck-at-step recovery | `winback` (activation) | `trial_inactive` / `stuckAtStep` | WhatsApp → AI-call |
| **WF-ACT-04** | Aha-recovery (no AI call by Day 4) | `winback` (aha) | Day≥4 AND M3 missing | WhatsApp + human/AI-call |
| **WF-ACT-05** | Aha-celebration + advocacy seed | `post_activation` | `customer_activated` | WhatsApp + in-app |

All enroll on the same machinery: write `SEQUENCE_ENROLLMENT` + a paired `SCHEDULED_NOTIFICATION` at `nextAt`; due-scan worker (`sequenceWorker`) advances/reschedules; cancel removes the future scheduled item.

---

## 2. WF-ACT-01 — Trial-Started onboarding drip (7-day)

| | |
|---|---|
| **Trigger** | `trial_started` event |
| **Conditions** | `consent.whatsapp == true`; segment resolved (solo/agency) for branch |
| **Actions (steps)** | Mirrors `onboarding-script.md` 7-day; each step = scheduled WhatsApp + in-app checklist update |
| **Notifications** | Day0 welcome+import · Day1 follow-up nudge · **Day2 AI-call (aha)** · Day3 team(agency)/property(solo) · Day5 khata · Day7 week-1 review (dashboard numbers) |
| **Branch** | agency → Day3 `team_invited`; solo → Day3/4 `buyer_matched` |
| **Cancel** | `customer_activated` (→ hand to WF-ACT-05) · opt-out · manual |
| **Metric** | W1 activation rate, Day-2 AI-call rate (`activation-framework.md` §6) |
| **Outcome** | 3/4 milestones by Day 7 → activated |

Verbatim copy lives in `customer-success.md` §2 (Day0–Day7) — do not fork; reference by day. Each step is consent-gated and skips if the milestone is already hit (e.g. don't nudge import if M1 done).

---

## 3. WF-ACT-02 — Milestone-nudge (next-best-action)

| | |
|---|---|
| **Trigger** | `milestone_hit` event OR nightly band==`partial` |
| **Conditions** | trial active; ≥1 core milestone still missing; not enrolled in WF-ACT-03/04 |
| **Action** | Compute next-best missing core milestone (priority M3 > M1 > M4/M4′ > M2); send the single matching nudge + in-app checklist highlight |
| **Notifications** | "Aapne X kar liya 👏 ab Y — 2 min lagega 👇" (one ask, never a list) |
| **Agency variant** | owner active but team dormant → team-training offer (`onboarding-script.md` stall table) |
| **Cancel** | core-4 complete; no-reply×3 → escalate to WF-ACT-03 |
| **Metric** | avg milestones/trial, missing-milestone conversion rate |
| **Outcome** | partial → activated |

Single-ask discipline: surfaces exactly one next action, in peak windows (6–8 AM / 12–1 PM / 6–8 PM). Idempotent — one nudge per milestone gap per 24h (`stepToken`).

---

## 4. WF-ACT-03 — Stuck-at-step recovery

| | |
|---|---|
| **Trigger** | `trial_inactive` (no login 48h) OR `stuckAtStep` set by nightly job |
| **Conditions** | trial active, not activated; consent for channel |
| **Actions (escalating)** | Step1 (T+0): personal WhatsApp nudge for the exact step · Step2 (T+2d): offer 10-min setup call ("main khud set kar deta hoon") · Step3 (T+4d): **founder escalation** if multi-red |
| **Step→blocker map** | `setup` → import-help · `aha` → route to WF-ACT-04 · `habit` → quick-win they haven't tried (khata/matching) |
| **Channel ladder** | WhatsApp → AI-call reminder → human founder call |
| **Cancel** | login resumes / milestone hit / reply → `sequenceService.cancel(reason)` |
| **Metric** | stuck rate, recovery rate (back-to-active within 72h) |
| **Outcome** | reactivated trial; reduced 48h-inactive churn |

Maps 1:1 to the Sales-OS stall-recovery plays (`onboarding-script.md`). Proactive rule: fire *before* full silence where score recency is decaying.

---

## 5. WF-ACT-04 — Aha-recovery (the #1 escalation)

| | |
|---|---|
| **Trigger** | Day ≥ 4 of trial AND M3 (`first_ai_call`) missing — highest-priority recovery |
| **Conditions** | pipeline may or may not exist; phone present |
| **Actions** | "AI calling abhi tak try nahi kiya — yeh toh main feature hai. Abhi 2 min mein on kar dun?"; offer **live** pre-staged AI call on a real lead (screen-share/WhatsApp), per aha-engineering rule |
| **Notifications** | WhatsApp concrete offer → if no reply, human/AI-call to schedule |
| **Cancel** | `first_ai_call` fires (aha reached) → WF-ACT-05 |
| **Metric** | Day-2 AI-call rate, aha-recovery conversion |
| **Outcome** | aha reached late but reached — the make-or-break moment |

Per `onboarding-script.md`: "If Day-2 AI call doesn't happen → this is your #1 escalation." This workflow encodes that priority above all other activation automations.

---

## 6. WF-ACT-05 — Aha-celebration + advocacy seed

| | |
|---|---|
| **Trigger** | `customer_activated` event |
| **Conditions** | activated=true; positive sentiment (no open objection flag) |
| **Actions** | In-app celebration state ("🎉 Activated!"); WhatsApp win message with *their own* numbers (X leads, Y AI calls, Z follow-ups); capture reaction (consent) as testimonial seed |
| **Notifications** | Day-7 review verbatim (`onboarding-script.md` §7-day); seeds content `FW-AI` |
| **Hand-off** | → retention cadence (`retention/retention-system.md`); referral ask **after first win**, never before (`referral.md`) |
| **Cancel** | n/a (terminal, single-fire) |
| **Metric** | activated→paid rate, referral-ask rate, testimonials captured |
| **Outcome** | activation → proof → referral loop start |

---

## 7. Cross-workflow rules

1. **Mutual exclusion:** a trial is in at most one recovery workflow at a time; priority **WF-ACT-04 > WF-ACT-03 > WF-ACT-02**. Activation (WF-ACT-05) cancels all drips.
2. **Consent + opt-out:** no WhatsApp/email send without stored `consent`; opt-out honored ≤1 cycle (`technical-design.md` §7). In-app + AI-call respect the same flags.
3. **Idempotency:** each scheduled step carries `stepToken`; worker conditionally marks `SENT#{stepToken}` (no double-send under SQS at-least-once).
4. **Peak windows:** scheduled sends pinned to 6–8 AM / 12–1 PM / 6–8 PM IST.
5. **Skip-if-done:** any step whose milestone is already hit is skipped at fire time (re-read SCORE).
6. **Engineering:** all five = `sequenceService` configs (EP-4); triggers wired in `automationEngine` from `events.md` derived events; acceptance in `implementation.md` AC-4/AC-5.
