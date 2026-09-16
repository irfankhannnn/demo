---
name: remotion-video
description: >
  Create and render videos programmatically using Remotion (React-based video
  framework). Generates video compositions for ad creatives, product demos,
  Instagram Reels, UGC-style content, and training videos. Leverages the
  existing marketing-and-sales/video-projects/my-video/ Remotion project for rendering. Use for any video
  creation task that requires programmatic video generation.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Remotion Video Generation — RealtyFlow

Create programmatic videos using Remotion. Brief: $ARGUMENTS

## Remotion Project Location
- **Project:** `marketing-and-sales/video-projects/my-video/`
- **Compositions:** `marketing-and-sales/video-projects/my-video/src/remotion/`
- **Render Command:** `npx remotion render [compositionId] output.mp4`
- **Studio:** `npx remotion studio` (preview in browser)
- **Lambda Deploy:** `node deploy.mjs` (render in cloud)

## Video Composition Templates

### 1. Ad Banner Video (15-30s)
```tsx
// Composition: RealtyFlowAd
// Props: headline, subheadline, cta, bgColor, logoUrl
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, Img } from 'remotion';

export const RealtyFlowAd: React.FC<{
  headline: string;     // Hinglish headline
  subheadline: string;  // Hinglish subheadline
  cta: string;          // CTA button text
  variant: 'pain' | 'solution' | 'premium';
}> = ({ headline, subheadline, cta, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Animate text entries with spring
  const titleOpacity = spring({ frame, fps, from: 0, to: 1, durationInFrames: 20 });
  // ... composition logic
};
```

### 2. Product Demo Video (60-90s)
```tsx
// Composition: ProductDemo
// Sequence of scenes: Hook → Problem → Demo Screens → Results → CTA
import { Sequence } from 'remotion';

export const ProductDemo: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={90}>  {/* Hook: 3s */}
      <HookScene text="Agency ki Growth, Aapke Control Mein" />
    </Sequence>
    <Sequence from={90} durationInFrames={210}>  {/* Problem: 7s */}
      <ProblemScene text="WhatsApp chaos, Excel nightmares..." />
    </Sequence>
    <Sequence from={300} durationInFrames={600}> {/* Demo: 20s */}
      <DemoScreensScene screenshots={[...]} />
    </Sequence>
    <Sequence from={900} durationInFrames={300}> {/* Results: 10s */}
      <ResultsScene metrics={[...]} />
    </Sequence>
    <Sequence from={1200} durationInFrames={150}> {/* CTA: 5s */}
      <CTAScene text="Free Trial Shuru Karo →" url="realtyflow.in" />
    </Sequence>
  </>
);
```

### 3. Instagram Reel (15-30s vertical)
```tsx
// Composition: InstagramReel
// 1080x1920 (9:16), 30fps
// Quick cuts, bold Hinglish text, energetic transitions
export const InstagramReel: React.FC<{
  scenes: Array<{ text: string; duration: number; visual: string }>;
}> = ({ scenes }) => {
  // ... vertical video with animated text overlays
};
```

### 4. Carousel Video (Multi-slide)
```tsx
// Composition: CarouselSlides
// Generate 5-10 image slides as a video or individual PNGs
// Each slide: bold headline + supporting visual + brand colors
```

### 5. Training/Tutorial Video (5-10min)
```tsx
// Composition: TutorialVideo
// Screen recording placeholders + voiceover timing marks
// Chapter markers for: Setup, Leads, Follow-ups, Reports
```

## Rendering Commands

### Local Render
```bash
# Render specific composition
cd my-video
npx remotion render RealtyFlowAd --props='{"headline":"Agency ki Growth","subheadline":"Aapke Control Mein","cta":"Try Free","variant":"solution"}' out/ad-solution.mp4

# Render Instagram Reel (vertical)
npx remotion render InstagramReel --width=1080 --height=1920 out/reel.mp4

# Render as PNG sequence (for image carousel)
npx remotion still CarouselSlides --frame=0 out/slide-1.png
npx remotion still CarouselSlides --frame=150 out/slide-2.png
```

### Batch Render (Multiple Variants)
```bash
#!/bin/bash
# Render 3 ad variants
VARIANTS=("pain" "solution" "premium")
HEADLINES=("Leads Kho Rahe Ho?" "Sab Ek Jagah" "Premium CRM for Agencies")

for i in "${!VARIANTS[@]}"; do
  npx remotion render RealtyFlowAd \
    --props="{\"headline\":\"${HEADLINES[$i]}\",\"variant\":\"${VARIANTS[$i]}\"}" \
    "out/ad-${VARIANTS[$i]}.mp4"
done
```

### Lambda Cloud Render
```bash
# Deploy and render in AWS Lambda (faster, parallel)
cd my-video
node deploy.mjs
# Then trigger renders via Lambda API
```

## Video Specs by Platform

| Platform | Composition | Resolution | FPS | Duration | Format |
|----------|-------------|-----------|-----|----------|--------|
| FB Feed Ad | RealtyFlowAd | 1280×720 | 30 | 15-30s | MP4 |
| IG Reel | InstagramReel | 1080×1920 | 30 | 15-60s | MP4 |
| IG Story | InstagramReel | 1080×1920 | 30 | 15s | MP4 |
| YouTube | ProductDemo | 1920×1080 | 30 | 60-120s | MP4 |
| LinkedIn | RealtyFlowAd | 1920×1080 | 30 | 30-60s | MP4 |
| Tutorial | TutorialVideo | 1920×1080 | 30 | 5-15min | MP4 |

## Adding Voiceover to Remotion Videos

```tsx
// Use <Audio> component with ElevenLabs-generated MP3
import { Audio } from 'remotion';

export const VideoWithVoice: React.FC<{ voiceoverUrl: string }> = ({ voiceoverUrl }) => (
  <>
    <Audio src={voiceoverUrl} />
    {/* ... visual composition */}
  </>
);
```

## Environment Variables
- `REMOTION_AWS_ACCESS_KEY_ID` — For Lambda rendering
- `REMOTION_AWS_SECRET_ACCESS_KEY` — For Lambda rendering
- `REMOTION_REGION` — AWS region (default: us-east-1)

## Output

Save to `marketing-and-sales/creative/video/[project]/`:
- Rendered MP4 files
- Composition source code (TSX)
- Props JSON for each variant
- Render log with timings
