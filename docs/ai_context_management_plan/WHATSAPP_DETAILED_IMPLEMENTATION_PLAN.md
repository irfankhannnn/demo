# WhatsApp Detailed Implementation Plan

## Document Purpose

This is the executable, phase-by-phase implementation plan derived from `WHATSAPP_ARCHITECTURE_REFACTOR_PLAN.md`. Each phase is broken into small, independently reviewable chunks with concrete files, acceptance criteria, and dependencies. The phases are ordered chronologically: later phases assume earlier phases are merged, tested, and stable.

**Working principle:** Implement one chunk at a time. Do not start a chunk until all its dependencies are marked done. Each chunk must have a passing test or verification step before it is considered complete.

---

## Phase 0: Pre-Phase-1 Quick Fixes

**Goal:** Fix the bugs, security holes, and breaking changes identified in the code review before the larger refactor begins. These are small, isolated changes that can be merged quickly.

**Entry criteria:** Current WhatsApp branch is stable enough to build and run locally.  
**Exit criteria:** All P0 chunks merged, unit tests added, and the existing WhatsApp flows (pairing, inbox, send) work without regression.

### P0.1 — Fix `jidToPhone` ReferenceError in `baileysClient.js`

**Files:**
- `baileys-service/src/baileysClient.js`

**Sub-tasks:**
1. Verify that `jidToPhone` is defined at module top level and is callable from `handleIncomingMessage`.
2. Remove any nested/local re-declarations of `jidToPhone` inside `createSession` or `handleIncomingMessage`.
3. Add a unit test in `baileys-service/__tests__/baileysClient.test.js` (or create the file) that passes a sample message with `key.participant` set and verifies `handleIncomingMessage` does not throw.
4. Run the Bailey service locally and send a test message to confirm no `ReferenceError`.

**Acceptance criteria:**
- `baileysClient.js` starts without errors.
- Unit test for group/self-chat message processing passes.
- No `ReferenceError: jidToPhone is not defined` in logs.

**Estimated effort:** 1–2 hours  
**Dependencies:** None

---

### P0.2 — Add Authentication to Bailey Pairing Routes

**Files:**
- `baileys-service/src/routes/pairing.js`
- `baileys-service/src/middleware/apiKeyAuth.js` (new)
- `baileys-service/src/config.js`
- `agency-app/api/bailey.js`

**Sub-tasks:**
1. Add a new `BAILEY_SERVICE_API_KEY` environment variable to `baileys-service/sample.env` and `.env`.
2. Create `baileys-service/src/middleware/apiKeyAuth.js` that checks `Authorization: Bearer <key>` or `x-api-key` header against `BAILEY_SERVICE_API_KEY`.
3. Apply the middleware to all routes in `baileys-service/src/routes/pairing.js` (`/qr`, `/status/:phone`, `/logout`).
4. Update `agency-app/api/bailey.js` to send the API key in all outgoing requests to the Bailey service (`getPairingQr`, `sendWhatsAppMessage`, `disconnectWhatsApp`, `getConnectionStatus`).
5. Add rate-limiting middleware to `/qr` and `/logout` (max 5 requests per phone per minute).
6. Add tests for unauthorized requests returning 401/403.

**Acceptance criteria:**
- Requests without a valid API key to `/pairing/*` return 401.
- `agency-app/api/bailey.js` always sends the API key.
- Rate limit kicks in after 5 requests per minute per phone.

**Estimated effort:** 3–4 hours  
**Dependencies:** None

---

### P0.3 — Revert or Version the WhatsApp API Endpoint Path Change

**Files:**
- `agency-app/web/src/services/api.ts`
- `agency-app/api/routes/whatsappConversations.js`
- `server/index.js` or wherever the router is mounted

**Sub-tasks:**
1. Revert the endpoint paths in `api.ts` back to `/api/whatsapp/*` (e.g., `/api/whatsapp/conversations`, `/api/whatsapp/conversations/:phone`, `/api/whatsapp/conversations/:phone/read`).
2. Verify the server mounts the `whatsappConversations` router at `/api/whatsapp`.
3. If the server currently mounts at `/whatsapp`, update the mount path to `/api/whatsapp`.
4. Add a temporary redirect from `/whatsapp/*` to `/api/whatsapp/*` if any clients already deployed with the new path.
5. Run frontend build and confirm no TypeScript errors.

**Acceptance criteria:**
- All WhatsApp API calls from the frontend use `/api/whatsapp/*`.
- Server routes respond correctly at `/api/whatsapp/*`.
- No 404s from the frontend.

**Estimated effort:** 1–2 hours  
**Dependencies:** None

---

### P0.4 — Fix Silent API Failures in `ConnectWhatsApp.tsx`

**Files:**
- `agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx`

**Sub-tasks:**
1. Update `saveConnectedPhone()` to await `api.updateAiEmployeeConfig()` and show a warning toast if it fails.
2. Update `clearConnectedPhone()` similarly.
3. If the sync fails, do not transition the UI to the connected state; keep it in the pairing state so the user can retry.
4. Add a loading/disabled state to the connect/disconnect buttons while the async operation is running.
5. Add a unit test with MSW or manual mock that simulates a failed API call and asserts the UI stays in the correct state.

**Acceptance criteria:**
- Failed config sync shows a user-visible error.
- UI state does not advance if sync fails.
- Buttons are disabled during the operation.

**Estimated effort:** 2–3 hours  
**Dependencies:** P0.3

---

### P0.5 — Add Unit Tests for `agency-app/api/utils/whatsapp.js`

