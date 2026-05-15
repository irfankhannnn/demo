# Day 19 — Execute Cold Outreach Batch 2 (25 Prospects) + Refinements

## Objective
Send the second 25 outreach messages — applying lessons learned from Day 18 (which channel performed, which template worked, which hook resonated) — and run completed demos with prospects who said yes yesterday.

## Why This Matters for RealtyFlow
Day 18 was a learning batch. Day 19 is the optimized one. If WhatsApp produced 3 replies and LinkedIn produced 0, reallocate Day 19 toward WhatsApp. If your "ai calling" hook landed but "WhatsApp" didn't, lean into AI calling. The compounding effect of outreach + completed demos starts to produce actual revenue this week.

## User Story
As a founder, I want to send 25 more personalized cold messages applying Day 18 learnings (channel mix, hook refinement, template tweaks), complete 2-3 demos with positive responses from Day 18, and continue tight reply handling, so that by EOD Day 19 my total outreach has produced 5+ booked demos and 1-2 paying trial signups.

## Acceptance Criteria
- [ ] 25 additional messages sent (total 50 across Days 18-19)
- [ ] Channel mix adjusted based on Day 18 reply rates
- [ ] Template improvements applied (subject lines, openers, CTAs)
- [ ] 2-3 demos COMPLETED from Day 18 bookings
- [ ] Each completed demo logged: outcome, conversion likelihood, next step
- [ ] 2-3 additional demos booked from Day 19 sends
- [ ] Total tracker shows: 50 prospects contacted, ~10 replies, 4-6 demos
- [ ] At least 1 trial signup directly attributed to outreach (UTM-tagged)
- [ ] Day 23 follow-up list prepared (non-responders to Day 18 messages)
- [ ] End-of-week-3 outreach report drafted (basis for Day 21 metrics review)

## Implementation Steps

### Step 1: Day 18 retrospective (8-9am IST)
Open your tracker. Compute:
- Reply rate per channel: WhatsApp __%, LinkedIn __%, Email __%
- Winning template (count "positive" replies per template variant)
- Best-performing send time
- Most common objection / question

Decisions for Day 19:
- Reallocate channel mix toward winner (e.g., from 10/10/5 → 13/8/4 if WhatsApp won)
- Tweak underperforming template's opener / CTA
- Apply better hook angle if one type resonated

### Step 2: WhatsApp batch (adjusted volume, 10am-12pm IST)
Apply Day 18 learnings:
- New opener if old one underperformed
- Reference launch ("just launched publicly Monday — already getting Mumbai/Bangalore brokers in") for social proof
- Possibly switch hook angle to whichever (AI calling / WhatsApp / pricing) resonated

### Step 3: LinkedIn batch (adjusted volume)
- If reply rate Day 18 was strong → keep volume
- If weak → reduce LI to 5-7, shift saved time to WhatsApp/email

### Step 4: Email batch (adjusted)
If email open rate was <30% on Day 18 → diagnose:
- Subject line problem (test new variants in Instantly/Smartlead)
- Deliverability dropping (run Mail-Tester check)
- Pause and fix BEFORE sending Day 19 batch

### Step 5: Run Day 18 booked demos (likely 2-3 between 10am-5pm IST)
Demo flow (15 min):
1. **Open (1 min):** "Thanks for the time. Quick frame: I'll show RealtyFlow in 10 min, then answer questions for 5. Goal: see if it fits your work, not to push you to buy."
2. **Show wedge (3-4 min):** AI calling in Hindi — most magical feature. Use demo tenant (`pre-launch-prep/05`).
3. **Show core workflow (4-5 min):** Add a buyer → AI call → WhatsApp follow-up → pipeline view. Use sample data.
4. **Pricing (1 min):** Show 3 tiers; emphasize Tier 2 unless they're solo.
5. **Q&A + CTA (3-4 min):** Answer questions. Offer free trial (3 months).
6. **Close (1 min):** "Want me to set up your account now? Takes 5 min."

If they say yes → screen-share, signup walk-through, leave them in their fresh account with a buyer added.

If they say "let me think" → "Cool — want trial access now so you can explore at your pace? No card needed for 14 days."

If they say no → "Honest reason? Helps me refine the pitch."

