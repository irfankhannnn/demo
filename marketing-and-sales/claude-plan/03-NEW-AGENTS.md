# New Agents — Detailed Specifications
> 3 new agents to build. Each spec includes: purpose, inputs, outputs, tools, sub-agents called.

---

## Agent 1: `growth-strategist`
**Priority:** P0 — Build First  
**Role:** The master decision brain. Synthesizes data from all sources into strategic direction.  
**Team:** Extends Team 2 (Strategists)  
**File:** `claude-skills/agents/growth-strategist.md`

### Purpose
Acts as the AI equivalent of a Growth VP. Reads weekly data (pipeline, ads, product analytics,
competitor moves), synthesizes it, and produces a Growth Brief: what's working, what isn't,
where to invest next.

Without this agent, teams work in silos. The media-buyer doesn't know which ICP the pipeline-manager
says converts best. The landing-page-builder doesn't know which message the ab-optimizer says wins.

### Inputs
| Input | Source | Frequency |
|-------|--------|-----------|
| Pipeline daily summaries | `marketing-and-sales/leads/daily-summary-*.md` | Daily |
| Ad performance reports | `marketing-and-sales/reports/campaign-performance/` | Weekly |
| Funnel analysis report | `marketing-and-sales/reports/intelligence/funnel-analysis/` | Weekly |
| Retention report | `marketing-and-sales/reports/intelligence/retention/` | Weekly |
| Competitor intel | `marketing-and-sales/research/` + trend-hunter outputs | Weekly |
| ICP data | `marketing-and-sales/research/buyer-personas-summary.md` | Reference |
| Brand positioning | `.brand/positioning.md` | Reference |

### Outputs
| Output | Format | Path |
|--------|--------|------|
| Weekly Growth Brief | Markdown | `marketing-and-sales/reports/intelligence/weekly-growth-brief/` |
| ICP Conversion Analysis | Markdown | `marketing-and-sales/reports/intelligence/icp-analysis/` |
| Channel Efficiency Report | Markdown | `marketing-and-sales/reports/intelligence/channel-efficiency/` |
| Recommended Experiments | Markdown | `marketing-and-sales/experiments/pending/` |
| Strategic Recommendations | Markdown (within Growth Brief) | — |

### Sub-Agents Called
```
growth-strategist
  ├── Calls: oracle (for feature prioritization context)
  ├── Calls: trend-hunter (for current market pulse)
  ├── Reads: pipeline-manager outputs
  ├── Reads: funnel-analysis skill outputs
  ├── Reads: retention-analyst outputs
  └── Writes: experiment candidates → experiment-designer picks up
```

### Tools Available
- Read, Write, Edit (for intelligence reports)
- Grep (for searching across report files)
- Bash (for date-stamped file creation)
- Task (for calling sub-agents: oracle, trend-hunter)

### Sample Output (Weekly Growth Brief)
```markdown
# Growth Brief — Week 20, 2026

## TL;DR
- Rajesh Bhai (agency owner) segment has 3x better trial→paid conversion than solo agents
- Meta Ads CPL dropped 18% when using "WhatsApp leads problem" hook vs. "CRM features" hook
- 40% of signups fail to create their first property listing within 48h (activation failure)

## Recommended Actions This Week
1. [HIGH] Shift ad targeting to 10+ employee agencies (Rajesh Bhai segment)
2. [HIGH] Build onboarding email that triggers if user hasn't added listing by Day 2
3. [MED] Test "WhatsApp chaos" hook on landing page hero (currently uses feature-list)
```

### Trigger Conditions
- **Scheduled:** Every Monday 9am (using /schedule or CronCreate)
- **Manual:** User runs `/growth-intel weekly`
- **Event-based:** After any ad campaign completes a week of data (ab-optimizer signals completion)

---

## Agent 2: `experiment-designer`
**Priority:** P1 — Build Second  
**Role:** Generates A/B test hypotheses, designs experiments, tracks active tests, declares winners.  
**Team:** Extends Team 4 (Scalers)  
**File:** `claude-skills/agents/experiment-designer.md`

### Purpose
`ab-optimizer` is good at execution (pause/scale). It has no strategic layer.
`experiment-designer` asks: "Based on our current funnel data, WHAT should we test next?"

It generates prioritized experiment hypotheses, designs the actual test (what variant, what metric,
what sample size), and then reads ab-optimizer results to declare statistically meaningful winners.

It bridges the gap between "we need to test something" and "we should test X because our funnel data
shows Y% drop at Z point, and the hypothesis is that changing W will recover P% of that drop."

### Inputs
| Input | Source |
|-------|--------|
| Funnel analysis reports | `marketing-and-sales/reports/intelligence/funnel-analysis/` |
| Weekly growth brief | `marketing-and-sales/reports/intelligence/weekly-growth-brief/` |
| Active ad data | `ab-optimizer` agent outputs |
| Conversion benchmarks | `marketing-and-sales/research/` |
| Current landing pages | `marketing-and-sales/creative/landing-pages/` |

### Outputs
| Output | Format | Path |
|--------|--------|------|
| Experiment Backlog | Markdown (scored list) | `marketing-and-sales/experiments/backlog.md` |
| Active Experiment Tracker | Markdown | `marketing-and-sales/experiments/active-experiments.md` |
| Experiment Briefs | Markdown (one per test) | `marketing-and-sales/experiments/briefs/` |
| Winner Analysis | Markdown | `marketing-and-sales/experiments/completed/` |

