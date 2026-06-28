# WhatsApp Platform

Multi-tenant, self-hosted WhatsApp service built on Baileys.  
Runs locally with zero AWS setup and deploys to ECS Fargate for production.

## Architecture

```
Local dev                              ECS Production
─────────────────────────────────────  ──────────────────────────────────────────
AUTH_STATE_DIR (filesystem)            S3 (encrypted auth state, per-session prefix)
in-memory Map (session metadata)       DynamoDB (session metadata + GSI by status)
CRM direct webhook                     EventBridge (async fan-out to CRM + other consumers)
no-op metrics                          CloudWatch metrics (sessions, utilization)
```

The storage/event layer is selected automatically:
- `LOCAL_STORAGE=true` (or no `SESSION_BUCKET_NAME` set) → filesystem + in-memory
- `SESSION_BUCKET_NAME` set → S3 + DynamoDB
- `USE_EVENTBRIDGE=true` → EventBridge instead of direct webhook

## Quick Start (Local)

```bash
cd whatsapp-platform
npm install
cp .env.example .env
# Edit .env — set BAILEYS_API_KEY, BAILEYS_ADMIN_API_KEY at minimum

npm start          # or: npm run dev (watch mode)
```

Health check: `curl http://localhost:3003/health`

## Docker (Local)

```bash
docker compose up --build
```

Auth state is persisted in Docker volume `whatsapp_auth_state`.

## API Reference

All authenticated routes require:
```
Authorization: Bearer <BAILEYS_API_KEY>
# or
x-api-key: <BAILEYS_API_KEY>
```

### Pairing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/pairing/qr` | Start pairing — returns QR code |
| GET | `/v1/pairing/status/:phone` | Session status |
| GET | `/v1/pairing/sessions` | List all sessions |
| POST | `/v1/pairing/logout` | Disconnect session |

