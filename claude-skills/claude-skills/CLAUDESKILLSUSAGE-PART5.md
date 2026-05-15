# Claude Skills Usage Guide — Part 5: Data Scraping, AI Calling & E2E Workflows

> Sections 11-13. See [Part 1](./CLAUDESKILLSUSAGE.md) | [Part 2](./CLAUDESKILLSUSAGE-PART2.md) | [Part 3](./CLAUDESKILLSUSAGE-PART3.md) | [Part 4](./CLAUDESKILLSUSAGE-PART4.md)

---

## 11. Data Scraping — All Platforms

**Agent:** `lead-scraper` | **Skill:** `serpapi-scraping`, `lead-enrichment`
**Script:** `serpapi-scrape.ps1`
**Strategy:** Scrape real estate agencies from Google Maps via SerpApi, enrich with contact data, validate, deduplicate, and score. Target: 100K leads.

### Env Setup
```bash
SERPAPI_API_KEY=your_serpapi_key           # SerpApi for Google Maps
PHANTOMBUSTER_API_KEY=your_pb_key         # PhantomBuster for LinkedIn/Instagram
BROWSERBASE_API_KEY=your_bb_key           # Browserbase for web scraping
```

### 11.1 — Scrape Real Estate Agencies in Mumbai
```
/agent lead-scraper
"Scrape all real estate agencies in Mumbai from Google Maps. Get: name, phone, email, website, rating, address."
```
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" -Query "real estate agency" `
  -Output "marketing-and-sales/leads/raw/mumbai-agencies.json"
```
**Output:** JSON array of agencies with contact details, ratings, reviews count

### 11.2 — Scrape Multiple Cities (Batch)
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -AllCities `
  -Output "marketing-and-sales/leads/raw/all-cities-agencies.json"
# Scrapes: Mumbai, Pune, Delhi NCR, Bangalore, Hyderabad, Chennai, Kolkata, Ahmedabad, Jaipur, Goa
```

### 11.3 — Scrape Property Dealers Specifically
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Pune" -Query "property dealer" `
  -Output "marketing-and-sales/leads/raw/pune-dealers.json"
```

### 11.4 — Scrape Real Estate Consultants
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Delhi" -Query "real estate consultant" `
  -Output "marketing-and-sales/leads/raw/delhi-consultants.json"
```

### 11.5 — Scrape Property Management Companies
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Bangalore" -Query "property management company" `
  -Output "marketing-and-sales/leads/raw/bangalore-pm.json"
```

### 11.6 — Scrape with Pagination (More Results)
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" -Query "real estate broker" `
  -MaxPages 5 -Output "marketing-and-sales/leads/raw/mumbai-brokers-deep.json"
# Each page = ~20 results, 5 pages = ~100 results per city
```

### 11.7 — Scrape Dubai Market
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Dubai" -Query "real estate agency Dubai" `
  -Output "marketing-and-sales/leads/raw/dubai-agencies.json"
