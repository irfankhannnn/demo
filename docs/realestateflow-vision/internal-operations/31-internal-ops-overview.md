# 31 — Internal Operations System Overview

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. None of this is built. The June header (Phase 4, Weeks 21–32, 8–12 people, 7 internal MCP servers, Strands, Postgres, Slack) is replaced by what actually exists: a solo founder with AI agents defined as Claude Code sub-agents in `tools/claude-skills/agents/`, five MCP servers in `.mcp.json`, and the operating-agent design in Content OS. **Start trigger: after the M1 PMF gate** (D21).

> **Scope:** the boundary between the internal go-to-market machinery and the product, and the design for the internal side when it starts. It is **not** part of what agencies buy. Product phases: `../21-roadmap.md`. The detailed operating-agent design: `marketing-and-sales/launch-plan-v2/content-os/growth-platform/ai-agents/ai-agent-architecture.md`.

---

## 1. Status and Start Trigger

Nothing in this document is running today. The launch plan is a solo founder plus AI agents and contractors (D20), with no SDR hire until MRR reaches ₹2L and no paid ads in M1 (`marketing-and-sales/launch-plan-v2/00-DECISIONS-LOG.md`).

**Internal operations start after the M1 PMF gate** (D21). The gate as recorded in the decisions log is: at least 3 paying agencies, at least 40% activation, at least 10% reply rate, Mumbai only.

> Open decision D27 (what counts as "activation") — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`.

Until then, the founder runs marketing and sales directly with the Claude Code agents and scripts already in the repo.

---

## 2. What This System Is

The internal operations system is the AI-powered machinery used to acquire, convert and retain customers. It is how the business is run, not what is sold.

Intended flows, once it starts:
- **Marketing:** a brief goes to an agent, which researches, writes copy, generates creative, and prepares posts for review before publishing.
- **Sales:** hot prospects are surfaced from the pipeline, outreach is drafted, and replies are tracked.
- **Operations:** a daily summary pulls revenue, pipeline velocity and churn into one place.
- **Product:** customer feedback is collected and turned into roadmap input.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Internal operations (founder tooling — not built yet)       │
│                                                              │
│  Claude Code sub-agents: tools/claude-skills/agents/         │
│    (30 definitions: the CLAUDE.md GTM personas plus          │
│     engineering reviewers used by the PR pipeline)           │
│                        ↓                                     │
│  Project MCP servers (.mcp.json): higgsfield, meta-ads,      │
│    blotato, nabi-crm, git                                    │
│  Local scripts: tools/claude-skills/scripts/*.ps1 (image,    │
│    TTS, Remotion render, SerpApi scrape, Sheets update)      │
│                        ↓                                     │
│  Outputs in git: marketing-and-sales/{creative,leads,ads,    │
│    outreach,reports}/                                        │
└──────────────────────────────────────────────────────────────┘
                            ↓
              RealEstateFlow go-to-market
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  Product (what agencies buy — built)                         │
│                                                              │
│  One agent core (classify → plan → tools → compose) serving  │
│    the WhatsApp command channel and in-CRM web chat          │
│  One MCP server, 72 tools generated from the shared registry │
│  Lead ingestion → EventBridge → qualifier + router Lambdas   │
│  Outbound AI calling + follow-up call service                │
│  Multi-tenant CRM on DynamoDB                                │
└──────────────────────────────────────────────────────────────┘
```

Evidence for the product box: `apps/crm/server/agents/`, `services/reality-flow-mcp/`, `apps/crm/server/leadIngestion.js`, `scripts/lead-qualifier-handler.js`, `lead-router-handler.js`, `services/ai-calling-service/`, `services/followup-agent-service/`.

**Different data, deliberately.** Operations agents read business data (Razorpay revenue, PostHog usage, the lead sheet, ad accounts). Product agents read a tenant's CRM. Operations never writes to a tenant's CRM.

**Different accounts.** Product runs in separate dev and prod AWS accounts (`infra/cicd/README.md`, `docs/pending-items/instagram-service-status.md`). Internal operations, when it starts, should not share a prod account with tenant data.

---

## 4. The Agents That Exist

