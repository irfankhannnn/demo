# 03 — Future-State Architecture

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Each layer now shows what is built; the June choices (Strands/AgentCore, Claude Haiku/Sonnet on Bedrock, Bedrock Knowledge Bases, Redis, Aurora, separate Conversations tables, 11 MCP servers) are marked "considered, not adopted" where the built solution replaced them.

> **Purpose:** the technical architecture for RealEstateFlow as an AI agency operating system, reached **incrementally from today's stack** (`01`) via the strangler-fig migration in `18`, not by rewrite. Per-domain detail lives in `04`–`17`. The agent/channel design being implemented is `docs/proposals/agent-channel-architecture/`.

---

## 1. Design Tenets

1. **Evolve the serverless core; don't rewrite it.** Lambda + DynamoDB + Cognito stays the system of record.
2. **One domain API, many interfaces.** Every channel and every agent reaches the business through the same domain layer: REST, the in-process tool registry (`apps/crm/server/shared/toolDefinitions.js`), and the MCP server generated from it (`05`).
3. **Agents are orchestrators, not data owners.** Agents reason and call tools; tools enforce tenancy, validation and RBAC.
4. **Async, event-driven backbone.** Conversations, calls, automations and follow-ups go through EventBridge/SQS, not synchronous chains.
5. **Tenant isolation end-to-end** — data, credentials, agent memory, vector search, billing (`15`).
6. **Cost-aware by default.** Cheapest model that works, chosen behind the model gateway; a separate cheaper classifier model; stable prompt prefixes so implicit caching hits (`17`, `20`).
7. **Human-in-the-loop is a first-class state** — every autonomous workflow has an approval/exception path.
8. **Never delete CRM data** — archive instead.

## 2. Layered Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  L1  EXPERIENCE / INTERFACES                                             │
│  Built: CRM SPA + web chat · Agency WhatsApp (command) · Capacitor app   │
│         · Instagram console (/insta) · MCP clients (Claude/ChatGPT)      │
│  Later: inbound voice · customer WhatsApp                                 │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L2  CHANNEL ADAPTERS (ingress/egress, per-platform rules)               │
│  Built: Baileys (agency self-chat only) · Instagram Graph API ·          │
│         ManyChat · property pages · ElevenLabs+Exotel (outbound calls)   │
│  Plan:  WhatsApp Business Cloud API (39) · portal leads · website chat   │
│  → lead adapters normalise to LeadInput → ingestLead()                   │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L3  EVENT BACKBONE                                                      │
│  Built: EventBridge default bus (lead.created, lead.qualified,           │
│         message.received, meeting.completed) · SQS (call recordings)    │
│         · scheduled crons                                                │
│  Plan:  per-tenant work queues where volume needs them                   │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L4  AGENT RUNTIME (reasoning)                                           │
│  Built: in-house pipeline classify → plan → execute → compose on Lambda  │
│         · model gateway (Gemini adapter) · optional bounded tool loop    │
│         · qualifier / router handlers · follow-up call jobs              │
│  Considered, not adopted: Strands agents, Bedrock AgentCore Runtime      │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L5  TOOL / MCP LAYER                                                    │
│  Built: one tool registry (72 tools, 9 categories) run in-process ·      │
│         POST /api/crm/agent/tool · one MCP server (services/reality-     │
│         flow-mcp) generated from the registry                            │
│  Considered, not adopted: 11 domain MCP servers via AgentCore Gateway    │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L6  DOMAIN SERVICES (system of record)                                  │
│  Express/Lambda modules: leads, contacts, properties, meetings, khata,   │
│  subscriptions, credits, notifications, enquiries, lead ingestion        │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L7  DATA & KNOWLEDGE                                                    │
│  Built: DynamoDB (single-table CRM + service tables, PITR) · DynamoDB     │
│         vector search + Titan v2 embeddings · S3 · Secrets Manager/SSM   │
│  Parked: Postgres as a reporting store fed from DynamoDB (27)           │
│  Not adopted: Redis/Valkey, Bedrock Knowledge Bases, OpenSearch          │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  L8  PLATFORM (cross-cutting)                                            │
│  Built: Cognito auth service · credits ledger + metering · agent audit   │
│         · CloudWatch metrics · CFN + infra/cicd deploy wrappers          │
│  Plan:  MANAGER role + lead scoping · CRM audit · LLM tracing · CI deploy│
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. The Event Backbone

**Built today:**

```
Lead adapters (ManyChat, Instagram service, property pages)
   → ingestLead(): dedupe (DynamoDB lookup) → createLead → notify → lead.created
   → LeadQualifierFunction → lead.qualified → LeadRouterFunction (assignment)
   → followup-agent-service call jobs / daily lead-followup cron (draft | autosend)

Agency WhatsApp (Baileys, ECS Fargate) → EventBridge message.received
   → WhatsAppProcessorFunction → agent runtime (only self-chat / fromMe is processed)
   → reply to the agency owner

Call recording → SQS → Transcribe → Gemini → suggested actions awaiting approval
```

