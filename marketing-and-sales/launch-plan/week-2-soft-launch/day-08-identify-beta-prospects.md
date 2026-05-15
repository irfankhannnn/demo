# Day 8 — Identify 30-40 Beta Prospects

## Objective
Build a curated list of 30-40 real estate agents who fit RealtyFlow's exact ICP (solo or 2-15 person agencies in Mumbai/Bangalore/Pune/Delhi NCR), with their names, contact info, and a personalization hook for each, ready for outreach on Day 9.

## Why This Matters for RealtyFlow
The original plan called for 15 prospects → 5 testers. That's thin: not enough signal, not enough testimonials, hard to get to 5 active users. Increase to 30-40 prospects → expect 8-12 active testers. This pool produces:
- Diverse feedback (different cities, agency sizes, tech literacy)
- Multiple testimonials for Day 15 social proof
- Real conversion data (how many testers eventually pay)
- Network referrals (testers refer their network — instant pipeline)

## User Story
As a founder, I want a list of 30-40 hand-picked real estate agents who match RealtyFlow's ICP, each with name + contact + personalization hook, organized in a spreadsheet ready for Day 9 outreach, so that Week 2 onboards 8-12 active beta testers and produces 5+ Week-3 testimonials.

## Acceptance Criteria
- [ ] List of 30-40 prospects in spreadsheet form
- [ ] Each row: name, agency, city, channel (LinkedIn/WhatsApp/email), contact, hook
- [ ] Mix of agency sizes: 40% solo, 40% small team (2-5), 20% larger (6-15)
- [ ] Geographic spread: minimum 4 cities (Mumbai, Bangalore, Pune, Delhi NCR, Hyderabad)
- [ ] Mix of focus: residential resale, new project sales, rentals
- [ ] Each prospect has a personalization hook (something specific you noticed)
- [ ] No prospects from your direct network (founders / techies) — only real estate operators
- [ ] Spreadsheet saved at `marketing-and-sales/launch-plan/week-2-soft-launch/assets/beta-prospects.csv`
- [ ] Tracking columns added: sent date, opened, replied, signed up, last activity
- [ ] Backup outreach plan: 15 additional "Tier 2" prospects if Tier 1 doesn't convert

## Implementation Steps

### Step 1: Define the precise ICP filter
Reuse from `pre-launch-prep/04`:
- **Industry:** Residential real estate brokerage / consultancy
- **Role:** Solo agent OR partner/founder of small agency
- **Size:** 1-15 active agents
- **City:** Mumbai, Bangalore, Pune, Delhi NCR, Hyderabad (Tier-1 cities first)
- **Tech literacy:** Uses WhatsApp daily, some uses Excel for tracking
- **Visible pain:** Active on portals (99acres, MagicBricks), posts about deals, mentions follow-up challenges

### Step 2: Five sourcing channels

**Channel A — LinkedIn search (target: 15-20 prospects)**
1. LinkedIn → search "Real Estate Agent Mumbai" / "Property Consultant Bangalore" etc.
2. Filter: Posted recently (last 30 days), People only
3. Look at: agency size (from headline), activity level, location
4. Save profile URL + take notes on their recent posts

**Channel B — 99acres / MagicBricks / Housing.com agent directories (target: 8-10 prospects)**
1. Visit each portal's "Find Agent" section
2. Filter by city, residential focus
3. Note: agency name, agent name, phone (often listed), city focus
4. Cross-reference on LinkedIn to enrich

**Channel C — Local real estate WhatsApp / Telegram groups (target: 5-8 prospects)**
1. Join groups like "Mumbai Property Brokers", "Bangalore Real Estate Network"
2. Observe active members for 24-48 hours
3. Note: who posts inventory, who asks questions, who seems organized
4. Get contacts via group admin or direct DM

**Channel D — Your existing network (target: 3-5 prospects)**
1. Ask friends/family: "Do you know a real estate agent in [city]?"
2. Get warm intros — these convert 5x better than cold
3. WhatsApp friend → asks agent → agent says yes to a call

**Channel E — Reddit/Quora/communities (target: 2-3 prospects)**
1. r/IndianRealEstate, r/RealEstateIndia
2. Quora topics: "real estate India", "property brokers"
3. Look for active answerers — they're often agents or consultants

### Step 3: Build the spreadsheet
Columns:
| # | Name | Agency | City | Size | Focus | Channel | Contact | Personalization Hook | Tier |
|---|------|--------|------|------|-------|---------|---------|----------------------|------|
| 1 | Rohit Sharma | Skyline Properties | Mumbai | 4 agents | Residential resale (Bandra-Andheri) | LinkedIn | linkedin.com/in/rohitsharma | Posted about losing a deal due to follow-up gap last week | Tier 1 |
| 2 | ... |

Tier 1 = highest fit, strongest hook, prioritized for personal outreach
Tier 2 = good fit, less personalization, backup pool

