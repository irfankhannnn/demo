# Growth Platform — How to Use It & What to Build Next

**For:** Product owners, content ops, agency, engineering leaders.
**Time to read:** 8 min.
**What you'll know:** The full Growth Platform in 4 layers, what to build in what order, who owns what, and the success metrics.

---

## The 4-Layer Growth System (Your Job)

```
Layer 1: CONTENT OS (ready)              You are here: Layer 3 & 4
├─ 25 frameworks (FW-*)                   ╭─ Layer 3: GROWTH PLATFORM
├─ 9 characters (CH-*)                    │  ├─ Measure (attribution, scoring, analytics)
├─ 1,000 hooks (HK-*)                     │  ├─ Acquire (referrals, campaigns)
├─ 500 CTAs (CTA-*)                       │  ├─ Operate (automations, AI agents, onboarding)
├─ 520 content opportunities (OPP-*)      │  └─ Engineer (implementation roadmap)
└─ Hinglish brand + production SOPs       │
                                          ╰─ Layer 4: REAL CODE (Express, Lambda, DynamoDB)
```

**What this means:**
- Layer 1 *generates content at scale* (via the Content Factory).
- **Layer 3 (this layer, your current build) *defines the measurement, automation, and roadmap* to turn that content into revenue.**
- Layer 4 is the *code sprint* that ships Layer 3 to production.

**Your job right now = Layer 3:** Spec out the measurement (who measures what), automation (what triggers what), and the engineering roadmap.

---

## The 12 Subsystems (Your Workstreams)

### Block 1: MEASUREMENT (You measure impact.)

#### Subsystem 1: Attribution
**What:** Track how a piece of content (`OPP-*`) actually created a customer.
**Reality:** You post a reel. Person watches → DMs → demos → pays. Attribution answers: "Did THIS reel cause this?"
**Files to read:** `attribution/attribution-architecture.md` (8-channel chain), `attribution/content-attribution.md` (content-to-customer ROI).
**Who owns it:** Analytics lead. **When:** Parallel to Layer 4 Sprint 1 (EP-1/EP-2 setup; attribution table hits on MKT_EVENT).
**Success:** Can report "OPP-014 drove 12 demos, 3 paid. CAC ₹8,000." by month 3.

#### Subsystem 2: Lead Scoring
**What:** Rank inbound leads by likelihood-to-close (0–100).
**Reality:** You have 200 leads. Which 20 will close in 30 days? Score says.
**Files to read:** `lead-scoring/lead-scoring-engine.md`.
**Formula:** FIT(30%) + SOURCE(20%) + INTENT(30%) + ENGAGEMENT(20%) = 0–100. Bands: Hot≥70, Warm 40–69, Cool 20–39, Cold<20.
**Who owns it:** Sales. **When:** Month 2 (after EP-2 events live).
**Success:** Top 50 leads close at 40% rate; bottom 50 at 10%. Clear tier.

#### Subsystem 3: Customer Health (4 Scores)
**What:** Know which customers will churn, expand, or refer.
**Reality:** You have 80 customers. Which 10 are at-risk *next week*? Which 5 are ready to expand?
**Files to read:** `customer-scoring/customer-health-system.md`.
**Four scores:** HEALTH (login, features, sentiment), RISK (inactivity, low-adopt), EXPANSION (high-adopt, feature-hungry), REFERRAL (NPS, tenure, win).
**Who owns it:** CS. **When:** Month 3.
**Success:** Recover 1 churn risk/week; upsell 1 expansion candidate/week.

#### Subsystem 4: Analytics & Dashboards
**What:** 6 role-specific dashboards pulling from a single metric dictionary.
**Reality:** Owner sees revenue/health. Sales sees pipeline/score. CS sees activation/churn.
**Files to read:** `analytics/metric-dictionary.md` (canonical), then the 6 dashboard files (executive, marketing, sales, customer-success, product, growth).
**Who owns it:** Analytics. **When:** Month 2–3 (runs on EP-1/EP-2/EP-3/EP-4 data).
**Success:** Owner can spend 10 min/day in one dashboard and know the full picture.

---

### Block 2: ACQUISITION (You add customers.)

