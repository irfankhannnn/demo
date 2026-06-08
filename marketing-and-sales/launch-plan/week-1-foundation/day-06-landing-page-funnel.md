# Day 6 — Landing Page Funnel + Welcome Email Sequence

## Objective
Ensure the public-facing landing page converts cold visitors into trial signups, every CTA button works, the pricing page is live, the wedge is the H1, and a 5-email welcome sequence fires automatically for every new signup.

## Why This Matters for RealtyFlow
The landing page is the conversion funnel. If a Mumbai agent clicks your LinkedIn outreach link and lands on a confusing or slow page, you've lost them. The page must answer in 5 seconds: (1) what is this, (2) is it for me, (3) what does it cost, (4) why should I trust it, (5) what do I do next. The welcome email sequence then converts trial signups into engaged users.

## User Story
As a founder, I want a landing page that clearly communicates RealtyFlow's wedge, has working CTAs that route to signup, displays pricing transparently, builds trust through (placeholder) testimonials and proof points, and triggers a 5-email welcome sequence on signup, so that Week 3 cold outreach traffic converts at 5%+ to trials.

## Acceptance Criteria
- [ ] Landing page wedge (from `pre-launch-prep/04`) is the H1
- [ ] One primary CTA above the fold: "Start Free Trial" or "Try Demo"
- [ ] One secondary CTA: "Book a Demo Call" → Calendly link
- [ ] Hero section answers "what / for whom / why" in 5 seconds
- [ ] At least 4 feature sections with screenshots/GIFs
- [ ] Pricing page live with 3 tiers + monthly/annual toggle
- [ ] FAQ section addressing top 5 objections
- [ ] Footer with legal links (ToS, Privacy, Refund, Cookies — from `pre-launch-prep/01`)
- [ ] Page loads in <3s on 4G (test with Chrome DevTools throttling)
- [ ] Mobile-responsive (test on actual phone)
- [ ] All forms submit successfully (signup, contact, demo request)
- [ ] Analytics events firing on landing (per Day 4)
- [ ] 5-email welcome sequence configured and tested
- [ ] Cookie banner showing on first visit (per `pre-launch-prep/01`)

## Implementation Steps

### Step 1: Audit current landing page
Visit your existing landing page. Compare against this checklist:
- [ ] Wedge as H1? Or generic "Welcome to RealtyFlow"?
- [ ] Primary CTA visible without scrolling?
- [ ] Pricing visible / linked?
- [ ] At least 3 specific feature explanations (not vague)?
- [ ] Trust signals (logos, numbers, testimonials)? — okay if placeholders for now
- [ ] FAQ section?
- [ ] Footer complete?

List gaps.

### Step 2: Hero section — most important
Layout:
```
[Logo top-left, nav top-right]

H1: [Wedge from pre-launch-prep/04]
H2: [Sub-headline — one sentence, who-it's-for]

[Primary CTA button] [Secondary CTA button]

[Hero image / video — 60-sec demo embed or screenshot]
```

Example for RealtyFlow:
- **H1:** "The CRM that calls your leads while you sleep."
- **H2:** "Built for Indian real estate agents. AI calling, WhatsApp follow-up, and owner-buyer matching — out of the box."
- **CTAs:** "Start Free Trial — no credit card" / "Watch 90-sec Demo"

### Step 3: Feature sections (4-6)
Each feature gets a section with:
- Bold headline (benefit, not feature name)
- 2-3 sentence description
- Screenshot or short GIF showing it in action

Suggested sections:
1. **"AI calling in Hindi, English, Marathi"** — screenshot of call transcript
2. **"Never drop a WhatsApp follow-up"** — screenshot of automated WhatsApp thread
3. **"Owner-buyer matchmaking in seconds"** — screenshot of matched pairs
4. **"Pipeline that fits Indian real estate"** — screenshot of pipeline view with Indian projects
5. **"Reports your CA will actually love"** — screenshot of GST-ready reports
6. **"Mobile-first — sell on the go"** — phone mockup

### Step 4: Social proof section
For Week 1, you don't have testimonials yet (you'll collect Day 14). Use placeholders for now:
- "Trusted by [X+] real estate agents across India" — keep number honest, or remove until Week 3
- Industry logos: NAR India, IRESC, RERA (use carefully — only if you legitimately operate under these)
- Replace placeholders with real testimonials Day 15

### Step 5: Pricing page
3-tier card layout from `pre-launch-prep/02`. Each card:
- Tier name
- Price (large, ₹ with "+18% GST")
- Monthly/Annual toggle
- 5-8 feature bullets
- CTA: "Start Free Trial" (all tiers)
- Tier 2 marked "Most Popular"

Below tiers: FAQ — "Can I cancel?", "Is GST extra?", "Do you offer custom plans?"

