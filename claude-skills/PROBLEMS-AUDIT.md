# Problems Audit — Original Marketing Skills System

This document lists every problem found in the original `skills/` directory and `scripts/` when compared against the use cases in CLAUDESKILLSUSAGE (Parts 1-5, 260+ examples).

## Critical Issues (System Won't Work)

### 1. Wrong Runtime Environment — PowerShell on Linux
- **All 8 scripts** were `.ps1` (PowerShell) files: `generate-image.ps1`, `render-remotion.ps1`, `elevenlabs-tts.ps1`, `serpapi-scrape.ps1`, `sheets-update.ps1`, `validate-*.sh`
- Claude Cowork runs on **Ubuntu 22 Linux** — PowerShell is not available
- **All 260+ usage examples** in CLAUDESKILLSUSAGE reference PowerShell syntax (`.\scripts\`, `$variable`, `Copy-Item`, `ForEach-Object`)
- **Fix:** Rewrote all scripts as bash `.sh` files

### 2. `/agent` Command Doesn't Exist in Cowork
- Every single usage example uses `/agent brand-strategist`, `/agent motion-engineer`, etc.
- Claude Cowork has **no `/agent` command** — it uses natural language + skill invocation
- The `setup.ps1` tried to install agents into `.claude/agents/` which is a Claude Code pattern
- **Fix:** Removed all `/agent` references; skills now trigger via natural conversation

### 3. Skills Not Registered with Cowork
- Original 22 skills were in `claude-skills/skills/` but Cowork discovers skills from `.claude/skills/` or `.skills/skills/`
- The `setup.ps1` (PowerShell) couldn't run on Linux to copy them
- None of the skills appeared in Cowork's available skill list
- **Fix:** Created `setup.sh` (bash) that installs to `.claude/skills/`; all 13 skills now appear in Cowork

### 4. Invalid YAML Frontmatter
- Many skills had `disable-model-invocation: true` — not a valid Cowork skill property
- Some had `context: fork`, `agent: Explore` — Claude Code agent properties, not Cowork
- Some had `allowed-tools:` lists — not how Cowork skills work
- **Fix:** Stripped to only `name` and `description` (the only fields Cowork recognizes)

## Major Issues (Incorrect/Misleading)

### 5. Brand Name Inconsistency
- 13 of 22 skills reference "Cloudberry" instead of "RealtyFlow"
- CLAUDESKILLSUSAGE consistently uses "RealtyFlow" as the go-to-market brand
- Skills affected: `design-assets`, `ugc-scripts`, `voiceover-gen`, `meta-ads-setup`, `ab-testing`, `outbound-outreach`, `lead-nurture`, `trend-analysis`, `icp-research`, `market-prediction`, `codebase-analysis`, `security-audit`, `pr-review`
- **Fix:** All 13 new skills consistently use "RealtyFlow"

### 6. `$ARGUMENTS` Placeholder Pattern
- Every skill used `$ARGUMENTS` as a placeholder (e.g., "Create brand positioning assets for RealtyFlow. Focus: $ARGUMENTS")
- This is a Claude Code custom agent pattern — Cowork doesn't substitute `$ARGUMENTS`
- **Fix:** Removed all `$ARGUMENTS` references; skills now provide complete frameworks

### 7. Overlapping/Redundant Skills
- `remotion-video` and `video-production` overlapped heavily (both cover video creation)
- `outbound-outreach` and `whatsapp-outreach` overlapped (both cover messaging)
- `lead-enrichment` and `serpapi-scraping` overlapped (both cover lead data)
- `trend-analysis`, `icp-research`, `market-prediction` were separate but related
- **Fix:** Consolidated 22 skills → 13 focused skills with clear boundaries

### 8. Google Sheets Dependency
- `pipeline-tracker` skill required Google Sheets MCP (`GOOGLE_SHEETS_PIPELINE_ID`)
- Cowork doesn't have Google Sheets MCP available
- `sheets-update.ps1` was PowerShell and required Google Sheets
- **Fix:** Replaced with JSON-based local pipeline storage + bash `pipeline-manager.sh`

## Medium Issues (Incomplete/Incorrect Content)

### 9. Missing Actual Code in Usage Examples
- Video examples show `'{"code":"...","durationInFrames":1800}'` with literal `"..."` as placeholder
- No actual Remotion component code provided
- User would need to write all React code themselves
- **Fix:** Video production skill now includes complete Remotion component templates

### 10. SEO Blog Skill — Incorrect Word Count Guidance
- Original skill said "800-1200" words but CLAUDESKILLSUSAGE examples ask for "2000-2500" words for pillar content
- Pillar articles need 2500+ words to rank competitively
- **Fix:** Updated to proper word count ranges (800-1200 for supporting, 2000-3000 for pillar)

### 11. Meta Ads — Outdated API Version
- Skills referenced `v19.0` of the Meta Marketing API
- Housing Special Ad Category rules were incomplete (missing the restriction on no age/gender/zip targeting)
- Budget format used cents (200000 = ₹2000) without explanation
- **Fix:** Added clear budget explanations, complete Housing category compliance rules

### 12. Voiceover Skill Referenced Wrong Orator Skill
- `voiceover-gen` listed `whatsapp-outreach` as a co-skill which made no sense
- Missing ElevenLabs preset configurations for different use cases
- **Fix:** Clean voiceover skill with proper ElevenLabs presets and bash commands

### 13. Lead Scraping — No Error Handling
- Original `serpapi-scrape.ps1` had no pagination logic despite usage docs showing it
- No rate limiting between API calls
- No deduplication in the scraping script itself
- **Fix:** New `serpapi-scrape.sh` includes pagination, rate limiting, and city coordinates

### 14. Landing Page Skill — Missing Actual HTML
- Skill described the page structure but didn't include HTML/CSS templates
- Usage examples promise "Generates full HTML with TailwindCSS" but skill doesn't have it
- **Fix:** New landing page skill includes complete HTML template with Tailwind CDN

### 15. Image Generation — Script Missing Provider Logic
- `generate-image.ps1` referenced both OpenAI and Gemini but the actual API calls weren't correct
- Gemini Imagen endpoint URL was outdated
- No error handling for failed API calls
- **Fix:** New `generate-image.sh` has proper API calls for both providers with error handling

## Minor Issues

### 16. Template Files Not Referenced by Skills
- 6 template files exist in `templates/` but no skill reads them
- `ad-creative-brief.md`, `icp-report-template.md`, `outreach-sequence-template.md`, etc.
- **Fix:** Templates integrated directly into relevant skills

### 17. Agent Files Reference Non-Existent Scripts
- Agent files like `brand-strategist.md` reference `claude-skills/scripts/` with PowerShell paths
- Agent coordination rules reference `INTEGRATIONS.md` but many env vars listed don't exist
- **Fix:** Not applicable — agents replaced by skills in Cowork

### 18. No Output Directory Structure
- Original system had no script to create the output directory tree
- Usage docs reference paths like `marketing-and-sales/creative/brand/` but directories don't exist
- **Fix:** `setup.sh` now creates all `marketing-outputs/` subdirectories

### 19. CUSTOM-MEDIA-WORKFLOW.md Not Integrated
- This file describes UGC workflow with user media but no skill references it
- **Fix:** UGC scripts skill now includes the media integration workflow

### 20. Engineering Skills Included in Marketing System
- `codebase-analysis`, `security-audit`, `pr-review` are engineering skills, not marketing
- They were mixed in with marketing skills causing confusion
- **Fix:** Excluded from marketing system (they belong in the engineering repo)

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Critical (won't work at all) | 4 | All fixed |
| Major (incorrect/misleading) | 4 | All fixed |
| Medium (incomplete) | 7 | All fixed |
| Minor (cleanup) | 5 | All fixed |
| **Total problems** | **20** | **All resolved** |

## File Changes

| What | Before | After |
|------|--------|-------|
| Skills count | 22 (in `skills/`) | 13 (in `cowork-skills/`) |
| Scripts | 8 PowerShell `.ps1` | 4 Bash `.sh` |
| Setup | `setup.ps1` (Windows) | `setup.sh` (Linux) |
| Brand name | Mixed Cloudberry/RealtyFlow | Consistent RealtyFlow |
| Skill format | Invalid frontmatter + `$ARGUMENTS` | Proper Cowork YAML |
| Pipeline storage | Google Sheets (unavailable) | Local JSON |
| Agent system | `/agent` commands (unavailable) | Natural language + skills |
| Total lines of skill content | ~3,200 | ~8,055 |
