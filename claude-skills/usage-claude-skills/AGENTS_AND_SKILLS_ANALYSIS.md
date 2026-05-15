# Cloudberry CRM: Complete Agents & Skills Analysis
**Generated:** 2026-05-08 | **Codebase:** `claude-skills/`, `.claude/agents/`, `.agents/skills/`

---

## 📋 EXECUTIVE SUMMARY

This document provides a complete inventory of:
- **20 Agents** across 6 specialized teams
- **22 Skills** supporting agent capabilities
- **Skill-to-Agent Relationships** with call flows and examples
- **Agent Team Coordination** patterns
- **Dependencies & Workflows** for complex tasks

---

## 🎯 PART 1: COMPLETE AGENTS INVENTORY

### AGENTS BY TEAM (6 Teams, 20 Agents)

| # | Agent Name | Team | Primary Role | Tools | Skills | Max Turns |
|---|---|---|---|---|---|---|
| 1 | **architect** | Builders | Codebase analysis, module planning, design decisions | Read, Grep, Glob, Bash, Write, Edit | codebase-analysis | 30 |
| 2 | **sentry** | Builders | Security scanning, vulnerability detection, auth review | Read, Grep, Glob, Bash (read-only) | security-audit | 25 |
| 3 | **pr-commander** | Builders | PR review, performance analysis, documentation | Read, Grep, Glob, Bash, Write, Edit | pr-review | 25 |
| 4 | **trend-hunter** | Strategists | Social listening, competitor tracking, market trends | Read, Bash, Grep, Write | trend-analysis | 30 |
| 5 | **deep-researcher** | Strategists | ICP analysis, firmographic mapping, lead lists | Read, Bash, Write, Grep | icp-research | 35 |
| 6 | **oracle** | Strategists | Predictive analytics, feature prioritization, hook testing | Read, Grep, Bash, Write | market-prediction | 25 |
| 7 | **brand-strategist** | Content Factory | Brand identity, Hinglish manifesto, taglines | Read, Write, Bash | brand-strategy | 20 |
| 8 | **nano-designer** | Content Factory | Ad banners, social graphics, UI mockups (AI images) | Read, Write, Bash | design-assets, image-generation, remotion-video | 25 |
| 9 | **motion-engineer** | Content Factory | Demo videos, B-roll, animated explainers (Veo + FFmpeg) | Read, Write, Bash | video-production, remotion-video, voiceover-gen | 25 |
| 10 | **ugc-planner** | Content Factory | UGC scripts, camera directions, creator briefs | Read, Write | ugc-scripts, remotion-video, brand-strategy | 20 |
| 11 | **orator** | Content Factory | Voiceovers (ElevenLabs TTS), subtitles, audio post-production | Read, Write, Bash | voiceover-gen, whatsapp-outreach | 20 |
| 12 | **landing-page-builder** | Content Factory | HTML landing pages with Hinglish copy, lead forms | Read, Write, Bash | landing-page, brand-strategy | 25 |
| 13 | **seo-content-writer** | Content Factory | Blog articles, keyword research, editorial calendars | Read, Write, Bash, Grep | seo-blog, brand-strategy | 30 |
| 14 | **media-buyer** | Scalers | Meta Ads campaigns, budgets, CAPI setup | Read, Write, Bash | meta-ads-setup | 30 |
| 15 | **ab-optimizer** | Scalers | A/B testing, ROAS/CPA monitoring, creative rotation | Read, Grep, Bash, Write | ab-testing | 25 |
| 16 | **lead-scraper** | Scalers | Lead enrichment, validation, deduplication, scoring | Read, Write, Bash, Grep | lead-enrichment, serpapi-scraping | 30 |
| 17 | **sdr** | Converters | Email sequences, LinkedIn outreach, personalization | Read, Write, Bash | outbound-outreach, whatsapp-outreach, brand-strategy | 25 |
| 18 | **nurture-bot** | Converters | Lead nurture sequences, objection handling, qualification | Read, Write, Bash, Grep | lead-nurture | 25 |
| 19 | **pipeline-manager** | Trackers | Pipeline tracking, stage automation, daily summaries | Read, Write, Bash, Grep | pipeline-tracker, lead-enrichment | 25 |
| 20 | **orchestrator** | Coordinator | Master coordinator across all 5 teams | Read, Grep, Glob, Bash, Write, Edit, Task(*) | All 31 skills | 50 |

---

## 🛠️ PART 2: COMPLETE SKILLS INVENTORY

### SKILLS BY CATEGORY (22 Skills)

