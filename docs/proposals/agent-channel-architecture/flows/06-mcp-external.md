# Flow 06 — MCP for External AI Applications

**Mode D — tool surface, no orchestration.** The external client's model does the planning. We own tool coverage, schemas, authorisation and rate limiting; we do not own the loop.

---

## Current architecture

```
Claude Desktop / ChatGPT / other MCP client
    │  MCP protocol (JSON-RPC over SSE) + OAuth with Dynamic Client Registration
    ▼
services/reality-flow-mcp/            ← standalone TypeScript service, own deployment
    src/controllers/mcpController.ts
    src/controllers/oauthController.ts
    src/services/toolDefinitions.ts   ⚠ hand-maintained COPY
    src/services/crmClient.ts         → mints a short-lived service JWT
    │
    │  HTTP POST /api/crm/agent/tool   (Bearer service JWT, role: mcp-agent)
    ▼
apps/crm/server/routes/agentTools.js
    │  verifies JWT, checks ALLOWED_TOOL_NAMES
    ▼
apps/crm/server/skillInvoker.js  →  canUserAccessTool()  →  crmDynamodbService  →  DynamoDB
```

The OAuth handshake is genuinely involved — DCR registration against the MCP server, session codes persisted, a desktop-client callback path — and it works. That part is not the problem.

---

## The problem: two tool registries

`services/reality-flow-mcp/src/services/toolDefinitions.ts` is an explicit copy. Its own header says so:

> *"Defines all 54 CRM tools in a neutral format... This is a self-contained copy for the isolated MCP microservice. The canonical source lives in `apps/crm/server/shared/toolDefinitions.js`."*

Measured at `f6b557e`:

| Registry | Unique tools |
|---|---|
| `apps/crm/server/shared/toolDefinitions.js` (canonical) | **87** |
| `services/reality-flow-mcp/src/services/toolDefinitions.ts` (copy) | **74** |
| Header comment in the copy | claims **54** |

Two layers of staleness: the copy has drifted 13 tools behind the canonical registry, and its own documentation has drifted 20 tools behind itself. External AI clients simply cannot reach those 13+ capabilities, and nothing detects further drift.

This is the concrete failure that `../04-orchestration-patterns.md` exists to prevent, and it is why "one registry, many consumers" is stated as non-negotiable there.

---

## The fix: generate, do not copy

```
apps/crm/server/shared/toolDefinitions.js          ← single source of truth
            │
            │  build step (CI / prebuild)
            ▼
    generate-mcp-tools.mjs
            │  neutral definition → MCP inputSchema
            ▼
services/reality-flow-mcp/src/services/toolDefinitions.ts   ← GENERATED, committed, never hand-edited
```

Requirements:

1. Run in `reality-flow-mcp`'s `prebuild`, so a stale copy cannot be deployed.
2. A CI check that fails if the generated output differs from what is committed — that is what makes drift *impossible* rather than merely *unlikely*.
3. Header changes to "GENERATED FILE — do not edit."
4. The dual-description field (`descriptions.internal` Hinglish for the WhatsApp agent, `descriptions.mcp` English for external apps) is a **good** design and should be preserved — carry both in the canonical registry and let the generator pick.

The MCP protocol layer, OAuth flow and `crmClient.ts` do not change. Only the schema's provenance changes.

There is already a related helper (`apps/crm/server/scripts/dump-tools.js`) and a docs generator (`docs/current_design/_generate-tools.mjs`), so this pattern is established in the repo.

---

## What we deliberately do not build here

**The internal agent must not become an MCP client of its own tools.** It is a tempting symmetry — one protocol for everything — and it is wrong here:

| Path | Hops |
|---|---|
| Internal agent today | `skillInvoker()` → DynamoDB — in-process |
| Via MCP | HTTP → JWT mint → MCP service → HTTP → `agentTools` → `skillInvoker` → DynamoDB |

That is two network hops and two serialisation round trips added to the latency budget of Flow 01, which is the tightest in the system, for no capability gain. MCP earns its place for **cross-application** tool sharing. Inside one application, a function call is the right abstraction.

Unification happens at the **registry**, not at the protocol.

---

## The interesting asymmetry

Because MCP hands planning to the caller, an external client with a strong model **already gets multi-step tool sequencing today** — it simply calls `/tool` repeatedly, reasoning between calls. That is precisely the bounded loop Flow 01 lacks.

So the single-shot limitation is a property of `apps/crm/server/agents/llm/planTurn.js`, **not** of the tools. Two consequences:

1. It confirms the tools are already shaped correctly for multi-step use — the loop is the only missing piece.
2. External clients may already be exercising tool combinations the internal agent has never produced. Their call logs are a **free source of realistic multi-step traces** for the Flow 01 eval set.

---

## Security posture

| Control | Status |
|---|---|
| Service JWT, `role: mcp-agent`, verified in `agentTools.js` | ✅ |
| `ALLOWED_TOOL_NAMES` allowlist before dispatch | ✅ |
| Per-user tool authorisation via `canUserAccessTool()` | ✅ |
| Tenant scoping from the JWT payload (`payload.tenantId`) | ✅ |
| Rate limiting (`src/middleware/rateLimiter.ts`) | ✅ |
| `delete_*` tools reachable by an external model | ❌ **8 today** — must be removed with the rest (`../02-target-architecture.md`) |
| Semantic search tools tenant-scoped | ⚠ Must inherit the mandatory `SearchConditionExpression` scoping (`../05-retrieval-and-vector-search.md §4`) |

The `delete_*` point is sharper here than anywhere else: on WhatsApp a human reads the reply immediately, but an external client can chain a delete without any Cloudberry-side human in the loop. Replacing them with reversible `archive_*` tools matters most for this flow.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| A tool exists in the CRM but not in Claude Desktop | registry drift | generated schema + CI drift check |
| Tool works internally, fails over MCP | schema divergence between copies | same |
| Oversized responses to the client | large list payloads | `crmClient.ts` already defaults `search_*` to `responseMode: 'summary'` ✅ |
| External client deletes records | `delete_*` exposed | `archive_*` replacement |
| Cross-tenant results from semantic tools | missing search condition | `tenantId` as `SearchSchema` HASH → API-level failure, not a leak |

---

## Acceptance criteria

1. `reality-flow-mcp` exposes exactly the canonical tool set — 87 today, and automatically whatever it becomes.
2. CI fails if the generated schema differs from the committed file.
3. No `delete_*` tool is reachable via MCP.
4. Semantic search tools are tenant-scoped, verified by a cross-tenant test through the MCP path specifically.
5. The internal agent still calls `skillInvoker` in-process — no internal traffic routed through MCP.
