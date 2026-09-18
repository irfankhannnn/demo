# Day 24 — Reactivate Stalled Trials (Email + WhatsApp + Founder DM)

> **Type:** 🤖 AUTO + 🤝
> **Phase:** Week 4
> **Skill(s):** `email-sequence` + `whatsapp-outreach` + `customer-research` + `paywall-upgrade-cro`
> **Estimated time:** 2h founder + 3h AI
> **Script:** `../40-sales-and-conversion/onboarding-script.md` (stall-recovery plays) · `../30-channels/whatsapp/customer-success.md`

## Objective
Identify all trial users active Day 1-21 who have NOT logged in for 3+ days (stalled), send a personalised reactivation message via email + WhatsApp + offer 7-day trial extension or 30-min screen-share to unblock. Goal: 30%+ stalled-trials reactivate.

## Why This Matters for RealEstateFlow
Stalled trials = silently churned trials. Day 24 saves these conversions before Day 30 expiry. Even 3-4 saves translates to ₹3,000-8,000 MRR if they convert.

## User Story
As a stalled trial user receiving a personal Day-24 message from the founder, I want a low-friction path to either restart my trial or talk to the founder, so I'm not just lost.

## Acceptance Criteria
- [ ] Stalled-trial cohort identified (PostHog: trial_started + no events last 3 days, not paying)
- [ ] Reactivation message drafted per persona at `day-24-reactivation-templates.md`
- [ ] Channel routing: email primary + WhatsApp where number captured + LinkedIn DM if connected
- [ ] All stalled trials get 1 personalised message Day 24 + 1 follow-up Day 27 if no response
- [ ] Trial extension (+7 days) offer documented + admin endpoint validated
- [ ] Cal.com slots reserved for Day 25-26 30-min screen-shares
- [ ] Tracker `day-24-reactivation-log.csv`: trial_user, email, sent_at, channel, replied_y_n, action_taken (extension / call_booked / no_action)
- [ ] Reactivation rate target ≥30% (action taken or replied)
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Run AI Prompt #1** to identify stalled cohort + draft templates.
2. **Manual review** of templates (founder voice).
3. **Send messages** via Brevo (email) + AiSensy/personal WhatsApp + LinkedIn manual.
4. **Monitor replies** + book demos / issue extensions in real-time.
5. **Daily standup**.

## AI Prompt (🤖)

```
Read inputs:
- PostHog: filter users where `subscription_status` = 'trial' AND last_event_timestamp < now()-3*24h AND last_event_timestamp > now()-21*24h
- DDB Subscriptions table: trial_started_at, trial_days_left, plan_id
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{slug}.md` (any beta tester data on file)
- `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md` (existing trial reminders)

## Step 1 — Stalled cohort identification

Output `marketing-and-sales/launch-implement/week-4/day-24-stalled-trials.csv`:
| user_email | trial_started | days_idle | last_event | trial_days_left | plan | persona_match |

For each user, classify persona based on what they did before stalling:
- Activated (added 1+ buyer + 1+ property) — "got partial value, lost interest"
- Onboarded but didn't add records — "got stuck"
- Never finished onboarding — "got lost early"

## Step 2 — Reactivation templates

Per persona, draft a 1-message email + 1 WhatsApp text:

### Persona A — "Got partial value, lost interest"
Email subject: "{{name}} — your last lead was {{lead_name}} 4 days ago"
Body: 80 words. "Saw you stopped using RealEstateFlow 4 days ago. Your trial has X days left + we just shipped {{Day-22 fix}} that addresses {{their likely pain}}. Want a 30-min call to walk through how to get more out of it? Cal.com link. — Founder."
WhatsApp: shorter version with same offer.

### Persona B — "Got stuck"
Email: "{{name}} — anything blocking you?"
Body: 70 words. "Noticed you haven't used the CRM since onboarding. Often that's a small confusing thing — happy to do 15-min screen-share. 7-day trial extension if you want more time. Reply with what's blocking. — Founder."

### Persona C — "Got lost early"
Email: "{{name}} — let's get you started in 10 min"
Body: 60 words. "Looks like onboarding didn't fully click. Here's the 90-sec demo + offer to do a 10-min walk-through together. Trial paused — extending +7 days no questions asked." Cal.com.

## Step 3 — Send queues

Output `marketing-and-sales/launch-implement/week-4/day-24-reactivation-templates.md` with personalised message per stalled user (founder reviews then sends).

Output `marketing-and-sales/launch-implement/week-4/day-24-reactivation-log.csv` template.

## Step 4 — Trial extension instructions

Output `marketing-and-sales/launch-implement/week-4/day-24-extension-sop.md`:
- Admin endpoint: POST /api/admin/subscriptions/{id}/extend-trial { days: 7, reason: "founder reactivation" }
- Auth: founder admin token
- Audit log: writes to AuditLog table
- Backend: agency-app/api/routes/admin.js subscriptionsExtendTrial handler (verify exists or build)
- SPA notification: the user sees a banner "Trial extended +7 days by founder. Welcome back!"
- Email confirmation auto-sent

## Step 5 — Reactivation funnel measurement

Add PostHog event `trial_reactivated` (fires on next session post-message).
Configure cohort `Day-24 Reactivated` in PostHog.

Stop. Do not auto-send.
```

## Inputs
- PostHog stalled-trial filter
- DDB subscriptions
- Existing trial-email templates

## Outputs
- `day-24-stalled-trials.csv`
- `day-24-reactivation-templates.md`
- `day-24-reactivation-log.csv`
- `day-24-extension-sop.md`
- New PostHog event + cohort

## Success Criterion
30%+ reactivation rate (replied or action taken); ≥3 trials extended; ≥2 paid conversions Day 24-30.

## Fallback / Plan B
If reactivation rate <15%, send 2nd-touch Day 27 with stronger offer (e.g., 14-day extension or 1-mo half-price). Don't shame; respect choice.

## Risks
| Risk | Mitigation |
|---|---|
| Stalled user feels stalked | Single personalised message per channel + 1 follow-up max |
| Trial extension abuse | Admin-only endpoint with audit log |
| Wrong cohort filter | Cross-check 5 users manually before sending |
| Privacy concerns (mentioning their lead name) | Keep PII out of templates; reference activity in general terms |

## India / Mumbai-Specific Notes
- WhatsApp >> email for Mumbai brokers; lead with WhatsApp where number on file
- Trial extension feels generous (Indian SaaS culture appreciates this)
- Founder voice essential — corporate auto-emails ignored

## Dependencies
- **Blocks:** Day 26 trial-to-paid follow-up, Day 30 conversion
- **Depends on:** P10 events firing, P14 trial system, paywall API

## Connected Skills
- `email-sequence` — drip
- `whatsapp-outreach` — WA reactivation
- `customer-research` — persona-based messaging
- `paywall-upgrade-cro` — extension UX
