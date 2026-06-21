# 10 — Content Factory (Production Pipeline)

**The runtime of the Content OS.** This is the exact, repeatable pipeline that turns memory into published content. Follow it top to bottom. Every step references objects by ID so output is consistent and loggable.

```
Business Memory → Framework → Character → Hook → Script →
Scene (+ Performance VP-PERF + Physics VP-PHYS + Grade VP-GRADE) →
Higgsfield Generation (+ premium + negative blocks) →
Motion Graphics (VP-GFX) + Sound (VP-MUSIC/VP-SFX) →
Caption → CTA → Scorecard QC → Publish
```

---

## Step 0 — Load Context (always)

```yaml
ACTIVE_WORKSPACE: realestateflow
LOAD:
  - global/00-content-os-overview.md
  - frameworks/03-framework-library.md
  - characters/04-character-system.md
  - visual-system/05-visual-system.md
  - higgsfield/06-higgsfield-production-guide.md
  - hooks/hooks.json
  - ctas/ctas.json
  - production-sop/09-content-type-system.md
  - workspaces/{{ACTIVE_WORKSPACE}}/01-business-memory.md
  - workspaces/{{ACTIVE_WORKSPACE}}/02-market-research.md
  - workspaces/{{ACTIVE_WORKSPACE}}/03-language-strategy.md
```

---

## Step 1 — Business Memory → pick the angle
Choose a **content opportunity** (`OPP-NNN` from `04-content-plan-500`) OR a brief. Confirm the feature claim exists in `01-business-memory.md §3`. Note the target persona + pain.

## Step 2 — Framework Selection
Pick **one primary framework** (`FW-*`) using the framework cheat-sheet for your goal (reach / saves / comments / leads / trust / differentiation). Record it.

## Step 3 — Character Selection
Pick character(s) (`CH-*`) from the casting cheat-sheet that fit the framework + persona. For drama/convo pick a duo. Pull their **consistency prompt** for generation.

## Step 4 — Hook Selection
Pull a hook (`HK-*`) whose category + `best_frameworks` match Step 2, and whose `language` matches the language strategy for this content type/city/persona. (Or write a fresh hook following the hook patterns.)

## Step 5 — Script Creation
Write the script using the framework's **Script structure**. Rules:
- First line = the hook (Step 4). Visual hook on screen within 1 second.
- Language per `03-language-strategy.md` tag (`hi-dominant` / `mr-dominant` / `mixed` / `en-leaning`).
- Length: reel 15–45s (≈ 35–110 words). One idea only.
- End line sets up the CTA (Step 9).
- Keep claims inside business memory. ₹/lakh/crore.

**Script object:**
```yaml
title: ...
opp: OPP-NNN
type: CT-*
framework: FW-*
characters: [CH-*]
hook: HK-*
language: hi-dominant
lines:
  - {char: CH-OWNER, text: "...", emotion: worried}
  - {char: CH-SALESMGR, text: "...", emotion: confident}
```

## Step 6 — Scene Creation (with performance + physics direction)
Convert each line into a shot using `visual-system` presets. Choose the bundle (`VP-*`) from the content-type recipe. For each shot specify: character + consistency prompt, camera (`VP-CAM-*`), lighting (`VP-LIGHT-*`), **performance (`VP-PERF-*`)**, **physics (`VP-PHYS-*`)**, **grade (`VP-GRADE-*`)**, location, action, on-screen text, duration. Performance + physics are **mandatory** on every human shot (this is what kills the dead-AI-face).

**Scene object (upgraded — premium defaults):**
```yaml
scenes:
  - id: S1
    char: CH-OWNER
    consistency: "<paste CH-OWNER consistency prompt>"
    camera: VP-CAM-OWNER
    light: VP-LIGHT-MOODY
    perf: VP-PERF-WORRY        # eyes flick to phone, furrowed brow, shallow breaths
    phys: VP-PHYS-OBJECT       # chai steam, realistic phone grip
    grade: VP-GRADE-MOODY
    location: owner cabin
    action: pinches nose, looks at phone
    on_screen: "100 LEADS AAYE… KITNE CLOSE?"   # gfx: VP-GFX-KINETIC
    duration_s: 2.5
```

