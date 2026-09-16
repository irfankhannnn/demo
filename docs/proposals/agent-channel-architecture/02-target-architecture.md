# Target Architecture

## Principle

One agent core. Two channel adapters. The channel is a parameter to the last pipeline stage (compose/format), not a fork in the pipeline. WhatsApp and web differ in *how much of the answer is shown and how fast* — not in *what the agent is capable of doing*.

```
CHANNELS                       ┌───────────────────────────────┐
                                │  WhatsApp        In-CRM chat  │
Bailey webhook ──▶ EventBridge │  adapter         adapter      │◀── SSE / browser
                                └───────────────┬───────────────┘
                                                │ Turn { tenantId, principal,
                                                │        text, channel, sessionId }
────────────────────────────────────────────────┼──────────────────────────────────
                                                ▼
AGENT CORE                     ┌───────────────────────────────┐
(channel-agnostic)             │  Session + memory              │
                                │  principal = wa:<phone>        │
                                │            | web:<userId>      │
                                └───────────────┬───────────────┘
                                                ▼
                                ┌───────────────────────────────┐
                                │  Domain ranker (rules → LLM)   │  ranks, does not gate
                                └───────────────┬───────────────┘
                                                ▼
                                ┌───────────────────────────────┐
                                │  BOUNDED TOOL LOOP             │
                                │  ≤6 steps · wall-clock cap     │
                                │  per-step credit metering      │
                                │  scope escalation on miss      │
                                └──────┬────────────────┬───────┘
                                       ▼                ▼
                             ┌─────────────────┐  ┌──────────────────┐
                             │  Model Gateway   │  │  Tool Registry    │
                             │  (Gemini today)  │  │  apps/crm/server/shared/   │
                             └────────┬─────────┘  │  toolDefinitions  │
                                      │             └────────┬─────────┘
                                      │                      ▼
                                      │                skillInvoker.js
                                      │                      ▼
                                      │                 DynamoDB
                                      ▼
                        ┌─────────────────────────────┐
                        │  CHANNEL-AWARE COMPOSE       │
                        │  channel: 'whatsapp' | 'web' │
                        │  → length budget, tone,      │
                        │    streaming vs. buffered    │
                        └──────────────┬───────────────┘
                                       ▼
                    WhatsApp: chunked text, capped ~400-700 chars
                    Web: SSE stream, full length, entity cards
```

## Components

### 1. Bounded tool loop (replaces single-shot `planTurn`)

The planner keeps calling tools and feeding results back until it produces a final answer or hits a step cap (recommend 6) or a wall-clock budget. This is the change that makes "complete flow from WhatsApp" possible — a compound request runs as multiple silent tool calls within a single turn; only the final compose step is user-facing.

Domain routing changes from a **gate** to a **ranker**: load the top-ranked domain's tools eagerly, but let the loop pull in additional tools from other domains if it discovers mid-loop that it needs them, instead of failing closed. Log every escalation — that log becomes the router's training/eval data.

### 2. Channel-aware compose step

The same tool-call results feed two different final renderings:

- **WhatsApp:** a length-budgeted prose summary (prompt-level budget, not post-hoc truncation) plus the existing deterministic list/card formatter, capped by `RESPONSE_MAX_LIST_ITEMS`. The existing `chunkWhatsAppText`/`sendWhatsAppMessageChunks` (4000-char hard split) stays as a safety net, not the primary length control.
- **Web:** streamed, full-length, can show intermediate tool activity ("searching leads…", "found 3 matches…") and rendered entity cards, matching a ChatGPT/Claude-style UI.

Concretely: `composeReply.js` gains a `channel` parameter that changes the prompt/template used, not the tool results it's summarizing.

### 3. Channel-agnostic session/principal

Replace the phone-only conversation-state key with a principal:

```
wa:<phone>      — WhatsApp
web:<userId>    — in-CRM chat
```

One session table, one set of read/write functions, both channels. This is a prerequisite for the web channel, independent of the tool-loop work, so it can ship on its own.

### 4. Web transport

API Gateway REST added response streaming (`ResponseTransferMode: STREAM`) in November 2025 — Server-Sent Events straight through the existing REST API, no new gateway, no WebSocket state, same custom domain/authorizer/CORS. The chat route gets its **own Lambda function** with a longer timeout and reserved concurrency, separate from the main 30s-timeout API Lambda, so a slow multi-step agent turn never starves ordinary CRM REST traffic.

### 5. MCP boundary (unchanged, but drift fixed separately)

`services/reality-flow-mcp/` stays a separate service for **external** AI clients (Claude Desktop, ChatGPT, etc.). The internal agent core does **not** become an MCP client of its own tools — that would add a network hop and serialization cost for zero benefit, since the core already has direct in-process access via `skillInvoker.js`. The only fix needed here is generating `reality-flow-mcp`'s tool schema from the canonical `apps/crm/server/shared/toolDefinitions.js` at build/deploy time instead of hand-maintaining a second copy — see `03-implementation-plan.md` Phase 5.

### 6. Semantic retrieval layer

The tool registry gains a small number of retrieval tools backed by DynamoDB Vector Search — embeddings stored on existing items in existing tables, no separate vector database. Because they live in the same registry, every flow and MCP get them at once.

```
        BOUNDED TOOL LOOP
                │
                ├──▶ skillInvoker  ──▶ crmDynamodbService ──▶ DynamoDB (exact: keys, GSIs)
                │
                └──▶ retrieval helper ──▶ Bedrock Titan (embed query)
                                     └──▶ SearchVectors   ──▶ DynamoDB vector index
                                              │
                                    tenantId = :t  ← MANDATORY (API-enforced)
                                    score threshold ← enforced centrally
                                    range post-filter (inline filters are `=` only)
```

Two rules that keep this from becoming a liability:

- **Exact stays exact.** Identity lookups — phone numbers, IDs, keys — never go through ANN search. Vector search is for free-text meaning (`requirement`, `notes`, `summary`, `description`) only.
- **Tenant scoping is structural, not conventional.** `tenantId` is the vector index partition key, which makes AWS reject any search that omits it.

Full design, constraints and risks: [`05-retrieval-and-vector-search.md`](05-retrieval-and-vector-search.md).

### 7. Orchestration modes for non-chat flows

The bounded loop above applies to flows where a human reads the output turn by turn. Unattended flows (event-driven, scheduled) use a different mode — the LLM produces structured facts, deterministic code selects tools, and writes beyond a safe default queue for approval. See [`04-orchestration-patterns.md`](04-orchestration-patterns.md) for the selection rule and [`flows/`](flows/) for each flow's architecture.

## Deletes stay out of AI reach

Not specific to channels, but relevant to any multi-step loop: the 8 `delete_*` tools currently in the registry should be removed from what the agent can call, replaced with `archive_*` tools that flip a status field and are fully reversible. Hard deletion becomes an admin-UI-only path. This also removes the `gateDeleteToolPlan()` / `pendingConfirmation` confirmation subsystem from the runtime entirely, which is one less thing the bounded loop has to reason about.
