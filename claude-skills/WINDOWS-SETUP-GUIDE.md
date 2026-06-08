# RealtyFlow Marketing System — Windows Setup Guide

You're running Claude Cowork on Windows. This guide walks you through everything you need to configure before using the 13 marketing skills.

## TL;DR Quick Start

1. **No setup script needed on Windows** — The skills are already installed
2. **Just set environment variables** for API access (see "Environment Variables" section)
3. **Start using skills** by asking Claude naturally (see "How to Use" section)

---

## Why No Setup Script on Windows?

The `setup.sh` script is for Linux users (Ubuntu inside Cowork VM). On Windows:
- Claude Cowork provides the Linux VM environment automatically
- Skills are already discoverable in your Cowork interface
- You just need to configure API credentials

---

## Step 1: Environment Variables Setup

The skills use external APIs. You need to provide credentials for them to work.

### What Are Environment Variables?

They're like settings that tell the scripts which APIs to use and which credentials to use.

### Where to Set Them in Claude Cowork (Windows)

In Claude Cowork on Windows, you can set environment variables in 2 ways:

#### Option A: Via Claude Cowork UI (Easiest)

1. Open Claude Cowork
2. Go to **Settings** → **Environment** (or similar, depending on your version)
3. Click **Add Environment Variable**
4. For each key-value pair below, add it

#### Option B: Via System Environment Variables (Also Works)

1. Press **Windows + X** → **System** (or right-click **This PC** → **Properties**)
2. Go to **Advanced system settings** → **Environment Variables**
3. Click **New** under "User variables"
4. Add each variable below
5. Restart Claude Cowork for them to take effect

### Required Environment Variables

**Paste each into your environment setup:**

```bash
# Image Generation (choose one or both)
OPENAI_API_KEY=sk-proj-XXXXXXXXX...
GOOGLE_AI_API_KEY=AIzaSyDXXXXXXX...

# Voiceover Generation
ELEVENLABS_API_KEY=sk_XXXXXXXXX...

# Lead Scraping from Google Maps
SERPAPI_API_KEY=XXXXXXXXX...

# Meta Ads (Facebook/Instagram)
META_ADS_ACCESS_TOKEN=EAA...XXXXXXXXX...
META_ADS_ACCOUNT_ID=act_XXXXXXXXX
META_PIXEL_ID=123456789
META_PAGE_ID=987654321

# WhatsApp Business (optional, for WhatsApp outreach)
WHATSAPP_BUSINESS_API_TOKEN=EAAxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
```

### How to Get These Credentials

| API | Where to Get | Time | Free Tier? |
|-----|-------------|------|-----------|
| **OpenAI** | https://platform.openai.com/api-keys | 2 min | Yes ($5 credit) |
| **Google AI (Gemini)** | https://aistudio.google.com/apikey | 1 min | Yes (free tier) |
| **ElevenLabs** | https://elevenlabs.io/sign-up | 5 min | Yes (10k chars/month) |
| **SerpApi** | https://serpapi.com/manage-api-key | 2 min | Yes (100 searches free) |
| **Meta Ads** | https://business.facebook.com → Settings → API → Tokens | 10 min | Yes (after ad account created) |
| **WhatsApp Business** | https://developers.facebook.com → My Apps → WhatsApp Business | 15 min | Yes (test account) |

---

## Step 2: Verify Environment Variables Are Set

Ask Claude: **"Check what environment variables I have set"**

Claude will run a command to verify they're all there. You should see output like:
```
✓ OPENAI_API_KEY is set
✓ ELEVENLABS_API_KEY is set
✓ SERPAPI_API_KEY is set
✓ META_ADS_ACCESS_TOKEN is set
...
```

If any are missing, you'll see:
```
✗ OPENAI_API_KEY is NOT set — Image generation won't work
```

---

## Step 3: Create Output Directories (Optional but Recommended)

The skills will save outputs to your workspace. Create these folders so they're organized:

In your Claude Cowork workspace, create a folder structure like this:
```
workspace/
└── marketing-outputs/
    ├── brand/
    ├── landing-pages/
    ├── blog/
    ├── images/
    ├── videos/
    ├── audio/
    ├── outreach/
    ├── leads/
    ├── pipeline/
    ├── ads/
    └── research/
```

**Or just ask Claude:** "Create the marketing output directories in my workspace"

Claude will create them automatically.

---

## How to Use the Skills (Once Setup is Done)

### Just Describe What You Need

You **don't need to run setup.sh** — the skills are already available. Just ask Claude naturally:

**Brand & Strategy:**
```
"Create a brand manifesto for RealtyFlow's Mumbai launch"
"Write 5 taglines for our Mumbai campaign"
"Create an ICP analysis for Indian real estate agents"
```

**Content:**
```
"Write an SEO blog article about CRM for real estate"
"Build a landing page for lead generation"
"Generate ad images for social media"
```

**Video & Audio:**
```
"Create a 60-second product demo video"
"Write a UGC script in Hinglish"
"Generate a voiceover for our video"
```

**Ads & Outreach:**
```
"Set up a Meta Ads campaign for Mumbai"
"Create an email outreach sequence"
"Scrape real estate agencies from Google Maps"
```

**Full Campaigns:**
```
"Plan a complete city launch for Mumbai across all channels"
"Run a weekly growth sprint for lead generation"
"Create a new feature launch campaign"
```

### What Happens When You Ask

1. Claude recognizes your request
2. Claude invokes the appropriate skill automatically (e.g., `brand-strategy`, `landing-page`, `video-production`)
3. The skill runs using your environment variables
4. Claude saves the output to `workspace/marketing-outputs/[category]/`
5. Claude shows you the result with a link to download it

---

## Bash Scripts on Windows

Claude Cowork runs a Linux VM on your Windows machine. The bash scripts (`.sh` files) run inside that Linux VM automatically.

**You don't need to run them manually.** When a skill needs a bash script, Claude will:
1. Run the script inside the Cowork Linux VM
2. Pass the results back to you
3. Save files to your workspace

**Example:** When you ask "Scrape real estate agencies from Mumbai", Claude will:
1. Run `serpapi-scrape.sh` inside the Linux VM
2. Use your `SERPAPI_API_KEY` to call Google Maps API
3. Return the leads as a JSON/CSV file

---

## Troubleshooting

### "Environment variable not found" error

**Solution:**
1. Check you added the variable correctly (no typos)
2. If you set it in System Environment Variables, restart Claude Cowork
3. Verify it with: `echo $VARIABLE_NAME` (or ask Claude to check)

### "API Key is invalid"

**Solution:**
1. Verify the key is correct (copy-paste from the API provider, don't type manually)
2. Check if the API account has the right permissions
3. Make sure you're using the right key for the right API (don't mix keys)

### "Command not found: serpapi-scrape.sh"

**Solution:**
This shouldn't happen — Claude runs the scripts inside the Linux VM automatically. If you see this error:
1. Ask Claude: "Run the lead scraping script for Mumbai"
2. Claude will handle running it in the VM

### "Permission denied" when running a script

**Solution:**
Scripts should have execute permissions. Ask Claude: "Make sure all shell scripts have execute permissions"

Claude will run: `chmod +x cowork-skills/scripts/*.sh`

---

## Example Workflow (Step-by-Step)

Let's say you want to launch RealtyFlow in Mumbai. Here's what you'd do:

### Day 1: Research & Branding
```
"I want to launch RealtyFlow in Mumbai. First, do market research on real estate agents there and create a brand manifesto in Hinglish"
```
Claude uses: `market-research` + `brand-strategy` skills → outputs in `marketing-outputs/research/` and `marketing-outputs/brand/`

### Day 2: Landing Page & Content
```
"Build a landing page for Mumbai real estate agents and write 2 SEO blog articles about CRM"
```
Claude uses: `landing-page` + `seo-blog` skills → outputs in `marketing-outputs/landing-pages/` and `marketing-outputs/blog/`

### Day 3: Visual Assets
```
"Generate 3 ad banners for Facebook, Instagram, and LinkedIn in the RealtyFlow brand colors"
```
Claude uses: `image-generation` skill with `OPENAI_API_KEY` → outputs in `marketing-outputs/images/`

