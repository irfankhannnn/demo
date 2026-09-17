# 20 — Technology Decisions (Decision Record)

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Rewritten from June "planned choices" into a record of what was adopted (as built) and what was considered and not adopted (Strands, AgentCore, Bedrock Knowledge Bases, Aurora, Chatwoot, 11 MCP servers, Lago).

> **Scope:** the load-bearing technology choices. Each record states the decision as built, the evidence in the repo, and the options that were considered and not adopted. Vendor prices in the June research were partly taken from pages that blocked automated fetch; reconfirm any price on the live vendor page before a financial commitment.

**Status values:** **Adopted** (in code) · **Direction** (decided, not built yet) · **Parked** (kept as an option, no date) · **Dropped** (will not be built).

---

### ADR-01 — Evolve the serverless core, no rewrite
**Status:** Adopted.
**Decision:** keep the Lambda + DynamoDB + Cognito CRM and grow around it (`18-migration-strategy.md`). DynamoDB stays the only source of truth; no design deletes CRM data.
**Evidence:** `agency-app/api/`, `agency-app/api/infra/cfn-backend.yaml`.
**Considered, not adopted:** a rewrite; moving the CRM to Postgres.

### ADR-02 — Agent runtime: in-house pipeline behind a model gateway (D7)
**Status:** Adopted.
**Decision:** a Node.js agent core: classify → plan → execute tools → compose, with an optional bounded multi-step tool loop (6-step cap, `AGENT_TOOL_LOOP_ENABLED`). One core serves the WhatsApp command channel and the in-CRM web chat. Off unless `AGENTS_ENABLED=true`. This is the direction; it is broader than the June plan because the same tool registry also feeds the MCP server.
**Evidence:** `agency-app/api/agents/agentRuntime.js`, `agents/llm/runToolLoop.js`, `agents/channels/webChannel.js`, `agency-app/api/routes/agentChat.js`; design `docs/proposals/agent-channel-architecture/`.
**Considered, not adopted:** Strands Agents SDK; Amazon Bedrock AgentCore (Runtime, Memory, Identity, Gateway); LangGraph; OpenAI Agents SDK. Revisit a framework only if a flow needs long-lived memory the core cannot hold.

### ADR-03 — Simple before agentic (T0/T1 before T2)
**Status:** Adopted.
**Decision:** single LLM calls and bounded tool loops for most work; a rules fast-path skips the classifier call when it can. Per-flow orchestration modes are in `docs/proposals/agent-channel-architecture/04-orchestration-patterns.md`.
**Evidence:** `agency-app/api/agents/domainRouter.js`, `scripts/lead-qualifier-handler.js`.

### ADR-04 — Models: Gemini Flash by default, pluggable via the gateway
**Status:** Adopted.
**Decision:** Gemini Flash for planning and replies and a lighter Flash model for classification (`GeminiModel` / `GeminiClassifierModel` parameters in `agency-app/api/infra/cfn-backend.yaml`). Gemini also powers the lead qualifier rubric, Call Intelligence and the Instagram lead analyst. Embeddings are Amazon Titan Text Embeddings v2 (1024 dimensions) on Bedrock. A second provider is added as a gateway adapter only when cost or quality data justifies it.
**Evidence:** `agency-app/api/agents/modelGateway/index.js`, `agency-app/api/utils/leadRubric.js`, `agency-app/api/services/callIntelligence/`, `agency-app/instagram-api/config/env.js`, `agency-app/api/services/embeddings/embeddingService.js`.
**Bedrock note (D12):** on 17 Sep 2026 `amazon.titan-embed-text-v2:0` and `global.anthropic.claude-haiku-4-5-20251001-v1:0` both invoked successfully in the dev account (ap-south-1). The earlier block (`docs/agency-app/ai-calling/AWS-CASE-178749035000906-BEDROCK-REPLY.md`) is resolved for dev; the prod account is not re-tested.
**Considered, not adopted:** Claude Haiku/Sonnet as the default models; Amazon Nova as a cost floor.

### ADR-05 — One MCP server (D10)
**Status:** Adopted.
**Decision:** a single MCP service exposing 72 CRM tools generated from the canonical registry that the WhatsApp agent and CRM backend also use. Express + MCP SDK on Lambda, Streamable HTTP, its own OAuth, calling the CRM backend over HTTP. Split only if clients struggle with one server.
**Evidence:** `platform/mcp/`, `platform/mcp/src/services/generatedToolDefinitions.ts` (72 tools), `agency-app/api/shared/toolDefinitions.js`, `agency-app/api/scripts/generate-mcp-tools.mjs`. (`platform/mcp/README.md` still says 54.)
**Considered, not adopted:** 11 business-domain MCP servers generated through AgentCore Gateway.

