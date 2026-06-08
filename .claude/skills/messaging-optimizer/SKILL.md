---
name: messaging-optimizer
description: >
  Closes the loop between "which message converted" and "what message to write next."
  Reads ad performance by creative, lead quality by source, and ICP analysis to generate
  segment-specific messaging recommendations: best hooks, best CTAs, copy variants to test.
  Outputs briefs for landing-page-builder, media-buyer, and ugc-planner. Use weekly after
  growth-strategist, or before any new landing page or ad campaign launch.
allowed-tools: Read, Grep, Bash, Write
---

# Messaging Optimization

Generate ICP-specific messaging recommendations from real conversion data. Focus: $ARGUMENTS

## Invocation Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| Weekly | `/messaging-optimizer weekly` | Full ICP-by-channel messaging recommendations |
| ICP-specific | `/messaging-optimizer icp:rajesh-bhai` | Deep dive on one persona |
| Page-specific | `/messaging-optimizer page:main-landing` | Optimize a specific landing page |
| Creative brief | `/messaging-optimizer creative-brief` | Generate brief for nano-designer/ugc-planner |
| Ad copy | `/messaging-optimizer ad-copy` | Generate ad headlines + primary text variants |

## The Feedback Loop This Skill Closes

Without this skill:
- brand-strategist writes Hinglish copy based on brand-kit (intuition + guidelines)
- ugc-planner writes scripts based on persona templates (intuition + templates)
- ab-optimizer detects ad performance but doesn't generalize learnings
- Nobody knows if "WhatsApp mein leads dhundh rahe ho?" outperforms "Excel mein CRM chala rahe ho?" for which ICP

With this skill:
- Read ad performance data → which CREATIVE ANGLE worked for which AUDIENCE SEGMENT
- Read landing page conversion data → which HEADLINE converts which TRAFFIC SOURCE
- Combine with ICP analysis → recommend exact copy direction for each segment

## Required Inputs

| Input | Path |
|-------|------|
| Ad performance by creative | `marketing-and-sales/ads/reports/` (ab-optimizer outputs) |
| Lead source quality | `marketing-and-sales/reports/intelligence/funnel-analysis/[latest].md` |
| ICP analysis | `marketing-and-sales/reports/intelligence/icp-analysis/[latest].md` or buyer-personas-summary.md |
| Current landing pages | `marketing-and-sales/creative/landing-pages/` |
| Current ad creatives | `marketing-and-sales/ads/` (creative briefs and live ad copy) |
| Brand guidelines | `.brand/brand-kit.md`, `.brand/positioning.md` |
| Hormozi framework | `marketing-and-sales/ads/hormozi-ad-system/` (hooks, CTAs, framework) |

## Output

Save to: `marketing-and-sales/reports/intelligence/messaging/YYYY-W##-messaging.md`

Also writes:
- Landing page recommendations → `marketing-and-sales/reports/intelligence/messaging/landing-page-recommendations-[date].md`
- Ad copy briefs → `marketing-and-sales/reports/intelligence/messaging/ad-copy-brief-[date].md`

## Output Template