| # | Skill Name | Agent(s) | Purpose | Type | Script |
|---|---|---|---|---|---|
| **ENGINEERING** |||||
| 1 | codebase-analysis | architect, orchestrator | Analyze codebase, plan modules | Read-only | - |
| 2 | security-audit | sentry, orchestrator | Vulnerability scanning, auth review | Read-only | validate-security-scan.sh |
| 3 | pr-review | pr-commander, orchestrator | PR analysis, performance, docs | Code review | run-lint-check.sh |
| **MARKET INTEL** |||||
| 4 | trend-analysis | trend-hunter, orchestrator | Social listening, competitor tracking | Research | - |
| 5 | icp-research | deep-researcher, orchestrator | ICP analysis, firmographic mapping | Research | - |
| 6 | market-prediction | oracle, orchestrator | Predictive analytics, hook testing | Analytical | - |
| **CREATIVE** |||||
| 7 | brand-strategy | brand-strategist, sdr, ugc-planner, landing-page-builder, seo-content-writer, orchestrator | Brand manifesto, Hinglish copy, taglines | Content | - |
| 8 | design-assets | nano-designer, orchestrator | Ad banners, social graphics, UI mockups | Design | - |
| 9 | image-generation | nano-designer, orchestrator | AI image generation (DALL-E/Gemini) | AI Gen | generate-image.ps1 |
| 10 | remotion-video | nano-designer, motion-engineer, ugc-planner, orchestrator | Programmatic video generation | Video | render-remotion.ps1 |
| 11 | video-production | motion-engineer, orchestrator | Demo videos, B-roll, FFmpeg editing | Video | - |
| 12 | voiceover-gen | orator, motion-engineer, orchestrator | ElevenLabs TTS, multi-language subtitles | Audio | elevenlabs-tts.ps1 |
| 13 | ugc-scripts | ugc-planner, orchestrator | UGC-style scripts, camera directions | Content | - |
| 14 | landing-page | landing-page-builder, orchestrator | HTML landing pages, Meta Pixel integration | Web | - |
| 15 | seo-blog | seo-content-writer, orchestrator | Blog articles, keyword research, SEO optimization | Content | - |
| 16 | whatsapp-outreach | orator, sdr, orchestrator | WhatsApp campaigns, voice messages | Outreach | elevenlabs-tts.ps1 |
| **GROWTH** |||||
| 17 | meta-ads-setup | media-buyer, orchestrator | Meta Ads campaigns, targeting, budgets | Ads | - |
| 18 | ab-testing | ab-optimizer, orchestrator | A/B test design, statistical significance | Analysis | - |
| 19 | lead-enrichment | lead-scraper, pipeline-manager, orchestrator | Lead validation, enrichment, scoring | Data | - |
| 20 | serpapi-scraping | lead-scraper, orchestrator | Google Maps scraping, data extraction | Data | serpapi-scrape.ps1 |
| **SALES** |||||
| 21 | outbound-outreach | sdr, orchestrator | Email sequences, LinkedIn, cold outreach | Outreach | - |
| 22 | lead-nurture | nurture-bot, orchestrator | Nurture sequences, objection handling | Sales | - |
| **OPERATIONS** |||||
| 23 | pipeline-tracker | pipeline-manager, orchestrator | Google Sheets MCP, pipeline automation | Operations | sheets-update.ps1 |

---

## 📊 PART 3: AGENT-SKILL RELATIONSHIPS (CALL MATRIX)

### Who Calls Which Skill

```
architect
  └─ codebase-analysis (primary skill)

sentry
  └─ security-audit (primary skill)

pr-commander
  └─ pr-review (primary skill)

trend-hunter
  └─ trend-analysis (primary skill)

deep-researcher
  └─ icp-research (primary skill)

oracle
  └─ market-prediction (primary skill)

brand-strategist
  └─ brand-strategy (primary skill)

nano-designer
  ├─ design-assets (primary)
  ├─ image-generation (AI images)
  └─ remotion-video (video stills)

motion-engineer
  ├─ video-production (primary)
  ├─ remotion-video (programmatic video)
  └─ voiceover-gen (ElevenLabs integration)

ugc-planner
  ├─ ugc-scripts (primary)
  ├─ remotion-video (video production)
  └─ brand-strategy (Hinglish copy)

orator
  ├─ voiceover-gen (primary - ElevenLabs)
  └─ whatsapp-outreach (voice messages)

landing-page-builder
  ├─ landing-page (primary)
  └─ brand-strategy (Hinglish copy)

seo-content-writer
  ├─ seo-blog (primary)
  └─ brand-strategy (Hinglish voice)

media-buyer
  └─ meta-ads-setup (primary)

ab-optimizer
  └─ ab-testing (primary)

lead-scraper
  ├─ lead-enrichment (primary)
  └─ serpapi-scraping (data extraction)

sdr
  ├─ outbound-outreach (primary)
  ├─ whatsapp-outreach (multi-channel)
  └─ brand-strategy (personalization)

nurture-bot
  └─ lead-nurture (primary)

pipeline-manager
  ├─ pipeline-tracker (primary)
  └─ lead-enrichment (data validation)

orchestrator
  ├─ All 22 skills (delegation)
  └─ Task() command for agent spawning
```

---

## 🔄 PART 4: TEAM STRUCTURES & RESPONSIBILITIES

### Team 1: BUILDERS (3 agents, 3 skills)
**Purpose:** Core platform development, security, quality

| Agent | Skill | Responsibility |
|---|---|---|
| architect | codebase-analysis | Design modules, APIs, database schemas |
| sentry | security-audit | Find vulnerabilities, auth review, encryption check |
| pr-commander | pr-review | Review code quality, performance, documentation |

**Workflow:**
```
architect designs → pr-commander reviews → sentry audits → MERGE
       ↓                   ↓                    ↓
   ADR + specs      Quality check       Security scan
   API design       Performance test    Auth/encryption
   Schema plan      Type coverage       Data leak check
```

---

