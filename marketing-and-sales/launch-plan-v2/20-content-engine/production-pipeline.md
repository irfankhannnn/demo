# Production Pipeline

**The runtime of the content engine.** The exact, repeatable pipeline that turns a content-plan row into a published post. Follow it top to bottom. Every step references objects by ID so output is consistent and loggable.

```
Product truth → Framework → Cast → Hook → Script → Route ([AI]/[REC]/[ED]) →
Scene (+ Performance VP-PERF + Physics VP-PHYS + Grade VP-GRADE) →
Generation (Higgsfield / HyperFrames / screen recording) →
Motion Graphics (VP-GFX) + Sound (VP-MUSIC/VP-SFX) →
Caption → CTA → Claims check → Scorecard QC → Publish
```

## Who makes what — the routing rule

Every asset carries exactly one producer tag. This is the constraint the whole pipeline bends around, because the editor is a part-time human and the other two are you.

| Tag | Producer | Tools | Makes |
|---|---|---|---|
| `[AI]` | You, driving Claude | Higgsfield MCP, HyperFrames skill, nano-banana-pro | Kinetic-type reels, WhatsApp chat-thread reels, all carousels, all posters, AI-presenter raw footage and voice |
| `[REC]` | You, manually | OBS / phone screen capture | Raw screen recordings of the real CRM and the real WhatsApp AI Employee |
| `[ED]` | The video editor | Whatever he already uses | Multi-shot narrative reels, assembling presenter footage with b-roll, cutting screen recordings, sound design, caption burn-in |

**The rule:** the editor only touches work that needs human judgement — pacing a narrative, cutting a screen recording down to its best three seconds, sound design. Everything templated goes to `[AI]`.

**Editor capacity is about 3 videos a week.** Plan the week against that number, not against ambition. The editor works only from `marketing-and-sales/realestateflow/content-strategy-first-month/EDITOR-JOBCARDS/` — one file per video, nothing else. If you change a script, change it in the job card too.

## Weekly rhythm

| Day | Action |
|---|---|
| Thu | Review next week's posts. Generate every `[AI]` asset in one Claude session. |
| Fri | Do the week's `[REC]` screen recordings in one sitting. Send the raw files to the editor. |
| Sat | Editor delivers the week's ~3 videos. |
| Sun | Review, schedule the week. Write nothing on weekdays. |
| Daily | 15 minutes: reply to every comment and DM within 60 minutes of posting. |

## Asset naming

```
REF-<TYPE><NN>-<slug>-v<N>.<ext>

REF-R01-lead-kho-gaya-v1.mp4
REF-C03-paisa-leak-slide2-v1.png
REF-S09-khata-screenrec-RAW.mp4
```

| Code | Type | Delivery spec |
|---|---|---|
| `R` | Reel | 1080×1920, 9:16, 30fps, H.264, ≤ 90s, audio −14 LUFS |
| `C` | Carousel slide | 1080×1350, 4:5, PNG |
| `P` | Poster / static | 1080×1350, 4:5, PNG |
| `S` | Screen recording (raw) | 1080×1920 preferred, or 1920×1080 to be reframed |
| `ST` | Story frame | 1080×1920, PNG or MP4 |

Generated files land in `marketing-and-sales/creative/` (there is no `marketing-and-sales/assets/`), and programmatic video builds in `marketing-and-sales/video-projects/my-video/`. Every asset is logged in `marketing-and-sales/realestateflow/content-strategy-first-month/13-ASSET-TRACKER.csv`.

---

## Step 0 — Load Context (always)

```yaml
LOAD:
  # what is true about the product and what we may claim
  - marketing-and-sales/launch-plan-v2/10-audience-and-voice/product-truth.md
  - marketing-and-sales/launch-plan-v2/10-audience-and-voice/claims-and-proof-policy.md
  - marketing-and-sales/launch-plan-v2/10-audience-and-voice/brand-constants.md
  - marketing-and-sales/launch-plan-v2/10-audience-and-voice/icp-and-personas.md
  - marketing-and-sales/launch-plan-v2/10-audience-and-voice/language-and-tone.md
  # how a piece is built
  - marketing-and-sales/launch-plan-v2/20-content-engine/README.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/framework-library.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/cast-and-presenter.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/visual-system.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/content-types.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-guide.md
  - marketing-and-sales/launch-plan-v2/20-content-engine/hooks/hooks.json
  - marketing-and-sales/launch-plan-v2/20-content-engine/ctas/ctas.json
  # brand and month-1 rules
  - marketing-and-sales/creative/realestateflow-launch/brand-kit.md
  - marketing-and-sales/realestateflow/content-strategy-first-month/00-START-HERE.md
  - marketing-and-sales/realestateflow/content-strategy-first-month/04-AI-PRESENTER-BIBLE.md
  - marketing-and-sales/realestateflow/content-strategy-first-month/14-METRICS-CLAIMS-REVIEW.md
  # prices — never hardcode one
  - marketing-and-sales/launch-plan-v2/pricing.json
```

