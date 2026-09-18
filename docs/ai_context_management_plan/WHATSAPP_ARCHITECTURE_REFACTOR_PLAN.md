# WhatsApp Architecture Refactor Plan

## Executive Summary

This document outlines a comprehensive refactoring of the WhatsApp integration in nabi-app-git-bkp to adopt production-grade resilience patterns from OpenClaw. The current implementation has basic connectivity but lacks robust error handling, recovery mechanisms, and sophisticated user access control.

All new modules use JavaScript (`.js`) consistent with the existing `baileys-service` and `server` codebases. All new backend services must follow the global infrastructure standards defined in `global_rules.md` (CloudFormation parameters, deployment scripts, directory structure).

## ⚠️ Why This Plan Fixes the Current Production Issue

**Current issue:** `PreKeyError: Invalid PreKey ID` and `Bad MAC` errors causing "no reply on self-chat."

**Root cause:** The WhatsApp session's pre-keys are exhausted or invalid on WhatsApp's server. Reconnecting with the same credentials CANNOT fix this — Baileys reuses the existing auth state (including pre-keys) on reconnect.

**Critical finding from OpenClaw analysis:** OpenClaw's crypto error handling only forces a reconnect with the **SAME credentials**. It does NOT have logic to detect *persistent* crypto failures and force a fresh session. OpenClaw would also fail to fix this issue.

**How this plan fixes it (Phase 1.0 — PreKey Exhaustion Recovery):**
1. Count consecutive crypto errors per session
2. After 3 consecutive errors: delete auth state, generate fresh QR, notify owner
3. Owner re-scans QR → new pre-keys provisioned by WhatsApp → crypto errors resolved
4. This is a NEW pattern not present in OpenClaw — we must implement it ourselves

**Without Phase 1.0, the rest of the plan (observability, backoff, watchdog) would make the system more robust but would NOT fix the current crypto error issue.**

## Current Implementation Analysis

### Existing Components

#### 1. baileys-service/src/baileysClient.js
**Current State:**
- Basic session management using in-memory Map
- Simple 60-second heartbeat logging
- Rate-limited reconnection (5 attempts per 10-minute window)
- LRU-style deduplication (10,000 sent IDs, 50,000 processed IDs)
- Empty text skip for undecryptable messages
- No credential backup/restore
- No connection state machine
- No watchdog timer
- No crypto error detection
- No exponential backoff with jitter
- No socket reference following

**Strengths:**
- Basic deduplication prevents echo loops
- Rate limiting prevents reconnect storms
- Empty text guard prevents AI confusion

**Weaknesses:**
- No automatic recovery from corrupted credentials
- No proactive health monitoring (watchdog)
- No smart retry logic (exponential backoff, jitter)
- No crypto error detection and forced reconnect
- No connection state machine for observability
- No socket reference following for reconnections

#### 2. agency-app/api/bailey.js
**Current State:**
- Simple API client for Bailey service
- Basic webhook signature verification (HMAC-SHA256, timing-safe)
- No connection management logic

**Strengths:**
- Clean separation of concerns
- Proper signature verification with timestamp freshness check

**Weaknesses:**
- No connection lifecycle management
- No status tracking
- No error classification

**Preservation Requirement:** The existing webhook signature verification in `agency-app/api/bailey.js` (`verifyBaileySignature`) MUST be preserved and remain enforced throughout the refactor. Any new endpoints added must also enforce signature verification. No unauthenticated webhook endpoints may be introduced.

#### 3. agency-app/api/scripts/whatsapp-message-processor.js
**Current State:**
- Simple command parsing (lead:, search leads)
- Basic AI agent invocation
- No user category system
- No feature toggles
- No integration with ai-employee documentation

**Strengths:**
- Basic command grammar
- Business hours support
- Credit tracking

**Weaknesses:**
- No user categorization (Owner/Whitelisted/External)
- No feature toggles per category
- No rich prompts from ai-employee documentation
- No access control policies

## OpenClaw Patterns Analysis

### Key Robustness Patterns

#### 1. Connection Controller Pattern
- **What:** Centralized `WhatsAppConnectionController` class managing entire connection lifecycle
- **Why:** Single source of truth for connection state, clean lifecycle management
- **Benefits:** Observable state machine, graceful shutdown, proper cleanup

#### 2. Credential Backup/Restore
- **What:** Automatic `creds.json.bak` restoration on corruption detection
- **Why:** Prevents permanent session loss from corrupted auth state
- **Benefits:** Self-healing credentials, zero-downtime recovery

#### 3. Claim-Based Deduplication
- **What:** Persistent claimable dedupe with TTL-based cleanup (20-minute TTL, max 5,000 messages)
- **Why:** At-least-once semantics with retry support
- **Benefits:** Retry-safe message processing, prevents duplicate processing

#### 4. Watchdog Timer
- **What:** Triggers reconnect if no messages in `messageTimeoutMs` (default 10min, configurable)
- **Why:** Proactive detection of stale connections
- **Benefits:** Self-healing connections, prevents silent failures

#### 5. Reconnection Policy
- **What:** Exponential backoff with jitter (2s initial, 30s max, 1.8 factor, 25% jitter, 12 max attempts)
- **Why:** Prevents thundering herd, smart retry with diminishing returns
- **Benefits:** Efficient retry, prevents server overload

#### 6. Crypto Error Detection (OpenClaw pattern — INSUFFICIENT alone)
- **What:** `isLikelyWhatsAppCryptoError()` detects Baileys crypto failures (Bad MAC, unsupported state)
- **Why:** Forces immediate reconnect on crypto errors
- **Benefits:** Prevents silent crypto failures, faster recovery
- **CRITICAL LIMITATION:** OpenClaw's implementation only forces a reconnect with the **SAME credentials**. It does NOT refresh pre-keys or delete auth state. If the root cause is PreKey exhaustion (pre-keys invalid/exhausted on WhatsApp's server), reconnecting with the same credentials will NOT fix it. The errors will persist until max attempts is reached, then the session enters degraded/stopped mode.
- **See pattern 11 below for the additional PreKey Exhaustion Recovery that OpenClaw does NOT have.**

