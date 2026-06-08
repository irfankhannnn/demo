---
name: meta-ads
description: Create and manage Meta Ads (Facebook/Instagram) campaigns for RealtyFlow. Includes campaign architecture, API commands, budget management, A/B testing, and compliance rules for Indian real estate marketing.
---

# Meta Ads Skill

Create, manage, and optimize Facebook/Instagram ad campaigns targeting Indian real estate agents. Includes Meta Marketing API commands, budget strategy, A/B testing protocols, and compliance rules.

## Meta Ads Prerequisites

### Get Required Credentials

1. **Meta Business Account:** [facebook.com/business](https://facebook.com/business)
2. **Ad Account ID:** Found in Settings → Ad Accounts
3. **Access Token:** Settings → Users and Permissions → System Users (create token)
4. **App ID:** Settings → Apps and Websites

Set environment variables:

```bash
export META_ACCESS_TOKEN="your-long-lived-access-token"
export META_AD_ACCOUNT="act_1234567890"  # Format: act_[ACCOUNT_ID]
export META_APP_ID="your-app-id"
```

## Campaign Architecture

```
Campaign (Strategic Level)
├── Ad Set 1 (Targeting Bundle)
│   ├── Ad 1 (Creative A)
│   ├── Ad 2 (Creative B)
│   └── Ad 3 (Creative C)
├── Ad Set 2 (Different Targeting)
│   ├── Ad 4 (Creative D)
│   └── Ad 5 (Creative E)
└── Ad Set 3 (Lookalike Audience)
    └── Ad 6 (Top Performer)

Budget Flow:
Campaign Budget: $1000/month
  ├── Ad Set 1 Budget: $400
  │   ├── Ad 1: Spend naturally (dynamic allocation)
  │   ├── Ad 2: Spend naturally
  │   └── Ad 3: Spend naturally
  ├── Ad Set 2 Budget: $300
  └── Ad Set 3 Budget: $300
```

## Meta Marketing API Commands

### 1. Create Campaign

```bash
#!/bin/bash
# create-campaign.sh

CAMPAIGN_NAME="RealtyFlow Q1 2024 - Lead Gen"
OBJECTIVE="LEAD_GENERATION"  # Or: CONVERSIONS, LINK_CLICKS, PAGE_LIKES
SPECIAL_AD_CATEGORY="REAL_ESTATE"

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/campaigns" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=${CAMPAIGN_NAME}" \
  -d "objective=${OBJECTIVE}" \
  -d "special_ad_categories=${SPECIAL_AD_CATEGORY}" \
  -d "status=PAUSED" \
  | jq '.id'
```

**Output:** Campaign ID (e.g., `23845638976850`)

### 2. Create Ad Set (Targeting Bundle)

```bash
#!/bin/bash
# create-adset.sh

CAMPAIGN_ID="$1"  # From above
ADSET_NAME="Delhi NCR - Real Estate Agents (Age 25-55)"
DAILY_BUDGET="50000"  # In cents (₹500/day)
TARGETING='
{
  "age_min": 25,
  "age_max": 55,
  "genders": [2],
  "geo_locations": {
    "regions": [
      {"key": "2409"},
      {"key": "2428"},
      {"key": "2560"}
    ]
  },
  "interests": [
    {"name": "Real estate"},
    {"name": "Property management"},
    {"name": "Business"},
    {"name": "Entrepreneurship"}
  ],
  "behaviors": [
    {"key": "6017253569572"}
  ],
  "flexible_spec": []
}'

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/adsets" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${ADSET_NAME}\",
    \"campaign_id\": \"${CAMPAIGN_ID}\",
    \"daily_budget\": ${DAILY_BUDGET},
    \"billing_event\": \"IMPRESSIONS\",
    \"optimization_goal\": \"LEAD_GENERATION\",
    \"targeting\": ${TARGETING},
    \"status\": \"PAUSED\"
  }" | jq '.id'
```

**Output:** Ad Set ID (e.g., `23845638976900`)

### 3. Create Ad Creative (Image + Text)

```bash
#!/bin/bash
# create-creative.sh

BUSINESS_ACCOUNT_ID="$1"  # Instagram business account
IMAGE_URL="https://realtyflow.com/ads/banner-1.jpg"
HEADLINE="Sabhi Leads Ek Jagah"
BODY_TEXT="Property management ab simple. RealtyFlow—ek app, sab kuch. Zero subscription. 3000+ agents joined."
CALL_TO_ACTION="LEARN_MORE"

curl -X POST "https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/adcreatives" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"object_story_spec\": {
      \"page_id\": \"${BUSINESS_ACCOUNT_ID}\",
      \"link_data\": {
        \"image_hash\": \"abc123def456\",
        \"message\": \"${BODY_TEXT}\",
        \"link\": \"https://realtyflow.com/download\",
        \"caption\": \"${HEADLINE}\",
        \"description\": \"Free lead management for Indian real estate agents\",
        \"call_to_action\": {
          \"type\": \"${CALL_TO_ACTION}\",
          \"value\": {
            \"link\": \"https://realtyflow.com/download\"
          }
        }
      }
    }
  }" | jq '.id'
```

### 4. Upload Image to Ads Manager

```bash
#!/bin/bash
# upload-image.sh

IMAGE_FILE="$1"  # Local image path

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/adimages" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -F "filename=@${IMAGE_FILE}" \
  | jq '.images'
```

### 5. Create Ad (Link Image, Creative, Ad Set)

```bash
#!/bin/bash
# create-ad.sh

ADSET_ID="$1"
CREATIVE_ID="$2"
AD_NAME="RealtyFlow Delhi - Image 1"

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/ads" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${AD_NAME}\",
    \"adset_id\": \"${ADSET_ID}\",
    \"creative\": {
      \"creative_id\": \"${CREATIVE_ID}\"
    },
    \"status\": \"PAUSED\"
  }" | jq '.id'
```

### 6. Create Custom Audience (Email List)

```bash
#!/bin/bash
# create-custom-audience.sh

AUDIENCE_NAME="RealtyFlow Agents - Email List"
EMAIL_LIST_FILE="emails.txt"  # One email per line

# Hash emails (SHA256)
HASHED_EMAILS=$(cat "$EMAIL_LIST_FILE" | xargs -I {} sh -c 'echo -n "{}" | sha256sum | cut -d" " -f1')

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/customaudiences" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${AUDIENCE_NAME}\",
    \"customer_file_source\": \"USER_PROVIDED_ONLY\",
    \"data\": $(echo $HASHED_EMAILS | jq -R 'split("\n")'),
    \"data_source\": \"USER_PROVIDED_ONLY\",
    \"content_type\": \"EMAIL\"
  }" | jq '.id'
```

### 7. Create Lookalike Audience

```bash
#!/bin/bash
# create-lookalike.sh

SOURCE_AUDIENCE_ID="$1"  # From custom audience above
LOOKALIKE_COUNTRY="IN"
LOOKALIKE_TYPE="0.01"  # 0.01 = top 1% similarity (most similar)

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/customaudiences" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Lookalike - RealtyFlow Agents (1%)\",
    \"lookalike_spec\": {
      \"source_id\": \"${SOURCE_AUDIENCE_ID}\",
      \"type\": \"${LOOKALIKE_TYPE}\"
    },
    \"lookalike_countries\": [\"${LOOKALIKE_COUNTRY}\"]
  }" | jq '.id'
```

### 8. Get Campaign Performance Metrics

```bash
#!/bin/bash
# get-performance.sh

CAMPAIGN_ID="$1"

curl -X GET "https://graph.instagram.com/v19.0/${CAMPAIGN_ID}/insights" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -d "fields=campaign_id,campaign_name,objective,spend,impressions,clicks,cpc,ctr,lead_generation_by_buttons,cost_per_lead" \
  -d "date_preset=last_7d" \
  | jq '.'
```

**Output Example:**
```json
{
  "data": [
    {
      "campaign_name": "RealtyFlow Q1 2024",
      "spend": "5000.00",
      "impressions": "150000",
      "clicks": "3500",
      "cpc": "1.43",
      "ctr": "2.33%",
      "cost_per_lead": "25.00",
      "lead_generation_by_buttons": "200"
    }
  ]
}
```

### 9. Pause/Resume Ads

```bash
#!/bin/bash
# pause-ad.sh

AD_ID="$1"
STATUS="PAUSED"  # Or: ACTIVE

curl -X POST "https://graph.instagram.com/v19.0/${AD_ID}" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -d "status=${STATUS}"
```

### 10. Update Campaign Budget

```bash
#!/bin/bash
# update-budget.sh

CAMPAIGN_ID="$1"
NEW_BUDGET="100000"  # In cents (₹1000)

curl -X POST "https://graph.instagram.com/v19.0/${CAMPAIGN_ID}" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -d "budget_rebalance_flag=true" \
  -d "daily_budget=${NEW_BUDGET}"
```

## Housing Special Ad Category Compliance

Meta requires housing/real estate ads to follow **Special Ad Category** rules:

### Required Disclosures

Add to all ad copy:

```
🏠 "This ad is about real estate. Housing can be a sensitive topic.
We want to help advertisers reach relevant audiences responsibly."
```

### Restricted Targeting

**DO NOT target by:**
- ✗ Race or ethnicity
- ✗ Religion
- ✗ Sexual orientation
- ✗ Gender identity
- ✗ Financial status
- ✗ Medical conditions

**OK to target by:**
- ✓ Age, gender, interests
- ✓ Location (region, city, postal code)
- ✓ Behaviors (real estate interest)
- ✓ Income level (only age + interest approach)

### Compliant Targeting Spec

```json
{
  "age_min": 25,
  "age_max": 65,
  "genders": [1, 2],
  "geo_locations": {
    "regions": [
      {"key": "2409"},
      {"key": "2428"}
    ]
  },
  "interests": [
    {"name": "Real estate"},
    {"name": "Property investment"},
    {"name": "Home improvement"}
  ]
}
```

## Budget Management Strategy

### Phase 1: Test (Days 1-7)

**Goal:** Find winning creatives, validate CPA

```
Total Budget: $200/month ($2000 over 10 days)
│
├── Ad Set 1: $600 (3 images, 2 copy variants = 6 ads)
├── Ad Set 2: $400 (Different audience)
└── Ad Set 3: $1000 (Broad audience)

KPI Targets:
- CPA (Cost Per Lead): $20–30
- CTR (Click-Through Rate): 1.5–2.5%
- CPM (Cost Per 1000 Impressions): $5–10
```

### Phase 2: Optimize (Days 8-20)

**Goal:** Scale winning ads, kill underperformers

```
Status: Review Performance
├── Ads with CPA < $20: SCALE UP budget +50%
├── Ads with CPA $20–30: MAINTAIN budget
├── Ads with CPA > $30: PAUSE (may restart later)
└── Ads with 0 leads after $100 spent: DELETE

Daily Allocation:
- Winner Creative (CPA $20): $20/day
- Runner-Up (CPA $25): $12/day
- Test New Creative: $8/day
```

### Phase 3: Scale (Days 21+)

**Goal:** Maximize volume while maintaining CPA

```
Scaling Rules (ONLY scale winners):
├── If CPA stable + budget available: +20% budget/day
├── If CPA increases 5%: PAUSE
├── If CPA decreases 10%: +30% budget
└── Monitor daily for deterioration

Daily Scaling Path:
Day 1: $20/day
Day 5: $24/day (+20%)
Day 10: $29/day (+20%)
Day 15: $35/day (+20%)
Day 20: $35/day (CAP at ROAS target)
```

## Performance Tier System

Categorize ads by performance to guide decisions:

| Tier | CPA | Status | Action |
|------|-----|--------|--------|
| **🟢 Scale** | $0–20 | Winning | +30% budget/day (if ROAS > 3.0) |
| **🟡 Maintain** | $20–30 | Stable | Keep budget flat, monitor daily |
| **🔴 Optimize** | $30–40 | Struggling | Test new copy, new image, new audience |
| **⚫ Kill** | $40+ | Failing | Pause after $150 spent with <5 leads |

## A/B Testing Protocol

### Test 1: Creative Comparison (Images)

```
Campaign: "RealtyFlow - Image Test"
├── Ad Set A: Image 1 (hero shot)
├── Ad Set B: Image 2 (dashboard screenshot)
├── Ad Set C: Image 3 (testimonial)
└── Ad Set D: Image 4 (infographic)

Duration: 7 days
Budget: $600 total ($150 per ad set)
Winner: Highest CTR + Lowest CPA

Test Metrics:
- CTR (Click-Through Rate) ← PRIMARY
- CPA (Cost Per Lead) ← SECONDARY
- CPM (Cost Per 1000 Impressions) ← DIAGNOSTIC
```

### Test 2: Copy Variation (Headline + Body)

```
Campaign: "RealtyFlow - Copy Test"
├── Ad Set A: Hook = "Pain" (frustration-focused)
├── Ad Set B: Hook = "Benefit" (transformation-focused)
├── Ad Set C: Hook = "Social Proof" (3000+ agents)
└── Ad Set D: Hook = "FOMO" (limited-time feel)

Winner: Lowest CPA + Highest Conversion Rate
```

### Test 3: Audience Segmentation

```
Campaign: "RealtyFlow - Audience Test"
├── Ad Set A: Narrow (25–35, Delhi NCR, High Interest)
├── Ad Set B: Mid (25–45, Metro Cities)
├── Ad Set C: Broad (25–55, All of India)
└── Ad Set D: Lookalike (1% similarity to existing customers)

Winner: Best CPA + Highest Volume
```

### Statistical Significance

**Stop test when:**
- Any ad set has ≥100 leads, OR
- Total spend ≥$500 for all ad sets, OR
- 14 days elapsed

**Then:** Declare winner if statistic significance met

```bash
# Simple: If best performing set has 2x leads of worst, it's likely significant
BEST_LEADS=150
WORST_LEADS=60
CONFIDENCE=$((BEST_LEADS / WORST_LEADS))
echo "Confidence ratio: ${CONFIDENCE}x (>2.0 = likely winner)"
```

## Creative Fatigue Detection

Monitor frequency and engagement drop:

| Frequency | Engagement | Action |
|-----------|-----------|--------|
| <2 | CTR > 1.5% | Keep running |
| 2–3 | CTR 1.2–1.5% | Monitor |
| 3–4 | CTR 0.8–1.2% | Pause or rotate |
| 4–5 | CTR 0.5–0.8% | Rotate creatives |
| >5 | CTR < 0.5% | Pause, refresh creative |

**Frequency** = Average # of times a person saw your ad

Daily check:

```bash
#!/bin/bash
# check-fatigue.sh

AD_ID="$1"

curl -X GET "https://graph.instagram.com/v19.0/${AD_ID}/insights" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -d "fields=ad_id,ad_name,frequency,impressions,clicks,ctr" \
  -d "date_preset=last_7d" \
  | jq '.data[] | "\(.ad_name): Freq=\(.frequency), CTR=\(.ctr)%"'
```

If frequency > 3 and CTR < 1.2%, rotate creative.

## KPI Targets Table

| KPI | Target | Range | Action If Below |
|-----|--------|-------|-----------------|
| **CPM** | $5–10 | ₹400–800 | Audience too broad, refine targeting |
| **CPC** | $1–2 | ₹80–160 | Low relevance score, improve creative |
| **CTR** | 1.5–2.5% | — | Weak copy/image, test new creative |
| **CPA** | $20–30 | ₹1600–2400 | Conversion funnel weak, improve landing page |
| **ROAS** | 3.0–5.0x | — | Not profitable, pause or optimize |
| **Lead Quality** | 60%+ valid | — | Form abandonment, simplify lead form |
| **Frequency** | <3 | — | Creative fatigue, rotate ads |

## Conversion API (CAPI) Setup

Track conversions server-side (more reliable):

```bash
#!/bin/bash
# setup-capi.sh

PIXEL_ID="your-pixel-id"
DATASET_ID="your-dataset-id"

# Test event delivery
curl -X POST "https://graph.instagram.com/v19.0/${PIXEL_ID}/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": [
      {
        \"event_name\": \"Lead\",
        \"event_time\": $(date +%s),
        \"action_source\": \"website\",
        \"event_source_url\": \"https://realtyflow.com/download\",
        \"user_data\": {
          \"email\": \"user@example.com\",
          \"phone\": \"9876543210\",
          \"fbc\": \"$FBC\",
          \"fbp\": \"$FBP\"
        },
        \"custom_data\": {
          \"value\": 1,
          \"currency\": \"INR\"
        }
      }
    ],
    \"test_event_code\": \"TEST12345\"
  }"
```

## Instagram Instant Form Creation

Capture leads without leaving Instagram:

```bash
#!/bin/bash
# create-lead-form.sh

FORM_NAME="RealtyFlow Lead Form"
QUESTIONS='
[
  {
    "type": "FULL_NAME",
    "key": "full_name"
  },
  {
    "type": "EMAIL",
    "key": "email"
  },
  {
    "type": "PHONE_NUMBER",
    "key": "phone_number"
  },
  {
    "type": "CITY",
    "key": "city"
  },
  {
    "type": "CUSTOM",
    "key": "property_type",
    "label": "What type of property interested in?",
    "options": ["Residential", "Commercial", "Land"]
  }
]'

curl -X POST "https://graph.instagram.com/v19.0/${META_AD_ACCOUNT}/leadgen_forms" \
  -H "Authorization: Bearer ${META_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${FORM_NAME}\",
    \"questions\": ${QUESTIONS},
    \"privacy_policy_url\": \"https://realtyflow.com/privacy\",
    \"status\": \"ACTIVE\"
  }" | jq '.id'
```

## Campaign Plan Template

Create a markdown file for each campaign:

```markdown
# Campaign Plan: RealtyFlow Q1 2024 Lead Generation

**Duration:** Jan 1 – Mar 31, 2024
**Total Budget:** $3000
**Target:** 150+ qualified leads at $20 CPA
**Platform:** Facebook + Instagram

---

## Campaign Structure

### Campaign
- **Name:** RealtyFlow Q1 2024 - Lead Gen
- **Objective:** LEAD_GENERATION
- **Special Ad Category:** REAL_ESTATE
- **Status:** [PAUSED until launch]

### Ad Set 1: Delhi NCR Warm Audience
- **Targeting:** Age 25–55, Delhi/NCR, Real estate interest
- **Budget:** $1200 (40% of total)
- **Bid Strategy:** Cost Cap ($20 CPA)
- **Ads:** 3 creative variations (image + copy test)

### Ad Set 2: Metro Cities Lookalike
- **Targeting:** Lookalike audience (1% similarity), Bangalore/Mumbai/Chennai
- **Budget:** $1200 (40% of total)
- **Ads:** 2 top-performing creatives from Ad Set 1

### Ad Set 3: Broad India Test
- **Targeting:** Age 25–45, All India, Property interest
- **Budget:** $600 (20% of total)
- **Ads:** 1 hero creative (for volume testing)

---

## Creative Assets

| Asset | Type | Dimensions | CTA |
|-------|------|-----------|-----|
| Asset 1 | Image | 1080×1350 (4:5) | "Download Now" |
| Asset 2 | Image | 1200×628 (16:9) | "Learn More" |
| Asset 3 | Image | 1080×1080 (1:1) | "Get Started" |

---

## Timeline

| Phase | Dates | Actions | Budget |
|-------|-------|---------|--------|
| **Setup** | Jan 1–3 | Create ads, review compliance, launch Ad Sets | — |
| **Test** | Jan 4–10 | Run all ads, identify winners | $500 |
| **Optimize** | Jan 11–20 | Scale winners, pause underperformers | $800 |
| **Scale** | Jan 21–31 | Focus budget on best 2–3 creatives | $700 |

---

## Daily Monitoring Checklist

- [ ] CPA for each ad (target: $20–30)
- [ ] Frequency (target: <3)
- [ ] CTR trend (target: >1.5%)
- [ ] Budget spend pace (on track?)
- [ ] Leads received (quality check)
- [ ] Creative fatigue (pause if CTR <1%)

---

## Success Criteria

✓ Achieved $20–25 CPA on 2+ ad sets
✓ Generated 120+ leads by end of campaign
✓ ROAS ≥ 3.0x (if revenue data available)
✓ Lookalike audience outperforms broad targeting
```

## Output Files

All campaign data will be saved to:

```
marketing-and-sales/ads/meta-campaigns/
├── campaign-plan-q1-2024.md
├── api-setup-commands.sh
├── performance-dashboards/
│   ├── daily-metrics-[date].csv
│   ├── creative-comparison.json
│   └── audience-analysis.json
└── creative-assets/
    ├── image-1-1080x1350.jpg
    ├── image-2-1200x628.jpg
    └── image-3-1080x1080.jpg
```

## Troubleshooting

### Issue: "Invalid targeting spec"
**Solution:** Check targeting fields match Meta's API spec (genders as array, regions with 'key')

### Issue: "Unable to upload image"
**Solution:** Ensure image meets Meta specs (min 600×600px, <8MB, JPG/PNG)

### Issue: "Lead generation forms not available"
**Solution:** Ensure account is eligible (min 2 weeks old, good standing)

### Issue: "CPA increasing over time"
**Solution:** Pause low-CTR ads, test new creative, reduce frequency (pause ads over 4 impressions)

---

**Skills Used Together:**
- Use `video-production` skill to create video ads
- Use `ugc-scripts` skill to write ad copy
- Use `voiceover-gen` skill for video ads with audio
- Combine with analytics to optimize performance
