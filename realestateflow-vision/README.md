# RealEstateFlow Vision — Discovery, Architecture & Execution Plan

This folder is the complete future-state architecture and implementation plan for evolving **RealEstateFlow** from a multi-tenant real-estate CRM into an **AI-Powered Real Estate Agency Operating System** (Phases 0–3) + the internal **GTM operations system** that Cloudberry runs to acquire and retain customers (Phase 4+).

It was produced by deep analysis of the codebase on branch `auth_rbac_feature` plus current (June 2026) vendor research. **Pricing/feature figures should be reconfirmed on live vendor pages before financial commitment** — see the verification caveat in `20`.

## Folder Structure

**Root (Product: Phases 0–3):**
- `01-20` — Strategic & technology documents
- `00, 21-28` — Phased execution (Phases 0–3)
- `29-30` — Payment system + credits/metering implementation

**Subfolder: Internal Operations (Phase 4+):**
- `internal-operations/README.md` — Overview: teams, MCPs, agent personas, why separate
- `internal-operations/31-35` — Strategic architecture (operations system design)
- `internal-operations/phase-4-detailed-implementation.md` — Week-by-week plan

## How to read this
- **Start with `02-product-vision.md`** (what & why) and **`01-current-state-analysis.md`** (what exists today, honestly).
- Then **`03-future-state-architecture.md`** (the system blueprint) and **`20-technology-decisions.md`** (the key choices as ADRs).
- For execution: **`18`→`21`→`22`→`23`→`24`**.
- `24-implementation-plan.md` ends with the **build-vs-integrate cheat sheet** and **first-90-days** plan, and the **immediate next actions**.

## Document index — Strategic Docs (Foundation)

| # | Document | Theme |
|---|---|---|
| 01 | current-state-analysis | What exists today (codebase-grounded) |
| 02 | product-vision | Vision, ICP, pillars, principles |
| 03 | future-state-architecture | System blueprint (layers, backbone) |
| 04 | agent-architecture | AI agents (Strands/AgentCore, tiers) |
| 05 | mcp-architecture | Business-domain MCP servers |
| 06 | skills-analysis | Existing skills → MCP migration |
| 07 | automation-platform | Browser/portal automation (+legal) |
| 08 | social-lead-acquisition-engine | Omnichannel capture |
| 09 | lead-qualification-engine | Qualification + Sales Assistant + Follow-up |
| 10 | lead-scoring-engine | Hot/Warm/Cold |
| 11 | lead-assignment-engine | Routing rules |
| 12 | voice-architecture | AI voice (India-compliant) |
| 13 | marketing-architecture | AI marketing engine |
| 14 | rag-and-knowledge-architecture | Knowledge/RAG |
| 15 | security-architecture | Identity, RBAC, isolation, compliance |
| 16 | infrastructure-architecture | AWS infra (validated vs reality) |
| 17 | cost-and-billing-architecture | Credits over tokens |
| 18 | migration-strategy | Strangler-fig (no rewrite) |
| 19 | risk-analysis | Risk register |
| 20 | technology-decisions | ADRs + decisions at a glance |

## Document index — Phased Execution Plan

| # | Document | Phase | Theme |
|---|---|---|---|
| 00 | phase-0-prerequisites | **Phase 0 (2–3 wks)** | Secrets rotation, CI/CD, RBAC, pagination, audit log — MUST complete before Phase 1 |
| 21 | roadmap | All phases | Strategic phases 0–3 |
| 24 | implementation-plan | Phase 1 | WhatsApp wedge details + build-vs-integrate cheat sheet |
| 25 | postgres-database-architecture (REVISED) | Phase 2 | PostgreSQL for agent/analytics only (NOT full CRM migration) |
| 26 | postgres-schema-migration-scripts (REVISED) | Phase 2 | Knex ORM, service layer, analytics table schema |
| 27 | phase-2-postgres-analytics-agent-tables | Phase 2 | Detailed: agent audit, conversations, credits, analytics |
| 28 | phase-3-scale-automation-marketing | Phase 3 | Follow-up journeys, voice, marketing, portal automation, dashboards |
| 29 | payment-system-implementation | Phase 0+1 | Fix all billing gaps: webhook, grace period, read-only, cancellation UI — CFN only |
| 30 | credits-metering-implementation | Phase 2 | Credit ledger, metering middleware, multi-model router, Razorpay packs — CFN only |
| 37 | product-agents-mcps-guide | Phase 1–3 | **Tenant-facing:** 10 agents + 11 MCPs, how they work, end-to-end examples, autonomy levels |

## Revised Phases

1. **Phase 0 (Weeks 1–3):** Security hardening, CI/CD fix, RBAC enforcement, pagination, audit log + **payment system gap fixes** (docs `00`, `29`)
2. **Phase 1 (Weeks 4–9):** WhatsApp inbound + Sales Assistant + Qualifier (on DynamoDB) + billing UI polish (doc `24`, `29`)
3. **Phase 2 (Weeks 7–10, parallel to Phase 1 weeks 6–9):** PostgreSQL for agent audit, analytics, **credits/metering** (doc `27`, `30`)
4. **Phase 3 (Weeks 13–20):** Follow-up automation, voice, marketing, portal automation, advanced analytics (doc `28`)

## Infrastructure Constraint

**All infrastructure must be CloudFormation (CFN) only.** No Terraform, CDK, Pulumi, or SAM. The canonical template is `server/infra/cfn-backend.yaml`. All new AWS resources (EventBridge rules, Lambda functions, Aurora cluster, RDS Proxy, SNS topics) are added as new resources in that template or as companion templates in `server/infra/`.

## The one-paragraph summary
RealEstateFlow today is a solid multi-tenant serverless CRM with its AI ambitions (telephony, Bedrock, an agent persona, a marketing rig) mostly switched off or run founder-side. The plan is **evolution, not rewrite**: wrap the existing domain in clean **MCP tools**, add an **event-driven conversation backbone** and a **domain-bounded agent layer** (Strands + Bedrock AgentCore, Haiku-first with prompt caching), and light up the eight engines — acquisition, qualification, scoring, assignment, sales assistant, follow-up, voice, marketing — plus governed portal automation, all multi-tenant, grounded (never hallucinated), human-in-the-loop by default, and billed in **credits, not tokens** (Phases 0–3).

**Separately:** The internal GTM operations system (20 agent personas, 6 teams, Marketing Agent, content factory, research, analytics) runs single-tenant in Phase 4+ (see `internal-operations/` folder). Same AWS infra, different data and RBAC.
