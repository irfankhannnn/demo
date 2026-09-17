# 01 — Current-State Analysis

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Rewritten as a September 2026 current-state analysis; the June 2026 snapshot (branch `auth_rbac_feature` @ `8079683`) is in git history.

This document describes **what exists in the code today**, with repo paths, and is honest about gaps. The vision (`02`) and target architecture (`03`+) build on it. RealEstateFlow is **pre-launch with zero customers**.

---

## 1. Executive Summary

RealEstateFlow (old name RealtyFlow; legacy repo name "Cloudberry Real Estate") is a **multi-tenant real-estate CRM SaaS on AWS serverless (ap-south-1)**. Since June 2026 most of the AI pieces the vision needs have been built, several of them on dev only:

1. **CRM platform** — React/TS SPA + Express-on-Lambda + DynamoDB, ~270 mounted endpoints in 42 route files, Cognito auth, 2-tier RBAC, KYC documents, khata, Razorpay billing, credits. **The mature core.**
2. **Agent runtime** — an in-house pipeline (classify → plan → execute → compose) behind a model gateway, Gemini as the one adapter today, used from the agency's WhatsApp command channel and CRM web chat. Off unless `AGENTS_ENABLED=true`.
3. **Lead pipeline** — one ingestion point for all adapters (ManyChat, Instagram), EventBridge lead qualification (Hot/Warm/Cold) and routing, a daily follow-up cron.
4. **Instagram service** — hosted, one Meta app, DMs + comments + insights + CRM hand-off. On dev; Meta App Review pending.
5. **AI voice** — outbound calls via ElevenLabs + Exotel, a follow-up call scheduler, and Call Intelligence on recordings.
6. **MCP server** — one server, 72 tools, own OAuth 2.1, for Claude/ChatGPT.
7. **Knowledge** — DynamoDB vector search with Titan v2 embeddings for property matching and agency policies.
8. **Internal marketing tooling** — agent personas, skills and MCPs used by the founder via Claude. Not a tenant feature.