### Day 4-5: Video
```
"Create a 60-second product demo video and generate a Hinglish voiceover"
```
Claude uses: `video-production` + `voiceover-gen` skills → outputs in `marketing-outputs/videos/` and `marketing-outputs/audio/`

### Day 6: Leads
```
"Scrape real estate agencies in Mumbai from Google Maps, enrich them, and score them by fit"
```
Claude uses: `lead-scraping` skill with `SERPAPI_API_KEY` → outputs in `marketing-outputs/leads/`

### Day 7: Outreach
```
"Create a 5-email cold outreach sequence and 3 WhatsApp templates in Hinglish"
```
Claude uses: `outreach` skill → outputs in `marketing-outputs/outreach/`

### Day 8: Ads
```
"Create a Meta Ads campaign for ₹2000/day with 3 ad variants for A/B testing"
```
Claude uses: `meta-ads` skill with `META_ADS_*` variables → outputs in `marketing-outputs/ads/`

### Day 9+: Optimize
```
"Show me a pipeline summary of all leads and which ads to scale"
```
Claude uses: `pipeline-tracker` skill → outputs in `marketing-outputs/pipeline/`

---

## File Locations (For Reference)

All the skill definitions are here:
```
workspace/
└── claude-skills/
    └── cowork-skills/
        ├── brand-strategy/SKILL.md
        ├── landing-page/SKILL.md
        ├── seo-blog/SKILL.md
        ├── image-generation/SKILL.md
        ├── video-production/SKILL.md
        ├── ugc-scripts/SKILL.md
        ├── voiceover-gen/SKILL.md
        ├── meta-ads/SKILL.md
        ├── outreach/SKILL.md
        ├── lead-scraping/SKILL.md
        ├── pipeline-tracker/SKILL.md
        ├── market-research/SKILL.md
        ├── marketing-orchestrator/SKILL.md
        └── scripts/
            ├── generate-image.sh
            ├── elevenlabs-tts.sh
            ├── serpapi-scrape.sh
            └── pipeline-manager.sh
```

---

## Quick Reference: What Each Skill Does

| Skill | What it Does | API Needed |
|-------|------------|-----------|
| `brand-strategy` | Brand manifesto, taglines, tone guide | None |
| `landing-page` | HTML landing pages with forms | None |
| `seo-blog` | Blog articles & keyword research | None |
| `image-generation` | AI ad banners & social images | OpenAI or Google AI |
| `video-production` | Remotion videos & demos | None |
| `ugc-scripts` | UGC ad scripts & creator briefs | None |
| `voiceover-gen` | Voiceovers & audio mixing | ElevenLabs |
| `meta-ads` | Facebook/Instagram campaigns | Meta Business |
| `outreach` | Email, WhatsApp, LinkedIn sequences | None |
| `lead-scraping` | Scrape & score leads from Google Maps | SerpApi |
| `pipeline-tracker` | Lead stage tracking & reports | None |
| `market-research` | ICP, trends, competitor analysis | None |
| `marketing-orchestrator` | Full campaign planning (uses all others) | Depends on campaign |

---

## Summary: What setup.sh Does (For Reference)

Even though you don't run it on Windows, here's what it does:

1. **Finds the skill files** in `cowork-skills/*/SKILL.md`
2. **Copies them to** `.claude/skills/` so Cowork discovers them
3. **Creates output directories** for your marketing outputs
4. **Lists available scripts** in `cowork-skills/scripts/`
5. **Prints setup success message**

On your Windows Cowork, all of this is already done. You just need to set the environment variables.

---

## Next Steps

1. ✅ Set all the environment variables (see Step 1 above)
2. ✅ Ask Claude to verify they're set: **"Check my environment variables"**
3. ✅ Create the output directories (or ask Claude to do it)
4. ✅ Start asking Claude for marketing content!

**Example first request:**
```
"Create a brand manifesto for RealtyFlow targeting Indian real estate agents in Hinglish"
```

That's it! You're ready to go.
