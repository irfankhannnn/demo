# Claude Skills Usage Guide — Part 4: Meta Ads & Multi-Platform Outreach

> Sections 9-10. See [Part 1](./CLAUDESKILLSUSAGE.md) | [Part 2](./CLAUDESKILLSUSAGE-PART2.md) | [Part 3](./CLAUDESKILLSUSAGE-PART3.md) | [Part 5](./CLAUDESKILLSUSAGE-PART5.md)

---

## 9. Meta Ads — Ad Sets, Testing & Leads

**Agent:** `media-buyer` + `ab-optimizer` | **Skill:** `meta-ads-setup`, `ab-testing`
**Strategy:** Create campaigns via Meta Marketing API. Structure: Campaign → Ad Set (audience) → Ad (creative). Always use Housing Special Ad Category for real estate. Test 3 creatives per ad set, kill losers at 48h.

### Meta Ads API Setup
```bash
# Required env vars
META_ADS_ACCESS_TOKEN=EAAxxxxxxx       # From Meta Business Manager
META_ADS_ACCOUNT_ID=act_123456789      # Ad account ID
META_PIXEL_ID=987654321                # For conversion tracking
META_PAGE_ID=111222333                 # Facebook Page ID
```

### 9.1 — Create Lead Gen Campaign
```
/agent media-buyer
"Create a lead generation campaign for RealtyFlow targeting real estate agents in Mumbai.
Budget ₹2000/day. Use Housing Special Ad Category."
```
**API command agent generates:**
```bash
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/campaigns" \
  -H "Authorization: Bearer ${META_ADS_ACCESS_TOKEN}" \
  -d '{
    "name": "RF_LeadGen_Mumbai_Agents_2025Q1",
    "objective": "OUTCOME_LEADS",
    "special_ad_categories": ["HOUSING"],
    "status": "PAUSED",
    "daily_budget": 200000
  }'
```

### 9.2 — Create Ad Set with Interest Targeting
```
/agent media-buyer
"Create ad set targeting: Age 25-55, interests: real estate, property management,
CRM software. Location: Mumbai. Daily budget ₹1000."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adsets" \
  -H "Authorization: Bearer ${META_ADS_ACCESS_TOKEN}" \
  -d '{
    "name": "RF_Mumbai_Agents_Interest",
    "campaign_id": "CAMPAIGN_ID",
    "daily_budget": 100000,
    "billing_event": "IMPRESSIONS",
    "optimization_goal": "LEAD_GENERATION",
    "targeting": {
      "geo_locations": {"cities": [{"key": "mumbai", "radius": 25, "distance_unit": "kilometer"}]},
      "age_min": 25, "age_max": 55,
      "interests": [
        {"id": "6003017039105", "name": "Real estate"},
        {"id": "6003288100991", "name": "Property management"},
        {"id": "6003384272389", "name": "Customer relationship management"}
      ]
    },
    "status": "PAUSED"
  }'
```

### 9.3 — Create Ad Set with Lookalike Audience
```
/agent media-buyer
"Create a 1% lookalike audience from our existing customer list, then create an ad set targeting it."
```
```bash
# Step 1: Create Custom Audience from customer emails
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/customaudiences" \
  -d '{"name": "RF_Customers_Email", "subtype": "CUSTOM", "customer_file_source": "USER_PROVIDED_ONLY"}'

# Step 2: Create Lookalike from Custom Audience
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/customaudiences" \
  -d '{"name": "RF_Lookalike_1pct_Mumbai", "subtype": "LOOKALIKE", "origin_audience_id": "CUSTOM_AUDIENCE_ID", "lookalike_spec": {"ratio": 0.01, "country": "IN"}}'

# Step 3: Ad Set targeting lookalike
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adsets" \
  -d '{"name": "RF_Mumbai_Lookalike_1pct", "campaign_id": "CID", "targeting": {"custom_audiences": [{"id": "LOOKALIKE_ID"}]}}'
```