### ADR-06 — Channels as adapters into one ingestion pipeline
**Status:** Adopted.
**Decision:** every lead source converts its payload to one `LeadInput` and calls `ingestLead()`, which de-duplicates, writes the lead and emits `lead.created`. Staff see WhatsApp conversations in the CRM and Instagram in its own console.
**Evidence:** `agency-app/api/leadIngestion.js`, `docs/lead-adapter-architecture.md`, `agency-app/api/routes/whatsappConversations.js`, `agency-app/instagram-web/`.
**Considered, not adopted:** Chatwoot Community as the channel layer and shared inbox (**dropped**, D9); a commercial omnichannel inbox.

### ADR-07 — WhatsApp: Baileys today, official Cloud API for customers (D9)
**Status:** Adopted (Baileys, agency command channel) · Direction (Cloud API for customer messaging).
**Decision:** today `platform/whatsapp-platform/` runs Baileys on ECS Fargate, and the CRM acts only on the agency's own self-chat or whitelisted admin senders (`agency-app/api/routes/webhooks.js`). Customer messaging moves to the WhatsApp Business Cloud API, possibly with AiSensy as BSP. Plan: `39-whatsapp-official-api-plan.md`.
**Why:** Baileys is an unofficial client; a banned number is the likely failure (`19` R4).
**Considered, not adopted:** Baileys for customer messaging; Embedded Signup through a BSP as the only path (folded into doc 39).

### ADR-08 — Voice: ElevenLabs agents + native Exotel integration
**Status:** Adopted (outbound) · Direction (inbound later).
**Decision:** ElevenLabs agents place and bridge calls through their native Exotel integration, with mid-call CRM tools and semantic property search. Follow-up calls are scheduled, retried and escalated by a separate service. Outbound only at launch; consent captured at intake; DLT registration before bulk calls (D16). Inbound AI voice is Phase C (D14). Calls always go through licensed Indian telephony.
**Evidence:** `agency-app/ai-calling/`, `agency-app/followup-agent/`.
**Considered, not adopted:** self-hosted Pipecat or LiveKit with Nova Sonic.

### ADR-09 — Knowledge: DynamoDB vector search + Titan v2 (D12)
**Status:** Adopted.
**Decision:** vector indexes on DynamoDB (`property-vector-index` on the CRM table, `knowledge-vector-index` on the knowledge table), Titan v2 embeddings, tenant id as the index partition key. A weak match returns nothing rather than a wrong policy. Indexes are created by script because CloudFormation has no schema for them.
**Evidence:** `agency-app/api/infra/create-vector-index.sh`, `KnowledgeChunksTable` in `cfn-backend.yaml`, `agency-app/api/services/knowledge/`, `agency-app/api/services/embeddings/`.
**Considered, not adopted:** Bedrock Knowledge Bases on S3 Vectors; OpenSearch Serverless; pgvector.

### ADR-10 — Compute and data: Lambda + Fargate, DynamoDB only
**Status:** Adopted · Postgres **Parked** (D8).
**Decision:** Lambda for APIs, workers and crons; ECS Fargate only where a long-lived process is needed (Baileys). No EKS. DynamoDB is the only data store. Postgres/Aurora is parked as a possible future reporting store fed from DynamoDB, with no date (`27-phase-2-postgres-analytics-agent-tables.md`; `25` and `26` archived).
**Evidence:** `agency-app/api/infra/cfn-backend.yaml`, `platform/whatsapp-platform/infra/`.
**Considered, not adopted:** Aurora Serverless v2 reporting projection with RDS Proxy; Drizzle or Knex ORM; dual-write; EKS.

### ADR-11 — Identity: Cognito auth service, simple roles for M1
**Status:** Adopted · Direction (MANAGER role).
**Decision:** `platform/auth/` on Cognito with Google sign-in and phone OTP. Roles ADMIN/MEMBER for M1; MANAGER and "members see only their own leads" before selling Team plans (D15). Services authenticate with API keys or service JWTs (`agency-app/api/middleware/apiKeyAuth.js`); MCP clients use the MCP server's own OAuth.
**Considered, not adopted:** Cognito M2M clients for agent identities; region/team scoping for M1; Clerk or WorkOS.

