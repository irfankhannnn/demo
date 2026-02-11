# Cloudberry Real Estate — Claude Code Skills & Agent Teams

A comprehensive multi-team AI agent system built for Claude Code, designed to autonomously manage product engineering, market intelligence, creative production, growth operations, and sales nurturing for the Cloudberry Real Estate CRM platform. Includes the **RealtyFlow 3,000 Lead Generation Campaign** — an 8-phase system to generate leads for Indian real estate agents.

## Architecture Overview

```
claude-skills/
├── README.md                          # This file
├── CLAUDE.md                          # Master context for all agents
├── INTEGRATIONS.md                    # All API keys, tokens, third-party setup guide
├── setup.ps1                          # Windows setup script (copies to .claude/)
│
├── agents/                            # Sub-agent definitions (20 agents)
│   ├── orchestrator.md                # Master orchestrator (coordinates all 6 teams)
│   │
│   ├── # Team 1: Product & Engineering (The Builders)
│   ├── architect.md                   # Codebase analysis, module planning
│   ├── sentry.md                      # Security scanning, auth/encryption
│   ├── pr-commander.md                # PR analysis, docs, auto-commit
│   │
│   ├── # Team 2: Market Intelligence (The Strategists)
│   ├── trend-hunter.md                # Social/competitor scraping, pain points
│   ├── deep-researcher.md             # ICP analysis, firmographic mapping
│   ├── oracle.md                      # Feature/hook conversion prediction
│   │
│   ├── # Team 3: Creative Production (The Content Factory)
│   ├── brand-strategist.md            # [NEW] Brand identity, Hinglish manifesto, taglines
│   ├── nano-designer.md               # Ad banners, images via DALL-E/Gemini + Remotion
│   ├── motion-engineer.md             # Demo videos via Remotion + FFmpeg
│   ├── ugc-planner.md                 # UGC scripts, hooks in Hinglish
│   ├── orator.md                      # Voiceovers via ElevenLabs, subtitles
│   ├── landing-page-builder.md        # [NEW] HTML landing pages with Hinglish copy
│   ├── seo-content-writer.md          # [NEW] SEO blog articles, editorial calendars
│   │
│   ├── # Team 4: Growth & Ad Ops (The Scalers)
│   ├── media-buyer.md                 # Meta Ads Manager, campaign setup
│   ├── ab-optimizer.md                # ROAS/CPA monitoring, ad set scaling
│   ├── lead-scraper.md                # Google Maps scraping (SerpApi), enrichment
│   │
│   ├── # Team 5: Sales & Lead Nurture (The Converters)
│   ├── sdr.md                         # Email/WhatsApp/LinkedIn/cold calls
│   ├── nurture-bot.md                 # CRM follow-ups, objection handling
│   │
│   └── # Team 6: Operations (The Trackers)
│       └── pipeline-manager.md        # [NEW] Pipeline tracking, Google Sheets, summaries
│
├── skills/                            # Skill definitions (22 skills)
│   ├── # Engineering (3)
│   ├── codebase-analysis/SKILL.md     # Analyze & plan CRM modules
│   ├── security-audit/SKILL.md        # Vulnerability scanning
│   ├── pr-review/SKILL.md             # Pull request review workflow
│   │
│   ├── # Market Intel (3)
│   ├── trend-analysis/SKILL.md        # Market trend identification
│   ├── icp-research/SKILL.md          # Ideal Customer Profile analysis
│   ├── market-prediction/SKILL.md     # Conversion prediction
│   │
│   ├── # Creative (9)
│   ├── brand-strategy/SKILL.md        # [NEW] Brand identity in Hinglish
│   ├── design-assets/SKILL.md         # Visual asset specifications
│   ├── image-generation/SKILL.md      # [NEW] AI image gen (DALL-E 3 / Gemini Imagen)
│   ├── video-production/SKILL.md      # Video content pipeline (FFmpeg)
│   ├── remotion-video/SKILL.md        # [NEW] Remotion programmatic video creation
│   ├── ugc-scripts/SKILL.md           # UGC script writing
│   ├── voiceover-gen/SKILL.md         # ElevenLabs TTS voice & subtitles
│   ├── landing-page/SKILL.md          # [NEW] HTML landing page generation
│   ├── seo-blog/SKILL.md              # [NEW] SEO blog article writing
│   │
│   ├── # Growth (4)
│   ├── meta-ads-setup/SKILL.md        # Meta campaign setup
│   ├── ab-testing/SKILL.md            # A/B test management
│   ├── lead-enrichment/SKILL.md       # Lead data enrichment
│   ├── serpapi-scraping/SKILL.md      # [NEW] Google Maps scraping via SerpApi
│   │
│   ├── # Sales (3)
│   ├── outbound-outreach/SKILL.md     # Personalized email outreach
│   ├── whatsapp-outreach/SKILL.md     # [NEW] WhatsApp voice/text + cold calls
│   ├── lead-nurture/SKILL.md          # Automated nurture sequences
│   │
│   └── # Operations (1)
│       └── pipeline-tracker/SKILL.md  # [NEW] Lead pipeline management
│
├── scripts/                           # Helper scripts (9 scripts)
│   ├── validate-security-scan.sh      # Pre-tool hook: block unsafe commands
│   ├── validate-readonly.sh           # Pre-tool hook: read-only enforcement
│   ├── run-lint-check.sh              # Post-tool hook: lint after edits
│   ├── validate-ad-budget.sh          # Pre-tool hook: budget safety guard
│   ├── generate-image.ps1             # [NEW] AI image generation (DALL-E 3 / Gemini)
│   ├── render-remotion.ps1            # [NEW] Remotion video rendering (local + Lambda)
│   ├── elevenlabs-tts.ps1             # [NEW] ElevenLabs voice generation
│   ├── serpapi-scrape.ps1             # [NEW] Google Maps agency scraping
│   └── sheets-update.ps1             # [NEW] Pipeline tracking (JSON/CSV offline)
│
└── templates/                         # Reusable templates
    ├── pr-review-template.md
    ├── icp-report-template.md
    ├── ad-creative-brief.md
    ├── ugc-script-template.md
    └── outreach-sequence-template.md
```

