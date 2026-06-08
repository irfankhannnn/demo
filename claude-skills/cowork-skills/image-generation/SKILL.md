---
name: Image Generation
description: Generate AI images using DALL-E 3 and Gemini Imagen via bash scripts, with ImageMagick post-processing for ads, social content, and blogs.
---

# Image Generation Skill

## Overview
This skill generates professional marketing images for RealtyFlow using:
- **DALL-E 3 API** (via bash curl commands)
- **Gemini Imagen API** (via bash curl commands)
- **ImageMagick** (post-processing, text overlays, resizing)
- **Batch generation** (automatic multi-image creation)
- All outputs saved as PNG files to workspace

**Requirements:** API keys in environment variables + ImageMagick installed

## Environment Setup

### Required Environment Variables
```bash
# DALL-E 3 (OpenAI)
export OPENAI_API_KEY="sk-..."

# Gemini Imagen (Google Cloud)
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"
export GOOGLE_CLOUD_API_KEY="your-api-key"

# Optional: Image processing
export IMAGEMAGICK_HOME="/usr/bin"
```

### Verify Installation
```bash
# Check ImageMagick
convert --version

# Check curl
curl --version

# Check API keys are set
echo $OPENAI_API_KEY
echo $GOOGLE_CLOUD_API_KEY
```

## DALL-E 3 API Integration

### Basic Image Generation (Bash Script)

```bash
#!/bin/bash
# generate-image-dalle.sh

API_KEY=$OPENAI_API_KEY
PROMPT="$1"
OUTPUT_FILE="$2"

# DALL-E 3 API call
curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "'"$PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd",
    "style": "natural"
  }' | jq -r '.data[0].url' > /tmp/image_url.txt

# Download generated image
IMAGE_URL=$(cat /tmp/image_url.txt)
curl -s "$IMAGE_URL" -o "$OUTPUT_FILE"

echo "Image saved: $OUTPUT_FILE"
```

### Usage
```bash
./generate-image-dalle.sh \
  "Professional real estate agent on video call with client" \
  "realtyflow-agent-call.png"
```

## Gemini Imagen API Integration

### Basic Image Generation (Bash Script)

```bash
#!/bin/bash
# generate-image-gemini.sh

PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID
API_KEY=$GOOGLE_CLOUD_API_KEY
PROMPT="$1"
OUTPUT_FILE="$2"

# Gemini Imagen API call
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1/models/imagen-3.0-generate-001:generateContent?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "'"$PROMPT"'"
      }]
    }],
    "generationConfig": {
      "temperature": 1,
      "topK": 40,
      "topP": 0.95,
      "maxOutputTokens": 2048
    }
  }' | jq -r '.candidates[0].content.parts[0].text' > /tmp/image_data.json

# Extract and decode base64 image
base64 -d /tmp/image_data.json > "$OUTPUT_FILE"

echo "Image saved: $OUTPUT_FILE"
```

### Usage
```bash
./generate-image-gemini.sh \
  "Dashboard showing real estate leads and CRM interface" \
  "realtyflow-dashboard.png"
```

## Prompt Engineering Templates

### Template 1: Ad Banner Image
```
Professional ad banner, 1200x628 pixels.
Image shows [Indian/Dubai] real estate agent smiling,
holding phone showing RealtyFlow interface.
Modern office setting, warm lighting.
Colors: blue (#2563EB), green (#10B981), gold accents.
Professional photography style, high quality.
Text overlay: "Close 25% More Deals"
```

### Template 2: Social Media Post (Instagram)
```
Square Instagram post (1080x1080px).
Featured: Real estate agent celebrating with team members.
Setting: Modern office, happy atmosphere.
Visual: Handshake or high-five between agents.
Colors: Warm, inviting, professional.
Style: Modern, aspirational photography.
Include subtle RealtyFlow logo in corner.
Emotion: Success, growth, teamwork.
```

### Template 3: Testimonial Card
```
Rectangular card (800x600px) with:
Close-up portrait of Indian real estate agent (headshot).
Agent wearing professional attire, smiling.
Soft blurred office background.
Modern photography style, warm lighting.
Color grade: Professional, approachable.
Space for text overlay (agent name, quote, location).
Background color: Light (leave room for text).
```

### Template 4: Blog Feature Image
```
Landscape blog header image (1200x600px).
Conceptual image representing:
[Real estate agent productivity / Lead management / Team growth]
Modern, clean aesthetic.
Colors: Blues, greens, golds matching RealtyFlow brand.
Professional photography or illustration style.
Text overlay space at bottom (for headline).
High contrast for readability when text is overlaid.
Indian market context (architecture, agents, or offices visible).
```

