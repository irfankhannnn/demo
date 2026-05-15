# Day 24 — Re-Engage Stalled Trial Users

## Objective
Identify every trial signup from Weeks 2-3 who hasn't logged back in for 3+ days, send a personal email/WhatsApp asking what specifically blocked them, and offer founder-direct help to unblock — recovering 20-40% of stalled trials before they expire silently.

## Why This Matters for RealtyFlow
Half your Week 3 signups silently stalled. They saw the dashboard, clicked around, hit something confusing, and never came back. They're not "no's" — they're "stuck's". A personal, specific re-activation message recovers 20-40% of these. Without this step, they expire trials without ever giving you a real chance.

## User Story
As a founder, I want to identify every trial signup who hasn't logged in for 3+ days and send a personal re-engagement message offering specific help (15-min screen share, written setup guidance, or a feature unlock), so that Week 4 converts 20-40% of stalled users back to active trial usage and gives them a real chance to become paying customers.

## Acceptance Criteria
- [ ] PostHog cohort built: "Stalled Trial Users" (signed up 3+ days ago, last seen 3+ days ago)
- [ ] All stalled users contacted via their preferred channel (email or WhatsApp)
- [ ] Each message is PERSONAL — references what they did before stalling
- [ ] Each message offers a SPECIFIC unblock action (not generic "let me know if you need help")
- [ ] Founder offers screen-share / personal setup for any user worth the effort
- [ ] Tracker updated: re-engagement attempted, response, status change
- [ ] 20%+ stalled users re-engage (return to app)
- [ ] At least 1 stalled user converts to active usage
- [ ] Patterns documented: what consistently causes stalling?

## Implementation Steps

### Step 1: Identify stalled users (30 min)
PostHog cohort filter:
- `signup_completed` event present
- Signup date: 3+ days ago
- `$last_seen`: 3+ days ago
- NOT in "Activated Users" cohort

This is your stalled list. Likely 5-15 users.

Also check beta testers from Week 2 — any who went silent on Day 13 check-in?

### Step 2: For each stalled user, gather context
Open PostHog → user profile. For each:
- When did they sign up?
- What did they do before stalling? (`onboarding_step_completed` events, `buyer_added` events)
- Where exactly did they last drop off?
- Did they hit an error? (Sentry events)
- Do you have their phone / WhatsApp? (Day 17 outreach prospects may have provided)
- Channel preference (where did they originally engage?)

### Step 3: Categorize stalls (15 min)
Patterns:

**Type 1: Never logged in after signup**
- Likely: didn't get welcome email, lost momentum
- Fix: Resend welcome with simple "first action" CTA

**Type 2: Logged in once, didn't complete onboarding**
- Likely: confused by onboarding flow
- Fix: Offer screen-share OR send a 60-sec Loom showing the next step

**Type 3: Completed onboarding, didn't add anything**
- Likely: dashboard empty, no clear next action
- Fix: "Want me to add 5 sample buyers to your account so you can see what it looks like populated?"

**Type 4: Added 1-2 things, stalled mid-trial**
- Likely: hit a feature gap, didn't know wedge feature exists
- Fix: "Have you tried the AI calling yet? That's the feature most agents say sells them."

### Step 4: Draft personalized messages

**Type 1 (never logged in) — email or WhatsApp:**
> "Hey Priya — quick check-in. You signed up Tuesday but haven't had a chance to log in yet. No judgment — real estate is busy.
>
> Want me to walk you through the basics in 10 min? Or I can send a 60-sec video showing how to add your first lead. Just reply with your preference.
>
> Or, if it's not the right time, no worries — totally fine to say 'try me in 2 weeks' or 'not the right fit'."

