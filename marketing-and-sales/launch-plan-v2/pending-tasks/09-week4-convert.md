# 09 — Week 4: Optimize & Convert (Day 22–30)

---

## CONV-01: Day 22 — CRO Fixes Based on Day-21 Drop-Points
**Priority:** High — Every conversion lift compounds

- Run Day-22 AI Prompt #1 (triage) on Day-21 growth brief → `day-22-drop-point-triage.md` with top-5 ranked by ICE
- Founder reviews triage: does each tie to a real PostHog event + session replay?
- Run Day-22 AI Prompt #2 (per fix) → feed to coding agent as PR
- Smoke test each fix; verify PostHog event fires post-fix; run Playwright suite
- Optional: set up A/B variant for top drop-point via PostHog feature flags

**References:** `week-4-optimize-convert/day-22-cro-fixes.md` · `coding-agent-brief/prompts/PR-J-paywall-trial.md` (PaywallModal CRO candidates)

---

## CONV-02: Day 23-24 — Follow-up Non-replies + Reactivate Stalled Trials
**Priority:** High

- Run Day-23 AI prompt → Touch-2 email + WhatsApp to Day-18 non-replies who opened but didn't reply
- Run Day-24 AI prompt → reactivation message to trial users with zero PostHog events in past 5 days
- For inactive: offer 10-min screen share (founder direct); reply within 2h

**References:** `week-4-optimize-convert/day-23-followup-non-replies.md` · `week-4-optimize-convert/day-24-reactivation-stalled-trials.md`

---

## CONV-03: Day 25 — Case Study + SEO Blog + Content Calendar
**Priority:** High — Long-term organic acquisition

- Re-confirm testimonial consent with chosen beta tester (text: "still OK to use in case study?")
- Run Day-25 AI Prompt #1 → case study draft (`day-25-case-study-{slug}.md`)
- Run Day-25 AI Prompt #2 → SEO blog draft ("Best CRM for Mumbai Brokers 2026")
- Run Day-25 AI Prompt #3 → 12-week content calendar
- Founder light-edit all 3 pieces; verify tester quotes are accurate
- Build case study + blog as LP pages: `creative/landing-pages/case-studies/` + `creative/landing-pages/blog/`
- Deploy via Netlify; submit both URLs to GSC for indexing
- Share on LinkedIn Post 7 + Twitter thread

**References:** `week-4-optimize-convert/day-25-case-study-seo-foundation.md`

---

## CONV-04: Day 26 — Trial-to-Paid Follow-up
**Priority:** Critical — Drives ≥3 paying customers (PMF gate)

- Identify active-but-non-paid trial cohort (PostHog + DDB filter)
- Run Day-26 AI prompt → personalised conversion messages per user
- Create Razorpay coupon `LAUNCH50` (50% off, max 3 uses, expiry Day 30)
- Send manually via WhatsApp (preferred) or email
- Walk users through checkout if they need help
- Book 30-min "thank you + Q&A" calls with first 3 paid customers (Day 28-30)
- Log first paid customer in `00-DECISIONS-LOG.md`

**References:** `week-4-optimize-convert/day-26-trial-to-paid.md`

---

## CONV-05: Day 27 — Pitch Refinement
**Priority:** Medium — Improves Week-5+ cold outreach

- Run Day-27 AI prompt on: open/reply/conversion rates from Days 17-26, call notes, testimonials
- Output: `day-27-pitch-v2.md` with updated wedge sentence + 3 new email subject line variants
- Update cold sequence in Instantly with new subjects for Day-28+ sends

**References:** `week-4-optimize-convert/day-27-pitch-refinement.md`

---

## CONV-06: Day 28 — NPS Email Blast to M1 Cohort
**Priority:** High — Baseline NPS measurement (PR-K built the in-product modal; this is the email blast)

- Run Day-28 AI Prompt #2 → NPS email content (`day-28-nps-email.md`)
- Create Brevo email template from content; send to entire M1 cohort list at 11am IST
- Monitor responses: NPS score responses in PostHog `nps_response` event + DDB NPSResponses table
- Personally WhatsApp/call any Detractor (score 0-6) within 48h: "What would have made this a 9?"
- Tag Promoters (score 9-10) in Brevo for Day-30 referral ask

**References:** `week-4-optimize-convert/day-28-nps-feedback-loops.md`

---

## CONV-07: Day 29 — Month-1 Revenue + Retention Audit
**Priority:** Critical — Close M1 books; input for M2 strategy

- Pull from Razorpay dashboard: all subscriptions, payments, invoices, refunds (Day 1-30)
- Pull from DDB Subscriptions: all M1 rows; bank statement: settlements credited
- Run Day-29 AI prompt → `day-29-month-1-audit.md` (revenue snapshot, retention snapshot, CAC proxy, top-5 wins, top-5 misses, M2 ICE recommendations)
- Founder signs off the report
- Log: "M1 results: [MRR], [N] paid customers, NPS [score], M2 strategy: [summary]" in `00-DECISIONS-LOG.md`

**References:** `week-4-optimize-convert/day-29-revenue-retention-audit.md`

---

## CONV-08: Day 30 — Month-2 Strategy + PMF Decision
**Priority:** Critical — Go/No-Go on paid spend

- Run Day-30 AI prompt → M2 strategy brief using Day-29 audit
- PMF gate check (from Day-21 re-evaluated with 9 more days of data):
  - If met: activate M2 plan (`month-2-plus/` folder) — start paid ads readiness + programmatic SEO
  - If not met: hold M2 paid spend; run 14-day extension of Mumbai beta cycle
- Write M2 kickoff plan or extension plan in `launch-implement/week-4/day-30-m2-strategy.md`
- Log decision in `00-DECISIONS-LOG.md`

**References:** `week-4-optimize-convert/day-30-month-2-strategy.md` · `month-2-plus/M2-paid-ads-readiness.md` · `month-2-plus/M2-content-engine.md` · `00-PLAN-OVERVIEW.md §4`
