# RealtyFlow Marketing System — Usage Guide for Claude Cowork

## What This Is

A complete marketing system with 13 specialized skills that turn Claude Cowork into a full marketing team for RealtyFlow. Each skill handles a specific marketing function — from branding to lead scraping to ad management.

## Quick Start

### Step 1: Run Setup

Tell Claude: **"Run the setup script at cowork-skills/setup.sh"**

This installs all 13 skills and creates output directories.

### Step 2: Start Using Skills

Just describe what you need in natural language. Claude will automatically use the right skill.

## The 13 Skills

### Content & Brand

| Skill | What to Ask For | Example Prompt |
|-------|----------------|----------------|
| **Brand Strategy** | Brand manifesto, taglines, tone guide, messaging | "Create a brand manifesto for RealtyFlow's Mumbai launch in Hinglish" |
| **Landing Page** | HTML lead-gen pages with forms | "Build a landing page for RealtyFlow targeting Pune real estate agents" |
| **SEO Blog** | Articles, keyword research, editorial calendar | "Write a 1200-word SEO article: 'Best Real Estate CRM India 2025'" |
| **Image Generation** | AI banners, social posts, ads | "Generate a Facebook ad banner for RealtyFlow using DALL-E" |

### Video & Audio

| Skill | What to Ask For | Example Prompt |
|-------|----------------|----------------|
| **Video Production** | Remotion videos, demos, Reels | "Create a 60-second product demo video for RealtyFlow" |
| **UGC Scripts** | Authentic ad scripts, creator briefs | "Write a 30-second UGC script using PAS framework in Hinglish" |
| **Voiceover Gen** | ElevenLabs TTS, subtitles, audio mixing | "Generate a Hinglish voiceover for our product demo" |

### Ads & Outreach

| Skill | What to Ask For | Example Prompt |
|-------|----------------|----------------|
| **Meta Ads** | FB/IG campaign setup, A/B testing | "Create a lead gen campaign for Mumbai with ₹2000/day budget" |
| **Outreach** | Email, WhatsApp, LinkedIn, cold call sequences | "Write a 5-email cold outreach sequence for Mumbai agents" |

### Data & Pipeline

| Skill | What to Ask For | Example Prompt |
|-------|----------------|----------------|
| **Lead Scraping** | Google Maps scraping, enrichment, scoring | "Scrape real estate agencies in Mumbai from Google Maps" |
| **Pipeline Tracker** | Lead management, stage updates, reports | "Show me a pipeline summary of all leads" |
| **Market Research** | Trends, ICP, competitor analysis, predictions | "Create an ICP analysis for Indian real estate agencies" |

### Orchestrator

| Skill | What to Ask For | Example Prompt |
|-------|----------------|----------------|
| **Marketing Orchestrator** | Full campaigns, multi-phase workflows | "Plan a complete Mumbai launch campaign across all channels" |

## Campaign Workflows (Copy-Paste Prompts)

### Full City Launch (Mumbai)

Use these prompts in sequence:

**Phase 1 — Research (Day 1)**
```
"Do market research on the Mumbai real estate agent market. Create an ICP analysis
and competitor positioning for RealtyFlow."
```

**Phase 2 — Brand (Day 2)**
```
"Create a brand manifesto, 5 taglines, and a tone-of-voice guide for RealtyFlow's
Mumbai launch. Everything in Hinglish."
```

**Phase 3 — Landing Page (Day 3)**
```
"Build a complete HTML landing page for RealtyFlow Mumbai. Include hero section,
features, testimonials, pricing, FAQ, and lead capture form. Hinglish copy,
mobile-first, Meta Pixel integration."
```

**Phase 4 — Content (Day 4-5)**
```
"Write 3 SEO blog articles targeting Mumbai real estate agents:
1. 'Best Real Estate CRM India 2025' (pillar, 2500 words)
2. '10 Signs You Need a CRM' (listicle, 1200 words)
3. 'How to Manage 100+ Leads' (how-to, 1500 words)
All in Hinglish."
```

**Phase 5 — Visual Assets (Day 5-6)**
```
"Generate ad images for RealtyFlow:
- Facebook ad banner (1200x628) — pain-focused
- Instagram post (1080x1080) — solution-focused
- Instagram story (1080x1920) — social proof
Use DALL-E 3 with real estate CRM theme."
```

**Phase 6 — Video (Day 6-7)**
```
"Create a 60-second product demo video for RealtyFlow using Remotion.
Scenes: Hook (5s), Problem (10s), 3 Features (30s), CTA (15s).
Then generate a Hinglish voiceover and merge."
```

**Phase 7 — Lead Scraping (Day 8)**
```
"Scrape real estate agencies in Mumbai from Google Maps using SerpApi.
Get name, phone, email, website, rating. Then score and deduplicate the leads."
```

**Phase 8 — Outreach (Day 9-14)**
```
"Create a multi-channel outreach campaign for Mumbai leads:
- 5-email sequence (Hinglish, value-first)
- 3 WhatsApp templates
- LinkedIn connection + follow-up
- Cold call script with objection handling"
```