## Step 7 — Higgsfield Generation (production-grade)
Map the framework → workflow (`HF-*`) via `06-higgsfield-production-guide.md`. For each scene:
1. Ensure character's Higgsfield Character/Soul exists (create once, reuse). Reuse **Elements** (`@apna-cabin` etc.) so the world stays consistent.
2. Generate image (Soul/Nano Banana Pro) or image→video (Veo/Kling/Sora) per the HF workflow's camera + motion.
3. **Always append the premium prompt blocks** (`06 §6.5`): quality block + `VP-PERF-*` performance block + `VP-PHYS-*` physics block + `VP-GRADE-*` tag, and pass the **negative/anti-AI-tell block**. No call ships without these.
4. Output 1080×1920, 9:16. Keep accent color + grade per preset.

## Step 7b — Motion Graphics & Sound (the SaaS-commercial finish)
5. Build motion graphics in Remotion (`my-video/`): `VP-GFX-KINETIC` captions, `VP-GFX-CALLOUT` UI arrows, `VP-GFX-DATAVIZ` counters for ₹/ROI, `VP-GFX-LOWER3` name/role chips, `VP-GFX-TRANSITION` between beats. Real UI = real screen-record/Remotion, never AI-faked.
6. Add sound: music (`VP-MUSIC-*` by mood) + SFX (`VP-SFX-*` on taps/transitions/wins) + ElevenLabs VO (`orator`). Mix to spec (duck music under VO, −14 LUFS, cut on the beat).
7. Stitch shots (FFmpeg / Remotion), subtitles (sound-off!), logo bug, optional gradient sting. Apply editing craft (`05 §15`): hook <1s, tension curve, J/L cuts, pattern-interrupt ~every 3s.

## Step 8 — Caption Creation
Write the IG caption: hook restated → 2–4 lines value in language tag → 1 line CTA → 5–10 hashtags (mix broad #realestate #realtor + niche #mumbairealestate #punerealestate #realestatecrm + Hinglish #propertydealsindia). First 1–2 lines must hook before "more".

## Step 9 — CTA Assignment
Pull a CTA (`CTA-*`) whose category matches the content-type default and whose `funnel_stage` matches intent (TOFU reach → FOLLOW/SAVE; MOFU → COMMENT/DM/LEAD-MAGNET; BOFU → DEMO/TRIAL/WHATSAPP). Place it as the script's last spoken line AND the caption ender.

## Step 10 — Publish
Upload manually to IG/FB/LinkedIn (Meta Business Suite + native apps). Pick slot from peak windows in `02-market-research.md`. Cross-post: Reels→IG+FB; Authority→LinkedIn; Stories→IG. Save the final **recipe log** (below).

---

## Recipe Log (write one per published piece)
```yaml
piece_id: REF-2026-0001
date: 2026-06-20
opp: OPP-014
type: CT-DRAMA
framework: FW-WHATSAPP-CHAOS
characters: [CH-OWNER, CH-SALESMGR]
hook: HK-WHATSAPP-014
cta: CTA-DEMO-007
language: hi-dominant
visual_preset: VP-DRAMA-OFFICE
higgsfield: HF-DRAMA-DIALOGUE
platforms: [instagram, facebook]
status: published
quality_score: {avg: 8.6, lowest_dim: performance:7}   # Production-Grade Scorecard (05 §16)
metrics: {reach: , saves: , comments: , dms: , demos: }
```
Store logs in `workspaces/{{ACTIVE_WORKSPACE}}/recipe-log.md`. These power reuse + the oracle/ab-optimizer feedback loop.

---

## Batch Mode (factory at scale)
To produce a week: pick top N opportunities by score from the content plan → run Steps 2–9 for each → group by character to batch-generate Higgsfield assets (reuse the same Soul across a shoot) → upload the week manually (Meta Business Suite). Batching by character is the biggest speed + consistency win.

---

## Quality Gate (before publish)

**Floor (must all pass — the 10 Non-Negotiables, `05 §9`):**
- [ ] Claim ∈ business memory §3
- [ ] One framework, one idea
- [ ] Hook visual ≤ 1s, subtitle present
- [ ] Language tag matches strategy for city/persona/type
- [ ] Recurring `CH-*` only, consistency prompt used
- [ ] Brand color/font/9:16 correct
- [ ] CTA present (spoken + caption)
- [ ] ₹/lakh/crore, no false numbers, RERA-safe
- [ ] Recipe logged

**Bar (Production-Grade Scorecard, `05 §16`):** score /10 on consistency, performance, physics, camera, lighting+grade, motion graphics, sound, editing, storytelling, no-AI-tells. **Publish only if avg ≥ 8 and no dimension < 6.** Otherwise regenerate the weak shot. Log the score in the recipe log.
