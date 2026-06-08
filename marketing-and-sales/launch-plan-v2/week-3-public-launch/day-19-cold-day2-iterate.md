# Day 19 — Cold Day 2 + Iterate Based on Day-18 Signal

> **Type:** 🧍 + 🤖
> **Phase:** Week 3
> **Skill(s):** `messaging-optimizer` + `cold-email` + `whatsapp-outreach`
> **Estimated time:** 4h founder + 2h AI

## Objective
Read Day-18 metrics, iterate on subject lines / CTAs / opener if needed, send the next batch of cold touches (Touch 1 to remaining prospects + Touch 2 to Day-9 + Day-13 non-replies if applicable), book demos for interested replies.

## Why This Matters for RealEstateFlow
Day 18 is N=100 sample; Day 19 either (a) doubles down on what worked or (b) iterates if reply rate <3%. This compounding loop sets Day 21 metrics.

## User Story
As founder reading Day-18 EOD metrics, I want clear actions for Day 19: same-or-iterate decision, prospect expansion if needed, demo booking flow tight, so we maximise reply-to-trial conversion.

## Acceptance Criteria
- [ ] Day-18 metrics reviewed; verdict logged: "continue same" OR "iterate {{which-element}}"
- [ ] If iterate: new subject lines / new opener / new CTA shipped to Instantly + queued for Day 19 sends
- [ ] Day-19 sends: balance of remaining email Touch-1 (if any unsent Day 18) + bumps to non-responders
- [ ] Demo bookings: every "interested" reply gets Cal.com link within 60 min; demo booked Day 20-22
- [ ] Demo prep doc per booking at `marketing-and-sales/launch-implement/week-3/demos/{prospect-slug}.md`: prospect background, pain points, ICP score, what-they-said-in-reply, demo agenda
- [ ] Tracker updated: cumulative reply rate per channel, demos booked count, conversion-to-trial signals
- [ ] If WhatsApp Touch 1 still pending Day 18 (template approval delay), execute Day 19 with caps
- [ ] Reply-handling SOP active throughout the day
- [ ] Day-19 standup with metric trend vs Day-18

## Manual Steps (🧍)

1. **Read `day-18-eod-metrics.md`** (5 min). Note verdict.

2. **Decide: same or iterate?**
   - If reply rate ≥3% and not-spam: Day 19 = continue same Touch 1 to remaining prospects (if any) + start Touch 2 to non-responders that received Touch 1 Day 17 (e.g., Day-9 cohort).
   - If reply rate <3%: pause new Touch 1 sends. Run AI Prompt #1 to iterate subject + opener. Test new variant on 20 prospects. Hold remaining 30 for Day 20.

3. **Execute** the chosen path.

4. **Reply funnel**:
   - Reply received → reply within 60 min with Cal.com + Loom
   - Demo booked → create prep doc using AI Prompt #2

5. **EOD Day-19 metrics snapshot** (run AI Prompt #3).

6. **Daily standup** + tick ACs.

## AI Prompt #1 (🤖) — Iterate sequences if reply <3%

```
Read inputs:
- `marketing-and-sales/launch-implement/week-3/day-18-eod-metrics.md`
- `marketing-and-sales/launch-implement/week-3/day-17-sequences.md`
- `marketing-and-sales/launch-implement/week-2/day-09-templates.md` (warm baseline)
- `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md`

Diagnose Day-18 underperformance:
- Subject open rate <30% → subject line problem
- Open >30% but click <5% → body/CTA problem
- Click >5% but reply <3% → offer / trust problem

Produce `marketing-and-sales/launch-implement/week-3/day-19-iteration.md`:
- 3 new subject variants (specific + curiosity + value-stack)
- New opener paragraph (more local-Mumbai specific, e.g., reference exact area landmark)
- New CTA (single ask vs double ask)
- Hypothesis per change
- Test plan: 20 prospects with new variant; success threshold: open ≥40% OR reply ≥5%

Stop. Do not deploy until founder reviews.
```

## AI Prompt #2 (🤖) — Demo prep doc per booking

```
For each Cal.com booking, read:
- The reply text (what they said yes to)
- Their `day-17-cold-prospects.csv` row (locality, agency, ICP score, hook)
- LinkedIn profile (if accessible, scrape with `firecrawl-scrape`)

Produce `marketing-and-sales/launch-implement/week-3/demos/{prospect-slug}.md`:

# {{prospect_name}} — {{agency}} — {{date_of_demo}}

## Profile
- Locality, role, years active, est team size
- Their reply quote (what triggered their interest)
- ICP fit score

## Likely pain points (3 hypotheses based on persona)
1. ...
2. ...
3. ...

## Demo agenda (15-20 min)
- 0-3 min: rapport + restate their interest
- 3-8 min: live demo CRM core (their use-case-relevant features)
- 8-13 min: AI Employee on WhatsApp — show transcript flow
- 13-17 min: pricing + 14-day no-card trial
- 17-20 min: ask close: "Would you start a trial today?" → if yes, signup live with them on the call

## Closing 3 questions
- "What's your gut feel — would you pay for this?" (1-10)
- "What's missing for you to commit?"
- "Could you refer 1-2 broker friends to a beta?"

## Founder asks
- ICP-validation question
- Locality-specific testing (does X feature work for {{their_use_case}})
```

## AI Prompt #3 (🤖) — EOD Day-19 metrics

```
Read updated CSV `day-18-cold-execution-log.csv` (now spanning Day 18 + 19).

Produce `marketing-and-sales/launch-implement/week-3/day-19-eod-metrics.md`:
- Cumulative metrics per channel (D18 + D19)
- Day-on-Day trend (improving / flat / declining)
- A/B subject performance update
- Demos booked count
- Pipeline value estimate (demos × est conversion × ARPU)
- Recommendation for Day 20

Stop.
```

## Inputs
- Day-18 metrics
- Day-17 sequences
- New replies + bookings

## Outputs
- `day-19-iteration.md` (if iterated)
- Demo prep docs in `demos/`
- `day-19-eod-metrics.md`
- Daily standup

## Success Criterion
Cumulative reply rate ≥3% combined; ≥3 demos booked for Day 20-22; clear Day 20 plan.

## Fallback / Plan B
If reply rate <2% on cumulative, pause cold sequence Day 20 entirely + run customer-research interviews via founder LinkedIn network (10 unstructured chats Day 20-21) to discover positioning gap. Resume cold Day 22-23 with new copy.

## Risks
| Risk | Mitigation |
|---|---|
| Iteration without enough data | N≥30 minimum before iterating; don't churn copy daily |
| Demo no-shows | Send WhatsApp + email reminder 1h before demo |
| Founder fatigue | Cap demos to 4/day; spread across 11am-5pm |
| Iterate too much, lose A/B signal | Cap iteration to 1 element/day (subject OR opener OR CTA) |

## India / Mumbai-Specific Notes
- Touch-2 to Day-9 non-responders should reference "checked back in" softly
- Demo time slots Mumbai-friendly: 11am, 1pm, 3pm, 5pm IST
- WhatsApp reminder 1h before demo + Cal.com auto-reminder both

## Dependencies
- **Blocks:** Day 20-22 demos, Day 21 metrics review
- **Depends on:** Day-18 sends + replies

## Connected Skills
- `messaging-optimizer` — diagnose + iterate
- `cold-email` — re-write Touch 1
- `whatsapp-outreach` — Touch 2 send
- `customer-research` — fallback discovery if reply rate dies
