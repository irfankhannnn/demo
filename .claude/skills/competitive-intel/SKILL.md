---
name: competitive-intel
description: >
  Synthesizes trend-hunter outputs and competitor research into actionable positioning
  gaps, response recommendations, and review-mining insights. Where trend-hunter
  reports WHAT competitors do, this skill analyzes WHY it matters and WHAT to do
  about it. Outputs positioning recommendations for messaging-optimizer and
  brand-strategist. Use weekly or whenever a competitor major move is detected.
allowed-tools: Read, Grep, Bash, Write
---

# Competitive Intelligence

Turn competitor reports into positioning action. Focus: $ARGUMENTS

## The Gap This Skill Closes

`trend-hunter` reports facts: "Competitor X raised pricing by 20%", "Competitor Y launched mobile app",
"Competitor Z has 4.2/5 on G2."

That's data. It's not direction.

`competitive-intel` answers:
- What does this mean for RealtyFlow's positioning?
- Which weakness in their offer maps to our strength?
- What new messaging angle does this open up?
- What threat needs immediate response?

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Weekly | `/competitive-intel weekly` | Full competitive landscape synthesis |
| Single competitor | `/competitive-intel competitor:[name]` | Deep dive on one competitor |
| Review mining | `/competitive-intel reviews` | Mine competitor reviews for our angles |
| Pricing intel | `/competitive-intel pricing` | Pricing/packaging analysis only |
| Response | `/competitive-intel response:[event]` | Generate response plan for specific competitor move |

## Required Inputs

| Input | Path |
|-------|------|
| Trend-hunter reports | `marketing-and-sales/research/weekly-market-intel-*.md` |
| Competitor research | `marketing-and-sales/research/` (any competitor-named files) |
| Our positioning | `.brand/positioning.md` |
| Our brand voice | `.brand/brand-kit.md` |
| Previous competitive intel | `marketing-and-sales/reports/intelligence/competitive/[previous]` |

## Output

Save to: `marketing-and-sales/reports/intelligence/competitive/YYYY-W##-competitive.md`

## Output Template

```markdown
# Competitive Intelligence Report — Week [##], [YYYY]
> Generated: [date] | Competitors tracked: [list]

## TL;DR
- Biggest opportunity this week: [gap competitors haven't filled]
- Biggest threat this week: [competitor move that needs response]
- Recommended action: [one specific thing]

## Competitive Landscape Snapshot
| Competitor | Pricing | Last Major Move | G2 Rating | Threat Level |
|------------|---------|----------------|-----------|--------------|
| Salesforce | $$$$$ | New AI features | 4.4/5 | LOW (different segment) |
| HubSpot | $$$$ | RE template launch | 4.4/5 | MEDIUM |
| Zoho CRM | $$ | Price drop India | 4.1/5 | HIGH |
| Sell.do (RE-specific) | $$$ | Mumbai office | 3.8/5 | HIGH |
| MagicBricks Pro | $$ | Lead routing AI | 3.5/5 | MEDIUM |

## Positioning Gaps (Opportunities)

### Gap 1: [Specific gap]
- **What competitors do:** [How they handle this]
- **What they miss:** [Specific gap we can fill]
- **Evidence:** [G2 review quote, Reddit thread, etc.]
- **Our angle:** [Specific message/feature to lean into]
- **Owner:** messaging-optimizer to test this angle

### Gap 2: [Another gap]
...

## Threat Map

### Threat 1: [Specific competitor move]
- **What happened:** [Factual description]
- **Why it matters:** [Impact on our market position]
- **Affected users:** [Which segment of ours is most exposed]
- **Response priority:** HIGH/MED/LOW
- **Recommended response:** [Specific action — usually counter-messaging, not feature-matching]

## Review Mining Insights

Top complaints about competitors (verbatim from G2/Capterra/Reddit):

### Complaint Pattern 1: "[Verbatim or paraphrased complaint]" ([N] mentions across reviews)
- **Competitor affected:** [Who]
- **What it reveals:** [The underlying need that's unmet]
- **Our counter:** "[How RealtyFlow solves this — phrased as message]"
- **Use in:** Landing page / Sales page / Ad copy

### Complaint Pattern 2: ...

## Pricing Intelligence

| Competitor | Entry Plan | Mid Plan | Top Plan | Our Comparison |
|------------|------------|----------|----------|----------------|
| Salesforce | $25/user | $75/user | $150+/user | We are 70% cheaper |
| Zoho | ₹720/user | ₹1,800/user | ₹3,600/user | We compete on features |
| Sell.do | ₹15k flat | ₹35k flat | Custom | Our per-user model is fairer for SMB |

**Pricing changes this week:** [If any, list with implications]
**Our pricing position:** [Sweet spot for SMB / Premium for our features / Etc.]
**Pricing test recommendation:** [If competitor moves suggest a test]

## Feature Positioning Matrix

| Feature | Salesforce | HubSpot | Zoho | Sell.do | RealtyFlow | Differentiator? |
|---------|-----------|---------|------|---------|------------|----------------|
| Hinglish UI | ❌ | ❌ | ❌ | ❌ | ✅ | YES — unique |
| WhatsApp Integration | ⚠️ Limited | ❌ | ⚠️ Limited | ✅ | ✅ | Parity |
| RERA Compliance | ❌ | ❌ | ❌ | ✅ | ✅ | Parity vs. Sell.do |
| Mobile-first | ⚠️ Tablet | ⚠️ | ✅ | ✅ | ✅ | Parity |
| AI Calling | ✅ Enterprise | ⚠️ Limited | ❌ | ❌ | ✅ | Differentiator vs. SMB |
| Property Matching | ❌ | ❌ | ❌ | ✅ | ✅ | Parity vs. Sell.do |
| Affordable for SMB | ❌ | ❌ | ✅ | ⚠️ | ✅ | Strong differentiator |

**Our defensible moats (unique combinations):**
1. Hinglish UI × RE-specific × Affordable for SMB → No competitor matches all 3
2. Mobile-first × WhatsApp × AI Calling × Indian market → No global competitor has this stack

## Recommended Actions

### For messaging-optimizer
- Test angle: "[Specific message that exploits a gap]"
- Add to landing page: "[Specific differentiator framing]"

### For brand-strategist
- Position update consideration: [If a new market shift requires repositioning]
- Tagline angle to explore: [If review mining suggests new language]

### For media-buyer
- Audience to attack: [Competitor's underserved segment we can win]
- Audience to defend: [Our segment competitor is targeting]

### For sdr (cold outreach)
- New competitor objection to prepare for: [If users may now have competitor X in mind]
- Battle card update needed: [Yes/No, what to add]

## Competitive Watch List (Next Week)
- [Specific signal to monitor — e.g., "Sell.do hiring sales reps in Pune → expect expansion"]
- [Pricing review windows]
- [Product release rumors]

## Confidence & Caveats
- Source reliability: [How recent / verified is each datapoint]
- Sampling: review mining sample sizes
- Bias: own-perspective bias acknowledgment
```

