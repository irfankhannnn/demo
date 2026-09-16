# Day 28 — NPS Survey + In-Product Feedback Loop

> **Type:** 🤖 AUTO
> **Phase:** Week 4
> **Skill(s):** `customer-research` + `email-sequence` + `analytics-tracking` + `pr-review`
> **Estimated time:** 2h founder + 4h AI

## Objective
Ship in-product NPS survey (after 14 days of usage) + email NPS to all M1 trial users (active + paid + churned) + open feedback Crisp channel + collect first cohort NPS score for M2 reference.

## Why This Matters for RealEstateFlow
NPS = quantified word-of-mouth potential + retention predictor. Day-28 captures M1 baseline. Without baseline, M2-M6 can't measure improvement.

## User Story
As a Day-14+ trial/paid user, I want to be asked once "would you recommend RealEstateFlow?" with a single click, so I can give honest feedback in 30 seconds.

## Acceptance Criteria
- [ ] In-product NPS modal shipped: triggers after 14 days from `created_at` AND ≥1 active session in last 3 days; 1-question 0-10 scale + free-text; max 1 ask per user per 90 days
- [ ] Email NPS sent to all M1 cohort (active trials + paid + churned) — Brevo template
- [ ] PostHog `nps_score` event captured with score + persona property
- [ ] PostHog cohort + dashboard showing M1 NPS distribution
- [ ] NPS classification: Promoters (9-10) / Passives (7-8) / Detractors (0-6)
- [ ] Promoters automatically queued for Day-30 referral ask + testimonial Day 35
- [ ] Detractors automatically queued for founder personal call within 48h ("what would have made this a 9?")
- [ ] Passives queued for re-engagement drip M2
- [ ] Crisp channel pinned message: "Have feedback? DM us anytime."
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Run AI Prompt #1** to generate the in-product modal component + backend route.
2. **Review + ship** modal PR.
3. **Run AI Prompt #2** to generate Brevo NPS email + workflow.
4. **Send NPS email** via Brevo to M1 cohort (Day 28 11am IST).
5. **Personally call/message** any Detractor within 48h.
6. **Monitor responses** in PostHog + Brevo.
7. **Daily standup**.

## AI Prompt #1 (🤖) — In-product NPS modal

```
You are a senior full-stack engineer. Build an in-product NPS modal for RealEstateFlow.

Read:
- `apps/crm/real-estate-crm-app/src/App.tsx`
- `apps/crm/real-estate-crm-app/src/components/PaywallModal.tsx` (modal pattern)
- `apps/crm/real-estate-crm-app/src/contexts/AuthContext.tsx`
- `apps/crm/server/routes/feedback.js` (or create if missing)
- `apps/crm/server/services/dynamodb.js` (NpsResponses table or create)

Build:

## Frontend
- Component: `apps/crm/real-estate-crm-app/src/components/NpsModal.tsx`
  - Trigger: only show if user.created_at < now()-14*24h AND last NPS ask > 90 days ago AND active session
  - 1 question: "How likely are you to recommend RealEstateFlow to a fellow Mumbai broker?" (0-10 scale, button row)
  - On click: POST `/api/feedback/nps` { score, anonymous: false }
  - On score 0-6: show free-text "What would have made this a 9?" — required
  - On score 7-8: optional free-text
  - On score 9-10: free-text "What's the one thing you love?" + "May we share your testimonial?" toggle
  - On submit: PostHog event `nps_score` { score, free_text_present, persona }
  - Dismiss-once: localStorage flag `nps_asked_at = today`
  - Re-ask: only after 90 days

## Backend
- Route: `apps/crm/server/routes/feedback.js` POST /api/feedback/nps
- Auth: requires authenticated user
- Body: { score: 0-10, free_text?: string, share_testimonial?: bool }
- Validation: score required, free_text required if score ≤ 6
- DynamoDB write: NpsResponses { tenantId, userId, score, free_text, share_testimonial, created_at }
- Side effects:
  - PostHog server event `nps_recorded`
  - If score ≤ 6: send Slack/Telegram notification to founder ("Detractor: {{user}} — {{free_text}}")
  - If score ≥ 9 + share_testimonial: tag in Brevo for testimonial follow-up

## Tests
- Playwright: open SPA → trigger modal (mock 14-day-old user) → click 9 → free-text → submit → DDB row created → PostHog event captured

Output:
1. `NpsModal.tsx` (full)
2. `feedback.js` route (full)
3. DDB schema for NpsResponses
4. Playwright test
5. PR description

Stop.
```

## AI Prompt #2 (🤖) — Email NPS

```
Read:
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (brand voice)
- `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md`

Produce `marketing-and-sales/launch-implement/week-4/day-28-nps-email.md`:

## Email content
Subject: "{{name}}, would you recommend RealEstateFlow? (1-click)"
Preheader: "30 seconds — your answer shapes Month 2."
Body (≤120 words):
- 1-line context: "It's been [N] days since you started — would love your honest take."
- Single question link: 11 links (0-10) — each links to `https://realestateflow.in/nps?score=X&token=...`
- 1 line: "If you click 9 or 10, we'll ask one bonus question (whether we can share your testimonial). If 0-6, we'll personally follow up to learn what missed."
- Founder signature

## Brevo automation spec
- Trigger: contact in M1 cohort list AND created > 14 days
- Step: send email above
- On link click → server endpoint records score + free-text follow-up

## Server endpoint
`/nps` GET handler:
- Validate token (HMAC of user_id + score)
- Render thank-you page with optional free-text textarea
- Store in same NpsResponses table
- Same PostHog event firing

## Promoter / Detractor automations
- Promoter (9-10): tag as "promoter" → enqueue Day-30 referral ask
- Detractor (0-6): SLA 48h founder call → personal email + WhatsApp template

Stop.
```

## Inputs
- M1 cohort
- Brevo + PostHog
- SPA + server

## Outputs
- `NpsModal.tsx` + route + DDB schema
- Brevo NPS email + automation
- M1 NPS data captured
- Promoter + Detractor follow-up queues

## Success Criterion
≥30% NPS response rate from M1 cohort + at least 1 baseline NPS score documented.

## Fallback / Plan B
If response rate <15%, send WhatsApp version Day 30. If product modal triggers issue, defer and rely on email-only.

## Risks
| Risk | Mitigation |
|---|---|
| Modal annoys active users | 90-day re-ask cap + dismissable + only after 14 days |
| HMAC token leak | Use env-secret for HMAC; rotate quarterly |
| Detractor backlash | Personal call SLA 48h |
| Response bias (only happy users respond) | Email + in-product = 2 channels; track deliverability |

## India / Mumbai-Specific Notes
- 0-10 NPS scale familiar in Indian B2B; no translation needed
- Detractor follow-up via WhatsApp voice = highest empathy channel
- "Recommend to fellow Mumbai broker" = locality-specific framing

## Dependencies
- **Blocks:** Day 29 retention audit (uses NPS data), Day 30 M2 strategy, M2 referral program
- **Depends on:** Day-21 PMF check, P10 PostHog events

## Connected Skills
- `customer-research` — NPS interpretation
- `email-sequence` — Brevo workflow
- `analytics-tracking` — PostHog events
- `pr-review` — code review
