# Day 2 — Fix Friction Points

## Objective
Resolve every Critical and High-priority issue in the Day 1 friction backlog. Do NOT add new features. Do NOT refactor. Just kill friction.

## Why This Matters for RealtyFlow
The Day 1 walkthrough exposed exactly what will trip up beta testers in Week 2. Fixing these now means Day 10 onboarding calls focus on value, not workarounds. Every Critical issue you skip becomes a "huh, this is broken" moment for a real agent — and that moment kills conversion 5x faster than any other factor.

## User Story
As a founder, I want to deploy fixes for every Critical and High-priority item in the Day 1 friction backlog, with no scope creep, so that Day 3 payment testing happens on a polished surface and Week 2 beta testers don't drop off due to known bugs.

## Acceptance Criteria
- [ ] All Critical issues from Day 1 backlog deployed to production
- [ ] All High issues from Day 1 backlog deployed to production
- [ ] No new features added (this is a fix-only day)
- [ ] Re-test fixed flows in incognito to verify
- [ ] Update `friction-backlog.md` — mark items DONE with commit SHA
- [ ] Mobile fixes deployed and re-tested on phone
- [ ] Production deploy completed by end of day
- [ ] Zero regressions introduced (smoke test of core flows)
- [ ] Day 2 commit log links saved for future reference

## Implementation Steps

### Step 1: Re-read the Day 1 backlog
Open `friction-backlog.md`. Read every item. Refresh memory.

Group fixes by area:
- Frontend: form fields, copy, error messages, mobile responsive
- Backend: validation, error responses, performance
- Email: deliverability, content, links
- Onboarding flow: order, copy, guided tour

### Step 2: Sequence the fixes — small first
Tackle in this order:
1. **Copy fixes (1-15 min each)** — wording, labels, tooltips, error messages. Fast wins build momentum.
2. **CSS/UX fixes (15-45 min each)** — alignment, spacing, mobile, button sizes.
3. **Validation fixes (30-60 min each)** — required field handling, duplicate prevention, format checks.
4. **Bug fixes (variable)** — broken flows, missing data, edge cases.
5. **Email fixes** — template updates, deliverability tweaks, link corrections.

Do NOT mix categories. Batch by area to keep focus.

### Step 3: Set a hard rule — NO new features
Today is fix-only. If you find yourself thinking "while I'm in here, I should add..." — STOP. Write it down for Month 2. Today's deliverable is fixes, not features.

### Step 4: For each fix
1. Find the file (use Grep / file search)
2. Make the change
3. Test locally
4. Commit with descriptive message: `fix(onboarding): clear error message when email exists`
5. Deploy (or batch deploy at end of day)

### Step 5: High-impact fixes to prioritize (typical first-time SaaS findings)
Based on common patterns, prioritize these if they're in your backlog:
- "Email verification link doesn't work on mobile" — fix Resend, Mailgun, Brevo template
- "Form submits with empty required fields" — add inline validation
- "Save button is unclear" — rename "Save" to "Add Buyer" / "Create Project"
- "No success confirmation after adding a buyer" — add toast/modal
- "Phone number format doesn't accept +91" — normalize input
- "Currency display wrong (USD instead of INR)" — fix locale
- "Logout doesn't clear session" — fix auth cookie cleanup
- "Dashboard empty state has no guidance" — add "Add your first buyer" CTA

### Step 6: Mobile-specific fixes
RealtyFlow agents will use this 50%+ on phones:
- Tap targets minimum 44x44px
- Form fields above keyboard (not hidden)
- Modal dismissal works on touch
- Sidebar collapses cleanly
- Table views scroll horizontally without breaking

### Step 7: Re-test in incognito after deploy
- Open fresh incognito window
- Re-walk the journey from Day 1
- Verify each fixed item is actually fixed
- If a fix introduced a regression, fix or rollback

### Step 8: Update the backlog
Mark each item:
- [x] Critical: "Email verification mobile-broken" — DONE — commit `a1b2c3d` — deployed 14:32
- [x] High: "Empty dashboard has no CTA" — DONE — commit `e4f5g6h` — deployed 15:10

Move unfixed items to "Day 12" if not blocking beta launch.

### Step 9: Smoke test core flows one more time
Run through:
- Signup → email verify → first login → onboarding → add buyer → log call → logout
- Same on mobile
- Same with Indian phone number / currency / name

### Step 10: End-of-day journaling
Write 3-5 sentences:
- What did you fix?
- What surprised you about your own code?
- What's still risky going into Day 3?

## Tools / Stack Required
- Your IDE / dev environment
- Local + staging environments
- Production deploy pipeline (Lambda + CloudFormation per CLAUDE.md)
- Chrome DevTools
- Your phone for mobile testing
- Loom for before/after screen recordings (optional, useful for changelog)

## Time Estimate
- Triage and sequencing: 1 hour
- Fixes (varies by backlog size): 4-6 hours
- Re-test and verify: 1-2 hours
- **Total: full day**

## Deliverables
- All Critical and High items deployed to production
- Updated `friction-backlog.md` with statuses
- Git commit history with descriptive messages
- Smoke test passing in incognito

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Scope creep (adding features) | Rule: only items from yesterday's backlog. New ideas → new file `month-2-backlog.md` |
| Fix introduces a regression | Smoke test core flows after every deploy. Don't deploy at 11pm tired. |
| Backlog is too large to clear | Prioritize Critical > High. Mediums can slip to Week 2. |
| Mobile fixes take longer than expected | Mobile-only issues can wait until Day 4-5 if needed. Beta testers Day 10 mostly desktop. |
| Production deploy breaks | Have rollback ready. Deploy in afternoon, not late evening, so you can fix if needed |

## India-Specific Notes
- Test phone number validation accepts: `+91 98765 43210`, `+919876543210`, `9876543210`, `091-9876543210`
- Currency formatting: `₹1,00,000` (Indian numbering) not `₹100,000` (Western)
- Date formatting: `DD/MM/YYYY` not `MM/DD/YYYY`
- Hindi/regional text rendering — make sure Devanagari fonts load

## Connected Days / Dependencies
- **Blocks:** Day 3 (Payment Testing — payment fails if friction-prone signup blocks)
- **Depends on:** Day 1 (Map User Journey — needs the backlog)

## Success Metric
- Zero Critical items remaining in backlog
- Re-walked journey takes 30%+ less time than Day 1
- You'd be comfortable having a real Mumbai agent walk through it tomorrow
