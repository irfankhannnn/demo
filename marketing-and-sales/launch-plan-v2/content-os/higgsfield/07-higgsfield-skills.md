# 07 — Higgsfield Skills / Slash Workflows

**Purpose:** Package stable `HF-*` recipes as reusable **Higgsfield Skills** (slash workflows) so one brief → a finished, on-brand, production-grade reel. Run via Higgsfield **Supercomputer** (`/realestateflow-drama …`) or as a saved agent macro. Version + share across the team like code.

> Depends on: `frameworks/03` (FW + production defaults), `characters/04` (Soul IDs), `visual-system/05` (VP-* incl. premium layer §10–16), `higgsfield/06` (HF-* + premium/negative prompt blocks §6.5). A Skill is just those steps, pre-chained, with the premium defaults locked on.

---

## Skill format (the schema every `/realestateflow-*` follows)

```yaml
skill: /realestateflow-<name>
inputs:
  topic: <OPP-ID or free brief>
  city: <Mumbai | Pune | both>
  count: <N reels>
  goal: <reach | saves | comments | leads | trust>
pipeline:                      # always runs in this order
  1_load:   global/00, frameworks/03, characters/04, visual-system/05,
            higgsfield/06+07, hooks/ctas json, workspace memory, .brand
  2_select: pick FW-* (this Skill's family) + CH-* cast + HK-*
  3_script: framework structure, language strategy, ≤1s hook, CTA last line
  4_scene:  per shot → VP-CAM + VP-LIGHT + VP-PERF + VP-PHYS + VP-GRADE
  5_gen:    HF-* workflow; append premium blocks (06 §6.5.1–6.5.3) +
            grade tag (§6.5.5) + NEGATIVE block (§6.5.4); reuse Soul IDs
            + Elements (@apna-cabin etc.)
  6_finish: VP-GFX-* motion graphics + VP-MUSIC/VP-SFX (framework default)
            + ElevenLabs VO; mix to spec; editing craft (05 §15)
  7_qc:     Production-Grade Scorecard (05 §16) — avg ≥ 8, no dim < 6
  8_out:    1080×1920 9:16 MP4 → marketing-and-sales/assets/ + recipe log
defaults_locked: [premium_prompt_blocks, negative_block, scorecard_gate]
```

---

## REFERENCE SKILL — `/realestateflow-drama`

The template all others copy. Produces relatable office-drama/skit reels.

```yaml
skill: /realestateflow-drama
family: [FW-DRAMA, FW-WHATSAPP-CHAOS, FW-SKIT, FW-CONVO]
cast_duos: [CH-OWNER↔CH-SALESMGR, CH-SALESMGR↔CH-BROKER,
            CH-NEWBIE↔CH-TEAMLEAD, +CH-LOSTLEAD]
language: hi-dominant (mr-dominant for Pune)
structure: setup → conflict (pain bites) → twist (RealEstateFlow contrast)
           → punchline → CTA
finish_defaults:                       # from frameworks/03 per-FW table
  music: VP-MUSIC-FUN / VP-MUSIC-TENSION (chaos beat)
  grade: VP-GRADE-MOODY → VP-GRADE-CLEAN (chaos→calm)
  perf:  full range (WORRY, FRUSTRATED, SURPRISE, RELIEF, CELEBRATE)
  sfx:   reaction stings, notification pings, whoosh on twist
  gfx:   VP-GFX-KINETIC captions, VP-GFX-TRANSITION on the twist
  hf:    HF-DRAMA-DIALOGUE (+ HF-CINEMATIC twist, HF-REACT punchline)
output: recipe YAML + full dialogue script (char + emotion + VP-PERF per
        line) + scene list (VP-DRAMA-OFFICE) + Higgsfield prompts
        (consistency + premium + NEGATIVE blocks) + caption + CTA + score
```

**One-line invocation (Supercomputer / agent):**
```
/realestateflow-drama topic="lead lost in WhatsApp" city=Mumbai count=3 goal=reach
```

**What it returns per reel (abridged example):**
```yaml
piece: drama-whatsapp-001
framework: FW-WHATSAPP-CHAOS   characters: [CH-SALESMGR, CH-BROKER]
hook: "200 unread… aur ek deal gayi 👋"   language: hi-dominant
scenes:
  - S1 CH-BROKER | VP-CAM-REACT | VP-LIGHT-MOODY | VP-PERF-FRUSTRATED
       | VP-PHYS-OBJECT(phone) | VP-GRADE-MOODY | "phone buzzing, scrolling chaos"
  - S2 CH-SALESMGR | VP-CAM-2SHOT | VP-LIGHT-OFFICE | VP-PERF-CONFIDENT
       | VP-GRADE-CLEAN | "system mein daal, sab dikhega"
  - S3 CH-BROKER | VP-CAM-REACT | VP-PERF-RELIEF | VP-GRADE-CLEAN | punchline
finish: VP-MUSIC-FUN, ping SFX on chaos, whoosh on S2, VP-GFX-KINETIC caps
hf_prompt_S1: "<CH-BROKER consistency> + VP-PERF-FRUSTRATED(jaw clench, exhale,
  sharp scroll) + VP-PHYS-OBJECT(real phone grip, screen glow on face)
  + <quality block> + graded VP-GRADE-MOODY; vertical 9:16"
negative: "<06 §6.5.4 anti-AI-tell block>"
cta: CTA-DEMO-007
score: {avg: 8.7, lowest: performance:8}
```

---

## Sibling Skills (same schema, swap the family)

- **`/realestateflow-ugc`** — family `[FW-UGC, FW-PROPERTY, FW-OBJECTION]`; cast `CH-BROKER`/`CH-CONSULTANT` selfie; `HF-UGC-SELFIE`; finish `VP-MUSIC-NONE` (ambient), `VP-GRADE-CLEAN` natural, raw (no SFX/gfx clutter); 3 hook variants for ad testing.
- **`/realestateflow-demo`** — family `[FW-DEMO, FW-AI, FW-CRM]`; cast `CH-BROKER`/`CH-SALESMGR`; `HF-DEMO-SCREEN`; finish `VP-MUSIC-CORPORATE-INDIA`, `VP-GRADE-SAAS`, `VP-GFX-CALLOUT`+`VP-GFX-DASH`+`VP-GFX-DATAVIZ`, UI-click SFX; **real UI via Remotion/screen-record, never AI-faked**.
- **`/realestateflow-founder`** — family `[FW-FOUNDER, FW-AUTHORITY, FW-CONTRARIAN]`; cast `CH-OWNER`; `HF-TALKING-HEAD` cinematic; finish `VP-MUSIC-CORPORATE-INDIA` warm, `VP-GRADE-WARM`, minimal gfx; also emits a LinkedIn text variant.

---

## Authoring SOP

1. Prove the recipe manually once via `06 §5` (script → finished reel) and clear the scorecard.
2. Fill the schema above; lock `defaults_locked` (premium blocks + negative + scorecard).
3. Save as a Higgsfield Skill / slash workflow (Supercomputer) **and** mirror here as the source of truth.
4. Version it (`v1`, `v2`); when a `VP-*` or `HF-*` changes, bump the Skill.
5. 🟡 Verify Skill-authoring is enabled on your Higgsfield plan; if not, run the pipeline step-by-step via MCP (`06 §5`) using this file as the checklist.

> **Why this matters:** Skills turn a 10-step expert pipeline into one command, so non-experts produce agency-grade reels and quality never drifts between operators.