### Template 5: LinkedIn Article Thumbnail
```
Landscape image (1200x627px).
Professional, business-focused imagery.
Real estate agent in action (on call, at property, with client).
Modern workspace setting.
Colors: Professional blues and greens.
Photography style: Corporate, aspirational.
Space for large text overlay (article title).
High readability with dark text overlay.
```

### Template 6: YouTube Thumbnail
```
Square thumbnail (1280x720px, 16:9 focus).
High contrast, eye-catching design.
Centered subject (agent or success metric).
Bold colors: Use RealtyFlow brand colors prominently.
Readable from small size (minimum 30pt font safe).
Expressive agent face (if featuring person).
Clear visual hierarchy.
Potential text: "25% More Deals" or "RealtyFlow Tips"
```

### Template 7: Email Header
```
Wide email header (600x400px or 600x200px).
Horizontal layout for email clients.
Professional, clean design.
Company branding prominent (RealtyFlow logo/colors).
Content focus: Call-to-action, key message.
Colors: Brand colors (blue, green, gold).
Text-safe design (avoid text critical areas).
```

### Template 8: WhatsApp Sticker/Share Image
```
Square image (1080x1080px).
Simple, high-contrast design.
Quick readability (WhatsApp small preview).
Minimal text, bold message.
RealtyFlow branding subtle but visible.
Emoji-compatible design.
Colors: Vibrant, eye-catching.
Message focus: Quick tip or statistic.
```

## ImageMagick Post-Processing

### Standard Resizing
```bash
#!/bin/bash
# resize-image.sh

INPUT_FILE="$1"
OUTPUT_FILE="$2"
WIDTH="$3"
HEIGHT="$4"

convert "$INPUT_FILE" \
  -resize "${WIDTH}x${HEIGHT}!" \
  -quality 90 \
  "$OUTPUT_FILE"

echo "Resized: $OUTPUT_FILE (${WIDTH}x${HEIGHT})"
```

### Add Text Overlay
```bash
#!/bin/bash
# add-text-overlay.sh

INPUT_FILE="$1"
OUTPUT_FILE="$2"
TEXT="$3"

convert "$INPUT_FILE" \
  -font /usr/share/fonts/opentype/noto/NotoSans-Bold.otf \
  -pointsize 72 \
  -fill white \
  -stroke black \
  -strokewidth 2 \
  -gravity center \
  -annotate 0 "$TEXT" \
  "$OUTPUT_FILE"

echo "Text added: $OUTPUT_FILE"
```

### Add Logo Watermark
```bash
#!/bin/bash
# add-watermark.sh

INPUT_FILE="$1"
LOGO_FILE="$2"
OUTPUT_FILE="$3"

convert "$INPUT_FILE" \
  "$LOGO_FILE" \
  -gravity southeast \
  -geometry +20+20 \
  -composite \
  "$OUTPUT_FILE"

echo "Watermark added: $OUTPUT_FILE"
```

### Batch Process Images (Resize Multiple)
```bash
#!/bin/bash
# batch-resize.sh

for file in *.png; do
  filename="${file%.*}"

  # Instagram (1080x1080)
  convert "$file" -resize "1080x1080!" "${filename}-instagram.png"

  # Facebook (1200x628)
  convert "$file" -resize "1200x628!" "${filename}-facebook.png"

  # Twitter (1024x512)
  convert "$file" -resize "1024x512!" "${filename}-twitter.png"

  # LinkedIn (1200x627)
  convert "$file" -resize "1200x627!" "${filename}-linkedin.png"

  echo "Batch resized: $filename"
done
```

## Platform Size Reference Table

### Social Media Dimensions
```
Platform             | Optimal Size        | Aspect Ratio | Format
---------------------|---------------------|--------------|--------
Facebook Feed        | 1200x628            | 16:9        | PNG/JPG
Facebook Story       | 1080x1920          | 9:16        | PNG/JPG
Instagram Feed       | 1080x1080          | 1:1         | PNG/JPG
Instagram Story      | 1080x1920          | 9:16        | PNG/JPG
Instagram Reel       | 1080x1920          | 9:16        | MP4
Twitter Post         | 1024x512           | 2:1         | PNG/JPG
Twitter Header       | 1500x500           | 3:1         | PNG/JPG
LinkedIn Feed        | 1200x627           | 16:9        | PNG/JPG
LinkedIn Article     | 1200x627           | 16:9        | PNG/JPG
LinkedIn Banner      | 1500x500           | 3:1         | PNG/JPG
YouTube Thumbnail    | 1280x720           | 16:9        | PNG/JPG
YouTube Banner       | 2560x1440          | 16:9        | PNG/JPG
Email Header         | 600x400 or 600x200 | 3:2 or 3:1  | PNG/JPG
Blog Featured Image  | 1200x600           | 2:1         | PNG/JPG
WhatsApp Share       | 1080x1080          | 1:1         | PNG/JPG
```