### Team 2: STRATEGISTS (3 agents, 3 skills)
**Purpose:** Market intelligence, competitive analysis, prediction

| Agent | Skill | Responsibility |
|---|---|---|
| trend-hunter | trend-analysis | Monitor social media, competitor moves, pain points |
| deep-researcher | icp-research | Build ICPs, firmographic mapping, lead lists |
| oracle | market-prediction | Forecast feature impact, hook performance, ROI |

**Workflow:**
```
trend-hunter identifies → deep-researcher profiles → oracle predicts
   pain points          target audiences          winning tactics
   competitor moves     ICP data                  feature priority
   content signals      firmographic scoring      pricing impact
```

---

### Team 3: CONTENT FACTORY (7 agents, 9 skills)
**Purpose:** Creative production, content creation, brand consistency

| Agent | Skills | Responsibility |
|---|---|---|
| brand-strategist | brand-strategy | Manifesto, taglines, tone-of-voice, Hinglish vocabulary |
| nano-designer | design-assets, image-generation, remotion-video | Ad banners, social graphics, UI mockups |
| motion-engineer | video-production, remotion-video, voiceover-gen | Demo videos, B-roll, animated explainers |
| ugc-planner | ugc-scripts, remotion-video, brand-strategy | UGC scripts, camera directions, creator briefs |
| orator | voiceover-gen, whatsapp-outreach | Voiceovers (ElevenLabs), subtitles, WhatsApp audio |
| landing-page-builder | landing-page, brand-strategy | HTML pages, lead forms, Meta Pixel integration |
| seo-content-writer | seo-blog, brand-strategy | Blog articles, keyword research, editorial calendars |

**Workflow:**
```
brand-strategist (guidelines)
         ↓
  ├─→ nano-designer (visuals)
  ├─→ motion-engineer (videos)
  ├─→ ugc-planner (scripts)
  ├─→ orator (voiceovers)
  ├─→ landing-page-builder (pages)
  └─→ seo-content-writer (content)
         ↓
    orchestrator (coordinates)
         ↓
    Unified campaign assets
```

---

### Team 4: SCALERS (3 agents, 4 skills)
**Purpose:** Growth marketing, paid ads, lead generation

| Agent | Skills | Responsibility |
|---|---|---|
| media-buyer | meta-ads-setup | Meta Ads campaigns, audience targeting, budgets, CAPI |
| ab-optimizer | ab-testing | Monitor ROAS/CPA, identify winners, scale/pause |
| lead-scraper | lead-enrichment, serpapi-scraping | Scrape leads, enrich data, score, validate |

**Workflow:**
```
oracle (predictions)
   ↓
media-buyer (campaign setup)
   ├─→ Creative from Content Factory
   ├─→ Audience from deep-researcher
   └─→ Leads from lead-scraper
        ↓
   ab-optimizer (daily optimization)
   └─→ ROAS/CPA monitoring
       Winner scaling
       Loser pausing
```

---

### Team 5: CONVERTERS (2 agents, 2 skills)
**Purpose:** Sales development, lead qualification, nurturing

| Agent | Skills | Responsibility |
|---|---|---|
| sdr | outbound-outreach, whatsapp-outreach, brand-strategy | Email sequences, LinkedIn, cold calls, personalization |
| nurture-bot | lead-nurture | Nurture sequences, objection handling, qualification |

**Workflow:**
```
lead-scraper (qualified leads)
     ↓
sdr (outbound)
 ├─ Email sequences
 ├─ LinkedIn messages
 └─ WhatsApp campaigns
     ↓
nurture-bot (follow-up)
 ├─ Auto-responses
 ├─ Objection handling
 └─ Stage progression
     ↓
pipeline-manager (tracking)
```

---

### Team 6: TRACKER (1 agent, 2 skills)
**Purpose:** Pipeline management, lead tracking, reporting

| Agent | Skills | Responsibility |
|---|---|---|
| pipeline-manager | pipeline-tracker, lead-enrichment | Google Sheets sync, lead staging, daily summaries, 3K tracking |

---

### Team 7: ORCHESTRATOR (1 agent, all skills)
**Purpose:** Cross-team coordination, complex workflows

| Agent | Primary Skill | Responsibility |
|---|---|---|
| orchestrator | All 22 skills | Coordinate teams, spawn agents, manage dependencies |

---

## 🔀 PART 5: SKILL-TO-AGENT DEPENDENCY GRAPH

### How Agents Call Each Other Through Skills

```
                          ORCHESTRATOR
                         (Coordinator)
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            BUILDERS      STRATEGISTS    SCALERS
            (3 agents)     (3 agents)   (3 agents)
                │             │             │
        architect          trend-hunter   media-buyer
         sentry            deep-researcher ab-optimizer
         pr-commander      oracle          lead-scraper
                │             │             │
          ┌─────└─────────────┼─────────────┘
          │                   │
      CODE REVIEW        MARKET INTEL ──→ CAMPAIGN DATA
      SECURITY SCAN      ICP PROFILES
      MODULE DESIGN      LEAD LISTS
                │                           │
                └──────────────┬────────────┘
                               │
                        CONTENT FACTORY
                          (7 agents)
                               │
                    ┌──────────┬──────────┐
                    │          │          │
             brand-strategist  │      landing-page-builder
             nano-designer     │      seo-content-writer
             motion-engineer   │
             ugc-planner       │
             orator            │
                    │          │          │
                    └──────────┴──────────┘
                           │
                   CREATIVE ASSETS
                   (images, videos, copy)
                           │
                           └─────────────────────────┐
                                                     │
                                            CONVERTERS
                                           (2 agents)
                                                │
                                        sdr + nurture-bot
                                                │
                                        PIPELINE MANAGER
                                        (1 agent)
                                                │
                                        DASHBOARD & REPORTS
```

