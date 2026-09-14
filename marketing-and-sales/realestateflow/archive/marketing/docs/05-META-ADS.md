# Meta Ads Campaign Guide

Create, manage, and optimize Facebook and Instagram ad campaigns using the Meta Ads MCP (29 tools).

---

## Setup Prerequisites

Before creating any campaign, have ready:
- **Ad Account ID:** `act_XXXXXXXXXX` (from Facebook Business Manager)
- **Facebook Page ID:** Your RealtyFlow FB page ID
- **Instagram Account ID:** @realtyflow_india account ID
- **Pixel ID:** Your Facebook Pixel (for conversion tracking)

Store these in `marketing/campaigns/.meta-config.md`.

---

## Campaign Structure (Facebook's Hierarchy)

```
Campaign (objective + budget cap)
  └── Ad Set (audience + placement + budget)
        └── Ad (creative + copy + URL)
```

---

## Example 1: Lead Generation Campaign (Full Setup)

**Step 1: Create the campaign**
```
Use Meta Ads MCP to create a new Facebook ad campaign on account act_XXXXXXXXXX.

Campaign settings:
- Name: "RealtyFlow - Lead Gen - Agency Owners - May 2026"
- Objective: OUTCOME_LEADS
- Status: PAUSED (we'll turn on after reviewing)
- Daily budget: ₹2,000/day (set at campaign level)
- Campaign budget optimization: ON
```

**Step 2: Create Ad Sets (3 audiences)**
```
Use Meta Ads MCP to create 3 ad sets under campaign [campaign_id]:

Ad Set 1: "Broad - Agency Owners Mumbai/Pune"
- Audience: 
  - Locations: Mumbai, Pune, Thane, Navi Mumbai
  - Age: 30-55
  - Interests: Real estate, Property management, Business, Entrepreneurship
  - Job titles: Real estate agent, Property dealer, Real estate developer
- Placements: Facebook Feed, Instagram Feed, Instagram Reel
- Budget: ₹800/day
- Optimization: LEAD_GENERATION
- Bid strategy: LOWEST_COST

Ad Set 2: "Lookalike - 1% Website Visitors"
- Audience: Lookalike of website visitors (from Pixel XXXXXXXXXX), 1%, India
- Locations: India (major metros)
- Age: 25-55
- Placements: Facebook Feed, Instagram Feed
- Budget: ₹700/day
- Optimization: LEAD_GENERATION

Ad Set 3: "Retargeting - Landing Page Visitors"
- Audience: People who visited realtyflow.in in last 30 days (Pixel custom audience)
- Placements: Facebook Feed, Instagram Feed, Facebook Right Column
- Budget: ₹500/day
- Optimization: LEAD_GENERATION

All ad sets: Status PAUSED, start date tomorrow.
```

**Step 3: Create Ads with Creative**
```
Use Meta Ads MCP to create ads under each ad set.

For each ad set, create 2 ad variants (A/B test):

Variant A: Image Ad
- Creative: Upload marketing/assets/images/fb-ad-banner-agency-owner-01.png
- Headline: "Leads Track Karo, Deals Close Karo"
- Primary text: "Team ka kaam track karo bina micromanage kiye. RealtyFlow — Indian real estate ke liye."
- Description: "Free trial available. No credit card."
- CTA button: LEARN_MORE
- Destination URL: https://realtyflow.in/agency-owners?utm_source=facebook&utm_campaign=lead-gen-may26

Variant B: Video Ad
- Creative: Upload marketing/assets/videos/fb-ad-speed-15s-01.mp4
- Headline: "Jo Pehle Call Karta Hai, Wo Deal Jeetta Hai"
- Primary text: "RealtyFlow se follow-up automatic hota hai. Ek bhi lead miss nahi hoti."
- CTA button: SIGN_UP
- Destination URL: https://realtyflow.in/trial?utm_source=facebook&utm_campaign=lead-gen-may26

Link ads to the correct Facebook Page (Page ID: XXXXXXXXXX) and Instagram account.
```

---

## Example 2: Retargeting Campaign

