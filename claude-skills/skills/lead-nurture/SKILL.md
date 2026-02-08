---
name: lead-nurture
description: >
  Design automated CRM nurture sequences that move leads from captured to qualified.
  Creates multi-channel follow-up workflows, objection response templates, and
  qualification frameworks. Use for nurture campaign design and lead qualification.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Grep
---

# Lead Nurture Campaign

Design an automated nurture sequence for Cloudberry leads. Target: $ARGUMENTS

## Sequence Architecture by Lead Grade

### Grade A (80-100) — Fast-Track (3 days, 5 touches)
- Touch 1 (0-5 min): Email + SMS — demo scheduling
- Touch 2 (Hour 4): Email — qualifying question
- Touch 3 (Day 1): LinkedIn message
- Touch 4 (Day 2): Email — case study from their vertical
- Touch 5 (Day 3): Email + phone call — personalized demo offer

### Grade B (60-79) — Standard Nurture (14 days, 7 touches)
Day 0: Welcome + value prop → Day 2: Case study → Day 4: Educational content
→ Day 7: Pain point email → Day 9: Social proof → Day 11: Feature spotlight
→ Day 14: Soft CTA

### Grade C (40-59) — Education Nurture (30 days, 6 touches)
Day 0: Welcome → Day 5: Industry insight → Day 10: Problem awareness
→ Day 15: Solution comparison → Day 20: Success story → Day 30: Direct CTA

### Grade D (20-39) — Long-term Drip (90 days, 8 touches)
Monthly educational content + quarterly re-engagement offers

## Auto-Response Templates
Pre-built for: pricing questions, WhatsApp integration, free trial, data migration, RERA compliance, Dubai market support

## Objection Response Flows
Structured flows for: "Need to think about it", "Locked into competitor contract", "Not enough budget", "Need team buy-in"

## Qualification Framework (BANT+)
- **Budget:** Can afford? Who controls it?
- **Authority:** Decision maker? Who else involved?
- **Need:** Pain points match? Current solution?
- **Timeline:** When needed? Urgency drivers?
- **+Fit:** Industry/size/geo/tech maturity match?

**Statuses:** MQL → SQL → SAL → Opportunity

## Channel Guidelines
- **Email:** Max 3 sentences first email, 1 CTA, business hours
- **SMS:** 160 chars, 10am-7pm IST, DND compliance
- **WhatsApp:** 24h window, approved templates, rich media
- **LinkedIn:** Max 1/week, engage first, professional tone

## Exit Criteria
- **Graduate:** Lead score increases to next grade → move to appropriate sequence
- **Disqualify:** Unsubscribe, bounce, explicit "not interested", wrong ICP
- **Convert:** Demo booked, trial started, purchase

Save to `marketing-and-sales/sequences/[campaign-name]/`
