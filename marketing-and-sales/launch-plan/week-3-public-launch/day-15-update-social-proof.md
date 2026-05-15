# Day 15 — Update Landing Page With Social Proof + Demo Video

## Objective
Deploy the 5+ Day-14 testimonials, the mini case study, AND a 60-90 second product demo video onto the landing page — making it credibility-loaded for Day 16 directory launches and Days 17-19 cold outreach traffic.

## Why This Matters for RealtyFlow
Day 15 is the threshold between "private soft launch" and "public launch". The landing page Week 3 visitors see must be radically different from Week 1's: real names, real Indian cities, real outcomes. A 60-sec demo video on the landing page doubles signup conversion. Cold traffic in Week 3 is unforgiving — pages without social proof get 1-2% conversion; pages WITH proof can hit 5-8%.

## User Story
As a founder, I want the landing page updated with 5+ named testimonials, 1 mini case study, a 60-90 second embedded demo video, and updated trust signals — all deployed and tested on mobile — so that Day 16 directory traffic and Days 17-19 cold outreach traffic see a credible, conversion-optimized page from the moment of public launch.

## Acceptance Criteria
- [ ] 5+ Day-14 testimonials placed throughout landing page near relevant features
- [ ] 1 mini case study published as a dedicated section
- [ ] 60-90 second demo video embedded above the fold (hero or near hero)
- [ ] Video has captions/subtitles (most B2B viewers watch muted)
- [ ] "Trusted by [X] real estate agents across India" updated to actual number
- [ ] All testimonial photos optimized (WebP, <100KB each)
- [ ] Hero updated to reference proof: "Used by 10+ agents in Mumbai, Bangalore, Pune"
- [ ] Mobile responsiveness verified
- [ ] Lighthouse score maintained 85+
- [ ] Landing page A/B test set up (optional but recommended): A=original Day 6, B=Day 15 with proof
- [ ] Day-14 testimonial providers thanked + given direct link to live page

## Implementation Steps

### Step 1: Produce the 60-90 second demo video
If you don't have one yet, this is Day 15's main task.

**Format:**
- Hook (5 sec): "Here's how RealtyFlow saves 4 hours/day for Indian real estate agents"
- Problem (10 sec): "Excel + WhatsApp + 50 phone calls = lost leads"
- Solution walkthrough (40-60 sec):
  - Add a buyer (10 sec)
  - AI calls them in Hindi (15 sec)
  - WhatsApp follow-up auto-fires (10 sec)
  - Deal moves to "Negotiation" stage (10 sec)
- CTA (5 sec): "Start free trial — link in description / on site"

**Production options:**
- **Loom screen recording** (free, fast) — most pragmatic for Day 15
- **Higgsfield + Veo / Kling for AI generation** (per CLAUDE.md MCPs) — higher polish, 4-6 hours
- **Remotion programmatic video** (per `my-video/` project) — most flexible if you can ship today

**Captions:** Add subtitles (Loom auto-generates; or use Descript). Include Hinglish translation if main is English.

**Hosting:** YouTube unlisted OR Wistia OR Loom embed. Avoid Vimeo paywalls.

### Step 2: Embed video on landing
Placement options:
- **Hero (preferred):** Replace hero static image with autoplay-muted video, looping, 90s max
- **Below hero:** "Watch 90-sec demo" CTA button → modal opens video

Modal approach is safer (faster initial load). Use Vidyard / Loom embed code.

### Step 3: Place testimonials throughout the page
Don't dump all 5 in one section. Distribute them near the feature they validate:

**Hero section (1 testimonial):**
Below the CTA, single quote in italics:
> "RealtyFlow's AI calling is the only reason I haven't missed a single weekend lead in 2 weeks." — Rohit Sharma, Skyline Properties, Mumbai
> [Photo]

**Below AI Calling feature section (1 testimonial):**
Rohit's quote (matches the feature)

**Below WhatsApp feature (1 testimonial):**
Priya's quote (mentions WhatsApp)

**Below Pricing section (1 testimonial):**
Vikram's Hinglish quote (mentions Sell.do / Zoho price comparison)

**Dedicated "What our beta testers say" section (2-3 grid layout):**
Anita + Meera + any extras

**Mini case study (full section):**
Use the Skyline Properties mini case study from Day 14. Full-width section with photo, before/after metrics, full quote.

### Step 4: Update headline + sub-headline
Add a numerical proof line below the H1:

