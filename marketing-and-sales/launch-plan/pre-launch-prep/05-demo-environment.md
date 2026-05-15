# Pre-Launch Prep — 05: Demo Environment & Sample Data

## Objective
Create a populated RealtyFlow tenant with realistic Indian real estate data so beta testers (Day 10) and prospects (Day 17+) can see the product full of value within 60 seconds — not as an empty CRM with zero context.

## Why This Matters for RealtyFlow
Empty CRMs kill SaaS conversion. A real estate agent who logs in and sees "0 leads, 0 projects, 0 calls" doesn't understand the value. The brain pattern-matches to "this is going to be a lot of work to set up" → drop-off. A populated demo environment shows them what their life looks like in 30 days, instantly. Day 10 onboarding calls become 3x more effective.

## User Story
As a founder, I want a "Demo Tenant" inside RealtyFlow seeded with 20+ Indian buyers, 10 projects in Mumbai/Bangalore/Pune, 5 active call sessions, sample WhatsApp threads, and pipeline metrics, so that beta testers and demo prospects experience a fully-realized CRM and grasp the value within their first minute on the platform.

## Acceptance Criteria
- [ ] Dedicated demo tenant created (`tenant_id = DEMO_REALTYFLOW` or similar)
- [ ] 20+ sample buyers with realistic Indian names, phones, locations, budgets
- [ ] 15+ sample sellers/owners with property details
- [ ] 10 projects across Mumbai, Bangalore, Pune, Delhi-NCR with photos
- [ ] 5 active call sessions with sample transcripts (English + Hindi mix)
- [ ] 8+ tasks in pipeline (Site Visit Scheduled, Negotiation, Closing, etc.)
- [ ] WhatsApp conversation threads (5+ chats) with realistic agent ↔ buyer back-and-forth
- [ ] Dashboard shows non-zero metrics (₹X crore in pipeline, X visits this week, etc.)
- [ ] Demo login URL works (or one-click "Try Demo" button on landing page)
- [ ] Reset script available — refreshes demo data daily to prevent corruption
- [ ] Demo tenant is read-only OR auto-resets every 24 hours (prevent tester pollution)

## Implementation Steps

### Step 1: Define the demo persona
The demo represents a believable Indian agency:
- **Agency name:** "Skyline Properties Mumbai"
- **Agent name:** "Rohit Sharma" (matches typical Mumbai broker)
- **Plan tier:** Professional (Tier 2) so all features are visible
- **Time on platform:** 6 weeks (so pipeline has history, not Day 1 freshness)

### Step 2: Seed sample data — buyers (20+)
Mix of profiles. Sample records:

| Name | Phone | City | Budget | Stage |
|------|-------|------|--------|-------|
| Priya Patel | +91 98XXXX1234 | Mumbai (Andheri W) | ₹1.5-2 Cr | Site Visit Scheduled |
| Rajesh Kumar | +91 98XXXX5678 | Bangalore (Whitefield) | ₹80L-1Cr | Negotiating |
| Anita Joshi | +91 98XXXX9012 | Pune (Kalyani Nagar) | ₹60-80L | New Lead |
| Vikram Singh | +91 98XXXX3456 | Delhi NCR (Gurgaon) | ₹2-3 Cr | Closing |
| Meera Reddy | +91 98XXXX7890 | Bangalore (Indiranagar) | ₹1-1.5 Cr | Site Visit Done |
| Arjun Mehta | +91 98XXXX2345 | Mumbai (Bandra) | ₹3-5 Cr | Cold Lead |
| ... | | | | |

Use realistic Indian names (mix religions/regions), real Mumbai/Bangalore/Pune locality names, plausible budgets, and varied pipeline stages.

**Important:** Use **fake phone numbers** (98XXXX prefix is reserved-style, but use clearly fake patterns like all 1s or sequential digits). NEVER seed real phone numbers — DPDP Act risk.

### Step 3: Seed sample data — sellers/owners (15+)
Mix of:
- Resale owners (have a flat, want to sell)
- Investors (have multiple units, casual sellers)
- Developers' direct allocation (early-bird inventory)

Include: name, property address, asking price, last-listed-date, photos URL (use Unsplash real estate stock images).

### Step 4: Seed sample data — projects (10)
Mix of:
- Under-construction Mumbai high-rises (Lodha, Godrej, Hiranandani-style names — use fictional like "Skyline Towers", "Emerald Heights")
- Bangalore Whitefield/Sarjapur villas
- Pune Kalyani Nagar apartments
- Gurgaon Sector commercial
- NCR plotted developments

Each project: name, location, builder, configurations (1-4 BHK), price range, RERA number (use fake but formatted-correctly like `MahaRERA P51800XXXXX`), launch date, possession date, brochure URL.

Use Unsplash for hero images.

