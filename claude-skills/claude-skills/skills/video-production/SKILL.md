---
name: video-production
description: >
  Create video production plans including scripts, Veo AI generation prompts,
  FFmpeg post-production commands, and platform-specific exports. Use for demo
  videos, ad videos, social content, and tutorial creation.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Video Production

Create a video production plan for Cloudberry. Brief: $ARGUMENTS

## Pre-Production

### 1. Video Brief
- Goal: Awareness | Consideration | Conversion | Education
- Duration: 15s | 30s | 60s | 2-5min
- Aspect: 16:9 (landscape) | 9:16 (vertical) | 1:1 (square)
- Platform: YouTube | Meta | LinkedIn | Reels | TikTok
- Style: Product demo | Talking head | Animation | B-roll | UGC-style

### 2. Script Template
| Timestamp | Visual | Voiceover | Text Overlay | Music |
|-----------|--------|-----------|-------------|-------|
| 0:00-0:03 | Hook | Hook line | Bold text | Upbeat |
| 0:03-0:10 | Problem | Pain point | Supporting | Tension |
| 0:10-0:25 | Demo | Features | Callouts | Confident |
| 0:25-0:35 | Proof | Social proof | Stats | Triumphant |
| 0:35-0:40 | CTA | CTA line | CTA + URL | Resolve |

## Production

### 3. Veo AI Generation Prompts
Generate detailed prompts for each scene with:
- Camera movement, lighting, subject, setting
- Color scheme, mood, style reference
- Resolution: 4K, framerate: 30fps

### 4. FFmpeg Post-Production Pipeline
Provide exact commands for:
- Trim, resize, concatenate clips
- Add text overlays, logo watermark
- Audio mixing (voiceover + background music)
- Subtitle burning (SRT format)
- Platform-specific exports

## Platform Exports

| Platform | Resolution | Duration | Format | Bitrate |
|----------|-----------|----------|--------|---------|
| YouTube | 1920×1080 | Any | MP4 H.264 | 8-12 Mbps |
| Meta Feed | 1280×720 | 15-60s | MP4 H.264 | 4-8 Mbps |
| Reels | 1080×1920 | 15-90s | MP4 H.264 | 6-10 Mbps |

Save to `marketing-and-sales/creative/video/[project]/`
