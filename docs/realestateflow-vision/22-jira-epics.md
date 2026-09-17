# 22 — Epics

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Every epic now carries a status with evidence, and the June Phase 0–4 grouping is re-baselined onto Phase A (M1 launch) → B (hardening) → C (growth). Epics for tools that were never adopted (Strands, AgentCore) and for work the founder dropped (tenant marketing engine, portal posting) are marked Dropped.

> **Scope:** the epic-level backlog. IDs keep the **REF** prefix so older notes still resolve. Stories: `23-jira-stories.md`. Phases: `21-roadmap.md`. These docs are the product-level map; day-to-day tracking lives in `docs/epics/` (the ZEE-* launch epics), `docs/proposals/agent-channel-architecture/` and `docs/pending-items/`.

**Status words:** **Done** · **Partly done** · **Not started** · **Dropped**. "Done differently" means the outcome exists but not with the tool the June epic named.

---

## 1. Epic Map

| Epic | Status | Phase |
|---|---|---|
| REF-E00 Security remediation & hardening | Partly done | A (WAF in B) |
| REF-E29 Payment enforcement | Partly done | A |
| REF-E01 Roles & tenant scoping | Partly done | B |
| REF-E02 Domain API & MCP foundation | Partly done (mostly done differently) | B (remainder) |
| REF-E03 CI, IaC & observability | Partly done | B |
| REF-E10 Conversation backbone | Done differently | — |
| REF-E11 Channel ingestion | Partly done | A/C |
| REF-E12 AI sales assistant | Partly done | C |
| REF-E13 Lead qualification | Done | — |
| REF-E14 Lead scoring | Done | — |
| REF-E15 Lead assignment | Partly done | — (next-generation engine, D11) |
| REF-E16 Metering & cost guards | Done differently | B (soft caps) |
| REF-E20 Follow-up automation | Partly done | C |
| REF-E21 Knowledge & RAG | Partly done | C (brochures) |
| REF-E22 AI voice | Partly done | C (inbound) |
| REF-E23 Social channels | Partly done (Instagram on dev) | A/C |
| REF-E24 Strands agent runtime | Dropped | — |
| REF-E30 AgentCore runtime adoption | Dropped | — |
| REF-E31 Tenant marketing engine | Dropped | — |
| REF-E32 Portal automation | Split: posting Dropped, ingestion Not started | C |
| REF-E33 Reporting & analytics | Partly done | Parked (Postgres) |
| REF-E34 Credit billing & packs | Partly done | A (pricing) |
| REF-E35 Consented outbound voice at scale | Partly done | A (consent) / B (DLT) |
| REF-E40 Mobile app | Done | A (store submission) |
| REF-E41 Multi-agent orchestration / LangGraph | Dropped | — |
| REF-E42 3D property experience pilots | Not started | — (not in A/B/C) |
| REF-E43 Partner / product MCP surface | Done | — |
| REF-E44 Autonomy expansion & continuous eval | Partly done | C |

> **REF-E04** ("PostgreSQL Migration Foundation") is referenced by the archived `24-implementation-plan.md` but was never defined here. It is **Dropped**: there is no DynamoDB → Postgres migration, and a reporting store is parked with no date (D8, `27-phase-2-postgres-analytics-agent-tables.md`).

---

## 2. Phase A — M1 Launch

### REF-E00 · Security remediation & hardening — **Partly done**
**Goal:** be safe enough to take money.
**Done:** the leaking `deploy-lambda.ps1` is deleted and the AI calling stack takes NoEcho parameters into Secrets Manager (`services/ai-calling-service/infra/cfn-ai-calling.yaml`, `src/config/secretsBootstrap.js`); env files untracked; SSM SecureString sync (`apps/crm/server/infra/sync-ssm-params.sh`); DynamoDB PITR on all CRM tables and S3 versioning (`apps/crm/server/infra/cfn-backend.yaml`); a CORS allowlist in Express (`apps/crm/server/server.js`).
**Not started:** confirmed rotation of the five leaked keys; gitleaks in CI; API Gateway throttling, access logs and the gateway-response CORS fix (responses still return `*`); WAF (Phase B, after first customers).
**Not doing:** git history purge — rotation is the fix, and the repo never force-pushes (D18).
**Refs:** `00-phase-0-prerequisites.md` §2 and §8, `19-risk-analysis.md` R1 and R8, `docs/security-key-rotation.md`.

