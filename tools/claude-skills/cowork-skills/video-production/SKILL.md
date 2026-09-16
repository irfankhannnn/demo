---
name: video-production
description: Create programmatic videos using Remotion and FFmpeg post-production. Generate ads, product demos, Instagram Reels, and tutorials for RealtyFlow targeting Indian real estate agents.
---

# Video Production Skill

Create professional marketing videos using Remotion (React-based programmatic video framework) and FFmpeg for post-production workflows.

## Remotion Composition Templates

### 1. Ad Banner Video Template

Create a new Remotion composition for short-form ad videos:

```bash
mkdir -p marketing-and-sales/video-projects/my-video/src/compositions/ads
cat > marketing-and-sales/video-projects/my-video/src/compositions/ads/AdBanner.tsx << 'EOF'
import { Composition, Img, Sequence, useVideoConfig } from "remotion";

export const AdBanner: React.FC = () => {
  const { width, height, fps } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        color: "white",
        overflow: "hidden",
      }}
    >
      <Sequence from={0} durationInFrames={60}>
        <div style={{ fontSize: 48, fontWeight: "bold", textAlign: "center" }}>
          RealtyFlow
        </div>
      </Sequence>

      <Sequence from={60} durationInFrames={60}>
        <div style={{ fontSize: 36, color: "#00d4ff", textAlign: "center" }}>
          Property Management <br /> Ab Aur Aasan
        </div>
      </Sequence>

      <Sequence from={120} durationInFrames={60}>
        <div style={{ fontSize: 28, color: "#ffaa00", textAlign: "center" }}>
          Join 3000+ Agents ✨
        </div>
      </Sequence>
    </div>
  );
};

export const adBannerComposition = {
  component: AdBanner,
  durationInFrames: 180,
  fps: 30,
  width: 1080,
  height: 1080,
  id: "ad-banner",
};
EOF
```

### 2. Product Demo Composition

```bash
cat > marketing-and-sales/video-projects/my-video/src/compositions/ads/ProductDemo.tsx << 'EOF'
import { Composition, Sequence, useVideoConfig, interpolate } from "remotion";

export const ProductDemo: React.FC = () => {
  const { width, height, fps } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Hero Section */}
      <Sequence from={0} durationInFrames={90}>
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            color: "white",
          }}
        >
          <h1 style={{ fontSize: 56, margin: 0 }}>RealtyFlow Dashboard</h1>
          <p style={{ fontSize: 28 }}>Sabhi leads ek jagah</p>
        </div>
      </Sequence>

      {/* Feature 1 */}
      <Sequence from={90} durationInFrames={90}>
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
          }}
        >
          <h2 style={{ fontSize: 40, color: "#667eea" }}>Lead Management</h2>
          <p style={{ fontSize: 24, color: "#333" }}>Track buyers, sellers, owners</p>
        </div>
      </Sequence>

      {/* CTA */}
      <Sequence from={180} durationInFrames={60}>
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#00d4ff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            color: "white",
          }}
        >
          <p style={{ fontSize: 44 }}>Download RealtyFlow App</p>
          <p style={{ fontSize: 28 }}>Link in bio 👇</p>
        </div>
      </Sequence>
    </div>
  );
};

export const productDemoComposition = {
  component: ProductDemo,
  durationInFrames: 240,
  fps: 30,
  width: 1080,
  height: 1920,
  id: "product-demo",
};
EOF
```

### 3. Instagram Reel Template

