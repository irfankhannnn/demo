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

`infra/deploy.sh` is the single entry point for everything — no manual parameter
files or secret generation required.

```bash
cd infra

# One-time: copy .env.example to ../.env if you haven't already (optional —
# only needed to override defaults; VPC/subnets/secrets are auto-handled).

# Deploy (builds + pushes Docker image + auto-detects VPC/subnets +
# auto-generates secrets on first run + deploys/updates the CFN stack)
bash deploy.sh deploy dev
# or, shorthand (defaults to the "deploy" command):
bash deploy.sh dev

# Deploy to staging or prod
bash deploy.sh deploy staging
bash deploy.sh deploy prod
```

### Environment-Specific Task Sizing

The deployment script automatically applies sensible defaults per environment:

| Environment | CPU | Memory | Desired Count |
|-------------|-----|--------|---------------|
| dev | 256 | 512 MB | 0 |
| staging | 256 | 1 GB | 1 |
| prod | 512 | 1 GB | 1 |

You can override these by setting `TASK_CPU`, `TASK_MEMORY`, or `DESIRED_COUNT` in `.env`.

### Auto-Detection & Auto-Generation

On first run, `deploy.sh`:
- Auto-detects your account's default VPC, its CIDR, and its subnets (unless
  `AWS_VPC_ID` / `AWS_VPC_CIDR` / `AWS_PRIVATE_SUBNET_IDS` are set in `.env`).
- Auto-generates `BAILEYS_API_KEY`, `BAILEYS_ADMIN_API_KEY`, `BAILEYS_WEBHOOK_SECRET`,
  and `AUTH_ENCRYPTION_KEY` if left as placeholders, and saves them to
  `infra/.generated-<env>.env` (gitignored) so subsequent deploys are idempotent.
- Validates the `TaskCpu`/`TaskMemory` combination against Fargate's allowed pairs
  before touching CloudFormation.

After deploy, instructions for getting the current task public IP endpoint are printed automatically.

### Dev Cost Controls (no infra changes)

```bash
bash deploy.sh stop dev     # sets ECS desired count to 0 — stops Fargate billing
bash deploy.sh start dev    # sets ECS desired count back to 1
bash deploy.sh status dev   # shows current desired/running/pending task counts
```

### Cost Estimate

With ALB removed and Fargate Spot enabled:

| State | Monthly Cost |
|-------|--------------|
| Running 24/7 (Spot) | ~$3.30 |
| Stopped (DesiredCount=0) | ~$0.60 |

Disable Spot (`SPOT_CAPACITY=false`) for no interruptions: ~$9.60/month running.

### Getting the Public Endpoint

The ALB has been removed to save cost. The ECS task gets a dynamic public IP on port 3003:

```bash
bash deploy.sh start dev        # start the service
bash deploy.sh endpoint dev     # get current public IP endpoint
```

Example output:
```
http://43.204.123.45:3003
```

**Important:** The public IP changes when the task restarts.

### Route53 Dynamic DNS (Stable Hostname)

To avoid chasing the public IP, add a Route53 hosted zone and a subdomain:

1. In AWS Route53, create or find your hosted zone (e.g., `realtyflow.com`). Copy the **Hosted Zone ID**.
2. In `.env`, set:

```bash
HOSTED_ZONE_ID=Z1234567890ABC
DOMAIN_NAME=whatsapp.realtyflow.com
```

3. Deploy:

```bash
bash deploy.sh deploy dev
```

A Lambda will automatically update the `A` record whenever the ECS task starts. The first deploy creates the record; subsequent task restarts update it.

Use this in your CRM:

```bash
BAILEY_API_ENDPOINT=http://whatsapp.realtyflow.com:3003
```

### Alarm Notifications

Set your email in `.env`:

```bash
ALARM_EMAIL=your-email@example.com
```

Then deploy:

```bash
bash deploy.sh deploy dev
```

You will receive an email from AWS to confirm the SNS subscription. Click the link.

After confirmation, you will get emails for:
- Spot interruptions
- ECS task stops/crashes
- High CPU/memory usage
- Task count below desired
- OOMKilled events

### Production-Ready Features

The CloudFormation template includes:

- **Deployment Circuit Breaker:** Automatic rollback on failed deployments
- **Fargate Spot:** Enabled by default for 60-70% compute cost savings (tasks may be interrupted with 2-minute warning). Disable via `SPOT_CAPACITY=false`
- **ECS Exec:** Enabled for debugging running containers (requires SSM Session Manager — ensure your IAM user/role has the `AmazonSSMFullAccess` or `AmazonSSMReadOnlyAccess` policy and the container's task role has the required `ssmmessages:*` permissions)
- **CloudWatch Alarms:**
  - CPU utilization (warning at 60%, critical at 80%)
  - Memory utilization (warning at 70%, critical at 85%)
  - Task restart detection (running < desired count, skipped when DesiredCount=0)
  - OOMKilled events (via log metric filter)
- **CloudWatch Alarm Notifications:** Optional email notifications via `ALARM_EMAIL` env var. The template creates an SNS topic and subscribes your email. You must confirm the subscription by clicking the email link.
- **Graceful Shutdown:** SIGTERM handler closes HTTP server and Baileys sessions cleanly
- **Log Retention:** 30 days (configurable via `LOG_RETENTION_DAYS`)

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
platform/whatsapp-platform/
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
│   ├── cfn-platform.yaml           # CloudFormation (ECS, S3, DynamoDB, IAM, no ALB)
│   ├── deploy.sh                   # Build + ECR push + CFN deploy
│   └── cfn-params.example.json     # Parameter template
├── patches/
│   └── *.patch                     # Baileys bug fix patches
├── .env.example                    # All env vars documented
├── Dockerfile                      # Node 20 slim production image
├── docker-compose.yml              # Local dev with volumes
└── package.json
```
