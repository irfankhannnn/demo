# Cloudberry Agents & Skills: Visual Reference Guide
**Quick lookup diagrams, tables, and flowcharts**

---

## TABLE 1: MASTER AGENT REGISTRY (Sortable)

```
┌─────┬──────────────────┬─────────────┬──────────────────────────┬────────────────┐
│ ID  │ Agent Name       │ Team        │ Primary Skill            │ Max Turns      │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ A1  │ architect        │ Builders    │ codebase-analysis        │ 30             │
│ A2  │ sentry           │ Builders    │ security-audit           │ 25             │
│ A3  │ pr-commander     │ Builders    │ pr-review                │ 25             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ S1  │ trend-hunter     │ Strategists │ trend-analysis           │ 30             │
│ S2  │ deep-researcher  │ Strategists │ icp-research             │ 35             │
│ S3  │ oracle           │ Strategists │ market-prediction        │ 25             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ C1  │ brand-strategist │ Content     │ brand-strategy           │ 20             │
│ C2  │ nano-designer    │ Content     │ design-assets            │ 25             │
│ C3  │ motion-engineer  │ Content     │ video-production         │ 25             │
│ C4  │ ugc-planner      │ Content     │ ugc-scripts              │ 20             │
│ C5  │ orator           │ Content     │ voiceover-gen            │ 20             │
│ C6  │ landing-page-*   │ Content     │ landing-page             │ 25             │
│ C7  │ seo-content-*    │ Content     │ seo-blog                 │ 30             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ G1  │ media-buyer      │ Scalers     │ meta-ads-setup           │ 30             │
│ G2  │ ab-optimizer     │ Scalers     │ ab-testing               │ 25             │
│ G3  │ lead-scraper     │ Scalers     │ lead-enrichment          │ 30             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ CV1 │ sdr              │ Converters  │ outbound-outreach        │ 25             │
│ CV2 │ nurture-bot      │ Converters  │ lead-nurture             │ 25             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ T1  │ pipeline-manager │ Trackers    │ pipeline-tracker         │ 25             │
├─────┼──────────────────┼─────────────┼──────────────────────────┼────────────────┤
│ O1  │ orchestrator     │ Coordinator │ All 22 skills            │ 50             │
└─────┴──────────────────┴─────────────┴──────────────────────────┴────────────────┘
```

---

## TABLE 2: AGENT SKILLS MATRIX (Who Has Access to Which Skills)

```
Agent                    │ Skill 1           │ Skill 2           │ Skill 3           │ Skill 4
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
architect                │ codebase-analysis │                   │                   │
sentry                   │ security-audit    │                   │                   │
pr-commander             │ pr-review         │                   │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
trend-hunter             │ trend-analysis    │                   │                   │
deep-researcher          │ icp-research      │                   │                   │
oracle                   │ market-prediction │                   │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
brand-strategist         │ brand-strategy    │                   │                   │
nano-designer            │ design-assets     │ image-generation  │ remotion-video    │
motion-engineer          │ video-production  │ remotion-video    │ voiceover-gen     │
ugc-planner              │ ugc-scripts       │ remotion-video    │ brand-strategy    │
orator                   │ voiceover-gen     │ whatsapp-outreach │                   │
landing-page-builder     │ landing-page      │ brand-strategy    │                   │
seo-content-writer       │ seo-blog          │ brand-strategy    │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
media-buyer              │ meta-ads-setup    │                   │                   │
ab-optimizer             │ ab-testing        │                   │                   │
lead-scraper             │ lead-enrichment   │ serpapi-scraping  │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
sdr                      │ outbound-outreach │ whatsapp-outreach │ brand-strategy    │
nurture-bot              │ lead-nurture      │                   │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
pipeline-manager         │ pipeline-tracker  │ lead-enrichment   │                   │
─────────────────────────┼───────────────────┼───────────────────┼───────────────────┼─────────────
orchestrator             │ ALL 22 SKILLS (delegation available)   │                   │
```

---

## TABLE 3: SKILLS TO AGENTS REVERSE MAP

