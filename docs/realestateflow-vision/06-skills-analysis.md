# 06 — Skills Analysis & Migration

> **Scope:** inventory and classification of the existing "skills" across the repo, and a migration plan into the target agent/MCP architecture (`04`, `05`). Two distinct skill systems exist today and are often conflated — this document separates them.

---

## 1. Two Skill Systems (don't conflate them)

| System | Location | Purpose today | Audience |
|---|---|---|---|
| **A. SyncBot CRM skills** | `ai-employee/skills/*` | Operate the CRM via natural language (6 skills, `npx tsx` CLI → CRM REST API) | A would-be tenant-facing AI employee (currently human-provisioned) |
| **B. Marketing/Eng skills** | `claude-skills/skills/*` (+ `cowork-skills/`, agents) | Run the **founding team's** go-to-market & engineering work via Claude (≈23 local + ~41 referenced, 20 agent personas) | Internal founder/operator |

These have different futures: **System A becomes MCP tools** consumed by tenant-facing agents; **System B mostly stays internal tooling**, with a *subset* productized as the tenant Marketing engine (`13`).

## 2. System A — SyncBot Skills: classify → MCP tools

All six are **business-workflow skills** that already call the CRM API. They map directly onto MCP servers (`05`).

| Skill | Scripts (examples) | Target MCP | Verdict |
|---|---|---|---|
| `lead-management` | create/get/update/search/delete/notes/metrics/convert lead | **Lead MCP** | **MCP candidate** — 1:1 |
| `buyer-management` | purchases, KYC docs, metrics | **CRM/Contact MCP** | MCP candidate |
| `tenant-management` | current rental, history, KYC | **CRM/Contact MCP** | MCP candidate |
| `owner-management` | portfolio, bank details, KYC | **CRM/Contact MCP** | MCP candidate |
| `property-management` | CRUD, list/sell/rent/vacate, docs | **Property/Inventory MCP** | MCP candidate |
| `contact-management` | CRUD, meetings, notes | **CRM/Contact + Visit MCP** | MCP candidate |

**Reusable assets to preserve (not the scripts, the *rules*):** money normalization (`80L→8000000`), area-specificity prompting, destructive-action confirmation gating, `responseMode` verbosity (summary/compact/details/full), "backend is source of truth." These become **tool-layer validation + agent prompt guidance**, surviving the CLI's retirement.

**Migration:** expose the underlying CRM endpoints via AgentCore Gateway as MCP tools → retire `npx tsx` scripts → tenant-facing agents (`04`) consume the tools. The "AI Employee" product stops being a human with a 24h SLA and becomes a real always-on agent.

## 3. System B — Marketing/Engineering Skills: classify

Classification of the `claude-skills` set against four buckets:

### 3.1 Business-workflow (→ tenant product, selectively)
`lead-enrichment`, `lead-nurture`, `outbound-outreach`, `whatsapp-outreach`, `pipeline-tracker`. These overlap with vision engines (Follow-Up, Acquisition). **Verdict:** reimplement as **product capabilities** (Follow-Up Automation `09`, Acquisition `08`) — *not* by lifting the founder skill, but by using it as a requirements spec. Keep founder versions for internal growth.

### 3.2 Content/Marketing (→ Marketing MCP, productized subset)
`brand-strategy`, `image-generation`/`nano-banana-pro`, `remotion-video`, `video-production`, `voiceover-gen`, `ugc-scripts`, `landing-page`, `seo-blog`, `social-content`, `ad-creative`, `meta-ads-setup`, plus the 41 referenced marketing skills. **Verdict:** the **generation primitives** (image/video/voiceover/caption/post-scheduling) become **Marketing MCP** tools wrapping Higgsfield/Meta-Ads/Blotato (`13`). The **strategy skills** (brand, positioning, content-strategy, CRO, SEO families) stay **internal** — they're consulting workflows, not per-tenant runtime features (at least until a "marketing copilot" tier).

### 3.3 Engineering (→ stay internal, dev-time)
`codebase-analysis`, `security-audit`, `pr-review`. **Verdict:** internal developer tooling. Keep; not productized.

### 3.4 Market-intelligence / strategy (→ stay internal)
`trend-analysis`, `icp-research`, `market-prediction`, `competitor-*`, `customer-research`, launch/pricing/positioning skills. **Verdict:** internal GTM tooling.

## 4. Agent Personas (System B) — internal vs product

The 20 `claude-skills/agents/*` personas (6 teams + orchestrator) are an **internal operating model for the founding team's marketing/engineering**, executed by Claude. They are **not** the tenant-facing agents of `04`. Keep them as-is for running the business. The *naming overlap* ("AI agents," "skills") with the product vision is the main source of confusion — this document's job is to draw that line clearly.

| | Internal (System B agents) | Product (vision agents, `04`) |
|---|---|---|
| Who it serves | The founding team | Each tenant's agency |
| Runtime | Claude Code / Claude on operator machines | Strands/AgentCore in the platform |
| Examples | `media-buyer`, `seo-content-writer`, `architect` | Sales Assistant, Qualifier, Voice |
| Future | Stay internal | The product |

## 5. `skills-lock.json` & external skills
Pins one external skill (`huashu-design`) by hash. Low relevance to product architecture; keep the lock pattern for any internal external-skill dependencies. Not a productization target.

## 6. Consolidated Migration Plan

| Asset | Action | Phase |
|---|---|---|
| SyncBot 6 skills | → MCP tools via Gateway; retire CLI; preserve rules in tool layer | 1–2 |
| SyncBot business rules | → tool-layer validation + agent prompt library | 1 |
| Marketing generation skills (image/video/voice/post) | → **Marketing MCP** (productized) | 3 |
| Marketing strategy skills | Keep internal | — |
| Lead nurture/enrichment/outreach skills | Use as spec for product engines (`08`,`09`) | 1–2 |
| Engineering skills | Keep internal (dev tooling) | — |
| 20 agent personas | Keep internal (GTM ops) | — |

## 7. Net Effect

After migration: **one product agent+MCP layer** (`04`/`05`) serves tenants, fed by the *requirements and rules* captured in today's skills; the founder's marketing/engineering skill apparatus continues to run the business internally. No capability is lost; the confusing dual meaning of "agents/skills" is resolved by who they serve and where they run.