Dedupe and idempotency use DynamoDB (`WebhookLog`, the lookup in `apps/crm/server/leadIngestion.js`), not Redis. WhatsApp conversation state is stored as rows in the CRM table (`apps/crm/server/whatsappConversationService.js`, `conversationStateService.js`).

**Target for customer conversations (Phase C):** every inbound customer message (official WhatsApp Cloud API, Instagram DM, website chat) is normalised, deduped, attached to a resolved Contact and thread, classified, and handed to the right agent; the reply goes out through the channel's egress rules (24h window, templates); outcomes are emitted as domain events. Adding a new channel means a new L2 adapter only.

**Human-in-the-loop:** an agent emits an approval request, the action waits in an inbox until a human approves or it times out safely. **Today** approvals exist only for Call Intelligence actions (`apps/crm/server/routes/callRecordings.js`) and the follow-up cron's `draft` mode (`apps/crm/server/routes/aiEmployeeConfig.js`); the chat agent has no approval inbox yet.

## 4. Where Each Vision Engine Lives

| Engine | Layer(s) | Built today | Doc |
|---|---|---|---|
| Lead acquisition | L2 adapters + L3 | ManyChat, Instagram (dev), property pages → `ingestLead()` | `08` |
| Lead qualification | L4 handler | `lead-qualifier-handler.js` (Hot/Warm/Cold) | `09` |
| Lead scoring | L4 | Part of the qualifier | `10` |
| Lead assignment | L4 handler + L6 | `lead-router-handler.js` via agent runtime | `11` |
| AI sales assistant | L4 + L5 | Agency-facing agent only; customer-facing not built | `09`, `14` |
| Follow-up automation | L3 crons + follow-up service | Lead-followup cron + AI follow-up calls | `09` |
| AI voice | L2 + voice service | Outbound (ElevenLabs + Exotel); inbound later | `12` |
| Social publishing | L2 | Not built (after Meta App Review); tenant marketing agent dropped | `13` |
| Portal lead ingestion | L2 adapter | Not built; browser posting dropped | `07` |
| Knowledge & RAG | L7 + L5 | DynamoDB vector search (property + policies) | `14` |
| Future 3D property experience | L1 + L7 media | Design only | §9 |

> Lead scoring and assignment are built as above. The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

## 5. Compute & Runtime Strategy

- **Lambda** for the domain API, webhooks, event handlers and the agent runtime. **ECS Fargate** only where a long-lived connection is needed (Baileys sessions in `services/whatsapp-platform`).
- **Agent runtime** is the in-house pipeline in `apps/crm/server/agents/` (see `04`). It is the direction. **Considered, not adopted:** Strands Agents on Lambda/Fargate and Bedrock AgentCore Runtime; revisit only if long-running voice or stateful agents need managed sessions. **EKS is not recommended** for this team (`16`).
- **Event/queue:** EventBridge for domain events, SQS where work needs retries/DLQs (call recordings), scheduled EventBridge rules for crons. Step Functions for multi-day journeys are a Phase C option, not built.

## 6. Model Strategy

**As built:**

| Job | Model | Where |
|---|---|---|
| Domain classification (after a rules fast-path) | `GEMINI_CLASSIFIER_MODEL` (CFN default `gemini-3.1-flash-lite`) | `apps/crm/server/agents/domainRouter.js` |
| Planning, tool loop, reply composition | `GEMINI_MODEL` (CFN default `gemini-3.8-flash`) | `agents/llm/planTurn.js`, `runToolLoop.js`, `composeReply.js` |
| Instagram lead analysis | Gemini, with a deterministic `rules` fallback (`LLM_PROVIDER`) | `apps/instagram/backend_insta_sol_ms/services/leadAnalyst.js` |
| Voice conversation | ElevenLabs Conversational AI | `services/ai-calling-service` |
| Embeddings | `amazon.titan-embed-text-v2:0`, 1024 dims (Bedrock) | `apps/crm/server/services/embeddings/embeddingService.js` |

- **Model gateway** (`agents/modelGateway/index.js`) is the seam: Gemini is the one adapter today; another provider is added there without changing the runtime. The CFN `LlmProvider` parameter reaches the Lambda as `LLM_PROVIDER` but the CRM agent code does not read it yet.
- **Bedrock** works in the dev account as of 17 Sep 2026 (Titan v2 embeddings and Claude Haiku 4.5 `invoke-model` succeeded in ap-south-1), so a Bedrock adapter is now possible. Prod account not re-tested.
- **Caching:** prompts are too small for Gemini explicit caching; planner prompts keep a stable prefix so implicit caching hits (`agents/llm/plannerPrompt.caching.test.js`).
- **Considered, not adopted (June plan):** Claude Haiku 4.5 for routing and Claude Sonnet for conversation on Bedrock, Nova Lite/Micro for bulk classification, 1-hour prompt caching of a tenant catalog.

## 7. Data Architecture