### 9.4 — Create 3 Ad Creatives for A/B Testing
```
/agent media-buyer
"Create 3 ad creatives for the Mumbai campaign:
Ad A: Pain-focused ('Tired of losing leads?')
Ad B: Solution-focused ('AI CRM that follows up')
Ad C: Social proof ('500+ agents trust us')"
```
```bash
# Ad A — Pain
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/ads" \
  -d '{"name": "RF_Mumbai_Pain_v1", "adset_id": "ADSET_ID", "creative": {"creative_id": "CREATIVE_A_ID"}, "status": "PAUSED"}'

# Ad B — Solution
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/ads" \
  -d '{"name": "RF_Mumbai_Solution_v1", "adset_id": "ADSET_ID", "creative": {"creative_id": "CREATIVE_B_ID"}, "status": "PAUSED"}'

# Ad C — Social Proof
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/ads" \
  -d '{"name": "RF_Mumbai_SocialProof_v1", "adset_id": "ADSET_ID", "creative": {"creative_id": "CREATIVE_C_ID"}, "status": "PAUSED"}'
```

### 9.5 — Setup Meta Pixel + CAPI (Conversion Tracking)
```
/agent media-buyer
"Setup Meta Pixel on our landing page and Conversions API (CAPI) for server-side tracking."
```
**Landing page pixel code (agent generates):**
```html
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){...}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
<!-- Lead event on form submit -->
<script>
document.getElementById('lead-form').addEventListener('submit', function() {
  fbq('track', 'Lead', {content_name: 'RealtyFlow Demo', content_category: 'CRM'});
});
</script>
```
**CAPI server-side:**
```bash
curl -X POST "https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events" \
  -d '{"data": [{"event_name": "Lead", "event_time": 1234567890, "user_data": {"em": ["hashed_email"]}, "action_source": "website"}], "access_token": "TOKEN"}'
```

### 9.6 — Brand Awareness Campaign
```
/agent media-buyer
"Create a brand awareness campaign targeting all of India. Video ad, ₹5000/day budget.
Optimize for ThruPlay."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/campaigns" \
  -d '{"name": "RF_BrandAwareness_India_Video", "objective": "OUTCOME_AWARENESS", "special_ad_categories": ["HOUSING"], "daily_budget": 500000, "status": "PAUSED"}'
```

### 9.7 — Retargeting Campaign (Website Visitors)
```
/agent media-buyer
"Create retargeting ad set for people who visited our landing page but didn't submit the form."
```
```bash
# Custom audience: website visitors who didn't convert
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/customaudiences" \
  -d '{"name": "RF_Website_NoConvert_30d", "rule": {"inclusions": {"operator": "or", "rules": [{"event_sources": [{"id": "PIXEL_ID", "type": "pixel"}], "retention_seconds": 2592000, "filter": {"operator": "and", "filters": [{"field": "url", "operator": "i_contains", "value": "realtyflow"}]}}]}, "exclusions": {"operator": "or", "rules": [{"event_sources": [{"id": "PIXEL_ID", "type": "pixel"}], "retention_seconds": 2592000, "filter": {"operator": "and", "filters": [{"field": "event", "operator": "eq", "value": "Lead"}]}}]}}}'
```

### 9.8 — A/B Test Analysis (48-Hour Check)
```
/agent ab-optimizer
"Analyze our Mumbai campaign after 48 hours. We have 3 ads running.
Pull metrics and recommend which to kill and which to scale."
```
```bash
# Get ad-level insights
curl -G "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/insights" \
  --data-urlencode "level=ad" \
  --data-urlencode "fields=ad_name,impressions,clicks,ctr,cpc,actions,cost_per_action_type" \
  --data-urlencode "time_range={'since':'2025-03-01','until':'2025-03-03'}" \
  -d "access_token=${META_ADS_ACCESS_TOKEN}"
```
**Agent evaluates:** CTR > 2% → keep, CPC < ₹15 → keep, CPL < ₹200 → scale. Kill losers.

### 9.9 — Scale Winning Ad (Increase Budget 20%)
```
/agent media-buyer
"The Pain-focused ad (Ad A) is winning. Scale its ad set budget by 20%."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/ADSET_ID" \
  -d '{"daily_budget": 120000, "access_token": "TOKEN"}'
```
**Rule:** Never increase budget more than 20% per day to avoid resetting the learning phase.

