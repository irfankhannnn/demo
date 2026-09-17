# Visual System

**Goal:** Every piece looks like ONE brand. This defines camera, lighting, color, typography, motion, thumbnails, and scene composition. Visual presets have IDs (`VP-*`) used by [`production-pipeline.md`](production-pipeline.md) and [`higgsfield-guide.md`](higgsfield-guide.md).

> **Brand truth upstream:** [`marketing-and-sales/creative/realestateflow-launch/brand-kit.md`](../../creative/realestateflow-launch/brand-kit.md) — v3 "Bazaar Signal". The constants are also summarised in [`../10-audience-and-voice/brand-constants.md`](../10-audience-and-voice/brand-constants.md). This file *applies* that kit to video, reels and stills; it never redefines it. Where a hex or font appears below it is quoted from the kit — if the two ever disagree, the kit wins.
>
> **Not the product UI.** The CRM front-end uses blue `#2563EB` + Inter (`apps/crm/real-estate-crm-app/tailwind.config.js`). That is deliberate and unrelated to the marketing brand. Screen recordings of the real product keep their own look — do not regrade the UI to marigold.

---

## 1. Brand Visual Guidelines (the look in one paragraph)

Bazaar signal, not enterprise SaaS. Warm near-black ink and khata-ledger cream as the two grounds, marigold as the single loud accent, gulal for one pop per screen. Golden-hour light, handheld candid framing, slight grain — a creator's-tool feel, not a corporate one. Real agents in real under-construction flats: dust, exposed wiring, genuine site-visit energy. Phone screens showing the actual WhatsApp and CRM UI, held naturally mid-conversation. Marigold garlands, chai tumblers and khata ledgers as incidental props. Agents in their 20s–40s, ordinary office chaos. Mobile-first vertical (9:16).

**Never:** generic handshake-over-a-table stock, glass-tower offices with no Indian specificity, posed everyone-smiling group shots, perfectly staged interiors with no signs of life, or invented chat-bubble screenshots that do not match the real product.

---

## 2. Color System (for content)

Quoted from brand kit v3. Do not invent a shade that is not in this table.

| Token | Hex | Use in content |
|---|---|---|
| Ink (primary ground) | `#1C1512` | Default frame ground, hook/quote posts, lower-thirds |
| Ink 2 (card ground) | `#251C16` | Cards, callout boxes |
| Ink 3 (alt card) | `#2E241D` | Alternating cards |
| Paper (light ground) | `#FBF2E4` | Light-ground frames, ledger/khata scenes |
| Paper 2 | `#F3E6D2` | Alt light surface |
| Marigold (primary accent) | `#FF7A1A` | CTAs, prices, the one highlighted word, logo accent wave |
| Marigold hover | `#E8620A` | Pressed/hover state in UI mockups |
| Gulal (secondary pop) | `#FF3D7F` | Quote marks, alerts — **once per screen**, never on the same card as marigold |
| Gulal hover | `#E01F63` | Pressed/hover state |
| Tulsi (tertiary, sparing) | `#1FAA59` | Checkmarks and "verified" only — never a primary accent |
| Dust (muted on dark) | `#C9BBA8` | Secondary text and hairlines on ink |
| Dust dim (muted on light) | `#948575` | Secondary text on paper |
| Error / pain | `#EF4444` | Pain points and loss framing |

**Gradient (hero headlines only):** `linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)` — marigold to gulal, on ink.

**Rules:**
- One accent per frame. Marigold and gulal never anchor the same card — pick one per component.
- Rough per-screen ratio: ~42% ink, ~18% paper, ~22% marigold, ~14% gulal, ~4% tulsi.
- "Loss / fear" beats use `#EF4444` on ink. "After / win" beats use marigold; tulsi is reserved for a literal checkmark.
- Never more than two brand colours plus the neutrals in one frame.

**Instagram post grounds (pick one ground + one accent per post):**

| Post type | Ground | Use for |
|---|---|---|
| Hook / quote | Ink | Scroll-stopping one-liners, WhatsApp-pain hooks, gulal quote mark |
| Stat / claim | Marigold | One big number the viewer works out for themselves + one line |
| Product / chat | Gulal | AI Employee screenshots, chat-bubble mockups |
| Ledger / khata | Paper | Khata, commission and reminder scenes |

> The brand kit labels the paper ground "testimonial". Pre-launch we have zero customers and zero testimonials, so paper carries khata/ledger scenes and plain copy instead. It reverts to its testimonial use the day a real customer gives written permission — see [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md).

**Feed consistency:** across any 9 grid tiles, no more than 3 may share a ground — alternate ink / marigold / paper / gulal in a loose checkerboard.

