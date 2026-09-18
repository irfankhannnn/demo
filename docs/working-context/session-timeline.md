# Session Timeline

## 1. Initial robustness code review
Reviewed previously implemented OpenClaw-inspired robustness features across:
- `baileys-service/src/baileysClient.js`
- `agency-app/api/bailey.js`
- `agency-app/api/scripts/whatsapp-message-processor.js`
- `baileys-service/src/config.js`
- `agency-app/api/whatsappConversationService.js`

Identified 10 issues (critical, high, medium, low) and fixed all of them.

## 2. Fixes applied (first pass)
1. **JID normalization** in outbound idempotency cache to prevent echo loops.
2. **5xx status code retry** in `agency-app/api/bailey.js` `isRetryableSendError`.
3. **Documented chunk retry duplicate risk** and added partial-success tracking.
4. **Debounced buffer max size** cap to prevent unbounded memory growth.
5. **Awaited debounce shutdown flush** so messages are not lost on SIGTERM.
6. **Group context limit logic** fixed to use the latest message's `isGroup` flag.
7. **Tracked chunk send partial success** and returned `sentChunks`/`totalChunks`.
8. **Normalized debounce key** `sessionPhone` via `normalizePhone`.
9. **Max validation** for `MESSAGE_DEBOUNCE_MS` (≤ 60000).
10. **Removed extra blank lines** in `baileysClient.js`.

All tests passed: `baileys-service` 39 passed, `server` all suites passed.

## 3. Manual testing and discovered issue: silent message loss
User manually tested WhatsApp. Initial replies worked, but one message ("Aur danish ki bhi information do") was never delivered. Root cause identified from logs:
- Baileys connection had gone stale (watchdog inactivity timeout).
- Message was queued locally in the pending-deliveries queue.
- Connection state machine transitioned to `RECONNECTING`, but **nothing actually reconnected**.
- Server's dedup claim was marked complete, so no retry happened.
- Customer received no reply.

## 4. Follow-up reliability fixes (second pass)
1. **Baileys messages route** returns `queued: true, sent: false, HTTP 202` instead of lying about success.
2. **Server `sendWhatsAppMessage`** propagates `queued: true`.
3. **Server `sendWhatsAppMessageChunks`** throws if nothing was actually delivered.
4. **Processor releases the dedup claim** (`markMessageProcessingFailed`) when a reply cannot be sent.
5. **Processor re-throws** reply failures so Lambda/webhook retries are triggered.
6. **Local dev webhook route** returns HTTP 503 on processing failure so the Baileys webhook forwarder retries.
7. **Baileys connection controller** now calls `socket.end()` on stale detection, forcing the existing reconnect logic to take over.

Tests passed again.

## 5. Separate issue discovered: "update budget" created a note
User asked to update a lead's budget. The agent created a note instead of updating `buyerRequirement.budget`.

Fixes applied:
1. Added `buyerRequirement`, `sellerRequirement`, `ownerRequirement`, `tenantRequirement`, and `notes` to the `update_lead` tool schema.
2. Updated `toolContextBuilder.js` `allowedFields` to include requirement objects.
3. Updated the WhatsApp agent prompt to explicitly instruct structured updates instead of notes.
4. Added requirement-object merging in `crmDynamodbService.js` `updateLead` so partial updates (e.g., only budget) do not wipe other fields.

Tests passed again.

## 6. Context snapshot created
This `working-context` folder was created at the end of the session to preserve state.

## 7. Third-pass Baileys robustness improvements (current session)
Implemented a 7-step plan to improve WhatsApp session auto-recovery and reduce the need for customers to re-scan QR codes after crypto/half-open socket failures.

