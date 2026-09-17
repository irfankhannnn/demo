# Slice 2a — Principal-Based Session Re-Key

**Status: ✅ Done, tested.**

## Why

`agency-app/api/conversationStateService.js` keyed conversation state directly on a raw phone number (`PK: TENANT#<t>#WHATSAPP#STATE#<phone>`). That's fine as long as WhatsApp is the only channel, but a future web channel (Phase 5) has a `userId`, not a phone number — building it would otherwise mean either faking a phone number or forking the whole state layer. The proposal calls for keying on a `principal` instead (`wa:<phone>` for WhatsApp, `web:<userId>` for a future web channel), so both channels can share one conversation-state store.

Research before writing any code confirmed the blast radius was smaller than it might sound: in production, only **two** places ever call into `conversationStateService.js` — `agency-app/api/scripts/whatsapp-message-processor.js` (the real Lambda handler) and `agency-app/api/agents/agentRuntime.js` — both using the same already-normalized phone value consistently. That made a careful, fully-tested re-key tractable in one slice.

Given the explicit "make sure nothing breaks" priority (this work happens before a launch), the cutover uses a **dual-read fallback** rather than a hard cutover: a lookup under the new principal key that misses retries once under the legacy phone-only key. New writes always go under the new key; legacy rows are never backfilled and simply expire on their own 24h TTL (`CONVERSATION_STATE_TTL_SECONDS`). This costs a small amount of extra code for a real benefit: zero observable behavior change, not even a one-time reset of in-flight conversation context at deploy time.

## What changed

### 1. `agency-app/api/conversationStateService.js`

Every exported function's second parameter is now `principal` instead of `contactPhone` (same position — this is a rename, not a reorder). The stored item field changed from `contactPhone` to `principal` too (confirmed via repo-wide search that nothing in production code reads `.contactPhone` off a *returned state object* — the many `.contactPhone` hits elsewhere are either an unrelated `context.contactPhone` parameter on `invokeAgent`, or fields on entirely different data structures in `whatsappConversationService.js`/`billing.js`/etc.).

