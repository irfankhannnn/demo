# Content OS — Master Index for AI Agents

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/README.md`. Its stable-ID namespace table survives there; the rest of its navigation is superseded.

> **The single navigation file for the entire system.** Load this first. It maps all **3 operating systems** (Content OS, GTM OS, Growth Platform), every folder and file, every stable-ID namespace, the single-source-of-truth for each concept, and the exact fetch logic an AI agent uses to create content or pull a configuration.

**Root:** `marketing-and-sales/launch-plan-v2/content-os/`
**Companion:** `user-guide.md` (the human walkthrough — how to operate this and what to build next).

---

## 0. The 3 Systems at a Glance

```
        CONTENT OS  ──►  GTM OS  ──────────────────────►  GROWTH PLATFORM
        (generate)       (acquire + convert)               (measure + scale)
            │                 │                                  │
   frameworks·characters   attention·distribution        attribution·scoring
   hooks·ctas·visual       ·sales·automation             ·activation·referrals
   ·higgsfield·factory     ·engineering·dashboard         ·automations·ai-agents
   ·workspaces             ·roadmap                        ·analytics·implementation
            └───────────────────── one brand, one ID system ──────────────────┘
```

| # | System | Folder(s) | Job | Status |
|---|---|---|---|---|
| **1** | **Content OS** | `global/ frameworks/ characters/ visual-system/ higgsfield/ hooks/ ctas/ production-sop/ workspaces/` | Generate consistent on-brand content at scale | Spec + assets ready |
| **2** | **GTM OS** | `attention-os/ distribution-os/ sales-os/ automation-os/ implementation/` + `GTM-OS-README.md growth-dashboard.md marketing-and-sales/launch-plan-v2/month-2-plus/README.md` | Acquire attention → distribute → convert → automate | Spec ready |
| **3** | **Growth Platform** | `growth-platform/` (12 subsystems, 42 files) | Attribution, scoring, activation, referrals, dashboards, engineering backlog | Spec-complete |

**The flow:** Content OS *makes* the reel → GTM OS *distributes & converts* it → Growth Platform *measures & scales* the whole motion, feeding learnings back to Content OS.

---

## 1. SYSTEM 1 — CONTENT OS (generate)

The reusable engine. A fresh agent loads it and produces brand-correct content with **zero additional briefing**. Two tiers: a business-agnostic **global engine** and a per-business **workspace**.

### 1A. Global engine (reusable across all businesses)

| File | Purpose | Canonical for |
|---|---|---|
| `global/00-content-os-overview.md` | Design principles + object model + runtime contract | The whole mental model |
| `global/01-workspace-system.md` | How to onboard a new business workspace | Multi-business reuse |
| `marketing-and-sales/launch-plan-v2/20-content-engine/framework-library.md` | 25 reusable content frameworks | `FW-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/cast-and-presenter.md` | 9 permanent recurring characters + consistency prompts | `CH-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/visual-system.md` | Camera, light, color, motion, thumbnail presets | `VP-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-guide.md` | Framework → Higgsfield workflow mapping + premium/negative prompt blocks | `HF-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-skills.md` | Reusable slash-workflow Skills (`/realestateflow-*`) — one brief → finished reel | `HF-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/hooks/hook-library.md` + `hooks.json` | 1,000 reusable hooks (taxonomy + data) | `HK-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/ctas/cta-library.md` + `ctas.json` | 500 reusable CTAs (taxonomy + data) | `CTA-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/content-types.md` | 10 content-type generation recipes | `CT-*` |
| `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md` | **The end-to-end production pipeline (runtime)** | The build process |
| `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md` | Copy-paste prompts (Claude/Cursor/Devin) + Universal Loader | Agent entry point |

### 1B. Workspace (one per business)

| File | Purpose |
|---|---|
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/product-truth.md` | What RealEstateFlow is (from code) — every content claim traces here |
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/market-research.md` | Mumbai & Pune market, ICP, peak windows |
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/language-and-tone.md` | Marathi/Hindi/English mix rules |
| `marketing-and-sales/launch-plan-v2/20-content-engine/content-plan/content-plan-500.md` + `.csv` | 500+ scored content opportunities (`OPP-*`) |
| `workspaces/realestateflow/05-14-day-launch-plan.md` | The launch sprint |
| `workspaces/_TEMPLATE/*` (8 files) | Copy to onboard a new business; same global engine reused |

