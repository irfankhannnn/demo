---
name: design-assets
description: >
  Generate specifications and AI prompts for ad banners, social media posts,
  UI mockups, and marketing graphics. Outputs detailed creative briefs with
  Nano Banana / image gen prompts, text overlay specs, and size variants.
  Use for any visual asset creation.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Design Asset Generation

Create visual asset specifications for Cloudberry marketing. Brief: $ARGUMENTS

## Brand System

### Colors — "Bazaar Signal" (v3)
Ink: #1C1512 | Paper: #FBF2E4 | Marigold: #FF7A1A | Gulal: #FF3D7F (once per screen)
Tulsi: #1FAA59 (sparing — verified only) | Error: #EF4444

### Typography
Headlines: Unbounded ExtraBold/Black 800-900 | Body: Manrope Regular 400 | CTAs: Manrope Bold 700-800

## Workflow

### 1. Parse the Creative Brief
- Campaign objective (awareness/consideration/conversion)
- Target audience (from ICP data)
- Key message / hook
- Platform(s) and required sizes
- CTA and tone

### 2. Platform Sizes

| Platform | Size (px) | Ratio |
|----------|-----------|-------|
| FB Feed | 1200×628 | 1.91:1 |
| FB/IG Story | 1080×1920 | 9:16 |
| IG Feed | 1080×1080 | 1:1 |
| LinkedIn | 1200×627 | 1.91:1 |
| Twitter/X | 1600×900 | 16:9 |
| Email Header | 600×200 | 3:1 |

### 3. Generate AI Image Prompts
Create detailed prompts for each variant:
- Variant A: Feature-focused (show product)
- Variant B: Pain point (show the problem)
- Variant C: Social proof (show results)
- Variant D: Urgency (limited offer)
- Variant E: Aspirational (show outcome)

### 4. Text Overlay Specs
For each asset: headline (6 words max), subheadline (12 words), CTA button text (4 words), logo placement

### 5. Output

Save to `marketing-and-sales/creative/[campaign]/`:
```markdown
# Creative Asset: [Campaign] — [Variant]
## Specifications (platform, size, format)
## AI Image Generation Prompt
## Text Overlay (font, size, color, position)
## File Naming Convention
```
