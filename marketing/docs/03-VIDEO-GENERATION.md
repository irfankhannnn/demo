# Video Generation Guide

Create video ads, Instagram Reels, demo videos, and explainers using Higgsfield MCP.

---

## Video Models Available

| Model | Best For | Max Length | Aspect Ratios |
|-------|----------|------------|---------------|
| **Veo 3.1** | Cinematic quality, product demos | 60s | 16:9, 9:16, 1:1 |
| **Kling 3.0** | Realistic motion, human scenes | 30s | 9:16, 16:9, 1:1 |
| **Sora 2** | Creative, stylized videos | 60s | 16:9, 9:16 |
| **Soul 2.0** | Portrait/talking head videos | 30s | 9:16 |
| **Seedance 2.0** | Dance/motion, social content | 15s | 9:16 |
| **Cinema Studio** | Cinematic B-roll, storytelling | 60s | 16:9 |

**Recommendation by content type:**
- Instagram Reels → Kling 3.0 (9:16, realistic)
- Facebook video ads → Veo 3.1 (16:9, cinematic)
- Talking head / UGC style → Soul 2.0 (9:16)
- Demo/product → Veo 3.1 (16:9)

---

## Platform Specifications

| Platform | Format | Dimensions | Duration | Notes |
|----------|--------|------------|---------|-------|
| Instagram Reel | MP4 | 1080×1920 | 15-90s | 9:16 required |
| Instagram Story Ad | MP4 | 1080×1920 | max 15s | 9:16 |
| Facebook Video Ad | MP4 | 1280×720 | 15-60s | 16:9 recommended |
| Facebook Story | MP4 | 1080×1920 | max 15s | 9:16 |
| YouTube Ad | MP4 | 1920×1080 | 15-60s | 16:9 |
| LinkedIn | MP4 | 1920×1080 | 30s-10min | 16:9 |

---

## Example 1: Instagram Reel — "Before/After" (30 seconds)

**Step 1: Generate the video**
```
Use Higgsfield (Kling 3.0) to generate a 30-second vertical video (1080x1920, 9:16):

Scene 1 (0-8s): BEFORE
Indian real estate agent (male, 30s) at a cluttered desk.
Multiple phones buzzing, WhatsApp notifications flooding in.
Frustrated expression, shuffling through papers.
Warm but chaotic lighting. Hindi text overlay: "Pehle..."

Scene 2 (8-20s): DURING TRANSITION
Same agent picking up phone. Opens a clean blue app (CRM dashboard).
Calm, focused expression. Text: "Phir RealtyFlow mila..."
Smooth camera push-in on the phone screen.

Scene 3 (20-30s): AFTER
Agent smiling, confident. Clean organized desk.
Screen shows green "Lead Closed" notification.
Mumbai skyline through window. 
Text overlay: "Ab har lead track hoti hai. Automatic."
CTA: "Free Trial Shuru Karo →"

Style: Cinematic, warm color grading, real Indian office setting.
No stock footage feel. Handheld camera movement.

Save to: marketing/assets/videos/ig-reel-before-after-01.mp4
```

**Step 2: Add voiceover**
```
Use voiceover-gen skill to create a 30-second Hindi voiceover for this video.

Script:
"Ek time tha jab mera din sirf WhatsApp aur Excel mein beet jaata tha.
Leads kahin, follow-ups kahin, team kahin aur.
Phir RealtyFlow mila.
Ek app mein sab kuch — leads, follow-ups, properties, team.
Ab koi lead nahi chhooti. Koi deal haath se nahi nikalti.
RealtyFlow — Agency ki Growth, Aapke Control Mein.
Aaj hi free trial shuru karo."

Voice: Male, confident, casual Hindi (Mumbai accent)
Emotion: Frustrated → relieved → confident
ElevenLabs voice: "Raj" or similar Indian male voice

Save to: marketing/assets/audio/ig-reel-before-after-vo.mp3
```

---

## Example 2: Facebook Video Ad — "Speed Wins Deals" (15 seconds)

```
Use Higgsfield (Veo 3.1) to generate a 15-second horizontal video (1280x720, 16:9):

Scene 1 (0-5s): HOOK
Split screen: Two agents side by side.
Left agent: Scrambling through phone, searching WhatsApp.
Right agent: Opens RealtyFlow, one tap, calls client instantly.
Text: "Jo pehle call karta hai, wo deal jeet ta hai."

Scene 2 (5-12s): PROBLEM + SOLUTION
Left agent: Client's phone goes to another agent.
Right agent: Handshake, deal closed. Confident smile.
Text: "RealtyFlow — follow-up automatic, deal fast."

Scene 3 (12-15s): CTA
RealtyFlow app on phone, blue #2563EB branding.
Text: "Free mein shuru karo. realtyflow.in"

Style: Dynamic, fast cuts, punchy. Corporate but relatable.
Color grade: Slightly cool on left (loser), warm on right (winner).

Save to: marketing/assets/videos/fb-ad-speed-15s-01.mp4
```