### Step 6: Demo post-mortem (5 min after each)
Log per demo:
- Their name + agency
- Demo length actual
- Did they signup right away? (Y/N)
- Top 3 questions they asked
- Their pricing reaction (specific)
- Conversion likelihood: 1-10 + 1-line why
- Next step: trial signed up / scheduled follow-up / declined

### Step 7: Reply handling continues (throughout)
Same flow as Day 18. Speed matters.

By end of Day 19, you should have 50 messages sent and ~10 total replies (across both batches).

### Step 8: Build Day 23 follow-up list
For Day 18 messages with NO response (likely 22 of 25):
- Filter: read but no reply = "opened-no-reply" cohort
- Filter: not even read = "didn't see it" cohort

Day 23 follow-up message differs per cohort:
- **Opened-no-reply:** "Hey [name], wanted to follow up — did this get buried? Even a 1-line 'not interested' helps me know whether to retry."
- **Didn't open:** Try different channel (if WhatsApp → email, if email → LinkedIn)

Save Day 23 list to tracker.

### Step 9: Trial signup tracking
Use UTM-tagged Calendly + landing links so PostHog can attribute signups to specific outreach prospects.

By EOD Day 19, expect:
- 1-2 trial signups directly attributable to outreach
- 4-6 demos booked total (across Days 18-19)

### Step 10: End-of-week-3 outreach summary
Draft a 1-page report (basis for Day 21):

```
# Week 3 Outreach Summary (Days 17-19)

## Totals
- Prospects contacted: 50
- Total messages sent: 65 (some prospects got multiple channels)
- Replies: __
- Reply rate: __%
- Demos booked: __
- Demos completed: __
- Trial signups: __
- Paying customers (if any): __

## By Channel
| Channel | Sent | Replies | Reply Rate | Best Use |
|---------|------|---------|-----------|----------|
| WhatsApp | __ | __ | __% | __ |
| LinkedIn | __ | __ | __% | __ |
| Email | __ | __ | __% | __ |

## Top 3 Objections
1.
2.
3.

## Top 3 Positive Reactions
1.
2.
3.

## What's Working
-
-

## What to Change Week 4
-
-
```

## Tools / Stack Required
- Same as Day 18 + Calendly active
- Demo tenant URL ready
- Trial signup flow tested + working

## Time Estimate
- Day 18 retrospective + adjustments: 1 hour
- Send 25 messages: 2-3 hours
- Run 2-3 demos: 1-1.5 hours
- Reply handling: 2-3 hours
- End-of-week summary: 30 min
- **Total: full day**

## Deliverables
- 25 messages sent (total 50)
- 2-3 demos completed with detailed notes
- 4-6 total demos booked
- 1-2 trial signups
- Day 23 follow-up list prepared
- Week 3 outreach summary draft

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Demo no-shows | 1-hour reminder; reschedule once; mark "no-show" after 2 misses |
| Demo runs long (>30 min) | Set timer; gently cut at 20 min: "want to schedule a longer follow-up?" |
| Prospect wants to negotiate price during demo | Stay firm on launch pricing; offer trial extension if needed; no discounts in Month 1 |
| Tech failure during demo (AI call fails) | Have backup screen recording ready; explain "occasional beta issue, fixed in days" |
| You're exhausted by EOD | Cap demos at 3/day. Quality > quantity. |

## India-Specific Notes
- Indian prospects often want phone-based demos (audio only) — accommodate via WhatsApp call if Zoom hesitancy
- Hinglish demos for Tier-2/3 city prospects — switch fluidly between English/Hindi
- "Trust" check is critical in demos — share founder photo, beta tester names, real customer count
- Indian agents want to see Excel import option (legacy data migration concern) — demo this if asked
- Be prepared for "Hindi voice quality" question — have audio sample ready

## Connected Days / Dependencies
- **Blocks:** Day 21 (Week 3 metrics review needs Day 19 totals), Day 23 (follow-up wave)
- **Depends on:** Day 18 (first batch + learnings), Day 17 (preparation)

## Success Metric
- 50 cumulative outreach sent
- 8-12% reply rate (improvement over Day 18)
- 4-6 demos booked total
- 1-2 trial signups from outreach
- Clear data on what's working — basis for Week 4 strategy
