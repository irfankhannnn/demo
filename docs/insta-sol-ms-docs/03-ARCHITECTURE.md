# Instagram Solution — Architecture & Shared Contract

**This file is the contract.** The backend microservice, the frontend app and the
laptop agent are built independently against it. If any of them needs to change
something here, change it here first.

Branch: `instagram-solution`. Account: `532404260898` (ap-south-1). Environment naming
is **env-first**: `<env>-realestateflow-insta-<resource>`.

---

## 1. Components

| Component | Folder | Runtime | Deployed as |
|---|---|---|---|
| Laptop agent | `instagram-local-agent/` | Node 20 ESM | runs on the agency owner's machine |
| Backend microservice | `backend_insta_sol_ms/` | Node 20 ESM, Express-on-Lambda | `<env>-realestateflow-insta-stack` |
| Frontend app | `frontend_insta_sol_ms/` | React 18 + TS + Vite | S3 + `/insta/*` behavior on the CRM CloudFront distribution |
| CI/CD wrappers | `cfn-templates-cicd/{backend,frontend}_insta_sol_ms/` | bash | build-tracked deploys |

```
 AGENCY LAPTOP                          AWS (532404260898, ap-south-1)
+----------------------+              +------------------------------------+
| instagram-local-agent|  HMAC-signed | API GW  <env>-realestateflow-      |
|  Meta Graph API ---> |------------->|         insta-api                  |
|  SQLite (truth)      |  /agent/*    |   +-> Lambda insta-lambda          |
|  local console :7317 |              |        +-> DDB insta-data          |
+----------------------+              |        +-> DDB insta-audit (TTL)   |
                                      |                                    |
 BROWSER                              | JWT via AUTH_SERVICE_URL/auth/me   |
+----------------------+   JWT        |                                    |
| CRM app  --redirect->|------------->| /insta/* CloudFront behavior       |
| frontend_insta_sol_ms|  /api/insta/*|   +-> S3 insta-frontend            |
+----------------------+              +------------------------------------+
```

**Isolation rule.** Nothing above writes to the existing CRM tables, the existing
`Leads` table, `AgencyConfig`, or `server/routes/webhooks.js`. The only edit to an
existing file is the conditional `/insta/*` origin + behavior in
`real-estate-crm-app/infra/cfn-frontend.yaml`, which is inert unless
`InstaFrontendBucketName` is passed.

---

## 2. Authentication — two separate schemes

### 2a. Browser to API: JWT (same as the CRM)

Reuses the existing auth microservice exactly as `server/middleware/validateToken.js`
does: `Authorization: Bearer <token>` then `GET ${AUTH_SERVICE_URL}/auth/me` returning
`{user, agency}`, giving `req.tenantId = user.tenantId`. Cached 60s in-memory, 5min
stale-grace on auth outage. The backend duplicates this middleware rather than importing
from `server/` — separate deployable, no shared code path.

### 2b. Laptop to API: HMAC device key

The laptop is not a browser and holds no user session, so it gets its own credential.

**Pairing (once per laptop):**

1. Owner clicks "Pair a laptop" in the frontend, hitting `POST /api/insta/devices/pair` (JWT).
2. Backend returns a **pairing code**: 8 chars, single use, 15-minute TTL.
3. Owner runs `ig-agent pair <code>`, hitting `POST /api/insta/agent/register`.
4. Backend returns `{ deviceId, deviceSecret }`. The secret is returned **once** and
   never again; the agent stores it in the OS keychain.

**Every agent request thereafter:**

```
x-insta-device-id: <deviceId>
x-insta-timestamp: <unix ms>
x-insta-nonce:     <uuid>
x-insta-signature: hex(HMAC_SHA256(deviceSecret, stringToSign))

stringToSign = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + sha256hex(rawBody)
```

Server rejects: unknown or revoked device, clock skew over 5 minutes, replayed nonce
(nonces cached in the audit table with TTL), or signature mismatch. Comparison uses
`crypto.timingSafeEqual`.

---

## 3. DynamoDB — two tables

Single-table design per `CLAUDE.md`, `TENANT#` partition prefix.

### `<env>-realestateflow-insta-data`

