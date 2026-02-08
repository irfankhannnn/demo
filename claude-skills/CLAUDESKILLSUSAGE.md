# Claude Skills Usage Guide — RealtyFlow Lead Generation

> Complete working guide with **260+ examples** across 13 categories.
> Each example includes the agent command, step-by-step strategy, and expected output.

## Table of Contents

1. [Branding & Positioning](#1-branding--positioning)
2. [Landing Pages](#2-landing-pages)
3. [SEO Research & Implementation](#3-seo-research--implementation)
4. [Image Creation — Banners & Posts](#4-image-creation--banners--posts)
5. [Video Creation — Product Demos](#5-video-creation--product-demos)
6. [Video Creation — Product Launch & Feature Explainers](#6-video-creation--product-launch--feature-explainers)
7. [UGC Videos (with Your Own Images/Videos)](#7-ugc-videos-with-your-own-imagesvideos)
8. [Audio Voiceover, Scene Matching & Lipsync](#8-audio-voiceover-scene-matching--lipsync)
9. [Meta Ads — Ad Sets, Testing & Leads](#9-meta-ads--ad-sets-testing--leads)
10. [Multi-Platform Outreach](#10-multi-platform-outreach)
11. [Data Scraping — All Platforms](#11-data-scraping--all-platforms)
12. [AI Outbound Calling](#12-ai-outbound-calling)
13. [End-to-End Campaign Workflows](#13-end-to-end-campaign-workflows)

## Prerequisites

```bash
# Required env vars (see INTEGRATIONS.md for full setup)
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
ELEVENLABS_API_KEY=...
META_ADS_ACCESS_TOKEN=...
META_ADS_ACCOUNT_ID=act_...
META_PIXEL_ID=...
SERPAPI_API_KEY=...
```

```powershell
.\claude-skills\setup.ps1          # Install agents/skills
cd my-video && npm install          # Remotion deps
ffmpeg -version                     # Verify FFmpeg
magick -version                     # Verify ImageMagick
```

---

## 1. Branding & Positioning

**Agent:** `brand-strategist` | **Skill:** `brand-strategy`
**Strategy:** Start every campaign here. Branding output feeds ALL other phases.

### 1.1 Full Brand Manifesto for City Launch
```
/agent brand-strategist
"Create a complete brand manifesto for RealtyFlow launching in Mumbai. Include brand
promise, mission, vision, core values, and 500-word manifesto in Hinglish."
```
- Agent loads `brand-strategy` skill → generates manifesto with problem-first messaging
- Output: `marketing-and-sales/creative/brand/mumbai-manifesto.md`

### 1.2 Generate 5 Tagline Variations for A/B Testing
```
/agent brand-strategist
"Create 5 taglines under 8 words each, in Hinglish, one per pain point: manual follow-ups,
lost leads, no analytics, slow response, spreadsheet chaos."
```
- Output: 5 taglines with A/B scoring rubric → `brand/tagline-variants.md`

### 1.3 Tone-of-Voice Guide for Sales Team
```
/agent brand-strategist
"Write a tone-of-voice guide for WhatsApp, email, and cold calls. Include do's/don'ts,
10 sample Hinglish phrases, and a cheat sheet."
```
- Channel-specific tone rules (WhatsApp=casual, Email=semi-formal, Call=warm)
- Output: `brand/tone-guide.md`

### 1.4 Competitor Positioning Matrix
```
/agent brand-strategist
"Analyze 5 competitors (Sell.Do, NoBroker Agent, Leadsquared, Freshsales, Zoho CRM).
Create positioning matrix showing where RealtyFlow wins. Hinglish messaging."
```
- Maps competitors on price, features, India-focus axes
- Output: `brand/positioning-matrix.md`

### 1.5 Brand Keyword Vocabulary (Hindi-English)
```
/agent brand-strategist
"Build 50 real estate CRM terms in English + Hinglish, grouped by category:
lead management, property, analytics, communication, automation."
```
- Output: `brand/keyword-vocabulary.md`

### 1.6 Messaging Matrix by Buyer Persona
```
/agent brand-strategist
"Create messaging matrix for 4 personas: solo agent, small brokerage (5-10),
large agency (50+), developer sales team. Pain points + Hinglish hooks for each."
```
- Output: `brand/messaging-matrix.md`

### 1.7 Brand Story for About Page
```
/agent brand-strategist
"Write RealtyFlow origin story for About page. 300 words, Hinglish, founder's journey
from frustrated agent to building the solution."
```
- Output: `brand/about-story.md`

### 1.8 Social Media Bio Pack
```
/agent brand-strategist
"Generate social media bios for Instagram, LinkedIn, Twitter/X, Facebook, YouTube.
Platform-optimized, with emojis, Hinglish."
```
- Follows character limits per platform
- Output: `brand/social-bios.md`

### 1.9 Elevator Pitch Variations
```
/agent brand-strategist
"Create 3 elevator pitches: 15-second, 30-second, 2-minute. All Hinglish.
Include delivery notes (pace, emphasis, pause points)."
```
- Output: `brand/elevator-pitches.md`

### 1.10 Brand Guidelines for Designers
```
/agent brand-strategist
"Write brand guidelines: color palette (hex), typography (fonts), logo usage rules,
image style, iconography preferences."
```
- Output: `brand/brand-guidelines.md`

### 1.11 City-Specific Brand Adaptation (Pune)
```
/agent brand-strategist
"Adapt brand messaging for Pune. Pune agents use more Marathi. Create 5 Pune-specific
taglines mixing English + Marathi + Hindi."
```
- Output: `brand/pune-adaptation.md`

### 1.12 Customer Testimonial Framework
```
/agent brand-strategist
"Create testimonial framework: 10 questions for happy customers, 3 formats (quote,
case study, video script), Hinglish templates."
```
- Output: `brand/testimonial-framework.md`

### 1.13 Brand Launch Announcement (4 Channels)
```
/agent brand-strategist
"Write launch announcements: press release (formal English), LinkedIn (professional
Hinglish), Instagram (casual Hinglish), WhatsApp (very casual)."
```
- Output: `brand/launch-announcement.md`

### 1.14 Objection Response Playbook
```
/agent brand-strategist
"Create playbook with 15 common objections Indian agents raise about CRM. Include
Hinglish response using FEEL-FELT-FOUND framework for each."
```
- Output: `brand/objection-playbook.md`

### 1.15 Email Signature Brand Templates
```
/agent brand-strategist
"Design 3 email signature templates: founder, sales rep, support. Include Hinglish
tagline, social links, 'Book a Demo' CTA."
```
- Output: `brand/email-signatures.md`

### 1.16 Partnership Pitch Deck Copy
```
/agent brand-strategist
"Write copy for 10-slide partnership pitch deck targeting real estate associations.
Cover: problem, solution, market size, traction, partnership model."
```
- Output: `brand/partnership-deck-copy.md`

### 1.17 Seasonal Campaign Themes (12 Months)
```
/agent brand-strategist
"Create 12 monthly campaign themes aligned with Indian real estate cycles (Diwali,
Gudi Padwa, financial year-end). Hinglish names + messaging + offers."
```
- Output: `brand/seasonal-calendar.md`

### 1.18 Internal Culture Deck
```
/agent brand-strategist
"Write culture deck: mission, 5 values with Hindi translations, how we work,
team principles. For internal onboarding."
```
- Output: `brand/culture-deck.md`

### 1.19 Referral Program Messaging
```
/agent brand-strategist
"Design messaging for 'Refer a Broker, Earn ₹5000'. Create WhatsApp share message,
email invite, landing page headline, social post."
```
- Output: `brand/referral-messaging.md`

### 1.20 Brand Audit Checklist
```
/agent brand-strategist
"Create 30-item brand audit checklist covering: website, social, ads, emails,
WhatsApp, sales calls. Scoring 1-5 per item."
```
- Output: `brand/brand-audit-checklist.md`

---

## 2. Landing Pages

**Agent:** `landing-page-builder` | **Skill:** `landing-page`
**Strategy:** Every landing page includes Meta Pixel, lead form, Hinglish copy, mobile-first design.

### 2.1 Full Lead-Gen Landing Page (Mumbai)
```
/agent landing-page-builder
"Create complete HTML/CSS landing page for RealtyFlow targeting Mumbai. Hero, features,
testimonials, pricing, FAQ, lead capture form. Hinglish copy, mobile-first."
```
- Generates full HTML with TailwindCSS, Meta Pixel, structured data
- Output: `landing-pages/mumbai-main.html`

### 2.2 City-Specific Landing Page (Pune)
```
/agent landing-page-builder
"Clone Mumbai page for Pune. Change testimonials, update pricing to Pune rates,
include Marathi phrases."
```
- Output: `landing-pages/pune-main.html`

### 2.3 Feature-Focused Page (AI Follow-Up)
```
/agent landing-page-builder
"Landing page focused on AI follow-up feature only. Hero: 'Aapka CRM Automatically
Follow-up Karega', demo video placeholder, trial signup form."
```
- Output: `landing-pages/feature-ai-followup.html`

### 2.4 Webinar Registration Page
```
/agent landing-page-builder
"Webinar landing page: 'How to 3X Your Closings with CRM'. Countdown timer, speaker
bio, agenda, registration form with calendar link."
```
- Output: `landing-pages/webinar-registration.html`

### 2.5 Comparison Page (vs Sell.Do)
```
/agent landing-page-builder
"Comparison page: RealtyFlow vs Sell.Do. Feature-by-feature table, pricing comparison,
'Switch Now' CTA with form."
```
- Output: `landing-pages/vs-selldo.html`

### 2.6 Free Trial Signup (Minimal)
```
/agent landing-page-builder
"Minimal page for 14-day free trial. Hero + 3 bullet benefits + 1 testimonial +
signup form (name, email, phone). No pricing."
```
- Output: `landing-pages/free-trial.html`

### 2.7 Case Study Page
```
/agent landing-page-builder
"Case study: 'How Sharma Properties Increased Closings by 40%'. Metrics, timeline,
challenges → solution → results, quote pullouts."
```
- Output: `landing-pages/case-study-sharma.html`

### 2.8 Pricing Page (3 Tiers)
```
/agent landing-page-builder
"Pricing page: Starter ₹999/mo, Pro ₹2499/mo, Enterprise custom. Feature comparison,
FAQ accordion, 'Talk to Sales' form."
```
- Output: `landing-pages/pricing.html`

### 2.9 Demo Booking Page
```
/agent landing-page-builder
"'Book a Free Demo' page. Calendly embed placeholder, 3 things they'll learn,
urgency: 'Is hafte sirf 10 slots bache hain'."
```
- Output: `landing-pages/book-demo.html`

### 2.10 Thank You / Post-Signup Page
```
/agent landing-page-builder
"Thank-you page: next steps, WhatsApp group link, 'Share with a friend' social buttons.
Conversion tracking fires on load."
```
- Output: `landing-pages/thank-you.html`

### 2.11 Mobile-Only Page (WhatsApp Traffic)
```
/agent landing-page-builder
"Mobile-only page for WhatsApp link clicks. Under 50KB, large tap buttons,
tap-to-call, tap-to-WhatsApp. No desktop version."
```
- Output: `landing-pages/mobile-whatsapp.html`

### 2.12 A/B Test Variants (3 Hero Sections)
```
/agent landing-page-builder
"3 hero section variants: A: Pain ('Tired of losing leads?'), B: Solution ('AI follows
up for you'), C: Social proof ('500+ agents'). Separate files."
```
- Output: `landing-pages/mumbai-variant-a.html`, `-b.html`, `-c.html`

### 2.13 Event/Conference Page
```
/agent landing-page-builder
"RECon India 2025 booth page. Booth number, demo schedule, 'Visit for free CRM setup',
QR code placeholder, lead scan form."
```
- Output: `landing-pages/recon-india-2025.html`

### 2.14 Multilingual Page (Hindi + English Toggle)
```
/agent landing-page-builder
"Landing page with JS language toggle. Full Hindi and full English. Toggle switches
content without reload. Stores preference in localStorage."
```
- Output: `landing-pages/multilingual.html`

### 2.15 Video Sales Letter (VSL) Page
```
/agent landing-page-builder
"VSL page: large video player, no nav, minimal text. CTA button appears after 60
seconds via JS timer. Exit-intent popup."
```
- Output: `landing-pages/vsl-page.html`

### 2.16 Integration Partners Page
```
/agent landing-page-builder
"Integration showcase: WhatsApp, 99acres, MagicBricks, Housing.com, IndiaMART.
Logo grid + accordion 'How it works' per integration."
```
- Output: `landing-pages/integrations.html`

### 2.17 ROI Calculator Page
```
/agent landing-page-builder
"Interactive ROI calculator. Sliders: number of agents, leads/month, close rate.
Real-time calculation shows revenue increase. Pre-filled form CTA."
```
- Output: `landing-pages/roi-calculator.html`

### 2.18 Testimonial Wall Page
```
/agent landing-page-builder
"Masonry grid testimonial page. 12 cards with photo placeholders, company, city, quote.
Filter buttons by city. 'Add Your Story' CTA."
```
- Output: `landing-pages/testimonials.html`

### 2.19 Dubai Waitlist Page
```
/agent landing-page-builder
"'Coming to Dubai' waitlist page. Countdown to launch, early bird pricing teaser,
email signup. Arabic + English."
```
- Output: `landing-pages/dubai-waitlist.html`

### 2.20 Reusable Exit-Intent Popup Module
```
/agent landing-page-builder
"Standalone exit-intent popup: 'Wait! Get 20% off', email form, dismiss button.
Cookie-based frequency cap. Embeddable via single <script> tag."
```
- Output: `landing-pages/exit-popup-module.html`

---

## 3. SEO Research & Implementation

**Agent:** `seo-content-writer` | **Skill:** `seo-blog`
**Strategy:** Target long-tail Hinglish keywords. Write 2,000+ word articles with H1-H3, internal links, and distribution assets.

### 3.1 Complete Keyword Research (Mumbai)
```
/agent seo-content-writer
"Keyword research for 'real estate CRM' in Mumbai. Find 30 long-tail keywords, group
by intent (informational, commercial, transactional), estimate difficulty."
```
- Output: `blog/keyword-research-mumbai.md`

### 3.2 Editorial Calendar (3 Months)
```
/agent seo-content-writer
"3-month editorial calendar, 2 posts/week. Mix pillar and supporting articles.
Include target keyword and publish date for each."
```
- Output: `blog/editorial-calendar-q1.md`

### 3.3 Pillar Article — "Best Real Estate CRM India 2025"
```
/agent seo-content-writer
"2500-word pillar article comparing 7 CRMs. Pros/cons tables, pricing, FAQ schema.
Target: 'best real estate CRM India'. Hinglish."
```
- Output: `blog/best-real-estate-crm-india-2025.md`

### 3.4 How-To — "Manage 100+ Leads Without Losing Any"
```
/agent seo-content-writer
"Step-by-step how-to: 'Bina Koi Lead Khoye 100+ Leads Kaise Manage Karein'. 1500
words, screenshot placeholders, numbered steps."
```
- Output: `blog/lead-management-100-plus.md`

### 3.5 Listicle — "15 Signs You Need a CRM"
```
/agent seo-content-writer
"Listicle: '15 Signs Aapko CRM Ki Zaroorat Hai'. Casual Hinglish, relatable scenarios
for Indian agents, ends with RealtyFlow plug."
```
- Output: `blog/15-signs-need-crm.md`

### 3.6 Google Business Profile Optimization
```
/agent seo-content-writer
"GBP optimization guide: category selection, 750-char Hinglish description, attributes,
service areas, weekly post calendar."
```
- Output: `blog/gbp-optimization.md`

### 3.7 City Market Analysis — Pune 2025
```
/agent seo-content-writer
"Market analysis: 'Pune Real Estate Market 2025'. Price trend tables per locality,
emerging hotspots, infrastructure projects."
```
- Output: `blog/pune-real-estate-2025.md`

### 3.8 FAQ Content Hub (25 Questions)
```
/agent seo-content-writer
"25 common CRM questions, 100-200 word Hinglish answers each. JSON-LD FAQ schema.
Grouped by: features, pricing, setup, support."
```
- Output: `blog/faq-hub.md`

### 3.9 Glossary Page (40 Terms)
```
/agent seo-content-writer
"SEO glossary: 40 CRM terms in simple Hinglish, 50-100 words each. Internal links
to blog posts. DefinedTerm schema."
```
- Output: `blog/crm-glossary.md`

### 3.10 Content Cluster — Lead Generation
```
/agent seo-content-writer
"Content cluster for 'lead generation real estate India'. 1 pillar (3000 words) +
6 supporting articles. Outlines + internal linking map."
```
- Output: `blog/cluster-lead-generation.md`

### 3.11 Case Study Blog Post
```
/agent seo-content-writer
"Case study: 'How Agent Verma Doubled Sales in 3 Months'. Before/after metrics,
implementation timeline, quote pullouts."
```
- Output: `blog/case-study-agent-verma.md`

### 3.12 Trend Article — AI in Real Estate
```
/agent seo-content-writer
"2000-word trend piece: 'AI Real Estate Mein Kya Revolution La Raha Hai (2025)'.
Chatbots, AI follow-up, predictive analytics, virtual tours."
```
- Output: `blog/ai-real-estate-revolution-2025.md`

### 3.13 Meta Description Optimization Pack
```
/agent seo-content-writer
"Write optimized meta titles (60 chars) and descriptions (155 chars) for all existing
blog posts. Primary keyword + CTA in each."
```
- Output: `blog/meta-descriptions-pack.md`

### 3.14 Internal Linking Audit
```
/agent seo-content-writer
"Audit all blog posts. Create internal linking strategy: which posts should link where,
with specific anchor text suggestions."
```
- Output: `blog/internal-linking-audit.md`

### 3.15 Social Distribution Copy (5 Posts)
```
/agent seo-content-writer
"For 5 blog posts create: LinkedIn post, Instagram caption, Twitter thread (5 tweets),
WhatsApp share message. All Hinglish."
```
- Output: `blog/distribution-copy-batch.md`

### 3.16 Infographic Content — "Agent's Day With CRM"
```
/agent seo-content-writer
"Infographic copy: 'Agent's Day With vs Without CRM'. 8 time blocks, data points,
copy for each section. Designer brief included."
```
- Output: `blog/infographic-agent-day.md`

### 3.17 YouTube Video SEO Pack
```
/agent seo-content-writer
"SEO-optimized titles, descriptions (with timestamps), and 30 tags each for 5 YouTube
videos: demo, walkthrough, testimonial, comparison, tutorial."
```
- Output: `blog/youtube-seo-pack.md`

### 3.18 Schema Markup Generator (5 Types)
```
/agent seo-content-writer
"Generate JSON-LD schema: Organization, SoftwareApplication, FAQPage, Article,
BreadcrumbList. Ready to paste into HTML head."
```
- Output: `blog/schema-markup-all.md`

### 3.19 Competitor Content Gap Analysis
```
/agent seo-content-writer
"Analyze top 5 competitors' blogs. Find 15 uncovered topics we can rank for.
Article titles + keyword targets + priority."
```
- Output: `blog/content-gap-analysis.md`

### 3.20 Blog-to-Multi-Format Repurpose
```
/agent seo-content-writer
"Repurpose 'Best CRM' pillar article into: LinkedIn article (1000 words), Twitter
thread (10 tweets), SlideShare outline (15 slides)."
```
- Output: `blog/repurpose-best-crm-article.md`

---

## 4. Image Creation — Banners & Posts

**Agent:** `nano-designer` | **Skill:** `image-generation`, `design-assets`
**Script:** `generate-image.ps1`
**Strategy:** Generate base image with DALL-E 3 / Gemini, then post-process with ImageMagick for text overlays and resizing.

### 4.1 Facebook Ad Banner (1200×628)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Modern real estate CRM dashboard on laptop, Indian agent smiling, clean office, warm lighting" `
  -Size "1792x1024" -Output "marketing-and-sales/creative/images/fb-ad-bg.png"
# Add text overlay
magick fb-ad-bg.png -resize 1200x628! -gravity South -fill white -font Arial-Bold `
  -pointsize 48 -annotate +0+30 "Ab Har Lead Track Karein" fb-ad-final.png
```

### 4.2 Instagram Post (1080×1080)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Abstract gradient, royal blue to purple, subtle geometric patterns, minimal" `
  -Size "1024x1024" -Quality "hd" -Output "images/ig-carousel-cover-bg.png"
magick ig-carousel-cover-bg.png -resize 1080x1080! -gravity Center -fill white `
  -font Arial-Bold -pointsize 56 -annotate +0+0 "Real Estate Agent Ka Secret Weapon" ig-post.png
```

### 4.3 Instagram Story (1080×1920)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Smartphone showing CRM notifications, hand holding phone, white background, vertical" `
  -Size "1024x1792" -Quality "hd" -Output "images/story-ad.png"
```

### 4.4 LinkedIn Company Banner (1584×396)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "gemini" `
  -Prompt "Mumbai skyline panoramic golden hour, professional real estate feel, wide banner" `
  -AspectRatio "4:1" -Output "images/linkedin-banner.png"
```

### 4.5 Batch Carousel Slides (5 Images)
```powershell
$features = @("Lead Auto-Assignment","WhatsApp Integration","AI Follow-Up","Analytics","Site Visit Tracker")
for ($i = 0; $i -lt $features.Count; $i++) {
    .\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
      -Prompt "Minimal flat icon of $($features[$i]), brand blue background, centered" `
      -Size "1024x1024" -Output "images/carousel-slide-$($i+1).png"
}
```

### 4.6 Google Display Ad Set (4 Sizes)
```powershell
# Generate base, then resize to standard display sizes
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Clean CRM screenshot mockup, modern blue gradient" `
  -Size "1792x1024" -Quality "hd" -Output "images/display-base.png"
$sizes = @("300x250","728x90","160x600","336x280")
foreach ($s in $sizes) { magick display-base.png -resize "${s}!" "images/display-${s}.png" }
```

### 4.7 WhatsApp Status Image
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Bold vibrant gradient background, high contrast, vertical mobile format" `
  -Size "1024x1792" -Output "images/whatsapp-status.png"
```

### 4.8 Blog Featured Image
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Professional comparison infographic, software icons on clean board, checkmarks" `
  -Size "1792x1024" -Output "images/blog-best-crm-2025.png"
```

### 4.9 Email Header Banner (600×200)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "gemini" `
  -Prompt "Clean modern email header, gradient blue, professional real estate theme" `
  -AspectRatio "3:1" -Output "images/email-header.png"
```

### 4.10 Testimonial Card Template
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Testimonial card template, circular photo placeholder, 5 stars, quote marks, blue/white" `
  -Size "1024x1024" -Output "images/testimonial-card.png"
```

### 4.11 YouTube Thumbnail (1280×720)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Eye-catching YouTube thumbnail, bright yellow background, red accents, shocked emoji" `
  -Size "1792x1024" -Output "images/yt-thumbnail.png"
```

### 4.12 AI-Generated Agent Photo (Gemini)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "gemini" `
  -Prompt "Professional Indian real estate agent, male, 35, formal shirt, modern office, laptop" `
  -AspectRatio "16:9" -Output "images/agent-photo.png"
```

### 4.13 Before/After Split Image
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Split image: left chaotic desk scattered papers stressed, right clean desk laptop relaxed" `
  -Size "1792x1024" -Quality "hd" -Output "images/before-after.png"
```

### 4.14 Event Poster (Vertical A4)
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Professional event poster, modern conference design, blue and gold, vertical A4" `
  -Size "1024x1792" -Output "images/event-poster.png"
```

### 4.15 App Store Screenshot Mockup
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Mobile phone mockup showing CRM app, notification badges, property cards, lead list" `
  -Size "1024x1792" -Output "images/app-screenshot.png"
```

### 4.16 Pricing Table for Instagram
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Modern pricing table, 3 columns, gradient blue cards, popular badge on middle" `
  -Size "1024x1024" -Output "images/pricing-ig.png"
```

### 4.17 Brand Pattern Texture
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Seamless pattern, subtle line icons of houses keys charts, light blue, low opacity" `
  -Size "1024x1024" -Output "images/brand-pattern.png"
```

### 4.18 Social Proof Metrics Banner
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Metrics banner, three large numbers with icons, dark background, bright numbers" `
  -Size "1792x1024" -Output "images/social-proof.png"
```

### 4.19 Infographic Base Image
```powershell
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "Vertical timeline infographic template, 8 time slots, icons, professional blue, tall" `
  -Size "1024x1792" -Output "images/infographic-base.png"
```

### 4.20 Dry Run — Preview Prompts Without API Call
```powershell
# Preview the API call without spending credits
.\claude-skills\scripts\generate-image.ps1 -Provider "openai" `
  -Prompt "your prompt" -Size "1024x1024" -Output "test.png" -DryRun
```
- Review prompts first → approve → then run without `-DryRun`

---

---

## Continue Reading

- **[Part 2: Video Creation — Product Demos & Feature Explainers](./CLAUDESKILLSUSAGE-PART2.md)** (Sections 5-6, 40 examples)
- **[Part 3: UGC Videos with Custom Media & Audio/Voiceover/Lipsync](./CLAUDESKILLSUSAGE-PART3.md)** (Sections 7-8, 40 examples)
- **[Part 4: Meta Ads & Multi-Platform Outreach](./CLAUDESKILLSUSAGE-PART4.md)** (Sections 9-10, 40 examples)
- **[Part 5: Data Scraping, AI Calling & E2E Workflows](./CLAUDESKILLSUSAGE-PART5.md)** (Sections 11-13, 50+ examples)
