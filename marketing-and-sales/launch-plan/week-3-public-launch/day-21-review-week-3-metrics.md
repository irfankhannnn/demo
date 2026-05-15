# Day 21 — Review Week 3 Metrics (Funnel, Channel, Conversion)

## Objective
Pull a complete Week 3 metrics report — landing page visitors, signups, activation, demos, paid conversions, channel attribution — and identify the 1-2 highest-ROI levers to double down on in Week 4.

## Why This Matters for RealtyFlow
Week 3 deployed multiple acquisition channels (directories, outreach, community). Week 4's 9 days must focus on the WINNERS — running 5 channels half-heartedly produces less than running 1 channel full-heartedly. Day 21 forces that decision with data. Without this review, you'll fragment your effort in Week 4 and end Month 1 with confusion instead of conviction.

## User Story
As a founder, I want to compile a full Week 3 metrics report — visitors, signups, activation, demos, paid conversions, by channel — and identify the top 1-2 channels delivering quality signups (high-activation rate, demo-bookers, paying customers), so that Week 4 strategy doubles down on the winners and pulls effort from underperformers.

## Acceptance Criteria
- [ ] Full traffic report by source (PostHog + GA4)
- [ ] Signup funnel measured: landing visits → signup form views → signup completions → activation
- [ ] Channel attribution table: source → visits → signups → demos → trials → paid
- [ ] Drop-off points identified (top 3)
- [ ] Demo-to-paid conversion rate calculated
- [ ] Outreach reply rate finalized (across Days 18-19)
- [ ] Best-performing channel(s) identified — top 1-2 for Week 4 focus
- [ ] Lowest-ROI activities identified — to drop or reduce
- [ ] Week-3 report saved at `assets/week-3-metrics-report.md`
- [ ] Week-4 strategy decision documented (1-2 sentences)

## Implementation Steps

### Step 1: Pull traffic data (1 hour)

**From PostHog:**
- Total unique visitors (Day 15-21)
- Visitors by `utm_source` (per UTM tags from Day 16/17)
- Top referrers (where direct/no-UTM came from)

**From GA4:**
- Acquisition → Traffic acquisition → channel grouping
- Pages: which pages got most traffic (landing, /pricing, /demo)

**From PostHog → Funnels:**
- Run the "Activation Funnel" you built on Day 4
- Compare conversion rate at each step

### Step 2: Build the channel attribution table
For each channel, count:

| Channel | Visits | Signups | Activation Rate | Demos | Paid |
|---------|--------|---------|-----------------|-------|------|
| Product Hunt | 80 | 4 | 50% | 0 | 0 |
| BetaList | 25 | 2 | 50% | 0 | 0 |
| LinkedIn launch post | 40 | 3 | 33% | 1 | 0 |
| Cold WhatsApp | 12 | 4 | 75% | 3 | 1 |
| Cold LinkedIn DM | 8 | 2 | 50% | 1 | 0 |
| Cold email | 6 | 1 | 0% | 0 | 0 |
| Quora | 15 | 1 | 100% | 0 | 0 |
| Reddit | 8 | 0 | - | 0 | 0 |
| Community/groups | 10 | 1 | 100% | 1 | 0 |
| Direct (no source) | 35 | 5 | 40% | 1 | 0 |

Use real numbers from your tracking.

### Step 3: Analyze quality, not just volume
Look at activation rate by source. A channel can deliver high volume but low-quality (signups who never activate).

Patterns to watch for:
- **Product Hunt:** Often high volume, low activation (curious tire-kickers)
- **Cold outreach:** Lower volume, MUCH higher activation (qualified prospects)
- **Community:** Low volume, often highest quality (active researchers)
- **Direct:** Hard to interpret — usually some channel's referral lost in attribution

### Step 4: Compute key ratios
- **Visit → Signup conversion:** total signups / total visits = X%
  - Target: 3-5% for cold; 10%+ for warm/referred
- **Signup → Activation conversion:** activated users / signups = X%
  - Target: 40%+ (per `pre-launch-prep` activation event)
- **Signup → Demo:** demos booked / signups = X%
  - Target: 20%+
- **Demo → Paid:** paid trials / demos completed = X%
  - Target: 25%+
- **Visit → Paid (full funnel):** paid / visits
  - Target: ~0.5-1% for cold; higher for warm

### Step 5: Drop-off analysis
Where does the funnel leak most?

**Landing → Signup form:**
- Look at PostHog: % who view landing but don't click signup CTA
- If <50% click → landing copy isn't converting → revisit Day 6/15 messaging
- If <30% click → wedge is wrong (refer back to `pre-launch-prep/04`)

**Signup form → Submission:**
- Look at form abandonment rate
- If high → form has too many fields, too much friction, or some validation bug

**Signup → First action (activation):**
- Look at PostHog: % who complete signup but don't reach activation event in 7 days
- If high → onboarding flow problem, or demo data missing (revisit `pre-launch-prep/05`)

