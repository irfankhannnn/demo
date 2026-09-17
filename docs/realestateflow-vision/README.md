# RealEstateFlow Vision — Discovery, Architecture & Execution Plan

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Index fixed (no docs 33–35 or phase-4 plan exist), archived docs marked, the June stack choices replaced by what was built, and dated phases replaced by Phase A/B/C.

This folder describes how **RealEstateFlow** (pre-launch, no customers yet) grows from a multi-tenant real-estate CRM into an **AI-powered operating system for Indian real estate agencies**, plus the internal GTM operations system used to sell it.

The docs were first written in June 2026 against branch `auth_rbac_feature`. In September 2026 they were updated in place: each updated doc carries a status banner saying what is built today (with repo paths) and what is still roadmap. Docs that no longer describe the plan carry an **Archived** banner and are kept for history. Vendor prices and feature claims should be reconfirmed on live vendor pages before any financial commitment (see `20`).

## Folder structure

**Root (product):**
- `01`–`20` — strategy and architecture
- `00`, `21`–`28` — execution plan and phase detail
- `29`–`30` — payments and credit metering
- `37` — tenant-facing agents and MCP guide
- `38`–`39` — new proposals (pricing, official WhatsApp API)

**Subfolder `internal-operations/` (internal GTM system):**
- `internal-operations/README.md`, `INDEX.md` — overview
- `internal-operations/31-internal-ops-overview.md` — kept (corrected)
- `internal-operations/32-marketing-agent-architecture.md` — archived
- Docs 33–36 and a phase-4 implementation plan were planned but never written. Internal operations start only after the M1 PMF gate.

## How to read this
- Start with **`01-current-state-analysis.md`** (what exists in the code, Sep 2026) and **`02-product-vision.md`** (what and why).
- Then **`03-future-state-architecture.md`** (blueprint: as built + target) and **`20-technology-decisions.md`**.
- For execution: **`QUICK-START.md`** → **`00-phase-0-prerequisites.md`** (hardening checklist with status) → **`21-roadmap.md`**.
- The design actually being implemented for the agent runtime is `docs/proposals/agent-channel-architecture/` ("one agent core, channel adapters"). Other current references: `docs/README.md`, `docs/current_design/`, `docs/lead-adapter-architecture.md`.

## Document index — strategy and architecture

| # | Document | Theme | Status |
|---|---|---|---|
| 01 | current-state-analysis | What exists today (Sep 2026, code-grounded) | Updated |
| 02 | product-vision | Vision, ICP, pillars, principles | Updated |
| 03 | future-state-architecture | System blueprint (as built + target) | Updated |
| 04 | agent-architecture | Agent runtime (in-house pipeline, model gateway, tiers) | Updated |
| 05 | mcp-architecture | One MCP server (72 tools) | Updated |
| 06 | skills-analysis | Skill systems → tool registry / MCP | Updated |
| 07 | automation-platform | Portal lead ingestion; browser posting dropped | Updated |
| 08 | social-lead-acquisition-engine | Channel capture, as built + plan | Updated |
| 09 | lead-qualification-engine | Qualification + Sales Assistant + Follow-up | |
| 10 | lead-scoring-engine | Hot/Warm/Cold | |
| 11 | lead-assignment-engine | Routing rules | |
| 12 | voice-architecture | AI voice (India-compliant) | |
| 13 | marketing-architecture | Marketing engine | |
| 14 | rag-and-knowledge-architecture | Knowledge/RAG | |
| 15 | security-architecture | Identity, RBAC, isolation, compliance | |
| 16 | infrastructure-architecture | AWS infra | |
| 17 | cost-and-billing-architecture | Credits over tokens | |
| 18 | migration-strategy | Strangler-fig (no rewrite) | |
| 19 | risk-analysis | Risk register | |
| 20 | technology-decisions | ADRs + decisions at a glance | |

## Document index — execution plan

