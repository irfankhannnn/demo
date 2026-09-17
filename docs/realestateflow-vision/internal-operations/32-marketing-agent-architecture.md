# 32 — Marketing Agent Architecture

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. A tenant-facing marketing agent is dropped (D14), Strands was considered and not adopted, and the budgets, cities and channels below (₹5L/month paid ads, Bangalore and Delhi NCR, TikTok, Blotato scheduling) contradict the M1 decisions — Mumbai only, no paid ads in M1, manual upload. Current source: `marketing-and-sales/launch-plan-v2/content-os/growth-platform/ai-agents/ai-agent-architecture.md` (the AG-1 Marketing / AG-2 Content / AG-3 Distribution operating agents) and `marketing-and-sales/launch-plan-v2/00-DECISIONS-LOG.md`.

> **Tier:** T2 (Strands Framework Agent) · **Phase:** 4 · **Role:** Autonomous AI marketing lead (brief → campaign → publish → measure)

---

## Overview

The **Marketing Agent** is a Strands-framework AI that owns the full campaign lifecycle end-to-end: researching ideas, writing copy, generating creative, launching ads, and measuring ROI.

**Capability:** Takes a 2-3 sentence brief (e.g., "Run a campaign targeting first-time home buyers in Bangalore, budget ₹5L/month, focus on property comparison guides") and outputs a full marketing campaign with creative, landing page, ad copy, audience setup, and launch plan — all human-approved before going live.

---

## Workflow: From Brief to ROI

```
Marketing Manager writes brief
    ↓
marketing-brief → Marketing Agent inbox
    ↓
Agent 1. RESEARCH
  ├─ Trend-hunter agent: competitor analysis (3 campaigns in market)
  ├─ Deep-researcher: ICP research (first-time buyer persona)
  └─ Oracle agent: audience sizing + CAC target
    ↓
Agent 2. STRATEGY
  ├─ Brand-strategist: messaging angle (e.g., "Confidence through data")
  ├─ Copy direction: email + social + landing page tone
  └─ Creative direction: visual style (e.g., "minimalist + Indian")
    ↓
Agent 3. CONTENT GEN (Parallel)
  ├─ Orator: voice the hook (ElevenLabs Multilingual, 3s)
  ├─ Nano-designer: create 5 banner variations (Higgsfield)
  ├─ Motion-engineer: reel (Remotion, 15s, 1–2 on-brand templates)
  ├─ Landing-page-builder: property comparison landing page (HTML)
  └─ SEO-content-writer: blog post seed (for organic funnel)
    ↓
Agent 4. CAMPAIGN SETUP (Meta-Ads MCP)
  ├─ Define audience (location, age, interests, lookalike)
  ├─ Set budget + bid strategy (target CPA ₹5k)
  ├─ Create ad sets (3 creative variations × 2 audience segments)
  ├─ Add pixels + conversion tracking (lead form)
  └─ Schedule: start date, end date, daily budget
    ↓
Agent 5. APPROVAL QUEUE
  Marketing manager reviews:
    ├─ Copy tone + brand fit
    ├─ Creative quality (legal + aesthetic)
    ├─ Audience definition (target vs. waste)
    ├─ Budget (CAC realistic?)
    └─ [Approves OR requests changes]
    ↓
Agent 6. LAUNCH & SCHEDULE
  ├─ One-click approve → campaign goes live
  ├─ Blotato queue: organic posts scheduled (same creative, adapted)
  └─ Slack notification: campaign live, link to dashboard
    ↓
Agent 7. DAILY MONITORING (Autonomous)
  ├─ Reads Analytics MCP every 6 hours
  ├─ Checks: impressions, CTR, cost per result, ROAS
  ├─ If CPA >20% above target: pauses underperforming ad sets
  ├─ If ROAS >target: increases daily budget by 10%
  └─ Slack alert: "Campaign XYZ hitting 4.2:1 ROAS; increased budget to ₹50k/day"
    ↓
Agent 8. WEEKLY REPORTING
  ├─ Pulls 7-day data from Analytics MCP
  ├─ Calculates ROAS, CPA, leads, CAC
  ├─ Compares to target + previous campaigns
  ├─ Identifies what worked (copy angle? audience? creative?)
  └─ Recommends next campaign hypothesis
    ↓
[Campaign ends OR iterates]
  ├─ Archive results (linked to Razorpay revenue for true LTV)
  └─ Learning fed into next brief (recursive improvement)
```