**Type 2 (logged in once, didn't complete) — channel of choice:**
> "Hey Rajesh — saw you signed up and explored Tuesday but haven't been back. Curious: did the onboarding flow trip you up somewhere? Happy to jump on a 15-min screen share to unblock anything.
>
> Or shoot me a screenshot of where you got stuck — I'll send a quick walkthrough."

**Type 3 (onboarded, empty dashboard):**
> "Hey Anita — you're set up but haven't added any buyers yet. Want me to drop 5 sample buyers into your account so you can see how RealtyFlow looks populated? Takes me 2 min on your behalf, you can replace with real data later.
>
> Or, if you have 10 min, I can show you the AI calling feature live."

**Type 4 (added some stuff, stalled mid-trial):**
> "Hey Vikram — saw you've added a few buyers (nice!). Have you tried the AI calling yet? That's the part most agents say is game-changing. Demo on me — DM me when you have 10 min."

### Step 5: Offer specific unblock options
Three escalating offers:
1. **Async help:** "Send screenshot, I'll send Loom"
2. **Sync help:** "15-min screen share — I'll walk you through your specific use case"
3. **Founder concierge:** "Want me to set up the AI calling for one of your real leads? I'll do it on your behalf in 5 min."

The third offer (concierge) recovers the most stalled users — almost no founder offers this. It works.

### Step 6: Send messages (1-2 hours)
- Channel by user preference (email if they signed up from cold email; WhatsApp if from WhatsApp outreach)
- Stagger 5-7 per hour
- Be personal — don't paste template

### Step 7: Reply handling
**If they reply positively:**
- Schedule the help session immediately
- During session: don't pitch, just unblock + show wedge feature
- End session by asking: "Now that you've seen it work, what's the chance you'd renew after trial?"

**If they reply "not for me right now":**
- Ask: "Honest feedback — what specifically wasn't a fit?"
- Save the reason — this is gold for Day 27 pitch refinement

**If they don't reply:**
- One more nudge 2-3 days later (Day 26 fits)
- After that, accept the loss

### Step 8: Track outcomes
Update spreadsheet:
- Re-activation message sent date
- Response Y/N
- Re-engaged Y/N (logged in again?)
- Outcome (Active again / Lost / Pending)

### Step 9: Document stalling patterns
After all messages sent, note 3-5 common reasons:
- "Empty dashboard, didn't know where to start" (Type 3)
- "Couldn't get AI calling to work on first try" (technical)
- "Got busy with real deals, lost momentum" (timing)
- "Confused by pricing tiers" (sales)

Add to friction-backlog for future onboarding improvements.

### Step 10: Iterate Day 4's onboarding
If you keep seeing the same stall pattern, that's a product signal:
- Type 1 dominant → improve welcome email + onboarding kickoff
- Type 2 dominant → simplify onboarding flow
- Type 3 dominant → auto-populate demo data on new signup
- Type 4 dominant → push wedge feature in welcome email sequence

Add the highest-frequency fix to Day 27 / Month 2 backlog.

## Tools / Stack Required
- PostHog (cohort + user profiles)
- Email / WhatsApp Business
- Loom (for async unblock videos)
- Calendar (for screen-share sessions)
- Your tracking spreadsheet

## Time Estimate
- Cohort + context gathering: 1-2 hours
- Personalized messages: 2-3 hours
- Reply handling + screen shares: 2-3 hours
- Documentation: 30 min
- **Total: full day**

## Deliverables
- All stalled users contacted
- 20%+ re-engaged
- 1+ re-activated user moves to trial-active or paid
- Stalling-pattern documentation
- Tracker updated

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Messages feel needy / pushy | Tone is service-oriented ("how can I help"), not sales-oriented |
| User feels surveilled ("you saw I didn't log in?") | Frame positively: "Noticed you signed up but didn't get to explore yet — wanted to check if something blocked you" |
| Concierge offer eats your time | Cap at 3-4 concierge sessions today; rest get async videos |
| User responds 2 days later | Set reminders; reply within 2 hours of late response |
| Stalls reveal product issue too big to fix now | Note and queue for Month 2 — don't rebuild during Week 4 |

## India-Specific Notes
- Indian agents often go silent due to real-world busy-ness (festivals, deals closing) — give grace
- WhatsApp message with voice note (10 sec, you offering help) is unusually effective in India
- Concierge offer ("I'll do this for you") is unusual but high-converting — Indian businesses value high-touch service
- Hindi/Hinglish reduces formality and increases reply rate
- Avoid contacting on Fridays late evening (mosque prayers) and Sundays (family days for many)

## Connected Days / Dependencies
- **Blocks:** Day 26 (final follow-up wave for stalls who didn't re-engage)
- **Depends on:** Day 21 (analytics setup), trial signups from Days 15-22

## Success Metric
- All stalled users contacted
- 20-40% re-engagement rate (PostHog `last_seen` updated)
- 1+ converted to active engaged usage
- Stalling pattern documented for product improvement
