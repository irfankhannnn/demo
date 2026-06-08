# New Skills — Detailed Specifications
> 7 new skills to build. Skills are callable capabilities — smaller than agents, focused on one task.

---

## Skill 1: `growth-intel`
**Priority:** P0  
**Used by:** growth-strategist agent (primary), manual invocation  
**File:** `claude-skills/skills/growth-intel/SKILL.md`

### What It Does
Takes structured data inputs (pipeline CSV, ad performance CSV, previous funnel report) and
synthesizes them into a Growth Brief with specific, data-grounded findings.

Key difference from `oracle`: `oracle` generates generic growth advice. `growth-intel` reads
YOUR actual data files and produces findings with real numbers from your real campaigns.

### Inputs
- Pipeline CSV: `marketing-and-sales/leads/pipeline.csv` (or Google Sheets export)
- Ad performance CSV: `marketing-and-sales/reports/campaign-performance/[latest].csv`
- Funnel report: `marketing-and-sales/reports/intelligence/funnel-analysis/[latest].md`
- Previous Growth Brief: `marketing-and-sales/reports/intelligence/weekly-growth-brief/[latest].md`

### Output
Structured Weekly Growth Brief (see Agent 1 spec for format).

### Invocation
```
/growth-intel weekly
/growth-intel icp-analysis     # focus on which ICP converts
/growth-intel channel-compare  # compare channels by effective CAC
```

### Intelligence Logic (what the skill does with data)
1. Load and normalize all data files
2. Calculate: CPL by channel, lead→demo rate, demo→trial rate, trial→paid rate
3. Segment all rates by ICP (classify leads by company size from CRM data)
4. Identify the #1 gap (biggest drop in funnel, worst channel, highest churn segment)
5. Generate 3 specific recommended actions with expected impact estimates
6. Flag 2 experiments worth running based on the data

---

## Skill 2: `funnel-analysis`
**Priority:** P0  
**Used by:** growth-strategist, experiment-designer, manual invocation  
**File:** `claude-skills/skills/funnel-analysis/SKILL.md`

### What It Does
Reads product analytics data (PostHog CSV export or equivalent) and maps the user journey
from signup to activation to retention. Finds where users drop, how fast they drop, and
which segments drop more than others.

### Why This Matters
Without this, you're optimizing acquisition into a black box. You don't know if the users
you're paying ₹800 each to acquire are activating. You don't know if the onboarding flow
you built is working.

### Inputs
- PostHog event export CSV: `marketing-and-sales/reports/product-analytics/events-[date].csv`
  - Expected columns: `user_id, event_name, timestamp, properties`
  - Key events to track: `signup`, `first_listing_created`, `first_team_member_added`,
    `whatsapp_connected`, `crm_entry_created`, `login_[day_7]`, `login_[day_30]`

- User properties CSV: `marketing-and-sales/reports/product-analytics/users-[date].csv`
  - Expected columns: `user_id, signup_date, plan, company_size, source (utm)`

### Output
```markdown
# Funnel Analysis Report — [Date]

## Conversion Funnel (Current)
Signup → Activation (Day 1):  [X]%  ← target: >60%
Activation → Day 7 login:     [X]%  ← target: >50%
Day 7 → Day 30 login:         [X]%  ← target: >40%

## Key Drop Points
1. [Step with highest drop]: [X]% drop | [N] users affected
2. [Second highest drop]: ...

## Segment Comparison
| ICP Segment | Activation Rate | D30 Retention |
|-------------|----------------|---------------|
| Agency Owner (10+ emp) | X% | X% |
| Sales Manager (5-10 emp) | X% | X% |
| Solo Agent | X% | X% |

## Activation Failure Analysis
[What did non-activated users fail to do?]
[What did activated users do within first 2 hours?]

## Recommended Onboarding Fixes (Top 3)
```

### File Format Requirements for PostHog Export
PostHog → Insights → Funnels → Export as CSV
Events to configure in PostHog (tell user what to instrument):
- `user_signed_up`
- `first_property_listed`  
- `crm_contact_added`
- `team_member_invited`
- `dashboard_viewed` (Day 7 check)

---

