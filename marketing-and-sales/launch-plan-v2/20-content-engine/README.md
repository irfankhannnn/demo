# 20 · Content Engine — how a piece of content gets made

This layer answers one question: **given an idea, how does it become a finished, publishable asset?** Who we are talking to and what we may say is [`../10-audience-and-voice/`](../10-audience-and-voice/). Where the finished asset goes is [`../30-channels/`](../30-channels/). What happens after someone replies is [`../40-sales-and-conversion/`](../40-sales-and-conversion/).

This is a reference layer, not a schedule. The schedule is the week folders (`../week-1-foundation/` … `../month-2-plus/`) and the month-1 pack at `marketing-and-sales/realestateflow/content-strategy-first-month/`.

## The constraint everything bends around

One founder, an AI toolchain, and a part-time video editor who can cut about **three videos a week**. Every rule below exists because of that number. A plan that needs five edited videos a week is not ambitious, it is fiction.

| Tag | Producer | Tools | Makes |
|---|---|---|---|
| `[AI]` | You, driving Claude | Higgsfield MCP, HyperFrames skill, nano-banana-pro | Kinetic-type reels, WhatsApp chat-thread reels, all carousels, all posters, AI-presenter footage and voice |
| `[REC]` | You, manually | OBS / phone screen capture | Raw screen recordings of the real CRM and the real WhatsApp AI Employee |
| `[ED]` | The video editor | Whatever he already uses | Multi-shot narrative reels, presenter footage cut against b-roll, screen recordings trimmed to their best three seconds, sound design, caption burn-in |

**The routing rule:** the editor only gets work that needs human judgement. Everything templated goes to `[AI]`. If a piece is over the editor's budget for the week, either re-cut it as an `[AI]`-only format or push it to next week — do not quietly hope he finds the time.

**The editor works from one folder.** `marketing-and-sales/realestateflow/content-strategy-first-month/EDITOR-JOBCARDS/` holds one file per video: the files he is owed, the b-roll to shoot, a second-by-second timeline, the exact on-screen text, and a checklist. He never reads strategy. If you change a script, change the job card too.

## The weekly run-sheet

| Day | Action |
|---|---|
| **Thu** | Review next week's rows. Generate every `[AI]` asset in one Claude session. |
| **Fri** | Do the week's `[REC]` screen recordings in one sitting. Send the raw files to the editor. |
| **Sat** | Editor delivers the week's ~3 videos. |
| **Sun** | Review, schedule the whole week. |
| **Mon–Wed** | Write nothing. 15 minutes a day replying to comments and DMs within an hour of posting. |

Posting slot is **9:30 PM IST** for feed posts; 8:30 AM and 1:45 PM for stories. Nothing goes out 11:00–13:00 or 16:00–19:00 — the audience is on site visits.

## Asset naming and where files land

```
REF-<TYPE><NN>-<slug>-v<N>.<ext>        REF-R01-lead-kho-gaya-v1.mp4
                                        REF-C03-paisa-leak-slide2-v1.png
                                        REF-S09-khata-screenrec-RAW.mp4
```

`R` reel · `C` carousel slide · `P` poster · `S` raw screen recording · `ST` story frame.

- Generated images, video and audio → `marketing-and-sales/creative/`. There is no `marketing-and-sales/assets/`; anything pointing there is stale.
- Programmatic video builds → `marketing-and-sales/video-projects/my-video/` (Remotion), rendered with `tools/claude-skills/scripts/render-remotion.ps1`.
- Voice-overs → ElevenLabs only, via `tools/claude-skills/scripts/elevenlabs-tts.ps1`.
- Every asset gets a row in `marketing-and-sales/realestateflow/content-strategy-first-month/13-ASSET-TRACKER.csv`.

## The object model

A finished piece is a recipe of IDs. Nothing here is invented at generation time; it is selected.

| Object | ID prefix | Defined in | Count |
|---|---|---|---|
| Framework | `FW-` | [`framework-library.md`](framework-library.md) | 25 |
| Cast member | `CH-` | [`cast-and-presenter.md`](cast-and-presenter.md) | presenter + supporting roster (gated on D25) |
| Hook | `HK-<CATEGORY>-NNN` | [`hooks/hook-library.md`](hooks/hook-library.md) · [`hooks/hooks.json`](hooks/hooks.json) | 1,000 |
| CTA | `CTA-<CATEGORY>-NNN` | [`ctas/cta-library.md`](ctas/cta-library.md) · [`ctas/ctas.json`](ctas/ctas.json) | 500 |
| Visual preset | `VP-` | [`visual-system.md`](visual-system.md) | — |
| Higgsfield workflow | `HF-` | [`higgsfield-guide.md`](higgsfield-guide.md) | — |
| Content type | `CT-` | [`content-types.md`](content-types.md) | 10 |
| Content opportunity | `OPP-NNN` | [`content-plan/`](content-plan/) | 526 |