---

## Step 1 — Product truth → pick the angle
Choose a **content opportunity** (`OPP-NNN` from [`content-plan/content-plan-500.csv`](content-plan/content-plan-500.csv)) or write a brief. Confirm the feature actually exists, in [`../10-audience-and-voice/product-truth.md`](../10-audience-and-voice/product-truth.md), and that the claim is on the approved list in [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md). Note the target persona and pain. If the row is flagged `blocked-prelaunch`, `blocked-feature` or `deferred-M3`, pick another row.

## Step 2 — Framework Selection
Pick **one primary framework** (`FW-*`) using the framework cheat-sheet for your goal (reach / saves / comments / leads / trust / differentiation). Record it.

## Step 3 — Cast Selection
Pick the presenter or, for labelled fiction, a duo from the casting cheat-sheet in [`cast-and-presenter.md`](cast-and-presenter.md). Pull the **consistency prompt** for generation. No AI face may play a customer, a testifying broker or the founder.

## Step 4 — Hook Selection
Pull a hook (`HK-*`) whose category and `best_frameworks` match Step 2, and whose `language` fits the piece. (Or write a fresh hook following the hook patterns.) A hook that asserts a figure we cannot source does not ship, however good it reads.

## Step 5 — Script Creation
Write the script using the framework's **Script structure**. Rules:
- First line = the hook (Step 4). Visual hook on screen within 1 second.
- Language per [`../10-audience-and-voice/language-and-tone.md`](../10-audience-and-voice/language-and-tone.md) (`hi-dominant` / `mr-dominant` / `mixed` / `en-leaning`). Brand copy is 70% English / 30% romanized Hindi.
- Length: reel 15–45s (≈ 35–110 words). One idea only.
- End line sets up the CTA (Step 9).
- Every claim must be on the approved-claims list. Prices come from `pricing.json` as tokens, never typed by hand. A ₹ figure is allowed only when it is a price or a number the viewer supplies themselves.

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

## Step 5b — Route each shot

Tag every shot `[AI]`, `[REC]` or `[ED]` before you generate anything. Count the `[ED]` shots for the week against the ~3-video cap. If a piece is over budget, either cut it to an `[AI]`-only format (kinetic type, chat thread, carousel) or move it to next week. An `[ED]` shot without a job card in `EDITOR-JOBCARDS/` does not exist as far as the editor is concerned.

## Step 6 — Scene Creation (with performance + physics direction)
Convert each line into a shot using the presets in [`visual-system.md`](visual-system.md). Choose the bundle (`VP-*`) from the content-type recipe. For each shot specify: character + consistency prompt, camera (`VP-CAM-*`), lighting (`VP-LIGHT-*`), **performance (`VP-PERF-*`)**, **physics (`VP-PHYS-*`)**, **grade (`VP-GRADE-*`)**, location, action, on-screen text, duration. Performance + physics are **mandatory** on every human shot (this is what kills the dead-AI-face).

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
Map the framework to a workflow (`HF-*`) via [`higgsfield-guide.md`](higgsfield-guide.md). For each `[AI]` scene:
1. Ensure character's Higgsfield Character/Soul exists (create once, reuse). Reuse **Elements** (`@apna-cabin` etc.) so the world stays consistent.
2. Generate image (Soul/Nano Banana Pro) or image→video (Veo/Kling/Sora) per the HF workflow's camera + motion.
3. **Always append the premium prompt blocks** ([`higgsfield-guide.md`](higgsfield-guide.md) §6.5): quality block + `VP-PERF-*` performance block + `VP-PHYS-*` physics block + `VP-GRADE-*` tag, and pass the **negative / anti-AI-tell block**. No call ships without these.
4. Output 1080×1920, 9:16. Keep accent color + grade per preset.

