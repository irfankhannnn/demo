# 11 - Generation Prompts `[AI]`

Paste-ready prompts for the assets you produce yourself with Higgsfield MCP, the HyperFrames skill,
and nano-banana-pro.

**Order of operations for the month:**
1. §1 - lock the Arjun character reference **once** (do this first, before anything else)
2. §2 - generate the 8 presenter clips
3. §3 - generate b-roll that's easier to make than to shoot
4. §4-5 - build the 5 HyperFrames reels
5. §6 - generate the 6 carousels and 4 posters

---

## 1. ★ Lock the character (do this first)

Before generating any Arjun video, create and save a character reference so he is identical all
month. An inconsistent face reads as a fake brand.

**Step 1 - load the workflow:**
```
get_workflow_instructions({ workflow: "character-sheet" })
```
Follow its instructions. Then generate with this prompt:

**Character sheet prompt:**
> Character reference sheet, photorealistic, of a 34-year-old Indian man. Medium-brown skin, North
> Indian features. Short thick black hair with a small amount of grey at the temples, not styled.
> Neatly trimmed short beard, heavier than stubble but not full. Average build, slightly heavier
> than a model, realistic body. Wearing a plain dark charcoal half-sleeve shirt, no pattern, no
> branding, no tie. A simple steel wristwatch. No other jewellery. Expression: level, direct,
> faintly amused - not smiling at camera. Multiple angles: front, three-quarter left, three-quarter
> right, profile. Neutral warm lighting. He should look like a competent small-business owner in
> Mumbai, not a model and not a corporate executive. Warm natural photography, mild film grain,
> shallow depth of field. Not studio-lit. Not glossy.

**Step 2 - save the media ID.** Record it here:

```
ARJUN_CHARACTER_REF_ID = ____________________
ARJUN_VOICE_ID         = ____________________
```

### ✅ GENERATED 7 Aug 2026 - pick one and fill in the ID above

Four variants were generated with `soul_2`, 16:9, 2K, from the prompt above.
**Look at all four, pick ONE, write its job_id into `ARJUN_CHARACTER_REF_ID`, and delete the other
three from your mind.** From that point every presenter generation attaches only that ID.

| Variant | job_id (this is the reference ID) | seed |
|---|---|---|
| A | `0af62472-4614-4434-b79d-9dd8487a9821` | 828278 |
| B | `a89e3333-aa45-4a03-b557-058d8712f88c` | 951987 |
| C | `976abef9-07f3-4938-b9a5-5227a4c34a45` | 553222 |
| D | `f0ca09ba-d512-4b71-a97a-ad9ed599406a` | 353265 |

**How to judge them.** Reject any variant that fails these, and regenerate rather than settling -
this face is on 8 reels and you cannot change it later:

- [ ] Reads as **34-36**, not 20s. No babyface, no soft round jaw.
- [ ] Build is **ordinary**, not gym-fit. Slightly soft midsection.
- [ ] Skin has **visible pores and texture**. If it looks airbrushed or waxy, reject.
- [ ] **Not smiling at camera.** Level, direct, faintly amused.
- [ ] Shirt is **plain dark, no pattern, no branding, no tie, no jacket.**
- [ ] Left panel is **standing, full body, both feet visible, not cropped, not sitting.**
- [ ] Right panel is a **tight close-up**, not a second full body.
- [ ] **Exactly one person.** No duplicate figure, no mannequin, no reflection.
- [ ] Does **not** resemble any recognisable actor or public figure. If it does, regenerate.

If several fail, re-run the §1 prompt for 4 more. It costs under 4 credits.

Every generation below must attach that reference. Every VO must use that voice ID.

**Step 3 - before generating video**, check the workflow catalog rather than guessing:
```
get_workflow_instructions()                        // see the catalog
get_workflow_instructions({ workflow: "<the talking-head / UGC one>" })
```

---

## 2. Presenter clip prompts (8 reels)

**Shared suffix - append to every prompt below:**