```yaml
piece: "Office group mein lead aaya, kisi ne uthaya hi nahi"
opp: OPP-009
type: CT-DRAMA
framework: FW-WHATSAPP-CHAOS
route: [ED]
cast: [CH-SALESMGR]               # labelled fiction
hook: HK-WHATSAPP-CHAOS-014
cta: CTA-COMMENT-012
language: hi-dominant
visual_preset: VP-DRAMA-OFFICE
higgsfield: HF-DRAMA-DIALOGUE
```

Two design principles are worth stating because they are what make this a system rather than a folder of ideas. **Memory over prompts:** knowledge lives in these files, and an agent loads them rather than re-deriving them each session. **Consistency by default:** the cast, the colours, the camera and the language ratios are decided once here, so output looks like one brand without anyone tuning it per piece.

## What is in this layer

| File | What it settles |
|---|---|
| [`attention-model.md`](attention-model.md) | Why a reel stops the scroll, and the three numbers that tell you whether it did |
| [`framework-library.md`](framework-library.md) | 25 script structures (`FW-*`), each with its sound, grade and performance defaults |
| [`cast-and-presenter.md`](cast-and-presenter.md) | The AI presenter, the fictional supporting cast, and the rules about who may play whom |
| [`visual-system.md`](visual-system.md) | Brand kit v3 applied to video: colour, type, camera, lighting, motion, grading, sound, and the QC scorecard |
| [`content-types.md`](content-types.md) | 10 ready-to-run recipes (`CT-*`) mapping type → framework → cast → CTA → workflow |
| [`production-pipeline.md`](production-pipeline.md) | The ten-step runtime, start to publish |
| [`prompt-library.md`](prompt-library.md) | Copy-paste prompts that load this layer and run the pipeline |
| [`higgsfield-guide.md`](higgsfield-guide.md) · [`higgsfield-skills.md`](higgsfield-skills.md) | The `[AI]` generation layer: workflows, prompt blocks, packaged slash workflows |
| [`hooks/`](hooks/) · [`ctas/`](ctas/) | 1,000 hooks and 500 CTAs, each in markdown and JSON |
| [`content-plan/`](content-plan/) | 526 scored content opportunities and how a row becomes a post |

## Source of truth, so nothing here has to repeat it

| For | Read |
|---|---|
| What the product actually does | [`../10-audience-and-voice/product-truth.md`](../10-audience-and-voice/product-truth.md) |
| What we may claim, and the pre-publish checklist | [`../10-audience-and-voice/claims-and-proof-policy.md`](../10-audience-and-voice/claims-and-proof-policy.md) |
| Handle, domain, colours, fonts, city scope | [`../10-audience-and-voice/brand-constants.md`](../10-audience-and-voice/brand-constants.md) |
| Language mix | [`../10-audience-and-voice/language-and-tone.md`](../10-audience-and-voice/language-and-tone.md) |
| Prices | [`../pricing.json`](../pricing.json) — never typed by hand, always a token |
| Visual identity | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` (v3 "Bazaar Signal") |
| What we are still deciding | [`../00-OPEN-DECISIONS.md`](../00-OPEN-DECISIONS.md) |

## The honesty floor

We are pre-launch with **zero customers**. That is not a temporary inconvenience to write around; it decides what this layer can produce.

- No customers, testimonials, agency counts, star ratings or case studies. The "200+ Agencies" trust bar is fabricated and must not come back, from any older file.
- `FW-CASE`, `FW-CUSTOMER`, `CT-CASE` and `CT-PROOF` are **disabled** until a real customer gives written permission. `VP-PROOF-HOME` and `HF-PROOF-HOME` go with them.
- No statistic or ₹ loss figure we cannot source. The pre-launch pattern is a question the viewer answers with their own numbers.
- The AI presenter speaks **for the brand**. It never claims to be a broker, an owner or a customer, and never gives a testimonial. The bio and pinned post disclose "AI presenter".
- **The founder is never on camera.** His name in a text post is fine.
- Any creative naming the WhatsApp AI Employee carries its price and no-trial line.
- Proof comes from the product: a `[REC]` screen recording of the real CRM or the real AI Employee proves the thing works without claiming anyone bought it.

## A worked example

`OPP-009` — "Office group mein lead aaya kisi ne uthaya hi nahi" — is a `CT-DRAMA` row scored 5.8, status `ok`, no gate. Pull it from the CSV → the row names `FW-WHATSAPP-CHAOS`, so [`framework-library.md`](framework-library.md) gives the structure (setup → conflict → twist → punchline → CTA) and the finish defaults (`VP-MUSIC-FUN`, `VP-GRADE-MOODY→CLEAN`, reaction stings) → [`content-types.md`](content-types.md) says `CT-DRAMA` runs on `VP-DRAMA-OFFICE` via `HF-DRAMA-DIALOGUE` with a labelled-fiction cast → pull `HK-WHATSAPP-CHAOS-014`, whose `best_frameworks` include `FW-WHATSAPP-CHAOS` → write three scenes → route them: the dialogue is `[ED]`, the product beat is `[REC]` → generate the `[AI]` stills, record the screen on Friday, send the job card → the row's `cta_category` is `COMMENT`, so pull a `CTA-COMMENT-*` line → caption → claims check → score it → schedule for 9:30 PM.

Every ID in that paragraph resolves to a real, defined object. If one does not, the piece is not ready.