## Skill 3: `messaging-optimizer`
**Priority:** P0  
**Used by:** growth-strategist, landing-page-builder, media-buyer  
**File:** `claude-skills/skills/messaging-optimizer/SKILL.md`

### What It Does
The feedback loop between "what message worked" and "what message to use next."

Reads conversion data (which ad creative → which ICP → what conversion rate) and generates
ICP-specific messaging recommendations. Tells landing-page-builder which hero headline to use.
Tells media-buyer which ad angle to scale.

### Why This Matters
Currently: brand-strategist writes Hinglish copy based on brand guidelines. Nobody knows if
"WhatsApp mein leads dhundh rahe ho?" converts better than "Excel mein CRM chala rahe ho?"
for agency owners vs. solo agents.

This skill closes that loop.

### Inputs
- Ad performance by creative: from `ab-optimizer` reports
- Lead quality by source: from `pipeline-manager` outputs
- ICP analysis: from `deep-researcher` outputs + growth-intel ICP analysis
- Current landing page copy: from `marketing-and-sales/creative/landing-pages/`
- Brand guidelines: `.brand/brand-kit.md`

### Outputs
```markdown
# Messaging Recommendations — [Date]

## Winning Angles (by ICP)

### Agency Owner (Rajesh Bhai) — highest converting segment
Best hook: "WhatsApp leads kho rahe ho?" (3.2% CTR vs. 1.1% for feature-list hook)
Best CTA: "Free mein dekho → 2 min demo"
Avoid: Technical feature lists, enterprise language

### Sales Manager (Priya Madam)
Best hook: "Team ki tracking kaise karein bina Excel ke?"
Best CTA: "Apni team ke saath try karo"
Avoid: Solo-agent framing

### Solo Agent (Dev bhai)
Best hook: "Clients bhool gaye follow-up karna? Yeh app yaad rakhega"
Avoid: Team features as primary pitch

## Landing Page Recommendations
- Hero headline change: [current] → [recommended] | Expected lift: [X%]
- CTA button change: [current] → [recommended] | Based on: [test result]
- Social proof: Lead with [specific testimonial type that converts this segment]

## Ad Creative Direction
- Scale: [creative angle] + [audience segment] (ROAS: X)
- Pause: [creative angle] (ROAS below threshold)
- Test Next: [proposed new angle based on data]
```

### Invocation
```
/messaging-optimizer weekly              # full weekly recommendations
/messaging-optimizer icp:rajesh-bhai     # messaging for specific persona
/messaging-optimizer page:main-landing   # optimize specific landing page
/messaging-optimizer creative-brief      # generate brief for nano-designer/ugc-planner
```

---

## Skill 4: `retention-analysis`
**Priority:** P1  
**Used by:** retention-analyst agent, growth-strategist  
**File:** `claude-skills/skills/retention-analysis/SKILL.md`

### What It Does
Cohort analysis + churn signal detection. Answers: which users are about to churn, which
cohorts retained well and why, what behavior in Day 1-7 predicts 6-month retention.

### Inputs
- PostHog event data (same CSV format as funnel-analysis)
- User activity logs: last login date, feature usage frequency
- CRM customer records: plan type, company size, ICP classification

### Output
- Retention Health Score (0-100) for current customer base
- At-risk customer list (to pass to nurture-bot)
- Cohort comparison table
- Behavioral predictors of retention ("users who do X in Day 3 retain at 80% vs. 30%")

### Key Analyses Built In
1. **Rolling retention table** — % of users from signup cohort who were active on Day N
2. **Feature correlation** — which features do retained users use that churned users don't?
3. **Churn signal scoring** — score each active user 1-10 on churn risk
4. **Time-to-first-value** — how long to the first "aha moment"?

---

## Skill 5: `channel-cac-analysis`
**Priority:** P1  
**Used by:** growth-strategist, media-buyer  
**File:** `claude-skills/skills/channel-cac-analysis/SKILL.md`

### What It Does
Cross-channel CAC analysis. Not just "which channel has the lowest CPL" but "which channel
has the lowest EFFECTIVE CAC" (accounting for lead quality and conversion rate to paid).