**Files:**
- `agency-app/api/utils/whatsapp.js`
- `agency-app/api/utils/whatsapp.test.js` (new)

**Sub-tasks:**
1. Create `agency-app/api/utils/whatsapp.test.js` using the project's test framework (Jest/Vitest).
2. Add test cases for `normalizeWhatsAppPhone` covering:
   - `+91 98765 43210`
   - `918291537522@s.whatsapp.net`
   - `918291537522:94@s.whatsapp.net`
   - `10076144300114@lid`
   - `120363000000000000@g.us`
   - Empty/null inputs
3. Add test cases for `classifyWhatsAppId` covering phone, LID, group, and unknown types.
4. Run the tests and ensure they pass.
5. Add a CI step if one exists to run these tests.

**Acceptance criteria:**
- All utility tests pass.
- Edge cases (null, malformed) are handled gracefully.

**Estimated effort:** 2–3 hours  
**Dependencies:** None

---

### P0.6 — Normalize Phone Validation in `aiEmployeeConfig.js`

**Files:**
- `agency-app/api/routes/aiEmployeeConfig.js`

**Sub-tasks:**
1. Strip all non-digit characters and leading `+` before validating `connectedWhatsAppPhone`.
2. Validate that the normalized number is 10–15 digits and starts with a valid country code.
3. Store the normalized value in the agency config.
4. Add unit tests for the validation function.
5. Verify the frontend can paste formatted numbers like `+91 98765 43210` and they are accepted.

**Acceptance criteria:**
- Formatted phone numbers are accepted and stored normalized.
- Invalid numbers (e.g., letters, too short) still return 400.

**Estimated effort:** 1–2 hours  
**Dependencies:** None

---

### P0.7 — Use UUID for Outbound Message IDs

**Files:**
- `agency-app/api/routes/whatsappConversations.js`

**Sub-tasks:**
1. Replace `Date.now() - Math.random()` with `crypto.randomUUID()` for `messageId`.
2. If the Bailey service returns a real message ID, store that as the canonical `messageId` instead of the generated one.
3. Ensure `logMessage` receives the same ID that is returned to the frontend.
4. Add a test that verifies the generated ID is unique across 1000 calls.

**Acceptance criteria:**
- No two generated IDs collide in a reasonable test.
- The returned message ID matches the persisted one.

**Estimated effort:** 1 hour  
**Dependencies:** None

---

## Phase 1: Connection Stability Foundation

**Goal:** Eliminate the root-cause `PreKeyError` / `Bad MAC` issue and make the connection resilient to transient failures.

**Entry criteria:** Phase 0 complete and merged.  
**Exit criteria:** Bailey service can detect PreKey exhaustion, delete corrupted auth state, generate a fresh QR, and notify the CRM. All connection states are observable via metrics and a health endpoint.

### P1.0 — Implement PreKey Exhaustion Recovery

**Files:**
- `baileys-service/src/prekey-recovery.js` (new)
- `baileys-service/src/config.js`
- `agency-app/api/routes/auth.js` (or new webhook route)
- `agency-app/api/services/notificationService.js` (modify if exists)
- `agency-app/web/src/pages/crm/CRMDashboard.tsx`

**Sub-tasks:**
1. Create `prekey-recovery.js` with:
   - A `Map<phone, consecutiveErrorCount>`.
   - A `Map<phone, lastFreshSessionAt>` for rate-limiting (max 1 per 30 minutes).
   - A `recordCryptoError(phone, errorType)` function that increments the counter and decides transient vs persistent.
   - A `resetCryptoErrorCount(phone)` function called on successful message decryption.
   - A `triggerFreshSession(phone)` function that:
     - Stops reconnect attempts.
     - Deletes the auth state directory with `fs.rm(authDir, { recursive: true, force: true })`.
     - Transitions connection state to `fresh_link_required`.
     - Generates a fresh QR via `createSession(phone)`.
     - Emits a `fresh_link_required` event.
     - Calls the CRM webhook with phone, QR, and reason.
2. Add `CRYPTO_ERROR_FRESH_SESSION_THRESHOLD` (default 3) and `FRESH_SESSION_RATE_LIMIT_MS` (default 30 minutes) to `baileys-service/src/config.js` and `sample.env`.
3. Add `POST /webhooks/bailey/fresh-link-required` in `agency-app/api/routes/auth.js` (or a dedicated webhook route) that:
   - Validates the Bailey webhook signature.
   - Stores an alert in DynamoDB (`TENANT#<tenantId>#ALERT#WHATSAPP_FRESH_LINK`).
   - Emits a Socket.IO event or publishes to a real-time channel for the CRM dashboard.
   - Sends an email to the owner if email is configured.
4. Update the CRM dashboard to show a "WhatsApp re-linking required" banner with the QR code and a "I've scanned the QR" button.
5. Add unit tests for `prekey-recovery.js` covering:
   - Counter increments on crypto error.
   - Counter resets on successful message.
   - Transient error does not trigger fresh session.
   - Threshold triggers fresh session.
   - Rate-limit prevents rapid re-link.

**Acceptance criteria:**
- After 3 consecutive crypto errors, auth state is deleted and a fresh QR is generated.
- CRM receives the webhook and displays the banner.
- Transient single errors do not trigger fresh session.
- Rate-limit prevents more than 1 fresh session per 30 minutes per phone.

**Estimated effort:** 8–12 hours  
**Dependencies:** P0.1, P0.2

---

### P1.1 — Implement Credential Backup/Restore

**Files:**
- `baileys-service/src/auth-store.js` (new)
- `baileys-service/src/baileysClient.js`