```markdown
# Messaging Recommendations — Week [##], [YYYY]
> Generated: [date] | Confidence: HIGH/MED/LOW

## TL;DR
- Best converting hook this week: [hook] (X% CTR vs. Y% baseline)
- Highest converting ICP: [persona] — focus copy here
- Recommended test: [specific variant]

## Performance by Hook × ICP
| Hook Angle | Rajesh Bhai CTR | Priya Madam CTR | Dev Bhai CTR | Notes |
|------------|----------------|-----------------|--------------|-------|
| "WhatsApp leads chaos" | X% | X% | X% | Best for Rajesh |
| "Excel CRM problems" | X% | X% | X% | Best for Priya |
| "Forgotten follow-ups" | X% | X% | X% | Best for Dev |
| "Team coordination" | X% | X% | X% | — |
| "RERA compliance" | X% | X% | X% | — |

## Winning Angles by ICP

### Rajesh Bhai (Agency Owner) — [conversion rate]
**Best hook:** [Exact text in Hinglish]
- Source: ad set X, X% CTR over Y impressions
- Why it works: [emotional driver — likely "team chaos" or "lost revenue"]

**Best CTA:** [Exact text]
- Source: [page or ad with conversion data]
- Why it works: [low commitment, time-bound, etc.]

**Best proof:** [Type of social proof that converts this segment]
- Example: "Used by 500+ agencies in Mumbai" (vs. "individual agents love it")

**Avoid for this segment:**
- [Pattern that underperformed]
- [Pattern from data]

### Priya Madam (Sales Manager) — [conversion rate]
[Same structure]

### Dev Bhai (Solo Agent) — [conversion rate]
[Same structure]

## Landing Page Recommendations
For each active landing page, specific changes ranked by expected impact:

### Page: `marketing-and-sales/creative/landing-pages/main.html`
**Current hero:** "[Current text]"
**Recommended hero:** "[New text]"
**Why:** Based on [data source], "[angle]" outperformed "[current angle]" by [X%]
**Expected lift:** [+Y% conversion]
**Confidence:** HIGH/MED/LOW

[Repeat for each page]

## Ad Creative Direction (for media-buyer + ugc-planner)

### Scale These Creatives (Top Performers)
| Creative ID | ROAS | ICP | What's Working |
|-------------|------|-----|----------------|
| Ad-X | 4.2 | Rajesh | "[hook text]" + agency-owner targeting |

### Pause These Creatives (Underperformers)
| Creative ID | ROAS | Reason |
|-------------|------|--------|
| Ad-Y | 0.8 | Generic hook, no ICP fit |

### New Creative Briefs (Top 3 to produce)
1. **Brief 1:** [Hook angle] + [Visual concept] for [ICP]
   - Hypothesis: Will beat [current top performer] by [X%]
   - Source insight: [data signal from this analysis]
2. ...

## Email/Outreach Messaging (for sdr + nurture-bot)
### What's working in outreach
- Subject line: "[winning subject]" — [open rate]
- Opener: "[winning opener]" — [reply rate]

### What's not working
- [Pattern with data]

### Recommended changes
- For SDR cold outreach: [specific change]
- For nurture sequence Day 3 email: [specific change]

## Experiment Candidates (for experiment-designer)
1. **Hypothesis:** Replacing main landing hero from "[A]" to "[B]" will lift signups by [X%] for [audience]
2. **Hypothesis:** Adding "[social proof type]" to pricing page will lift trial→paid by [X%]
3. ...

## Brand Guardrails Applied
All recommendations conform to:
- Hinglish ratio: 70% English + 30% Hindi romanized (per brand-kit.md)
- Primary color: #2563EB Royal Blue for CTAs
- Tone: Casual + Expert + Supportive (no enterprise jargon, no patronizing tone)
- Approved phrases (only): [from brand-kit.md key phrases]

## Confidence & Caveats
- Sample size warnings
- Time period of underlying data
- Any creative without sufficient impressions (<5k) marked LOW confidence
```

## Analysis Protocol

### Step 1: Aggregate ad performance by angle
Read ab-optimizer reports. For each active ad, classify by:
- **Hook angle:** WhatsApp / Excel / Follow-ups / Team / Compliance / Growth / Other
- **CTA style:** Trial / Demo / Free / Urgency / Low-friction
- **Visual style:** Product screenshot / Testimonial / Founder / Lifestyle / Stat-driven
- **ICP target:** From ad set targeting + actual converting audience

### Step 2: Cross-reference with lead quality
For each ad's leads (from pipeline-manager UTM data):
- What % became demos?
- What % became trials?
- What % became paid?

This gives "effective conversion" per creative, not just CTR.

### Step 3: Build hook × ICP matrix
Compute CTR and conversion rate for each (hook, ICP) cell.
Flag the top cell in each row (best ICP for that hook) and each column (best hook for that ICP).