### The Problem It Solves
Meta Ads: ₹800 CPL → 2% lead-to-trial → 20% trial-to-paid → ₹20,000 CAC
LinkedIn: ₹3,200 CPL → 12% lead-to-trial → 40% trial-to-paid → ₹6,667 CAC

LinkedIn is actually cheaper per customer. But without this analysis, media-buyer sees
₹800 CPL on Meta and thinks Meta is better.

### Inputs
- Ad spend by channel: Meta Ads CSV, LinkedIn Ads CSV
- Lead-to-trial conversion by source: pipeline-manager with UTM data
- Trial-to-paid conversion by source: CRM data
- Monthly revenue by customer: for LTV calculation

### Output
```markdown
# Channel CAC Analysis — [Month]

| Channel | CPL | Lead→Trial | Trial→Paid | Effective CAC | LTV:CAC |
|---------|-----|-----------|-----------|--------------|---------|
| Meta Ads | ₹X | X% | X% | ₹X | X:1 |
| LinkedIn | ₹X | X% | X% | ₹X | X:1 |
| Cold Email | ₹X | X% | X% | ₹X | X:1 |
| Organic | ₹0 | X% | X% | ₹X | X:1 |

## Recommendation
- Scale: [channel] — best LTV:CAC ratio
- Cut: [channel] — LTV:CAC below 3:1
- Investigate: [channel] — high CPL but high conversion, verify attribution
```

---

## Skill 6: `experiment-design`
**Priority:** P1  
**Used by:** experiment-designer agent  
**File:** `claude-skills/skills/experiment-design/SKILL.md`

### What It Does
Given a funnel drop or conversion problem (from funnel-analysis report), generates a structured
A/B test hypothesis with scoring, sample size requirements, and expected lift estimate.

### Inputs
- Funnel analysis report (identifies where to test)
- Current page/ad/email being tested
- Historical test results (what's already been tried)
- Business context: current traffic volume, conversion baseline

### Output
Structured Experiment Brief (see experiment-designer spec).

### Hypothesis Generation Logic
1. Identify the funnel step with the biggest recoverable drop
2. Generate 3-5 hypotheses for why users drop at that step
3. For each hypothesis, generate a testable variant
4. Score each variant by (impact × confidence) / effort
5. Rank and output top 2 to run

### Statistical Guardrails
- Always calculate minimum sample size for 80% power at 95% confidence
- Flag tests that would require >8 weeks of data at current traffic (not worth running)
- Require pre-registration of primary metric before test starts
- Include stopping rules (when to call it early if one variant is clearly winning/losing)

---

## Skill 7: `competitive-intel`
**Priority:** P2 — Build Later  
**Used by:** growth-strategist, messaging-optimizer  
**File:** `claude-skills/skills/competitive-intel/SKILL.md`

### What It Does
Extends trend-hunter output. trend-hunter reports WHAT competitors are doing.
competitive-intel analyzes WHY it matters and WHAT to do about it.

### Inputs
- trend-hunter reports: `marketing-and-sales/research/`
- Competitor landing pages (scraped URLs)
- G2/Capterra review exports for competitors
- Competitor pricing pages

### Output
```markdown
# Competitive Intel Report — [Date]

## Positioning Gaps (Opportunities)
1. [Gap]: Competitor X doesn't address [pain point]. Our opportunity: [message].
2. ...

## Threats
1. [Competitor Y] launched [feature]. Our users care about this: [evidence]. Response: [action].

## Review Mining Insights
What competitor customers complain about (directly addressable in our messaging):
- "[Specific complaint]" — [N] mentions — Our counter: "[How we solve this]"

## Pricing Intelligence
[Competitor pricing changes and what it means for our positioning]
```

---

## Skills Not Building (and Why)

| Skill Proposed | Decision |
|----------------|----------|
| Real-time PostHog API connector | Defer — file exports sufficient for Phase 1 |
| LangGraph orchestration | Not needed — Claude's agent system handles this |
| Qdrant vector DB for insights | Defer — file-based search works at current scale |
| n8n workflow automation | Defer — manual triggers sufficient until patterns proven |
| PhantomBuster social scraping | Defer — SerpApi + trend-hunter covers this |
