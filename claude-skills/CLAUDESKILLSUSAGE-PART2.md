# Claude Skills Usage Guide — Part 2: Video Creation

> Sections 5-6. See [Part 1](./CLAUDESKILLSUSAGE.md) for Sections 1-4, [Part 3](./CLAUDESKILLSUSAGE-PART3.md) for Sections 7-8, [Part 4](./CLAUDESKILLSUSAGE-PART4.md) for Sections 9-13.

---

## 5. Video Creation — Product Demos

**Agent:** `motion-engineer` | **Skill:** `remotion-video`, `video-production`
**Script:** `render-remotion.ps1` | **Project:** `my-video/` (uses `DynamicComp` composition)

**How It Works:**
1. Agent writes React code for video scenes (using `Sequence`, `useCurrentFrame()`, `interpolate()`, `spring()`)
2. Code passed as `code` prop to DynamicComp → compiles and renders at runtime
3. Output: MP4 at any resolution/fps

### 5.1 — 60-Second Product Demo
```
/agent motion-engineer
"Create 60s product demo: Scene 1 (10s) Problem, Scene 2 (10s) Solution intro,
Scene 3 (30s) 3 features, Scene 4 (10s) CTA. Generate Remotion code and render."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1800,"fps":30}' `
  -Width 1920 -Height 1080 -Output "videos/product-demo-60s.mp4"
# Add voiceover
ffmpeg -i product-demo-60s.mp4 -i voiceover.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 product-demo-final.mp4
```

### 5.2 — Feature Walkthrough: Lead Management
```
/agent motion-engineer
"45s animated walkthrough: add lead → auto-assign → follow-up reminder → lead scoring. Animated cursor."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1350,"fps":30}' -Output "videos/feature-lead-mgmt.mp4"
```

### 5.3 — Feature Walkthrough: WhatsApp Integration
```
/agent motion-engineer
"30s split-screen: phone (left) + dashboard (right). Notification → auto-reply → agent takes over → deal closed."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Width 1080 -Height 1080 -Output "videos/feature-whatsapp.mp4"
```

### 5.4 — Feature Walkthrough: AI Follow-Up
```
/agent motion-engineer
"40s timeline animation: Lead in → AI message → 24h wait → Follow-up → Agent notified → Deal closed."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1200,"fps":30}' -Output "videos/feature-ai-followup.mp4"
```

### 5.5 — Feature Walkthrough: Analytics Dashboard
```
/agent motion-engineer
"35s: animated charts growing, numbers counting up, KPI cards flipping. Use spring() animations."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1050,"fps":30}' -Output "videos/feature-analytics.mp4"
```

### 5.6 — Feature Walkthrough: Site Visit Tracker
```
/agent motion-engineer
"30s: schedule visit → reminder → check in → upload photos → client updated. Map + calendar animation."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/feature-site-visit.mp4"
```

### 5.7 — Full Platform Overview (2 min)
```
/agent motion-engineer
"2-min overview: 8 sections with title cards. Intro → Dashboard → Leads → WhatsApp → AI → Analytics → Pricing → CTA."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":3600,"fps":30}' -Output "videos/platform-overview-2min.mp4"
```

### 5.8 — Before/After Split-Screen
```
/agent motion-engineer
"30s split: Left 'Without CRM' (messy spreadsheet), Right 'With RealtyFlow' (clean dashboard). Simultaneous actions."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/before-after.mp4"
```

### 5.9 — Onboarding Tutorial (3 min)
```
/agent motion-engineer
"3-min tutorial: Sign up → Import leads → Set up pipeline → Connect WhatsApp → First follow-up. Progress bar."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":5400,"fps":30}' -Output "videos/onboarding-tutorial.mp4"
```

### 5.10 — Mobile App Demo (Vertical 9:16)
```
/agent motion-engineer
"30s vertical (9:16) for Reels. Phone frame, finger taps, swipe gestures, notifications."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Width 1080 -Height 1920 -Output "videos/mobile-demo-reel.mp4"
```

### 5.11 — Integration Demo: 99acres
```
/agent motion-engineer
"25s: Lead on 99acres → auto-import to CRM → notification → WhatsApp reply. Data flow arrows."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":750,"fps":30}' -Output "videos/integration-99acres.mp4"
```

### 5.12 — Speed Comparison Race
```
/agent motion-engineer
"30s race: Manual vs RealtyFlow. Timer counts up, tasks complete side by side. RealtyFlow finishes 3x faster."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/speed-comparison.mp4"
```

### 5.13 — Animated Logo Intro + Outro (5s each)
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...logo particles...","durationInFrames":150,"fps":30}' -Output "videos/logo-intro.mp4"
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...outro fade...","durationInFrames":150,"fps":30}' -Output "videos/logo-outro.mp4"
```

