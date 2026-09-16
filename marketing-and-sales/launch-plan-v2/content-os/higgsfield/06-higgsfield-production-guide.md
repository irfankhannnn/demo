# 06 — Higgsfield Production Guide

**Purpose:** The production layer of the RealEstateFlow Content OS. This document maps our **25 frameworks (`FW-*`)**, **9 characters (`CH-*`)**, and **visual presets (`VP-*`)** onto **Higgsfield**'s real, currently-supported image + video generation capabilities, and gives copy-paste production recipes.

> Upstream context:
> - Frameworks → `frameworks/03-framework-library.md` (25 × `FW-*`)
> - Characters → `characters/04-character-system.md` (9 × `CH-*`, each with a consistency prompt)
> - Visual system → `visual-system/05-visual-system.md` (`VP-CAM-*`, `VP-LIGHT-*`, `VP-MOTION-*`, scene bundles)
> - MCP wiring → repo `/.mcp.json` (`higgsfield` = `https://mcp.higgsfield.ai/mcp`, HTTP transport, OAuth)
> - Brand truth → `/.brand/brand-kit.md` (primary `#2563EB`, gradient `#2563EB→#7C3AED`, font **Inter**)

---

## 0. How this was researched (verification log)

Research date: **2026-06-17**. Verified via web search against Higgsfield's official pages and third-party guides (Higgsfield blog, MCP guides, Soul ID guides, Supercomputer pages, a public Higgsfield MCP reference implementation on GitHub).

**Verification key used throughout this doc:**
- ✅ **Verified** — confirmed via web research on multiple sources.
- 🟡 **Likely / partial** — reported by one credible source or strongly implied; confirm exact name/param in-tool before production.
- ⚠️ **Verify before use** — plausible from product structure but NOT confirmed; treat as an assumption.

> IMPORTANT: The Higgsfield platform ships new models and renames features frequently (Cinema Studio 2.5 → 3.5, Soul → Soul 2.0, Nano Banana Pro → Nano Banana 2, etc.). Tool names and model IDs below are the best-verified set as of the research date. **Always call the MCP's own "list models / list presets / list characters" tools at run time** to get the live, authoritative IDs before generating. Do not hardcode a model ID that an MCP listing call contradicts.

Sources consulted:
- Higgsfield MCP — https://higgsfield.ai/mcp
- Higgsfield Skills — https://higgsfield.ai/skills (and https://github.com/higgsfield-ai/skills)
- Higgsfield Supercomputer — https://higgsfield.ai/supercomputer-intro
- Higgsfield Soul ID guide — https://scribehow.com/page/Higgsfield_Soul_ID_The_Best_Tool_for_AI_Character_Consistency_in_2026__i1nfbuF-TcalH-r-LeNQgg
- Higgsfield MCP guide — https://mcp.directory/blog/higgsfield-mcp-guide
- Higgsfield MCP reference implementation — https://github.com/geopopos/higgsfield_ai_mcp
- Cinema Studio — https://higgsfield.ai/cinematic-video-generator
- MCP guide (SoloSoft) — https://www.solosoft.dev/post/higgsfield-ai-mcp-guide-2026/

---

## 1. Verified Capabilities (what Higgsfield ACTUALLY supports today)

### 1.1 The product surface
Higgsfield is an AI image + video generation platform. We touch it three ways:

| Surface | What it is | We use it for |
|---|---|---|
| **Higgsfield MCP** (`mcp.higgsfield.ai/mcp`) | ✅ Remote MCP server (HTTP + OAuth, no API keys in config). Exposes image gen, video gen, character training, history. Works with Claude (web, Cowork, Claude Code), and other agents. | ✅ Primary production path — our agents call it directly. |
| **Higgsfield Supercomputer** | ✅ Agentic chat product. You describe a reel/ad/"a week of content"; it plans, picks models+presets, and delivers finished assets. Runs on the "Hermes Agent" engine; advertises 40+ built-in tools and reusable **Skills** (slash workflows like `/montage`, `/cinematic`). | 🟡 Optional higher-level orchestration when we want one prompt → finished asset instead of step-by-step MCP calls. |
| **Higgsfield web app / Cinema Studio** | ✅ The GUI: Soul (image), Cinema Studio (cinematic video), Marketing Studio (branded ads), motion/camera presets, Elements. | Manual fallback / character training / QC. |

### 1.2 Image generation — ✅ Verified
- Text-to-image and reference-image-to-image. ✅
- Flagship image model is **Soul** (a.k.a. Soul 2.0 / Soul V2) for photoreal people; also routes to **Nano Banana Pro / Nano Banana 2 (Gemini 3 Pro Image)**, **Flux 2**, **GPT Image 2**, **Seedream**. ✅
- Output up to **4K** resolution (typical fast path 720p/1080p). ✅ Images usually return in a few seconds. ✅
- Built-in **prompt enhancement** engine that auto-enriches a basic prompt with lighting/DoF/atmosphere/camera. ✅

