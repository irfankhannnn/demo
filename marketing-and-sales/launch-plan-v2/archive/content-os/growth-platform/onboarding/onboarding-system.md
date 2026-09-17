# Onboarding System — RealEstateFlow (Product-Led + Assisted)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/onboarding-script.md`.

The complete onboarding system: **product-led** (in-app checklist, empty states, setup wizard) PLUS **human/WhatsApp-assisted** (Sales-OS [`onboarding-script.md`](../../../../40-sales-and-conversion/onboarding-script.md) + WhatsApp [`customer-success.md`](../../../../30-channels/whatsapp/customer-success.md)). Milestone-driven (`activation/milestones-and-score.md`), 7-day + 30-day, with engineering requirements for the in-app checklist. Aha = first AI call + organized pipeline (`activation/activation-framework.md` §2). Features per `01-business-memory.md` §3.

---

## 1. Two onboarding tracks, one milestone backbone

Both tracks drive the **same activation milestones** (M1–M7) and emit the **same events** (`activation/events.md`) — they are complementary, not duplicate.

| | **Product-led (in-app)** | **Assisted (human / WhatsApp / AI-call)** |
|---|---|---|
| Owner | Product (checklist, wizard, empty states) | CS / founder via WhatsApp drip (WF-ACT-01..04) |
| Scales to | every trial, 24×7, zero marginal cost | high-value / agency / stuck trials |
| Drives | M1, M2, M3, M5, M6 self-serve | M3 aha (live), M4 team, stuck-recovery |
| When | always-on from `trial_started` | Day 0 close call + proactive nudges |
| Source of truth | this file | `onboarding-script.md`, `customer-success.md` |

**Rule:** in-app checklist completion silences the matching WhatsApp nudge (skip-if-done, `workflows.md` §7) — the human track only fires where the product track stalls.

---

## 2. Product-led onboarding

### 2.1 Setup wizard (first session, post `trial_started`)
Stepped wizard on first login (`apps/onboarding/` + new `SetupWizard.tsx`):
1. **Agency profile** — name, city (Mumbai/Pune/Delhi/Bangalore), team size → sets `segment` (solo/agency).
2. **Import leads** — paste/upload sheet or manual add → emits `leads_imported` (target ≥10 → M1).
3. **Set first follow-up** — pick a lead, set reminder → `followup_set` (M2).
4. **Try AI calling** — pre-staged real lead, one-tap "AI ko call lagane do" → `first_ai_call` (M3, AHA).
5. **Branch:** agency → invite team + role (M4); solo → match a buyer to property (M4′).

Wizard is skippable/resumable; state derives from the SCORE entity, not wizard-local — so progress survives drop-off.

### 2.2 In-app checklist (persistent)
A dismissible-but-recallable checklist widget (mobile-first) showing the 4 core milestones + breadth, each deep-linking to its feature with the matching empty-state CTA. Progress bar = `milestoneCountCore4 / 4`. Engineering spec in §5.

### 2.3 Empty states (the silent onboarding)
| Surface (file) | Empty state | CTA → milestone |
|---|---|---|
| LeadList | "Abhi koi lead nahi — apni list import karo" | import → M1 |
| AICalling dashboard | "AI se pehli call lagao — dekho magic" | start call → M3 (aha) |
| Calendar/Follow-ups | "Pehla follow-up reminder set karo" | set reminder → M2 |
| KhataBook | "Commission ka hisaab yahan — pehli entry" | add entry → M5 |
| Hierarchy (agency) | "Team invite karo, role set karo" | invite → M4 |
| CRMDashboard | populates after data; teaser of "kahan leads atke" | view → M6 |

Empty states are the highest-leverage, lowest-cost onboarding surface — they convert curiosity into the next milestone with one tap.

---

## 3. 7-day onboarding (in-app + assisted, milestone-driven)

Mirrors `onboarding-script.md` 7-day; in-app drives self-serve, WhatsApp (WF-ACT-01) drives assisted. Verbatim Hinglish copy in `customer-success.md` §2 — do not fork.