**Main gaps:** customer-facing WhatsApp (today WhatsApp only carries the agency owner's own commands), team roles and lead scoping, cursor pagination, a CRM mutation audit log, grace-period enforcement, API Gateway throttling/logs, E2E tests in CI, and production deploys of the newer services.

## 2. System Inventory

| Subsystem | Path | State | Direction |
|---|---|---|---|
| CRM SPA | `agency-app/web/` | Mature (63 page files, 68 component files) | Keep and extend |
| CRM backend API | `agency-app/api/` | Mature (42 route files, ~270 mounted endpoints) | Keep; fix access patterns |
| Auth microservice | `platform/auth/` | Mature (Cognito, phone OTP, Google, invites) | Keep; add MANAGER role |
| Onboarding tool | `apps/onboarding/` | Local tool, still used | Keep as internal tool |
| Agent runtime | `agency-app/api/agents/` | Built, flag-gated | Direction for all agents (`04`) |
| Tool registry | `agency-app/api/shared/toolDefinitions.js`, `agency-app/api/skillInvoker.js` | Built (72 tools) | Single source for agent + MCP tools |
| Lead ingestion | `agency-app/api/leadIngestion.js` (`POST /api/internal/adapters/leads`) | Built (ManyChat, Instagram) | Add portal and WhatsApp adapters |
| Instagram service | `apps/instagram/{backend,frontend}_insta_sol_ms/` | Built, dev only | Prod after Meta App Review |
| WhatsApp platform | `platform/whatsapp-platform/` | Built (Baileys on ECS Fargate) | Agency command channel only; customer messaging moves to official API (`39`) |
| AI calling | `agency-app/ai-calling/` | Built, routes mounted in CRM | Outbound at launch |
| Follow-up calls | `agency-app/followup-agent/` | Built | Keep |
| MCP server | `platform/mcp/` | Built (72 tools) | Keep one server (`05`) |
| Property pages | `public-app/property-pages/` | Built | Keep |
| Landing pages | `agency-app/landing-pages/` | Built | Keep; fix stale claims |
| Mobile app | `agency-app/web/` (Capacitor, `android/`, `ios/`) | Store launch in prep | Keep |
| Skill references | `tools/openclaw_workspace_reference/skills/*` | Reference only (6 skills) | Rules live on in the tool registry |
| Internal marketing tooling | `tools/claude-skills/`, `marketing-and-sales/` | Founder tooling | Stays internal |
| Video projects | `marketing-and-sales/video-projects/` (Remotion `my-video`, HyperFrames `realestateflow-launch`) | Founder tooling | Internal |
| Crons | `agency-app/api/scripts/*-cron.js` | 8 scheduled rules in the backend stack | Wire grace-period expiry (not scheduled) |
| Tests | `tests/playwright/` (31 specs), jest in `agency-app/api` | Jest in CI; Playwright not in CI | Run E2E in CI |

## 3. CRM Core

### 3.1 Backend (`agency-app/api/`)
- **Runtime:** Express, dual-mode: local (`server.js`) and Lambda via `@vendia/serverless-express` (`lambda-handler.js`), `nodejs20.x`, 512 MB default.
- **API Gateway REST APIs** on `services-api.cloudberrysolutions.in`, explicit route templates in `agency-app/api/infra/apigw-explicit-routes*.yaml`.
- **Middleware:** CORS allowlist → request id → logging → billing webhook (raw body) → body parsers → in-memory rate limiter (per Lambda instance) → security headers → per-route `validateToken` → `extractTenantId` → error handler.
- **Mounted route groups** (`server.js`): crm, contacts, leads, buyers, enquiries, khata, notifications, billing, subscriptions, feedback, auth, agent, agent-chat, agents, config, whatsapp, ai-employee, internal adapters, internal followups, public-pages (internal + settings), ai-calling internal, ai-integrations, call-recordings, ai-calling, calls, agency-policies, followups, credit-config, admin.
- **Not mounted:** developers, projects, realEstateAreas, buildings/flats, areas (`docs/agency-app/api/DISABLED_FEATURES.md`).

### 3.2 Data model
- **Lead** (buyer/seller/tenant/owner; status new → contacted → qualified → negotiating → converted → lost; source; requirement sub-objects; Hot/Warm/Cold score) → converts to **Buyer** (`purchases[]`), **Tenant/Customer** (`currentRental`, `rentalHistory[]`), **Owner**, and a unified multi-role **Contact**.
- **Property** with lifecycle status and sale/rental info; a `descriptionVector` for semantic search.
- KYC document keys with presigned-URL retrieval.
- WhatsApp conversations and state are rows in the CRM table (`agency-app/api/whatsappConversationService.js`, `conversationStateService.js`), not separate tables.

### 3.3 Frontend (`agency-app/web/`)
- React 18 + TypeScript 5 + Vite 5 + Tailwind 3, React Router 7, Context API. PostHog + Sentry. Google Maps.
- Capacitor 8 app `in.realestateflow.app` with `android/` and `ios/` projects; store launch tasks in `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`.
- Instagram console served at `/insta/*` from `agency-app/instagram-web`.

### 3.4 Auth and RBAC
- Cognito-based auth microservice: phone OTP (custom auth challenge Lambdas + SNS), Google OAuth, PKCE, refresh token in httpOnly cookie, member multi-identity.
- `tenantId` is server-derived; `extractTenantId` rejects a client-supplied tenant when authenticated.
- **Roles:** the auth model has only `'ADMIN' | 'MEMBER'` (`platform/auth/src/models/usersModel.ts`). The server also accepts FOUNDER/OWNER/MANAGER (`agency-app/api/middleware/requireRole.js`) and PLATFORM_OPERATOR/SUPER_ADMIN for credit admin only (`requirePlatformOperator.js`).
- Most mounted DELETE routes are guarded; `routes/aiIntegrations.js` (`DELETE /:clientId`) and `routes/notifications.js` (`DELETE /devices/:token`) are not.
- **No team/region/assigned-lead scoping** (`assignedTo` is only a filter). Plan: MANAGER role + "members see only their own leads" before selling Team plans (`00` §4).

### 3.5 Billing and credits
- **Razorpay subscriptions** with HMAC-verified, idempotent webhooks (`WebhookLog` table). Cancel/halt update the DB; `payment.failed` starts a 7-day grace; `subscription.charged` does not clear grace; the grace-expiry script is not scheduled (`00` §1).
- **Pricing:** current pre-launch pricing is in `marketing-and-sales/launch-plan-v2/pricing.json` and CRM `agency-app/web/src/lib/plans.ts`, which disagree on Team+. It is being replaced by the proposal in `38-pricing-plan-contacts-and-credits.md` (Proposed).
- **Credits:** `CreditsTable` with ledger and `CreditConfigTable` (`agency-app/api/creditService.js`), metering on CRM write routes (`middleware/meterCredits.js`) and per agent action (`agents/agentRuntime.js`), Razorpay credit-pack orders (`razorpayOrders.js`), per-minute AI call billing (`aiCallBilling.js`), monthly reset cron. Detail: `30`.

### 3.6 Integrations in use
Brevo (email), Razorpay, PostHog, Sentry, hCaptcha, Google Maps, **Gemini** (agent runtime, Instagram lead analyst), **Amazon Bedrock Titan v2 embeddings**, **DynamoDB vector search**, **Amazon Transcribe** (Call Intelligence), **ElevenLabs + Exotel** (voice), **Baileys** (self-hosted WhatsApp), **Instagram Graph API**, **ManyChat** (lead adapter), **AiSensy** (only the AI Employee onboarding broadcast in `routes/billing.js`). Founder-side MCPs in `.mcp.json`: higgsfield, meta-ads, blotato, nabi-crm, git.

**Bedrock:** on 17 Sep 2026 Bedrock `invoke-model` succeeded in the dev account (ap-south-1) for `amazon.titan-embed-text-v2:0` and Claude Haiku 4.5. The earlier access block (`docs/agency-app/ai-calling/AWS-CASE-178749035000906-BEDROCK-REPLY.md`) is resolved for dev; the prod account has not been re-tested.

## 4. Agent Runtime and Channels

- **Pipeline** (`agency-app/api/agents/agentRuntime.js`): classify (rules fast-path, then `GEMINI_CLASSIFIER_MODEL`) → plan (one scoped tool call, or chat/clarify) → execute through the in-process tool registry (`skillInvoker.js`) → compose a channel-shaped reply.
- **Model gateway** (`agents/modelGateway/index.js`): `classify`/`plan`/`planAndRun`/`compose` seam. Gemini is the one adapter today; a new provider plugs in here without changing the runtime. The CFN `LlmProvider` parameter is passed as `LLM_PROVIDER` but the agent code does not read it yet.
- **Tool loop:** optional bounded multi-step loop (`llm/runToolLoop.js`) behind `AGENT_TOOL_LOOP_ENABLED` (default off).
- **Channels:** WhatsApp (Baileys → EventBridge `message.received` → `WhatsAppProcessorFunction`) and CRM web chat (`/api/crm/agent-chat`, `agents/channels/webChannel.js`).
- **WhatsApp is the agency owner's command line only.** The CRM webhook skips any message that is not self-chat/`fromMe` as `unauthorized_sender` (`agency-app/api/routes/webhooks.js`). Customer-facing WhatsApp is not built.
- **Audit and metrics:** `AgentAuditTable` (90-day TTL), CloudWatch metrics (`agency-app/api/observability/`). No LLM tracing.
- **Evals:** `agents/goldenConversations.test.js` checks the deterministic formatter; `agency-app/api/eval/whatsapp-tool-choice.eval.js` runs against live Gemini outside `npm test`.
- **AI Employee offer:** the runtime is always-on when enabled, but the add-on is still sold with a concierge setup, and the escalation cron remains.
- Design being implemented: `docs/proposals/agent-channel-architecture/`.

## 5. Lead Pipeline

```
adapter (ManyChat webhook | Instagram service crmBridge) → POST /api/internal/adapters/leads
property-page visit booking → POST /api/internal/public-pages/site-visits (siteVisitBooking.js)
  → ingestLead(): dedupe → createLead → notify → lead.created
  → LeadQualifierFunction (Hot/Warm/Cold) → lead.qualified
  → LeadRouterFunction (assignment via agent runtime)
  → follow-up: daily lead-followup cron (draft | autosend) and followup-agent-service call jobs
```

Paths: `agency-app/api/leadIngestion.js`, `scripts/lead-qualifier-handler.js`, `scripts/lead-router-handler.js`, `docs/lead-adapter-architecture.md`. Website and WhatsApp adapters are planned, not built.

> The founder is building a next-generation lead engine separately; these docs will be updated when it lands.

## 6. AI Voice

- `agency-app/ai-calling` places outbound calls through ElevenLabs' native Exotel integration; server tools pull live CRM data mid-call, and policy answers use the CRM's vector search. Own CFN stack, NoEcho parameters into Secrets Manager.
- `agency-app/followup-agent` schedules site-visit confirmation and post-visit feedback calls from `lead.created` / `meeting.completed`, with retries and escalation to humans.
- **Call Intelligence:** recording → SQS → Amazon Transcribe → Gemini → suggested actions that need human approval (`docs/CALL_INTELLIGENCE.md`, `routes/callRecordings.js`).

## 7. Instagram, Property Pages, MCP

- **Instagram** (`apps/instagram/`): one Meta app; agencies connect via Connect Instagram; DMs, comments with public reply and one private reply, reels, insights, lead scoring, CRM hand-off. Deployed on dev with sends in dry-run; prod not deployed; Meta App Review pending (`docs/pending-items/instagram-service-status.md`).
- **Property pages** (`public-app/property-pages/`): public tenant-branded listing pages; "Schedule a visit" creates a CRM lead + meeting.
- **MCP** (`platform/mcp/`): one Streamable HTTP server on Lambda with its own OAuth 2.1 (dynamic client registration + PKCE). 72 tools generated from the CRM registry, proxied to `POST /api/crm/agent/tool`. Agencies can connect Claude/ChatGPT today (`docs/MCP_AGENCY_GUIDE.md`). The service README still says 54 tools.

## 8. Knowledge / RAG

- DynamoDB vector search, tenant id as the required search partition: `property-vector-index` on the CRM table and `knowledge-vector-index` on `KnowledgeChunksTable` (`agency-app/api/infra/create-vector-index.mjs`).
- Embeddings: `amazon.titan-embed-text-v2:0`, 1024 dimensions (`services/embeddings/embeddingService.js`). One query path for every channel (`services/embeddings/vectorSearchService.js`).
- Agency policies: `agency-app/api/services/knowledge/*`. This replaced the Bedrock Knowledge Base path; uploaded files in the calling service are stored but not indexed.

## 9. Infrastructure and Deployment

- **CloudFormation only:** 17 templates across `apps/*/infra`, `services/*/infra`, `infra/cicd/common-infra`. 13 deploy wrappers `infra/cicd/<service>/deploy.sh` with build tracking. Deploys are manual.
- **DynamoDB:** 18 tables in `agency-app/api/infra/cfn-backend.yaml` + 6 in `launch-tables-cfn.yaml`, all with PITR and `DeletionPolicy: Retain`, plus per-service tables (Instagram, follow-up, WhatsApp platform, AI calling).
- **EventBridge (backend stack):** 11 rules — 8 schedules (credit reset, trial reminder, incomplete data, expiring agreements, team summary, AI Employee escalation, meeting reminder, lead follow-up) and 3 event rules (`lead.created`, `lead.qualified`, `message.received`). Other services add their own rules.
- **CI:** `playwright.yml` (E2E guard never matches), `server-tests.yml` (jest + MCP drift), `insta-sol-ms-tests.yml`, `pr-intelligence.yml`. No deploy workflow.
- **Frontends:** CloudFront stacks for the CRM SPA (`agency-app/web/infra/cfn-frontend.yaml`, served at `app.realestateflow.in` with the Instagram console at `/insta`) and the marketing site (`agency-app/landing-pages/infra/cfn-landing-pages.yaml`, apex `realestateflow.in`).

## 10. Security Posture

Good: CORS allowlist in the app, generic prod errors, security headers, auth rate limits, timing-safe API-key compare, structured logging, server-derived tenant, PITR on CRM tables, secrets via Secrets Manager/SSM.

Open:
- 🔴 **Leaked keys in git history** (Exotel, ElevenLabs, Gemini, Baileys, CRM API key). Rotation status unconfirmed. Plan: rotate, no history rewrite, add gitleaks to CI (`docs/security-key-rotation.md`).
- 🟠 In-memory rate limiter per Lambda instance; no API Gateway throttling or access logs.
- 🟠 API Gateway gateway responses still return CORS `*`.
- 🟠 No server-enforced read-only after grace.
- 🟠 RBAC too coarse for team plans; two mounted DELETE routes unguarded.
- 🟡 No WAF (planned after first customers). No CRM mutation audit.

## 11. Gaps vs. the Vision

| Capability | Today |
|---|---|
| WhatsApp — agency command channel | ✅ Built (Baileys + agent runtime) |
| WhatsApp — customer conversations / lead capture | ❌ Not built; plan is the official Cloud API (`39`) |
| Instagram DMs and comments | ✅ Built (dev; App Review pending) |
| Facebook Messenger, website chat widget, Meta Lead Ads | ❌ Not built |
| Telegram | Dropped |
| Unified lead ingestion | ✅ Built (ManyChat, Instagram, property pages) |
| Qualification / scoring / assignment | ✅ Built (event handlers) |
| AI sales assistant | ⚠️ Agency-facing agent built; customer-facing assistant not built |
| Follow-up automation | ✅ Text follow-up cron (draft/autosend) + AI follow-up calls |
| AI voice | ✅ Outbound built; inbound later |
| Knowledge / RAG | ✅ DynamoDB vector search (property + policies) |
| Portal lead ingestion | ❌ Not built (adapter planned) |
| Portal posting via browser automation | Dropped |
| Tenant social publishing | ❌ Not built (after Meta App Review) |
| Team RBAC and lead scoping | ❌ 2-tier only |
| Reporting beyond counts | ⚠️ Metrics endpoints over scans (MED-1) |
| AI observability | ⚠️ Agent audit + CloudWatch metrics; no LLM tracing |
| Usage metering | ✅ Credits ledger and packs |
| Automated deploys | ❌ Manual wrappers |

## 12. Strengths to Build On

1. **Tenant isolation** — `TENANT#` keys, server-derived tenant, tenant id required in every vector search.
2. **One tool registry** shared by the WhatsApp agent, CRM backend and MCP server.
3. **One lead ingestion point** that any new channel plugs into.
4. **Model gateway seam** that keeps models swappable to control cost.
5. **Idempotent webhook patterns** reused across billing, adapters and channels.
6. **Everything in CloudFormation** with tracked deploy wrappers.

**Bottom line:** the product is further along than the June plan assumed. The next work is launch hardening (`00`), not new platforms: close the billing, key and API-protection gaps for M1, then team scoping, pagination and audit, then growth channels on the official WhatsApp API.
