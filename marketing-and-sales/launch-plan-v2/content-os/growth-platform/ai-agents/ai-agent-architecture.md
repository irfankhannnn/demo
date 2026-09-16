# AI Agent Architecture (Phase 10 — The AI Operating Model)

The **AI operating model** that runs the Growth Platform end-to-end: **6 operating agents** (`AG-*`) that coordinate over the `MKT_EVENT` event backbone (`../automations/automation-architecture.md`) and shared OS memory, executing the 12 workflows (`../automations/workflow-catalog.md`) and the content pipeline (`../../production-sop/10-content-factory.md`).

> **Reconciliation, not replacement.** The root `CLAUDE.md` defines **20 specialist sub-agents across 6 teams**. Those stay — they are the *hands*. The 6 agents here are the **operating layer** (the *minds*): each owns a stage of the funnel, holds memory + tools + MCPs, and delegates execution to the matching specialists. One operating agent ⇒ a cluster of CLAUDE.md specialists. No specialist is removed; each gains a clear owner.

---

## 1. The 6 operating agents (map to the funnel + the 20-agent model)

| Agent | Owns funnel stage | Wraps CLAUDE.md specialists | Drives workflows |
|---|---|---|---|
| **AG-1 Marketing Agent** | Strategy, demand, attribution, budget | trend-hunter, deep-researcher, oracle, brand-strategist, media-buyer, ab-optimizer | WF-01, WF-04 (campaigns) |
| **AG-2 Content Agent** | Create (factory: idea→asset) | nano-designer, motion-engineer, ugc-planner, orator, seo-content-writer, landing-page-builder | WF-01 |
| **AG-3 Distribution Agent** | Publish + engage + capture | (Blotato publishing) + founder engine; feeds sdr | WF-01, WF-02, WF-03 |
| **AG-4 Sales Agent** | Lead→demo→trial | sdr, nurture-bot, pipeline-manager | WF-03, WF-04, WF-05, WF-06 |
| **AG-5 Customer Success Agent** | Activate→retain→expand | nurture-bot, pipeline-manager (lifecycle side) | WF-07, WF-08, WF-09, WF-10, WF-12 |
| **AG-6 Analytics Agent** | Measure + decide (the VP) | oracle, ab-optimizer, pipeline-manager | reads all; tunes rules/scores; referrals WF-11 |

---

## AG-1 — Marketing Agent
- **Responsibilities:** demand strategy, channel mix, campaign/UTM structure, budget allocation, content briefs (which `OPP-*` to make + why), paid spend (HIL).
- **Inputs:** market signals, attribution rollups, CAC/LTV, ICP research, content-ROI by `OPP-*`.
- **Outputs:** content briefs, campaign configs (`CAMPAIGN` entity + UTM), budget recommendations, `media-buyer` tasks.
- **Memory — reads:** `workspaces/realestateflow/01-business-memory.md`, `02-market-research.md`, `../attribution/*`, `../campaigns/`, `../analytics/`; **DynamoDB:** `MKT_EVENT` (GSI-EventType), `CAMPAIGN`, `LEAD.leadSource`. **Writes:** `CAMPAIGN` items, brief docs, `marketing-and-sales/research|reports`.
- **Tools:** Read/Write/Grep/Bash; channel-cac-analysis, icp-research, paid-ads, market-prediction skills.
- **MCP:** `meta-ads` (campaign/lead-form/budget — **spend = HIL**). *Add: analytics/insights MCP (or insights puller) for organic reach.*
- **Integration:** writes briefs consumed by AG-2; campaign UTMs land on `LEAD` (WF-04); spend from `meta-ads` updates `CAMPAIGN.spend` for CAC.
- **Automation opportunities:** auto-reallocate budget to winning OPP-*/channel (HIL approve); auto-pause losers via `ab-optimizer`.
- **Guardrail:** all spend changes queued as `APPROVAL`, never auto-executed.

