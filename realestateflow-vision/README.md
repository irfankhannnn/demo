# RealEstateFlow Vision — Discovery, Architecture & Execution Plan

This folder is the complete future-state architecture and implementation plan for evolving **RealEstateFlow** from a multi-tenant real-estate CRM into an **AI-Powered Real Estate Agency Operating System**.

It was produced by deep analysis of the codebase on branch `auth_rbac_feature` plus current (June 2026) vendor research. **Pricing/feature figures should be reconfirmed on live vendor pages before financial commitment** — see the verification caveat in `20`.

## How to read this
- **Start with `02-product-vision.md`** (what & why) and **`01-current-state-analysis.md`** (what exists today, honestly).
- Then **`03-future-state-architecture.md`** (the system blueprint) and **`20-technology-decisions.md`** (the key choices as ADRs).
- For execution: **`18`→`21`→`22`→`23`→`24`**.
- `24-implementation-plan.md` ends with the **build-vs-integrate cheat sheet** and **first-90-days** plan, and the **immediate next actions**.

## Document index
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
| 21 | roadmap | Phases 0–4 |
| 22 | jira-epics | Epic backlog |
| 23 | jira-stories | Stories + acceptance criteria |
| 24 | implementation-plan | First 90 days + cheat sheet |
| 25 | postgres-database-architecture | DynamoDB → Aurora PostgreSQL migration |
| 26 | postgres-schema-migration-scripts | DDL, Drizzle ORM, migration strategy |

## The one-paragraph summary
RealEstateFlow today is a solid multi-tenant serverless CRM with its AI ambitions (telephony, Bedrock, an agent persona, a marketing rig) mostly switched off or run founder-side. The plan is **evolution, not rewrite**: wrap the existing domain in clean **MCP tools**, add an **event-driven conversation backbone** and a **domain-bounded agent layer** (Strands + Bedrock AgentCore, Haiku-first with prompt caching), and light up the eight engines — acquisition, qualification, scoring, assignment, sales assistant, follow-up, voice, marketing — plus governed portal automation, all multi-tenant, grounded (never hallucinated), human-in-the-loop by default, and billed in **credits, not tokens**. Most of it is **integration of tools the repo already touches** (Bedrock, Exotel, ElevenLabs, AiSensy, Higgsfield/Meta/Blotato, Razorpay, Cognito) plus a little OSS (Chatwoot, Lago, Langfuse). Start by **rotating the exposed secrets**, wrapping the core as MCP, and shipping a WhatsApp-first acquisition+qualification wedge to pilot agencies in ~90 days.
