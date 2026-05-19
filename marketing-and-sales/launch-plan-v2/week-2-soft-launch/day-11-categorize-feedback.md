# Day 11 — Categorize Beta Feedback + Plan Critical Fixes

> **Type:** 🤖 AUTO
> **Phase:** Week 2
> **Skill(s):** `customer-research` + `signup-flow-cro` + `onboarding-cro`
> **Estimated time:** 0.5h founder + 4h AI

## Objective
Aggregate Day 10 call notes + Crisp tickets + PostHog drop-off events into a single triaged backlog (P0 ship-by-Day-12 / P1 ship-by-Day-14 / P2 defer-to-Week-4). Identify patterns across testers (e.g., "5/8 testers got stuck on phone OTP") rather than treating each as one-off.

## Why This Matters for RealEstateFlow
Beta data is gold but raw notes are noise. Day 11 turns it into a ranked, executable list so Day 12 fixes the highest-leverage bugs and Days 13-14 can run check-in drips against a stable product.

## User Story
As founder reading 8-12 call notes + Crisp + PostHog, I want a single ranked backlog of beta feedback patterns, so Day 12 fixes the right 5 things — not 30 random items.

## Acceptance Criteria
- [ ] Aggregated backlog at `marketing-and-sales/launch-implement/week-2/day-11-feedback-backlog.md` with: pattern title, observed-by-N-testers count, severity P0/P1/P2, ICE score, proposed fix, file location, fix-by-day
- [ ] Patterns require ≥2 testers (singletons go to "individual feedback" section, not P0)
- [ ] Each P0 has explicit "fix-by-Day-12 EOD" tag
- [ ] Each P1 has "fix-by-Day-14 EOD" tag
- [ ] Insights summary at top: top 3 wedge-validation signals, top 3 wedge-risk signals
- [ ] Personas updated if new pattern emerges (e.g., 5/8 want feature X — update Priya/Arjun/Suresh)
- [ ] Action items per tester listed in `day-11-tester-followups.md`: who needs reschedule, who needs trial extension, who needs feature commit
- [ ] Day 12 fix queue locked + assigned to AI agent batch

## AI Prompt (🤖)

```
Read inputs:
- All `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{slug}.md` (8-12 files)
- `marketing-and-sales/launch-implement/week-2/day-10-friction-aggregate.md` (founder's pre-aggregation)
- Crisp tickets exported (or scrape last 48h via Crisp API)
- PostHog drop-off events for the beta cohort (last 48h, where users abandoned the funnel)
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/launch-implement/week-1/day-01-backlog.md` (cross-reference: are Week-1 fixes still showing up in Week 2?)

Produce:

## 1. `marketing-and-sales/launch-implement/week-2/day-11-feedback-backlog.md`

### Insights summary
- Top 3 wedge-validation signals (e.g., "6/8 testers said 'AI Employee on WhatsApp is exactly what I need'")
- Top 3 wedge-risk signals (e.g., "3/8 testers asked for Excel import" — minor; "1/8 questioned ₹999 too cheap to be real" — high)
- Persona insight updates (if any)

### Patterns table
| Pattern | Observed by N testers | Severity | ICE | Proposed fix | File location | Fix-by-day |
|---|---|---|---|---|---|---|

Group by area: signup/auth, onboarding, CRM core, Khata, AI Employee, paywall, performance.

### Individual feedback (singletons)
For items only 1 tester mentioned. Flag as "validate next cohort".

### Day 12 fix queue (P0 only)
List 3-5 items max for Day 12. Each: title, file, fix description, expected effort (S/M/L), AI prompt if Cascade can fix it.

## 2. `marketing-and-sales/launch-implement/week-2/day-11-tester-followups.md`
Per-tester action plan:
- Tester X: needs reschedule for Day 13 (couldn't finish onboarding)
- Tester Y: requested 30-day trial extension — already issued
- Tester Z: wants AI Employee comp — confirm with founder before issuing
- Tester ABC: high promoter signal — book testimonial Day 14
- ...

## 3. `marketing-and-sales/launch-implement/week-2/day-11-cohort-health.md`
Status across the cohort:
- Total testers: N
- Activated (PostHog `feature_first_use`): X/N
- Stuck on signup: Y/N
- Stuck mid-onboarding: Z/N
- High promoter signal (willingness-to-pay 8+): W/N
- Confirmed for testimonial Day 14: V/N

Stop. Do not auto-fix anything (Day 12).
```

## Inputs
- 8-12 call notes from Day 10
- Crisp tickets
- PostHog drop-off events
- Persona docs

## Outputs
- `marketing-and-sales/launch-implement/week-2/day-11-feedback-backlog.md`
- `.../day-11-tester-followups.md`
- `.../day-11-cohort-health.md`

## Success Criterion
Backlog has ≥2-tester patterns ranked + Day 12 P0 queue locked at 3-5 items + every tester has follow-up plan.

## Fallback / Plan B
If <8 testers showed up Day 10, defer Day 11 triage to Day 12 + extend invite wave to next 10 prospects from Day 8 cohort. If patterns emerge weakly, still ship the top P0 to learn faster.

## Risks
| Risk | Mitigation |
|---|---|
| Singletons mistreated as patterns | ≥2-tester rule + flag singletons separately |
| Founder bias in interpretation | AI extracts patterns mechanically; founder reviews |
| Backlog sprawls | Cap Day 12 fix queue at 5 items |
| Tester escalation missed | Tester followups file lists every tester |

## India / Mumbai-Specific Notes
- "Phone OTP didn't arrive" common Mumbai issue — flag if N≥2; investigate Jio/Vi delivery + WhatsApp OTP fallback
- Hindi labels missing where confusing — language note added to Week-4 backlog if observed
- Mobile-first feedback (most testers on phone) — bias fixes mobile-first

## Dependencies
- **Blocks:** Day 12 (fixes), Day 14 (testimonials)
- **Depends on:** Day 10 calls

## Connected Skills
- `customer-research` — pattern extraction
- `funnel-analysis` — PostHog drop-off interpretation
- `signup-flow-cro` + `onboarding-cro` — fix recommendations
