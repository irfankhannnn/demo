# 23 — Stories

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Every story now carries a status with evidence, and acceptance criteria that named tools the code never adopted (AgentCore Gateway, Lago, Chatwoot, Bedrock Knowledge Bases, Step Functions, Redis, Aurora, Cognito M2M) are rewritten around what was actually built. Stories for dropped work are removed.

> **Scope:** the stories under the epics in `22-jira-epics.md`, grouped by Phase A (M1 launch) → B (hardening) → C (growth) and then by what is already done. Not exhaustive. Format: **As a [role], I want [capability], so that [value].** AC = acceptance criteria.

**Status words:** **Done** · **Partly done** · **Not started** · **Dropped**. Story points are dropped — one founder with AI agents does not estimate in points.

---

## Phase A — before taking payment

### REF-E00-S1 · Rotate the leaked keys — **Partly done**
As the platform owner, I want every key that reached git history rotated, so that the leaked values are worthless.
**Done:** `services/ai-calling-service/deploy-lambda.ps1` is deleted; the stack takes NoEcho parameters into Secrets Manager (`services/ai-calling-service/infra/cfn-ai-calling.yaml`, `src/config/secretsBootstrap.js`); the files holding the Gemini and Baileys keys are untracked; the CRM syncs SSM SecureStrings (`apps/crm/server/infra/sync-ssm-params.sh`).
**AC left:** Exotel, ElevenLabs, Gemini, Baileys and the CRM internal API key are each rotated and recorded in `docs/security-key-rotation.md`; gitleaks runs on every PR and blocks new secrets.
**Not doing:** purging git history. The repo never force-pushes; rotation is the fix (D18).

### REF-E00-S2 · Protect the CRM API — **Not started**
As an operator, I want the public API throttled and logged, so that abuse is visible and bounded.
**AC:** API Gateway stage throttling and access logs on the CRM API; gateway responses stop returning `Access-Control-Allow-Origin: *` (`apps/crm/server/infra/cfn-backend.yaml`); the in-memory limiter (`middleware/rateLimiter.js`) is no longer the only defence. WAF is a separate Phase B story (D17).
**Reference:** the Instagram and property-pages APIs already set `ThrottlingRateLimit`/`ThrottlingBurstLimit` in their templates.

### REF-E00-S3 · Backups — **Done**
As an operator, I want data recoverable. **AC met:** PITR on all CRM tables and versioning on the document buckets (`apps/crm/server/infra/cfn-backend.yaml`). Bucket lifecycle rules are not verified.

### REF-E29-S1 · Enforce the grace period on the server — **Partly done**
As the business, I want an unpaid tenant to go read-only without relying on the browser.
**Done:** `payment.failed` sets `gracePeriodActive` and `gracePeriodEndsAt` (default 7 days); `subscription.cancelled` and `halted` update the Subscriptions table; the paywall respects grace (`apps/crm/server/routes/billing.js`, `components/PaywallModal.tsx`).
**AC left:** `subscription.charged` clears grace; `apps/crm/server/scripts/grace-period-expiry-cron.js` is deployed as a Lambda plus an EventBridge rule in `cfn-backend.yaml`; writes are refused server-side after grace ends; all of it tested with Razorpay test events (`29-payment-system-implementation.md`).

### REF-E34-S1 · One price list — **Not started**
As a customer, I want the price I see to be the price I am charged.
**AC:** one source of truth for plans and packs; `marketing-and-sales/launch-plan-v2/pricing.json`, `apps/crm/real-estate-crm-app/src/lib/plans.ts` and `apps/landing-pages/pricing/index.html` agree on Team+; `BuyCreditsModal.tsx` reads pack prices from `GET /api/credit-config` instead of hard-coding them; "Telegram" is removed from the AI Employee copy because no such channel exists (D14).
**Blocked on:** founder approval of `38-pricing-plan-contacts-and-credits.md`.

### REF-E35-S1 · Consent at intake — **Not started**
As a lead, I want to have agreed before an AI calls me.
**AC:** `ingestLead()` records a call-consent flag and its source; the calling and follow-up services refuse to dial a lead without it; the consent state is visible on the lead.
**Context:** calling is outbound-only and inside tenant business hours today (D16); there is no DLT or DND handling anywhere (that is REF-E35-S2, Phase B).

