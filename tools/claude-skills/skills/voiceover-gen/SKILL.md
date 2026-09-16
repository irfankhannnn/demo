---
name: voiceover-gen
description: >
  Generate voiceover specifications using ElevenLabs TTS, create multi-language
  subtitle files (SRT/VTT), and produce audio post-production FFmpeg commands.
  Use for voiceover creation, subtitle generation, and audio mixing.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Voiceover & Subtitle Generation

Create voiceover and subtitle specs for Cloudberry content. Brief: $ARGUMENTS

## Voice Profiles

| Profile | Language | Use Case | Tone |
|---------|----------|----------|------|
| Arjun | English (Indian) | Demos, tutorials | Professional, warm |
| Priya | English (Indian) | Ads, social | Energetic, confident |
| Khalid | English (Arabic) | Dubai content | Authoritative |
| Dev | English (Casual) | UGC-style | Casual, relatable |

## ElevenLabs API Settings

```json
{
  "product_demo": { "stability": 0.7, "similarity_boost": 0.8, "style": 0.2, "speed": 0.95 },
  "ad_energetic": { "stability": 0.4, "similarity_boost": 0.7, "style": 0.6, "speed": 1.1 },
  "ugc_casual": { "stability": 0.3, "similarity_boost": 0.6, "style": 0.7, "speed": 1.0 },
  "tutorial_calm": { "stability": 0.8, "similarity_boost": 0.85, "style": 0.1, "speed": 0.9 }
}
```

## Subtitle Languages
Priority: English (en), Hindi (hi), Arabic (ar)
Secondary: Marathi (mr), Tamil (ta), Telugu (te), Kannada (kn)

## Localization Notes
- **India:** Use ₹ (INR), reference RERA, crore/lakh numbers, mention WhatsApp
- **Dubai:** Use AED/USD, reference Oqood/DLD, international workflows

## Audio Post-Production (FFmpeg)
- Normalize: `loudnorm=I=-16:TP=-1.5:LRA=11`
- Mix music: `volume=0.15` for background
- Trim silence: `silenceremove` filter
- Fade: `afade` in/out
- Burn subtitles: `subtitles=subs.srt` filter

## Output
```markdown
# Voiceover: [Title]
## Voice Config (profile, language, settings)
## Script with Timing Marks
## SRT Subtitle Files (per language)
## FFmpeg Pipeline (ordered commands)
## Deliverables List
```

Save to `marketing-and-sales/creative/audio/[project]/`