### 1.3 Video generation — ✅ Verified
- **Image-to-video** is the core path (animate a still). ✅
- Text-to-video also supported via the underlying frontier models. ✅
- Clips up to ~**15 seconds**; many presets default to short clips (≈5s). ✅ (One MCP reference implementation hard-codes 5s clips — 🟡 length may be model/preset dependent, so request the length you need and verify.)
- Accessible video models include **Veo 3.1**, **Kling 3.0**, **Sora 2**, **Seedance 2.0**, plus Higgsfield's own motion/camera engine ("DoP" / Cinema Studio motion). ✅ (This matches the repo `CLAUDE.md` list: Nano Banana Pro, Veo 3.1, Kling 3.0, Sora 2.)
- **Cinema Studio** = pro control center: camera/lens simulation, transitions, fine motion design. ✅

### 1.4 Character consistency — Soul ID / Soul — ✅ Verified
- **Soul ID** trains a persistent digital identity from a few uploaded photos (training ≈5 min). Once trained, the identity holds across generations regardless of style/lighting/angle/prompt. ✅
- The trained **Character ID** is reusable across **both image and video** generations. ✅
- Via MCP this surfaces as a **create-character / list-characters** capability that returns a reusable character reference ID. ✅
- **Elements** (Cinema Studio) = reusable project assets (characters, locations, props) referenced with **@tags**, shareable with a team, kept consistent across shots. ✅ This is the broader "consistency" system; Soul ID is the per-person face lock.

### 1.5 Camera control & motion presets — ✅ Verified
- Motion control panel with cinematic moves: **pan, tilt, dolly, zoom, crash zoom, FPV drone**, and combinations in one clip. ✅
- Curated **video presets** (reported ~9): **UGC, unboxing, product review, hyper motion, TV spot**, and more — queryable and passed into generation. ✅
- Kling 3.0 "Motion Control" and Cinema Studio camera/lens simulation give director-level control. ✅
- Motion is applied as a **motion preset / motion_id** on the image-to-video call. ✅ (exact id list = read at run time.)

### 1.6 Supported models accessible via Higgsfield — ✅ Verified (list is live/changing)
30+ models. Confirmed names across sources: **Soul / Soul 2.0** (image), **Nano Banana Pro / Nano Banana 2 = Gemini 3 Pro Image** (image), **Flux 2** (image), **GPT Image 2** (image), **Seedream / Seedance 2.0** (image/video), **Veo 3.1** (video), **Kling 3.0** (video), **Sora 2** (video), **Minimax / Hailuo** (video), plus Higgsfield's own **Cinema Studio / DoP** motion engine. ✅

### 1.7 Higgsfield Skills / Workflows — ✅ Verified
- **Skills** = installable workflows from a Marketplace (e.g. a commercial-ad pipeline, product-demo flow, trend-research pass). Supercomputer runs them on demand. ✅
- **Slash workflows**: teach a workflow once (`/montage`, `/cinematic`, your own brand pipeline), trigger with a slash, **reuse across projects, share across teams, version like code**. ✅
- Implication for us: our `HF-*` workflows below can be packaged as reusable Higgsfield Skills/slash workflows once we standardise them. 🟡

### 1.8 Verified MCP tool surface
From a public Higgsfield MCP reference implementation (✅ for that implementation; the hosted server may name things slightly differently — 🟡 confirm at run time):

| Tool | Purpose | Key params |
|---|---|---|
| `generate_image` | Text/ref → image | `prompt` (req), `quality` (e.g. 720p/1080p), `character_id`, `style_id` |
| `generate_video` | Image → ~5s cinematic video | `image_url` (req), `motion_id` (req), `prompt` (opt), `quality` (lite/turbo/standard) |
| `create_character` | Train a reusable character (Soul) | `name` (req), `image_urls` (1–5) |
| `list_characters` | List trained characters + IDs/status | — |
| `get_generation_status` | Poll a job | `job_set_id` (req) |
| (resources) | Browse `styles`, `motion presets`, `characters` | — |

> 🟡 The official hosted MCP advertises additionally: generate images, create videos, **train characters**, and **browse creation history** in one session. Treat the table above as the canonical *shape* (image / video / character / status / list) and read live tool names on connect.

### 1.9 What we could NOT fully verify (flagged ⚠️)
- Exact verbatim tool names on the **hosted** `mcp.higgsfield.ai/mcp` server (official pages returned 403 to automated fetch). Use the reference-implementation names as a guide and confirm in-session.
- Exact maximum video length per model (5s vs 10s vs 15s) — ⚠️ model/preset dependent; request explicitly and verify.
- Exact list and IDs of motion presets / styles — ⚠️ read at run time via the resources/listing calls.
- Whether per-clip audio/voice is generated by Higgsfield for our use — ⚠️ we will keep voice on **ElevenLabs** (`orator`) regardless, per `CLAUDE.md`.

---

## 2. Higgsfield Workflow Catalog (`HF-*`)

Stable, reusable Higgsfield production recipes. Each `HF-*` is a named bundle of (model + camera + motion + use). Map frameworks to these in §4.

> Camera = a `VP-CAM-*` intent expressed to Higgsfield as camera language/preset. Motion = a Higgsfield motion preset / `motion_id`. "Model" = preferred Higgsfield model; if unavailable, see §7 fallbacks.