### REF-E29 · Payment enforcement — **Partly done**
**Goal:** an unpaid tenant loses write access without relying on the browser. New epic — the June map had no equivalent.
**Done:** `payment.failed` starts a 7-day grace period and `subscription.cancelled`/`halted` update the Subscriptions table (`apps/crm/server/routes/billing.js`); the paywall respects grace (`components/PaywallModal.tsx`); the expiry script exists (`apps/crm/server/scripts/grace-period-expiry-cron.js`).
**Not started:** `subscription.charged` does not clear grace; the expiry script is not scheduled in CloudFormation; there is no server-enforced read-only after grace ends.
**Refs:** `29-payment-system-implementation.md`, `00-phase-0-prerequisites.md` §1, `19-risk-analysis.md` R6.

### REF-E34 · Credit billing & packs — **Partly done**
**Goal:** charge for AI without charging per token.
**Done differently:** a DynamoDB credit ledger instead of Lago — 1 credit = ₹1, 1,000 free monthly credits, `agent_action` 15 credits, `ai_call_per_minute` 15, manual CRM actions 0; atomic deduction with HTTP 402 on a short balance; refund on a failed agent turn; Razorpay one-time Orders for top-up packs; admin cost editor; balance and ledger in the UI (`apps/crm/server/creditConfig.js`, `creditService.js`, `middleware/meterCredits.js`, `razorpayOrders.js`, `routes/creditAdmin.js`, `routes/subscriptions.js`, `components/CreditBalanceCard.tsx`).
**Not started (Phase A):** one canonical price list. `pricing.json`, `plans.ts` and the landing page disagree on Team+, and `BuyCreditsModal.tsx` displays pack prices the server does not charge. Settle through `38-pricing-plan-contacts-and-credits.md` and have the UI read `GET /api/credit-config`. Remove "Telegram" from the AI Employee copy — no such channel exists (D14).
**Refs:** `17-cost-and-billing-architecture.md`, `30-credits-metering-implementation.md`, `19` R7.

### REF-E40 · Mobile app — **Done** (store submission pending)
**Done:** Capacitor 8 wrapper with real Android and iOS projects, native camera, mobile layouts, push device tokens (`apps/crm/real-estate-crm-app/capacitor.config.ts`, `android/`, `ios/`, `apps/crm/server/services/push/`).
**Not started:** the human store-submission steps in `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`. Offline capture is not built.

### REF-E35 · Consented outbound voice — **Partly done**
**Done:** outbound calling only (D16), inside tenant business hours, with role-based phone masking (`services/ai-calling-service/`, `services/followup-agent-service/`, `apps/crm/server/middleware/phoneMasking.js`).
**Not started:** capture call consent at lead intake (Phase A); DLT registration before any bulk calling (Phase B). No DND scrubbing exists.

---

## 3. Phase B — Hardening

### REF-E01 · Roles & tenant scoping — **Partly done**
**Done:** the CRM backend checks ADMIN/MANAGER/FOUNDER/OWNER/MEMBER (`apps/crm/server/middleware/requireRole.js`) and masks phone numbers by role; MCP clients carry OAuth scopes (`services/reality-flow-mcp/scripts/check-scopes.ts`).
**Not started:** the auth service still issues only ADMIN/MEMBER (`services/reality-flow-authentication/src/models/usersModel.ts`); no MANAGER role, no "members see only their own leads", no team or region scoping; two mounted DELETE routes have no role check (`routes/aiIntegrations.js`, `routes/notifications.js`).
**Decision:** ADMIN/MEMBER is enough for M1; MANAGER plus own-lead scoping is required before selling Team plans (D15).
**Dropped:** Cognito M2M clients for agent identities — services use API keys or service JWTs and MCP has its own OAuth.

