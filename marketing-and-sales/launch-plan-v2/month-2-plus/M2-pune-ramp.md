# M2 — Pune Ramp (Research + Localisation)

> **Type:** 🤖 + 🧍
> **Phase:** Month 2 (Day 31-60), launching M3 (Day 61+)
> **Skill(s):** `icp-research` + `customer-research` + `landing-page` + `copywriting` + `social-content`
> **Pre-requisites:** Mumbai PMF gate PASS

## Objective
Replicate the M1 Mumbai playbook in Pune by Day 60 — localised wedge, 30 Pune broker prospects, 1 Pune-specific LP, founder's first 3 Pune broker conversations + first beta tester.

## Why Pune?
- Adjacent geography (3-hour drive from Mumbai) → travel manageable for founder demos
- Different but compatible market: smaller deals, more student-housing focus, different developer ecosystem
- Lower CAC compared to entering Delhi/Bangalore directly
- Validates that the playbook is repeatable, not Mumbai-only

## Plan

### M2 Week 1-2 — Pune research

- Run `icp-research` skill: Pune broker market sizing, top localities (Kothrud, Kalyani Nagar, Hinjewadi, Wakad, Baner, Aundh, Viman Nagar, Hadapsar)
- Customer research: 8-10 Pune broker conversations (founder personally; 1 trip Pune Day 35-40)
- Identify Pune-specific pain points + adapt wedge if needed
- Output: `marketing-and-sales/launch-implement/m2/pune-research.md`

### M2 Week 3 — Pune asset localisation

- Create `realestateflow.in/pune` LP variant (clone /agency-owners + adapt):
  - Hero: Pune-specific imagery + localities
  - Testimonial slot reserved for Pune beta tester (M3 Week 1)
  - Pune-specific FAQs (Pune RERA, Pune Khata conventions if different)
- Adapt outreach templates for Pune voice
- Adapt founder LinkedIn Post 9: "Why we're going to Pune next"

### M2 Week 4 — Pune outreach soft start

- Source 30 Pune broker prospects (`firecrawl-agent` + `serpapi-scraping`)
- Send 10 personalised invites (founder-personal mode like M1 Day-9)
- Aim: 2-3 Pune beta testers booked for M3 Week 1

### M3 Week 1+ — Pune public launch
- Replicate Mumbai Days 8-30 playbook with Pune cohort
- Founder: 1 Pune trip, 4-5 onboarding calls, repeat the loop

## Success metrics M2

| Metric | M2 Target |
|---|---|
| Pune research interviews | 8-10 |
| Pune /pune LP live | ✅ |
| Pune prospect list | 30 |
| Pune Day-30 invitees sent | 10 |
| Pune beta testers committed | 2-3 (for M3 Week 1) |

## Required AI prompts

```
Use `icp-research` + `customer-research` + `landing-page` skills. Read:
- M1 Mumbai wedge-v2 + persona docs + LP source
- (Founder's 8-10 Pune broker conversations — synthesise transcripts)

Produce:
1. Pune market sizing (broker count, agency density, locality breakdown)
2. Pune persona delta vs Mumbai (similarities/differences)
3. Pune wedge variant (≤300 words; what changes vs Mumbai)
4. /pune LP draft + Hero copy + testimonial slot
5. 10 Pune-localised outreach templates (email + WhatsApp + LinkedIn)
6. Pune launch Day-by-Day playbook (M3 Week 1-4)

Stop.
```

## Risks
| Risk | Mitigation |
|---|---|
| Pune doesn't replicate Mumbai conversion | Test small (10 invites) before scaling |
| Founder bandwidth split | M2 Pune is research + setup only; full launch M3 |
| Pune-Mumbai pricing mismatch | Same pricing across cities (no city-specific tiers M2) |
| Pune reqires Marathi-language UI | Add to backlog if 5+ Pune brokers ask; not M2 |

## Connected files
- M2 day-by-day implementation plan (built from this template post Day-30)
- Pune outreach assets land in `marketing-and-sales/outreach/pune-*`