**Sub-tasks:**
1. Create `auth-store.js` that wraps `useMultiFileAuthState`:
   - On every `creds.update`, write to `creds.json` and `creds.json.bak` atomically (write to temp, fsync, rename).
   - On read, validate `creds.json` is parseable. If corrupted, restore from `creds.json.bak`.
   - If both are corrupted, delete the auth directory and emit `credentials_lost`.
   - Set file permissions to `0600` on POSIX; on Windows, restrict ACLs if possible.
2. Add structured audit logging for every read, write, and restore operation.
3. Keep only the last backup (`creds.json.bak`).
4. Integrate `auth-store.js` into `baileysClient.js` so it replaces the direct `useMultiFileAuthState` call.
5. Add unit tests with a temporary auth directory to simulate corruption and restore.

**Acceptance criteria:**
- `creds.json.bak` is created on every credential save.
- Corrupted `creds.json` is restored from backup.
- Both-files-corrupted scenario triggers fresh QR instead of crash.
- Audit logs contain operation type, phone, and timestamp.

**Estimated effort:** 6–8 hours  
**Dependencies:** P0.1

---

### P1.2 — Implement Crypto Error Detection

**Files:**
- `baileys-service/src/crypto-error-detector.js` (new)
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/prekey-recovery.js`

**Sub-tasks:**
1. Create `crypto-error-detector.js` with `isLikelyWhatsAppCryptoError(error)` that matches:
   - `Bad MAC`
   - `PreKeyError`
   - `No matching sessions`
   - `Unsupported state`
   - Any Baileys error with a relevant `data` or `code` field.
2. Add a rate-limiter for forced reconnects (max 3 per 5 minutes per phone).
3. In `baileysClient.js`, wrap the `messages.upsert` handler and connection error handlers to detect crypto errors and delegate to `crypto-error-detector.js`.
4. If the consecutive crypto error count is below the threshold, force an immediate reconnect with the same credentials.
5. If the count is at or above the threshold, delegate to `prekey-recovery.js` for fresh session creation.
6. Add structured logging with `phone`, `errorType`, `consecutiveCount`, and `threshold`.
7. Add unit tests for the error classifier and the rate-limiter.

**Acceptance criteria:**
- Crypto errors are detected and logged with structured fields.
- Forced reconnects are rate-limited.
- Below-threshold errors trigger reconnect; at-threshold errors trigger fresh session.

**Estimated effort:** 4–6 hours  
**Dependencies:** P1.0, P1.1

---

### P1.3 — Implement Watchdog Timer

**Files:**
- `baileys-service/src/watchdog.js` (new)
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/config.js`

**Sub-tasks:**
1. Create `watchdog.js` with a `Watchdog` class that:
   - Accepts `messageTimeoutMs` (default 10 minutes) and `checkIntervalMs` (default 60 seconds).
   - Tracks the timestamp of the last inbound message or successful heartbeat.
   - On each check, if the elapsed time exceeds the timeout, calls a provided `onTimeout` callback.
2. Add `WATCHDOG_MESSAGE_TIMEOUT_MS` and `WATCHDOG_CHECK_MS` to `config.js` and `sample.env`.
3. Integrate the watchdog into `baileysClient.js`:
   - Start on connection open.
   - Reset on every inbound message and on every heartbeat.
   - On timeout, force-close the socket to trigger the reconnect policy.
4. Add a unit test that simulates a stale connection and verifies the timeout callback fires.

**Acceptance criteria:**
- Watchdog starts when connection opens and stops when it closes.
- Timeout fires after no messages for the configured duration.
- Timeout forces a socket close and reconnect.

**Estimated effort:** 3–4 hours  
**Dependencies:** P0.1

---

### P1.4 — Implement Reconnection Policy

