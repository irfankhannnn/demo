# 02 — Content OS Explained (Layer 1)

> How **one** piece of content actually gets built. This is the generative engine.

---

## The core idea: content is a *recipe*

Every post is assembled from small reusable parts, each with a stable ID:

```
Instagram Post =
   FW-*  (framework — the story)
 + CH-*  (character — who we talk to)
 + HK-*  (hook — the grabber)
 + CTA-* (call-to-action — the click)
 + VP-*  (visual preset — the look)
 + HF-*  (Higgsfield workflow — how it's rendered)
```

**Worked example:**

```
FW-09  Lead Chaos → Control      (the narrative)
CH-01  Rajesh Bhai, Mumbai owner (the persona)
HK-03  Before/After spreadsheet  (the hook)
CTA-05 "Free Trial Shuru Karo →" (the action)
VP-02  Dashboard + agent + blue  (the visual)
HF-04  Nano Banana Pro prompt    (the render)
= one finished Instagram post
```

**Why recipes?** Reuse. One framework powers 10 posts. One character appears in 20. Fix the character once → all 20 improve. This is what lets you go from 1 post to 500 without 500x the work.

---

## The 10-step Content Factory

This is the assembly line in `production-sop/10-content-factory.md`. Each step is atomic — you can pause, reuse, or A/B test at any point.

```
1  MEMORY    Read brand + audience
              → workspaces/realestateflow/01-business-memory.md
2  FRAMEWORK Pick the story         → frameworks/  (FW-09)
3  CHARACTER Pick the persona       → characters/  (CH-01)
4  HOOK      Write the grabber      → hooks/       (HK-03)
5  SCRIPT    Write the caption (Hinglish, 3–5 lines)
6  SCENE     Visual + performance VP-PERF + physics VP-PHYS + grade VP-GRADE
7  GENERATE  Render via Higgsfield (+ premium & NEGATIVE blocks) → .png/.mp4
7b GFX+SOUND Motion graphics VP-GFX + music/SFX VP-MUSIC/VP-SFX
8  CAPTION   Polish copy + hashtags + emojis
9  CTA       Add the button/link    → ctas/        (CTA-05)
QC SCORECARD Production-grade score ≥ 8 or regenerate  (visual-system §16)
10 PUBLISH   Upload (Meta Business Suite — manual) or schedule
```

### Why 10 separate steps?
- Pause after **Step 5** for human review before spending render credits.
- Reuse one **Step 5** script with 3 different visuals (Step 6–7).
- Generate 100 captions but only render the best 10.

---

## What each part means (in one line)

| Part | ID | Plain English | Example |
|---|---|---|---|
| Framework | `FW-*` | The narrative shape | "Chaos → Control", "Speed Wins Deals" |
| Character | `CH-*` | Who you're speaking to | Rajesh (owner), Priya (manager), Dev (agent) |
| Hook | `HK-*` | First-line grabber | "Excel mein CRM chala rahe ho?" |
| CTA | `CTA-*` | The ask | "Free Trial Shuru Karo →" |
| Visual preset | `VP-*` | The reusable look | Blue theme + dashboard screenshot |
| Higgsfield WF | `HF-*` | The render recipe | Nano Banana Pro (image), Kling 3.0 (video) |

---

## Global engine vs Workspace memory

The system separates **reusable** parts from **business-specific** parts:

```
global/  +  frameworks/ characters/ hooks/ ctas/ visual-system/
   └─ The ENGINE. Works for ANY business (RealtyFlow, a future SaaS, etc.)

workspaces/realestateflow/
   └─ The MEMORY. RealtyFlow-only facts:
      01-business-memory.md   brand, colours, tone
      02-market-research.md   ICP, competitors
      03-language-strategy.md Hinglish 70/30 rules
      04-content-plan-500.md  500 posts planned
      05-14-day-launch-plan.md launch sequence
```

**Why?** To launch a *second* business later, you copy `workspaces/_TEMPLATE/`, fill in its memory, and reuse the entire global engine. Zero rebuilding.

---

## Higgsfield = the render farm

`higgsfield/` holds the prompt workflows that turn your **Step 6 scene description** into actual pixels via the Higgsfield MCP:

| Need | Model | Rough cost |
|---|---|---|
| Image / banner | Nano Banana Pro | ~$0.02–0.05 |
| Short video / reel | Kling 3.0 / Veo 3.1 | ~$0.20–2.00 |

You write the scene in words; the workflow file has the structured prompt template; the MCP returns the file into `marketing/assets/`.

---

## The Premium Production Layer (what makes it agency-grade)

