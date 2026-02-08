# Claude Skills Usage Guide — Part 3: UGC Videos & Audio/Voiceover/Lipsync

> Sections 7-8. See [Part 1](./CLAUDESKILLSUSAGE.md) | [Part 2](./CLAUDESKILLSUSAGE-PART2.md) | [Part 4](./CLAUDESKILLSUSAGE-PART4.md) | [Part 5](./CLAUDESKILLSUSAGE-PART5.md)

---

## 7. UGC Videos (with Your Own Images/Videos)

**Agent:** `ugc-planner` + `motion-engineer` | **Skill:** `ugc-scripts`, `remotion-video`
**Strategy:** YOU provide your own photos, video clips, or screen recordings. The system composites them into polished UGC content with text overlays, transitions, and voiceover.

### How to Provide Your Own Media

```
marketing-and-sales/creative/media/
├── my-photos/           # Your photos (.jpg, .png)
├── my-videos/           # Your video clips (.mp4, .mov)
├── my-screenshots/      # App screenshots (.png)
└── my-audio/            # Background music, voice recordings (.mp3)
```

**3 Ways to Include Your Media:**

**A) Remotion staticFile()** — Copy media to `my-video/public/` then reference with `staticFile("filename.mp4")`
```powershell
Copy-Item "media/my-videos/clip.mp4" "my-video/public/clip.mp4"
# In Remotion code: <Video src={staticFile("clip.mp4")} />
```

**B) FFmpeg compositing** — Overlay, merge, picture-in-picture with existing clips
```powershell
ffmpeg -i my-video.mp4 -i overlay.png -filter_complex "overlay=10:10" output.mp4
```

**C) Remotion <Img> / <Video> components** — Reference local files directly in composition code

---

### 7.1 — "Agent Reviews RealtyFlow" (Webcam + Screen Recording)
```
/agent ugc-planner
"Write 45s UGC script: agent at desk talks to camera about CRM experience.
I'll provide my webcam recording and screen recording."
```
**Your files:** `media/my-videos/webcam.mp4`, `media/my-videos/screen.mp4`
```powershell
# Picture-in-picture: screen with webcam overlay in corner
ffmpeg -i media/my-videos/screen.mp4 -i media/my-videos/webcam.mp4 `
  -filter_complex "[1:v]scale=320:240[pip];[0:v][pip]overlay=W-w-20:H-h-20" `
  -c:a copy videos/ugc-agent-review.mp4
```

### 7.2 — "Day in My Life" Photo Slideshow (Your 5 Photos)
```
/agent ugc-planner
"Write 30s Reel: 'Day in my life using RealtyFlow'. I'll provide 5 photos of my workday."
```
**Your files:** `media/my-photos/morning.jpg`, `office.jpg`, `site-visit.jpg`, `closing.jpg`, `evening.jpg`
```
/agent motion-engineer
"Create Remotion composition: 5 images, 6 seconds each, Ken Burns zoom effect,
text overlay per slide, background music. Render 9:16."
```
```powershell
# Copy photos to Remotion public folder
Copy-Item media/my-photos/*.jpg my-video/public/
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...ken burns + staticFile refs...","durationInFrames":900,"fps":30}' `
  -Width 1080 -Height 1920 -Output "videos/ugc-day-in-life.mp4"
```

### 7.3 — Screen Recording Tutorial (Your Recording)
```
/agent ugc-planner
"Write 60s tutorial narration for 'how to add a lead'. I'll provide screen recording."
```
**Your file:** `media/my-videos/add-lead-recording.mp4`
```powershell
ffmpeg -i media/my-videos/add-lead-recording.mp4 `
  -vf "drawtext=text='Step 1 - Click Add Lead':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.7:x=50:y=50:enable='between(t,0,5)', drawtext=text='Step 2 - Fill Details':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.7:x=50:y=50:enable='between(t,5,10)', drawtext=text='Step 3 - Save':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.7:x=50:y=50:enable='between(t,10,15)'" `
  videos/ugc-tutorial.mp4
