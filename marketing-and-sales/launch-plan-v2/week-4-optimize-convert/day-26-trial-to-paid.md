# Day 26 — Trial-to-Paid Follow-up Wave

> **Type:** 🤖 AUTO + 🤝
> **Phase:** Week 4
> **Skill(s):** `email-sequence` + `paywall-upgrade-cro` + `whatsapp-outreach`
> **Estimated time:** 3h founder + 2h AI
> **Script:** `../40-sales-and-conversion/closing-script.md` (the close and the discount guardrails) · `../40-sales-and-conversion/objections.md`

## Objective
Identify all active trials that have NOT yet converted (Day 21+ trial, still using product), send a personalised "convert before trial ends" message via email + WhatsApp + offer 1-mo half-price for first 3 to commit Day 26-30. Drive ≥3 trial-to-paid conversions.

## Why This Matters for RealEstateFlow
Trial expiry = make-or-break moment. Day 26 is 4 days before earliest trial expiry. A personal nudge + a small commitment-incentive lifts conversion 5-15%.

## User Story
As an active trial user 11+ days in, I want a personal Day-26 message from the founder asking what's holding me back + a small thank-you incentive to commit, so I can decide easily.

## Acceptance Criteria
- [ ] Active-but-non-paid trial cohort identified (PostHog + DDB Subscriptions filter)
- [ ] Personalised message per user at `marketing-and-sales/launch-implement/week-4/day-26-conversion-templates.md`
- [ ] Channel: WhatsApp (where available) + email backup
- [ ] First-3-to-commit incentive: 1 month at 50% off (₹499 instead of ₹999 for Solo, ₹999 instead of ₹1,999 for Team) — apply via Razorpay coupon
- [ ] Razorpay coupon `LAUNCH50` created (50% off, max-uses 3, expiry Day 30)
- [ ] Tracker `day-26-conversion-log.csv`: user, channel, sent_at, replied, converted_y_n, plan, coupon_used
- [ ] Conversion rate target ≥10% (3+ paying customers from this cohort)
- [ ] Founder schedules 30-min "thank you + Q&A" call with first 3 paid customers Day 28-30
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Run AI Prompt below** to identify cohort + draft templates.
2. **Create Razorpay coupon** `LAUNCH50` in dashboard (50%, max 3 uses, expiry Day 30).
3. **Manual review + send** messages.
4. **Monitor replies** + walk users through checkout if they need help.
5. **Celebrate first paid** customer (LinkedIn post, log in `00-DECISIONS-LOG.md`).
6. **Daily standup**.

## AI Prompt (🤖)

```
Read inputs:
- PostHog: filter users with `subscription_status` = 'trial' AND `trial_days_left` < 7 AND last_event_timestamp > now()-3*24h (active)
- DDB Subscriptions: trial_started_at, trial_days_left, plan_id, locality from user metadata
- All `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{slug}.md` (pain captured during onboarding for beta cohort)
- `marketing-and-sales/launch-implement/pre-launch/14-paywall/trial-emails.md`
- `marketing-and-sales/launch-implement/week-3/demos/*.md` (from cold-prospect demos that converted to trial)

## Step 1 — Cohort identification

Output `marketing-and-sales/launch-implement/week-4/day-26-conversion-cohort.csv`:
| user_email | trial_days_left | plan_likely | sessions_last_7d | records_added | locality | persona |

Group by:
- "High-engagement, expiring soon" (likely converters with right nudge)
- "Mid-engagement, stuck" (need a feature ask answered)
- "Low-engagement" (probably won't convert; minimal effort)

## Step 2 — Conversion message per user

For high-engagement:
- Email subject: "{{name}}, your trial ends in {{N}} days — quick decision?"
- Body (90 words): personalised reference to their usage ("you've added X buyers, Y properties; trial expires Friday") + offer ("Solo at ₹499 first month if you commit by Day 30 — coupon LAUNCH50") + low-pressure ask ("just reply yes/no/'tell me more'") + founder signature
- WhatsApp variant: shorter

For mid-engagement:
- "What's the one thing missing for you to commit?"
- Offer 30-min screen-share to address blocker
- Coupon offer if appropriate

For low-engagement:
- "Trial wrapping up — anything we should fix?"
- No coupon push; just feedback ask

## Step 3 — Razorpay coupon spec

Output `marketing-and-sales/launch-implement/week-4/day-26-coupon-spec.md`:
- Coupon code: `LAUNCH50`
- Discount: 50% off first month
- Max uses: 3 (first-come-first-served)
- Expiry: Day 30 (date)
- Plans: Solo monthly, Team monthly (not Team+ or AI Employee)
- One-per-customer flag: yes
- Visibility: only mentioned in Day-26 messages, not on public LP
- Implementation: Razorpay coupon creation steps + Razorpay UI screenshots reference

## Step 4 — Templates output

Save personalised messages per user at `marketing-and-sales/launch-implement/week-4/day-26-conversion-templates.md`. Each section:
- {{user_email}}
- Channel routing
- Email body
- WhatsApp body (if applicable)
- LinkedIn DM (if connected)

## Step 5 — Tracker

Save `marketing-and-sales/launch-implement/week-4/day-26-conversion-log.csv` template.

## Step 6 — Celebration plan

Save `marketing-and-sales/launch-implement/week-4/day-26-first-paid-celebration.md`:
- LinkedIn Post 8 draft (founder publishes upon first paid customer)
- WhatsApp broadcast to broker friends sharing the milestone
- Cal.com slot reserved for "thank you + Q&A" call with first paid customer

Stop. Do not auto-send.
```

## Inputs
- PostHog active-trials cohort
- DDB Subscriptions
- Day-10 call notes
- Trial-email baseline

## Outputs
- `day-26-conversion-cohort.csv`
- `day-26-conversion-templates.md`
- `day-26-coupon-spec.md`
- `day-26-conversion-log.csv`
- `day-26-first-paid-celebration.md`
- Razorpay coupon `LAUNCH50` created

## Success Criterion
≥10% conversion (3+ paid customers) Days 26-30; first paid celebration LinkedIn post live.

## Fallback / Plan B
If conversion <5% by Day 28, extend coupon to ₹250 first month for next 5 commits + extend trial by +7 days for hesitant users. Keep optionality, don't burn.

## Risks
| Risk | Mitigation |
|---|---|
| Coupon abuse | Max 3 uses + 1-per-customer flag |
| Founder over-discount → revenue trap | Only 50% for 1 month, not lifetime |
| User feels pressured | Low-pressure CTA + "just reply" |
| Razorpay coupon misconfig | Verify in test mode first |

## India / Mumbai-Specific Notes
- ₹499 first-month is psychologically meaningful (under ₹500 threshold)
- WhatsApp message + voice from founder more effective than email-only
- Indian SaaS culture: discount + relationship beat hard sell

## Dependencies
- **Blocks:** Day 28-30 paid pipeline, Day 29 revenue audit
- **Depends on:** P14 paywall, P11 Razorpay live, Day-10 + Day-21 data

## Connected Skills
- `email-sequence` — drip
- `whatsapp-outreach` — WA
- `paywall-upgrade-cro` — coupon flow
- `pricing-strategy` — coupon pricing
