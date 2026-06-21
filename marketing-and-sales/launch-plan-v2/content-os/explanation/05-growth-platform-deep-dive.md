# 05 — Growth Platform Deep Dive (Layer 3) + Extending the System

> The biggest layer. It turns "we posted stuff" into "we know what made money — do more of it." Then: how to extend the system and clone it for a new business.

---

## What's inside growth-platform/

```
attribution/      tie every post → lead → revenue
lead-scoring/     rank leads so sales calls the hot ones first
customer-scoring/ rank customers (upsell / churn risk)
activation/       get new users to the "aha" moment
onboarding/       first-run setup
retention/        keep them past month 1
referrals/        turn customers into a lead source
campaigns/        grouped pushes with goals
analytics/        dashboards + reports
automations/      the runtime that fires workflows
ai-agents/        the agents that operate all of the above
integrations/     CRM, ads, WhatsApp, forms connections
implementation/   build order
```

Plus three top-level reviews: `README.md`, `gap-analysis.md`, `quality-review.md` (what's built, what's missing, what's weak).

---

## 1. Attribution — the heart of Layer 3

This is the most important sub-system. Its files form a complete measurement spec:

| File | What it defines |
|---|---|
| `events.md` | Every tracked event (PageView, FormSubmit, DemoBooked, Paid…) |
| `data-model.md` | How events are stored + linked to a person |
| `content-attribution.md` | How a post (`OPP-*`) gets credit for a lead |
| `attribution-architecture.md` | The whole pipeline, wired |
| `dashboards.md` | What you actually look at |
| `implementation-plan.md` | Build order (this is your **P0**) |

### The chain, as data

```
EVENT: PageView      (source = OPP-042, the Tue 9AM IG post)
   ↓
EVENT: FormSubmit    → creates LEAD, keeps OPP-042 tag
   ↓
EVENT: DemoBooked    → LEAD becomes DEMO
   ↓
EVENT: Paid          → DEMO becomes CUSTOMER, ₹15k ARR

Attribution result: OPP-042 → 1 customer → ₹15,000
```

Because every event carries the originating `OPP-*`, you can sum revenue **per post**. That single capability is what makes "scale the winners" possible.

> **The catch:** with no scheduling MCP, the publish event isn't auto-logged. You either tag manually or pull it from the IG/Meta Graph API. This is why attribution is the **first thing to build** (`EP-1/EP-2`).

---

## 2. Scoring — who to focus on

```
lead-scoring/     → "Rajesh from a 20-agent agency clicked twice + booked demo" = HOT (call now)
customer-scoring/ → "This customer logged in once in 30 days" = CHURN RISK (intervene)
```

**Flow:**

```
Raw leads (100)
   ↓ lead-scoring-engine.md applies points (team size, intent, source)
Ranked: 12 hot / 40 warm / 48 cold
   ↓
Sales calls the 12 hot first → higher close rate, less wasted time
```

---

## 3. The lifecycle: activation → retention → referral

These run *after* someone signs up — the part most teams ignore.

```
activation/  "Did they reach the aha moment?"  (added 10 leads in week 1)
onboarding/  guided first-run setup
retention/   keep them past month 1 (the churn cliff)
referrals/   happy customer → brings 2 more (cheapest leads you'll get)
```

**Example referral loop:**

```
Customer closes a deal using RealtyFlow
   ↓ retention-engine notices the win
Prompt: "Apne 2 dost agents ko refer karo → dono ko 1 month free"
   ↓
2 new leads at ₹0 cost → back into the funnel
```

---

## 4. Automations + AI agents — the runtime

```
automations/automation-architecture.md  → how workflows fire
automations/workflow-catalog.md          → the canonical list of every workflow (WF-*)
ai-agents/ai-agent-architecture.md       → which agents run which workflows (AG-*)
```

`workflow-catalog.md` is an **SSOT** — every automation is defined once here (`WF-*`) and referenced everywhere else. Same for agents (`AG-*`).

**Example:**

```
WF-07 "Churn-risk win-back"
  trigger: customer-scoring flags risk
  run by:  AG-03 (nurture-bot)
  action:  send win-back sequence + alert human if no response in 3 days
```

---

## 5. Reading the health of the system

Three files tell you the truth about the build:

- `README.md` — what the platform is + how the pieces connect.
- `gap-analysis.md` — **what's missing** (read this before building anything new).
- `quality-review.md` — what exists but is weak/risky.

Start any new work by reading `gap-analysis.md` so you don't rebuild something that exists.

---

## Extending the system (new content, new metric, new workflow)

The golden rule: **add to the SSOT, never duplicate.**

```
Need a new persona?   → add CH-* in characters/        (don't redefine inline)
New narrative?        → add FW-* in frameworks/
New metric?           → add it to the metric dictionary in global/
New automation?       → add WF-* in automations/workflow-catalog.md
New agent?            → add AG-* in ai-agents/
```

Then reference the new ID everywhere — one definition, many uses.

---

## Cloning for a NEW business

This is why the global/workspace split exists. To launch a second product:

```
1  cp -r workspaces/_TEMPLATE  workspaces/<new-business>
2  Fill in its memory:
     01-business-memory.md   brand, colours, tone
     02-market-research.md   its ICP + competitors
     03-language-strategy.md its voice
     04-content-plan.md      its content plan
3  REUSE everything else as-is:
     global/ frameworks/ characters/ hooks/ ctas/
     visual-system/ higgsfield/ production-sop/
     attention-os/ distribution-os/ sales-os/
     automation-os/ growth-platform/
```

You rewrite only the *memory*. The entire **engine** is reused. That's the payoff of the whole architecture: build the machine once, point it at any business.

---

## The system in one loop

```
CONTENT OS   → make on-brand assets        (files 01, 02)
GTM OS       → attention/distribute/sell    (files 03, 04)
GROWTH       → measure, score, retain       (this file)
   ↓
gap-analysis + dashboards say what worked
   ↓
back to CONTENT OS → make better assets
```

→ For *what to build first*, see `../user-guide.md`. For the agent file-map, see `../master-index.md`. For the "why", start back at `01-the-big-picture.md`.
