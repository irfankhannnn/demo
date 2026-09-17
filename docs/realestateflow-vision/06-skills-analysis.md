# 06 — Skills Analysis & Migration

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. The migration this document planned has happened: the SyncBot `npx tsx` CLI is gone and the CRM's in-process tool registry (`agency-app/api/shared/toolDefinitions.js`, 72 tools) is the product surface, republished as MCP by `platform/mcp` (`05`). Paths, counts and `skills-lock.json` are corrected; the tenant marketing agent is dropped.

> **Scope:** inventory and classification of the "skills" in the repo, and where each one ended up in the agent/MCP architecture (`04`, `05`). Two different things are called skills here and are often conflated — this document separates them.

---

## 1. Two Skill Systems (don't conflate them)

| System | Where it lives today | What it is | Audience |
|---|---|---|---|
| **A. Product CRM tools** (was "SyncBot skills") | `agency-app/api/shared/toolDefinitions.js` — 72 tools across 9 domains; run in-process by `agency-app/api/skillInvoker.js` behind `POST /api/crm/agent/tool` | The CRM's own capabilities, described once so any agent can call them | Tenant-facing agents, and customers' own Claude/ChatGPT via MCP |
| **B. Founder's Claude toolkit** | `tools/claude-skills/` — 30 agent personas, 32 skills, 15 `cowork-skills`, 9 scripts | Runs the **founding team's** go-to-market and engineering work inside Claude Code | Internal founder/operator |

The old System A location `ai-employee/skills/*` no longer exists. The six skill folders survive as **reference documentation only** at `tools/openclaw_workspace_reference/skills/*` (`buyer-`, `contact-`, `lead-`, `owner-`, `property-`, `tenant-management`, plus `utils`); nothing executes them.

