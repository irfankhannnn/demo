# 00 — Content OS Overview

**Purpose:** Define the operating principles, layers, and object model that make this a *system*, not a content dump.

---

## 1. Design Principles

1. **Memory over prompts.** Knowledge lives in files (business memory, characters, frameworks). Agents *load* memory; they don't re-invent it each time.
2. **Composable IDs.** Every reusable object has a stable ID. A reel is just: `FW-* + CH-* + HK-* + CTA-* + visual preset + Higgsfield workflow`.
3. **Global vs Workspace separation.** Reusable engine in `global/` etc.; business-specific facts in `workspaces/<business>/`.
4. **Consistency by default.** Characters, colors, camera, language ratios are pre-decided so output looks like one brand without manual tuning.
5. **One source of brand truth.** `/.brand/brand-kit.md` + `/.brand/positioning.md` are upstream of everything here. Never contradict them.
6. **Production-ready, not theoretical.** Every framework maps to a Higgsfield workflow; every content type maps to frameworks + characters + CTA + language.

---

## 2. The Object Model

| Object | ID prefix | Lives in | Count |
|---|---|---|---|
| Framework | `FW-` | `frameworks/` | 25 |
| Character | `CH-` | `characters/` | 9 |
| Hook | `HK-<CATEGORY>-NNN` | `hooks/` | 1,000 |
| CTA | `CTA-<CATEGORY>-NNN` | `ctas/` | 500 |
| Visual preset | `VP-` | `visual-system/` | — |
| Higgsfield workflow | `HF-` | `higgsfield/` | — |
| Content type | `CT-` | `production-sop/` | 10 |
| Content opportunity | `OPP-NNN` | `workspaces/<biz>/` | 500+ |

**A finished piece = a recipe of IDs.** Example:
```yaml
piece: "WhatsApp pe lead kho gaya"
type: CT-DRAMA
framework: FW-WHATSAPP-CHAOS
characters: [CH-OWNER, CH-SALESMGR]
hook: HK-WHATSAPP-014
cta: CTA-DEMO-007
language: hi-dominant
visual_preset: VP-DRAMA-OFFICE
higgsfield: HF-DRAMA-DIALOGUE
```

---

## 3. The Three Layers

### Layer 1 — GLOBAL ENGINE (reusable across all businesses)
`frameworks/`, `characters/` (scaffold + archetypes), `hooks/` (taxonomy), `ctas/` (taxonomy), `visual-system/`, `higgsfield/`, `production-sop/`.

> Note: characters and hooks/CTAs ship pre-filled for RealEstateFlow because that's the first business, but the *structure* (archetypes, categories, fields) is the reusable part. New businesses re-skin the same archetypes.

### Layer 2 — WORKSPACE (one per business)
`workspaces/<business>/`: business memory, market research, language strategy, content plan, launch plan. This is what changes per business.

### Layer 3 — CONTENT FACTORY (the runtime)
`production-sop/`: the pipeline that consumes Layers 1 & 2 to produce finished content.

---

## 4. How an Agent Uses This OS (runtime contract)

```
1. READ  global/* + the active workspace/*           # load memory
2. PICK  a content opportunity (OPP-) or a brief     # what to make
3. SELECT framework (FW-) + characters (CH-)          # structure + cast
4. SELECT hook (HK-) + cta (CTA-)                     # open + close
5. WRITE script using framework structure + language strategy
6. BUILD scene list using visual-system presets (VP-)
7. GENERATE via Higgsfield workflow (HF-) mapped to the framework
8. WRITE caption + assign CTA + hashtags
9. LOG  the piece as a recipe of IDs (for reuse + analytics)
```

This contract is implemented step-by-step in `production-sop/10-content-factory.md`.

---

## 5. Success Test

The OS passes if a *fresh* agent, given only these files, can produce:
- ✅ The same 9 characters, consistently described
- ✅ Brand-correct colors, fonts, camera, motion
- ✅ Correct language mix for Mumbai/Pune
- ✅ On-brand hooks and CTAs pulled by ID
- ✅ A Higgsfield-ready scene plan

…with **zero additional briefing**.
