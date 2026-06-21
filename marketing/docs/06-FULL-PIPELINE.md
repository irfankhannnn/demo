# Full Marketing Pipeline

End-to-end workflow from brand docs to content generation, publishing, paid ads, and monitoring.

---

## The 6-Stage Pipeline

```
Stage 1: BRIEF          Stage 2: CREATE         Stage 3: REVIEW
Read brand docs  →   Generate content   →   Check + refine
.brand/ files         Higgsfield MCP          Human approval
                      marketingskills
                            │
Stage 6: MONITOR        Stage 5: ADS            Stage 4: PUBLISH
Track metrics    ←   Launch campaigns   ←   Upload posts
Meta Ads MCP          Meta Ads MCP            Manual (Meta Business Suite)
```

---

## Workflow A: Weekly Content Batch (7 Posts in 1 Session)

Use this every Monday to plan and schedule the full week.

**Time: ~30-45 minutes total**

### Step 1: Generate the content plan
```
Read .brand/brand-kit.md and .brand/positioning.md.

Use content-strategy skill to create a 7-day Instagram content calendar for 
RealtyFlow targeting Indian real estate agents.

Week theme: [e.g., "Lead Management Chaos → Control"]
Include:
- Post type per day (image, carousel, reel, story)
- Content angle / hook per day
- Target persona per day (Rajesh Bhai, Priya Madam, or Dev Bhai)
- Brief visual description per post
- Suggested caption angle

Save to: marketing/campaigns/week-[XX]-plan.md
```

### Step 2: Generate all 7 images
```
Based on the plan in marketing/campaigns/week-[XX]-plan.md, 
use Higgsfield (Nano Banana Pro) to generate all 7 Instagram images (1080x1080px).

Keep consistent visual style throughout the week.
Save to: marketing/assets/images/week-[XX]/day-1.png through day-7.png
```

### Step 3: Write all 7 captions
```
Use social-content skill to write Instagram captions for all 7 posts 
in marketing/campaigns/week-[XX]-plan.md.

Hinglish tone. 3-5 sentences per caption. 15-20 hashtags per post.
Mix educational, emotional, and promotional angles.

Save to: marketing/posts/instagram/week-[XX]-captions.md
```

### Step 4: Schedule all 7 posts
```
Upload all 7 Instagram posts manually (Meta Business Suite) from the week-[XX] plan.

Images: marketing/assets/images/week-[XX]/
Captions: marketing/posts/instagram/week-[XX]-captions.md

Post times (IST):
Mon: 9 AM | Tue: 12 PM | Wed: 9 AM | Thu: 7 PM | Fri: 9 AM | Sat: 12 PM | Sun: 6 PM
```

---

## Workflow B: Launch a New Ad Campaign (Full Setup)

Use when launching a new product feature, offer, or targeting a new audience.

**Time: ~1-2 hours (content generation + setup)**

### Step 1: Brief + Strategy
```
Read .brand/brand-kit.md and .brand/positioning.md.

Use ad-creative skill to develop a Facebook ad campaign brief for:
- Goal: Lead generation (trial signups)
- Target: [Agency owners / Sales managers / Individual agents]
- Offer: Free trial, no credit card
- Budget: ₹2,000/day
- Duration: 14 days test

Output: 3 creative concepts with hook, headline, body copy, and visual description.
Save to: marketing/campaigns/[campaign-name]/brief.md
```

### Step 2: Generate ad creatives (3 variants for A/B)
```
Based on brief in marketing/campaigns/[campaign-name]/brief.md,
use Higgsfield (Nano Banana Pro) to generate 3 Facebook ad banners (1200x628px).

One per creative concept. Consistent branding.
Save to: marketing/campaigns/[campaign-name]/assets/variant-a.png, variant-b.png, variant-c.png
```

### Step 3: Generate video variant (optional)
```
Use Higgsfield (Kling 3.0) to generate a 15-second vertical video ad (9:16) 
based on the best performing concept from the brief.
Save to: marketing/campaigns/[campaign-name]/assets/video-ad-15s.mp4
```

### Step 4: Launch campaign on Meta
```
Use Meta Ads MCP to create campaign: [name from brief]
- Account: act_XXXXXXXXXX
- Objective: OUTCOME_LEADS
- Budget: ₹2,000/day

Create 3 ad sets (broad, lookalike, retarget) — see 05-META-ADS.md

Create 3 ads (one per variant image) + 1 video ad.
Status: ACTIVE. Start date: today.
```

### Step 5: Also publish organic posts about the campaign
```
Upload 3 Instagram posts manually (Meta Business Suite) this week 
supporting the [campaign-name] campaign.

Use the campaign assets in marketing/campaigns/[campaign-name]/assets/
Write organic captions using social-content skill.
Schedule: Mon, Wed, Fri at 9 AM IST.
```

---

## Workflow C: Complete Landing Page Launch

Full workflow from idea to live page with supporting content and ads.