```

### 11.8 — Enrich Leads (Extract Emails from Websites)
```
/agent lead-scraper
"Take the scraped Mumbai agencies list. Visit each website and extract email addresses,
social media links, and team size indicators."
```
**Steps:**
1. Agent reads `mumbai-agencies.json`
2. For each agency with a website, agent uses `Read` tool or Browserbase to extract:
   - Email addresses (contact@, info@, sales@ patterns)
   - LinkedIn company page
   - Instagram handle
   - Team size estimate
3. Saves enriched data to `marketing-and-sales/leads/enriched/mumbai-enriched.json`

### 11.9 — LinkedIn Scraping via PhantomBuster
```
/agent lead-scraper
"Set up PhantomBuster LinkedIn Profile Scraper to extract real estate agent profiles
from LinkedIn Sales Navigator search results."
```
**Steps:**
1. Agent creates PhantomBuster workflow config:
```json
{
  "phantom": "LinkedIn Search Export",
  "search_url": "https://www.linkedin.com/sales/search/people?query=real%20estate%20agent%20india",
  "max_results": 500,
  "fields": ["name", "headline", "company", "location", "profile_url"]
}
```
2. Export results to CSV
3. Import to lead database

### 11.10 — Instagram Scraping via PhantomBuster
```
/agent lead-scraper
"Scrape Instagram profiles of real estate agencies. Search hashtags: #mumbairealestate,
#punerealestate, #propertydealer."
```
**PhantomBuster config:**
```json
{
  "phantom": "Instagram Hashtag Collector",
  "hashtags": ["mumbairealestate", "punerealestate", "propertydealer"],
  "max_posts_per_hashtag": 200,
  "extract": ["username", "full_name", "bio", "followers", "email_in_bio"]
}
```

### 11.11 — 99acres Listing Scraper
```
/agent lead-scraper
"Scrape real estate agent profiles from 99acres.com for Mumbai. Extract: name, phone,
agency, listing count, areas served."
```
**Using Browserbase:**
```bash
# Agent uses Browserbase MCP to navigate 99acres agent directory
# Extracts structured data per agent
```

### 11.12 — MagicBricks Agent Scraper
```
/agent lead-scraper
"Scrape agent profiles from MagicBricks.com for Pune. Extract contact info and
listing counts."
```

### 11.13 — IndiaMART Real Estate Service Providers
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" `
  -Query "real estate services site:indiamart.com" `
  -Output "marketing-and-sales/leads/raw/indiamart-mumbai.json"
```

### 11.14 — Google Search for Agency Websites
```powershell
# Use SerpApi Google Search (not Maps) to find agency websites
$params = @{
    engine = "google"
    q = "real estate agency Mumbai contact email"
    num = 100
}
# Agent processes search results to extract agency domains
```

### 11.15 — Deduplicate Across Sources
```
/agent lead-scraper
"Take all scraped data from Mumbai (Google Maps, LinkedIn, Instagram, 99acres).
Deduplicate by phone number and email. Create unified lead list."
```
**Agent workflow:**
1. Load all source files
2. Normalize phone numbers (remove +91, spaces, dashes)
3. Match by phone → email → company name
4. Merge records, keeping richest data per field
5. Save to `marketing-and-sales/leads/deduped/mumbai-unified.json`

### 11.16 — Lead Scoring
```
/agent lead-scraper
"Score all Mumbai leads. Scoring model: has email (+10), has phone (+10), has website (+5),
rating > 4 (+5), reviews > 50 (+5), LinkedIn presence (+5), team size > 5 (+10)."
```
**Output:** Scored leads sorted by score descending → `leads/scored/mumbai-scored.json`

### 11.17 — Export to CSV for Outreach Tools
```
/agent lead-scraper
"Export the top 500 scored Mumbai leads to CSV format compatible with Instantly.ai import."
```
**CSV columns:** `email, first_name, last_name, company, phone, city, score, source`
**Output:** `marketing-and-sales/leads/export/mumbai-top500.csv`

### 11.18 — Track Scraping Progress (100K Goal)
```
/agent lead-scraper
"Show scraping progress towards 100K lead goal. Break down by city and source."
```
```powershell
.\claude-skills\scripts\sheets-update.ps1 -Action "summary"
```
**Output:** Progress table showing leads per city, source, and quality score distribution

### 11.19 — JustDial Business Scraper
```powershell
.\claude-skills\scripts\serpapi-scrape.ps1 -City "Hyderabad" `
  -Query "real estate agents site:justdial.com" `
  -Output "marketing-and-sales/leads/raw/justdial-hyderabad.json"
```

