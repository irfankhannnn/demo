# Implementation — API Requirements

REST under the existing conventions: base `/api/...`, auth via `validateToken` (JWT) + `extractTenantId` (`tenantMiddleware.js`), error shape **`{ error: string, details?: string }`** (matches `routes/leads.js`). Webhook routes use **HMAC signature verification** instead of JWT and resolve tenant from the verified payload/path. All responses are tenant-scoped; no endpoint accepts a client-supplied tenant when a JWT is present (server-derived `tenantId` wins, per `extractTenantId`).

Conventions:
- Timestamps ISO-8601 UTC.
- Idempotency: mutating webhook/event calls accept `Idempotency-Key` (or use `dedupeKey`).
- Pagination: `limit` + `offset` (or `cursor`) like existing lead routes.

---

## 1. New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/marketing/events` | JWT or HMAC | Ingest a normalized marketing event |
| GET | `/api/marketing/events` | JWT | Query events (type, channel, range) |
| GET | `/api/marketing/dashboard/funnel` | JWT (admin) | Funnel counts reach→DM→demo→trial→paid→referral |
| GET | `/api/marketing/dashboard/attribution` | JWT (admin) | Leads/demos/paid by source and by `contentRef (OPP-*)` |
| GET | `/api/marketing/dashboard/cohorts` | JWT (admin) | Trial→paid + retention cohorts |
| POST | `/api/marketing/sequences/enroll` | JWT | Enroll a lead into a sequence |
| POST | `/api/marketing/sequences/cancel` | JWT | Cancel enrollment (reply/convert/opt-out) |
| GET | `/api/referrals` | JWT | List referral codes/status |
| POST | `/api/referrals` | JWT | Create a referral code for a customer |
| POST | `/api/referrals/convert` | JWT or HMAC | Attribute + reward on conversion |
| GET | `/api/leads/:id/score` | JWT | Lead/activation/health scores |
| POST | `/api/webhooks/instagram` | HMAC | IG comments/DMs |
| POST | `/api/webhooks/whatsapp` | HMAC | WhatsApp inbound + status |
| POST | `/api/webhooks/meta-leadads` | HMAC | Meta Lead Ads form submissions |
| POST | `/api/webhooks/blotato` | HMAC | Post-published events |

## 2. Changed endpoints

| Path | Change |
|---|---|
| `POST /api/crm/leads` (and `routes/leads.js` create) | Accept + persist `leadSource, utmSource, utmMedium, utmCampaign, utmContent, campaignId, contentRef, consent`. Backward compatible (all optional; default `leadSource='unknown'`). |
| `GET /api/leads` | Add filters `leadSource`, `minScore`, `stage`; response includes `leadSource`, `leadScore`, `contentRef`. |
| `GET /api/leads/:id` | Include attribution block + denormalized scores. |

---

## 3. Endpoint specifications

### POST /api/marketing/events
Ingest a canonical event. Idempotent by `dedupeKey`.

Request:
```json
{
  "type": "dm",
  "channel": "instagram",
  "occurredAt": "2026-06-18T09:12:00Z",
  "leadRef": "LEAD#abc123",
  "contentRef": "OPP-0142",
  "campaignId": "cmp_reel_q2",
  "dedupeKey": "ig:17900000000000001",
  "payload": { "keyword": "PRICE", "username": "agent_rahul" }
}
```
Response `201`:
```json
{ "eventId": "evt_9f...", "deduped": false }
```
Errors: `400` invalid `type`/`channel`; `401` bad auth/signature; `409`-style dedupe returns `200 {deduped:true}` (not an error); `500 {error, details}`.

### GET /api/marketing/events
Query: `type`, `channel`, `from`, `to`, `leadRef`, `limit`, `offset`.
Response `200`:
```json
{ "items": [ { "eventId":"...","type":"dm","channel":"instagram","occurredAt":"...","leadRef":"LEAD#abc123","contentRef":"OPP-0142" } ],
  "nextOffset": 50 }
```

### GET /api/marketing/dashboard/funnel
Query: `from`, `to`, `channel?`, `campaignId?`.
Response `200`:
```json
{
  "range": {"from":"2026-06-01","to":"2026-06-18"},
  "stages": [
    {"stage":"reach","count":48000},
    {"stage":"dm","count":410},
    {"stage":"demo_booked","count":38},
    {"stage":"trial_started","count":17},
    {"stage":"paid","count":6},
    {"stage":"referral","count":2}
  ],
  "dropoff": {"dm_to_demo":0.093,"demo_to_trial":0.447,"trial_to_paid":0.353}
}
```

