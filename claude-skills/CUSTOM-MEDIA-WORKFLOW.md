# Custom Media Input Workflow

> How to use YOUR OWN photos, videos, screen recordings, and audio in the video creation pipeline.

---

## Step 1: Organize Your Media

Create the folder structure:
```powershell
New-Item -ItemType Directory -Force -Path "marketing-and-sales/creative/media/my-photos"
New-Item -ItemType Directory -Force -Path "marketing-and-sales/creative/media/my-videos"
New-Item -ItemType Directory -Force -Path "marketing-and-sales/creative/media/my-screenshots"
New-Item -ItemType Directory -Force -Path "marketing-and-sales/creative/media/my-audio"
```

Place your files:
```
media/my-photos/         → .jpg, .png (agent photos, office, site visits)
media/my-videos/         → .mp4, .mov (webcam, screen recordings, client clips)
media/my-screenshots/    → .png (CRM dashboard, before/after, app screens)
media/my-audio/          → .mp3 (background music, pre-recorded voiceovers)
```

---

## Step 2: Choose Your Pipeline

### Pipeline A: Remotion (Programmatic — Best for polished videos)

Copy media to Remotion's public folder so `staticFile()` can access them:
```powershell
Copy-Item "marketing-and-sales/creative/media/my-photos/*" "my-video/public/" -Force
Copy-Item "marketing-and-sales/creative/media/my-videos/*" "my-video/public/" -Force
Copy-Item "marketing-and-sales/creative/media/my-audio/*" "my-video/public/" -Force
```

Then ask the agent to create a composition that references your files:
```
/agent motion-engineer
"Create a Remotion composition using these files from public/:
- Photo: agent-photo.jpg (show for 5 seconds with Ken Burns)
- Video: screen-recording.mp4 (show for 20 seconds)
- Audio: bgm.mp3 (background music at 15% volume)
Add text overlays and transitions."
```

The composition code will use:
```tsx
<Img src={staticFile("agent-photo.jpg")} />
<Video src={staticFile("screen-recording.mp4")} />
<Audio src={staticFile("bgm.mp3")} volume={0.15} />
```

Render:
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...composition with your media...","durationInFrames":900,"fps":30}' `
  -Output "videos/my-custom-video.mp4"
```

### Pipeline B: FFmpeg (Quick — Best for simple compositing)

**Picture-in-Picture (webcam + screen recording):**
```powershell
ffmpeg -i media/my-videos/screen.mp4 -i media/my-videos/webcam.mp4 `
  -filter_complex "[1:v]scale=320:240[pip];[0:v][pip]overlay=W-w-20:H-h-20" `
  -c:a copy output.mp4
```

**Side-by-Side:**
```powershell
ffmpeg -i media/my-videos/left.mp4 -i media/my-videos/right.mp4 `
  -filter_complex "[0:v]scale=540:960[l];[1:v]scale=540:960[r];[l][r]hstack" output.mp4
```

**Photo Slideshow (5 images, 4 seconds each):**
```powershell
ffmpeg -framerate 1/4 -i "media/my-photos/img%d.jpg" -c:v libx264 -pix_fmt yuv420p slideshow.mp4
```

**Add Text Overlay to Existing Video:**
```powershell
ffmpeg -i media/my-videos/clip.mp4 `
  -vf "drawtext=text='Your Text Here':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=50" output.mp4
```

**Green Screen Removal:**
```powershell
ffmpeg -i media/my-videos/greenscreen.mp4 -i media/my-screenshots/background.png `
  -filter_complex "[0:v]chromakey=0x00FF00:0.15:0.1[fg];[1:v][fg]overlay=0:0" output.mp4
```

**Trim Video:**
```powershell
ffmpeg -i media/my-videos/long-clip.mp4 -ss 00:00:05 -t 00:00:30 -c copy trimmed.mp4
```

**Add Audio to Video:**
```powershell
ffmpeg -i video.mp4 -i media/my-audio/voiceover.mp3 `
  -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 video-with-audio.mp4
```

**Mix Voice + Background Music:**
```powershell
ffmpeg -i media/my-audio/voiceover.mp3 -i media/my-audio/bgm.mp3 `
  -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.15[m];[v][m]amix=inputs=2:duration=first" mixed.mp3
```

### Pipeline C: Hybrid (Remotion rendering + FFmpeg post-processing)

1. Render animated graphics/text via Remotion
2. Composite your live footage via FFmpeg
3. Mix audio tracks
4. Burn subtitles

```powershell
# 1. Render animated overlay (transparent background)
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...text animations only...","durationInFrames":900,"fps":30}' `
  -Output "videos/overlay.webm"

# 2. Overlay animated graphics on your footage
ffmpeg -i media/my-videos/footage.mp4 -i videos/overlay.webm `
  -filter_complex "overlay=0:0" videos/composited.mp4

# 3. Add voiceover
ffmpeg -i videos/composited.mp4 -i media/my-audio/voiceover.mp3 `
  -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 videos/final.mp4
```

---

## Step 3: Generate Voiceover (If Needed)

```powershell
# From text
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Your Hinglish script here" `
  -VoiceId "pNInz6obpgDQGcFmaJgB" `
  -Output "media/my-audio/generated-voiceover.mp3"

# From text file
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -TextFile "marketing-and-sales/outreach/scripts/my-script.txt" `
  -VoiceId "pNInz6obpgDQGcFmaJgB" `
  -Output "media/my-audio/generated-voiceover.mp3"
```

---

## Step 4: Match Audio to Video Duration

```powershell
# Get audio duration
$audioDur = ffprobe -v error -show_entries format=duration -of csv=p=0 "media/my-audio/voiceover.mp3"
$frames = [math]::Ceiling([double]$audioDur * 30)

# Use $frames as durationInFrames in Remotion render
# OR trim/speed video to match:
ffmpeg -i video.mp4 -t $audioDur -c copy video-trimmed.mp4
```

---

## Step 5: Add Subtitles

```powershell
# Burn SRT subtitles into video
ffmpeg -i videos/final.mp4 -vf "subtitles=subs.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF'" `
  videos/final-subtitled.mp4
```

---

## Supported File Formats

| Type | Formats | Max Recommended Size |
|------|---------|---------------------|
| Photos | .jpg, .png, .webp | 4096×4096 |
| Videos | .mp4 (H.264), .mov, .webm | 1080p for social, 4K for YouTube |
| Audio | .mp3, .wav, .aac | — |
| Screenshots | .png | Original resolution |

---

## Tips

- **Naming:** Use descriptive names (`agent-office-mumbai.jpg` not `IMG_1234.jpg`)
- **Resolution:** Record at 1080p minimum for quality
- **Audio:** Record in quiet environment, normalize after with FFmpeg
- **Screen Recording:** Use OBS Studio (free) for best quality
- **Webcam:** Good lighting > expensive camera
- **Green Screen:** Even lighting on green cloth, wear contrasting colors