`DeletionPolicy: Retain`, `UpdateReplacePolicy: Retain`, PITR on, PAY_PER_REQUEST.

| Key | Value |
|---|---|
| PK `pk` | `TENANT#<tenantId>` |
| SK `sk` | see below |
| GSI `gsi1-index` | `gsi1pk` / `gsi1sk` — sparse, for lookups that are not tenant-scoped. Named `<name>-index` to match the repo convention already live on `instagramWebhookToken-index` and `connectedWhatsAppPhone-index`. |

| Item type | `sk` | `gsi1pk` / `gsi1sk` | Key attributes |
|---|---|---|---|
| Device | `DEVICE#<deviceId>` | `DEVICE#<deviceId>` / `TENANT#<tenantId>` | deviceName, deviceSecret, status, igUserId, igUsername, agentVersion, lastSeenAt, tokenExpiresAt, revokedAt |
| Pairing code | `PAIRCODE#<code>` | `PAIRCODE#<code>` / `TENANT#<tenantId>` | expiresAt (epoch s, TTL), usedAt |
| Account snapshot | `SNAP#ACCOUNT#<igUserId>#<YYYY-MM-DD>` | — | followersCount, followsCount, mediaCount, reach, views, accountsEngaged, totalInteractions, profileLinksTaps, demographics |
| Media | `MEDIA#<mediaId>` | — | caption, permalink, mediaType, mediaProductType, publishedAt, thumbnailUrl, metrics, commentCount, dmCount, enquiryCount |
| Media snapshot | `SNAP#MEDIA#<mediaId>#<YYYY-MM-DD>` | — | views, reach, likes, comments, saved, shares, totalInteractions, avgWatchTimeMs |
| Enquiry | `ENQ#<enquiryId>` | `TENANT#<tenantId>#ENQ` / `<createdAt>#<enquiryId>` | name, phone, intent, budgetBracket, preferredArea, temperature, sourceMediaId, igSenderId, igUsername, status, notes, createdAt |
| Thread | `THREAD#<conversationId>` | — | participantId, participantUsername, messageCount, lastInboundAt, lastOutboundAt, windowState, unanswered, firstSeenAt |
| Rule | `RULE#<ruleId>` | — | keyword, matchType, publicReply, dmMessage, mediaScope, enabled, createdAt |

Enumerations:

- `intent` is one of `buy`, `rent`, `heavy_deposit_ok`, `sell`, `unknown`
- `temperature` is one of `hot`, `warm`, `cold`
- `status` is one of `new`, `contacted`, `qualified`, `site_visit`, `won`, `lost`, `spam`
- `windowState` is one of `STANDARD`, `COMMENT_REPLY`, `HUMAN_AGENT`, `CLOSED`

### `<env>-realestateflow-insta-audit`

Ephemeral. TTL on `expiresAt`, no Retain (checklist item 7 explicitly exempts TTL-only
tables). PK `pk` is `TENANT#<tenantId>`, SK `sk` is `EVT#<isoTs>#<uuid>` or
`NONCE#<deviceId>#<nonce>`. Holds the API audit trail and HMAC replay nonces.

---

## 4. HTTP API

Base path `/api/insta`. All failures respond `{ error: string, details?: string }`,
matching the repo convention.