**Files:**
- `baileys-service/src/reconnect-policy.js` (new)
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/config.js`

**Sub-tasks:**
1. Create `reconnect-policy.js` that:
   - Tracks attempts per phone with a sliding window.
   - Computes exponential backoff (initial 2s, max 30s, factor 1.8) with 25% jitter.
   - Detects non-retryable status codes (440 conflict, 401 logged out) and stops immediately.
   - Detects rate-limit signals (HTTP 429, WhatsApp-specific throttle) and uses extended backoff (min 60s, max 300s).
   - Detects network partitions (`ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT`) and uses longer max backoff (60s).
   - Max 12 attempts before entering `degraded` state.
2. Add `RECONNECT_POLICY_*` config variables to `config.js` and `sample.env`.
3. Replace the existing simple reconnect rate-limiting in `baileysClient.js` with the new policy.
4. Add unit tests for backoff calculation, status code detection, and attempt exhaustion.

**Acceptance criteria:**
- Backoff increases exponentially with jitter.
- 440 and 401 stop reconnect attempts.
- 429 uses extended backoff.
- After 12 attempts, state becomes `degraded`.

**Estimated effort:** 4–6 hours  
**Dependencies:** P0.1

---

### P1.5 — Implement Connection State Machine

**Files:**
- `baileys-service/src/connection-state.js` (new)
- `baileys-service/src/baileysClient.js`

**Sub-tasks:**
1. Create `connection-state.js` with:
   - States: `starting`, `healthy`, `stale`, `reconnecting`, `conflict`, `logged-out`, `stopped`, `degraded`, `fresh_link_required`.
   - A `transition(newState)` method that validates legal transitions and emits events.
   - Timestamp tracking: `lastConnectedAt`, `lastInboundAt`, `lastEventAt`, `lastCryptoErrorAt`, `consecutiveCryptoErrors`.
2. Define legal transitions (e.g., `starting → healthy`, `healthy → stale`, `stale → reconnecting`, `reconnecting → healthy|degraded|conflict|logged-out|fresh_link_required`, etc.).
3. Log and reject illegal transitions.
4. Integrate the state machine into `baileysClient.js` so every connection update goes through it.
5. Add unit tests for all legal transitions and a sample of illegal transitions.

**Acceptance criteria:**
- All connection updates map to a valid state.
- Illegal transitions are logged and rejected.
- State machine emits events on every transition.
- Timestamps are updated correctly.

**Estimated effort:** 4–6 hours  
**Dependencies:** P0.1

---

### P1.6 — Implement Connection Controller

**Files:**
- `baileys-service/src/connection-controller.js` (new)
- `baileys-service/src/baileysClient.js`

**Sub-tasks:**
1. Create `connection-controller.js` with a `ConnectionController` class that:
   - Owns the socket, state machine, watchdog, reconnect policy, and pending deliveries.
   - Provides a `socketRef` object so outbound sends always use the current socket.
   - Uses a per-phone mutex to prevent concurrent connection attempts.
   - Queues or rejects duplicate QR requests for the same phone while a connection is starting.
   - Handles graceful shutdown: clear timers, remove listeners, end socket.
2. Integrate the controller into `baileysClient.js` so it replaces the simple `sessions` Map.
3. Add a feature flag `BAILEY_USE_NEW_CONTROLLER` (default `true`) that falls back to the legacy session Map when `false`.
4. Add unit tests for concurrent connection attempts, duplicate QR requests, and graceful shutdown.

**Acceptance criteria:**
- Only one connection attempt per phone at a time.
- Duplicate QR requests return the in-progress QR.
- Graceful shutdown cleans up all resources.
- Feature flag toggles between new controller and legacy code.

**Estimated effort:** 8–12 hours  
**Dependencies:** P1.3, P1.4, P1.5

---

### P1.7 — Refactor `baileysClient.js` and Migrate Existing Sessions

**Files:**
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/index.js`
- `baileys-service/src/config.js`

**Sub-tasks:**
1. Replace the legacy session Map with the new connection controller.
2. Integrate `auth-store.js`, `crypto-error-detector.js`, `watchdog.js`, `reconnect-policy.js`, `connection-state.js`, and `connection-controller.js`.
3. On startup, detect existing auth directories and migrate them to the controller-managed structure without forcing re-pairing.
4. Ensure `restoreSessions()` works with the new controller.
5. Add a health check endpoint `GET /pairing/health` that returns state, uptime, and last message timestamp.
6. Add end-to-end tests that pair, disconnect, reconnect, and simulate crypto errors.
7. Run the full Bailey service test suite.

**Acceptance criteria:**
- Existing paired sessions continue to work after the refactor.
- All connection states are observable via `/pairing/health` and metrics.
- Feature flag `BAILEY_USE_NEW_CONTROLLER` can disable the new behavior.

**Estimated effort:** 10–16 hours  
**Dependencies:** P1.0, P1.1, P1.2, P1.3, P1.4, P1.5, P1.6

---

## Phase 2: Message Processing Robustness

**Goal:** Ensure no message loss during reconnections and reliable outbound/inbound message handling.

**Entry criteria:** Phase 1 complete and the new connection controller is stable.  
**Exit criteria:** Messages sent during reconnect are delivered, replies work across reconnections, and the system handles queue overflow gracefully.

### P2.1 — Implement Socket Reference Following

**Files:**
- `baileys-service/src/connection-controller.js`
- `baileys-service/src/baileysClient.js`

**Sub-tasks:**
1. Expose a `socketRef` object from `connection-controller.js` that always points to the current socket.
2. Update `sendMessage()` in `baileysClient.js` to read from `socketRef.current`.
3. If `socketRef.current` is null (reconnecting), wait up to 2 seconds for a new socket before failing.
4. Add a test that sends a message while reconnecting and verifies it uses the new socket.

**Acceptance criteria:**
- Outbound sends always use the current socket.
- Sends during reconnect either wait briefly or fail with a clear error.

**Estimated effort:** 2–3 hours  
**Dependencies:** P1.6

---

### P2.2 — Implement Drain Pending Deliveries

