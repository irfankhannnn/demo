# RealtyFlow Lead Generation — Third-Party Integrations Guide

All APIs, tokens, and third-party services required for the 8-phase, 3,000 lead generation plan.

## Quick Reference

| Service | Phase(s) | Required | Cost Tier | Env Variable |
|---------|----------|----------|-----------|-------------|
| OpenAI (DALL-E 3) | 4, 8 | Yes (for images) | Pay-per-use ~$0.04/image | `OPENAI_API_KEY` |
| Google Gemini Imagen | 4, 8 | Alternative to OpenAI | Free tier available | `GOOGLE_AI_API_KEY` |
| ElevenLabs | 5, 8 | Yes (for voice) | Free: 10k chars/mo, Pro: $5/mo | `ELEVENLABS_API_KEY` |
| Meta Marketing API | 4 | Yes (for ads) | Free (ad spend separate) | `META_ADS_ACCESS_TOKEN` |
| Meta Pixel | 2, 4 | Yes (for tracking) | Free | `META_PIXEL_ID` |
| SerpApi | 6 | Yes (for scraping) | Free: 100/mo, $50/mo: 5000 | `SERPAPI_API_KEY` |
| Browserbase | 6 | Optional | Free tier available | `BROWSERBASE_API_KEY` |
| PhantomBuster | 6 | Optional | Free: 5 phantoms, $69/mo | `PHANTOMBUSTER_API_KEY` |
| Google Sheets API | 7 | Recommended | Free | `GOOGLE_SHEETS_PIPELINE_ID` |
| Instantly.ai | 5 | Optional (or AWS SES) | $30/mo Growth plan | `INSTANTLY_API_KEY` |
| AWS SES | 5, 7 | Alternative to Instantly | ~$0.10/1000 emails | `AWS_SES_REGION` |
| WhatsApp Business API | 5 | Optional | Free: 1000 convos/mo | `WHATSAPP_BUSINESS_API_TOKEN` |
| Remotion (Lambda) | 4, 8 | Optional (local free) | AWS Lambda costs | `REMOTION_AWS_ACCESS_KEY_ID` |

---

## Phase 1: Branding & Positioning

### No external APIs needed
- Agent: `brand-strategist`
- This phase is pure content generation (manifesto, taglines, tone guide)
- Output: Markdown files in `marketing-and-sales/creative/brand/`

---

## Phase 2: Landing Page Creation

