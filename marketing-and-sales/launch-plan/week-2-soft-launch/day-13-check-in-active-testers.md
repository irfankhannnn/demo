# Day 13 — Check In On Active Testers

## Objective
Personally reach out to all 8-12 beta testers via WhatsApp / email — ask one specific question about their core-task completion ("Were you able to add 5 buyers and start 1 AI call this week?") — and identify who is engaged, who is stalled, and who is dropping off.

## Why This Matters for RealtyFlow
By Day 13, beta testers have had 3-4 days to use RealtyFlow on their own. Some are using it daily (testimonial candidates). Some logged in once and forgot (re-activation candidates). Some hit a bug not in your Day 12 fixes (urgent intervention). Without a check-in, you don't know which is which — and silent churn happens. A 2-line personal message wins back 30%+ of stalled testers.

## User Story
As a founder, I want to personally message every active beta tester with a specific check-in question ("Were you able to complete [Core Task]?") via their preferred channel (WhatsApp/email), so that by end of Day 13 I know which testers are engaged (testimonial candidates), which are stalled (rescue candidates), and which need urgent intervention (bug reports / drop-off risk).

## Acceptance Criteria
- [ ] Every beta tester (8-12) received a personal check-in message
- [ ] Each message asks ONE specific, behavioral question (not generic "how's it going?")
- [ ] Messages sent via tester's preferred channel (WhatsApp / email — from Day 9 record)
- [ ] PostHog cohort filtered: which testers actually logged in past 3 days?
- [ ] Tester status categorized: Active / Stalled / At-Risk / Lost
- [ ] All stalled testers received a follow-up offer (15-min screen-share to unblock)
- [ ] At-risk testers: scheduled rescue call within 24h
- [ ] Lost testers: 1 final outreach + accept the loss
- [ ] Update beta-prospects.csv: status as of Day 13
- [ ] At least 1 new piece of feedback / bug surfaced from check-ins

## Implementation Steps

### Step 1: Check usage data first
Before messaging, open PostHog → Cohorts → "Beta Testers" (build cohort if not made):
- Filter: signed up Day 10-11
- Last seen: <3 days = Active, 3-5 days = Stalled, >5 days = At-Risk/Lost

This tells you what to ask:
- Active users → ask about specific feature feedback
- Stalled → ask if something blocked them
- At-Risk → ask if they're still interested OR ready to disengage

### Step 2: Segment testers
| Status | Last Active | Action |
|--------|-------------|--------|
| Active | <72h | Ask for specific feedback; pre-position for testimonial |
| Stalled | 3-5 days | Ask if blocked; offer 15-min screen share |
| At-Risk | 5-7 days | Direct rescue call request |
| Lost | >7 days, no replies | One final message; accept the loss |

### Step 3: Write personalized messages — Active users
> "Hey Rohit — saw you've been adding buyers (great!). One quick question: were you able to start the AI call feature? Curious what you thought of the Hindi/Hinglish voice quality. Also, anything broken from this week's fixes? — Kalim"

Goals:
- Acknowledge their behavior (you noticed!)
- Ask about wedge feature (AI calling)
- Open the door for feedback
- Sign personally

### Step 4: Write personalized messages — Stalled users
> "Hey Priya — I noticed you signed up Tuesday but haven't logged back in. Wanted to check: did you hit a roadblock somewhere, or is the timing just off? Happy to jump on a 15-min screen share to unblock anything technical. If real estate is just busy this week, no worries — let me know when's better."

