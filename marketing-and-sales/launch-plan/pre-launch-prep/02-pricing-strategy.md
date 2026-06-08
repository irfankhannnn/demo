# Pre-Launch Prep — 02: Pricing Strategy

## Objective
Set RealtyFlow's launch pricing tiers in INR with confidence — benchmarked against competitors, validated against willingness-to-pay, and structured to maximize trial-to-paid conversion.

## Why This Matters for RealtyFlow
Pricing is the most leveraged decision in SaaS. Too low and you can't acquire customers profitably. Too high and trials don't convert. Indian B2B SaaS has psychological price barriers (₹999, ₹1,999, ₹4,999, ₹9,999) and a strong preference for monthly billing (Indian agents are cash-flow sensitive). Get this right BEFORE landing page goes live on Day 6.

## User Story
As a founder, I want a 3-tier pricing structure with clear value differentiation and benchmark-validated price points, so that the landing page on Day 6 can display prices that maximize trial signups while sustaining unit economics.

## Acceptance Criteria
- [ ] 3 pricing tiers defined (e.g., Starter, Professional, Team)
- [ ] Each tier has 5-8 feature bullets (not 20 — clarity matters)
- [ ] Monthly + Annual pricing for each tier (annual = 20% discount typical)
- [ ] INR prices end in 99 or 999 (psychological anchor)
- [ ] GST handling decided: tax-inclusive OR tax-exclusive (recommend exclusive for B2B clarity)
- [ ] Free trial length defined (recommend 14 days, no credit card required)
- [ ] Free tier decision made (recommend NO free tier in Month 1 — focus on paid conversion)
- [ ] At least 3 competitor prices documented (Sell.do, Zoho, LeadSquared)
- [ ] Willingness-to-pay validated via 5+ conversations with real estate agents
- [ ] Pricing page mockup or copy drafted

## Implementation Steps

### Step 1: Competitor benchmark
Build a sheet with these columns: Competitor, Lowest Tier, Mid Tier, Highest Tier, Per-User Pricing (Y/N), Annual Discount, Free Trial.

Research these Indian real estate CRMs:
1. **Sell.do** — typical price ₹1,500-3,000/user/month
2. **Zoho CRM** — ₹1,300-4,200/user/month
3. **LeadSquared** — ₹2,500-5,000/user/month (often custom-quoted)
4. **PropertyManager.in** — ₹999-2,499/month flat
5. **NoBroker for Agents** — varies
6. **Salesforce Essentials** — ₹2,000/user/month

Method: Check public pricing pages, request demos as a prospect (use a different email), check G2/Capterra reviews where pricing is sometimes leaked.

### Step 2: Decide pricing model
Two main models:
- **Per-user pricing** (Sell.do, Zoho) — scales with team size. Best for monetization, but adds friction for solo agents.
- **Flat/tiered pricing** (PropertyManager) — predictable, easier to sell. Caps revenue per customer.

**Recommendation for RealtyFlow:** Tiered pricing with user count caps per tier. Solo agents pick Starter (1 user), small agencies pick Professional (up to 5 users), bigger picks Team (up to 15 users + add-ons).

### Step 3: Draft tier structure

**Tier 1: Starter — ₹999/month or ₹9,999/year (saves 17%)**
For solo real estate agents.
- 1 user
- Up to 500 contacts (buyers/sellers/owners)
- Up to 10 projects
- AI calling: 50 mins/month
- WhatsApp integration: 100 messages/month
- Basic reports
- Email support (24-hour SLA)

**Tier 2: Professional — ₹2,499/month or ₹24,999/year (saves 17%)**
For small agencies (2-5 agents).
- 5 users
- Up to 5,000 contacts
- Unlimited projects
- AI calling: 300 mins/month
- WhatsApp integration: 1,000 messages/month
- Advanced reports + analytics
- Lead scoring + automation
- Email + chat support (4-hour SLA)

**Tier 3: Team — ₹6,499/month or ₹64,999/year (saves 17%)**
For established agencies (6-15 agents).
- 15 users
- Up to 25,000 contacts
- AI calling: 1,500 mins/month
- WhatsApp integration: 5,000 messages/month
- Custom workflows
- API access
- Dedicated account manager
- Phone + WhatsApp support (1-hour SLA)

**Above 15 users → Enterprise (custom quote)**

Prices are starting points — validate in Step 4.