## Analysis Protocol

### Step 1: Refresh trend data
Read latest trend-hunter outputs (typically weekly-market-intel-*.md).
If stale (>7 days), call trend-hunter agent to refresh.

### Step 2: Build the landscape snapshot
For each tracked competitor:
- Current pricing (from their pricing page or recent reports)
- Last major move (feature launch, pricing change, GTM shift)
- Public rating (G2, Capterra, Trustpilot if available)
- Threat level assessment based on segment overlap and recent moves

### Step 3: Identify positioning gaps
Cross-reference competitor weaknesses with our strengths:
- What do competitors NOT do that we DO? (differentiator)
- What do they do POORLY that we do well? (positioning angle)
- What pain do users express about competitors? (review mining)

For each gap, generate a specific positioning angle (not generic — must include exact words).

### Step 4: Identify threats
For each competitor move:
- Does it target our ICP?
- Does it copy our differentiator?
- Does it threaten our acquisition channels?

Rate threat: HIGH / MEDIUM / LOW.

### Step 5: Review mining
Read competitor G2/Capterra reviews. Look for:
- Specific complaints (5-15 word verbatims)
- Frequency of similar complaints (sign of systemic issue)
- Magnitude (1-star reviews vs. 4-star with caveats)

For each common complaint, generate our counter-message.

### Step 6: Pricing analysis
Compare pricing tier-by-tier:
- Where are we positioned (premium / mid / value)?
- Where are we vulnerable (competitor can undercut us)?
- Where are we strong (competitor can't reach our value)?

### Step 7: Feature matrix
Build feature comparison. Identify defensible moats — features only we have, or combinations only we deliver.

### Step 8: Generate recommendations
For each agent that consumes competitive intel:
- messaging-optimizer: 1-2 specific angles to test
- brand-strategist: positioning shifts to consider (if any)
- media-buyer: audience attack/defend decisions
- sdr: battle card updates and new objections to prepare

### Step 9: Set watch list
What signals to monitor next week:
- Expected competitor moves
- Pricing review periods
- Product launch rumors

## Decision Heuristics

### When to recommend "Counter-message" (not "Match feature")
- Competitor has a feature we don't, but their UX/positioning is weak → counter with our strength
- Competitor launches with weak execution → wait, don't react in panic
- Match only when: feature is truly table-stakes AND we have capacity to build

### When to recommend "Match feature"
- Lack of the feature is a deal-breaker in sales calls (verify with SDR feedback)
- Customers are churning specifically because of this gap (verify with retention-analyst)
- Industry shift makes the feature non-optional (e.g., regulatory)

### When to recommend "Ignore"
- Competitor is in a different segment (enterprise when we're SMB)
- The move is symbolic/PR (no real impact on our funnel)
- We can't verify impact (rumor without evidence)

### When confidence should be LOW
- Single source for major claim
- Review sample <10 mentions
- Pricing data >2 weeks old (changes fast)
- Rumor without primary source

## What This Skill Does NOT Do

- Does not scrape competitor sites (trend-hunter does that — this skill consumes its output)
- Does not change brand positioning (passes recommendations to brand-strategist)
- Does not generate full ad copy (passes angles to messaging-optimizer)
- Does not run war-room responses to competitor crises (escalates to growth-strategist)

## Strategic Memory

Track over time:
- Which competitor predictions came true (calibrate trend-hunter signal quality)
- Which counter-messages worked (calibrate messaging-optimizer recommendations)
- Long-term competitor patterns (Sell.do always launches new features in Q1, etc.)
- Industry shifts that affect all competitors (regulatory, market cycles)

This builds a multi-year competitive memory that's hard to replicate.

## Competitor Tracking List (Default for RealtyFlow)

| Tier | Competitors |
|------|-------------|
| Direct (RE-specific India) | Sell.do, PropertyAdda, MagicBricks Pro, 99acres CRM |
| Indirect (Generic CRM India) | Zoho CRM, Freshsales, LeadSquared |
| Global (out-of-segment) | Salesforce, HubSpot (only watch for pattern moves) |
| Adjacent (WhatsApp-first) | AiSensy, WATI, Interakt |

Update list quarterly with growth-strategist + brand-strategist input.