### 11.20 — Scheduled Weekly Scrape (New Agencies)
```
/agent lead-scraper
"Set up a weekly scraping schedule. Every Monday, scrape new agencies added to Google Maps
in the past 7 days for all target cities. Append to existing database."
```
**Agent creates PowerShell scheduled task:**
```powershell
# Weekly scrape script
$cities = @("Mumbai","Pune","Delhi","Bangalore","Hyderabad")
$date = Get-Date -Format "yyyy-MM-dd"
foreach ($city in $cities) {
    .\claude-skills\scripts\serpapi-scrape.ps1 -City $city `
      -Query "new real estate agency" `
      -Output "marketing-and-sales/leads/raw/weekly/$city-$date.json"
}
# Then deduplicate against existing database
```

---

## 12. AI Outbound Calling

**Service:** `ai-calling-service/` | **Agent:** `orator` + `sdr`
**Backend:** Exotel (telephony) + ElevenLabs (AI voice) + RAG (knowledge base)
**API:** `POST /api/ai-calling/calls/start`, `GET /api/ai-calling/calls/:id/status`

### How AI Calling Works
```
1. CRM identifies lead to call (from pipeline)
2. API call starts Exotel outbound call
3. ElevenLabs generates AI voice responses in real-time
4. Intent detection processes lead's speech
5. RAG retrieves relevant product info for responses
6. Call outcome saved to CRM (interested / callback / not interested)
7. Transcript stored for review
```

### 12.1 — Start a Single AI Call
```bash
curl -X POST "http://localhost:3001/api/ai-calling/calls/start" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "leadId": "LEAD_123",
    "leadName": "Rohit Sharma",
    "leadPhone": "+919876543210",
    "callPurpose": "demo_booking"
  }'
```
**Response:** `{ "callSessionId": "CS_abc123", "status": "initiating" }`

### 12.2 — Check Call Status
```bash
curl -G "http://localhost:3001/api/ai-calling/calls/CS_abc123/status" \
  -H "x-tenant-id: TENANT_001"
```
**Response:** `{ "status": "in_progress", "duration": 45, "currentIntent": "interested" }`

### 12.3 — Get Call Transcript
```bash
curl -G "http://localhost:3001/api/ai-calling/calls/CS_abc123/transcript" \
  -H "x-tenant-id: TENANT_001"
```
**Response:** Full conversation transcript with timestamps and speaker labels

### 12.4 — End a Call Manually
```bash
curl -X POST "http://localhost:3001/api/ai-calling/calls/CS_abc123/end" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{"reason": "lead_requested_callback"}'
```

### 12.5 — Batch Call Campaign (List of Leads)
```
/agent sdr
"Set up a batch calling campaign for top 50 scored leads from Mumbai scraping."
```
**Steps:**
1. Export top 50 leads from pipeline
2. Create calling schedule (10 calls/hour, 9AM-6PM IST)
3. Loop API calls:
```powershell
$leads = Get-Content "marketing-and-sales/leads/scored/mumbai-top50.json" | ConvertFrom-Json
foreach ($lead in $leads) {
    $body = @{
        leadId = $lead.id
        leadName = $lead.name
        leadPhone = $lead.phone
        callPurpose = "demo_booking"
    } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/ai-calling/calls/start" `
      -Headers @{"x-tenant-id"="TENANT_001"; "Content-Type"="application/json"} `
      -Body $body
    Start-Sleep -Seconds 360  # 6 min gap between calls
}
```

### 12.6 — Upload Knowledge Base Documents
```bash
# Upload product FAQs so AI can answer questions during calls
curl -X POST "http://localhost:3001/api/ai-calling/knowledge" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "title": "RealtyFlow Product FAQ",
    "content": "Q: What is RealtyFlow? A: RealtyFlow is India'\''s #1 real estate CRM...\nQ: How much does it cost? A: Plans start at ₹999/month...\nQ: Is there a free trial? A: Yes, 14-day free trial, no credit card required.",
    "category": "product"
  }'
```

### 12.7 — Upload Pricing Knowledge
```bash
curl -X POST "http://localhost:3001/api/ai-calling/knowledge" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "title": "RealtyFlow Pricing",
    "content": "Starter: ₹999/month (up to 500 leads, 1 user)\nPro: ₹2499/month (unlimited leads, 5 users, AI follow-up)\nEnterprise: Custom pricing (unlimited everything, dedicated support)",
    "category": "pricing"
  }'
```