```
Skill Name              │ Primary Agent(s)        │ Also Available To
────────────────────────┼─────────────────────────┼───────────────────────
codebase-analysis       │ architect               │ orchestrator
security-audit          │ sentry                  │ orchestrator
pr-review               │ pr-commander            │ orchestrator
trend-analysis          │ trend-hunter            │ orchestrator
icp-research            │ deep-researcher         │ orchestrator
market-prediction       │ oracle                  │ orchestrator
brand-strategy          │ brand-strategist        │ sdr, ugc-planner, landing-page-*, seo-content-*, orchestrator
design-assets           │ nano-designer           │ orchestrator
image-generation        │ nano-designer           │ orchestrator
remotion-video          │ nano-designer, motion-engineer, ugc-planner │ orchestrator
video-production        │ motion-engineer         │ orchestrator
voiceover-gen           │ orator, motion-engineer │ orchestrator
ugc-scripts             │ ugc-planner             │ orchestrator
landing-page            │ landing-page-builder    │ orchestrator
seo-blog                │ seo-content-writer      │ orchestrator
whatsapp-outreach       │ orator, sdr             │ orchestrator
meta-ads-setup          │ media-buyer             │ orchestrator
ab-testing              │ ab-optimizer            │ orchestrator
lead-enrichment         │ lead-scraper, pipeline-manager │ orchestrator
serpapi-scraping        │ lead-scraper            │ orchestrator
outbound-outreach       │ sdr                     │ orchestrator
lead-nurture            │ nurture-bot             │ orchestrator
pipeline-tracker        │ pipeline-manager        │ orchestrator
```

---

## DIAGRAM 1: AGENT TEAM STRUCTURE (Hierarchical)

```
                          COMPANY LEADERSHIP
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼────────┐   │   ┌────────▼────────┐
            │   Builders     │   │   │   Orchestrator  │
            │   (3 agents)   │   │   │ (1 coordinator) │
            └────────────────┘   │   └─────────────────┘
                    │            │
         ┌──────────┼──────┐     │
         │          │      │     │
    architect    sentry pr-cmdr  │
         │          │      │     │
         └──────────┼──────┘     │
                    │            │
         ┌──────────┴───┬────────┴──┬───────────┐
         │              │           │           │
    ┌────▼─────┐  ┌─────▼──┐  ┌────▼────┐ ┌───▼────┐
    │Strategists│ │Content  │  │ Scalers │ │Trackers│
    │ (3)      │  │Factory │  │  (3)    │ │  (1)   │
    └──────────┘  │  (7)    │  └─────────┘ └────────┘
         │        │         │      │
    ├────┼────┐   │    ┌────┼──┐   │
    │    │    │   │    │    │  │   │
 trend-H deep-re oracle │    │  │ media-  ab-opt. lead-
        │    │   │    │    │  │ buyer         scraper
         └────┘   │    │    │  │   │              │
                  │    │    │  │   └──────────────┘
            ┌─────┴─┐  │    │  │
            │       │  │    │  │
         brand- nano-  motion  ugc    orator landing  seo-
         strat. desig  engr.   planner         page   content
            │       │  │    │  │              │       │
            └───────┴──┴────┴──┴──────────────┴───────┘
                          │
                   ┌──────┴────┐
                   │           │
                ┌──▼─────┐ ┌───▼────┐
                │Converters│ │  │(2) │
                └──────────┘ │      │
                   │         │      │
                sdr + nurture-bot
```

---

## DIAGRAM 2: DATA FLOW FOR LEAD GENERATION CAMPAIGN