## Batch Generation Bash Script

### Complete Workflow Script
```bash
#!/bin/bash
# batch-generate-images.sh

set -e

WORKSPACE_DIR="${1:-.}"
API_KEY=$OPENAI_API_KEY
TIMESTAMP=$(date +%s)

# Create output directories
mkdir -p "$WORKSPACE_DIR/generated"
mkdir -p "$WORKSPACE_DIR/processed"

echo "🎨 Starting batch image generation..."

# Image 1: Ad Banner (Facebook)
echo "Generating ad banner..."
PROMPT="Professional real estate agent smiling while using RealtyFlow CRM on laptop. Modern office setting. Warm lighting. Indian market context. Professional photography, high quality. Size: 1200x628."

curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "'"$PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd"
  }' | jq -r '.data[0].url' | xargs curl -s -o "$WORKSPACE_DIR/generated/ad-banner-${TIMESTAMP}.png"

# Image 2: Social Proof (Instagram Square)
echo "Generating testimonial card..."
PROMPT="Close-up portrait of confident Indian real estate agent in professional attire, smiling warmly. Soft blurred office background. Warm lighting. Professional photography style. Space for text overlay. Size: 1080x1080."

curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "'"$PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd"
  }' | jq -r '.data[0].url' | xargs curl -s -o "$WORKSPACE_DIR/generated/testimonial-${TIMESTAMP}.png"

# Image 3: Dashboard Screenshot Concept
echo "Generating dashboard concept..."
PROMPT="Modern SaaS dashboard interface showing real estate CRM with lead list, analytics charts, and action buttons. Clean blue and green UI. Professional software design. Clean white background. Size: 1920x1080."

curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "'"$PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd"
  }' | jq -r '.data[0].url' | xargs curl -s -o "$WORKSPACE_DIR/generated/dashboard-${TIMESTAMP}.png"

# Image 4: Blog Feature Image
echo "Generating blog header..."
PROMPT="Landscape conceptual image about real estate lead management automation. Indian agents, modern office, technology integration. Blues, greens, gold accents. Professional photography. High contrast. Space for text overlay. Size: 1200x600."

curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "'"$PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "hd"
  }' | jq -r '.data[0].url' | xargs curl -s -o "$WORKSPACE_DIR/generated/blog-header-${TIMESTAMP}.png"

echo "✅ Generation complete!"
echo "📁 Files saved to: $WORKSPACE_DIR/generated/"

# Now process all generated images
echo "🔄 Processing images for all platforms..."

for file in "$WORKSPACE_DIR/generated"/*.png; do
  filename=$(basename "$file" .png)

  # Instagram (1080x1080)
  convert "$file" -resize "1080x1080!" -quality 90 \
    "$WORKSPACE_DIR/processed/${filename}-instagram.png"

  # Facebook (1200x628)
  convert "$file" -resize "1200x628!" -quality 90 \
    "$WORKSPACE_DIR/processed/${filename}-facebook.png"

  # Twitter (1024x512)
  convert "$file" -resize "1024x512!" -quality 90 \
    "$WORKSPACE_DIR/processed/${filename}-twitter.png"

  # LinkedIn (1200x627)
  convert "$file" -resize "1200x627!" -quality 90 \
    "$WORKSPACE_DIR/processed/${filename}-linkedin.png"

  # Blog (1200x600)
  convert "$file" -resize "1200x600!" -quality 90 \
    "$WORKSPACE_DIR/processed/${filename}-blog.png"

  echo "✅ Processed: $filename"
done

echo "✅ All images processed!"
echo "📁 Output files: $WORKSPACE_DIR/processed/"
```

### Run the Script
```bash
chmod +x batch-generate-images.sh
./batch-generate-images.sh /path/to/workspace
```

## Advanced Post-Processing Examples

### Create Branded Image with Logo and Text
```bash
#!/bin/bash
# create-branded-image.sh

INPUT="$1"
LOGO="realtyflow-logo.png"
HEADLINE="$2"
OUTPUT="$3"

# Resize input
convert "$INPUT" -resize "1200x628!" /tmp/base.png

# Add semi-transparent overlay
convert /tmp/base.png \
  -fill black -colorize 30% \
  /tmp/overlay.png

# Add logo
convert /tmp/overlay.png \
  "$LOGO" -gravity northeast -geometry +20+20 -composite \
  /tmp/with-logo.png

# Add text
convert /tmp/with-logo.png \
  -font /usr/share/fonts/opentype/noto/NotoSans-Bold.otf \
  -pointsize 60 \
  -fill white \
  -gravity center \
  -annotate +0+0 "$HEADLINE" \
  "$OUTPUT"

echo "Branded image created: $OUTPUT"
```

