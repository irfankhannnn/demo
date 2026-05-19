# Day 09 — Craft + Send Beta Invites (Email + WhatsApp + LinkedIn)

> **Type:** 🤝 HYBRID + 🧍
> **Phase:** Week 2
> **Skill(s):** `cold-email` + `whatsapp-outreach` + `outbound-outreach`
> **Estimated time:** 5h founder + 2h AI

## Objective
Send personalised beta invites to all 30-40 Day-8 prospects via 3 channels (email + WhatsApp + LinkedIn) with founder-personal voice + 90-sec Loom + cal.com booking link, targeting 8-12 confirmed beta tester signups by EOD Day 10.

## Why This Matters for RealEstateFlow
Day 9 invites are the first real test of the wedge + offer + product. Reply rate ≥20% is the signal that the positioning works; <10% means iterate before Day 17 cold sequence.

## User Story
As founder, I want each of 30-40 prospects to receive a personalised invite via their best channel + a clear no-card 14-day offer, so 8-12 confirm beta participation by Day 10 EOD.

## Acceptance Criteria
- [ ] Invite templates drafted at `marketing-and-sales/launch-implement/week-2/day-09-templates.md`: email (long), email (short), WhatsApp text, WhatsApp voice script (60s), LinkedIn DM
- [ ] All templates use founder-personal voice (no buzzwords, no "Dear Sir/Madam")
- [ ] Each prospect routed to their best channel: WhatsApp Business → WhatsApp text+voice; LinkedIn-active → LinkedIn DM; email-only → email
- [ ] Templates carry: 1-line wedge, 1 personalisation token, 14-day no-card offer, 90-sec Loom URL, cal.com booking link, founder name
- [ ] All 30-40 invites sent by EOD Day 9
- [ ] Tracker at `marketing-and-sales/launch-implement/week-2/day-09-invite-log.csv`: prospect, channel, sent_at, response_y_n, response_at, response_text, status (interested/not-interested/no-reply)
- [ ] Reply rate target ≥20% by EOD Day 10
- [ ] Confirmed beta testers target: 8-12 booked for Day 10 onboarding calls
- [ ] Cal.com receives bookings; founder calendar fills Day 10 slots

## Manual Steps (🧍)

1. **Run AI Prompt below** to generate 5 templates with placeholder slots.
2. **Personalise per prospect**: for each row in `day-08-mumbai-prospects.csv`, fill placeholders (name, agency, locality, hook). Don't bulk-blast — each invite hand-customized in <2 min.
3. **Route by channel**:
   - WhatsApp-active prospects: send text from founder personal WhatsApp + 60-sec voice note (record once, send to all WhatsApp prospects)
   - LinkedIn-active prospects: send DM via LinkedIn
   - Email-only prospects: send via Gmail / Brevo (founder mailbox warm)