## AG-2 — Content Agent
- **Responsibilities:** run the Content Factory (`10-content-factory.md`) — brief → FW-* → CH-* → HK-* → script → scene → Higgsfield asset → caption → CTA-*. Quality-gate every piece.
- **Inputs:** AG-1 briefs, `OPP-*` from content plan, frameworks/characters/hooks/CTAs libraries.
- **Outputs:** finished 9:16 assets + recipe log (`REF-*`), captions, CTA assignment; ready-to-publish package for AG-3.
- **Memory — reads:** `frameworks/`, `characters/`, `visual-system/`, `higgsfield/`, `hooks/hooks.json`, `ctas/ctas.json`, `production-sop/`, business-memory §3 (claim check). **Writes:** `workspaces/realestateflow/recipe-log.md`, `marketing-and-sales/creative|assets`.
- **Tools:** Read/Write/Bash; image, video, ugc-scripts, voiceover-gen, seo-blog, landing-page, prompt-generator skills; FFmpeg/Remotion (`my-video/`).
- **MCP:** `higgsfield` (Nano Banana Pro / Veo / Kling / Sora — image+video gen).
- **Integration:** consumes AG-1 brief; hands package + `OPP-*` ref to AG-3; recipe log feeds AG-6 content-ROI.
- **Automation opportunities:** batch-by-character generation; auto-variant hooks for A/B (AG-6 picks winner).
- **Guardrail:** Quality Gate (claim ∈ business-memory §3, RERA-safe, no false numbers) before any publish handoff.

## AG-3 — Distribution Agent
- **Responsibilities:** schedule/publish (Blotato), founder-engine posting, monitor comments/DMs, fire content-to-conversation, open attribution window.
- **Inputs:** AG-2 packages, peak-window data, inbound comment/DM webhooks.
- **Outputs:** published posts (emits `content_published` WF-01), auto-DMs/replies (WF-02/03), captured/attributed leads handed to AG-4.
- **Memory — reads:** `02-market-research.md` (peak windows), `distribution-os/*`, business-memory. **Writes:** publish logs; **DynamoDB:** triggers `MKT_EVENT(content_published|comment|dm)`, `lead.upsert(contentRef=OPP-*)`.
- **Tools:** Read/Write/Bash; social-content skill.
- **MCP:** `blotato` (IG/FB/LI/TikTok/X publishing — **publish = HIL**). *Add: IG Graph + WhatsApp Business API webhook adapters (ingest, not MCP).*
- **Integration:** publish → attribution window; comment/DM intent → AG-4 (qualified lead + SDR notify).
- **Automation opportunities:** auto-reply keyword templates (rate-limited, consent-safe); auto-attribute DMs to the live OPP-*.
- **Guardrail:** publishing requires human approval; auto-DM rate-capped; no PII in public replies.

## AG-4 — Sales Agent
- **Responsibilities:** qualify, score, route, nurture leads from capture → demo → trial. Run speed-to-lead (<5 min). Own the pipeline.
- **Inputs:** `dm`/`lead_magnet`/`demo_requested` events, lead scores, qualification matrix.
- **Outputs:** scored/assigned leads, demo bookings + reminders, objection handling, trial pushes; pipeline updates.
- **Memory — reads:** `sales-os/qualification.md|objections|demo`, `../lead-scoring/lead-scoring-engine.md`, `../activation/`. **Writes:** `LEAD` (stage/assign/score), `SEQUENCE_ENROLLMENT`, `marketing-and-sales/outreach|sequences`; **DynamoDB:** `LEAD`, `SCORE`, `MKT_EVENT`.
- **Tools:** Read/Write/Bash/Grep; outbound-outreach, whatsapp-outreach, lead-nurture, cold-email, sales-enablement skills.
- **MCP:** none directly; uses `ai-calling-service` (Exotel+ElevenLabs) via `aiCall.place` action.
- **Integration:** AG-3 hands leads in; AG-4 places auto-qualify calls, books demos, hands activated trials to AG-5.
- **Automation opportunities:** auto-qualify call on Hot DM; auto-demo-reminder; objection sequence drafts.
- **Guardrail:** consent-gated WhatsApp/calls; quiet-hours; human-in-loop for custom pricing offers.

