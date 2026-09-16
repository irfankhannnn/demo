# 01 — Workspace System (Multi-Business Onboarding)

**Purpose:** Make the Content OS reusable. Adding a new business should take *filling in memory*, not rebuilding the engine.

---

## 1. What's Global vs What's Per-Workspace

| Global (reuse as-is) | Per-Workspace (rewrite per business) |
|---|---|
| Framework library (25 frameworks) | Business memory (product, users, features) |
| Character **archetypes** (9 roles) | Character **casting** (names, looks, language) |
| Hook **taxonomy** (12 categories) | Hook **content** (business-specific lines) |
| CTA **taxonomy** (10 categories) | CTA **content** (business-specific offers) |
| Visual system **structure** | Brand colors/fonts (from that brand's kit) |
| Higgsfield mapping logic | Market research + language strategy |
| Content type recipes | Content plan + launch plan |
| Content factory pipeline | — |

**Rule of thumb:** the *shape* is global; the *substance* is per-workspace.

---

## 2. Onboarding a New Business — 7 Steps

```bash
# 1. Clone the workspace template
cp -r workspaces/_TEMPLATE workspaces/<business-slug>
```

2. **Repo/Doc analysis → business memory.** Fill `01-business-memory.md` strictly from the product's code, docs, screenshots. Do not assume features.
3. **Market research.** Fill `02-market-research.md`: geography, ICP behaviour, lead sources, pains, objections, content consumption.
4. **Language strategy.** Fill `03-language-strategy.md`: language mix % with reasoning per market.
5. **Re-cast characters.** Copy the 9 archetypes from `characters/04-character-system.md` and re-skin names/looks/language for the new audience. Keep the *roles*.
6. **Re-skin hooks & CTAs.** Keep the taxonomy; rewrite lines using the new business memory + language strategy.
7. **Content plan + launch.** Generate scored opportunities (`04-content-plan-500`) and a launch sprint (`05-14-day-launch-plan.md`).

After step 7, the global frameworks, visual system, Higgsfield mapping, content-type recipes, and the factory pipeline all work unchanged.

---

## 3. Workspace Template Contract

Every `workspaces/<business>/` MUST contain:

```
workspaces/<business>/
├── 01-business-memory.md      # product, users, features (from code/docs)
├── 02-market-research.md      # market, ICP, lead sources, pains, objections
├── 03-language-strategy.md    # language mix + when-to-use rules
├── 04-content-plan-500.md     # scored opportunities (+ .csv)
└── 05-14-day-launch-plan.md   # the launch sprint
```

Optional but recommended: `assets/` (logos, reference photos), `casting.md` (character overrides if they diverge from global archetypes).

---

## 4. Workspace Switching (runtime)

An agent activates a workspace by setting one variable at the top of its run:

```yaml
ACTIVE_WORKSPACE: realestateflow
```

All prompts in `production-sop/11-prompt-library.md` read `workspaces/{{ACTIVE_WORKSPACE}}/*`. Switching businesses = changing this one value.

---

## 5. Isolation Guarantees

- No workspace file may reference another workspace's facts.
- Global files must never hardcode a single business's product facts (RealEstateFlow specifics live in its workspace, not in `frameworks/` or `production-sop/`).
- Brand colors/fonts come from each business's own brand kit; the visual-system file references the *active* brand kit, not a fixed palette.

> This isolation is what lets one OS serve many businesses without cross-contamination.
