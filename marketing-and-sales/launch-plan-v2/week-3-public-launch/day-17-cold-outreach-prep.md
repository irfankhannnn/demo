# Day 17 — Cold Outreach Prep (50 fresh prospects + 3-channel sequences)

> **Type:** 🤖 AUTO
> **Phase:** Week 3
> **Skill(s):** `cold-email` + `whatsapp-outreach` + `outbound-outreach` + `lead-enrichment` + `messaging-optimizer`
> **Estimated time:** 0.5h founder + 6h AI

## Objective
Source 50 fresh Mumbai broker prospects (different from Day-8 cohort), draft 3-channel outbound sequences (email 4-touch, WhatsApp 3-touch, LinkedIn 3-touch) leveraging Day-14 testimonials as social proof, and queue Day 18-21 sends with daily caps.

## Why This Matters for RealEstateFlow
Beta cohort is small + warm. Day 17+ cold outreach is the M1 lever for non-beta paying customers. Quality of sequence + personalisation + social proof determines reply rate (target 5-8%).

## User Story
As founder ramping outbound, I want a 50-prospect list + 3-channel sequence drafts ready by Day 17 EOD, so Day 18-21 sends 50 emails / 30 WhatsApps / 20 LinkedIn DMs with proven copy.

## Acceptance Criteria
- [ ] Fresh prospect list at `marketing-and-sales/launch-implement/week-3/day-17-cold-prospects.csv` (50 rows, Mumbai-focused, no overlap with Day-8 cohort)
- [ ] 3-channel sequence draft at `marketing-and-sales/launch-implement/week-3/day-17-sequences.md`:
  - Email: 4 touches (Day 18, Day 21, Day 24, Day 28)
  - WhatsApp: 3 touches (Day 18, Day 22, Day 26)
  - LinkedIn: 3 touches (Day 18, Day 23, Day 27)
- [ ] Each sequence carries: 1 testimonial quote (Day 14), wedge, no-card 14-day offer, demo Loom, cal.com booking, P.S. with specific Mumbai locality reference
- [ ] Sequences leverage `messaging-optimizer` learnings from Day 9 (which subject performed best, which CTA, channel ROI)
- [ ] All Day-18 send queues prepared in Instantly (email) + AiSensy (WhatsApp templates pre-approved) + LinkedIn DM list
- [ ] Daily send caps per channel documented + adhered: email 50/day, WhatsApp 30/day, LinkedIn 20/day (founder-personal account caps)
- [ ] CSV tracker `day-17-cold-tracker.csv` initialized for Day 18-30 logging
- [ ] Subject-line A/B variants prepared (3 per email touch)
- [ ] Reply-handling SOP at `day-17-reply-handling-sop.md` for founder + future contractor

## Manual Steps (🧍 — small)

1. Approve target list (founder spot-checks 5 prospects).
2. After AI run, manual review of sequences (read aloud — does it sound like founder? not corporate?).
3. Pre-approve WhatsApp templates in AiSensy + Meta Business (24-48h approval — start Day 16 PM if needed).
4. Tick ACs.

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/day-08-mumbai-prospects.csv` (Day-8 list — exclude these from Day-17 list)
- `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md` (5 testimonials + quotes + locality)
- `marketing-and-sales/launch-implement/week-2/day-13-checkin-log.csv` (channel-best-fit signals)
- `marketing-and-sales/launch-implement/week-2/day-09-templates.md` (Day-9 sequence — measure what's working)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/research/icp-report-mumbai-launch.md`

## Part 1 — Source 50 fresh Mumbai broker prospects

Same scoring methodology as Day 8 (`day-08-source-mumbai-prospects.md`). Different filters this round:
- Different localities mix: Goregaon W (8), Mulund W (6), Kandivali (6), Vikhroli (5), Chembur (5), Ghatkopar (5), Kurla W (4), Bhandup (4), Malad W (4), Versova (3) — broadens beyond Day-8
- Exclude every phone present in Day-8 CSV (dedup)
- Score 5+ minimum on ICP fit
- Include 5-10 medium-sized agencies (4-9 agents) for upmarket signal

Output: `marketing-and-sales/launch-implement/week-3/day-17-cold-prospects.csv` with same columns as Day-8.

## Part 2 — 3-channel sequence drafts

Use Day-14 testimonials as proof. Pull 1 quote per sequence touch from `day-14-testimonials-index.md`. Cycle quotes so different prospects see different testimonials.

### Email sequence (4 touches over 11 days)

