# Email Warm-up Plan — 21 Days

**Mailbox:** founder@realestateflow.in  
**Tool:** Instantly.ai warm-up pool  
**Target steady state:** 50 emails/day by Day 21  
**Goal:** ≥85% inbox placement before Day 17 cold outreach  
**Last updated:** 2026-06-11

---

## Overview

Fresh domains sent to cold lists land in spam. This 21-day ramp builds sender reputation through Instantly's warm-up network (engaged seed inboxes including Indian providers) before the first real cold batch on **Day 17** (Week 3).

---

## Daily Ramp Schedule

| Day | Target volume | Max/hour | Reply-rate target | Action if >2% bounces |
|-----|---------------|----------|-------------------|----------------------|
| 1–3 | 5/day | 2 | >30% (warm-up pool) | Pause 24h; check SPF/DKIM |
| 4–6 | 10/day | 3 | >30% | Pause 24h; review content |
| 7–10 | 15/day | 4 | >25% | Pause 48h; MXToolbox audit |
| 11–14 | 25/day | 5 | >20% | Pause 48h; Glockapps test at Day 14 |
| 15–17 | 40/day | 6 | >15% | Pause 72h if blacklist hit |
| 18–21 | 50/day | 8 | >10% | Steady state — ready for cold |

---

## Instantly Configuration

1. Connect `founder@realestateflow.in` via Google OAuth
2. Settings → Warmup → **Enable**
3. Target inbox volume: **50/day** (final)
4. Daily ramp increment: **5/day** (verify matches table above)
5. Warm-up only — no cold campaigns until Day 17

---

## Daily Monitoring Checklist

- [ ] Emails sent vs target volume
- [ ] Bounce rate (<2%)
- [ ] Spam complaints (0%)
- [ ] Warm-up pool reply rate
- [ ] Blacklist check (MXToolbox Blacklist Check)
- [ ] DMARC aggregate report review (weekly)

---

## Milestone Tests

| Milestone | Day | Test | Pass criteria |
|-----------|-----|------|---------------|
| DNS live | T-21 | MXToolbox SPF/DKIM/DMARC | All green |
| Mail-tester | T-18 | Send from founder@ to mail-tester.com | Score ≥ 9/10 |
| Glockapps | T-7 (Day 14) | Inbox placement test ($79) | ≥85% inbox, 0% spam |
| First cold send | Day 17 | 20-email batch to Mumbai prospects | <5% bounce, >50% open |

---

## Content Guidelines During Warm-up

- Use real founder voice — no spam triggers ("FREE", "ACT NOW", all caps)
- Include physical address in signature (Mumbai office)
- One plain-text link maximum per email
- No attachments in warm-up phase
- Unsubscribe line on any non-warm-up send (Instantly template)

---

## Escalation Playbook

### If Glockapps <70% at Day 14
1. Pause Instantly warm-up
2. Switch to lemwarm.com ($29/mo) as backup
3. Extend warm-up 2 weeks
4. Push first cold send from Day 17 → Day 30
5. Consider secondary domain `realestateflow.email` for cold only

### If blacklisted
1. Pause all outbound for 7 days
2. Identify source (content vs DNS)
3. Request delisting from blacklist operator
4. Resume at 50% volume for 7 days

### If DMARC quarantine blocks transactional
1. Temporarily set `p=none`
2. Fix DKIM alignment
3. Re-escalate to `p=quarantine` after 7 clean days

---

## Brevo Transactional (parallel track)

Brevo handles transactional email (welcome drip, invoices, grievance acks) — separate from Instantly warm-up.

- Verify domain in Brevo before Day 6 welcome drip
- API key whitelisted for `ap-south-1` outbound
- Do not mix cold outreach through Brevo (reputation isolation)

---

## Success Criteria

By **T-7** (Day 14 of warm-up):
- Mail-tester ≥ 9/10
- Glockapps ≥ 85% inbox
- All 3 DKIM selectors verified
- Zero blacklist entries
- Founder signature deployed in Workspace