---

## Example 3: UGC-Style Talking Head (Instagram Reel, 45s)

This creates authentic user-testimonial-style content using Soul 2.0 or Kling 3.0:

```
Use Higgsfield (Soul 2.0) to generate a 45-second vertical talking-head video (9:16):

Concept: Indian real estate agent speaking directly to camera, casual.
Setting: Modern apartment or office background, natural lighting.
Person: Male, 28-35, professional but approachable. Mumbai/Pune vibe.
Camera: Close selfie-style, slight handheld movement.

Script beats:
0-5s HOOK: "Yaar, mujhe batao — tum abhi bhi Excel mein leads track kar rahe ho?"
[Raised eyebrow, direct to camera, slight smile]

5-15s PROBLEM: "Main bhi yehi karta tha. 200 leads, 10 WhatsApp groups, 
3 spreadsheets. Aur phir bhi deals miss ho jaati thein."
[Frustrated expression, head shake]

15-30s SOLUTION: "Phir ek bande ne bola — RealtyFlow try kar. 
Mujhe nahi pata tha ke itna easy hoga. Sab ek jagah. 
Follow-up automatic. Team sab dekh sakti hai."
[Scrolling phone, showing satisfaction]

30-40s RESULT: "Pehle mahine mein hi 3 extra deals close kiye. 
Bina kisi extra effort ke."
[Big smile, thumbs up]

40-45s CTA: "Try karo bhai. Link neeche hai. Free hai."
[Points down, winks]

Subtitle overlays throughout in white text.
Style: Authentic, NOT polished. Real human feel.

Save to: marketing/assets/videos/ig-reel-ugc-testimonial-01.mp4
```

---

## Example 4: Product Demo Video (YouTube/LinkedIn, 60s)

```
Use Higgsfield (Cinema Studio) to generate a 60-second cinematic demo video (1920x1080, 16:9):

Intro (0-10s):
Aerial shot of Mumbai cityline at golden hour.
Text overlay: "Hazaaron real estate agents ki ek kahani hai..."
Music: Subtle, modern, aspirational

Problem sequence (10-25s):
Series of quick shots:
- Phone screen: 50+ unread WhatsApp messages
- Laptop: Messy Excel spreadsheet with colored cells
- Agent on phone looking stressed
- Post-it notes everywhere
Text: "Aapka din kuch aisa dikhta hai?"

Solution reveal (25-45s):
Clean phone screen showing RealtyFlow dashboard
Smooth scrolling through: lead list, follow-up reminders, pipeline view
Each feature highlighted with blue (#2563EB) callout animations
Text overlays for each feature: 
  "Sab leads ek jagah"
  "Follow-up automatic"
  "Team kya kar rahi hai — live dekho"
  "Deals track karo, reports ek click mein"

Close (45-60s):
Agent smiling, confident, closing a deal on phone
Cut to RealtyFlow logo on white background
Tagline: "Agency ki Growth, Aapke Control Mein"
CTA: "Free Trial — realtyflow.in"

Voice: Professional male voiceover throughout (Hinglish)
Style: Premium SaaS product launch video

Save to: marketing/assets/videos/product-demo-60s-01.mp4
```

---

## Adding Voiceover to Any Video

After generating video, add voiceover:

```
Use voiceover-gen skill to create a voiceover for [video name].

Script: [your script here]
Language: Hinglish (mix of Hindi and English)
Voice type: [Male/Female], [age range], [tone: professional/casual/excited]
Duration: Match video length ([X] seconds)
ElevenLabs model: eleven_multilingual_v2

Save to: marketing/assets/audio/[video-name]-vo.mp3
```

Then combine in description for the editor or Remotion:
```
Combine marketing/assets/videos/[video].mp4 with 
marketing/assets/audio/[vo].mp3 using FFmpeg.
Save final to: marketing/assets/videos/[video]-final.mp4
```

---

## Prompt Tips for Better Videos

**For realistic Indian scenes:**
- "Mumbai suburban office, 2025"
- "Indian real estate agency, modern but not fancy"
- "Natural lighting, not studio-lit"
- Avoid "businessman" — use "real estate agent", "property broker"

**For product UI in video:**
- "Phone showing a clean blue CRM dashboard (RealtyFlow)"
- "Screen recording style of modern property management app"
- Don't ask for specific UI — Higgsfield generates placeholder UI that looks professional

**For UGC/authentic feel:**
- "Selfie camera angle, slight movement"
- "Natural background, casual setting"
- "NOT polished, NOT studio quality"
- "Like a real person filmed this on their phone"

**For cinematic quality:**
- "Cinema Studio model, 4K, cinematic color grade"
- "Golden hour lighting, lens flare, bokeh background"
- "Professional color grading, warm tones"