---

## 🎯 PART 6: EXAMPLE WORKFLOWS & CALL ORDERS

### WORKFLOW 1: Full Feature Launch (7 Agents, Sequential)

**Goal:** Launch a new "AI Buyer Matching" feature

**Call Order & Data Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: DESIGN & SECURITY                                      │
└─────────────────────────────────────────────────────────────────┘

1. ARCHITECT (codebase-analysis)
   Input: "Design AI buyer matching module"
   Output: ADR, database schema, API endpoints
   ↓

2. SENTRY (security-audit)
   Input: Module design + API endpoints
   Output: Security scan report, JWT review, data encryption check
   ↓

3. PR-COMMANDER (pr-review)
   Input: Code + design docs
   Output: Code review, performance recommendations, docs

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: MARKET POSITIONING                                     │
└─────────────────────────────────────────────────────────────────┘

4. TREND-HUNTER (trend-analysis)
   Input: Feature scope
   Output: Market pain point analysis, competitive positioning
   ↓

5. DEEP-RESEARCHER (icp-research)
   Input: Market analysis
   Output: Target ICP profiles, firmographic data
   ↓

6. ORACLE (market-prediction)
   Input: Market + ICP data
   Output: Feature impact prediction, adoption forecast

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: CREATIVE PRODUCTION                                    │
└─────────────────────────────────────────────────────────────────┘

7. BRAND-STRATEGIST (brand-strategy)
   Input: Feature details + market insights
   Output: Hinglish messaging, value props, taglines
   ↓

8. NANO-DESIGNER (design-assets)
   Input: Messaging + screenshots
   Output: Ad banners, feature graphics
   ↓

9. MOTION-ENGINEER (video-production)
   Input: Feature scope + script
   Output: Demo video (30-60s)
   ↓

10. LANDING-PAGE-BUILDER (landing-page)
    Input: Messaging + visuals + video
    Output: Feature landing page with lead form
    ↓

11. SEO-CONTENT-WRITER (seo-blog)
    Input: Feature benefits + market pain points
    Output: 3 blog articles (keyword-optimized)

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: MARKETING EXECUTION                                    │
└─────────────────────────────────────────────────────────────────┘

12. MEDIA-BUYER (meta-ads-setup)
    Input: Creatives + landing page + ICP audiences
    Output: Meta ad campaigns (3 ad sets), budgets
    ↓

13. AB-OPTIMIZER (ab-testing)
    Input: Campaigns live
    Output: Monitor ROAS/CPA, optimize daily
    ↓

14. LEAD-SCRAPER (lead-enrichment)
    Input: Ad campaign leads
    Output: Enriched, scored lead list
    ↓

15. SDR (outbound-outreach)
    Input: Qualified leads + messaging
    Output: Personalized email/LinkedIn sequences
    ↓

16. NURTURE-BOT (lead-nurture)
    Input: Lead responses
    Output: Auto-responses, objection handling
    ↓

17. PIPELINE-MANAGER (pipeline-tracker)
    Input: All lead activity
    Output: Real-time pipeline dashboard, daily summaries

┌─────────────────────────────────────────────────────────────────┐
│ EXPECTED OUTPUTS                                                │
└─────────────────────────────────────────────────────────────────┘

✓ Code deployed + security-verified
✓ Ad campaigns live (Meta Ads)
✓ Landing page with form
✓ 3 blog posts published
✓ Demo video uploaded
✓ 100+ leads captured & enriched
✓ Nurture sequences active
✓ Pipeline tracked daily
```

---

### WORKFLOW 2: 3,000 Lead Generation Campaign (8 Phases, Parallel)

**Goal:** RealtyFlow campaign targeting 3,000 leads in 90 days

**Phase Diagram & Execution Order:**

```
                        PHASE 1: BRANDING
                            (Week 1)
                 brand-strategist outputs manifesto
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   PHASE 2a            PHASE 2b            PHASE 3
Landing Page        SEO Blog             Ads Creative
   (Week 2)           (Week 2)            (Week 3)
     │                  │                  │
landing-page      seo-content-writer   nano-designer
        ↓               ↓                   ↓
     Pixel          Keyword research    Image gen
     Forms          Editorial cal.      (DALL-E)
                    4-6 articles            │
                           │           PHASE 4b
                    ┌───────┼──────────────┘
                    │       │
                PHASE 4: Ads + Outbound (Week 4)
                    │       │
        ┌───────────┴───────┴────────────┐
        │           │                    │
    media-buyer  sdr            lead-scraper
     (campaign) (sequences)      (enrichment)
        │           │                    │
        └───────────┴────────────────────┘
                    │
            PHASE 5: Optimization
                    │
            ab-optimizer (daily)
            nurture-bot (auto-responses)
            sdr (follow-up)
                    │
            PHASE 6: Tracking
                    │
            pipeline-manager (daily summaries)
                    │
            PHASE 7: Content Iteration
                    │
        ├─ motion-engineer (videos)
        ├─ orator (voiceovers)
        └─ ugc-planner (UGC scripts)
                    │
            PHASE 8: Reporting
                    │
            oracle (performance predictions)
            ab-optimizer (winner analysis)
            pipeline-manager (funnel report)

