# Day 29 — Month-1 Revenue + Usage Audit

## Objective
Pull a complete Month-1 audit: total MRR, paying customers, activation rate, channel attribution for paid customers, power users (daily active), retention indicators — and identify the 3 customers most likely to churn so you can intervene before they do.

## Why This Matters for RealtyFlow
Day 21 was "Week 3 metrics". Day 29 is "Month 1 financials + retention". You need to know:
- Did you hit your revenue targets?
- Which acquisition channel delivered paying customers (not just signups)?
- Who's actually USING RealtyFlow daily vs trialing-and-forgetting?
- Who's at risk of churning before Month 2?

These answers shape Day 30's Month-2 strategy decision.

## User Story
As a founder, I want a complete Month-1 audit covering revenue (MRR, ARR-projected, customer count), usage (DAU, activation rate, power users), and risk (churn-risk customers, support load), so that Day 30's strategy decision is grounded in data not gut.

## Acceptance Criteria
- [ ] Total Month-1 MRR calculated (Razorpay)
- [ ] Customer count: paying + trial + churned (categorized)
- [ ] Average revenue per customer (ARPU)
- [ ] Channel attribution for paid customers (where did each come from?)
- [ ] Power users identified (daily login, high feature use)
- [ ] At-risk customers identified (low usage, payment failures, support issues)
- [ ] Activation rate computed (per Day 4 definition)
- [ ] NPS Month-1 score documented (if 5+ responses by now)
- [ ] Support load measured: ticket count, avg response time, resolution time
- [ ] Month-1 audit report saved at `assets/month-1-audit.md`
- [ ] Top 3 churn-risk customers identified + intervention plan for each

## Implementation Steps

### Step 1: Pull revenue data from Razorpay (30 min)
- Total successful subscription transactions in May (or your launch month)
- MRR (Monthly Recurring Revenue) = sum of monthly equivalents
- Annual subscriptions: divide by 12 for monthly equivalent
- ARR projection: MRR × 12

Save:
- MRR: ₹__
- ARR projection: ₹__
- Paying customer count: __
- Average revenue per user (ARPU): MRR / paying count

### Step 2: Categorize customers (30 min)

| Category | Count | MRR Contribution |
|----------|-------|------------------|
| Paid (active) | __ | ₹__ |
| Trialing (Day 26 expiring soon) | __ | ₹0 |
| Trial-ended-no-convert | __ | ₹0 |
| Churned (cancelled in Month 1) | __ | ₹0 |
| **Total signups** | __ | __ |

Compute key ratios:
- Trial-to-paid conversion: __ / (paid + trial-ended) = __%
- Net new MRR (Month 1): ₹__

### Step 3: Channel attribution for paying customers
For each paying customer:
- Their original acquisition channel (UTM, conversation history)
- Cold outreach / community / direct / referral / directory?

Build summary:
| Channel | Paid Customers | MRR |
|---------|---------------|-----|
| Cold WhatsApp | 2 | ₹4,998 |
| LinkedIn outreach | 1 | ₹2,499 |
| Community (Quora) | 0 | ₹0 |
| Product Hunt | 0 | ₹0 |
| Beta tester referral | 1 | ₹999 |
| Direct (no source) | 1 | ₹2,499 |

This tells you which channel delivers MONEY (not just signups).

### Step 4: Power user identification
PostHog filter:
- Active in last 7 days: yes
- Sessions in last 7 days: 5+
- Activation event completed: yes
- Feature use breadth: 3+ features used

These are your champions. Note their names + agencies.

Use for:
- Testimonials (Month 2)
- Case study #2 (Month 2)
- Referral program targets (Day 30)

### Step 5: Power-user feature analysis
For each power user:
- Which features are they actually using?
- Which features they HAVEN'T used (gap)?
- Is there a pattern? (e.g., "all power users use WhatsApp + AI calling, never use pipeline reports")

This guides Month 2 prioritization:
- If all use feature X → make it MORE central
- If none use feature Y → either kill it or make it more discoverable

### Step 6: At-risk identification
PostHog filter:
- Subscribed/Paid: yes
- Last seen: 5+ days ago
- Activation events: low in last 14 days
- Support tickets: 2+ open
- Payment failures: any

These customers are the BIGGEST Month-2 churn risk. Likely 1-3 customers.

For each:
- Why are they at risk? (low usage / support / payment / disengagement)
- Have you been in touch?
- What action would save them?

### Step 7: Intervention plan for at-risk
For each at-risk customer, plan one intervention TODAY:

**Plan A — Low usage:**
> "Hey [Name] — noticed you've been less active. Anything blocking you? Free 15-min screen share to dig in or help set up something."