### 1C. How an agent generates content (runtime contract)

```
1 READ   global/* + workspaces/{ACTIVE_WORKSPACE}/*        # load memory
2 PICK   a content opportunity (OPP-*) or brief            # confirm claim ∈ business-memory §3
3 SELECT framework (FW-*) + character(s) (CH-*)            # structure + cast
4 SELECT hook (HK-*) + cta (CTA-*)                         # open + close
5 WRITE  script (framework structure + language strategy)
6 BUILD  scene list (visual presets VP-*)
7 GENER. via Higgsfield workflow (HF-*) mapped to FW-*
8 WRITE  caption + hashtags + assign CTA
9 LOG    the piece as a recipe of IDs                       # workspaces/<biz>/recipe-log.md
```
Implemented step-by-step in `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md`. Ready-made prompts in `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`.

---

## 2. SYSTEM 2 — GTM OS (acquire + convert)

Wraps the Content OS to capture attention, distribute, convert, and automate. Read `GTM-OS-README.md` for the overview. Four layers + engineering + scoreboard + roadmap.

### 2A. Attention OS — `attention-os/` (capture attention → conversations)
| File | Purpose |
|---|---|
| `attention-model.md` | How attention is won (scroll-stop → hold → act) |
| `audience-research.md` | Where attention lives (platforms, formats, timing) |
| `content-to-conversation.md` | Turn viewers into DMs / replies |
| `virality-engine.md` | Share/save triggers, loops |
| `retention-engine.md` | Keep attention across pieces (series, hooks) |

### 2B. Distribution OS — `distribution-os/` (distribute + founder engine)
- **Channel playbooks (top level):** `instagram.md`, `whatsapp.md`, `linkedin.md`, `youtube.md`, `facebook.md`, `founder-brand.md`, `founder-engine.md`
- **`instagram/` (10):** `90-day-growth-strategy.md`, `content-cadence.md`, `reels.md`, `carousels.md`, `stories.md`, `comments.md`, `dm-workflows.md`, `broadcast-channels.md`, `growth-loops.md`, `follower-to-demo.md`
- **`whatsapp/` (8):** `_README.md`, `message-templates.md`, `lead-nurture.md`, `demo-followup.md`, `customer-success.md`, `community.md`, `founder-broadcast.md`, `referral.md`

### 2C. Sales OS — `sales-os/` (qualify → demo → close → onboard → referral)
| File | Purpose | Canonical for |
|---|---|---|
| `customer-journey.md` | End-to-end stages DM→paid→referral | The funnel map |
| `qualification.md` | Lead qualification framework + bands | **Lead-scoring bands** (Growth Platform aligns here) |
| `demo-script.md` | Demo flow | — |
| `objections.md` | Objection handling | — |
| `closing-script.md` | Close | — |
| `onboarding-script.md` | Post-sale onboarding | — |
| `followup-script.md` | Follow-up cadence | — |

### 2D. Automation OS — `automation-os/` (measure + automate in-product)
| File | Purpose |
|---|---|
| `architecture.md` | Event/automation architecture (origin of the runtime) |
| `workflow-map.md` | The original workflow map (superseded + extended by `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md`) |
| `integrations.md` | External integrations (Meta, WhatsApp, Exotel…) |
| `implementation-plan.md` | How it gets built |