> Shot on a 40mm lens, medium close-up, chest and head in frame. Subject positioned left of centre,
> leaving the right third of the frame empty. Handheld with slight natural drift, not locked off.
> Warm golden natural light from one side, single source. Slightly lifted blacks, mild film grain,
> realistic skin texture. Vertical 9:16 framing. Photorealistic, documentary feel - like a good
> phone camera at golden hour, not a commercial. No text, no captions, no graphics, no logo.

---

**R01 - E2, car, evening**
> [Character ref] sitting in the driver's seat of a parked car, seatbelt off, evening light coming
> through the windscreen behind him. He is talking directly to the camera, calm and direct, with
> small natural hand movements. The car interior is ordinary - an Indian mid-range sedan, slightly
> lived-in.

**R03 - E1, the real office** *(week 1 hero - generate 3 variations, pick the best)*
> [Character ref] sitting at a laminate desk in a small Indian real-estate brokerage office. Behind
> him: a whiteboard with faint handwriting, a stack of paper files, a cheap office chair, one window
> with warm afternoon light. The room is slightly cluttered and clearly real. He is talking directly
> to camera, leaning slightly forward, serious.

**R04 - E3, under-construction flat, morning**
> [Character ref] standing inside an unfinished apartment - bare cement walls, exposed electrical
> wiring, construction dust in the air. Bright morning light coming through an unfinished window
> opening behind him. He is talking to camera, calm, half-smiling.

**R05 - E1, office, at the desk**
> [Character ref] seated at a desk in a small Indian brokerage office, papers and a receipt book
> visible on the desk in front of him, slightly out of focus. Warm afternoon light. He is talking
> directly to camera, asking a question, leaning in.

**R08 - E3, under-construction flat** *(week 2 hero)*
> [Character ref] standing in an unfinished apartment with bare cement and exposed wiring. Softer,
> cooler light than R04 - overcast daylight through the window opening. He is talking to camera,
> serious, delivering an uncomfortable truth.

**R09 - TWO clips required** *(month hero)*

*Clip A (0-24s), E1, cooler grade:*
> [Character ref] seated at a laminate desk in a small brokerage office, slightly cooler and flatter
> light than usual, overcast daylight from the window. He is talking to camera, plain and matter-of-
> fact, almost tired.

*Clip B (24-38s), E4, warmer grade, energy lift:*
> [Character ref] seated at the same desk but now with an open laptop in front of him, warmer golden
> light, slightly brighter room. He is talking to camera with visibly more energy, leaning forward,
> making a point with his hands.

> **The contrast between clip A and clip B is the emotional pivot of the entire month.** Generate
> both in one session so the wardrobe and room match, but push the lighting difference hard.

**R13 - E2, car, evening, intimate**
> [Character ref] in the driver's seat of a parked car in the evening, warm low light, quieter and
> more reflective than usual. He is talking to camera softly, honestly, without performing. Less
> hand movement, more stillness.

**R18 - E1, office, direct**
> [Character ref] seated at a desk in a small brokerage office, warm light, talking directly to
> camera with quiet confidence. Clear, straightforward delivery - making an offer, not a pitch.

---

## 3. B-roll generation prompts

Generate these rather than sourcing them - they're specific enough that stock won't match.

**Night notification (R01)**
> Overhead shot of a smartphone lying face-up on a dark bedside table in a dark room. The screen
> lights up with an incoming message notification, illuminating the surrounding surface. Handheld,
> shallow depth of field, warm screen glow against near-black surroundings. Photorealistic, no
> readable text on screen.

**Chat list scroll (R01, R04, R09)**
> Close-up of a smartphone screen showing a long messaging app conversation list, scrolling rapidly
> downward, rows blurring with motion. Held in a hand, slight tremor. Warm indoor light. Anonymous
> grey message rows, no readable names, no recognisable brand UI.

**Desk being cleared (R03)**
> An office desk in a small Indian workplace being emptied - a drawer pulled open and emptied, a
> chair pushed in, papers removed, leaving a bare laminate surface. Warm afternoon light, handheld,
> documentary feel, melancholy.

