# Files Changed in This Session

## Core robustness files

- `baileys-service/src/baileysClient.js`
  - Added JID normalization, debounce buffer, outbound cache helpers, shutdown flush.
- `baileys-service/src/config.js`
  - Added `MESSAGE_DEBOUNCE_MS` with validation.
- `server/bailey.js`
  - Added chunking, retry logic, honest queued status handling.
- `server/scripts/whatsapp-message-processor.js`
  - Uses chunking, releases claim on failure, re-throws for retry.
- `server/whatsappConversationService.js`
  - Group context limit, `isGroup` field, `markMessageProcessingFailed`.
- `server/routes/webhooks.js`
  - Returns 503 on local processing failure.

## Reliability fixes

- `baileys-service/src/routes/messages.js`
  - Returns `queued: true` with HTTP 202 when connection not ready.
- `baileys-service/src/connection-controller.js`
  - `handleStaleConnection` now calls `socket.end()` to force reconnect.

## Agent budget update fix

- `server/skillInvoker.js`
  - Expanded `update_lead` schema with requirement objects and notes.
- `server/agents/toolContextBuilder.js`
  - Expanded `allowedFields` for `update_lead`.
- `server/agents/prompts.js`
  - Added explicit instructions for structured updates vs notes.
- `server/crmDynamodbService.js`
  - Merges requirement objects in `updateLead`.

## Third-pass Baileys robustness files (current session)

- `baileys-service/package.json`
  - Added `patch-package` dependency and `postinstall` script.
  - Updated test scripts to use `node --experimental-vm-modules` for ES modules.

- `baileys-service/patches/@whiskeysockets+baileys+6.7.18.patch`
  - Created by `patch-package`; contains the `libsignal.js` and `USyncQuery.js` patches.

- `baileys-service/node_modules/@whiskeysockets/baileys/lib/Signal/libsignal.js`
  - Patched: pre-key grace period (5-minute delayed deletion) and per-instance cleanup timer.

- `baileys-service/node_modules/@whiskeysockets/baileys/lib/WAUSync/USyncQuery.js`
  - Patched: null check on `result` before reading `attrs.type`.

- `baileys-service/src/config.js`
  - Added `HEALTH_PROBE_INTERVAL_MS`, `HEALTH_PROBE_TIMEOUT_MS`, `DEFAULT_QUERY_TIMEOUT_MS`, `PREKEY_ROTATION_INTERVAL_MS`, `SOFT_RESET_MAX_RETRIES` with validation.
  - **Updated:** `DEFAULT_QUERY_TIMEOUT_MS` default restored from `30000` to `60000` to give fresh QR links time for initial sync.

- `baileys-service/src/baileysClient.js`
  - Added health probe (`startHealthProbe`, `stopHealthProbe`, `healthProbeTimers`).
  - Added `isHealthProbeFailure` detection.
  - Added `createSocketLogger` proxy for init-query timeout interception.
  - Updated `makeWASocket` to use `createSocketLogger` and `DEFAULT_QUERY_TIMEOUT_MS`.
  - Updated `shutdownAllSessions` to clear health probe timers.
  - Updated `disconnectSession` to stop health probe.
  - **Updated:** `createSocketLogger` now logs init-query timeouts without forcibly ending the socket. Actual half-open detection is handled by the health probe.

- `baileys-service/src/auth-state-utils.js` (new)
  - Atomic credential backup, soft reset, and restore functions.
  - **Updated:** accepts an explicit `baseDir` parameter in all exported functions for test isolation.
  - **Updated:** `restoreCredsFromBackup` validates that `creds.json` contains required Baileys fields (`noiseKey`, `signedIdentityKey`, `signedPreKey`, `registrationId`, `advSecretKey`, `me`) before deciding a restore is unnecessary.

- `baileys-service/src/connection-controller.js`
  - Added proactive pre-key rotation (`startPreKeyRotation`, `stopPreKeyRotation`, `performPreKeyRotation`).
  - Added `recordActivity()` for the health probe.
  - Added soft reset retry logic in `handleCryptoError` using `softResetSession`.
  - Added `softResetRetries` counter reset on successful connection.
  - Added `unref()` on `preKeyRotationTimer`.

- `baileys-service/__tests__/robustness.test.js` (new)
  - 18 tests for auth-state-utils, health probe detection, socket logger, and config exports.
  - **Updated:** passes explicit temp `baseDir` to all `auth-state-utils` functions instead of mutating `process.env.AUTH_STATE_DIR`.
  - **Updated:** `createSocketLogger` test now asserts log-only behavior (no socket.end).

- `baileys-service/__tests__/connection-controller.test.js` (new)
  - 3 tests for pre-key rotation timer and soft reset flow.
  - **Updated:** mocks `auth-state-utils.js` with `jest.unstable_mockModule` to prevent real disk writes.

- `baileys-service/sample.env`
  - Documented the new robustness tuning environment variables.
  - **Updated:** `DEFAULT_QUERY_TIMEOUT_MS` default changed to `60000`.

