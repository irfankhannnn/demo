# 05 — Visual System

**Goal:** Every piece looks like ONE brand. This defines camera, lighting, color, typography, motion, thumbnails, and scene composition. Visual presets have IDs (`VP-*`) used by the content factory and Higgsfield guide.

> Brand truth upstream: `/.brand/brand-kit.md`. Primary `#2563EB`, gradient `#2563EB→#7C3AED`, font **Inter**. The visual system *applies* the brand kit to video/reels. For a new business, swap the brand kit; the structure below stays.

---

## 1. Brand Visual Guidelines (the look in one paragraph)

Clean modern Indian SaaS meets real, lived-in brokerage life. Bright, optimistic, mobile-first vertical (9:16). Royal-blue accents on neutral/white environments, warm Indian skin tones, natural light. Product UI always shown on a phone or clean laptop. Confident but warm — never cold corporate stock.

---

## 2. Color System (for content)

| Use | Color |
|---|---|
| Primary accent / CTA / captions highlight | `#2563EB` |
| Depth / hover | `#1D4ED8` |
| Success / growth / "after" states | `#10B981` |
| Urgency / "loss" / numbers | `#F59E0B` |
| Text on light / dark BG blocks | `#1E293B` |
| Page / clean BG | `#F8FAFC` / white |
| Premium gradient (intros/outros) | `linear-gradient(135deg,#2563EB,#7C3AED)` |

**Rules:** one accent per frame; "loss/fear" beats lean amber/red-amber; "after/win" beats lean emerald; never more than 2 brand colors + neutrals in a single frame.

---

## 3. Camera System (`VP-CAM-*`)

| Preset | When | Spec |
|---|---|---|
| `VP-CAM-OWNER` | Authority/owner | Mid shot, slight low angle, shallow DoF, cabin |
| `VP-CAM-TALK` | Founder/authority/education | Eye-level mid, locked-off or subtle push-in |
| `VP-CAM-UGC` | UGC/agent | Handheld selfie, arm's length, slight shake, vertical |
| `VP-CAM-WALK` | Energy/drama | Walk-and-talk gimbal, follow shot |
| `VP-CAM-OTS` | Demo/team | Over-the-shoulder onto phone/screen |
| `VP-CAM-2SHOT` | Conversation/testimonial | Two-shot eye-level, soft DoF |
| `VP-CAM-INSERT` | Product/proof | Tight insert on screen, tap, ledger, keys |
| `VP-CAM-REACT` | Drama/fear | Quick reaction close-up |

Default for reels: vertical 9:16, 1080×1920, 24–30fps, eye-level unless authority.

---

## 4. Lighting System (`VP-LIGHT-*`)

| Preset | Mood | Use |
|---|---|---|
| `VP-LIGHT-OFFICE` | Bright, even, optimistic | Default office scenes |
| `VP-LIGHT-WARM` | Soft warm key | Consultant/happy-customer/founder warmth |
| `VP-LIGHT-GOLDEN` | Golden hour | Success/"after"/handover scenes |
| `VP-LIGHT-MOODY` | Lower-key, single source | Fear/loss/"before chaos" beats |
| `VP-LIGHT-SCREEN` | Screen-glow + soft fill | Demos, AI-calling, dashboards |

---

## 5. Typography (on-screen text)

- **Font:** Inter (700 headlines, 600 subs, 500 captions). Fallback: Poppins.
- **Captions/subtitles:** Inter SemiBold, white text, dark-blue (`#1D4ED8`) or black box, key word highlighted in `#2563EB` or `#F59E0B`.
- **Hinglish/Marathi rendering:** romanized Latin script for spoken Hinglish; Devanagari only for deliberate Marathi/Hindi script accents in titles.
- **Numbers:** big, bold, amber for loss ("₹20L"), emerald for gain ("+3x").
- **Safe zones:** keep text within central 80%; avoid bottom 12% (IG UI) and top 10%.

---

## 6. Motion System (`VP-MOTION-*`)