### Agent endpoints — HMAC auth (`middleware/deviceAuth.js`)

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/agent/register` | `{ pairingCode, deviceName, platform, agentVersion }` returns `{ deviceId, deviceSecret, tenantId }`. **No HMAC** — the pairing code is the credential. |
| POST | `/agent/heartbeat` | `{ igUserId, igUsername, agentVersion, tokenExpiresAt, counters }` returns `{ ok, serverTime, killSwitch }` |
| POST | `/agent/snapshot` | `{ accounts, media, mediaSnapshots }` — batched upsert, max 500 items |
| POST | `/agent/enquiries` | `{ enquiries }` — idempotent on `enquiryId` |
| POST | `/agent/threads` | `{ threads }` — batched upsert |
| GET | `/agent/rules` | returns `{ rules, updatedAt }` |

### Frontend endpoints — JWT auth (`middleware/validateToken.js`)

| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | headline counters plus a 30-day series for the dashboard |
| GET | `/accounts` | connected IG accounts and device health |
| POST | `/devices/pair` | returns `{ pairingCode, expiresAt }` |
| GET | `/devices` | list paired laptops |
| DELETE | `/devices/:deviceId` | revoke |
| GET | `/media` | reel leaderboard; `?sort=enquiries|views&limit=` |
| GET | `/media/:mediaId` | one reel plus its snapshot series |
| GET | `/enquiries` | `?status=&temperature=&limit=&cursor=` |
| PATCH | `/enquiries/:enquiryId` | `{ status?, notes? }` |
| GET | `/threads` | `?windowState=&unanswered=` |
| GET/POST | `/rules`, DELETE `/rules/:ruleId` | keyword rules |
| GET | `/insights/timeseries` | `?metric=followers|reach|views&days=` |
| GET | `/health` | unauthenticated liveness |

---

## 5. SQLite schema (laptop, `~/.ig-agent/agent.db`)

Local DB is the source of truth; the cloud copy is a projection.

| Table | Purpose |
|---|---|
| `accounts` | connected IG accounts, igUserId, username, tokenExpiresAt |
| `tokens` | encrypted access tokens (never leaves the laptop) |
| `media` | posts and reels |
| `media_metrics` | dated per-media metric rows |
| `account_metrics` | dated account-level metric rows |
| `conversations` | DM threads, window state |
| `messages` | individual DMs, direction, text, timestamp |
| `comments` | comments seen, trigger match, private-reply state |
| `enquiries` | extracted enquiries plus upload state |
| `drafts` | AI-drafted replies awaiting approval |
| `outbox` | queued outbound sends, window-checked |
| `rules` | keyword rules pulled from the CRM |
| `sync_state` | per-collector cursors |
| `audit_log` | every API call and message, local forever |
| `upload_queue` | pending cloud uploads, retry count |

---

## 6. Meta API surface actually used

| Purpose | Endpoint | Scope |
|---|---|---|
| OAuth | `https://api.instagram.com/oauth/authorize`, `/oauth/access_token` | — |
| Long-lived token | `GET /access_token?grant_type=ig_exchange_token` | — |
| Refresh | `GET /refresh_access_token?grant_type=ig_refresh_token` | — |
| Profile | `GET /me?fields=user_id,username,followers_count,follows_count,media_count,biography,profile_picture_url` | `instagram_business_basic` |
| Account insights | `GET /me/insights?metric=reach,views,accounts_engaged,total_interactions,follows_and_unfollows,profile_links_taps` | `instagram_business_basic` |
| Media list | `GET /me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp` | `instagram_business_basic` |
| Media insights | `GET /<media-id>/insights?metric=views,reach,likes,comments,saved,shares,total_interactions` | `instagram_business_basic` |
| Comments | `GET /<media-id>/comments` | `instagram_business_manage_comments` |
| Public comment reply | `POST /<comment-id>/replies` | `instagram_business_manage_comments` |
| **Private reply (comment to DM)** | `POST /<ig-id>/messages` with `recipient:{comment_id}` | `instagram_business_manage_messages` |
| Conversations | `GET /me/conversations?platform=instagram` | `instagram_business_manage_messages` |
| Messages | `GET /<conversation-id>?fields=messages{id,from,to,message,created_time}` | `instagram_business_manage_messages` |
| Send DM | `POST /me/messages` | `instagram_business_manage_messages` |

`BASE = https://graph.instagram.com/v23.0`. **Verify the metric list against the live API
version at build time** — Meta removed `impressions`, `plays` and `profile_views` in
April 2025, so the collectors must degrade gracefully when a metric disappears rather
than failing the whole sync.

## 7. Rate limits enforced client-side

| Bucket | Meta ceiling | Our cap |
|---|---|---|
| Graph reads | 4800 x impressions / 24h | 200 / hour |
| DM sends | 100 / second | 200 / hour |
| Comment private replies | 750 / hour | 150 / hour |
| Comment replies | — | 150 / hour |
| Publishing | 50 / 24h | 20 / 24h |

Any `4`, `613`, `80007` or `2018001` response halts that bucket until the next window.
Retrying a window-blocked send is forbidden — the sender downgrades the thread state
instead.
