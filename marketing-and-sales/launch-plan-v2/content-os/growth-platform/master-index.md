# Growth Platform — Master Index for AI Agents

> AI-navigable registry of all 42 files, 12 subsystems, and the rules for generating content and fetching configurations. Load this file first; it tells you where everything lives and which file is canonical for any concept.

## Quick Navigation

This index is designed so an AI agent can:
1. Load the full Growth Platform structure in ~2 min.
2. Identify which file is the "canonical source" for any concept (metrics, entities, workflows, epics).
3. Generate content by knowing subsystem dependencies.
4. Cross-reference via stable IDs (`FW-*`, `CH-*`, `HK-*`, `CTA-*`, `OPP-*`, `EP-*`, `M-*`, `WF-*`, `AG-*`).

---

## The 4-Layer System

```
Layer 1: CONTENT OS
├── Global engine (frameworks, characters, hooks, CTAs, visual, SOPs)
└── Workspace (business memory, market research, language, content plan)

↓ Layer 2: GTM OS (Attention, Distribution, Sales, Automation)

↓ Layer 3: GROWTH PLATFORM (THIS LAYER — 42 files)
├── Measurement (attribution, activation, lead-scoring, customer-scoring)
├── Acquisition (referrals, campaigns)
├── Operations (automations, ai-agents, onboarding, retention)
└── Engineering (analytics, implementation, roadmaps)

↓ Layer 4: CODE (Express+Lambda, DynamoDB, React — built per implementation/)
```

---

## The 12 Subsystems (in dependency order)

### PHASE 1: Measure & Build Foundation

#### 1. `gap-analysis.md` — READ THIS FIRST
- **What:** Audit of P0/P1/P2/P3 gaps, duplicates, conflicts, build order.
- **Why:** Tells you why each file exists and in what order to build.
- **Key output:** "P0 = attribution + events. P1 = activation + scoring + referral. P2 = health + dashboards + campaigns. P3 = onboarding + retention."
- **Use by AI:** "Which subsystem do I generate next?" → read gap-analysis build order.

#### 2. `attribution/` (6 files)
- **Files:** `attribution-architecture.md`, `data-model.md`, `events.md`, `dashboards.md`, `content-attribution.md`, `implementation-plan.md`
- **What:** Multi-touch attribution across 8 channels (IG, WhatsApp, LinkedIn, FB, YouTube, referral, organic, paid).
- **Canonical entities:** TOUCHPOINT, ATTRIBUTION_PATH, MKT_EVENT (16 fields).
- **Content chain:** reel (`OPP-*`) → impression → engagement → DM → demo → trial → activation → paid → referral → expansion.
- **Metric IDs:** `M-CA-*` (CAC), `M-E-CA-*` (effective CAC), `M-C-ROI` (content ROI).
- **Use by AI:** To generate content, tag it with `OPP-*` and track its attribution weight across all 8 channels.
- **Depends on:** Content OS (`OPP-*` available), technical-designs.md (MKT_EVENT schema).

#### 3. `lead-scoring/` (1 file)
- **File:** `lead-scoring-engine.md`
- **What:** 0–100 lead score = FIT(30) + SOURCE(20) + INTENT(30) + ENGAGEMENT(20).
- **Canonical formula:** explicit signal tables, 14-day half-life decay, bands Hot(≥70)/Warm(40-69)/Cool(20-39)/Cold(<20).
- **Metric ID:** `M-LS-*` (lead score).
- **Use by AI:** Understand how leads are prioritized in the sales process.
- **Depends on:** `sales-os/qualification.md` (bands align with broker qualification framework).

#### 4. `customer-scoring/` (1 file)
- **File:** `customer-health-system.md`
- **What:** Four scores: HEALTH, RISK/CHURN, EXPANSION, REFERRAL. Each triggers an automation.
- **Canonical formulas:** weighted signals + cross-gating rules (e.g., no referral ask if RISK≥30; no upsell if HEALTH<50).
- **Metric IDs:** `M-CH-*` (customer health), `M-CR-*` (churn risk), `M-E-*` (expansion score), `M-R-*` (referral score).
- **Use by AI:** Understand which customers are at-risk vs. expansion candidates.
- **Depends on:** `activation/` (activation signals feed health score).

---

### PHASE 2: Acquisition & Operations

