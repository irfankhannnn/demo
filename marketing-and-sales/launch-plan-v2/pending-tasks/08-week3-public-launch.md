# 08 — Week 3: Public Launch (Day 15–21)

---

## PUB-01: Day 15 — Replace LP Placeholders with Real Testimonials + Social Proof
**Priority:** Critical — LPs must have real proof before cold outreach traffic arrives

- Swap testimonial placeholder blocks in all LP HTML pages with real quotes + names + photos from Day-14 testimonials
- Replace "Mumbai-built · early-access launch" trust strip with real social proof
- Run `npm run build:lps` + `netlify deploy --prod` (redeploy LP)
- Verify placeholder search: `grep -r "\[TESTIMONIAL PENDING\]" dist/` → zero results

**References:** `week-3-public-launch/day-15-replace-placeholders.md` · `launch-implement/week-2/day-14-testimonials-index.md`

---

## PUB-02: Day 16 — Directory Submissions (30+ directories)
**Priority:** Medium — Backlinks + organic discovery; compounding M2-M6

- Run Day-16 AI prompt → `day-16-directories-target.md` (30+ ranked) + `day-16-brand-copy-bundle.md` + `day-16-directory-tracker.csv`
- Founder approves target list; AI handles directories with public submission forms
- Manually submit to 5-7 directories requiring auth: ProductHunt (register only — post on Day 23), G2, Capterra, TAAFT, Futurepedia, SoftwareSuggest, AlternativeTo
- Save all credentials to 1Password
- Capture ahrefs Webmaster Tools domain rating baseline (ahrefs.com/webmaster-tools, free)

**References:** `week-3-public-launch/day-16-directory-submissions.md`

---

## PUB-03: Day 17 — Cold Outreach Prep (50 fresh prospects + sequences)
**Priority:** Critical — First cold outreach wave

- Run Day-17 AI prompt: source 50 fresh Mumbai broker prospects + 3-channel sequences + routing + reply-handling SOP
- Founder spot-checks 5 prospects; manually reviews sequence copy (read aloud: does it sound like founder?)
- Pre-approve WhatsApp templates in AiSensy + Meta Business (24-48h approval — start Day 16 PM)
- Set up Day-18 sends in Instantly (email 50/day queue) + AiSensy (WhatsApp 30/day) + LinkedIn DM list (20/day)

**References:** `week-3-public-launch/day-17-cold-outreach-prep.md`

---

## PUB-04: Day 18-21 — Execute Cold Outreach (3 channels, daily)
**Priority:** Critical — Primary acquisition channel Days 18-21

- Day 18: Send Touch-1 across all 3 channels. Adhere to daily caps: 50 email / 30 WhatsApp / 20 LinkedIn
- Monitor replies every 2h during business hours; reply within 60 min
- Categorize replies: interested → book Cal.com / not-now → soft response + M2 queue / unsubscribe → remove from sequence
- Day 19: iterate based on reply rate — if <3%, A/B switch subject line for remaining batch
- Day 21: Send Touch-2 (Loom email) to non-replies from Day-18

**References:** `week-3-public-launch/day-18-execute-cold-day1.md` · `week-3-public-launch/day-19-cold-day2-iterate.md`

---

## PUB-05: Day 20 — Community Engagement
**Priority:** Medium — Organic top-of-funnel

- Publish LinkedIn Post 6 (testimonial video + short-form story) at 11am IST
- Engage with first 10 comments within 1h
- Leave 20 substantive comments on broker/SaaS/real-estate LinkedIn posts (no self-promo)
- Share Loom + 1 testimonial in 3 Mumbai broker WhatsApp groups
- Leave 5 value-first comments in r/IndiaInvestments, Indian SaaS Slack channels

**References:** `week-3-public-launch/day-20-community-engagement.md`

---

## PUB-06: Day 21 — Weekly Metrics Review + PMF Gate Check
**Priority:** Critical — Decision: proceed to M2 paid spend or iterate

- Run Day-21 AI prompt (growth brief) from PostHog + channel data
- Check PMF gate (all 4 must be met before M2 paid spend):
  - ≥3 paying customers
  - ≥40% trial-to-activation rate (`ai_employee_lead_handled` within 7d of signup)
  - ≥10% reply rate on cold outreach
  - ≥1 NPS promoter (score 9-10)
- Output: `launch-implement/week-3/day-21-weekly-growth-brief.md`
- If gate missed: hold paid spend; run another 14-day Mumbai beta cycle
- Log verdict in `00-DECISIONS-LOG.md`

**References:** `week-3-public-launch/day-21-metrics-review.md` · `00-PLAN-OVERVIEW.md §4`
