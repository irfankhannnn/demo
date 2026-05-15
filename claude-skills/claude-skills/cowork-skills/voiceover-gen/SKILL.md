---
name: voiceover-gen
description: Generate professional voiceovers using ElevenLabs TTS API with audio post-production. Create subtitles, mix music, normalize audio, and sync voiceovers with video for RealtyFlow ads.
---

# Voiceover Generation Skill

Generate professional voiceovers for marketing videos using ElevenLabs TTS API. Includes voice profiles, audio mixing, subtitle generation, and video sync workflows.

## ElevenLabs API Setup

### Get API Key

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Copy your API key from Settings
3. Set environment variable:

```bash
export ELEVENLABS_API_KEY="your-api-key-here"
```

### List Available Voices

```bash
curl -s "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" | jq '.voices[] | {voice_id, name, labels}'
```

**Output Example:**
```json
{
  "voice_id": "pNInz6obpgDQGcFmaJgB",
  "name": "Aria",
  "labels": { "age": "young", "accent": "british", "gender": "female" }
}
```

## Voice Profiles for Indian Real Estate

### Profile 1: Indian English Male (Energetic)

**Use Case:** Product demos, tutorials, testimonials
**Characteristics:** Clear, energetic, professional, Indian accent

```bash
# Voice ID: pNInz6obpgDQGcFmaJgB (Aria - male variant)
# Actually use "Rajarath" or similar Indian male voice if available

curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Namaste agents. Meet RealtyFlow. Sabhi leads ek jagah.",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.6,
      "use_speaker_boost": true
    },
    "model_id": "eleven_multilingual_v2"
  }' \
  --output voiceover-male-energetic.mp3
```

### Profile 2: Indian English Female (Friendly)

**Use Case:** Onboarding, customer testimonials, product benefits
**Characteristics:** Warm, conversational, approachable, Indian accent

```bash
# Voice ID: 21m00Tcm4TlvDq8ikWAM (Clyde - female variant)

curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Itne saare leads ko manage kaise kar rahe ho? Meet RealtyFlow—ek app, sabhi leads.",
    "voice_settings": {
      "stability": 0.6,
      "similarity_boost": 0.8,
      "style": 0.7,
      "use_speaker_boost": true
    },
    "model_id": "eleven_multilingual_v2"
  }' \
  --output voiceover-female-friendly.mp3
```

### Profile 3: Professional Narrator (Authoritative)

**Use Case:** Brand story, company vision, authority positioning
**Characteristics:** Polished, deep, confident, professional

```bash
# Voice ID: iP95p4xoKVk53GoZ742B (Callum)

curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/iP95p4xoKVk53GoZ742B" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "RealtyFlow is not just another real estate app. It is a movement. 3000 agents strong.",
    "voice_settings": {
      "stability": 0.7,
      "similarity_boost": 0.85,
      "style": 0.5,
      "use_speaker_boost": false
    },
    "model_id": "eleven_multilingual_v2"
  }' \
  --output voiceover-narrator.mp3
```

## Voice Settings Presets

### Stability vs Similarity Boost

| Profile | Stability | Similarity | Style | Use Case |
|---------|-----------|-----------|-------|----------|
| **Energetic** | 0.5 | 0.75 | 0.6 | Product demos, tutorials |
| **Friendly** | 0.6 | 0.8 | 0.7 | Testimonials, onboarding |
| **Professional** | 0.7 | 0.85 | 0.5 | Brand story, narrator |
| **Casual** | 0.4 | 0.7 | 0.8 | Conversational, UGC |
| **Slow** | 0.7 | 0.8 | 0.4 | Elderly audience, clarity |

**Parameters:**
- **stability** (0–1): How consistent the voice is across sentences (higher = more stable/robotic)
- **similarity_boost** (0–1): How close to the original voice (higher = more true to voice)
- **style** (0–1): Emphasis on spoken style (higher = more expressive)

## Voiceover Generation Script

Create a bash script for batch voiceover generation:

```bash
#!/bin/bash
# generate-voiceovers.sh

API_KEY="${ELEVENLABS_API_KEY}"
VOICE_ID="${1:-pNInz6obpgDQGcFmaJgB}"  # Default: Indian male voice
OUTPUT_DIR="./output/voiceovers/$(date +%Y%m%d)"

mkdir -p "$OUTPUT_DIR"

# Script file (one text per line)
SCRIPTS=(
  "Namaste agents. Meet RealtyFlow."
  "Sabhi leads ek jagah manage karo."
  "AI-powered calling, automatic follow-ups."
  "Download karo. Zero subscription. Lifetime free."
)

for i in "${!SCRIPTS[@]}"; do
  TEXT="${SCRIPTS[$i]}"
  FILENAME="${OUTPUT_DIR}/voiceover-$((i+1)).mp3"

  echo "Generating: $TEXT"

  curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
    -H "xi-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"${TEXT}\",
      \"voice_settings\": {
        \"stability\": 0.5,
        \"similarity_boost\": 0.75
      },
      \"model_id\": \"eleven_multilingual_v2\"
    }" \
    --output "${FILENAME}"

  if [ -f "$FILENAME" ]; then
    echo "✓ Created: $FILENAME"
    # Get duration
    DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$FILENAME")
    echo "  Duration: ${DURATION}s"
  fi

  # Rate limit (5 requests/second)
  sleep 0.2
done

echo "All voiceovers generated in: $OUTPUT_DIR"
```

Run it:

```bash
chmod +x generate-voiceovers.sh
./generate-voiceovers.sh "pNInz6obpgDQGcFmaJgB"  # Pass voice ID as argument
```

## Multi-Language Voiceovers

### Hindi Voiceover

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "नमस्ते एजेंट्स। रियलटीफ्लो से सभी लीड्स को एक जगह प्रबंधित करें।",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75
    },
    "model_id": "eleven_multilingual_v2"
  }' \
  --output voiceover-hindi.mp3
```

### Marathi Voiceover

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "नमस्कार एजेंट्स. रियलटीफ्लोने सर्व लीड्स एका जागेवर व्यवस्थापित करा.",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75
    },
    "model_id": "eleven_multilingual_v2"
  }' \
  --output voiceover-marathi.mp3
```

## SRT Subtitle Generation

Create SRT (SubRip) subtitle files from voiceover script:

```bash
#!/bin/bash
# generate-srt.sh - Create SRT file from timecoded script

cat > subtitle.srt << 'EOF'
1
00:00:00,000 --> 00:00:03,500
Namaste agents, meet RealtyFlow

2
00:00:03,500 --> 00:00:07,000
Property management ab simple ho gaya

3
00:00:07,000 --> 00:00:10,500
All leads in one place

4
00:00:10,500 --> 00:00:14,000
AI calling, automatic follow-ups

5
00:00:14,000 --> 00:00:18,000
Download karo. Zero subscription.

6
00:00:18,000 --> 00:00:21,000
Lifetime free. 3000+ agents joined.

7
00:00:21,000 --> 00:00:24,000
Link in bio. Download now.
EOF

echo "✓ Subtitle file created: subtitle.srt"
```

### Calculate Timecodes from Audio Duration

```bash
#!/bin/bash
# Get voiceover duration and calculate frame timecodes

VOICEOVER="voiceover.mp3"
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$VOICEOVER")

echo "Total duration: ${DURATION}s"

# Calculate seconds for 7 equal scenes
SCENE_DURATION=$(echo "scale=2; $DURATION / 7" | bc)
echo "Each scene: ${SCENE_DURATION}s"

# Generate timecodes
for i in {1..7}; do
  START=$(echo "scale=2; ($i - 1) * $SCENE_DURATION" | bc)
  END=$(echo "scale=2; $i * $SCENE_DURATION" | bc)

  # Convert to SRT timecode format (HH:MM:SS,mmm)
  START_TC=$(printf "%02d:%02d:%06.3f" $((${START%.*} / 3600)) $(((${START%.*} % 3600) / 60)) $((${START#*.} + (${START%.*} % 60))))
  END_TC=$(printf "%02d:%02d:%06.3f" $((${END%.*} / 3600)) $(((${END%.*} % 3600) / 60)) $((${END#*.} + (${END%.*} % 60))))

  echo "$i: $START_TC --> $END_TC"
done
```

## FFmpeg Audio Post-Production Pipeline

### 1. Normalize Audio Levels

```bash
# Normalize to -16 LUFS (loudness standard)
ffmpeg -i voiceover.mp3 \
  -filter:a "loudnorm=I=-16:TP=-1.5:LRA=11" \
  voiceover-normalized.mp3
```

### 2. Mix Voiceover + Background Music

