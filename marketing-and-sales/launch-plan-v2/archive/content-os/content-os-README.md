# RealEstateFlow Content OS

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/README.md` (the single entry point). This file was the Content OS root README; its folder map is superseded by the six numbered layers.

> **The permanent Content Operating System for RealEstateFlow — and the reusable foundation for every future business.**

This is not a content folder. It is an **operating system**. A new AI agent (Claude, Cursor, Devin) should be able to read this OS and generate consistent characters, branding, language, visuals, hooks, and CTAs **without manual prompt engineering**.

> **New here? Start with the two entry files:**
> - **`master-index.md`** — AI-agent navigation across all 3 systems (Content OS, GTM OS, Growth Platform): every folder, stable-ID registry, single-source-of-truth map, and fetch logic.
> - **`user-guide.md`** — the human manual: how to use each system end-to-end, the build order, who owns what, and what to build next.

---

## 🧠 How the Content OS Thinks

```
                     ┌─────────────────────────┐
                     │     GLOBAL (engine)     │
                     │  frameworks · characters │
                     │  hooks · ctas · visuals  │
                     │  higgsfield · SOPs       │
                     └────────────┬─────────────┘
                                  │ loaded by every job
                                  ▼
                     ┌─────────────────────────┐
                     │   WORKSPACE (business)   │
                     │  business memory · market│
                     │  language · content plan │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   CONTENT FACTORY (SOP)  │
                     │  memory → framework →     │
                     │  character → hook →       │
                     │  script → scene →         │
                     │  higgsfield → caption →   │
                     │  cta → publish            │
                     └─────────────────────────┘
```

The **GLOBAL** layer is business-agnostic and reusable. The **WORKSPACE** layer holds everything specific to one business. To onboard a new business, you copy the workspace template and fill in its memory — the entire global engine works instantly.

---

## 📂 Directory Map

| Path | Purpose | Phase |
|---|---|---|
| `global/00-content-os-overview.md` | How the whole system fits together | — |
| `global/01-workspace-system.md` | How to onboard a new business workspace | — |
| `marketing-and-sales/launch-plan-v2/20-content-engine/framework-library.md` | 25 reusable content frameworks | 3 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/cast-and-presenter.md` | 9 permanent recurring characters | 4 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/visual-system.md` | Camera, light, color, motion, thumbnails | 5 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-guide.md` | Higgsfield MCP/Skills/Supercomputer mapping | 6 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/hooks/hook-library.md` + `hooks.json` | 1,000 reusable hooks | 7 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/ctas/cta-library.md` + `ctas.json` | 500 reusable CTAs | 8 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/content-types.md` | 10 content-type generation recipes | 9 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md` | The end-to-end production pipeline | 10 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md` | Copy-paste prompts for Claude/Cursor/Devin | 11 |
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/product-truth.md` | What RealEstateFlow is (from code) | Repo analysis |
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/market-research.md` | Mumbai & Pune market research | 1 |
| `marketing-and-sales/launch-plan-v2/10-audience-and-voice/language-and-tone.md` | Marathi/Hindi/English mix | 2 |
| `marketing-and-sales/launch-plan-v2/20-content-engine/content-plan/content-plan-500.md` + `.csv` | 500+ scored content opportunities | 12 |
| `workspaces/realestateflow/05-14-day-launch-plan.md` | The launch sprint | 12 |

---

## ▶️ Quick Start (for an AI agent)

1. **Load global engine:** read everything in `global/`, `frameworks/`, `characters/`, `visual-system/`, `hooks/`, `ctas/`, `production-sop/`.
2. **Load workspace:** read everything in `workspaces/realestateflow/`.
3. **Run the factory:** follow `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md`.
4. **Use a ready prompt:** copy from `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`, paste, generate.

> Every framework, character, hook, CTA, and visual rule has a **stable ID** (e.g. `FW-PAS`, `CH-OWNER`, `HK-FEAR-001`, `CTA-DEMO-001`). Scripts and the content plan reference these IDs so the system stays composable.

---

## 🔁 Reuse for Future Businesses

To add "Business B":
```
cp -r workspaces/_TEMPLATE workspaces/businessB
# fill in business memory, market research, language strategy, content plan
```
The global frameworks, characters scaffold, hooks taxonomy, CTA taxonomy, visual system, and Higgsfield mapping all carry over. See `global/01-workspace-system.md`.

---

**Brand truth (do not violate):** Primary `#2563EB`, font Inter, Hinglish (70% English / 30% romanized Hindi), mobile-first, India-first (₹, lakh, crore, RERA). Full brand kit: `marketing-and-sales/creative/realestateflow-launch/brand-kit.md`. Positioning: `marketing-and-sales/realestateflow/BRAND-POSITIONING.md`.

---

## 🚀 GTM OS (Acquire & Convert)

The Content OS *generates* content. The **GTM OS** wraps it to acquire and convert customers, and to measure + automate growth. See **`GTM-OS-README.md`**.

| Layer | Folder | Job |
|---|---|---|
| Attention OS | `attention-os/` | Capture attention → conversations |
| Distribution OS | `distribution-os/` (+ `instagram/ whatsapp/ linkedin/`) | Distribute + founder engine |
| Sales OS | `sales-os/` | Qualify → demo → close → onboard → referral |
| Automation OS | `automation-os/` | Attribution, automations, scoring (in-product) |
| Engineering | `implementation/` | Build the in-product GTM features |
| KPIs | `growth-dashboard.md` | The growth scoreboard |
| Roadmap | `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` | Sequenced 30/60/90 execution |

---

## 🌱 Growth Platform (Operationalize & Scale)

The GTM OS designs the motion; the **Growth Platform** turns it into measured, automatable, engineering-backed systems — attribution, activation, scoring, referrals, campaigns, automation runtime, AI agents, dashboards, and a full engineering backlog/roadmap. See **`growth-platform/README.md`** (audit in `growth-platform/gap-analysis.md`, consistency in `growth-platform/quality-review.md`).

| Subsystem | Folder |
|---|---|
| Attribution + content attribution | `growth-platform/attribution/` |
| Activation / onboarding / retention | `growth-platform/{activation,onboarding,retention}/` |
| Lead + customer scoring | `growth-platform/{lead-scoring,customer-scoring}/` |
| Referrals · campaigns · integrations | `growth-platform/{referrals,campaigns,integrations}/` |
| Automation runtime + 12 workflows | `growth-platform/automations/` |
| 6 AI operating agents | `growth-platform/ai-agents/` |
| Metric dictionary + 6 dashboards | `growth-platform/analytics/` |
| Engineering epics→backlog→roadmaps (30/60/90/180) | `growth-platform/implementation/` |
