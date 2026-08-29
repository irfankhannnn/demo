# Backend API Reference

Service: `backend_insta_sol_ms`. Deployed as `prod-realestateflow-insta-stack`.
Live: `https://dvdmdi6c5i.execute-api.ap-south-1.amazonaws.com/v1`

Base path `/api/insta`. Errors are `{ error: string, details?: string }`, matching the
repo convention.

## Authentication

Two schemes, deliberately separate. See `03-ARCHITECTURE.md` section 2 for the details.

| Routes | Scheme | Middleware |
|---|---|---|
| `/agent/*` | HMAC device key | `middleware/deviceAuth.js` |
| everything else | Bearer JWT via the auth service | `middleware/validateToken.js` |
| `/health` | none | — |

`tenantId` is **only ever** set by one of those two middlewares, from the authenticated
device or user. It is never read from a request body, query or path — a test asserts
this, and it is what makes the multi-tenancy safe.

## Agent endpoints (HMAC)

| Method | Path | Notes |
|---|---|---|
| POST | `/agent/register` | `{ pairingCode, deviceName, platform, agentVersion }` returns `{ deviceId, deviceSecret, tenantId }`. Not HMAC-signed — the pairing code is the credential. Single use, 15-minute TTL. |
| POST | `/agent/heartbeat` | Returns `{ ok, serverTime, killSwitch }`. `killSwitch` is the fleet-wide brake. |
| POST | `/agent/snapshot` | `{ accounts, media, mediaSnapshots }`, max 500 items |
| POST | `/agent/enquiries` | `{ enquiries }`, idempotent on `enquiryId`; returns `{ ok, written, rejected }` |
| POST | `/agent/threads` | `{ threads }` — thread STATS only. Message bodies never leave the laptop. |
| GET | `/agent/rules` | `{ rules, updatedAt }` |

## Frontend endpoints (JWT)

| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | Headline counters plus a 30-day series |
| GET | `/accounts` | Connected IG accounts with device health |
| GET | `/devices` | Paired laptops |
| POST | `/devices/pair` | `{ pairingCode, expiresAt }` |
| DELETE | `/devices/:deviceId` | Revoke. A revoked device fails HMAC immediately. |
| GET | `/media` | Reel leaderboard. `?sort=enquiries\|views&limit=`. Defaults to enquiries. |
| GET | `/media/:mediaId` | One reel plus its dated snapshot series |
| GET | `/enquiries` | `?status=&temperature=&limit=&cursor=` |
| PATCH | `/enquiries/:enquiryId` | `{ status?, notes? }` |
| GET | `/threads` | `?windowState=&unanswered=` |
| GET/POST | `/rules`, DELETE `/rules/:ruleId` | Keyword rules |
| GET | `/insights/timeseries` | `?metric=followers\|reach\|views&days=` |
| GET | `/health` | Unauthenticated liveness |

## Storage

Two tables, single-table design, `TENANT#<id>` partition key. Full item-type map in
`03-ARCHITECTURE.md` section 3.

- `prod-realestateflow-insta-data` — Retain, PITR on, GSI `gsi1-index`
- `prod-realestateflow-insta-audit` — TTL only, holds the audit trail and HMAC nonces

The Lambda's IAM role reaches exactly those two table ARNs plus its own log group. No
CRM table is reachable from this service at all — the isolation is enforced by IAM, not
by convention.

## Running locally

```bash
cd backend_insta_sol_ms
cp .env.sample .env
npm install
npm start        # local Express server
npm test         # 80 tests, no AWS needed
```
