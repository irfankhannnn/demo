# Day 18 — Execute Cold Sends Day 1 (Email + WhatsApp + LinkedIn)

> **Type:** 🧍 + 🤝
> **Phase:** Week 3
> **Skill(s):** `outbound-outreach` + `cold-email` + `whatsapp-outreach`
> **Estimated time:** 4h founder + 1h AI

## Objective
Execute the first day of Day-17 prepared cold sequences: 50 emails (Touch 1, A/B subjects) + 30 WhatsApp messages (text + voice) + 20 LinkedIn connection requests with personalised notes — all tracked in real time.

## Why This Matters for RealEstateFlow
This is the first batch of fully cold outbound (Day 9 was warm-ish via personal hooks). Day 18 metrics calibrate the sequence quality + tell you whether to scale or iterate.

## User Story
As founder hitting Send Day 18, I want every prospect contacted via their primary channel + tracker updated in real time, so I have a baseline metric (open rate, reply rate, click-through) by Day 19 morning.

## Acceptance Criteria
- [ ] 50 emails sent via Instantly using Touch-1 sequence with A/B/C subject split (configured Day 17)
- [ ] 30 WhatsApp messages sent (text + voice on first message) — manual via founder personal WhatsApp + AiSensy for warm broadcast where eligible
- [ ] 20 LinkedIn connection requests sent with personalised notes
- [ ] All 100 sends logged in `marketing-and-sales/launch-implement/week-3/day-18-cold-execution-log.csv`: prospect, channel, sent_at, subject_variant, voice_note_y_n, instantly_message_id (for email)
- [ ] No spam-flag triggered (mailbox monitor green); WhatsApp account green
- [ ] Reply-handling SOP active: founder responds within 60 min during 11am-7pm IST
- [ ] EOD Day 18 metrics snapshot captured: open rate, click rate, reply rate per channel
- [ ] Sentry/PostHog confirms LP visit traffic from cold cohort (referrer = email link / linkedin / etc.)
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Pre-flight checks** (15 min):
   - Mailbox warmth: Instantly health score green
   - WhatsApp account: no warnings
   - LinkedIn account: no recent flags
   - All UTM parameters configured for tracking
   - Cal.com calendar shows availability for Day 19-22 demo slots

2. **Email blast** (30 min): Instantly → start campaign with A/B/C subject split. Stagger sends across 11am-3pm IST window. Verify 1st 5 sends via inbox check.

3. **WhatsApp broadcast** (90 min):
   - Pre-recorded 60-sec voice (Day 9 voice + updated with testimonial reference)
   - Send text + voice to 30 WhatsApp prospects via founder personal WhatsApp (AiSensy if pre-approved warm broadcast)
   - Limit to 5/hour to avoid spam flag

4. **LinkedIn outreach** (60 min):
   - Send 20 connection requests with personalised notes (≤300 chars each)
   - Don't auto-tool; manual is safer

5. **Track every send** in CSV (or Instantly auto-logs email; capture LinkedIn + WhatsApp manually).

6. **Reply monitoring** (continuous Day 18 + Day 19 morning):
   - Mailbox check every 2h
   - WhatsApp constant
   - LinkedIn 2-3x/day

7. **Reply handling per SOP** (`day-17-reply-handling-sop.md`):
   - Interested → reply with Cal.com link + Loom
   - Not now → thank + soft ask for M2 follow-up consent
   - Unsubscribe → remove + tag

8. **EOD metrics snapshot**: pull Instantly + Day 18 log → save `day-18-eod-metrics.md`

9. **Daily standup** + tick ACs.

## AI Prompt (🤖) — small role

```
Read `day-18-cold-execution-log.csv` (CSV updated through Day 18 EOD).

Produce `marketing-and-sales/launch-implement/week-3/day-18-eod-metrics.md`:

## Email metrics
- Sent: N
- Delivered: M (delivery rate %)
- Opened: O (open rate %)
- Clicked: P (click rate %)
- Replied: Q (reply rate %)
- Bounced: R
- Unsubscribed: S
- Subject A vs B vs C performance

## WhatsApp metrics
- Sent: N
- Read receipts: M (target ≥80%)
- Replied: O (reply rate %)
- Voice listened (estimated from "1 blue tick voice" engagement): P

## LinkedIn metrics
- Connection requests sent: 20
- Accepted (live count): N
- Replied to note: M

## Replies summary
- Interested: list names + ICP scores
- Not-now: list with feedback
- Negative: list with reason

## Day-18 verdict
- Cold reply rate per channel
- Vs Day-9 warm baseline
- Recommendation: continue Day 19 same / iterate (subject change / new CTA)
- Top action item for Day 19

Stop. Do not modify sequences (Day 19 founder decides).
```

## Inputs
- Day-17 outputs (prospects, sequences, routing, SOP)
- Instantly + AiSensy + LinkedIn accounts
- Founder mailbox (warm)

## Outputs
- 100 sends across 3 channels
- `day-18-cold-execution-log.csv`
- `day-18-eod-metrics.md`
- Replies handled in real-time

## Success Criterion
All 100 sends complete + metrics snapshot ready Day 19 morning + ≥3% combined reply rate.

## Fallback / Plan B
If <2% reply rate by Day 19 morning, pause Day 19-20 follow-ups + iterate sequence Day 19 (founder rewrites Touch-1 with new opener). Don't burn the list with bad copy.

## Risks
| Risk | Mitigation |
|---|---|
| Spam-flag from too many sends | 50 emails well within Instantly Growth allowance; staggered |
| WhatsApp account flag | 5/hour cap; voice + text feels human |
| LinkedIn restriction | 20 requests/day OK |
| Reply overwhelmed | 60-min SLA + SOP document |
| UTM tracking misconfigured | Check first 5 sends manually for correct attribution |

## India / Mumbai-Specific Notes
- 11am-3pm IST = highest open rates for B2B India
- Tue-Thu = highest reply rates
- WhatsApp voice played 2× more than text-only DM
- Mumbai broker mid-day = car/site visit; afternoon = office; evening = WhatsApp catchup

## Dependencies
- **Blocks:** Day 19-20 follow-ups, Day 21 metrics review
- **Depends on:** Day-17 prep, P3 mailbox warmth

## Connected Skills
- `outbound-outreach` — orchestration
- `cold-email` — email
- `whatsapp-outreach` — WA
