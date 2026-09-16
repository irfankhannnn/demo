# RealtyFlow — 30-Day Launch Plan

A step-by-step operator handbook to take RealtyFlow from "finished build" to "first paying customers" in 30 days. Built for first-time SaaS founders targeting Indian real estate agents.

## How To Use This Plan

1. **Read `00-PLAN-OVERVIEW.md` first** — it explains the strategy, success metrics, and weekly objectives.
2. **Then read `00-GAPS-AND-ADDITIONS.md`** — explains what was added to your original 30-day plan and why.
3. **Complete `pre-launch-prep/` BEFORE Day 1** — these are foundational items (legal, pricing, deliverability) that the 30 days assume are done. Email deliverability alone needs 2-3 weeks of warm-up, so start this early.
4. **Then work through Day 1 → Day 30** — each day file is a self-contained user story with acceptance criteria, implementation steps, and deliverables.
5. **Use `templates/`** — copy-paste-ready outreach emails, beta invites, Product Hunt post drafts.

## File Naming Convention

- `dayXX-action-verb.md` — chronological execution order
- All files use markdown checklist (`- [ ]`) for acceptance criteria so you can tick off items as you complete them

## What Each Day File Contains

| Section | Purpose |
|---------|---------|
| Objective | One-sentence goal |
| Why This Matters | RealtyFlow-specific context |
| User Story | "As a / I want to / So that" format |
| Acceptance Criteria | Binary done/not-done checklist |
| Implementation Steps | Numbered tactical steps with tool names |
| Tools / Stack | Exact services + links |
| Time Estimate | Realistic hours for a solo founder |
| Deliverables | Concrete artifacts (files, configs, screenshots) |
| Risks & Mitigations | What can go wrong |
| India-Specific Notes | GST, DPDP, WhatsApp, INR, cultural cues |
| Connected Days | Dependencies + downstream day links |
| Success Metric | How you know the day succeeded |

## Quick Navigation

- [Plan Overview](00-PLAN-OVERVIEW.md)
- [Gaps & Additions](00-GAPS-AND-ADDITIONS.md)
- [Pre-Launch Prep](pre-launch-prep/) — Start here (parallel to Day 1)
- [Week 1: Foundation](week-1-foundation/)
- [Week 2: Soft Launch](week-2-soft-launch/)
- [Week 3: Public Launch](week-3-public-launch/)
- [Week 4: Optimize & Convert](week-4-optimize-convert/)
- [Templates](templates/)

## North-Star Metrics for Month 1

| Metric | Target | How Measured |
|--------|--------|--------------|
| Paying customers | 3-5 | Razorpay/Stripe dashboard |
| Free trial signups | 30-50 | PostHog `signup_completed` event |
| Beta testimonials | 5+ | Collected in Week 2 |
| MRR | ₹15,000-₹50,000 | Payment gateway |
| Activation rate | >40% | % of signups that reach "aha moment" (defined Day 4) |
| Outbound reply rate | >10% | Cold email/LinkedIn replies / sent |

## Critical Dependencies

```
pre-launch-prep/03 (email deliverability) → Week 3 cold outreach
pre-launch-prep/01 (legal) → Day 3 (payment go-live)
pre-launch-prep/04 (positioning) → Day 9 (beta pitch)
pre-launch-prep/05 (demo sandbox) → Day 10 (onboarding calls)
Day 14 (testimonials) → Day 15 (landing page social proof)
Day 4 (analytics) → Day 21 (Week 3 metrics review) → Day 22 (drop-off analysis)
```

## Tools Stack Recommended For India SaaS (Month 1)

Listed in the day files when first used. Quick map:

- **Payments:** Razorpay (primary), Stripe (Dubai/international fallback)
- **Analytics:** PostHog (product analytics) + GA4 (web)
- **Email infra:** Google Workspace + Brevo/Mailgun for transactional
- **Cold outreach:** Instantly.ai or Smartlead
- **Helpdesk:** Crisp (chat) + support@ email
- **WhatsApp Business:** AiSensy or Wati
- **Status page:** BetterStack or Instatus
- **Uptime monitor:** UptimeRobot or BetterStack
- **CRM-for-your-own-sales:** Your own RealtyFlow (dogfood) or HubSpot free