**Contacts scroll (R03)**
> Close-up of a smartphone contact list scrolling slowly, showing many entries. Held in a hand.
> Warm indoor light. Names blurred or generic - nothing readable or identifying.

**Two phones (R03)**
> Two smartphones lying side by side on a wooden desk in a small office, warm directional light,
> shallow depth of field, shot from a slight angle above. Both screens dark. Quiet, still, slightly
> tense composition.

**Rent diary (R04, R05)**
> Close-up of a handwritten Indian accounts ledger or diary, ruled pages with columns of handwritten
> figures and names in blue ink. A hand turns a page slowly. Warm desk lamp light, shallow depth of
> field, visible paper texture and slight wear.

**Paperwork pile (R05)**
> Close-up of receipts, an invoice, and a handwritten notepad with figures spread on a laminate desk
> in a small office. Warm afternoon light from one side. Handheld, shallow focus moving across the
> papers.

**Dead CRM laptop (R09)**
> A laptop on a desk in a small office, screen showing a generic anonymous software login form.
> A thin layer of dust visible on the keyboard. Then a hand slowly closes the lid. Warm but flat
> light, slightly cold grade, quiet and abandoned feeling. No recognisable brand or readable text.

**Build b-roll (R13)**
> A notebook with hand-drawn workflow diagrams and arrows, next to a laptop showing an unfinished
> interface, on a desk in a small workspace. Evening light. Handheld, shallow depth of field,
> intimate and unglamorous.

---

## 4. HyperFrames kinetic-type reels (R02, R06, R11, R16)

These are text-only compositions. Use the HyperFrames skill - start by loading `hyperframes` (the
router skill), which will point you at `motion-doctrine` and `cut-the-curve` for the motion rules.

### Shared build spec

```
Canvas          1080 × 1920, 30fps
Ground          #1C1512 (Ink)
Display font    Unbounded 900, ~105px, line-height 1.05
Body font       Manrope 600 (only for the small disclosure line in R16)
Colours         Dust #C9BBA8 · Marigold #FF7A1A · Gulal #FF3D7F · Error #EF4444
Safe zone       all text between y 220 and y 1500; text block vertically centred ~y 850
Logo            "RealEstateFlow" Manrope 600, 32px, Dust, bottom centre at y 1420, final 2s only
Audio           none, or a single low sub-hit on the key beat
```

### Motion rules (these are what make it not look cheap)

- **Word-by-word waterfall entry**, ~0.06s stagger, each word arriving with a short power-ease.
- **Then absolute stillness.** No drift, no float, no breathing scale. If it isn't performing a
  move, it is frozen.
- **One accent lit at a time.** When line 2 lights up in marigold, line 1 drops to Dust. Never two
  accent colours simultaneously.
- **Line transitions use a nudge slide** - slow, fast, slow - not a linear move or a crossfade.
- Hold the final composition **2 full seconds** before the logo, and cut hard to black so it loops.

### Per-reel content

Exact text, timings and colour assignments are in the script files:
- **R02** → `06-SCRIPTS-WEEK-1-2.md`
- **R06** → `06-SCRIPTS-WEEK-1-2.md`
- **R11** → `07-SCRIPTS-WEEK-3-4.md` *(includes a drawn strike-through - animate it left to right over 0.25s, error red, on the word "software" only)*
- **R16** → `07-SCRIPTS-WEEK-3-4.md` *(**mandatory**: the ₹5,000/month disclosure line at 11s must be fully legible - Manrope 600, 34px, Dust. Do not shrink or dim it below readable.)*

---

## 5. HyperFrames WhatsApp chat reel (R07)

A chat-thread animation. Same canvas and fonts as §4.

```
Card ground     #251C16 (Ink 2), rounded 20px, inset 60px from frame edges
Incoming bubble left-aligned,  #2E241D ground, Paper text, Manrope 500, 44px
Outgoing bubble right-aligned, #FF7A1A ground, Ink text, Manrope 600, 44px
Bubble radius   18px, max width 70% of card
Timestamps      Manrope 400, 24px, Dust at 50%, bottom-right inside each bubble
```