### ADR-12 — Billing: credits on a DynamoDB ledger, Razorpay collection
**Status:** Adopted · pricing under re-plan.
**Decision:** "humans work for free, AI costs credits", 1 credit = ₹1; atomic ledger with HTTP 402 on a short balance; Razorpay subscriptions plus one-time Orders for credit packs. Current pre-launch pricing (`marketing-and-sales/launch-plan-v2/pricing.json` and `agency-app/web/src/lib/plans.ts`, which disagree on Team+) is being replaced by the proposal in `38-pricing-plan-contacts-and-credits.md`. Details: `17-cost-and-billing-architecture.md`.
**Evidence:** `agency-app/api/creditService.js`, `creditConfig.js`, `middleware/meterCredits.js`, `razorpayOrders.js`, `routes/billing.js`.
**Considered, not adopted:** Lago (self-hosted meter); Stripe Billing + Meters; OpenMeter; per-token billing.

### ADR-13 — Portal automation
**Status:** Dropped (browser posting) · Direction (lead ingestion).
**Decision:** no posting to portals by browser automation (account-block risk, D14). Portal leads come in as new adapters on the ingestion pipeline (Phase C).
**Considered, not adopted:** AgentCore Browser Tool; Playwright workers on Fargate; Steel.dev.

### ADR-14 — Event backbone: EventBridge + SQS
**Status:** Adopted.
**Decision:** EventBridge for domain events (`lead.created`, `lead.qualified`, `call.ended`, `meeting.completed`), SQS for work queues (call recordings, follow-up DLQ), scheduled Lambdas for crons, DynamoDB idempotency log for dedup.
**Evidence:** `agency-app/api/infra/cfn-backend.yaml`, `agency-app/followup-agent/infra/cfn-followup.yaml`, `agency-app/api/webhookLogService.js`.
**Considered, not adopted:** Step Functions for follow-up journeys; Redis/Valkey for cache, rate limits and dedup.

### ADR-15 — Observability
**Status:** Adopted (partial).
**Decision:** CloudWatch metrics (`agency-app/api/observability/cloudwatch.js`), Sentry and PostHog in the CRM server, agent action audit in `AgentAuditTable` (`agency-app/api/agents/agentAuditService.js`), Gemini call tracking. Gaps: no CRM mutation audit; audit rows expire by TTL instead of being archived (D17).
**Considered, not adopted:** OpenTelemetry/ADOT; Langfuse; AgentCore Observability.

### ADR-16 — Infrastructure as code and deploys
**Status:** Adopted · Direction (CI deploy to dev).
**Decision:** CloudFormation only. Deploys are manual through `infra/cicd/<service>/deploy.sh` wrappers with build tracking, rollback and config-only deploys, into separate dev and prod AWS accounts (D19). GitHub Actions runs tests today (`.github/workflows/server-tests.yml`, `insta-sol-ms-tests.yml`, `playwright.yml`, `pr-intelligence.yml`); a GitHub Actions deploy to dev comes later.
**Considered, not adopted:** Terraform, CDK, SAM; a full CD pipeline with approvals before launch.

### ADR-17 — Email
**Status:** Adopted.
**Decision:** Amazon SES first, Brevo as fallback (`agency-app/api/emailService.js`).

### ADR-18 — Mobile
**Status:** Adopted (store launch pending).
**Decision:** Capacitor 8 wrapper of the CRM app with Android and iOS projects (`agency-app/web/capacitor.config.ts`, `android/`, `ios/`). Store submission steps: `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`.

---

## Decisions at a Glance

| Area | Adopted (as built) | Considered, not adopted |
|---|---|---|
| Core | Serverless CRM, evolved in place | Rewrite |
| Agent runtime | In-house pipeline + bounded tool loop | Strands, AgentCore, LangGraph |
| Models | Gemini Flash via model gateway; Titan v2 embeddings | Claude Haiku/Sonnet default, Nova |
| Tools | One MCP server, 72 generated tools | 11 domain MCP servers via AgentCore Gateway |
| Channels | Adapters into `ingestLead()` | Chatwoot (dropped) |
| WhatsApp | Baileys for agency command channel; Cloud API for customers (direction, doc 39) | Baileys for customer messaging |
| Voice | ElevenLabs + native Exotel, outbound | Pipecat/LiveKit + Nova Sonic |
| Knowledge | DynamoDB vector search | Bedrock Knowledge Bases + S3 Vectors, OpenSearch |
| Data | DynamoDB only; Postgres parked | Aurora + RDS Proxy reporting projection |
| Identity | Cognito, ADMIN/MEMBER (MANAGER next) | Cognito M2M, region scoping for M1 |
| Billing | DynamoDB credit ledger + Razorpay; pricing re-plan in doc 38 | Lago, Stripe Meters, OpenMeter |
| Events | EventBridge + SQS | Step Functions, Redis |
| Observability | CloudWatch, Sentry, PostHog, agent audit table | OpenTelemetry, Langfuse |
| Portal automation | Lead ingestion adapters (Phase C) | Browser posting (dropped) |
| Deploys | CloudFormation + manual `infra/cicd` wrappers | Automated CD before launch |