4. **Cap daily sends**: max 15 WhatsApp/day, 10 LinkedIn DM/day, 20 email/day (avoid spam flags). Spread Day 9-10 if needed.
5. **Track every send** in the CSV log immediately.
6. **Monitor replies** every 2h Day 9 + Day 10 morning. Reply within 60 min during business hours.
7. **For interested**: book Cal.com slot for Day 10-11 onboarding call (15-30 min).
8. **Daily standup** + tick ACs.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/day-08-mumbai-prospects.csv` (sample 5 rows)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-profile.md`
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/outreach/mumbai-outreach-templates.md` (existing baseline — adapt voice, don't copy verbatim)

Produce 5 templates at `marketing-and-sales/launch-implement/week-2/day-09-templates.md`. Each carries placeholders `{{name}}`, `{{agency}}`, `{{locality}}`, `{{hook}}`, `{{founder_first_name}}`, `{{loom_url}}`, `{{calcom_url}}`. Voice = direct, founder-personal, not corporate. English with sparing Hinglish (1-2 words max).

## Template 1 — Long email (300-400 words)
Subject (≤50 chars): "{{name}}, can RealEstateFlow save your team 10h/week?" or 3-4 subject variants for A/B
Preheader (≤90): "Built for Mumbai brokers — 14-day free trial, no card."
Body structure:
- Para 1: Personalisation — reference {{hook}} + brief intro of who I am (founder, building this in Mumbai)
- Para 2: Wedge — "RealEstateFlow is an AI Employee that runs your broking agency on WhatsApp + Telegram. Qualifies leads, follows up buyers, updates your Khata book."
- Para 3: Why I'm reaching out — building beta cohort of 8-12 Mumbai brokers; you fit the ICP; hoping you'd try it for 14 days free.
- Para 4: Offer specifics — no card needed, 1-month money-back if you upgrade, full demo at {{loom_url}}, book 15-min call at {{calcom_url}}.
- Para 5: Soft close — "Would love your feedback even if you don't sign up. Reply to this email with any thoughts."
Signature: founder name + LinkedIn link + WhatsApp number

## Template 2 — Short email (~120 words)
For prospects with limited bandwidth.
- Hook: 1-line personalisation
- Wedge: 1 sentence
- Offer: 1 sentence
- CTA: book 15-min call

## Template 3 — WhatsApp text (≤500 chars, 3-4 short paragraphs separated by line breaks)
- Hi {{name}} — saw {{hook}}, congrats!
- I'm {{founder_first_name}}, building RealEstateFlow — it's like an AI Employee for Mumbai brokers, runs your CRM via WhatsApp + Telegram. Built it because 80% of broker work happens on WhatsApp anyway.
- Putting together 8-12 Mumbai brokers for a 14-day free beta. No card needed. Would love to add you. {{calcom_url}} or just reply here.
- Voice note coming in next message.

## Template 4 — WhatsApp voice script (60-second version, founder records once, sends to all WA prospects)
Open: "Hi, I'm {{founder_first_name}}, and I'm building RealEstateFlow — an AI Employee for real estate brokers in Mumbai." Then 30s of: what it does (CRM + WhatsApp + Telegram + Khata book) + why I built it + the 14-day free beta offer. Close: "If this sounds interesting, just reply or book a quick 15-min call — link's in the previous message. No pressure either way."
- Record yourself; ElevenLabs OK as fallback if uncomfortable on voice
- Save the .ogg file in repo; reuse for every WhatsApp prospect

## Template 5 — LinkedIn DM (≤500 chars, very personal)
- "Hi {{name}}, {{hook}} — quick note: I'm building RealEstateFlow, an AI Employee for Mumbai brokers. Putting together a 14-day free beta of 8-12 brokers. You'd fit perfectly. Open to a 15-min chat? {{calcom_url}}"

## Output
Each template has:
- The template body
- 3 alternative subject lines (for emails)
- Channel routing logic per ICP profile (e.g., "use WhatsApp if whatsapp_business_y_n=Y AND icp_fit_score≥7")
- Expected reply-rate target: email 15-25%, WhatsApp 25-40%, LinkedIn DM 10-15%
- Send cap rules: 20 emails/day, 15 WhatsApps/day, 10 LinkedIn DMs/day

Produce a CSV template at `marketing-and-sales/launch-implement/week-2/day-09-invite-log.csv` with empty rows for Day 9 logging:
prospect_name, channel, sent_at, replied (Y/N), reply_at, reply_summary, status (interested/not/no-reply), booked_call (Y/N), notes

Stop. Do not send (founder sends manually).
```

## Inputs
- Day 8 CSV
- Wedge + LinkedIn profile copy
- Loom URL (P6)
- Cal.com handle

## Outputs
- `marketing-and-sales/launch-implement/week-2/day-09-templates.md`
- `marketing-and-sales/launch-implement/week-2/day-09-invite-log.csv` (template; founder fills)
- WhatsApp voice .ogg recorded
- 30-40 invites sent + tracked

## Success Criterion
≥20% reply rate by EOD Day 10; ≥8 confirmed beta testers booked.

## Fallback / Plan B
If reply rate <10% by Day 10 morning, A/B test new subject lines + WhatsApp opener; ramp follow-up wave Day 11. If <5 confirmed by Day 10 EOD, expand cohort: send to next 20 prospects with ICP score 5-6 from Day-8 list.

## Risks
| Risk | Mitigation |
|---|---|
| Spam flag from too many sends | Daily caps; warm mailbox (P3) |
| WhatsApp number flagged | Personal number ≤15 sends/day with personalised text |
| LinkedIn DM throttle | Stay under 10/day; quality over quantity |
| Voice note feels weird | Record draft, listen back, re-record until natural |
| Replies missed | 2h check cadence Day 9-10 |

## India / Mumbai-Specific Notes
- WhatsApp dominant — primary channel for ≥60% of prospects
- Voice notes get higher engagement than text in Mumbai broker culture
- Hinglish 1-2 words ("bhai", "agency"); don't overdo
- Cal.com set IST + 15-min default

## Dependencies
- **Blocks:** Day 10 onboarding calls
- **Depends on:** Day 8 CSV, P6 Loom, Cal.com active, P3 warm mailbox

## Connected Skills
- `cold-email` — email templates
- `whatsapp-outreach` — WA text + voice
- `outbound-outreach` — multi-channel sequence
