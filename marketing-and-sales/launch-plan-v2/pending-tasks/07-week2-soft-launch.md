# 07 — Week 2: Soft Launch (Day 8–14)

---

## SOFT-01: Day 8 — Source 30-40 Mumbai Beta Prospects
**Priority:** Critical — Day 9 invites cannot go without this list

- Run Day-08 AI prompt (from `week-2-soft-launch/day-08-source-mumbai-prospects.md`) using Firecrawl + SerpAPI
- Output: `launch-implement/week-2/day-08-mumbai-prospects.csv` (30-40 rows) + `day-08-cohort-plan.md`
- Founder spot-checks 5 random rows (call 1, WhatsApp 1, look up 3 on Google)
- Move CSV to Instantly (email) + AiSensy (WhatsApp) + manual WhatsApp

**References:** `team-work/MADHU-tasks.md` (lead-enrichment task) · `week-2-soft-launch/day-08-source-mumbai-prospects.md`

---

## SOFT-02: Day 9 — Send Beta Invites (Email + WhatsApp + LinkedIn)
**Priority:** Critical — First real customer acquisition

- Run Day-09 AI prompt → 5 invite templates at `launch-implement/week-2/day-09-templates.md`
- Personalise each of 30-40 invites (<2 min per invite, fill name/agency/locality/hook)
- Send manually via each tester's best channel:
  - WhatsApp-active: WhatsApp text + 60-sec voice note (record once, send to all WA prospects)
  - LinkedIn-active: LinkedIn DM
  - Email-only: send via Instantly or Gmail (warm mailbox from ACCT-11)
- Daily cap: 15 WhatsApp / 10 LinkedIn DM / 20 email
- Track every send in `day-09-invite-log.csv`
- Reply within 60 min during business hours; book Cal.com slots for Day 10

**References:** `week-2-soft-launch/day-09-craft-send-invites.md` · `coding-agent-brief/prompts/PR-L-signup-brevo.md` (UTM params are captured on signup)

---

## SOFT-03: Day 10-11 — Beta Onboarding Calls (8-12 calls)
**Priority:** Critical — Highest-fidelity feedback channel

- Run 15-30 min onboarding calls with each confirmed tester via Cal.com + Zoom/Meet
- Walk tester through: signup → first buyer → first property → first lead
- Record each call (with tester consent)
- Write call notes per tester: `launch-implement/week-2/day-10-call-notes/{tester-slug}.md`
- Aggregate friction: `day-10-friction-aggregate.md`
- Issue trial extensions or AI Employee comp for top 3 testers if needed

**References:** `week-2-soft-launch/day-10-onboarding-calls.md`

---

## SOFT-04: Day 11 — Categorize Feedback + Plan Critical Fixes
**Priority:** Critical — Produces Day 12 fix queue

- Run Day-11 AI prompt on all call notes + Crisp tickets + PostHog drop-off events
- Output: `day-11-feedback-backlog.md` (P0/P1/P2 patterns + ICE) + `day-11-tester-followups.md` + `day-11-cohort-health.md`
- Founder reviews: lock Day-12 fix queue at 3-5 P0 items

**References:** `week-2-soft-launch/day-11-categorize-feedback.md`

---

## SOFT-05: Day 12 — Ship Critical Fixes
**Priority:** Critical

- Feed Day-12 fix queue (P0 items from SOFT-04) to coding agent
- Agent creates fix PRs per `week-2-soft-launch/day-12-ship-critical-fixes.md`
- Founder smoke tests each fix; deploy

**References:** `week-2-soft-launch/day-12-ship-critical-fixes.md`

---

## SOFT-06: Day 13 — Beta Check-in Drip
**Priority:** High — Re-activation + testimonial scaffolding

- Run Day-13 AI prompt with PostHog usage data (records added per tester) + Day-9 channel preferences
- Output: per-tester check-in messages + 30-sec voice script + CSV tracker
- Send manually via each tester's preferred channel
- Send re-engagement DM to inactive testers (no PostHog events in 48h): "noticed you haven't logged in — 10-min screen share?"
- Confirm ≥4 testers say "yes" to testimonial Day 14

**References:** `week-2-soft-launch/day-13-checkin-drip.md`

---

## SOFT-07: Day 14 — Collect 5+ Testimonials
**Priority:** Critical — Social proof required before Day 17 cold outreach

- Schedule 30-min recording calls with testers who confirmed "yes" (Day 13)
- Send consent form + 5 prep questions ahead
- Record via Zoom/Meet/Loom; extract 60-sec clip + 2-3 min long-form per tester
- Capture: name, role/agency, locality, headshot, quote, signed consent (DPDP-compliant)
- Store at `launch-implement/week-2/testimonials/{tester-slug}/`: video.mp4, photo.jpg, quote.txt, consent.pdf
- Update `day-14-testimonials-index.md` master list
- Queue LP placeholder swap for Day 15

**References:** `week-2-soft-launch/day-14-collect-testimonials.md`