### REF-E23-S1 · Instagram in production — **Partly done**
As an agency, I want my Instagram DMs and comments in the CRM.
**Done on dev:** OAuth connect, DM and comment handling, public and private replies, keyword rules, insights, lead scoring and CRM hand-off (`apps/instagram/`).
**AC left:** `realestateflow.in` serves the privacy, terms and data-deletion pages over HTTPS; Meta business verification, reviewer login and screencasts submitted; Advanced Access granted and the app Live; the service deployed to prod (`docs/pending-items/instagram-app-review-actions.md`, `docs/insta-sol-ms-docs/10-APP-REVIEW.md`).

### REF-E40-S1 · Mobile app in the stores — **Partly done**
As an agent on site, I want the CRM on my phone.
**Done:** Capacitor 8 app with Android and iOS projects, native camera, mobile layouts, push device tokens (`apps/crm/real-estate-crm-app/capacitor.config.ts`, `apps/crm/server/services/push/`).
**AC left:** the human store steps in `docs/launch/MOBILE_LAUNCH_YOUR_TASKS.md`. Offline capture is **not started** and is not required for M1.

---

## Phase B — hardening

### REF-E01-S1 · MANAGER role and own-lead scoping — **Not started**
As an agency owner, I want staff to see only their own leads, so that I can put a team on the platform.
**AC:** MANAGER exists in the auth model (`services/reality-flow-authentication/src/models/usersModel.ts`), matching the roles `apps/crm/server/middleware/requireRole.js` already checks; a MEMBER's lead reads and writes are scoped to `assignedTo = caller` (plus unassigned, if the agency allows); MANAGER and ADMIN see everything; tests prove a MEMBER cannot read another member's lead.
**Gate:** required before selling Team plans (D15).

### REF-E01-S2 · Guard the remaining DELETE routes — **Not started**
**AC:** `apps/crm/server/routes/aiIntegrations.js` (`DELETE /:clientId`) and `routes/notifications.js` (device-token unregister) require a role; no mounted DELETE is unguarded.

### REF-E01-S3 · Region and team scoping — **Dropped for now**
Not needed for M1 or for the first Team plans (D15). Revisit only if an agency asks for territory isolation.

### REF-E02-S1 · Stop scanning (MED-1) — **Partly done**
As the platform, I want tenant-scoped Queries instead of table scans.
**Done:** `getLeads` queries `search-index` (GSI3).
**AC left:** contacts, owners, properties and meetings move off Scan + FilterExpression (`TODO(MED-1)` in `apps/crm/server/crmDynamodbService.js`); any new GSI is backfilled, nothing moves.

### REF-E02-S2 · Cursor pagination — **Partly done**
**Done:** leads and customers accept `limit`/`offset`, sliced in memory after a scan.
**AC left:** every list endpoint returns `{ items, nextCursor, hasMore }` from `LastEvaluatedKey`, default 50, max 1000; frontend lists updated; tests for empty, single-page and multi-page.

### REF-E03-S1 · CRM mutation audit, archived not deleted — **Not started**
As an admin, I want to see who changed what.
**AC:** every CRM POST/PUT/PATCH/DELETE writes `{ tenantId, userId, action, entityType, entityId, before, after, timestamp }` asynchronously; an admin-only read endpoint filters by date, user and entity; old rows are exported to S3 rather than expiring — including `AgentAuditTable` (90-day TTL today) and credit ledger rows (12 months) (D17).
**Done already:** agent actions are audited (`apps/crm/server/agents/agentAuditService.js`).

### REF-E03-S2 · E2E tests in CI — **Not started**
**AC:** the 31 Playwright specs under `tests/playwright/` run on PRs against a dev backend and block merge. Today `playwright.yml` guards on a path that never matches.

### REF-E03-S3 · Deploy to dev from CI — **Not started**
**AC:** merging to `main` deploys to dev through the existing `infra/cicd/<service>/deploy.sh` wrappers (D19). Prod deploys stay manual.

