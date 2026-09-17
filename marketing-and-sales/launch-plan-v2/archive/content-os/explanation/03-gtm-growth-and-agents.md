# 03 — GTM, Growth & Agents (Layers 2 + 3)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/README.md`.

> Once a post exists, how do you **publish it, measure it, scale it** — and how do AI agents run the whole thing?

---

## Layer 2 — GTM OS (acquire + convert)

Answers: *"How do I turn content into leads?"* It has 4 sub-systems:

```
attention-os/    → grab attention (hooks, formats, what stops the scroll)
distribution-os/ → WHERE + WHEN to post (per platform)
sales-os/        → convert the lead (demo, trial, follow-up)
automation-os/   → glue that runs it without manual work
```

### Distribution: one asset, many platforms

```
Content asset (from Layer 1)
   ├─ Instagram  → 9 AM Tue/Wed/Thu, Hinglish, link in bio
   ├─ Facebook   → longer caption + paid ads to Mumbai owners
   ├─ LinkedIn   → English-first, professional, 8 AM
   └─ YouTube    → Shorts, SEO title/desc/tags
```

Same idea, re-skinned per platform. Rules live in `distribution-os/<platform>/`.

### Paid ads (when organic isn't enough)

```
IG post = 500 free reach
   ↓  "boost it"  (Meta Ads MCP)
Campaign: Lead Gen – Chaos to Control – June
Audience: agency owners, Mumbai/Delhi/Pune, 35–55
Budget:   ₹500/day × 14 days
   ↓
1,000 impressions → 50 clicks → 5 leads
CPL ₹150  →  good? scale it. too high? pause it.
```

---

## Layer 3 — Growth Platform (measure + scale)

Answers: *"Which content actually worked?"* It's the biggest layer (attribution, scoring, retention, referrals, automations).

### The attribution chain — the whole point

```
IG post (Tue 9 AM)
  ↓ 750 see it
Click "link in bio"
  ↓ 150 click
Land on realtyflow.in/trial
  ↓ 90 enter email
LEAD in CRM
  ↓ 14 book a demo (next 7 days)
DEMO in pipeline
  ↓ 3 become paying
₹15,000/month

→ that one post = ₹15,000 ARR
```

Now you can answer the questions that matter:

- Which post makes the most leads? *(score each)*
- Cost per lead? *(ad spend ÷ leads)*
- ROI? *(revenue ÷ spend)*
- Best platform? *(IG ₹50/lead beats LinkedIn ₹120/lead)*

### Weekly optimisation loop

```
MON  pull 7-day data
     IG: 5 posts, 12 leads, CPL ₹80
     FB: 3 posts,  8 leads, CPL ₹130
WED  decide
     IG wins → +20% budget
     FB too costly → pause 2 ads
FRI  execute → 5 new IG-style posts
```

This loop is what "scale" actually means: do more of what works, kill what doesn't.

---

## How an AI agent runs all of this

When you ask: *"Generate an IG post for Rajesh Bhai about lead chaos"* —

```
1  Read master-index.md   → learn the file map + SSOT locations
2  Read workspace memory   → brand colours, Rajesh persona
3  Read frameworks/        → pick FW-09 (Chaos → Control)
4  Read characters/        → pick CH-01 (Rajesh)
5  Read hooks/             → pick HK-03 (before/after)
6  Write script + scene
7  Call Higgsfield MCP     → render the image
8  Polish caption + CTA
9  Save to marketing/assets/ + marketing/posts/
```

The agent never *invents* the brand — it **reads the SSOT** every time, so output is always on-brand.

### Which agent does what (examples)

| Job | Agent |
|---|---|
| Image/banner | `nano-designer` |
| Video/reel | `motion-engineer` |
| Caption/copy | uses `social-content` / `ad-creative` skills |
| Run the ads | `media-buyer` |
| Optimise ads | `ab-optimizer` |
| Weekly strategy | `growth-strategist` |
| Pipeline tracking | `pipeline-manager` |

`orchestrator` coordinates them when a task spans teams.

### One-command reels (Higgsfield Skills)

The full 10-step factory can be packaged as a **slash workflow** so a whole reel comes from a single brief — the agent doesn't re-derive the pipeline each time. The reference template is `marketing-and-sales/launch-plan-v2/20-content-engine/higgsfield-skills.md`.

```
/realestateflow-drama topic="lead lost in WhatsApp" city=Mumbai count=3 goal=reach
   ↓ (Skill auto-runs, premium defaults locked on)
load memory → FW-DRAMA + cast duo → script → scenes (+VP-PERF/PHYS/GRADE)
→ Higgsfield (+ premium & NEGATIVE blocks) → motion graphics + sound
→ Production-Grade Scorecard ≥ 8 → 3 finished 9:16 reels
```

Siblings: `/realestateflow-ugc`, `/realestateflow-demo`, `/realestateflow-founder` — same schema, different framework family + finish. The win: a non-expert gets agency-grade output, and quality never drifts between operators.

---

## Publishing reality check

There is **no scheduling MCP** configured. The flow stops at "asset + caption ready", then **you upload manually**:

- **Instagram + Facebook** → [Meta Business Suite](https://business.facebook.com) → Planner (free, schedules both).
- **YouTube** → YouTube Studio.
- **LinkedIn** → native scheduler.

The agent does everything *up to* the upload; you do the final 2 clicks.

---

## Putting it together — the full loop

```
CONTENT OS      make 7 posts        (Layer 1)
     ↓
GTM OS          schedule + boost     (Layer 2)
     ↓
GROWTH PLATFORM measure → leads      (Layer 3)
     ↓
            decide what worked
     ↓
back to CONTENT OS → make 7 better posts
```

That feedback loop — generate → distribute → measure → improve — is the entire system in one sentence.

→ Want more depth? **04-gtm-os-deep-dive.md** (the 4 GTM sub-systems) and **05-growth-platform-deep-dive.md** (measurement + cloning). For *what to build next*, see `../user-guide.md`; for the agent map, `../master-index.md`.
