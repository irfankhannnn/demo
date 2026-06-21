# RealtyFlow Marketing Automation System
**Master Guide — Read This First**

---

## What This System Does

This is a complete, brand-consistent marketing automation system for **RealtyFlow** (Cloudberry CRM for Indian real estate agents). It lets you generate any type of content, publish it to social media, and run paid ads — all from within Claude Code.

```
.brand/brand-kit.md          ← Brand identity (colors, fonts, tone)
.brand/positioning.md        ← ICP, personas, messaging strategy
        │
        ▼
┌──────────────────────────────────────────────────────┐
│              CONTENT GENERATION                      │
│  Higgsfield MCP → images, banners, videos            │
│  nano-banana-pro → Gemini 3 Pro images               │
│  marketingskills → copy, captions, ad creative       │
│  voiceover-gen → ElevenLabs TTS                      │
│  landing-page → HTML pages with Hinglish copy        │
└──────────────────────────┬───────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────┐               ┌──────────────────────┐
│  SOCIAL PUBLISH  │               │    PAID ADS          │
│  Manual upload   │               │    Meta Ads MCP      │
│  (Meta Business  │               │    FB + IG campaigns │
│  Suite + apps)   │               │    CAPI, audiences   │
└──────────────────┘               └──────────────────────┘
```

---

## Quick-Start: Your First Content Piece

**Generate a Facebook ad banner in 3 messages:**

```
Message 1:
"Read .brand/brand-kit.md and .brand/positioning.md, then use Higgsfield 
to generate a 1200x628 Facebook ad banner for RealtyFlow targeting Rajesh 
Bhai (agency owner, Mumbai). Pain point: can't track which agent is 
following up which lead. Use blue #2563EB as dominant color."

Message 2:
"Now use ad-creative skill to write 3 headline + body copy variants for 
this banner targeting agency owners. Hinglish tone."

Message 3:
"Save the banner to marketing/assets/images/fb-ad-rajesh-01.png and the 
copy to marketing/posts/facebook/fb-ad-rajesh-01.md"
```

---

## Documentation Index

| Doc | What It Covers |
|-----|----------------|
| [01-AUTHENTICATION.md](docs/01-AUTHENTICATION.md) | Connect Higgsfield, Meta Ads (do this first) |
| [02-IMAGE-GENERATION.md](docs/02-IMAGE-GENERATION.md) | Generate images, banners, ad creatives |
| [03-VIDEO-GENERATION.md](docs/03-VIDEO-GENERATION.md) | Create video ads, reels, explainers |
| [04-SOCIAL-PUBLISHING.md](docs/04-SOCIAL-PUBLISHING.md) | Schedule and publish to IG, FB, LinkedIn |
| [05-META-ADS.md](docs/05-META-ADS.md) | Create and manage Facebook/Instagram ad campaigns |
| [06-FULL-PIPELINE.md](docs/06-FULL-PIPELINE.md) | End-to-end pipeline: content → publish → ads → monitor |

---

## Content Type Reference

| Content Type | Primary Tool | Output Path | Time to Generate |
|---|---|---|---|
| Facebook ad banner (1200x628) | Higgsfield (Nano Banana Pro) | `marketing/assets/images/` | ~30 sec |
| Instagram post (1080x1080) | Higgsfield (Nano Banana Pro) | `marketing/assets/images/` | ~30 sec |
| Instagram Reel (1080x1920) | Higgsfield (Kling 3.0 / Veo 3.1) | `marketing/assets/videos/` | 2-5 min |
| Facebook video ad (16:9) | Higgsfield (Veo 3.1) | `marketing/assets/videos/` | 2-5 min |
| Landing page (HTML) | landing-page skill | `marketing/content/landing-pages/` | 1-2 min |
| Blog post (SEO) | seo-blog skill | `marketing/content/blog/` | 1-2 min |
| Email sequence | email-sequence skill | `marketing/content/emails/` | 1-2 min |
| Ad copy (headline+body) | ad-creative skill | `marketing/posts/` | <1 min |
| Social caption + hashtags | social-content skill | `marketing/posts/` | <1 min |
| Voiceover (MP3) | voiceover-gen skill | `marketing/assets/audio/` | ~1 min |

---

## Brand Quick Reference

```
Product:    RealtyFlow
Tagline:    "Agency ki Growth, Aapke Control Mein"
Primary:    #2563EB (Royal Blue)
Secondary:  #10B981 (Emerald Green)
Accent:     #F59E0B (Amber)
Font:       Inter (Bold headlines, Regular body)
Language:   Hinglish — 70% English + 30% Hindi romanized
Audience:   Indian real estate agents, Mumbai/Pune focus
```

### Key Hinglish Phrases to Include
- Pain: "WhatsApp mein leads dhundh rahe ho?"
- Pain: "Excel mein CRM chala rahe ho? Bhai, 2026 aa gaya"
- Solution: "Sab ek jagah — leads, follow-ups, properties, team"
- CTA: "Free Trial Shuru Karo →"
- CTA: "Demo Dekho (2 min)"

---

## Campaign Themes

Use these when briefing any content generation:

| Theme | Hook | Audience |
|---|---|---|
| Stop the Chaos | "Yeh WhatsApp wala CRM system nahi hai yaar" | Agents drowning in WhatsApp |
| Speed Wins Deals | "Competitor ne pehle call kar liya..." | Competitive agents |
| Your Team, Your Rules | "Pata nahi team kya kar rahi hai? Ab sab dikh sakta hai" | Agency owners |
| Grow Without Chaos | "10 agents manage kar sakte ho. 100 agents? System chahiye." | Growing agencies |

---

## Output Directory Map

```
marketing/
├── MARKETING_SYSTEM.md     ← you are here
├── docs/                   ← detailed guides
├── campaigns/              ← campaign plans + configs
│   └── [campaign-name]/
│       ├── brief.md
│       ├── assets/
│       └── results.md
├── assets/
│   ├── images/             ← generated banners + graphics
│   ├── videos/             ← generated video ads
│   └── audio/              ← voiceovers
├── posts/
│   ├── instagram/          ← caption + asset per post
│   ├── facebook/           ← copy + creative per post
│   └── linkedin/           ← professional copy per post
├── content/
│   ├── blog/               ← SEO articles
│   ├── landing-pages/      ← HTML pages
│   └── emails/             ← email sequences
└── reports/                ← analytics + performance
```
