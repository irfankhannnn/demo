# Agent Runtime Flow (Bonus)

Source: `apps/crm/server/scripts/whatsapp-message-processor.js`, `apps/crm/server/agents/agentRuntime.js`, `apps/crm/server/agents/responseFormatter.js`

End-to-end path from WhatsApp message to reply.

---

## High-level diagram

```
WhatsApp user
    ↓
Baileys (whatsapp-platform) → webhook
    ↓
whatsapp-message-processor.js
    ↓
invokeAgent({ prompt, tenantId, userId, context })
    ↓
┌─────────────────────────────────────────┐
│ 1. Load conversation history (20 msgs)  │
│ 2. Load conversation state (DynamoDB) │
│ 3. buildSystemPromptWithContext()       │
│ 4. Gemini chat + function declarations  │
│ 5. Tool loop (max iterations)           │
│    → skillInvoker → aiDtoMiddleware     │
│ 6. Parse { thinking, reply }            │
│ 7. sanitizeAndFormatReply()             │
└─────────────────────────────────────────┘
    ↓
Prefix 🤖 + send via Baileys
    ↓
Update conversation state (entities, intent, topic)
```

---

## `invokeAgent()` steps

### 1. Context assembly

- **History:** `getConversationContext(tenantId, contactPhone, 20)` — prior user/assistant turns
- **State:** `getConversationState()` — intent, topic, `lastDiscussedEntities` (up to 5)
- State injected into user message as plain-text lines:
  - `Current intent: ...`
  - `Current topic: ...`
  - `Recently discussed: Rahul Shah (lead), ...`

### 2. LLM provider

- Primary: **Gemini** (`GEMINI_MODEL`)
- Fallback path: Bedrock Haiku (Anthropic tool format) — used when configured

### 3. Tool loop

For each Gemini function call:

1. `normalizeGeminiToolName()` — strip `default.` prefix
2. `invokeSkill(toolName, input, { tenantId, userId })`
3. `transformWithAiDto()` — optional DTO wrap
4. `truncateToolResultForLlm()` — shrink large lists for context
5. Append function response to chat
6. Gemini continues until text reply or max iterations

Logging: `skillInvoker.request`, `skillInvoker.response`, `agent.tool.complete`

### 4. Output parsing

1. Try JSON parse → extract `reply`
2. Else `sanitizeAgentReply()` — heuristic scoring to strip reasoning leaks
3. Validate with `isAcceptableAgentOutput()`
4. Retry if broken JSON or list intent without tool (classifier-assisted)

### 5. Post-formatting

`sanitizeAndFormatReply(reply, toolResults)`:

- May **replace** LLM reply with deterministic formatter (see [04-response-formatter.md](04-response-formatter.md))

### 6. State update (after reply)

- `extractEntitiesFromToolResults(toolResults)` — top 3 entities per tool
- `updateLastDiscussedEntities()` — merge into conversation state
- `recordMessageInConversation()`

---

## Memory model (current)

| Mechanism | What it stores | Limitations |
|-----------|----------------|-------------|
| Chat history (20 msgs) | Raw user/assistant text | No structured list indices |
| `lastDiscussedEntities` | type, name, id, phone from last tools | Max 5, no ordinal position |
| `intent` / `topic` | High-level labels | Not always updated per turn |
| Stale reset | `resetConversationStateIfStale(2h)` | Context lost after gap |

**Not implemented:** explicit "current list" buffer, pronoun resolution rules, slot filling for pending deletes.

---

## Classifier retry (second Gemini call)

Triggered when:

- User message looks like list/search intent
- Agent returned conversational text without calling a tool

Classifier returns `suggestedTool` → retry prompt forces tool call.

**Does not run** for summary intents ("how many leads") — those should use insight tools via main prompt.

---

## Permission layer

`skillInvoker` → `canUserAccessTool(userId, toolName)` via `userCategoryService`.

Dev bypass: `agent.invoke.local_dev_bypass` when categories missing (config-dependent).

---

## Configuration reference

| Env var | Purpose |
|---------|---------|
| `GEMINI_API_KEY` | Gemini API |
| `GEMINI_MODEL` | Main agent model |
| `GEMINI_CLASSIFIER_MODEL` | Intent classifier (optional) |
| `USE_AI_DTO_FOR_*` | Per-entity DTO pipeline |
| `RESPONSE_MAX_LIST_ITEMS` | Formatter list cap |
| `TOOL_LOG_MAX_RESULT_CHARS` | Skill invoker log truncation |

---

## Failure modes

| Symptom | Typical cause |
|---------|---------------|
| Double Gemini call on "Hello" | Was: plain text rejected as invalid JSON — **fixed** with `isAcceptableAgentOutput` |
| Metrics dump instead of Hinglish answer | Formatter overrode LLM on `get_crm_metrics` — **fixed** with `preferLlmReply` |
| "undefined (Lead Lead)" after note | Formatter treated note as create — **fixed** |
| Tool hang | CRM URL / permissions — separate infra issue |

This flow doc should be read alongside [01-system-prompt.md](01-system-prompt.md) and [04-response-formatter.md](04-response-formatter.md).
