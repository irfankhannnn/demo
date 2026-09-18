# Internal Operations — Document Index

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The index now lists only files that exist: docs 33, 34, 35, 36 and a phase-4 implementation plan were planned in June and never written. Owners, approval routes and the Strands/7-MCP assumptions are corrected. The system starts after the M1 PMF gate (D21).

> **Audience:** the founder and anyone helping with go-to-market. Internal only — none of this is sold.

---

## Files in This Folder

| File | What it is | Status |
|---|---|---|
| `README.md` | Why internal operations is separate from the product, and what is real today | Updated |
| `31-internal-ops-overview.md` | The boundary, the agents and MCPs that actually exist, autonomy model, start trigger | Kept, corrected |
| `32-marketing-agent-architecture.md` | June design for an autonomous marketing agent | **Archived** |

**Never written:** `33-content-creation-pipeline.md`, `34-gtm-skills-analysis.md`, `35-internal-mcp-servers.md`, `36-team-agent-coordination.md`, `phase-4-detailed-implementation.md`. They are not planned. What they would have covered now lives elsewhere:

| Planned doc | Where the content actually is |
|---|---|
| 33 Content creation pipeline | `marketing-and-sales/launch-plan-v2/content-os/production-sop/` and `content-os/higgsfield/` |
| 34 GTM skills analysis | The skills registry in `CLAUDE.md`; skill folders in `tools/claude-skills/skills/` |
| 35 Internal MCP servers | Not built and not planned. The real MCP list is in `.mcp.json` (see `31` §5). |
| 36 Team agent coordination | Agent definitions in `tools/claude-skills/agents/`; team map and file ownership in `CLAUDE.md` |
| phase-4 implementation plan | Superseded by `marketing-and-sales/launch-plan-v2/` and `content-os/growth-platform/ai-agents/ai-agent-architecture.md` |

---

## Key Decisions

| Decision | Why |
|---|---|
| **Starts after the M1 PMF gate** (D21) | One founder. Time spent automating go-to-market before it has run manually is time not spent launching. |
| **Separate folder from the product docs** | Different data, different access control, different risk. No coupling to the product release cycle. |
| **Claude Code sub-agents, not a framework** | The agents already exist as definitions in `tools/claude-skills/agents/` and run through the same mechanism as the PR pipeline. Strands was considered and not adopted (`../20-technology-decisions.md` ADR-02). |
| **No internal MCP servers** | The seven proposed in June were never built. Local scripts and the five servers in `.mcp.json` cover what is needed. |
| **Level 0 autonomy by default** | Nothing is published, sent or charged without a human. |
| **Nothing is productized** | No internal playbook or skill is sold or exposed in the product. This supersedes the contradictory "productize select skills" line in the June README. |

---

## How to Use This Folder

- **Deciding what to build:** read `README.md`, then `31`. The start trigger and the product/operations boundary are the two things that matter.
- **Doing marketing work today:** this folder is not the playbook. Use `marketing-and-sales/launch-plan-v2/` and `marketing-and-sales/creative/realestateflow-launch/brand-kit.md`.
- **Building the operating agents when the trigger fires:** start from `marketing-and-sales/launch-plan-v2/content-os/growth-platform/ai-agents/ai-agent-architecture.md`, not from `32`.

---

## Relationship to the Product

| Dimension | Product (`../21-roadmap.md`) | Internal operations |
|---|---|---|
| Tenancy | Multi-tenant (agencies) | Single tenant (us) |
| Data | Tenant CRM: leads, contacts, properties | Business data: revenue, usage, ad accounts, prospect lists |
| Risk of a mistake | Customer-visible, sometimes irreversible | Internal, mostly reversible — but prospect data is still personal data under DPDP |
| Autonomy | Draft first, graduate per flow with evals | Same rule, same bar |
| Status | Built; launching (Phase A) | Not built; starts after the M1 PMF gate |

**Data flows one way.** Operations reads product metrics (revenue, usage, funnel). Operations never writes to a tenant's CRM.

---

## Ownership

Everything in this folder is owned by the founder. There is no separate product manager, growth lead, CTO or operations manager, and there is no Slack workspace in the loop — the team is a solo founder plus AI agents and contractors (D20). Changes go through a normal pull request.
