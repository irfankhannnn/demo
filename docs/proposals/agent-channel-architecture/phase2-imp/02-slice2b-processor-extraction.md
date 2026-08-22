# Slice 2b — Extract Business Logic from the WhatsApp Processor

**Status: ✅ Done, tested.**

## Why

`server/scripts/whatsapp-message-processor.js` mixed transport (parsing the inbound event), dedup (claim lifecycle), and business logic (business-hours policy, category access control, conversation-state bootstrap, agent invocation, entity persistence) all in one 368-line handler. A future web channel would either have to duplicate all of that business logic or fork it — exactly the kind of drift the whole proposal exists to prevent (see the MCP tool-registry drift finding in `../01-diagnosis.md`).

Before writing any code, a research pass produced a line-range breakdown of the processor categorizing every block as transport/dedup/delivery (stays in the adapter) or business logic (moves to the agent core). That breakdown held up close to exactly during implementation, with one important correction found along the way (below).

## What changed

### The split: two new exported functions in `server/agents/agentRuntime.js`, not one

The plan originally sketched a single new function the processor would call once. Implementation found a real seam that made one function wrong: `logMessage` (the inbound message log write) sits, in the original code, **between** access-control passing and the agent actually running — and a message that fails access control is **never logged** at all. Collapsing everything into one function would have forced a choice between losing that ordering or silently starting to log denied messages. Neither is acceptable for a "make sure nothing breaks" slice, so the extraction became two functions instead:

- **`prepareConversationalTurn({tenantId, principal, contactPhone})`** — business-hours/pause policy, category-based access control, category resolution, conversation-state bootstrap. Returns `{outcome: 'access_denied', reason}` (caller stops here — releases its claim, never logs, never replies, exactly as before) or `{outcome: 'ready', isAgentPaused, isAutoReplyBlocked, autoReply, category}`.
- **`runConversationalTurn({tenantId, principal, contactPhone, text, messageId, isAgentPaused, isAutoReplyBlocked, autoReply, category})`** — called *after* the processor logs the inbound message. Handles the empty-text guard, invokes the agent, persists discovered entities, and returns a discriminated outcome: `empty_message`, `agent_result` (with `ok`/`error`/`text`/`toolCalls`), `agent_invocation_failed`, `agent_paused`, or `agents_not_available`.

Both are deliberately **not** folded into `invokeAgent()` itself: `invokeAgent` is also called directly for the non-conversational agents (qualifier/router/followup/mcp — see `CONVERSATIONAL_AGENTS`), which must not inherit business-hours/category-access policy that only makes sense for a live conversational turn. The business-hours helper functions (`minutesFromTime`, `isWithinBusinessHours`) moved into `agentRuntime.js` alongside them, unchanged.

### A second subtlety: two different "the agent didn't work" paths

The original processor had two distinct failure shapes that needed preserving exactly:
1. `invokeAgent` resolving with `{ok: false, error: '<code>'}` — mapped to specific Hinglish copy per error code (`insufficient_credits`, `ai_employee_not_provisioned`, etc.). This is the normal, expected "the agent declined to act" path.
2. The `invokeAgent` call itself throwing (or the surrounding block throwing) — caught locally, mapped to a generic "❌ Something went wrong" reply, **without** propagating to the outer per-record `catch` that would fail the whole Lambda invocation for retry.

These map to `runConversationalTurn`'s `agent_result` (path 1) and `agent_invocation_failed` (path 2) outcomes respectively. Getting this distinction right mattered: collapsing them would have either turned a normal "insufficient credits" reply into a retry-triggering failure, or turned a genuine invocation crash into a silent no-op.

### `server/scripts/whatsapp-message-processor.js` — what's left

Now genuinely thin: event/record parsing, tenant resolution, self-chat auth, the dedup claim lifecycle, the two new core-function calls (with inbound logging happening between them, preserving the ordering above), the reply-copy mapping (still channel-specific presentation, deliberately not moved), and delivery (`sendWhatsAppMessageChunks`, outbound logging, claim completion/failure). The **8 dynamic `import()` calls** (7 already outside the per-record loop, 1 — `agentRuntime.js` — inside it) are gone entirely: the file now statically imports everything it needs at module scope, and no longer imports `agentRuntime.js`'s `invokeAgent` at all (it calls the two new functions instead).

## How it was tested

1. **`server/scripts/whatsapp-message-processor.test.js`** — substantially rewritten. The processor's mock surface changed (no longer mocks `whatsappAccessControl.js`/`userCategoryService.js`/`conversationStateService.js`/`agencyConfigService.getAgencyConfig` directly, since the processor no longer imports them — only `agentRuntime.js`'s two new exports, mocked wholesale). All 4 existing Slice 1 tests preserved and passing unchanged in intent. 7 new tests added, each asserting the processor correctly maps one `prepareConversationalTurn`/`runConversationalTurn` outcome to the exact same reply copy and side effects the original inline logic produced: `access_denied` (claim released, never logged, never replied), inbound logging happens before the turn runs, `empty_message`, an `agent_result` error code, `agent_invocation_failed` (with the 🤖 prefix), `agent_paused`, `agents_not_available`.
2. **New file `server/agents/agentRuntime.prepareConversationalTurn.test.js`** (9 tests) — isolated unit tests for `prepareConversationalTurn` itself, mocking `agencyConfigService.js`/`whatsappAccessControl.js`/`userCategoryService.js`/`conversationStateService.js`. Covers: happy path, access-denied short-circuiting *before* category resolution or conversation-state bootstrap even runs, `autoReply: false` → paused, outside-business-hours → paused, `canAutoReply: false` → blocked without full denial, a failing `getAgencyConfig` degrading to `{}` rather than throwing (matches the original `.catch(() => ({}))`), a conversation-state bootstrap failure being logged-not-thrown (matches the original inner try/catch), and the initialize-only-if-missing conversation-state logic.
3. **`runConversationalTurn` was *not* given an equivalent isolated unit test** — it calls `invokeAgent` as a same-module function reference (not an import), which `jest.unstable_mockModule` cannot intercept (the same ESM same-module-call limitation documented in `phase1-imp/03-slice3-archive-property.md`'s testing-scope retrospective). Its outcome contract is instead verified from the caller's side (item 1 above), and its internal call to the real `invokeAgent` is covered by the pre-existing `agentRuntime.test.js`/`goldenConversations.test.js` suites, which needed zero changes and continue to pass.
4. **Full suite**: 561/564 passing (up from 545/548 before this slice), the same 3 pre-existing unrelated failures, zero new ones.

## Explicitly out of scope for this slice

- **The Hinglish reply-copy mapping stays in the processor** — channel-specific presentation, not business logic, per the original plan.
- **`CONVERSATIONAL_AGENTS` generalization beyond what's needed to keep WhatsApp working unchanged** — not building the web channel itself (Phase 5).
- **The model-gateway seam** — Slice 2c.