### 7.1. Baileys patching
- Added `patch-package` to apply targeted patches to `@whiskeysockets/baileys@6.7.18`.
- Patched `lib/Signal/libsignal.js` to delay pre-key deletion by a 5-minute grace period (addresses Baileys issue #1769 / PR #2372). Pre-keys are no longer deleted immediately, so retransmissions using the same pre-key ID can still decrypt.
- Patched `lib/WAUSync/USyncQuery.js` to add a null check on `result` before reading `attrs.type`, preventing a crash on unexpected USync responses.

### 7.2. Health probe for half-open sockets
- Added `startHealthProbe` / `stopHealthProbe` in `baileysClient.js`.
- While the socket reports `open`, a lightweight `sendPresenceUpdate('available', ownJid)` is sent every 30 seconds (configurable) with a 10-second timeout.
- On known crypto/half-open failures (`Bad MAC`, `No matching session`, `Invalid PreKey ID`, `Session not found`, MAC verification, HTTP 408), the socket is ended so the existing reconnect logic takes over.

### 7.3. Init-query timeout interception
- Added `createSocketLogger` in `baileysClient.js`: a proxy over the pino logger that detects Baileys internal `init queries timed out` / 408 error logs.
- On detection, the socket is ended immediately instead of waiting for the default long timeout.

### 7.4. Atomic credential backup and soft session reset
- Added `src/auth-state-utils.js` with:
  - `backupCredsJsonAtomically` — writes `creds.json.bak` next to `creds.json` using temp-file + rename.
  - `softResetSession` — deletes only resettable Signal files (`session-*`, `pre-key-*`, `sender-key-*`, `app-state-sync-key-*`) while preserving `creds.json` and `connection-state.json`. Aborts if the backup cannot be created.
  - `restoreCredsFromBackup` — restores `creds.json` from the backup if the live file is missing or empty, validating JSON first.
- Integrated `softResetSession` into `ConnectionController.handleCryptoError` as a recovery step before giving up on high-severity crypto errors. `SOFT_RESET_MAX_RETRIES` defaults to 2.

### 7.5. Proactive pre-key rotation
- Added `startPreKeyRotation` / `stopPreKeyRotation` / `performPreKeyRotation` in `ConnectionController`.
- A 6-hour interval (configurable) rotates pre-keys while the connection is open, preventing `Invalid PreKey ID` exhaustion.
- Timer is `unref()` so it does not block process exit.

### 7.6. Query timeout tuning
- Set `defaultQueryTimeoutMs` to 60000 (configurable via `DEFAULT_QUERY_TIMEOUT_MS`).
- Initially reduced to 30000, but fresh QR links sometimes need the full minute for initial sync, so restored to 60000.

### 7.7. Configuration and documentation
- Added new environment variables in `src/config.js` and `sample.env`:
  - `HEALTH_PROBE_INTERVAL_MS` (default 30000)
  - `HEALTH_PROBE_TIMEOUT_MS` (default 10000)
  - `DEFAULT_QUERY_TIMEOUT_MS` (default 30000)
  - `PREKEY_ROTATION_INTERVAL_MS` (default 21600000, 6 hours)
  - `SOFT_RESET_MAX_RETRIES` (default 2)

### 7.8. Testing
- Added `__tests__/robustness.test.js` (18 tests) covering auth-state-utils, health probe detection, socket logger interception, and config exports.
- Added `__tests__/connection-controller.test.js` (3 tests) covering proactive pre-key rotation and soft reset retry logic.
- Full `baileys-service` test suite: **60 passed, 4 suites passed**.

### 7.9. Code review fixes
After implementing the above, a detailed review fixed:
1. `softResetSession` aborting on backup failure (was continuing to delete files).
2. Health probe timer leak in `shutdownAllSessions`.
3. Missing `recordActivity()` method in `ConnectionController`.
4. Overly broad `isHealthProbeFailure` detection (removed generic 'timeout' / 'connection closed' string matches).
5. `restoreCredsFromBackup` not validating backup content before restoring.
6. Unused `INIT_QUERY_TIMEOUT_MS` in `config.js`.
7. Added `unref()` to the `preKeyRotationTimer` in `ConnectionController`.

## 9. Complete chat-accessible CRUD audit
Audited the OpenClaw workspace reference skills and the server CRM layer, then closed the gaps so all major entity CRUD operations are available to the WhatsApp agent.

### Implementation
1. **Deleted CRUD operations** for every main entity:
   - `delete_lead`, `delete_contact`, `delete_property`, `delete_owner`, `delete_tenant`
2. **Note operations** for all entities:
   - `create_*_note` and `get_*_notes` for leads, contacts, owners, tenants, buyers
3. **Phone lookup** to avoid duplicates:
   - `find_contact_by_phone`, `get_owner_by_phone`, `get_tenant_by_phone`
4. **Search/list improvements**:
   - `get_owners` now searches by query when provided, `search_tenants` added
5. **Contact roles**:
   - `update_contact_role` to add/remove owner/buyer/seller/tenant roles
6. **Property documents**:
   - `get_property_documents`, `create_property_document`, `delete_property_document`
7. **Meetings**:
   - `create_meeting`, `get_meeting`, `get_upcoming_meetings`, `update_meeting`, `delete_meeting`
8. **CRM metrics**:
   - `get_crm_metrics`
9. **Response formatting** updated for:
   - delete confirmations, note lists, meeting cards, document lists, metrics
10. **Prompts** updated to instruct the agent on delete confirmation, phone lookup, meetings, and note tools.

### Files changed
- `agency-app/api/skillInvoker.js` — added all new tools and tool schemas
- `agency-app/api/skillInvoker.test.js` (new) — unit tests for tool routing and validation
- `agency-app/api/agents/responseFormatter.js` — formatting for new result types
- `agency-app/api/agents/prompts.js` — instructions for new tools

### Test results
- `agency-app/api/skillInvoker.test.js`: all passed
- Full `server` test suite: passed

## 8. Structured WhatsApp response formatting
Added deterministic response formatting for all CRM entity types so WhatsApp replies are scannable instead of long paragraphs.

### Implementation
1. Created `agency-app/api/agents/responseFormatter.js` with format templates for:
   - Lead (buyer/seller/tenant/owner)
   - Buyer / Owner / Tenant / Contact
   - Property
2. Single entity: bold header + bullet fields
3. Multiple entities: numbered list with key fields (max 5 + "+N more")
4. Empty results: concise guidance
5. Money formatted as `₹80L`, `₹1.5Cr`, `₹45k`
6. Validation: rejects raw JSON/empty replies, falls back to formatter or safe message

### Files changed
- `agency-app/api/agents/responseFormatter.js` (new)
- `agency-app/api/agents/responseFormatter.test.js` (new)
- `agency-app/api/agents/agentRuntime.js` — applies `sanitizeAndFormatReply` before returning text
- `agency-app/api/agents/prompts.js` — updated whatsapp prompt to prefer structured bullets/numbered lists

### Test results
- `agency-app/api/agents/responseFormatter.test.js`: all passed
- Full `server` test suite: passed

## 10. Code review fixes for CRUD audit
After the initial CRUD audit implementation, a detailed review identified and fixed the following issues:
1. **Missing `delete_buyer`** — Added `deleteBuyer` to `crmDynamodbService.js` and the `delete_buyer` tool to `skillInvoker.js` so buyer CRUD is complete.
2. **Schema mismatch in `update_contact_role`** — Added `profileData` (type `object`) to the tool schema so it is validated like the implementation expects.
3. **Overly broad note detection in `responseFormatter.js`** — Removed the generic `item.id` fallback that could misclassify any entity as a note.
4. **Tool-name detection order for `create_property_document`** — Moved `document` detection before `property` so document tools are formatted correctly.
5. **Metrics formatting** — Fixed `formatToolResult` to call `formatMetricsCard` directly instead of `formatSingleCard`, which lost the metrics context. Added `humanize()` for camelCase metric labels.
6. **Document type capitalization** — Document types are now capitalized in the output.
7. **Meeting default days handling** — Switched `input.days || 7` to `input.days ?? 7` in `get_upcoming_meetings` so `0` is not coerced to `7`.
8. **Test coverage** — Added tests for `delete_buyer`, meeting formatters, note formatters, document formatters, metrics, and the note-misclassification regression.

### Test results after fix
- `agency-app/api/skillInvoker.test.js`: all passed
- `agency-app/api/agents/responseFormatter.test.js`: all passed
- Full `server` test suite: **237 passed, 9 suites passed**

## 9. Bug discovered and fixed: tests corrupted real `auth_state`
While attempting to reconnect by scanning QR after the third-pass work, the pairing failed with HTTP 400 and Baileys crashed with `Cannot read properties of undefined (reading 'public')` during `processHandshake`.

### Root cause
The unit tests had written test fixture values (`{"live":true}` and `{"restored":true}`) into the real `auth_state/918291537522/creds.json` and `creds.json.bak`. This happened because `robustness.test.js` and `connection-controller.test.js` both relied on `process.env.AUTH_STATE_DIR`, and Jest's parallel execution created a race condition that redirected writes into the real `./auth_state` directory.

### Fix
1. Deleted the corrupted `auth_state/918291537522` directory.
2. Updated `auth-state-utils.js` to accept an explicit `baseDir` parameter, removing the need for tests to mutate `process.env.AUTH_STATE_DIR`.
3. Updated `restoreCredsFromBackup` to validate that `creds.json` contains required Baileys fields (`noiseKey`, `signedIdentityKey`, `signedPreKey`, `registrationId`, `advSecretKey`, `me`), not just that the file is non-empty.
4. Updated `robustness.test.js` to pass the temp directory explicitly to all `auth-state-utils` calls.
5. Updated `connection-controller.test.js` to mock `auth-state-utils.js` with `jest.unstable_mockModule`, so `softResetSession` never touches the real filesystem.
6. Verified the `auth_state` directory remains empty after running the full test suite.

### 8.2. Init-query timeout handling tuned (immediately after)
After the user reconnected by scanning QR, the connection was forcibly closed ~46 seconds later when the `init queries timed out` handler ended the socket. Fresh QR links need the full Baileys 60-second window for initial sync, so:
1. `DEFAULT_QUERY_TIMEOUT_MS` restored from 30000 to 60000.
2. `createSocketLogger` now logs the init-query timeout but no longer ends the socket. Actual half-open detection is left to the health probe.

### Test results after fix
- `baileys-service`: **61 passed, 4 suites passed**.
- The real `auth_state` directory was not touched.

## 11. Runtime fix: Gemini rejected tool schema for `attendees` array
During live testing the WhatsApp agent failed with a Gemini 400 error:
```
[400 Bad Request] GenerateContentRequest.tools[0].function_declarations[48].parameters.properties[attendees].items: missing field.
```

### Root cause
The `create_meeting` tool schema in `skillInvoker.js` declared `attendees` as type `array`, but the `agentRuntime.js` function that converts `TOOL_SCHEMAS` into Gemini function declarations did not include the required `items` field for array parameters.

### Fix
1. Refactored the `create_meeting` schema in `skillInvoker.js` so `attendees` is declared as a standard JSON Schema object (`{ type: 'array', items: { type: 'string' } }`) instead of a bare `'array'` type.
2. Updated `validateInput` in `skillInvoker.js` to handle both string type names and complex type definitions so the new schema shape is validated correctly.
3. Updated `buildToolProperties` in `agentRuntime.js` to emit `items` when a schema declares them for array parameters, supporting both the nested structure and the legacy `schema.items[key]` shape for backward compatibility. This applies to both Gemini and Anthropic tool definitions.
4. Exported `buildGeminiToolDefinitions` and `buildAnthropicToolDefinitions` from `agentRuntime.js` for testability.
5. Added tests in `agentRuntime.test.js` to verify that every array parameter has a valid `items` schema and that the `attendees` items description is preserved.

### Test results after fix
- `agency-app/api/agents/agentRuntime.test.js`: all passed
- Full `server` test suite: **240 passed, 9 suites passed**
