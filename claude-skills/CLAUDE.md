# Cloudberry Real Estate — Master Agent Context

## Project Overview
Cloudberry is a full-stack real estate CRM platform serving India and Dubai markets. The system manages buyers, sellers, owners, tenants, developers, projects, areas, and AI-powered calling. **RealtyFlow** is the go-to-market brand targeting Indian real estate agents with a 3,000 lead generation campaign.

## Tech Stack
- **Frontend:** React + TypeScript + Vite + TailwindCSS (real-estate-crm-app/)
- **Backend:** Node.js + Express + DynamoDB (server/)
- **AI Calling:** Lambda + Exotel + ElevenLabs (ai-calling-service/)
- **Video:** Remotion (React-based programmatic video) (my-video/)
- **Auth:** JWT-based authentication
- **Deployment:** AWS Lambda + API Gateway + CloudFormation
- **Package Manager:** npm

## Key Directories
- `real-estate-crm-app/src/` — Frontend source (components, pages, services, types, contexts)
- `server/` — Express backend (routes, services, middleware)
- `server/build-lambda/` — Lambda deployment build
- `ai-calling-service/` — AI calling microservice
- `onboarding-page/` — Onboarding flow
- `my-video/` — Remotion video generation project
- `claude-skills/` — Agent definitions, skills, scripts, templates
- `marketing-and-sales/` — All marketing outputs (creative, leads, outreach, ads, research)

## DynamoDB Tables
- CRM: Buyers, Sellers, Owners, Customers (Tenants)
- Real Estate: Developers, Areas, Projects
- AI Calling: Call sessions, transcripts, knowledge docs

## Coding Conventions
- Use ES modules in backend (`import`/`export` where supported, otherwise CommonJS)
- TypeScript strict mode in frontend
- RESTful API patterns: `/api/crm/<resource>`
- DynamoDB single-table design with `TENANT#` prefix for multi-tenancy
- All environment variables documented in `.env.example` files
- Error responses: `{ error: string, details?: string }`
- **Hinglish convention:** All marketing copy uses 70% English + 30% Hindi (romanized)

## Agent Teams (6 Teams, 20 Agents)

### Team 1: Product & Engineering (The Builders)
- `architect` — Codebase analysis, module planning
- `sentry` — Security scanning, vulnerability detection
- `pr-commander` — PR review, performance, documentation

### Team 2: Market Intelligence (The Strategists)
- `trend-hunter` — Social listening, competitor tracking
- `deep-researcher` — ICP analysis, firmographic mapping
- `oracle` — Predictive analytics, feature prioritization

### Team 3: Creative Production (The Content Factory)
- `brand-strategist` — Brand identity, Hinglish manifesto, taglines
- `nano-designer` — Ad banners, images via DALL-E/Gemini + Remotion stills
- `motion-engineer` — Video production via Remotion + FFmpeg
- `ugc-planner` — UGC-style ad scripts in Hinglish
- `orator` — Voiceovers via ElevenLabs TTS, subtitles
- `landing-page-builder` — HTML landing pages with Hinglish copy
- `seo-content-writer` — SEO blog articles, editorial calendars

### Team 4: Growth & Ad Ops (The Scalers)
- `media-buyer` — Meta Ads campaigns, budgets, lead forms
- `ab-optimizer` — ROAS/CPA monitoring, winner scaling
- `lead-scraper` — Google Maps scraping (SerpApi), enrichment

### Team 5: Sales & Lead Nurture (The Converters)
- `sdr` — Email/WhatsApp/LinkedIn/cold call outreach
- `nurture-bot` — Automated follow-ups, objection handling

### Team 6: Operations (The Trackers)
- `pipeline-manager` — Pipeline tracking, Google Sheets MCP, daily summaries

## Agent Team Coordination Rules
1. **No file conflicts:** Each agent owns specific directories. Check CLAUDE.md before editing.
2. **Communication:** Use task lists and messages to coordinate between teammates.
3. **Memory:** Update agent memory after completing significant tasks.
4. **Testing:** Always run relevant tests before marking tasks complete.
5. **Git discipline:** Create descriptive commits; never force-push.
6. **Hinglish:** All marketing content uses casual Hinglish tone for Indian audience.
7. **Remotion:** Use `my-video/` project for all programmatic video/image generation.
8. **APIs:** Check `INTEGRATIONS.md` for required env vars before using external APIs.

## File Ownership Map
| Team | Owned Paths |
|------|-------------|
| Builders (architect, sentry, pr-commander) | `real-estate-crm-app/src/`, `server/`, `ai-calling-service/` |
| Strategists (trend-hunter, deep-researcher, oracle) | `marketing-and-sales/research/`, `marketing-and-sales/reports/` |
| Content Factory (brand-strategist, nano-designer, motion-engineer, ugc-planner, orator, landing-page-builder, seo-content-writer) | `marketing-and-sales/creative/`, `marketing-and-sales/assets/` |
| Scalers (media-buyer, ab-optimizer, lead-scraper) | `marketing-and-sales/ads/`, `marketing-and-sales/leads/` |
| Converters (sdr, nurture-bot) | `marketing-and-sales/outreach/`, `marketing-and-sales/sequences/` |
| Trackers (pipeline-manager) | `marketing-and-sales/leads/pipeline.*`, `marketing-and-sales/leads/daily-summary-*` |

## Skills Registry (22 Skills)
| Category | Skills |
|----------|--------|
| Engineering | `codebase-analysis`, `security-audit`, `pr-review` |
| Market Intel | `trend-analysis`, `icp-research`, `market-prediction` |
| Creative | `brand-strategy`, `design-assets`, `image-generation`, `video-production`, `remotion-video`, `ugc-scripts`, `voiceover-gen`, `landing-page`, `seo-blog` |
| Growth | `meta-ads-setup`, `ab-testing`, `lead-enrichment`, `serpapi-scraping` |
| Sales | `outbound-outreach`, `whatsapp-outreach`, `lead-nurture` |
| Operations | `pipeline-tracker` |

## Scripts (8 Scripts)
| Script | Purpose |
|--------|---------|
| `scripts/validate-security-scan.sh` | Blocks destructive commands for Sentry |
| `scripts/validate-readonly.sh` | Enforces read-only for research agents |
| `scripts/run-lint-check.sh` | Post-edit linting for PR Commander |
| `scripts/validate-ad-budget.sh` | Budget safety guard for Media Buyer |
| `scripts/generate-image.ps1` | AI image generation (DALL-E 3 / Gemini Imagen) |
| `scripts/render-remotion.ps1` | Remotion video rendering (local + Lambda) |
| `scripts/elevenlabs-tts.ps1` | ElevenLabs voice generation |
| `scripts/serpapi-scrape.ps1` | Google Maps agency scraping via SerpApi |
| `scripts/sheets-update.ps1` | Pipeline tracking (JSON/CSV offline mode) |
