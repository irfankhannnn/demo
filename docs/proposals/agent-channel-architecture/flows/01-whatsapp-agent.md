# Flow 01 — WhatsApp Agent

**Mode A — bounded tool loop.** A human reads every reply within seconds, so the agent may sequence its own tool calls.

**Goal:** a user completes a whole task from WhatsApp ("create a lead for Rajesh and schedule a site visit tomorrow"), and gets back a short reply.

---

## Current architecture

```
WhatsApp user
    │
    ▼
Baileys  (whatsapp-platform/, self-hosted ECS)
    │ webhook
    ▼
server/routes/webhooks.js ──▶ EventBridge  (source: whatsapp.incoming)
    │                          │ local dev: direct import instead
    ▼                          ▼
Lambda: server/scripts/whatsapp-message-processor.js
    │  ├─ tenant resolution   ← ScanCommand on AgencyConfigTable
    │  ├─ atomic dedup claim  ← conditional DynamoDB write, 5-min window
    │  ├─ sender authz        ← self-chat / admin only
    │  └─ 2 debug fetches     ← google.com + Bailey ALB /health (5s timeout each)
    ▼
server/agents/agentRuntime.js  invokeAgent()
    │
    ├─▶ domainRouter.js      rules keyword match → Gemini classifier fallback
    │                        picks 1–2 domains, GATES the tool list
    ├─▶ llm/planTurn.js      Gemini generateContent + functionDeclarations
    │                        ⚠ takes functionCalls[0] ONLY, discards the rest
    ├─▶ skillInvoker.js      one tool → crmDynamodbService → DynamoDB
    └─▶ responseFormatter.js deterministic lists/cards; LLM prose otherwise
    ▼
bailey.js  sendWhatsAppMessageChunks()  → 4000-char hard split
    ▼
WhatsApp user
```

### What is right and must be kept

- **Async decoupling via EventBridge** — fast webhook ack, retries for free.
- **Atomic dedup claim** — a conditional write with a stale window, released on failure so a retry can reclaim. Properly reasoned distributed lock.
- **Deterministic formatting** — lists and cards rendered by code. Consistency plus zero output tokens; a model swap cannot change how results look.
- **Rules-first routing** — most messages never reach a classifier call.
- **Defence in depth on sender identity** — checked at both webhook and processor.

### What is wrong

| # | Problem | Evidence |
|---|---|---|
| 1 | **One tool call per turn.** Compound requests are impossible by construction. | `llm/planTurn.js` — `functionCalls[0]`; remaining calls dropped |
| 2 | **Router hard-gates the tool list.** A wrong domain guess is unrecoverable mid-turn. | `agentRuntime.js` → `getToolsForDomain()` narrows declarations before planning |
| 3 | **No recovery on empty results.** An empty tool result goes straight to the formatter. | no loop to retry with different arguments |
| 4 | **Length controlled by truncation**, not by composition. | `bailey.js chunkWhatsAppText()` splits at 4000 chars |
| 5 | **Two debug network calls per message**, 5s abort each. | `whatsapp-message-processor.js` hot path |
| 6 | **Full Scan to resolve the tenant** on every message. | `ScanCommand` + `FilterExpression` on `connectedWhatsAppPhone` |
| 7 | **Business logic lives in the processor script** — unusable by any other channel. | ~400-line handler mixing transport, auth, dedup, state, agent, delivery |
| 8 | **Conversation state keyed by phone.** | `conversationStateService.js` — `PK: TENANT#<t>#CONTACT#<phone>` |

---

## Target architecture