**Touch 1 (Day 18) — "Initial outreach with social proof"**
- Subject A: "{{name}}, can RealEstateFlow give your team back 10h/week?"
- Subject B: "{{name}} — quick note on your {{locality}} listings"
- Subject C: "Saw your {{hook}} — built a CRM for Mumbai brokers"
- Body: 250-350 words. Open with hook. State wedge. Cite 1 testimonial verbatim. Offer 14-day no-card. CTA: book Cal.com or reply.

**Touch 2 (Day 21) — "Different angle + Loom"**
- Subject: "Re: 90-second demo for {{agency_name}}"
- Body: 100 words. "Forgot to share the Loom in last note. Here it is. Click play, see if it's a fit. Reply with thumbs up/down."

**Touch 3 (Day 24) — "Specific Mumbai use-case"**
- Subject: "How {{neighborhood_broker_testimonial}} used RealEstateFlow"
- Body: 150 words. Story + outcome. CTA: "Want a similar setup?"

**Touch 4 (Day 28) — "Honest break-up"**
- Subject: "Last note from {{founder_first_name}}"
- Body: 80 words. "I won't pester you again. If you're interested in the future, feel free to reply."

### WhatsApp sequence (3 touches over 9 days)

**Touch 1 (Day 18, 11am IST)** — text + voice (60s pre-recorded variant from Day 9, refined with testimonial quote)
**Touch 2 (Day 22, 2pm IST)** — text-only + Loom URL
**Touch 3 (Day 26, 11am IST)** — text-only "last check-in"

### LinkedIn sequence (3 touches over 10 days)

**Touch 1 (Day 18)** — Connection request with personalised note (≤300 chars)
**Touch 2 (Day 23)** — Once accepted: DM with Loom + cal.com (≤500 chars)
**Touch 3 (Day 27)** — Final DM with testimonial + offer

## Part 3 — Channel routing logic

For each Day-17 prospect, score channel preferences (same as Day 9):
- WhatsApp Business + ICP 7+ → WhatsApp primary, email backup
- LinkedIn-active (recent posts) → LinkedIn primary, email backup
- Email-only → email primary, LinkedIn fallback

Output: `marketing-and-sales/launch-implement/week-3/day-17-routing.md` mapping prospect-slug → primary + backup channel.

## Part 4 — Reply-handling SOP

Save `day-17-reply-handling-sop.md`:
- Reply within 60 min during business hours
- Categorize replies: interested → cal.com book / not-now → soft response + queue M2 / unsubscribe → tag + remove from sequence
- Bounce handling: remove from list, log Brevo bounce
- Negative reply: thank politely + ask 1 feedback question
- Auto-pause sequence if reply received (Instantly does this; verify config)

## Part 5 — Subject A/B prep

Per Touch-1 email, output 3 subject variants + 50/30/20 split for measurement.

Stop. Do not send (Day 18 founder runs).
```

## Inputs
- Day-8 cohort (exclude)
- Day-14 testimonials
- Day-9 sequence performance
- Wedge

## Outputs
- `day-17-cold-prospects.csv` (50 rows)
- `day-17-sequences.md` (3-channel)
- `day-17-routing.md`
- `day-17-cold-tracker.csv`
- `day-17-reply-handling-sop.md`

## Success Criterion
50 fresh prospects + 3-channel sequences ready by Day 17 EOD; Day 18 sends queued.

## Fallback / Plan B
If WhatsApp template approval delayed by AiSensy/Meta, push WhatsApp sends to Day 19-20. Email + LinkedIn still go Day 18 on time.

## Risks
| Risk | Mitigation |
|---|---|
| AiSensy template rejected | Use generic-sounding template; resubmit if rejected |
| Founder-mailbox spam-flag from 50/day | Use Instantly Growth + warm mailbox; 50 is well within capacity |
| LinkedIn account flag from too many connection requests | 20/day cap; only personalised invites |
| Reply rate <3% | Day-18 metrics review; switch testimonial cycling Day 19 |
| Duplicate prospect from Day-8 | Phone-dedup mandatory in Step 1 |

## India / Mumbai-Specific Notes
- WhatsApp templates may need Hindi version for AiSensy approval; ship English-only initially
- Indian sender reputation: send 11am-3pm IST + Tue-Thu = highest open rates
- Mumbai broker WhatsApp culture: voice notes get 2× engagement vs text

## Dependencies
- **Blocks:** Day 18-21 sends, Day 23 follow-ups, Day 26 trial-to-paid follow-ups
- **Depends on:** Day-14 testimonials, Day-9 templates baseline, P3 mailbox warmed

## Connected Skills
- `cold-email` — sequence
- `whatsapp-outreach` — voice + text
- `outbound-outreach` — multi-channel orchestration
- `lead-enrichment` — fresh list
- `messaging-optimizer` — learn from Day-9
