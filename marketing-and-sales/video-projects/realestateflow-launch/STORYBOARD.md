---
format: 1080x1920
duration: 29s
message: "WhatsApp rahega. Chaos jayega. — RealEstateFlow puts a real Real Estate OS behind the WhatsApp your agency already runs on."
arc: PAS with Feature-Benefit Cascade → Hook (self-diagnosis) → Pain → Reframe/thesis → The OS breadth → The money module → The AI Employee → CTA
audience: "Owners/principals of Indian real-estate agencies, 2-15 staff, Mumbai / Thane / Navi Mumbai / Pune, 28-45, Hinglish"
mode: collaborative
music: confident street-smart underscore, tight dry percussion, warm low-end, building to one punchy resolve — no vocals, no melodic sweetness
---

> **Silent-first build.** There is no `SCRIPT.md` and no voiceover — every `voiceover:` field is
> intentionally empty. All meaning is carried by burned-in on-screen text, which must survive with
> sound OFF. Music is a bed only. Reveal pacing is driven by the beat grid, not by narration.
>
> **Reel safe zones are hard layout constraints on every frame:** y 0–220 and y 1500–1920 are DEAD
> (Instagram UI). All display type, key visuals and captions live in **y 220–1500**. Keep the last
> **140px** of the right edge clear of anything meaningful.

## Video direction

**Palette system** — from `frame.md`, never invented. Ink `#1C1512` is the default ground for every
frame; paper `#FBF2E4` carries display type on ink. Marigold `#FF7A1A` is the primary accent and
marks exactly one thing per frame — the payoff. Gulal `#FF3D7F` appears **only** inside the Frame 3
hero gradient (`linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)`) and never as a flat ground or
alongside marigold on the same card. Tulsi `#1FAA59` appears **exactly once in the whole video** —
the settled tick in Frame 5. Dust `#C9BBA8` carries all secondary and disclosure text. No pain-red
anywhere: the pain frames earn their weight from density, not from a warning colour.

**Type by role** — display lines use the `display` / `h1` roles (Unbounded 800/900, sentence case,
negative-tracked). Every kicker, label, ledger row, chat bubble and disclosure uses the reading ramp
(Manrope). **No chat bubble, ledger row, or disclosure is ever set in Unbounded.**

**Motion grammar** — long-tail settles throughout; `power3` is the default and overshoot is not used
anywhere in this video. The brand voice is confident and blunt, and bounce reads as cute, which is
the one thing this audience will not forgive.

**Reveal model — the silent-film substitution.** There is no voiceover, so the usual "reveal each
piece when the VO names it" cue does not exist. **Reading time replaces it.** Every text reveal is
paced so a viewer can actually finish reading it before the next piece arrives — budget ~2.5 words
per second for display type, and never let two display lines land inside 0.6s of each other. The
anti-PowerPoint rule still binds in its stronger form: **nothing front-loads.** At t=0 a frame shows
only its first beat; every further piece arrives on its own beat across the back half.

**Rhythm / held-frame allocation** — the video alternates dense and still on purpose:

| | Frame | Energy |
|---|---|---|
| 1 | Sochna pada? | reveal → **held** (the held second IS the pressure; do not fill it) |
| 2 | Yeh aapka system hai | **densest frame in the video** — accumulation to claustrophobia |
| 3 | WhatsApp rahega | **breather / climax** — two lines, then still. The stillness is the confidence |
| 4 | Real Estate OS | dense cascade, resolving to a held grid |
| 5 | Khata Book | medium — one structure builds, one row resolves |
| 6 | Ek naya employee | conversational pacing — deliberate gaps between bubbles |
| 7 | Founding 50 | assemble → **held to the final frame** |