### 9.10 — Instagram Story Ad Setup
```
/agent media-buyer
"Create an Instagram Story placement ad (9:16 video) for the Mumbai campaign."
```
```bash
# Ad set with Instagram Stories placement only
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adsets" \
  -d '{"name": "RF_Mumbai_IGStory", "campaign_id": "CID", "targeting": {"publisher_platforms": ["instagram"], "instagram_positions": ["story"]}, "daily_budget": 50000}'
```

### 9.11 — Lead Form Ad (Instant Form)
```
/agent media-buyer
"Create a Meta Lead Form (Instant Form) with fields: Name, Phone, City, Company Size."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/${META_PAGE_ID}/leadgen_forms" \
  -d '{"name": "RF_Demo_Request_Form", "questions": [{"type": "FULL_NAME"}, {"type": "PHONE"}, {"type": "CITY"}, {"type": "CUSTOM", "key": "company_size", "label": "How many agents in your team?", "options": [{"value": "1-5"}, {"value": "6-20"}, {"value": "20+"}]}], "privacy_policy": {"url": "https://realtyflow.in/privacy"}, "thank_you_page": {"title": "Dhanyavaad!", "body": "Humari team 24 ghante mein aapko call karegi."}}'
```

### 9.12 — Multi-City Campaign (5 Cities)
```
/agent media-buyer
"Create separate ad sets for Mumbai, Pune, Delhi, Bangalore, and Hyderabad. Same campaign,
₹500/day each, different city-specific copy."
```
```bash
$cities = @("Mumbai","Pune","Delhi","Bangalore","Hyderabad")
foreach ($city in $cities) {
    # Agent generates city-specific ad set + ad creative
    # Each ad set has geo_locations targeting that city
}
```

### 9.13 — Carousel Ad (5 Feature Slides)
```
/agent media-buyer
"Create a carousel ad showing 5 RealtyFlow features. Each card: image + headline + description."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adcreatives" \
  -d '{"name": "RF_Carousel_5Features", "object_story_spec": {"page_id": "PAGE_ID", "link_data": {"child_attachments": [{"link": "https://realtyflow.in", "name": "Lead Auto-Assignment", "description": "Har lead sahi agent ko automatically assign", "image_hash": "HASH1"}, {"link": "https://realtyflow.in", "name": "WhatsApp Integration", "description": "Direct CRM se WhatsApp pe reply", "image_hash": "HASH2"}], "link": "https://realtyflow.in"}}}'
```

### 9.14 — Video Ad Creative Upload
```
/agent media-buyer
"Upload the 30-second product demo video as an ad creative."
```
```bash
# Step 1: Upload video
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/advideos" \
  -F "file=@videos/product-demo-30s.mp4" \
  -F "title=RealtyFlow Demo" \
  -F "access_token=${META_ADS_ACCESS_TOKEN}"

# Step 2: Create creative using uploaded video
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adcreatives" \
  -d '{"name": "RF_VideoAd_Demo30s", "object_story_spec": {"page_id": "PAGE_ID", "video_data": {"video_id": "VIDEO_ID", "message": "Ab CRM hassle-free! 14-din free trial shuru karein.", "call_to_action": {"type": "SIGN_UP", "value": {"link": "https://realtyflow.in/trial"}}}}}'
```

### 9.15 — Daily Performance Report
```
/agent ab-optimizer
"Pull daily performance metrics for all active campaigns. Format as a report."
```
```bash
curl -G "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/insights" \
  --data-urlencode "level=campaign" \
  --data-urlencode "fields=campaign_name,spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type" \
  --data-urlencode "date_preset=today" \
  -d "access_token=${META_ADS_ACCESS_TOKEN}"
```
**Agent formats into:** Campaign name | Spend | Leads | CPL | CTR | Status (Scale/Hold/Kill)

### 9.16 — Audience Exclusion (Existing Customers)
```
/agent media-buyer
"Exclude existing customers from all lead gen campaigns to avoid wasting budget."
```
```bash
# Upload customer email list as exclusion audience
# Then add to all ad sets: "excluded_custom_audiences": ["CUSTOMER_AUDIENCE_ID"]
```