### Step 4: Write personalization hooks
For each prospect, write ONE specific thing you noticed:
- "Saw your LinkedIn post on Mar 12 about losing leads to slow WhatsApp follow-up"
- "Noticed you handle 4 Andheri projects on 99acres — that's a lot of inventory to track"
- "Your Quora answer on lead nurturing was thoughtful — felt like we're solving the same problem you described"

If you can't write a real hook → that prospect doesn't go in Tier 1. Bump them to Tier 2 or skip.

### Step 5: Contact data quality check
For each prospect, verify:
- [ ] Name spelled correctly
- [ ] LinkedIn profile is theirs (check photo, location, role match)
- [ ] Phone number is plausible Indian format
- [ ] Email is professional (not generic gmail if you have agency email)

Bad data = wasted outreach. Spend 30 sec per row verifying.

### Step 6: Channel preference per prospect
Decide HOW you'll reach each one:
- **LinkedIn DM:** if connected or warm via 2nd-degree
- **Cold email:** if you have professional email + a clear hook
- **WhatsApp Business:** if phone visible AND you have WhatsApp Business set up
- **Warm intro:** if shared connection exists

Indian real estate agents prefer WhatsApp 4:1 over email. Lean WhatsApp where possible.

### Step 7: Set up tracking
Add columns:
- Sent date
- Channel used
- Opened (Y/N — track via email tool / LinkedIn read receipts)
- Replied (Y/N + date)
- Reply sentiment (positive / neutral / negative)
- Trial signed up (Y/N + date)
- Trial active (Y/N as of Day 13)
- Converted to paid (Y/N + date)

This becomes your beta tester CRM (irony noted).

### Step 8: Prep Day-9 outreach materials
Don't write personalized messages yet (that's Day 9), but:
- Decide outreach windows: Day 9 mornings + Day 10 evenings
- Set daily volume: 10-15 outreaches/day spread across channels
- Block calendar for Day 10 calls (the testers who say yes)
- Calendly link ready (from `pre-launch-prep/06`)

### Step 9: Backup Tier-2 list
Build 15 more "Tier 2" prospects who get the outreach if Tier-1 doesn't deliver enough testers by Day 12. Less personalization, broader fit.

### Step 10: Reality check
If you can't find 30-40 prospects who actually fit:
- Widen geographic filter (add Hyderabad, Chennai, Ahmedabad)
- Widen agency size (allow 16-25 person agencies)
- Re-examine wedge — is it too narrow?

But DON'T lower the bar on ICP fit. 20 good prospects > 40 mediocre ones.

## Tools / Stack Required
- LinkedIn (free)
- 99acres, MagicBricks, Housing.com (free portals)
- Hunter.io / Apollo.io (find emails — free tier) — optional
- Google Sheets / Notion / Airtable for prospect tracking
- WhatsApp Business (download from Play Store / App Store)
- Calendly (already from Day 6)

## Time Estimate
- LinkedIn sourcing: 3-4 hours
- Portal directory sourcing: 2 hours
- WhatsApp group monitoring: 1-2 hours (passive — set up earlier)
- Network outreach: 1-2 hours
- Spreadsheet build + verification: 2 hours
- **Total: full day**

## Deliverables
- `beta-prospects.csv` with 30-40 Tier-1 prospects
- 15 Tier-2 backup prospects
- Personalization hooks for each Tier-1
- Outreach plan for Day 9 (channel + sequence)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Can't find 30-40 prospects in target cities | Widen to 6 cities; lower agency size cap; accept some "anyone in residential" |
| Personalization hooks are weak | If you can't find a specific hook, prospect is Tier 2 — generic outreach gets lower priority |
| Prospects don't match — wrong ICP | Refine filter. Re-read `pre-launch-prep/04`. Don't fudge ICP to hit a number |
| All prospects from one city | Force minimum 4 cities. Single-city bias = single-market product. |
| Contacts get stale by Day 17 (re-outreach) | Note "last activity" so you can re-personalize if you reach out again |

## India-Specific Notes
- WhatsApp number on 99acres listings is the most reliable contact — get WhatsApp Business and use it as primary channel for Indian agents
- LinkedIn connection acceptance rate higher in India than US — ~30-40% accept rate is normal
- Use Hinglish in DMs when culturally appropriate ("Rohit sir, ek minute baat karni thi" feels more natural than formal English)
- Religious/regional festival weeks slow response (Diwali, Eid, Ganesh Chaturthi) — plan timing
- "Agency" in India often means 1-3 people working from a home office — not 20+ formal office

## Connected Days / Dependencies
- **Blocks:** Day 9 (Personalized Invitations)
- **Depends on:** `pre-launch-prep/04` (positioning), `pre-launch-prep/06` (LinkedIn ready)

## Success Metric
- 30+ prospects in spreadsheet with valid contact + personalization hook
- 15+ Tier-2 backups identified
- You feel confident: "These are real ICP fits, not random agents"
