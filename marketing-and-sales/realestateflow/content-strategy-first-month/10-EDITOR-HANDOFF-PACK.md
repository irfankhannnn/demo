# 10 - Editor Handoff Pack

> ⚠️ **Do not send this file to the editor. Send the `EDITOR-JOBCARDS/` folder instead.**
>
> This document is written in full English at a level the editor will struggle with, and it forces
> him to cross-reference three files to build one reel. The job cards say the same things in simple
> English + Hinglish, one self-contained file per video.
>
> **Keep this file for yourself.** It is the reference version: use it to brief a *new* editor, to
> check a delivery against spec, or to regenerate a job card if a script changes.

---

## 1. What this project is

RealEstateFlow is a software product for **Indian real estate agency owners** - the person who owns
a 2-15 person brokerage in Mumbai, Thane, Navi Mumbai or Pune.

We are pre-launch. Nobody knows us. The job of these videos is to make an agency owner stop
scrolling because he recognises his own daily life on screen.

**Everything is in Hinglish** - roughly 70% English, 30% romanized Hindi. Not translated Hindi.
The way people actually talk in a Mumbai office.

**Tone:** direct, calm, a little blunt. **Never** motivational-guru, never hype, never "hustle."
The audience is exhausted; we are the calm operator who tells them the truth.

---

## 2. Your total workload: 13 videos over 4 weeks

| Week | Videos | IDs |
|------|--------|-----|
| Week 1 (deliver by Sat 9 Aug) | 3 | R01, R03, R04 |
| Week 2 (deliver by Sat 16 Aug) | 3 | R05, R08 *(+ buffer)* |
| Week 3 (deliver by Sat 23 Aug) | 4 | R09 ★★, R10, R12, R13 |
| Week 4 (deliver by Sat 30 Aug) | 4 | R14 ★★, R15, R17, R18 |

**Deliver one week ahead of the posting date.** Week 1 videos are needed before 10 Aug.

★★ = **R09 and R14 are the two most important videos of the month.** Budget two days each.

### The 13 videos

| ID | Title | Length | Type | Your inputs |
|----|-------|--------|------|-------------|
| R01 | Raat ke 11:47 | 28s | Presenter | Arjun clip + VO + phone b-roll |
| R03 | Employee resign karta hai ★ | 32s | Presenter | Arjun clip + VO + b-roll |
| R04 | Independence Day | 22s | Presenter | Arjun clip + VO + b-roll |
| R05 | Pandrah hazaar kiska hai | 26s | Presenter | Arjun clip + VO + paperwork b-roll |
| R08 | Buyer ab builder ko direct ★ | 34s | Presenter | Arjun clip + VO + phone/portal b-roll |
| R09 | **THE THESIS** ★★ | 38s | Presenter | 2 Arjun clips (2 environments) + VO + S-A1 |
| R10 | Screen demo - dashboard | 24s | Screen | S-01 recording + VO |
| R12 | Screen demo - Khata Book | 26s | Screen | S-02 recording + VO |
| R13 | Hum ye kyun bana rahe hain | 30s | Presenter | Arjun clip + VO + build b-roll |
| R14 | **THE REVEAL** ★★ | 30s | Screen | S-03 recording + VO |
| R15 | WhatsApp Se Puchho #1 | 18s | Screen | S-04 recording + VO |
| R17 | WhatsApp Se Puchho #2 | 19s | Screen | S-05 recording + VO |
| R18 | Founding 50 closer | 28s | Presenter | Arjun clip + VO + month montage |

**Not your job:** R02, R06, R07, R11, R16 (kinetic type / chat animations), all carousels (C01-C06),
all posters (P01-P04). Those are produced separately.

---

## 3. What you receive per video

Three files, in a folder named after the reel ID:

```
REF-R03/
├── REF-R03-arjun-RAW.mp4     ← presenter footage, no text, no music, no captions
├── REF-R03-vo.wav            ← the voice track alone, 48kHz
└── REF-R03-script.md         ← the timed script (from file 06 or 07)
```

For screen-demo reels you receive `REF-S##-<slug>-RAW.mp4` instead of the Arjun clip.

**You supply:** b-roll, captions, sound design, music, graphics, end card, grade.

> The presenter, "Arjun," is an **AI-generated brand narrator.** Treat him like any spokesperson
> footage. He is not a customer and must never be captioned or lower-thirded as a real broker,
> agent, or customer. If a script seems to imply that, flag it - don't build it.

---

## 4. Delivery spec

| | |
|---|---|
| Resolution | **1080 × 1920** (9:16) |
| Frame rate | 30fps |
| Codec | H.264, MP4 |
| Bitrate | 10-15 Mbps |
| Audio | AAC, 48kHz stereo, **normalised to −14 LUFS**, true peak ≤ −1 dBTP |
| Captions | **Burned in.** Always. |
| File name | `REF-R03-employee-resign-v1.mp4` |
| Also deliver | A clean version **without** burned captions, same name + `-noCC` |

### Safe zones - build this into your template

```
1080 × 1920
├─ 0-220px       DEAD  ── Instagram UI. Nothing here.
├─ 220-1500px    SAFE  ── all text, all key action
│                          captions sit at y ≈ 1050-1250
└─ 1500-1920px   DEAD  ── caption, username, audio, buttons
Right edge: keep last 140px clear (like/comment/share rail)
```

---

## 5. Brand system

### Colours (use these hexes exactly)