```
Baileys ──▶ webhook ──▶ EventBridge ──▶ Lambda (thin channel adapter)
                                             │  transport, dedup, authz, delivery ONLY
                                             ▼
                              Turn { tenantId, principal: "wa:<phone>",
                                     text, channel: "whatsapp", sessionId }
                                             ▼
              ┌──────────────── AGENT CORE (shared with Flow 02) ────────────────┐
              │                                                                   │
              │  session/memory  →  domain RANKER  →  BOUNDED TOOL LOOP           │
              │  (principal-keyed)   (ranks, never      ≤6 steps, wall-clock cap  │
              │                       gates)            scope escalation on miss  │
              │                                         credit metered per step   │
              │                                             │                     │
              │                                             ▼                     │
              │                                   skillInvoker (87 tools)         │
              │                                   + semantic retrieval (05)       │
              └───────────────────────────────────┬───────────────────────────────┘
                                                  ▼
                                    CHANNEL-AWARE COMPOSE
                                    channel = "whatsapp"
                                    prose budget ~400–700 chars
                                    list cap via RESPONSE_MAX_LIST_ITEMS
                                                  ▼
                              chunkWhatsAppText()  ← safety net only
                                                  ▼
                                            WhatsApp user
```

### The loop, concretely

*"Rajesh ke liye lead banao aur kal site visit schedule karo"*

| Step | Model decides | Tool | User sees |
|---|---|---|---|
| 1 | needs a lead | `create_lead{name:"Rajesh", leadType:"buyer"}` | nothing |
| 2 | has `leadId`, needs a meeting | `create_meeting{entityId, date:tomorrow, type:site_visit}` | nothing |
| 3 | done | — | one short reply |

Steps 1–2 are invisible. **Multi-step capability and short replies are not in tension** — only the compose step is user-facing.

### Length: composed, not truncated

Truncating a good answer produces a bad answer. The budget belongs in the compose prompt.

| | WhatsApp | Web (Flow 02) |
|---|---|---|
| Prose budget | ~400–700 chars | unbounded |
| List behaviour | top-N + *"10 aur hain, dikhau?"* | full list, cards |
| Hard cap | 4000-char chunking as **fallback** | n/a |

### Semantic retrieval

Per `../05-retrieval-and-vector-search.md`, semantic search is a **separate tool the agent chooses** (`search_leads_semantic`), not a silent replacement inside `search_leads` — because it adds a Bedrock round trip before DynamoDB is touched, and this flow has the tightest latency budget of any.

---

## Tools

Everything in `server/shared/toolDefinitions.js` (87 tools, 8 domains), plus proposed:

| Tool | Why | Source |
|---|---|---|
| `find_person(name\|phone)` | Kills the lead-vs-converted-record prose rules | `../01-diagnosis.md` |
| `archive_*` (×8) | Replaces the 8 `delete_*` tools; reversible | `../02-target-architecture.md` |
| `khata_*` | The `khata` domain has **0 tools** despite table + routes + CFN existing | verified: 0 matches |
| `search_leads_semantic` | Hinglish paraphrase matching | `../05-retrieval…` R4 |
| `match_properties_for_lead` | Capability that does not exist at all today | `../05-retrieval…` R5 |

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Compound request half-completes | single-shot planner | bounded loop |
| "No results" for a record that exists | substring match + no retry | loop retry + semantic search |
| Wrong tool for a clear request | router gated the wrong domain | ranker + escalation |
| Reply truncated mid-sentence | 4000-char split on long output | composed budget |
| Agent "broke and apologised" indistinguishable from success | errors swallowed into user strings, `ok: true` | typed failures; channel adapter decides display |
| Message vanishes | no visible DLQ on the EventBridge rule | add DLQ + alarm |

---

## Acceptance criteria

1. A two-operation Hinglish request completes in one turn and reports both outcomes.
2. p50 WhatsApp reply ≤ 700 chars without mid-sentence truncation.
3. Tool-choice accuracy on the labelled eval set does not regress versus the single-shot baseline.
4. Worst-case tool calls per turn is provably bounded (step cap + wall-clock).
5. No `delete_*` tool is reachable by the model.
6. Debug fetches and the tenant-resolution Scan are gone from the hot path.