**Motion:** each bubble scales in from 92% with a short overshoot, ~0.18s, staggered by the read
time of the previous bubble. A typing indicator (three dots, Dust, gentle pulse) appears for 0.5s
before each reply.

**Table reveal at 12.5s:** the chat blurs to 8px and pushes back to 88% scale; a clean two-column
table scales in over it on an Ink card. Table headers Manrope 800, marigold. A marigold row
highlight sweeps down the rows over 1.5s.

> **Do not clone WhatsApp's exact green or its UI chrome.** Use the brand's dust-grey and marigold.
> This is a stylised skit, not an imitation of the app, and it must not be mistakable for a real
> screenshot.

Exact chat content is in `06-SCRIPTS-WEEK-1-2.md` under R07.

---

## 6. Carousels & posters (nano-banana-pro)

Use the `nano-banana-pro` skill. All output **1080×1350 (4:5), PNG.**

### Shared style block - prepend to every carousel/poster prompt

> Flat graphic design poster, no photography, no 3D, no gradients except where specified. Bold
> editorial layout with generous margins. Display type in Unbounded ExtraBold, body type in Manrope.
> Colour palette strictly limited to: warm near-black #1C1512, cream #FBF2E4, orange #FF7A1A, pink
> #FF3D7F, green #1FAA59, muted tan #C9BBA8. High contrast, confident, modern Indian design
> sensibility - bold and warm, not corporate and not minimalist-Scandinavian. Text must be crisply
> rendered and perfectly legible. 1080×1350 vertical.

### Per-slide approach

Generate **each slide individually**, not as a set. For each one, take the exact copy from
`08-CAROUSELS-AND-STATICS.md` and wrap it:

```
[shared style block]
Ground colour: [gulal #FF3D7F / ink #1C1512 / marigold #FF7A1A / paper #FBF2E4]
Headline (Unbounded ExtraBold, [colour], large, left-aligned):
"[exact headline text]"
Body (Manrope, [colour], smaller, below):
"[exact body text]"
[Any bullet dots in marigold #FF7A1A]
[Small "→" swipe cue bottom-right in muted tan, Manrope - slides 1-4 only]
```

**If the model garbles the Hinglish text** - which it will on longer lines - generate the layout
without text and composite the copy yourself, or regenerate slide-by-slide with shorter strings.
Legibility beats a single-pass generation every time. **Never ship a slide with misspelt Hinglish.**

### Posters

| ID | Ground | Key requirement |
|----|--------|-----------------|
| **P01** | Paper `#FBF2E4` | Two-panel meme layout. Must feel hand-made and warm, not designed. No logo lockup, no CTA. |
| **P02** | Ink `#1C1512` | Two questions stacked, marigold display type. Heavy white space. |
| **P03** | Split ink / ink-2 | Hard vertical split, no gradient across the seam. Left desaturated + error red label, right warm + tulsi label. |
| **P04** | Marigold `#FF7A1A` | Loudest asset of the month. Enormous "FOUNDING 50" in ink. Tulsi checkmarks. The ₹5,000 disclosure line must be present and legible. |

---

## 7. Grid check before you post

After generating each week's assets, lay the ground colours out against the sequence in
`05-CALENDAR-30-DAY.md` §"Feed grid check". If you've substituted a ground colour, re-sequence - no
three adjacent tiles may share a ground.

---

## 8. Generation session checklist

- [ ] `ARJUN_CHARACTER_REF_ID` recorded in §1 and attached to every presenter generation
- [ ] `ARJUN_VOICE_ID` fixed and used for every VO
- [ ] VO scripts use TTS spelling from `04` §5 (numbers as words)
- [ ] On-screen text uses digits (`₹15,000`), not words
- [ ] Environment rotated - not the same as the previous reel
- [ ] Marigold and gulal never accenting the same frame
- [ ] Every Hinglish string proofread against `03` §6 spelling standard
- [ ] R16's ₹5,000 disclosure present and legible
- [ ] C06 commands checked against the real capability list in `02` §2
- [ ] Feed grid re-checked
