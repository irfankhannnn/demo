# 11 — Prompt Library (Claude · Cursor · Devin)

**Copy-paste prompts that auto-load the Content OS** and generate finished content with zero manual prompt engineering. Each prompt instructs the agent to load business/character/visual/framework/hook/CTA memory, then run the content factory.

> All prompts assume the repo root and `ACTIVE_WORKSPACE: realestateflow`. Change that one line to target another business.

---

## 0. The Universal Loader (prepend to ANY prompt)

```
You are the RealEstateFlow Content OS operator. Before doing anything, LOAD this memory and obey it exactly:

- marketing-and-sales/launch-plan-v2/content-os/global/00-content-os-overview.md
- marketing-and-sales/launch-plan-v2/content-os/frameworks/03-framework-library.md
- marketing-and-sales/launch-plan-v2/content-os/characters/04-character-system.md
- marketing-and-sales/launch-plan-v2/content-os/visual-system/05-visual-system.md
- marketing-and-sales/launch-plan-v2/content-os/higgsfield/06-higgsfield-production-guide.md
- marketing-and-sales/launch-plan-v2/content-os/hooks/hooks.json
- marketing-and-sales/launch-plan-v2/content-os/ctas/ctas.json
- marketing-and-sales/launch-plan-v2/content-os/production-sop/09-content-type-system.md
- marketing-and-sales/launch-plan-v2/content-os/production-sop/10-content-factory.md
- marketing-and-sales/launch-plan-v2/content-os/workspaces/realestateflow/01-business-memory.md
- marketing-and-sales/launch-plan-v2/content-os/workspaces/realestateflow/02-market-research.md
- marketing-and-sales/launch-plan-v2/content-os/workspaces/realestateflow/03-language-strategy.md
- .brand/brand-kit.md

Rules: only claim features in business-memory §3; Hinglish 70/30 (+ Marathi per language strategy); ₹/lakh/crore; recurring CH-* characters only with their consistency prompts; one framework per piece; hook visual ≤1s; subtitles always; brand color #2563EB + Inter + 9:16. Output every piece as a Content Factory recipe (IDs) + script + scene list + Higgsfield prompts + caption + CTA. Then STOP and show me.
```

---

## 1. Reel Generation

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} Instagram Reels.
Topic/opportunity: {{OPP-ID or free brief}}
Goal: {{reach | saves | comments | leads | trust}}
Persona: {{Agency Owner | Sales Manager | Young Broker | New Joiner}}
City bias: {{Mumbai | Pune | both}}

For each reel run the Content Factory (Steps 1–9): pick CT-*, FW-*, CH-*, HK-*, write the script (with character lines + emotions), build the scene list with VP-* presets, give the HF-* Higgsfield image/video prompts (character-anchored), write the caption + hashtags, assign a CTA-*. Vary frameworks and characters across the batch. Output as recipe YAML + script + scenes + caption.
```

## 2. Drama / Skit Generation

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} CT-DRAMA reels (office drama / skit) for {{Mumbai|Pune}}.
Use FW-DRAMA / FW-WHATSAPP-CHAOS / FW-SKIT / FW-CONVO. Cast duos from CH-* (e.g. CH-OWNER↔CH-SALESMGR, CH-SALESMGR↔CH-BROKER, CH-NEWBIE↔CH-TEAMLEAD, plus CH-LOSTLEAD).
Language: hi-dominant (mr-dominant for Pune). Structure: setup → conflict (the pain bites) → twist (RealEstateFlow contrast) → punchline → CTA.
Output: recipe YAML, full dialogue script with character + emotion per line, scene list using VP-DRAMA-OFFICE, HF-DRAMA-DIALOGUE prompts per scene (with each character's consistency prompt), caption, CTA-FOLLOW/COMMENT/DEMO. Make it genuinely funny/relatable, not an ad.
```

