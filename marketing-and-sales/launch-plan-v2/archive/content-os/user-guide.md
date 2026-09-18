# Content OS — User Guide (How to Use It & What to Build Next)

> **Archived (17 Sep 2026):** June 2026 design record, kept for history. Not the current plan. Current source: `marketing-and-sales/launch-plan-v2/README.md` (navigation) and `marketing-and-sales/launch-plan-v2/20-content-engine/README.md` (the weekly production run-sheet).

> **For humans** (founder, product owner, content lead, engineering lead, agency). This is the operating manual for the whole system: the 3 operating systems, how to run them end-to-end, the build order, who owns what, and the exact next steps to reach complete content-to-revenue creation.
>
> **Companion:** `master-index.md` (the AI-agent navigation map). **Time to read:** ~12 min.

---

## 1. What You Have (3 systems, one machine)

```
  CONTENT OS  ──────►  GTM OS  ──────────────►  GROWTH PLATFORM
  Make the content     Get it seen & convert    Measure it & scale it
  (reels, carousels)   (IG/WA/LinkedIn/sales)   (attribution, scores, $)
        │                     │                        │
        └──────── learnings feed back to Content OS ───┘
```

1. **Content OS** — a reusable *engine* that turns business memory into on-brand reels, carousels, stories, and scripts with zero re-briefing. 25 frameworks, 9 characters, 1,000 hooks, 500 CTAs, a visual system, a Higgsfield production guide, and a step-by-step Content Factory.
2. **GTM OS** — wraps that content to *acquire and convert*: capture attention, distribute across IG/WhatsApp/LinkedIn/YouTube/FB, run the founder engine, and move a viewer DM → demo → trial → paid → referral. Plus the GTM engineering to make the product itself power the motion.
3. **Growth Platform** — *measures and scales* everything: attribution (which reel made the sale), lead scoring, customer health, activation, referrals, campaigns, an automation runtime, 6 AI operating agents, 6 dashboards, and a full engineering backlog/roadmap.

**In one line:** Content OS makes it · GTM OS sells it · Growth Platform proves and scales it.

---

## 2. How to Use SYSTEM 1 — Content OS (create content today)

You can produce publish-ready content **right now**, before any code is built.

### The fastest path
1. Open `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`.
2. Copy the **Universal Loader** (top of the file) — it auto-loads frameworks, characters, hooks, CTAs, visual system, Higgsfield mapping, and the active business memory.
3. Pick a task block (Reel, Drama/Skit, UGC, Carousel, Story, Founder, Demo, Case Study), fill the `{{ }}` slots, and run it in Claude/Cursor/Devin.
4. The agent returns a **recipe** (`FW-* + CH-* + HK-* + CTA-* + VP-* + HF-*`) + script + scene list + Higgsfield prompts + caption + hashtags.

### The Content Factory (what happens under the hood) — `marketing-and-sales/launch-plan-v2/20-content-engine/production-pipeline.md`
```
Business Memory → Framework → Character → Hook → Script → Scene →
Higgsfield Generation → Caption → CTA → Publish (manual upload) → Log recipe
```

### Quality gate (must all pass before publishing)
- Claim ∈ business-memory §3 · one framework, one idea · hook visual ≤1s + subtitles ·
  language matches strategy for city/persona · recurring `CH-*` with consistency prompt ·
  brand `#2563EB`/Inter/9:16 · CTA spoken + caption · ₹/lakh/crore, RERA-safe · recipe logged.

### To onboard another business later
`global/01-workspace-system.md` → `cp -r workspaces/_TEMPLATE workspaces/<biz>` → fill the 5 memory files → set `ACTIVE_WORKSPACE`. The entire global engine carries over unchanged.

**Owner:** Content/Social lead. **Cadence:** 8–10 pieces/week now → 50+/week by month 6.

---

## 3. How to Use SYSTEM 2 — GTM OS (get seen & convert)

Read `GTM-OS-README.md` first. Then use the layer you need.

| You want to… | Read | Outcome |
|---|---|---|
| Stop the scroll & spark DMs | `attention-os/` (attention-model, content-to-conversation) | Viewers → conversations |
| Publish & repurpose | `distribution-os/<channel>.md` + subfolder (`instagram/`, `whatsapp/`) | Content live across channels |
| Build the founder's presence | `marketing-and-sales/launch-plan-v2/30-channels/founder-presence.md`, `founder-engine.md` | Personal-brand demand |
| Run the sale | `sales-os/` (customer-journey → qualification → demo-script → objections → closing-script) | DM → demo → paid |
| Onboard & retain | `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/onboarding-script.md`, `followup-script.md` | Paid → activated → referral |
| Automate the motion in-product | `automation-os/` (architecture, workflow-map, integrations) | Events + sequences |
| Track GTM KPIs | `growth-dashboard.md` | The scoreboard |
| Sequence execution | `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` | 30/60/90 plan |