### Step 4: Willingness-to-pay validation
Talk to 5+ real estate agents in your network. Script:
> "I'm building a CRM specifically for Indian real estate agents — pipeline, AI calling, WhatsApp follow-ups, owner/buyer matching. Looking at three tiers: ₹999 solo, ₹2,499 small team, ₹6,499 bigger agency. Where on that range would you fit? What would make you say yes immediately vs. think twice?"

Record their responses verbatim. Look for:
- Sticker-shock signals ("that's expensive for me")
- Permission to charge more ("we already pay ₹3k for Sell.do")
- Feature must-haves they'd pay extra for

Adjust your tier accordingly — but **do not undercut blindly**. Indian SaaS founders chronically underprice.

### Step 5: GST handling decision
Two ways to display:
- **Tax-exclusive** ("₹999 + 18% GST"): Clearer for B2B. Customer sees clean number, GST added at checkout.
- **Tax-inclusive** ("₹999 incl. GST"): Cleaner for consumer-style framing. Slightly under-collects from price-sensitive buyers.

**Recommendation:** Tax-exclusive. Most Indian B2B SaaS uses this. Wire it in Razorpay (covered in `07-gst-invoicing-setup.md`).

### Step 6: Free trial vs free tier vs freemium
Three options:
1. **14-day free trial, no card required** — recommended. Lowest friction, forces conversion conversation Day 14.
2. **30-day free trial, card required** — better unit economics but big drop-off at signup.
3. **Free forever tier** — high acquisition but tail of free riders who never convert. Avoid Month 1.

**Recommendation:** 14-day free trial, no credit card. Convert via Day 13 outreach (covered in Day 26 of plan).

### Step 7: Annual billing incentive
Annual prepay = 17-20% discount + lock in. Reduces churn. Better cash flow for you.

Wire annual toggle on pricing page (default: Monthly).

### Step 8: Mockup the pricing page
Draft copy in a doc OR a basic HTML mockup. Include:
- 3 tier cards side-by-side
- Monthly/Annual toggle at top
- "Most Popular" badge on Tier 2
- FAQ section: "Can I cancel anytime?", "Do you offer custom enterprise plans?", "Is GST extra?"
- Trust badges (testimonials Week 2)
- Big "Start Free Trial" CTA on each tier

## Tools / Stack Required
- Spreadsheet for competitor research
- Notion or Google Doc for tier draft
- Razorpay Subscriptions (configured Day 3)
- Pricing page builder (your existing landing page stack)

## Time Estimate
- Competitor research: 3-4 hours
- WTP conversations: 5-6 hours over 2-3 days
- Tier draft + page mockup: 4 hours
- **Total: 1-2 working days spread across a week**

## Deliverables
- `marketing-and-sales/launch-plan/pre-launch-prep/assets/pricing-benchmark.csv` — competitor data
- `marketing-and-sales/launch-plan/pre-launch-prep/assets/pricing-tiers-v1.md` — finalized tiers
- Pricing page draft on landing page (live by Day 6)

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| You underprice out of insecurity | Anchor against competitors; if 3+ agents say "fair" or "cheap", you're underpriced |
| Tier 1 cannibalizes Tier 2 | Limit Tier 1 to 1 user, 500 contacts — clear ceiling |
| Trial users don't convert | Plan Day 26 follow-up with limited-time discount as conversion lever |
| Customers want a custom plan you can't fulfill | Tier 3 is your top published. Enterprise = "talk to founder" form |

## India-Specific Notes
- ₹999 is the psychological floor for "real" SaaS in India. Below this, perceived as unserious.
- Annual prepay is HARDER to sell in India than in US (cash flow concerns). Still offer it; expect 20-30% of paid users to take it.
- GST must be shown clearly. "+18% GST" is the standard phrasing.
- Avoid mid-month price hikes for existing customers in Month 1. Grandfather them for 12 months.
- UPI auto-pay limit is ₹15,000/month/transaction — Tier 3 monthly fits, Tier 3 annual does not. Razorpay handles this but be aware.

## Connected Days / Dependencies
- **Blocks:** Day 6 (landing page funnel), Day 9 (beta invitations need pricing for "after trial" conversation)
- **Depends on:** Company GSTIN obtained (legal foundation file)

## Success Metric
- 3+ real estate agents independently say "that's fair pricing" during WTP conversations
- Pricing page live on Day 6 with no edit requests in Week 2 from beta testers
- Tier 2 (Professional) emerges as most chosen during trial — confirms middle-tier psychology working