Agent definitions live in `tools/claude-skills/agents/` — 30 files today. They are Claude Code sub-agents with tool permissions, not deployed services. `CLAUDE.md` lists 20 GTM personas across 6 teams; the rest are engineering reviewers used by the PR pipeline (`architecture`, `cicd`, `database`, `finops`, `principal-engineer`, `release-readiness`, `security`, `sre-observability`, `pr-intelligence`, `pr-orchestrator`, `orchestrator`).

| Team | Personas with a definition file | Missing / planned |
|---|---|---|
| 1 · Product & Engineering | `architect`, `sentry`, `pr-commander` | — (the PR pipeline now uses `principal-engineer` and `security`, D30) |
| 2 · Market Intelligence | `trend-hunter`, `deep-researcher`, `oracle` | — |
| 3 · Creative Production | `brand-strategist`, `nano-designer`, `motion-engineer`, `ugc-planner`, `orator`, `landing-page-builder`, `seo-content-writer` | — |
| 4 · Growth & Ad Ops | `media-buyer`, `ab-optimizer`, `lead-scraper` | — |
| 5 · Sales & Nurture | `sdr`, `nurture-bot` | — |
| 6 · Operations | `pipeline-manager` | `finance-tracker` and `analytics-reporter` were in the June design and do not exist |

The June document also described `analytics`, `finance-tracker` and `analytics-reporter` as a three-agent operations team. Only `pipeline-manager` was ever written.

**Tool reality per persona, corrected:**
- `nano-designer` and `motion-engineer`: production runs on Higgsfield (`marketing-and-sales/launch-plan-v2/content-os/higgsfield/`), not Remotion. The Remotion project referenced in `CLAUDE.md` is not in the repo; Remotion survives only as `tools/claude-skills/skills/remotion-video/SKILL.md` and `tools/claude-skills/scripts/render-remotion.ps1`.
- `orator`: ElevenLabs through `tools/claude-skills/scripts/elevenlabs-tts.ps1`. There is no ElevenLabs MCP configured.
- `landing-page-builder`: landing pages deploy to S3 + CloudFront through `infra/cicd/landing-pages/deploy.sh`. No Vercel.
- `sdr`: email is Amazon SES with Brevo as fallback (`apps/crm/server/emailService.js`). AiSensy appears only as a founder-side broadcast in the Razorpay webhook (`apps/crm/server/routes/billing.js`).
- `pipeline-manager`: the pipeline is tracked through `tools/claude-skills/scripts/sheets-update.ps1` in offline JSON/CSV mode. There is no Razorpay MCP, Analytics MCP or Workspace MCP.
- There is no Slack integration anywhere in the repo.

---

## 5. MCP Servers: What Exists

The June design called for **7 internal MCP servers** (Content, Campaign, Analytics, Scheduling, Research, Workspace, Events). **None were built**, and none are planned before the start trigger.

What `.mcp.json` actually configures:

| Server | Purpose |
|---|---|
| `higgsfield` | AI image and video generation |
| `meta-ads` | Facebook/Instagram campaign management |
| `blotato` | Social scheduling and publishing |
| `nabi-crm` | The product MCP server (`services/reality-flow-mcp/`), 72 CRM tools |
| `git` | Repository access |

Everything else is a local script under `tools/claude-skills/scripts/` or a direct API call.

> Open decision D22 (which scheduling tool — Blotato or manual upload) — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`. The operational Content OS docs currently describe manual upload (`content-os/distribution-os/instagram.md`), while `.mcp.json` and `CLAUDE.md` still list `blotato`. These need to agree before the internal system starts.

**Where content lives:** in git, at `marketing-and-sales/launch-plan-v2/content-os/` and `marketing-and-sales/creative/`, read directly by agents. There is no Content MCP and no S3 content store.

---

## 6. Data Sources

| Source | Used for | How it is reached today |
|---|---|---|
| Razorpay | Revenue, subscriptions, credit packs | REST API from the CRM backend (`apps/crm/server/routes/billing.js`, `razorpayOrders.js`) |
| PostHog | Product analytics | SDK in the CRM app and server |
| SES / Brevo | Outbound email | `apps/crm/server/emailService.js` |
| Google Sheets | Lead and pipeline tracking | `tools/claude-skills/scripts/sheets-update.ps1`, offline JSON/CSV mode |
| Meta Ads | Paid campaigns | `meta-ads` MCP |
| Higgsfield | Image and video generation | `higgsfield` MCP |
| Git repo | Brand kit, prompts, templates, content plans | Read directly from the working tree |

---

## 7. Autonomy Model

Start conservative and graduate with evidence. This model is unchanged from June and is the right shape; it just has nothing running on it yet.

```
Level 0 — Suggest.  Agent drafts → human edits and approves → executes.
  Default for: copy, design, social posts, outreach, anything financial.
