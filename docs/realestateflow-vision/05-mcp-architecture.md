# 05 — MCP Architecture

> **Status (17 Sep 2026):** As built + roadmap. Checked against the code on main. Built: one MCP server (`services/reality-flow-mcp`, 72 tools generated from the CRM tool registry, own OAuth 2.1, Lambda). The June design of 11 domain servers behind AgentCore Gateway is kept below as "considered, not adopted"; we split only if clients struggle.

> **Scope:** how RealEstateFlow exposes its business capabilities to AI agents and to customers' own AI tools through the **Model Context Protocol**. Builds on `03` (L5 tool layer) and `04`.

---

## 1. Why MCP

The domain is already exposed as **one tool registry** (`apps/crm/server/shared/toolDefinitions.js`) that the in-house agent runtime runs in-process via `apps/crm/server/skillInvoker.js`. The older SyncBot CLI skills (now reference only in `tools/openclaw_workspace_reference/skills/*`) were retired in its favour. MCP publishes the same tools through a **standard, discoverable, auth-aware interface** that Claude, ChatGPT and partner tools can use.

## 2. As Built: One Server

| Property | Today |
|---|---|
| Server | `services/reality-flow-mcp` (TypeScript, Express), Streamable HTTP, on Lambda + API Gateway (`services/reality-flow-mcp/infra/cfn-backend.yaml`) |
| Tools | **72**, generated from the CRM registry into `src/services/generatedToolDefinitions.ts` (`npm run generate:mcp-tools`). The WhatsApp agent, CRM backend and MCP server expose the same 72 tools. |
| Categories | lead 8, buyer 7, tenant 8, owner 8, property 9, contact 10, meeting 5, metrics 15, khata 2 |
| Execution | Each call is proxied to the CRM backend `POST /api/crm/agent/tool` (`src/services/crmClient.ts`); no direct DynamoDB access |
| Auth | Own OAuth 2.1 authorization server: dynamic client registration (rate-limited), PKCE, HS256 access/refresh tokens (`src/routes/oauth.ts`, `src/services/tokenService.ts`) |
| Tenancy | `tenantId` comes from the token claim; a token without it is rejected (`src/middleware/jwtAuth.ts`) |
| Scopes | Every tool maps to `read_<noun>` / `write_<noun>` by category and read-only flag; unknown categories fall back to `crm`, never unrestricted (`src/services/toolDefinitions.ts`) |
| Drift control | CI regenerates the tool file and fails on any difference (`.github/workflows/server-tests.yml`) |
| Customer use | Agencies can connect Claude/ChatGPT today (`docs/MCP_AGENCY_GUIDE.md`, `apps/crm/server/routes/aiIntegrations.js`) |

Known gap: `services/reality-flow-mcp/README.md` still says 54 tools.

**Decision:** keep one server, grouped by category and OAuth scope. Split into separate servers **only if clients struggle** with the tool count (tool-choice errors, context limits). Scopes already let a client be granted a subset.

## 3. Considered, Not Adopted: Eleven Domain Servers

The June 2026 plan proposed eleven domain servers. Kept for reference; the "wraps" column is corrected to today's code.

| June domain server | Maps to today | Representative tools (June) |
|---|---|---|
| Lead | registry category `lead`; `routes/leads.js` | `create_lead`, `update_lead`, `search_leads`, `convert_lead` |
| Property/Inventory | category `property`; `projects`/`developers`/`buildings`/`flats` routes are **not mounted** | `search_inventory`, `get_property`, `check_availability` |
| CRM/Contact | categories `contact`, `buyer`, `tenant`, `owner` | `resolve_contact_by_phone`, `upsert_contact`, `add_note` |
| Visit | category `meeting` | `schedule_visit`, `list_upcoming_visits` |
| Task | notifications; no task category yet | `create_task`, `list_tasks` |
| Marketing | not built; tenant marketing agent **dropped** | — |
| Voice | `services/ai-calling-service` (not in MCP) | `start_call`, `get_transcript` |
| Analytics | category `metrics` | `pipeline_summary`, `lead_funnel` |
| Automation | not built; portal posting **dropped** | — |
| Document | `s3Service`, KYC flows (not in MCP) | `get_brochure`, `get_signed_url` |
| Knowledge | `apps/crm/server/services/knowledge/*` + vector search (not in MCP) | `query_knowledge` |

The domain boundaries survive as **tool categories and scopes** inside the one server.

## 4. How the Server Is Built & Hosted

- **Built:** a custom TypeScript MCP server on Lambda, Streamable HTTP, generated tool definitions, business logic left in the CRM backend.
- **Considered, not adopted:** AgentCore Gateway turning OpenAPI specs / Lambdas into MCP tools with zero server code.
- **Transport:** Streamable HTTP for hosted use; `src/local-server.ts` for local runs.
- **Service identity:** internal calls without a user token run as `mcp-agent`. Cognito M2M is not used.

## 5. Multi-Tenancy & Security

```
tool(args, authContext):
  tenantId = authContext.tenantId             # from the token, never from args
  assert authContext.scopes ⊇ TOOL_SCOPES[tool] # read_/write_<noun>
  per-client rate limit
  POST /api/crm/agent/tool  (CRM enforces TENANT# keys)
```

- Tenant id is **never** accepted as a tool argument.
- A tool is never more privileged than the caller. Today the caller's access is tenant-wide (ADMIN/MEMBER, no lead scoping). When MANAGER and "members see only their own leads" land (before Team plans), the CRM tool endpoint must apply the same scoping to MCP calls.
- **Open:** a per-call audit record for MCP tool use (today agent-runtime actions go to `AgentAuditTable`; there is no general CRM mutation audit, see `00` §7).

## 6. Tool Design Guidance (house rules)

- **Few, intent-shaped tools** beat many CRUD primitives.
- **Structured, quotable returns** so agents ground answers (`04` §5).
- **Idempotency** on mutating tools (reuse the `WebhookLog` pattern).
- **Async for long work** (calls, media): return a run id and poll or emit an event.
- **Stable schemas:** definitions are generated from one registry; change the registry, never the generated file.

## 7. MCP as a Product Surface

- **Customers' own AI tools — live:** agencies connect Claude/ChatGPT to their tenant through OAuth with scoped access.
- **Partners/integrations — later:** specific scopes under contract.
- **Agent-to-agent interop — later**, only if a partner needs it.

## 8. What We Avoid

- **Splitting servers before there is a problem** (more deploys and auth surfaces for no gain today).
- **One-server-per-endpoint.**
- **Tenant id as a tool argument.**
- **Synchronous long-running tools.**
- **Duplicating business logic in the MCP layer** — the server proxies to the CRM, rules live once.