## AG-5 — Customer Success Agent
- **Responsibilities:** drive activation (aha = first AI call M3), retention, win-back, at-risk saves, expansion + referral asks.
- **Inputs:** `trial_started`, `milestone_hit`, `trial_inactive`, `customer_activated`, `health_critical`, `expansion_signal`.
- **Outputs:** onboarding drips, win-back/save flows, usage reviews, expansion offers (HIL), referral issuance.
- **Memory — reads:** `../activation/milestones-and-score.md`, `../customer-scoring/`, `../retention/`, `../onboarding/`, `sales-os/onboarding`. **Writes:** `SEQUENCE_ENROLLMENT`, `REFERRAL`, `LEAD/CUSTOMER` stage; **DynamoDB:** `SCORE` (activation/health), `MKT_EVENT`.
- **Tools:** Read/Write/Bash; lead-nurture, churn-prevention, onboarding-cro, referral-program, retention-analysis skills.
- **MCP:** none directly; uses `aiCall.place` + WhatsApp/email actions.
- **Integration:** AG-4 hands trials; AG-5 drives activation→paid→expansion; feeds AG-6 health/NRR.
- **Automation opportunities:** activation drip, capped win-back, at-risk save, usage-threshold expansion nudge.
- **Guardrail:** spend (discount/offer) = HIL; touch caps; consent.

## AG-6 — Analytics Agent
- **Responsibilities:** the AI Growth VP — synthesize funnel/attribution/scores into the Weekly Growth Brief, tune rules + score weights, declare A/B winners, allocate effort across agents. Owns referral tracking + reward integrity.
- **Inputs:** entire `MKT_EVENT` log, `SCORE`s, `CAMPAIGN.spend`, recipe logs, pipeline.
- **Outputs:** Weekly Growth Brief, score-weight tuning, rule priority changes, A/B verdicts, `REFERRAL` reward audits, dashboards.
- **Memory — reads:** `../analytics/` (metric dictionary), `../attribution/`, all scores, `growth-dashboard.md`. **Writes:** `marketing-and-sales/reports`, rule/score config, `../analytics/` dashboards; **DynamoDB:** read GSIs, write `RULE` weights (HIL), `REFERRAL` reward state.
- **Tools:** Read/Grep/Bash/Write; growth-intel, funnel-analysis, ab-testing, experiment-design, competitive-intel skills.
- **MCP:** `meta-ads` (read performance); pipeline (Sheets) for summaries.
- **Integration:** reads everything, writes back tuning to the engine; instructs AG-1 (budget), AG-2 (which OPP-* to scale), AG-4 (score thresholds).
- **Automation opportunities:** nightly score recompute feeding `trial_inactive`/`at_risk`; weekly auto-brief; auto-flag content-ROI winners.
- **Guardrail:** weight/rule changes proposed, applied on HIL approval; reward issuance audited on `paid` only.

---

## 2. Orchestration model

Agents do **not** call each other directly — they coordinate through two shared substrates: the **`MKT_EVENT` event backbone** (async handoffs) and **shared OS memory** (DynamoDB single table + content-OS markdown). Each operating agent subscribes to its trigger event types; the automation engine (`automation-architecture.md` §3) routes events to actions, and actions re-emit events that the next agent picks up. The chain is the funnel.

```
                         ┌──────────────────────── AG-6 ANALYTICS (VP) ───────────────────────┐
                         │  reads MKT_EVENT log + SCORE + CAMPAIGN.spend → Weekly Brief        │
                         │  tunes RULE weights / score / budget (HIL) ─────────────────────────┘
                         ▼ instructs                       ▲ measures everything
   brief ┌────────┐ asset ┌────────┐ publish ┌──────────┐ dm/lead ┌────────┐ trial ┌──────────┐
 ───────►│ AG-1   │──────►│ AG-2   │────────►│ AG-3     │────────►│ AG-4   │──────►│ AG-5     │
 demand  │ MKTG   │ brief │ CONTENT│ package │ DISTRIB. │ MKT_EVT │ SALES  │ paid  │ CUST.SUCC│
         └───┬────┘       └────────┘         └────┬─────┘         └───┬────┘       └────┬─────┘
             │ CAMPAIGN/UTM                       │ content_published │ lead/demo       │ activated/
             ▼                                    ▼ comment/dm        ▼ events          ▼ at_risk/expand
        ┌──────────────────────  MKT_EVENT BACKBONE (SQS → automationEngine → actionLibrary)  ──────────────────────┐
        │  shared memory: DynamoDB single table (TENANT#) · content-OS markdown (frameworks/hooks/recipe-log)        │
        └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                     ▲ referral loop (AG-5 issue → AG-4 attribute → AG-6 reward audit) feeds back to AG-1 demand
```

