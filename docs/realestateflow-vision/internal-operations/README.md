# Internal Operations — GTM, Marketing, Content

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The June week-by-week timeline, the "7 teams", the seven internal MCP servers, Strands, Postgres and the plan to sell the ops system are all corrected or removed. Nothing here is built; it starts after the M1 PMF gate (D21).

> **Scope:** the machinery used to run the business — marketing, content, sales support, reporting — as distinct from the product agencies buy. Product: `../21-roadmap.md`.

---

## What This Folder Is

The **product** is RealEstateFlow, the AI agency OS that agencies pay for. The **operations** side is how the company markets and sells it. They are different systems with different data, different risk and different people (or, today, one person).

This folder holds three files:

- `README.md` — this file: the boundary, the reality check, the start trigger.
- `31-internal-ops-overview.md` — the agents and MCP servers that actually exist, the autonomy model, the data sources.
- `32-marketing-agent-architecture.md` — **archived** June design for an autonomous marketing agent.

Docs 33–36 and a phase-4 implementation plan were listed in June and never written. See `INDEX.md` for where their content actually lives.

---

## Reality Check (Sep 2026)

| June assumption | What is true |
|---|---|
| Phase 4, Weeks 21–32, Q3 2026 | It is Q3 2026 and none of it is built. It starts after the M1 PMF gate, with no date (D21). |
| 8–12 people, 7 teams | Solo founder plus AI agents and contractors; no SDR hire until MRR ≥ ₹2L (D20). `CLAUDE.md` defines 6 teams, not 7. |
| 20 agent personas, 60+ skills | 30 agent definitions exist in `tools/claude-skills/agents/` — the GTM personas plus engineering reviewers. Team 6 has only `pipeline-manager`. The skill registry is in `CLAUDE.md`; `tools/claude-skills/skills/` holds the ones that live in this repo. |
| 7 internal MCP servers | None exist. `.mcp.json` configures `higgsfield`, `meta-ads`, `blotato`, `nabi-crm` and `git`. |
| Strands T2 agents | Not adopted. Agents are Claude Code sub-agents over repo files (`../20-technology-decisions.md` ADR-02). |
| PostgreSQL for analytics | Parked with no date (D8). DynamoDB is the only store. |
| Same AWS account as the product | The product runs in separate dev and prod accounts (`infra/cicd/README.md`). |
| Remotion for video, Vercel for pages, Blotato for scheduling | Video production runs on Higgsfield (`content-os/higgsfield/`); landing pages go to S3 + CloudFront via `infra/cicd/agency-app/landing-pages/deploy.sh`; the scheduling tool is an open decision (D22). |
| Slack for approvals and alerts | No Slack integration exists anywhere in the repo. |
| Productize the ops skills and rent out the GTM agents | Not happening, and nothing is productized. This replaces the contradictory line in the June README. |

---

## Why It Waits

1. **One founder.** Every hour on internal automation is an hour off the Phase A launch list.
2. **Nothing to automate yet.** A go-to-market motion has to run manually before it is worth automating.
3. **The design already moved.** The operating agents (marketing, content, distribution and the rest, over a DynamoDB event backbone) are designed in `marketing-and-sales/launch-plan-v2/content-os/growth-platform/ai-agents/ai-agent-architecture.md`. Build from there, not from `32`.

**Start trigger:** after the M1 PMF gate — at least 3 paying agencies, at least 40% activation, at least 10% reply rate, Mumbai only (`marketing-and-sales/launch-plan-v2/00-DECISIONS-LOG.md`, D21).

> Open decision D27 (what counts as "activation") and D28 (launch date) — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`.

---

## Governance

The autonomy model is in `31` §7 and applies to every internal agent:

- **Level 0 (draft, human approves)** is the default for copy, design, posts, outreach and anything financial.
- **Level 1** for research summaries and metric reports.
- **Level 2** only for reversible, routine work, after 30–50 clean runs.
- **Never autonomous:** money, legal commitments, anything published under the company name, any reply sent to a real prospect.

Prospect lists are personal data. DPDP obligations and the repo rule "archive, never delete" apply to internal data too.

---

## What To Read Instead, Today

Internal operations is not running, so the useful documents are elsewhere:

| Need | Document |
|---|---|
| The launch plan and decisions | `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`, `00-DECISIONS-LOG.md` |
| Brand, tone, visual system | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` |
| Positioning and ICP | `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` |
| Content production | `marketing-and-sales/launch-plan-v2/content-os/` |
| The operating-agent design for later | `content-os/growth-platform/ai-agents/ai-agent-architecture.md` |
| Product roadmap and status | `../21-roadmap.md`, `../QUICK-START.md` |

---

## Next Steps (when the trigger fires)

1. Confirm the scheduling tool (D22) and the channel set (D23) so distribution stops contradicting `.mcp.json`.
2. Pick the first workstream. Content production is the obvious one — it is already half-defined in Content OS.
3. Write the missing operations agent definitions (`finance-tracker`, `analytics-reporter`) or decide `pipeline-manager` covers them.
4. Decide whether anything needs to be deployed at all, or whether founder tooling stays local scripts plus Claude Code.
