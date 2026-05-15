#!/bin/bash
# RealtyFlow — AI Image Generation Script
# Generates images via OpenAI DALL-E 3 or Google Gemini Imagen
# Usage: ./generate-image.sh -p "openai" -t "prompt text" -s "1024x1024" -o "output.png"
# Usage: ./generate-image.sh -p "gemini" -t "prompt text" -a "16:9" -o "output.png"

set -euo pipefail

# Defaults
PROVIDER="openai"
PROMPT=""
SIZE="1024x1024"
ASPECT_RATIO="1:1"
QUALITY="hd"
STYLE="natural"
OUTPUT="generated-image.png"
DRY_RUN=false

usage() {
    echo "Usage: $0 [options]"
    echo "  -p  Provider: openai or gemini (default: openai)"
    echo "  -t  Prompt text (required)"
    echo "  -s  Size for OpenAI: 1024x1024, 1792x1024, 1024x1792 (default: 1024x1024)"
    echo "  -a  Aspect ratio for Gemini: 1:1, 3:4, 4:3, 9:16, 16:9 (default: 1:1)"
    echo "  -q  Quality: standard or hd (default: hd)"
    echo "  -o  Output file path (default: generated-image.png)"
    echo "  -d  Dry run — show API call without executing"
    exit 1
}

while getopts "p:t:s:a:q:o:dh" opt; do
    case $opt in
        p) PROVIDER="$OPTARG" ;;
        t) PROMPT="$OPTARG" ;;
        s) SIZE="$OPTARG" ;;
        a) ASPECT_RATIO="$OPTARG" ;;
        q) QUALITY="$OPTARG" ;;
        o) OUTPUT="$OPTARG" ;;
        d) DRY_RUN=true ;;
        h) usage ;;
        *) usage ;;
    esac
done

if [ -z "$PROMPT" ]; then
    echo "Error: Prompt is required (-t)"
    usage
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

if [ "$PROVIDER" = "openai" ]; then
    if [ -z "${OPENAI_API_KEY:-}" ]; then
        echo "Error: OPENAI_API_KEY environment variable not set"
        exit 1
    fi

    CMD="curl -s -X POST 'https://api.openai.com/v1/images/generations' \
      -H 'Authorization: Bearer ${OPENAI_API_KEY}' \
      -H 'Content-Type: application/json' \
      -d '{
        \"model\": \"dall-e-3\",
        \"prompt\": \"${PROMPT}\",
        \"n\": 1,
        \"size\": \"${SIZE}\",
        \"quality\": \"${QUALITY}\",
        \"style\": \"${STYLE}\"
      }'"

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] Would execute:"
        echo "$CMD"
        exit 0
    fi

    echo "Generating image with DALL-E 3..."
    RESPONSE=$(curl -s -X POST "https://api.openai.com/v1/images/generations" \
      -H "Authorization: Bearer ${OPENAI_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"model\": \"dall-e-3\",
        \"prompt\": \"${PROMPT}\",
        \"n\": 1,
        \"size\": \"${SIZE}\",
        \"quality\": \"${QUALITY}\",
        \"style\": \"${STYLE}\"
      }")

    IMAGE_URL=$(echo "$RESPONSE" | jq -r '.data[0].url // empty')

    if [ -z "$IMAGE_URL" ]; then
        echo "Error: Failed to generate image"
        echo "$RESPONSE" | jq .
        exit 1
    fi

    curl -s -o "$OUTPUT" "$IMAGE_URL"
    echo "Saved to: $OUTPUT"

elif [ "$PROVIDER" = "gemini" ]; then
    if [ -z "${GOOGLE_AI_API_KEY:-}" ]; then
        echo "Error: GOOGLE_AI_API_KEY environment variable not set"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] Would call Gemini Imagen with prompt: $PROMPT"
        echo "Aspect ratio: $ASPECT_RATIO"
        exit 0
    fi

    echo "Generating image with Gemini Imagen..."
    RESPONSE=$(curl -s -X POST \
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"instances\": [{\"prompt\": \"${PROMPT}\"}],
        \"parameters\": {
          \"sampleCount\": 1,
          \"aspectRatio\": \"${ASPECT_RATIO}\",
          \"safetyFilterLevel\": \"block_few\"
        }
      }")

    IMAGE_B64=$(echo "$RESPONSE" | jq -r '.predictions[0].bytesBase64Encoded // empty')

    if [ -z "$IMAGE_B64" ]; then
        echo "Error: Failed to generate image"
        echo "$RESPONSE" | jq .
        exit 1
    fi

    echo "$IMAGE_B64" | base64 -d > "$OUTPUT"
    echo "Saved to: $OUTPUT"
else
    echo "Error: Unknown provider '$PROVIDER'. Use 'openai' or 'gemini'."
    exit 1
fi