## Step 7b — Motion Graphics & Sound (the SaaS-commercial finish)
5. Build motion graphics in Remotion (`marketing-and-sales/video-projects/my-video/`, rendered with `tools/claude-skills/scripts/render-remotion.ps1`) or HyperFrames for kinetic type and chat-thread reels: `VP-GFX-KINETIC` captions, `VP-GFX-CALLOUT` UI arrows, `VP-GFX-DATAVIZ` counters, `VP-GFX-LOWER3` role chips, `VP-GFX-TRANSITION` between beats. **Real UI means a real `[REC]` screen recording** — never an AI-generated fake of the product.
6. Add sound: music (`VP-MUSIC-*` by mood) + SFX (`VP-SFX-*` on taps/transitions/wins) + ElevenLabs VO (`tools/claude-skills/scripts/elevenlabs-tts.ps1`; voice-overs are ElevenLabs-only, and Higgsfield has no usable Indian male preset). Mix to spec: duck music under VO, −14 LUFS, cut on the beat.
7. Stitch shots (FFmpeg / Remotion, or the editor's own tool for `[ED]` pieces), subtitles (sound-off!), logo bug, optional marigold→gulal sting. Apply the editing craft in [`visual-system.md`](visual-system.md) §15: hook <1s, tension curve, J/L cuts, pattern-interrupt about every 3s.

## Step 8 — Caption Creation
Write the IG caption: hook restated → 2–4 lines of value → 1 line CTA → 5–10 hashtags (broad #realestate #realtor + niche #mumbairealestate #realestatecrm + #RealEstateFlow). First 1–2 lines must hook before the "more" fold. If the caption names the WhatsApp AI Employee it carries the price and no-trial line.

## Step 9 — CTA Assignment
Pull a CTA (`CTA-*`) whose category matches the content-type default and whose `funnel_stage` matches intent (TOFU reach → FOLLOW/SAVE; MOFU → COMMENT/DM/LEAD-MAGNET; BOFU → DEMO/TRIAL/WHATSAPP). Place it as the script's last spoken line AND the caption ender.

## Step 9b — Claims check (before anything is scheduled)
Run the pre-publish checklist in [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md). In short: no customer, count or testimonial we do not have; no figure we cannot source; no AI face claiming to be a real person; the AI-presenter disclosure is in the bio and pinned post; any AI Employee mention carries its price and no-trial line; every price came from `pricing.json`.

## Step 10 — Publish
Primary slot is **9:30 PM IST** for every feed post; 8:30 AM and 1:45 PM are for stories. Do not post 11:00–13:00 or 16:00–19:00 — the audience is on site visits. Cross-post: Reels → IG + FB; Authority → LinkedIn; Stories → IG.

**How publishing happens is not settled.** The `blotato` MCP is configured in `.mcp.json` and can schedule IG, FB and LinkedIn posts; the June docs said "manual upload via Meta Business Suite" and were written before that MCP existed. Stories, broadcast channels and group actions stay manual either way.
> Open decision D22 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

Then save the **recipe log** (below).

---

## Recipe Log (write one per published piece)
```yaml
asset_id: REF-R01-lead-kho-gaya-v1        # REF-<TYPE><NN>-<slug>-v<N>
opp: OPP-014
type: CT-DRAMA
framework: FW-WHATSAPP-CHAOS
route: [ED]                                # [AI] | [REC] | [ED]
cast: [CH-OWNER, CH-SALESMGR]              # labelled fiction
hook: HK-WHATSAPP-CHAOS-014
cta: CTA-DEMO-007
language: hi-dominant
visual_preset: VP-DRAMA-OFFICE
higgsfield: HF-DRAMA-DIALOGUE
platforms: [instagram, facebook]
status: published
claims_check: passed
quality_score: {avg: 8.6, lowest_dim: performance:7}   # scorecard, visual-system.md §16
metrics: {reach: , saves: , comments: , dms: , waitlist_signups: }
```
Log every asset in `marketing-and-sales/realestateflow/content-strategy-first-month/13-ASSET-TRACKER.csv`. Outcome metrics roll up into [`../50-measurement/weekly-scorecard.md`](../50-measurement/weekly-scorecard.md).

---

## Batch Mode (factory at scale)
To produce a week: pick the top N opportunities by score from [the content plan](content-plan/README.md) → run Steps 2–9 for each → check the `[ED]` count against the ~3-video cap → group by cast member to batch-generate Higgsfield assets (reuse the same Soul across a shoot) → schedule the week on Sunday. Batching by cast member is the biggest speed and consistency win; batching all `[REC]` recordings into one Friday sitting is the second.

---

## Quality Gate (before publish)

**Floor (must all pass — the 10 Non-Negotiables, [`visual-system.md`](visual-system.md) §9):**
- [ ] The feature shown exists in `product-truth.md`, and the claim is on the approved-claims list
- [ ] One framework, one idea
- [ ] Hook visual ≤ 1s, subtitle present
- [ ] Language matches `language-and-tone.md`
- [ ] Cast is the presenter or labelled fiction; consistency prompt used; no AI face as a real person
- [ ] Brand kit v3 tokens (Unbounded/Manrope, ink/paper grounds, marigold or gulal) and 9:16
- [ ] CTA present (spoken + caption), pulled by `CTA-*` id
- [ ] No fabricated customer, count or testimonial; no unsourced figure; prices resolved from `pricing.json`
- [ ] AI Employee disclosure present wherever the AI Employee is named
- [ ] Bio and pinned post carry the "AI presenter" disclosure
- [ ] Asset named `REF-<TYPE><NN>-<slug>-v<N>` and logged in the asset tracker

**Bar (Production-Grade Scorecard, [`visual-system.md`](visual-system.md) §16):** score /10 on consistency, performance, physics, camera, lighting+grade, motion graphics, sound, editing, storytelling, no-AI-tells. **Publish only if avg ≥ 8 and no dimension < 6.** Otherwise regenerate the weak shot. Log the score in the recipe log.
