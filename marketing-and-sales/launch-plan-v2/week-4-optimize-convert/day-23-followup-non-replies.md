# Day 23 — Follow-up Wave to Non-Replies + Twitter Thread Publish

> **Type:** 🤝 HYBRID + 🧍
> **Phase:** Week 4
> **Skill(s):** `cold-email` + `whatsapp-outreach` + `social-content`
> **Estimated time:** 4h founder + 2h AI
> **Script:** `../40-sales-and-conversion/followup-script.md` (Touch 2 and 3 copy) · `../30-channels/whatsapp/message-templates.md`

## Objective
Send Touch-2 of cold sequences to all Day 17-19 non-responders + publish the Day-20-drafted Twitter thread + cross-post on LinkedIn as carousel + open 1 new community engagement loop.

## Why This Matters for RealEstateFlow
Touch 1 typically gets 30-60% of total replies; Touch 2 + Touch 3 add another 20-40%. Day 23 captures the long-tail. The Twitter thread + LinkedIn carousel reaches new audiences during Day 21-30 launch momentum.

## User Story
As founder, I want every Day 17-19 non-responder hit with Touch 2 + the Twitter thread shipped, so reply-rate compounds + social visibility ticks up.

## Acceptance Criteria
- [ ] Touch 2 sent via the same primary channel as Touch 1 to all non-responders (~80-100 prospects across Day-9 + Day-17 cohorts)
- [ ] Email Touch 2 = Loom embed angle (Day-17 sequence Touch 2 spec)
- [ ] WhatsApp Touch 2 = text-only "checking in" + Loom URL
- [ ] LinkedIn Touch 2 = DM (only if connection accepted)
- [ ] Tracker `day-23-followup-log.csv` updated with sent_at + replied_y_n
- [ ] Twitter/X thread published (`day-20-twitter-thread.md`) at 11am IST
- [ ] LinkedIn carousel version of same thread published at 12pm IST
- [ ] Reply rate target ≥3% on Touch 2 alone (cumulative reply rate Day-21 baseline + Day-23 boost)
- [ ] Founder responds to all replies within 60 min during business hours
- [ ] Day-23 standup written
- [ ] If LinkedIn Post 6 + Twitter thread + Day-22 community comments aggregate to ≥10 LP visits in 6h, log signal

## Manual Steps (🧍)

1. **Twitter thread** (10 min): copy from `day-20-twitter-thread.md` + paste to Twitter at 11am IST. Schedule via TweetHunter or manual. Engage with first replies for 30 min.

2. **LinkedIn carousel** (15 min): convert Twitter thread to LinkedIn carousel via Canva or Sendible. Publish at 12pm IST.

3. **Cold Touch 2 email** (60 min): Instantly auto-sends Touch 2 if configured Day 17. Verify queue. If not auto-set, manually launch via Instantly.

4. **WhatsApp Touch 2** (60 min): manual sends to 30 prospects. Cap 5/hour.

5. **LinkedIn Touch 2 DM** (30 min): only to accepted connections from Day 18 (~10-15 people). DM = text + Loom URL + Cal.com link.

6. **Reply monitoring** (continuous): respond to all replies + Twitter thread engagements within 60 min.

7. **Track** in `day-23-followup-log.csv` + post-thread engagement in `day-23-thread-metrics.csv`.

8. **Daily standup**.

## AI Prompt (🤖) — small role

```
Read:
- `marketing-and-sales/launch-implement/week-3/day-17-sequences.md` (Touch 2 templates)
- `marketing-and-sales/launch-implement/week-3/day-18-cold-execution-log.csv` + `day-19-eod-metrics.md` + Instantly metrics (replies received)

Produce:

## 1. `marketing-and-sales/launch-implement/week-4/day-23-followup-recipient-list.csv`
Filter: prospects from Day-17 list who didn't reply Touch 1 + Day-9 cohort prospects who didn't reply Touch 1 (sub-set if applicable).
Columns: prospect_slug, channel_to_use_for_touch2, primary_email_or_phone, last_contacted_at, days_since_touch1.

## 2. `marketing-and-sales/launch-implement/week-4/day-23-touch2-templates.md`
Use Touch-2 templates from Day-17 sequences. Light personalisation tweaks based on what we've learned about reply triggers in Day 18-19. If a specific subject variant (A/B/C) outperformed, lean toward that style.

## 3. `marketing-and-sales/launch-implement/week-4/day-23-thread-publish-plan.md`
Twitter thread + LinkedIn carousel publish plan:
- Twitter: 11am IST + 6 thread tweets in queue + 1 reply-to-self with cal.com link
- LinkedIn carousel: 12pm IST + 8 slides + caption (200 words) + 5 hashtags
- Engagement plan: respond to first 10 replies within 30 min
- Cross-promotion: WhatsApp share to broker friends after Twitter publishes

Stop.
```

## Inputs
- Day-17 sequences
- Day-18-19 cold metrics
- Day-20 Twitter thread draft

## Outputs
- 80-100 Touch 2 sends
- Twitter thread + LinkedIn carousel published
- `day-23-followup-log.csv`
- `day-23-thread-metrics.csv`

## Success Criterion
All Touch 2 sent; Twitter+LinkedIn published; ≥3% reply rate on Touch 2; ≥1 demo booked from this wave.

## Fallback / Plan B
If Twitter thread underperforms, do not pay-promote; engage manually via 5 Mumbai/SaaS connections to RT/share.

## Risks
| Risk | Mitigation |
|---|---|
| Touch 2 feels redundant | Sub-vary copy per channel; Loom embed = new value |
| Spam-flag from too many sends | Touch 2 spaced ≥3 days from Touch 1 |
| LinkedIn DM spam-flag | Only DM accepted connections |
| Twitter thread no engagement | Cross-share to LinkedIn + WhatsApp |

## India / Mumbai-Specific Notes
- Twitter Indian SaaS audience small but vocal; LinkedIn carousel has 5x reach
- 11am IST = Tier-1 SaaS founder window
- Hindi-English mix in carousel captions OK if subtle

## Dependencies
- **Blocks:** Day 24 reactivations, Day 26 trial-to-paid
- **Depends on:** Day-17 + Day-20 outputs

## Connected Skills
- `cold-email` — Touch 2
- `whatsapp-outreach` — WA bump
- `social-content` — Twitter + LinkedIn carousel