### 2E. GTM Engineering — `implementation/` (top level, 10 files)
Make RealEstateFlow itself power the GTM motion (additive, multi-tenant, reuse notification engine). **7 epics.**
`README.md` · `epics.md` · `user-stories.md` · `engineering-tasks.md` · `technical-design.md` · `api-requirements.md` · `database-requirements.md` · `ui-requirements.md` · `infrastructure-requirements.md` · `backlog.md`
> **Read order:** `epics.md` → `technical-design.md` → `database-requirements.md` + `api-requirements.md` → `ui-requirements.md` → `engineering-tasks.md` → `backlog.md`.
> **Confirmed gap (from code):** leads have no source/UTM/attribution/score today — this is the P0 work.

### 2F. Scoreboard + Roadmap
- `growth-dashboard.md` — the GTM KPI scoreboard.
- `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` — sequenced 30/60/90 GTM execution.

---

## 3. SYSTEM 3 — GROWTH PLATFORM (measure + scale)

Operationalizes the GTM motion into measured, automatable, engineering-backed systems. **42 files, 12 subsystems.** Full internal detail lives in `growth-platform/README.md` and `growth-platform/gap-analysis.md`.

| # | Subsystem | Folder | Canonical file | ID(s) |
|---|---|---|---|---|
| 1 | Gap analysis (read first) | `growth-platform/` | `gap-analysis.md` | build order |
| 2 | Attribution (8 channels) | `attribution/` | `attribution-architecture.md` | `M-CA-*`, MKT_EVENT |
| 3 | Lead scoring (0–100) | `lead-scoring/` | `lead-scoring-engine.md` | `M-LS-*` |
| 4 | Customer scoring (4 scores) | `customer-scoring/` | `customer-health-system.md` | `M-CH/CR/E/R-*` |
| 5 | Activation (5 milestones) | `activation/` | `activation-framework.md` | `M-A-*` |
| 6 | Onboarding (PLG + assisted) | `onboarding/` | `onboarding-system.md` | — |
| 7 | Retention (lifecycle) | `retention/` | `retention-system.md` | NRR/DAU |
| 8 | Referrals (double-sided) | `referrals/` | `referral-engine.md` | `M-R-*` |
| 9 | Campaigns (paid+organic) | `campaigns/` | `campaign-system.md` | `M-CM-*` |
| 10 | Automations (runtime + 12 WF) | `automations/` | `workflow-catalog.md` | `WF-01..12` |
| 11 | AI agents (6 operating) | `ai-agents/` | `ai-agent-architecture.md` | `AG-1..6` |
| 12 | Analytics (dict + 6 dashboards) | `analytics/` | `metric-dictionary.md` | `M-*` |
| 13 | Implementation (14 epics→roadmap) | `implementation/` | `epics/epics.md` + `technical-designs/` | `EP-1..14` |
| — | Integrations registry | `integrations/` | `integrations.md` | — |
| — | Consistency validation | `growth-platform/` | `quality-review.md` | — |

> The Growth Platform's own `master-index.md`/`user-guide.md` were consolidated up to this root pair. For deep per-subsystem navigation use `growth-platform/README.md`.

---

## 4. Stable-ID Registry (the composable namespace)

Every reusable object has a stable ID so a finished piece — or a metric, workflow, or epic — is just a recipe of IDs.

| ID prefix | Object | Canonical home | Count |
|---|---|---|---|
| `FW-*` | Framework | `marketing-and-sales/launch-plan-v2/20-content-engine/framework-library.md` | 25 |
| `CH-*` | Character | `marketing-and-sales/launch-plan-v2/20-content-engine/cast-and-presenter.md` | 9 |
| `HK-*` | Hook | `marketing-and-sales/launch-plan-v2/20-content-engine/hooks/hooks.json` | 1,000 |
| `CTA-*` | CTA | `marketing-and-sales/launch-plan-v2/20-content-engine/ctas/ctas.json` | 500 |
| `VP-*` | Visual preset | `marketing-and-sales/launch-plan-v2/20-content-engine/visual-system.md` | — |
| `HF-*` | Higgsfield workflow | `marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-guide.md` | — |
| `CT-*` | Content type | `marketing-and-sales/launch-plan-v2/20-content-engine/content-types.md` | 10 |
| `OPP-*` | Content opportunity | `workspaces/<biz>/04-content-plan-500.*` | 500+ |
| `M-*` | Metric | `marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md` | 70+ |
| `WF-*` | Workflow | `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md` | 12 |
| `AG-*` | AI operating agent | `growth-platform/ai-agents/ai-agent-architecture.md` | 6 |
| `EP-*` | Engineering epic | `growth-platform/implementation/epics/epics.md` (14) + `implementation/epics.md` (7) | 14 / 7 |