### REF-E02 · Domain API & MCP foundation — **Partly done**
**Done differently:** one MCP service exposing 72 tools generated from the canonical registry that the WhatsApp agent and CRM backend share, with tenant derived from the token, not from arguments (`services/reality-flow-mcp/`, `apps/crm/server/shared/toolDefinitions.js`, `scripts/generate-mcp-tools.mjs`). Not AgentCore Gateway (D10).
**Partly done:** tenant-scoped reads (MED-1) — `getLeads` queries `search-index`, other list functions still scan (`TODO(MED-1)` in `apps/crm/server/crmDynamodbService.js`).
**Done differently:** conversation state lives in `apps/crm/server/conversationStateService.js` and `whatsappConversationService.js` rather than in new generic conversation tables.
**Not started:** a per-tenant feature-flag service. Today there are per-category toggles (`featureToggleService.js`) and env flags.

### REF-E03 · CI, IaC & observability — **Partly done**
**Done:** 17 CloudFormation templates and per-service deploy wrappers with build tracking, rollback and config-only deploys into separate dev and prod accounts (`infra/cicd/README.md`); CI runs server jest plus MCP tool-drift checks and Instagram tests; CloudWatch metrics, Sentry, PostHog and an agent action audit table (`apps/crm/server/observability/cloudwatch.js`, `agents/agentAuditService.js`).
**Not started:** GitHub Actions deploy to dev (D19); Playwright E2E in CI (31 specs exist but `playwright.yml` never matches them); a CRM mutation audit; archiving audit and ledger rows instead of TTL delete (D17). Tamper-evidence was never built and is not planned.
**Dropped:** OpenTelemetry and Langfuse.

### REF-E16 · Metering & cost guards — **Done differently**
**Done:** metering at the call site with its own ledger rows, a hard stop at zero balance (HTTP 402), a 6-step tool-loop cap, and refund on a failed turn.
**Not started (Phase B):** soft-warn thresholds, spend alerts and a per-tenant spend view for the founder.
**Dropped:** Lago.

---

## 4. Phase C — Growth

### REF-E11 · Channel ingestion — **Partly done**
**Done differently:** every source converts to one `LeadInput` and calls `ingestLead()`, which de-duplicates through a DynamoDB idempotency log and emits `lead.created` (`apps/crm/server/leadIngestion.js`, `webhookLogService.js`, `docs/lead-adapter-architecture.md`). WhatsApp is self-hosted Baileys for the agency's own command channel, not AiSensy or Embedded Signup. ManyChat, Instagram and property pages all feed the same pipeline.
**Not started (Phase C):** the official WhatsApp Business Cloud API for customer messaging (`39-whatsapp-official-api-plan.md`); portal lead ingestion adapters.
**Dropped:** Chatwoot as the channel layer (D9).
**Open question:** the website visitor chat widget and Meta Lead Ads sync are not built and are not in the D14 scope list — are they still wanted? Public property pages with site-visit booking (`apps/property-pages-ms/`) cover part of the website need today.

### REF-E12 · AI sales assistant — **Partly done**
**Done:** an in-house agent core (classify → plan → execute tools → compose, optional bounded tool loop) on Gemini behind a model gateway, serving the WhatsApp command channel and in-CRM web chat; grounded property and policy search that returns nothing on a weak match; `create_meeting` and site-visit booking; follow-up `draft` mode as a light approval step (`apps/crm/server/agents/`, `services/knowledge/`, `siteVisitBooking.js`, `routes/aiEmployeeConfig.js`).
**Not started:** a customer-facing assistant (the current one serves agency staff); an agent action inbox with one-tap approve; a measured first-response time.

