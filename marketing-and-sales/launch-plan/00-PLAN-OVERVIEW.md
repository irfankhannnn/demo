# 30-Day Launch Plan — Overview

## The Strategy In One Paragraph

RealtyFlow is a CRM for Indian real estate agents. Month 1 is about **proving product-market fit with 3-5 paying customers through manual, unscalable, founder-led sales**. We will NOT spend on paid ads. We WILL talk to every customer personally, watch them use the product, and let their feedback drive the roadmap. The 30 days are split into four phases: technical foundation (Week 1), private beta with hand-picked testers (Week 2), public launch with cold outreach + community + directories (Week 3), and optimize-follow-up-close (Week 4).

## Weekly Objectives

### Week 1 (Days 1-7) — Foundation
Ensure that when a real estate agent in Mumbai or Bangalore wants to pay you on Day 8, every pipeline works: signup → onboarding → payment → invoice → support. You are your own first customer this week.

**Success looks like:** End-to-end test on Day 7 completes in under 10 minutes with zero broken steps. Razorpay live payment succeeds. PostHog events fire. Crisp chat is reachable from in-app.

### Week 2 (Days 8-14) — Soft Launch
Invite 30-40 hand-picked Indian real estate agents to use RealtyFlow free for 3 months in exchange for honest feedback and a testimonial. Watch them use it. Fix what breaks. Collect 5+ testimonials.

**Success looks like:** 8-12 active beta testers logging in 3+ times/week. 5+ testimonials collected. Critical bugs fixed. Activation rate measured.

### Week 3 (Days 15-21) — Public Launch
Public launch on Day 15. Landing page has social proof. Submit to 8-10 directories. Send 100+ personalized cold outreaches via email + LinkedIn + WhatsApp. Engage in 3-5 communities daily.

**Success looks like:** 200+ landing page visitors. 30-50 trial signups. 10+ outbound replies. Featured on at least 2 directories. 1-2 paying customers.

### Week 4 (Days 22-30) — Optimize, Follow-up, Convert
Plug funnel leaks. Follow up with everyone who showed interest but didn't sign up. Re-engage stalled trial users. Convert trial-to-paid. Write a case study. Build a feedback channel. Decide what channel to double down on for Month 2.

**Success looks like:** 3-5 paying customers. ₹15-50k MRR. 1 published case study. 1 channel identified as Month 2 focus.

## Key Principles (Read This First)

### 1. Do Things That Don't Scale
You are not building a marketing machine in Month 1. You are doing customer development. Every cold outreach is personally written. Every onboarding is a video call. Every bug report is fixed within 24 hours. **This is not how a Series A company operates. It IS how a $0 → $10k MRR company operates.**

### 2. Talk to More Customers, Not Fewer
The single biggest failure mode of first-time founders is hiding behind code. If you find yourself "building features" instead of "talking to agents", you are failing. Target: minimum 5 conversations with real estate agents per week.

### 3. Pricing Is Marketing
Your pricing decision (made in `pre-launch-prep/02-pricing-strategy.md`) shapes who signs up, who pays, and who churns. Don't price by gut — price by competitor benchmark + value math.

### 4. Distribution > Product (At This Stage)
RealtyFlow is good enough to launch. The question is no longer "is the product ready" but "can you put it in front of 100 qualified Indian agents in 30 days?" Days 16-20 are the distribution week. Treat them as sacred.

### 5. Measure What Matters
Vanity metrics (page views, followers) lie. The metrics that count for Month 1: **activation rate, conversion rate, week-2 retention, outbound reply rate, paying customers**. Everything else is noise.

### 6. Indian Real Estate Is A WhatsApp-First Market
Most plans assume email-first. In India, agents live on WhatsApp. Your outreach mix should be ~40% WhatsApp, 30% LinkedIn, 30% email. Cold calls also work in India (don't be afraid to ring a number).

## What Could Kill This Plan

| Risk | Mitigation |
|------|------------|
| Email deliverability not warmed up by Day 17 | Start `pre-launch-prep/03` 2-3 weeks before Day 1. Non-negotiable. |
| Payment fails on Day 3 due to missing legal docs | Complete `pre-launch-prep/01` (ToS, Privacy, DPDP compliance) before Day 3. |
| Beta testers don't actually use the product | Day 10 watches them live. Day 13 follows up personally. Hand-hold ruthlessly. |
| You build features instead of doing outreach in Week 3 | Set a rule: 2 hours/day coding maximum during Week 3-4. Rest is sales. |
| GST compliance breaks invoices when first Indian agent pays | `pre-launch-prep/07` solves this. Don't skip. |
| You burn out trying to do all 30 days alone | Block calendar in 90-min focused sessions. Take Sundays off. Don't context-switch. |

## North-Star Metrics

See [README.md](README.md#north-star-metrics-for-month-1).

## How To Track Progress

Create a simple Google Sheet titled "RealtyFlow Launch Tracker" with these tabs:
1. **Daily Log** — date, day#, completed?, blockers, key insight
2. **Beta Testers** — name, agency, city, signup date, last login, testimonial collected (Y/N)
3. **Outreach Pipeline** — name, contact, channel, sent date, opened, replied, signed up, paid
4. **Bugs/Feedback** — source (tester name), description, priority, fixed date
5. **Metrics Dashboard** — weekly snapshot of signups, MRR, activation, reply rate

## Founder Mental Model

Month 1 is **brutally tactical**. There is no glamour. You will spend hours in spreadsheets, on video calls watching strangers click around your app, replying to LinkedIn DMs at 11pm, and debugging Razorpay webhooks at 7am. **This is the work**. The people who skip this and go straight to "scale" never have a real Month 2.

The good news: by Day 30, you will have learned more about your customer than 90% of founders learn in their first year. That knowledge is the moat.

## Next Step

Read [00-GAPS-AND-ADDITIONS.md](00-GAPS-AND-ADDITIONS.md) to understand what was missing from your draft plan, then start [pre-launch-prep/01-legal-foundation.md](pre-launch-prep/01-legal-foundation.md).