---

## 5. Single-Source-of-Truth (SSOT) Map

**Always reference these canonical files; never re-define a concept elsewhere.**

| Concept | Canonical file |
|---|---|
| Object model & principles | `global/00-content-os-overview.md` |
| Multi-business onboarding | `global/01-workspace-system.md` |
| Brand truth (colors/font/lang) | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` + `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` (upstream of everything) |
| Content production pipeline | `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md` |
| Business facts / feature claims | `workspaces/<biz>/01-business-memory.md` |
| Lead qualification bands | `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/qualification.md` |
| Metrics | `marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md` |
| Entities / DB schema | `growth-platform/implementation/technical-designs/technical-designs.md` |
| Automation workflows | `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md` |
| Growth engineering epics | `growth-platform/implementation/epics/epics.md` |
| GTM engineering epics | `implementation/epics.md` |
| Attribution | `marketing-and-sales/launch-plan-v2/50-measurement/attribution-today.md` |
| Lead score formula | `marketing-and-sales/launch-plan-v2/50-measurement/prospect-lead-scoring.md` |
| Customer health | `marketing-and-sales/launch-plan-v2/50-measurement/customer-health.md` |

---

## 6. Agent Fetch Logic (how to resolve any task to the right files)

```
TASK = "create <content type> about <topic>"
  → load marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md  (UNIVERSAL LOADER auto-loads the engine)
  → if <topic> maps to a Growth Platform subsystem, read its canonical file (§3) for accuracy
  → run marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md Steps 1–9
  → output recipe (IDs) + script + scenes + Higgsfield prompts + caption + CTA
  → tag with OPP-* and the relevant M-* metric; log the recipe

TASK = "onboard a new business"        → global/01-workspace-system.md + cp workspaces/_TEMPLATE
TASK = "distribute on <channel>"       → distribution-os/<channel>.md (+ its subfolder)
TASK = "handle the sale / demo"        → sales-os/ (customer-journey → qualification → demo → close)
TASK = "what fires when X happens"     → marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md (WF-*)
TASK = "define / look up a metric"     → marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md (M-*)  [only here]
TASK = "add a DB field / entity"       → growth-platform/implementation/technical-designs/technical-designs.md
TASK = "which agent does X"            → growth-platform/ai-agents/ai-agent-architecture.md (AG-*)
TASK = "what do we build next"         → growth-platform/gap-analysis.md + implementation roadmaps
TASK = "is the system consistent"      → growth-platform/quality-review.md
```

**Output discipline (all agents):** only claim features in `business-memory §3`; Hinglish 70/30 (+ Marathi per language strategy); ₹/lakh/crore; recurring `CH-*` only with consistency prompts; one `FW-*` per piece; hook visual ≤1s; subtitles always; brand `#2563EB` + Inter + 9:16; always emit the recipe so the piece is reproducible.

---

## 7. Complete File Tree (~100 files)