### Experiment Brief Format
Each experiment gets a structured brief:
```markdown
# Experiment: [Name]
**Hypothesis:** If we [change X], then [metric Y] will improve by [Z%]
  because [reasoning from data].
**Metric:** Primary: [trial conversions] | Secondary: [CTR]
**Variant A (Control):** [current state description]
**Variant B (Test):** [proposed change]
**Sample Size Needed:** [N leads/visitors for 80% power at 95% confidence]
**Duration Estimate:** [X weeks at current traffic]
**Expected Lift:** [P%]
**Priority Score:** [1-10] based on (impact × confidence) / effort
**Assign To:** [media-buyer / landing-page-builder / sdr]
```

### Experiment Scoring Formula
Priority Score = (Impact Score × Confidence Score) / Effort Score
- Impact: 1-3 (how much does this metric matter?)
- Confidence: 1-3 (how strong is the data signal?)
- Effort: 1-3 (how hard to build and run?)
- **Score ≥ 3:** Run immediately | **Score 2-3:** Queue | **Score < 2:** Backlog

### Sub-Agents Called
```
experiment-designer
  ├── Reads: funnel-analysis skill outputs
  ├── Reads: ab-optimizer reports
  ├── Reads: growth-strategist Weekly Growth Brief
  ├── Calls: media-buyer (to set up the actual ad test)
  ├── Calls: landing-page-builder (to create landing page variants)
  └── Writes: experiment briefs → media-buyer + landing-page-builder pick up
```

### Trigger Conditions
- **Scheduled:** Every Monday after growth-strategist runs (reads the weekly brief)
- **Manual:** User runs `/experiment-design next`
- **Event-based:** When ab-optimizer declares a winner (design the next experiment in that domain)

---

## Agent 3: `retention-analyst`
**Priority:** P1 — Build Second (parallel with experiment-designer)  
**Role:** Cohort analysis, churn signal detection, win-back campaign triggers.  
**Team:** Extends Team 5 (Converters)  
**File:** `claude-skills/agents/retention-analyst.md`

### Purpose
The most under-built capability in the current system. You can generate 3,000 leads and 300 customers,
but if 250 of them churn in 90 days, you've built a leaky bucket.

`retention-analyst` reads product analytics data (PostHog exports) and pipeline data to answer:
- Which users are at risk of churning right now?
- Why did users in Cohort [month] churn more than Cohort [next month]?
- What behavior in the first 7 days predicts 6-month retention?
- Which ICP segments retain best?

This feeds two existing agents: `nurture-bot` (proactive intervention for at-risk users) and
`sdr` (win-back outreach for churned users who might come back).

### Inputs
| Input | Source |
|-------|--------|
| PostHog product event exports | `marketing-and-sales/reports/product-analytics/*.csv` |
| CRM customer data | DynamoDB export (customer list + signup date + plan) |
| Pipeline stage data | pipeline-manager Google Sheets export |
| ICP classifications | `marketing-and-sales/research/buyer-personas-summary.md` |

### Outputs
| Output | Format | Path |
|--------|--------|------|
| Retention Health Report | Markdown | `marketing-and-sales/reports/intelligence/retention/` |
| Churn Risk List | CSV | `marketing-and-sales/leads/churn-risk-[date].csv` |
| Win-Back Target List | CSV | `marketing-and-sales/leads/winback-targets-[date].csv` |
| Cohort Analysis | Markdown | `marketing-and-sales/reports/intelligence/retention/cohorts/` |
| Retention Playbook Updates | Markdown | `marketing-and-sales/sequences/retention-playbook.md` |

### Key Analyses
1. **Activation Analysis:** What % of new signups complete activation? (Define activation as:
   created first property listing OR added first team member OR connected WhatsApp)
   
2. **Cohort Retention:** Day 1 / Day 7 / Day 30 / Day 90 retention by signup cohort (monthly)

3. **Churn Signals:** Users showing churn signals:
   - No login in 7 days (for active users who used to log in daily)
   - Feature usage drop >50% week-over-week
   - Support ticket opened + no resolution in 3 days
   
4. **Segment Analysis:** Which ICP (Rajesh Bhai vs. Priya Madam vs. Dev bhai) retains best?
   What feature set do retained users use that churned users didn't?

5. **Expansion Signal:** Users likely to upgrade (high feature usage, team size growing)

### Sub-Agents Called
```
retention-analyst
  ├── Reads: PostHog CSV exports (product analytics)
  ├── Reads: pipeline-manager daily summaries
  ├── Reads: ICP data from deep-researcher
  ├── Calls: nurture-bot (passes churn-risk segment for intervention sequence)
  ├── Calls: sdr (passes win-back targets for outreach)
  └── Writes: retention report → growth-strategist reads this
```

### Trigger Conditions
- **Scheduled:** Every Sunday (data for growth-strategist Monday brief)
- **Manual:** User runs `/retention-analysis weekly`
- **Event-based:** When pipeline-manager flags unusual drop in active users
- **Threshold-based:** When any cohort's 30-day retention drops below 60%, trigger alert

---

## Summary: Agent Dependency Graph

```
Sunday:
  retention-analyst runs → writes reports to intelligence/retention/

Monday AM:
  trend-hunter runs → writes market intel
  funnel-analysis skill runs → writes funnel reports
  channel-cac-analysis skill runs → writes channel reports

Monday 9am:
  growth-strategist runs → reads all reports → writes Weekly Growth Brief

Monday 10am:
  experiment-designer runs → reads Growth Brief → writes experiment backlog + active briefs
  messaging-optimizer runs → reads Growth Brief → writes ICP copy recommendations

Monday 11am:
  media-buyer picks up experiment briefs → sets up ad variants
  landing-page-builder picks up copy recommendations → updates landing pages
  nurture-bot picks up churn-risk list → activates intervention sequences
```