TIMELINE DEPENDENCIES:
┌─ Phase 1 (Branding) MUST COMPLETE first
│  ├─→ Phase 2a (Landing Page) - parallel with 2b
│  ├─→ Phase 2b (SEO Blog) - parallel with 2a
│  └─→ Phase 3 (Ads Creative) starts after Phase 1
│       ├─→ Phase 4 (Campaign Launch) - when creatives ready
│       └─→ Phase 6 (Lead Scraping) - starts early
└─ Phase 5-8 run ongoing during campaign

AGENT INVOLVEMENT TIMELINE:
Week 1: brand-strategist
Week 2: landing-page-builder, seo-content-writer
Week 3: nano-designer, motion-engineer, ugc-planner, orator
Week 4: media-buyer, sdr, lead-scraper, deep-researcher
Week 5+: ab-optimizer, nurture-bot, pipeline-manager (daily)
```

---

### WORKFLOW 3: Daily A/B Test Optimization (Real-Time)

**Goal:** Monitor and optimize Meta ad performance hourly

**Real-Time Call Flow:**

```
ab-optimizer (every 6 hours)
│
├─ 1. Pull metrics from Meta Marketing API
│  ├─ CPA per ad set
│  ├─ ROAS by audience
│  ├─ CTR and frequency
│  └─ Impressions/spend
│
├─ 2. Classify ad sets into tiers
│  ├─ TIER 1 (CPA < Target × 0.8) → "SCALE"
│  │  └─ Action: +20% budget increase
│  ├─ TIER 2 (CPA between 0.8-1.5x) → "MAINTAIN"
│  │  └─ Action: test new creatives
│  ├─ TIER 3 (CPA between 1.5-3.0x) → "OPTIMIZE"
│  │  └─ Action: swap creatives, adjust audience
│  └─ TIER 4 (CPA > 3.0x OR $100+ spend, 0 conversions) → "KILL"
│     └─ Action: PAUSE immediately
│
├─ 3. Detect creative fatigue
│  ├─ Frequency > 3.0 → prepare new creative
│  ├─ Frequency > 5.0 → FORCE creative replacement
│  └─ CTR declined 3 days straight → refresh hooks
│
├─ 4. Log actions & learnings
│  └─ Output: "Daily Optimization Report"
│
└─ 5. Trigger dependent agents as needed
   ├─ IF creative fatigue → nano-designer for new banners
   ├─ IF hook underperformance → ugc-planner for new scripts
   ├─ IF audience issue → deep-researcher for audience refresh
   └─ IF scaling needed → media-buyer for new ad sets

RESULT OUTPUT:
├─ Paused TIER 4 ad sets (stop wasting $$)
├─ Scaled TIER 1 budgets (+20%)
├─ Queued new creatives for TIER 2/3
└─ Daily report: "Optimized X ad sets, saved $Y, added Z leads"
```

---

## 📈 PART 7: SKILL CALL SEQUENCE EXAMPLES

### Example 1: Ad Banner Creation Flow

**Agent Sequence: nano-designer → image-generation → orchestrator**

```markdown
# SEQUENCE: Create ad banner for Meta campaign

1. INPUT: Campaign brief
   - Campaign: "CRM for Agents"
   - Pain point: "Spreadsheet chaos"
   - CTA: "Start free trial"
   - Size: 1200×628 (Facebook feed)

2. NANO-DESIGNER (design-assets skill)
   - Creates AI image prompt
   - Example prompt:
     "Professional real estate dashboard interface, 
      clean UI with blue accents, agent working on laptop, 
      modern office setting, warm lighting, SaaS style"

3. IMAGE-GENERATION (uses generate-image.ps1 script)
   .\scripts\generate-image.ps1 `
     -Provider "openai" `
     -Prompt "[prompt from step 2]" `
     -Size "1200x628" `
     -Output "banner_v1.png"