#### Subsystem 5: Referral Engine
**What:** Productized referral system — track codes, rewards, and the referral's full journey.
**Reality:** Happy customer tells a friend. Friend signs up. You reward both. Automate it.
**Files to read:** `referrals/referral-engine.md`, `referrals/data-model.md`, `referrals/workflows.md`.
**Who owns it:** Growth/Demand-gen. **When:** Month 2–3 (automations, not engineering-heavy).
**Success:** 10% of new customers are referred by existing ones by month 4.

#### Subsystem 6: Campaign System
**What:** Unified paid (Meta Lead Ads + CAPI) + organic (content-as-campaigns) tracking.
**Reality:** You run a ₹50k/month Meta campaign. You also publish an OPP-* reel. Both have a ROAS. You report them in one place.
**Files to read:** `campaigns/campaign-system.md`.
**Who owns it:** Demand-gen/Performance. **When:** Month 2 (setup) + Month 3 (optimization).
**Success:** Can report "Organic CAC ₹4k, Paid CAC ₹8k, Overall CAC ₹6k" monthly.

#### Subsystem 7: Activation (Product-Led)
**What:** Guide a trial customer from signup to first "aha" moment (their first AI call / lead imported / team invite).
**Reality:** A broker tries the app. We need them to hit the activation checklist in 7 days.
**Files to read:** `activation/activation-framework.md`, `activation/milestones-and-score.md`, `onboarding/onboarding-system.md`.
**Who owns it:** Product + CS. **When:** Month 1 (product checklist design) + Month 2 (automations/email drip).
**Success:** 60%+ of trial customers hit 5-milestone checklist by day 7.

---

### Block 3: OPERATIONS (Systems run themselves.)

#### Subsystem 8: Automation Engine & 12 Workflows
**What:** Event-driven rules: when a thing happens (content published, comment received, lead captured), run an action (send email, enroll in drip, trigger AI call).
**Reality:** A lead comes in. Automatically: assign to next-available agent, send welcome email, schedule first AI call for 2h later.
**Files to read:** `automations/automation-architecture.md`, `automations/workflow-catalog.md`.
**Who owns it:** DevOps + backend. **When:** Month 1–2 (RULE entity, SQS).
**Success:** 95%+ of leads auto-assigned within 5 min. No manual ops.

#### Subsystem 9: AI Agents (6 Operating Agents)
**What:** 6 autonomous agents (Marketing, Content, Distribution, Sales, CS, Analytics) that coordinate via the event backbone to run the engine.
**Reality:** Marketing agent sees "activation dipped"; triggers a cadence of awareness reels. Content agent auto-generates them. Distribution agent schedules.
**Files to read:** `ai-agents/ai-agent-architecture.md`.
**Who owns it:** Engineering + product leadership. **When:** Month 3–6 (complex, guards needed).
**Success:** 60%+ of tasks execute without human trigger; human = reviewer only.

#### Subsystem 10: Onboarding & Retention
**What:** Product-led onboarding checklist + lifecycle retention (engagement loops, dormancy alerts, expansion nudges).
**Reality:** Trial user sees a visual "5-step checklist" in the app. CS watches for dormancy and re-engages.
**Files to read:** `onboarding/onboarding-system.md`, `retention/retention-system.md`.
**Who owns it:** Product + CS. **When:** Month 1–2.
**Success:** 70%+ trial activation by day 7; churn detected ≥1 week before it happens.

---

### Block 4: ENGINEERING (You build the code.)

#### Subsystem 11: Technical Implementation
**What:** The 14 epics, 100+ user stories, and sprint-sequenced backlog needed to ship the Growth Platform.
**Files to read:** `implementation/epics/epics.md` (EP-1..14), `implementation/technical-designs/technical-designs.md` (DynamoDB schema), `implementation/architecture/architecture.md` (end-state), `implementation/coding-backlog/coding-backlog.md` (what to build first).
**Structure:** EP-1 = attribution fields (P0 gate). EP-2 = MKT_EVENT ingest. EP-3–6 = scoring + activation. EP-7+ = dashboards + automation runtime.
**Who owns it:** Engineering lead. **When:** Month 1 (EP-1/EP-2 sprint); then rolling 2-week sprints.
**Success:** EP-1/EP-2 live in production (Express: new /api/leads fields; Lambda: MKT_EVENT ingest) by week 4. Scoring dashboard live by month 2.