Goals:
- Non-judgmental (don't shame them)
- Offer concrete help (screen share)
- Leave dignity intact (real estate IS busy)

### Step 5: Write personalized messages — At-Risk
> "Hey Vikram — quick check-in. You signed up last week but haven't been back. Was it the product, the timing, or something else? Totally fine if it's not the right fit right now — would just love to know what made you pause. 10 sec reply is enough."

Goals:
- Direct (avoiding it makes them ghost)
- Permission to opt out (reduces guilt)
- Ask for the "why" (data even from drop-offs)

### Step 6: Send messages in batches
Don't blast all 12 at once.
- 9-10am IST: 4 messages (Active users — easy wins)
- 11am-12pm: 4 messages (Stalled — need more care)
- 4-5pm IST: 4 messages (At-Risk — second-chance window when they may have evening time)

Watch for replies in real-time. Respond within 30 minutes.

### Step 7: Handle replies — three types

**Positive ("Yes! Loving it!")**
- "Awesome — would you be open to a 2-line testimonial for our landing page next week?"
- This pre-positions Day 14 testimonial collection.

**Constructive ("Hit a snag here...")**
- Fix or unblock the same day if possible
- "Got it — let me look at that today and DM you when fixed"
- Add to friction-backlog if a real bug

**Cool / disengaged ("Haven't gotten around to it")**
- Offer: "Want me to spend 10 min helping you set up your first real lead? No pressure — happy to do it whenever you have a window."
- One offer. If declined, mark "Lost" and move on.

### Step 8: Schedule rescue calls
For At-Risk testers who reply with interest:
- Calendly link OR direct slot offer
- 15-min screen share
- Goal: unblock + observe what tripped them up

These calls produce critical feedback (why people drop off in the wild).

### Step 9: Surface new feedback
Day 13 check-ins almost always uncover new issues. Add them to friction-backlog under "Day 14 fix queue".

Common Day 13 surfaces:
- "I tried Saturday but the app was slow" (server scaling issue)
- "Email verification didn't arrive" (deliverability regression)
- "I can't find my old leads from yesterday" (data display bug)

These are gold — they're real usage in the wild, not contrived test scenarios.

### Step 10: Update tracker + reflect
Update `beta-prospects.csv`:
- Status as of Day 13
- Last activity
- Sentiment
- Testimonial-ready (Y/N)
- Conversion likelihood (1-10)

End of day reflection (5 min):
- How many testers are genuinely engaged?
- What's the % activated (per Day 4 definition)?
- Any pattern in why people stall?
- What 1 thing would lift activation if I fixed it?

## Tools / Stack Required
- WhatsApp Business app
- Email
- PostHog (cohort + activation funnel)
- Beta-prospects.csv
- Calendly for rescue call booking

## Time Estimate
- Usage data review: 30 min
- Message drafting: 1 hour (~5 min × 12)
- Sending + early replies: 2 hours
- Rescue calls (if any): 1-2 hours
- Reflection + tracker update: 30 min
- **Total: 4-5 hours (half day)**

## Deliverables
- 8-12 personalized check-in messages sent
- Beta-prospects.csv updated with statuses
- New feedback items added to friction-backlog
- Rescue calls scheduled (where applicable)
- Day 14 testimonial-ready list identified

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Testers ignore generic check-ins | Always personalize — reference their behavior (or lack thereof) |
| You sound desperate | One message + one follow-up max. After that, accept the loss with grace |
| You spend too long on one stalled tester | Time-box rescue effort: 1 screen share, 2 follow-ups, then move on |
| Day 13 reveals a major bug | If critical, fix immediately. If minor, add to Day 14 batch |
| Testers want pricing details now | Polite redirect: "Focus on whether it works for you first — we can talk pricing at the end of your trial" |

## India-Specific Notes
- WhatsApp >> email for engagement check-ins. Indian testers reply on WhatsApp in minutes; email takes days.
- Indian agents are conflict-averse — they'll go silent rather than say "this didn't work". Read silence as "didn't work" not "thinking about it".
- A personal call/voice message from the founder = unusually high signal of caring in Indian B2B
- Match their language preference (English/Hindi/Hinglish) in your message

## Connected Days / Dependencies
- **Blocks:** Day 14 (Testimonials need engaged testers), Day 24 (re-activation flow)
- **Depends on:** Day 12 (improved product), Day 4 (PostHog cohort data)

## Success Metric
- 100% of beta testers messaged
- 50%+ reply rate within 24 hours (Indian WhatsApp norm)
- 3+ active testers pre-positioned for Day 14 testimonial
- 1-2 rescue calls booked (high-quality feedback opportunity)
- Updated tracker shows clear segmentation