```
                    START: RealtyFlow Campaign
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            ┌───▼────┐   ┌────▼────┐  ┌───▼──┐
            │Branding│   │Market    │  │ICP   │
            │(Week 1)│   │Intel     │  │Anal. │
            │        │   │(Week 1-2)│  │      │
            └───┬────┘   └────┬─────┘  └───┬──┘
                │             │            │
        ┌───────┴─────────────┼────────────┘
        │                     │
    ┌───▼────┐        ┌───────▼────────┐
    │Messaging│       │Audience Profil.│
    │& Tagline│       │& Firmographics │
    └───┬────┘       └────┬───────────┘
        │                  │
        └──────────┬───────┘
                   │
        ┌──────────▼──────────┐
        │  Content Production  │
        │  (Weeks 2-3)        │
        ├──────────┬──────────┤
        │          │          │
    ┌───▼──┐ ┌────▼─┐ ┌──────▼──┐
    │Ads   │ │Video │ │Landing  │
    │Images│ │&Audio│ │Pages    │
    └───┬──┘ └────┬─┘ └──────┬──┘
        │         │          │
        └────┬────┴────┬─────┘
             │         │
        ┌────▼─────────▼────┐
        │  Media Buyer      │
        │  Launch Campaign  │
        │  (Week 4)         │
        └────┬──────────────┘
             │
        ┌────▼─────────────────┐
        │ Lead Scraper          │
        │ Enrich & Score Leads  │
        └────┬──────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──┐         ┌────▼────┐
│ SDR  │         │Nurture  │
│Outbound│       │Bot      │
└───┬──┘         └────┬────┘
    │                 │
    └────────┬────────┘
             │
        ┌────▼──────────────┐
        │ Pipeline Manager   │
        │ Track & Report     │
        └────────────────────┘
             │
        [3,000 LEADS TARGET]
```

---

## DIAGRAM 3: REAL-TIME AD OPTIMIZATION LOOP

```
                    CAMPAIGN RUNNING
                         │
                    ┌────▼────┐
                    │6-hourly  │
                    │ab-optim. │
                    │pull data │
                    └────┬─────┘
                         │
                    ┌────▼──────────────────┐
                    │ Classify Ad Sets      │
                    ├──────────┬──────┬─────┤
                    │          │      │     │
              ┌─────▼──┐  ┌────▼─┐ ┌─▼──┐ ┌▼────┐
              │ TIER 1 │  │TIER 2│ │TIER3│ │TIER4│
              │ SCALE  │  │ HOLD │ │OPT. │ │KILL │
              └──┬─────┘  └──┬───┘ └─┬───┘ └─┬───┘
                 │           │       │       │
              +20%        Test   Adjust  PAUSE
              budget      new    audience Adset
                        creatives  mix
                 │           │       │       │
              ┌──▼───────────▼───────▼───────▼──┐
              │    Action Log                   │
              │  Save optimization metrics      │
              │  Track learnings               │
              └──┬────────────────────────────┬─┘
                 │                            │
          ┌──────▼──────┐            ┌────────▼──────┐
          │Queue new    │            │Update         │
          │creatives?   │            │performance    │
          │ → nano-des. │            │report         │
          └─────────────┘            └────────────────┘
                 │                        │
                 └────────────┬───────────┘
                              │
                       [Back to 6h Loop]
```

---

## DIAGRAM 4: CONTENT FACTORY COORDINATION HUB

```
                    Brand Strategist
                   (Brand Guidelines)
                          │
          ┌───────────────┼────────────────┐
          │               │                │
      ┌───▼────┐    ┌─────▼───┐    ┌──────▼──┐
      │Taglines│    │Tone of  │    │Hinglish │
      │& Moto │    │Voice    │    │Keywords │
      └───┬────┘    └────┬────┘    └──────┬──┘
          │              │                │
          └──────────────┼────────────────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
   ┌──▼────┐        ┌────▼────┐      ┌─────▼──┐
   │Nano-  │        │Motion-  │      │Landing-│
   │Design │        │Engineer │      │Page    │
   │(Images)        │(Videos) │      │Builder │
   └──┬────┘        └────┬────┘      └────┬───┘
      │                  │                │
      │            ┌─────▼────┐           │
      │            │Orator    │           │
      │            │(Voiceover)           │
      │            └─────┬────┘           │
      │                  │                │
      └─────────────┬────┴────────────────┘
                    │
         ┌──────────▼────────────┐
         │   UGC Planner         │
         │   (Scripts & Camera)  │
         └──────────┬────────────┘
                    │
         ┌──────────▼────────────┐
         │ SEO Content Writer     │
         │ (Blog Articles)        │
         └──────────┬────────────┘
                    │
         [UNIFIED CREATIVE ASSETS]
                    │
         Ready for distribution:
         ├─ Social Media
         ├─ Meta Ads
         ├─ Email
         └─ Landing Pages
```

