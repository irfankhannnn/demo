# Robustness Implementation

## First-pass review fixes

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | Outbound cache key mismatch / echo loops | `baileysClient.js` | Added `normalizeJidForKey()`; all outbound cache helpers normalize `sessionPhone` and `remoteJid` |
| 2 | Send retry missed 5xx status codes | `agency-app/api/bailey.js` | `isRetryableSendError` checks `err.response.status` as number (500–599) |
| 3 | Chunk retry duplicate-delivery risk | `agency-app/api/bailey.js` | Documented in JSDoc; partial success tracked |
| 4 | Debounce buffer unbounded | `baileysClient.js` | Added `MAX_DEBOUNCE_BUFFER_SIZE = 100`; drops oldest on overflow |
| 5 | Debounce shutdown flush not awaited | `baileysClient.js` | `flushDebounceBuffer` returns Promise; `shutdownAllSessions` awaits all |
| 6 | Group context limit logic wrong | `whatsappConversationService.js` | Uses latest message's `isGroup` flag instead of `some()` |
| 7 | Chunk send partial success not tracked | `agency-app/api/bailey.js` | Returns `sentChunks`, `totalChunks`, `messageIds` |
| 8 | Debounce key not normalized | `baileysClient.js` | `buildDebounceKey` normalizes both `sessionPhone` and `remoteJid` |
| 9 | `MESSAGE_DEBOUNCE_MS` no max | `config.js` | Validates ≤ 60000 ms |
| 10 | Extra blank lines | `baileysClient.js` | Cleaned up |

## Second-pass reliability fixes (after manual test failure)

### Problem
During manual testing, a reply was generated but never delivered because the Baileys connection was stale. The system falsely marked the message as complete.

### Fixes

1. **Honest queued status from baileys-service**
   - `baileys-service/src/routes/messages.js` returns `queued: true, sent: false, HTTP 202` when the connection is not ready.

2. **Server propagates queued status**
   - `agency-app/api/bailey.js` `sendWhatsAppMessage` returns `queued: true`.
   - `sendWhatsAppMessageChunks` throws if nothing was actually delivered.

3. **Processor releases claim on failure**
   - Added `markMessageProcessingFailed` in `agency-app/api/whatsappConversationService.js`.
   - Processor calls it when a reply cannot be sent.
   - Removed the `hasMessage()` fallback that blocked legitimate retries.

4. **Invocation is considered failed**
   - Processor re-throws reply failures.
   - Local dev webhook route returns HTTP 503 so Baileys forwarder retries.
   - Lambda mode will fail the invocation and trigger AWS retry.

5. **Stale connection actually reconnects**
   - `baileys-service/src/connection-controller.js` `handleStaleConnection` now calls `socket.end()`.
   - This fires the Baileys `connection.close` event and triggers the existing reconnect logic.

## Third-pass Baileys issue #1769 / half-open socket robustness

### Problem
After the second pass, the system could still get stuck when:
1. Baileys deleted a pre-key immediately and a retransmission using the same pre-key ID failed (`Invalid PreKey ID`, `Bad MAC`).
2. The socket became half-open (Baileys thought it was connected but WhatsApp was not responding), leading to `init queries timed out` or silent send failures.
3. Signal session state became corrupted and required a full re-link (customer re-scanning QR).

### Fixes

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | Pre-key deleted too early | `node_modules/@whiskeysockets/baileys/lib/Signal/libsignal.js` | Patch: `removePreKey` schedules deletion after 5-minute grace period; cleanup runs every 1 minute |
| 2 | USync null crash | `node_modules/@whiskeysockets/baileys/lib/WAUSync/USyncQuery.js` | Patch: `result?.attrs.type` null check |
| 3 | Half-open socket not detected | `baileysClient.js` | `startHealthProbe` runs `sendPresenceUpdate` every 30s with 10s timeout; ends socket on known failures |
| 4 | `init queries timed out` not acted on | `baileysClient.js` | `createSocketLogger` proxy detects Baileys 408/init-query logs and ends socket |
| 5 | Corrupted Signal session required re-link | `auth-state-utils.js`, `connection-controller.js` | Atomic `creds.json` backup + soft reset deletes only resettable files; preserves pairing |
| 6 | Pre-key exhaustion over time | `connection-controller.js` | Proactive pre-key rotation every 6 hours while connected |
| 7 | Dead handshakes hang too long | `baileysClient.js`, `config.js` | `defaultQueryTimeoutMs` reduced from 60000 to 30000 |

### Integration details
- `softResetSession` is called from `ConnectionController.handleCryptoError` when `preKeyRecovery.attemptRecovery` fails and the error severity is high, before transitioning to `RECONNECTING` and ending the socket.
- `restoreCredsFromBackup` can be called on startup before `useMultiFileAuthState` if the live `creds.json` is empty or missing.
- Health probe and socket logger both call `sock.end()` to force the existing `connection.update` close/reconnect path in `baileysClient.js`.

## Result

- If a reply cannot be delivered, the system retries instead of silently dropping it.
- The Baileys pending-delivery queue is a backup, but the primary retry path is now server-side/Lambda.
- Pre-key retransmissions are less likely to fail because of the grace period.
- Half-open sockets are detected and reconnected faster via health probe and init-query timeout interception.
- Corrupted Signal sessions can often be recovered without requiring the customer to re-scan the QR code.
