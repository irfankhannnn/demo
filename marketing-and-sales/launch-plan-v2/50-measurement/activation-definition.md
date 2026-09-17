# Activation definition

Activation is the single number the PMF gate turns on (`00-PLAN-OVERVIEW.md` §4: ≥40% of trials activated). Two definitions exist in the repo, they measure different populations, and **this file does not pick between them**.

> Open decision D27 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Merged from `archive/content-os/growth-platform/activation/activation-framework.md` and `.../milestones-and-score.md`.

---

## Definition A — the launch plan's

> The owner connects WhatsApp and the AI Employee handles at least one inbound lead end to end, within 7 days of signup.

Source: `00-PLAN-OVERVIEW.md` §1 and §5, which names PostHog `ai_employee_lead_handled` as the measurement.

Problems with it, stated plainly:

- The AI Employee is a **paid add-on with no trial** (`pricing.json`, tier `ai_employee_addon`). A Solo or Team trial user cannot reach this definition without buying the add-on first, so the definition cannot describe most trials.
- AI calls consume credits (`apps/crm/server/creditConfig.js`), so even a paying tenant's activation has a cost attached to it.
- The event is **not fired by any code** ([`posthog-event-map.md`](./posthog-event-map.md) §4), so the number cannot currently be read at all.

## Definition B — the June growth platform's

> Activated = three of four week-one milestones, with an activation score of 70 or more out of 100.

Milestones in the June design: 10+ leads imported · first follow-up reminder set · **first AI call fired** (the "aha") · plus team invited (agency) or buyer matched to a property (solo). Weighted 18 / 12 / 25 / 15, with recency and feature-breadth bonuses.

Problems with it:

- It targets ≥60% activation with a 45% floor, which contradicts the PMF gate's ≥40%. The gate number wins; the 60% is dropped.
- It segments on a Free / Starter / Growth / Pro plan ladder that **does not exist**. The real plans are Solo, Team, Team+ and the AI Employee add-on (`pricing.json`), so the solo/agency split should read "Solo plan" vs "3+ seats" (`apps/crm/server/subscriptionService.js`).
- It needs a `scoringService` and a `SCORE` entity, neither of which exists. **Design only — not built.**
- It puts the aha on the AI call, which the current onboarding does not ask for. Onboarding asks the user to connect WhatsApp (`apps/crm/real-estate-crm-app/src/pages/onboarding/ConnectWhatsApp.tsx`).

## What the product actually onboards to today

Worth stating, because whichever definition wins should be reachable by the flow that exists:

1. Phone OTP login (`src/pages/PhoneLogin.tsx`) — fires `signup_started`, `otp_verified`, captures UTM.
2. Role selection (`src/pages/RoleSelection.tsx`) — `onboarding_role_selected`.
3. Connect WhatsApp (`src/pages/onboarding/ConnectWhatsApp.tsx`).
4. Choose plan (`src/pages/onboarding/ChoosePlan.tsx`) — `onboarding_plan_buy_clicked`, `onboarding_trial_started`; the trial record is created in `apps/crm/server/subscriptionService.js`.

A trial email drip already runs at day 10, day 12, day 14 and after expiry (`apps/crm/server/scripts/trial-reminder-cron.js`). Any activation nudge should extend that cron rather than start a parallel one.

## The milestone list, kept

Independent of which definition wins, these are the behaviours worth tracking. Weights are deliberately omitted — they were the part that contradicted itself across three June documents.

| Milestone | What it means | Observable today? |
|---|---|---|
| First login after signup | they came back at all | PostHog session activity |
| A real pipeline exists | leads in the CRM, not a demo tenant | CRM query; `lead_added` is declared but unfired |
| WhatsApp connected | the channel the product runs on is live | not instrumented; `ai_employee_connected` is declared but unfired |
| A follow-up or meeting set | they are working the pipeline | not instrumented; `meeting_scheduled` declared but unfired |
| First AI call or AI-handled lead | the differentiator was experienced | AI call outcomes land in `apps/crm/server/routes/aiCallingInternal.js`; no PostHog event |
| Returned on three separate days in week one | habit | PostHog session activity |
| Team invited | relevant only on Team / Team+ | `invite_accepted` declared but unfired; the seat cap on Solo fires `paywall_seat_limit_hit` |

## How to measure it until the decision lands

At three to five trials a week, count by hand. Keep a row per trial in the prospect sheet with: signup date, plan, WhatsApp connected y/n, first real lead y/n, follow-up set y/n, AI-handled lead y/n, returned in week one y/n. Fill it from the CRM and from your own conversations with the customer. Then row 3 of the [`weekly-scorecard.md`](./weekly-scorecard.md) is the fraction meeting whichever definition you noted in the cell.

This is not a stopgap to be embarrassed about: at this volume a hand-kept list is more accurate than an uninstrumented funnel, and it tells you *why* a trial stalled, which no dashboard would have.

## The one instrumentation ask

If D27 settles on anything AI-Employee-shaped, `ai_employee_connected` and `ai_employee_lead_handled` have to be emitted before the number can be read automatically. That is the whole build ask — two `trackEvent` calls. See [`posthog-event-map.md`](./posthog-event-map.md) §4.