#### 7. PreKey Exhaustion Recovery (NEW — not in OpenClaw)
- **What:** Detects *persistent* crypto failures (vs transient) and forces a fresh session by deleting auth state and requiring re-linking via QR
- **Why:** PreKey exhaustion (`PreKeyError: Invalid PreKey ID`, persistent `Bad MAC`) cannot be fixed by reconnecting with the same credentials. The only fix is to delete the auth state and re-link via fresh QR scan to get new pre-keys from WhatsApp's server.
- **How it works:**
  1. Count consecutive crypto errors per session (reset counter on successful message decryption)
  2. After N consecutive crypto errors (default 3, configurable via `CRYPTO_ERROR_FRESH_SESSION_THRESHOLD`):
     - Delete the auth state directory (`fs.rm(authDir, { recursive: true, force: true })`)
     - Transition state to `fresh_link_required`
     - Emit `fresh_link_required` event with QR code for re-pairing
     - Notify owner via CRM dashboard alert + email (if configured)
     - Stop reconnect attempts with same credentials
  3. Distinguish transient vs persistent:
     - **Transient:** Single Bad MAC on one message (network glitch, out-of-order delivery) → reconnect with same credentials
     - **Persistent:** Consecutive Bad MAC / PreKeyError across multiple messages or reconnects → fresh session required
- **Benefits:** Actually fixes PreKey exhaustion (the current production issue), prevents infinite reconnect loops with broken credentials, provides clear operator action (re-scan QR)

#### 8. Socket Reference Following
- **What:** `socketRef.current` allows reply closures to follow reconnections
- **Why:** Outbound sends always use current socket
- **Benefits:** Replies work across reconnections

#### 9. Non-Retryable Status Detection
- **What:** Status 440 (session conflict) stops immediately
- **Why:** Prevents infinite retry loops
- **Benefits:** Smart retry logic, manual intervention when needed

#### 10. Drain Pending Deliveries
- **What:** Drains pending message queue after reconnect
- **Why:** Ensures messages sent during reconnect are delivered
- **Benefits:** No message loss during reconnections

#### 11. Comprehensive Status State Machine
- **What:** States: `starting`, `healthy`, `stale`, `reconnecting`, `conflict`, `logged-out`, `stopped`, `degraded`, `fresh_link_required`
- **Why:** Rich health state tracking for observability
- **Benefits:** Clear operational visibility, better debugging
- **Note:** `fresh_link_required` is a NEW state not in OpenClaw, added to signal PreKey exhaustion and the need for manual re-linking

## Gap Analysis

### Critical Gaps (Must Fix)

1. **No PreKey Exhaustion Recovery** ⚠️ ROOT CAUSE OF CURRENT ISSUE
   - Impact: Persistent `PreKeyError: Invalid PreKey ID` and `Bad MAC` errors that reconnecting with same credentials CANNOT fix. This is the actual production issue causing "no reply on self-chat."
   - Priority: CRITICAL
   - Effort: MEDIUM
   - Note: OpenClaw does NOT have this. This is a new pattern we must invent.

2. **No Credential Backup/Restore**
   - Impact: Permanent session loss on corruption
   - Priority: HIGH
   - Effort: MEDIUM

3. **No Watchdog Timer**
   - Impact: Silent connection failures
   - Priority: HIGH
   - Effort: MEDIUM