### 5.14 — Still Frame / Thumbnail from Video
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1800,"fps":30}' `
  -Still -Frame 450 -Output "images/demo-thumbnail.png"
```

### 5.15 — Success Story Animation
```
/agent motion-engineer
"45s: 'Agent Sharma's Journey'. Month 1: 10 leads → Month 3: 50 → Month 6: 200. Growing graph + confetti."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1350,"fps":30}' -Output "videos/success-story.mp4"
```

### 5.16 — Pricing Explainer
```
/agent motion-engineer
"30s: pricing cards slide in, features check off, 'Popular' badge bounces, CTA pulses."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/pricing-explainer.mp4"
```

### 5.17 — Cloud Render via Lambda
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1800,"fps":30}' -Output "videos/demo-cloud.mp4" -Cloud
# ~30 seconds vs ~5 min local. Needs REMOTION_AWS_ACCESS_KEY_ID + SECRET.
```

### 5.18 — GIF Preview for Email
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":150,"fps":15}' -Output "videos/preview.mp4"
ffmpeg -i preview.mp4 -vf "fps=10,scale=480:-1:flags=lanczos" -loop 0 preview.gif
```

### 5.19 — Concatenate Intro + Demo + Outro
```powershell
@("file 'logo-intro.mp4'","file 'product-demo.mp4'","file 'logo-outro.mp4'") | Out-File -Encoding ascii list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy product-demo-branded.mp4
```

### 5.20 — Batch Render All Feature Videos
```powershell
$features = @("lead-mgmt","whatsapp","ai-followup","analytics","site-visit")
foreach ($f in $features) {
    .\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
      -Props "{`"code`":`"...$f code...`",`"durationInFrames`":900,`"fps`":30}" `
      -Output "videos/feature-$f.mp4"
}
```

---

## 6. Video Creation — Product Launch & Feature Explainers

**Agent:** `motion-engineer` + `ugc-planner` | **Skill:** `remotion-video`, `ugc-scripts`

### 6.1 — Launch Teaser (15s)
```
/agent motion-engineer
"15s teaser: Dark → text letter-by-letter 'Something Big Is Coming' → logo reveal → date → CTA."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...typewriter...","durationInFrames":450,"fps":30}' `
  -Width 1080 -Height 1920 -Output "videos/launch-teaser.mp4"