### REF-E00-S4 · WAF — **Not started**
**AC:** a WAF web ACL in front of the public APIs, after the first customers are live (D17).

### REF-E16-S2 · Soft caps and spend alerts — **Not started**
As the founder, I want warning before a tenant burns their balance.
**AC:** a soft-warn threshold on credit balance with a notification; a per-tenant spend view.
**Done already:** the hard stop at zero balance (HTTP 402 in `middleware/meterCredits.js`), the 6-step tool-loop cap, and refund on a failed agent turn.

### REF-E35-S2 · DLT registration — **Not started**
**AC:** sender and template registration complete before any bulk calling or messaging campaign; DND scrubbing in the calling path (D16).

---

## Phase C — growth

### REF-E11-S1 · Customer WhatsApp on the official API — **Not started**
As an agency, I want to message leads on WhatsApp without risking my number.
**AC:** customer messaging runs on the WhatsApp Business Cloud API (possibly via AiSensy as BSP); replies stay inside the 24-hour service window, with Utility templates outside it; opt-in recorded; Baileys stays restricted to the agency's own command channel (`39-whatsapp-official-api-plan.md`, D9).
**Today:** `services/whatsapp-platform/` is Baileys on ECS Fargate, and the CRM acts only on the agency's self-chat or whitelisted admin senders (`apps/crm/server/routes/webhooks.js`).

### REF-E20-S1 · WhatsApp nurture journeys — **Not started**
**AC:** multi-touch journeys that branch on engagement, stop on human takeover or conversion, and are grounded in CRM data; built on REF-E11-S1, on EventBridge and DynamoDB like the existing follow-up service — not Step Functions.
**Done already:** scheduled, retried and escalated follow-up **calls** with `draft`/`autosend` modes (`services/followup-agent-service/`).

### REF-E23-S2 · Instagram DM assistant — **Not started**
As an agency, I want suggested DM replies I can approve.
**AC:** the assistant drafts a reply for every inbound DM; nothing sends without a human until draft acceptance is measured; then auto-send behind a per-tenant flag (D14). Inbound DM text is treated as untrusted input, never as instructions.

### REF-E21-S1 · Brochures and floor plans — **Not started**
As an agency, I want AI to answer from my brochures with citations.
**AC:** upload, chunk and embed brochures into the existing DynamoDB vector store with tenant id as the index partition key; answers cite the document; re-ingestion is versioned; a weak match returns nothing rather than a guess.
**Done already:** the vector store itself and policy/property retrieval (`apps/crm/server/services/embeddings/`, `services/knowledge/`).

### REF-E22-S1 · Inbound AI voice — **Not started**
**AC:** an inbound number answered by an ElevenLabs agent grounded in CRM tools; books a site visit; transfers to a human on request; recording and consent handled. Outbound is already built (`services/ai-calling-service/`).

### REF-E32-S1 · Portal lead ingestion — **Not started**
**AC:** portal leads arrive through official push or email ingestion as a new adapter on `ingestLead()`, de-duplicated and routed like every other source. **Posting** to portals stays dropped (D14).

### REF-E44-S1 · Evals before auto-send — **Not started**
**AC:** the tool-choice and golden-conversation suites run against real anonymised conversations in CI; a written graduation rule (volume, error rate, zero bad outcomes) must pass before any customer-facing flow moves off draft mode.
**Done already:** `apps/crm/server/agents/goldenConversations.test.js`, `eval/whatsapp-tool-choice.eval.js`.

---

## Already Done