- **Pace:** cut every 1.5–3s in reels; first cut within 1s of hook.
- **Transitions:** clean cuts default; whip-pan for energy; match-cut for before/after; subtle zoom-punch on key line.
- **Text motion:** pop-in (scale 0.9→1) + 1px shadow; never slow fades for hooks.
- **B-roll rhythm:** alternate face ↔ product/screen ↔ scene.
- **Intro/outro:** 0.5s gradient logo sting (`#2563EB→#7C3AED`) only on hero pieces; skip on UGC.
- `VP-MOTION-DRAMA`: cinematic, slightly slower, music-led. `VP-MOTION-PUNCHY`: fast, education/listicle. `VP-MOTION-UGC`: minimal, raw.

---

## 7. Thumbnail / Cover System (`VP-THUMB-*`)

Reel covers (1080×1920, but design the top 1080×1350 for grid):
- **Formula:** Big Hinglish phrase (3–5 words) + 1 character face (emotion) + 1 number/icon.
- **Style:** white or blue-gradient BG, Inter 700, key word in amber/blue, character cut-out right or center.
- **Drama covers (`VP-THUMB-DRAMA`):** cinematic still + caption bar.
- **Education covers (`VP-THUMB-EDU`):** "3 GALTIYAN" style numbered.
- **Consistency:** same caption bar style + logo bug bottom-left across all.

---

## 8. Scene Composition Presets (`VP-*` bundles used by the factory)

| Preset | Camera | Light | Motion | Use |
|---|---|---|---|---|
| `VP-DRAMA-OFFICE` | OTS/REACT/2SHOT | MOODY→OFFICE | DRAMA | FW-DRAMA, FW-WHATSAPP-CHAOS |
| `VP-EDU-DESK` | TALK/INSERT | OFFICE | PUNCHY | FW-MISTAKE, FW-CRM, FW-MYTH |
| `VP-UGC-FIELD` | UGC/WALK | WARM/GOLDEN | UGC | FW-UGC, FW-PROPERTY |
| `VP-DEMO-SCREEN` | OTS/INSERT | SCREEN | PUNCHY | FW-DEMO, FW-AI |
| `VP-FOUNDER-CABIN` | OWNER/TALK | WARM | DRAMA-lite | FW-FOUNDER, FW-AUTHORITY |
| `VP-PROOF-HOME` | 2SHOT/INSERT | GOLDEN | DRAMA-lite | FW-CUSTOMER, FW-CASE |

---

## 9. The 10 Non-Negotiables (consistency checklist)

1. Vertical 9:16 for reels/stories. 2. Inter font. 3. One brand accent per frame. 4. Hook visual within 1 second. 5. Subtitles always (sound-off viewing). 6. Product shown on phone/laptop, never abstract. 7. Real Indian faces, natural light. 8. ₹/lakh/crore on-screen. 9. Logo bug bottom-left (except raw UGC). 10. Recurring characters only (`CH-*`).

---

# PREMIUM PRODUCTION LAYER (studio-grade defaults)

> Sections 10–16 are what turn "AI content" into "agency content." They are **mandatory defaults** — every generation inherits them unless a piece explicitly opts out. They cover performance, physics, grading, motion graphics, sound, editing, and a scored QC gate.

---

## 10. Performance & Realism System (`VP-PERF-*`)

The #1 fix for the "dead AI face." A character's *appearance* is locked by the consistency prompt; this locks their **performance**. Attach one `VP-PERF-*` per emotional beat — it becomes literal prompt language in the video call.

**Universal micro-realism (append to EVERY human shot):**
`natural slow blinking (1 blink ~every 3–5s), micro eye-darts, subtle breathing chest movement, tiny involuntary head micro-movements, relaxed asymmetric facial muscles, natural skin texture with pores and slight imperfections, soft catchlight in eyes`