---

## Key Components

### 1. Agent Framework (Strands T2)
- **Memory:** Persistent thread across brief → launch → measurement
- **Planning:** Agent breaks brief into research → strategy → execution → measure tasks
- **Tools:** Calls sub-agents or MCPs for each step
- **Approval gates:** Halts before high-risk actions (publishing) until human approves

**Typical conversation length:** 15–20 turns spread over 2–4 days

### 2. Sub-Agents (Callable from Marketing Agent)

Each of the 6 creative personas is a smaller T1 or T0 agent that the Marketing Agent can invoke:

```
marketing_agent.invoke_tool("call_agent", {
  agent_id: "orator",
  task: "Generate 3-second voiceover hook for property guide campaign",
  context: { brand_voice: "friendly, confident", language: "Hinglish", tone: "aspirational" }
})
// Returns: 3 audio files + transcripts
```

### 3. MCPs (11 + 1 new)

From Phase 0–3 product, Marketing Agent reads:
- **Lead MCP** → lead volume, conversion rates (historical for CAC modeling)
- **Analytics MCP** → PostHog funnel data (organic traffic, landing page abandonment)
- **Workspace MCP** → Google Sheets (media buy playbook, previous campaign results)

New (Phase 4 only):
- **Campaign MCP** → Razorpay ad spend, affiliate payouts, conversion attribution
- **Content MCP** → brand kit, approved messaging, style guide
- **Marketing MCP** (external, wraps Higgsfield + Meta-Ads + Blotato) → campaign creation, scheduling

### 4. Approval Flow (Customizable per Tenant + Cloudberry)

For Cloudberry's internal campaigns:
```
Marketing Manager → [reviews copy, design, audience]
    ↓
1-tap approve or "change X" → sent back to agent
    ↓
Agent revises (if feedback) or launches (if approved)
```

For product tenants (Phase 4+, paid tier):
```
Marketing Agent → campaign draft
    ↓
Approval queue (settable by tenant to: manager, owner, auto)
    ↓
Launch or notify
```

---

## Campaigns Marketing Agent Owns (Cloudberry, Phase 4+)

### Sprint 1 (Week 21–24) — Product Awareness
- **Brief:** "Position RealEstateFlow as the WhatsApp lead capture solution for Indian agencies"
- **Channels:** IG, Facebook, LinkedIn, TikTok, email
- **Audience:** Real estate agents (25–55), Mumbai/Bangalore/Delhi NCR
- **KPI:** 100 free trial signups/month at <₹500 CAC

### Sprint 2 (Week 25–28) — First-Time Buyer Education
- **Brief:** "Agencies using RealEstateFlow close deals 30% faster (hypothesis)"
- **Channels:** Google Ads (high-intent), YouTube, Reddit communities
- **Audience:** Agency owners + managers searching for "lead management", "real estate CRM"
- **KPI:** 50 conversations/month; 10% → trial; 20% trial → paid

### Sprint 3 (Week 29–32) — Retention + Expansion
- **Brief:** "Agencies with Voice/Marketing add-ons see 2x revenue per lead"
- **Channels:** In-app, email (active users), WhatsApp (warm audience)
- **Audience:** Existing trial users (segmented by phase)
- **KPI:** 20% trial→paid conversion; 30% paid→add-on

---

## Approval Gate: Legal + Brand Safety

