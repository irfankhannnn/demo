# Day 16 — Directory Submissions (30+ targets)

> **Type:** 🤖 AUTO + 🤝
> **Phase:** Week 3
> **Skill(s):** `directory-submissions` + `copywriting`
> **Estimated time:** 1h founder + 6h AI

## Objective
Submit RealEstateFlow to 30+ directories across SaaS / AI / India-startup / real-estate / no-code / MCP categories for backlinks, domain rating, and discovery. Maintain a tracker per submission with status, follow-up cadence, and approval ETA.

## Why This Matters for RealEstateFlow
Backlinks from authoritative directories build domain rating + bring qualified traffic + power AEO citations (LLMs cite directory entries). Day 16 invests once for compounding M2-M6 returns.

## User Story
As founder, I want RealEstateFlow listed on every relevant directory by Day 16 EOD with consistent brand copy + tracker, so M2 onwards I get organic discovery without paid spend.

## Acceptance Criteria
- [ ] Directory submission target list at `marketing-and-sales/launch-implement/week-3/day-16-directories-target.md` with 30+ directories ranked by domain rating + relevance
- [ ] Submissions sent to top 30 (skip directories that require >₹0 listing fee unless ROI clear)
- [ ] Tracker at `marketing-and-sales/launch-implement/week-3/day-16-directory-tracker.csv`: directory, URL, submitted_at, login_credentials_vault_ref, expected_approval_eta, listing_url_when_live, dofollow_y_n, notes
- [ ] Consistent brand copy used: 50-char tagline, 150-char short description, 500-char long description, 1-line use case, logo, screenshots
- [ ] Categories submitted to where applicable: AI · SaaS · CRM · Real Estate · India SaaS · No-code · WhatsApp · Productivity
- [ ] All credentials saved in 1Password (no plaintext)
- [ ] Day 17-21 follow-up cadence documented (most directories take 3-14 days to approve)
- [ ] Domain rating snapshot captured today (ahrefs Webmaster Tools) — baseline for M2 measurement
- [ ] PostHog event `directory_referral` configured for incoming traffic from directory backlinks

## Manual Steps (🧍 — small)

1. Approve target list (founder reviews 30 directories before submission).
2. For directories requiring manual signup (5-7 of 30), founder logs in + completes submission.
3. AI handles the 23-25 directories with public submission forms or known patterns.
4. Founder verifies tracker after AI run + spot-checks 5 random submissions.
5. Capture ahrefs domain rating baseline.
6. Tick ACs.

## AI Prompt (🤖)

```
You are a directory-submissions specialist for B2B SaaS launches. Read inputs:

- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md`
- `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-profile.md` (for founder bio reuse)
- `realestateflow/assets/logos/final/logo.png` (200×200 + 512×512 + 1024×1024)
- 4-6 best demo screenshots from `screenshots/day-15/`

## Step 1 — Build target list

Produce `day-16-directories-target.md` with 30+ directories grouped by category:

### Tier-1 high-DR generic SaaS / AI directories (15+)
- Product Hunt (BetaList for pre-launch + Product Hunt for M1 day-23 launch — DAY 16 only registers, doesn't post)
- BetaList
- AlternativeTo
- G2 (free listing)
- Capterra (free listing)
- SaaSHub
- TAAFT (There's An AI For That)
- Futurepedia
- AI Tools Directory
- AItopTools
- AI Scout
- ToolFinder
- Toolify
- Insidr.ai
- AIPedia
- LaterPost
- StackShare
- GetApp
- Crozdesk
- SoftwareSuggest

### Tier-2 India-focused (5+)
- IndieHackers India
- iSPIRT MakerVillage
- StartupIndia register (govt — gives "Recognized Startup" badge if eligible)
- TechCrunch India coverage waitlist
- YourStory submissions

### Tier-3 Real-estate vertical (5+)
- PropertyPortal directories
- IBEF Real Estate Tech listings
- Indian Real Estate Tech Map (if exists)
- PropTech India
- RealEstate-IT directories

### Tier-4 No-code / WhatsApp / Niche (5+)
- WhatsApp Business directory (Meta)
- NoCode List
- BubbleApps (if relevant)
- Fast Track (Indian SaaS list)
- IndianStartups directory

For each entry:
| Directory | URL | Domain Rating | Listing fee | Submission method (manual/auto) | Auto-approve? | Dofollow? |

## Step 2 — Build canonical brand copy bundle

Save `marketing-and-sales/launch-implement/week-3/day-16-brand-copy-bundle.md`:
- **Tagline (50 char)**: "AI Employee for Mumbai real-estate brokers"
- **Short (150 char)**: "RealEstateFlow is an AI Employee that runs your real-estate broking agency on WhatsApp + Telegram. Built in Mumbai for Mumbai brokers."
- **Long (500 char)**: "{{generate from wedge.md, focusing on Mumbai broker pain + AI Employee + WhatsApp + ₹999/mo + 14-day free trial}}"
- **Use case (1 line)**: "Replace Excel + 4 WhatsApp groups with one AI Employee that qualifies leads, follows up buyers, and tracks Khata."
- **Categories**: CRM · Real Estate · AI · WhatsApp · India · SaaS · Productivity
- **Pricing**: From ₹999/mo · 14-day free trial
- **Founders**: {{founder name}}
- **Year founded**: {{2025/2026 based on real}}
- **Logo URLs**: 200/512/1024 PNG + SVG
- **Screenshots**: 4-6 from day-15 capture
- **Demo URL**: realestateflow.in/demo
- **Pricing URL**: realestateflow.in/pricing
- **Loom 90-sec demo URL**: from Day 6
- **Founder LinkedIn**: from P6
- **Twitter**: handle if exists

## Step 3 — Submission package per directory

For directories with public submission forms (no auth needed): generate the exact form-fill JSON. Founder reviews + clicks "submit".

For directories requiring auth: produce step-by-step instructions for founder including which fields to copy from the brand-copy bundle.

## Step 4 — Tracker template

Initialize `day-16-directory-tracker.csv` with one row per directory + empty status fields.

## Step 5 — Follow-up cadence

Save `marketing-and-sales/launch-implement/week-3/day-16-followup-cadence.md`:
- Day 17: confirm approval emails received
- Day 19: check 14-day-approval directories (ProductHunt, G2)
- Day 22: re-submit any rejected with feedback addressed
- Day 28: backlink audit via ahrefs (which submissions actually live + dofollow)

Stop. Do not auto-submit anywhere requiring credentials (founder handles).
```

## Inputs
- Plan overview + wedge + pricing
- Brand assets (logos + screenshots)
- Founder bio

## Outputs
- `day-16-directories-target.md`
- `day-16-brand-copy-bundle.md`
- `day-16-directory-tracker.csv`
- `day-16-followup-cadence.md`
- 30+ submissions live or in queue

## Success Criterion
30+ submissions sent or queued; tracker populated; 1Password vault has all credentials.

## Fallback / Plan B
If <30 directories realistic for Day 16, ship 20 high-DR + queue the rest for Day 18-21. Quality over quantity — better 20 dofollow than 50 nofollow.

## Risks
| Risk | Mitigation |
|---|---|
| Spam-flag from too many submissions same day | Spread Day 16-18 if risk |
| Rejected listings | Day-22 re-submit with feedback |
| Dofollow vs nofollow not tracked | Tracker column required |
| Brand copy inconsistency | Single source-of-truth bundle |

## India / Mumbai-Specific Notes
- StartupIndia "Recognized Startup" badge gives DPIIT benefits
- Indian SaaS directories underrated for traffic — submit even if low DR
- TAAFT + Futurepedia drive AI-curious traffic to "AI Employee" wedge

## Dependencies
- **Blocks:** M2 organic discovery, AEO citations
- **Depends on:** Day 15 LP polish, P8 logo

## Connected Skills
- `directory-submissions` — primary
- `copywriting` — brand copy bundle
- `seo-audit` — verify dofollow status