**Carousels are a fixed 5 slides:** gulal hook → three quiet ink slides, one point each with a marigold bullet → marigold CTA slide. Not 6, not 9.

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
| `VP-LIGHT-WARM` | Soft warm key | Consultant / client-care / founder warmth |
| `VP-LIGHT-GOLDEN` | Golden hour | Success/"after"/handover scenes |
| `VP-LIGHT-MOODY` | Lower-key, single source | Fear/loss/"before chaos" beats |
| `VP-LIGHT-SCREEN` | Screen-glow + soft fill | Demos, AI-calling, dashboards |

---

## 5. Typography (on-screen text)

- **Display:** Unbounded 800/900 — hooks, headlines, big numbers and prices. One line, at most two. Never a paragraph.
- **Body / UI / captions:** Manrope 400–800. Everything Unbounded does not shout.
- **Captions / subtitles:** Manrope 700, paper-cream text on an ink box, the one key word in marigold. One highlight per caption line.
- **CTA labels:** Manrope 800 — punch without shouting.
- **Numerals:** Manrope with tabular figures. Loss framing in `#EF4444`, the payoff number in marigold.
- **Hinglish rendering:** romanized Latin script for spoken Hinglish. Devanagari only as a deliberate script accent in a title — never inside a romanized word (that glitch cost 30 records in the hook library).
- **Safe zones:** keep text within the central 80%; avoid the bottom 12% (IG UI) and the top 10%.

> Fallback stacks: Unbounded → system sans-serif; Manrope → system sans-serif. Poppins and Inter are v1/v2 and are no longer brand fonts.

---

## 6. Motion System (`VP-MOTION-*`)

- **Pace:** cut every 1.5–3s in reels; first cut within 1s of hook.
- **Transitions:** clean cuts default; whip-pan for energy; match-cut for before/after; subtle zoom-punch on key line.
- **Text motion:** pop-in (scale 0.9→1) + 1px shadow; never slow fades for hooks.
- **B-roll rhythm:** alternate face ↔ product/screen ↔ scene.
- **Intro/outro:** 0.5s gradient logo sting (marigold → gulal, `#FF7A1A→#FF3D7F`, on ink) only on hero pieces; skip on UGC.
- `VP-MOTION-DRAMA`: cinematic, slightly slower, music-led. `VP-MOTION-PUNCHY`: fast, education/listicle. `VP-MOTION-UGC`: minimal, raw.

---

## 7. Thumbnail / Cover System (`VP-THUMB-*`)

Reel covers (1080×1920, but design the top 1080×1350 for grid):
- **Formula:** big Hinglish phrase (3–5 words) + one face (emotion) + one number or icon.
- **Style:** ink or paper ground per the post-type table in §2 — never a white or blue gradient. Unbounded 800 for the phrase, key word in marigold. Cut-out right or centre.
- **Drama covers (`VP-THUMB-DRAMA`):** cinematic still, ink caption bar, gulal quote mark if the line is a quote.
- **Education covers (`VP-THUMB-EDU`):** "3 GALTIYAN" numbered, marigold numeral on ink.
- **Consistency:** same caption-bar style and logo bug bottom-left across all covers; the logo's third wave line is marigold on paper-cream.
- **Grid check:** lay the last nine covers out together before publishing — no more than three may share a ground.

---

## 8. Scene Composition Presets (`VP-*` bundles used by the factory)

| Preset | Camera | Light | Motion | Use |
|---|---|---|---|---|
| `VP-DRAMA-OFFICE` | OTS/REACT/2SHOT | MOODY→OFFICE | DRAMA | FW-DRAMA, FW-WHATSAPP-CHAOS |
| `VP-EDU-DESK` | TALK/INSERT | OFFICE | PUNCHY | FW-MISTAKE, FW-CRM, FW-MYTH |
| `VP-UGC-FIELD` | UGC/WALK | WARM/GOLDEN | UGC | FW-UGC, FW-PROPERTY |
| `VP-DEMO-SCREEN` | OTS/INSERT | SCREEN | PUNCHY | FW-DEMO, FW-AI |
| `VP-FOUNDER-CABIN` | OWNER/TALK | WARM | DRAMA-lite | FW-FOUNDER, FW-AUTHORITY |
| `VP-PROOF-HOME` | 2SHOT/INSERT | GOLDEN | DRAMA-lite | FW-CUSTOMER, FW-CASE — **disabled pre-launch** |

> `VP-PROOF-HOME` exists for the day we have a real, consented customer. Until then it is not used: an AI face may never play a customer or give a testimonial. See [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md) and [`cast-and-presenter.md`](cast-and-presenter.md).