**Files:**
- `baileys-service/src/pending-deliveries.js` (new)
- `baileys-service/src/connection-controller.js`
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/config.js`

**Sub-tasks:**
1. Create `pending-deliveries.js` with a queue that stores minimal entries (`messageId`, `to`, `text`, `timestamp`).
2. Set max queue size to 1000 (configurable via `PENDING_DELIVERIES_MAX_SIZE`).
3. On overflow, drop the oldest entries and emit `pending_deliveries_overflow` with a count of dropped messages.
4. Integrate into the connection controller: enqueue messages when the socket is not `open`, drain the queue (FIFO) when the socket becomes `open`.
5. Handle specific errors like `No active listener` by bypassing the queue for that message.
6. Clear the queue on graceful shutdown.
7. Add unit tests for enqueue, drain, overflow, and clear.

**Acceptance criteria:**
- Messages sent during reconnect are queued and delivered after reconnect.
- Queue overflow drops oldest messages and emits an event.
- Queue is cleared on shutdown.

**Estimated effort:** 4–6 hours  
**Dependencies:** P1.6, P2.1

---

### P2.3 — Implement Non-Retryable Status Detection

**Files:**
- `baileys-service/src/reconnect-policy.js`
- `baileys-service/src/connection-controller.js`

**Sub-tasks:**
1. Update `reconnect-policy.js` to classify disconnect status codes:
   - 440 → transition to `conflict`, stop reconnect.
   - 401 → transition to `logged-out`, clear credentials, stop reconnect.
   - 500/503 → retry with extended backoff.
   - 515 (stream error) → allow reconnect with same credentials.
2. Update `connection-controller.js` to use these classifications.
3. Add unit tests for each status code and the resulting state.

**Acceptance criteria:**
- 440 and 401 stop reconnect attempts.
- 500/503 retry with longer backoff.
- State transitions are correct.

**Estimated effort:** 2–3 hours  
**Dependencies:** P1.4, P1.6

---

### P2.4 — Improve Deduplication and Memory Management

**Files:**
- `baileys-service/src/baileysClient.js`
- `baileys-service/src/config.js`

**Sub-tasks:**
1. Move `markMessageProcessed` so it runs **after** the message has been validated and accepted for forwarding. Undecryptable messages should not be marked as processed.
2. Add a periodic cleanup job for `processedMessageIds` (e.g., every 15 minutes evict the oldest 10%).
3. Defensively rewrite `markMessageProcessed` to avoid race-prone size snapshots (use a single check-delete-set path).
4. Add metrics: `whatsapp_processed_ids_size` gauge.
5. Add tests for deduplication after validation and cleanup behavior.

**Acceptance criteria:**
- Undecryptable messages are not marked processed.
- `processedMessageIds` size is bounded and periodically cleaned.
- Duplicate messages are still suppressed.

**Estimated effort:** 3–4 hours  
**Dependencies:** P0.1, P1.7

---

### P2.5 — Frontend Optimistic UI for Message Sending

**Files:**
- `agency-app/web/src/pages/crm/WhatsAppInbox.tsx`
- `agency-app/web/src/components/WhatsAppChatThread.tsx`

**Sub-tasks:**
1. In `WhatsAppInbox.tsx`, update `handleSendMessage` to immediately add a pending message to the local `messages` state with `status: 'pending'` and a generated UUID.
2. On API success, update the pending message to `status: 'sent'` and replace the ID with the server-returned ID if available.
3. On API failure, mark the message as `failed` and allow retry.
4. Add a 4096-character limit to the input with a counter.
5. Add Enter-to-send and Shift+Enter-for-new-line behavior.
6. Add unit tests for optimistic updates and retry.

**Acceptance criteria:**
- Sent message appears immediately in the chat.
- Failed messages show a retry option.
- Character limit is enforced.
- Enter sends, Shift+Enter inserts a new line.

**Estimated effort:** 4–6 hours  
**Dependencies:** P0.4, P0.7

---

## Phase 3: User Category System

**Goal:** Implement Owner/Whitelisted/External customer access control with feature toggles.

**Entry criteria:** Phase 2 complete and message processing is robust.  
**Exit criteria:** Every incoming message is categorized, access control is enforced, and feature toggles work per category.

### P3.1 — DynamoDB Schema and Migration for User Categories

**Files:**
- `infra/cfn-whatsapp-user-categories.yaml` (new)
- `infra/deploy.sh` (new or modify existing)
- `server/models/userCategory.js` (new)
- Migration script

**Sub-tasks:**
1. Design the DynamoDB table `WhatsAppUserCategories`:
   - PK: `TENANT#<tenantId>`
   - SK: `USER#<normalizedPhone>`
   - Attributes: `category` (owner/whitelisted/external), `accessLevel`, `features`, `permissions`, `updatedAt`, `updatedBy`.
2. Create CloudFormation template following `global_rules.md` with all required parameters.
3. Create `deploy.sh` for the new table.
4. Create `server/models/userCategory.js` with CRUD operations.
5. Write a migration script that seeds the default Owner from the tenant's configured `connectedWhatsAppPhone`.
6. Run the migration in a local/dev environment.

**Acceptance criteria:**
- Table is created via CFN with correct keys and indexes.
- Migration script runs without errors and seeds the owner.
- Model layer supports CRUD and query by tenant.

**Estimated effort:** 6–8 hours  
**Dependencies:** None (can start in parallel with Phase 2)

---

### P3.2 — Implement Category Resolution Service

**Files:**
- `agency-app/api/services/userCategoryService.js` (new)
- `agency-app/api/utils/whatsapp.js`

**Sub-tasks:**
1. Create `userCategoryService.js` with:
   - `resolveCategory(tenantId, phone)` that checks the connected owner phone first, then the whitelist, then defaults to `external`.
   - In-memory cache with 5-minute TTL and max 10,000 entries with LRU eviction.
   - Cache invalidation on manual category updates.
2. Integrate with `agency-app/api/utils/whatsapp.js` for normalization.
3. Add unit tests for owner, whitelisted, external, and unknown numbers.
4. Add tests for cache TTL and eviction.

**Acceptance criteria:**
- Owner phone resolves to `owner`.
- Whitelisted numbers resolve to `whitelisted`.
- Unknown numbers resolve to `external`.
- Cache respects TTL and LRU eviction.

**Estimated effort:** 4–6 hours  
**Dependencies:** P3.1, P0.5

---

### P3.3 — Implement Feature Toggle Service

**Files:**
- `agency-app/api/services/featureToggleService.js` (new)
- `server/models/agencyConfig.js` (modify if needed)

**Sub-tasks:**
1. Define default feature sets per category:
   - Owner: all features (ai_reply, manual_send, view_inbox, manage_settings).
   - Whitelisted: configurable subset.
   - External: minimal (e.g., ai_reply only if enabled, no inbox access).