```

### 6.2 — Launch Full Video (90s)
```
/agent motion-engineer
"90s: Problem montage (10s) → 'Introducing RealtyFlow' (5s) → 5 features (10s each) → Pricing (5s) → CTA (10s) → Outro (5s)."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":2700,"fps":30}' -Output "videos/product-launch-90s.mp4"
```

### 6.3 — "How It Works": Lead Capture Flow
```
/agent motion-engineer
"45s flowchart: Form filled → Auto-imported → AI assigns agent → Follow-up starts. Animated flow arrows."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1350,"fps":30}' -Output "videos/how-lead-capture.mp4"
```

### 6.4 — "How It Works": Property Matching
```
/agent motion-engineer
"40s: Buyer requirements → AI matches properties → Agent notified → One-click share via WhatsApp."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1200,"fps":30}' -Output "videos/how-matching.mp4"
```

### 6.5 — "How It Works": Deal Pipeline
```
/agent motion-engineer
"35s Kanban: Cards animate through stages: New → Qualified → Site Visit → Negotiation → Closed Won. Confetti at end."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1050,"fps":30}' -Output "videos/how-pipeline.mp4"
```

### 6.6 — "How It Works": AI Auto-Reply
```
/agent motion-engineer
"30s: Lead messages 2 AM → AI analyzes → Personalized reply → Agent sees summary next morning."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/how-auto-reply.mp4"
```

### 6.7 — "How It Works": Reporting
```
/agent motion-engineer
"30s: Data flows in → Dashboard assembles → Charts animate → Report auto-generates → Email to manager."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/how-reporting.mp4"
```

### 6.8 — 5 Instagram Reels (Feature Spotlights)
```powershell
$reels = @("LeadMgmt","WhatsApp","AIFollowUp","Analytics","SiteVisit")
foreach ($r in $reels) {
    .\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
      -Props "{`"code`":`"...$r...`",`"durationInFrames`":900,`"fps`":30}" `
      -Width 1080 -Height 1920 -Output "videos/reel-$r.mp4"
}
```

### 6.9 — Countdown Feature Reveal (20s)
```
/agent motion-engineer
"20s: 3-2-1 countdown → Feature name reveals → Quick demo → 'Update Now' CTA."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":600,"fps":30}' -Output "videos/feature-reveal.mp4"
```

### 6.10 — Day-in-Life Comparison (60s)
```
/agent motion-engineer
"60s: Morning/Noon/Evening comparison. Manual agent vs RealtyFlow agent side-by-side through the day."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1800,"fps":30}' -Output "videos/day-comparison.mp4"
```

### 6.11 — Roadmap Video (45s)
```
/agent motion-engineer
"45s: Timeline with milestones: Q1 (launched), Q2 (WhatsApp), Q3 (AI), Q4 (Dubai). Cards flip."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1350,"fps":30}' -Output "videos/roadmap.mp4"
```

### 6.12 — "How It Works": Team Collaboration
```
/agent motion-engineer
"30s: Manager assigns → Team members see leads → Activity feed → Performance dashboard."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/how-team-collab.mp4"
```

### 6.13 — Testimonial Video Template
```
/agent motion-engineer
"15s template: Photo placeholder → Quote text animates → Metric cards → Name + city."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":450,"fps":30}' -Output "videos/testimonial-template.mp4"
```

### 6.14 — Animated FAQ (60s)
```
/agent motion-engineer
"60s: Top 5 FAQs. Question slides in → Answer appears → Next. Q&A card format."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":1800,"fps":30}' -Output "videos/faq-animated.mp4"
```

### 6.15 — "How It Works": Document Management
```
/agent motion-engineer
"25s: Upload docs → Auto-tagged → Secure storage → Client portal → E-signature."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":750,"fps":30}' -Output "videos/how-docs.mp4"
```

### 6.16 — Mini Tour for Stories (15s vertical)
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":450,"fps":30}' `
  -Width 1080 -Height 1920 -Output "videos/mini-tour-story.mp4"
```

### 6.17 — "What's New" Monthly Update (30s)
```
/agent motion-engineer
"30s: 'This Month in RealtyFlow' → 3 new features, quick animations → Try it now."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":900,"fps":30}' -Output "videos/whats-new.mp4"
```

### 6.18 — Webinar Promo (20s)
```
/agent motion-engineer
"20s: 'Free Webinar' → Topic → Date/Time → Speaker photo → 'Register Now' CTA."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":600,"fps":30}' -Output "videos/webinar-promo.mp4"
```

### 6.19 — Training: How to Import Leads (2 min)
```
/agent motion-engineer
"2-min training: step-by-step import leads from Excel. Screen recording style, animated cursor, step numbers."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":3600,"fps":30}' -Output "videos/training-import.mp4"
```

### 6.20 — Year-in-Review (90s)
```
/agent motion-engineer
"90s: Metrics counting up, milestone timeline, customer quotes, 'Thank you' ending."
```
```powershell
.\claude-skills\scripts\render-remotion.ps1 -Composition "DynamicComp" `
  -Props '{"code":"...","durationInFrames":2700,"fps":30}' -Output "videos/year-review.mp4"
```

---

*Continue to [Part 3](./CLAUDESKILLSUSAGE-PART3.md) for UGC Videos & Audio/Voiceover/Lipsync*
