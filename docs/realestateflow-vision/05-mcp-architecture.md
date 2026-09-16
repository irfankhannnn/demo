# 05 — MCP Architecture

> **Scope:** how RealEstateFlow exposes its business capabilities to AI agents (and partners) as **Model Context Protocol** servers, organized by business domain. Builds on `03` (L5 tool layer) and `04` (agents that consume these). Research basis: MCP spec + AgentCore Gateway, verified June 2026 (`20`).

---

## 1. Why MCP, and Why Domain-Oriented

The existing **SyncBot** already proves the core idea: skills that are thin CLI wrappers calling the CRM REST API (`ai-employee/skills/*`). MCP formalizes that pattern into a **standard, discoverable, auth-aware tool interface** any agent (ours, or a customer's own tooling, or a partner) can consume.

**Decision: business-domain-oriented MCP servers, not one mega-server and not one-server-per-endpoint.** Rationale:
- **Tool-count hygiene:** agents degrade when given dozens of flat tools. Grouping by domain keeps each agent's working tool set small and its prompt cacheable (`04`).
- **Bounded blast radius & ownership:** each MCP server maps to a domain module and team; failures, permissions, and rate limits are scoped.
- **Composability:** an agent loads only the MCP servers its charter needs (Sales Assistant → Property + Knowledge + Visit; Scorer → Lead only).
- **Multi-tenant safety:** tenancy and RBAC are enforced *inside* each server against the existing domain layer, so no agent can bypass isolation.

## 2. The MCP Domain Map

Eleven domain servers, each wrapping existing (or near-existing) domain services:

| MCP Server | Wraps (today's code) | Representative tools | Consumers |
|---|---|---|---|
| **Lead MCP** | `routes/leads.js`, `crmDynamodbService` | `create_lead`, `update_lead`, `search_leads`, `score_lead`, `set_qualification`, `convert_lead`, `lead_metrics` | Qualifier, Scorer, Sales |
| **Property/Inventory MCP** | `crm` properties, `projects`, `developers`, `buildings`/`flats` | `search_inventory`, `get_property`, `get_project`, `get_pricing`, `get_payment_plan`, `check_availability` | Sales, Voice, Marketing |
| **CRM/Contact MCP** | `contacts.js`, `crm.js` | `resolve_contact_by_phone`, `upsert_contact`, `assign_role`, `add_note`, `get_timeline` | Router, all agents |
| **Visit MCP** | meetings in `crm`, site-visit flows | `schedule_visit`, `reschedule_visit`, `list_upcoming_visits`, `visit_reminder` | Sales, Voice, Follow-Up |
| **Task MCP** | tasks/notifications | `create_task`, `assign_task`, `list_tasks`, `complete_task` | Assignment, all agents (HITL) |
| **Marketing MCP** | Higgsfield/Meta-Ads/Blotato MCPs + `marketing-and-sales` | `generate_image`, `generate_reel`, `create_campaign`, `schedule_post`, `get_campaign_metrics` | Marketing agent |
| **Voice MCP** | `ai-calling-service` | `start_call`, `get_call_status`, `get_transcript`, `schedule_callback` | Voice, Follow-Up |
| **Analytics MCP** | metrics endpoints + (later) Aurora reporting | `pipeline_summary`, `agent_performance`, `lead_funnel`, `revenue_report` | Agency-Command, dashboards |
| **Automation MCP** | new (portal/browser) | `enqueue_portal_post`, `get_automation_run`, `list_credentials`, `request_2fa` | Automation agent (HITL) |
| **Document MCP** | `s3Service`, KYC doc flows | `get_brochure`, `get_floor_plan`, `upload_document`, `get_signed_url` | Sales, Voice, Automation |
| **Knowledge MCP** | Bedrock KB (`ragService`) | `query_knowledge`, `list_sources`, `ingest_document` | Sales, Voice, Follow-Up |

These boundaries are intentionally the **same seams** as the agent roster (`04`) and the future domain-service refactor (`18`) — one mental model across agents, tools, and code.

## 3. How MCP Servers Are Built & Hosted

**Two complementary mechanisms** (use the cheaper/simpler one per server):

1. **AgentCore Gateway (preferred for existing APIs):** point Gateway at our **OpenAPI specs / Lambda functions** and it produces MCP tools with **zero MCP-server code**, handling ingress/egress auth and tool discovery. Most CRM-backed servers (Lead, Property, CRM, Visit, Task, Analytics, Document) start here — we already have the REST endpoints. This is the fastest path and avoids maintaining server processes.
2. **Custom MCP servers (TypeScript/Python SDK) on Lambda/Fargate (Streamable HTTP):** for servers needing bespoke logic, composition across services, or third-party orchestration (Marketing wrapping 3 external MCPs; Automation with queue + browser; Knowledge with custom retrieval). Hosted as Streamable HTTP behind API Gateway/ALB.

**Transport:** Streamable HTTP (not stdio) for all hosted servers — they're network services consumed by cloud agents. **Auth:** OAuth 2.1 resource-server pattern; each server validates the caller's (agent's) Cognito M2M token and **derives tenant + scope from it** — identical to how `validateToken`/`extractTenantId` work today, reused.

## 4. Multi-Tenancy & Security in MCP

Every tool call carries an authenticated identity (user via dashboard, or agent via M2M). Inside each server:

```
tool(args, authContext):
  tenantId = authContext.tenantId          # server-derived, never from args
  assert authContext.scopes ⊇ required_scope(tool)   # RBAC (15)
  enforce per-tenant rate/budget caps      # cost control (17)
  call domain service (already tenant-scoped: TENANT# keys)
  audit(tenant, identity, tool, args-redacted, result-summary, cost)
```

This means an MCP tool is **never more privileged than the principal calling it**: an agent serving a Team-Lead's request sees only that team's data; the Automation MCP resolves portal credentials only for the calling tenant from Secrets Manager. Tenant id is **always** derived from the token, never accepted as a tool argument — directly carrying forward today's anti-spoofing posture.

## 5. Tool Design Guidance (house rules)

- **Few, high-level, intent-shaped tools** beat many CRUD primitives. Prefer `qualify_lead(budget, timeline, …)` over five field setters; prefer `search_inventory(criteria)` returning ranked results over raw scans.
- **Structured, quotable returns** (so agents ground answers, `04 §5`), with source/citation fields where relevant.
- **Idempotency keys** on mutating tools (reuse the `WebhookLog` idempotency pattern) — agents retry.
- **Cost/latency budgets** declared per tool; expensive tools (reel generation, browser runs) are async (return a run id; poll/event).
- **Stable schemas** — tool definitions are part of the cached prompt; churn = cache misses + agent confusion.

## 6. Beyond Internal Agents: MCP as a Product Surface

Because the domain is exposed as standard MCP, three external surfaces come nearly for free later:
- **Customer power-users / their own AI tools** can be granted scoped MCP access to their tenant (e.g. connect their Claude/agent to their RealEstateFlow data).
- **Partners/integrations** (a developer's CRM, a portal) consume specific servers under contract.
- **A2A interop** (`04`): our agents can call partner agents and vice-versa over standard protocols.
This is a strategic reason to invest in clean MCP boundaries now, not just an internal plumbing choice.

## 7. Migration from SyncBot Skills → MCP (detail in `06`, `18`)

The 6 SyncBot skills map almost 1:1 onto Lead/CRM/Property/Visit MCP tools. Path: (1) extract the REST calls the skill scripts make; (2) expose those endpoints via Gateway as MCP tools; (3) retire the CLI scripts, keeping the *business rules* (money normalization, confirmation gating, response modes) as tool-layer validation/prompt guidance. Net: same capability, now consumable by any agent, governed and audited.

## 8. What We Avoid

- **One mega-MCP** (too many flat tools → agent degradation, uncacheable prompts).
- **One-MCP-per-endpoint** (explosion of servers, ops overhead).
- **Tenant id as a tool argument** (spoofing risk).
- **Synchronous long-running tools** (browser/reel/voice are async via run ids + events).
- **Duplicating business logic in the MCP layer** — servers wrap the single domain layer; rules live once.