2. Create `featureToggleService.js` that evaluates whether a feature is enabled for a given category.
3. Store overrideable feature sets in agency config.
4. Add unit tests for default and overridden toggles.

**Acceptance criteria:**
- Features are correctly enabled/disabled per category.
- Overrides from agency config take effect.

**Estimated effort:** 3–4 hours  
**Dependencies:** P3.1

---

### P3.4 — Implement Access Control Service

**Files:**
- `agency-app/api/services/whatsappAccessControl.js` (new)
- `agency-app/api/services/userCategoryService.js`
- `agency-app/api/services/featureToggleService.js`

**Sub-tasks:**
1. Create `whatsappAccessControl.js` with policies:
   - DM policies: `owner-only`, `allowlist`, `open`, `disabled`.
   - Group policies: `open`, `disabled`, `allowlist`.
   - Default secure policy: `owner-only` when unconfigured.
2. Implement `canReceive(tenantId, contactPhone, category)` and `canReply(tenantId, contactPhone, category)`.
3. Integrate category resolution and feature toggles.
4. Add unit tests for all policy combinations.

**Acceptance criteria:**
- Default unconfigured policy is owner-only.
- DM and group policies are enforced correctly.
- Access decisions are logged.

**Estimated effort:** 4–6 hours  
**Dependencies:** P3.2, P3.3

---

### P3.5 — Integrate Category System into Message Processor

**Files:**
- `agency-app/api/scripts/whatsapp-message-processor.js`
- `agency-app/api/routes/webhooks.js`
- `agency-app/api/whatsappConversationService.js`

**Sub-tasks:**
1. Before processing any incoming message, call `resolveCategory()` and `canReceive()`.
2. If access is denied, log the reason and return a skipped response (no AI invocation).
3. Pass the category and allowed features to the agent runtime so the AI can adapt its behavior.
4. Update `whatsappConversationService.js` so the conversation filter uses the database-driven category/whitelist instead of the global `WHITELISTED_NUMBERS` env variable.
5. Add tests for owner self-chat, whitelisted user, external customer, and denied group.

**Acceptance criteria:**
- Incoming messages are categorized before AI processing.
- Access control decisions are enforced.
- Category and feature context are passed to the AI.
- Inbox filtering uses the database-driven allowlist.

**Estimated effort:** 4–6 hours  
**Dependencies:** P3.4, P2.4

---

## Phase 4: AI Integration

**Goal:** Replace the minimal hardcoded prompt with rich prompts from the ai-employee documentation and use REST API tool execution.

**Entry criteria:** Phase 3 complete and user categories are enforced.  
**Exit criteria:** The AI uses rich prompts, executes tools via REST API, and behaves correctly per user category.

### P4.1 — Read and Extract ai-employee Documentation

**Files:**
- `ai-employee/IDENTITY.md`
- `ai-employee/MEMORY.md`
- `ai-employee/AGENTS.md`

**Sub-tasks:**
1. Read all three documents.
2. Extract:
   - Identity/personality rules from `IDENTITY.md`.
   - Context/memory rules from `MEMORY.md`.
   - Agent definitions and tool rules from `AGENTS.md`.
3. Document which rules are WhatsApp-specific and which need adaptation.
4. Create a brief internal summary document if needed.

**Acceptance criteria:**
- All relevant rules and prompts are extracted.
- WhatsApp-specific adaptations are documented.

**Estimated effort:** 2–3 hours  
**Dependencies:** None

---

### P4.2 — Design WhatsApp Agent Prompt

**Files:**
- `agency-app/api/agents/whatsapp-agent-prompt.js` (new)

**Sub-tasks:**
1. Create `whatsapp-agent-prompt.js` that composes a system prompt from:
   - Identity block from `IDENTITY.md`.
   - Memory/context block from `MEMORY.md`.
   - Agent rules from `AGENTS.md`.
   - User category instructions (owner vs whitelisted vs external).
   - Feature-aware instructions (e.g., if auto-reply is off, explain that).
2. Ensure the prompt enforces "NEVER write internal reasoning" and similar rules.
3. Add unit tests that verify the prompt contains the required sections and does not leak internal instructions.

**Acceptance criteria:**
- Prompt contains all required sections.
- Category-specific and feature-aware instructions are injected correctly.
- No internal reasoning is exposed in the final prompt.

**Estimated effort:** 4–6 hours  
**Dependencies:** P4.1, P3.5

---

### P4.3 — Implement REST API Tool Executor

**Files:**
- `agency-app/api/agents/whatsapp-tool-executor.js` (new)
- `agency-app/api/services/apiClient.js` (new or modify existing)

**Sub-tasks:**
1. Create `whatsapp-tool-executor.js` that:
   - Accepts a tool name and parameters.
   - Maps tools to internal CRM REST API endpoints (e.g., create lead, search properties, add note).
   - Makes authenticated internal API calls using the tenant's JWT or an internal API key.
   - Retries up to 3 times with exponential backoff.
   - Parses and returns the response.
2. Add a tool registry that documents each tool's parameters and endpoint.
3. Add unit tests with mocked API responses and retry scenarios.

**Acceptance criteria:**
- Tools map to the correct CRM endpoints.
- Retry logic works on transient failures.
- Errors are returned in a format the agent can understand.

**Estimated effort:** 6–8 hours  
**Dependencies:** None (can start in parallel with P4.2)

---

### P4.4 — Integrate Agent Runtime