## Fourth-pass: structured WhatsApp responses

- `server/agents/responseFormatter.js` (new)
  - Deterministic formatter for CRM entity replies on WhatsApp.
  - Supports lead, buyer, owner, tenant, contact, property, meeting, note, document, and metrics formats.
  - Single entity: bold header + bullets; multiple entities: numbered list.
  - Money normalization (₹80L, ₹1.5Cr, ₹45k), date formatting, and empty-state handling.
  - Handles delete confirmations, phone lookups, and meeting/document results.
  - Validation layer rejects raw JSON and falls back to a safe message.

- `server/agents/responseFormatter.test.js` (new)
  - Unit tests for all entity formatters, list truncation, validation, and reply sanitization.

- `server/agents/agentRuntime.js`
  - Applies `sanitizeAndFormatReply` to the final LLM text before returning it.

- `server/agents/prompts.js`
  - Updated whatsapp prompt to instruct the agent to use bullet points / numbered lists instead of paragraphs or raw JSON.
  - Added instructions for delete confirmation, phone lookup, contact role updates, meetings, and note tools.

- `server/skillInvoker.js`
  - Expanded tool registry to cover full chat-accessible CRUD:
    - Delete tools for lead, contact, property, owner, tenant.
    - Note read/write tools for lead, contact, owner, tenant, buyer.
    - Phone lookup tools for contact, owner, tenant.
    - Search/list improvements for owners and tenants.
    - Contact role update (`update_contact_role`).
    - Property document tools (`get_property_documents`, `create_property_document`, `delete_property_document`).
    - Meeting CRUD (`create_meeting`, `get_meeting`, `get_upcoming_meetings`, `update_meeting`, `delete_meeting`).
    - CRM metrics (`get_crm_metrics`).
  - All tools are routed to the correct `crmDynamodbService.js` functions.

- `server/skillInvoker.test.js` (new)
  - Unit tests for tool routing, validation, and the full `ALLOWED_TOOLS` registry.
  - **Updated:** added `delete_buyer` mock, registry check, and routing test.

## Fifth-pass: CRUD audit code review fixes

- `server/crmDynamodbService.js`
  - Added `deleteBuyer` function that handles legacy `BUYER` entities and CONTACT-as-buyer records.

- `server/skillInvoker.js`
  - **Updated:** added `delete_buyer` tool and import for `deleteBuyer`.
  - **Updated:** `update_contact_role` schema now includes optional `profileData` (type `object`).
  - **Updated:** `get_upcoming_meetings` uses nullish coalescing (`days ?? 7`) for the default window.

- `server/agents/responseFormatter.js`
  - **Updated:** `entityTypeFromToolName` now checks `document` before `property` so `create_property_document` / `delete_property_document` are formatted correctly.
  - **Updated:** `formatToolResult` calls `formatMetricsCard` directly for metrics instead of `formatSingleCard`, which lost the entity context.
  - **Updated:** `formatMetricsCard` uses a new `humanize()` helper for camelCase metric labels (e.g., `totalLeads` → `Total Leads`).
  - **Updated:** `formatDocumentCard` capitalizes the document type.
  - **Updated:** `detectEntityType` no longer uses generic `item.id` as a note fallback.

- `server/agents/prompts.js`
  - **Updated:** DELETE operations list now includes `delete_buyer`.

- `server/agents/responseFormatter.test.js`
  - **Updated:** added tests for meetings, notes, documents, metrics, delete confirmation, and the note-misclassification regression.

- `server/skillInvoker.test.js`
  - **Updated:** added `deleteBuyer` mock, registry check, and routing test.

## Sixth-pass: Gemini tool schema array items fix

- `server/skillInvoker.js`
  - **Updated:** `create_meeting` schema now declares `attendees` as a standard JSON Schema object (`{ type: 'array', items: { type: 'string' } }`) instead of a bare `'array'` type.
  - **Updated:** `validateInput` now handles both string type names and complex type definitions so array/object type definitions are validated correctly.

- `server/agents/agentRuntime.js`
  - **Updated:** `buildToolProperties` now emits `items` for array parameters when the schema defines them, supporting both the new nested structure and the legacy `schema.items[key]` shape for backward compatibility.
  - **Updated:** `buildGeminiToolDefinitions` and `buildAnthropicToolDefinitions` are now exported for testing.

- `server/agents/agentRuntime.test.js`
  - **Updated:** added tests verifying that every Gemini tool declaration with an array parameter includes an `items` schema, and that the `create_meeting` schema is valid for both Gemini and Anthropic.

## Documentation / context

- `working-context/` (this folder) — created as the session snapshot; updated in this session to reflect the third-pass changes.

## Deleted / cleanup

- `baileys-service/auth_state/918291537522` — deleted because the `creds.json` and `creds.json.bak` files were corrupted by test fixture writes.
- `baileys-service/__test_config.mjs` — deleted earlier (stale IDE tab may remain).