System B is copied into `.claude/agents/` and `.claude/skills/` by `tools/claude-skills/setup.ps1` so Claude Code can discover it. `tools/claude-skills/` is the source of truth — edit there, re-run setup, never edit `.claude/` directly. (The script's header says "symlinks"; it copies.)

## 2. System A — the migration is done

All six SyncBot skills already called the CRM REST API. They were replaced by one registry rather than six CLIs.

| June skill | Registry domain | MCP category (`05`) | Status |
|---|---|---|---|
| `lead-management` | `leads` | `lead` (8 tools) | **Done** |
| `buyer-management` | `buyers` | `buyer` (7) | **Done** |
| `tenant-management` | `tenants` | `tenant` (8) | **Done** |
| `owner-management` | `owners` | `owner` (8) | **Done** |
| `property-management` | `properties` | `property` (9) | **Done** |
| `contact-management` | `contacts` | `contact` (10), `meeting` (5) | **Done** |
| — (new since June) | `analytics`, `khata` | `metrics` (15), `khata` (2) | **Done** |

**How it actually went.** Not "expose the endpoints through AgentCore Gateway": the tools are defined once in the registry, executed in-process by `skillInvoker.js`, and the MCP server generates its 72 tool definitions from that same registry, with CI failing on drift (`05 §2`). One definition, three consumers — WhatsApp agent, CRM backend, MCP server. AgentCore Gateway is listed in `05 §4` as considered, not adopted.

**The rules survived, the scripts didn't.** Money normalisation (`80L → 8000000`), area-specificity prompting, destructive-action confirmation gating, `responseMode` verbosity, "backend is source of truth" — these now live as tool-layer validation and agent prompt guidance rather than as CLI argument parsing. That was always the point of the migration.

**"AI Employee" reality check.** The runtime is genuinely always-on (`03 §4`, agent pipeline on Lambda) and billing auto-starts provisioning. But the product sold today is still an AI Employee add-on with a **24-hour concierge setup** (`marketing-and-sales/launch-plan-v2/pricing.json`), so a human is still in the first mile. The June line "stops being a human with a 24h SLA" is half true: the software is there, the offer has not changed yet.

## 3. System B — what is in `tools/claude-skills/` now

**32 skills**, grouped by what they are for:

| Bucket | Skills | Verdict |
|---|---|---|
| Business workflow (spec for product engines) | `lead-enrichment`, `lead-nurture`, `outbound-outreach`, `whatsapp-outreach`, `pipeline-tracker`, `serpapi-scraping` | Use as **requirements** for the product engines (`08`–`11`). Do not lift the skill into the product. Keep the founder versions for internal growth work. |
| Content & marketing | `brand-strategy`, `design-assets`, `image-generation`, `landing-page`, `remotion-video`, `seo-blog`, `ugc-scripts`, `video-production`, `voiceover-gen`, `meta-ads-setup`, `ab-testing` | **Stay internal.** The June plan to productise the generation primitives as a tenant "Marketing MCP" is dropped along with the tenant marketing agent (see §5). |
| Engineering & PR intelligence | `architecture-review`, `cicd-review`, `codebase-analysis`, `database-review`, `finops-review`, `pr-change-routing`, `pr-intelligence`, `pr-review`, `principal-engineer-review`, `release-readiness`, `security-audit`, `sre-observability-review` | Internal developer tooling. Not productised. |
| Market intelligence | `icp-research`, `market-prediction`, `trend-analysis` | Internal go-to-market tooling. |

**30 agent personas** in `tools/claude-skills/agents/`: the original 20 marketing/product personas (six teams plus `orchestrator`) and 10 engineering personas added with the PR-intelligence work (`architecture`, `cicd`, `database`, `finops`, `pr-intelligence`, `pr-orchestrator`, `principal-engineer`, `release-readiness`, `security`, `sre-observability`). The `kubernetes-helm` persona and its `kubernetes-review` skill were removed — this stack has no Kubernetes.

The registry in the root `CLAUDE.md` also lists 41 marketing skills from `coreyhaines31/marketingskills`. Those are **not vendored in this repo**; treat the CLAUDE.md list as a catalogue of what may be installed, not an inventory of what is on disk.

## 4. `skills-lock.json` and external skills

The lock file at the repo root pins **27 external skills** by content hash: 26 from `heygen-com/hyperframes` (video composition, captions, rendering) and 1 from `alchaincyf/huashu-design`. The June note that it "pins one external skill" is out of date.

Keep the pattern. Hash-pinning is the only thing stopping an upstream edit from silently changing how our video pipeline behaves.

## 5. Internal agents vs product agents

The System B personas are an **internal operating model for the founding team**, executed by Claude on an operator machine. They are **not** the tenant-facing agents of `04`. The naming overlap is the main source of confusion; this table is the line.

| | Internal (System B personas) | Product (agents, `04`) |
|---|---|---|
| Who it serves | The founding team | Each tenant's agency |
| Runtime | Claude Code on operator machines | In-house pipeline on Lambda, behind the model gateway (`03 §4`, `04`) |
| Tools | Local files, MCPs listed in `.mcp.json` | The 72-tool registry via `skillInvoker` / MCP |
| Examples | `media-buyer`, `seo-content-writer`, `principal-engineer` | Sales assistant, lead qualifier, lead router, follow-up caller |
| Future | Stays internal | Is the product |

**Dropped:** a per-tenant marketing agent. Agencies will not get an autonomous marketing agent that spends their money or posts in their name. What stays on the roadmap is **tenant social publishing** through the Instagram service once Meta App Review passes (`08`) — a publishing surface a person drives, not an agent with a budget.

## 6. Where each asset ended up

| Asset | Action | Status |
|---|---|---|
| Six SyncBot skills | → one in-process tool registry + one MCP server; CLI retired | **Done** |
| SyncBot business rules | → tool-layer validation + agent prompt guidance | **Done** |
| Marketing generation skills | Keep internal; tenant Marketing MCP dropped | Decided |
| Marketing strategy skills | Keep internal | Decided |
| Lead nurture / enrichment / outreach skills | Use as spec for the product engines `08`–`11` | Ongoing |
| Engineering and PR-intelligence skills | Keep internal (dev tooling) | Done |
| 30 agent personas | Keep internal (GTM + engineering ops) | Done |
| `skills-lock.json` | Keep hash-pinning for external skills | Done |

## 7. What is still open

- **Registry hygiene.** `platform/mcp/README.md` still says 54 tools (`05 §2`). The root `CLAUDE.md` skills registry is a catalogue, not an inventory, and says so nowhere.
- **Tool-level audit.** Agent actions land in `AgentAuditTable`; there is no per-tool audit record for MCP callers (`05 §5`).
- **Scoping.** Registry tools are tenant-scoped, not user-scoped. When MANAGER and "members see only their own leads" land (`15`), `POST /api/crm/agent/tool` has to apply the same scoping for every consumer at once.

## 8. Net effect

One product tool layer (`04`/`05`) serves tenants, carrying the rules the old CRM skills encoded. The founder's Claude toolkit keeps running the business from the operator's machine and is not shipped to anyone. "Agents" and "skills" now mean two clearly different things, separated by who they serve and where they run.