### 12.8 — Upload Objection Handling Scripts
```bash
curl -X POST "http://localhost:3001/api/ai-calling/knowledge" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "title": "Objection Handling",
    "content": "If lead says too expensive: Samjhiye, ₹999 mein aapko har mahine 20+ extra leads mil sakte hain. Ek deal close karein toh 10x return hai.\nIf lead says already have CRM: Kaun sa use kar rahe ho? Humara 2x fast hai aur WhatsApp integration built-in hai.\nIf lead says not interested: Koi baat nahi. Main aapko ek free guide bhej deta hun jo aapke kaam aayegi.",
    "category": "objections"
  }'
```

### 12.9 — Configure AI Voice Settings
```bash
curl -X PUT "http://localhost:3001/api/ai-calling/config" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "voiceId": "pNInz6obpgDQGcFmaJgB",
    "language": "hi-IN",
    "speakingRate": 1.0,
    "stability": 0.5,
    "similarityBoost": 0.75,
    "greeting": "Namaste! Main RealtyFlow se bol raha hun. Kya aap [LeadName] ji se baat kar raha hun?"
  }'
```

### 12.10 — Call with Demo Booking Purpose
```bash
curl -X POST "http://localhost:3001/api/ai-calling/calls/start" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_001" \
  -d '{
    "leadId": "LEAD_456",
    "leadName": "Priya Patel",
    "leadPhone": "+919876543211",
    "callPurpose": "demo_booking"
  }'
```
**AI conversation flow:**
```
AI: "Namaste Priya ji! Main RealtyFlow se bol raha hun. Aapki agency ke baare mein
jaanke bahut accha laga. Kya aapka 2 minute hai?"
Lead: "Haan, boliye"
AI: "Humne ek CRM banaya hai specifically real estate agents ke liye. WhatsApp
integration, AI follow-up, sab built-in. Kya aap ek 15-minute demo dekhna chahenge?"
Lead: "Pricing kya hai?"
AI: [RAG retrieves pricing] "Plans ₹999/month se start hote hain. Aur 14-din ka
free trial bhi hai, bina credit card."
```

### 12.11 — Call with Follow-Up Purpose
```bash
curl -X POST "http://localhost:3001/api/ai-calling/calls/start" \
  -d '{"leadId": "LEAD_789", "leadName": "Amit Kumar", "leadPhone": "+919876543212", "callPurpose": "follow_up"}'
```

### 12.12 — Call with Feedback Collection Purpose
```bash
curl -X POST "http://localhost:3001/api/ai-calling/calls/start" \
  -d '{"leadId": "LEAD_101", "leadName": "Neha Singh", "leadPhone": "+919876543213", "callPurpose": "feedback"}'
```

### 12.13 — Get Call History
```bash
curl -G "http://localhost:3001/api/ai-calling/calls" \
  -H "x-tenant-id: TENANT_001" \
  --data-urlencode "status=completed" \
  --data-urlencode "limit=20"
```

### 12.14 — Get Call Metrics Summary
```bash
curl -G "http://localhost:3001/api/ai-calling/calls/metrics/summary" \
  -H "x-tenant-id: TENANT_001" \
  --data-urlencode "startDate=2025-03-01" \
  --data-urlencode "endDate=2025-03-31"
```
**Response:** `{ "totalCalls": 150, "connected": 120, "interested": 45, "demoBooked": 30, "avgDuration": 95 }`

### 12.15 — CRM Integration: Get Lead Context Before Call
```bash
# Internal API fetches lead context for AI to use during call
curl -G "http://localhost:3000/api/internal/leads/LEAD_123/context" \
  -H "x-api-key: ${AI_CALLING_INTERNAL_API_KEY}"
```
**Response:** Lead history, previous interactions, property interests, notes

