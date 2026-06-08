# Day 28 — Continuous Feedback Channel + NPS Survey

## Objective
Install an in-app feedback button + a one-question NPS survey that captures user voice continuously — so by Month 2 you have a steady stream of feature requests, bug reports, and satisfaction signal without needing to manually run Day-13 check-ins every week.

## Why This Matters for RealtyFlow
Day 24's stalled-user re-engagement was reactive. Day 13 check-ins were manual. Day 28 makes feedback PASSIVE — users tell you what's wrong (or right) without you asking. NPS captures satisfaction trend over time. Feedback button captures specific friction in the moment it happens. Together, they replace 80% of the manual check-ins you'd do every month.

## User Story
As a founder, I want a persistent "Feedback" button in the app dashboard, a single-question NPS survey that triggers at the activation moment, and a one-question monthly poll about missing features — all routing responses to my inbox in real-time — so that by Month 2 I have continuous user-voice signal without manual check-ins.

## Acceptance Criteria
- [ ] In-app "Feedback" button visible in main nav OR persistent sidebar
- [ ] Feedback button opens a simple form: text area + optional screenshot + send
- [ ] All feedback routes to founder@ email + Slack/Telegram channel
- [ ] NPS survey configured: triggers after user reaches activation event (per Day 4 definition)
- [ ] NPS displays 0-10 scale + open-ended "why" field
- [ ] Monthly one-question poll configured: "What's the one feature missing that would make this indispensable?"
- [ ] Tester WhatsApp group remains for high-touch async feedback (not deprecated)
- [ ] All feedback aggregated in one dashboard (Notion DB / Airtable / spreadsheet)
- [ ] Founder commits to responding to each feedback within 24h
- [ ] Day-28 feedback log saved with first 5 responses

## Implementation Steps

### Step 1: Choose feedback tool stack
Two stacks:

**Stack A — DIY (recommended for Month 1):**
- Feedback button: simple modal with email/text/screenshot, posts to your API
- Routes to founder@ email + Slack/Telegram channel
- NPS: simple form with 0-10 buttons + textarea, fires on activation event via PostHog

**Stack B — Tool-based:**
- Canny.io for feature voting (free tier)
- Hotjar / Microsoft Clarity for screen recordings + sentiment
- Delighted / Wootric for NPS automation

**Recommendation:** Stack A for Month 1 (lower cost, more control). Migrate to Stack B if volume justifies.

### Step 2: Build the feedback button
Place: persistent in app sidebar or header.

Modal content:
```
What's on your mind?
[ Text area — 500 char ]

[ Optional: attach screenshot ]

[ ] Bug
[ ] Feature request
[ ] Compliment
[ ] Confused about something

[Submit] [Cancel]
```

On submit:
- POST to your API: `{ user_id, type, message, screenshot_url, page_url, timestamp }`
- Send to founder@ email immediately
- Auto-respond: "Thanks — I read every one. Will reply within 24h if action needed."

### Step 3: Wire NPS survey
Trigger: 24-48 hours AFTER `activation_event_completed`.

Show as in-app modal (1 per user, 90 days re-show):
```
Quick question: how likely are you to recommend RealtyFlow to a fellow real estate agent?

[ 0 ] [ 1 ] [ 2 ] ... [ 10 ]

Why did you give that score? (optional)
[ Text area ]

[Send] [Skip]
```

Score buckets:
- 0-6: Detractors (urgent — find out why)
- 7-8: Passives (room to improve)
- 9-10: Promoters (testimonial candidates)

Save to your DB. Compute NPS = % Promoters - % Detractors. Target Month 2: NPS >30.

### Step 4: Monthly one-question poll
Once per user per month (rotates):
- Month 1: "What's the one feature missing that would make RealtyFlow indispensable?"
- Month 2: "If RealtyFlow disappeared tomorrow, how disappointed would you be?" (Sean Ellis)
- Month 3: "What's the one workflow we don't support well?"

These rotate so users don't get fatigued.