```

### 7.4 — Before/After with Your Real Screenshots
```
/agent ugc-planner
"Before/after script. I'll provide my old spreadsheet screenshot and new CRM screenshot."
```
**Your files:** `media/my-screenshots/old-spreadsheet.png`, `media/my-screenshots/new-crm.png`
```powershell
# Create wipe transition
Copy-Item media/my-screenshots/*.png my-video/public/
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...wipe transition between two images...","durationInFrames":900,"fps":30}' `
  -Output "videos/ugc-before-after.mp4"
```

### 7.5 — Customer Testimonial (Your Client's Raw Video)
```
/agent ugc-planner
"Write branded intro card + lower-third + outro CTA for customer testimonial.
I'll provide the raw interview clip."
```
**Your file:** `media/my-videos/client-interview.mp4`
```powershell
# Add lower-third name plate
ffmpeg -i media/my-videos/client-interview.mp4 `
  -vf "drawtext=text='Rohit Sharma, Sharma Properties':fontsize=28:fontcolor=white:box=1:boxcolor=blue@0.8:x=50:y=H-80:enable='between(t,2,30)'" `
  videos/testimonial-titled.mp4
# Concatenate: intro + testimonial + outro
@("file 'logo-intro.mp4'","file 'testimonial-titled.mp4'","file 'logo-outro.mp4'") | Out-File -Encoding ascii list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy videos/testimonial-final.mp4
```

### 7.6 — Product Unboxing Style (Your Laptop Recording)
```
/agent ugc-planner
"30s 'unboxing' style: open laptop → login → 'Whoa look at this dashboard!'.
I'll record myself opening laptop and reacting."
```
**Your file:** `media/my-videos/laptop-opening.mp4`
- Agent adds text overlays ("Ab dekhte hain!"), zoom effects on key moments
```powershell
ffmpeg -i media/my-videos/laptop-opening.mp4 `
  -vf "drawtext=text='Ab dekhte hain!':fontsize=48:fontcolor=yellow:x=(w-text_w)/2:y=100:enable='between(t,3,6)'" `
  videos/ugc-unboxing.mp4
```

### 7.7 — Problem-Agitate-Solution (Your Story Recording)
```
/agent ugc-planner
"PAS script in Hinglish. I'll record myself telling my story of losing leads. 45s."
```
**Script structure from agent:**
```
Hook (3s):  "Maine ek mahine mein 50 leads khoye..."  [Your face recording]
Problem (10s): [Your screenshots of old process]
Agitate (10s): [More screenshots + frustrated face]
Solution (15s): [Screen recording of RealtyFlow]
Result (5s):  "Ab mera close rate 3X ho gaya"        [Your face, happy]
CTA (2s):    "Link in bio"                           [Text card]
```

### 7.8 — Side-by-Side Phone + Desktop (Your Recordings)
```
/agent ugc-planner
"Script: mobile + desktop sync demo. I'll provide both screen recordings."
```
**Your files:** `media/my-videos/phone-screen.mp4`, `media/my-videos/desktop-screen.mp4`
```powershell
ffmpeg -i media/my-videos/phone-screen.mp4 -i media/my-videos/desktop-screen.mp4 `
  -filter_complex "[0:v]scale=540:960[left];[1:v]scale=540:960[right];[left][right]hstack" `
  videos/ugc-phone-desktop.mp4
```

### 7.9 — Carousel Video (5 Your Screen Recordings)
```
/agent ugc-planner
"5-slide carousel: each slide is 10-second clip. I'll provide 5 screen recordings."
```
**Your files:** `media/my-videos/feature-1.mp4` through `feature-5.mp4`
```powershell
for ($i = 1; $i -le 5; $i++) {
    ffmpeg -i "media/my-videos/feature-$i.mp4" -t 10 `
      -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2, drawtext=text='Feature $i':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=H-100" `
      "videos/carousel-slide-$i.mp4"
}
```

### 7.10 — Reaction to Competitor (Your Face + Screen)
```
/agent ugc-planner
"Reaction script: I'll record my reaction watching competitor CRM vs RealtyFlow."
```
**Your files:** `media/my-videos/my-reaction.mp4`, `media/my-videos/competitor-screen.mp4`
```powershell
# Side-by-side: competitor on left, your reaction on right
ffmpeg -i media/my-videos/competitor-screen.mp4 -i media/my-videos/my-reaction.mp4 `
  -filter_complex "[0:v]scale=540:960[left];[1:v]scale=540:960[right];[left][right]hstack" `
  videos/ugc-reaction.mp4
```

### 7.11 — Time-Lapse of Workday (Your Footage)
```
/agent ugc-planner
"Overlay text for time-lapse of my work day. I'll provide time-lapse footage."
```
**Your file:** `media/my-videos/timelapse.mp4`
```powershell
ffmpeg -i media/my-videos/timelapse.mp4 `
  -vf "drawtext=text='8 AM - Checking Leads':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:x=50:y=50:enable='between(t,0,3)', drawtext=text='10 AM - Site Visits':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:x=50:y=50:enable='between(t,3,6)', drawtext=text='2 PM - Follow-ups':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:x=50:y=50:enable='between(t,6,9)', drawtext=text='5 PM - Closings!':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:x=50:y=50:enable='between(t,9,12)'" `
  videos/ugc-timelapse.mp4
```

### 7.12 — "3 Things I Wish I Knew" (Your Face Cam)
```
/agent ugc-planner
"'3 things I wish I knew before CRM' script. 30s Hinglish, trending format. I'll record."
```
**Agent provides:** Script with exact timestamps for cuts and text overlays

### 7.13 — Stitch/Duet Response (Your Recording)
```
/agent ugc-planner
"Stitch response to: 'CRM is waste of money'. I'll record my debunk. 30s."
```
**Your file:** `media/my-videos/my-response.mp4`
```powershell
# Add "original post" text at top
ffmpeg -i media/my-videos/my-response.mp4 `
  -vf "drawtext=text='Someone said CRM is waste of money...':fontsize=24:fontcolor=red:x=50:y=30:enable='between(t,0,3)'" `
  videos/ugc-stitch-response.mp4
```

### 7.14 — Behind-the-Scenes Office Tour (Your Tour Footage)
```
/agent ugc-planner
"Overlay text for my office tour video showing team using RealtyFlow."
```
**Your file:** `media/my-videos/office-tour.mp4`

### 7.15 — Client Meeting Prep (Your Screen + Face)
```
/agent ugc-planner
"Script: I prep for meeting using CRM. I'll provide screen recording + face cam."
```
**Your files:** `media/my-videos/crm-screen.mp4`, `media/my-videos/face-cam.mp4`
```powershell
# PiP: screen full, face cam in corner
ffmpeg -i media/my-videos/crm-screen.mp4 -i media/my-videos/face-cam.mp4 `
  -filter_complex "[1:v]scale=280:210[pip];[0:v][pip]overlay=W-w-15:15" `
  videos/ugc-meeting-prep.mp4
```

### 7.16 — Weekend Lead Check (Your Phone Recording)
```
/agent ugc-planner
"Casual Reel: Saturday morning checking leads on phone from bed. I'll record."
```
**Your file:** `media/my-videos/weekend-phone.mp4`

### 7.17 — Quick Tips Compilation (5 Your Clips, 5s Each)
```
/agent ugc-planner
"5 CRM tips, 5s each = 25s Reel. I'll provide 5 short clips."
```
**Your files:** `media/my-videos/tip-1.mp4` through `tip-5.mp4`
```powershell
# Trim and concat
for ($i = 1; $i -le 5; $i++) {
    ffmpeg -i "media/my-videos/tip-$i.mp4" -t 5 -vf "scale=1080:1920" "videos/tip-trimmed-$i.mp4"
}
@(1..5 | ForEach-Object { "file 'tip-trimmed-$_.mp4'" }) | Out-File -Encoding ascii tips-list.txt
ffmpeg -f concat -safe 0 -i tips-list.txt -c copy videos/ugc-5-tips.mp4
```

### 7.18 — Client Testimonial Montage (4 Your Client Clips)
```
/agent ugc-planner
"Intro/outro for montage of 4 client testimonials. I'll provide raw clips."
```
**Your files:** `media/my-videos/client-1.mp4` through `client-4.mp4`
```powershell
for ($i = 1; $i -le 4; $i++) { ffmpeg -i "media/my-videos/client-$i.mp4" -t 15 "videos/client-$i-trim.mp4" }
@(1..4 | ForEach-Object { "file 'client-$_-trim.mp4'" }) | Out-File -Encoding ascii clients.txt
ffmpeg -f concat -safe 0 -i clients.txt -c copy videos/ugc-client-montage.mp4
```

### 7.19 — Green Screen Replacement (Your Green Screen Recording)
```
/agent ugc-planner
"Script for green screen video. I'll record in front of green screen. Replace BG with CRM dashboard."
```
**Your files:** `media/my-videos/greenscreen.mp4`, `media/my-screenshots/dashboard.png`
```powershell
ffmpeg -i media/my-videos/greenscreen.mp4 -i media/my-screenshots/dashboard.png `
  -filter_complex "[0:v]chromakey=0x00FF00:0.15:0.1[fg];[1:v][fg]overlay=0:0" `
  videos/ugc-greenscreen.mp4
```

### 7.20 — Full Production: Your Media + Generated Voiceover + Remotion
```
/agent ugc-planner
"Full 60s UGC video. I'll provide: 3 photos, 2 video clips, 1 screen recording.
Write script, generate voiceover, composite everything."
```
**Your files:** Place everything in `media/` folder
**Complete workflow:**
```powershell
# 1. Agent writes script → saves to outreach/scripts/ugc-full-script.txt

# 2. Generate voiceover from script
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -TextFile "marketing-and-sales/outreach/scripts/ugc-full-script.txt" `
  -VoiceId "pNInz6obpgDQGcFmaJgB" -Output "media/my-audio/ugc-voiceover.mp3"

# 3. Copy all media to Remotion public folder
Copy-Item media/my-photos/*.jpg my-video/public/
Copy-Item media/my-videos/*.mp4 my-video/public/
Copy-Item media/my-audio/*.mp3 my-video/public/

# 4. Agent creates Remotion composition combining everything
#    (using <Img src={staticFile("photo.jpg")} />, <Video src={staticFile("clip.mp4")} />,
#     <Audio src={staticFile("voiceover.mp3")} />)

# 5. Render
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...full composition...","durationInFrames":1800,"fps":30}' `
  -Output "videos/ugc-full-production.mp4"

# 6. Final audio mix (voiceover loud + background music quiet)
ffmpeg -i videos/ugc-full-production.mp4 -i media/my-audio/bgm.mp3 `
  -filter_complex "[0:a]volume=1.0[vo];[1:a]volume=0.15[bg];[vo][bg]amix=inputs=2:duration=first" `
  -c:v copy videos/ugc-final.mp4
```

---

## 8. Audio Voiceover, Scene Matching & Lipsync

**Agent:** `orator` | **Skill:** `voiceover-gen`, `whatsapp-outreach`
**Script:** `elevenlabs-tts.ps1`
**Strategy:** Generate voiceovers per scene, match duration to video frames, sync lip movements using audio-driven Remotion animation.

### Audio-Video Sync Workflow
```
1. Write script with [Scene Markers] and timing
2. Generate voiceover per scene (or full script)
3. Get audio duration → calculate frame count (duration × fps)
4. Render video with matched frame count
5. Merge audio + video via FFmpeg
6. For lipsync: use @remotion/media-utils to drive mouth animation from audio amplitude
```

### 8.1 — Full Script Voiceover (Hinglish)
```
/agent orator
"Generate voiceover for 60s product demo. Warm male Indian English voice."
```
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Namaste! Kya aap bhi apne leads Excel mein track karte ho? Ab woh zamaana gaya. RealtyFlow ke saath har lead automatically track hoti hai." `
  -VoiceId "pNInz6obpgDQGcFmaJgB" -Output "media/my-audio/demo-vo.mp3"
```

### 8.2 — Per-Scene Voiceover (Separate Files)
```powershell
$scenes = @(
    @{Name="scene1"; Text="Kya aapke leads bhi kho jaate hain? Har din kitne follow-up miss hote hain?"},
    @{Name="scene2"; Text="Introducing RealtyFlow — India ka sabse smart real estate CRM."},
    @{Name="scene3"; Text="Automatic lead assignment, WhatsApp integration, AI follow-up, aur analytics. Sab ek jagah."},
    @{Name="scene4"; Text="Aaj hi free trial shuru karein. realtyflow.in pe jaayein."}
)
foreach ($s in $scenes) {
    .\claude-skills\scripts\elevenlabs-tts.ps1 `
      -Text $s.Text -VoiceId "pNInz6obpgDQGcFmaJgB" `
      -Output "media/my-audio/$($s.Name).mp3"
}
```

### 8.3 — Match Video Duration to Audio Duration
```powershell
# Get audio duration in seconds
$duration = ffprobe -v error -show_entries format=duration -of csv=p=0 "media/my-audio/demo-vo.mp3"
$frames = [math]::Ceiling([double]$duration * 30)  # 30 fps

# Render video with exactly that many frames
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props "{`"code`":`"...`",`"durationInFrames`":$frames,`"fps`":30}" `
  -Output "videos/demo-matched.mp4"

# Merge audio + video
ffmpeg -i videos/demo-matched.mp4 -i media/my-audio/demo-vo.mp3 `
  -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 videos/demo-with-voice.mp4
```

### 8.4 — Scene-by-Scene Audio-Video Sync
```powershell
# Get each scene's audio duration → set Remotion Sequence durations to match
$sceneDurations = @()
foreach ($file in Get-ChildItem "media/my-audio/scene*.mp3" | Sort-Object Name) {
    $dur = ffprobe -v error -show_entries format=duration -of csv=p=0 $file.FullName
    $sceneDurations += [math]::Ceiling([double]$dur * 30)
}
$totalFrames = ($sceneDurations | Measure-Object -Sum).Sum

# Remotion composition uses sceneDurations to set each <Sequence durationInFrames={...}>
$props = @{ code="..."; fps=30; sceneDurations=$sceneDurations; durationInFrames=$totalFrames } | ConvertTo-Json -Compress
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" -Props $props -Output "videos/synced.mp4"

# Concat scene audios and merge
ffmpeg -i "concat:scene1.mp3|scene2.mp3|scene3.mp3|scene4.mp3" -c copy full-vo.mp3
ffmpeg -i videos/synced.mp4 -i full-vo.mp3 -c:v copy -c:a aac videos/final-synced.mp4
```

### 8.5 — Lipsync (Audio-Driven Mouth Animation in Remotion)
```
/agent motion-engineer
"Create Remotion composition with animated character whose mouth moves based on audio amplitude."
```
**Remotion lipsync code approach:**
```tsx
// Inside composition code:
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { Audio, staticFile, useCurrentFrame } from "remotion";

const audioSrc = staticFile("voiceover.mp3");
const audioData = useAudioData(audioSrc);
const frame = useCurrentFrame();
const visualization = visualizeAudio({
  fps: 30, frame, audioData, numberOfSamples: 16
});
// Amplitude drives mouth opening
const mouthOpen = visualization ? visualization[0] * 50 : 0;

return (
  <>
    <Audio src={audioSrc} />
    {/* Character face with mouth scaled by amplitude */}
    <div style={{
      width: 200, height: 200, borderRadius: '50%', background: '#FFD700',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 60, height: mouthOpen, background: '#333',
        borderRadius: '0 0 30px 30px', transition: 'height 0.05s'
      }} />
    </div>
  </>
);
```
```powershell
Copy-Item "media/my-audio/voiceover.mp3" "my-video/public/voiceover.mp3"
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...lipsync code...","durationInFrames":1800,"fps":30}' `
  -Output "videos/lipsync-character.mp4"
