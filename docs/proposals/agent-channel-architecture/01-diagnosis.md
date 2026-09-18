# Diagnosis — Current State

Grounded in direct reading of the code on `auth_rbac_feature` (commit `f6b557e` at time of writing). File paths and line references will drift as code changes; treat this as a snapshot, not a live contract.

## Three separate "AI agent" surfaces exist today

| Surface | Entry point | Model/logic | Tool access | Loop? |
|---|---|---|---|---|
| WhatsApp (Bailey) | `agency-app/api/scripts/whatsapp-message-processor.js` | Gemini function-calling, single-shot | `agency-app/api/skillInvoker.js` (in-process) | No — one tool call per turn |
| Voice (Exotel) | `agency-app/ai-calling/src/handlers/callOrchestration.js` | Regex pattern matching, no LLM | `ai-calling-service` → CRM internal API | No — deterministic switch/case |
| External AI apps (MCP) | `platform/mcp/` (standalone service) | Whatever the external client (Claude Desktop, ChatGPT) provides | `agency-app/api/routes/agentTools.js` → same `skillInvoker.js` | Yes, but the loop lives in the *external* client, not our code |

They do not talk to each other. There is no shared session between a WhatsApp conversation and an MCP session, and the voice pipeline is fully separate infrastructure (Exotel + ElevenLabs + its own DynamoDB tables).

## 1. WhatsApp / Bailey agent

**Flow:**

```
WhatsApp user
    ↓
Baileys (platform/whatsapp-platform/, self-hosted on ECS)
    ↓ webhook
agency-app/api/routes/webhooks.js  →  EventBridge (PutEventsCommand)
    ↓
Lambda: agency-app/api/scripts/whatsapp-message-processor.js
    ↓
agency-app/api/agents/agentRuntime.js
    → domainRouter.js       (rules fast-path, LLM fallback — ranks/gates CRM domains)
    → llm/planTurn.js       (Gemini function-calling, ONE tool call taken: functionCalls[0])
    → skillInvoker.js       (executes the tool directly against crmDynamodbService)
    → responseFormatter.js  (deterministic list/card rendering; LLM only for prose)
    ↓
bailey.js sendWhatsAppMessageChunks() → chunked at 4000 chars, sent back via Bailey
```

**Pattern:** native provider function-calling ("LLM + Tools," not MCP) — the right choice for a single app's own tools. Implementation is single-shot, not a real agent loop.

**Reused beyond chat replies.** `agentRuntime.js`'s `invokeAgent()` is also called by:
- `agency-app/api/scripts/lead-qualifier-handler.js` (EventBridge `lead.created` → Hot/Warm/Cold scoring)
- `agency-app/api/scripts/lead-router-handler.js` (EventBridge `lead.qualified` → team assignment)
- `agency-app/api/scripts/lead-followup-cron.js` (scheduled follow-ups)

So the agent core is already channel/trigger-agnostic at the invocation level — WhatsApp is one caller, not a hardcoded assumption baked into the core.

**Known issues (ranked by impact):**

1. **Single tool call per turn.** `agency-app/api/agents/llm/planTurn.js` takes `functionCalls[0]` and discards the rest; `agentRuntime.js` executes exactly one tool, composes a reply, and returns. Any compound request ("create lead and schedule visit") cannot complete in one turn.
2. **Hard domain gating.** `domainRouter.js` narrows the function declarations handed to the planner to 1–2 domains before the planner runs. If the router guesses wrong, the planner physically doesn't have the right tool available and cannot recover mid-turn.
3. **Entity ambiguity resolved by prose rules.** Buyer/seller/tenant/owner each have both a "lead" form and a "converted record" form in different tables. This is currently handled by rules in the planner system prompt rather than a resolver tool.
4. **No tool-choice eval**, only reply-formatting tests (`goldenConversations.test.js`). Nothing asserts "this Hinglish message should call this tool with these args."
5. **Conversation state is phone-keyed** (`PK: TENANT#<t>#CONTACT#<phone>`), which blocks reusing the same session model for a web channel with no phone number.
6. **Credits deducted up front**, before the loop runs, with no refund path on failure; failures inside the conversational path currently return `ok: true` with an apology string, so the caller can't tell a failure occurred.

## 2. Exotel / voice agent

**Flow:**

```
Exotel (telephony) + ElevenLabs (conversational voice AI)
    ↓ webhooks
agency-app/ai-calling/src/routes/webhooks.js
    ↓
agency-app/ai-calling/src/handlers/callOrchestration.js
    → intentService.classifyIntent()   — REGEX patterns, no LLM call
    → intentService.routeAndFetchData() — deterministic switch/case per intent
    → CRM internal API (agency-app/api/routes/aiCallingInternal.js) or RAG vector DB
    ↓
elevenlabs.injectContext() — response text injected back into the live call
```

**Pattern:** deterministic workflow, but without an LLM step deciding what to do — that step is regex. ElevenLabs handles the actual conversational speech (STT/TTS/turn-taking); intent detection deciding *which CRM data to fetch* is hand-written pattern matching against ~9 fixed intents (`INTENT_TYPES` in `agency-app/ai-calling/src/config/constants.js`).

