# Day 10 — Beta Onboarding Calls (8-12 testers)

> **Type:** 🧍 MANUAL
> **Phase:** Week 2
> **Skill(s):** `customer-research`
> **Estimated time:** 6h founder
> **Script:** `../40-sales-and-conversion/demo-script.md` (what to show) · `../40-sales-and-conversion/onboarding-script.md` (Day 0 setup) · `../30-channels/whatsapp/customer-success.md`

## Objective
Run 15-30 minute onboarding calls with each confirmed beta tester (8-12 calls Day 10 + spillover Day 11), guide them through signup + first record, capture their first impressions live, hand-issue trial extensions or AI Employee comp where it earns goodwill.

## Why This Matters for RealEstateFlow
Live calls = highest-fidelity feedback channel. Every call should produce: (a) a successful first record, (b) 1-3 friction items for Day 12 fix loop, (c) a relationship the founder can lean on for testimonials Day 14.

## User Story
As founder, I want each beta tester guided through their first 30 min in RealEstateFlow live with me, so they activate today + I capture friction + I build the relationship.

## Acceptance Criteria
- [ ] 8-12 calls completed (split across Day 10 + Day 11 if needed)
- [ ] Each tester completes: signup → onboarding → first buyer → first property → first lead during the call
- [ ] Each call recorded (Cal.com + Zoom or Google Meet recording) with tester consent
- [ ] Notes per call at `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{tester-slug}.md`: tester profile, top 3 friction observations, top 3 "wow" moments, asks/feature requests, willingness to convert (1-10), willingness to refer (1-10)
- [ ] Friction items aggregated into `day-10-friction-aggregate.md` for Day 11-12 triage
- [ ] All testers in PostHog cohort "Beta testers" with custom property `betaCohort=mumbai-soft-launch`
- [ ] Each tester has founder's WhatsApp + email in their phone
- [ ] Trial extensions (e.g., 30-day instead of 14-day) issued for top 3 testers if asked, logged in CRM
- [ ] AI Employee comp (1 month free for top 3) issued where it earns commitment, logged
- [ ] Day 11 schedule (spillover calls + check-ins) drafted

## Manual Steps (🧍)

1. **Pre-call checklist** for each tester (5 min before each call):
   - Confirm calendar + Zoom/Meet link sent
   - Open `day-10-call-notes/{tester-slug}.md` (template) ready to type
   - Have demo tenant + their personalisation hook in front
   - Test record-permission with Cal.com or Zoom

2. **Call structure (25 min target)**:
   - 0-2 min: rapport + thank for time + restate the wedge
   - 2-7 min: their current workflow (Excel/WhatsApp/CRM?), 3 specific frustrations
   - 7-15 min: live signup + onboarding (share screen, watch them click) + first buyer/property/lead
   - 15-22 min: AI Employee status page tour, ₹7,999 add-on conversation, see if they want to add (concierge starts immediately if so)
   - 22-25 min: ask the closing 3 questions:
     - "On a scale 1-10, how likely would you pay for this?"
     - "What's missing for you to commit?"
     - "Would you refer 1-2 broker friends?"

3. **Capture in real-time**: friction observations as you watch them click; type into call notes file.

4. **Issue extensions/comps in real-time** if it earns commitment: "I'll extend your trial to 30 days" / "I'll comp 1 month of AI Employee since you have a high lead volume" — log in CRM admin within 5 min.

5. **Post-call follow-up** (within 1h):
   - WhatsApp: "Great chat — here's the Loom of what we covered + Cal.com for next check-in Day 13"
   - Email: "Notes from today + 3 next steps for you"
   - Add to PostHog cohort

6. **Aggregate friction** at EOD Day 10: scan all call notes; group repeated observations; produce `day-10-friction-aggregate.md` for Day 12 fix loop.

7. **Tick ACs** + standup.

## Notes file template

For `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{tester-slug}.md`:

```markdown
# {{tester_name}} — {{agency}} — {{date}}

## Profile
- Locality: {{locality}}
- Team size: {{size}}
- Years active: {{years}}
- Current CRM: {{their_current_tool}}

## Top 3 friction observations (live during call)
1. ...
2. ...
3. ...

## Top 3 "wow" moments
1. ...
2. ...
3. ...

## Asks / feature requests
- ...

## Closing 3
- "Pay 1-10?": {{score}}
- "What's missing": {{quote}}
- "Would refer?": {{count}}

## Trial extension / comp issued
- {{none / +30d / +1mo AI Employee}}

## Founder notes
- {{rapport quality, follow-up style, anything specific to them}}

## Next check-in
- Day 13 / Day 14 / Day 21
```

## Inputs
- Day 9 confirmed bookings (Cal.com)
- Demo tenant for screen-share (P5)
- AI Employee status page (P11)
- CRM admin tools

## Outputs
- 8-12 call notes
- `marketing-and-sales/launch-implement/week-2/day-10-friction-aggregate.md`
- Beta cohort in PostHog
- Day 11 schedule

## Success Criterion
≥80% of testers reach first-record completion during the call; ≥3 testers self-rate willingness-to-pay ≥7/10.

## Fallback / Plan B
If a tester can't complete onboarding in 15 min (P0 friction), pause the call + ship a hot-fix Day 11 + reschedule check-in Day 13. Don't push them to keep clicking through broken flows.

## Risks
| Risk | Mitigation |
|---|---|
| Call recording fails | Always backup notes via typing; recording is bonus |
| Tester drops off mid-call | Rapport-first; reschedule if connection bad |
| Founder fatigue 8 calls × 25 min | 15-min buffer between calls; lunch break enforced |
| Friction overwhelm | Aggregate Day 10 EOD; triage Day 12 |
| Comp/extension over-promised | Cap to top 3 testers; log every issue in `00-DECISIONS-LOG.md` |

## India / Mumbai-Specific Notes
- Mumbai brokers prefer Hindi for rapport opening, English for product walk-through — switch as needed
- Calls scheduled 11am-5pm IST avoid Mumbai traffic + commute distractions
- WhatsApp follow-up always — Mumbai brokers check WhatsApp before email

## Dependencies
- **Blocks:** Day 11 (friction triage), Day 12 (fixes), Day 13 (check-in drip)
- **Depends on:** Day 9 invites, P5 demo, P11 AI Employee status

## Connected Skills
- `customer-research` — call interview structure
- `signup-flow-cro` + `onboarding-cro` — friction interpretation