```

### 8.6 — SRT Subtitle Generation + Burn-In
```
/agent orator
"Generate SRT subtitles for demo voiceover. Timestamps every 3-5 words. Hindi + English."
```
**Agent generates `subs.srt`:**
```
1
00:00:00,000 --> 00:00:03,000
Namaste! Kya aap bhi

2
00:00:03,000 --> 00:00:06,000
apne leads Excel mein track karte ho?
```
```powershell
ffmpeg -i videos/demo-final.mp4 `
  -vf "subtitles=subs.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF'" `
  videos/demo-subtitled.mp4
```

### 8.7 — Multi-Language Voiceovers (Hindi, English, Marathi)
```powershell
$langs = @(
    @{L="english"; Text="Are you still tracking leads in Excel?"; Voice="english-voice-id"},
    @{L="hindi"; Text="Kya aap abhi bhi leads Excel mein track karte hain?"; Voice="hindi-voice-id"},
    @{L="marathi"; Text="Tumhi ajunhi leads Excel madhe track kartat ka?"; Voice="marathi-voice-id"}
)
foreach ($l in $langs) {
    .\claude-skills\scripts\elevenlabs-tts.ps1 -Text $l.Text -VoiceId $l.Voice `
      -Output "media/my-audio/vo-$($l.L).mp3"
}
# Then merge each VO with the same video for 3 language versions
```

### 8.8 — Voice Cloning for Brand Consistency
```
/agent orator
"Use ElevenLabs voice cloning. Record 1-3 min clean audio of founder reading a script."
```
**Steps:**
1. Record → Upload to ElevenLabs → Voices → Add Voice → Instant Clone
2. Get new voice ID
3. Use forever:
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 -Text "any script" -VoiceId "cloned-id" -Output "vo.mp3"
```

### 8.9 — WhatsApp Voice Message (Casual Tone)
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Bhai, maine tumhare liye ek CRM dhundha hai jo sach mein kaam karta hai. Ek baar try karo." `
  -VoiceId "casual-male-voice" -Stability 0.3 -SimilarityBoost 0.8 `
  -Output "media/my-audio/whatsapp-casual.mp3"
# Lower stability = more natural conversational style
```

### 8.10 — Background Music Mixing
```powershell
ffmpeg -i media/my-audio/voiceover.mp3 -i media/my-audio/bgm.mp3 `
  -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first" `
  media/my-audio/vo-with-bgm.mp3
```

### 8.11 — Audio Normalization (Batch)
```powershell
foreach ($file in Get-ChildItem "media/my-audio/scene*.mp3") {
    ffmpeg -i $file.FullName -af "loudnorm=I=-16:TP=-1.5:LRA=11" "media/my-audio/norm/$($file.Name)"
}
```

### 8.12 — Detect Silence for Scene Breaks
```powershell
ffmpeg -i media/my-audio/full-voiceover.mp3 -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1 | Select-String "silence_end"
# Output: timestamps where silence ends → use as scene break points in Remotion
```

### 8.13 — Speed Up/Slow Down to Match Scene Duration
```powershell
# Speed up VO to fit 10-second scene (no pitch change)
ffmpeg -i media/my-audio/scene1.mp3 -filter:a "atempo=1.2" media/my-audio/scene1-faster.mp3
# Slow down
ffmpeg -i media/my-audio/scene1.mp3 -filter:a "atempo=0.85" media/my-audio/scene1-slower.mp3
```

### 8.14 — Energetic Reel Voiceover
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Ek CRM jo real estate agents ke liye bana hai! Lead aaye, automatic assign ho, AI reply kare!" `
  -VoiceId "energetic-voice" -Stability 0.25 -SimilarityBoost 0.9 -Speed 1.1 `
  -Output "media/my-audio/reel-vo.mp3"
```

### 8.15 — List Available ElevenLabs Voices
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 -ListVoices
# Displays all voice IDs, names, accents, preview URLs
```

### 8.16 — Generate from Text File (Long Scripts)
```powershell
"Yeh hai RealtyFlow ka complete walkthrough..." | Out-File -Encoding utf8 script.txt
.\claude-skills\scripts\elevenlabs-tts.ps1 -TextFile "script.txt" -VoiceId "id" -Output "vo.mp3"
```

### 8.17 — Complete Pipeline: VO → Match Video → Subtitles
```powershell
# 1. Generate voiceover
.\claude-skills\scripts\elevenlabs-tts.ps1 -Text "your script" -VoiceId "id" -Output "vo.mp3"

# 2. Calculate frames from audio duration
$dur = ffprobe -v error -show_entries format=duration -of csv=p=0 vo.mp3
$frames = [math]::Ceiling([double]$dur * 30)

# 3. Render video matched to audio
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props "{`"code`":`"...`",`"durationInFrames`":$frames,`"fps`":30}" -Output "video.mp4"

# 4. Merge audio + video
ffmpeg -i video.mp4 -i vo.mp3 -c:v copy -c:a aac merged.mp4

# 5. Burn subtitles
ffmpeg -i merged.mp4 -vf "subtitles=subs.srt" final.mp4
```

### 8.18 — Batch Voiceover for Email Outreach Sequences
```powershell
$emails = @(
    @{N="intro"; T="Hi, main RealtyFlow se bol raha hun. Aapke liye ek special offer hai."},
    @{N="followup1"; T="Aapne hamare demo ka time decide kiya? Abhi book karein."},
    @{N="followup2"; T="Last chance — free trial kal expire ho raha hai. Miss mat karein."}
)
foreach ($e in $emails) {
    .\claude-skills\scripts\elevenlabs-tts.ps1 -Text $e.T -VoiceId "pro-voice" `
      -Output "media/my-audio/email-$($e.N).mp3"
}
```

### 8.19 — Audio Fade In/Out
```powershell
ffmpeg -i media/my-audio/voiceover.mp3 `
  -af "afade=t=in:st=0:d=1,afade=t=out:st=58:d=2" `
  media/my-audio/vo-faded.mp3