**End-to-end conversion path (the spine):**
`reel (OPP-*)` → attention (DM) → distribution (channel) → `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/qualification.md` (band) → demo → trial → paid → `referral`.

**Owners:** Distribution = Social/Growth · Sales = Sales/CS · Founder engine = the founder.

---

## 4. How to Use SYSTEM 3 — Growth Platform (measure & scale)

This is the layer that makes the machine *self-aware and scalable*. Start at `growth-platform/gap-analysis.md` (the build-order brain), then use `growth-platform/README.md` to navigate the 12 subsystems.

**The 12 subsystems, in plain English (what / who owns / when):**

| Subsystem | What it answers | Owner | When |
|---|---|---|---|
| Attribution | "Which reel actually made this customer?" | Analytics | Month 1–3 |
| Lead scoring | "Which 20 of these 200 leads will close?" (0–100) | Sales | Month 2 |
| Customer health | "Who churns next week? Who's ready to expand?" | CS | Month 3 |
| Analytics & dashboards | "One screen, the whole picture" (6 role dashboards) | Analytics | Month 2–3 |
| Referral engine | "Turn happy customers into the cheapest CAC channel" | Growth | Month 2–3 |
| Campaign system | "Paid + organic in one ROAS view" | Demand-gen | Month 2–3 |
| Activation | "Get a trial to its aha-moment in 7 days" | Product+CS | Month 1–2 |
| Automation engine | "When X happens, do Y — automatically" (12 workflows) | Backend | Month 1–3 |
| AI agents | "6 agents run the engine; humans review" | Eng+Product | Month 3–6 |
| Onboarding & retention | "Activate fast, detect churn early" | Product+CS | Month 1–2 |
| Implementation | "The 14 epics that ship all of the above" | Engineering | Month 1→ |
| Roadmap | "30/60/90/180 sequencing" | CPO | Now |

**Canonical files you'll reference constantly:**
- Metrics → `marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md` (never define a metric anywhere else)
- DB entities → `growth-platform/implementation/technical-designs/technical-designs.md`
- Workflows → `marketing-and-sales/launch-plan-v2/60-automation/workflow-catalog.md`
- Engineering epics → `growth-platform/implementation/epics/epics.md`

---

## 5. What to Build Next (the engineering path to end-to-end)

The system is **spec-complete** but the product (`agency-app/api/`, React app) does not yet measure anything. **Confirmed gap from the code: leads have no source / UTM / attribution / score today.** That is the P0 gate — until it ships, scoring, dashboards, and automations have no data.

Two engineering tracks reference each other; build them in this order:

### P0 — Foundation (Month 1) — "Measure first"
- **EP-1:** Add `leadSource`, `utm*`, `contentRef`, `consent` fields to the Lead entity (DynamoDB, additive, `TENANT#`-safe).
- **EP-2:** Build `/api/marketing/events` ingest → `MKT_EVENT` table → SQS queue.
- Source files: `implementation/` (GTM engineering, 7 epics) + `growth-platform/implementation/` (14 epics). Read `epics.md` → `technical-design(s).md` → `database-requirements.md`/`api-requirements.md`.
- **Do NOT scale paid media yet.** Build organic volume with Content OS.
- **Gate:** you can answer "this lead came from WHERE?" and "how many events happened today?"

### P1 — Score & Automate (Month 2)
- **EP-3:** Lead-scoring service (live FIT/SOURCE/INTENT/ENGAGEMENT → 0–100).
- **EP-4:** Activation milestone tracking + activationScore.
- **EP-7a:** Basic workflow engine (RULE entity, 3–4 key workflows: New Lead→Assign+Email, Trial→Onboarding Drip).
- Ship the **sales dashboard** (pipeline by score) + **activation dashboard**.
- Begin small paid test (₹5–10k/week) now that attribution exists.
- **Gate:** sales sees a lead score; CS sees who's on track for the day-7 milestone.

### P2 — Full Automation (Month 3)
- **EP-5:** Customer health (4 scores) + churn alerts.
- **EP-7b:** All 12 workflows live (`workflow-catalog.md`) + cross-gating.
- **EP-11:** Analytics suite (all 6 dashboards).
- **EP-12:** Referral engine (codes + reward ledger).
- Scale paid to ₹20–30k/week; launch referral program; content cadence 8–10/week.
- **Gate:** no manual ops — leads auto-assign, drips auto-send, scores auto-update.