**Before publishing any ad/post:**
- ✅ Copy complies with Meta policy (no false claims, no high-risk claims without substantiation)
- ✅ Audience targeting is legal (no age/gender targeting that violates local law)
- ✅ Brand fit (tone matches brand, no off-brand creative)
- ✅ Budget is reasonable (no runaway spends; within monthly cap)

**Gate implementation:**
```
agent.call_tool("publish_campaign", {
  campaign_id: "...",
  approval_required: true,
  approval_type: "legal_and_brand"
})
    ↓
Raises approval_queue event
    ↓
Legal/brand manager reviews (async)
    ↓
If approved: agent proceeds
If rejected: agent revises based on feedback
```

---

## Closed-Loop Attribution: Lead → Revenue

**The missing link most marketing teams don't have:**

Marketing Agent closes the loop by tying ad spend → leads → conversions → revenue:

1. **Ad flow:** Agent creates campaign with Meta lead form
2. **Lead capture:** Leads arrive in Meta Lead Ads inbox
3. **CRM sync:** Webhook pulls leads into RealEstateFlow CRM
4. **Conversion tracking:** CRM notes trial signup → paid conversion
5. **Attribution:** Agent queries Campaign MCP (Razorpay + CRM) to ask:
   - "How many leads from this campaign became paying customers?"
   - "Total ad spend: ₹50k. Revenue from leads: ₹8L. True ROAS: 16:1"

**Result:** Agent learns which campaigns drive real value, not just vanity metrics (clicks, leads).

---

## Example Prompt: Marketing Agent System Prompt

```
You are the Marketing Agent for Cloudberry RealEstateFlow.

Your role:
- Receive a brief from the team (1–3 sentences)
- Break it into research → strategy → content → campaign → launch → measure phases
- Delegate research to trend-hunter, strategy to brand-strategist, creative to the 6 personas
- Consolidate outputs and present to marketing manager for approval
- Launch campaign, monitor daily, measure ROI

Constraints:
- No campaign launches without legal/brand approval
- All copy must be Hinglish (70% English, 30% Hindi romanized)
- Budget must fit within Razorpay monthly cap (ask before exceed)
- Audience size must be >10k (avoid niche markets)

Tools you can call:
- call_agent(agent_id, task, context) — invoke sub-agents
- create_campaign(campaign_spec) → returns draft for approval
- query_analytics(metric, date_range) → ROAS, CPA, leads
- schedule_post(content, platform, time) → via Blotato MCP
- get_brand_kit() → approved colors, fonts, tone, messaging

Approval flow:
1. Draft campaign → present to marketing manager
2. Manager reviews + approves or requests changes
3. If approved: launch (one-click on your end)
4. Monitor daily; optimize (pause underperforming, scale winners)
5. Weekly report + next-campaign hypothesis

Let's start. What's the brief?
```

---

## Phase 4 Success Criteria

| Metric | Target | Owner |
|---|---|---|
| Campaign time-to-launch | 2–3 days (brief → live) | Marketing Agent |
| Campaigns/month | 4 (1 per week) | Marketing Agent + manager |
| Campaign ROAS | >3:1 payback (₹3 revenue per ₹1 spend) | Media-buyer + ab-optimizer |
| Creative production cost | <₹2k per campaign (via Higgsfield + internal) | Motion-engineer |
| Manager approval time | <1 hour turnaround | Marketing manager |
| Campaign iterations | <2 revisions before launch | Quality gate |

---

## Integration with Product

**Feedback loop:**
```
Marketing Agent runs campaign → 100 trial signups
    ↓
CRM auto-syncs (webhook) → RealEstateFlow sees signups
    ↓
Trial onboarding flow (Phase 1 product)
    ↓
If trial→paid: agent attributes revenue to campaign (Analytics MCP)
    ↓
If trial expires unsigned: agent analyzes drop-off (landing page? onboarding? feature gap?)
    ↓
Feedback → next campaign hypothesis (product-led positioning vs. event-driven)
```

This creates a **virtuous cycle**: better product → better conversion → better ROAS → more budget for marketing → more visibility → faster growth.
