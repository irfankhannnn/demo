#!/bin/bash
# RealtyFlow — ElevenLabs Text-to-Speech Script
# Generates voiceovers using ElevenLabs API
# Usage: ./elevenlabs-tts.sh -t "text" -v "voice_id" -o "output.mp3"
# Usage: ./elevenlabs-tts.sh -f "script.txt" -v "voice_id" -o "output.mp3"
# Usage: ./elevenlabs-tts.sh --list-voices

set -euo pipefail

# Defaults
TEXT=""
TEXT_FILE=""
VOICE_ID="pNInz6obpgDQGcFmaJgB"  # Default: Adam (Indian English)
OUTPUT="voiceover.mp3"
STABILITY=0.5
SIMILARITY=0.75
STYLE=0.2
SPEED=1.0
LIST_VOICES=false

# Presets
declare -A PRESETS
PRESETS[product_demo]="0.7:0.8:0.2:0.95"
PRESETS[ad_energetic]="0.4:0.7:0.6:1.1"
PRESETS[ugc_casual]="0.3:0.6:0.7:1.0"
PRESETS[tutorial_calm]="0.8:0.85:0.1:0.9"
PRESETS[whatsapp_casual]="0.3:0.8:0.5:1.0"

usage() {
    echo "Usage: $0 [options]"
    echo "  -t  Text to synthesize"
    echo "  -f  Text file to synthesize (alternative to -t)"
    echo "  -v  Voice ID (default: pNInz6obpgDQGcFmaJgB)"
    echo "  -o  Output MP3 file (default: voiceover.mp3)"
    echo "  -s  Stability 0-1 (default: 0.5)"
    echo "  -b  Similarity boost 0-1 (default: 0.75)"
    echo "  -y  Style 0-1 (default: 0.2)"
    echo "  -r  Speed 0.5-2.0 (default: 1.0)"
    echo "  -p  Preset: product_demo, ad_energetic, ugc_casual, tutorial_calm, whatsapp_casual"
    echo "  --list-voices  List available voices"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -t) TEXT="$2"; shift 2 ;;
        -f) TEXT_FILE="$2"; shift 2 ;;
        -v) VOICE_ID="$2"; shift 2 ;;
        -o) OUTPUT="$2"; shift 2 ;;
        -s) STABILITY="$2"; shift 2 ;;
        -b) SIMILARITY="$2"; shift 2 ;;
        -y) STYLE="$2"; shift 2 ;;
        -r) SPEED="$2"; shift 2 ;;
        -p)
            PRESET="$2"
            if [ -n "${PRESETS[$PRESET]:-}" ]; then
                IFS=':' read -r STABILITY SIMILARITY STYLE SPEED <<< "${PRESETS[$PRESET]}"
            else
                echo "Unknown preset: $PRESET"
                echo "Available: product_demo, ad_energetic, ugc_casual, tutorial_calm, whatsapp_casual"
                exit 1
            fi
            shift 2
            ;;
        --list-voices) LIST_VOICES=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
    echo "Error: ELEVENLABS_API_KEY environment variable not set"
    exit 1
fi

# List voices
if [ "$LIST_VOICES" = true ]; then
    echo "Available ElevenLabs voices:"
    curl -s "https://api.elevenlabs.io/v1/voices" \
      -H "xi-api-key: ${ELEVENLABS_API_KEY}" | \
      jq -r '.voices[] | "  \(.voice_id)  \(.name)  [\(.labels.accent // "unknown")]"'
    exit 0
fi

# Get text
if [ -n "$TEXT_FILE" ] && [ -f "$TEXT_FILE" ]; then
    TEXT=$(cat "$TEXT_FILE")
elif [ -z "$TEXT" ]; then
    echo "Error: Provide text with -t or a text file with -f"
    usage
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

echo "Generating voiceover..."
echo "  Voice: $VOICE_ID"
echo "  Stability: $STABILITY | Similarity: $SIMILARITY | Style: $STYLE | Speed: $SPEED"
echo "  Text length: ${#TEXT} chars"

# Escape text for JSON
ESCAPED_TEXT=$(echo "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT" \
  -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": ${ESCAPED_TEXT},
    \"model_id\": \"eleven_multilingual_v2\",
    \"voice_settings\": {
      \"stability\": ${STABILITY},
      \"similarity_boost\": ${SIMILARITY},
      \"style\": ${STYLE},
      \"use_speaker_boost\": true
    }
  }")

if [ "$HTTP_CODE" -ne 200 ]; then
    echo "Error: API returned HTTP $HTTP_CODE"
    cat "$OUTPUT"
    rm -f "$OUTPUT"
    exit 1
fi

FILE_SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null)
echo "Saved to: $OUTPUT ($FILE_SIZE bytes)"

# Get duration if ffprobe available
if command -v ffprobe &>/dev/null; then
    DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT" 2>/dev/null || echo "unknown")
    echo "Duration: ${DURATION}s"
fi
