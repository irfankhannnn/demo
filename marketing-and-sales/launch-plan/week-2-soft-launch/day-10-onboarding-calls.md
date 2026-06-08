# Day 10 — Conduct Onboarding Calls (Watch Them Use It)

## Objective
Run 8-12 video walkthroughs where you share the screen with the beta prospect, watch THEM sign up and use RealtyFlow live, and document every hesitation, every confused face, every "wait, where's...?" moment without intervening prematurely.

## Why This Matters for RealtyFlow
This is the single highest-signal activity in your entire 30-day plan. Every word of feedback in Week 1 was theoretical (you imagined a user). Now you're watching real Indian real estate agents — not you, not your co-founder, not your developer friend — interact with RealtyFlow for the first time. Their friction is real product-market fit data. Recording these calls gives you weeks of insight to mine.

## User Story
As a founder, I want to run 8-12 video onboarding calls with beta prospects where they share their screen, sign up live, complete onboarding, and try to perform 2-3 core tasks — while I observe without intervening — so that I learn exactly where Indian real estate agents struggle, what they value, and what they say in their own words about RealtyFlow.

## Acceptance Criteria
- [ ] 8-12 calls completed (target — adjust based on Day 9 bookings)
- [ ] Each call: prospect shares THEIR screen (not yours)
- [ ] Each call: prospect signs up using their own info (not a pre-made test account)
- [ ] Each call recorded (with consent) for later review
- [ ] Each call <30 minutes (15-min target, 30 max)
- [ ] Each prospect attempts at least 2 core tasks (add buyer, log a call, etc.)
- [ ] You DON'T intervene unless they're truly stuck >2 min
- [ ] Real-time notes captured in a structured template
- [ ] Verbatim quotes documented (especially their exact wording about what RealtyFlow is/does)
- [ ] At end of each call: ask 3 standard questions (see Step 8)
- [ ] Post-call: prospect added to beta tester WhatsApp group OR sent "next steps" follow-up

## Implementation Steps

### Step 1: Pre-call prep (15 min before each)
- Open the call note template (Step 6)
- Pull up the prospect's spreadsheet row — refresh on their context
- Have demo tenant URL ready (from `pre-launch-prep/05`) — only show if they ask
- Have Calendly available for booking follow-up if needed
- Make sure your Wi-Fi is stable, audio works, you're well-lit

### Step 2: Start the call
First 60 seconds:
- "Thanks for hopping on — really appreciate the time"
- "Quick frame: I want to watch YOU sign up and use RealtyFlow as if I'm not here. The goal is to see where it's confusing — your 'this is weird' is more valuable than 'this is great'."
- "Mind if I record? Just for my notes — won't share it externally."
- "Can you share your screen and pull up realtyflow.in?"

### Step 3: Watch them go through Steps 2-7 of the user journey
Same flow as your Day 1 walkthrough, but THEY do it. Stay silent. Observe:
- Where do they hover and not click?
- What do they say out loud while reading?
- Where do they back-button or try a different path?
- Do they understand the wedge from the H1?
- Where do they sigh, frown, or laugh?