### 9.17 — Dynamic Creative Optimization (DCO)
```
/agent media-buyer
"Create a DCO ad set that automatically tests combinations of 3 headlines, 3 images, and 2 CTAs."
```
```bash
curl -X POST "https://graph.facebook.com/v19.0/act_${META_ADS_ACCOUNT_ID}/adcreatives" \
  -d '{"name": "RF_DCO_Mumbai", "asset_feed_spec": {"images": [{"hash": "H1"}, {"hash": "H2"}, {"hash": "H3"}], "titles": [{"text": "Ab Har Lead Track Karein"}, {"text": "India Ka #1 Real Estate CRM"}, {"text": "Free Trial — No Credit Card"}], "bodies": [{"text": "500+ agents trust RealtyFlow"}, {"text": "AI follow-up, WhatsApp, analytics"}], "call_to_action_types": ["SIGN_UP", "LEARN_MORE"]}}'
```

### 9.18 — Budget Scheduling (Dayparting)
```
/agent media-buyer
"Set budget to run ads only 8AM-10PM IST (when agents are active). Pause overnight."
```
```bash
# Scheduled ad set with delivery schedule
# 0 = midnight, each hour = 1. Schedule: 8-22 (8AM to 10PM)
```

### 9.19 — Conversion Lift Test
```
/agent ab-optimizer
"Set up a holdout test: 90% see ads, 10% control group. Measure incremental leads."
```
**Agent creates:** Campaign with A/B test split, control holdout, and measurement plan.

### 9.20 — Campaign Kill + Relaunch Protocol
```
/agent ab-optimizer
"Our Mumbai campaign CPL is above ₹300. Analyze, kill underperformers, and recommend relaunch strategy."
```
**Agent workflow:**
1. Pull 7-day insights per ad
2. Kill ads with CPL > ₹300 or CTR < 1%
3. Identify winning audience segments
4. Recommend new creative angles
5. Create new ad set with refined targeting
6. Save report to `marketing-and-sales/campaigns/mumbai-relaunch.md`

---

## 10. Multi-Platform Outreach

**Agent:** `sdr` + `nurture-bot` + `orator` | **Skill:** `outbound-outreach`, `whatsapp-outreach`, `lead-nurture`
**Scripts:** `elevenlabs-tts.ps1`, `sheets-update.ps1`
**Strategy:** Multi-touch outreach across Email, WhatsApp, LinkedIn, and Voice. Hinglish messaging. 7-touch sequence over 14 days.

### 10.1 — Cold Email Sequence (5 Emails)
```
/agent sdr
"Write a 5-email cold outreach sequence for real estate agents in Mumbai.
Hinglish, value-first approach, personalized per agency."
```
**Agent generates 5 emails:**
```
Email 1 (Day 0): Value-first — share free resource
Email 2 (Day 2): Pain point + case study
Email 3 (Day 5): Social proof + demo invite
Email 4 (Day 9): Objection handling
Email 5 (Day 14): Breakup email — "Last message from me"
```
**Output:** `marketing-and-sales/outreach/email/mumbai-sequence.md`

### 10.2 — WhatsApp Outreach Template (Text)
```
/agent sdr
"Write 3 WhatsApp text templates for cold outreach to agents:
Template A: Introduction + free resource
Template B: Pain point + solution teaser
Template C: Exclusive offer + urgency"
```
```
Template A:
"Namaste [Name] ji 🙏 Main [Your Name], RealtyFlow se. Aapke agency [Agency] ke
baare mein jaanke bahut accha laga. Humne ek free guide banaya hai: '10 Ways to
Never Lose a Lead Again'. Bhej dun? [Link]"
```
**Output:** `marketing-and-sales/outreach/whatsapp/templates.md`

### 10.3 — WhatsApp Voice Message (AI-Generated)
```
/agent orator
"Generate WhatsApp voice messages for outreach. Casual Hinglish, 15-20 seconds each."
```
```powershell
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Hey [Name] bhai, main [Your Name] RealtyFlow se. Maine dekha aapki agency [City] mein kaafi accha kaam kar rahi hai. Ek quick question — kya aap apne leads abhi bhi manually track karte ho? Agar haan, toh mujhe ek minute dena, main kuch dikhata hun jo aapka kaam easy kar dega." `
  -VoiceId "casual-male-voice" -Stability 0.3 -SimilarityBoost 0.8 `
  -Output "media/my-audio/whatsapp-voice-cold.mp3"
```

