# RealtyFlow Self-Hosted Baileys WhatsApp Service

This is a standalone, self-hosted WhatsApp gateway for the RealtyFlow CRM. It uses the open-source [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) library to connect to WhatsApp and exposes the same REST API shape that the CRM already expects from the hosted Bailey.ai service.

## Why self-hosted?

- **No per-message vendor fees** — you pay only for your own server/EC2/ECS costs.
- **Any WhatsApp number** — business or personal, with country code.
- **No WABA approval** — unlike the official Meta Cloud API.

Trade-off: you must run this service 24/7 because the WhatsApp Web multi-device protocol requires a persistent connection.

## How it works

```
┌─────────────┐     REST API      ┌─────────────────────┐     WhatsApp Web     ┌────────────┐
│ RealtyFlow  │ ────────────────> │ Baileys self-hosted │ ───────────────────> │ WhatsApp   │
│  CRM server │                   │    service          │                    │  servers   │
│             │ <──────────────── │                     │ <──────────────────│            │
└─────────────┘  signed webhooks  └─────────────────────┘  incoming messages  └────────────┘
```

The CRM's `server/bailey.js` adapter can now run in two modes:

- `BAILEY_MODE=hosted` (default) → `https://api.bailey.ai`
- `BAILEY_MODE=selfhosted` → your own Baileys service URL

## Quick start (local)

1. Copy the sample environment file:

   ```bash
   cp sample.env .env
   ```

2. Fill in `.env`:

   ```env
   PORT=3003
   NODE_ENV=development                          # use 'production' only after setting secrets below
   DEFAULT_SESSION_PHONE=919876543210              # your business WhatsApp number
   BAILEYS_WEBHOOK_SECRET=long-random-string       # mandatory in production
   BAILEYS_API_KEY=long-random-string              # mandatory in production
   CRM_WEBHOOK_URL=https://api.realestateflow.in/api/webhooks/whatsapp  # mandatory in production
   ```

   The service will refuse to start in `production` mode if `BAILEYS_WEBHOOK_SECRET`,
   `BAILEYS_API_KEY`, or `CRM_WEBHOOK_URL` are missing.

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run the service:

   ```bash
   npm run dev
   ```

5. Pair the number:

   ```bash
   curl -X POST http://localhost:3003/v1/pairing/qr \
     -H 'Authorization: Bearer $BAILEYS_API_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"phone":"919876543210"}'
   ```

   The response contains a `qrCode` data URL. Scan it with WhatsApp Business → Linked Devices.

## Docker (recommended for production)

```bash
cp sample.env .env
# edit .env
docker compose up -d
```

The `auth_state` directory is persisted in a Docker volume so the session survives container restarts.

## CRM configuration

In the CRM's `server/.env`:

```env
BAILEY_ENABLED=true
BAILEY_MODE=selfhosted
BAILEY_API_ENDPOINT=http://localhost:3003    # or your public Baileys service URL
BAILEY_WEBHOOK_SECRET=long-random-string      # must match BAILEYS_WEBHOOK_SECRET
BAILEY_API_KEY=long-random-string              # must match BAILEYS_API_KEY
```

For the frontend, keep `VITE_BAILEY_ENABLED=true` so the QR-pairing page is visible.

## CloudFormation

The `server/infra/cfn-backend.yaml` template now accepts a `BaileyMode` parameter (`hosted` or `selfhosted`). Set it to `selfhosted` and point `BaileyApiEndpoint` to your Baileys service when deploying the CRM.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/sessions` | List active sessions |
| POST | `/v1/pairing/qr` | Generate QR code for a phone number |
| GET | `/v1/pairing/status/:phone` | Check connection status |
| POST | `/v1/pairing/logout` | Disconnect a session |
| POST | `/v1/messages/send` | Send a WhatsApp message |

## Webhooks to the CRM

Incoming WhatsApp messages are forwarded to `CRM_WEBHOOK_URL` with:

- `x-bailey-signature: sha256=<hmac>`
- `x-bailey-timestamp: <unix seconds>`

The CRM's existing `server/routes/webhooks.js` already validates this signature using `BAILEY_WEBHOOK_SECRET`.

## Multi-session / multi-tenant

This service supports multiple WhatsApp sessions keyed by phone number. The CRM's `sendWhatsAppMessage` now accepts an optional `from` parameter to choose which session to send from. When `from` is omitted, the service falls back to `DEFAULT_SESSION_PHONE`.

For a true multi-tenant SaaS, you typically run one Baileys service instance per tenant/business number, or point the CRM's `BAILEY_API_ENDPOINT` to a dedicated Baileys instance per tenant.

## Notes and warnings

- This service is **not serverless**. It must run continuously to keep the WhatsApp session alive.
- Do not expose the Baileys service to the public internet without authentication. Place it inside a VPC or behind a reverse proxy and firewall.
- The `auth_state` directory contains WhatsApp credentials. Keep it secret and back it up securely.
- Use at your own risk. WhatsApp may flag or ban numbers that violate its Terms of Service.
