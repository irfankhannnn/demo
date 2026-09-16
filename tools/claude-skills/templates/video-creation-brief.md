# Video Creation Brief Template

Use this template when requesting video creation from `motion-engineer` or `ugc-planner`.

---

## Project Details

- **Video Title:** [e.g., "RealtyFlow Product Demo"]
- **Duration:** [e.g., 60 seconds]
- **Aspect Ratio:** 16:9 (YouTube/LinkedIn) | 1:1 (Feed) | 9:16 (Reels/Stories)
- **Purpose:** Product Demo | Feature Explainer | UGC | Ad | Tutorial | Testimonial
- **Platform:** YouTube | Instagram Reels | Instagram Feed | Facebook | LinkedIn | WhatsApp Status

---

## Scene Breakdown

| Scene | Duration | Visual | Text Overlay | Audio/VO |
|-------|----------|--------|-------------|----------|
| 1 | 5s | [describe] | [text on screen] | [voiceover line] |
| 2 | 10s | [describe] | [text on screen] | [voiceover line] |
| 3 | 10s | [describe] | [text on screen] | [voiceover line] |
| ... | ... | ... | ... | ... |

---

## Your Custom Media (Optional)

Check all that apply and provide file paths:

- [ ] **Photos:** `media/my-photos/[filename].jpg`
- [ ] **Video Clips:** `media/my-videos/[filename].mp4`
- [ ] **Screen Recordings:** `media/my-screenshots/[filename].png`
- [ ] **Background Music:** `media/my-audio/[filename].mp3`
- [ ] **Logo:** `media/my-photos/logo.png`
- [ ] **Voiceover (pre-recorded):** `media/my-audio/voiceover.mp3`

> If no custom media is provided, agent will generate everything programmatically via Remotion.

---

## Voiceover Requirements

- **Language:** Hinglish | English | Hindi | Marathi | Arabic
- **Tone:** Casual | Professional | Energetic | Warm
- **Voice Gender:** Male | Female
- **Generate via ElevenLabs?** Yes / No (provide your own)
- **Lipsync Required?** Yes / No (for character animations)

---

## Branding

- **Include Logo Intro?** Yes / No (5-second animated logo)
- **Include Logo Outro?** Yes / No (5-second outro with tagline)
- **Brand Colors:** Primary `#1E40AF` | Secondary `#F59E0B`
- **Font:** Inter / Arial / Custom

---

## Delivery

- **Output Format:** MP4
- **Resolution:** 1920×1080 | 1080×1080 | 1080×1920
- **FPS:** 30
- **Also need:** [ ] GIF preview [ ] Thumbnail PNG [ ] SRT subtitles
- **Save to:** `marketing-and-sales/creative/videos/[filename].mp4`

---

## Example Usage

Fill this brief, then run:
```
/agent motion-engineer
"[Paste your filled brief here or reference it]"
```

Or for UGC with your own media:
```
/agent ugc-planner
"[Paste your filled brief with custom media paths]"
```