### 10.4 — LinkedIn Connection Request + Follow-Up
```
/agent sdr
"Write LinkedIn outreach: connection request (300 chars max), then 3 follow-up messages
after acceptance. Targeting real estate agency owners."
```
**Agent generates:**
```
Connection Note (300 chars):
"Hi [Name], I noticed your agency in [City] — impressive portfolio! I help agents
automate lead tracking with AI. Would love to connect. — [Your Name]"

Follow-up 1 (Day 1 after accept): Share free resource
Follow-up 2 (Day 4): Case study + question
Follow-up 3 (Day 7): Demo offer
```
**Output:** `marketing-and-sales/outreach/linkedin/connection-sequence.md`

### 10.5 — Cold Call Script (Hinglish)
```
/agent sdr
"Write a cold call script for calling real estate agents. 2-minute framework.
Hinglish, conversational, with objection handling."
```
**Agent generates call script:**
```
Opening (15s): "Namaste [Name] ji, main [Your Name] RealtyFlow se bol raha hun.
Aapka 1 minute hai? Bahut chhoti baat hai."

Qualify (30s): "Aap abhi leads kaise track karte ho? Excel? Ya koi aur tool?"

Pain (30s): "Agar main bolu ki aap har mahine 20-30% leads follow-up miss kar rahe
ho, toh aapko surprise hoga?"

Solution (30s): "Humara CRM automatically lead assign karta hai, WhatsApp se reply
karta hai, aur AI follow-up karta hai."

CTA (15s): "Ek 15-minute demo dekhenge? Aapke liye kab convenient hai?"

Objections:
- "Price?" → "₹999/month hai, ek deal se recover ho jaata hai."
- "Already have CRM" → "Kaun sa use kar rahe ho? Most agents 2 months mein switch karte hain."
- "No time" → "Sirf 15 minutes, aur main aapko dikhaunga kitna time save hoga."
```

### 10.6 — Multi-Channel Outreach Sequence (7 Touches)
```
/agent sdr
"Design a 14-day multi-channel sequence. 7 touchpoints across email, WhatsApp, LinkedIn."
```
**Agent generates:**
```
Day 0:  LinkedIn connect + Email 1 (value)
Day 1:  WhatsApp text (intro)
Day 3:  Email 2 (case study)
Day 5:  WhatsApp voice message
Day 7:  LinkedIn message (content share)
Day 10: Email 3 (demo invite)
Day 14: Email 4 (breakup) + WhatsApp final
```

### 10.7 — Nurture Sequence for Demo No-Shows
```
/agent nurture-bot
"Create a nurture sequence for leads who booked demo but didn't show up. 3 emails + 2 WhatsApp."
```
**Output:** `marketing-and-sales/outreach/nurture/demo-noshow-sequence.md`

### 10.8 — Re-Engagement Campaign (Cold Leads)
```
/agent nurture-bot
"Create re-engagement sequence for leads who haven't responded in 30+ days.
'Hey, we've added new features' angle."
```

### 10.9 — Referral Request Messages
```
/agent sdr
"Write referral request messages for happy customers. WhatsApp + Email. Include incentive."
```
```
WhatsApp: "Rohit bhai 🙏 Aapko RealtyFlow pasand aa raha hai toh kya aap 2-3 agent
friends ko refer karenge? Har successful referral pe aapko ₹5000 ka credit milega!"
```

### 10.10 — Event Invitation Outreach
```
/agent sdr
"Write outreach for inviting agents to our Mumbai Demo Day event.
WhatsApp broadcast + Email + LinkedIn."
```

### 10.11 — Personalized Video Message Script
```
/agent sdr
"Write a personalized video message script that I record for each prospect.
30 seconds, mentions their agency name and city."
```
**Template:**
```
"Hey [Name], main [Your Name]. Maine [Agency Name] ke baare mein research kiya —
[City] mein aapka kaam impressive hai. Mujhe lagta hai RealtyFlow se aap aur bhi
zyada deals close kar sakte ho. Yeh 2-minute demo dekhiye: [Link]"
```