**Negative list — never appears in this video:** browser chrome, nav bars, scrollbars, real cursors ·
floating bokeh or purple-blue "AI" gradients · drop shadows and glows (the Bazaar Signal plane is
flat; the one sanctioned gradient is Frame 3's hero text) · any WhatsApp logo, wordmark, or green
UI chrome (we name WhatsApp in copy, we never impersonate its interface) · stock photography or any
human face · **both motion failure modes** — slideshow (dump everything by 25%, then freeze) and
screensaver (elements drifting independently to fake life). During any hold the only sanctioned
aliveness is low-amplitude **subtle jitter**; no breathing, no back-half pan or push.

**No `sfx:` is named on any frame.** SFX retrieval requires a HeyGen credential this project does
not have, so naming sounds would create a dependency that cannot resolve. The build is designed to
carry with no audio at all.

## Frame 1 — Sochna pada?

- scene: Two-beat rhetorical question in huge display type; the payoff line spring-pops on the cut
- voiceover: ""
- duration: 4s
- transition_in: cut
- status: animated
- src: compositions/frames/01-sochna-pada.html
- type: hook
- persuasion: Self-diagnosis (the viewer produces the number, we never assert one)
- beat: anxiety + recognition
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates:

**Adapt:** keep the signature in-place beat replacement — the payoff lands at the *same optical
centre* the question vacates, on a hard cut. Changed: the corpus shape escalates across 3–5 beats;
this runs two beats with a held silence between them, because the silence is the persuasion.

Scene 1 (0.0–1.6s): ink ground, nothing else in frame. `Aapki agency mein abhi` / `kitne deal live
hain?` enters by **per-word staggered reveal** (`dynamic-content-sequencing`) on a long-tail settle
(`power3`), two display lines ranged left, occupying ~72% of frame width, seated in the upper-middle
of the safe band. Centered template, single depth layer — the emptiness is deliberate.

Scene 2 (1.6–2.6s): **HOLD, completely still.** The question reads alone with nothing competing.
No jitter, no drift, no camera. This second is the whole persuasion mechanism — it is the second in
which the viewer tries to answer and cannot. Do not fill it.

Scene 3 (2.6–4.0s): **hard-cut word-swap** (`discrete-text-sequence`) — the question clears on the
cut and `Sochna pada?` arrives at the same optical centre via **spring-pop entrance**
(`spring-pop-entrance`, smooth long-tail — no overshoot) in marigold `#FF7A1A`, set larger than the
question it replaced. Holds; at most **subtle jitter** (`sine-wave-loop`, low amplitude).

narrativeRole: Opens on the viewer's own blind spot instead of a claim. The question is
unanswerable off the top of the head, and the two-word payoff names that hesitation out loud.
keyMessage: You do not actually know what is happening inside your own agency.

**Why this and not a statistic:** the claims audit (`14-METRICS-CLAIMS-REVIEW.md` §2.2) forbids
asserting a loss figure — "never assert a loss figure, make the viewer produce their own." A number
we assert is discounted as advertising; a hesitation they feel is a fact they now believe.

## Frame 2 — Yeh aapka system hai

- scene: WhatsApp message fragments pile in from all edges until they crowd the frame, then one flat line lands on top
- voiceover: ""
- duration: 4.5s
- transition_in: cut
- status: animated
- src: compositions/frames/02-yeh-aapka-system-hai.html
- type: pain_point
- persuasion: Pain agitation by accumulation — the enemy is WhatsApp-as-database, never WhatsApp itself
- beat: overwhelm → dark recognition
- blueprint: overwhelm-surround (Adapt)
- asset_candidates:

**Adapt:** keep the signature move — **elements close IN from all sides** (surrounded, never
zoomed-into). Changed: the corpus version morphs a centre element into the viewer's avatar; there is
no avatar here and no human face anywhere in this video, so the crowd closes onto **empty centre**
and the payoff line claims that emptiness instead. Bubbles are drawn as plain rounded cards — never
WhatsApp's actual UI, chrome, or green.

Scene 1 (0.0–0.8s): ink ground. Two chat fragments drop in from the top and left edges on a
long-tail settle (`power3`), each tilted a few degrees off-axis, paper cards with ink Manrope text.
Layered-depth framing, foreground layer only.

Scene 2 (0.8–2.4s): the remaining four fragments arrive **staggered from all four edges**
(index-derived, deterministic — no randomness), overlapping each other and accumulating toward the
centre. Density climbs from two cards to six; three depth layers now read (back cards smaller and
dimmed, front cards full contrast). Nothing is centred yet — the middle stays open.

Scene 3 (2.4–3.2s): **cluster→inward close** — the whole crowd pushes IN toward the open centre
(`center-outward-expansion`, run inward), overlapping tighter until the frame feels crowded.
**Depth-of-field blur** (`depth-of-field-blur`) settles on the outer ring so the pressure reads as
depth rather than clutter. This is the signature move; it is the frame.

Scene 4 (3.2–4.5s): the crowd dims to ~45% and **freezes**. `Yeh aapka system hai.` lands flat on
top at the optical centre in paper display via **spring-pop entrance** (`spring-pop-entrance`,
smooth). Held still — the line is deadpan and the motion must be too.

- `Sir woh Andheri wala flat?`
- `Payment kab aayega?`
- `Bhai file kahan hai?`
- `Kal site visit tha na?`
- `Uska number bhejo`
- `Token kitna liya tha?`

Payoff line, landing flat over the crowd: **`Yeh aapka system hai.`** (*This is your system.*)

narrativeRole: Names the real enemy precisely — not the app, but the app doing the job of a
database, a memory, a ledger and a filing cabinet.
keyMessage: Your system of record is a chat thread, and you already know it.

**Tone note:** the payoff is deadpan, not accusatory. It is the line a peer says, not a vendor.

**Why `system` and not `CRM` — and not `Real Estate Operating System` either.** The review note
correctly flagged that "CRM" is generic-category language the brand has retired. But our own
category name must not be handed to the chaos: this line points AT the mess, so calling the mess a
"Real Estate Operating System" crowns the enemy with the term we need to own — and four words kill
a deadpan payoff that has to land in huge type in under a second. `system` keeps the burn, drops
the retired word, and does narrative work the original line could not: it sets up the direct echo
in Frame 4 (`Ek system. Poori agency.`) and lands squarely on the brand's core belief — *"a real
estate business without a system is a risky business."* The category term itself is planted in
Frame 4, on our product, where it belongs.

## Frame 3 — WhatsApp rahega

- scene: The crowd clears; the thesis lands in two halves — the concession, then the promise
- voiceover: ""
- duration: 3.5s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-whatsapp-rahega.html
- type: product_intro
- persuasion: Negative contrast + friction reduction (the ask is near-zero behaviour change)
- beat: relief
- blueprint: kinetic-type-beats (Reproduce)
- asset_candidates:

**Reproduce:** a statement built across full-screen beats, each its own move, resolving on a payoff.
The slots map cleanly — two beats, two lines, and the payoff carries the accent.

Scene 1 (0.0–1.4s): the `zoom-through` transition delivers a clean ink field. `WhatsApp rahega.`
enters by **per-word staggered reveal** (`dynamic-content-sequencing`) on a long-tail settle, paper
display, ranged left in the upper-middle of the safe band, ~80% of frame width. Nothing else on
screen — this frame gets the most negative space in the video.

Scene 2 (1.4–2.4s): `Chaos jayega.` lands directly beneath via **spring-pop entrance**
(`spring-pop-entrance`, smooth long-tail, no overshoot), filled with the approved hero gradient
`linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)` — the only gradient in the whole video, and the
only place gulal appears. Set at the same size as the line above it: the two halves are equals, and
the design must not argue with the copy.

Scene 3 (2.4–3.5s): **held, still.** No camera, no drift, at most **subtle jitter**
(`sine-wave-loop`, low amplitude). This is the climax and the breather at once — after Frame 2's
crowd, stillness is what makes the claim feel true rather than shouted.

1. `WhatsApp rahega.` — paper `#FBF2E4`, lands first and HOLDS
2. `Chaos jayega.` — lands beneath it in the approved hero gradient
   `linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)`

narrativeRole: **The message frame.** Per `story-spine.md` §2 the value claim must land by beat 2–3;
this is it. Every frame after this is evidence for this line.
keyMessage: You do not have to leave WhatsApp. You have to put something behind it.

**Why the concession comes first:** "leave WhatsApp" asks for total behaviour change, which is why
every CRM before us died in this market. Conceding WhatsApp in the first half of the line is what
makes the second half credible — and it is what makes Frame 6's AI Employee proof rather than
contradiction.

## Frame 4 — Apni agency ka Real Estate OS

- scene: A 16-tile module grid self-assembles in a fast staggered cascade and holds as one dense field
- voiceover: ""
- duration: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-real-estate-os.html
- type: feature_showcase
- persuasion: Value stacking — breadth asserted all at once, so the category reads as "system", not "tool"
- beat: scale + control
- blueprint: grid-card-assemble (Reproduce)
- asset_candidates:

**Reproduce:** N items self-assemble in a staggered cascade into a grid and hold. This is the shape's
home case — enumerate breadth at once — and the slots map directly onto the sixteen modules.

Scene 1 (0.0–0.8s): ink ground. The kicker `REAL ESTATE OPERATING SYSTEM` reveals across the top of
the safe band in Manrope 800 uppercase, tracked, in dust `#C9BBA8`. Nothing else yet.

Scene 2 (0.8–3.6s): the sixteen module tiles **self-assemble in a staggered cascade**
(`dynamic-content-sequencing`) in reading order — left-to-right, top-to-bottom — each arriving by
**spring-pop entrance** (`spring-pop-entrance`, smooth) with an index-derived delay. Deterministic:
the stagger derives from tile index, never from randomness. Tiles are flat ink-2 `#251C16` cards with
a `#3A2E25` hairline, paper Manrope labels, generous radius. 4×4 grid filling ~78% of frame width,
seated in the middle of the safe band. Three depth layers: ink ground, tile field, kicker.

Scene 3 (3.6–4.6s): the **Khata Book** tile transitions to a marigold `#FF7A1A` ground with ink text
via **keyword glow** (`asr-keyword-glow`, attack-decay-rest — the glow resolves to a flat marigold
fill, no residual bloom, since the plane stays flat). The other fifteen tiles hold unchanged. This
pre-lights the tile Frame 5 pushes into, so the next cut reads as motivated rather than arbitrary.

Scene 4 (4.6–6.0s): `Ek system. Poori agency.` reveals beneath the grid by **per-word staggered
reveal**, paper display, sized well below the grid so it reads as a caption to the field rather than
competing with it. Grid and line hold together, still.

Spelled out in full, never abbreviated to "OS" and never softened to "CRM" — this frame is where
the category claim is planted, on our product. It is the direct answer to Frame 2's
`Yeh aapka system hai.`

The 16 tiles, cascading in reading order — **every one verified against the codebase**
(`14-METRICS-CLAIMS-REVIEW.md` §2.3 + the CRM app's own page modules):

| | | | |
|---|---|---|---|
| Leads | Buyers | Owners | Tenants |
| Contacts | Properties | Projects | Developers |
| Areas | Rentals | **Khata Book** | Calendar |
| Documents | Call Recordings | Analytics | Team |

Closing line under the grid: `Ek system. Poori agency.` (*One system. The whole agency.*)

narrativeRole: This is the "all features" beat. At 29s, breadth has to arrive as one legible field
rather than sixteen cuts — the cascade IS the argument.
keyMessage: This is not another chatbot. It is the whole operating system for the agency.

**Khata Book is set in marigold** while the other fifteen tiles stay paper-on-ink — it is the tile
Frame 5 pushes into, and pre-lighting it makes that cut feel motivated rather than arbitrary.

## Frame 5 — Kisne kitna dena hai

- scene: The Khata Book tile expands into a two-column ledger card; rows land, one settles with a tulsi tick
- voiceover: ""
- duration: 3s
- transition_in: push-slide UP
- status: animated
- src: compositions/frames/05-khata-book.html
- type: benefit_highlight
- persuasion: Risk reduction made concrete — the pillar with a rupee attached
- beat: control
- blueprint: device-surface-showcase (Adapt)
- asset_candidates:

**Adapt:** keep the signature — a held hero surface whose content advances through a real flow,
cursorless and stepwise. Changed: no device mockup or phone bezel (the brand's flat plane does not
carry chrome), so the ledger card itself is the held surface. The **handoff from Frame 4's marigold
tile is the entrance**, not a separate reveal.

Scene 1 (0.0–0.7s): the marigold Khata Book tile from Frame 4 **card morph-anchors**
(`card-morph-anchor`) up and outward into a full ledger card — same centre, growing scale and
radius, marigold receding to an ink-2 `#251C16` card surface with a marigold top edge. The label
`KHATA BOOK` sits above it in marigold Manrope 800, uppercase, tracked.

Scene 2 (0.7–1.6s): the headline `Kisne kitna dena hai.` / `Kisne kitna lena hai.` reveals by
**per-word staggered reveal**, paper display, two lines above the card. The card's two column
headers — **To Give** / **To Take** — arrive with it in dust Manrope, split evenly across the card.

Scene 3 (1.6–2.4s): four ledger rows **cascade in** (`dynamic-content-sequencing`), index-staggered,
each row carrying party · property · category (Brokerage · Maintenance · Security Deposit · Rent) in
Manrope with `tabular-nums` on the amounts so the columns align optically.

Scene 4 (2.4–3.0s): the second row resolves to `Settled ✓` in tulsi `#1FAA59` — **the only green in
the entire video** — via a short **keyword glow** (`asr-keyword-glow`) that settles flat. Held still.

Headline: `Kisne kitna dena hai.` / `Kisne kitna lena hai.`
(*Who owes what. Who is owed what.*)

Ledger card — two columns, **To Give** / **To Take**, rows carrying party + property + category:

- Brokerage · Maintenance · Security Deposit · Rent

One row resolves to `Settled ✓` in tulsi `#1FAA59` — the only green in the entire video.

narrativeRole: Turns the abstract grid into the one module an owner feels in their stomach. Money
is the buying trigger named in the ICP: "the moment they lose money or face to a mistake they
can't explain."
keyMessage: The money your agency is owed stops living in your head.

## Frame 6 — Ek naya employee

- scene: A WhatsApp thread on an ink card — a Hinglish message arrives, and the reply performs a real CRM operation
- voiceover: ""
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-ai-employee.html
- type: feature_showcase
- persuasion: Show-don't-tell proof — the feature that vindicates the Frame 3 thesis
- beat: intrigue → inevitability
- blueprint: prompt-type-submit-generate (Adapt)
- asset_candidates:

**Adapt:** keep the signature — the ask arrives, **status theater breathes a beat**, then the machine
answers and the result is the payoff. Changed: the "prompt" is not typed into a product input, it is
an incoming WhatsApp message from a client, because that is literally how this product works. The
thread is drawn as plain rounded bubbles on an ink card — **no WhatsApp logo, wordmark, or green
chrome anywhere.** We name WhatsApp in copy; we never impersonate its interface.

Scene 1 (0.0–0.6s): ink ground. The label `WHATSAPP AI EMPLOYEE` reveals top of the safe band in
marigold Manrope 800, uppercase, tracked. An ink-2 `#251C16` thread card seats beneath it, empty.

Scene 2 (0.6–1.8s): the incoming bubble arrives from the left on a long-tail settle — paper
`#FBF2E4` ground, ink Manrope text, generous radius:
`Andheri West mein 2BHK kharidar chahiye, budget 85L`. Left-aligned in the card. Held long enough to
be read completely — this is the frame's longest single dwell and it must not be rushed.

Scene 3 (1.8–2.6s): **status theater** — a three-dot typing indicator appears on the right side of
the thread and animates via **live SVG internals** (`svg-icon-enrichment`, finite bounded, no
`repeat`). Nothing else moves. This beat is what makes the reply feel earned rather than instant.

Scene 4 (2.6–3.8s): the outgoing bubble **spring-pops** in from the right (`spring-pop-entrance`,
smooth) — marigold `#FF7A1A` ground, ink text: `Lead ban gaya ✓` on the first line, then
`Faizan Khan · 2BHK · Andheri West · ₹85L` beneath it in a smaller Manrope weight. The tick is ink,
not tulsi — tulsi is spent in Frame 5 and appears only once.

Scene 5 (3.8–5.0s): `Aapka WhatsApp. Aapka number.` / `Ek naya employee.` reveals beneath the card
by **per-word staggered reveal**, paper display. The **disclosure** —
`Optional add-on · ₹5,000/month · no free trial` — reveals last in dust `#C9BBA8` Manrope,
comfortably inside the safe band and at a size that survives a phone screen. Held still.

The thread, timed as a real exchange:

1. Incoming bubble (paper `#FBF2E4`, ink text): `Andheri West mein 2BHK kharidar chahiye, budget 85L`
2. A held typing indicator — the machine visibly works
3. Outgoing bubble (marigold `#FF7A1A`, ink text): `Lead ban gaya ✓` / `Faizan Khan · 2BHK · Andheri West · ₹85L`

Line beneath: `Aapka WhatsApp. Aapka number.` / `Ek naya employee.`

**★ MANDATORY DISCLOSURE — renders on this frame, legible, never trimmed:**
`Optional add-on · ₹5,000/month · no free trial`

narrativeRole: The differentiator, and the structural payoff of Frame 3. The CRM went inside
WhatsApp, so keeping WhatsApp and killing the chaos are the same act.
keyMessage: A new employee who already knows Hinglish and never opens a CRM.

**Claims discipline:** the AI genuinely parses this Hinglish vocabulary (`kharidar`, `kirayedar`,
`makan`, `malik`, `sampark`, `milan`, `kitne`, `dikhao` — `server/agents/domainRouter.js`) and
genuinely creates leads from WhatsApp (`server/shared/toolDefinitions.js`). Nothing here is
aspirational. The disclosure is required by `14-METRICS-CLAIMS-REVIEW.md` §2.4 — **do not remove it
to tighten the frame.** If the free-CRM-trial message implies the AI is free, the first billing
conversation is where trust dies.

## Frame 7 — Founding 50

- scene: Elements clear off-frame, the logo lockup draws itself in, and the offer stacks beneath it
- voiceover: ""
- duration: 3s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-founding-50.html
- type: cta
- persuasion: Scarcity + risk reversal, stated exactly as approved
- beat: urgency-to-act
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/realestateflow-logo.svg
- roles: realestateflow-logo.svg = cutout (the hero mark; all type lays out beneath it)
- asset_candidates: assets/realestateflow-logo.svg — the RealEstateFlow mark, ink square with paper house, wordmark and one marigold flow wave

**Adapt:** keep the signature — the mark **comes to exist on screen** and resolves into a centred
lockup extended to a CTA. Changed: no camera push-through (this is a 3s end card on a reel, and a
push would fight the held read the offer needs); the mark's own **flow waves draw themselves in**
instead, which uses the logo's existing structure rather than an imposed effect.

Scene 1 (0.0–1.0s): ink ground. The logo's house outline **self-draws** (`svg-path-draw`)
stroke-by-stroke in paper, then its four flow waves draw in sequence — the **third wave last and in
marigold** `#FF7A1A`, so the brand's one accent is the final stroke of the build. Centred, upper
portion of the safe band, ~40% of frame width.

Scene 2 (1.0–2.0s): `Founding 50` reveals beneath the mark via **spring-pop entrance**
(`spring-pop-entrance`, smooth) in marigold display — the largest type on the card after the mark.

Scene 3 (2.0–3.0s): the offer stack **cascades in** (`dynamic-content-sequencing`), tight
index-stagger, Manrope in dust: `2 months free · no credit card`, then
`6-month money-back guarantee`, then `realestateflow.in` in paper. Everything **holds to the final
frame** — this is the one frame a viewer may pause on, and it must be legible at rest. Subtle jitter
at most; no exit motion.

- `Founding 50` — marigold, the largest line after the mark
- `2 months free · no credit card`
- `6-month money-back guarantee`
- `realestateflow.in`

narrativeRole: Converts on specificity and scarcity, not on social proof — we have none, and
inventing it is banned.
keyMessage: First 50 agencies. Free to start. Nothing to lose.

**Nothing here may drift.** The offer is stated identically across every asset or not at all
(`01-STRATEGY-AND-POSITIONING.md` §4.3). **No trust bar** — "200+ Agencies · Mumbai · Delhi · Pune ·
Dubai" is false and is deleted from every template. If we commit to Founding 50, all 50 get honoured.