## 3. UGC Generation

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} CT-UGC reels (authentic creator selfie style) for paid + organic.
Use FW-UGC / FW-PROPERTY / FW-OBJECTION. Character: CH-BROKER or CH-CONSULTANT (selfie POV). Language: hi-dominant/regional.
Output: recipe YAML, spoken script (casual, first-person, "main ek broker hoon…"), scene list VP-UGC-FIELD, HF-UGC-SELFIE prompts, caption, CTA-TRIAL/DEMO/DM. Produce 3 hook variants per concept for ad testing.
```

## 4. Carousel Generation

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} Instagram carousels (CT-EDU or CT-CASE).
Use FW-MISTAKE / FW-CRM / FW-MYTH / FW-LEAD-LEAKAGE / FW-CASE.
Output per carousel: slide-by-slide (Slide 1 = hook cover using VP-THUMB-EDU; slides 2–7 = one point each with on-screen text + visual note; final slide = CTA). Give HF-IMAGE-CHARACTER prompts for any character slides. Caption + CTA-SAVE/DEMO. 6–9 slides. Inter font, #2563EB accent, one idea per slide.
```

## 5. Story Generation

```
[UNIVERSAL LOADER]

TASK: Generate a {{3–7}}-frame Instagram Story sequence.
Pick a quick FW-* (FW-CURIOSITY, FW-DEMO, FW-OBJECTION, FW-NEWS). Each frame: visual note + short text + interactive sticker (poll/quiz/question/slider) + last frame CTA with link sticker (CTA-DEMO/TRIAL/COMMUNITY). Vertical, brand colors, fast. Output frame-by-frame.
```

## 6. Founder Content

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} CT-FOUNDER reels.
Use FW-FOUNDER / FW-AUTHORITY / FW-CONTRARIAN. Character: CH-OWNER as founder proxy. Language hi-dominant→en for vision. Preset VP-FOUNDER-CABIN, HF-TALKING-HEAD cinematic.
Output: recipe YAML, monologue script (personal, mission-led), scene list, Higgsfield prompts, caption, CTA-COMMUNITY/COMMENT. Also produce a LinkedIn text variant (en-leaning).
```

## 7. Product Content (Demo)

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} CT-DEMO reels spotlighting feature: {{Lead Management | AI Calling | Khata/Settlement | Follow-ups | Team Hierarchy | Property Mgmt | Dashboards}} (must exist in business-memory §3).
Use FW-DEMO / FW-AI / FW-CRM. Character CH-BROKER/CH-SALESMGR. Preset VP-DEMO-SCREEN, HF-DEMO-SCREEN.
Output: recipe YAML, script (pain → "dekho kaise" → 2–3 on-screen taps → result), scene list with exact screen actions, Higgsfield/screen-record notes, caption, CTA-DEMO/TRIAL.
```

## 8. Case Study Content

```
[UNIVERSAL LOADER]

TASK: Generate {{N}} CT-CASE pieces (reel + carousel) for persona {{Agency Owner|Sales Manager}}.
Use FW-CASE / FW-BAB / FW-LEAD-LEAKAGE. Characters CH-OWNER/CH-SALESMGR + CH-HAPPY. Language en-leaning + hi quotes. Preset VP-PROOF-HOME.
Output: recipe YAML, script (who → before metric → what they did → after metric), scene list, Higgsfield prompts, caption, CTA-DEMO/TRIAL. Use realistic, defensible numbers only (no fabricated precise stats); mark any placeholder metric as [TO VERIFY].
```

---

## Cursor / Devin Notes
- **Cursor:** paste the prompt into Composer/Chat with the repo open; it will read the listed files as context. Pin the `content-os/` folder.
- **Devin:** give the Universal Loader as the "knowledge"/setup, then the task prompt as the objective; point its repo to this branch.
- **Output discipline (all agents):** never invent a character or feature; never skip the language tag; always emit the recipe YAML so the piece is reproducible and loggable per `10-content-factory.md`.

---

## Workspace Switch
To target a different business, replace every `workspaces/realestateflow/...` path and the `ACTIVE_WORKSPACE` value with the new workspace slug. Everything else (frameworks, characters scaffold, hooks/CTAs taxonomy, visual system, Higgsfield mapping, factory) is reused unchanged. See `global/01-workspace-system.md`.