#### 5. `activation/` (5 files)
- **Files:** `activation-framework.md`, `milestones-and-score.md`, `events.md`, `workflows.md`, `implementation.md`
- **What:** Activation framework, milestones (leads imported → first follow-up → first AI call → team invite → property match), activationScore, workflows.
- **Canonical milestones:** 5 events, each with weight.
- **Metric IDs:** `M-A-*` (activation metrics).
- **Use by AI:** Understand what a "successful customer onboarding" looks like.
- **Depends on:** `onboarding/` (product-led checklist), `automations/` (activation automations).

#### 6. `onboarding/` (1 file)
- **File:** `onboarding-system.md`
- **What:** Product-led onboarding (in-app checklist, empty states, setup wizard) + assisted (WhatsApp/email drip).
- **Metrics:** week-1 milestone rate, time-to-aha.
- **Use by AI:** Understand activation surface design.
- **Depends on:** `automations/` (automated nurture sequences).

#### 7. `retention/` (1 file)
- **File:** `retention-system.md`
- **What:** Lifecycle retention (engagement loops, habit formation, re-engagement, expansion), dormancy detection, churn automation.
- **Metrics:** DAU/WAU/MAU, feature breadth, NRR.
- **Use by AI:** Understand long-term customer value.
- **Depends on:** `customer-scoring/` (dormancy triggers).

#### 8. `referrals/` (4 files)
- **Files:** `referral-engine.md`, `data-model.md`, `workflows.md`, `backlog.md`
- **What:** Referral engine: lifecycle (issued → clicked → signup → converted → rewarded), double-sided rewards (referrer + referee), anti-abuse.
- **Canonical entities:** REFERRAL, REFERRAL_CODE, REWARD_LEDGER.
- **Metric IDs:** `M-R-*` (referral rate, viral coefficient).
- **Use by AI:** Understand the cheapest CAC channel.
- **Depends on:** `customer-scoring/` (referral score triggers).

#### 9. `campaigns/` (1 file)
- **File:** `campaign-system.md`
- **What:** Unified paid (Meta Lead Ads + CAPI) and organic (`OPP-*` content-as-campaigns) campaign tracking, UTM taxonomy, CAMPAIGN entity.
- **Metric IDs:** `M-CM-*` (campaign metrics), `M-C-ROAS` (ROAS), `M-E-CA-*` (effective CAC).
- **Use by AI:** Understand how paid + organic tie to revenue.
- **Depends on:** `attribution/` (UTM taxonomy), `integrations/` (Meta/CAPI).

#### 10. `automations/` (2 files)
- **Files:** `automation-architecture.md`, `workflow-catalog.md`
- **What:** Event-driven runtime (webhook → MKT_EVENT → SQS → automationEngine with RULE entity, 11-action library). 12 workflows (`WF-01..12`).
- **Canonical entities:** RULE, RULE_RUN, SEQUENCE_ENROLLMENT.
- **Workflows:** Content Published, Comment, DM, Lead Captured, Demo Requested, Demo Completed, Trial Started, Trial Inactive, Customer Activated, Customer At Risk, Referral Generated, Customer Expanded.
- **Use by AI:** Understand what triggers what; how the platform self-operates.
- **Depends on:** all measurement subsystems above (they feed events).

#### 11. `ai-agents/` (1 file)
- **File:** `ai-agent-architecture.md`
- **What:** 6 operating agents (AG-1 Marketing, AG-2 Content, AG-3 Distribution, AG-4 Sales, AG-5 Customer Success, AG-6 Analytics), reconciled with existing 20-agent/6-team roster.
- **Per-agent:** memory (which DynamoDB tables/events), tools (which MCPs), MCP requirements, guardrails (human-in-the-loop for spend/publish).
- **Event subscription:** how agents coordinate.
- **Use by AI:** Understand which agent does what; how to ask for a specific action.
- **Depends on:** `automations/` (workflow execution), `analytics/` (dashboards agents read).

---

### PHASE 3: Reporting & Implementation

#### 12. `analytics/` (8 files)
- **Files:** `dashboard-strategy.md`, `metric-dictionary.md` (canonical), 6 dashboards (executive, marketing, sales, customer-success, product, growth).
- **What:** Metric dictionary (`M-*` IDs, formulas, data sources) is the single source of truth. 6 dashboards reference metrics by ID, each tailored to a role.
- **Canonical source:** `metric-dictionary.md` (70+ metrics: north-star, funnel, CAC, LTV, activation, health, churn, NRR, expansion, referral, operations).
- **Use by AI:** All dashboards pull from this one metric definition; never re-define a metric.
- **Depends on:** all measurement subsystems (they define metrics).

