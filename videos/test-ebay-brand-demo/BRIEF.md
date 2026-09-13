---
workflow: general-video
flow: companion
storyboard: yes
message: "12,000 eBay purchases, 6-figure Amazon resale profit — but zero system to track it, and it nearly broke me."
destination: youtube
aspect: 1920x1080
language: en
audience: general / online-business audience
length: 60s
angle: hook-and-turn (success stat, then the honest pain point)
---

## Intent

A capability test, not a real campaign: recut an existing talking-head clip
into an advanced short-form edit to learn the HyperFrames workflow before
producing real RealtyFlow videos. The user is new to video editing and wants
to watch/approve each stage rather than get one final render.

Style is deliberately borrowed from Cloudberry Solutions' real site
(cloudberrysolutions.in) as a branding exercise, even though the clip's
content (eBay-to-Amazon reselling) has nothing to do with Cloudberry's actual
cloud/DevOps/AI business — confirmed acceptable since this is a test run.

## Assets

- C:\Users\qures\Downloads\Talking Head Video Raw.mp4 — raw talking-head footage, 1280x720, 30fps, 61.17s, AAC audio. Primary track.
- C:\Users\qures\Downloads\transcript.json — word-level transcript (whisper small.en, 179 words), drives caption timing.
- https://cloudberrysolutions.in/cloudberry-full-logo.svg and /logo.svg — brand logo, not yet downloaded locally.
- Brand reference: primary blue #0077C8, dark tech/AI hero with animated gradient orbs + grid overlay, clean modern sans-serif type, thin-line lucide-style icons (cloud/shield/bot/cpu), checkmark bullet lists, card-based layout — scraped from cloudberrysolutions.in home page.

## Customizations

- Styled, animated subtitle captions synced to the real transcript timestamps.
- B-roll cutaways tied to the spoken content: eBay listings/packages (12,000 products stat), Amazon seller dashboard + growth chart (6-figure profit), messy-desk/stress visual (the obstacles beat), delivery-tracking/doorstep package (the "no system" pain point). B-roll is AI-generated (no real footage exists for this).
- One animation moment: count-up/stat hit on the "12,000 products" / "6 figures" beat.
- Background music bed (offline Lyria engine) under the existing real voice track — no synthetic narration, the raw footage's own audio is the voice.

## Notes

- Audio: staying signed out of HeyGen — using free local engines (Lyria for music; Kokoro unavailable/not needed since narration is the real voice, not TTS).
- Do not touch or reuse videos/realestateflow-launch/ — separate project, separate brand.