### Step 4: When they get stuck (>2 min)
Three escalation levels:
1. **Quiet observation** — let them figure it out for 90 seconds
2. **Open question** — "What are you looking for?" (don't tell them the answer)
3. **Gentle guidance** — "Try clicking [X]" but note this is a UX failure

Stuck = product gap. Make a note. Do NOT minimize ("oh that's a known issue").

### Step 5: Have them attempt 2-3 core tasks
After signup + onboarding:
1. "Try adding a buyer for a 2BHK in Andheri, budget ₹1.5 Cr"
2. "Try starting an AI call to that buyer"
3. "Try sending a WhatsApp message about a new project"

These are the wedge demonstrations. Watch carefully.

### Step 6: Call note template
For each call:

```markdown
# Call: [Prospect Name] — [Date Time]

## Background
- Agency: [name]
- City: [city]
- Size: [solo / X agents]
- Years in industry: [if mentioned]
- Current tools: [Excel? Sell.do? Zoho? WhatsApp only?]

## Friction Points Observed
- [Timestamp] — [What happened] — [Severity]
- 0:45 — Confused by "Tenant" vs "Buyer" terminology
- 2:10 — Couldn't find "Add Project" — clicked Settings first
- ...

## Verbatim Quotes (use exact words)
- "This is exactly what I need for WhatsApp follow-up"
- "Why is it asking for GSTIN? I'm just a broker."
- "Where's the report for monthly leads?"

## Aha Moments
- [Timestamp] — [What clicked for them]

## Feature Requests They Mentioned
- [What they wished it did]

## Their Pricing Reaction
- What they said about ₹999 / ₹2,499 / ₹6,499

## Likelihood to Convert (gut feel)
- 1-10 scale + 1-sentence why
```

### Step 7: Mid-call: where you CAN talk
You can speak to:
- Answer their direct questions
- Ask clarifying open-ended questions ("Why did you click there?")
- Explain a feature if asked
- Defend a design choice if needed (rarely)

You should NOT:
- Apologize for friction ("sorry, that's confusing — we'll fix it")
- Pitch features they didn't ask about
- Defend features they criticize
- Steer them away from a flow you know is broken

### Step 8: End-of-call standard questions
Ask every prospect these 3:
1. "If I told you the price is ₹999-2,499/month, would you consider using this in 3 months?"
2. "What's the ONE thing that would make this indispensable to your daily work?"
3. "On a scale of 1-10, how disappointed would you be if RealtyFlow disappeared tomorrow?" (Sean Ellis test — 40%+ saying "very disappointed" = PMF signal)

Document their answers verbatim.

### Step 9: Set the next step before hanging up
- "Use it for 2 weeks. I'll check in via WhatsApp in 3-4 days."
- "If you hit any roadblock, message me directly: +91-XXXXX or support@realtyflow.in"
- "Want me to add you to the beta tester WhatsApp group? Other agents are sharing tips."
- Confirm their email for trial extension confirmation

### Step 10: 5 minutes post-call
Immediately after each call, before next one starts:
- Review your notes — anything missed?
- Add critical fixes to `friction-backlog.md`
- Update prospect's spreadsheet row: "Trial active", PMF score, conversion likelihood
- Save call recording to a labeled folder
- Re-energize for next call (call quality drops after 4 calls/day — limit to 4-5)

## Tools / Stack Required
- Google Meet / Zoom (with screen sharing + recording)
- Loom (for async if calls reschedule)
- Your call notes template
- Calendly (already from Day 6)
- WhatsApp Business (for beta tester group)
- Beta tester WhatsApp group (create today, add testers as they finish onboarding)

## Time Estimate
- Per call: 30 min (15 min call + 5 min prep + 10 min notes)
- 8 calls = 4-5 hours
- 12 calls = 6-7 hours
- Spread Day 10-11 if needed (don't cram all in one day — fatigue kills observation quality)

## Deliverables
- 8-12 call recordings saved
- 8-12 call note documents
- Beta tester WhatsApp group created with onboarded testers
- Updated `friction-backlog.md` with Day 10 findings
- Sean Ellis PMF score aggregated

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| You jump in too early to "help" — pollutes feedback | Sit on your hands. Stay silent for 90 seconds minimum when they're stuck. |
| Prospect no-shows | Send 1-hour reminder via WhatsApp. Re-book once. Don't chase 3x. |
| Recording fails | Use Loom as backup recording; OR have a notepad and write fast |
| Hard feedback hurts your feelings | Reframe: "their pain is my product manager." Take notes, not personally. |
| 12 calls in 2 days = exhausted you | Cap at 5/day. Quality > quantity. |
| Prospect demos product to YOU instead of trying it themselves | Redirect: "I want to see what happens when YOU click. Pretend I'm not here." |

## India-Specific Notes
- Indians are polite — expect overstated enthusiasm. Look for behavior, not words.
- If they say "this is amazing" but never logs back in → it wasn't amazing.
- Hindi/Hinglish flows naturally during calls — let them speak in their preferred language
- Indian agents may not be comfortable with screen sharing — coach them ("Click the 'Share' button at the bottom")
- Mobile-first agents may prefer screen-share from phone — supported on Meet, harder on Zoom

## Connected Days / Dependencies
- **Blocks:** Day 11 (Categorize feedback), Day 12 (Deploy fixes)
- **Depends on:** Day 9 (calls booked)

## Success Metric
- 8-12 calls completed (target)
- 5+ severe friction points identified (you found real product gaps)
- 3+ verbatim quotes you can use in marketing later
- 40%+ "very disappointed" on Sean Ellis test = strong PMF early signal
