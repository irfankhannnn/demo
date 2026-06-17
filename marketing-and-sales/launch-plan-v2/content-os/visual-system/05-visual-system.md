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