**Plan B — Support tickets open:**
- Resolve them today
- Personal follow-up: "Fixed the issue you reported. Anything else?"

**Plan C — Payment issue:**
- Check Razorpay for failure reason
- Reach out: "Saw your renewal failed. Want me to send a new payment link or switch to UPI?"

### Step 8: Support load measurement
From Crisp + email:
- Total tickets in Month 1: __
- Average first-response time: __ hours
- Average resolution time: __ hours
- SLA adherence: __%

Note any patterns:
- 60% of tickets about onboarding → improve onboarding
- 40% of tickets about pricing → improve pricing page clarity
- 20% of tickets about AI calling errors → fix the calling integration

### Step 9: NPS Month-1
If you got 5+ NPS responses since Day 28:
- Promoters: __
- Passives: __
- Detractors: __
- NPS: __

If <5 responses (too early), note "insufficient data — re-measure Month 2".

### Step 10: Compile the audit report
Save `assets/month-1-audit.md`:

```markdown
# RealtyFlow — Month 1 Audit

## Revenue
- MRR: ₹X
- ARR (projected): ₹X × 12 = ₹Y
- Paying customers: __
- ARPU: ₹__
- Annual prepays: __ (₹__)

## Acquisition
[Channel attribution table from Step 3]
- Total visitors: __
- Total signups: __
- Total trials: __
- Total paid: __

## Funnel Conversion
- Visit → Signup: __%
- Signup → Activation: __%
- Trial → Paid: __%
- Visit → Paid (full funnel): __%

## Usage
- Power users: __ (names listed)
- Activation rate (7-day): __%
- Daily active users: __
- Average sessions/user/week: __
- Top 3 features by use: ___

## Risk
- At-risk customers: __ (intervention plans documented)
- Churn rate (Month 1): __%
- Support load: __ tickets, __h avg resolution

## NPS
- Score: __
- Sample size: __
- Top Promoter feedback: ___
- Top Detractor feedback: ___

## What Worked
1.
2.
3.

## What Didn't Work
1.
2.
3.

## Key Insight
[One sentence on the biggest learning]
```

### Step 11: Reflect
Take 30 min off. Walk. Process.

Then ask yourself:
- Did I hit my target (3-5 paying customers, ₹15-50k MRR)?
- If yes: what got me there? Replicate.
- If no: was it acquisition (too few signups)? Conversion (signups didn't pay)? Activation (signups didn't use)? Diagnose precisely.

Bring this clarity to Day 30.

## Tools / Stack Required
- Razorpay dashboard
- PostHog (cohorts, funnel, user profiles)
- GA4 (channel attribution backup)
- Crisp + email for support data
- Your customer + tracker spreadsheet

## Time Estimate
- Revenue data: 30 min
- Channel attribution: 1 hour
- Power user + at-risk analysis: 1-2 hours
- At-risk intervention messages: 1 hour
- Audit report writing: 1-2 hours
- Reflection: 30 min
- **Total: half day**

## Deliverables
- `assets/month-1-audit.md` complete
- Revenue numbers logged
- 3 at-risk customers identified + intervention sent
- Power user list compiled
- NPS score documented
- Channel ROI clarified
- One-sentence key insight captured

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Revenue below target | Use as Day 30 input. Don't despair. Month 1 is calibration. |
| Attribution is incomplete | Best-effort, last-touch + qualitative. Not perfect, useful. |
| At-risk interventions ignored | One intervention per customer; if ignored, accept loss with grace |
| You compare unfavorably to other founders publicly | Most founders inflate numbers. Trust your data. |
| Audit feels demoralizing | Pause if needed. Day 30 strategy comes after rest. |

## India-Specific Notes
- Indian B2B SaaS Month-1 benchmarks: 2-5 paying customers, ₹5-25k MRR is realistic
- Annual prepay rare in Month 1 — most pick monthly to test
- Churn often delayed in India (people cancel 2-3 months in, not Month 1) — Month 1 churn rate underrepresents true rate
- Support tickets in Hindi/Hinglish — log them too; "didn't get my message" deserves analysis
- Festival overlap (Diwali, Eid, Ganesh) — adjust expectations if Month 1 hit these

## Connected Days / Dependencies
- **Blocks:** Day 30 (Strategy decision needs audit)
- **Depends on:** Days 4 (analytics), 21 (Week 3 metrics), 28 (NPS), 26 (conversions)

## Success Metric
- Audit report compiled
- 3 at-risk customers contacted
- Channel ROI clear (one winner identified)
- One-sentence insight captured
- You feel ready for Day 30 strategy decision