---

## 9. The 10 Non-Negotiables (consistency checklist)

1. Vertical 9:16 for reels/stories.
2. Brand kit v3 type — Unbounded 800/900 display, Manrope body — and only v3 colour tokens.
3. One brand accent per frame (marigold *or* gulal, never both on one card).
4. Hook visual within 1 second.
5. Subtitles always (sound-off viewing).
6. Product shown on a phone or laptop, never abstract — and the UI shown is the real UI.
7. Real Indian faces, natural light, golden hour where possible.
8. ₹/lakh/crore on-screen only where the number is the viewer's own or comes from `pricing.json`.
9. Logo bug bottom-left (except raw UGC).
10. Recurring cast per [`cast-and-presenter.md`](cast-and-presenter.md) — the roster itself is **gated on D25**; what is already settled is that no AI face plays a customer, a broker giving testimony, or the founder.

> Open decision D25 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

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

The brand *hex* (§2) is the palette; this is the *grade* (the cinematic look). Apply one in finish (Remotion, HyperFrames or an FFmpeg LUT) per mood.

| Preset | Look | Used on |
|---|---|---|
| `VP-GRADE-CLEAN` | Bright, true-to-life, gentle contrast, protected neutral whites, accurate Indian skin tones | default office / demo / education |
| `VP-GRADE-WARM` | Lifted warmth, soft highlights, golden skin glow, slightly creamy blacks | consultant / client-care / founder warmth |
| `VP-GRADE-GOLDEN` | Golden-hour teal-orange, warm highlights + cool shadows, rich and aspirational | success / "after" / handover |
| `VP-GRADE-MOODY` | Lower-key, crushed-but-detailed blacks, desaturated except amber accents, single-source contrast | fear / loss / "before chaos" |
| `VP-GRADE-BAZAAR` | Warm highlights, slight grain, honest contrast, marigold and gulal reading true, screen glow left warm | product/UI hero & brand spots — the default brand grade |

**Always:** protect skin tones (never orange or plastic), keep marigold `#FF7A1A` and gulal `#FF3D7F` accurate after the grade, and hold one grade across every shot in a piece.

**Screen recordings are an exception.** `[REC]` footage of the real CRM keeps the product's own blue UI. Grade the room, not the screen — a regraded UI misrepresents the product.

---

## 13. Motion Graphics System (`VP-GFX-*`)

What makes it feel like a made thing, not a slideshow. Build these in Remotion (`marketing-and-sales/video-projects/my-video/`) or HyperFrames for kinetic type and chat reels, and Nano Banana Pro for stills.

- `VP-GFX-KINETIC` — kinetic typography: words pop/scale in on the beat, Unbounded 800 for the hook line, the one key word in marigold `#FF7A1A`, 1px shadow, never slow fades on hooks.
- `VP-GFX-CALLOUT` — UI callouts: animated arrows, circles, highlight boxes that draw the eye to the exact tap/button on the product screen.
- `VP-GFX-DATAVIZ` — animated counters and charts: a number ticks up from the viewer's own input ("tumhare leads → ?"), bar/line growth, pie fills. Marigold for the payoff figure, `#EF4444` for the loss figure. **Never animate a statistic we cannot source** — the counter's start and end must be the viewer's numbers or a price from `pricing.json`.
- `VP-GFX-LOWER3` — lower-thirds: name/role chips on an ink card with a marigold hairline, feature-name tags, source tickers for FW-NEWS. A chip that names a role must not imply a real customer; the AI presenter's chip says what it is.
- `VP-GFX-TRANSITION` — transitions: match-cut, whip-pan, mask-wipe on the marigold→gulal gradient, screen-into-screen for demos.
- `VP-GFX-DASH` — dashboard presentation: clean device frame, cursor/tap animation, active card lifted, depth and shadow, subtle parallax. The frame is brand-coloured; the screen inside it is the real product.
- `VP-GFX-DEPTH` — warm gradients, soft drop-shadows, layered ink-on-ink depth, paper grain. No glassmorphism and no cool-blue glow — those belong to the v1 look.

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
10. Brand & honesty — brand kit v3 tokens accurate (Unbounded/Manrope, marigold/gulal on ink/paper), zero plastic/morph/warp-text, **and the AI-presenter honesty check**: no AI face claims to be a broker, owner or customer; no unsourced figure on screen; the AI Employee, if named, carries its price and no-trial line.

> The 10 Non-Negotiables (§9) are the *floor*; this scorecard is the *bar*. Log the score against the asset's `REF-` id in `marketing-and-sales/realestateflow/content-strategy-first-month/13-ASSET-TRACKER.csv`.