### Step 1: Build the page
```
Read .brand/brand-kit.md and .brand/positioning.md.

Use landing-page skill to create an HTML landing page for:
- Page: RealtyFlow free trial signup
- Target audience: Agency owners (Rajesh Bhai persona)
- Key benefit: Full team visibility without micromanagement
- CTA: Start Free Trial
- Hinglish copy throughout
- Mobile-first design

Save HTML to: marketing/content/landing-pages/trial-agency-owners.html
```

### Step 2: Generate hero image
```
Use Higgsfield (Nano Banana Pro) to generate a hero image (1440x900px) 
for the landing page in marketing/content/landing-pages/trial-agency-owners.html.

Visual: Indian agency owner at desk, confident, looking at clean dashboard on screen.
Style: Professional, modern, warm lighting.
Colors: Dominant #2563EB blue.

Save to: marketing/content/landing-pages/hero-agency-owners.png
```

### Step 3: Generate 15s explainer video
```
Use Higgsfield (Veo 3.1) to generate a 15-second explainer for the landing page.
Embed in the page's hero section.

Visual: Quick product tour — dashboard → leads → follow-ups → deal closed.
Text overlays: Hinglish feature highlights.
Save to: marketing/content/landing-pages/explainer-15s.mp4
```

### Step 4: Drive traffic — paid ads
```
Use Meta Ads MCP to create traffic campaign for the landing page.
URL: https://realtyflow.in/agency-trial [or wherever page is hosted]
Creative: Use hero-agency-owners.png + explainer-15s.mp4
Copy from landing page headline and subheadline.
Budget: ₹1,500/day.
```

### Step 5: Drive traffic — organic
```
Upload 5 social posts manually (Meta Business Suite) over 5 days announcing the page.
Use ad-creative skill + social-content skill for platform-specific copy.
Include landing page URL in all posts.
Schedule Mon-Fri at 9 AM IST.
```

---

## Workflow D: Competitor Comparison Content

Content series positioning RealtyFlow vs. alternatives.

### Step 1: Research
```
Use competitor-profiling skill to analyze how RealtyFlow compares to:
- Sell.Do
- HubSpot (generic CRM)
- Excel + WhatsApp

Focus on: features real estate agents need, pricing, India-specific capabilities.
Save to: marketing/campaigns/competitor-series/research.md
```

### Step 2: Create comparison posts
```
Based on research in marketing/campaigns/competitor-series/research.md,
use Higgsfield to generate 3 comparison infographic images (1080x1080px):

1. "RealtyFlow vs Excel" — visual comparison card
2. "RealtyFlow vs WhatsApp Groups" — before/after style
3. "RealtyFlow vs Generic CRM" — features checklist

Hinglish text overlays. RealtyFlow clearly wins in all.
Save to: marketing/assets/images/competitor-series/
```

### Step 3: Write supporting blog post
```
Use seo-blog skill to write a 1500-word SEO blog post:
Title: "Best CRM for Real Estate Agents in India 2026: RealtyFlow vs HubSpot vs Sell.Do"
Target keywords: "CRM for real estate India", "best CRM for real estate agents"
Language: English (SEO) with natural Hinglish in examples
Structure: Comparison table, pros/cons, clear winner verdict

Save to: marketing/content/blog/best-crm-real-estate-india-2026.md
```

---

## Monitoring and Optimization

### Daily check (5 minutes)
```
"Pull yesterday's Meta Ads performance for account act_XXXXXXXXXX.
Show CPL, impressions, clicks, leads, and spend per ad set.
Flag any ad sets with CPL above ₹300 or frequency above 4."
```

### Weekly optimization (15 minutes)
```
"Pull 7-day performance summary for all active campaigns on act_XXXXXXXXXX.
Identify:
1. Top 2 performing ads by CPL
2. Bottom 2 performing ads
3. Ad sets with frequency > 3.5 (need new creative)
4. Budget reallocation recommendations

Then:
- Pause ads with CPL > ₹400
- Increase budget 20% on ad sets with CPL < ₹100
- Flag which creatives need refreshing"
```

### Monthly reporting
```
"Generate a monthly marketing performance report for May 2026:
- Total leads generated
- Average CPL
- Best performing campaign, ad set, and creative
- Social media: top 5 posts by engagement on Instagram and Facebook
- Recommendations for June

Save to: marketing/reports/monthly-report-may-2026.md"
```

---

## File Naming Conventions

| Asset Type | Convention | Example |
|-----------|------------|---------|
| FB ad image | `fb-ad-[audience]-[theme]-[variant].png` | `fb-ad-owners-chaos-v1.png` |
| IG post | `ig-post-[theme]-[date].png` | `ig-post-before-after-0509.png` |
| IG reel | `ig-reel-[theme]-[duration].mp4` | `ig-reel-ugc-30s.mp4` |
| Campaign folder | `[brand]-[goal]-[audience]-[month]` | `rf-leadgen-owners-may26` |
| Blog post | `[keyword]-[year].md` | `best-crm-real-estate-2026.md` |
| Weekly batch | `week-[XX]-[theme]` | `week-19-chaos-control` |