### HF-IMAGE-CHARACTER — Character still (anchor frame)
- **Produces:** A single photoreal still of one `CH-*` character in scene (also the seed frame for video).
- **Model/feature:** Soul (image) + the character's **Soul ID** (`character_id`).
- **Camera:** per character default (e.g. `VP-CAM-OWNER` mid + low angle).
- **Motion:** none (still).
- **Use:** thumbnails, carousels, the first frame of every video workflow below.

### HF-IMAGE-2SHOT — Two-character still
- **Produces:** Two `CH-*` characters in one frame (conversation/testimonial/drama duo).
- **Model/feature:** Soul (image), referencing two Soul IDs / Elements via @tags.
- **Camera:** `VP-CAM-2SHOT` (eye-level two-shot, soft DoF).
- **Motion:** none.
- **Use:** FW-CONVO, FW-CUSTOMER, FW-DRAMA setups.

### HF-TALKING-HEAD — Talking-head clip
- **Produces:** Locked/eye-level character delivering a line to camera.
- **Model/feature:** Image-to-video (Veo 3.1 / Cinema Studio) from an HF-IMAGE-CHARACTER still + Soul ID.
- **Camera:** `VP-CAM-TALK` (eye-level mid, subtle push-in).
- **Motion:** subtle push-in / locked-off motion preset.
- **Use:** FW-AUTHORITY, FW-FOUNDER, FW-MYTH, FW-CRM, FW-OBJECTION talking segments.