---

## DIAGRAM 5: SKILL DEPENDENCY TREE (Remotion Video as Example)

```
                    remotion-video skill
                           │
                ┌──────────┼──────────┐
                │          │          │
         ┌──────▼──┐  ┌────▼───┐  ┌──▼───┐
         │nano-    │  │motion- │  │ugc-  │
         │designer │  │engr.   │  │plan. │
         └──┬──────┘  └───┬────┘  └──┬───┘
            │             │          │
            └─────────────┼──────────┘
                          │
            [remotion-video generates...]
                          │
                ┌─────────┴──────────┐
                │                    │
          ┌─────▼────┐        ┌──────▼──┐
          │PNG Stills│        │MP4 Video│
          │(for ads) │        │(for ads)│
          └─────┬────┘        └──────┬──┘
                │                    │
                └──────────┬─────────┘
                           │
                      ORCHESTRATOR
                           │
                ┌──────────┼──────────┐
                │          │          │
             ┌──▼──┐  ┌────▼───┐  ┌──▼───┐
             │media │  │ab-opt. │  │seo-  │
             │buyer │  │monitor │  │writer│
             └──────┘  └────────┘  └──────┘
```

---

## TABLE 4: SCRIPT FILES & THEIR AGENTS

```
Script File               │ Primary Agent    │ Skill Used         │ Purpose
──────────────────────────┼──────────────────┼────────────────────┼──────────────────
generate-image.ps1        │ nano-designer    │ image-generation   │ DALL-E/Gemini AI
render-remotion.ps1       │ motion-engineer  │ remotion-video     │ Video rendering
elevenlabs-tts.ps1        │ orator           │ voiceover-gen      │ Text-to-speech
serpapi-scrape.ps1        │ lead-scraper     │ serpapi-scraping   │ Lead scraping
sheets-update.ps1         │ pipeline-manager │ pipeline-tracker   │ Google Sheets sync
validate-security-scan.sh │ sentry           │ security-audit     │ Security hooks
validate-readonly.sh      │ trend-hunter,... │ research skills    │ Read-only enforce
run-lint-check.sh         │ pr-commander     │ pr-review          │ Code quality
validate-ad-budget.sh     │ media-buyer      │ meta-ads-setup     │ Budget safety
```

---

## TABLE 5: AGENT TOOLS ACCESS (Read/Write/Edit Permissions)

```
Agent                │ Read   │ Write  │ Edit   │ Bash   │ Grep   │ Glob
─────────────────────┼────────┼────────┼────────┼────────┼────────┼──────
architect            │ ✓      │ ✓      │ ✓      │ ✓      │ ✓      │ ✓
sentry               │ ✓      │ ✗      │ ✗      │ ✓      │ ✓      │ ✓
pr-commander         │ ✓      │ ✓      │ ✓      │ ✓      │ ✓      │ ✓
trend-hunter         │ ✓      │ ✓      │ ✓      │ ✓      │ ✓      │ ✗
deep-researcher      │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
oracle               │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
brand-strategist     │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
nano-designer        │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
motion-engineer      │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
ugc-planner          │ ✓      │ ✓      │ ✗      │ ✗      │ ✗      │ ✗
orator               │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
landing-page-builder │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
seo-content-writer   │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
media-buyer          │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
ab-optimizer         │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
lead-scraper         │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
sdr                  │ ✓      │ ✓      │ ✗      │ ✓      │ ✗      │ ✗
nurture-bot          │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
pipeline-manager     │ ✓      │ ✓      │ ✗      │ ✓      │ ✓      │ ✗
orchestrator         │ ✓      │ ✓      │ ✓      │ ✓      │ ✓      │ ✓
```

---

## TABLE 6: TEAM MEETING SCHEDULE (Recommended Cadence)