**POST /v1/pairing/qr**
```json
{ "phone": "919876543210" }
```
Response:
```json
{ "enabled": true, "qrCode": "data:image/png;base64,...", "connected": false }
```
Add `"forceNew": true` + `x-admin-api-key` header to force re-link.

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/messages/send` | Send WhatsApp message |

**POST /v1/messages/send**
```json
{ "from": "919876543210", "to": "919999999999", "text": "Hello!" }
```
Response:
```json
{ "enabled": true, "sent": true, "queued": false, "messageId": "..." }
```

### Health

| Path | Auth | Description |
|------|------|-------------|
| `GET /health` | None | Basic liveness |
| `GET /health/sessions` | None | Session summary |
| `GET /health/deep` | None | Detailed health + memory |
| `GET /v1/health` | None | ECS capacity check |

## Incoming Message Webhook

When `USE_EVENTBRIDGE=false` (default for local), incoming messages are POSTed to `CRM_WEBHOOK_URL`:

```json
{
  "messageId": "...",
  "from": "919999999999",
  "to": "919876543210",
  "text": "Hello!",
  "fromMe": false,
  "isSelfChat": false,
  "isGroup": false,
  "fromJid": "919999999999@s.whatsapp.net",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Signed with HMAC-SHA256 (`x-bailey-signature` header).

## Environment Variables

See `.env.example` for full documentation. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `BAILEYS_API_KEY` | Yes | API auth key for CRM |
| `BAILEYS_ADMIN_API_KEY` | Yes (prod) | Admin key for destructive ops |
| `BAILEYS_WEBHOOK_SECRET` | Yes (prod) | HMAC secret for webhooks |
| `CRM_WEBHOOK_URL` | Yes (local) | Incoming message target |
| `AUTH_ENCRYPTION_KEY` | Yes (prod) | Credential backup encryption |
| `SESSION_BUCKET_NAME` | ECS | S3 bucket for auth state |
| `SESSION_TABLE_NAME` | ECS | DynamoDB session table |
| `USE_EVENTBRIDGE` | ECS | Publish to EventBridge |
| `LOCAL_STORAGE` | Auto | Override storage mode |

## ECS Deployment

```bash
cd infra

# Copy and fill parameters
cp cfn-params.example.json cfn-params-dev.json
# Edit cfn-params-dev.json

# Deploy (builds + pushes Docker image + deploys stack)
bash deploy.sh dev
```

After deploy, the ALB DNS name is printed. Add to CRM Lambda:
```
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_ENDPOINT=http://<alb-dns>
BAILEY_API_KEY=<same as InternalApiKey>
BAILEY_WEBHOOK_SECRET=<same as WebhookSecret>
```

## Robustness Features

This service includes the full robustness stack from `baileys-service`:

| Feature | File |
|---------|------|
| Connection state machine (12 states) | `src/connection-state.js` |
| Exponential backoff with jitter | `src/reconnect-policy.js` |
| Health probes (half-open socket detection) | `src/baileysClient.js` |
| Watchdog (inactivity timeout) | `src/watchdog.js` |
| Pre-key recovery + rotation | `src/prekey-recovery.js` |
| Crypto error detection + classification | `src/crypto-error-detector.js` |
| Message deduplication (LRU cache) | `src/baileysClient.js` |
| Message debounce buffering | `src/baileysClient.js` |
| Pending delivery queue (reconnect) | `src/pending-deliveries.js` |
| Encrypted credential backup | `src/auth-store.js` |
| Auth state soft reset | `src/auth-state-utils.js` |
| Timing-safe API key comparison | `src/middleware/apiKeyAuth.js` |
| Pairing rate limiting | `src/middleware/pairingRateLimit.js` |

## Project Structure

```
whatsapp-platform/
├── src/
│   ├── index.js                    # Express server + bootstrap
│   ├── config.js                   # All env vars + validation
│   ├── logger.js                   # Pino logger
│   ├── types.js                    # JSDoc type definitions
│   ├── baileysClient.js            # Core session manager (storage-adapter-aware)
│   ├── webhookForwarder.js         # HMAC-signed HTTP webhook with retry
│   ├── auth-store.js               # Encrypted credential backup (AES-256-GCM)
│   ├── auth-state-utils.js         # Auth state soft reset utilities
│   ├── connection-controller.js    # Central session lifecycle orchestrator
│   ├── connection-state.js         # Formal state machine (12 states)
│   ├── reconnect-policy.js         # Exponential backoff with jitter
│   ├── watchdog.js                 # Inactivity/heartbeat monitoring
│   ├── pending-deliveries.js       # Message queue during reconnection
│   ├── prekey-recovery.js          # Signal pre-key exhaustion recovery
│   ├── crypto-error-detector.js    # Crypto error classification
│   ├── storage/
│   │   ├── authState.js            # S3 / filesystem auth state adapter
│   │   └── sessionRepository.js   # DynamoDB / in-memory session repo
│   ├── events/
│   │   └── index.js                # EventBridge / direct webhook event layer
│   ├── observability/
│   │   └── metrics.js              # CloudWatch metrics (no-op when disabled)
│   ├── middleware/
│   │   ├── apiKeyAuth.js           # Timing-safe API key auth
│   │   └── pairingRateLimit.js     # Per-phone+IP rate limiting
│   └── routes/
│       ├── health.js               # Health endpoints
│       ├── pairing.js              # QR pairing + session management
│       ├── messages.js             # Message sending
│       └── utils.js                # Safe error utility
├── infra/
│   ├── cfn-platform.yaml           # CloudFormation (ECS, S3, DynamoDB, ALB, IAM)
│   ├── deploy.sh                   # Build + ECR push + CFN deploy
│   └── cfn-params.example.json     # Parameter template
├── patches/
│   └── *.patch                     # Baileys bug fix patches
├── .env.example                    # All env vars documented
├── Dockerfile                      # Node 20 slim production image
├── docker-compose.yml              # Local dev with volumes
└── package.json
```