### REF-E20 · Follow-up automation — **Partly done**
**Done differently:** `services/followup-agent-service/` schedules, retries and escalates follow-up calls on EventBridge + DynamoDB — site-visit confirmation and post-visit feedback — with `draft` and `autosend` modes. Not Step Functions.
**Not started (Phase C):** multi-channel nurture journeys on WhatsApp, which wait for the official API.

### REF-E21 · Knowledge & RAG — **Partly done**
**Done differently:** DynamoDB vector search with Titan v2 embeddings and tenant id as the index partition key, instead of Bedrock Knowledge Bases on S3 Vectors (`apps/crm/server/services/embeddings/`, `services/knowledge/`, `infra/create-vector-index.sh`).
**Not started (Phase C):** brochure and floor-plan upload with citations and versioned re-ingestion (D14).

### REF-E22 · AI voice — **Partly done**
**Done:** outbound qualification and follow-up calls on ElevenLabs agents through their native Exotel integration, with mid-call CRM tools, semantic property search and Hinglish intents (`services/ai-calling-service/`).
**Not started (Phase C):** inbound answering, human transfer, and reminder calls on a 1600-series number (D14, D16).

### REF-E23 · Social channels — **Partly done**
**Done on dev:** the hosted Instagram service — OAuth connect, DMs, comments with public and private replies, keyword rules, reels and insights, lead scoring and CRM hand-off, live reply desk (`apps/instagram/`).
**Not started:** prod deploy and Meta App Review (`docs/pending-items/instagram-app-review-actions.md`, blocked by the domain); the DM assistant that drafts replies (D14); tenant social publishing, which waits for App Review.
**Open question:** a Facebook Messenger and comments channel is not built and is not in the D14 scope list — still wanted?

### REF-E32 · Portal automation — **Split**
**Dropped:** posting listings to portals through browser automation (account-block risk, D14). No code was ever written.
**Not started (Phase C):** portal **lead** ingestion as new adapters on `ingestLead()`.

### REF-E44 · Autonomy expansion & continuous eval — **Partly done**
**Done:** golden-conversation tests and a tool-choice eval harness (`apps/crm/server/agents/goldenConversations.test.js`, `eval/whatsapp-tool-choice.eval.js`); Call Intelligence actions require approval (`services/callIntelligence/actionExecutor.js`).
**Not started (Phase C):** evals on real data in CI, and a written graduation rule before any customer-facing auto-send.

---

## 5. Done (no further work planned)

### REF-E10 · Conversation backbone — **Done differently**
EventBridge domain events (`lead.created`, `lead.qualified`, `call.ended`, `meeting.completed`) plus SQS work queues (call recordings, follow-up DLQ) and scheduled Lambdas. Dedup is a DynamoDB atomic claim, not Redis; there is no generic orchestrator and no per-tenant queue. Evidence: `apps/crm/server/infra/cfn-backend.yaml`, `services/followup-agent-service/infra/cfn-followup.yaml`.

### REF-E13 · Lead qualification — **Done**
Every `lead.created` runs through an LLM rubric that bands the lead Hot/Warm/Cold with reasons; an AI qualification call overwrites the text score when it happens. Context from Instagram and ManyChat is carried in `LeadInput`. Evidence: `apps/crm/server/scripts/lead-qualifier-handler.js`, `utils/leadRubric.js`, `leadIngestion.js`.

### REF-E14 · Lead scoring — **Done**
The Hot/Warm/Cold rubric with manual override is the scoring model. There are no deterministic weights, no recency decay and no per-tenant tuning, and none are planned here: the founder is building a next-generation lead engine separately and `10-lead-scoring-engine.md` will be updated when it lands (D11).

### REF-E15 · Lead assignment — **Partly done**
An agent-based router assigns qualified leads (`apps/crm/server/scripts/lead-router-handler.js`). There is no rule chain, no capacity or availability model and no SLA timers. Same note as REF-E14: superseded by the next-generation lead engine (D11).