| Name | Hex | Use |
|------|-----|-----|
| Ink | `#1C1512` | Backgrounds, end cards. Warm near-black - **not** pure black, **not** navy |
| Ink 2 | `#251C16` | Cards, panels |
| Paper | `#FBF2E4` | Light backgrounds, body text on dark |
| **Marigold** | `#FF7A1A` | **Primary accent.** Key words, CTAs, highlights, underlines |
| **Gulal** | `#FF3D7F` | Secondary pop - **once per video maximum** |
| Tulsi | `#1FAA59` | Checkmarks and "money coming in" only. Never a general accent. |
| Dust | `#C9BBA8` | Secondary text on dark backgrounds |
| Error red | `#EF4444` | Pain, loss, negative numbers, strike-throughs |

**Rule: never put marigold and gulal on the same frame as accents.** Pick one per moment.

### Fonts

- **Unbounded, weight 800 or 900** - headlines, hook text, big numbers. Google Fonts, free.
  **Never** set a paragraph in it. One line, maybe two.
- **Manrope, 400-800** - captions, body, small labels, CTA button text. Google Fonts, free.

### Caption style (burned-in)

- Manrope **700**, ~62px, Paper `#FBF2E4`
- Key word in each line in **Marigold**
- Max **4 words per line**, max 2 lines at a time
- Word-by-word or phrase-by-phrase pop-on, synced to the VO. **No karaoke highlight sweeps.**
- Subtle dark shadow or 60% ink pill behind text so it survives bright footage
- Position: y ≈ 1050-1250

### End card (build once, reuse on all 13)

Ink `#1C1512` ground. Logo mark + "RealEstateFlow" wordmark in Unbounded 800, Paper, centred.
A thin marigold rule underneath. Holds 1.5-2s. Where a script specifies a CTA, add it in
Manrope 800 on a marigold pill.

---

## 6. Motion & editing rules

These make the difference between "AI slop" and something that looks made on purpose.

1. **The hook lands in 1.5 seconds.** First frame carries text or action. No fade-ins, no logo
   openers, no "wait for it."
2. **Cut on the beat of the voice**, not on a grid. Every cut should land on a stressed syllable.
3. **Zoom-punches, not slow pans** - especially on screen recordings. Cut to a scaled crop on the
   beat, cut back. A static screen recording dies without them.
4. **Nothing idles.** Every element either performs a move or is completely still. No floating,
   no breathing scale, no drifting backgrounds. Idle wobble is the #1 tell of low-effort editing.
5. **Silence is a tool.** Several scripts specify 2+ seconds of silence (R05 at 6s, R14 at 13s).
   Those pauses are the most important frames in the video. **Do not fill them with music.**
6. **Text enters word by word**, staggered ~0.06s apart, then holds. It does not fade in as a block.
7. **Loop-friendly:** the last frame should cut cleanly back to the first. Viewers rewatching is
   free reach.
8. **Grade warm.** Slightly lifted blacks, mild grain. Never cold, never clinical, never
   over-sharpened.

### Music

- Low, minimal, percussive. Indian percussion textures welcome - tabla, dholak - but subtle, never
  a "Bollywood" cue.
- **Duck 12-15dB under all voiceover.** The VO is the content; music is texture.
- Several scripts start with **no music at all.** Respect that - it's specified deliberately.
- Licensed or royalty-free only. Trending audio does not apply to a B2B account.

---

## 7. B-roll you will need

Most of these can be shot on a phone in an ordinary office in an afternoon, or sourced. Keep a
reusable library - many repeat across videos.

| For | Shot | Used in |
|-----|------|---------|
| Phone chaos | WhatsApp chat list scrolling fast, blurring | R01, R04, R09 |
| Night notification | Phone lighting up in a dark room, shot from above | R01 |
| Desk being cleared | Chair pushed in, drawer emptied, empty desk | R03 |
| Contacts scroll | Personal phone contact list scrolling, many names | R03 |
| Two phones | Two phones side by side on a desk | R03 |
| Diary / ledger | A handwritten rent diary, pages turning | R04, R05 |
| Paperwork | Deposit receipt, cleaning bill, notepad with figures | R05 |
| Portal browsing | Phone browsing a property portal, tapping "contact" | R08 |
| Missed call log | Phone showing missed calls | R08 |
| Dead CRM | Laptop with a generic login screen, lid closing | R09 |
| Live WhatsApp | WhatsApp with messages actually arriving | R09 |
| Build b-roll | Notebook with workflow scribbles, whiteboard, half-built UI on screen | R13 |

**Never use:** glass-tower corporate offices, handshake stock footage, people in suits, symmetrical
smiling group shots, anything that looks American. If it looks like a stock photo, it's wrong.

**Always prefer:** real Indian brokerage offices, laminate desks, files stacked, an under-construction
flat with dust and exposed wiring, golden-hour light, handheld framing, mild grain.

---

## 8. Per-video approval flow

1. You deliver **v1** by the Saturday deadline
2. Feedback within 24 hours
3. **One** revision round → **v2** final
4. Anything beyond v2 means the brief was wrong - flag it rather than absorbing it

**Flag immediately, don't guess, if:**
- A script asks you to show a product feature you don't have footage for
- A screen recording has a visible bug, error state, or real personal data in it
- A script seems to claim something about customers or results
- The presenter footage is inconsistent with previous videos (different face, wardrobe, age)

---

## 9. Quick QC checklist - run before every delivery

- [ ] 1080×1920, 30fps, H.264
- [ ] Audio normalised to −14 LUFS
- [ ] Hook lands within 1.5s
- [ ] All text inside y 220-1500, right 140px clear
- [ ] Captions burned in, ≤4 words per line, marigold keyword accent
- [ ] Marigold and gulal never both accenting the same frame
- [ ] Specified silences preserved (check the script)
- [ ] Nothing idles - every element performs or is still
- [ ] End card present, 1.5-2s
- [ ] Loops cleanly
- [ ] No real client names, phone numbers or personal data visible
- [ ] Both versions exported: with captions and `-noCC`
