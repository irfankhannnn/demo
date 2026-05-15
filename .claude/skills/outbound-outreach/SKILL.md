---
name: outbound-outreach
description: >
  Create personalized outbound email sequences and LinkedIn messages for sales
  development. Generates multi-step campaigns with dynamic personalization,
  A/B variants, and objection handling. Use for outreach campaign creation.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Outbound Outreach Campaign

Create a personalized outbound campaign for Cloudberry. Target: $ARGUMENTS

## Outreach Philosophy
1. **Relevant** — Reference something specific about their business
2. **Valuable** — Offer insight or value, not just a pitch
3. **Human** — Sound like a person, not a template

## Email Sequence Frameworks

### Value-First Sequence (5 emails, 14 days)
- **Day 0:** The Insight — Specific observation + value prop
- **Day 3:** Social Proof — Similar company case study
- **Day 7:** The Question — Engaging diagnostic question
- **Day 10:** Breakup Warning — "Should I close your file?"
- **Day 14:** Value Drop — Free resource, no reply needed

### Trigger-Based Sequence (for hot leads)
Triggers: new project launch, CRM job posting, competitor contract ending, pricing page visit
- **Day 0:** Congratulate + connect trigger to Cloudberry value

## LinkedIn Templates
- **Connection Request** (300 char): Industry peer, specific observation
- **Follow-Up After Connect:** Genuine question about their process
- **Engagement Strategy:** Like 2-3 posts → comment 1 → share 1 → THEN connect

## Personalization Data Points
Use: company name, city, active projects, job postings, current CRM, recent news, mutual connections, pain points from Trend Hunter data

## Objection Handling Library
Pre-built responses for: "Already have CRM", "Too small", "Not the right time", "Send more info", "Too expensive", "Spreadsheets work fine"

## Deliverability Best Practices
- SPF/DKIM/DMARC configured
- Warm up new domains (20/day → +10/day)
- Bounce rate <3%, complaint rate <0.1%
- Max 50-75 new contacts/day/account
- Send during business hours in recipient timezone

## Performance Targets

| Metric | Target |
|--------|--------|
| Open Rate | >50% |
| Reply Rate | >8% |
| Positive Reply | >3% |
| Meeting Booked | >2% |

Save to `marketing-and-sales/outreach/[campaign-name]/`
