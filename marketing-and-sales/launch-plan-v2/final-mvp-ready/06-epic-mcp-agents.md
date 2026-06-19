# EPIC 6 — MCP Server + Autonomous Agents

**Outcome:** The 6 existing CRM skills are exposed as MCP tools; three Bedrock-backed agents (Qualifier, Follow-up, Router) automate lead handling. Everything is tenant-scoped, credit-metered, and flag-gated (`AGENTS_ENABLED`).

**Architecture anchors:**
- Skills live in `ai-employee/skills/` (lead/buyer/contact/owner/property/tenant). Each invoked via `npx tsx scripts/<x>.ts '<json>'`. Skills use Axios `crmClient` (`ai-employee/skills/utils/crm-client.ts`) → CRM API via env `CRM_API_BASE` + `CRM_TOKEN`. They do **not** touch DynamoDB directly — CRM API enforces tenant + validation.
- Skill domains and script locations:
  ```
  ai-employee/skills/lead-management/scripts/    — create-lead, get-lead, get-leads, update-lead, search-leads, convert-lead, delete-lead, lead-notes, get-lead-metrics
  ai-employee/skills/buyer-management/scripts/   — create-buyer, get-buyers, search-buyers, update-buyer, buyer-notes, buyer-metrics, lookup-buyer-by-phone
  ai-employee/skills/contact-management/scripts/ — create-contact, get-contacts, search-contacts, update-contact, delete-contact, update-contact-role, contact-notes
  ai-employee/skills/owner-management/scripts/   — create-owner, get-owner, get-owners, search-owners, update-owner, owner-notes, lookup-owner-by-phone, get-owner-properties
  ai-employee/skills/property-management/scripts/ — create-property, get-properties, search-properties, update-property, property-status, get-property-documents
  ai-employee/skills/tenant-management/scripts/  — create-tenant, get-tenants, search-tenants, update-tenant, tenant-notes, tenant-formatter, tenant-rental
  ai-employee/skills/utils/crm-client.ts         — Axios client (CRM_API_BASE + CRM_TOKEN from env)
  ai-employee/skills/utils/bootstrap.ts          — env loader (checks ~/.openclaw/workspace/.env, then local .env)
  ai-employee/skills/utils/logger.ts             — execution logger
  ```
- Agent soul/identity files (inform system prompts for MCP agents):
  ```
  ai-employee/SOUL.md       — principles: accuracy > assumptions, execution > explanation
  ai-employee/IDENTITY.md   — SyncBot: parse intent → select skill → build input → execute → return result
  ai-employee/AGENTS.md     — operating rules: backend-first, no inventing APIs or data
  ai-employee/TOOLS.md      — tool execution model diagram
  ```
- Bedrock v3 client: copy setup from `ai-calling-service/src/services/ragService.js` which uses `@aws-sdk/client-bedrock-agent-runtime`. For the API Lambda, use `@aws-sdk/client-bedrock-runtime` (InvokeModel, not AgentRuntime) — add to `server/package.json`.
- `.mcp.json` (project root): currently lists only external servers (higgsfield, meta-ads, blotato, git). Add `nabi-crm` stdio server in E6-T2.
- Cron/Lambda + EventBridge patterns: clone `cron/trial-reminder.yaml`. Handlers export `handler`. Runtime `nodejs20.x`.
- See `notes/codebase-reference.md` §8 for Bedrock client setup reference.

---

## E6-T1 — Shared skill invoker (single source of truth)

**Goal:** One module both the MCP server and the WhatsApp processor (E1-T6) use to run a skill action for a tenant. Avoid duplicate invocation logic.

**Files**
- NEW `server/skillInvoker.js`

**Detail**
- `invokeSkill(tenantId, toolName, input, { userId, adminToken? })` in `server/skillInvoker.js`:
  - Maps `toolName` → domain + action. Tool name format: `{action}_{entity}` e.g. `create_lead`, `search_buyers`, `update_property`.
  - **In-Lambda path (default):** import CRM service functions directly from `server/crmDynamodbService.js` — no HTTP, no token juggling. Pass `tenantId` to every DynamoDB call explicitly.
  - **stdio/external path:** HTTP to CRM API using a service JWT signed with `JWT_SECRET` env var and claim `{ tenantId, source: 'mcp', userId }`.
  - Validate `input` against schemas in `server/validation/crmSchemas.js` before any mutation.
  - Always passes `tenantId` explicitly; never relies on ambient state.