**Handoff contract:** every cross-agent handoff is a `MKT_EVENT` with `leadRef` + `contentRef(OPP-*)` + `campaignId`, so attribution and ownership are never lost. Shared memory is read-mostly; writes are owned (file-ownership map in root `CLAUDE.md`) — no two agents write the same entity field, preventing conflicts. AG-6 closes the loop: its brief re-tunes AG-1's demand strategy and AG-2's content priorities.

---

### 2.1 Event subscriptions (who wakes on what)

| `MKT_EVENT.type` | Subscribing agent(s) | Action triggered |
|---|---|---|
| `content_published` | AG-3 → AG-6 | open attribution window; ROI baseline |
| `comment`, `dm` | AG-3 → AG-4 | auto-DM, lead.upsert, score, notify SDR |
| `lead_magnet_download` | AG-4 | nurture enroll + score |
| `demo_requested`, `demo_booked` | AG-4 | reminder sequence + qualification brief |
| `demo_completed` | AG-4 → AG-5 | branch: trial push / objection / reschedule |
| `trial_started`, `milestone_hit` | AG-5 | onboarding drip + activation tracking |
| `trial_inactive` | AG-5 | capped win-back (cancellable) |
| `customer_activated`, `paid` | AG-5 → AG-6 | celebrate, referral ask, cancel nurture |
| `health_critical` | AG-5 | at-risk save flow |
| `expansion_signal` | AG-5 | expansion offer (HIL) |
| `referral_sent/converted` | AG-5 + AG-6 | issue / attribute / reward (paid-only) |
| *all types* | AG-6 | aggregate → Weekly Brief, tune rules/scores (HIL) |

Each subscription is implemented as a per-tenant `RULE` whose `do[]` calls the owning agent's action cluster — so the operating model and the runtime are the **same** rule set, viewed by funnel stage (here) vs by trigger (`workflow-catalog.md`).

## 3. Guardrails (system-wide)

| Guardrail | Rule | Owner |
|---|---|---|
| **Spend HIL** | No `meta-ads` budget change or paid offer auto-executes — queued as `APPROVAL` | AG-1, AG-5 |
| **Publish HIL** | No `blotato` publish without human approval; Quality Gate must pass | AG-2, AG-3 |
| **Consent** | No WhatsApp/email/call without stored `consent`; opt-out honored ≤1 cycle | AG-3/4/5 |
| **Rate limits** | Auto-DM + AI-call capped per lead/day; quiet hours 21:00–09:00 IST | AG-3/4 |
| **Claim safety** | Every asset claim ∈ business-memory §3; RERA-safe; no false numbers | AG-2 |
| **Tenant isolation** | All reads/writes `TENANT#`-scoped; no cross-tenant path | all |
| **Score/rule changes** | Weight + rule edits proposed, applied on HIL approval | AG-6 |
| **Reward integrity** | Referral reward only on `paid`; anti-abuse | AG-5, AG-6 |
| **Audit** | Every agent action re-emits a `MKT_EVENT` (full trail) | all |

---

## 4. Cross-links
- Runtime + rules engine + action library: `../automations/automation-architecture.md`
- 12 workflows (WF-*) the agents execute: `../automations/workflow-catalog.md`
- Content pipeline the agents operate: `../../production-sop/10-content-factory.md`
- 20-agent / 6-team specialist roster (the hands): root `CLAUDE.md` §Agent Teams + File Ownership Map
- Scores agents consume/produce: `../lead-scoring/`, `../activation/`, `../customer-scoring/`
- Metrics every agent ties to: `../analytics/` (metric dictionary), `../attribution/events.md`
