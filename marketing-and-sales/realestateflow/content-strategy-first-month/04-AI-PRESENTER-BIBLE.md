# 04 - AI Presenter Bible

Since you are not going on camera, the brand needs a consistent face. This file defines it, how to
generate it, how to voice it, and - critically - **what it is not allowed to say.**

---

## 1. The character

### "ARJUN" - the RealEstateFlow narrator

Not a guru. Not a model. Not a customer. He is **the operator who has seen inside 200 agencies** and
tells you plainly what he found.

| Attribute | Spec |
|-----------|------|
| **Name on screen** | Rarely named. If needed: "Arjun · RealEstateFlow" |
| **Age** | 33-36 |
| **Build** | Average. Slightly heavier than a model. Real. |
| **Skin** | Medium-brown North/West Indian |
| **Hair** | Short, neat, slightly thick. Not styled. Small amount of grey at the temples. |
| **Facial hair** | Trimmed short beard or heavy stubble - never clean-shaven, never a full beard |
| **Wardrobe** | Plain half-sleeve shirt, dark solid colour (charcoal, deep olive, dark maroon). Occasionally a plain dark polo. **Never** a suit. **Never** a tie. **Never** a branded tee. |
| **Accessories** | Simple steel watch. Nothing else. No chains, no rings, no sunglasses. |
| **Posture** | Leaning slightly forward. Talks with his hands, moderately. |
| **Expression** | Level, direct, faintly amused. Not smiling at the camera. |

### Why this specific person

Our audience is a 28-45 year old agency owner. He does not trust a polished consultant in a glass
office - that person has never chased a ₹15,000 deposit. He trusts **someone who looks like a
slightly more organised version of himself.** Every attribute above is chosen to sit just one step
ahead of the viewer, not ten.

### Environments (rotate - never use the same one twice in a row)

| Env | Description | Use for |
|-----|-------------|---------|
| **E1 - The real office** | Small Indian brokerage office. Laminate desk, a whiteboard with scribbles, a stack of files, a cheap office chair, one window with warm afternoon light. Slightly cluttered. | Default. Chaos Mirror + System pillars |
| **E2 - Car, parked** | Driver's seat, parked, seatbelt off, phone in hand, evening light through the windscreen. | Confessional / direct-to-camera truths |
| **E3 - Under-construction flat** | Bare cement, exposed wiring, dust, natural light from an unfinished window. | Authority / market-reality posts |
| **E4 - Desk with laptop** | Same office, seated at a laptop, screen visible but not readable. | Product / demo lead-ins |

### Absolute visual bans (from brand kit)
✗ Glass-tower corporate offices ✗ Suits and ties ✗ Handshake stock imagery
✗ Symmetrical smiling group shots ✗ Studio-lit white backgrounds ✗ Anything that looks American

---

## 2. Look & grade

- **Framing:** medium close-up, chest up. Eyes on the upper-third line.
- **Lens feel:** 35-50mm equivalent. Slight handheld drift - never locked-off tripod stillness.
- **Light:** warm, directional, single key from a window. Practical, not studio.
- **Grade:** warm, slightly lifted blacks, mild grain. Should feel like a good phone camera in
  golden hour, not like a commercial.
- **Position in frame:** subject sits **left-of-centre** so the right third is free for on-screen
  text and product cutaways.

---

## 3. Generation workflow (Higgsfield)

### Step 1 - Lock the character once (prep week, do this first)

Before generating any video, call the character-sheet workflow so Arjun stays identical all month:

```
get_workflow_instructions({ workflow: "character-sheet" })
```

Then generate the reference sheet with the prompt in `11-GENERATION-PROMPTS.md` §1. **Save the
resulting media ID.** Every subsequent generation references it. Inconsistent face = dead brand.

### Step 2 - Per-video generation

For talking-head / UGC-style clips, check the workflow catalog first - do not guess:

```
get_workflow_instructions()                          // see what's available
get_workflow_instructions({ workflow: "<match>" })   // load the talking-head / UGC workflow
```

Then generate each shot with the reference element attached. Per-reel prompts are in
`11-GENERATION-PROMPTS.md` §2.

### Step 3 - Deliver to editor

Export the raw avatar clip **without captions and without music**, plus the separate voice track.
The editor needs clean stems. Name it `REF-R01-arjun-RAW.mp4` + `REF-R01-vo.wav`.

---

## 4. Voice (ElevenLabs or equivalent)

### ⚠️ FINDING, 7 Aug 2026: Higgsfield has NO Indian male preset voice

All 114 preset voices were checked. Every male preset is Western (Marcus, Callum, Sterling,
Harrison, Alistair, Miles, Andre, Mark…). The only vaguely Indian-coded names, Anika and Anush, are
both female.

Three auditions were generated on the R03 line to hear how they cope:

| Voice | voice_id | Age read | Audition job_id |
|---|---|---|---|
| Marcus | `6f98d3dd-324f-4845-8c28-c1d1647a06cd` | middle-aged | `ac409823-5c4b-4d48-a08c-5b71ca73b8f3` |
| Mark | `27c04473-84a9-4b60-a41f-c8e8458bd4f1` | young | `199ec3d9-2f7d-486a-8cac-949fac48080f` |
| Andre | `f1e8226e-2248-4d5f-b43c-0a79e9949dbf` | young | `2da7c296-aac5-4797-89bf-7aa10bbd5b91` |

**Why this matters more than it looks.** Our entire positioning is *"we understand your business
better than the CRM companies do."* An Indian agency owner hears a Western accent stumbling through
`kirayedaar` in the first two seconds and the claim collapses before the argument starts. A wrong
accent is not a polish problem here, it is a credibility problem.

### The fix: clone a real Hinglish voice

`seed_audio` accepts an `audio_references` media input, and `create_voice` exists as a tool. So:

1. Find someone who speaks natural Mumbai/Pune Hinglish. A friend, a colleague, a freelancer off
   any Indian VO marketplace. Male, 30-40, conversational, not a radio voice.
2. Record **60-90 seconds** of clean audio: quiet room, phone is fine, no music, no echo. Have them
   read a few lines from `06`/`07` so the sample carries the actual register.
3. **Get written permission to clone and use the voice commercially.** One paragraph over email is
   enough, but get it, and keep it. This is someone's voice.
4. Clone it, save the ID as `ARJUN_VOICE_ID`, and never change it.

That voice becomes a real brand asset. It also costs less than a month of hunting presets that will
never sound right.

**Interim option if you must ship week 1 before the clone exists:** use Marcus (the only
middle-aged male preset) for R01 only, and hold R03 and R04 until the clone is ready. Do **not**
launch the whole month on a Western-accented voice and plan to swap later, because the voice is the
one thing viewers will have already learned by week 2.

---

### Selection criteria - audition 3-4 voices, pick one, never change it

- Indian male, **not** a British-Indian or American-Indian accent
- Age-read 30-40
- Mid-to-low pitch, warm, slightly grainy
- **Conversational, not broadcast.** If it sounds like a news anchor or an IVR, reject it.
- Must handle romanized Hindi words without mangling them - test with the phrase below

**Audition test phrase (run this through every candidate voice):**
> "Aapka employee resign karta hai. Uske phone mein aapke chaar sau client the. Woh chaar sau client
> ab uske hain - aapke nahin."

Reject any voice that mispronounces `resign`, `chaar sau`, or `nahin`.

### Settings (starting point - tune by ear)

| Setting | Value | Why |
|---------|-------|-----|
| Model | Multilingual / v2-class (best Hindi-word handling) | Romanized Hindi needs multilingual |
| Stability | **40-50** | Low enough to keep emotion, high enough to avoid drift |
| Similarity | **75** | Consistency across a month of clips |
| Style exaggeration | **15-30** | Above 30 it starts performing. We don't perform. |
| Speed | **1.0-1.05** | Indian broker speech is fast; slightly quick reads as natural |