### REF-E33 · Reporting & analytics — **Partly done**
**Done:** a team analytics dashboard over DynamoDB with Excel export (`apps/crm/real-estate-crm-app/src/pages/admin/TeamAnalytics.tsx`, `apps/crm/server/routes/admin.js`, `utils/excel.js`), plus PostHog product analytics.
**Parked:** an Aurora reporting projection with row-level security — Postgres is parked as a possible future reporting store fed from DynamoDB, with no date (D8). No ROI or attribution suite is planned before that.

### REF-E43 · Partner / product MCP surface — **Done**
`services/reality-flow-mcp/` is usable from Claude and ChatGPT with its own OAuth 2.1 (`docs/MCP_AGENCY_GUIDE.md`, `37-product-agents-mcps-guide.md`).

---

## 6. Dropped Epics

| Epic | Why |
|---|---|
| REF-E24 Strands agent runtime | The in-house runtime behind a model gateway is the direction (D7). Strands was considered, not adopted (`20` ADR-02). |
| REF-E30 AgentCore runtime adoption | Same. No AgentCore Runtime, Memory, Identity, Gateway or Browser anywhere in code. |
| REF-E31 Tenant marketing engine | A tenant-facing marketing agent is dropped (D14). Tenant social publishing after Meta App Review is the only piece kept, under REF-E23. |
| REF-E32 (posting half) Portal posting | Account-block risk (D14). |
| REF-E41 Multi-agent orchestration / LangGraph | Not adopted; the bounded tool loop covers current flows. |
| REF-E04 PostgreSQL migration foundation | Never defined, never started; no migration is planned (D8). |

**REF-E42 (3D / Gaussian-splatting property pilots)** is not dropped but is not in Phase A, B or C either. It stays a "someday" idea in `03-future-state-architecture.md`.

---

## 7. Shipped Without a REF Id

These were not in the June epic map at all. They are complete and tracked in `docs/epics/EPIC-1..13-COMPLETION.md`.

| Work | Where |
|---|---|
| Public property pages + site-visit booking microservice | `apps/property-pages-ms/` |
| Call Intelligence: recording upload → transcription → AI review → approved actions | `apps/crm/server/services/callIntelligence/`, `routes/callRecordings.js` |
| Click-to-call with phone masking | `apps/crm/server/routes/clickToCall.js` |
| Khata (ledger) | `apps/crm/server/routes/khata.js` |
| Seat caps, paywall, trial countdown, trial reminders | `apps/crm/server/routes/subscriptions.js`, `components/PaywallModal.tsx`, `SeatCounter.tsx` |
| Grievance portal, cookie consent, in-app account deletion, NPS | `routes/grievance.js`, `routes/feedback.js`, `components/CookieConsentBanner.tsx`, `DeleteAccountModal.tsx`, `NpsModal.tsx` |
| Demo tenant | `docs/epics/EPIC-1-COMPLETION.md` |
| Landing pages build pipeline + 12 pages with JSON-LD | `apps/landing-pages/` |
| Cross-tenant Playwright pentest suite | `tests/playwright/api/cross-tenant-pentest.spec.ts` |

---

## 8. Dependency Map (what is left)

```
A: E00 (keys, API protection) ─┐
   E29 (grace → read-only) ────┤
   E34 (one price list) ───────┼─► take payment ─► E40 store submission
   E35 (consent at intake) ────┘                   E23 prod + App Review

B: E01 (MANAGER + own-lead scoping) ─► sell Team plans
   E02 (MED-1 + pagination) ─┐
   E03 (CRM audit, E2E in CI, CI deploy) ─┴─► scale past the first agencies
   E16 (soft caps)

C: E11 official WhatsApp ─► E20 nurture journeys
   E23 DM assistant ─► tenant publishing (after App Review)
   E21 brochures · E22 inbound voice · E32 portal ingestion
   E44 evals before any auto-send
```