#### Subsystem 12: 180-Day Roadmap
**What:** Phased delivery of all layers: 30 days (P0), 60 days (P1), 90 days (P2), 180 days (full operating system live).
**Files to read:** `implementation/roadmaps/roadmap-30-60-90-180.md`.
**Who owns it:** CPO. **When:** NOW (used to coordinate all 11 subsystems).
**Success:** Roadmap executed on-time; revenue correlates with roadmap gates.

---

## The Build Order (What to do *when*)

### Month 1: Foundation (P0) — "Measure First"

**Engineering sprint(s):**
- EP-1: Add `leadSource`, `utm*`, `contentRef`, `consent` fields to Lead entity in DynamoDB.
- EP-2: Build `/api/marketing/events` ingest route + `MKT_EVENT` table + SQS queue.
- EP-3a: Begin lead-scoring service stub (no live scoring yet, just the DB shape).

**Content/Growth:** Do not scale paid media. Focus on organic foundation (Content OS + channel setup).

**Metrics ready:** lead source tracking, event funnel raw.

**Success gate:** Can answer "This lead came from WHERE?" and "HOW MANY events happened today?"

---

### Month 2: Measure & Understand (P1) — "Score & Automate"

**Engineering sprint(s):**
- EP-3: Ship lead-scoring service (live FIT/SOURCE/INTENT/ENGAGEMENT scores on every lead).
- EP-4: Ship activation milestone tracking + activationScore.
- EP-5a: Customer health scoring (stub).
- EP-7a: Basic workflow engine (RULE entity, 3–4 key workflows live: New Lead → Assign + Email, Trial → Onboarding Drip, etc.).

**Content/Growth:** Scale organic (OPP-* reels). Launch paid campaign test (₹5–10k/week).

**Analytics:** Launch sales dashboard (pipeline by score), activation dashboard (trial cohort metrics).

**Success gate:** Sales can see a lead score. Activation team can see who's on track for day-7 milestone.

---

### Month 3: Full Automation (P2) — "All 12 Workflows Live"

**Engineering sprint(s):**
- EP-5b: Full customer health (4 scores) + churn alerts.
- EP-7b: 12 workflows fully live (all workflow-catalog.md workflows + cross-gating).
- EP-11: Analytics suite (all 6 dashboards).
- EP-12: Referral engine (codes, rewards ledger).

**Content/Growth:** Scale paid to ₹20–30k/week. Launch referral program. Content cadence = 8–10/week.

**Success gate:** No manual ops: leads auto-assign, drips auto-send, scores auto-update, dashboards auto-refresh.

---

### Months 4–6: Optimization & AI Agents — "Self-Operating"

**Engineering sprints:**
- EP-9: AI agents (6 operating agents) live and coordinating.
- EP-13: Observability, cost tracking, human guards in place.
- EP-14: 180-day roadmap backlog executed (experimentation, API, advanced analytics).

**Content/Growth:** Fully scaled, >50 pieces/month, attribution closed-loop (know exact OPP-* → revenue).

**Success gate:** >60% of platform ops run without human trigger.

---

## Success Metrics (North Star + Health)

### North Star
- **₹MRR from paid customer base** (subscriptions; free tier tracks but ≠ revenue).
- **Activation rate** (% of trial users hitting 5-milestone checklist by day 7) — drive this to 70%+.
- **CAC** (all-in cost to acquire one paying customer) — target: ₹6–8k.

### Health Metrics (watch these weekly)
- **Organic CAC** vs Paid CAC — organic must trend down as brand/content compounds.
- **Churn rate** — must stay <5%/month; health scoring should predict it ≥1 week early.
- **Lead score distribution** — 30%+ Hot, 40% Warm, 20% Cool, 10% Cold = healthy pipeline.
- **Referral rate** — measure as % of new customers who came via referral code.
- **MRR growth** — aim 15–20%/month compound in months 2–6.

---

## FAQ: "How Does This Connect to Content OS?"

