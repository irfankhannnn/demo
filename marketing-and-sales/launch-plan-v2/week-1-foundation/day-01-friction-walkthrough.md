# Day 01 — Friction Walkthrough (Founder-as-User)

> **Type:** 🧍 MANUAL + 🤖 AUTO
> **Phase:** Week 1 — Foundation
> **Skill(s):** `customer-research` + `signup-flow-cro` + `onboarding-cro`
> **Estimated time:** 4h founder + 2h AI

## Objective
Founder walks the entire RealEstateFlow product from anonymous-visitor → signup → onboarding → first-buyer-added → first-property-added → first-AI-Employee-conversation, recording every moment of friction with screenshots and timestamps. AI then triages findings into a P0/P1/P2 backlog.

## Why This Matters for RealEstateFlow
Day 1 is the only chance to experience the product cold before paying customers do. A 30-min walkthrough usually surfaces 10-20 fixable issues. Day 2 ships fixes. Day 3 onwards you're operating on knowledge of how Mumbai brokers will see it.

## User Story
As founder, I want to walk the product as a brand-new agency owner from Bandra, so I see and document every friction point before live launch.

## Acceptance Criteria
- [ ] Walkthrough recorded as Loom (private) covering: LP → signup → OTP → onboarding role pick → agency setup → first buyer added → first property added → first lead added → AI Employee status page
- [ ] Friction log at `marketing-and-sales/launch-implement/week-1/day-01-friction-log.md` with: step, observed, expected, severity (P0/P1/P2), screenshot ref
- [ ] Screenshots organised in `marketing-and-sales/launch-implement/week-1/screenshots/day-01/`
- [ ] Backlog at `marketing-and-sales/launch-implement/week-1/day-01-backlog.md` with: issue, file (best guess), proposed fix, ICE score, fix-by-day
- [ ] Total walkthrough time recorded; targets <8 minutes signup-to-first-record (a Mumbai broker won't endure more)
- [ ] Mobile walkthrough also done (iPhone + low-end Android over 4G) — separate log
- [ ] All P0 issues queued for Day 2 fix
- [ ] Backlog reviewed against Persona docs (would Priya/Arjun/Suresh hit different issues?)

## Manual Steps (🧍)

1. **Test setup**: incognito Chrome (desktop) + iPhone Safari + low-end Android Chrome. Throttle to 4G in DevTools. Loom recording on for desktop walkthrough.
2. **Step 1 — LP arrival**: visit `realestateflow.in` cold. Note: load time, hero copy clarity, CTA visibility, cookie banner UX, scroll-to-pricing flow.
3. **Step 2 — Signup**: click primary CTA. Note: form fields, OTP delay, error states, password complexity hints.
4. **Step 3 — Onboarding**: pick role (agency owner). Note: each onboarding screen, copy clarity, skip-options, default values.
5. **Step 4 — Agency setup**: name agency "Test Mumbai Broker", add Mumbai address. Note: dropdown values, locality picker, image upload.
6. **Step 5 — First buyer**: add 1 buyer (Mumbai persona). Note: required fields, validation messages, save speed.
7. **Step 6 — First property**: add 1 property (Andheri 2BHK ₹1.8Cr). Note: form length, photo upload UX, locality auto-complete.
8. **Step 7 — First lead**: add 1 lead linking buyer + property. Note: pipeline stages, save behaviour.
9. **Step 8 — AI Employee status**: navigate to `/integrations/ai-employee`. Note: empty state copy (no purchase yet), CTA clarity.
10. **Step 9 — Khata book**: add 1 entry. Note: form complexity, settlement flow.
11. **Step 10 — Logout + login**: confirm session persistence; OTP works on re-login.
12. **Mobile walkthrough**: repeat steps 2-7 on iPhone + Android. Log mobile-specific issues separately.
13. **Run AI Prompt below** to triage the friction-log.md into a P0/P1/P2 backlog.
14. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## AI Prompt (🤖)

```
Read `marketing-and-sales/launch-implement/week-1/day-01-friction-log.md` (founder's raw notes).

Triage into a P0/P1/P2 backlog at `marketing-and-sales/launch-implement/week-1/day-01-backlog.md`. For each entry:
- Title (1 line)
- Description + observed vs expected
- Severity: P0 (blocks core flow), P1 (significant friction, high frequency), P2 (polish)
- Best-guess code location: scan `apps/crm/real-estate-crm-app/src/pages/`, `apps/crm/real-estate-crm-app/src/components/`, `apps/crm/server/routes/` to identify the file
- Proposed fix (1-3 lines)
- ICE score (Impact 1-10 × Confidence 1-10 × Ease 1-10) / 10
- Suggested fix-by-day (Day 2 for P0, Day 5 for P1, Week 4 for P2)

Cross-reference with persona docs:
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/research/icp-report-mumbai-launch.md`
For each finding, note "Would Priya/Arjun/Suresh hit this?" — boost severity if all 3 personas hit.

Output a summary at top: total findings, P0 count, P1 count, P2 count, top-5-by-ICE.

Do NOT auto-fix anything; leave the fixes for Day 2.
```

## Inputs
- Live `realestateflow.in` (deployed via P15) + production CRM
- Persona docs in `research/`

## Outputs
- `marketing-and-sales/launch-implement/week-1/day-01-friction-log.md`
- `.../day-01-backlog.md`
- `.../screenshots/day-01/*.png`
- Loom URL (private)

## Success Criterion
Backlog has ≥10 entries; ≥1 P0 found and queued for Day 2.

## Fallback / Plan B
If walkthrough takes >2h (deep friction), queue Day 2 to fix only P0; defer P1 to Day 4-5.

## Risks
| Risk | Mitigation |
|---|---|
| Founder bias (knows product too well) | Recruit 1 broker friend for blind walkthrough Day 7 |
| Mobile walkthrough skipped | Schedule explicitly; Mumbai brokers are 80% mobile |
| Backlog too long to fix in Week 1 | Strict P0/P1/P2 with ICE scoring; defer P2 to Week 4 |

## India / Mumbai-Specific Notes
- Mumbai brokers prefer Hindi-English mixed UI labels — flag any English-only labels that confuse
- 4G throttle test critical — Bandra/Andheri have variable connectivity
- Phone OTP must work on Jio/Airtel/Vi networks

## Dependencies
- **Blocks:** Day 2 (fixes), Day 3 (payment) — can't go-live with P0 friction
- **Depends on:** P5 (demo seed gives test data), P15 (LP deployed), P10 (analytics fires events you want to verify)

## Connected Skills
- `customer-research` — interpret friction
- `signup-flow-cro` + `onboarding-cro` — fix recommendations
- `pr-review` — when fixes go in Day 2