**Demo → Paid:**
- Why are demos not converting? Pricing? Feature gap? Trust?
- Re-watch demo recordings if you have them

### Step 6: Identify the winners
Two questions:
1. Which channel delivered the most PAYING customers? (or closest-to-paid: trial signups + demo-bookers)
2. Which channel has best activation rate?

If WhatsApp cold outreach delivered 1 paid + 3 demos → WINNER for Week 4
If Quora delivered 0 paid but 1 signup with strong activation → SEEDING for Month 2

Goal: identify 1-2 channels to allocate 80% of Week 4 effort to.

### Step 7: Identify the losers
- Channels with high effort but zero results
- Time-sinks (e.g., Reddit comments that returned crickets)
- Activities to PAUSE for Week 4

Be honest. Don't sentimentally cling to a channel because you wanted it to work.

### Step 8: Write Week 3 Metrics Report
Save `assets/week-3-metrics-report.md`:

```markdown
# RealtyFlow — Week 3 Metrics Report (Days 15-21)

## Headline
- Visits: __
- Signups: __ (X% conversion)
- Activations: __ (Y% of signups)
- Demos completed: __
- Paying customers: __
- MRR: ₹__

## Funnel
Landing visits → Signup views → Signup completed → Activated → Demo booked → Paid
__ → __ → __ → __ → __ → __

## Channel Performance
[Insert table from Step 2]

## Top Winners (allocate Week 4 here)
1. [Channel] — [reason — quality + quantity]
2. [Channel] — [reason]

## Underperformers (deprioritize Week 4)
1. [Channel] — [reason]
2. [Channel] — [reason]

## Drop-off Analysis
- Biggest leak: [where] — [hypothesis] — [Day 22 fix]
- Second-biggest: ...

## Conversation Themes (from demos + outreach replies)
1. Top objection: __
2. Top positive: __
3. Pricing reaction: __

## Week 4 Strategy (1-2 sentences)
"Double down on [Winner Channel 1] + [Winner Channel 2]. Pause [Underperformer]. Fix [Top Drop-off]. Convert [N] trial signups to paid via [Day 26 strategy]."
```

### Step 9: Share with beta tester WhatsApp group (optional)
Brief, transparent update to your beta tester group:
> "Week 3 wrap: [N] new agents trying RealtyFlow. [N] demos. [Y/N] our first paid customer. Couldn't have done this without you. Week 4 focus: turning trial users into paid + listening to more feedback. Anything I should fix next?"

Transparency builds tester loyalty + invites continued feedback.

### Step 10: Mental decompression
This day is HEAVY. Numbers can be sobering. Two outcomes:
- **If you exceeded targets:** Don't get cocky. Find the leak.
- **If you missed targets:** Don't despair. Find the lever. One channel-level pivot in Week 4 can fix Month 1.

Either way: take 1-2 hours OFF Day 21 evening. Week 4 needs you fresh.

## Tools / Stack Required
- PostHog
- GA4
- Razorpay dashboard (for paid customer count, MRR)
- Beta-prospects + outreach trackers
- Calendar (for demo history)

## Time Estimate
- Data pulling: 1-2 hours
- Channel analysis: 1-2 hours
- Drop-off analysis: 1 hour
- Report writing: 1-2 hours
- **Total: half day**

## Deliverables
- Full Week 3 metrics report
- Channel attribution table
- Funnel + drop-off analysis
- Top 1-2 winners + losers identified
- Week 4 strategy decision documented
- Tester WhatsApp update (optional)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Numbers are disappointing | Use as data, not judgment. Month 1 expectations are modest. |
| Attribution is fuzzy (multi-touch) | Use last-touch attribution + qualitative ("I came from your LinkedIn post"). Perfect attribution is impossible. |
| You don't have any paying customers yet | Activation rate + demo-bookers are early proxies. If those are healthy, paid will follow Week 4. |
| You want to fix every leak in Week 4 | Pick ONE. Drop-off fixing is high-leverage but distracting from new acquisition. |
| Bias toward channels you ENJOY (e.g., LinkedIn over WhatsApp) | Follow the data, not your preference |

## India-Specific Notes
- Indian customer journey often involves 5+ touches before paying — last-touch attribution undercounts WhatsApp/LinkedIn warmups
- Saturday/Sunday spike in trial signups is normal for Indian B2B (agents have time on weekends to try new tools)
- Mumbai dominates signups historically — note geo distribution
- Don't penalize channels that bring tier-2/3 city agents — they're often lower volume but higher LTV (sticky users)

## Connected Days / Dependencies
- **Blocks:** Day 22 (drop-off fix), Days 23-30 (Week 4 strategy)
- **Depends on:** Days 15-20 outputs, Day 4 (analytics setup)

## Success Metric
- Full metrics report compiled
- Top 1-2 winning channels identified with quantitative justification
- Drop-off leak hypothesis documented for Day 22
- You have CONVICTION on Week 4 plan (not "let me try everything again")