**Files:**
- `agency-app/api/agents/agentRuntime.js`
- `agency-app/api/scripts/whatsapp-message-processor.js`

**Sub-tasks:**
1. Modify `agentRuntime.js` to:
   - Use the WhatsApp agent prompt from `whatsapp-agent-prompt.js`.
   - Use the REST API tool executor from `whatsapp-tool-executor.js`.
   - Receive `category` and `features` context from the message processor.
2. Update `whatsapp-message-processor.js` to pass the resolved category and features to `invokeAgent`.
3. Ensure the agent response is logged in the conversation service.
4. Add tests for category-aware behavior (e.g., owner can ask for admin actions, external user cannot).

**Acceptance criteria:**
- Agent uses the new prompt and tool executor.
- Category and features are passed through.
- Agent responses are persisted.

**Estimated effort:** 4–6 hours  
**Dependencies:** P4.2, P4.3, P3.5

---

### P4.5 — Test AI Integration End-to-End

**Files:**
- All files under `agency-app/api/agents/`
- `agency-app/api/scripts/whatsapp-message-processor.js`

**Sub-tasks:**
1. Run end-to-end tests with sample WhatsApp messages:
   - Lead creation command.
   - Property search.
   - Area validation question.
   - Owner-only admin command.
2. Verify rich responses with proper context.
3. Verify correct REST API tool execution.
4. Verify rule enforcement (no internal reasoning).
5. Verify category-aware behavior.

**Acceptance criteria:**
- All sample messages produce correct responses and actions.
- Tools execute via REST API, not direct DB access.
- Rules from ai-employee docs are enforced.

**Estimated effort:** 4–6 hours  
**Dependencies:** P4.4

---

## Phase 5: Testing, Observability & Validation

**Goal:** Validate the entire system, add monitoring, and ensure production readiness.

**Entry criteria:** Phases 1–4 complete.  
**Exit criteria:** All tests pass, metrics and alarms are live, rollback is verified, and the system is production-ready.

### P5.1 — Connection Stability Tests

**Files:**
- `baileys-service/__tests__/` (create/update tests)

**Sub-tasks:**
1. Test PreKey exhaustion recovery:
   - Consecutive crypto error counting.
   - Threshold triggers fresh session.
   - Transient errors do not trigger fresh session.
   - Rate-limit prevents rapid re-link.
   - `fresh_link_required` state transitions.
   - CRM webhook receives the event.
2. Test credential backup/restore (including both-files-corrupted fallback).
3. Test crypto error detection and reconnect rate-limit.
4. Test watchdog timer.
5. Test reconnection policy (440, 401, 429, network errors).
6. Test connection state machine (legal and illegal transitions).
7. Test connection locking and concurrent QR requests.
8. Test existing session migration.

**Acceptance criteria:**
- All connection stability tests pass.
- Each failure scenario is covered by a test.

**Estimated effort:** 8–12 hours  
**Dependencies:** P1.7, P2.3

---

### P5.2 — Message Processing Tests

**Files:**
- `baileys-service/__tests__/` and `server/__tests__/` (create/update tests)

**Sub-tasks:**
1. Test socket reference following.
2. Test drain pending deliveries (including overflow).
3. Test non-retryable status detection.
4. Test deduplication (including undecryptable message handling).
5. Test outbound message endpoint (success, missing text, unauthorized recipient, rate limit, Bailey disabled, persistence).
6. Test pagination for filtered conversations.
7. Test N+1 query fix in `listConversations`.

**Acceptance criteria:**
- All message processing tests pass.
- No message loss during reconnections.
- Access control and rate limiting work.

**Estimated effort:** 6–8 hours  
**Dependencies:** P2.2, P2.5, P3.5

---

### P5.3 — User Category and AI Integration Tests

**Files:**
- `agency-app/api/services/__tests__/` (create/update tests)
- `agency-app/api/agents/__tests__/` (create/update tests)

**Sub-tasks:**
1. Test category resolution (owner, whitelisted, external, cache behavior).
2. Test feature toggles and overrides.
3. Test access control policies (DM and group).
4. Test owner self-chat, whitelisted user access, external customer access.
5. Test rich prompt composition.
6. Test REST API tool executor.
7. Test agent runtime category-aware behavior.
8. Test rule enforcement (no internal reasoning).

**Acceptance criteria:**
- All category and AI tests pass.
- Access control decisions are correct.
- Agent behavior is category-aware.

**Estimated effort:** 6–8 hours  
**Dependencies:** P3.5, P4.5

---

### P5.4 — End-to-End Tests

**Files:**
- E2E test suite (location depends on project convention)

**Sub-tasks:**
1. Write E2E test for the complete message flow: incoming WhatsApp → webhook → processor → agent → outbound reply → conversation inbox.
2. Write E2E test for reconnection scenarios.
3. Write E2E test for PreKey exhaustion recovery.
4. Write E2E test for user category scenarios.
5. Run the full E2E suite in a local/dev environment.

**Acceptance criteria:**
- All E2E tests pass.
- Each test covers a complete user journey.

**Estimated effort:** 8–12 hours  
**Dependencies:** P5.1, P5.2, P5.3

---

### P5.5 — Observability and Monitoring

**Files:**
- `baileys-service/src/metrics.js` (new)
- `baileys-service/src/config.js`
- CloudWatch dashboard config (optional)
- `infra/` CloudFormation updates