### Step 5: Seed sample data — calls (5 active)
The AI calling feature is a key wedge. Demo MUST show this:
- Call ID + buyer name + duration
- Transcript snippet (English/Hindi mix) — example:

```
[Buyer]: Hello?
[AI]: Hi Priya ji, this is calling from Skyline Properties. Aap ke 2BHK ki requirement ke regarding follow up kar rahe the. Andheri West mein humare paas 2 new projects launch hue hain — kya aap site visit ke liye available hain is weekend?
[Buyer]: Haan, Saturday afternoon free hai.
[AI]: Bilkul, main 2pm ka slot block kar deta hoon. Rohit sir aapko WhatsApp pe location share karenge.
```

Include sentiment scores, next-action suggestions, recordings (use placeholder mp3).

### Step 6: Seed sample data — WhatsApp threads
5+ realistic chats showing agent + buyer/owner back-and-forth in Hinglish:
```
Agent: Priya ji, weekend ka schedule fix?
Buyer: Yes, Saturday 2pm
Agent: Perfect, sending location 📍
Agent: [Property Brochure.pdf]
```

### Step 7: Seed dashboard metrics
The demo dashboard should show:
- ₹12.5 Cr active pipeline
- 47 leads in last 30 days
- 12 site visits scheduled this week
- 3 deals closed (₹2.1 Cr GMV)
- AI call minutes used: 187/300
- WhatsApp messages sent: 654/1,000

These numbers should look healthy but not magical.

### Step 8: Build "Try Demo" experience
Two options:

**Option A — Shared demo login (simpler):**
- Public credentials: `demo@realtyflow.in / RealtyDemo123`
- Or one-click button on landing: "Try Demo (no signup)"
- Reset script runs daily at 3am IST

**Option B — Personal demo (richer):**
- Visitor clicks "Try Demo" → enters name + email → spawns clone of demo tenant for 24 hours
- More effort, higher conversion
- Captures email = remarketing list

**Recommendation for Month 1:** Option A. Build Option B in Month 2.

### Step 9: Reset script (DynamoDB)
Write a script that:
- Deletes all DEMO tenant items
- Re-seeds from `demo-data.json`
- Runs nightly via Lambda + EventBridge

Sample command:
```bash
node server/scripts/reset-demo-tenant.js --tenant DEMO_REALTYFLOW
```

### Step 10: Use demo in landing page + outreach
- Landing page hero: "Try Demo (no signup)" button next to "Start Free Trial"
- Cold outreach Day 17-19: include demo URL in P.S. line
- Demo call Day 10: start from the populated demo, not blank tenant

## Tools / Stack Required
- Your existing DynamoDB tables + multi-tenancy logic (TENANT# prefix)
- A seed data file: `server/scripts/demo-data.json`
- Unsplash for stock real estate photos
- Faker.js for additional sample data generation (npm package)
- Lambda + EventBridge for nightly reset (or cron on your server)

## Time Estimate
- Data design + seed file: 6-8 hours
- Demo tenant + reset script: 4-6 hours
- Landing page integration: 2 hours
- **Total: 1.5-2 days**

## Deliverables
- `server/scripts/demo-data.json` — seed file
- `server/scripts/reset-demo-tenant.js` — reset script
- Demo tenant accessible at `app.realtyflow.in/login` with demo creds
- Landing page "Try Demo" button live
- Daily reset cron deployed

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Real customer data leaks into demo | Use clearly fake phone numbers (98XX patterns), test name flags, separate tenant |
| Demo tenant gets vandalized | Auto-reset every 24h, read-only mode optional |
| Demo data looks too perfect (fake) | Vary stages, include some "stuck" leads, realistic time gaps between activities |
| Demo overpromises features that don't exist | Only seed data for features that ACTUALLY work — don't seed AI call data if AI calling isn't deployed |
| Privacy violation if real names accidentally used | Code-review the seed file; use Faker.js for diversity |

## India-Specific Notes
- Indian names diverse: include Patel, Sharma, Reddy, Singh, Iyer, Khan, Mehta, Joshi
- Localities matter: agents in Mumbai see "Andheri W", "Bandra", "Powai" and feel seen
- Hinglish in transcripts/WhatsApp = authentic. Pure English = looks foreign
- Show ₹ Cr / Lakh formatting (not USD millions)
- Show RERA numbers (Indian compliance signal)
- AI call transcripts in Hindi/Hinglish = wedge demonstration

## Connected Days / Dependencies
- **Blocks:** Day 10 (onboarding calls), Day 15 (landing page social proof), Day 17 (outreach demo links)
- **Depends on:** Multi-tenancy code (existing in Cloudberry), seed script infrastructure

## Success Metric
- 80%+ of Day 10 beta testers say "this looks like a real working CRM" within their first minute
- Demo URL gets 50+ clicks in Week 3 cold outreach
- At least 2 paying customers cite "I tried the demo first" as conversion factor