#### 13. `implementation/` (7 files)
- **Files:** `epics/epics.md` (`EP-1..14`), `features/features.md`, `user-stories/user-stories.md`, `technical-designs/technical-designs.md` (entity catalog, GSIs, algorithms), `architecture/architecture.md` (end-state), `coding-backlog/coding-backlog.md` (sprint-sequenced), `roadmaps/roadmap-30-60-90-180.md`.
- **What:** The full engineering spec. Epics drive the build order: `EP-1`/`EP-2` (P0 attribution+events) → `EP-3..6` (P1 activation+scoring) → `EP-7+` (P2 health+dashboards).
- **Canonical source for entities:** `technical-designs.md` (DynamoDB schema, all new entities, GSIs, access patterns).
- **Use by AI:** Developers pull epics → features → stories from here. Understand what engineering work happens next.
- **Depends on:** all subsystems above (each defines what code is needed).

#### 14. `quality-review.md` — VALIDATE BEFORE SHIPPING
- **What:** Phase 15 consistency matrix (IDs aligned, duplicates gone, conflicts resolved).
- **Use by AI:** Verify the whole system is consistent before shipping any content or code.

---

## Single-Source-of-Truth (SSOT) Map

**Always reference these canonical files; never re-define in another file:**

| Concept | Canonical File | ID prefix | What it contains |
|---|---|---|---|
| **Metrics** | `analytics/metric-dictionary.md` | `M-*` | 70+ metric definitions (formula, unit, data source, owner, target) |
| **Entities** | `implementation/technical-designs/technical-designs.md` | — | Full DynamoDB schema (all entities, attributes, GSIs, access patterns) |
| **Workflows** | `automations/workflow-catalog.md` | `WF-*` | 12 end-to-end automations (trigger→conditions→actions) |
| **Epics** | `implementation/epics/epics.md` | `EP-*` | 14 engineering epics (P0→P1→P2 build order) |
| **AI Agents** | `ai-agents/ai-agent-architecture.md` | `AG-*` | 6 operating agents + memory/tools/guardrails |
| **Attribution** | `attribution/attribution-architecture.md` | — | 8-channel chain, content→customer ROI |
| **Lead Score** | `lead-scoring/lead-scoring-engine.md` | — | Explicit formula (FIT/SOURCE/INTENT/ENGAGEMENT) + bands |
| **Customer Health** | `customer-scoring/customer-health-system.md` | — | 4 scores (HEALTH, RISK, EXPANSION, REFERRAL) + cross-gating |
| **Activation** | `activation/activation-framework.md` | — | Milestones + score + aha moment + product checklist |
| **Referral** | `referrals/referral-engine.md` | — | Engine (lifecycle, rewards, anti-abuse) + metrics |
| **Campaigns** | `campaigns/campaign-system.md` | — | Paid + organic campaign model, UTM taxonomy |

> Content-generation IDs (`FW-*`, `CH-*`, `HK-*`, `CTA-*`, `OPP-*`, `VP-*`, `HF-*`, `CT-*`) are canonical in the **Content OS** layer, not here. See `../README.md` and `../production-sop/`.

---

## How an AI Agent Uses This Index