### Step 6: FAQ section (homepage + pricing)
Top 5 objections (write conversationally):
1. "Why not just use Excel + WhatsApp?"
2. "How is this different from Sell.do / Zoho?"
3. "Will my data be safe? Where is it stored?"
4. "Do I need to install anything? Train my team?"
5. "What if I cancel — can I export my data?"

### Step 7: Footer
Required links:
- Terms of Service
- Privacy Policy
- Refund Policy
- Cookie Policy
- Status page (status.realtyflow.in)
- Help center
- Contact (support@)
- Founder's LinkedIn (trust signal)
- Company address + GSTIN

### Step 8: Performance optimization
- Compress images (use WebP, lazy-load below-the-fold)
- Inline critical CSS
- Defer analytics JS until after first paint
- Use a CDN (Cloudflare free tier)

Target: Lighthouse score 90+ on mobile.

### Step 9: 5-email welcome sequence
Configure in your transactional email tool (Brevo, Mailgun, Resend, SendGrid):

**Email 1 (Day 0 — immediately after signup):**
- Subject: "Welcome to RealtyFlow — let's add your first buyer"
- Body: Quick welcome, 3-step "get started" link, founder photo
- CTA: "Add Your First Buyer"

**Email 2 (Day 1 — 24h later):**
- Subject: "Did you add a buyer yesterday?"
- Body: Check-in. If they did → next step. If not → 90-sec video showing how.
- CTA: "Add a Buyer" or "Watch How"

**Email 3 (Day 3):**
- Subject: "How [Beta Tester Name] closed a ₹85L deal using RealtyFlow"
- Body: Case study / proof point (use beta testimonial from Day 14, or interim story)
- CTA: "Try the AI calling feature"

**Email 4 (Day 5):**
- Subject: "Need a hand? Want a 15-min walkthrough?"
- Body: Offer demo call (Calendly link), founder signs personally
- CTA: "Book 15 min with the founder"

**Email 5 (Day 7):**
- Subject: "Your trial: halfway done. Here's what most agents do next."
- Body: Recap value, list 2-3 features to try, soft pricing reminder
- CTA: "See Pricing" or "Continue Building Your Pipeline"

### Step 10: End-to-end test
- Visit landing in incognito → click signup → complete → check welcome email arrives
- Verify email body renders correctly on mobile + Gmail web + Outlook
- Verify links work
- Verify unsubscribe link works (legal requirement)
- Verify Day 1 follow-up fires 24h later (check next day)

## Tools / Stack Required
- Your existing landing page stack (React + Vite per CLAUDE.md, or whatever's deployed)
- Transactional email tool: Brevo / Mailgun / Resend / SendGrid
- Image optimization: Squoosh, TinyPNG
- Performance testing: Chrome Lighthouse, PageSpeed Insights
- Mobile testing: BrowserStack OR your phone

## Time Estimate
- Landing page polish: 4-6 hours
- Pricing page: 2-3 hours
- FAQ section: 1-2 hours
- Welcome email sequence: 3-4 hours
- Performance optimization: 1-2 hours
- Testing: 2 hours
- **Total: full day (might spill to Day 7 morning)**

## Deliverables
- Polished landing page live at realtyflow.in
- Pricing page live at realtyflow.in/pricing
- 5-email welcome sequence configured and tested
- Lighthouse mobile score 90+
- All CTAs routing correctly
- Footer with all legal/support links

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Landing page wedge feels weak | Workshop with 3 agents from positioning validation (`pre-launch-prep/04`) |
| Welcome emails land in spam | Set up SPF/DKIM/DMARC for transactional domain (per `pre-launch-prep/03`) |
| Page loads slow on tier-2/3 city 3G | Compress images aggressively, lazy-load, use CDN |
| FAQ feels defensive | Frame answers positively: "Yes, you can — and here's how..." |
| Mobile-responsive breaks | Test on real phone (not just browser DevTools) |

## India-Specific Notes
- Show pricing in ₹ with "+18% GST" — Indian B2B expects this
- Include Indian phone format support in any "contact us" form
- Add Hinglish phrasing in headlines where it fits ("Lead chhutne se pehle pakdo" — "Catch leads before they slip")
- Industry trust signals: RERA-compliance badge, ISO logo if applicable, Make in India context
- WhatsApp Business contact button in footer (very Indian B2B)

## Connected Days / Dependencies
- **Blocks:** Day 7 (final audit needs landing page complete), Days 17-19 (cold outreach drives to landing page), Day 22 (drop-off analysis)
- **Depends on:** `pre-launch-prep/02` (pricing), `pre-launch-prep/01` (legal), `pre-launch-prep/04` (positioning), Day 4 (analytics events on landing)

## Success Metric
- A non-technical friend says "I get what this does" within 10 seconds of seeing the page
- Welcome email 1 arrives within 30 seconds of signup, mobile-readable
- Lighthouse mobile score 90+
- Day 7 audit: full path from landing → first action in app takes <5 minutes for new user