- Returns a normalized `{ ok: boolean, data?: any, error?: string }`.

**Security**
- Tenant id is a required argument; reject if missing. Validate `input` with existing `server/validation/` schemas before mutating.

**Tests**
- Unit: `create_lead` routes to lead create with tenant; invalid input rejected.

**Acceptance**
- A single invoker performs CRM actions identically for MCP and WhatsApp paths.

**Depends on:** existing CRM service.

---

## E6-T2 — MCP server wrapping the skills

**Goal:** Expose CRM skills as MCP tools.

**Files**
- NEW `server/mcp-server/index.js` (ESM; use `@modelcontextprotocol/sdk`)
- NEW `server/mcp-server/package.json` (its own deps; not bundled into the API Lambda)
- NEW `server/mcp-server/tools.js` (tool schemas: `create_lead`, `search_leads`, `get_lead`, `update_lead`, `convert_lead`, and equivalents for contact/owner/property/tenant)
- MODIFY `.mcp.json` — register `nabi-crm` stdio server.

**Detail**
- stdio transport first (local Claude/dev). Each tool's handler calls `skillInvoker.invokeSkill`.
- Tenant resolution for stdio: read `MCP_TENANT_ID` and `MCP_SERVICE_TOKEN` from env — the local operator sets these. Never hardcode.
- Define JSON input schemas by reading `ai-employee/skills/*/SKILL.md` files for each domain — the SKILL.md already lists required/optional fields and types for every script. Mirror those schemas exactly.
- System prompt for each agent: compose from `ai-employee/SOUL.md` + `ai-employee/IDENTITY.md` + domain `SKILL.md`.
- Tool naming convention: `{action}_{entity}` (e.g. `create_lead`, `search_owners`, `update_property`). Match the existing script names (e.g. `create-lead.ts` → `create_lead` tool).

**Deployment**
- Phase 1: stdio process (documented in `.mcp.json`).
- Phase 2 (optional, later): Lambda HTTP transport for Bedrock agents — note as follow-up, not MVP-blocking.

**Security**
- Service token scoped; tenant required per call. No cross-tenant tool calls.

**Tests**
- Start server, `tools/list` returns all tools; `create_lead` via MCP creates a lead (against a test tenant).

**Acceptance**
- All 6 domains exposed as MCP tools; a tool call performs the CRM action.

**Depends on:** E6-T1.

---

## E6-T3 — Agent runtime + credit/flag gating

**Goal:** A thin agent runner that calls Bedrock with the MCP/skill tools, gated by credits and per-tenant enable.

**Files**
- NEW `server/agents/agentRuntime.js` — wraps Bedrock (copy client/region pattern from `ai-calling-service/src/services/ragService.js`; use `@aws-sdk/client-bedrock-runtime` with `InvokeModelCommand` for direct model calls). Haiku-first model routing, tool-use loop delegating to `skillInvoker`. **Note:** `server/agents/` is a new directory — add `agents/` to the zip include in `deploy.sh`.
- NEW `server/agentAuditService.js` — log each agent action to CRM table (`PK=TENANT#{t}#AGENTLOG#{ts}`) with input/output summary + credits charged.

**Detail**
- Before any invocation: check `AGENTS_ENABLED` and a per-tenant flag (config), then **deduct `agent_action` credits** (EPIC 2). If insufficient → skip + log.
- Model routing: start Haiku; escalate to Sonnet only if confidence/complexity requires (keep simple for MVP: Haiku default, Sonnet for qualifier reasoning).
- Per-tenant daily cap (config) to bound cost.

**Security**
- Tenant-scoped tools only; audit every action; never log secrets/PII beyond necessary.

**Tests**
- Unit (mock Bedrock + invoker): runs tool loop, deducts credits, writes audit; skips when disabled or out of credits.