```bash
# Voiceover (louder) + Background Music (softer)
ffmpeg -i voiceover.mp3 -i bgmusic.mp3 \
  -filter_complex "[0]volume=1.0[vo];[1]volume=0.25[music];[vo][music]amix=inputs=2:duration=first" \
  -c:a aac voiceover-with-music.mp3
```

### 3. Add Fade In/Out Effects

```bash
# Fade in first 2s, fade out last 1s
ffmpeg -i voiceover.mp3 \
  -filter:a "afade=t=in:st=0:d=2,afade=t=out:st=$(echo 'scale=2; 10 - 1' | bc):d=1" \
  voiceover-faded.mp3
```

### 4. Compress Dynamic Range

```bash
# Reduce loudness peaks for consistent volume
ffmpeg -i voiceover.mp3 \
  -filter:a "acompressor=threshold=0.1:ratio=4:attack=5:release=50" \
  voiceover-compressed.mp3
```

### 5. Add Reverb (Optional, for spaciousness)

```bash
# Add subtle reverb
ffmpeg -i voiceover.mp3 \
  -filter:a "aecho=0.8:0.9:6:0.7" \
  voiceover-reverb.mp3
```

### Complete Audio Pipeline (All Steps)

```bash
#!/bin/bash
# complete-audio-pipeline.sh

INPUT="voiceover.mp3"
MUSIC="bgmusic.mp3"
OUTPUT="voiceover-final.mp3"

# All processing in one command
ffmpeg -i "$INPUT" -i "$MUSIC" \
  -filter_complex "
    [0]loudnorm=I=-16:TP=-1.5:LRA=11,
    acompressor=threshold=0.1:ratio=4:attack=5:release=50,
    afade=t=in:st=0:d=2[vo];
    [1]volume=0.25[music];
    [vo][music]amix=inputs=2:duration=first
  " \
  -c:a aac -b:a 192k "$OUTPUT"

echo "✓ Audio pipeline complete: $OUTPUT"
```

## Audio-Video Synchronization Workflow

### Step 1: Get Durations

```bash
#!/bin/bash
# sync-workflow.sh

VIDEO="video.mp4"
VOICEOVER="voiceover.mp3"

# Get video duration (in seconds)
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$VIDEO")

# Get audio duration
AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$VOICEOVER")

echo "Video duration: ${VIDEO_DUR}s"
echo "Audio duration: ${AUDIO_DUR}s"
```

### Step 2: Adjust Video Speed to Match Audio

If voiceover is longer, slow video down:

```bash
# Calculate speed factor
SPEED=$(echo "scale=4; $VIDEO_DUR / $AUDIO_DUR" | bc)
echo "Adjusting video speed to: $SPEED"

# Slow down video to match audio duration
ffmpeg -i "$VIDEO" \
  -filter:v "setpts=${SPEED}*PTS" \
  -c:v libx264 -c:a aac \
  video-synced.mp4
```

If audio is longer, you need to trim or speed up video:

```bash
# Speed up video
SPEED=$(echo "scale=4; $VIDEO_DUR / $AUDIO_DUR" | bc)
ffmpeg -i "$VIDEO" \
  -filter:v "setpts=${SPEED}*PTS" \
  -filter:a "atempo=${SPEED}" \
  video-synced.mp4
```

### Step 3: Merge Voiceover into Video

```bash
# Replace video audio with voiceover, keep video stream
ffmpeg -i video-synced.mp4 -i voiceover-final.mp3 \
  -c:v copy \
  -map 0:v:0 -map 1:a:0 \
  -shortest \
  video-with-voiceover.mp4
```

### Step 4: Add Subtitles (Optional)

```bash
# Burn SRT subtitles into video
ffmpeg -i video-with-voiceover.mp4 \
  -vf "subtitles=subtitle.srt:force_style='FontSize=32,PrimaryColour=&HFFFFFF&,BorderStyle=1'" \
  -c:v libx264 -c:a copy \
  video-final-with-subs.mp4
```

### Full Sync Workflow (Single Script)