**Sub-tasks:**
1. Add a `metrics.js` module in `baileys-service` that publishes CloudWatch metrics:
   - `whatsapp_connection_state` gauge.
   - `whatsapp_reconnect_attempts` counter.
   - `whatsapp_crypto_errors` counter.
   - `whatsapp_consecutive_crypto_errors` gauge.
   - `whatsapp_prekey_exhaustion_events` counter.
   - `whatsapp_fresh_link_required` counter.
   - `whatsapp_pending_deliveries_size` gauge.
   - `whatsapp_pending_deliveries_dropped` counter.
   - `whatsapp_messages_processed` counter.
   - `whatsapp_messages_failed` counter.
   - `whatsapp_credential_restores` counter.
   - `whatsapp_processed_ids_size` gauge.
2. Add CloudWatch alarms:
   - Connection in `conflict`, `logged-out`, `degraded`, or `fresh_link_required` for > 5 minutes.
   - Crypto error rate > 5 per minute.
   - PreKey exhaustion event (immediate alert).
   - Pending deliveries size > 800.
   - Message failure rate > 10%.
3. Ensure `/pairing/health` responds within 1 second.
4. Create a CloudWatch dashboard JSON (or use AWS console) with connection state timeline, error rates, and queue depths.
5. Verify metrics are published in local dev using the AWS SDK with dummy credentials or local CloudWatch agent.

**Acceptance criteria:**
- All metrics are emitted.
- Alarms are configured and can be triggered in test.
- Health endpoint responds in < 1 second.
- Dashboard shows key metrics.

**Estimated effort:** 6–8 hours  
**Dependencies:** P1.7, P2.2, P2.4

---

### P5.6 — Rollback Verification and Production Readiness

**Files:**
- Feature flag configuration
- Deployment scripts
- `WHATSAPP_ARCHITECTURE_REFACTOR_PLAN.md` and `WHATSAPP_DETAILED_IMPLEMENTATION_PLAN.md`

**Sub-tasks:**
1. Verify `BAILEY_USE_NEW_CONTROLLER` toggles back to the legacy session Map cleanly.
2. Verify `PREKEY_RECOVERY_ENABLED` toggles off PreKey exhaustion recovery cleanly.
3. Verify Phase 2 pending deliveries can be disabled.
4. Verify Phase 3 user categories can be disabled (all users treated as before).
5. Verify Phase 4 new agent prompt can be disabled.
6. Verify DynamoDB `WhatsAppUserCategories` table can be deleted without affecting CRM data.
7. Document the rollback runbook.
8. Run a production readiness checklist:
   - All env vars documented.
   - All new endpoints authenticated.
   - Secrets not in code.
   - Logs do not contain PII or credentials.
   - Rate limits configured.
   - Backups tested.
9. Deploy to a staging environment and run smoke tests for 24 hours.

**Acceptance criteria:**
- Each feature flag rollback works without redeployment.
- Database migration is reversible.
- Runbook is documented.
- Staging smoke tests pass for 24 hours.

**Estimated effort:** 4–6 hours  
**Dependencies:** P5.4, P5.5

---

## Cross-Cutting Dependencies and Critical Path

```
P0.1 → P0.2 → P1.0 → P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1.7
       ↓                                                              ↓
       P0.3 → P0.4 → P2.5                                              P2.1 → P2.2 → P2.3
       ↓                                                              ↓
       P0.5 → P0.6 → P3.1 → P3.2 → P3.3 → P3.4 → P3.5                  P2.4
       ↓
       P0.7 → P2.5
       ↓
       P4.1 → P4.2 → P4.3 → P4.4 → P4.5
       ↓
       P5.1 → P5.2 → P5.3 → P5.4 → P5.5 → P5.6
```

**Critical path:** P0.1 → P0.2 → P1.0 → P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1.7 → P2.1 → P2.2 → P2.3 → P2.4 → P3.5 → P4.4 → P4.5 → P5.1 → P5.4 → P5.6.

**Can run in parallel:**
- P3.1 can start as soon as P0.5 is done.
- P4.1 and P4.3 can start while P3.x is in progress.
- P5.5 observability can be implemented incrementally alongside Phase 1 and 2.

---

## Definition of Done for Each Chunk

A chunk is considered done only when:
1. The code change is implemented and self-reviewed.
2. Unit/integration tests are added and passing.
3. The change does not break existing tests.
4. Relevant documentation is updated (env vars, API changes, runbook).
5. The feature flag (if applicable) is tested in both on and off states.
6. A brief commit message is written focusing on the "why".

---

## Suggested Sprint Schedule

| Week | Chunks | Focus |
|------|--------|-------|
| Week 1 | P0.1–P0.7 | Quick fixes, tests, and stabilization |
| Week 2 | P1.0–P1.4 | PreKey recovery, backup, detection, watchdog, reconnect policy |
| Week 3 | P1.5–P1.7 | State machine, connection controller, baileysClient refactor |
| Week 4 | P2.1–P2.5 | Socket reference, pending deliveries, dedup, optimistic UI |
| Week 5 | P3.1–P3.5 | User category schema, resolution, access control, integration |
| Week 6 | P4.1–P4.5 | AI prompts, REST tool executor, agent runtime integration |
| Week 7 | P5.1–P5.3 | Connection, message, category, and AI tests |
| Week 8 | P5.4–P5.6 | E2E tests, observability, rollback verification, staging |

---

## Notes

- This plan is derived from `WHATSAPP_ARCHITECTURE_REFACTOR_PLAN.md` and its Appendix A.
- Each chunk is intentionally small enough to review in a single PR.
- Feature flags are the primary rollback mechanism; test them early and often.
- The PreKey Exhaustion Recovery (P1.0) is the highest priority because it fixes the current production issue.