**Status:** the CRM-side internal bridge (`agency-app/api/routes/aiCallingInternal.js`) was disabled pre-launch and has since been **re-enabled** as part of the Hot/Warm/Cold lead-qualification feature (`f65f6bf feat(server): resurrect AI calling internal routes for qualification calls`).

**Known issues:** brittle to paraphrasing and Hinglish code-switching (no fallback to an LLM classifier when regex misses); explicitly out of scope for this proposal (see README "Non-goals") but flagged here because it's the one surface with no LLM-based understanding at all.

## 3. MCP server (`platform/mcp/`)

A real, standalone MCP microservice using the official `@modelcontextprotocol/sdk`, deployed independently from the main CRM backend:

```
Claude Desktop / ChatGPT (MCP client)
    ↓ MCP protocol (JSON-RPC over SSE), OAuth (DCR flow)
platform/mcp/src/controllers/mcpController.ts
    ↓
platform/mcp/src/services/crmClient.ts  — generates short-lived service JWT
    ↓ HTTP POST /api/crm/agent/tool
agency-app/api/routes/agentTools.js  →  skillInvoker.js  →  crmDynamodbService
```

**Tool coverage has drifted.** `platform/mcp/src/services/toolDefinitions.ts` is an explicitly hand-maintained copy (its own header: *"self-contained copy... canonical source lives in agency-app/api/shared/toolDefinitions.js"*). Measured at time of writing:

- Canonical registry (`agency-app/api/shared/toolDefinitions.js`): **87 tools**
- MCP copy (`platform/mcp/src/services/toolDefinitions.ts`): **74 tools** (and its own doc-comment still says "54 CRM tools" — stale on top of stale)

So roughly 13+ tools available to the WhatsApp/web agent are simply unreachable from Claude Desktop/ChatGPT today, with no mechanism to catch new drift as either registry changes.

**Architecturally, this path bypasses the entire agent core.** MCP calls hit `invokeSkill()` directly — same permission check (`canUserAccessTool`), same DynamoDB handlers — but no domain routing, no conversation memory, no Hinglish tone, no deterministic list/card formatting. The external MCP client does its own planning and tool sequencing; this is why an MCP client with a strong model already gets a working multi-step loop "for free," while the homegrown WhatsApp planner does not.

## 4. Search and retrieval (cross-cutting gap)

Not a fourth agent surface, but a shared weakness underneath all of them.

`searchLeads` (`agency-app/api/crmDynamodbService.js:5823`) and `searchProperties` (`:5934`) both load every record for the tenant and then substring-match in Lambda:

```js
const leads = unwrapLeadsList(await getLeads(tenantId));
filtered = filtered.filter(lead =>
  lead.buyerRequirement?.requirement?.toLowerCase().includes(normalizedQuery) || /* …15 more… */);
```

And `getLeads` (`:3701`) underneath is a **full `ScanCommand`** on the shared multi-tenant `CrmTable` with a `FilterExpression`, capped at `maxPages: 100`.

Four consequences:

1. **Meaning is unmatchable.** `"do bedroom flat, station ke paas"` never matches a search for `"2BHK near metro"`. Given the project's 70/30 Hinglish convention, this is the common case.
2. **Cost grows with total tenant data**, because a filtered Scan consumes read capacity for everything scanned, not everything returned.
3. **No ranking.** `.includes()` is boolean — there is no "closer fit."
4. **Silent truncation** past 100 pages, with no error.

Two capabilities are missing outright, not merely slow:

- **Property matching.** No `matchProperties` / `recommendedProperties` exists anywhere (verified: zero matches). *"Which properties fit this lead?"* is not a query at all today.
- **Call transcript search.** `docs/CALL_INTELLIGENCE.md §12` offers filter-by-status and pagination only.

Addressed in [`05-retrieval-and-vector-search.md`](05-retrieval-and-vector-search.md).

## Summary of what this proposal acts on

- **Fix:** WhatsApp agent's single-shot limitation (issue 1–2 above) — this is the actual blocker for "complete flow from WhatsApp." → [`flows/01`](flows/01-whatsapp-agent.md)
- **Add:** a channel-aware compose step so the same core produces a short WhatsApp reply and a long, streamed web reply from the same tool results.
- **Add:** a second channel (in-CRM web chat) on the same core, once conversation state is channel-agnostic. → [`flows/02`](flows/02-web-crm-chat.md)
- **Fix:** unattended flows (qualifier, router, follow-up cron) currently run with full chat-agent autonomy; move them to constrained extraction + deterministic rules, as Call Intelligence already does. → [`flows/04`](flows/04-background-automation.md)
- **Add:** semantic retrieval over free-text fields, and the property-matching capability that does not exist today. → [`05-retrieval-and-vector-search.md`](05-retrieval-and-vector-search.md)
- **Fix (independent):** eliminate the MCP tool-definition drift by generating `reality-flow-mcp`'s schema from the canonical registry instead of hand-maintaining a copy. → [`flows/06`](flows/06-mcp-external.md)
- **Improve (independent):** replace the Exotel voice classifier's English-only regex with a rules-then-LLM fallback, keeping its single-step realtime shape. → [`flows/05`](flows/05-voice-exotel.md)
- **Not touched:** model provider choice, and delete/billing semantics beyond what the channel work requires.

Why each flow gets the mode it gets: [`04-orchestration-patterns.md`](04-orchestration-patterns.md).