```
Use Meta Ads MCP to create a retargeting campaign:

Campaign:
- Name: "RealtyFlow - Retarget - Trial Abandoned - May 2026"
- Objective: OUTCOME_LEADS
- Budget: ₹500/day

Ad Set:
- Audience: Custom audience — people who visited realtyflow.in/trial but did NOT convert
  (Use Pixel XXXXXXXXXX, last 14 days)
- Locations: India
- Age: 25-55
- Placements: Facebook Feed, Instagram Feed
- Optimization: LEAD_GENERATION

Ads (2 variants):

Variant A: Urgency
- Image: marketing/assets/images/fb-ad-urgency.png
- Headline: "Abhi Nahi, Toh Kab?"
- Text: "Aapne trial dekha tha. Ek baar use karke dekho — free hai. Leads miss hona band."
- CTA: START_TRIAL
- URL: https://realtyflow.in/trial?utm_source=retargeting

Variant B: Social proof
- Image: marketing/assets/images/fb-ad-social-proof.png
- Headline: "500+ Agencies Use Kar Rahi Hain"
- Text: "Mumbai, Pune, Delhi ke agents RealtyFlow pe aa gaye hain. Aap kab aa rahe ho?"
- CTA: SIGN_UP
```

---

## Example 3: A/B Testing Creative

```
Use Meta Ads MCP to set up an A/B test:

Create a campaign split test on campaign [campaign_id]:
- Variable: Creative
- Split: 50/50
- Duration: 7 days
- Winning metric: Cost per lead

Creative A: Pain point angle
File: marketing/assets/images/ab-test-visibility/variant-a.png
Headline: "Team ka kaam dikh nahi raha? Fix karo."

Creative B: Feature angle  
File: marketing/assets/images/ab-test-visibility/variant-b.png
Headline: "Ek Dashboard Mein Poori Pipeline"

Keep audience, placement, budget identical for both.
Show results after 7 days and recommend winner.
```

---

## Example 4: Conversion API (CAPI) Setup

For better tracking and lower CPL, set up CAPI:

```
Use Meta Ads MCP to configure Conversions API for ad account act_XXXXXXXXXX.

Event setup:
- Event: Lead (when user submits trial signup form)
- Event source: realtyflow.in/trial
- Test event code: [get from Events Manager]
- Server-side events: enabled

Map parameters:
- email: user email from form
- phone: user phone from form (Indian format)
- external_id: user ID hash
- event_name: "Lead"
- event_time: timestamp
- action_source: "website"
```

---

## Example 5: Pulling Analytics

```
"Use Meta Ads MCP to pull performance report for account act_XXXXXXXXXX:
- Date range: Last 7 days
- Metrics: impressions, clicks, leads, CPL, CTR, spend, reach
- Breakdown by: campaign, then ad set
- Format as a table"
```

**Key metrics to monitor:**
| Metric | Target | Pause if |
|--------|--------|---------|
| CPL (Cost per Lead) | < ₹150 | > ₹400 |
| CTR | > 1.5% | < 0.5% |
| Lead form completion | > 40% | < 20% |
| Frequency | < 3 | > 5 |
| ROAS | > 3x | < 1.5x |

---

## Optimization Commands

```
"Pause ad sets with CPL above ₹300 in the last 3 days"

"Increase budget by 20% on ad sets with CPL below ₹100"

"Duplicate the winning ad set and scale budget to ₹2000/day"

"Create a lookalike audience from people who converted (became leads) 
in the last 30 days — 1%, India"

"Update all ads in campaign [id] to add UTM parameter utm_content=may-26-v2"
```

---

## Campaign Naming Convention

Always use this format:
```
[Brand] - [Goal] - [Audience] - [Month Year]
RealtyFlow - Lead Gen - Agency Owners Mumbai - May 2026
RealtyFlow - Retarget - Trial Abandoned - May 2026
RealtyFlow - Awareness - Agents All India - Jun 2026
```

---

## Budget Recommendations (Starting)

| Stage | Daily Budget | Split |
|-------|-------------|-------|
| Testing (Week 1-2) | ₹1,500/day | 50% broad, 50% lookalike |
| Scaling (Week 3-4) | ₹3,000/day | 30% broad, 40% lookalike, 30% retarget |
| Full scale | ₹6,000+/day | Campaign budget optimization ON |
