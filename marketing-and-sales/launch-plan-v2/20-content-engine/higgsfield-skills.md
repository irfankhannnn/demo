# Higgsfield Skills

**Purpose:** package stable `HF-*` recipes as reusable Higgsfield Skills (slash workflows) so one brief produces a finished, on-brand reel. Run via Higgsfield Supercomputer (`/realestateflow-drama …`) or as a saved agent macro. Version them like code.

> Depends on [`framework-library.md`](framework-library.md) (FW + production defaults), [`cast-and-presenter.md`](cast-and-presenter.md) (Soul IDs), [`visual-system.md`](visual-system.md) (VP-*, including the premium layer §10–16) and [`higgsfield-guide.md`](higgsfield-guide.md) (HF-* + premium/negative prompt blocks §6.5). A Skill is those steps pre-chained with the defaults locked on.

> Every Skill inherits the honesty rules in [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md). No Skill may generate a customer, a testimonial, an unsourced figure, or an AI face presented as a real person.

---

## Skill format (the schema every `/realestateflow-*` follows)

```yaml
skill: /realestateflow-<name>
inputs:
  topic: <OPP-ID or free brief>
  city: Mumbai            # M1 is Mumbai-only; Pune is parked (D24)
  count: <N reels>
  goal: <reach | saves | comments | leads | trust>
pipeline:                      # always runs in this order
  1_load:   20-content-engine/README.md, framework-library.md,
            cast-and-presenter.md, visual-system.md, content-types.md,
            higgsfield-guide.md, hooks/hooks.json, ctas/ctas.json,
            10-audience-and-voice/{product-truth,claims-and-proof-policy,
            brand-constants,language-and-tone}.md, pricing.json,
            creative/realestateflow-launch/brand-kit.md
  2_select: pick FW-* (this Skill's family) + CH-* cast + HK-*
  3_script: framework structure, language 70/30, ≤1s hook, CTA last line;
            claims limited to the approved list; prices as tokens
  4_scene:  per shot → VP-CAM + VP-LIGHT + VP-PERF + VP-PHYS + VP-GRADE
  5_gen:    HF-* workflow; append premium blocks (higgsfield-guide.md
            §6.5.1–6.5.3) + grade tag (§6.5.5) + NEGATIVE block (§6.5.4);
            reuse Soul IDs + Elements (@apna-cabin etc.)
  6_finish: VP-GFX-* motion graphics + VP-MUSIC/VP-SFX (framework default)
            + ElevenLabs VO (voice-overs are ElevenLabs-only); mix to spec;
            editing craft (visual-system.md §15)
  7_qc:     claims check, then Production-Grade Scorecard
            (visual-system.md §16) — avg ≥ 8, no dimension < 6
  8_out:    1080×1920 9:16 MP4 named REF-<TYPE><NN>-<slug>-v<N>
            → marketing-and-sales/creative/ ; row appended to
            realestateflow/content-strategy-first-month/13-ASSET-TRACKER.csv
defaults_locked: [premium_prompt_blocks, negative_block, scorecard_gate,
                  claims_check]
```

---

## REFERENCE SKILL — `/realestateflow-drama`

The template all others copy. Produces relatable office-drama/skit reels.

```yaml
skill: /realestateflow-drama
family: [FW-DRAMA, FW-WHATSAPP-CHAOS, FW-SKIT, FW-CONVO]
cast_duos: [CH-OWNER↔CH-SALESMGR, CH-SALESMGR↔CH-BROKER,
            CH-NEWBIE↔CH-TEAMLEAD, +CH-LOSTLEAD]
language: hi-dominant          # mr-dominant parked under D24
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
hook: "200 unread… aur ek deal gayi 👋"   language: hi-dominant   # dramatised fiction
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

- **`/realestateflow-ugc`** — family `[FW-UGC, FW-PROPERTY, FW-OBJECTION]`; cast the AI presenter in selfie POV, speaking **for the brand** and never as a broker who uses the product; `HF-UGC-SELFIE`; finish `VP-MUSIC-NONE` (ambient), `VP-GRADE-CLEAN` natural, raw (no SFX/gfx clutter); 3 hook variants. (No paid ads in M1, so these are organic tests.)
- **`/realestateflow-demo`** — family `[FW-DEMO, FW-AI, FW-CRM]`; cast presenter lead-in then real hands; `HF-DEMO-SCREEN`; finish `VP-MUSIC-CORPORATE-INDIA`, `VP-GRADE-BAZAAR`, `VP-GFX-CALLOUT`+`VP-GFX-DASH`+`VP-GFX-DATAVIZ`, UI-click SFX; **real UI via `[REC]` screen recording, never AI-faked**. The AI shown is the WhatsApp AI Employee — AI calling is not on the approved-claims list (**D26**).
- **`/realestateflow-founder`** — family `[FW-FOUNDER, FW-AUTHORITY, FW-CONTRARIAN]`; cast **the AI presenter speaking for the brand**, never an AI face cast as the founder or owner, and never the founder himself on camera; `HF-TALKING-HEAD` cinematic; finish `VP-MUSIC-CORPORATE-INDIA` warm, `VP-GRADE-WARM`, minimal gfx; also emits a LinkedIn text variant, which is often the better form for founder material.

---

## Authoring SOP

1. Prove the recipe manually once via [`higgsfield-guide.md`](higgsfield-guide.md) §5 (script → finished reel) and clear the scorecard.
2. Fill the schema above; lock `defaults_locked` (premium blocks + negative + scorecard + claims check).
3. Save as a Higgsfield Skill / slash workflow (Supercomputer) **and** mirror here as the source of truth.
4. Version it (`v1`, `v2`); when a `VP-*` or `HF-*` changes, bump the Skill.
5. 🟡 Verify Skill-authoring is enabled on your Higgsfield plan; if not, run the pipeline step by step via the `higgsfield` MCP (see [`higgsfield-guide.md`](higgsfield-guide.md) §5) using this file as the checklist.

> **Why this matters:** a Skill turns a ten-step pipeline into one command, so output stays consistent between sessions and the honesty rules cannot be skipped by accident.

> Open decision D25 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md` (which cast members these Skills may draw on)
> Open decision D26 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md` (which AI features may be shown)
