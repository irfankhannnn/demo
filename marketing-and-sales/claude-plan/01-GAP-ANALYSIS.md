# Gap Analysis — What Exists vs. What's Missing
> Compares current system against the Growth Intelligence framework

---

## Current System Inventory

### What You Have: 20 Agents, 23 Skills — All Execution

**Team 1: Builders (Engineering)**
- `architect`, `sentry`, `pr-commander`
- Status: Complete. Not in scope for this plan.

**Team 2: Strategists (Market Intel)**
- `trend-hunter` — Scrapes Twitter/Reddit/competitor sites for pain points
- `deep-researcher` — ICP analysis, firmographic mapping, lead targeting
- `oracle` — "Predictive analytics, feature prioritization"
- Status: EXISTS but shallow. `oracle` is described as predictive but has no data inputs defined.
  It generates recommendations from general knowledge, not from YOUR actual product + campaign data.

**Team 3: Content Factory (7 agents)**
- brand-strategist, nano-designer, motion-engineer, ugc-planner, orator, landing-page-builder, seo-content-writer
- Status: Complete for execution. They produce content on demand.
  Problem: They have no feedback loop. They don't know which creative angle is converting.

**Team 4: Scalers (Ads)**
- `media-buyer` — Sets up Meta Ads campaigns
- `ab-optimizer` — Monitors ROAS/CPA, pauses losers, scales winners
- `lead-scraper` — Scrapes Google Maps for leads
- Status: `ab-optimizer` is good at tactical optimization (pause/scale). It does NOT do strategic analysis
  (why is ROAS high in this segment? what does it tell us about ICP fit?).

**Team 5: Converters (Sales)**
- `sdr`, `nurture-bot`
- Status: Complete for execution. They reach out. They don't know which leads to prioritize based on
  conversion probability.

**Team 6: Trackers (Operations)**
- `pipeline-manager`
- Status: Tracks lead stages. Does NOT analyze pipeline health, conversion rates, or stage velocity.

---

## The Missing Capabilities (Prioritized)

### GAP 1 — No Growth Intelligence Brain [CRITICAL]

**What's missing:** An agent that synthesizes data from multiple sources (pipeline, ads, product)
and produces strategic direction: "invest more in channel X", "ICP segment Y converts 3x better",
"users who do Z in onboarding retain 4x longer."

**What exists instead:** `oracle` generates generic recommendations based on its training knowledge.
It has no mechanism to ingest YOUR actual data and reason over it.

**Impact:** Every execution decision is made on intuition, not evidence.

**Solution:** `growth-strategist` agent + `growth-intel` skill

---

### GAP 2 — No Product Analytics Connection [CRITICAL]

**What's missing:** Any link between what users do INSIDE the product and marketing decisions.
You cannot know if users who come from Meta Ads activate at the same rate as those from LinkedIn.
You cannot know which onboarding step has the highest drop rate.

**What exists instead:** Nothing. The system produces leads (pipeline-manager) but doesn't track
what happens after signup.

**Impact:** Cannot find PMF signal. Cannot know if you're acquiring the right users.

**Solution:** `funnel-analysis` skill (file-based — accepts PostHog CSV exports, not live API)

---

### GAP 3 — No ICP-to-Messaging Feedback Loop [HIGH]

**What's missing:** A system that looks at which message → ICP segment → conversion rate,
then generates new message variants targeting the highest-converting segments.

**What exists:** `brand-strategist` writes Hinglish copy based on brand-kit. `ugc-planner` writes
scripts based on personas (Rajesh Bhai, Priya Madam, Dev bhai). But neither knows which persona
is actually converting at what rate.

**Impact:** Creative production is disconnected from performance. You produce content; you don't
know if it's converting the RIGHT people.

**Solution:** `messaging-optimizer` skill

---

### GAP 4 — No Retention Intelligence [HIGH]

**What's missing:** Cohort analysis, churn signals, win-back triggers. Understanding WHY users
leave (not just that they do).

**What exists:** `pipeline-manager` tracks lead stages. `nurture-bot` does follow-up sequences.
Neither analyzes retention health across cohorts.

**Impact:** You'll optimize acquisition but leak customers from the bottom of the funnel.
At early stage, keeping first 50 customers matters more than acquiring the next 50.

**Solution:** `retention-analyst` agent + `retention-analysis` skill

---

### GAP 5 — No Structured Experimentation [MEDIUM]

**What's missing:** A system for generating hypotheses, designing experiments, scoring them by
expected impact, and tracking results. `ab-optimizer` can detect winners but cannot propose
what to test.

**What exists:** `ab-optimizer` monitors active tests and makes tactical decisions (pause/scale).
It has no hypothesis generation or test prioritization capability.

**Impact:** You run tests reactively (test what feels right) instead of proactively (test what
data says matters most).

**Solution:** `experiment-designer` agent + `experiment-design` skill

---

### GAP 6 — No CAC Intelligence [MEDIUM]

**What's missing:** Cross-channel CAC analysis. Media buyer runs campaigns but doesn't produce
a comparative view: "LinkedIn leads cost ₹2,400 each but convert at 8%. Meta leads cost ₹800 each
but convert at 2%. LinkedIn's effective CAC is actually lower."

**What exists:** `ab-optimizer` optimizes within Meta. No cross-channel intelligence.

**Solution:** `channel-cac-analysis` skill

---

### GAP 7 — No Competitive Intelligence Synthesis [LOW]

**What's missing:** A system that synthesizes competitor moves, pricing changes, and positioning
gaps into actionable direction (not just reporting them).

**What exists:** `trend-hunter` scrapes competitor sites and social. It produces reports but not
actionable positioning recommendations.

**Solution:** `competitive-intel` skill (extends trend-hunter output)

---

## Priority Matrix

```
High Impact + Low Complexity → Build First
High Impact + High Complexity → Build Second
Low Impact → Defer

[HIGH IMPACT / LOW COMPLEXITY]
  ✓ growth-intel skill (synthesis from existing data)
  ✓ messaging-optimizer skill (ICP-copy feedback loop)
  ✓ funnel-analysis skill (accepts file exports, no new APIs)

[HIGH IMPACT / HIGH COMPLEXITY]
  → growth-strategist agent (orchestrates multiple data sources)
  → retention-analyst agent (needs product data pipeline)
  → channel-cac-analysis skill (needs multi-channel data normalization)

[MEDIUM IMPACT / MEDIUM COMPLEXITY]
  → experiment-designer agent
  → experiment-design skill

[LOW / DEFER]
  → competitive-intel skill (trend-hunter already covers this partially)
  → real-time analytics API integrations
  → autonomous GTM orchestration
```

---

## Key Insight: What NOT To Do

The framework you shared suggests PostHog, Mixpanel, ClickHouse, LangGraph, Qdrant, n8n.
**Do not build that yet.**

That infrastructure is for scale. At early stage, the data you need exists in:
- Meta Ads Manager (downloadable CSV)
- Google Sheets pipeline (already tracked by pipeline-manager)
- PostHog (free tier exports to CSV)
- Your own CRM (DynamoDB → exportable)

Start with **file-based intelligence** (Claude reads CSVs and reasons over them).
Move to API-based real-time intelligence only when you've proven what questions to answer.