4. **No Crypto Error Detection**
   - Impact: Persistent crypto failures go undetected
   - Priority: HIGH
   - Effort: LOW
   - Note: Necessary but NOT sufficient alone. Must be combined with PreKey Exhaustion Recovery (#1).

5. **No Connection State Machine**
   - Impact: Poor observability, debugging difficulty
   - Priority: HIGH
   - Effort: HIGH

6. **No Smart Reconnection Policy**
   - Impact: Inefficient retries, potential server overload
   - Priority: MEDIUM
   - Effort: MEDIUM

### Important Gaps (Should Fix)

7. **No Socket Reference Following**
   - Impact: Replies fail during reconnections
   - Priority: MEDIUM
   - Effort: MEDIUM

8. **No Drain Pending Deliveries**
   - Impact: Message loss during reconnections
   - Priority: MEDIUM
   - Effort: MEDIUM

9. **No Non-Retryable Status Detection**
   - Impact: Infinite retry loops on session conflict
   - Priority: MEDIUM
   - Effort: LOW

### Nice-to-Have Gaps (Can Defer)

10. **Claim-Based Deduplication**
    - Impact: Current LRU dedup is adequate
    - Priority: LOW
    - Effort: HIGH

11. **Per-Account Isolation**
    - Impact: Single account is sufficient for current use case
    - Priority: LOW
    - Effort: HIGH

## Functional Requirements Gaps

### User Category System

**Current State:**
- No user categorization
- All users treated equally
- No access control

**Required State:**
- Three user categories: Owner, Whitelisted, External Customer
- Different access levels per category
- Feature toggles per category

**Gap Priority:** HIGH
**Gap Effort:** MEDIUM

### AI Integration

**Current State:**
- Minimal hardcoded prompt
- No integration with ai-employee documentation
- Direct DynamoDB access (not REST API)
- No contextual understanding

**Required State:**
- Rich prompts from IDENTITY.md, MEMORY.md, AGENTS.md
- REST API tool execution (consistent with ai-employee)
- Contextual understanding for features like area validation
- Proper rule enforcement (e.g., "NEVER write internal reasoning")

**Gap Priority:** HIGH
**Gap Effort:** HIGH

## Refactor Architecture

### Phase 1: Connection Stability (Foundation)

**Goal:** Eliminate current connection instability and crypto errors

#### 1.0 Implement PreKey Exhaustion Recovery ⚠️ ROOT CAUSE FIX
- **File:** `baileys-service/src/prekey-recovery.js` (new)
- **Why:** This is the fix for the CURRENT production issue. OpenClaw does NOT have this — we must invent it.
- **Features:**
  - Track consecutive crypto errors per session (in-memory counter, reset on successful message decryption)
  - Threshold: After N consecutive crypto errors (default 3, configurable via `CRYPTO_ERROR_FRESH_SESSION_THRESHOLD`):
    1. Stop reconnect attempts with current credentials
    2. Delete auth state directory (`fs.rm(authDir, { recursive: true, force: true })`)
    3. Transition connection state to `fresh_link_required`
    4. Generate fresh QR code for re-pairing
    5. Emit `fresh_link_required` event (consumed by CRM to notify owner)
    6. Call CRM webhook (`/webhooks/bailey/fresh-link-required`) with phone + QR code
  - Distinguish transient vs persistent crypto errors:
    - **Transient:** Single Bad MAC on one message → log warning, continue, reset counter after successful message
    - **Persistent:** Consecutive Bad MAC / PreKeyError across multiple messages or reconnects → trigger fresh session
  - Rate-limit fresh session creation: max 1 fresh session per 30 minutes per phone (prevents rapid re-link loops)
  - Log all crypto errors with structured fields (`phone`, `errorType`, `consecutiveCount`, `threshold`)
- **Integration with crypto-error-detector.js (1.2):**
  - `crypto-error-detector.js` detects the error
  - `prekey-recovery.js` decides whether to reconnect (transient) or fresh-link (persistent)
- **CRM-side notification:**
  - `agency-app/api/routes/auth.js` (modify): Add `POST /webhooks/bailey/fresh-link-required` endpoint
  - On receipt: store alert in DynamoDB, emit Socket.IO event to CRM dashboard, send email to owner if configured
  - CRM dashboard shows "WhatsApp re-linking required" banner with QR code

#### 1.1 Implement Credential Backup/Restore
- **File:** `baileys-service/src/auth-store.js` (new)
- **Pattern:** OpenClaw `auth-store.ts`
- **Features:**
  - Automatic backup on credential save (`creds.json` → `creds.json.bak`)
  - Restore from backup on corruption detection
  - Per-account auth directory support
  - Safe credential validation (JSON parseability check)
  - **Security:**
    - Set restrictive file permissions (`0600` on POSIX, ACL-restricted on Windows) on `creds.json` and `creds.json.bak`
    - Audit log every credential read/write/restore operation
    - Backup retention: keep only the last 1 backup (`creds.json.bak`); overwrite older backups atomically
  - **Fallback:** If both `creds.json` and `creds.json.bak` are corrupted, force a new QR code generation (clear auth dir, transition state to `starting`, emit `credentials_lost` event) rather than crashing

#### 1.2 Implement Crypto Error Detection
- **File:** `baileys-service/src/crypto-error-detector.js` (new)
- **Pattern:** OpenClaw `auto-reply/util.ts`
- **Features:**
  - Detect Baileys crypto errors (Bad MAC, unsupported state, PreKeyError, No matching sessions)
  - On detection: increment consecutive crypto error counter (in `prekey-recovery.js`)
  - If counter < threshold: force immediate reconnect with same credentials (bypass backoff)
  - If counter >= threshold: delegate to `prekey-recovery.js` for fresh session creation
  - Log crypto errors for debugging with structured fields
  - Rate-limit forced reconnects to prevent reconnect storms (max 3 forced reconnects per 5 minutes)

#### 1.3 Implement Watchdog Timer
- **File:** `baileys-service/src/watchdog.js` (new)
- **Pattern:** OpenClaw `connection-controller.ts:521-559`
- **Features:**
  - Message timeout detection (default 10min, configurable via `WATCHDOG_MESSAGE_TIMEOUT_MS`)
  - Watchdog check interval (default 60s, configurable via `WATCHDOG_CHECK_MS`)
  - Force close on timeout to trigger reconnect
  - Reset watchdog on any inbound message or heartbeat success

#### 1.4 Implement Reconnection Policy
- **File:** `baileys-service/src/reconnect-policy.js` (new)
- **Pattern:** OpenClaw `reconnect.ts`
- **Features:**
  - Exponential backoff (2s initial, 30s max, 1.8 factor)
  - Jitter (25%) for thundering herd prevention
  - Max attempts (12) before entering degraded mode
  - Non-retryable status detection (440 = session conflict → stop immediately)
  - 401 (logged out) → clear credentials, stop reconnect
  - **Rate limit handling:** Detect HTTP 429 / WhatsApp rate-limit signals and apply extended backoff (min 60s, max 300s)
  - **Network partition handling:** Detect `ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT` and apply backoff with longer max (60s)

#### 1.5 Implement Connection State Machine
- **File:** `baileys-service/src/connection-state.js` (new)
- **Pattern:** OpenClaw `auto-reply/monitor-state.ts`
- **Features:**
  - States: `starting`, `healthy`, `stale`, `reconnecting`, `conflict`, `logged-out`, `stopped`, `degraded`, `fresh_link_required`
  - `fresh_link_required`: NEW state (not in OpenClaw) — entered when PreKey exhaustion is detected; signals that auth state has been deleted and owner must re-scan QR
  - State transitions with validation (illegal transitions logged and rejected)
  - Event emission for observability
  - Timestamp tracking (lastConnectedAt, lastInboundAt, lastEventAt, lastCryptoErrorAt, consecutiveCryptoErrors)

#### 1.6 Implement Connection Controller
- **File:** `baileys-service/src/connection-controller.js` (new)
- **Pattern:** OpenClaw `connection-controller.ts`
- **Features:**
  - Centralized connection lifecycle management
  - Socket reference tracking (`socketRef.current`)
  - Graceful shutdown (cleanup timers, listeners, background tasks)
  - Integration with watchdog, reconnection policy, state machine
  - **Connection locking:** Mutex per phone number to prevent concurrent connection attempts. If a connection is in progress, queue or reject subsequent requests.
  - **Concurrent QR requests:** If multiple QR requests arrive for the same phone while a connection is starting, return the in-progress QR rather than starting a new connection.

#### 1.7 Refactor baileysClient.js
- **File:** `baileys-service/src/baileysClient.js` (modify)
- **Changes:**
  - Replace simple session Map with connection controller
  - Integrate credential backup/restore
  - Integrate crypto error detection
  - Integrate watchdog timer
  - Integrate reconnection policy
  - Integrate connection state machine
  - **Existing session migration:** On startup, detect existing auth directories and migrate them to the new controller-managed structure. Active sessions are preserved; no forced re-pairing.
  - **Rollback safety:** Feature flag `BAILEY_USE_NEW_CONTROLLER` (default `true`) allows falling back to the legacy session Map if the new controller causes issues. Legacy code path retained for one release cycle.

### Phase 2: Message Processing Robustness

**Goal:** Ensure reliable message delivery and processing

#### 2.1 Implement Socket Reference Following
- **File:** `baileys-service/src/baileysClient.js` (modify)
- **Pattern:** OpenClaw `connection-controller.ts`
- **Features:**
  - `socketRef.current` pattern
  - Reply closures follow reconnections
  - Outbound send waits briefly (max 2s) for socket if currently reconnecting

#### 2.2 Implement Drain Pending Deliveries
- **File:** `baileys-service/src/pending-deliveries.js` (new)
- **Pattern:** OpenClaw `auto-reply/monitor.ts:298-314`
- **Features:**
  - Queue pending messages during reconnect
  - Drain queue after reconnect (FIFO order)
  - Error-based bypass for specific errors (e.g., "No active listener")
  - **Queue limits:**
    - Max queue size: 1000 messages (configurable via `PENDING_DELIVERIES_MAX_SIZE`)
    - When queue is full, drop oldest messages and emit `pending_deliveries_overflow` event
    - Log dropped message count for observability
  - **Memory management:** Queue entries are minimal (messageId, to, text, timestamp). Queue is cleared on graceful shutdown.

#### 2.3 Implement Non-Retryable Status Detection
- **File:** `baileys-service/src/reconnect-policy.js` (modify)
- **Pattern:** OpenClaw `connection-controller.ts:420-471`
- **Features:**
  - Detect status 440 (session conflict) → stop immediately, transition to `conflict`
  - Detect status 401 (logged out) → clear credentials, transition to `logged-out`
  - Detect status 500/503 (server error) → retry with extended backoff

### Phase 3: User Category System

**Goal:** Implement Owner/Whitelisted/External customer access control

#### 3.1 Design User Category Schema
- **File:** `server/models/userCategory.js` (new)
- **Features:**
  - User categories: Owner, Whitelisted, External
  - Category properties: accessLevel, features, permissions
  - Storage: DynamoDB table `WhatsAppUserCategories` (PK: `TENANT#<tenantId>`, SK: `USER#<phone>`)
- **Database Migration:**
  - CloudFormation template `infra/cfn-whatsapp-user-categories.yaml` (new) following global rules
  - Includes DynamoDB table with `TENANT#` prefix for multi-tenancy
  - Includes all required CFN parameters per `global_rules.md`
  - Deployment via `deploy.sh` per global standards
  - Migration script to seed default Owner from existing tenant config

#### 3.2 Implement Category Resolution
- **File:** `agency-app/api/services/userCategoryService.js` (new)
- **Features:**
  - Resolve user category by phone number
  - In-memory cache with TTL (5 min) and max size (10,000 entries) with LRU eviction
  - Support manual category assignment via admin API
  - Default to External for unknown users
  - Owner resolution: compare against tenant's configured owner phone(s)

#### 3.3 Implement Feature Toggles
- **File:** `agency-app/api/services/featureToggleService.js` (new)
- **Features:**
  - Feature definitions per category
  - Toggle evaluation logic
  - Configuration-driven feature sets (stored in agency config)

#### 3.4 Implement Access Control
- **File:** `agency-app/api/services/whatsappAccessControl.js` (new)
- **Pattern:** OpenClaw `inbound/access-control.ts`
- **Features:**
  - DM policies: owner-only, allowlist, open, disabled
  - Group policies: open, disabled, allowlist
  - Secure defaults (owner-only when unconfigured)
  - Pairing flow for unknown users (optional)

#### 3.5 Integrate Category System into Message Processor
- **File:** `agency-app/api/scripts/whatsapp-message-processor.js` (modify)
- **Changes:**
  - Resolve user category before processing
  - Apply feature toggles based on category
  - Enforce access control policies
  - Log category for analytics

### Phase 4: AI Integration

**Goal:** Integrate rich prompts and proper tool execution

#### 4.1 Read ai-employee Documentation
- **Files:** `ai-employee/IDENTITY.md`, `ai-employee/MEMORY.md`, `ai-employee/AGENTS.md`
- **Action:** Extract prompt templates, rules, context

#### 4.2 Design WhatsApp Agent Prompt
- **File:** `agency-app/api/agents/whatsapp-agent-prompt.js` (new)
- **Features:**
  - Rich identity from IDENTITY.md
  - Memory context from MEMORY.md
  - Agent rules from AGENTS.md
  - Category-specific instructions
  - Feature-aware prompts

#### 4.3 Implement REST API Tool Execution
- **File:** `agency-app/api/agents/whatsapp-tool-executor.js` (new)
- **Features:**
  - REST API calls to CRM backend
  - Consistent with ai-employee tool execution
  - Error handling and retry (max 3 attempts, exponential backoff)
  - Response parsing

#### 4.4 Integrate Agent Runtime
- **File:** `agency-app/api/agents/agentRuntime.js` (modify)
- **Changes:**
  - Use WhatsApp agent prompt
  - Use REST API tool executor
  - Pass user category context
  - Pass feature toggle context

#### 4.5 Test AI Integration
- **Action:** Test with real WhatsApp messages
- **Validation:**
  - Rich responses with proper context
  - Correct tool execution via REST API
  - Rule enforcement (no internal reasoning)
  - Category-aware behavior

### Phase 5: Testing, Observability & Validation

**Goal:** Ensure complete system stability, correctness, and production observability

#### 5.1 Connection Stability Tests
- Test PreKey exhaustion recovery:
  - Consecutive crypto error counting (counter increments, resets on success)
  - Threshold triggers auth state deletion + fresh QR + CRM notification
  - Transient errors do NOT trigger fresh session
  - Rate-limit prevents rapid re-link loops (max 1 per 30min)
  - `fresh_link_required` state transitions correctly
  - CRM webhook receives fresh-link-required event
  - Owner notification (dashboard banner + email) fires
- Test credential backup/restore (including both-files-corrupted fallback)
- Test crypto error detection and reconnect (including rate-limit of forced reconnects)
- Test watchdog timer
- Test reconnection policy (including 440, 401, 429, network errors)
- Test connection state machine (all transitions including `fresh_link_required`, illegal transitions rejected)
- Test connection locking (concurrent connection attempts)
- Test existing session migration

#### 5.2 Message Processing Tests
- Test socket reference following
- Test drain pending deliveries (including queue overflow)
- Test non-retryable status detection
- Test deduplication

#### 5.3 User Category Tests
- Test category resolution (including cache TTL and eviction)
- Test feature toggles
- Test access control policies
- Test owner self-chat
- Test whitelisted user access
- Test external customer access

#### 5.4 AI Integration Tests
- Test rich prompts
- Test REST API tool execution
- Test category-aware behavior
- Test rule enforcement

#### 5.5 End-to-End Tests
- Test complete message flow
- Test reconnection scenarios
- Test error recovery
- Test user category scenarios

#### 5.6 Observability & Monitoring
- **Metrics (CloudWatch):**
  - `whatsapp_connection_state` (gauge: 0=stopped, 1=starting, 2=healthy, 3=stale, 4=reconnecting, 5=conflict, 6=logged-out, 7=degraded, 8=fresh_link_required)
  - `whatsapp_reconnect_attempts` (counter)
  - `whatsapp_crypto_errors` (counter)
  - `whatsapp_consecutive_crypto_errors` (gauge — current consecutive count per session)
  - `whatsapp_prekey_exhaustion_events` (counter — fires when fresh session is triggered)
  - `whatsapp_fresh_link_required` (counter — fires when owner must re-scan QR)
  - `whatsapp_pending_deliveries_size` (gauge)
  - `whatsapp_pending_deliveries_dropped` (counter)
  - `whatsapp_messages_processed` (counter)
  - `whatsapp_messages_failed` (counter)
  - `whatsapp_credential_restores` (counter)
- **Alarms:**
  - Connection in `conflict`, `logged-out`, `degraded`, or `fresh_link_required` for > 5 min
  - Crypto error rate > 5/min
  - PreKey exhaustion event fires (immediate alert — owner action required)
  - Pending deliveries size > 800 (80% of limit)
  - Message failure rate > 10%
- **Health check endpoint:** `GET /pairing/health` returns connection state, uptime, last message timestamp
- **Dashboards:** CloudWatch dashboard with connection state timeline, error rates, queue depths

#### 5.7 Rollback Strategy
- **Feature flag `BAILEY_USE_NEW_CONTROLLER`** (Phase 1.7): Allows instant rollback to legacy session Map without redeployment
- **Feature flag `PREKEY_RECOVERY_ENABLED`** (Phase 1.0): Allows disabling PreKey exhaustion recovery if false positives occur (disabling means crypto errors will not trigger fresh session — manual intervention required)
- **Per-phase rollback:**
  - Phase 1.0: Disable `PREKEY_RECOVERY_ENABLED` → crypto errors no longer trigger auth state deletion (revert to reconnect-only behavior)
  - Phase 1: Disable `BAILEY_USE_NEW_CONTROLLER` → revert to legacy baileysClient behavior
  - Phase 2: Disable pending deliveries → messages sent directly (no queue)
  - Phase 3: Disable user categories → all users treated as before
  - Phase 4: Disable new agent prompt → revert to minimal hardcoded prompt
- **Database rollback:** DynamoDB `WhatsAppUserCategories` table can be deleted without affecting existing CRM data (separate table)
- **Deployment safety:** Each phase deployed behind feature flag, monitored for 24h before enabling for all tenants

## Implementation Order

### Sprint 1: Foundation (Week 1)
0. **PreKey Exhaustion Recovery** (ROOT CAUSE FIX — do this FIRST)
   - `prekey-recovery.js`: consecutive crypto error counting, threshold-based auth state deletion, fresh QR generation, CRM notification webhook
   - `agency-app/api/routes/auth.js`: `POST /webhooks/bailey/fresh-link-required` endpoint
   - CRM dashboard: "WhatsApp re-linking required" banner
1. Credential backup/restore (with security + fallback)
2. Crypto error detection (with rate-limit, integrated with prekey-recovery)
3. Watchdog timer (10min default)
4. Reconnection policy (with 440/401/429/network handling)
5. Connection state machine (with `fresh_link_required` state)
6. Connection controller (with locking)
7. Refactor baileysClient.js (with migration + feature flag)

### Sprint 2: Robustness (Week 2)
1. Socket reference following
2. Drain pending deliveries (with queue limits)
3. Non-retryable status detection
4. Testing connection stability

### Sprint 3: User Categories (Week 3)
1. User category schema + DynamoDB migration (CFN)
2. Category resolution service (with cache)
3. Feature toggle service
4. Access control service
5. Integrate into message processor
6. Testing user categories

### Sprint 4: AI Integration (Week 4)
1. Read ai-employee documentation
2. Design WhatsApp agent prompt
3. Implement REST API tool executor
4. Integrate agent runtime
5. Test AI integration

### Sprint 5: Validation & Observability (Week 5)
1. Connection stability tests
2. Message processing tests
3. User category tests
4. AI integration tests
5. End-to-end tests
6. Observability (metrics, alarms, dashboards)
7. Rollback verification
8. Production readiness check

## Success Criteria

### Root Cause Fix (PreKey Exhaustion) ⚠️ CRITICAL
- ✅ PreKey exhaustion detected via consecutive crypto error counting
- ✅ Auth state automatically deleted after N consecutive crypto errors
- ✅ Fresh QR code generated and displayed to owner
- ✅ Owner notified via CRM dashboard banner + email
- ✅ Session recovers after owner re-scans QR
- ✅ No infinite reconnect loops with broken credentials
- ✅ Transient crypto errors (single message) do NOT trigger fresh session

### Connection Stability
- No permanent session loss (credential backup/restore + both-files-corrupted fallback)
- No silent connection failures (watchdog timer)
- No persistent crypto errors (crypto error detection)
- Efficient reconnection (exponential backoff with jitter)
- Clear observability (connection state machine + CloudWatch metrics)
- No concurrent connection race conditions (connection locking)
- Rate limit and network partition handling verified

### Message Processing
- No message loss during reconnections (drain pending deliveries with queue limits)
- Replies work across reconnections (socket reference following)
- No infinite retry loops (non-retryable status detection)
- No duplicate processing (deduplication)
- Queue overflow handled gracefully (drop oldest + alert)

### User Categories
- Owner has full access
- Whitelisted users have configured access
- External customers have restricted access
- Feature toggles work correctly
- Access control policies enforced
- Category cache performs within TTL/size limits

### AI Integration
- Rich prompts from ai-employee documentation
- REST API tool execution
- Category-aware behavior
- Rule enforcement (no internal reasoning)
- Contextual understanding

### Security
- Webhook signature verification preserved on all endpoints
- Credential files have restrictive permissions
- Credential operations audit-logged
- No unauthenticated endpoints introduced

### Observability
- CloudWatch metrics published for all critical states
- Alarms fire on degraded/conflict/logged-out states
- Health check endpoint responds within 1s
- Dashboard shows connection state timeline

### Operations
- Feature flag rollback verified for each phase
- Database migration reversible
- Existing sessions preserved during refactor
- Zero-downtime deployment achievable

## Risks & Mitigations

### Risk 1: Breaking Changes During Refactor
**Mitigation:** Incremental refactoring, extensive testing, feature flags (`BAILEY_USE_NEW_CONTROLLER`), per-phase rollback strategy

### Risk 2: Increased Complexity
**Mitigation:** Clear documentation, modular design, code reviews, comprehensive state machine

### Risk 3: Performance Impact
**Mitigation:** Benchmarking, optimization, lazy loading, memory limits on all in-memory structures, configurable timeouts

### Risk 4: Testing Coverage
**Mitigation:** Comprehensive test suite, E2E tests, manual validation, rollback verification

### Risk 5: Credential Loss During Migration
**Mitigation:** Existing session migration preserves auth directories, feature flag allows rollback, both-files-corrupted fallback forces new QR

### Risk 6: Memory Exhaustion
**Mitigation:** All in-memory structures have max sizes with LRU eviction, pending deliveries queue capped at 1000, category cache capped at 10,000 with TTL

### Risk 7: WhatsApp Rate Limiting / Bans
**Mitigation:** 429 detection with extended backoff, forced reconnect rate-limit (3/5min), max reconnect attempts (12) before degraded mode

### Risk 8: PreKey Exhaustion Recovery Deletes Valid Session ⚠️
**Problem:** If the consecutive crypto error threshold is too low (e.g., 1), a single transient Bad MAC error (network glitch) could trigger unnecessary auth state deletion, forcing the owner to re-scan QR.
**Mitigation:**
- Default threshold is 3 consecutive errors (not 1)
- Counter resets on any successful message decryption
- Rate-limit: max 1 fresh session per 30 minutes per phone
- Transient errors (single message, no reconnect) do NOT increment counter
- Feature flag `PREKEY_RECOVERY_ENABLED` (default `true`) allows disabling if false positives occur
- Log all threshold decisions for post-incident review

## Compliance with Global Rules

All new backend services and infrastructure MUST comply with `global_rules.md`:

- **CloudFormation:** New DynamoDB table defined in `infra/cfn-whatsapp-user-categories.yaml` with all required parameters (ServiceName, Env, LambdaMemorySize, etc.)
- **Directory structure:** New services follow `src/models/`, `src/services/`, `src/controllers/`, `src/routes/` structure
- **Deployment:** Via `deploy.sh` per global standards
- **Security:** Cognito JWT authorizer on admin endpoints, no unauthenticated endpoints
- **Coding:** No DB operations in routes (must go through Models), centralized error handling

## Appendix A: Implementation-Level Fixes from Code Review

This section captures concrete bugs, security issues, and edge cases identified during the detailed review of the existing WhatsApp implementation. These items must be fixed either immediately (before or alongside Phase 1) or as explicit acceptance criteria for the relevant phase.

### A.1 Backend — `baileys-service/src/baileysClient.js`

1. **ReferenceError: `jidToPhone` moved but still used inline**
   - **Problem:** In the diff, `jidToPhone` is moved to top-level scope but `handleIncomingMessage` still references it as if it were locally defined. This will throw a `ReferenceError` at runtime when processing group messages.
   - **Impact:** Inbound group and self-chat messages will crash the message handler.
   - **Fix:** Keep `jidToPhone` at top-level module scope (as already done) and ensure all call sites are removed from nested functions; add a unit test for `handleIncomingMessage` with a group message.

2. **Memory leak in `processedMessageIds`**
   - **Problem:** The `processedMessageIds` Map is only cleared on shutdown. At 50,000 entries, long-running processes will grow unbounded between restarts, and there is no TTL/eviction beyond the single-entry LRU eviction on insert.
   - **Impact:** Memory pressure on the Bailey service; restart cycles become slower.
   - **Fix:** Add a periodic cleanup job (e.g., every 1,000 processed messages or every 15 minutes) that evicts the oldest 10% of entries. Alternatively, add a per-entry TTL and a reaper interval.

3. **Race condition in `markMessageProcessed`**
   - **Problem:** The size check, eviction, and set are not atomic. Two concurrent calls can both see the Map at capacity and evict the same oldest entry, or interleave in a way that leaves the Map slightly over capacity.
   - **Impact:** Possible duplicate processing or unbounded growth.
   - **Fix:** In a single-threaded Node.js event loop this is mostly theoretical, but the code should still be written defensively: use a single helper that checks `has()`, deletes, then sets in one pass, and never evict based on a stale size snapshot.

4. **Deduplication runs before text validation**
   - **Problem:** The current handler marks a message as processed before checking whether `text` is empty. Undecryptable messages are therefore counted as processed and will not be retried if they arrive again with a valid payload later.
   - **Impact:** False positives in deduplication may suppress legitimate retries after PreKey recovery.
   - **Fix:** Only mark as processed after the message has been validated and accepted for forwarding. For undecryptable messages, log and skip without marking processed, or mark with a separate `processed_with_error` set if needed.

### A.2 Backend — `baileys-service/src/routes/pairing.js`

5. **No authentication on pairing routes**
   - **Problem:** `POST /pairing/qr`, `GET /pairing/status/:phone`, and `POST /pairing/logout` have no authentication or rate limiting. Anyone who can reach the Bailey service can generate a QR code or disconnect a session.
   - **Impact:** Unauthorized session hijacking, forced disconnects, and potential DoS.
   - **Fix:** Add an `x-api-key` or JWT middleware to all pairing routes. The key should be shared only between `agency-app/api/bailey.js` and `baileys-service`. Add rate limiting (e.g., max 5 QR requests per phone per minute) and reject requests without the secret.

### A.3 Backend — `agency-app/api/routes/aiEmployeeConfig.js`

6. **Overly restrictive `connectedWhatsAppPhone` validation**
   - **Problem:** The regex `^\+?\d{10,15}$` rejects valid formatted numbers like `+91 98765 43210` or `(+91) 98765-43210`.
   - **Impact:** Users cannot paste numbers in standard display formats and must manually strip formatting.
   - **Fix:** Normalize the input first (strip all non-digits and leading `+`), then validate length and country code. The stored value should always be the normalized form.

7. **No verification that the phone is actually connected**
   - **Problem:** The API allows an admin to set any phone number as the connected WhatsApp number, even if there is no active Bailey session for it.
   - **Impact:** The CRM dashboard will show a connected phone that cannot actually receive or send messages, leading to false confidence.
   - **Fix:** When `connectedWhatsAppPhone` is updated, call `getConnectionStatus()` from `agency-app/api/bailey.js` and reject the update if the session is not connected. Return a clear 400 error with the actual connection state.

### A.4 Backend — `agency-app/api/routes/whatsappConversations.js`

8. **Non-unique message ID generation**
   - **Problem:** The send-message endpoint uses `Date.now() - Math.random()` to generate `messageId`. This is not unique across concurrent requests or across multiple server instances.
   - **Impact:** Duplicate message IDs break deduplication, conversation ordering, and retry logic.
   - **Fix:** Use `crypto.randomUUID()` or a deterministic ULID that includes tenant, phone, and timestamp. Also store the actual Bailey `messageId` returned by `sendWhatsAppMessage` if available.

9. **No rate limiting on outbound messages**
   - **Problem:** `POST /api/whatsapp/conversations/:phone/messages` has no rate limiting, allowing an admin to spam a recipient.
   - **Impact:** Abuse, WhatsApp rate limits, and potential account bans.
   - **Fix:** Apply the existing `webhookRateLimit` or a dedicated per-tenant/per-recipient rate limiter (e.g., max 30 messages per minute per phone, max 100 per tenant per minute).

10. **No access control on outbound messages**
    - **Problem:** Any authenticated admin/manager can send a message to any phone number, including numbers outside the allowed conversation list (groups, external users, etc.).
    - **Impact:** Data leakage and policy violations.
    - **Fix:** Reuse `isAllowedConversation()` from `whatsappConversationService.js` before sending. Return 403 if the recipient is not the owner, a whitelisted number, or the connected phone.

11. **Inconsistent HTTP status codes**
    - **Problem:** All failures return 500, even for bad input, missing configuration, or unauthorized recipients.
    - **Impact:** Harder for the frontend to distinguish recoverable vs non-recoverable errors.
    - **Fix:** Return 400 for missing/invalid text, 404 for unknown phone, 403 for unauthorized recipient, 409 for rate limit, 503 if Bailey is unreachable, and 500 only for unexpected server errors.

### A.5 Backend — `agency-app/api/whatsappConversationService.js`

12. **Breaking change in `getConversationSummary` return format**
    - **Problem:** `lastMessage` changed from an object to a plain text string. Any existing callers or future integration expecting the object format will break.
    - **Impact:** API contract breakage.
    - **Fix:** Keep the object format for compatibility, or introduce a new field `lastMessageText` and keep `lastMessage` as the formatted object. Document the change in API changelog.

13. **Pagination disabled when filtering is active**
    - **Problem:** When `WHITELISTED_NUMBERS` or `connectedPhone` is configured, `nextKey` is always returned as `undefined`, even if more pages exist.
    - **Impact:** Inboxes with more than `limit` conversations will silently truncate the list.
    - **Fix:** Implement a stable cursor that tracks the last evaluated DynamoDB key and the set of already-seen allowed phones. When `nextKey` is requested, resume scanning from the stored cursor and continue until the next page of allowed conversations is filled.

14. **N+1 query problem in `listConversations`**
    - **Problem:** For each conversation, the code calls `getReadMeta()` and `countUnread()` in separate DynamoDB requests. With 100 conversations this becomes 200 extra reads per list request.
    - **Impact:** High latency, increased DynamoDB cost, and risk of throttling.
    - **Fix:** Batch the metadata reads using `BatchGetItem` or include the read metadata in the main query by using a single `PK` query with `SK` prefix `META#` for each phone. Alternatively, cache unread counts in the conversation item itself at write time.

15. **Environment-based whitelist is not tenant-scoped**
    - **Problem:** `WHITELISTED_NUMBERS` is loaded once from `process.env` at startup and applies globally to all tenants.
    - **Impact:** Multi-tenant deployments cannot have per-tenant whitelists, and runtime changes require a restart.
    - **Fix:** Move whitelisted numbers to agency config (DynamoDB) and refresh them via the category/permission system in Phase 3. Until then, make it an optional override and document that it is global.

16. **Duplicate `classifyWhatsAppId` logic**
    - **Problem:** The classification logic for phone/LID/group is duplicated in `agency-app/api/utils/whatsapp.js` and `agency-app/web/src/components/WhatsAppConversationList.tsx`.
    - **Impact:** Inconsistent behavior if the rules diverge; extra maintenance burden.
    - **Fix:** Centralize the logic in a shared utility. For the frontend, either import from a shared package or create a matching helper that stays in sync with the backend version.

### A.6 Backend — `agency-app/api/bailey.js`

17. **`forceNew` parameter is passed but not validated by the service**
    - **Problem:** `getPairingQr(phone, forceNew)` forwards `forceNew` to Bailey, but the plan does not specify how the CRM should decide when to request a forced re-pairing.
    - **Impact:** Ad-hoc use of `forceNew` could delete valid sessions unnecessarily.
    - **Fix:** Only allow `forceNew=true` when the current session is in `fresh_link_required` or `degraded` state, or when an admin explicitly confirms via the UI. Add a confirmation step in the frontend.

### A.7 Frontend — `agency-app/web/src/services/api.ts`

18. **Breaking change in WhatsApp API endpoint paths**
    - **Problem:** The diff changes endpoints from `/api/whatsapp/*` to `/whatsapp/*`. This breaks any existing callers, bookmarks, or third-party integrations.
    - **Impact:** Runtime failures in production if the server routes are not updated to match the new path, or if clients using the old path remain active.
    - **Fix:** Either keep the `/api` prefix (preferred for consistency with the rest of the CRM API) or introduce a versioned redirect (`/api/whatsapp/* → /whatsapp/*`) during a deprecation window. Update the server router mount path accordingly.

19. **Poor error handling in `getWhatsAppConnectionStatus`**
    - **Problem:** On non-200 responses, the method returns `{ connected: false, error: 'status_check_failed' }` and discards the server error body.
    - **Impact:** Harder to debug connection failures in the UI.
    - **Fix:** Return the actual response status and message when available, or throw a typed error so the UI can show actionable messages.

### A.8 Frontend — `agency-app/web/src/pages/onboarding/ConnectWhatsApp.tsx`

20. **Silent API failures when syncing `connectedWhatsAppPhone`**
    - **Problem:** `saveConnectedPhone()` and `clearConnectedPhone()` call `api.updateAiEmployeeConfig()` with an empty catch block.
    - **Impact:** If the API fails, the frontend thinks the phone is saved but the backend does not, causing mismatched state across the dashboard and inbox.
    - **Fix:** Show a warning toast if the sync fails, and either roll back localStorage or retry once. Do not proceed to the connected state if the API sync fails.

21. **Race conditions on rapid connect/disconnect**
    - **Problem:** Multiple rapid clicks can interleave `saveConnectedPhone`/`clearConnectedPhone` calls and localStorage writes.
    - **Impact:** The final state may not match the user's last action.
    - **Fix:** Disable the connect/disconnect buttons while the async operation is in flight, and serialize operations using a local flag or queue.

### A.9 Frontend — `agency-app/web/src/pages/crm/CRMDashboard.tsx`

22. **Duplicate polling for the same phone number**
    - **Problem:** `CRMDashboard` polls status every 30 seconds, and `WhatsAppInbox` polls conversations every 5 seconds plus status. If both are open, the same status endpoint is hit multiple times per minute.
    - **Impact:** Unnecessary API load and cost.
    - **Fix:** Introduce a small shared context or React Query-style cache for connection status with a single polling source. Alternatively, push status updates via WebSocket/Socket.IO instead of polling.

23. **Raw error messages displayed to users**
    - **Problem:** `whatsappError` is rendered directly in the UI (e.g., `status_check_failed`, `unknown`).
    - **Impact:** Users see internal error tokens instead of actionable messages.
    - **Fix:** Map error codes to human-friendly strings and provide a "Reconnect WhatsApp" action button when the error indicates a disconnect.

### A.10 Frontend — `agency-app/web/src/pages/crm/WhatsAppInbox.tsx`

24. **Aggressive 5-second polling for conversations**
    - **Problem:** `REFRESH_INTERVAL_MS` was reduced from 10s to 5s. For large inboxes this creates significant load and may cause the UI to flash while re-rendering.
    - **Impact:** Higher DynamoDB read cost and API Gateway requests.
    - **Fix:** Keep 10s as the default and make it configurable via an environment variable. Add backoff when the user is idle or the tab is hidden (`document.hidden`).

25. **No optimistic UI for sent messages**
    - **Problem:** The new message only appears after the API round-trip completes. On slow networks, the user gets no feedback that the message is sending.
    - **Impact:** Poor UX; users may send duplicates.
    - **Fix:** Add the message to the local `messages` array with `status: 'pending'` immediately, then update it to `sent` or `failed` when the API responds. Dedupe by the generated message ID.

### A.11 Frontend — `agency-app/web/src/components/WhatsAppChatThread.tsx`

26. **Missing UX polish for message input**
    - **Problem:** There is no character limit, no Enter-to-send shortcut, and no message preview.
    - **Impact:** Users may send oversized messages, and the keyboard UX is slower than native WhatsApp.
    - **Fix:**
      - Add a 4096-character limit (WhatsApp's documented max) with a visible counter.
      - Send on Enter, insert new line on Shift+Enter.
      - (Optional) Show a small preview/thumbnail for link previews if the backend supports it.

27. **Send button enabled while `onSendMessage` is undefined**
    - **Problem:** The submit handler checks `!onSendMessage` but the button only checks `!onSendMessage` in the disabled expression. The input is disabled but the button remains visually enabled.
    - **Impact:** Minor UI inconsistency; the button can be clicked but will no-op.
    - **Fix:** Use the same disabled condition for both input and button.

### A.12 Frontend — `agency-app/web/src/pages/crm/AiEmployee.tsx`

28. **Silent failure on WhatsApp status check**
    - **Problem:** If `api.getWhatsAppConnectionStatus()` fails, the code silently falls back to `false` without updating the UI.
    - **Impact:** The dashboard may show a stale "Connected" status after the session has actually dropped.
    - **Fix:** Set `whatsappConnected` to `false` and `whatsappError` to the error message when the status check fails, so the card reflects reality.

### A.13 Testing & Utilities

29. **No unit tests for phone number utilities**
    - **Problem:** `agency-app/api/utils/whatsapp.js` contains critical normalization and classification logic that is currently untested.
    - **Impact:** A bug in phone parsing can silently break the entire WhatsApp pipeline (tenant resolution, whitelisting, self-chat detection).
    - **Fix:** Add unit tests in `agency-app/api/utils/whatsapp.test.js` covering E.164, JID, LID, group IDs, device suffixes, international numbers, and malformed inputs. Add equivalent tests for the frontend helper if it remains.

30. **No integration tests for the send-message endpoint**
    - **Problem:** The new `POST /api/whatsapp/conversations/:phone/messages` endpoint has no test coverage.
    - **Impact:** Regressions in access control, rate limiting, or message logging will not be caught.
    - **Fix:** Add integration tests that verify success, missing text, unauthorized recipient, rate limit, Bailey disabled, and message persistence in DynamoDB.

### A.14 Recommended Pre-Phase-1 Quick Fixes

These items are small enough to fix before the full Phase 1 refactor and will prevent the current production code from shipping with the issues identified above:

1. **Fix `jidToPhone` ReferenceError** in `baileysClient.js`.
2. **Add authentication middleware** to `baileys-service/src/routes/pairing.js`.
3. **Revert or version the `/api/whatsapp` endpoint path change** in `api.ts` and `agency-app/api/routes/whatsappConversations.js`.
4. **Fix silent API failures** in `ConnectWhatsApp.tsx`.
5. **Add unit tests** for `agency-app/api/utils/whatsapp.js`.
6. **Normalize phone validation** in `aiEmployeeConfig.js` before rejecting formatted input.
7. **Use `crypto.randomUUID()`** for outbound message IDs.

## Conclusion

This refactoring plan adopts production-grade patterns from OpenClaw AND adds a critical missing piece — PreKey Exhaustion Recovery — that OpenClaw does not have. Without the PreKey Exhaustion Recovery (Phase 1.0), the rest of the plan would make the system more observable and resilient but would NOT fix the current production issue (`PreKeyError`, `Bad MAC`, no reply on self-chat).

**The single most important change is Phase 1.0:** detecting persistent crypto failures, deleting the corrupted auth state, and requiring the owner to re-scan a fresh QR code. This is the only way to fix PreKey exhaustion — reconnecting with the same credentials cannot regenerate pre-keys.

Key improvements over the initial draft:
- **PreKey Exhaustion Recovery** (Phase 1.0) — ROOT CAUSE FIX, not present in OpenClaw
- Security requirements for credential handling (permissions, audit logging, backup retention)
- Error handling for edge cases (both-files-corrupted, queue overflow, concurrent connections, network partitions, rate limiting)
- Memory management for all in-memory structures (max sizes, LRU eviction, TTL)
- Observability requirements (CloudWatch metrics, alarms, dashboards, health check)
- Rollback strategy (feature flags, per-phase rollback, reversible DB migration)
- Existing session migration strategy
- Compliance with global infrastructure rules
- Fixed file extensions (.js throughout)
- Fixed Sprint 1 numbering
- Removed duplicate socket reference following task
- New `fresh_link_required` connection state
- CRM dashboard notification for re-linking required
- Rate-limiting to prevent false-positive fresh session triggers
- **Appendix A** — concrete implementation-level fixes from code review (ReferenceError, unauthenticated pairing routes, API path breaking change, N+1 pagination, optimistic UI, deduplication race condition, etc.)