### Meta Pixel (Free)
- **What:** Tracking pixel for conversion events on landing page
- **Setup:**
  1. Go to [Meta Events Manager](https://business.facebook.com/events_manager)
  2. Create a new Pixel
  3. Copy the Pixel ID
- **Env:** `META_PIXEL_ID`
- **Used by:** `landing-page-builder` agent

### Google Analytics 4 (Free)
- **What:** Website analytics for landing page traffic
- **Setup:**
  1. Go to [Google Analytics](https://analytics.google.com)
  2. Create property → Get Measurement ID (G-XXXXXXX)
- **Env:** `GA4_MEASUREMENT_ID`
- **Used by:** `landing-page-builder` agent

---

## Phase 3: SEO Blog Strategy

### No external APIs needed
- Agent: `seo-content-writer`
- Keyword research done via Claude's knowledge + free tools (Google Keyword Planner, Ubersuggest)
- Output: Markdown blog articles in `marketing-and-sales/creative/blog/`

### Optional: Google Search Console (Free)
- **What:** Monitor search rankings and indexing
- **Setup:** Verify domain ownership at [Search Console](https://search.google.com/search-console)
- **Used by:** `seo-content-writer` for keyword performance tracking

---

## Phase 4: High-Converting Meta Ads

### Meta Marketing API (Required for automated ad creation)
- **What:** Programmatic ad campaign creation, audience targeting, lead forms
- **Setup:**
  1. Create [Meta Business Account](https://business.facebook.com)
  2. Create App at [Meta Developers](https://developers.facebook.com)
  3. Request `ads_management` and `leads_retrieval` permissions
  4. Generate long-lived access token
- **Env Variables:**
  ```
  META_ADS_ACCESS_TOKEN=your_token_here
  META_ADS_ACCOUNT_ID=act_123456789
  META_PIXEL_ID=your_pixel_id
  META_APP_ID=your_app_id
  META_APP_SECRET=your_app_secret
  ```
- **Permissions needed:** `ads_management`, `ads_read`, `leads_retrieval`, `pages_read_engagement`
- **Rate limits:** 200 calls/hour for ad management
- **Cost:** API is free; you pay for ad spend (budget set in campaigns)
- **Used by:** `media-buyer` agent, `ab-optimizer` agent

### OpenAI DALL-E 3 (For ad creative images)
- **What:** AI image generation for ad banners and social posts
- **Setup:**
  1. Create account at [OpenAI Platform](https://platform.openai.com)
  2. Add billing → Generate API key
- **Env:** `OPENAI_API_KEY`
- **Pricing:**
  - Standard quality: $0.040/image (1024x1024)
  - HD quality: $0.080/image (1024x1024)
  - HD quality: $0.120/image (1792x1024 or 1024x1792)
- **Rate limits:** 5 images/minute (Tier 1), 7/min (Tier 2+)
- **Used by:** `nano-designer` agent via `generate-image.ps1`

### Google Gemini Imagen (Alternative for images)
- **What:** Google's image generation model
- **Setup:**
  1. Go to [Google AI Studio](https://aistudio.google.com)
  2. Generate API key
- **Env:** `GOOGLE_AI_API_KEY`
- **Pricing:** Free tier available (limited), pay-per-use after
- **Used by:** `nano-designer` agent via `generate-image.ps1`

### Remotion (For video ads)
- **What:** Programmatic video generation using React components
- **Setup (Local — Free):**
  1. `cd my-video && npm install`
  2. `npx remotion studio` (preview)
  3. `npx remotion render CompositionName output.mp4` (render)
- **Setup (Lambda — Cloud rendering):**
  1. Configure AWS credentials
  2. `node deploy.mjs`
  ```
  REMOTION_AWS_ACCESS_KEY_ID=your_key
  REMOTION_AWS_SECRET_ACCESS_KEY=your_secret
  REMOTION_REGION=us-east-1
  ```
- **Pricing:** Local is free. Lambda: ~$0.005-0.05 per render (AWS Lambda costs)
- **Used by:** `motion-engineer`, `nano-designer`, `ugc-planner` agents via `render-remotion.ps1`

---

## Phase 5: Outbound Sales Campaigns

### ElevenLabs (Required for voice messages)
- **What:** AI text-to-speech for WhatsApp voice messages and video voiceovers
- **Setup:**
  1. Create account at [ElevenLabs](https://elevenlabs.io)
  2. Go to Profile → API Key
  3. Clone or select voice profiles for Indian English
- **Env:** `ELEVENLABS_API_KEY`
- **Pricing:**
  - Free: 10,000 characters/month (≈10 minutes of audio)
  - Starter: $5/month — 30,000 chars
  - Creator: $22/month — 100,000 chars
  - Pro: $99/month — 500,000 chars
- **Rate limits:** 2 concurrent requests (free), varies by plan
- **Recommended plan:** Creator ($22/mo) for this campaign
- **Used by:** `orator` agent, `sdr` agent via `elevenlabs-tts.ps1`

### Voice Setup Steps
1. Sign up at ElevenLabs
2. Go to Voice Library → find or clone Indian English voices
3. Note voice IDs for: professional male, professional female, casual male, casual female
4. Set `ELEVENLABS_API_KEY` env variable
5. Test: `.\claude-skills\scripts\elevenlabs-tts.ps1 -ListVoices`

### Instantly.ai (Option A for email sequences)
- **What:** Cold email automation platform with warmup
- **Setup:**
  1. Create account at [Instantly.ai](https://instantly.ai)
  2. Connect sending email accounts
  3. Set up domain warmup (2 weeks recommended before campaigns)
  4. Generate API key
- **Env:** `INSTANTLY_API_KEY`
- **Pricing:**
  - Growth: $30/month — 1,000 leads, unlimited emails
  - Hypergrowth: $77.6/month — 25,000 leads
- **Used by:** `sdr` agent

### AWS SES (Option B for email — cheaper, more control)
- **What:** Amazon Simple Email Service
- **Setup:**
  1. Verify domain in AWS SES console
  2. Set up DKIM, SPF, DMARC records
  3. Request production access (out of sandbox)
- **Env:** `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Pricing:** $0.10 per 1,000 emails
- **Note:** Requires building your own warmup/scheduling logic
- **Used by:** `sdr` agent, `pipeline-manager` agent

### WhatsApp Business API (Optional)
- **What:** Send templated messages and voice notes via WhatsApp
- **Setup:**
  1. Create [WhatsApp Business Account](https://business.facebook.com/wa/manage/home/)
  2. Through Meta Business Suite → WhatsApp → API Setup
  3. Get phone number ID and access token
  4. Submit message templates for approval (24-48 hours)
- **Env:**
  ```
  WHATSAPP_BUSINESS_API_TOKEN=your_token
  WHATSAPP_PHONE_NUMBER_ID=your_phone_id
  ```
- **Pricing:** First 1,000 conversations/month free, then per-conversation pricing
- **Note:** Template messages must be pre-approved by Meta
- **Used by:** `sdr` agent, `nurture-bot` agent

---

## Phase 6: Local Agency Data Scraping

### SerpApi (Required for Google Maps scraping)
- **What:** Google Maps search API for finding real estate agencies
- **Setup:**
  1. Create account at [SerpApi](https://serpapi.com)
  2. Copy API key from dashboard
- **Env:** `SERPAPI_API_KEY`
- **Pricing:**
  - Free: 100 searches/month
  - Developer: $50/month — 5,000 searches
  - Business: $130/month — 15,000 searches
- **Recommended:** Developer ($50/mo) — enough for 5 cities × ~500 results
- **Used by:** `lead-scraper` agent via `serpapi-scrape.ps1`

### Browserbase (Optional — for website scraping)
- **What:** Headless browser API for extracting emails/social from websites
- **Setup:**
  1. Create account at [Browserbase](https://browserbase.com)
  2. Create project → Get API key and project ID
- **Env:**
  ```
  BROWSERBASE_API_KEY=your_key
  BROWSERBASE_PROJECT_ID=your_project_id
  ```
- **Pricing:** Free tier: 100 sessions/month, then pay-per-use
- **Used by:** `lead-scraper` agent

### PhantomBuster (Optional — for social media scraping)
- **What:** Pre-built automation flows for Google Maps, Instagram, Facebook data extraction
- **Setup:**
  1. Create account at [PhantomBuster](https://phantombuster.com)
  2. Set up flows: "Google Maps Search to Contact Data", "Instagram Profile Scraper"
  3. Generate API key
- **Env:** `PHANTOMBUSTER_API_KEY`
- **Pricing:**
  - Free: 5 phantoms, 2 hours/day
  - Starter: $69/month — 5 phantoms, 20 hours/day
  - Pro: $159/month — 15 phantoms, 80 hours/day
- **Recommended:** Starter ($69/mo) for initial scraping runs
- **Used by:** `lead-scraper` agent

---

## Phase 7: Lead/Demo Tracker Automation

### Google Sheets API + MCP (Recommended)
- **What:** Real-time pipeline tracking via Claude Code's Google Sheets MCP
- **Setup:**
  1. Create a Google Cloud project at [Console](https://console.cloud.google.com)
  2. Enable Google Sheets API
  3. Create Service Account → Download JSON key
  4. Create spreadsheet → Share with service account email
  5. Configure Google Sheets MCP in Claude Code
- **Env:**
  ```
  GOOGLE_SHEETS_PIPELINE_ID=spreadsheet_id_from_url
  GOOGLE_SHEETS_SERVICE_ACCOUNT=path/to/service-account.json
  ```
- **Pricing:** Free (within Google Sheets API quotas — 300 requests/minute)
- **MCP Config:**
  ```json
  {
    "mcpServers": {
      "google-sheets": {
        "command": "npx",
        "args": ["-y", "@anthropic/google-sheets-mcp"],
        "env": {
          "GOOGLE_SHEETS_CREDENTIALS": "${GOOGLE_SHEETS_SERVICE_ACCOUNT}"
        }
      }
    }
  }
  ```
- **Used by:** `pipeline-manager` agent

### Offline Alternative: JSON/CSV Pipeline
- No external API needed
- Uses `sheets-update.ps1` script for local pipeline management
- Export to CSV/Excel for sharing

---

## Phase 8: Content & Video Production

### Remotion (Same as Phase 4)
- Local rendering: Free
- Lambda rendering: AWS costs
- Used for: UGC videos, product demos, Instagram Reels, training videos, carousel images

### ElevenLabs (Same as Phase 5)
- Used for: Video narration, voiceovers for demos and tutorials

### OpenAI / Gemini (Same as Phase 4)
- Used for: Thumbnail images, carousel slide backgrounds, social post visuals

### FFmpeg (Free, local)
- **What:** Video/audio post-processing (trim, resize, add text, subtitles)
- **Setup:** `winget install FFmpeg` or download from [ffmpeg.org](https://ffmpeg.org)
- **Used by:** `motion-engineer`, `orator` agents

### ImageMagick (Free, local)
- **What:** Image resizing, text overlay, watermarking
- **Setup:** `winget install ImageMagick` or download from [imagemagick.org](https://imagemagick.org)
- **Used by:** `nano-designer` agent

---

## Environment Variables Summary

Create a `.env` file or set these in your environment:

```bash
# === Phase 2: Landing Page ===
META_PIXEL_ID=your_pixel_id
GA4_MEASUREMENT_ID=G-XXXXXXXXXX

# === Phase 4: Meta Ads + Image Generation ===
META_ADS_ACCESS_TOKEN=your_meta_token
META_ADS_ACCOUNT_ID=act_123456789
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_AI_API_KEY=your-google-ai-key

# === Phase 4/8: Remotion Video (Lambda - optional) ===
REMOTION_AWS_ACCESS_KEY_ID=your_aws_key
REMOTION_AWS_SECRET_ACCESS_KEY=your_aws_secret
REMOTION_REGION=us-east-1

# === Phase 5: Outbound (Voice + Email + WhatsApp) ===
ELEVENLABS_API_KEY=your_elevenlabs_key
INSTANTLY_API_KEY=your_instantly_key
WHATSAPP_BUSINESS_API_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
AWS_SES_REGION=ap-south-1

# === Phase 6: Scraping ===
SERPAPI_API_KEY=your_serpapi_key
BROWSERBASE_API_KEY=your_browserbase_key
BROWSERBASE_PROJECT_ID=your_project_id
PHANTOMBUSTER_API_KEY=your_phantombuster_key

# === Phase 7: Pipeline Tracking ===
GOOGLE_SHEETS_PIPELINE_ID=your_spreadsheet_id
GOOGLE_SHEETS_SERVICE_ACCOUNT=path/to/service-account.json
```

---

## Estimated Monthly Costs

### Minimum Viable Setup (Essential APIs only)
| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| OpenAI DALL-E 3 | ~$10-20 | ~200-500 images |
| ElevenLabs Creator | $22 | 100k chars ≈ 100 min audio |
| SerpApi Developer | $50 | 5,000 searches |
| Meta Ads Spend | $500-2,000 | Actual ad budget |
| **Total (excluding ads)** | **~$82-92/mo** | |

### Full Setup (All integrations)
| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| OpenAI DALL-E 3 | ~$20-40 | HD quality images |
| ElevenLabs Pro | $99 | 500k chars for extensive voice |
| SerpApi Developer | $50 | 5,000 searches |
| PhantomBuster Starter | $69 | Social media scraping |
| Instantly Growth | $30 | Email automation |
| Remotion Lambda | ~$5-20 | Cloud video rendering |
| Meta Ads Spend | $1,000-5,000 | Scaled ad budget |
| **Total (excluding ads)** | **~$273-308/mo** | |

### Free Alternatives
| Paid Service | Free Alternative | Trade-off |
|-------------|-----------------|-----------|
| DALL-E 3 | Gemini Imagen (free tier) | Limited generations |
| Instantly | AWS SES + custom scripts | More setup work |
| PhantomBuster | Manual scraping / Browserbase free | Slower, less data |
| Remotion Lambda | Remotion local rendering | Slower rendering |
| Google Sheets MCP | Local JSON/CSV pipeline | No real-time sharing |

---

## Setup Priority Order

1. **Week 1 (Foundation):**
   - Meta Business Account + Pixel (free)
   - OpenAI or Gemini API key (for images)
   - ElevenLabs account (free tier to start)
   - Remotion local setup (`cd my-video && npm install`)

2. **Week 2 (Scraping + Outreach):**
   - SerpApi key (free tier → paid if needed)
   - Instantly or AWS SES for email
   - ElevenLabs upgrade to Creator/Pro

3. **Week 3 (Scaling):**
   - Meta Marketing API access token
   - WhatsApp Business API setup
   - Google Sheets MCP for pipeline
   - PhantomBuster for social scraping

4. **Week 4 (Optimization):**
   - Remotion Lambda for fast video rendering
   - Browserbase for website scraping
   - Full ad budget deployment

---

## Engineering Change Intelligence (PR review)

Local-first. The review runs in Claude Code on your machine; GitHub Actions only gathers context, and nothing is posted anywhere unless you ask for it.

### Run a review

```bash
# once, to copy the agents and skills into .claude/ so Claude Code discovers them
pwsh tools/claude-skills/setup.ps1

claude --agent pr-orchestrator "Review PR #42"
claude --agent pr-orchestrator "Review branch feat/lead-scoring"
```

Reports land in `tools/engineering-change-intelligence/reports/<target>/`, which is gitignored.

### Prerequisites

- **bash** (Git Bash on Windows), **git**, **Python 3.8+** (`python3` or `python` on PATH). `jq` is not needed.
- **GitHub CLI**, authenticated, for `--pr` mode: `gh auth login`. The scripts only read (`gh pr view`, `gh pr diff`).
  - In CI, `gh` needs `GH_TOKEN` set in the step's own `env:` — `GITHUB_TOKEN` is not picked up automatically. `.github/workflows/pr-intelligence.yml` sets `GH_TOKEN: ${{ github.token }}` on the steps that call `gh`.
- No `ANTHROPIC_API_KEY` is needed: the model calls happen inside your Claude Code session.

### Slack (optional, local opt-in)

- **What:** posts one release-readiness summary to a Slack channel. Off by default and never automatic.
- **Setup:** [Slack API Apps](https://api.slack.com/apps) → Create New App → enable **Incoming Webhooks** → add a webhook to your channel → copy the URL.
- **Env:** `SLACK_PR_WEBHOOK_URL`. Optional: `SLACK_BOT_NAME`. The webhook posts to the channel it was created for; it cannot be redirected.
- **Usage:** `bash tools/engineering-change-intelligence/scripts/post-to-slack.sh <output_dir>/release-readiness.md` previews the message, and only `--send` posts it. Ask for Slack explicitly; a webhook URL sitting in the environment is not a request to post.
- **Not used by CI:** `pr-intelligence.yml` is `workflow_dispatch` only, has no Slack step and posts no PR comment. It uploads the gathered context as an artifact. See `tools/engineering-change-intelligence/README.md`.

### Env file

`tools/engineering-change-intelligence/.env` is gitignored and **not** auto-loaded. Source it yourself when you need it:

```bash
set -a; . tools/engineering-change-intelligence/.env; set +a
```
