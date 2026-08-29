# OpenClaw-Inspired Patterns Applied

This work was influenced by OpenClaw's WhatsApp AI agent architecture. The patterns applied:

## 1. Outbound idempotency with composite keys
- OpenClaw pattern: key outbound messages by `(session, recipient, messageId)` rather than just `messageId`.
- Applied in `baileysClient.js` via `addOutboundMessageId` / `hasOutboundMessageId` / `deleteOutboundMessageId`.
- JIDs are normalized (device suffix stripped) so send-side and receive-side keys match.

## 2. Inbound debounce
- OpenClaw pattern: buffer rapid consecutive messages from the same sender and combine them before forwarding.
- Applied in `baileysClient.js` via `debounceIncomingMessage` and `flushDebounceBuffer`.
- Capped at `MAX_DEBOUNCE_BUFFER_SIZE = 100` to prevent unbounded growth.
- `MESSAGE_DEBOUNCE_MS` defaults to 0 (disabled) to avoid latency; configurable up to 1 minute.

## 3. Retryable send error detection
- OpenClaw pattern: classify network/5xx errors as retryable and apply exponential backoff.
- Applied in `server/bailey.js` `isRetryableSendError` with 5xx status-code checking and text-based network error detection.

## 4. Per-sender context limits
- OpenClaw pattern: group chats need tighter context windows than 1:1 chats.
- Applied in `server/whatsappConversationService.js` `getConversationContext` using the latest message's `isGroup` flag.

## 5. Pending delivery queue
- OpenClaw pattern: queue messages while reconnecting and drain when connection is restored.
- Applied in `baileys-service` via `PendingDeliveriesQueue` and `ConnectionController`.
- **Important caveat found:** the queue was not reliable because the reconnect logic did not actually fire when the watchdog went stale. This was fixed by forcing `socket.end()` in `handleStaleConnection`.

## 6. Connection watchdog and state machine
- OpenClaw pattern: formal connection state machine with watchdog-driven reconnect.
- Applied in `baileys-service` via `ConnectionStateMachine` and `ConnectionWatchdog`.
- Fixed gap: watchdog now actually closes the socket on stale detection, so the existing reconnect logic runs.

## Non-OpenClaw robustness layer (third pass)
The following additions are Baileys-specific fixes rather than OpenClaw patterns:

- **Baileys patching** (`patch-package`) — pre-key grace period and USync null check.
- **Health probe** — active `sendPresenceUpdate` probe to detect half-open sockets.
- **Init-query timeout interception** — logger proxy that detects Baileys internal 408 errors.
- **Atomic auth-state backup + soft reset** — preserves pairing while rebuilding Signal state.
- **Proactive pre-key rotation** — prevents pre-key exhaustion over long sessions.

## Skill-to-Agent Tool Mapping

All OpenClaw skill operations are now exposed to the WhatsApp agent via `server/skillInvoker.js`:

| Skill Category | Operations Available in Chat |
|----------------|--------------------------------|
| Lead management | create, get, search, update, delete, convert, notes |
| Contact management | create, get, search, update, delete, role update, notes, phone lookup |
| Property management | create, get, search, update, delete, documents |
| Owner management | create, get, search, update, delete, notes, phone lookup |
| Tenant management | create, get, search, update, delete, notes, phone lookup |
| Buyer management | create, get, search, update, delete, notes |
| Meetings | create, get, list, update, delete |
| Metrics | get CRM metrics |

Operations not yet exposed (low priority): rental history/archive, property agreements, property verifications, project linking, contact activity timeline, owner/customer migration.