### Step 4: Read landing page conversion data
For each page in `marketing-and-sales/creative/landing-pages/`:
- What's the current conversion rate (visitors → signups)?
- What hero / CTA / proof elements are currently used?
- Identify mismatches: e.g., page targets solo agents but converts agency owners best

### Step 5: Generate ICP-specific copy direction
For each persona, synthesize:
- **Best hook angle** = the one with highest CTR for that segment
- **Best CTA style** = the one with highest click-to-signup conversion
- **Best proof type** = the social proof element that converted this segment
- **Failed angles** = patterns to avoid

### Step 6: Write recommendations
For each landing page and ad campaign, write a specific change with:
- Current state (exact copy)
- Recommended state (exact copy)
- Source data (which test/cell in the matrix proved this)
- Expected lift estimate

### Step 7: Generate experiment candidates
Pass 2-3 top recommendations to experiment-designer as testable hypotheses.

## Hinglish Style Enforcement

All copy recommendations MUST follow brand-kit.md rules:
- 70% English + 30% Hindi (romanized — written in Latin script)
- Casual tone: "bhai", "yaar", "abhi" sparingly
- No enterprise jargon: avoid "leverage", "synergy", "ecosystem"
- Common winning phrases to compose from:
  - Pain: "[X] mein [Y] dhundh rahe ho?", "[X] kab tak chalega?"
  - Solution: "Sab ek jagah", "Automatic hai bhai", "2 click mein ho jaata hai"
  - CTA: "[X] Shuru Karo →", "Demo Dekho (2 min)", "Free Trial — No Credit Card"

## ICP-Specific Language Patterns

### Rajesh Bhai (Agency Owner, 35-50)
- **Speak to:** business pain, team coordination, revenue, status
- **Words that resonate:** "team", "agency", "growth", "control", "visibility"
- **Avoid:** technical jargon, "user", "individual contributor"
- **Tone:** Respectful "aap" form, business-serious

### Priya Madam (Sales Manager, 28-40)
- **Speak to:** efficiency, reporting, team productivity, career growth
- **Words that resonate:** "reporting", "tracking", "team", "data", "dashboard"
- **Avoid:** "owner" framing, financial-CEO speak
- **Tone:** Professional but warm

### Dev Bhai (Solo Agent, 22-35)
- **Speak to:** convenience, mobile-first, individual productivity, time-saving
- **Words that resonate:** "mobile", "WhatsApp", "fast", "simple", "remember"
- **Avoid:** team features, enterprise pitches
- **Tone:** Casual "tu/tum" form, friend-to-friend

## Decision Heuristics

### When to recommend a copy change
- Current landing page conversion <2% AND analysis shows clear winning angle elsewhere
- Specific ad creative has run >5k impressions and underperforms baseline by >30%
- New ICP segment has emerged in pipeline data with no matching landing page

### When to NOT recommend changes
- Sample size on current creative <5k impressions (not enough data yet)
- The "winning" alternative has <2k impressions (might be statistical noise)
- Brand-kit explicitly forbids the recommended phrasing (must stay within guardrails)

### When confidence should be LOW
- Less than 2 weeks of ad data
- Less than 50 conversions across the campaign
- No ICP classification on leads (can't segment)
- Significant external factor (competitor launch, seasonality) confounds data

## What This Skill Does NOT Do

- Does not write the final ad copy (passes brief to ugc-planner/brand-strategist who do)
- Does not build the landing page HTML (passes brief to landing-page-builder)
- Does not run the experiment (passes brief to experiment-designer)
- Does not change brand positioning (that's brand-strategist)
- Does not invent data — if conversion data is missing, says so

## Strategic Memory

After each weekly run, update memory with:
- Winning hook × ICP combinations validated
- Failed hypotheses (what didn't work and why)
- Emerging copy patterns worth deeper testing
- Brand guardrails that prevented otherwise-good recommendations (signal to brand-strategist)