### 12.16 — CRM Integration: Update Call Outcome
```bash
curl -X PATCH "http://localhost:3000/api/internal/leads/LEAD_123/call-outcome" \
  -H "x-api-key: ${AI_CALLING_INTERNAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"outcome": "demo_booked", "nextAction": "send_calendar_invite", "notes": "Interested in Pro plan, team of 8 agents"}'
```

### 12.17 — Book Site Visit via Call
```bash
# When lead wants site visit, AI creates via internal API
curl -X POST "http://localhost:3000/api/internal/site-visits" \
  -H "x-api-key: ${AI_CALLING_INTERNAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"leadId": "LEAD_123", "propertyId": "PROP_456", "preferredDate": "2025-03-20", "preferredTime": "11:00"}'
```

### 12.18 — AI Call Script for Cold Outreach (Hinglish)
```
/agent sdr
"Write the AI calling agent's complete conversation script for cold outreach.
Include: greeting, qualification questions, pitch, objection handling, close."
```
**Agent creates full script tree** (if/else branching per response):
```
GREETING → QUALIFY → PITCH → HANDLE_OBJECTIONS → CLOSE/CALLBACK/NURTURE
```
Upload as knowledge doc (see 12.6)

### 12.19 — Call + WhatsApp Follow-Up Automation
```
/agent sdr
"After AI call ends with 'interested' outcome, automatically send WhatsApp message
with demo booking link."
```
**Workflow:**
1. Call ends → outcome = "interested"
2. CRM webhook triggers WhatsApp message:
```bash
curl -X POST "https://graph.facebook.com/v19.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ${WHATSAPP_BUSINESS_API_TOKEN}" \
  -d '{"messaging_product":"whatsapp","to":"919876543210","type":"template","template":{"name":"demo_followup","language":{"code":"hi"}}}'
```

### 12.20 — Pipeline Update After Call Campaign
```powershell
# Update pipeline with call outcomes
.\claude-skills\scripts\sheets-update.ps1 -Action "update" -LeadId "LEAD_123" `
  -Stage "demo-scheduled" -Notes "AI call: interested in Pro plan, demo March 20"

.\claude-skills\scripts\sheets-update.ps1 -Action "update" -LeadId "LEAD_456" `
  -Stage "nurture" -Notes "AI call: asked for callback next week"

.\claude-skills\scripts\sheets-update.ps1 -Action "update" -LeadId "LEAD_789" `
  -Stage "not-interested" -Notes "AI call: already using Sell.Do"
```

---

## 13. End-to-End Campaign Workflows

Complete workflows combining multiple agents and skills across all phases.

### 13.1 — Full Mumbai Launch Campaign (All Phases)
```
Phase 1: Brand
  /agent brand-strategist → "Create Mumbai brand manifesto + 5 taglines"

Phase 2: Landing Page
  /agent landing-page-builder → "Create Mumbai landing page with Meta Pixel"

Phase 3: SEO
  /agent seo-content-writer → "Write 3 Mumbai-focused blog articles"

Phase 4: Creative
  Generate images: .\claude-skills\scripts\generate-image.ps1 (5 ad images)
  Render videos: .\claude-skills\scripts\render-remotion.ps1 (product demo + 3 reels)
  Generate voiceovers: .\claude-skills\scripts\elevenlabs-tts.ps1 (demo VO + WhatsApp VMs)

Phase 5: Outreach
  /agent sdr → "Create 5-email + 3 WhatsApp + LinkedIn sequence"

Phase 6: Scraping
  .\claude-skills\scripts\serpapi-scrape.ps1 -City "Mumbai" (scrape 500+ agencies)
  /agent lead-scraper → "Enrich, dedupe, score leads"

Phase 7: Pipeline
  .\claude-skills\scripts\sheets-update.ps1 -Action "create" (initialize pipeline)
  Import scored leads into pipeline

Phase 8: Ads
  /agent media-buyer → "Create Mumbai lead gen campaign"
  Upload creative → create 3 ad variants → launch
  /agent ab-optimizer → "Monitor and optimize at 48h"