```bash
cat > marketing-and-sales/video-projects/my-video/src/compositions/ads/InstagramReel.tsx << 'EOF'
import { Composition, Sequence, useVideoConfig } from "remotion";

export const InstagramReel: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        color: "white",
        fontSize: 32,
        textAlign: "center",
        padding: 40,
      }}
    >
      <Sequence from={0} durationInFrames={90}>
        <div>
          <h2 style={{ fontSize: 48, marginBottom: 20 }}>Problem</h2>
          <p>Itne saare buyers/sellers ko manage kaise karoge?</p>
        </div>
      </Sequence>

      <Sequence from={90} durationInFrames={90}>
        <div>
          <h2 style={{ fontSize: 48, marginBottom: 20, color: "#ffaa00" }}>Solution</h2>
          <p>RealtyFlow: Ek app, sabhi leads, zero hassle</p>
        </div>
      </Sequence>

      <Sequence from={180} durationInFrames={90}>
        <div>
          <h2 style={{ fontSize: 48, marginBottom: 20, color: "#00d4ff" }}>Action</h2>
          <p>Download now. Zero subscription. Lifetime free.</p>
        </div>
      </Sequence>
    </div>
  );
};

export const instagramReelComposition = {
  component: InstagramReel,
  durationInFrames: 270,
  fps: 30,
  width: 1080,
  height: 1920,
  id: "instagram-reel",
};
EOF
```

### 4. Tutorial Video Template

```bash
cat > marketing-and-sales/video-projects/my-video/src/compositions/ads/Tutorial.tsx << 'EOF'
import { Composition, Sequence, useVideoConfig } from "remotion";

export const Tutorial: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#1a1a2e",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: 40,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Sequence from={0} durationInFrames={120}>
        <div>
          <h1 style={{ fontSize: 56, marginBottom: 20 }}>How to Add a Buyer</h1>
          <p style={{ fontSize: 32 }}>Step-by-step tutorial</p>
        </div>
      </Sequence>

      <Sequence from={120} durationInFrames={150}>
        <div>
          <h2 style={{ fontSize: 40 }}>Step 1: Dashboard se "Add Buyer" click karo</h2>
        </div>
      </Sequence>

      <Sequence from={270} durationInFrames={150}>
        <div>
          <h2 style={{ fontSize: 40 }}>Step 2: Details fill karो - Name, Budget, Location</h2>
        </div>
      </Sequence>

      <Sequence from={420} durationInFrames={150}>
        <div>
          <h2 style={{ fontSize: 40 }}>Step 3: Click "Save" aur done! 🎉</h2>
        </div>
      </Sequence>
    </div>
  );
};

export const tutorialComposition = {
  component: Tutorial,
  durationInFrames: 570,
  fps: 30,
  width: 1920,
  height: 1080,
  id: "tutorial",
};
EOF
```

## Platform Video Specifications

| Platform | Resolution | FPS | Duration | Aspect Ratio | Format |
|----------|------------|-----|----------|--------------|--------|
| **Facebook Feed** | 1080×1080 | 30 | 15–240s | 1:1 or 4:5 | MP4 |
| **Instagram Reels** | 1080×1920 | 30 | 15–90s | 9:16 | MP4 |
| **YouTube Short** | 1080×1920 | 30 | 15–60s | 9:16 | MP4 |
| **LinkedIn Feed** | 1080×1080 | 30 | 1–10m | 1:1 or 16:9 | MP4 |
| **WhatsApp Status** | 1080×1920 | 30 | 15s | 9:16 | MP4 |
| **Web Ads** | 1920×1080 | 30 | 6–15s | 16:9 | MP4 |

## Remotion Render Commands

### Local Rendering

Render composition to MP4 locally:

```bash
# Single composition render
cd my-video
npx remotion render src/compositions/ads/AdBanner.tsx --props '{"text":"RealtyFlow"}' --output-format mp4 ./output/ad-banner.mp4

# Instagram Reel render
npx remotion render src/compositions/ads/InstagramReel.tsx --output-format mp4 ./output/instagram-reel.mp4

# Batch render all compositions
npx remotion render src/compositions/ads/ --output-format mp4 --image-sequence false
```

### Lambda Cloud Rendering

For high-quality batch rendering via AWS Lambda:

```bash
# Deploy to Lambda
npx remotion lambda functions deploy

# Render to S3
npx remotion lambda render \
  src/compositions/ads/AdBanner.tsx \
  --props '{"text":"RealtyFlow"}' \
  --output-bucket realtyflow-videos

# Get render status
npx remotion lambda renders --status <render-id>
```