`buildPk` now takes a principal directly:
```js
function buildPk(tenantId, principal) {
  return `TENANT#${tenantId}#WHATSAPP#STATE#${principal}`;
}
```

`getConversationState` — the only function with the dual-read fallback (every other function only writes, and writes always target the new key):
```js
export async function getConversationState(tenantId, principal) {
  // ...try the new principal key first...
  if (result.Item) return result.Item;

  // Dual-read fallback: try the legacy phone-only key for WhatsApp principals.
  if (typeof principal === 'string' && principal.startsWith('wa:')) {
    const legacyPhone = phoneFromWhatsAppPrincipal(principal); // strips the `wa:` prefix
    const legacyResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildLegacyPk(tenantId, legacyPhone), SK: 'STATE#CURRENT' },
    }));
    if (legacyResult.Item) return legacyResult.Item;
  }
  return null;
}
```
The fallback is scoped to `wa:`-prefixed principals only — a future `web:<userId>` principal has no legacy key to fall back to, and correctly makes only one lookup (verified by test).

### 2. `agency-app/api/utils/whatsapp.js` — new `buildWhatsAppPrincipal(phone)`

```js
export function buildWhatsAppPrincipal(phone) {
  return `wa:${normalizeWhatsAppPhone(phone)}`;
}
```
Single source of truth so the processor, `agentRuntime.js`, and the ops script all construct the exact same string — avoiding the kind of formatting drift that would silently break the dual-read logic (e.g. one caller forgetting to normalize the phone first).

### 3. `agency-app/api/scripts/whatsapp-message-processor.js`

Computes `principal = buildWhatsAppPrincipal(normalizedFrom)` once, alongside the existing `normalizedFrom`/`normalizedTo`. Only the `conversationStateService.js` call sites (`resetConversationStateIfStale`, `getConversationState`, `initializeConversationState`, `recordMessageInConversation`, `updateLastDiscussedEntities`) switched to `principal`. Everything phone-keyed in `whatsappConversationService.js` (dedup claims, message logging) is **unchanged** — that file is explicitly out of scope for this slice (it's a separate, larger phone-keyed store; flagged as a known follow-up, not migrated here).

`invokeAgent`'s context object now carries both fields: `contactPhone: normalizedFrom` (unchanged, still needed by `whatsappConversationService.getConversationContext`) and the new `principal` (needed by `conversationStateService` calls). This split was the key discovery of this slice — `context.contactPhone` was being used for two DynamoDB stores with two different key formats going forward, and collapsing them into one field would have silently broken whichever store didn't get the memo.

### 4. `agency-app/api/agents/agentRuntime.js`

- Removed a confirmed-dead import (`updateConversationState`, imported but never called — verified via a fresh grep before deleting).
- `invokeAgent` now derives `principal` with a safety-net fallback: `context.principal || (context.contactPhone ? buildWhatsAppPrincipal(context.contactPhone) : null)`, then backfills `context.principal` so the later `persistTurnState` call (inside `runConversationalPipeline`, which receives the same `context` object by reference) sees the resolved value too, even for a caller that only ever set `contactPhone`.
- Added a `Turn` JSDoc typedef (`{tenantId, principal, channel, text, sessionId}`) documenting the channel-agnostic shape `invokeAgent`'s `context` is expected to satisfy for a conversational agent — not a new type system (this is plain JS), just naming the concept the proposal calls for.

### 5. `agency-app/api/scripts/clear-whatsapp-conversation.js` (ops utility)

Now deletes conversation state under **both** the new principal key and the legacy phone key, since an explicit "clear this conversation" operator action should actually clear regardless of which key format a given row still happens to use — unlike the read path, which only needs one fallback attempt, a delete utility being thorough here is low-risk and more genuinely useful.

## How it was tested

1. **New test file** `agency-app/api/conversationStateService.principal.test.js` (7 tests) — mocks `@aws-sdk/lib-dynamodb` directly (same pattern as Phase 1's `agencyConfigService.test.js`), since the *existing* `conversationStateService.test.js` turned out to be almost entirely simulated/local state objects that never actually exercise the real DynamoDB-calling functions (only `extractEntitiesFromToolResults`, a pure function, was genuinely tested there) — a pre-existing gap, not something this slice broke, but real coverage of the new dual-read logic was needed and didn't exist. Covers: hit-on-new-key (one call), miss-then-legacy-hit (two calls, correct PK format on each), miss-on-both (returns null), a non-`wa:` principal correctly skipping the fallback entirely, and that `initializeConversationState`/`updateConversationState`/`deleteConversationState` key correctly on whatever principal string is passed.
2. **New tests** in `agency-app/api/utils/whatsapp.test.js` for `buildWhatsAppPrincipal` (3 tests): normalizes before prefixing, matches `normalizeWhatsAppPhone` exactly, handles empty/null input predictably.
3. **Regression**: confirmed `agency-app/api/scripts/whatsapp-message-processor.test.js` needed zero changes — its mocks configure return values for the conversation-state functions but never assert the exact argument passed, so the `normalizedFrom` → `principal` value change inside the processor is invisible to those tests, as expected for a pure key-format change.
4. **Full suite**: 545/548 passing (up from 535/538 before this slice — the +10 are the new tests above), the same 3 pre-existing unrelated failures (documented in `phase1-imp/07-bugs-found.md`) and zero new ones.

## Explicitly out of scope for this slice

- **`whatsappConversationService.js`** (the separate message-log store, also phone-keyed) — not re-keyed. A known, flagged follow-up, not silently ignored.
- **No backfill of legacy rows** — they're read via fallback until they naturally expire (≤24h), never rewritten under the new key proactively.
- **Business-logic extraction and the model-gateway seam** — Slices 2b and 2c.