Phase 9: AI Calling
  Upload knowledge base → configure voice → batch call top leads
  Update pipeline with outcomes

Phase 10: Nurture
  /agent nurture-bot → "Create sequences for each outcome category"
```

### 13.2 — Weekly Growth Sprint
```
Monday:
  /agent trend-hunter → "Weekly trend scan"
  /agent lead-scraper → "Weekly scrape new agencies"

Tuesday:
  /agent seo-content-writer → "Write 2 blog articles"
  /agent nano-designer → "Generate social media posts for the week"

Wednesday:
  /agent sdr → "Send outreach batch (50 emails + 50 WhatsApp)"
  AI Calling: batch call 20 leads

Thursday:
  /agent ab-optimizer → "Analyze ad performance, kill/scale"
  /agent motion-engineer → "Create 2 Instagram Reels"

Friday:
  /agent pipeline-manager → "Weekly pipeline summary"
  /agent nurture-bot → "Review and adjust nurture sequences"
```

### 13.3 — New Feature Launch Campaign
```
1. /agent brand-strategist → "Feature positioning + messaging"
2. /agent landing-page-builder → "Feature-specific landing page"
3. /agent motion-engineer → "'How it works' video (45s)"
4. /agent orator → "Generate voiceover + burn subtitles"
5. /agent nano-designer → "Generate ad banners (3 sizes)"
6. /agent media-buyer → "Create feature launch campaign on Meta"
7. /agent sdr → "Email blast to existing leads about new feature"
8. AI Calling → "Call warm leads about new feature"
```

### 13.4 — Content Production Assembly Line
```
1. /agent seo-content-writer → "Write pillar article"
2. /agent seo-content-writer → "Create distribution copy (LinkedIn, Twitter, IG)"
3. /agent nano-designer → "Generate blog featured image + social images"
4. /agent motion-engineer → "Create article summary Reel (30s)"
5. /agent orator → "Generate voiceover for Reel"
6. FFmpeg → merge video + voiceover + subtitles
7. Post across all platforms with distribution copy
```

### 13.5 — Lead-to-Customer Pipeline Automation
```
1. Lead scraped → added to pipeline (Stage: new)
2. AI call → qualify → update stage (contacted/interested/not-interested)
3. If interested → email demo invite + WhatsApp confirmation
4. Demo completed → update stage (demo-done)
5. No signup in 3 days → nurture sequence activates
6. Signed up → update stage (trial)
7. Trial ending → AI call for feedback + upgrade offer
8. Converted → update stage (paid) 🎉
```

### 13.6 — Event/Webinar Promotion Flow
```
1. /agent brand-strategist → "Event branding + messaging"
2. /agent landing-page-builder → "Registration page with countdown"
3. /agent nano-designer → "Event poster + social banners"
4. /agent motion-engineer → "20s promo video"
5. /agent sdr → "Invite outreach across email + WhatsApp + LinkedIn"
6. /agent media-buyer → "Event promotion ads on Meta"
7. AI Calling → "Call top leads to personally invite"
8. /agent pipeline-manager → "Track registrations + attendance"
```

### 13.7 — Competitor Switch Campaign
```
1. /agent brand-strategist → "Positioning matrix: us vs [competitor]"
2. /agent landing-page-builder → "Comparison page"
3. /agent seo-content-writer → "'[Competitor] Alternative' article"
4. /agent lead-scraper → "Scrape reviews of competitor on G2/Capterra"
5. /agent sdr → "Write switch-specific outreach sequence"
6. /agent media-buyer → "Retarget competitor's website visitors"
```

### 13.8 — Monthly Reporting Pipeline
```powershell
# 1. Pipeline summary
.\claude-skills\scripts\sheets-update.ps1 -Action "summary"

# 2. Ad performance
/agent ab-optimizer → "Monthly Meta ads report"

# 3. Content performance
/agent seo-content-writer → "Monthly SEO/blog analytics"