## RealtyFlow 3,000 Lead Generation — Phase Mapping

| Phase | Agent(s) | Skill(s) | Script(s) | Third-Party APIs |
|-------|----------|----------|-----------|------------------|
| **1. Branding** | `brand-strategist` | `brand-strategy` | — | None |
| **2. Landing Page** | `landing-page-builder`, `nano-designer` | `landing-page`, `image-generation` | `generate-image.ps1` | Meta Pixel, DALL-E/Gemini |
| **3. SEO Blog** | `seo-content-writer`, `trend-hunter` | `seo-blog`, `trend-analysis` | — | None |
| **4. Meta Ads** | `media-buyer`, `nano-designer`, `motion-engineer`, `ugc-planner` | `meta-ads-setup`, `image-generation`, `remotion-video` | `generate-image.ps1`, `render-remotion.ps1` | Meta Marketing API, DALL-E/Gemini, Remotion |
| **5. Outbound** | `sdr`, `orator`, `nurture-bot` | `whatsapp-outreach`, `outbound-outreach`, `voiceover-gen` | `elevenlabs-tts.ps1` | ElevenLabs, Instantly/SES, WhatsApp API |
| **6. Scraping** | `lead-scraper` | `serpapi-scraping`, `lead-enrichment` | `serpapi-scrape.ps1` | SerpApi, Browserbase, PhantomBuster |
| **7. Pipeline** | `pipeline-manager` | `pipeline-tracker` | `sheets-update.ps1` | Google Sheets MCP |
| **8. Content/Video** | `motion-engineer`, `ugc-planner`, `orator`, `nano-designer` | `remotion-video`, `ugc-scripts`, `voiceover-gen`, `image-generation` | `render-remotion.ps1`, `elevenlabs-tts.ps1`, `generate-image.ps1` | Remotion, ElevenLabs, DALL-E/Gemini |

## Teams

### Team 1: Product & Engineering (The Builders)
**Focus:** CRM stability, feature velocity, and autonomous maintenance.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `architect` | Codebase analysis, module planning | `sonnet` | `codebase-analysis` |
| `sentry` | Security scanning, auth management | `sonnet` | `security-audit` |
| `pr-commander` | PR review, documentation | `sonnet` | `pr-review` |

### Team 2: Market Intelligence (The Strategists)
**Focus:** Identifying blue ocean audiences and trending triggers.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `trend-hunter` | Social/competitor scraping | `sonnet` | `trend-analysis` |
| `deep-researcher` | ICP analysis, firmographic mapping | `sonnet` | `icp-research` |
| `oracle` | Conversion prediction | `sonnet` | `market-prediction` |

### Team 3: Creative Production (The Content Factory)
**Focus:** Hinglish brand assets, images, videos, landing pages, and SEO content.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `brand-strategist` | Brand identity, Hinglish manifesto, taglines | `sonnet` | `brand-strategy` |
| `nano-designer` | Ad banners, images (DALL-E/Gemini/Remotion) | `sonnet` | `design-assets`, `image-generation`, `remotion-video` |
| `motion-engineer` | Videos via Remotion + FFmpeg | `sonnet` | `video-production`, `remotion-video`, `voiceover-gen` |
| `ugc-planner` | UGC scripts, hooks in Hinglish | `sonnet` | `ugc-scripts`, `remotion-video`, `brand-strategy` |
| `orator` | Voiceovers (ElevenLabs), subtitles | `sonnet` | `voiceover-gen`, `whatsapp-outreach` |
| `landing-page-builder` | HTML landing pages with Hinglish copy | `sonnet` | `landing-page`, `brand-strategy` |
| `seo-content-writer` | SEO blog articles, editorial calendars | `sonnet` | `seo-blog`, `brand-strategy` |
###
### Team 4: Growth & Ad Ops (The Scalers)
**Focus:** Deploying, testing, and scaling Meta ad campaigns.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `media-buyer` | Meta Ads Manager, campaigns, lead forms | `sonnet` | `meta-ads-setup` |
| `ab-optimizer` | ROAS/CPA monitoring, scaling | `sonnet` | `ab-testing` |
| `lead-scraper` | Google Maps scraping, data enrichment | `sonnet` | `lead-enrichment`, `serpapi-scraping` |