```bash
#!/bin/bash
# full-audio-sync.sh

VIDEO="$1"
VOICEOVER="$2"
MUSIC="$3"
SUBTITLES="$4"
OUTPUT="output-final.mp4"

echo "Starting audio-video sync workflow..."

# Get durations
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$VIDEO")
AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 "$VOICEOVER")

echo "Video: ${VIDEO_DUR}s | Audio: ${AUDIO_DUR}s"

# Calculate speed factor
SPEED=$(echo "scale=4; $VIDEO_DUR / $AUDIO_DUR" | bc)

# Process: sync video + mix audio + add subtitles
ffmpeg -i "$VIDEO" -i "$VOICEOVER" -i "$MUSIC" \
  -filter_complex "
    [0:v]setpts=${SPEED}*PTS[v];
    [1]loudnorm=I=-16:TP=-1.5:LRA=11,
    acompressor=threshold=0.1:ratio=4[vo];
    [2]volume=0.25[music];
    [vo][music]amix=inputs=2:duration=first[a];
    [v]subtitles=${SUBTITLES}[vf]
  " \
  -map "[vf]" -map "[a]" \
  -c:v libx264 -c:a aac \
  "$OUTPUT"

echo "✓ Complete video saved: $OUTPUT"
```

Usage:

```bash
chmod +x full-audio-sync.sh
./full-audio-sync.sh video.mp4 voiceover.mp3 bgmusic.mp3 subtitle.srt
```

## Batch Voiceover Generation with Subtitles

```bash
#!/bin/bash
# batch-voiceover.sh

API_KEY="${ELEVENLABS_API_KEY}"
VOICE_ID="pNInz6obpgDQGcFmaJgB"
OUTPUT_DIR="./output/batch-$(date +%Y%m%d)"

mkdir -p "$OUTPUT_DIR"

# Define scripts (text + timecode)
declare -a SCRIPTS
declare -a TIMECODES

SCRIPTS[0]="Namaste agents. Meet RealtyFlow."
TIMECODES[0]="00:00:00,000 --> 00:00:03,500"

SCRIPTS[1]="Sabhi leads ek jagah manage karo."
TIMECODES[1]="00:00:03,500 --> 00:00:07,000"

SCRIPTS[2]="AI calling, automatic follow-ups, zero hassle."
TIMECODES[2]="00:00:07,000 --> 00:00:11,000"

SCRIPTS[3]="Download karo. Zero subscription. Lifetime free."
TIMECODES[3]="00:00:11,000 --> 00:00:15,000"

SRT_FILE="$OUTPUT_DIR/subtitles.srt"
> "$SRT_FILE"  # Clear file

for i in "${!SCRIPTS[@]}"; do
  TEXT="${SCRIPTS[$i]}"
  TIMECODE="${TIMECODES[$i]}"
  FILENAME="$OUTPUT_DIR/voiceover-$((i+1)).mp3"

  echo "[$((i+1))] Generating: $TEXT"

  # Generate voiceover
  curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
    -H "xi-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"${TEXT}\",
      \"voice_settings\": {
        \"stability\": 0.5,
        \"similarity_boost\": 0.75
      },
      \"model_id\": \"eleven_multilingual_v2\"
    }" \
    --output "$FILENAME"

  echo "✓ $FILENAME"

  # Add to SRT
  echo "$((i+1))" >> "$SRT_FILE"
  echo "$TIMECODE" >> "$SRT_FILE"
  echo "$TEXT" >> "$SRT_FILE"
  echo "" >> "$SRT_FILE"

  sleep 0.2  # Rate limit
done

echo ""
echo "All voiceovers generated: $OUTPUT_DIR"
echo "Subtitles: $SRT_FILE"
```

## Output Files

All voiceovers and subtitles will be saved to:

```
output/voiceovers/[DATE]/
├── voiceover-1.mp3
├── voiceover-2.mp3
├── voiceover-3.mp3
├── voiceover-final.mp3 (with music, normalized)
├── subtitles.srt
└── final-video-with-voiceover.mp4
```

## Voiceover Checklist

Before finalizing:

- [ ] Audio is normalized to -16 LUFS (loudness standard)
- [ ] Background music is at 0.25 volume (not overpowering voiceover)
- [ ] Voiceover duration matches video duration (or vice versa)
- [ ] SRT subtitle timecodes are accurate
- [ ] Hinglish is natural and conversational
- [ ] No background noise in recording
- [ ] Audio fade-in/fade-out are smooth
- [ ] Final MP3 is mono or stereo at 48 kHz (video standard)

---

**Skills Used Together:**
- Use `ugc-scripts` skill to write voiceover scripts
- Use `video-production` skill to render video matched to voiceover duration
- Combine with `meta-ads` skill to launch campaigns
