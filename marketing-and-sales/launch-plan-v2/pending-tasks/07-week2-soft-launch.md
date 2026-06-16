# 07 — Week 2: Soft Launch (Day 8–14)

> **Scope:** Post-launch beta cycle — source prospects, invite, onboard, collect testimonials. All **pending** (future) and human-run.
> **Note on owners:** `team-work/` only covers Pre-Launch + Week 1, so there are **no `FND/MAD/ZEE` tasks for Week 2–4**. These are owned by **Founder + Madhu** and sequenced in `launch-implement/week-2-soft-launch/`. Code fixes that fall out of feedback go to a coding agent (same pattern as `ZEE-011`).

---

## SOFT-01: Day 8 — Source 30–40 Mumbai Beta Prospects
**Why:** The Day-9 invites can't go out without a vetted list; quality of this list caps the whole beta cohort.
- Run the Day-08 prompt (Firecrawl + SerpAPI) → `day-08-mumbai-prospects.csv` (30–40 rows) + cohort plan. Founder spot-checks 5 rows. Load into Instantly + AiSensy + manual WhatsApp.

## SOFT-02: Day 9 — Send Beta Invites (Email + WhatsApp + LinkedIn)
**Why:** First real customer acquisition; personalised multi-channel invites drive the beta sign-ups.
- Personalise each of 30–40 invites (< 2 min each). Caps: 15 WhatsApp / 10 LinkedIn / 20 email. Track in `day-09-invite-log.csv`; reply < 60 min; book Cal.com slots.

## SOFT-03: Day 10–11 — Beta Onboarding Calls (8–12)
**Why:** Highest-fidelity feedback channel — watching real brokers use the product reveals the true friction.
- 15–30 min calls via Cal.com; walk signup → first buyer → property → lead; record (with consent); write per-tester notes; aggregate friction.

## SOFT-04: Day 11 — Categorise Feedback + Plan Critical Fixes
**Why:** Turns scattered call notes + Crisp tickets + drop-off events into a ranked Day-12 fix queue.
- Run the Day-11 prompt → `day-11-feedback-backlog.md` (P0/P1/P2 + ICE); founder locks 3–5 P0 items.

## SOFT-05: Day 12 — Ship Critical Fixes
**Why:** Closes the highest-impact beta blockers before the public-launch traffic of Week 3.
- Feed the P0 queue to a coding agent → fix PRs → founder smoke-tests → deploy.

## SOFT-06: Day 13 — Beta Check-in Drip
**Why:** Re-activates quiet testers and scaffolds the Day-14 testimonial asks.
- Run the Day-13 prompt with PostHog usage → per-tester check-ins; re-engage testers idle > 48h; confirm ≥ 4 testimonial "yes".

## SOFT-07: Day 14 — Collect 5+ Testimonials
**Why:** Social proof is required before Day-17 cold outreach — real quotes/photos replace the LP placeholders.
- Record 30-min calls (consent + 5 prep questions); extract 60-sec clip + long-form; store name/role/locality/headshot/quote/signed DPDP consent; update the testimonials index.