## FFmpeg Post-Production Pipeline

### 1. Trim Video

```bash
# Trim first 5 seconds and last 2 seconds (for 15s target)
ffmpeg -i input.mp4 -ss 5 -to 13 -c:v libx264 -c:a aac -q:v 5 output-trimmed.mp4
```

### 2. Resize for Platform

```bash
# Resize to Instagram Reel (1080×1920)
ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -c:a aac output-ig.mp4

# Resize to Facebook Feed (1080×1080)
ffmpeg -i input.mp4 -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -c:a aac output-fb.mp4
```

### 3. Concatenate Multiple Videos

```bash
# Create concat file
cat > concat.txt << 'EOF'
file 'intro.mp4'
file 'main.mp4'
file 'outro.mp4'
EOF

# Concatenate
ffmpeg -f concat -safe 0 -i concat.txt -c copy output-concat.mp4
```

### 4. Add Text Overlay

```bash
# Add text with Hinglish
ffmpeg -i video.mp4 \
  -vf "drawtext=textfile='subtitle.txt':x=50:y=h-100:fontsize=32:fontcolor=white:line_spacing=10" \
  -c:v libx264 -c:a aac output-text.mp4
```

### 5. Audio Normalization & Mixing

```bash
# Normalize audio levels
ffmpeg -i input.mp4 -filter:a loudnorm=I=-16:TP=-1.5:LRA=11 -c:v copy output-norm.mp4

# Mix voiceover (primary) with background music (secondary)
ffmpeg -i voiceover.mp3 -i bgmusic.mp3 \
  -filter_complex "[0]volume=1.0[vo];[1]volume=0.3[music];[vo][music]amix=inputs=2:duration=first" \
  output-mixed.mp3
```

### 6. Add Subtitles (SRT to Burned)

```bash
# Create SRT file (subtitle.srt)
cat > subtitle.srt << 'EOF'
1
00:00:00,000 --> 00:00:03,000
Namaste agents, meet RealtyFlow

2
00:00:03,000 --> 00:00:06,000
Lead management ab simple ho gaya
EOF

# Burn subtitles into video
ffmpeg -i video.mp4 -vf "subtitles=subtitle.srt" -c:v libx264 -c:a aac output-subs.mp4
```

### 7. Add Watermark/Logo

```bash
# Overlay watermark at bottom-right corner
ffmpeg -i video.mp4 -i logo.png \
  -filter_complex "overlay=main_w-overlay_w-10:main_h-overlay_h-10" \
  -c:v libx264 -c:a aac output-watermark.mp4
```

## Scene-by-Scene Script Template

Create a markdown file for each video with this structure:

```markdown
# Video: [Title]

**Platform:** Instagram Reels | **Duration:** 30s | **Language:** Hinglish

## Scene 1: Hook (0-5s)
- **Visual:** Close-up of overwhelmed agent with 100 leads
- **Voiceover:** "Itne saare buyers, sellers, owners... kaise manage karoge?"
- **Hinglish Ratio:** 60% English, 40% Hindi
- **Music:** Upbeat, energetic (120 BPM)

## Scene 2: Problem (5-12s)
- **Visual:** Split screen - chaos on left, organized on right
- **Voiceover:** "Pehle spreadsheets, WhatsApp groups, phone calls... nightmare tha"
- **Music:** Slows down, tension

## Scene 3: Solution (12-20s)
- **Visual:** RealtyFlow dashboard animation, features flying in
- **Voiceover:** "Meet RealtyFlow - ek app, sabhi leads, AI-powered insights"
- **Music:** Upbeat returns

## Scene 4: Benefits (20-27s)
- **Visual:** Quick cuts of 3 features
  - Scene 4a: Lead dashboard (2s)
  - Scene 4b: AI calling (2s)
  - Scene 4c: Analytics (3s)
- **Voiceover:** "Track, call, close. Repeat. Zero subscription."
- **Music:** Climax builds

## Scene 5: CTA (27-30s)
- **Visual:** App download screen with QR code
- **Voiceover:** "Download RealtyFlow. Link in bio. 3000+ agents already joined."
- **On-screen Text:** "DOWNLOAD NOW" (flashing)
- **Music:** Resolution, positive

## Audio & Voiceover
- **Voiceover Talent:** Male, Indian English, energetic
- **Voice Speed:** Normal (1.0x)
- **Music Track:** "Upbeat Modern" (royalty-free)
- **SFX:** Click sounds, notification dings

## Color & Branding
- **Primary Colors:** #667eea (purple), #00d4ff (cyan)
- **Accent:** #ffaa00 (orange)
- **Font:** Montserrat (bold), Inter (regular)
- **Logo Placement:** Bottom-right corner, 10% opacity fade-in at 27s
```

