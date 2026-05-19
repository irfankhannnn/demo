# Day 13 — Beta Check-in Drip + WhatsApp Sequence

> **Type:** 🤝 HYBRID
> **Phase:** Week 2
> **Skill(s):** `email-sequence` + `whatsapp-outreach` + `community-marketing`
> **Estimated time:** 2h founder + 3h AI

## Objective
Send a personalised check-in to every active beta tester via their preferred channel — recap the past 4 days of their CRM activity (powered by PostHog stats), surface 3 quick-win nudges, ask 1 testimonial-prep question. The goal is reactivation + testimonial scaffolding for Day 14.

## Why This Matters for RealEstateFlow
Beta testers go quiet after Day 11; Day 13 re-engages them with proof of progress (their own usage stats) and seeds the testimonial ask without it feeling forced.

## User Story
As a beta tester on Day 13 of the trial, I want a personalised check-in message recapping my activity + quick wins + a low-friction "how's it going?" question, so I feel guided + want to keep using.

## Acceptance Criteria
- [ ] Personalised check-in sent to every active beta tester (8-12 testers)
- [ ] Each message includes: tester's actual usage stats (records added, sessions, AI Employee transcripts), 3 quick-win nudges, 1 testimonial-prep question
- [ ] Message routed via channel preference (WhatsApp text+voice / LinkedIn DM / email — same routing as Day 9)
- [ ] Tracker updated at `marketing-and-sales/launch-implement/week-2/day-13-checkin-log.csv`: tester, channel, sent_at, replied_y_n, reply_summary, testimonial_yes_no_pending, willingness_score (1-10)
- [ ] Founder responds to every reply within 2h
- [ ] Re-activation lift measured: PostHog cohort active-users delta Day-12 → Day-13
- [ ] Inactive testers (no PostHog event in 48h) get specific re-engagement DM: "Hey, noticed you haven't logged in since Day-11 — anything blocking? Happy to do a 10-min screen share."
- [ ] At least 4 testers verbally confirm "yes" to testimonial Day 14

## Manual Steps (🧍)

1. **Run AI Prompt below** to generate per-tester messages with personalised stats.
2. **Manual review + send**: each message routed via tester's preferred channel from Day 9.
3. **For inactive testers**: send re-engagement DM with offer to screen-share Day 14.
4. **Track responses** in CSV log; reply within 2h.
5. **Daily standup** + tick ACs.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/day-09-invite-log.csv` (channel preference per tester)
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/*.md` (their pain + asks)
- PostHog event export for the beta cohort, last 4 days, per user: count of `buyer_added`, `property_added`, `lead_added`, `khata_entry_created`, `meeting_scheduled`, `feature_first_use`, total sessions
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`

For each beta tester, produce a personalised check-in:

## Channel routing
- WhatsApp-active → text (≤500 chars) + 30-sec voice note
- LinkedIn-active → LinkedIn DM (≤500 chars)
- Email-only → email (≤200 words)

## Message structure (all channels)

1. **Open with name + 1-line context** — "Hi {{name}}, jumping in 4 days into your beta."
2. **Stats recap (their actual data)** — "Quick recap: you've added X buyers, Y properties, Z leads. {{If they have AI Employee}}: AI Employee handled W conversations."
3. **3 quick-win nudges** — pick from this list based on their gaps:
   - "Try the WhatsApp share for a property listing — saves 5 min on every buyer call"
   - "Open Khata book and add 1 entry — auto-tracks settlement"
   - "Tag 3 buyers as Hot — shows up in your hot pipeline view"
   - "Try AI Employee on WhatsApp — even just one inbound, see how it qualifies"
   - "Set up Hierarchy view if you have a 2nd agent"
4. **Testimonial prep question** — Pick ONE based on their willingness-to-pay score from Day 10:
   - High (8-10): "On a scale 1-10, how likely would you recommend RealEstateFlow to another Mumbai broker friend? If 8+, would you let me record a 60-second testimonial Day 14?"
   - Medium (5-7): "What's the ONE thing missing for you to fully commit?"
   - Low (1-4): "Be honest — is this not the right fit? Happy to part ways amicably; would love your feedback either way."
5. **Close with founder personal voice** — "— {{founder_first_name}}"

## Output
- `marketing-and-sales/launch-implement/week-2/day-13-checkins/{tester-slug}.md` (one file per tester with the personalised message)
- `marketing-and-sales/launch-implement/week-2/day-13-checkin-log.csv` (template)
- 30-second voice script (1 universal version with `{{name}}` placeholder) for WhatsApp testers — founder records once, sends to all WA testers

## Voice script (60s max, conversational)
"Hi {{name}}, just checking in — you're 4 days in. I noticed you've added [X] buyers, [Y] properties — solid start. Quick question: how's the AI Employee feeling on your WhatsApp? Anything broken? Anything missing? Happy to ship a fix this week. And — if you're loving it — would you mind a 60-sec testimonial later this week? No pressure. Reply when you can. — {{founder_first_name}}"

## Inactive-tester variant
If PostHog says no events in 48h:
"Hi {{name}}, noticed you haven't logged in since Day 10. Often that's because something broke or felt confusing. No pressure to use it — but if you've got 10 min, I'll do a quick screen-share to fix it together. Reply 'yes' and I'll send a Cal.com link."

Stop. Do not auto-send (founder sends).
```

## Inputs
- Day 9 invite log (channel preference)
- Day 10 call notes (their pain)
- PostHog event export (their actual usage)
- Wedge

## Outputs
- 8-12 personalised check-in messages
- CSV tracker
- 60-sec voice script
- 4+ testimonial-yes confirmations for Day 14

## Success Criterion
≥80% reply rate Day 13; ≥4 testimonial-yes; cohort active-user delta improves Day-12 → Day-13.

## Fallback / Plan B
If <50% reply rate by EOD Day 13, send a 2nd-touch follow-up Day 14 morning — short ("just bumping this") + offer to call. If active-user delta worsens (more inactive than Day 12), pause Day 17 cold sequence prep and run another fix loop.

## Risks
| Risk | Mitigation |
|---|---|
| Stats wrong (PostHog mis-attribution) | Verify on 2 testers manually before sending all |
| Voice note feels canned | Founder records 1 take, listen back, re-record once if needed |
| Testimonial ask comes off pushy | Vary by willingness-score (don't ask low-score testers for testimonial) |
| Inactive testers feel ambushed | Re-engagement DM offers screen-share, not guilt |

## India / Mumbai-Specific Notes
- WhatsApp voice notes >> text in Mumbai broker culture
- Mid-week (Wed-Thu) check-in better than Friday (broker workload spikes Fri)
- Send 11am-3pm IST for highest read rates

## Dependencies
- **Blocks:** Day 14 testimonials
- **Depends on:** Day 9-12, P10 PostHog firing

## Connected Skills
- `email-sequence` — drip
- `whatsapp-outreach` — voice + text
- `customer-research` — willingness-score interpretation
- `community-marketing` — relationship lift
