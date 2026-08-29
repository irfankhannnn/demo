# Flow 02 — In-CRM Web Chat

**Mode A — bounded tool loop.** Same core as Flow 01. The only differences are transport (streaming) and compose budget (unbounded).

**Goal:** a ChatGPT/Claude-style assistant panel inside the CRM that performs real actions and streams full-length responses with rendered entity cards.

**Status:** not built.

---

## The design decision

This flow shares the agent core with Flow 01 rather than getting its own implementation. Two agents would mean two tool registries, two conversation models, two sets of prompts — and they would drift, exactly as the MCP tool registry already has (74 vs 87 tools, `../01-diagnosis.md`).

**What differs between WhatsApp and web is the rendering target, not the reasoning.** So `channel` is a parameter to the last pipeline stage, not a fork in the pipeline.

---

## Target architecture

```
Browser (React chat panel)
    │  POST /api/crm/agent/chat   (JWT, existing authoriser)
    ▼
API Gateway  ──▶  Chat Lambda  (dedicated: longer timeout, reserved concurrency)
    │                   │
    │  SSE stream       ▼
    │        Turn { tenantId, principal: "web:<userId>",
    │               text, channel: "web", sessionId }
    │                   ▼
    │   ┌──────────── AGENT CORE (identical to Flow 01) ────────────┐
    │   │  session/memory → domain ranker → BOUNDED TOOL LOOP       │
    │   │                                    ≤6 steps, wall-clock   │
    │   │                                    skillInvoker (87 tools)│
    │   └──────────────────────┬────────────────────────────────────┘
    │                          ▼
    │              CHANNEL-AWARE COMPOSE  channel = "web"
    │              unbounded prose · full lists · entity cards
    │                          ▼
    └──────────  SSE events ───┘
                 ├─ tool_start   { name, args }   → "Searching leads…"
                 ├─ tool_result  { name, count }  → "Found 3 matches"
                 ├─ token        { text }         → streamed prose
                 ├─ card         { type, data }   → rendered entity card
                 └─ done         { creditsUsed }
```

### Why the tool loop is visible here and not on WhatsApp

Streaming intermediate steps is the main UX advantage a web panel has. `tool_start` / `tool_result` events turn the loop's latency from dead air into visible progress — the thing that makes ChatGPT-style UIs feel responsive. WhatsApp cannot do this (no partial-message protocol), so the same loop stays silent there. **Same loop, different observability.**

---

## Transport — decide in a spike, do not assume

The prior analysis asserted that API Gateway REST APIs support response streaming via `ResponseTransferMode: STREAM` (November 2025). **I could not verify this.** It is load-bearing for the "no new infrastructure" claim, so it must be confirmed before the phase starts.

| Option | Pros | Cons | Confidence |
|---|---|---|---|
| **A. API Gateway response streaming** | Reuses gateway, custom domain, authoriser, CORS. No new infra | Unverified for **REST** APIs specifically; may be HTTP-API-only | ⚠ Unconfirmed — **verify first** |
| **B. Lambda Function URL + response streaming** | Well-established capability; streams up to 15 min | Separate hostname → CORS + auth handled in-function, not by the gateway authoriser | ✅ High |
| **C. Buffered JSON, no streaming** | Trivial | Feels broken next to ChatGPT; a 6-step loop with no feedback looks hung | ✅ High (but poor UX) |
| **D. WebSocket API** | Bidirectional | Connection state we have no use for; chat responses are unidirectional | ✅ High (but over-engineered) |

**Recommendation:** spike A. If REST streaming is not real, fall back to **B** — not C or D. Ship C only as a deliberate MVP stopgap with streaming as the immediate follow-up.

### The timeout constraint is real either way

The main API Lambda has a **30-second timeout**. A six-step tool loop against a strong model can exceed it. The chat route gets **its own Lambda** with a longer timeout and its own reserved concurrency, so a slow agent turn can never starve ordinary CRM REST traffic. This is true for every transport option above.

---

## Session model — the prerequisite

Conversation state is keyed `PK: TENANT#<t>#CONTACT#<phone>` (`conversationStateService.js`). Web chat has a `userId` and **no phone number**. Shipping on this signature means either a fake phone or a forked state layer — both bad.

```
before:  TENANT#<t>#CONTACT#<phone>
after:   TENANT#<t>#PRINCIPAL#wa:<phone>
         TENANT#<t>#PRINCIPAL#web:<userId>
```

One table, one set of functions, both channels. Migration is dual-read (try principal key, fall back to phone key) and let old state expire — conversation context is short-lived, so no backfill is needed.

This work is **independent of the tool loop** and can ship on its own. It is the only hard blocker for this flow.

---

## Frontend

`real-estate-crm-app/` (React + TypeScript + Vite + Tailwind).

| Piece | Notes |
|---|---|
| Chat panel | Streamed tokens; `tool_start`/`tool_result` as inline activity rows |
| Entity cards | Reuse the shapes the deterministic formatter already produces — do not invent a second card vocabulary |
| Permissions | Tools are already gated per user by `canUserAccessTool()`; the panel must render "not permitted" rather than a raw error |
| Credit display | `done` event carries `creditsUsed`; surface it so cost is visible |

---

## Tools

**Identical set to Flow 01.** No web-only tools. If a capability is worth having in the web panel it is worth having on WhatsApp, and vice versa — divergence here is how two registries start.

The one legitimate asymmetry: `responseMode`. Web can request `details`/`full`; WhatsApp defaults to `summary`/`compact`. That is a **parameter**, not a different tool.

---

## Failure modes

| Symptom | Cause | Mitigation |
|---|---|---|
| Panel hangs with no output | buffered response, or loop exceeding Lambda timeout | streaming + dedicated Lambda + wall-clock cap that emits a partial answer |
| CRM REST traffic slows during heavy chat use | shared Lambda concurrency | reserved concurrency on the chat function |
| Same question answers differently on web vs WhatsApp | prompts forked per channel | one core; channel affects compose only |
| Stream dies mid-answer | client disconnect / gateway idle timeout | client resumes by `sessionId`; server settles credits on disconnect |
| Cross-channel confusion | shared session showing WhatsApp context in web | shared session is optional — ship channel-scoped first, unify only if users ask |

---

## Acceptance criteria

1. First token reaches the browser in under ~2 seconds for a single-tool question.
2. A six-step loop streams progress throughout and never appears hung.
3. Tool-choice accuracy on the eval set is **identical** to WhatsApp for the same utterances — proving one core, not two.
4. A slow chat turn provably cannot delay unrelated CRM REST requests.
5. Tool permissions are enforced identically to WhatsApp (same `canUserAccessTool` path).