### 10.12 — Instantly.ai Email Campaign Setup
```
/agent sdr
"Set up cold email campaign on Instantly.ai. Provide the campaign settings,
warmup instructions, and sending schedule."
```
**Agent provides:**
```
Account warmup: 14 days before campaign, 20 emails/day ramp
Sending: 50 emails/day max per account, use 3 accounts for 150/day
Schedule: Mon-Fri, 9AM-6PM IST
Subject line rotation: 3 variants
Reply handling: Auto-tag interested vs not interested
```

### 10.13 — AWS SES Email Sending (Transactional)
```
/agent sdr
"Set up AWS SES for sending demo confirmation and follow-up emails programmatically."
```
```bash
aws ses send-email \
  --from "team@realtyflow.in" \
  --destination '{"ToAddresses":["agent@example.com"]}' \
  --message '{"Subject":{"Data":"Aapki RealtyFlow Demo Confirmed!"},"Body":{"Html":{"Data":"<h1>Demo Confirmed</h1><p>Namaste! Aapki demo [Date] ko hai...</p>"}}}'
```

### 10.14 — WhatsApp Business API Broadcast
```
/agent sdr
"Send WhatsApp broadcast to 100 new leads using WhatsApp Business API template message."
```
```bash
# Send template message via WhatsApp Cloud API
curl -X POST "https://graph.facebook.com/v19.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ${WHATSAPP_BUSINESS_API_TOKEN}" \
  -d '{"messaging_product": "whatsapp", "to": "91XXXXXXXXXX", "type": "template", "template": {"name": "realtyflow_intro", "language": {"code": "hi"}, "components": [{"type": "body", "parameters": [{"type": "text", "text": "Agent Name"}]}]}}'
```

### 10.15 — Objection Handling Playbook for Outreach
```
/agent sdr
"Create an objection handling playbook with responses for the top 10 objections
across email, WhatsApp, and phone."
```
**Output:** `marketing-and-sales/outreach/objection-playbook.md`

### 10.16 — Pipeline Update After Outreach
```powershell
# After outreach campaign, update pipeline with new leads
.\claude-skills\scripts\sheets-update.ps1 -Action "add" `
  -LeadName "Sharma Properties" -LeadEmail "rohit@sharma.com" `
  -LeadPhone "+919876543210" -Stage "contacted" -Source "cold-email"
```

### 10.17 — A/B Test Email Subject Lines
```
/agent sdr
"Write 5 subject line variants for our cold email. Test which gets highest open rate."
```
```
A: "Kya aapke leads bhi kho rahe hain?"
B: "[Name], ek question hai"
C: "Free: Real Estate CRM Guide"
D: "Mumbai ke 500+ agents yeh use kar rahe hain"
E: "Quick question about [Agency Name]"
```

### 10.18 — Post-Demo Follow-Up Sequence
```
/agent nurture-bot
"Create 5-touch follow-up for leads who attended demo but haven't signed up.
Progressively more direct. End with limited-time offer."
```

### 10.19 — Content-Based Nurture (Educational)
```
/agent nurture-bot
"Create an educational nurture sequence for cold leads. 4 emails sharing valuable
content (not selling). Build trust first."
```
```
Email 1: "5 Lead Management Mistakes Agents Make" (blog link)
Email 2: "Free Template: Weekly Sales Report for Agents" (download)
Email 3: "Case Study: How Sharma Properties 3X-ed" (case study)
Email 4: "Free Webinar: CRM Basics for Agents" (registration)
```

### 10.20 — Outreach Performance Tracking
```
/agent pipeline-manager
"Track outreach campaign performance. Update pipeline with response rates,
meetings booked, and conversion by channel."
```
```powershell
.\claude-skills\scripts\sheets-update.ps1 -Action "summary"
# Shows: Total leads | Contacted | Responded | Demo Booked | Converted | by channel
```

---

*Continue to [Part 5](./CLAUDESKILLSUSAGE-PART5.md) for Data Scraping, AI Calling & E2E Workflows*