**Acceptance**
- Agent runs only when enabled + funded; every run is audited and metered.

**Depends on:** E6-T1, E2.

---

## E6-T4 — Lead Qualifier agent (first agent)

**Goal:** Auto-score new leads HOT/WARM/COLD with reasons.

**Files**
- NEW `server/agents/leadQualifierAgent.js`
- NEW `server/scripts/lead-qualifier-handler.js` (Lambda handler, ships via zip)
- NEW CFN: EventBridge rule on `crm.leads`/`lead.created` → handler (see `07-infra-cfn-deploy.md`)
- MODIFY `server/routes/crm.js` lead-create: publish EventBridge `lead.created` `{leadId, tenantId, leadType}` (v3 `@aws-sdk/client-eventbridge`).

**Detail**
- Handler resolves `{tenantId, leadId}`, loads lead via `skillInvoker get_lead`, runs `agentRuntime` with a qualification prompt, then `update_lead` with `score` + `reasons` (store on lead; extend lead schema with optional `score`, `scoreReasons`, `scoredAt`).
- Confidence threshold from config (default 0.7).

**Security/cost**
- Credit-gated; tenant-scoped; idempotent per lead (skip if already scored recently).

**Tests**
- Unit (mock Bedrock): given a lead, writes a score + reasons; out-of-credits → no write.

**Acceptance**
- Creating a lead triggers qualification; lead gets a score within seconds (when enabled).

**Depends on:** E6-T3, infra EventBridge.

---

## E6-T5 — Follow-up agent (scheduled)

**Goal:** Draft follow-ups for leads contacted 1–7 days ago.

**Files**
- NEW `server/agents/leadFollowupAgent.js`
- NEW `server/scripts/lead-followup-cron.js` (handler)
- NEW CFN `cron/lead-followup.yaml` (daily 09:30 IST)

**Detail**
- `search_leads` status=`contacted`, last activity 1–7 days ago; for each, agent drafts a short message; deliver via WhatsApp (Bailey) or email, or queue for human approval (config: `autosend` vs `draft`). Default **draft** for MVP (safer).
- Credit-metered per agent action + per message send.

**Security**
- Tenant-scoped; no autosend unless explicitly enabled.

**Tests**
- Unit: selects right leads; produces drafts; respects autosend flag + credits.

**Acceptance**
- Daily run produces follow-up drafts (or sends if enabled) for eligible leads.

**Depends on:** E6-T3.

---

## E6-T6 — Router agent (assignment)

**Goal:** Assign qualified leads to the best-fit available member.

**Files**
- NEW `server/agents/leadRouterAgent.js`
- NEW `server/scripts/lead-router-handler.js` (handler)
- NEW CFN EventBridge rule on `lead.qualified` → handler. Qualifier emits `lead.qualified` after scoring.

**Detail**
- Inputs: lead + team members (from auth svc list, reuse E4 service) + current workload (active leads per member from CRM). Agent picks assignee; `update_lead.assignedTo`. Notify member (WhatsApp/email).
- Strategy config: weighted-by-workload (default) vs round-robin.

**Security**
- Only assigns within tenant; audited.

**Tests**
- Unit: assigns to lighter-loaded member; updates lead; notifies.

**Acceptance**
- Qualified leads get auto-assigned and the member is notified.

**Depends on:** E6-T3, E6-T4, E4-T1 service.

---

## E6-T7 — Agent activity UI (transparency)

**Goal:** Show recent agent actions + credit cost.

**Files**
- NEW `real-estate-crm-app/src/components/AgentActivityLog.tsx`
- NEW read endpoint `GET /api/admin/agent-activity` (from `agentAuditService`), admin-only.

**Tests/Acceptance**
- Admin sees a chronological, credit-attributed log of agent actions (tenant-scoped).

**Depends on:** E6-T3.

---

## EPIC 6 sequencing & ship state
- Default **`AGENTS_ENABLED=false`**. Ship MCP server (T1–T2) first (usable standalone). Then Qualifier (T4) behind the flag for pilot tenants, then Follow-up/Router.
- All agent work is credit-gated and audited; never autosends customer messages unless explicitly enabled.