### Split Image for A/B Testing
```bash
#!/bin/bash
# create-ab-variants.sh

INPUT="$1"

# Variant A: Dark theme
convert "$INPUT" -fill black -colorize 20% "variant-a-dark.png"

# Variant B: Bright theme
convert "$INPUT" -brightness-contrast 10x5 "variant-b-bright.png"

# Variant C: Saturated colors
convert "$INPUT" -modulate 100,150 "variant-c-saturated.png"

echo "A/B variants created"
```

## API Error Handling

### Robust Image Generation Script
```bash
#!/bin/bash
# generate-image-safe.sh

API_KEY=$OPENAI_API_KEY
PROMPT="$1"
OUTPUT_FILE="$2"
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Generating image (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."

  RESPONSE=$(curl -s -X POST "https://api.openai.com/v1/images/generations" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "dall-e-3",
      "prompt": "'"$PROMPT"'",
      "n": 1,
      "size": "1024x1024",
      "quality": "hd"
    }')

  IMAGE_URL=$(echo "$RESPONSE" | jq -r '.data[0].url' 2>/dev/null)

  if [ -n "$IMAGE_URL" ] && [ "$IMAGE_URL" != "null" ]; then
    curl -s "$IMAGE_URL" -o "$OUTPUT_FILE"
    echo "✅ Image saved: $OUTPUT_FILE"
    exit 0
  fi

  ERROR=$(echo "$RESPONSE" | jq -r '.error.message' 2>/dev/null)
  echo "❌ Error: $ERROR"

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "⏳ Retrying in 5 seconds..."
    sleep 5
  fi
done

echo "❌ Failed after $MAX_RETRIES attempts"
exit 1
```

## Image Quality Guidelines

### Prompt Writing Best Practices
```
✅ GOOD PROMPTS (Specific, Visual, Action-Oriented)
- "Professional Indian real estate agent in modern office,
  smiling while reviewing property listings on tablet.
  Natural daylight, warm tones, friendly atmosphere."

- "Dashboard mockup of RealtyFlow CRM: clean blue UI,
  lead list on left, analytics charts on right.
  Modern SaaS design, professional, high contrast."

❌ POOR PROMPTS (Vague, Abstract, Text-Heavy)
- "Make an image about real estate"
- "Image showing business success"
- "CRM platform dashboard" (too generic)

PROMPT FORMULA:
[PERSON/OBJECT] + [SETTING] + [ACTION] + [MOOD] + [STYLE]

Example:
Indian woman / modern office / reviewing leads on phone /
focused & confident / professional photography
```

## Output Organization

Save generated images with clear naming:
```
/workspace/generated/
├── ad-banner-feb17.png
├── testimonial-feb17.png
├── dashboard-feb17.png
└── blog-header-feb17.png

/workspace/processed/
├── ad-banner-feb17-instagram.png
├── ad-banner-feb17-facebook.png
├── ad-banner-feb17-twitter.png
├── ad-banner-feb17-linkedin.png
├── testimonial-feb17-instagram.png
├── testimonial-feb17-facebook.png
└── [... all variants ...]
```

## Common Commands Quick Reference

```bash
# Generate single DALL-E image
curl -s -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"dall-e-3","prompt":"YOUR_PROMPT","n":1,"size":"1024x1024"}'

# Resize image
convert input.png -resize 1080x1080! output.png

# Add text to image
convert input.png -font Arial -pointsize 48 -fill white -gravity center \
  -annotate 0 "Your Text" output.png

# Add watermark/logo
convert input.png logo.png -gravity southeast -geometry +10+10 \
  -composite output.png

# Batch resize all PNGs
for f in *.png; do convert "$f" -resize 1200x628! "${f%.*}-resized.png"; done

# Check image properties
identify image.png

# Optimize image quality
convert input.png -quality 85 -strip output.png
```

## Performance Notes

- DALL-E 3 takes 30-90 seconds per image
- Gemini Imagen is faster (15-30 seconds)
- ImageMagick operations are instant (<1 second)
- Batch 4-5 images at a time to avoid API rate limits
- Always add error handling for failed API calls

All generated PNG files are ready for immediate deployment to Meta Ads Manager, social platforms, and blog publishing systems.