| Story | Status | Evidence |
|---|---|---|
| **REF-E02-S0** Domain endpoints as governed tools — tenant from the token, not from arguments | Done differently (one MCP server, not AgentCore Gateway) | `services/reality-flow-mcp/`, 72 tools generated from `apps/crm/server/shared/toolDefinitions.js` by `scripts/generate-mcp-tools.mjs` |
| **REF-E10-S1** Inbound messages normalised onto an event backbone with work queues, DLQ and retry | Done differently (dedup via a DynamoDB atomic claim, not Redis; no per-tenant queues) | `apps/crm/server/leadIngestion.js`, `webhookLogService.js`, `infra/cfn-backend.yaml` |
| **REF-E10-S2** Contact resolved and threaded before routing | Done | `leadIngestion.js` idempotency guard, `conversationStateService.js` |
| **REF-E12-S1** Grounded answers about properties and policies | Done | `apps/crm/server/services/knowledge/` (weak match returns nothing), semantic property search. First-response time is not measured. |
| **REF-E12-S2** Book a site visit from a conversation | Done | `create_meeting` tool, `apps/crm/server/siteVisitBooking.js` |
| **REF-E12-S3** AI replies wait for a human by default | Partly done | follow-up `draft`/`autosend` modes (`routes/aiEmployeeConfig.js`); Call Intelligence actions need approval (`services/callIntelligence/actionExecutor.js`). No unified action inbox. |
| **REF-E13-S1** Leads profiled and banded with reasons | Done | `apps/crm/server/scripts/lead-qualifier-handler.js`, `utils/leadRubric.js` |
| **REF-E13-S2** Known fields carried from the source channel | Done | `LeadInput` in `leadIngestion.js` (Instagram, ManyChat, property pages) |
| **REF-E14-S1** Hot/Warm/Cold with reasons, recomputed on events | Done | `utils/leadRubric.js`; an AI qualification call overwrites the text score. No recency decay. |
| **REF-E14-S2** Per-tenant weight tuning | Not started | Superseded by the next-generation lead engine (D11) |
| **REF-E15-S1/S2** Rule chain, capacity, SLA timers | Not started | An agent-based router assigns leads (`scripts/lead-router-handler.js`); same D11 note |
| **REF-E16-S1** Every AI action metered to a credit ledger | Done differently (DynamoDB ledger, not Lago) | `creditService.js`, `middleware/meterCredits.js`, `creditConfig.js` |
| **REF-E22-S2** Automated follow-up calls | Done | `services/followup-agent-service/` (site-visit confirmation, post-visit feedback). No 1600-series transactional number. |
| **REF-E23-S3** Comment → private reply DM | Done on dev | `apps/instagram/` keyword rules and private replies |
| **REF-E24-S1** Run the agency from WhatsApp | Done differently | The agency-command channel runs on the in-house agent core, not Strands (`apps/crm/server/agents/`, `routes/webhooks.js`). Off unless `AGENTS_ENABLED=true`. |
| **REF-E33-S1** Pipeline dashboard | Partly done | Team analytics over DynamoDB with Excel export (`src/pages/admin/TeamAnalytics.tsx`, `apps/crm/server/utils/excel.js`). No Aurora projection — parked (D8). |
| **REF-E34-S2** Credit packs and a usage view | Done | Razorpay one-time Orders (`razorpayOrders.js`), balance and ledger (`routes/subscriptions.js`, `components/CreditBalanceCard.tsx`) |

---

## Removed Stories

| Story | Why |
|---|---|
| REF-E11-S2 Website visitor chat widget | Not built. Not in the D14 scope list — see the open question in `22` §4. Public property pages with site-visit booking cover part of the need. |
| REF-E11-S3 Meta Lead Ads sync | Not built, not in the D14 scope list — same open question. |
| REF-E01-S3 Cognito M2M agent identities | Not adopted; services use API keys or service JWTs and MCP has its own OAuth. |
| REF-E24 Strands stories | The in-house runtime is the direction (D7). |
| REF-E31-S1 Tenant reel generation and scheduling | A tenant marketing agent is dropped (D14). |
| REF-E32 posting stories | Portal posting by browser automation is dropped (D14). |
| REF-E33 Aurora projection stories | Postgres is parked with no date (D8). |

---

## Definition of Done (every story)

- Tenant isolation enforced and tested; no cross-tenant read or write.
- Server-side role checks; the client is never the only gate.
- Customer-facing AI answers come from tools or knowledge search — no invented facts, and a weak match returns nothing.
- New agent capability ships behind a flag and starts in draft mode.
- **Nothing deletes CRM data.** Archive instead, including audit and ledger rows.
- Tests: jest for the server, Playwright where there is UI or an isolation boundary.
- Compliance checked where the story touches personal data, messaging or calling (DPDP, DLT, Meta policy).
- Repo paths in the story are correct at merge time.