### ★ Hinglish TTS pronunciation guide

TTS engines mangle romanized Hindi. Write VO scripts using the **left column**, not the right.

| Write this in the VO script | Not this | Because |
|------------------------------|----------|---------|
| `nahin` | nahi | "nahi" often reads as "nay-hy" |
| `kyoon-ki` | kyunki | avoids "kun-key" |
| `chaar sau` | 400 | digits get read in English cadence |
| `pandrah hazaar` | ₹15,000 | keeps the Hindi number rhythm |
| `do mahiney` | 2 months | |
| `kirayedaar` | kirayedar | lengthens the correct vowel |
| `khaataa` | khata | avoids "kah-tuh" |
| `paisaa` | paisa | |
| `dikhaao` | dikhao | |
| `WhatsApp` | Whatsapp | capital A helps the engine |

**Rule: in voiceover scripts, always spell numbers as Hindi/English words. In on-screen text, always
use digits (`₹15,000`).** The two never match, and that's correct.

### Pacing marks used in the scripts
- `|` = short beat (~0.3s)
- `||` = hard pause (~0.8s) - use before a reveal
- **bold** = stress this word

---

## 5. Delivery format for the editor

Every AI-presenter asset ships to the editor as **three separate files**:

1. `REF-R##-arjun-RAW.mp4` - avatar clip, no text, no music, no captions
2. `REF-R##-vo.wav` - the voice track alone, 48kHz
3. `REF-R##-script.md` - the timed script from file 06/07

The editor adds b-roll, captions, sound design and the end card. Do not pre-burn anything.

---

## 6. Story-only variant

For Stories, Arjun is generated at lower fidelity and **without lipsync** - a still frame with
subtle motion plus a voice track is enough at Story quality, and costs a fraction. Reserve full
lipsync generation for feed reels.

---

## 7. ★ Honesty policy - read this before generating a single frame

Arjun is a **brand narrator**. That is normal and legitimate - brands have used spokespeople and
mascots forever, and there is nothing wrong with a synthetic one.

What would be wrong is using a synthetic face to manufacture the social proof we don't have.

### Arjun MAY:
- Explain a problem, a concept, a feature, or an opinion
- Say "hum," "humne," "RealEstateFlow" - he speaks **for the brand**
- Narrate real product behaviour that a real screen recording backs up
- Say "hum ye bana rahe hain" (we are building this)

### Arjun MAY NOT - under any circumstances:
- ❌ Claim to be a real estate agent, broker, or agency owner
- ❌ Give a testimonial: "maine ye use kiya aur mera business badh gaya"
- ❌ Be presented as a customer, a user, or a case study
- ❌ Appear alongside a fabricated name-and-agency lower-third ("Rajesh, Andheri Properties")
- ❌ State a statistic that isn't in the approved list in `14` §2
- ❌ Describe a feature that does not exist and work today

### Disclosure
Add **"AI presenter"** to the Instagram bio and to the pinned post. Not because regulation forces
it today, but because the day someone works it out - and on a tech-product account, someone will -
you want to have said it first. It costs nothing now and it is expensive later.

> **The line that matters:** a synthetic narrator explaining a real product is marketing. A
> synthetic face claiming to be a satisfied customer is a fake review. We are pre-launch with zero
> customers, which is exactly the situation where that temptation is strongest. Don't.

---

## 8. Consistency checklist (run before every generation batch)

- [ ] Character reference media ID attached
- [ ] Environment differs from the previous post
- [ ] Wardrobe: plain, dark, no suit, no branding
- [ ] Subject left-of-centre, right third clear for text
- [ ] Warm grade, mild grain, handheld drift
- [ ] Same voice ID as every previous clip
- [ ] Script passed the §7 honesty check
- [ ] Numbers in VO written as words; numbers on screen written as digits