| Day | In-app (product-led) | Assisted (WhatsApp/call) | Milestone | Event |
|---|---|---|---|---|
| 0 | Wizard: profile + import 10 leads | Welcome + live import on close call | M1, M7 | `leads_imported`,`login` |
| 1 | Checklist nudges follow-up | "Aaj 3 leads pe reminder lagao" | M2 | `followup_set` |
| **2** | One-tap AI call from lead | **Live AI call together (the aha)** | **M3** | `first_ai_call` |
| 3 | agency: invite UI / solo: match UI | team invite or buyer-match nudge | M4/M4′ | `team_invited`/`buyer_matched` |
| 5 | Khata empty-state CTA | "Commission ka hisaab daal do" | M5 | `khata_setup` |
| 6 | Checklist surfaces unused feature | friction check ("kuch atka?") | breadth | — |
| 7 | Dashboard auto-shows wk-1 numbers | Week-1 review call w/ their data | M6, activated | `dashboard_viewed`,`customer_activated` |

Solo skips Day-3 team-invite (deeper property/buyer matching); agency emphasises Day-3 RBAC + Day-7 team-adoption review (`onboarding-script.md` §solo-vs-agency).

---

## 4. 30-day onboarding (habit → expansion)

Hand-off from activation to retention after Day 7. Mirrors `onboarding-script.md` 30-day.

| Week | Focus | In-app | Assisted |
|---|---|---|---|
| 1 (D0–7) | Activation | wizard + checklist → 3/4 | WF-ACT-01..05 |
| 2 (D8–14) | Habit | daily lead-entry default; AI calling on a *batch*; first khata settlement | "pipeline move ho raha hai" proof |
| 3 (D15–21) | Depth | full team active (agency); real buyer–property matches; dashboard review | "kahan leads atak rahe" review |
| 4 (D22–30) | Value + expansion | usage-limit prompts (`paywall-upgrade-cro`) | **Day-30 ROI review in ₹**; review + referral ask |

Day-30 verbatim ROI script: `onboarding-script.md` §30-day. Hand to `retention/retention-system.md` cadence after Day 30.

---

## 5. Engineering requirements — in-app checklist component

| Aspect | Requirement |
|---|---|
| Component | `components/activation/OnboardingChecklist.tsx` (React+TS, mobile-first, Tailwind, primary `#2563EB`). |
| Data source | `GET /api/marketing/score/{entityId}` → `{ milestones{}, milestoneCountCore4, band, segment }` (`activation/implementation.md` §3). No client-side scoring. |
| Items | render core-4 (segment-aware M4/M4′) + breadth M5/M6; each: label (Hinglish), state (todo/done + `at`), deep-link route to feature. |
| Progress | bar = `milestoneCountCore4/4`; show `activated` celebration at 4 (ties WF-ACT-05). |
| Refresh | re-fetch on focus + after any milestone action; optimistic tick on event emit. |
| Empty-state contract | each feature page checks its milestone via the same payload and renders the §2.3 CTA. |
| Wizard | `SetupWizard.tsx` resumable; persists nothing locally — derives from SCORE so it survives logout/drop-off. |
| Consent | wizard captures `consent.whatsapp/email` (gates WF-ACT-01 sends, `technical-design.md` §7). |
| Events | each completed step emits the matching `MKT_EVENT` (`events.md`); UI emits facts, never scores. |
| Acceptance | checklist reflects server milestone state within 1 refresh; activated state appears when `milestoneCountCore4≥3 && score≥70`; consent captured before any send. |

---

## 6. Metrics & ties

| Metric | Target | Source |
|---|---|---|
| Setup-wizard completion | ≥ 80% reach step 4 | wizard step events |
| In-app checklist → milestone | ≥ 50% of milestones via in-app (vs assisted) | event `source` |
| Empty-state CTA click→milestone | ≥ 40% | UI events |
| W1 activation rate (NSAM) | ≥ 60% | `customer_activated` |
| Day-2 AI-call rate | ≥ 70% | `first_ai_call` |

Engineering: EP-7 (checklist/wizard UI), EP-4 (assisted drip), EP-5 (score feed). Every onboarding step ties to a milestone, an event, and a metric — product-led and assisted reinforce, never duplicate.