1. **Load:** Read `gap-analysis.md` to know the build order and why each subsystem exists.
2. **Understand structure:** "Measurement subsystems measure X. Automation subsystem executes Y. Implementation specifies how."
3. **Generate content:** Pick a subsystem (e.g., activation). Read its canonical files. Understand the metrics, workflows, milestones. Generate an Instagram reel about activation using `FW-*` + `CH-*` + `HK-*` from the Content OS, then run the Content Factory (`../production-sop/10-content-factory.md`).
4. **Cross-reference:** When writing about lead scoring, always reference `lead-scoring-engine.md` (canonical formula), not a summary in another file.
5. **Tag for downstream:** Every piece should reference the subsystem it's teaching or the metric it's supporting (e.g., reel tagged `M-LS-01` links to the lead-scoring metric it's educating on).

---

## How to Fetch Folders (agent fetch logic)

```
TASK = "create content about <topic>"  → resolve <topic> to a SUBSYSTEM in the table above
  → read that subsystem's canonical file (SSOT Map)
  → read Content OS engine (../production-sop/11-prompt-library.md UNIVERSAL LOADER)
  → run Content Factory; tag output with OPP-* + the subsystem's M-* metric

TASK = "what do we build next"          → read gap-analysis.md + implementation/roadmaps/roadmap-30-60-90-180.md
TASK = "define/lookup a metric"         → read ONLY analytics/metric-dictionary.md
TASK = "add a DB field / entity"        → read ONLY implementation/technical-designs/technical-designs.md
TASK = "what fires when X happens"      → read ONLY automations/workflow-catalog.md (WF-*)
TASK = "which agent does X"             → read ONLY ai-agents/ai-agent-architecture.md (AG-*)
TASK = "is the system consistent"       → read quality-review.md
```

---

## File Map (all 42 files)

```
growth-platform/
├── master-index.md                                 ← THIS FILE (AI navigation)
├── user-guide.md                                   ← Human guide (how to use + what's next)
├── gap-analysis.md                                 ← START HERE (build order)
├── README.md                                       ← System summary
├── quality-review.md                               ← Phase 15 validation
├── attribution/
│   ├── attribution-architecture.md                 (8 channels)
│   ├── data-model.md                               (TOUCHPOINT entity)
│   ├── events.md                                   (16 MKT_EVENT fields)
│   ├── dashboards.md                               (attribution views)
│   ├── content-attribution.md                      (OPP-* → customer chain)
│   └── implementation-plan.md                      (EP-1/EP-2 tie-in)
├── activation/
│   ├── activation-framework.md                     (5 milestones)
│   ├── milestones-and-score.md                     (weights + formula)
│   ├── events.md                                   (activation events)
│   ├── workflows.md                                (5 automations)
│   └── implementation.md                           (in-app + assisted)
├── onboarding/
│   └── onboarding-system.md                        (product-led + email drip)
├── retention/
│   └── retention-system.md                         (DAU/WAU, churn loops)
├── lead-scoring/
│   └── lead-scoring-engine.md                      (0–100 formula)
├── customer-scoring/
│   └── customer-health-system.md                   (4 scores + cross-gating)
├── referrals/
│   ├── referral-engine.md                          (lifecycle, rewards)
│   ├── data-model.md                               (REFERRAL entity)
│   ├── workflows.md                                (5 automations)
│   └── backlog.md                                  (engineering stories)
├── campaigns/
│   └── campaign-system.md                          (paid + organic model)
├── integrations/
│   └── integrations.md                             (Meta, WhatsApp, Exotel, etc.)
├── automations/
│   ├── automation-architecture.md                  (RULE engine, 11 actions)
│   └── workflow-catalog.md                         (WF-01..12 workflows)
├── ai-agents/
│   └── ai-agent-architecture.md                    (AG-1..6 + orchestration)
├── analytics/
│   ├── dashboard-strategy.md                       (6 dashboards, roles, RBAC)
│   ├── metric-dictionary.md                        (M-* canonical, 70+ metrics)
│   ├── executive-dashboard.md
│   ├── marketing-dashboard.md
│   ├── sales-dashboard.md
│   ├── customer-success-dashboard.md
│   ├── product-dashboard.md
│   └── growth-dashboard.md
└── implementation/
    ├── epics/epics.md                              (EP-1..14)
    ├── features/features.md
    ├── user-stories/user-stories.md
    ├── technical-designs/technical-designs.md      (canonical entity schema)
    ├── architecture/architecture.md                (end-state AWS/Lambda/DynamoDB)
    ├── coding-backlog/coding-backlog.md            (sprint-sequenced tasks)
    └── roadmaps/roadmap-30-60-90-180.md            (30/60/90/180 plan)
```

---

## Quick Win: Next Immediate Action

**For engineering:** Read `implementation/epics/epics.md`, focus on `EP-1` (lead attribution fields) and `EP-2` (MKT_EVENT ingest). These are the P0 gate; all downstream work (scoring, dashboards, automations) depends on them shipping first.

**For content:** Pick any subsystem (e.g., activation). Read its canonical file. Use `FW-*` frameworks + `CH-*` characters from the Content OS to generate Instagram reels teaching it. Tag the reel with the subsystem's metric IDs.

**For AI agents:** Load this index. For each request, find the relevant subsystem in the file map. Pull its canonical files. Generate accordingly. All content should reference at least one canonical file + one metric ID.

---

## Version
- **Growth Platform v1:** 42 files, 12 subsystems, ~5,000 lines, spec-complete.
- **Last updated:** 2026-06-18.
- **Owner:** Content OS team.