4. NANO-DESIGNER adds text overlay via design-assets skill
   - Headline: "Aapki Agency, Aapka Control"
   - Subheadline: "Leads se deals tak — RealtyFlow"
   - CTA: "Free Trial →"
   - Colors: Primary (#2563EB), Text (#FFFFFF)

5. OUTPUT: PNG banner ready for Meta Ads

AGENTS INVOLVED: nano-designer (primary), image-generation (skill)
TOOLS USED: design-assets (spec creation), image-generation (script)
DEPENDENCIES: orchestrator may queue multiple banners in parallel
```

---

### Example 2: Email Sequence Creation Flow

**Agent Sequence: sdr → brand-strategy → nurture-bot**

```markdown
# SEQUENCE: Create outbound email sequence for leads

1. INPUT: Lead list + ICP data
   - Source: lead-scraper (enriched leads)
   - ICP: Mumbai agencies, 5-50 employees
   - Pain point: "WhatsApp lead chaos"

2. SDR agent (outbound-outreach skill)
   - Writes 5-email sequence:
     Email 1 (Day 0): The Insight
     Email 2 (Day 3): Social Proof
     Email 3 (Day 7): The Question
     Email 4 (Day 10): Breakup Warning
     Email 5 (Day 14): Value Drop

3. BRAND-STRATEGIST (brand-strategy skill)
   - Ensures Hinglish tone consistency
   - Validates messaging against brand voice
   - Example: "Aapki Agency, Aapka Control" theme carries through

4. SDR personalizes with data
   - Variable substitution:
     [Company name] from enriched data
     [Specific pain point] from lead scoring
     [Local reference] from city data
   
5. NURTURE-BOT (lead-nurture skill)
   - Designs auto-responses
   - Objection response templates
   - Stage-based follow-up triggers

6. OUTPUT: Sequence ready for email platform
   - Template: 5 emails + auto-responses
   - Personalization variables: [Company], [FirstName], [Pain]
   - Scheduling: Day 0, 3, 7, 10, 14

AGENTS INVOLVED: sdr (primary), brand-strategist (validation), nurture-bot (responses)
TOOLS USED: outbound-outreach, brand-strategy, lead-nurture
DEPENDENCIES: Lead data must come from lead-scraper first
```

---

### Example 3: Video Production Pipeline

**Agent Sequence: motion-engineer → voiceover-gen → orator**

```markdown
# SEQUENCE: Create demo video with voiceover

1. INPUT: Product demo script + timing marks
   [0:00] "Stop wasting time in WhatsApp"
   [0:03] "Track 100+ leads in one place"
   [0:15] "Close 40% more deals"
   [0:30] "RealtyFlow — your real estate CRM"

2. MOTION-ENGINEER (video-production skill)
   - Creates storyboard:
     0:00-0:03: Problem hook (WhatsApp chaos)
     0:03-0:15: Product demo (screen recording)
     0:15-0:30: Results (metrics + testimonial)
   - Uses render-remotion.ps1:
     .\scripts\render-remotion.ps1 `
       -Composition "DemoVideo" `
       -Duration "30s" `
       -Output "demo.mp4"

3. ORATOR (voiceover-gen skill)
   - Selects voice profile: "Priya" (energetic female)
   - Voice settings:
     stability: 0.5
     similarity_boost: 0.75
     style: 0.3
   
4. ORATOR calls elevenlabs-tts.ps1 script:
   .\scripts\elevenlabs-tts.ps1 `
     -VoiceId "professional-female-en" `
     -Text "[Script from step 1]" `
     -Output "voiceover.mp3"

5. ORATOR post-processes audio (voiceover-gen skill)
   ffmpeg -i voiceover.mp3 \
     -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
     normalized.mp3

6. MOTION-ENGINEER composites video + audio
   ffmpeg -i demo.mp4 -i voiceover.mp3 \
     -c:v copy -map 0:v:0 -map 1:a:0 \
     -shortest final_demo.mp4

7. ORATOR creates subtitles (SRT format)
   - English subs in subs_en.srt
   - Hindi option in subs_hi.srt

8. OUTPUT: 
   - final_demo.mp4 (video + voiceover + music)
   - subs_en.srt (subtitle file)
   - final_subtitled.mp4 (with burned-in subs)

AGENTS INVOLVED: motion-engineer (primary), orator (voiceover)
TOOLS/SKILLS USED: video-production, voiceover-gen, remotion-video
SCRIPTS CALLED: render-remotion.ps1, elevenlabs-tts.ps1
```

---

## 🗺️ PART 8: AGENT DEPENDENCY MATRIX (Who Depends on Whom)

### INPUTS & OUTPUTS MAPPING

| Agent | Requires Input From | Outputs For | Critical Path |
|---|---|---|---|
| **architect** | None (design from brief) | pr-commander, sentry | Code → Review → Security |
| **sentry** | architect | pr-commander, merge decision | Design → Audit → Approval |
| **pr-commander** | architect, sentry | merge decision | Review all changes |
| **trend-hunter** | Industry data (public) | deep-researcher, oracle | Market intel foundation |
| **deep-researcher** | trend-hunter | oracle, media-buyer, sdr | Market → ICP → Targeting |
| **oracle** | trend-hunter, deep-researcher, past performance | media-buyer, ab-optimizer | Predictions → Strategy |
| **brand-strategist** | Project brief | All Content Factory agents | Guidelines for consistency |
| **nano-designer** | brand-strategist, oracle | media-buyer, landing-page-builder | Visuals for campaigns |
| **motion-engineer** | brand-strategist, ugc-planner | media-buyer, ab-optimizer, seo-content-writer | Video assets for ads/content |
| **ugc-planner** | brand-strategist, oracle | motion-engineer, media-buyer | Scripts for video production |
| **orator** | motion-engineer, sdr | media-buyer, nurture-bot | Voiceovers for videos/messages |
| **landing-page-builder** | brand-strategist, nano-designer | media-buyer, seo-content-writer | Page for lead capture |
| **seo-content-writer** | brand-strategist, trend-hunter | media-buyer, seo-content-writer | Content for organic + distribution |
| **media-buyer** | nano-designer, motion-engineer, landing-page-builder, deep-researcher | ab-optimizer, lead-scraper | Campaigns live |
| **ab-optimizer** | media-buyer (campaigns live) | nano-designer (new creatives), lead-scraper, sdr | Continuous optimization |
| **lead-scraper** | media-buyer, ab-optimizer, seo-content-writer | sdr, nurture-bot, pipeline-manager | Leads for outreach |
| **sdr** | lead-scraper, brand-strategist | nurture-bot, pipeline-manager | Outbound sequences |
| **nurture-bot** | lead-scraper, sdr | pipeline-manager | Follow-up automation |
| **pipeline-manager** | lead-scraper, sdr, nurture-bot, media-buyer | Final reporting | Real-time tracking |
| **orchestrator** | All agents | All teams | Coordinates everything |

---

## 🔗 PART 9: FILE OWNERSHIP & AGENT ACCESS

### Directory Access by Agent

| Team | Agent | Read Access | Write Access |
|---|---|---|---|
| **Builders** | architect | `/real-estate-crm-app/src/`, `/server/`, `/.env.example` | `/server/`, `/real-estate-crm-app/src/` |
| | sentry | `/real-estate-crm-app/src/`, `/server/`, `/ai-calling-service/` | None (read-only) |
| | pr-commander | All changed files | `ARCHITECTURE.md`, `README.md`, docs |
| **Strategists** | trend-hunter | `/marketing-and-sales/research/`, Twitter/Reddit (external) | `/marketing-and-sales/research/trends-*.md` |
| | deep-researcher | `DynamoDB tables`, LinkedIn, property portals | `/marketing-and-sales/research/icp-*.md`, `/marketing-and-sales/research/leads-*.csv` |
| | oracle | Past performance data, market data | `/marketing-and-sales/reports/predictions/` |
| **Content Factory** | brand-strategist | Project brief, brand docs | `/marketing-and-sales/creative/brand/` |
| | nano-designer | `/marketing-and-sales/creative/brand/` | `/marketing-and-sales/creative/assets/images/` |
| | motion-engineer | Scripts, brand guidelines | `/marketing-and-sales/creative/video/` |
| | ugc-planner | Brand guidelines, target audience | `/marketing-and-sales/creative/ugc-scripts/` |
| | orator | Scripts, voiceover briefs | `/marketing-and-sales/creative/audio/` |
| | landing-page-builder | Brand guidelines, messaging | `/marketing-and-sales/creative/landing-pages/` |
| | seo-content-writer | Brand guidelines, keyword research | `/marketing-and-sales/creative/blog/` |
| **Scalers** | media-buyer | Creative assets, audience data, budgets | `/marketing-and-sales/ads/campaigns/` |
| | ab-optimizer | Campaign data, Meta Ads API | `/marketing-and-sales/ads/reports/` |
| | lead-scraper | Public data sources, ad campaigns | `/marketing-and-sales/leads/` |
| **Converters** | sdr | Lead data, brand guidelines | `/marketing-and-sales/outreach/sequences/` |
| | nurture-bot | Lead data, sequences | `/marketing-and-sales/sequences/` |
| **Tracker** | pipeline-manager | All lead/pipeline data | `/marketing-and-sales/leads/pipeline.*`, `Google Sheets` |
| **Coordinator** | orchestrator | Everything (can delegate) | Everything (can delegate) |

---

## 🎯 PART 10: ORCHESTRATOR DELEGATION PATTERNS

### When to Use Orchestrator for Multi-Team Tasks

| Task Type | Agents to Spawn | Pattern | Example |
|---|---|---|---|
| **Feature Launch** | architect → sentry → pr-commander → (all Content Factory) → (all Scalers) | Sequential then parallel | "Launch AI Buyer Matching" |
| **Campaign Sprint** | oracle → nano-designer → motion-engineer → media-buyer → ab-optimizer | Linear pipeline | "Q2 growth campaign" |
| **Lead Generation** | deep-researcher → media-buyer → lead-scraper → sdr → nurture-bot → pipeline-manager | Funnel flow | "3K lead RealtyFlow campaign" |
| **Content Week** | brand-strategist → (Content Factory) → seo-content-writer | Hub-and-spoke | "Weekly content batch" |
| **Emergency Security** | sentry → architect → pr-commander | Immediate priority | "JWT vulnerability found" |
| **Market Analysis** | trend-hunter → deep-researcher → oracle | Sequential intel gathering | "Competitive response strategy" |

---

## 📋 PART 11: ORCHESTRATOR SKILL REGISTRY

### All Skills Available to Orchestrator

The orchestrator has access to **all 22 skills** for delegation:

```
Engineering (3):
  ✓ codebase-analysis
  ✓ security-audit
  ✓ pr-review

Market Intel (3):
  ✓ trend-analysis
  ✓ icp-research
  ✓ market-prediction

Creative (9):
  ✓ brand-strategy
  ✓ design-assets
  ✓ image-generation
  ✓ remotion-video
  ✓ video-production
  ✓ voiceover-gen
  ✓ ugc-scripts
  ✓ landing-page
  ✓ seo-blog
  ✓ whatsapp-outreach

Growth (4):
  ✓ meta-ads-setup
  ✓ ab-testing
  ✓ lead-enrichment
  ✓ serpapi-scraping

Sales (2):
  ✓ outbound-outreach
  ✓ lead-nurture

Operations (1):
  ✓ pipeline-tracker
```

---

## 💡 PART 12: KEY TAKEAWAYS & BEST PRACTICES

### Agent Team Coordination Rules

1. **Sequential Dependencies** — Don't run parallel if downstream depends on upstream
   - ❌ Don't: Run media-buyer and lead-scraper simultaneously (scraper needs audience data)
   - ✓ Do: Run deep-researcher first, then media-buyer

2. **File Ownership** — Respect team directories
   - ❌ Don't: sdr writing to `/marketing-and-sales/ads/` (media-buyer's territory)
   - ✓ Do: sdr writes to `/marketing-and-sales/outreach/`

3. **Skill Chaining** — Use orchestrator when tasks span multiple teams
   - ❌ Don't: Manually spawn architect, then sentry, then pr-commander
   - ✓ Do: Use orchestrator to coordinate all three in sequence

4. **Memory Updates** — Record learnings for future conversations
   - ✓ Always update agent memory after completing complex tasks
   - Examples: winning hooks, CPA benchmarks, conversion rates, content performance

5. **Budget Safety** — media-buyer has validation hooks
   - ✓ Validate budget limits before scaling
   - ✓ Never scale more than 20% per 48 hours

6. **Quality Gates** — Don't skip reviews
   - ✓ architect → sentry → pr-commander (always all three)
   - ✓ Content Factory → orchestrator before deployment

### Common Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Better Approach |
|---|---|---|
| Running SDR before lead-scraper | No enriched leads to personalize | Scrape & enrich first, then SDR |
| Parallel architect + deep-researcher | They need each other's outputs | architect → deep-researcher for ICP validation |
| Skipping sentry security scan | Vulnerabilities ship to production | architect → sentry (mandatory) |
| Nurture-bot without brand-strategist | Inconsistent messaging | brand-strategist first → all Content Factory |
| ab-optimizer without media-buyer data | No campaigns to optimize | media-buyer launches → ab-optimizer monitors |

---

## 📞 PART 13: QUICK REFERENCE GUIDE

### "I Need to..." (Quick Lookup)

| Need | Primary Agent | Helper Agents |
|---|---|---|
| Design a new CRM module | architect | sentry, pr-commander |
| Find market pain points | trend-hunter | deep-researcher, oracle |
| Build an ICP | deep-researcher | trend-hunter, oracle |
| Create ad banners | nano-designer | brand-strategist, motion-engineer |
| Produce a demo video | motion-engineer | orator, ugc-planner |
| Write a landing page | landing-page-builder | brand-strategist, nano-designer |
| Write a blog post | seo-content-writer | brand-strategist, nano-designer |
| Launch Meta ads | media-buyer | nano-designer, motion-engineer, deep-researcher |
| Optimize campaigns daily | ab-optimizer | nano-designer (for new creatives), lead-scraper |
| Enrich leads | lead-scraper | deep-researcher (for ICP scoring) |
| Send outbound campaigns | sdr | brand-strategist, lead-scraper |
| Nurture captured leads | nurture-bot | sdr, lead-scraper |
| Track pipeline | pipeline-manager | lead-scraper, sdr, nurture-bot |
| Coordinate multiple teams | orchestrator | All agents |

---

## 🎓 PART 14: AGENT SKILL DEPTH BY CATEGORY

### Engineering (3 agents, 3 skills)
- **Depth:** Deep technical expertise
- **Time/Complexity:** 20-30 min per task, high expertise
- **Output Quality:** Production-ready code + docs

### Market Intelligence (3 agents, 3 skills)
- **Depth:** Data-driven research & analysis
- **Time/Complexity:** 30-45 min per task, moderate expertise
- **Output Quality:** Actionable insights + data backing

### Content Production (7 agents, 9 skills)
- **Depth:** Creative + technical (writing, design, video, audio)
- **Time/Complexity:** 15-45 min per asset, diverse expertise
- **Output Quality:** Varied (copy, images, videos, audio)

### Growth (3 agents, 4 skills)
- **Depth:** Performance marketing + data enrichment
- **Time/Complexity:** 10-20 min for daily optimization, higher for setup
- **Output Quality:** Real-time optimized campaigns + enriched leads

### Sales (2 agents, 2 skills)
- **Depth:** Copy + qualification logic
- **Time/Complexity:** 15-30 min per sequence, high personalization
- **Output Quality:** Conversion-optimized templates

### Operations (1 agent, 2 skills)
- **Depth:** Pipeline automation + reporting
- **Time/Complexity:** 5-15 min daily, real-time syncing
- **Output Quality:** Real-time dashboards + summaries

---

## 🚀 CONCLUSION

This ecosystem of **20 agents and 22 skills** enables:
- ✅ Coordinated feature launches
- ✅ Multi-channel marketing campaigns
- ✅ Real-time ad optimization
- ✅ Scalable lead generation (targeting 100k leads)
- ✅ Automated sales workflows
- ✅ Complete audit trail and reporting

**Key Insight:** The **orchestrator agent** is essential for any task spanning multiple teams. Use it to manage dependencies, coordinate parallel work, and maintain quality gates across all phases.

---

**END OF ANALYSIS**