| Preset | Emotion | Performance direction (prompt language) |
|---|---|---|
| `VP-PERF-WORRY` | Worried / stressed | furrowed brow, tightened jaw, eyes flicking to phone, shallow quick breaths, hand drifts to face/neck, shoulders slightly raised |
| `VP-PERF-RELIEF` | Relief / calm | slow exhale, shoulders drop, brow softens, small genuine half-smile reaching the eyes, slow blink |
| `VP-PERF-CONFIDENT` | Confident / authority | steady eye contact, controlled slow head nods, open chest, calm hands, minimal blinking, slight chin lift |
| `VP-PERF-EXCITED` | Excited / win | widened eyes, raised brows, fast genuine smile, energetic hand gestures, leaning in, quicker speech rhythm |
| `VP-PERF-CONFUSED` | Confused | head tilt, one raised eyebrow, eyes searching up-left, lips slightly parted, hesitant micro-pauses |
| `VP-PERF-SURPRISE` | Surprise / "kya?!" | sharp eye widen, eyebrow flash, quick inhale, head pull-back, hand freeze mid-gesture |
| `VP-PERF-FRUSTRATED` | Frustrated | jaw clench, exhale through nose, pinch bridge of nose, sharp gestures, looking away then back |
| `VP-PERF-CELEBRATE` | Celebration | full Duchenne smile, fist pump / clap, head back, team high-five energy, bright eyes |
| `VP-PERF-EMPATHY` | Warm / client-care | soft attentive eyes, gentle nods, open palms, slight forward lean, reassuring micro-smile |

**Timing & delivery rules (natural conversation):**
- Real pauses: 0.3–0.6s beat before a key word; never robotic even cadence.
- One genuine micro-reaction per line (a blink, swallow, glance) — humans are never still.
- Eye-line: to-camera for authority/UGC; to-other-character for drama/convo; to-screen for demo.
- Gesture economy: 1–2 purposeful hand moves per sentence, not constant flapping.

---

## 11. Physics & Environment Realism (`VP-PHYS-*`)

Kills the "floaty AI" look. Append the relevant cues so motion obeys real-world physics.

- `VP-PHYS-BODY` — natural weight shift, grounded stance, realistic gait, gravity on clothing folds, hair sway with head turns.
- `VP-PHYS-OBJECT` — phone held with realistic grip + finger taps, chai steam rising, papers with weight, keys that jingle and swing, pen that writes.
- `VP-PHYS-ENV` — believable depth/parallax, soft real shadows matching key light, dust motes in sun shafts, screen glow spilling onto face, reflections in glass cabins.
- `VP-PHYS-CROWD` — background team members doing independent natural activity (typing, walking, talking), not frozen mannequins.

**Anti-physics rejects:** no sliding feet, no morphing/merging fingers, no objects that float or pass through hands, no impossibly smooth "conveyor-belt" walks, no static background people.

---

## 12. Color Grading Looks (`VP-GRADE-*`)

The brand *hex* (§2) is the palette; this is the *grade* (the cinematic look). Apply one in finish (Remotion/FFmpeg LUT or grade) per mood.

| Preset | Look | Used on |
|---|---|---|
| `VP-GRADE-CLEAN` | Bright, true-to-life, gentle contrast, protected neutral whites, accurate Indian skin tones | default office / demo / education |
| `VP-GRADE-WARM` | Lifted warmth, soft highlights, golden skin glow, slightly creamy blacks | consultant / happy-customer / founder warmth |
| `VP-GRADE-GOLDEN` | Golden-hour teal-orange, warm highlights + cool shadows, rich and aspirational | success / "after" / handover |
| `VP-GRADE-MOODY` | Lower-key, crushed-but-detailed blacks, desaturated except amber accents, single-source contrast | fear / loss / "before chaos" |
| `VP-GRADE-SAAS` | Crisp, slightly cool, high micro-contrast, vivid #2563EB, clean screen glow | product/UI hero & ad spots |

**Always:** protect skin tones (never orange/plastic), keep brand `#2563EB` accurate after grade, consistent grade across all shots in one piece.

---

## 13. Motion Graphics System (`VP-GFX-*`)

What makes it feel like a *SaaS commercial*, not a slideshow. Build these in Remotion (deterministic, on-brand) or Nano Banana Pro for stills.