> **The CRM that calls your leads while you sleep**
> Trusted by 10+ real estate agencies in Mumbai, Bangalore, Pune & Delhi NCR
> [CTA]

Honest number. Don't say "1000+ customers" — beta testers laugh and bounce. "10+ in 2 weeks of beta" is a humble flex.

### Step 5: Update trust signals
- Industry logos: only if accurate (RERA-compliant badge, ISO if real, etc.)
- "As featured in" — if you got any press by Day 15
- Trust badges: SSL, GDPR/DPDP compliant, AWS-hosted

### Step 6: Mobile audit
Open landing on your phone. Verify:
- Testimonial photos load fast
- Video plays on mobile (Safari + Chrome)
- Text doesn't break / overflow
- CTA buttons remain prominent
- Mini case study readable without horizontal scroll

### Step 7: Image optimization
Each photo on landing should be:
- Format: WebP (with JPG fallback)
- Size: <100KB
- Dimensions: actual display size (not 2000px wide for a 200px thumbnail)
- `loading="lazy"` for below-the-fold images

Use Squoosh or TinyPNG for compression.

### Step 8: Performance re-check
Run Lighthouse mobile:
- Target: 85+ (down from 90+ Day 6 — video adds weight)
- If <80, lazy-load testimonial photos, defer video load until intersection

### Step 9: A/B test setup (optional but recommended)
If you have time:
- Tool: Google Optimize (sunsetting) / VWO / Optimizely / or simple cookie-based split
- Variant A: Day 6 page (no social proof)
- Variant B: Day 15 page (full social proof)
- Split 50/50 traffic, measure signup conversion over 7 days

You'll likely see B win 1.5-3x. Decide whether to call it on Day 22 (data review).

### Step 10: Thank the testimonial providers
After deploy, send each tester:
> "Hey Rohit — landing page is live with your testimonial! https://realtyflow.in
> Honestly means a lot. If you're cool with it, feel free to share — would help us reach more agents like you. Owe you a coffee next time I'm in Mumbai."

This:
- Closes the loop (they see their name live)
- Invites organic sharing
- Builds the personal relationship for Day 27 paid conversion

## Tools / Stack Required
- Loom for video (free)
- OR Higgsfield MCP for AI video (per CLAUDE.md)
- OR Remotion (per `my-video/`)
- Descript for captions (free tier)
- Squoosh / TinyPNG for image compression
- Your existing landing page stack
- Google Optimize / VWO / custom A/B if testing

## Time Estimate
- Demo video production: 3-5 hours (most time)
- Testimonial placement: 2 hours
- Mini case study section: 1-2 hours
- Image optimization: 1 hour
- Mobile + performance audit: 1 hour
- Thanks to testers: 30 min
- **Total: 1-2 days (often spills to Day 16 morning)**

## Deliverables
- Landing page updated and deployed
- 60-90 sec demo video live (with captions)
- 5+ testimonials placed strategically
- 1 mini case study section live
- Mobile audit passing
- Testimonial provider thanks sent
- A/B test running (if applicable)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Video production takes longer than expected | Use Loom for v1 — fast & good enough. Polish in Month 2. |
| Video too long (>90 sec) | Cut ruthlessly. 60 sec > 90 sec for cold conversion. |
| Mobile video doesn't autoplay | Use poster image + click-to-play. iOS Safari doesn't autoplay by default. |
| Testimonial layout breaks | Test on phone + tablet + desktop. Use CSS grid with `min(100%, 800px)` to constrain. |
| Performance regression | Lazy-load testimonial photos, defer video until intersection |
| Inflated "trusted by" number | Always use real number. Honesty converts; lies erode trust on contact. |

## India-Specific Notes
- Demo video in English with Hinglish moments works for B2B India audience
- AI calling demo IN HINDI is a wedge demonstration — make it the highlight
- Indian agents recognize Mumbai/Bangalore/Pune locality names — list them explicitly in trust line
- ₹ amounts in case study (not USD) — Indian numbering (₹85L)
- Mobile-first is critical — 50%+ of Indian B2B traffic is mobile

## Connected Days / Dependencies
- **Blocks:** Day 16 (directory launches with landing page link), Days 17-19 (cold outreach drives to landing page)
- **Depends on:** Day 14 (testimonials), Day 6 (landing page base)

## Success Metric
- Page loads in <3s on mobile 4G with video
- 5+ testimonials visible on page with photos
- Demo video has at least 1 view before Day 16 (your own test view)
- Testimonial providers see their name + are happy
- Mobile audit + Lighthouse pass