- **Operational data:** DynamoDB single-table CRM plus service tables (18 tables in `apps/crm/server/infra/cfn-backend.yaml`, 6 in `launch-tables-cfn.yaml`, all PITR). The scan inefficiency `TODO(MED-1)` in `apps/crm/server/crmDynamodbService.js` is still open; note `tenant-index` exists only on the UserCategories table today.
- **Conversation store:** WhatsApp messages and conversation state are rows in the CRM table under the tenant key. The June design's separate `Conversations`/`Messages` tables were not built; revisit when customer conversations arrive (Phase C).
- **Reporting:** Postgres/Aurora is **parked** as a possible future reporting store fed from DynamoDB, no date (`27`). Docs `25`/`26` are archived.
- **Vector/knowledge:** DynamoDB vector search indexes, tenant id as the required search partition: `property-vector-index` on the CRM table, `knowledge-vector-index` on `KnowledgeChunksTable` (`apps/crm/server/infra/create-vector-index.mjs`, `services/embeddings/vectorSearchService.js`). **Considered, not adopted:** Bedrock Knowledge Bases, S3 Vectors, pgvector, OpenSearch Serverless.

## 8. Cross-Cutting Platform

- **Identity & RBAC (`15`):** auth model roles ADMIN/MEMBER; server also checks FOUNDER/OWNER/MANAGER. Plan: ADMIN/MEMBER for M1, then MANAGER + "members see only their own leads" before selling Team plans. Service-to-service calls use `x-api-key` and HS256 service JWTs (e.g. the MCP server's `mcp-agent` identity); **Cognito M2M is not implemented**.
- **Secrets (`15`):** Secrets Manager and SSM SecureStrings; NoEcho CFN parameters. Leaked keys (Exotel, ElevenLabs, Gemini, Baileys, CRM API key) remain in git history with rotation **unconfirmed**: rotate, no history rewrite, add gitleaks to CI.
- **Observability:** CloudWatch logs and metrics (`apps/crm/server/observability/`), agent actions in `AgentAuditTable`. Not built: LLM tracing/eval tooling, CRM mutation audit, API Gateway access logs.
- **Billing/metering (`17`, `30`):** built — credits ledger, per-agent-action charges with refunds (`agentRuntime.js`), metering helpers on CRM write routes (`middleware/meterCredits.js`), per-minute AI call billing, Razorpay credit packs, monthly reset. Pricing: current pre-launch pricing is in `marketing-and-sales/launch-plan-v2/pricing.json` and CRM `apps/crm/real-estate-crm-app/src/lib/plans.ts`, which disagree on Team+; being replaced by the proposal in `38`.
- **IaC/CI-CD (`16`):** 17 CloudFormation templates, each service deployed manually via `infra/cicd/<service>/deploy.sh` with build tracking. Plan: GitHub Actions deploy to dev later. Before paid launch: API Gateway throttling, access logs, CORS fix; WAF after first customers.

## 9. Future Property Experience (design only — do not implement)

A premium, later tier: **3D tours / virtual walkthroughs / Gaussian-splatting** captures. Capture (phone/360 rig) → processing (third-party service or batch GPU job) → artifacts in **S3**, served via **CloudFront**, embedded in property pages (`apps/property-pages-ms`) and shareable in WhatsApp/IG. Stored as a `PropertyExperience` asset linked to the Property; gated by plan/credits. No vendor commitment; keep it out of the critical path.

## 10. Reference Request Lifecycles

**(a) Agency command via WhatsApp — built:**
`Owner messages their own linked number "aaj ke hot leads bhejo" → Baileys → EventBridge message.received → WhatsAppProcessorFunction → classify → plan one tool call (or bounded tool loop) → tool registry query (tenant-scoped) → compose WhatsApp-sized reply → agent audit row.`

**(b) New lead from Instagram or a property page — built:**
`Adapter → ingestLead (dedupe, createLead, notify) → lead.created → qualifier (Hot/Warm/Cold) → lead.qualified → router assigns → optional AI follow-up call job → escalation to a human if not reached.`

**(c) New customer WhatsApp lead → qualified → visit booked — target (Phase C, official Cloud API, `39`):**
`Cloud API webhook → normalise + dedupe → resolve Contact → agent answers grounded from property/knowledge tools (draft for human approval first) → ingestLead → qualify → assign → meeting created → confirmation inside the 24h window.`

**(d) Follow-up journey — target:**
`Journey per lead waits/branches on engagement → each step composes a grounded message → sent on the official WhatsApp API (template rules) or as an outbound call → responses re-enter the backbone.`

## 11. What This Architecture Deliberately Avoids

- A second CRM or a data rewrite (we wrap, not replace).
- Kubernetes/EKS for a small team (`16`).
- One mega-agent with no domain boundaries: the classifier scopes each turn to the domains it needs, so the planner sees a small tool set.
- Splitting the MCP layer before there is a reason: one server with categories and OAuth scopes; split only if clients struggle (`05`).
- Per-token customer billing (`17`, `38`).
- Synchronous long chains across services.
- Deleting CRM data (archive instead).
- Lock-in at the reasoning layer: the model gateway keeps providers swappable.
- Unofficial WhatsApp for customer messaging: Baileys stays for the agency's own command channel only.

---

**In one sentence:** the existing serverless CRM already carries an event backbone, an in-house agent runtime and one tool/MCP layer; the next steps are hardening for launch, then customer channels on official APIs, without replacing what works.