Level 1 — Approve.  Agent composes → human one-tap approves → auto-executes.
  For: research summaries, metric reports, scheduling.
Level 2 — Auto + notify.  Agent acts → human is notified → can undo.
  For: pipeline updates, routine reports.
Level 3 — Auto.  Rare; only for deterministic calculations and scheduled tasks.
```

**Graduation:** 30–50 clean executions, under 2% error rate, zero bad outcomes (spam complaints, wrong data, policy violations), evals passing. The same rule governs product agents (`../21-roadmap.md` §7).

**Always Level 0 or 1, no exceptions:** anything touching money, anything legally binding, anything published under the company name, and any reply sent to a real prospect.

---

## 8. Success Metrics

The June targets assumed a paid-ads motion and were written in dollars. Corrected, and only meaningful once the system starts:

| Metric | Target | Applies from |
|---|---|---|
| Brief → publish-ready content | Under 2 days | Start |
| Content cadence | Set by the Content OS calendar, not by this doc | Start |
| Sales pipeline velocity | Contacted → replied → demo, trended weekly | Start |
| Churn and usage insight latency | Under 24 hours | Start |
| Cost per qualified lead (₹) | Set when a paid channel is switched on | M2+ |
| Return on ad spend | Set when a paid channel is switched on | M2+ |

No paid ads run in M1 (`00-DECISIONS-LOG.md`), so cost-per-lead and ROAS have nothing to measure until then.

> Open decision D23 (which channels) and D29 (analytics, referrals, prospect WhatsApp) — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`.

---

## 9. Technology, When It Starts

Reuse what the product already runs on. Nothing here is a new platform commitment.

- **Agents:** Claude Code sub-agents over repo files, the same way the PR pipeline runs today (`claude --agent <name>`, D30). Not Strands — it was considered and not adopted (`../20-technology-decisions.md` ADR-02).
- **Events, if any are needed:** EventBridge and DynamoDB, like the product. Not Step Functions.
- **Storage:** git for content and prompts; DynamoDB for any agent action log. **Not Postgres** — it is parked with no date (D8).
- **Scheduling:** whatever D22 settles.

---

## 10. Operations Versus Product

| Aspect | Operations | Product |
|---|---|---|
| Tenancy | Single tenant (us) | Multi-tenant (agencies) |
| Agents | GTM personas as Claude Code sub-agents | One agent core, tenant-scoped tools |
| Access control | Founder only | Tenant from token, role checks server-side |
| Data | Business data (revenue, usage, ad accounts) | Tenant CRM data |
| Compliance | Internal, but real prospects' data is still personal data under DPDP | DPDP, DLT, Meta policy |
| Cost | Overhead | Revenue |
| Risk of a mistake | Low, reversible | High, customer-visible |

Operations data is not risk-free: prospect lists are personal data, so the same "archive, never delete" and consent rules apply.

---

## 11. Why It Waits

1. **The product has to be sold first.** With one founder, time spent on internal automation is time not spent on the Phase A launch list (`../21-roadmap.md`).
2. **There is nothing to automate yet.** Automating a go-to-market motion before it has run manually optimises the wrong thing.
3. **The design already moved.** The operating-agent model now lives in Content OS (AG-1 Marketing, AG-2 Content, AG-3 Distribution and the rest) over a DynamoDB event backbone: `marketing-and-sales/launch-plan-v2/content-os/growth-platform/ai-agents/ai-agent-architecture.md`. That is the document to build from; this one is the boundary and the start trigger.

**Trigger:** after the M1 PMF gate (D21).

> **Open question:** does the internal system get its own AWS account, or does founder tooling stay local (scripts plus Claude Code) indefinitely? Nothing in it needs to be deployed to run.