### GET /api/marketing/dashboard/attribution
Query: `from`, `to`, `groupBy=source|content`.
Response `200`:
```json
{
  "groupBy":"content",
  "rows":[
    {"key":"OPP-0142","leads":120,"demos":14,"paid":4,"leadToDemo":0.117,"demoToPaid":0.286},
    {"key":"OPP-0098","leads":80,"demos":6,"paid":1,"leadToDemo":0.075,"demoToPaid":0.167}
  ]
}
```

### GET /api/marketing/dashboard/cohorts
Query: `cohortBy=signup_week`, `from`, `to`.
Response `200`:
```json
{
  "cohorts":[
    {"cohort":"2026-W22","trials":12,"paidD7":2,"paidD30":4,"retainedD30":0.58}
  ]
}
```

### POST /api/marketing/sequences/enroll
Request:
```json
{ "leadId":"abc123", "seqId":"winback", "channel":"whatsapp" }
```
Response `201`:
```json
{ "enrollmentId":"SEQ#abc123#winback", "status":"active", "nextAt":"2026-06-18T10:00:00Z" }
```
Errors: `400` no consent for channel (`{error:"consent_required", details:"whatsapp"}`); `404` lead not found; `409` already enrolled (returns existing).

### POST /api/marketing/sequences/cancel
```json
{ "leadId":"abc123", "seqId":"winback", "reason":"replied" }
```
Response `200 { "status":"cancelled" }`. Removes future `SCHEDULED_NOTIFICATION`.

### GET /api/referrals  /  POST /api/referrals
GET response:
```json
{ "items":[ {"code":"RAHUL20","referrerId":"cust_1","status":"converted","reward":{"type":"credit","amount":1000,"currency":"INR"}} ] }
```
POST request `{ "referrerId":"cust_1", "reward":{"type":"credit","amount":1000,"currency":"INR"} }` → `201` with generated `code`.

### POST /api/referrals/convert
```json
{ "code":"RAHUL20", "refereeLeadId":"abc123" }
```
Response `200 { "status":"converted","rewardIssued":true }`. Idempotent on `code+refereeLeadId`.

### GET /api/leads/:id/score
Response `200`:
```json
{ "leadScore":78,"band":"Hot","activationScore":null,"healthScore":null,
  "signals":{"sourceQuality":15,"recency":20,"intentKeyword":20,"icpFit":15,"contactable":5,"depth":3},
  "computedAt":"2026-06-18T08:00:00Z","version":"v1" }
```

### Webhook contract (all `/api/webhooks/*`)
- **Signature:** verify provider HMAC (Meta `X-Hub-Signature-256`; WhatsApp same; Blotato shared secret) before parsing body. Fail closed → `401`.
- **Tenant resolution:** map provider account/page id → `tenantId` via `CAMPAIGN`/account-mapping config; reject if unmapped (`400`).
- **Normalization:** translate provider payload → canonical `MKT_EVENT` (see POST /events schema) and hand to `marketingEventsService`.
- **Idempotency:** provider event id → `dedupeKey`.
- **Ack fast:** return `200` immediately after enqueue (providers retry on non-2xx); processing is async via SQS.

Example normalized IG comment webhook → event:
```json
{ "type":"comment","channel":"instagram","occurredAt":"2026-06-18T09:00:00Z",
  "contentRef":"reel_17841...","dedupeKey":"ig:comment:18029...",
  "payload":{"text":"price?","fromUsername":"agent_rahul","mediaId":"17841..."} }
```

---

## 4. Changed: POST /api/crm/leads (create) — extended request
```json
{
  "name":"Rahul Sharma","phone":"+919812345678","leadType":"buyer",
  "leadSource":"instagram_dm","utmSource":"instagram","utmMedium":"reel",
  "utmCampaign":"q2_reels","utmContent":"OPP-0142","campaignId":"cmp_reel_q2",
  "contentRef":"OPP-0142",
  "consent":{"whatsapp":true,"email":false,"capturedAt":"2026-06-18T09:12:00Z","source":"ig_dm_optin"}
}
```
Validation: `name` required, `leadType ∈ {buyer,seller,tenant,owner}` (unchanged); attribution all optional; invalid `leadSource` → `400 {error:"invalid leadSource"}`. Duplicate phone still returns `409` (existing behavior).

---

## 5. Error & status conventions

| Code | When |
|---|---|
| 400 | validation / unmapped webhook tenant / invalid enum |
| 401 | bad JWT or failed webhook signature |
| 403 | RBAC (admin-only dashboards/sequences for Member where applicable) |
| 404 | lead/referral not found |
| 409 | duplicate phone on lead create |
| 200 + `{deduped:true}` | idempotent replay (events/referrals) — not an error |
| 500 | `{error, details}` |

Cross-refs: `database-requirements.md` (entities + GSIs), `technical-design.md` (flows + scoring), `ui-requirements.md` (consumers), `infrastructure-requirements.md` (webhook routing + SQS).