**Phase 9 — Ads (Day 9-14)**
```
"Create a Meta Ads lead generation campaign for RealtyFlow Mumbai.
₹2000/day budget, Housing Special Ad Category, 3 ad variants for A/B testing."
```

**Phase 10 — Optimize (Day 15+)**
```
"Analyze our Mumbai campaign performance. Check which ads to scale and which to kill.
Generate a pipeline summary showing conversion rates."
```

### Weekly Growth Sprint

**Monday:**
```
"Scrape new real estate agencies added this week across Mumbai, Pune, and Delhi.
Deduplicate against existing leads and score them."
```

**Tuesday:**
```
"Write 2 SEO blog articles and generate social media images for the week."
```

**Wednesday:**
```
"Create outreach messages for 50 new leads — email + WhatsApp templates."
```

**Thursday:**
```
"Analyze Meta Ads performance. Kill underperformers. Create 2 new Instagram Reels."
```

**Friday:**
```
"Generate a weekly pipeline summary. How many leads, demos, and conversions this week?"
```

### New Feature Launch

```
"Plan a feature launch campaign for RealtyFlow's new AI Follow-Up feature.
I need: positioning copy, a feature landing page, a 45s explainer video,
ad banners, email blast to existing leads, and a Meta Ads campaign."
```

## Environment Variables Needed

Set these before using skills that call external APIs:

```bash
# Image Generation (either or both)
export OPENAI_API_KEY="sk-..."
export GOOGLE_AI_API_KEY="..."

# Voiceover
export ELEVENLABS_API_KEY="..."

# Lead Scraping
export SERPAPI_API_KEY="..."

# Meta Ads
export META_ADS_ACCESS_TOKEN="EAA..."
export META_ADS_ACCOUNT_ID="act_..."
export META_PIXEL_ID="..."
export META_PAGE_ID="..."

# WhatsApp Business
export WHATSAPP_BUSINESS_API_TOKEN="..."
export WHATSAPP_PHONE_NUMBER_ID="..."
```

## Bash Scripts Available

Located in `cowork-skills/scripts/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `generate-image.sh` | AI image generation (DALL-E/Gemini) | `./generate-image.sh -p openai -t "prompt" -s 1024x1024 -o output.png` |
| `elevenlabs-tts.sh` | Voiceover generation | `./elevenlabs-tts.sh -t "text" -v voice_id -o output.mp3` |
| `serpapi-scrape.sh` | Google Maps lead scraping | `./serpapi-scrape.sh -c Mumbai -o leads.json` |
| `pipeline-manager.sh` | Lead pipeline operations | `./pipeline-manager.sh add --name "Agency" --phone "+91..."` |

## Output File Locations

All outputs are saved under your workspace:

```
marketing-outputs/
├── brand/              # Manifestos, taglines, tone guides
├── agency-app/landing-pages/      # HTML files
├── blog/               # SEO articles, editorial calendars
├── images/             # Generated PNG banners and posts
├── videos/             # MP4 videos
├── audio/              # MP3 voiceovers, SRT subtitles
├── outreach/           # Email/WhatsApp/LinkedIn sequences
├── leads/              # Scraped JSON/CSV lead files
├── pipeline/           # Pipeline JSON + daily summaries
├── ads/                # Campaign plans + performance reports
└── research/           # Market research, ICP, trend reports
```

## Hinglish Convention

All marketing copy follows this rule:
- 70% English + 30% Hindi (romanized, not Devanagari)
- Emotions in Hindi: "tension mat lo", "sapna poora hoga"
- Technical in English: "CRM", "pipeline", "analytics"
- Casual fillers: "yaar", "bhai", "dekho"
- Currency: ₹, crore, lakh (never million/billion)

## What Changed from the Old System

The original system had these problems that are now fixed:

1. **PowerShell scripts → Bash**: All .ps1 scripts converted to .sh (Linux-compatible)
2. **`/agent` commands → Natural language**: No more `/agent brand-strategist` — just describe what you need
3. **Skills not registered → Properly installed**: Skills now work with Cowork's discovery system
4. **Cloudberry naming → RealtyFlow**: Consistent brand naming throughout
5. **Windows-only → Linux**: Everything runs on Ubuntu 22 (Cowork's VM)
6. **22 fragmented skills → 13 focused skills**: Consolidated overlapping skills into clear categories
7. **No orchestrator → Marketing Orchestrator**: Central skill that routes to the right sub-skill
8. **Missing output structure → Clear directories**: All outputs organized by type

## Tips

- Start with the **Marketing Orchestrator** if you're not sure which skill to use
- For a full campaign, follow the **City Launch** workflow above
- Skills can be combined — ask for "a landing page with images and a video demo"
- Always set your API keys before using image/voice/scraping features
- The pipeline manager script works offline with JSON — no Google Sheets needed
