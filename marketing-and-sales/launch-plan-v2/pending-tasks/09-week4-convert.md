# 09 — Week 4: Optimize & Convert (Day 22–30)

> **Scope:** Conversion optimization, trial→paid push, NPS, and the Month-1 close. All **pending** (future), human-run.
> **Note on owners:** Not covered by `team-work/` (Pre-Launch + Week 1 only). Owned by **Founder + Madhu**, sequenced in `launch-implement/week-4-optimize-convert/`. Code fixes go to a coding agent.

---

## CONV-01: Day 22 — CRO Fixes from Day-21 Drop-points
**Why:** Every conversion lift compounds across all downstream paid spend.
- Triage Day-21 drop-points → top-5 by ICE (each tied to a real PostHog event/replay) → feed per-fix prompt to a coding agent; verify event fires post-fix; optional PostHog A/B flag.

## CONV-02: Day 23–24 — Follow-up Non-replies + Reactivate Stalled Trials
**Why:** Recovers warm-but-quiet prospects and trials that opened but stalled.
- Touch-2 to Day-18 non-replies who opened; reactivation message to trials with zero events in 5 days; offer 10-min screen share; reply < 2h.

## CONV-03: Day 25 — Case Study + SEO Blog + Content Calendar
**Why:** Long-term organic acquisition engine seeded from the first real customer story.
- Re-confirm testimonial consent; draft case study + SEO blog ("Best CRM for Mumbai Brokers 2026") + 12-week calendar; founder light-edits; build as LP pages; deploy + submit to GSC; share on LinkedIn.

## CONV-04: Day 26 — Trial-to-Paid Follow-up
**Why:** Directly drives the ≥ 3 paying customers needed for the PMF gate.
- Identify active-non-paid cohort (PostHog + DDB); personalised conversion messages; create Razorpay coupon `LAUNCH50` (50% off, max 3 uses, expiry Day 30); walk users through checkout; book thank-you calls; log first paid customer.

## CONV-05: Day 27 — Pitch Refinement
**Why:** Improves Week-5+ cold outreach using real open/reply/conversion data.
- Run the Day-27 prompt → `day-27-pitch-v2.md` (updated wedge + 3 new subject lines); update the Instantly sequence.

## CONV-06: Day 28 — NPS Email Blast to M1 Cohort
**Why:** Baseline NPS measurement; the in-product modal already exists (PR-K) — this is the email push.
- Build the Brevo NPS template; send to the M1 list 11am IST; monitor `nps_response` (PostHog + DDB `NPSResponses`); WhatsApp/call detractors < 48h; tag promoters for the Day-30 referral ask.

## CONV-07: Day 29 — Month-1 Revenue + Retention Audit
**Why:** Closes the M1 books and feeds the Month-2 strategy decision.
- Pull Razorpay + DDB + bank settlements; run the Day-29 prompt → revenue/retention snapshot + CAC proxy + top-5 wins/misses + M2 ICE recs; founder signs off; log MRR/paid/NPS in `00-DECISIONS-LOG.md`.

## CONV-08: Day 30 — Month-2 Strategy + PMF Decision
**Why:** Go/No-Go on paid spend — the gate between launch and scale.
- Run the Day-30 prompt for the M2 brief; re-check the 4 PMF gates with 9 more days of data; if met, activate `month-2-plus/` (paid ads + programmatic SEO); else run a 14-day beta extension; log the decision.
