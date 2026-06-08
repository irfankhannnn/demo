# Day 9 — Send Personalized Beta Invitations

## Objective
Send personalized outreach to the 30-40 Day-8 prospects across LinkedIn, WhatsApp, and email — offering 3 months free in exchange for honest feedback and a 10-minute walkthrough — and book 8-12 onboarding calls for Day 10-11.

## Why This Matters for RealtyFlow
This is the first real test of your wedge, your positioning, and your founder credibility. If 30 personalized messages produce 0 replies, your wedge is wrong (or your delivery is). If they produce 15+ replies, you have product-market signal. Either way, you learn fast. The goal is not "sign everyone up" — it's "have honest conversations with 8-12 agents".

## User Story
As a founder, I want to send personalized beta invitations to the 30-40 Day-8 prospects across LinkedIn, WhatsApp, and email — each message referencing a specific hook about that prospect and offering 3 months free in exchange for a 10-min walkthrough and honest feedback — so that 8-12 agents agree and become active beta testers by Day 14.

## Acceptance Criteria
- [ ] 30-40 personalized messages sent across LinkedIn, WhatsApp, email
- [ ] Each message <120 words (Indian attention spans are short on cold)
- [ ] Each message has a real personalization hook (not "I noticed you're in real estate")
- [ ] Offer is clear: "3 months free in exchange for honest feedback + a 10-min walkthrough"
- [ ] CTA is concrete: "Would you be open to a 10-min call this week?"
- [ ] Calendly link OR specific time slots offered (reduce friction)
- [ ] Send timing optimized (Tue-Thu, 10am-12pm or 4-6pm IST)
- [ ] Replies tracked in Day-8 spreadsheet
- [ ] 8-12 calls booked on calendar (Day 10-11)
- [ ] Follow-up sequence planned for non-responders (Day 11)

## Implementation Steps

### Step 1: Draft a base template per channel
Reference `marketing-and-sales/launch-plan/templates/beta-invite-email.md` and `beta-invite-linkedin.md` (built in Templates batch).

Quick template structure:

**Hook + relevance** (1-2 sentences) → **Who you are + what RealtyFlow does** (2 sentences) → **The offer** (1 sentence) → **CTA** (1 sentence)

### Step 2: Personalize each one
For each prospect, replace the [HOOK] placeholder with your real research finding. Examples:

> "Hi Rohit, saw your LinkedIn post last week about losing 3 deals to slow follow-up — that's exactly the problem I'm trying to solve.
>
> I'm building RealtyFlow, a CRM for Indian real estate agents that handles AI calling + WhatsApp follow-up automatically. Most of my Mumbai testers say it saves 4-5 hours/day.
>
> Looking for 10 brokers to test it free for 3 months in exchange for honest feedback. Want a 10-min walkthrough this week? Here's my calendar: calendly.com/kalimq"

**Do NOT:**
- Send the same message to everyone
- Use ChatGPT to "personalize" 30 messages — it shows
- Open with "Hope you're doing well" or "Quick question"
- Pitch features in the first message

**DO:**
- Reference something concrete you noticed
- Mention their city / agency by name
- Offer a clear time commitment ("10 min")
- Make the next step easy (Calendly link OR 2-3 time slots)

### Step 3: Send via LinkedIn (target: 15-20 messages)
For prospects you're 1st-degree connected to: send DM directly.
For 2nd-degree: send connection request WITH note (300 chars). If they accept, follow up with full message.

**LinkedIn etiquette:**
- 1 message at a time — wait for reply before sending more to same person
- Don't auto-DM via tools — LinkedIn flags this
- Personalize EVERY message (LinkedIn detects copy-paste)

### Step 4: Send via WhatsApp Business (target: 10-15 messages)
- Use WhatsApp Business mobile app (free)
- For each prospect: open chat, paste personalized message, send
- Add: "Hi [name], saw your number on 99acres — hope it's okay to reach out about this"
- Send during business hours (10am-7pm IST) — avoid early morning / late night

**WhatsApp etiquette:**
- Single message, not 5 split messages
- No marketing-heavy language ("special offer", "limited time" — sounds spammy)
- Match their language: if their listing is in Hindi, write in Hinglish

### Step 5: Send via email (target: 5-10 messages)
For prospects where you found a professional email (Hunter.io, agency website, LinkedIn export):
- Send via your warmed-up secondary domain (from `pre-launch-prep/03`)
- Subject line: short, specific, NOT salesy
  - GOOD: "Saw your post about lead follow-up"
  - GOOD: "Beta testers for Indian real estate CRM"
  - BAD: "Increase your sales 10x with RealtyFlow!"