### Team 5: Sales & Lead Nurture (The Converters)
**Focus:** Converting 3,000 leads via multi-channel outreach.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `sdr` | Email/WhatsApp/LinkedIn/cold calls | `sonnet` | `outbound-outreach`, `whatsapp-outreach`, `brand-strategy` |
| `nurture-bot` | CRM follow-ups, objection handling | `sonnet` | `lead-nurture` |

### Team 6: Operations (The Trackers)
**Focus:** Pipeline management and progress tracking toward 3K target.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| `pipeline-manager` | Pipeline tracking, daily summaries | `sonnet` | `pipeline-tracker`, `lead-enrichment` |

## Quick Start

### 1. Setup (Windows)
```powershell
# Run the setup script to copy agents/skills into .claude/
.\claude-skills\setup.ps1
```

### 2. Set Up API Keys
See `INTEGRATIONS.md` for full details. Minimum required:
```bash
OPENAI_API_KEY=sk-...              # For DALL-E 3 image generation
ELEVENLABS_API_KEY=...             # For voice messages
META_ADS_ACCESS_TOKEN=...          # For Meta ad campaigns
META_PIXEL_ID=...                  # For conversion tracking
SERPAPI_API_KEY=...                # For Google Maps scraping
```

### 3. Use in Claude Code
```
# Run the full 8-phase lead gen campaign
/agent orchestrator
"Execute the RealtyFlow 3K Lead Generation Campaign starting with Phase 1 Branding"

# Run individual phases
/agent brand-strategist
"Create a Hinglish brand manifesto and 5 taglines for RealtyFlow"

/agent landing-page-builder
"Generate a complete HTML landing page for RealtyFlow with Hinglish copy"

/agent seo-content-writer
"Write 5 blog post ideas and a full article for 'real estate CRM Mumbai'"

/agent media-buyer
"Create a Meta lead-gen campaign for RealtyFlow targeting Mumbai and Pune"

/agent sdr
"Generate 3 WhatsApp voice scripts and 3 email sequences in Hinglish"

/agent lead-scraper
"Scrape real estate agencies in Mumbai and Pune from Google Maps"

/agent pipeline-manager
"Create the master pipeline tracker and add today's scraped leads"

/agent motion-engineer
"Create a 30s product demo video for RealtyFlow using Remotion"
```

### 4. Run Scripts Directly
```powershell
# Generate ad images
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" -Prompt "Modern CRM dashboard" -Output "ad.png"

# Render video via Remotion
.\claude-skills\scripts\render-remotion.ps1 -Composition "RealtyFlowAd" -Output "out/ad.mp4"

# Generate voice messages
.\claude-skills\scripts\elevenlabs-tts.ps1 -Text "Namaste bhai!" -VoiceId "your-voice-id" -Output "voice.mp3"

# Scrape agencies from Google Maps
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" -Output "leads-mumbai.json"

# Manage pipeline
.\claude-skills\scripts\sheets-update.ps1 -Action "create"
.\claude-skills\scripts\sheets-update.ps1 -Action "add-lead" -Name "Test Agency" -Phone "+919876543210" -City "Mumbai"
.\claude-skills\scripts\sheets-update.ps1 -Action "summary"
```

## MCP Server Integration

These agents are designed to work with the following MCP servers:

- **GitHub MCP** — PR analysis, commit management, issue tracking
- **Brave Search MCP** — Web search for trend hunting and research
- **Browserbase MCP** — Headless browser for website scraping and Meta Ads automation
- **Google Sheets MCP** — Real-time pipeline tracking and lead management
- **FileSystem MCP** — Local file management for assets and reports

## Best Practices

1. **Start with Phase 1 (Branding)** — all other phases depend on brand voice
2. **Use the orchestrator** for cross-team coordination
3. **Check INTEGRATIONS.md** before using any external APIs
4. **Use Remotion** (`my-video/`) for all video and animated image creation
5. **All marketing copy in Hinglish** — 70% English + 30% Hindi (romanized)
6. **Enable persistent memory** so agents learn from past runs
7. **Monitor token usage** — agent teams consume tokens per teammate
8. **Use `delegate` permission mode** for autonomous team operation
9. **Set `maxTurns`** to prevent runaway agent loops
10. **Pipeline tracking** — always update pipeline-manager after capturing or converting leads