```
Team                │ Meeting Type    │ Frequency      │ Attendees
────────────────────┼─────────────────┼────────────────┼──────────────────
Builders            │ Code Review     │ Pre-merge      │ architect, sentry, pr-cmdr
Builders            │ Security Audit  │ Post-merge     │ sentry, architect
Strategists         │ Market Sync     │ Weekly         │ trend-hunter, deep-resear, oracle
Content Factory     │ Creative Sync   │ 2x Weekly      │ All 7 agents
Scalers             │ Growth Standup  │ Daily (10min)  │ media-buyer, ab-opt, lead-scraper
Converters          │ Sales Sync      │ Weekly         │ sdr, nurture-bot
All Teams           │ Campaign Review │ Monthly        │ Orchestrator + all agents
```

---

## TABLE 7: QUALITY GATES & CHECKPOINTS

```
Stage           │ Owner          │ Checklist
────────────────┼────────────────┼─────────────────────────────────────
Design Review   │ architect      │ ✓ ADR created, ✓ Schema approved
Security Scan   │ sentry         │ ✓ No OWASP, ✓ Auth reviewed, ✓ Keys safe
PR Review       │ pr-commander   │ ✓ Code quality, ✓ Performance, ✓ Tests
Brand Review    │ brand-strat    │ ✓ Hinglish consistent, ✓ Messaging aligned
Creative QA     │ nano-designer  │ ✓ Specs met, ✓ Sizing correct, ✓ Brand colors
Copy Review     │ seo-content-*  │ ✓ Grammar, ✓ Brand voice, ✓ Keywords
Campaign Launch │ media-buyer    │ ✓ Pixel verified, ✓ Budgets set, ✓ Audiences created
Lead Quality    │ lead-scraper   │ ✓ <5% dupes, ✓ 90% emails valid, ✓ Scores assigned
Conversion QA   │ sdr            │ ✓ Sequences tested, ✓ Links working, ✓ Personalization
Report Accuracy │ pipeline-mgr   │ ✓ No data loss, ✓ Stages accurate, ✓ Metrics verified
```

---

## QUICK COMMAND REFERENCE

### Spawning Agents via Orchestrator

```bash
# Example: Spawn architect for module design
orchestrator(
  "Design a new 'lead scoring' module. Output: ADR + schema + API endpoints."
)

# Example: Spawn content factory team for campaign
orchestrator(
  "Launch RealtyFlow campaign. Coordinate: brand-strategist → 
   landing-page-builder → nano-designer → seo-content-writer → 
   sdr for email sequences."
)

# Example: Real-time optimization
ab-optimizer(
  "Monitor campaign CONV_BROAD-REALESTATE_IN_20250207_V1. 
   Report: which ad sets to scale/pause. Daily at 6:00 IST."
)
```

---

## KEY METRICS BY AGENT

| Agent | Primary KPI | Target | Frequency |
|---|---|---|---|
| architect | Code coverage | >80% | Per PR |
| sentry | Vulnerability count | 0 critical | Weekly |
| pr-commander | Review time | <1 day | Per PR |
| trend-hunter | Trend signals | 5+ per week | Weekly |
| deep-researcher | ICP accuracy | >85% match | Monthly |
| oracle | Prediction accuracy | >70% | Quarterly |
| brand-strategist | Message resonance | >60% engagement | Campaign |
| nano-designer | CPC (click per creative) | <$5 | Daily |
| motion-engineer | Video completion | >30% | Per video |
| ugc-planner | UGC CTR | >2% | Per campaign |
| orator | Audio clarity | >95% | Per voiceover |
| landing-page-builder | Conversion rate | >5% | Daily |
| seo-content-writer | Organic traffic | +20%/month | Monthly |
| media-buyer | CPA | <$15 | Daily |
| ab-optimizer | ROAS | >3:1 | Daily |
| lead-scraper | Lead quality | Grade A >40% | Daily |
| sdr | Reply rate | >8% | Weekly |
| nurture-bot | Conversion rate | >2% | Weekly |
| pipeline-manager | Pipeline velocity | <30 days to close | Daily |

---

**END OF VISUAL REFERENCE GUIDE**