Locking *how a character looks* (the consistency prompt) is only half the job. The system also locks *how they perform, move, sound, and get finished* — this is the difference between "AI content" and "studio content." These presets live in `visual-system/05` (§10–16) and `higgsfield/06` (§6.5–6.6), and **every generation inherits them by default**.

Six layers, each an ID you attach to a shot:

- **`VP-PERF-*` — Performance.** Kills the dead AI face. Direction for eyes, blinking, breathing, micro-expressions, hand gestures, timing/pauses. *e.g. `VP-PERF-WORRY` = furrowed brow, eyes flicking to phone, shallow breaths, hand to face.*
- **`VP-PHYS-*` — Physics.** Real-world motion: weight, grip, gravity on clothes/hair, steam, shadows, screen-glow. Kills floaty/sliding AI motion.
- **`VP-GRADE-*` — Colour grade.** The cinematic *look* (not just brand hex): `MOODY` for fear, `GOLDEN` teal-orange for wins, `SAAS` crisp-cool for product, skin tones protected.
- **`VP-GFX-*` — Motion graphics.** What makes it a SaaS *commercial*: kinetic captions, animated UI callouts, ticking ₹ counters, lower-third name chips, premium transitions.
- **`VP-MUSIC-*` / `VP-SFX-*` — Sound.** Music by mood (tension/uplift/corporate-India/fun) + SFX (whoosh, UI click, ₹-reveal ding), mixed to spec (duck under VO, cut on the beat, −14 LUFS).
- **Anti-AI-tell negatives.** Every Higgsfield call passes a *negative* block — no plastic skin, no morphing hands, no dead eyes, no warped text.

### The quality bar
A new **Production-Grade Scorecard** (`05 §16`) scores each piece /10 across 10 dimensions (consistency, performance, physics, camera, grade, graphics, sound, editing, story, no-AI-tells). **Publish only if average ≥ 8 and nothing < 6** — else regenerate the weak shot. The old 10 Non-Negotiables are now the *floor*; the scorecard is the *bar*.

### Auto-mood per framework (no manual picking)
You don't choose sound/grade/performance by hand. Each of the 25 frameworks ships a **default mood** (`frameworks/03` → "Per-Framework Production Defaults"). Pick the framework, the finish comes free:

```
FW-FEAR          → tension music + moody amber grade + worried performance
FW-CUSTOMER      → uplifting music + golden grade + celebrate/empathy
FW-DEMO          → corporate-India + crisp SaaS grade + UI-click SFX
FW-UGC           → no music (ambient) + natural grade + raw, authentic
```
Override only when a piece needs something special — otherwise the mood is correct by default.

**Example — same shot, before vs after the upgrade:**

```
BEFORE: "Rajesh at desk, worried, looks at phone."
        → stiff, waxy, dead-eyed, floaty → looks AI.

AFTER:  "<consistency prompt> + VP-PERF-WORRY (furrowed brow, eyes flick
        to phone, shallow breaths, hand to nose) + VP-PHYS-OBJECT (chai
        steam, real phone grip) + quality block (35mm, pores, catchlight)
        + graded VP-GRADE-MOODY + NEGATIVE block (no plastic skin/morphing)"
        → alive, cinematic, on-brand → looks like an agency made it.
```

---

## A full mini-run

```
Ask: "Generate an IG post for Rajesh Bhai about lead chaos."

→ Step 1  Read brand: blue #2563EB, Hinglish 70/30
→ Step 2  FW-09 Chaos → Control
→ Step 3  CH-01 Rajesh, agency owner
→ Step 4  HK-03 before/after
→ Step 5  Caption:
          "Pehle spreadsheet, ab RealtyFlow 📊
           ❌ 3 Excel files  ❌ 50 WhatsApp msgs
           ✅ Sab leads ek jagah  ✅ Follow-up automatic
           Free try karo 👇"
→ Step 6  Scene + VP-PERF-WORRY + VP-PHYS-OBJECT + VP-GRADE-MOODY
→ Step 7  Higgsfield (+ quality/performance/physics + NEGATIVE blocks)
          → ig-post-chaos-control-01.png
→ Step 7b VP-GFX-KINETIC captions + VP-MUSIC-TENSION + VP-SFX taps
→ Step 8  + hashtags
→ Step 9  CTA-05 "Free Trial → realtyflow.in"
→ QC      Production-Grade Scorecard: avg 8.6 ✅ (publish)
→ Step 10 Save + upload via Meta Business Suite

One agency-grade post in ~3 minutes.
```

→ Next: **03-gtm-growth-and-agents.md** (publishing, measuring, and how agents run all this).
