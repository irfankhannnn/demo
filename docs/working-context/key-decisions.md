# Key Decisions

## 1. Prefer server-side retry over silent queueing
**Decision:** When Baileys cannot send a message (queued), the server treats this as a failure and triggers a retry rather than trusting the local pending-delivery queue.

**Rationale:** The pending-delivery queue was unreliable because the reconnect logic was not firing. A failed invocation with a released dedup claim is more observable and recoverable.

## 2. Remove `hasMessage()` fallback for dedup
**Decision:** Removed the `hasMessage()` duplicate-skip inside the processor after a successful claim.

**Rationale:** The fallback was blocking legitimate retries. The atomic claim is now the single source of truth.

## 3. Force `socket.end()` on watchdog stale detection
**Decision:** The connection controller explicitly ends the socket when stale.

**Rationale:** The state machine transitioned to `RECONNECTING` but the socket stayed open, so Baileys never emitted a `close` event and reconnect never ran. Ending the socket fixes this.

## 4. Accept small duplicate-delivery risk
**Decision:** In the rare case where both Baileys queue and server retry deliver, a duplicate message may be sent.

**Rationale:** Duplicate delivery is preferable to silent message loss. AI invocations are still deduplicated by the DynamoDB claim.

## 5. Merge requirement objects on partial updates
**Decision:** `updateLead` merges incoming `buyerRequirement`/`sellerRequirement`/etc. with existing data.

**Rationale:** Prevents an LLM that passes only `{ buyerRequirement: { budget: 28000000 } }` from wiping `preferredArea`, `bhk`, and `propertyType`.

## 6. Prompt-first fix for structured field updates
**Decision:** Expanded the tool schema and added explicit prompt instructions before building a dedicated tool.

**Rationale:** This is the smallest change that addresses the issue. If it is not reliable, a dedicated `update_lead_requirements` tool can be added later.

## 7. Patch Baileys instead of upgrading
**Decision:** Use `patch-package` to apply targeted fixes to `@whiskeysockets/baileys@6.7.18` rather than upgrading to a newer version.

**Rationale:** Upgrading Baileys risks breaking the existing integration and may not be immediately compatible with the current auth-state format. Patching the specific files (`libsignal.js`, `USyncQuery.js`) addresses the known issues with minimal blast radius.

## 8. Add a health probe alongside the watchdog
**Decision:** Introduce a separate health probe that actively sends `sendPresenceUpdate` while the socket is open, in addition to the existing connection watchdog.

**Rationale:** The watchdog detects inactivity but does not directly test whether the socket can still send traffic. The health probe catches half-open sockets that look alive but do not respond to WhatsApp.

## 8.1. Do not forcibly close the socket on init-query timeout
**Decision:** The init-query timeout proxy logger only logs the timeout; it no longer calls `sock.end()`.

**Rationale:** After a fresh QR link, the initial sync can take close to the 60-second Baileys query window. Forcibly closing the socket on `init queries timed out` repeatedly disconnected the user before the session could fully initialize. The health probe still detects genuinely stuck sockets.

## 9. Preserve `creds.json` during soft reset
**Decision:** `softResetSession` deletes Signal session/pre-key/sender-key files but never touches `creds.json` or `connection-state.json`.

**Rationale:** `creds.json` holds the WhatsApp Web pairing. Preserving it allows a corrupted session to be rebuilt without forcing the customer to re-scan the QR code.

## 10. Add pre-key grace period
**Decision:** Patched Baileys to delay `removePreKey` by 5 minutes instead of deleting immediately.

**Rationale:** WhatsApp retransmissions can reuse the same pre-key ID. Immediate deletion caused `Invalid PreKey ID` / `Bad MAC` failures. A grace period keeps the pre-key available for retransmissions while still removing it eventually.

## 11. Tests must not rely on global `process.env.AUTH_STATE_DIR`
**Decision:** `auth-state-utils.js` accepts an explicit `baseDir` parameter, and tests use it instead of mutating the global `AUTH_STATE_DIR` environment variable.

**Rationale:** `robustness.test.js` and `connection-controller.test.js` both modified `process.env.AUTH_STATE_DIR`. Jest's parallel execution caused a race condition that redirected writes into the real `./auth_state` directory, corrupting `creds.json` with test fixture data. Passing the directory explicitly removes the race and prevents real filesystem corruption.

## 12. Validate credentials structure before deciding they are usable
**Decision:** `restoreCredsFromBackup` now checks that `creds.json` contains required Baileys fields, not just that the file is non-empty.

**Rationale:** A partially corrupted `creds.json` (e.g., containing `{"live":true}` from test fixtures) has non-zero size but is missing the `noiseKey` and `signedIdentityKey` required for the WhatsApp handshake. The previous check would not restore from backup, leading to the `Cannot read properties of undefined (reading 'public')` crash. Structural validation catches this.

## 13. Use deterministic post-processing for WhatsApp CRM responses
**Decision:** Add a `responseFormatter.js` layer that takes raw CRM tool results and produces structured WhatsApp messages, independent of the LLM's free-form reply.

**Rationale:** The LLM was returning long, inconsistent paragraphs that mixed raw data with conversational filler. A deterministic formatter guarantees each entity category (lead, buyer, seller, owner, tenant, property, contact) is rendered the same way every time, with bold headers, bullet fields, and numbered lists. The LLM still provides conversational context, but factual output is always structured and scannable.

## 14. Expose complete CRM CRUD through the chat agent
**Decision:** The WhatsApp agent now has direct tool access to the full set of CRM operations: create/read/update/delete for every main entity, notes, phone lookup, contact role management, property documents, meetings, and CRM metrics.

**Rationale:** The OpenClaw reference workspace supports operations (delete, notes, lookup, meetings, documents) that were not wired to the chat agent. Exposing every CRUD operation through `skillInvoker.js` ensures the agent can fulfill any CRM request the user makes via WhatsApp without falling back to "I can't do that" or forcing the user to open the dashboard.

## 15. Keep tool schemas and response formatters in sync
**Decision:** After implementing the CRUD audit, a separate review pass fixed schema mismatches, entity detection ordering, and formatting edge cases. The `delete_buyer` tool was added, `update_contact_role` was updated to declare `profileData`, document/metrics detection order was fixed, and the response formatter no longer relies on a generic `id` field to detect notes.

**Rationale:** The first pass of the CRUD audit covered the main surface area but missed a few edge cases. A focused review pass before the next release prevents runtime mismatches and formatting bugs. The test suite was expanded to catch these regressions.