```

### 8.20 — Full Audio Production: VO + Music + SFX + Normalize
```powershell
# 1. Generate VO
.\claude-skills\scripts\elevenlabs-tts.ps1 -Text "..." -VoiceId "id" -Output "vo.mp3"

# 2. Normalize
ffmpeg -i vo.mp3 -af "loudnorm=I=-16:TP=-1.5" vo-norm.mp3

# 3. Fade in/out
ffmpeg -i vo-norm.mp3 -af "afade=t=in:d=0.5,afade=t=out:st=55:d=2" vo-faded.mp3

# 4. Mix with background music at 10%
ffmpeg -i vo-faded.mp3 -i bgm.mp3 `
  -filter_complex "[1:a]volume=0.10[m];[0:a][m]amix=inputs=2:duration=first" mixed.mp3

# 5. Add SFX (notification ding at 5 seconds)
ffmpeg -i mixed.mp3 -i sfx-ding.mp3 `
  -filter_complex "[1:a]adelay=5000|5000[sfx];[0:a][sfx]amix=inputs=2:duration=first" final-audio.mp3

# 6. Merge with video
ffmpeg -i video.mp4 -i final-audio.mp3 -c:v copy -c:a aac final-video.mp4
```

---

*Continue to [Part 4](./CLAUDESKILLSUSAGE-PART4.md) for Meta Ads & Multi-Platform Outreach*
