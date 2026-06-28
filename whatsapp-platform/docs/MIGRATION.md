# Migration: baileys-service → whatsapp-platform

This document explains the changes made when merging `baileys-service` (local, single-instance)
into `whatsapp-platform` (ECS-ready, multi-tenant, cloud-native).

## What Changed

### Storage Layer (New)

| baileys-service | whatsapp-platform |
|-----------------|-------------------|
| `useMultiFileAuthState(dir)` | `getAuthState(phone)` → filesystem OR S3 |
| `fs.readdir(AUTH_STATE_DIR)` | `listPersistedPhones()` → filesystem OR S3 list |
| `fs.rm(dir)` | `deleteAuthState(phone)` → filesystem OR S3 delete |
| No session metadata | `upsertSession()` → in-memory Map OR DynamoDB |

**Files:**
- `src/storage/authState.js` — S3 + filesystem adapter
- `src/storage/sessionRepository.js` — DynamoDB + in-memory adapter

### Event Layer (New)

| baileys-service | whatsapp-platform |
|-----------------|-------------------|
| `forwardWebhook(CRM_WEBHOOK_URL, payload)` | `events.messageReceived(payload)` |
| No session events | `events.sessionConnected/Disconnected/Restored()` |
| No EventBridge | `USE_EVENTBRIDGE=true` → EventBridge |

**File:** `src/events/index.js`

### Observability (New)

| baileys-service | whatsapp-platform |
|-----------------|-------------------|
| No metrics | `publishSessionMetrics()` → CloudWatch |
| Single log group | Per-task log stream |

**File:** `src/observability/metrics.js`

### Config (Extended)

All original `baileys-service` env vars are preserved. New vars added:

| New Variable | Purpose |
|-------------|---------|
| `LOCAL_STORAGE` | Override storage mode |
| `USE_EVENTBRIDGE` | Override event mode |
| `SESSION_BUCKET_NAME` | S3 bucket for ECS |
| `SESSION_TABLE_NAME` | DynamoDB table for ECS |
| `SESSION_KMS_KEY_ID` | KMS key for S3 encryption |
| `EVENT_BUS_NAME` | EventBridge bus name |
| `CLOUDWATCH_METRICS_ENABLED` | Enable CloudWatch |
| `MAX_SESSIONS_PER_TASK` | ECS capacity per task |
| `ECS_TASK_ID` | ECS task identifier |

### API Compatibility

All original `baileys-service` endpoints are preserved:
- `POST /health` → `/health`
- `GET /health/sessions` → `/health/sessions`
- `GET /health/deep` → `/health/deep`
- `POST /v1/pairing/qr` (was `/api/sessions` or similar)
- `POST /v1/messages/send`

New ECS-compatible aliases added:
- `GET /v1/health`
- `GET /v1/sessions/:tenantId`
- `DELETE /v1/sessions/:tenantId`

## Modules Unchanged (Carried Over Verbatim)

These modules from `baileys-service` are copied as-is — no modifications:

- `src/auth-store.js` — AES-256-GCM credential backup
- `src/auth-state-utils.js` — Auth state soft reset
- `src/connection-controller.js` — Session lifecycle orchestrator
- `src/connection-state.js` — 12-state FSM
- `src/reconnect-policy.js` — Exponential backoff
- `src/watchdog.js` — Inactivity monitoring
- `src/pending-deliveries.js` — Message queue
- `src/prekey-recovery.js` — Pre-key rotation
- `src/crypto-error-detector.js` — Crypto error classification
- `src/webhookForwarder.js` — HMAC webhook with retry
- `patches/` — Baileys bug fix patches

## Local Development (Zero AWS)

```bash
LOCAL_STORAGE=true   # auto-detected when SESSION_BUCKET_NAME is not set
USE_EVENTBRIDGE=false  # auto-detected
```

The service runs identically to `baileys-service` with filesystem + direct webhooks.

## ECS Production

```bash
LOCAL_STORAGE=false  # auto-detected when SESSION_BUCKET_NAME is set
USE_EVENTBRIDGE=true
SESSION_BUCKET_NAME=dev-whatsapp-session-state-xxxx
SESSION_TABLE_NAME=dev-whatsapp-sessions
```

No code changes needed — the adapters switch automatically.
