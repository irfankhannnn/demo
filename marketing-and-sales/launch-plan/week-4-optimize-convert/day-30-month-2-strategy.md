# Day 30 — Month-2 Strategy + Referral Program Launch

## Objective
Decide ONE channel to focus 80% of Month-2 effort on (based on Day 29 audit), set up a customer referral program to leverage Month-1 customers as Month-2 acquisition, and document the Month-2 plan in 1 page.

## Why This Matters for RealtyFlow
Month 1 was scattered: directories, outreach, communities, content, demos, beta. Month 2 must be FOCUSED. Founders who run 5 half-channels burn out. Founders who run 1 channel hard hit ₹1L MRR. Day 30 is the commitment day — pick the winner, write down the plan, ship the referral system, and stop trying everything.

## User Story
As a founder, I want to evaluate Month-1 channel performance from Day 29's audit and commit Month-2 to ONE primary channel + ONE supporting channel, launch a customer referral program that converts current customers into Month-2 acquisition, and document the Month-2 plan in 1 page, so that Month 2 starts with focus and the referral system compounds from Day 31.

## Acceptance Criteria
- [ ] Primary Month-2 channel selected and justified (with Day 29 data)
- [ ] Secondary supporting channel selected
- [ ] Channels to DROP listed (deliberate stops)
- [ ] Referral program designed: incentive structure + mechanism
- [ ] Referral landing / signup logic deployed (or planned for Week 5)
- [ ] Customer referral invite sent to all Month-1 paying customers
- [ ] Month-2 strategy doc saved at `assets/month-2-strategy.md`
- [ ] Month-2 targets set (MRR, paying customers, activation, etc.)
- [ ] Calendar blocked for Month-2 execution
- [ ] Personal reflection on Month 1 documented
- [ ] Day 30 close-out: WhatsApp thanks to beta testers + customers

## Implementation Steps

### Step 1: Re-read Day 29 audit (30 min)
Open `month-1-audit.md`. Re-focus on:
- Which channel delivered PAYING customers (not just signups)?
- Which channel had best signup-to-paid conversion?
- Which channel had best LTV signals (engaged customers)?
- Which activity took most time but delivered nothing?

### Step 2: Pick Month-2 primary channel (1 hour)
This is the most important Day-30 decision.

Decision framework:
| Criteria | Weight |
|----------|--------|
| Customers acquired in Month 1 | 40% |
| Conversion rate (signup → paid) | 30% |
| Time-per-acquisition (effort efficiency) | 20% |
| Scalability for Month 2-6 | 10% |

Common Month-1 winners for Indian SaaS:
- **Cold outreach (WhatsApp + LinkedIn)** — usually wins Month 1 because high-touch, founder-driven
- **Community engagement (Quora, Reddit)** — slow compounding, often Month 2-3 payoff
- **Content / SEO** — even slower, Month 3+ payoff
- **Directory launches** — one-time spike, doesn't compound
- **Beta referrals** — high-quality but limited volume

**Most common Month-2 choice:** double down on outreach (since it worked) + plant seeds for content/community.

### Step 3: Define the Month-2 motion
For your chosen primary channel, decide:
- **Volume target:** 100 prospects/week if outreach? 4 articles/month if content?
- **Daily/weekly rhythm:** How will you sustain it without burnout?
- **Tooling investment:** Do you need a better tool? (e.g., Sales Navigator, ConvertKit, etc.)
- **Conversion improvements:** Apply Day 22 + Day 27 learnings

Sample Month-2 plan for "Outreach primary":
- Week 5-8: 100 outreach prospects/week
- Daily: 10 WhatsApp + 5 LinkedIn + 5 email
- 3 demos/week target
- Templates: Use refined Day-27 versions
- Goal: 8-10 paid customers by end of Month 2

### Step 4: Channels to drop
Be deliberate about STOPPING:
- "Drop Product Hunt — high effort, low ROI (0 paid customers)"
- "Drop Reddit — no engagement Week 3 community day"
- "Pause directories — Month 1 burst sufficient; revisit Q4"

Listing what NOT to do is as important as listing what to do.

### Step 5: Design referral program
Indian real estate is a referral-driven industry. Your customers know other agents.

**Program structure (simple):**
- **For referrer (existing customer):** Get 1 free month for every paid referral that converts
- **For referee (new customer):** Get 20% off first 3 months
- **Trigger:** Existing customer shares unique link OR adds their friend's contact

**Track:**
- Unique referral codes per customer
- Razorpay coupon: REF_[CustomerCode]
- Dashboard view: "Your referrals" — shows pending + converted

**Launch:**
- Email + WhatsApp every Month-1 paying customer with their personal referral link
- Promote in product (dashboard banner) after Week 5
- Track in PostHog (`referral_signup` event)

### Step 6: Build referral mechanics
Two implementations:

**Quick: Link-based (Day 30 launch)**
- Each customer gets `realtyflow.in/refer/[code]` link
- Their friend visits, signs up, gets discount
- Customer auto-credited 1 month free on referral's first payment
- Implement in 4-6 hours

**Full: Dashboard-integrated (Week 5+)**
- Customers see referral status in-app
- Auto-notifies when referral converts
- Tier-based rewards (2 referrals = extra perks)
- Implement Week 5+

For Day 30: ship the link-based version.

