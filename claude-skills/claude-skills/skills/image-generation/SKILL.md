---
name: image-generation
description: >
  Generate images for ad creatives, social posts, and marketing assets using
  AI image generation APIs (OpenAI DALL-E 3, Google Gemini Imagen). Outputs
  API calls, prompt engineering, and image post-processing commands.
  Use for any visual asset that requires AI-generated images.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# AI Image Generation

Generate images for RealtyFlow marketing. Brief: $ARGUMENTS

## Supported APIs

### 1. OpenAI DALL-E 3
```bash
curl -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "[PROMPT]",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd",
    "style": "natural"
  }' | jq -r '.data[0].url'
```

Sizes: `1024x1024` (square), `1792x1024` (landscape), `1024x1792` (portrait)

### 2. Google Gemini Imagen
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict" \
  -H "Authorization: Bearer ${GOOGLE_AI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{"prompt": "[PROMPT]"}],
    "parameters": {
      "sampleCount": 1,
      "aspectRatio": "1:1",
      "safetyFilterLevel": "block_few"
    }
  }'
```

Aspect ratios: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`

## Prompt Engineering for RealtyFlow

### Ad Banner Prompts
```
Product Screenshot: "Clean modern SaaS CRM dashboard, real estate data, blue-white UI,
property listing cards, pipeline visualization, professional software, 16:9, high resolution"

Lifestyle: "Indian real estate agent in modern Mumbai office, tablet showing CRM dashboard,
confident expression, professional attire, natural lighting, warm corporate photography"

Results/Data: "Clean infographic, upward trending graph, bold numbers showing 40% increase,
modern flat design, blue gradient background, professional SaaS marketing"

Before/After: "Split screen, left messy WhatsApp groups and spreadsheets, right clean
organized CRM dashboard, dramatic improvement, professional marketing design"
```

### Social Media Prompts
```
Instagram Post: "Modern minimal graphic, bold Hindi-English text overlay space,
real estate theme, blue and emerald gradient, professional, square format"

Story: "Vertical mobile-first design, real estate agent success story visual,
modern Indian office, vibrant colors, 9:16 aspect ratio"
```

## Post-Processing with ImageMagick

### Resize for platforms
```bash
# Facebook Feed (1200x628)
magick input.png -resize 1200x628^ -gravity center -extent 1200x628 fb-feed.png

# Instagram Square (1080x1080)
magick input.png -resize 1080x1080^ -gravity center -extent 1080x1080 ig-square.png

# Story/Reel (1080x1920)
magick input.png -resize 1080x1920^ -gravity center -extent 1080x1920 story.png
```

### Add text overlay
```bash
magick input.png \
  -font Inter-Bold -pointsize 72 -fill white \
  -gravity North -annotate +0+100 "Agency ki Growth" \
  -font Inter-Regular -pointsize 36 -fill "#E2E8F0" \
  -gravity North -annotate +0+200 "Aapke Control Mein" \
  output.png
```

### Add logo watermark
```bash
magick input.png logo.png -gravity SouthEast -geometry +20+20 -composite output.png
```

## Batch Generation Script

```bash
#!/bin/bash
# Generate multiple ad variants
PROMPTS=(
  "Feature-focused: Modern CRM dashboard with real estate data"
  "Pain point: Frustrated agent with messy spreadsheets"
  "Social proof: Happy Indian agency team celebrating results"
  "Urgency: Limited time offer graphic with countdown feel"
)

for i in "${!PROMPTS[@]}"; do
  curl -s -X POST "https://api.openai.com/v1/images/generations" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"dall-e-3\",\"prompt\":\"${PROMPTS[$i]}\",\"size\":\"1024x1024\",\"quality\":\"hd\"}" \
    | jq -r '.data[0].url' | xargs curl -o "variant-$((i+1)).png"
done
```

## Environment Variables Required
- `OPENAI_API_KEY` — OpenAI API key for DALL-E 3
- `GOOGLE_AI_API_KEY` — Google AI API key for Gemini Imagen

## Output

Save to `marketing-and-sales/creative/images/[campaign]/`:
- Generated images as PNG
- Prompt log (for reproducibility)
- Resized variants per platform