### Step 5: Centralize feedback in one place
Build Notion DB / Airtable table:
- Columns: User, Date, Type, Message, Severity, Status (New / In Review / Action Planned / Shipped / Closed), Linked Issue
- Filter views: All open, By type, By user, Action items
- Founder reviews daily for 15 min

### Step 6: Founder feedback review ritual
Daily 9am IST 15-min ritual:
1. Open feedback inbox
2. Reply to each within 24h (template: "Got it — adding to backlog. I'll update you when shipped/decided.")
3. Tag severity
4. Update DB

Weekly synthesis:
- Friday review: any patterns? Top 3 themes?
- Update Month 2 product roadmap with high-frequency items

### Step 7: Loop back to users
When you ship something a user requested:
- "Hey [Name] — remember when you asked for X? Just shipped it. Let me know if it works."

This creates loyalty. Free word-of-mouth.

### Step 8: Don't over-engineer
Resist building a "feedback portal" with voting, comments, status threads. That's Month 3+. For Month 1:
- Inbound feedback → Notion DB
- Founder reviews daily
- Reply within 24h
- Done

### Step 9: NPS reporting
After first 5-10 NPS responses, compute Month 1 NPS.

Save to `assets/nps-month-1.md`:
- Promoters: __
- Passives: __
- Detractors: __
- NPS Score: __
- Common Detractor reasons: __
- Common Promoter feedback: __

Detractors are gold — they tell you what to fix. Promoters are testimonial / referral pipeline.

### Step 10: Brief beta testers
Send WhatsApp:
> "Update — added a 'Feedback' button in your dashboard sidebar. Use it any time you spot something weird, want a feature, or just want to vent. I read everything personally and reply within 24h."

This signals: "I'm staying close. Your input shapes RealtyFlow."

## Tools / Stack Required
- Your existing app (React/TS per CLAUDE.md) — for the button UI
- Backend endpoint for feedback POST
- Email (founder@) for delivery
- Slack / Telegram / Discord webhook (optional, for real-time pings)
- PostHog (for activation event trigger)
- Notion / Airtable for the feedback DB
- Loom (for video replies — high-touch)

## Time Estimate
- Feedback button UI + endpoint: 3-4 hours
- NPS modal + scoring: 2-3 hours
- Monthly poll setup: 1 hour
- Notion DB setup: 30 min
- Beta tester briefing: 15 min
- **Total: full day**

## Deliverables
- In-app feedback button live
- NPS survey triggering on activation
- Monthly poll scheduled
- Notion / Airtable feedback DB created
- Founder daily review ritual set
- Beta tester WhatsApp briefing sent
- First 5 feedback responses logged (over coming days)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Feedback floods overwhelm you | Triage daily, tag severity, don't action everything. "Read + acknowledged" is enough for most. |
| NPS scores low | Diagnose Detractor reasons; act on top 1-2 themes |
| Users ignore the feedback button | Place prominently; mention in welcome emails ("Hit Feedback button anytime") |
| Survey fatigue | Cap to 1 NPS per 90 days + 1 monthly poll per user. Don't ask weekly. |
| Privacy concern (storing free-text feedback) | Disclose in privacy policy; allow user to delete their feedback |

## India-Specific Notes
- Indian users prefer text/voice over rating-scale alone — open-ended "why" is critical
- Hindi/Hinglish in feedback messages = high authenticity, treat seriously
- Voice-note feedback (via WhatsApp) is common — accommodate it
- NPS in India sometimes runs lower than US benchmarks (cultural — Indians rarely give 10s) — calibrate expectations
- Detractor follow-up via WhatsApp call (not email) = high-impact response in India

## Connected Days / Dependencies
- **Blocks:** Month 2 product roadmap (built from Day 28's continuous feedback)
- **Depends on:** Day 4 (analytics + activation event), Day 5 (helpdesk infra)

## Success Metric
- Feedback button shipping by EOD
- NPS survey configured
- First 5 feedback items logged in Notion DB within 48h of deploy
- Beta tester WhatsApp group reacts ("nice", "thanks")
- You have a passive feedback machine running by Day 30
