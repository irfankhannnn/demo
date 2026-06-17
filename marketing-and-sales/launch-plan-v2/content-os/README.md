# RealEstateFlow Content OS

> **The permanent Content Operating System for RealEstateFlow — and the reusable foundation for every future business.**

This is not a content folder. It is an **operating system**. A new AI agent (Claude, Cursor, Devin) should be able to read this OS and generate consistent characters, branding, language, visuals, hooks, and CTAs **without manual prompt engineering**.

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
| `frameworks/03-framework-library.md` | 25 reusable content frameworks | 3 |
| `characters/04-character-system.md` | 9 permanent recurring characters | 4 |
| `visual-system/05-visual-system.md` | Camera, light, color, motion, thumbnails | 5 |
| `higgsfield/06-higgsfield-production-guide.md` | Higgsfield MCP/Skills/Supercomputer mapping | 6 |
| `hooks/07-hook-library.md` + `hooks.json` | 1,000 reusable hooks | 7 |
| `ctas/08-cta-library.md` + `ctas.json` | 500 reusable CTAs | 8 |
| `production-sop/09-content-type-system.md` | 10 content-type generation recipes | 9 |
| `production-sop/10-content-factory.md` | The end-to-end production pipeline | 10 |
| `production-sop/11-prompt-library.md` | Copy-paste prompts for Claude/Cursor/Devin | 11 |
| `workspaces/realestateflow/01-business-memory.md` | What RealEstateFlow is (from code) | Repo analysis |
| `workspaces/realestateflow/02-market-research.md` | Mumbai & Pune market research | 1 |
| `workspaces/realestateflow/03-language-strategy.md` | Marathi/Hindi/English mix | 2 |
| `workspaces/realestateflow/04-content-plan-500.md` + `.csv` | 500+ scored content opportunities | 12 |
| `workspaces/realestateflow/05-14-day-launch-plan.md` | The launch sprint | 12 |

---

## ▶️ Quick Start (for an AI agent)

1. **Load global engine:** read everything in `global/`, `frameworks/`, `characters/`, `visual-system/`, `hooks/`, `ctas/`, `production-sop/`.
2. **Load workspace:** read everything in `workspaces/realestateflow/`.
3. **Run the factory:** follow `production-sop/10-content-factory.md`.
4. **Use a ready prompt:** copy from `production-sop/11-prompt-library.md`, paste, generate.

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

**Brand truth (do not violate):** Primary `#2563EB`, font Inter, Hinglish (70% English / 30% romanized Hindi), mobile-first, India-first (₹, lakh, crore, RERA). Full brand kit: `/.brand/brand-kit.md`. Positioning: `/.brand/positioning.md`.