```
content-os/
├── master-index.md                     ← THIS FILE (AI navigation, all 3 systems)
├── user-guide.md                       ← Human guide (how to use + what to build next)
├── README.md                           ← Content OS overview
├── GTM-OS-README.md                    ← GTM OS overview
├── growth-dashboard.md                 ← GTM KPI scoreboard
├── marketing-and-sales/launch-plan-v2/month-2-plus/README.md                 ← GTM execution roadmap
│
│  ── SYSTEM 1: CONTENT OS ──
├── global/{00-content-os-overview, 01-workspace-system}.md
├── marketing-and-sales/launch-plan-v2/20-content-engine/framework-library.md                      (FW-*)
├── marketing-and-sales/launch-plan-v2/20-content-engine/cast-and-presenter.md                       (CH-*)
├── marketing-and-sales/launch-plan-v2/20-content-engine/visual-system.md                       (VP-*)
├── marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-guide.md            (HF-*)
├── marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-skills.md                      (HF-* slash workflows)
├── hooks/{07-hook-library.md, hooks.json}                  (HK-*, 1000)
├── ctas/{08-cta-library.md, ctas.json}                     (CTA-*, 500)
├── production-sop/{09-content-type-system, 10-content-factory, 11-prompt-library}.md
├── workspaces/_TEMPLATE/{README, 01-business-memory, 02-market-research,
│                         03-language-strategy, casting, 04-content-plan-500(.md/.csv),
│                         05-14-day-launch-plan}
├── workspaces/realestateflow/{01-business-memory, 02-market-research,
│                              03-language-strategy, 04-content-plan-500(.md/.csv),
│                              05-14-day-launch-plan}
│
│  ── SYSTEM 2: GTM OS ──
├── attention-os/{attention-model, audience-research, content-to-conversation,
│                 virality-engine, retention-engine}.md
├── distribution-os/{instagram, whatsapp, linkedin, youtube, facebook,
│                    founder-brand, founder-engine}.md
│   ├── instagram/{90-day-growth-strategy, content-cadence, reels, carousels, stories,
│   │             comments, dm-workflows, broadcast-channels, growth-loops, follower-to-demo}.md
│   └── whatsapp/{_README, message-templates, lead-nurture, demo-followup,
│                 customer-success, community, founder-broadcast, referral}.md
├── sales-os/{customer-journey, qualification, demo-script, objections,
│             closing-script, onboarding-script, followup-script}.md
├── automation-os/{architecture, workflow-map, integrations, implementation-plan}.md
├── implementation/{README, epics, user-stories, engineering-tasks, technical-design,
│                   api-requirements, database-requirements, ui-requirements,
│                   infrastructure-requirements, backlog}.md          (7 GTM epics)
│
│  ── SYSTEM 3: GROWTH PLATFORM ──
└── growth-platform/   (42 files, 12 subsystems — see growth-platform/README.md)
    ├── README.md · gap-analysis.md · quality-review.md
    ├── attribution/ (6)   · activation/ (5)   · onboarding/ (1) · retention/ (1)
    ├── lead-scoring/ (1)  · customer-scoring/ (1) · referrals/ (4) · campaigns/ (1)
    ├── integrations/ (1)  · automations/ (2)  · ai-agents/ (1)  · analytics/ (8)
    └── implementation/ (7: epics, features, user-stories, technical-designs,
                            architecture, coding-backlog, roadmaps/30-60-90-180)
```

---

## 8. Quick Start (for an AI agent)

1. **Orient:** read this `master-index.md` → know the 3 systems and the SSOT map.
2. **To generate content:** open `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`, copy the Universal Loader + a task prompt, run the factory. Tag output with `OPP-*` + `M-*`.
3. **To distribute/convert:** read the relevant `distribution-os/` channel + `sales-os/` stage.
4. **To measure/build:** read `growth-platform/gap-analysis.md`, then the subsystem's canonical file, then `growth-platform/implementation/epics/epics.md`.
5. **Never** re-define a metric, entity, or workflow — reference the SSOT file (§5).

---

## Version
- **System:** Content OS + GTM OS + Growth Platform — ~100 files, spec-complete.
- **Brand truth:** `#2563EB`, Inter, Hinglish 70/30 (+Marathi), mobile-first, India-first (₹/lakh/crore/RERA).
- **Last updated:** 2026-06-18. **Owner:** Content OS team.