### HF-UGC-SELFIE — Handheld selfie clip
- **Produces:** Arm's-length, slightly shaky vertical selfie video, creator-authentic.
- **Model/feature:** Image-to-video + **UGC preset**; from an HF-IMAGE-CHARACTER selfie still.
- **Camera:** `VP-CAM-UGC` (handheld selfie, arm's length).
- **Motion:** UGC preset (minimal, raw, slight shake).
- **Use:** FW-UGC, FW-PROPERTY (field), casual CTAs.

### HF-MOTION-WALK — Walk-and-talk
- **Produces:** Character walking + talking, gimbal follow energy.
- **Model/feature:** Image-to-video (Kling 3.0 Motion Control / Cinema Studio) + dolly/follow motion.
- **Camera:** `VP-CAM-WALK` (gimbal follow).
- **Motion:** dolly / tracking / hyper-motion preset.
- **Use:** FW-DRAMA, FW-SKIT energy beats, broker field life.

### HF-CINEMATIC — Cinematic dramatic beat
- **Produces:** Film-look shot with deliberate camera move + mood lighting.
- **Model/feature:** **Cinema Studio** (camera/lens sim) + Veo 3.1 / Sora 2.
- **Camera:** `VP-CAM-REACT` / `VP-CAM-OTS` with crash-zoom or dolly.
- **Motion:** crash zoom / dolly-in / pan; `VP-MOTION-DRAMA` pace.
- **Use:** FW-DRAMA, FW-WHATSAPP-CHAOS, FW-FEAR, FW-FOUNDER hero pieces.

### HF-DRAMA-DIALOGUE — Two-character drama clip
- **Produces:** Animated two-shot/OTS with reaction cuts for a skit/drama.
- **Model/feature:** Image-to-video from HF-IMAGE-2SHOT; multiple short clips stitched.
- **Camera:** `VP-CAM-2SHOT` + `VP-CAM-REACT` inserts.
- **Motion:** subtle handheld + reaction zoom.
- **Use:** FW-DRAMA, FW-SKIT, FW-CONVO.

### HF-REACT — Reaction close-up
- **Produces:** Quick emotional close-up (worry → relief, "kya?!", frustration).
- **Model/feature:** Image-to-video, short clip + push-in.
- **Camera:** `VP-CAM-REACT`.
- **Motion:** fast punch-in.
- **Use:** FW-FEAR, FW-LEAD-LEAKAGE, FW-DRAMA punchlines.

### HF-DEMO-SCREEN — Product/screen demo
- **Produces:** Over-the-shoulder or insert of the RealEstateFlow UI on phone/laptop (taps, dashboards).
- **Model/feature:** Soul still of UI-on-device → image-to-video for subtle motion; OR Remotion screen capture composite (see §7).
- **Camera:** `VP-CAM-OTS` + `VP-CAM-INSERT`.
- **Motion:** subtle insert push / screen-glow.
- **Use:** FW-DEMO, FW-AI, FW-CRM, FW-TEAM dashboard reveals.
- **Note:** For pixel-accurate real UI, prefer **Remotion/real screen-record** composited in; use Higgsfield for the surrounding human + b-roll.

### HF-INSERT — Object/proof insert
- **Produces:** Tight insert: keys, ledger screen, ₹ number, phone notification.
- **Model/feature:** Soul image → short motion (or static still).
- **Camera:** `VP-CAM-INSERT`.
- **Motion:** micro push / none.
- **Use:** FW-CASE, FW-CUSTOMER, FW-LEAD-LEAKAGE, FW-OBJECTION proof beats.

### HF-PROOF-HOME — Happy-customer / handover
- **Produces:** Warm golden-hour two-shot at a new home, keys in hand.
- **Model/feature:** HF-IMAGE-2SHOT (CH-HAPPY) → image-to-video, soft motion.
- **Camera:** `VP-CAM-2SHOT` + `VP-CAM-INSERT` (keys).
- **Motion:** slow push / `VP-MOTION-DRAMA`-lite.
- **Use:** FW-CUSTOMER, FW-CASE, FW-BAB "after".

### HF-INTRO-STING — Gradient logo sting
- **Produces:** 0.5s brand intro/outro (gradient `#2563EB→#7C3AED` + logo).
- **Model/feature:** Best done in **Remotion** (deterministic brand control), not Higgsfield.
- **Camera/Motion:** scripted in Remotion.
- **Use:** hero pieces only; skip on UGC.

### HF-COVER — Thumbnail / cover still
- **Produces:** 1080×1920 cover (design top 1080×1350 for grid): big Hinglish phrase + character face + number.
- **Model/feature:** Soul still (character) → Remotion/Nano Banana composite for typography (`VP-THUMB-*`).
- **Use:** every reel cover.

---

## 3. Character Setup SOP (Soul ID per `CH-*`)

**Goal:** one reusable Soul ID (Character ID) per character, locked once, reused across every generation so all 9 characters stay visually identical forever.

### 3.1 One-time training (per character)
1. **Generate the anchor set.** Using `generate_image` (Soul) with the character's **consistency prompt** (verbatim from `04-character-system.md`), generate **5 stills**: front face, 3/4 left, 3/4 right, mid-body in-scene, and one expression shot. Keep wardrobe/age/face descriptors identical; vary only angle/expression.
2. **Train the Soul ID.** Call `create_character` with `name` = the `CH-*` ID (e.g. `CH-OWNER-RajeshBhai`) and `image_urls` = those 5 stills. Training ≈5 min.
3. **Record the ID.** Save the returned `character_id` into the registry table below. Verify with `list_characters`.
4. **QC.** Generate 2 test stills in new scenes using `character_id`; confirm face holds. Re-train if drift.

> If `create_character` accepts raw photos directly, you may skip step 1 and upload curated reference photos. We use Soul-generated stills so we own a consistent, brand-safe base (no real-person likeness issues).

### 3.2 Reuse rule (every generation)
- **Image:** pass `character_id` to `generate_image`, and still include the consistency prompt as text anchor (belt + braces).
- **Video:** generate the still with `character_id` first (HF-IMAGE-*), then `generate_video` from that `image_url` — the face carries through. For multi-character scenes, reference each as an **Element / @tag**.
- **Never** invent a new look. Vary only scene, emotion, camera, motion.

### 3.3 Character → Soul ID registry (fill at training time)

| CH ID | Name / role | Consistency prompt source | Soul ID (`character_id`) | Default camera | Trained? |
|---|---|---|---|---|---|
| CH-OWNER | Rajesh Bhai (Owner) | 04 §CH-OWNER | `__________` | VP-CAM-OWNER | ☐ |
| CH-SALESMGR | Priya Madam (Sales Mgr) | 04 §CH-SALESMGR | `__________` | VP-CAM-TALK/OTS | ☐ |
| CH-BROKER | Arjun (Broker) | 04 §CH-BROKER | `__________` | VP-CAM-UGC/WALK | ☐ |
| CH-CONSULTANT | Sneha (Consultant) | 04 §CH-CONSULTANT | `__________` | VP-CAM-2SHOT | ☐ |
| CH-OPS | Kiran (Ops Mgr) | 04 §CH-OPS | `__________` | VP-CAM-INSERT | ☐ |
| CH-TEAMLEAD | Vikram (Team Lead) | 04 §CH-TEAMLEAD | `__________` | VP-CAM-WALK | ☐ |
| CH-NEWBIE | Rohan (New Joiner) | 04 §CH-NEWBIE | `__________` | VP-CAM-OTS | ☐ |
| CH-LOSTLEAD | Mr. Mehta (Lost Lead) | 04 §CH-LOSTLEAD | `__________` | VP-CAM-REACT | ☐ |
| CH-HAPPY | Mr. & Mrs. Khan (Happy) | 04 §CH-HAPPY | `__________` | VP-CAM-2SHOT | ☐ |

> CH-HAPPY is a couple → train as one Element pair, or two Soul IDs referenced together via @tags.

---

## 4. THE KEY MAPPING — Framework → Higgsfield (all 25 `FW-*`)

For each framework: lead `HF-*` workflow → Higgsfield model/skill → camera setup → motion setup → recommended `VP-*` scene preset.

| FW | Lead HF workflow | Higgsfield model/skill | Camera setup | Motion setup | VP scene preset |
|---|---|---|---|---|---|
| **FW-PAS** | HF-REACT → HF-DEMO-SCREEN | Soul + Veo 3.1 (i2v) | VP-CAM-REACT → VP-CAM-OTS | push-in → punchy cut | VP-DEMO-SCREEN (+MOODY open) |
| **FW-BAB** | HF-CINEMATIC (before) → HF-PROOF-HOME (after) | Cinema Studio + Veo 3.1 | VP-CAM-REACT → VP-CAM-2SHOT | match-cut before/after | VP-DRAMA-OFFICE → VP-PROOF-HOME |
| **FW-CASE** | HF-TALKING-HEAD + HF-INSERT | Soul + Veo 3.1; Nano Banana for number cards | VP-CAM-TALK + VP-CAM-INSERT | subtle push + insert punch | VP-PROOF-HOME / VP-EDU-DESK |
| **FW-AUTHORITY** | HF-TALKING-HEAD | Soul + Veo 3.1 | VP-CAM-TALK (eye-level mid) | locked-off / slow push | VP-FOUNDER-CABIN |
| **FW-FOUNDER** | HF-CINEMATIC + HF-TALKING-HEAD | Cinema Studio + Veo 3.1 | VP-CAM-OWNER/TALK | slow dolly-in, DRAMA-lite | VP-FOUNDER-CABIN |
| **FW-MYTH** | HF-TALKING-HEAD + HF-COVER | Soul + Veo 3.1 | VP-CAM-TALK | punchy text pop, push | VP-EDU-DESK |
| **FW-MISTAKE** | HF-TALKING-HEAD + HF-INSERT | Soul + Veo 3.1; Nano Banana number cards | VP-CAM-TALK + VP-CAM-INSERT | PUNCHY, fast cuts | VP-EDU-DESK |
| **FW-FEAR** | HF-REACT + HF-CINEMATIC | Cinema Studio + Veo 3.1 | VP-CAM-REACT | crash-zoom, MOODY | VP-DRAMA-OFFICE |
| **FW-CURIOSITY** | HF-CINEMATIC (teaser) | Cinema Studio / Sora 2 | VP-CAM-TALK / VP-CAM-INSERT | quick reveal, whip-pan | VP-EDU-DESK / VP-DEMO-SCREEN |
| **FW-CONTRARIAN** | HF-TALKING-HEAD | Soul + Veo 3.1 | VP-CAM-TALK | locked-off, sharp pop | VP-FOUNDER-CABIN / VP-EDU-DESK |
| **FW-NEWS** | HF-TALKING-HEAD + HF-INSERT | Soul + Veo 3.1; Nano Banana news cards | VP-CAM-TALK + VP-CAM-INSERT | PUNCHY ticker pops | VP-EDU-DESK |
| **FW-DEMO** | HF-DEMO-SCREEN | Soul still + i2v; Remotion screen comp (fallback) | VP-CAM-OTS + VP-CAM-INSERT | subtle insert push, SCREEN | VP-DEMO-SCREEN |
| **FW-DRAMA** | HF-DRAMA-DIALOGUE + HF-CINEMATIC | Cinema Studio + Kling 3.0 | VP-CAM-2SHOT/OTS/REACT | DRAMA, reaction zooms | VP-DRAMA-OFFICE |
| **FW-SKIT** | HF-DRAMA-DIALOGUE + HF-MOTION-WALK | Kling 3.0 (Motion Control) | VP-CAM-2SHOT + VP-CAM-WALK | hyper-motion, comedic cuts | VP-DRAMA-OFFICE |
| **FW-CONVO** | HF-DRAMA-DIALOGUE | Soul 2-shot + Veo 3.1 | VP-CAM-2SHOT | gentle handheld | VP-DRAMA-OFFICE |
| **FW-CUSTOMER** | HF-PROOF-HOME + HF-TALKING-HEAD | Soul + Veo 3.1 (golden) | VP-CAM-2SHOT + VP-CAM-INSERT | slow push, GOLDEN | VP-PROOF-HOME |
| **FW-OBJECTION** | HF-TALKING-HEAD + HF-INSERT | Soul + Veo 3.1 | VP-CAM-TALK + VP-CAM-INSERT | locked-off + insert | VP-EDU-DESK |
| **FW-WHATSAPP-CHAOS** | HF-CINEMATIC + HF-DEMO-SCREEN | Cinema Studio + Veo 3.1; Remotion phone UI | VP-CAM-REACT + VP-CAM-INSERT | MOODY → relief, fast cuts | VP-DRAMA-OFFICE → VP-DEMO-SCREEN |
| **FW-LEAD-LEAKAGE** | HF-REACT + HF-INSERT | Soul + Veo 3.1; Nano Banana ₹ math cards | VP-CAM-REACT + VP-CAM-INSERT | number pops, amber | VP-DRAMA-OFFICE / VP-EDU-DESK |
| **FW-FOLLOWUP** | HF-CINEMATIC + HF-REACT | Cinema Studio + Veo 3.1 | VP-CAM-REACT | tension push-in | VP-DRAMA-OFFICE |
| **FW-AI** | HF-DEMO-SCREEN + HF-CINEMATIC | Cinema Studio + Veo 3.1; SCREEN-glow | VP-CAM-OTS + VP-CAM-INSERT | screen-glow reveal, PUNCHY | VP-DEMO-SCREEN |
| **FW-CRM** | HF-TALKING-HEAD + HF-DEMO-SCREEN | Soul + Veo 3.1; Remotion UI | VP-CAM-TALK + VP-CAM-INSERT | PUNCHY explainer | VP-EDU-DESK / VP-DEMO-SCREEN |
| **FW-UGC** | HF-UGC-SELFIE | i2v + **UGC preset** | VP-CAM-UGC (selfie) | UGC (raw, minimal) | VP-UGC-FIELD |
| **FW-TEAM** | HF-DEMO-SCREEN + HF-TALKING-HEAD | Soul + Veo 3.1; dashboard insert | VP-CAM-OTS + VP-CAM-INSERT | dashboard reveal push | VP-DEMO-SCREEN / VP-EDU-DESK |
| **FW-PROPERTY** | HF-UGC-SELFIE + HF-MOTION-WALK | Kling 3.0 + UGC preset | VP-CAM-UGC + VP-CAM-WALK | walk-and-talk, WARM/GOLDEN | VP-UGC-FIELD |

> **Reading the table:** pick ONE primary `FW-*` per piece (per framework library pairing rule), build the listed `HF-*` shots, apply the camera + motion, and grade to the `VP-*` scene preset. Number/text cards and pixel-accurate UI → Nano Banana Pro + Remotion, composited over Higgsfield human/b-roll.

---

## 5. Step-by-Step Production Recipe (script → finished reel)

**Output spec (default):** 1080×1920, **9:16**, 24–30 fps, H.264 MP4, subtitles burned in (Inter SemiBold), logo bug bottom-left (except raw UGC), ≤ ~30–45s reel.

### Step 1 — Inputs
- A script built from ONE `FW-*` (structure + hook + CTA + language) from `03`.
- A **scene list**: each scene = {character(s) `CH-*`, beat, line, camera `VP-CAM-*`, the `HF-*` workflow}.
- Confirm every `CH-*` in the script has a trained Soul ID (§3). If not, train first.

### Step 2 — Connect & list (run-time truth)
- Ensure MCP `higgsfield` is authenticated (OAuth via `mcp.higgsfield.ai/mcp`).
- List live **models**, **motion presets/styles**, and **characters** (resources/listing calls). Resolve the model + `motion_id` + `character_id` you'll actually pass. Never hardcode against a stale ID.

### Step 3 — Generate anchor stills (images first, always)
- For each scene, run `generate_image` (Soul) with the **consistency prompt + `character_id`**, quality 1080p (or 4K for covers). This produces the seed frame and locks the face. QC each still.

### Step 4 — Animate (image → video)
- For each motion scene, run `generate_video` with `image_url` (the still), the chosen `motion_id` (mapped from `VP-CAM-*`/`VP-MOTION-*` in §4), optional `prompt`, and `quality`. Request the clip length you need (5–15s; verify model support).
- Poll `get_generation_status` until done; download clips.

### Step 5 — Screen/UI & number cards
- Generate UI/number/text cards with **Nano Banana Pro** (`nano-banana-pro` skill) and/or build pixel-accurate UI + intro/outro sting + typography in **Remotion** (`my-video/`, `render-remotion.ps1`). Real product UI = real screen-record or Remotion, NOT AI-faked UI.

### Step 6 — Voice & subtitles
- Generate Hinglish/Marathi VO via **ElevenLabs** (`orator`, `elevenlabs-tts.ps1`). Generate subtitles (romanized Latin for spoken Hinglish; Devanagari only for deliberate title accents).

### Step 7 — Stitch & finish (FFmpeg / Remotion)
- Assemble clips + cards + VO + music + captions. Per `CLAUDE.md`: programmatic assembly in **Remotion** (`my-video/`) for branded/templated pieces; **FFmpeg** for concatenation, trims, audio mix, burn-in, and final encode.
- Apply pacing (`VP-MOTION-*`): first cut within 1s, cut every 1.5–3s, one brand accent per frame.
- Add `HF-INTRO-STING` (gradient logo) on hero pieces only.

### Step 8 — QC against the 10 Non-Negotiables (`05 §9`)
- 9:16 · Inter · one accent/frame · hook visual <1s · subtitles on · product on phone/laptop · real Indian faces/natural light · ₹/lakh/crore on-screen · logo bug · only `CH-*` characters. Reject and regenerate if any fail.

### Step 9 — Export & route
- Export 1080×1920 MP4 → `marketing-and-sales/assets/` (Content Factory ownership). Download for manual upload (Meta Business Suite / native apps); route to ads (`meta-ads`) as needed.

### Step 10 (optional) — Supercomputer / Skill packaging
- Once an `HF-*` recipe is stable, package it as a Higgsfield **Skill / slash workflow** (e.g. `/realestateflow-ugc`, `/realestateflow-drama`) so Supercomputer can run the whole pipeline from one brief. 🟡 Verify Skill authoring availability on your plan.

---

## 6. Prompt Templates (character-anchored)

> Always embed the character's verbatim consistency prompt as the anchor AND pass `character_id`. Vary only `[SCENE]`, `[EMOTION]`, `[CAMERA]`, `[MOTION]`.

### 6.1 Image (`generate_image`, Soul)
```
prompt: "<CONSISTENCY_PROMPT_VERBATIM>, [EMOTION], [ACTION], in [SCENE],
[VP-CAM-* described: e.g. eye-level medium shot, shallow depth of field],
[VP-LIGHT-* described: e.g. bright even office lighting], vertical 9:16 composition,
photorealistic, modern Indian SaaS aesthetic, royal-blue #2563EB accent,
clean uncluttered background, subject centred for caption safe-zone"
character_id: "<CH-* Soul ID>"
quality: "1080p"   // "4K"/highest for covers
style_id: "<optional style from listing>"
```
**Example — CH-OWNER, FW-LEAD-LEAKAGE anchor:**
```
prompt: "Indian man, 44, stocky build, salt-and-pepper hair, trimmed grey-black moustache,
warm tired brown eyes, gold ring, crisp light-blue folded-sleeve formal shirt, gold leather-strap
watch, real-estate agency owner, photorealistic, soft office lighting; worried expression pinching
the bridge of his nose, sitting at desk with laptop and chai, glass-walled cabin with city view,
mid shot slight low angle, shallow depth of field, vertical 9:16, royal-blue #2563EB accent"
character_id: "CH-OWNER-RajeshBhai"
quality: "1080p"
```

### 6.2 Video (`generate_video`, image-to-video)
```
image_url: "<url of the Soul still from 6.1>"
motion_id: "<motion preset mapped from VP-CAM-* / VP-MOTION-* via §4>"
prompt: "[CAMERA MOVE e.g. slow push-in], [SUBJECT ACTION/micro-expression],
[VP-MOTION-* pace], natural realistic motion, no morphing of face, keep identity consistent"
quality: "standard"   // lite/turbo for drafts
```
**Example — CH-OWNER talking head (FW-AUTHORITY):**
```
image_url: "<HF-IMAGE-CHARACTER still>"
motion_id: "<push-in / locked-off preset>"
prompt: "subtle slow push-in, owner speaks calmly to camera with slight authoritative head nod,
shallow depth of field, cinematic, identity locked, no face morphing"
quality: "standard"
```

### 6.3 Two-character (Elements/@tags)
```
prompt: "<CH-A consistency prompt> as @CharA and <CH-B consistency prompt> as @CharB,
[INTERACTION], in [SCENE], two-shot eye-level, soft depth of field, vertical 9:16, photorealistic"
character_id / elements: [<CH-A Soul ID>, <CH-B Soul ID>]
```

### 6.4 UGC selfie (FW-UGC)
```
generate_image: "<CH-BROKER consistency prompt>, holding phone at arm's length filming a selfie,
casual genuine expression, on a property site / street, natural daylight, vertical 9:16, photoreal"
→ generate_video with motion_id="<UGC preset>", prompt="handheld selfie, slight natural shake,
walking, casual, talking to camera"
```

---

## 6.5 PREMIUM REALISM PROMPT BLOCKS (mandatory — append to every call)

> This is the single biggest visual-quality lever. Every image/video prompt must carry a **quality block** (positive) and a **negative block** (anti-AI-tell). These encode `VP-PERF-*` / `VP-PHYS-*` / `VP-GRADE-*` from `visual-system/05` into Higgsfield language.

### 6.5.1 Quality block (append to POSITIVE prompt, every shot)
```
shot on cinema camera, 35mm/50mm lens look, shallow depth of field, natural realistic
lighting with soft shadows and accurate Indian skin tones, photorealistic skin texture
with visible pores and subtle imperfections, soft catchlight in the eyes, true-to-life
colour, fine detail, cinematic colour grade, professional advertising production quality,
8k detail, no plastic skin
```

### 6.5.2 Performance block (append for HUMAN shots — pick the `VP-PERF-*`)
```
natural slow blinking, micro eye-darts, subtle breathing, tiny involuntary head movement,
relaxed asymmetric facial expression, [VP-PERF-* direction verbatim, e.g. furrowed brow,
eyes flicking to phone, shallow breaths, hand drifting to face], authentic human micro-expression
```

### 6.5.3 Physics block (append for MOTION shots)
```
natural body weight and balance, realistic hand grip on objects, gravity-correct clothing
and hair movement, grounded footsteps, believable parallax and depth, real soft shadows,
[VP-PHYS-* cues e.g. chai steam rising, screen glow on face]
```

### 6.5.4 NEGATIVE block (the anti-AI-tell list — pass to every call)
```
plastic skin, waxy skin, airbrushed skin, dead eyes, no blink, frozen face, mannequin,
uncanny, deformed hands, extra fingers, merged fingers, morphing face, identity drift,
sliding feet, floating objects, warped text, gibberish text, distorted logo, oversaturated,
HDR halo, blurry, low-res, stiff motion, robotic movement, conveyor-belt walk, static
background people, watermark, AI artifacts
```
> If the model exposes a `negative_prompt` param, pass 6.5.4 there. If not, prepend `avoid: …` to the prompt. Real product UI and on-screen text → still Remotion/Nano Banana, never AI-faked (see §7).

### 6.5.5 Grade tag (append, map from `VP-GRADE-*`)
`…, graded VP-GRADE-CLEAN (bright true-to-life)` / `VP-GRADE-MOODY (low-key amber accents)` / `VP-GRADE-GOLDEN (teal-orange golden hour)` / `VP-GRADE-SAAS (crisp cool, vivid blue)`.

**Upgraded image example (CH-OWNER, FW-LEAD-LEAKAGE) — now production-grade:**
```
prompt: "<CH-OWNER consistency prompt verbatim>, VP-PERF-WORRY: furrowed brow, eyes flicking
to phone, shallow breaths, hand drifting to bridge of nose; sitting at desk with laptop and
steaming chai, glass-walled cabin with city view; mid shot slight low angle, shallow depth of
field; <6.5.1 quality block>; <6.5.2 performance block>; graded VP-GRADE-MOODY; vertical 9:16,
royal-blue #2563EB accent"
negative_prompt: "<6.5.4 negative block>"
character_id: "CH-OWNER-RajeshBhai"
quality: "1080p"
```

---

## 6.6 ADVANCED HIGGSFIELD EXPLOITATION (features we were leaving on the table)

1. **Elements (environment + prop lock)** — train not just faces but the *recurring sets*: "Apna Properties" Mumbai cabin, open-floor office, model flat. Reference via `@apna-cabin`, `@apna-floor` so every reel shares ONE consistent world (not a new random office each time). Train once like a Soul ID; reuse across all shots.
2. **Advanced camera combos (Cinema Studio / Kling Motion Control)** — systematize premium moves as named intents: crash-zoom on the twist, FPV-drone establishing, dolly-in on authority, parallax push on reveals, whip-pan transition. Map these onto `VP-CAM-*`/`VP-GFX-TRANSITION`.
3. **Lens & film-stock language** — speak the camera: "35mm, T1.8, shallow DoF", "anamorphic flare", "filmic grain" — Cinema Studio responds to lens sim; raises the cinematic ceiling.
4. **Prompt-enhancement OFF for locked shots** — when identity/scene must be exact, disable auto-enhance so it doesn't drift the look; ON only for exploratory b-roll.
5. **Supercomputer Skill packaging** — once an `HF-*` recipe is stable, publish it as a slash workflow (`/realestateflow-drama`, `/realestateflow-ugc`, `/realestateflow-demo`) so one brief → finished, on-brand, production-grade reel. Version + share across the team. **Reference template + schema: `higgsfield/07-higgsfield-skills.md`.** 🟡 verify plan access.
6. **Higgsfield Marketing Studio** — use for branded ad variants/templated SaaS spots when we want platform-native ad polish fast; keep brand hex + Inter via Remotion overlays.

---

## 7. Limitations & Fallbacks

| If this fails / is unavailable | Fallback (repo-supported) |
|---|---|
| Higgsfield video model unavailable / poor result | Generate high-quality Soul/**Nano Banana Pro** stills → animate/composite in **Remotion** (`my-video/`, `render-remotion.ps1`); Ken-Burns + text motion via FFmpeg. |
| Face drifts across generations | Re-train Soul ID with cleaner anchor set; always pass `character_id` + verbatim consistency prompt; reduce style strength; lock seed. |
| Pixel-accurate product UI needed | Use **real screen-recording** or build UI in **Remotion** — never let Higgsfield hallucinate the RealEstateFlow UI. |
| Number/text/Hinglish typography off-brand | Render text + ₹ cards in **Remotion** / **Nano Banana Pro** with Inter + exact brand hex; don't rely on AI text-in-image. |
| Voice / VO | Always **ElevenLabs** (`orator`, `elevenlabs-tts.ps1`) — do not depend on Higgsfield audio. |
| Clip length too short for a beat | Generate multiple ~5–15s clips and stitch with FFmpeg; design scene list around short shots. |
| Exact MCP tool name differs from §1.8 | Call the server's listing/resources tools on connect; use the live names; §1.8 is the shape, not gospel. |
| Motion/style/model IDs unknown | Query the MCP `styles` / `motion presets` / models resources at run time before generating. |
| Credits exhausted / rate limit | Batch overnight; draft at `lite`/`turbo` quality, final pass at `standard`/4K only on approved cuts. |
| Multi-character consistency in one frame | Use **Elements** + @tags; if unsupported on plan, generate characters separately and composite in Remotion. |
| Whole-pipeline automation desired | Use **Supercomputer** Skill/slash workflow (`/realestateflow-*`) — 🟡 verify plan access; otherwise orchestrate step-by-step via MCP as in §5. |

---

## 8. Quick reference — defaults

- **Image:** Soul + `character_id`, 1080p (4K covers), prompt-enhance on.
- **Video:** image-to-video, request 5–15s, `motion_id` per §4, `standard` quality for finals.
- **Consistency:** Soul ID per `CH-*` (§3) + verbatim consistency prompt every call.
- **Models:** image = Soul / Nano Banana Pro; video = Veo 3.1 (talk/cine), Kling 3.0 (motion/drama), Sora 2 (cinematic), Cinema Studio (camera/lens control).
- **Finish:** Remotion + FFmpeg, ElevenLabs VO, 1080×1920 9:16 MP4.
- **Always:** list live models/presets/characters at run time before generating.