# 4. Outreach metrics
/agent sdr → "Monthly outreach report (emails sent, response rates)"

# 5. AI calling report
curl -G "http://localhost:3001/api/ai-calling/calls/metrics/summary" -H "x-tenant-id: TENANT_001"
```

### 13.9 — City Expansion Playbook
```
When expanding to a new city (e.g., Chennai):
1. Scrape: serpapi-scrape.ps1 -City "Chennai"
2. Brand: Adapt messaging for Chennai market (Tamil phrases)
3. Landing: Create Chennai-specific landing page
4. SEO: Write "Real Estate CRM Chennai" articles
5. Ads: New campaign targeting Chennai
6. Outreach: City-specific email + WhatsApp sequences
7. Calling: Batch call Chennai leads
8. Pipeline: Track Chennai separately
```

### 13.10 — Dubai Market Entry
```
1. /agent brand-strategist → "Dubai brand adaptation (English + Arabic)"
2. /agent landing-page-builder → "Dubai landing page (AED pricing)"
3. /agent seo-content-writer → "Dubai real estate CRM articles"
4. Scrape: serpapi-scrape.ps1 -City "Dubai"
5. /agent sdr → "Dubai outreach in English (no Hinglish)"
6. /agent media-buyer → "UAE-targeted Meta campaign"
7. AI Calling with English voice → Dubai leads
```

---

## Quick Reference: Agent → Skill → Script Mapping

| Use Case | Agent | Skill | Script |
|----------|-------|-------|--------|
| Branding | `brand-strategist` | `brand-strategy` | — |
| Landing Pages | `landing-page-builder` | `landing-page` | — |
| SEO/Blog | `seo-content-writer` | `seo-blog` | — |
| Images | `nano-designer` | `image-generation`, `design-assets` | `generate-image.ps1` |
| Videos | `motion-engineer` | `remotion-video`, `video-production` | `render-remotion.ps1` |
| UGC | `ugc-planner` | `ugc-scripts`, `remotion-video` | `render-remotion.ps1` |
| Voiceover | `orator` | `voiceover-gen` | `elevenlabs-tts.ps1` |
| Meta Ads | `media-buyer` | `meta-ads-setup` | — |
| A/B Testing | `ab-optimizer` | `ab-testing` | — |
| Outreach | `sdr`, `nurture-bot` | `outbound-outreach`, `whatsapp-outreach`, `lead-nurture` | `elevenlabs-tts.ps1` |
| Scraping | `lead-scraper` | `serpapi-scraping`, `lead-enrichment` | `serpapi-scrape.ps1` |
| Pipeline | `pipeline-manager` | `pipeline-tracker` | `sheets-update.ps1` |
| AI Calling | `ai-calling-service` API | — | — |
| Orchestrate | `orchestrator` | — | — |

---

## File Output Locations

All outputs are saved under `marketing-and-sales/`:
```
marketing-and-sales/
├── creative/
│   ├── brand/          # Brand manifesto, guidelines, messaging
│   ├── landing-pages/  # HTML landing pages
│   ├── images/         # Generated banners, posts, ads
│   ├── videos/         # Rendered MP4 videos
│   └── media/          # YOUR uploaded photos/videos/audio
│       ├── my-photos/
│       ├── my-videos/
│       ├── my-screenshots/
│       └── my-audio/
├── outreach/
│   ├── email/          # Email sequences
│   ├── whatsapp/       # WhatsApp templates
│   ├── linkedin/       # LinkedIn messages
│   └── scripts/        # Call scripts, UGC scripts
├── leads/
│   ├── raw/            # Scraped data
│   ├── enriched/       # Enriched + validated
│   ├── scored/         # Scored + ranked
│   ├── deduped/        # Deduplicated
│   └── export/         # CSV exports for tools
├── campaigns/          # Meta ads plans + reports
├── research/           # Trend reports, ICP, market analysis
└── blog/               # SEO articles, editorial calendar
```
