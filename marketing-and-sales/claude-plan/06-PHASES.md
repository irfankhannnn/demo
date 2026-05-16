# Build Phases — Phased Plan with Go/No-Go Criteria
> Sequenced to deliver value fast. Each phase is independently useful.

---

## Phase 0 — Prerequisites (Before Building Anything)
**Duration:** 1-2 days | **Who:** You (human setup required)

These are not agent builds. They are data infrastructure decisions that determine whether
the intelligence layer will have anything to analyze.

### Setup Required
1. **PostHog instrumentation:** Add these 5 events to the Cloudberry CRM app:
   - `user_signed_up` (on registration)
   - `first_property_listed` (activation event #1)
   - `crm_contact_added` (activation event #2)
   - `team_member_invited` (activation event #3)
   - `user_session` (for Day 7 / Day 30 retention tracking)
   
   Without this, funnel-analysis skill has nothing to analyze.

2. **UTM tracking on all links:** Every Meta Ad → Landing Page → Signup must carry:
   `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
   This connects ad spend to lead quality to conversion rate.

3. **Pipeline stage consistency:** pipeline-manager must track:
   - Lead source (where did this person come from?)
   - ICP classification (agency owner / sales manager / solo agent)
   - Stage dates (when did they enter each stage?)
   
   Without ICP classification, all segment analysis is impossible.

4. **Create report directories:**
   ```
   marketing-and-sales/reports/product-analytics/
   marketing-and-sales/reports/campaign-performance/
   marketing-and-sales/reports/intelligence/
   marketing-and-sales/reports/intelligence/weekly-growth-brief/
   marketing-and-sales/reports/intelligence/funnel-analysis/
   marketing-and-sales/reports/intelligence/retention/
   marketing-and-sales/experiments/
   marketing-and-sales/experiments/backlog.md
   marketing-and-sales/experiments/active-experiments.md
   marketing-and-sales/experiments/briefs/
   marketing-and-sales/experiments/completed/
   ```

### Go/No-Go Criteria for Phase 1
- [ ] PostHog installed and 5 events firing
- [ ] UTM params on all ad links
- [ ] Pipeline has ICP classification field
- [ ] At least 50 leads in pipeline (enough data to analyze)
- [ ] At least 2 weeks of Meta Ads data

---

## Phase 1 — Intelligence Foundation [HIGHEST PRIORITY]
**Duration:** 3-5 days of building | **Builds:** 3 skills + 1 agent

### Build Order
1. **`funnel-analysis` skill** (2 days)
   - Build the SKILL.md definition
   - Define exact CSV format it expects (PostHog export spec)
   - Define the standard output report format
   - Test with sample/synthetic data first
   - Why first: every other skill depends on funnel data

2. **`growth-intel` skill** (1 day)
   - Build the SKILL.md definition
   - Define what data files it reads and how it synthesizes them
   - Define the Weekly Growth Brief template
   - Test: generate a Growth Brief from sample pipeline + ad data

3. **`messaging-optimizer` skill** (1 day)
   - Build the SKILL.md definition
   - Wire it to read growth-intel output + ab-optimizer reports
   - Define ICP-specific copy recommendation format
   - Test: generate messaging recommendations from sample data

4. **`growth-strategist` agent** (1 day)
   - Build the agent definition (agent.md)
   - Define its weekly orchestration sequence
   - Define which sub-agents it calls and when
   - Test: run a full weekly cycle with synthetic data

### Phase 1 Output
- You have a system that, every Monday, reads last week's data and tells you:
  - Which ICP converted best
  - Which channel had best effective CAC
  - What the top funnel drop point was
  - What message to test next
  - What experiment to run next

### Go/No-Go Criteria for Phase 2
- [ ] Growth-strategist has run successfully 2+ consecutive weeks
- [ ] At least 1 messaging recommendation has been implemented and tested
- [ ] Funnel analysis has identified at least 1 actionable drop point
- [ ] Team is consistently uploading weekly data files

---

## Phase 2 — Retention + Experimentation [HIGH PRIORITY]
**Duration:** 3-4 days of building | **Builds:** 2 agents + 3 skills

### Build Order
5. **`retention-analysis` skill** (1 day)
   - Build SKILL.md
   - Define cohort table format
   - Define churn signal scoring (inputs: days since login, usage frequency)
   - Output: churn-risk-[date].csv format for nurture-bot

6. **`retention-analyst` agent** (1 day)
   - Build agent definition
   - Wire to: read PostHog exports, write to nurture-bot + sdr
   - Wire to: feed retention report into growth-strategist

7. **`experiment-design` skill** (1 day)
   - Build SKILL.md
   - Implement hypothesis generation logic
   - Implement scoring formula (impact × confidence / effort)
   - Implement sample size calculation
   - Define Experiment Brief template

8. **`experiment-designer` agent** (1 day)
   - Build agent definition
   - Wire to: read growth brief + funnel analysis
   - Wire to: write experiment briefs for media-buyer + landing-page-builder
   - Wire to: read ab-optimizer results and declare winners

9. **`channel-cac-analysis` skill** (1 day)
   - Build SKILL.md
   - Define multi-channel CAC calculation logic
   - Wire to: feed into growth-strategist weekly run

### Phase 2 Output
- You have the full intelligence loop:
  - Data flows in every week
  - Growth strategist synthesizes it
  - Experiment designer proposes what to test
  - Media buyer and landing-page-builder execute tests
  - ab-optimizer declares winners
  - Experiment designer designs next test
  - Retention analyst catches at-risk users before they churn

### Go/No-Go Criteria for Phase 3
- [ ] Experimentation cycle has completed at least 1 full A/B test (hypothesis → result → next)
- [ ] Retention analyst has identified and passed churn-risk users to nurture-bot
- [ ] At least 1 cohort has been analyzed with behavioral retention predictors identified
- [ ] Channel CAC analysis has recommended a budget reallocation

---

## Phase 3 — Competitive Intel + Automation [MEDIUM PRIORITY]
**Duration:** 2-3 days | **Builds:** 1 skill + automation wiring

### Build Order
10. **`competitive-intel` skill** (1 day)
    - Build SKILL.md
    - Wire to read trend-hunter outputs and synthesize positioning gaps
    - Feed into messaging-optimizer and brand-strategist

11. **Weekly Automation Setup** (1-2 days)
    - Wire the weekly cycle using /schedule or CronCreate
    - Set up Sunday data upload reminder
    - Set up Monday auto-run of the intelligence cycle
    - Test: full automated Monday morning run without human trigger

### Phase 3 Output
- Fully automated weekly intelligence cycle
- Competitive positioning fed into messaging in real-time
- Human involvement reduced to: upload data Sunday → review Growth Brief Monday

---

## Phase 4 — Scale Intelligence [FUTURE, AFTER PROOF]
**Duration:** TBD | **Only build if Phase 1-3 proves value**

These are the advanced capabilities from the framework you shared. Only build these once
you've proven the file-based intelligence system works and you have enough scale to need
real-time processing.

### What Phase 4 Includes
- Real-time PostHog API integration (replace CSV file uploads)
- Cross-channel attribution modeling (multi-touch)
- Predictive churn scoring (ML model trained on your own data)
- Autonomous experiment generation (fully automated, no human review)
- Self-optimizing ad campaigns (budget reallocation happens automatically)
- Full GTM automation (cold email sequences generated from funnel data automatically)

### Why Not Build Phase 4 Now
- You need 6+ months of data before predictive models have signal
- Real-time APIs require DevOps maintenance
- Autonomous actions without human review increase error risk at early stage
- The simpler file-based system will tell you EXACTLY what to optimize Phase 4 for

---

## Total Build Estimate

| Phase | Days | Value Unlocked |
|-------|------|---------------|
| 0 (Prerequisites) | 1-2 | Data foundation — nothing else works without this |
| 1 (Intelligence Foundation) | 3-5 | Weekly Growth Brief: who converts, what to do |
| 2 (Retention + Experiments) | 3-4 | Full intelligence loop: measure → test → learn |
| 3 (Competitive + Automation) | 2-3 | Automated weekly cycle, competitive positioning |
| **Total Phases 0-3** | **9-14 days** | **Complete Growth Intelligence System** |

---

## What Success Looks Like

After all phases are complete, your Monday looks like this:

```
9:00am — You receive a Slack/email notification:
"Weekly Growth Brief ready — Week 21"

You open it and see:
- Rajesh Bhai segment trial→paid rate: 24% (up from 18% last week)
- Meta Ads creative "WhatsApp chaos" scaling — ROAS 4.2
- Activation alert: 38% of signups failing to add first listing (down from 45%)
- Recommended this week: test shorter onboarding (3 steps vs 7)
- Experiment running: "hero headline A/B" (3 days in, no winner yet)
- At risk: 4 customers (passed to nurture-bot for intervention)

You spend 15 minutes reviewing and approving the week's recommendations.
The agents execute.
```

That is the goal.