```
Content OS (Layer 1)
  ├─ Generates 500+ content ideas (OPP-*)
  ├─ 25 frameworks (FW-*) + 9 characters (CH-*) → scripts + Higgsfield renders
  └─ Ships ~8–10 pieces/week (month 1) → 50+/week (month 6)

Growth Platform (Layer 3 — THIS LAYER)
  ├─ Tags each piece with attribution ID (OPP-014 drives M-A-*, etc.)
  ├─ Tracks: impressions → DMs → demos → trial → activated → paid
  ├─ Learns: which FW-*, CH-*, hook-style drives most CAC
  └─ Feeds learnings back to Content OS (double down on high-ROI FW-*)

Engineering (Layer 4)
  └─ Builds the measurement, automation, and dashboards to run the loop
```

In short: **Content OS makes the reel. Growth Platform measures it. Code executes the measurement.**

---

## What Happens *After* Month 6?

- **Month 7+:** You have data. You know OPP-014 (AI calling drama reel) drives CAC ₹4k at scale; OPP-089 (myth busting) drives CAC ₹12k but lands big accounts. Rebalance the Content OS weighted toward OPP-014 type.
- **Year 2:** Full AI agent operation (AG-1 Marketing automatically spins up campaigns around high-ROI content types; AG-6 Analytics feeds the insights; humans are decision-makers + quality gates).

---

## Quick Links (by role)

**If you are the:**
- **CEO / Founder:** Read `README.md` (90s overview), then `implementation/roadmaps/roadmap-30-60-90-180.md` (your roadmap).
- **Product Head:** Read `README.md`, then `activation/`, `analytics/`, `onboarding/`. Own months 1–3 product hooks + E2E customer experience.
- **Engineering Lead:** Read `implementation/epics/epics.md`, then `implementation/technical-designs/technical-designs.md`. Start with EP-1/EP-2. Roadmap is yours.
- **Analytics / BI:** Read `analytics/metric-dictionary.md` (your source of truth), then the 6 dashboard files. Roadmap: month 1 (raw), month 2 (sales + activation), month 3 (all 6).
- **Growth / Demand-Gen:** Read `campaigns/`, `referrals/`, `attribution/`. Own the CAC curve.
- **Content / Social:** Read `README.md` (your context), link back to the Content OS for frameworks/chars/hooks. Use `master-index.md` to fetch subsystem angles for content (e.g., "write a reel about lead scoring" → pull `lead-scoring/lead-scoring-engine.md`).
- **Sales / CS:** Read `lead-scoring/`, `activation/`, `customer-scoring/`. Own trial→paid + churn prevention.
- **New hire / onboarding:** Start with `master-index.md` (navigation), then read your role's section above.

---

## Immediate Next Steps

**Engineering:** Read `implementation/epics/epics.md`. Pick EP-1 (lead attribution). Draw the schema change (which fields add to Lead?). Time-box: 2 days.

**Product:** Read `activation/activation-framework.md`. Define the 5 milestones + on-screen checklist. Prototype in Figma. Time-box: 3 days.

**Growth:** Run a small ₹2k test on Meta Lead Ads (month 1). Set up UTM tracking (campaign, source, content, medium). Log to `campaigns/` for learning.

**Content:** Hit 8–10 reels/week using frameworks from the Content OS. Tag each `OPP-*`. Queue them in Blotato. No need to wait for analytics (month 2) to start; create the volume now.

**Analytics/BI:** Prepare to receive `MKT_EVENT` stream (EP-2, week 3–4). Start building the raw funnel dashboard (reach → DM → demo → trial → activation). No customer health yet.

---

## Success Statement (Month 6)

You will ship a **fully measured, partially automated real estate CRM** where:
- Every lead's origin is known (attribution closed loop).
- Lead quality is ranked 0–100 (sales uses scores to triage).
- Customers auto-activate in 7 days (product + email do it, CS watches).
- Customer churn is predicted ≥1 week early (health scores).
- 60%+ of ops run on rules, not people.
- **₹MRR is growing 15–20%/month.**
- **CAC is known and decreasing** (organic beats paid month-on-month).

**And the Content OS feeds all of this** — it generates the awareness, attribution tracks it, engineering measures it.

---

## File Map (reference)

Go to `master-index.md` for the complete file tree and subsystem cross-links.

---

## Questions?
This doc is your contract; if something doesn't line up with the code (or your reality), it needs updating.
