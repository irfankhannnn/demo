# Day 1 — Map Your User Journey

## Objective
Walk through RealtyFlow as a brand-new user — register, onboard, complete the core task, log out — and document every friction point, broken link, and confusing UI moment in a structured backlog.

## Why This Matters for RealtyFlow
You wrote the code. You know where everything is. A new Mumbai real estate agent doesn't. Day 1 is the only chance you have to experience your own product with fresh eyes — tomorrow you've already lost that perspective. Every issue you find today gets fixed Day 2. Every issue you miss today, a beta tester finds Day 10 (and may silently drop off without telling you).

## User Story
As a founder, I want to register a fresh test account on RealtyFlow and complete the full onboarding flow as a first-time user would, documenting every confusing, slow, or broken step, so that Day 2 has a clear, prioritized list of friction points to fix before any real users arrive.

## Acceptance Criteria
- [ ] New test account created using a personal email NOT linked to your developer account
- [ ] You used a different browser (Chrome incognito or Firefox) — not your dev environment
- [ ] You completed the full onboarding flow without skipping any step
- [ ] You attempted the 3 core tasks (add a buyer, create a project, log a call) end-to-end
- [ ] You logged every issue (UI, copy, performance, bug) in a structured backlog
- [ ] Each issue tagged: critical / high / medium / low + estimated fix time
- [ ] Screenshots captured for visual issues
- [ ] You ran the same flow on mobile (your phone, not desktop) and noted mobile-specific issues
- [ ] Friction backlog saved at `marketing-and-sales/launch-plan/week-1-foundation/assets/friction-backlog.md`
- [ ] Time-to-value measured: signup → first meaningful action in seconds/minutes

## Implementation Steps

### Step 1: Set up the test environment
- Open Chrome incognito window (or Firefox if your dev work is Chrome)
- Disable browser dev tools
- Use a personal email address you don't normally use for the product (e.g., a Gmail address with `+test1` suffix)
- Pretend you saw a LinkedIn ad and clicked through

### Step 2: Start from the landing page
- Visit `realtyflow.in` (your production landing page) — NOT localhost
- Read the hero. Does it answer "what is this and is it for me?" in 5 seconds?
- Click the primary CTA ("Start Free Trial" or "Try Demo")
- Time how long until the signup form loads

Log:
- Hero copy clarity (0-10)
- CTA visibility (0-10)
- Page load time
- Anything broken (images, fonts, links)

### Step 3: Complete signup
- Fill out signup form using fresh credentials
- Note: how many fields? Anything required that shouldn't be? Anything missing (e.g., "Company name" — useful for B2B segmentation)
- Verify email if required
- Note: how long until verification email arrives? Where does it land — Inbox / Promotions / Spam?
- Click verification link
- Land in app

Log:
- Field count
- Required vs optional fields
- Email delivery time
- Email inbox placement
- Any errors / confusion

### Step 4: Onboarding flow
- Watch what happens after first login
- Is there a welcome modal? A guided tour? A blank dashboard?
- Try to complete every "Get Started" step
- Note: where do you have to guess what to do next?
- Note: any step that requires reading docs to complete?

Log:
- Onboarding steps count
- Each step: clear / unclear, time taken
- Drop-off points (where would a user give up?)

### Step 5: Complete 3 core tasks
The "aha moment" for RealtyFlow likely involves:
1. Adding a buyer (your first lead)
2. Creating a project / property
3. Logging a call OR starting an AI call

Do each one. Time it. Note every click, every confusing label, every missing tooltip.

Log:
- Steps to add a buyer
- Steps to create a project
- Steps to log/start a call
- Time-to-completion per task
- Issues per task

### Step 6: Test the un-happy paths
Real users hit these:
- Click "Save" without filling required fields — is the error message helpful?
- Try to add a duplicate buyer — what happens?
- Reload mid-form — is data saved?
- Logout and log back in — does state persist?
- Try a feature you don't have permission for (if multi-tier) — clear messaging?

Log all unhappy path bugs.

### Step 7: Mobile test
RealtyFlow agents will use this on phones constantly. Open the app on your phone:
- Does the dashboard load?
- Can you tap buttons easily?
- Is text readable?
- Does the keyboard hide form fields?
- Can you complete adding a buyer on mobile?

Log mobile-specific issues.

### Step 8: Compile the friction backlog
Create the file `marketing-and-sales/launch-plan/week-1-foundation/assets/friction-backlog.md` with this structure:

```markdown
# Day 1 Friction Backlog

## Critical (must fix Day 2 — blocks core flow)
- [ ] [Description] | [Screenshot] | [Estimated fix time]

## High (must fix Day 2 — degrades trust)

## Medium (fix this week if time permits)

## Low (Month 2 / future)

## Mobile-Specific Issues

## Copy/UX Improvements (non-bugs)

## Time-to-Value Measurement
- Signup completion: X minutes
- First buyer added: Y minutes
- First call logged: Z minutes
- Total time-to-aha: A minutes

## Overall Verdict
[2-3 sentences: is this ready for beta testers? What's the riskiest thing about UX?]
```

### Step 9: Self-debrief
After completing the walkthrough, take 10 minutes to write down:
- What surprised you?
- What would a Mumbai agent NOT understand?
- Is there a step where you'd quit if you weren't the founder?
- What's the one fix that would 10x the experience?

## Tools / Stack Required
- Chrome incognito (or alternate browser)
- Loom or built-in screen recorder — record the whole journey for review
- Phone for mobile test
- Stopwatch / phone timer
- A notepad (paper or markdown) for live note-taking

## Time Estimate
- Full walkthrough: 2-3 hours
- Friction backlog compile: 1-2 hours
- **Total: half a day**

## Deliverables
- `friction-backlog.md` with prioritized issues
- Screen recording of the full journey (Loom link or local file)
- Screenshots in `assets/screenshots/day-01/`

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| You're too close to the code — you skip steps "because you know how it works" | Force yourself: incognito, paper-based notes, follow every prompt as if you've never seen it |
| You find too many issues to fix | That's GOOD. Prioritize ruthlessly: Critical → Day 2 mandatory, others later |
| You don't find issues because you've optimized too well | Have a non-technical friend run through it too (15-min favor) |
| Mobile is broken — too big to fix Day 2 | Mark mobile fixes as "Critical for Week 2 demo" if Day 8 testers will use mobile |

## India-Specific Notes
- Test with Indian phone number format (+91 prefix) — common bug source
- Test with Indian name with non-Latin characters if you support Devanagari
- Test currency display — should be ₹ with Indian number formatting (1,00,000 not 100,000)
- Test on slower internet (throttle to 3G in Chrome DevTools — many tier-2 agents are on patchy 4G)

## Connected Days / Dependencies
- **Blocks:** Day 2 (Fix Friction Points — needs this backlog)
- **Feeds:** Day 7 (Final Technical Audit — verify all Day 1 items are fixed)

## Success Metric
- 30+ issues logged in friction backlog (if fewer, you didn't look hard enough)
- 5+ critical/high items identified
- Time-to-value measured
- You walk away feeling "this is closer to ready than I thought" OR "we have real work to do" — either is fine, both are informed
