# RealEstateFlow — Landing Pages

Complete marketing site for RealEstateFlow Real Estate OS. 5 standalone HTML pages, deployable to Netlify in minutes.

## Pages Built

| Page | File | URL | Purpose |
|------|------|-----|---------|
| Homepage | `main/index.html` | `realestateflow.in` | Full brand story, all personas |
| Agency Owner LP | `agency-owners/index.html` | `/agency-owners` | Google Ads → broker owners |
| Agent LP | `agents/index.html` | `/agents` | LinkedIn/WhatsApp → young agents |
| AI Employee LP | `ai-employee/index.html` | `/ai-employee` | Meta Video Ads → AI bot add-on |
| Demo Page | `demo/index.html` | `/demo` | All paid ad traffic → Calendly |

## Deploy to Netlify

### Option 1: Drag and Drop (Fastest)
1. Go to [netlify.com](https://netlify.com) → Log in
2. Drag the entire `landing-pages/` folder onto the Netlify dashboard
3. Netlify auto-deploys and gives you a URL (e.g., `random-name.netlify.app`)
4. Go to **Site Settings → Domain Management** → add `realestateflow.in`

### Option 2: Netlify CLI
```bash
npm install -g netlify-cli
cd landing-pages
netlify deploy --prod
```

## Before Going Live — 5-Step Checklist

### Step 1 — Replace 3 Tracking IDs (same ID goes in all files)

Open each HTML file and replace these 3 placeholders:

| Placeholder | Replace with | Where to get it |
|-------------|-------------|------------------|
| `G-XXXXXXXXXX` | Your GA4 Measurement ID | analytics.google.com → Admin → Data Streams |
| `YOUR_PIXEL_ID` | Your Meta Pixel ID | business.facebook.com → Events Manager |
| `YOUR_HOTJAR_ID` | Your Hotjar Site ID (numeric) | hotjar.com → Sites & Organizations |

These are already in `<head>` of all pages — just find/replace across the folder.

### Step 2 — Add Your Calendly Username

Calendly is already embedded in **demo** and **agency-owners** pages + partially in **ai-employee**.
Search all files for `YOUR_CALENDLY_USERNAME` and replace:
```
REPLACE: YOUR_CALENDLY_USERNAME
WITH: your-actual-calendly-username
```
URL format: `https://calendly.com/YOUR_USERNAME/30min`

### Step 3 — Connect Netlify Forms → Your Lead API

All 5 form names (for webhook mapping):

| Form Name | Page | Lead type |
|-----------|------|-----------|
| `lead-capture` | Homepage | CRM Trial signup |
| `demo-request` | Demo | Callback request |
| `agency-owner-lead` | Agency Owners | Demo booking |
| `agent-trial` | Agents | Trial signup |
| `ai-employee-demo` | AI Employee | Bot demo + `interest=ai-employee-addon` |

In Netlify: **Site Settings → Forms → Form Notifications → Add Webhook** → paste your API URL.

### Step 4 — Add YouTube Video IDs

Search for `[ YouTube embed` in any file. Replace each placeholder `<div>` with:
```html
<iframe width="100%" height="100%"
  src="https://www.youtube.com/embed/YOUR_VIDEO_ID?rel=0&modestbranding=1"
  frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
</iframe>
```

### Step 5 — Update Contact Details

Global find/replace across all files:
- `919999999999` → your WhatsApp number (no + prefix in wa.me links)
- `hello@realestateflow.in` → your actual email

---

## Tracking Events Map

| Event fired | When | GA4 event | Meta Pixel event |
|-------------|------|-----------|------------------|
| Page load | Every page view | `config` | `PageView` |
| Form submit | Any Netlify form submitted | `generate_lead` | `Lead` |
| Calendly booked | User books a slot | `schedule` | `Schedule` |

All events are already wired in — just need real IDs.

## Pricing Shown (Confirmed)

| Plan | Price |
|------|-------|
| CRM Solo | ₹999/month |
| CRM Team | ₹1,999/month (up to 3 members) |
| CRM Team+ | ₹4,999/month (up to 10 members) |
| WhatsApp AI Bot (Add-on) | +₹7,999/month — **NO free trial** |

**CRM Trial:** 14-day free trial, no credit card
**AI Bot Trial:** None — paid from day 1
**Guarantee:** 30-day money-back on CRM (no questions)