- Use cold outreach tool (Instantly / Smartlead) for tracking

### Step 6: Stagger your sends
DO NOT send all 30 messages in one hour. Stagger:
- Tue 10am-12pm: 8 LinkedIn DMs
- Tue 4-6pm: 5 WhatsApp messages
- Wed 10am-12pm: 7 LinkedIn DMs + 5 emails
- Wed 4-6pm: 5 WhatsApp messages

This avoids LinkedIn/email rate limits and gives you time to respond as replies come in.

### Step 7: Reply within 60 minutes
The MOMENT someone replies positively:
1. Reply with enthusiasm + a Calendly link OR specific time slots
2. Offer flexibility: "Wednesday 3pm or Thursday 11am work?"
3. Confirm in their preferred channel (don't move them off WhatsApp to email if they prefer WhatsApp)
4. Send calendar invite immediately upon time confirmation

**Slow replies kill beta conversions.** A "yes I'm interested" left to bake for 24h often becomes "actually nevermind".

### Step 8: Handle objections in real time
Common objections:
- **"What's it cost after 3 months?"** → "₹999-2,499/month depending on tier. But honestly, focus on whether it works for you first."
- **"Will my data be safe?"** → "Yes — DPDP Act compliant, stored in AWS Mumbai, you own your data, full export anytime."
- **"How long is the call?"** → "10 minutes max. I'll watch you sign up and use it. Your honest 'this is confusing' is more valuable than 'this is great'."
- **"Why me?"** → "[Specific hook reason]" — repeat the personalization

### Step 9: Track everything in the spreadsheet
For each prospect:
- Sent date + time
- Channel
- Opened? (LinkedIn shows reads, email tool shows opens, WhatsApp shows blue ticks)
- Replied? (Y/N + sentiment)
- Booked call? (Y/N + slot)
- No-reply timestamp (for follow-up Day 11)

### Step 10: End-of-day reflection
At 7pm, review:
- Messages sent: __
- Replies received: __
- Positive responses: __
- Calls booked: __
- Reply rate: __%

If reply rate <10% → your message or wedge needs adjustment. If 20%+ → you're in good territory.

If <5 calls booked by end of Day 9 → escalate Day 10 sending to Tier 2 prospects.

## Tools / Stack Required
- LinkedIn (free, 2nd-degree connections via Sales Navigator if you have it)
- WhatsApp Business mobile app
- Cold email tool (Instantly / Smartlead — from `pre-launch-prep/03`)
- Hunter.io or Apollo.io (find emails if needed) — free tier
- Calendly (from `pre-launch-prep/06`)
- Your spreadsheet (CRM ironically)

## Time Estimate
- Personalization writing: 4-6 hours (30-40 messages × 5-8 min each)
- Sending: 2-3 hours
- Reply handling: 2-3 hours throughout the day
- **Total: full day**

## Deliverables
- 30-40 messages sent across 3 channels
- Spreadsheet updated with status for each prospect
- 8-12 calls booked on calendar
- Day-11 follow-up list prepared

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| LinkedIn flags account for high message volume | Stay under 20-30 messages/day; always personalize |
| WhatsApp Business flagged for spam | Don't message 50+ at once; let conversations breathe; never send media-heavy messages cold |
| Email lands in spam | Warm-up done in pre-launch-prep/03; subject line clean; no spam triggers |
| Low reply rate (<5%) | Switch up the hook angle; try shorter messages; A/B test subject lines on Tier 2 |
| Calls booked but no-show | Send 1-hour reminder + Google Meet link in WhatsApp |
| Customer asks for paid pricing immediately | Stay focused on "3 months free first, then we talk pricing if it's valuable" |

## India-Specific Notes
- Hindi/Hinglish dramatically increases response rate for Tier 2/3 city brokers
- Indian agents respect "founder" / "owner" titles — lean into being "the founder, personally reaching out"
- Mention specific Indian places (Andheri, Whitefield, Kalyani Nagar) — pattern-match recognition
- Avoid sending Friday afternoons (mosque prayers, weekend mindset) and Monday mornings (chaotic)
- Best times: Tue/Wed/Thu 10am-12pm and 4-6pm IST

## Connected Days / Dependencies
- **Blocks:** Day 10 (onboarding calls — only happens if calls booked)
- **Depends on:** Day 8 (prospect list), `pre-launch-prep/03` (email deliverability), `pre-launch-prep/06` (LinkedIn credibility)

## Success Metric
- 30+ messages sent
- 10%+ reply rate (vs typical 1-3% for non-warmed cold)
- 8-12 calls booked
- At least 1 message gets a reply within 1 hour (signals strong hook)