## Video + Voiceover Merging Workflow

### Step 1: Generate Voiceover with ElevenLabs

```bash
# Generate voiceover MP3
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB" \
  -H "xi-api-key: $ELEVEN_LABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Itne saare buyers kaise manage karoge?","voice_settings":{"stability":0.5,"similarity_boost":0.75}}' \
  > voiceover.mp3
```

### Step 2: Get Video & Voiceover Duration

```bash
# Get video duration (in seconds)
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 video.mp4)

# Get audio duration
AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nounits=1 voiceover.mp3)

echo "Video: ${VIDEO_DUR}s | Voiceover: ${AUDIO_DUR}s"
```

### Step 3: Adjust Video Duration to Match Voiceover

If voiceover is longer, slow video down:

```bash
# Calculate speed factor
SPEED=$(echo "scale=3; $VIDEO_DUR / $AUDIO_DUR" | bc)

# Apply slowdown
ffmpeg -i video.mp4 -filter:v "setpts=$SPEED*PTS" -c:v libx264 -c:a aac video-synced.mp4
```

### Step 4: Mix Audio Tracks

Replace video audio with voiceover:

```bash
# Replace audio only
ffmpeg -i video-synced.mp4 -i voiceover.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output-with-vo.mp4
```

### Step 5: Add Background Music (Optional)

```bash
# Mix voiceover (louder) with background music (softer)
ffmpeg -i output-with-vo.mp4 -i bgmusic.mp3 \
  -filter_complex "[0:a]volume=1.0[vo];[1]volume=0.25[bg];[vo][bg]amix=inputs=2:duration=first" \
  -c:v copy -c:a aac final-video.mp4
```

## Batch Rendering Script

Create a bash script to render multiple videos:

```bash
#!/bin/bash
# render-batch.sh

OUTPUT_DIR="./output/batch-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

COMPOSITIONS=(
  "AdBanner"
  "ProductDemo"
  "InstagramReel"
  "Tutorial"
)

for comp in "${COMPOSITIONS[@]}"; do
  echo "Rendering $comp..."
  npx remotion render src/compositions/ads/${comp}.tsx \
    --output-format mp4 \
    "$OUTPUT_DIR/${comp}-$(date +%s).mp4"

  if [ $? -eq 0 ]; then
    echo "✓ $comp rendered successfully"
  else
    echo "✗ $comp failed"
  fi
done

echo "All renders complete. Output: $OUTPUT_DIR"
```

Run it:

```bash
chmod +x render-batch.sh
./render-batch.sh
```

## Output Files

All rendered videos will be saved to:

```
marketing-and-sales/video-projects/my-video/output/
├── ad-banner.mp4
├── product-demo.mp4
├── instagram-reel.mp4
├── tutorial.mp4
└── batch-[timestamp]/
    ├── AdBanner.mp4
    ├── ProductDemo.mp4
    ├── InstagramReel.mp4
    └── Tutorial.mp4
```

Download these MP4 files to your workspace folder for upload to ad platforms.

---

**Skills Used Together:**
- Use `ugc-scripts` skill to write scene-by-scene scripts
- Use `voiceover-gen` skill to create voiceovers
- Combine outputs with `video-production` for final renders