### Step 7: Invite Month-1 customers
Send to each paying customer (likely 2-5 people):
> Subject: Special thank-you (and a chance to earn free months)
>
> Hey Rohit,
>
> You're one of RealtyFlow's first paying customers — thank you. Genuinely couldn't have shipped this without your feedback.
>
> Quick ask: if you know fellow agents who might benefit, here's your personal referral link:
>
> realtyflow.in/refer/SKYLINE-RS
>
> Anyone who signs up via your link:
> - Gets 20% off first 3 months
> - You get 1 full month FREE on RealtyFlow when they convert to paid
>
> No pressure — but if you do refer, I'll personally onboard them like I did for you.
>
> Owes you a coffee (₹2,499 discount equivalent),
> Kalim

### Step 8: Write the Month-2 strategy doc
Save `assets/month-2-strategy.md` (1 page max):

```markdown
# RealtyFlow — Month 2 Strategy

## North Star
- MRR target: ₹__ (2x Month 1)
- Paying customers: __ (Month 1: __)
- Activation rate: __%
- Channel focus: [Primary] + [Secondary]

## What Worked Month 1
1. ___
2. ___
3. ___

## What Didn't / Stopping in Month 2
1. ___
2. ___

## Month 2 Primary Channel: [name]
- Why: ___
- Volume: ___
- Cadence: ___
- Tooling: ___
- Conversion improvements: ___

## Month 2 Secondary Channel: [name]
- Why: ___
- Activity per week: ___

## Referral Program
- Launched Day 30
- Mechanic: ___
- Target: __ referrals in Month 2

## Product Roadmap (Month 2)
Based on Day 28 NPS + feedback:
1. [Top feature requested]
2. [Top bug pattern fix]
3. [Top onboarding improvement]

## Weekly Milestones
- Week 5: ___
- Week 6: ___
- Week 7: ___
- Week 8: ___

## What I'm NOT Doing
- Paid ads (validate organic first)
- Hiring (founder-led until 10 paid customers)
- New features outside top-3 above

## Founder Time Allocation (per week, 40h)
- Sales / outreach / demos: 60% (24h)
- Customer support: 15% (6h)
- Product development: 15% (6h)
- Content / community / brand: 10% (4h)
```

### Step 9: Final reflections + Month-1 close-out
Take 1 hour to write personal reflection:
- What surprised you?
- What were you wrong about?
- What's a question you have now that you didn't on Day 1?
- What's the one thing you'll do differently in Month 2?
- What's the one thing you're proud of?

Save to `assets/month-1-reflection.md` (private, for you).

### Step 10: Day-30 close-out message
To beta testers WhatsApp group:
> "Quick close on Month 1 — wanted to share.
>
> 30 days ago I was wondering if anyone would care about RealtyFlow.
>
> Today: [N] paying customers, [N] more on trial, [N] beta testers (all of you).
>
> You're the reason this works. Thanks for the brutally honest feedback. Every fix Week 2-3 was someone in this group telling me what was broken.
>
> Month 2: focusing on [Primary channel] + launching referrals (you each get a personal link tomorrow — refer agents you know, get 1 free month per conversion).
>
> Keep the feedback coming. Building this with you."

To paying customers (individually):
> "[Name] — you're officially a Month-1 paying customer. That's a real thing now. Thanks for trusting RealtyFlow at the riskiest moment. I owe you. — Kalim"

These two messages cement the relationships you'll lean on Month 2-6.

## Tools / Stack Required
- Day 29 audit
- Razorpay (referral coupon codes)
- Your customer + tracker spreadsheets
- WhatsApp Business
- Email
- Your IDE for referral link implementation

## Time Estimate
- Channel decision: 1-2 hours
- Referral program design + build: 4-6 hours
- Month-2 strategy doc: 1-2 hours
- Customer invites: 1 hour
- Beta tester close-out: 30 min
- Personal reflection: 1 hour
- **Total: full day**

## Deliverables
- Month-2 primary + secondary channel chosen with justification
- Referral program launched (link-based version)
- Each Month-1 customer received referral invite
- `assets/month-2-strategy.md` saved
- `assets/month-1-reflection.md` saved
- Beta tester WhatsApp close-out sent
- Founder calendar blocked for Month 2 execution

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| You can't pick ONE channel — tempted to do all | Force the constraint. "If I had to bet 80% of time, where?" |
| Referral program complexity slows launch | Ship link-based v1 today; iterate Week 5+ |
| Referrals = 0 in Month 2 | Common — referrals need momentum. Month 3 sees real numbers. |
| Burnout from 30 days of sustained effort | Take Days 31-32 OFF. Then return fresh. Sustainability > heroism. |
| Strategy doc grows to 5 pages | 1 page max. Constraints clarify. |

## India-Specific Notes
- Referral mechanics work well in India (commission culture among agents)
- "Free month" is more motivating than discount in India (cash flow concern)
- WhatsApp delivery of referral links converts higher than email
- Indian customers refer 1-2 people max in Month 1 — don't expect viral
- Channel partner program (agencies as resellers) is a Month 3+ idea — note for later

## Connected Days / Dependencies
- **Blocks:** Month 2 execution (Week 5 onward)
- **Depends on:** Day 29 (audit), all prior days

## Success Metric
- Month-2 strategy doc <1 page, choice clear
- Referral program live (link-based)
- All Month-1 customers received referral invite
- Beta tester close-out sent
- You feel CONVICTION about Month 2, not anxiety
- You take Day 31-32 off without guilt