- `VP-GFX-KINETIC` — kinetic typography: words pop/scale in on the beat, key word in `#2563EB`/`#F59E0B`, 1px shadow, never slow fades on hooks.
- `VP-GFX-CALLOUT` — UI callouts: animated arrows, circles, highlight boxes that draw the eye to the exact tap/button on the product screen.
- `VP-GFX-DATAVIZ` — animated counters & charts: numbers tick up ("0 → ₹20L"), bar/line growth, pie fills — for leakage math, ROI, growth.
- `VP-GFX-LOWER3` — lower-thirds: name/role chips (e.g. "Rajesh • Agency Owner"), feature-name tags, source tickers for FW-NEWS.
- `VP-GFX-TRANSITION` — premium transitions: match-cut, whip-pan, mask-wipe on brand gradient, screen-into-screen for demos.
- `VP-GFX-DASH` — SaaS dashboard presentation: clean device frame, cursor/tap animation, glowing active card, depth/shadow, subtle parallax.
- `VP-GFX-DEPTH` — gradients, soft drop-shadows, layered depth, glassmorphism accents (sparingly) for premium feel.

**Rule:** motion graphics earn attention, never clutter. Max 1 primary graphic idea on screen at once; everything snaps to the edit beat.

---

## 14. Sound Design & Music Direction (`VP-SFX-*`, `VP-MUSIC-*`)

Premium content is 50% sound. VO stays on ElevenLabs (`orator`); this directs music + SFX + mix.

**Music (`VP-MUSIC-*`) — pick by framework mood:**
- `VP-MUSIC-TENSION` — minimal, pulsing, rising (FW-FEAR, FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE before-beat).
- `VP-MUSIC-UPLIFT` — bright, hopeful, building (FW-BAB after, FW-CASE, FW-CUSTOMER).
- `VP-MUSIC-CORPORATE-INDIA` — modern, confident, light tabla/percussion fusion (FW-FOUNDER, FW-AUTHORITY, demos).
- `VP-MUSIC-FUN` — playful, bouncy (FW-SKIT, FW-DRAMA comedy beats).
- `VP-MUSIC-NONE` — raw ambient only (FW-UGC authenticity).

**SFX (`VP-SFX-*`):** whoosh on transitions, UI click/pop on each tap & text pop, soft "ding" on a win/notification, cash/coin on ₹ reveals, subtle riser before the twist, room tone always (never dead silence).

**Mix rules:** VO always on top & intelligible; duck music −12 to −15dB under VO; SFX accents but never masks; -14 LUFS target for social; punch on the hook, breathe on the CTA. Beat-map cuts to the music (cut on the downbeat).

---

## 15. Editing Craft (premium pacing)

Beyond "cut every 1.5–3s":
- **Hook = 0–1s** visual + first word; the highest-tension frame leads.
- **Tension curve:** setup → escalate → twist → release → CTA; pace accelerates into the twist, breathes on the payoff.
- **J/L cuts:** let audio lead or trail the cut for natural flow (esp. drama/convo).
- **Match cuts** for before/after (same framing, chaos→calm). **Whip-pan** for energy jumps.
- **Pattern interrupt** every ~3s (new angle, graphic, SFX) to hold retention.
- **Subtitle rhythm:** 1–4 words per beat, key word highlighted, synced to VO syllable.
- **End frame:** CTA holds 1.5–2s, logo bug + clear next action; loopable last frame for replays.

---

## 16. Production-Grade Scorecard (scored QC — replaces pass/fail thinking)

Score each piece /10 per dimension. **Publish bar = ≥ 8 average AND no dimension < 6.** Below bar → regenerate the weak shot, don't ship.

1. Character consistency (face/wardrobe identical to Soul ID)
2. Performance realism (`VP-PERF-*` applied — eyes/blink/breath/gesture alive)
3. Physics realism (`VP-PHYS-*` — weight, hands, objects, environment correct)
4. Camera & composition (intentional `VP-CAM-*`, safe zones, depth)
5. Lighting & color grade (`VP-LIGHT-*` + `VP-GRADE-*`, skin protected)
6. Motion graphics quality (`VP-GFX-*` — premium, on-beat, uncluttered)
7. Sound & music (`VP-MUSIC-*`/`VP-SFX-*`, mix to spec, VO clear)
8. Editing & pacing (hook <1s, tension curve, clean cuts)
9. Storytelling & emotional payoff (one framework, lands the feeling)
10. Brand & no-AI-tells (Inter, #2563EB accurate, zero plastic/morph/warp-text)

> The 10 Non-Negotiables (§9) are the *floor*; this scorecard is the *bar*. Log the score in the recipe log.