### P3 — Self-Operating (Months 4–6)
- **EP-9:** 6 AI operating agents live and coordinating via the event backbone.
- **EP-13:** Observability, cost tracking, human guardrails.
- **EP-14:** 180-day backlog (experimentation, API, advanced analytics).
- **Gate:** >60% of platform ops run without a human trigger.

Full sequencing: `growth-platform/implementation/roadmaps/roadmap-30-60-90-180.md` and `marketing-and-sales/launch-plan-v2/month-2-plus/README.md`.

---

## 6. The Complete End-to-End Loop (what "done" looks like)

```
Content OS                GTM OS                      Growth Platform
─────────                 ──────                      ───────────────
OPP-014 reel    ─────►   posted (IG+FB), DM opened   ─────►  TOUCHPOINT logged
(FW + CH + HK + CTA)      sales-os qualifies (Hot)             lead scored 0–100
                          demo → trial → paid                  activation milestones hit
                                                                health score tracked
                          referral asked (if safe)             attribution closes:
                                                                "OPP-014 → 3 paid, CAC ₹8k"
        ▲                                                              │
        └──────────  double down on high-ROI FW-*/OPP-*  ◄────────────┘
```

When this loop runs, you have a **fully measured, partially automated real estate CRM growth engine**: every lead's origin known, lead quality ranked, trials auto-activating in 7 days, churn predicted a week early, 60%+ ops on rules, MRR compounding 15–20%/month, CAC known and falling (organic beating paid).

---

## 7. Success Metrics (watch weekly)

**North star:** ₹MRR from paying customers · Activation rate (→70%+ by day 7) · CAC (target ₹6–8k).
**Health:** Organic vs Paid CAC (organic must trend down) · Churn <5%/mo (predicted ≥1 wk early) · Lead-score mix (~30% Hot / 40% Warm / 20% Cool / 10% Cold) · Referral rate · MRR growth 15–20%/mo.
All definitions live in `marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md`.

---

## 8. Who Reads What (by role)

| Role | Start here | Then |
|---|---|---|
| **Founder / CEO** | `master-index.md` §0 | `marketing-and-sales/launch-plan-v2/month-2-plus/README.md` + `growth-platform/implementation/roadmaps/roadmap-30-60-90-180.md` |
| **Content / Social** | `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md` | `frameworks/`, `characters/`, `workspaces/realestateflow/` |
| **Distribution / Growth** | `GTM-OS-README.md` | `distribution-os/`, `attention-os/`, `growth-platform/campaigns/` |
| **Sales / CS** | `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/customer-journey.md` | `marketing-and-sales/launch-plan-v2/40-sales-and-conversion/qualification.md`, `growth-platform/{lead-scoring,activation,customer-scoring}/` |
| **Engineering** | `implementation/epics.md` | `growth-platform/implementation/epics/epics.md` → `technical-designs/` → start EP-1/EP-2 |
| **Analytics / BI** | `marketing-and-sales/launch-plan-v2/50-measurement/metric-dictionary.md` | the 6 dashboard files |
| **New hire** | `master-index.md` | `user-guide.md` (this file) → your role row above |

---

## 9. Your Immediate Next Steps (this week)

- **Engineering:** read `implementation/epics.md` + `growth-platform/implementation/epics/epics.md`; spec EP-1 (Lead attribution fields). Time-box 2 days.
- **Product:** read `growth-platform/activation/activation-framework.md`; define the 5 milestones + in-app checklist. Time-box 3 days.
- **Growth:** set up UTM tracking (campaign/source/content/medium); run a ₹2k Meta Lead Ads test; log to `growth-platform/campaigns/`.
- **Content:** ship 8–10 reels this week via `marketing-and-sales/launch-plan-v2/20-content-engine/prompt-library.md`; tag each `OPP-*`; upload manually (Meta Business Suite / native apps). Don't wait for analytics.
- **Analytics:** prepare to receive the `MKT_EVENT` stream (EP-2, wk 3–4); build the raw funnel dashboard (reach → DM → demo → trial → activation).

---

## 10. Golden Rules (don't violate)

1. **Brand truth is upstream of everything** — `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` + `marketing-and-sales/realestateflow/BRAND-POSITIONING.md`. `#2563EB`, Inter, Hinglish 70/30 (+Marathi), mobile-first, ₹/lakh/crore, RERA-safe.
2. **Only claim features in `business-memory §3`.** No invented features or numbers.
3. **Never re-define a metric/entity/workflow** — reference the SSOT file (`master-index.md` §5).
4. **Measure before you optimize** — ship EP-1/EP-2 before scaling spend.
5. **Log every piece as a recipe** — that's what powers the feedback loop back into the Content OS.

---

**Questions?** This guide is your contract. If the docs and the code (or reality) diverge, update the docs. Navigate anything via `master-index.md`.