| # | Document | Phase | Theme | Status |
|---|---|---|---|---|
| 00 | phase-0-prerequisites | A / B | Hardening checklist: billing, secrets, CI, RBAC, pagination, audit | Updated |
| 21 | roadmap | All | Phase A (M1 launch) → B (hardening) → C (growth) | |
| 22 | jira-epics | All | Epics | |
| 23 | jira-stories | All | Stories | |
| 24 | implementation-plan | — | June Phase-1 WhatsApp wedge plan | **Archived** |
| 25 | postgres-database-architecture | — | June Postgres design | **Archived** |
| 26 | postgres-schema-migration-scripts | — | June Knex/Postgres scripts | **Archived** |
| 27 | phase-2-postgres-analytics-agent-tables | Parked | Postgres as a future reporting store fed from DynamoDB (no date) | Parked |
| 28 | phase-3-scale-automation-marketing | C | Follow-up journeys, voice, marketing, dashboards | |
| 29 | payment-system-implementation | A | Billing gaps: webhooks, grace period, read-only, cancellation UI (CFN only) | |
| 30 | credits-metering-implementation | Built | Credit metering as built; pricing moved to `38` | |
| 37 | product-agents-mcps-guide | — | Tenant-facing agents + MCPs (June design: 10 agents, 11 MCPs; built: one agent runtime, one MCP server) | |
| 38 | pricing-plan-contacts-and-credits | — | Plans by properties + AI credits, new "Contacts" unit | **Proposed** (awaiting founder approval) |
| 39 | whatsapp-official-api-plan | C | WhatsApp Business Cloud API for customer messaging | **Proposed** |
| internal-operations/31 | internal-ops-overview | After M1 PMF gate | Internal GTM operations | Kept |
| internal-operations/32 | marketing-agent-architecture | — | June internal marketing agent design | **Archived** |

## Phases (no dates)

1. **Phase A — M1 launch.** Ship what is built to the first agencies, and close the items that must be done before taking payment: grace-period enforcement, API throttling, access logs, CORS fix, key rotation. Voice is outbound only.
2. **Phase B — Hardening.** MANAGER role and "members see only their own leads" before selling Team plans, cursor pagination, CRM audit log (archive, not TTL delete), E2E tests in CI, WAF after first customers, DLT registration before bulk calls.
3. **Phase C — Growth.** Official WhatsApp Cloud API for customer messaging (`39`), WhatsApp nurture journeys, Instagram DM assistant (draft first, auto later), inbound AI voice, portal lead ingestion, brochure/floor-plan tools, tenant social publishing after Meta App Review.

Detail and status per item: `QUICK-START.md`, `00`, `21`.

## Infrastructure constraint

**CloudFormation only.** No Terraform, CDK, Pulumi or SAM. Each service owns its template(s) under `apps/*/infra` or `services/*/infra` (17 templates today) and deploys through `infra/cicd/<service>/deploy.sh`. CRM backend resources (EventBridge rules, Lambdas, tables) go in `apps/crm/server/infra/cfn-backend.yaml`; launch tables are in `apps/crm/server/infra/launch-tables-cfn.yaml`. Deploys stay manual through these wrappers; a GitHub Actions deploy to dev comes later.

## The one-paragraph summary
RealEstateFlow today is a multi-tenant serverless CRM (DynamoDB, Lambda, Cognito) with most of the AI pieces already in code, several only on dev: an in-house agent runtime behind a model gateway (Gemini today) used from WhatsApp and web chat, EventBridge lead qualification and routing, outbound AI calling (ElevenLabs + Exotel) with a follow-up call service, a hosted Instagram service (dev, Meta App Review pending), one MCP server with 72 tools, DynamoDB vector search with Titan embeddings, public property pages, and a credit ledger. The remaining gaps are team RBAC and lead scoping, cursor pagination, a CRM mutation audit log, grace-period enforcement, customer-facing WhatsApp, and production deploys. The plan is **evolution, not rewrite**, grounded answers only, human-in-the-loop by default, and never deleting CRM data (archive instead).

**Separately:** the internal GTM operations system (`internal-operations/`) is founder tooling (solo founder + AI agents + contractors) and starts after the M1 PMF gate.
