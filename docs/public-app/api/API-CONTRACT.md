# Marketplace — API contract (all three services + CRM)

The consumer marketplace ("AI property matching portal") is three services
plus changes in the CRM. This file is the single contract they are built
against. Every request/response below is JSON. Errors are always
`{ error: string, details?: string }`.

```
marketplace-web  ──JWT──►  marketplace-api  ──x-api-key──►  CRM /api/internal/marketplace/*
      │                         │
      └──────────────────►  marketplace-authentication (Cognito consumer pool)
CRM /api/crm/marketplace/*  ──x-api-key──►  marketplace-api /internal/*
```

Design rule: **no property/agency data is copied**. marketplace-api holds
only consumer data (profiles, saved, searches, threads, messages, guard).
Everything about a listing is fetched from the CRM at request time (cached
60 s). See `agency-app/api/marketplaceIndexing.js` for how a listing becomes
visible (sparse `GSI4` + `marketplace-vector-index` on the CRM table).

---

## 1. CRM internal API — `/api/internal/marketplace/*`

Mounted in `agency-app/api/server.js`; implemented in
`agency-app/api/routes/marketplaceInternal.js`. Base URL for callers:
`https://<CRM_INTERNAL_API_DOMAIN_NAME>/<CRM_INTERNAL_API_BASE_PATH>/api/internal/marketplace`.

Auth: header `x-api-key: <MARKETPLACE_INTERNAL_API_KEY>` on every route.
Reads are cross-tenant (no tenant header). Writes require `x-tenant-id`.

### Listing shape (`MarketplaceListing`)

`toPublicProperty()` allowlist + agency card:

```json
{
  "propertyId": "p_123", "slug": "2-bhk-andheri-west",
  "title": "…", "description": "…", "propertyType": "apartment",
  "bhk": 2, "furnishing": "semi-furnished", "facing": "east",
  "carpetArea": 850, "builtUpArea": 1000, "amenities": ["Gym", "Lift"],
  "locality": "Andheri West", "city": "Mumbai", "buildingName": "…",
  "latitude": 19.13, "longitude": 72.83,
  "status": "for-sale",
  "pricing": { "mode": "sale" | "rent", "amount": 8500000 | null, "deposit": null },
  "imageCount": 6, "documents": [{ "kind": "brochure", "label": "Brochure" }],
  "availableFrom": null, "updatedAt": "2026-09-17T…",
  "tenantId": "t_1", "agencySlug": "sharma-realty",
  "agency": { "name": "Sharma Realty", "slug": "sharma-realty", "logoS3Key": null, "brandPrimaryColor": "#FF7A1A" },
  "listedAt": "2026-09-01T…",
  "matchScore": 0.81            // only on search / similar results (1 - cosine distance)
}
```

Images are never URLs: fetch `…/asset?kind=image&index=N` for a presigned URL.

### Reads

| Method | Path | Query / body | Response |
|---|---|---|---|
| GET | `/cities` | – | `{ cities: [{ name, cityKey, sale, rent, total }] }` (only cities with listings; 5-min cache) |
| GET | `/listings` | `city` (required), `mode=sale\|rent`, `locality`, `minPrice`, `maxPrice`, `bhk`, `minBhk`, `maxBhk`, `propertyType`, `furnishing`, `sort=newest\|price_asc\|price_desc`, `limit≤50`, `cursor` | `{ items: MarketplaceListing[], nextCursor, cityKey, mode }` |
| POST | `/search` | `{ query (2-500), city (required), mode?, locality?, propertyType?, minPrice?, maxPrice?, bhk?, minBhk?, maxBhk?, furnishing?, limit≤25 }` | `{ items: MarketplaceListing[] (with matchScore), cityKey, reason?: 'city_required'\|'search_unavailable' }` |
| GET | `/agencies/:slug` | – | `{ agency: { tenantId, slug, name, logoS3Key, brandPrimaryColor, publicPhone, publicEmail, publicAddress, about, marketplaceEnabled } }` — 404 if not on marketplace |
| GET | `/agencies/:slug/listings/:propertyId` | – | `{ listing }` — 404 when missing/unpublished/unlisted |
| GET | `/agencies/:slug/listings/:propertyId/similar` | `limit≤12` | `{ items }` |
| GET | `/agencies/:slug/listings/:propertyId/asset` | `kind=image\|document`, `index` | `{ url, expiresIn: 900 }` |
| GET | `/sitemap-entries` | – | `{ entries: [{ agencySlug, propertyId, updatedAt, cityKey, mode }] }` |

Read responses carry `Cache-Control: public, s-maxage=60` (cities 300, sitemap 3600).

### Writes (header `x-tenant-id` required)

Common buyer body: `{ name, phone, email?, marketplaceUserId, propertyId, threadId, messageId?, text?, dedupeKey? }`

| Method | Path | Notes | Response |
|---|---|---|---|
| POST | `/enquiries` | first message of a thread → `ingestLead` (source `Marketplace`, sourceAdapter `marketplace`) + `notifyMarketplaceActivity(kind='enquiry')` | `{ ok, leadId, leadCreated, propertyTitle }` or `{ ok, duplicate: true }` |
| POST | `/messages` | later buyer message → alert (kind `message`) | same |
| POST | `/pings` | "I'm interested" (kind `ping`) | same |
| GET | `/availability` | `days≤30` → `{ timeZone, dates: [{ date, slots: ["10:00", …] }] }` (CRM `getAvailability`) | |
| POST | `/site-visits` | `{ name, phone, email?, marketplaceUserId, propertyId, threadId?, meetingDate: 'YYYY-MM-DD', meetingTime: 'HH:MM', message?, dedupeKey? }` → CRM `bookSiteVisit` | `{ ok, meetingId, leadId, meetingDate, meetingTime, propertyTitle }`; 400 with `details` ∈ `missing_name_or_phone, invalid_date, invalid_time, date_in_past, date_too_far, slot_unavailable, property_unavailable` |

Alerts fan out per AgencyConfig `marketplaceNotifications` `{ email, whatsapp, push, extraEmails[], extraPhones[] }`
(edited in the CRM under Settings → Public pages). The in-app notification deep-links to
`/crm/marketplace/inbox/<threadId>`.

---

## 2. marketplace-api — `public-app/api/`

Express on Lambda (ESM, Node 20), own REST API Gateway, base URL
`https://<MARKETPLACE_API_DOMAIN_NAME>/<MARKETPLACE_API_BASE_PATH>` (dev:
`services-api.cloudberrysolutions.in/devrealestatemarketplace`; consumer auth
is at `/devrealestatemarketplaceauth`). Only the web domain is a placeholder.

Auth:
- **Public**: none (abuse guard by IP).
- **Consumer** (`/me/*`, `/listings/*/ping|visit`): `Authorization: Bearer <Cognito ID token>` from marketplace-authentication (access tokens are also accepted, but Cognito access tokens carry no `phone_number`/`email`/`name`, so the web app sends the ID token). Verified with `jwks-rsa` against `COGNITO_USER_POOL_ID` (+ client binding when `COGNITO_CLIENT_ID` is set); `req.user = { userId (= sub), sub, phone?, email?, name? }`. Chat/ping/visit return `400 profile_incomplete` until the profile has name + phone.
- **Internal** (`/internal/*`): `x-api-key: <CRM_CALLER_API_KEY>` (presented by the CRM) or `<AUTH_CALLER_API_KEY>` (presented by marketplace-authentication) — both accepted, checked constant-time.

Env: `MARKETPLACE_TABLE_NAME`, `CRM_INTERNAL_API_DOMAIN_NAME`, `CRM_INTERNAL_API_BASE_PATH`, `MARKETPLACE_INTERNAL_API_KEY` (to CRM), `CRM_CALLER_API_KEY`, `AUTH_CALLER_API_KEY`, `COGNITO_USER_POOL_ID`, `COGNITO_REGION`, `MODEL_PROVIDER=gemini|bedrock`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `BEDROCK_MODEL_ID`, `MARKETPLACE_WEB_ORIGIN` (CORS; placeholder), `SES_FROM_EMAIL`, guard limits.

### Public

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/health` | – | `{ ok, service, version }` |
| GET | `/cities` | – | proxied CRM `{ cities }` |
| GET | `/listings` | same query as CRM `/listings` | proxied |
| GET | `/agencies/:slug` | – | proxied |
| GET | `/agencies/:slug/listings/:propertyId` | – | `{ listing }` + `saved: boolean` when logged in |
| GET | `/agencies/:slug/listings/:propertyId/similar` | – | proxied |
| POST | `/search/ai` | `{ query, city?, filters?: { mode, propertyType, bhk, minPrice, maxPrice, locality, furnishing }, conversationId? }` | `{ intent: { cityKey, city, mode, propertyType, bhk, minPrice, maxPrice, locality, mustHaves[], canonicalQuery }, results: MarketplaceListing[] (matchScore, why), followUps: string[], assistantMessage: string, needsCity: boolean }` |
| GET | `/i/:slug/:propertyId/:index` | – | 302 → presigned image URL (cache 300 s) |
| GET | `/d/:slug/:propertyId/:index` | – | 302 → presigned document |
| GET | `/share/p/:slug/:propertyId` | – | HTML with OG/JSON-LD + meta-refresh to `<MARKETPLACE_WEB_ORIGIN>/p/:slug/:propertyId` |
| GET | `/sitemap.xml`, `/robots.txt` | – | text |

`POST /search/ai` flow: `modelGateway.parseIntent(query, city)` → JSON intent; if no city → `needsCity: true, assistantMessage` asks for it; else CRM `POST /search` with `canonicalQuery` + filters; then `modelGateway.explain(query, top 8)` → `why` per result + 2 follow-ups. Guard: 20/IP/hour anonymous, 60 logged-in.

### Consumer (`authRequired`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/me` | – | `{ user: { userId, name, phone, email, preferredCities, createdAt } }` |
| PUT | `/me` | `{ name?, email?, preferredCities? }` | `{ user }` |
| GET | `/me/saved` | – | `{ items: [{ propertyId, tenantId, agencySlug, savedAt, snapshot: { title, price, mode, locality, city, imageCount } }] }` |
| PUT | `/me/saved/:slug/:propertyId` | – | `{ ok }` (fetches listing from CRM for snapshot) |
| DELETE | `/me/saved/:slug/:propertyId` | – | `{ ok }` |
| GET/POST/DELETE | `/me/searches[/:searchId]` | `{ query, city, filters }` | `{ items }` / `{ search }` / `{ ok }` |
| GET | `/me/threads` | `cursor?` | `{ items: Thread[], nextCursor }` |
| POST | `/me/threads` | `{ slug, propertyId, text }` | `{ thread, message }` — one thread per buyer+property (returns existing + appends message); first message → CRM `POST /enquiries`; profile must have `name` + `phone` |
| GET | `/me/threads/:threadId` | `since?` (ISO) | `{ thread, messages: Message[] }` |
| POST | `/me/threads/:threadId/messages` | `{ text }` | `{ message }` → CRM `POST /messages` |
| POST | `/me/threads/:threadId/read` | – | `{ ok }` (unreadBuyer = 0) |
| POST | `/listings/:slug/:propertyId/ping` | – | `{ ok, thread }` (1 per property per 24 h; creates/uses thread; system message kind `ping`; CRM `POST /pings`) |
| GET | `/listings/:slug/:propertyId/availability` | – | proxied CRM availability |
| POST | `/listings/:slug/:propertyId/visit` | `{ date, time, message? }` | `{ ok, meetingId, meetingDate, meetingTime, thread }` → CRM `POST /site-visits`; appends `visit_request` message |

```ts
Thread   { threadId, buyerUserId, tenantId, agencySlug, propertyId, leadId|null,
           status: 'open'|'listing_removed'|'agency_closed',
           snapshot: { title, agencyName, city, locality, price, mode, imageCount },
           lastMessageAt, lastPreview, unreadBuyer, unreadAgency, createdAt }
Message  { messageId, threadId, senderType: 'buyer'|'agency'|'system', senderId, senderName,
           text, kind: 'text'|'ping'|'visit_request', meta?: { meetingId, meetingDate, meetingTime }, createdAt }
```

### Internal (`internalAuth`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/internal/tenants/:tenantId/threads` | `status?, limit?, cursor?` | `{ items: Thread[] (+ buyer: { name, phone, email }), nextCursor }` |
| GET | `/internal/threads/:threadId` | `since?`; header `x-tenant-id` must equal thread.tenantId | `{ thread, buyer, messages }` |
| POST | `/internal/threads/:threadId/messages` | `{ text, agentUserId, agentName }` | `{ message }` (unreadBuyer++, buyer email via SES if set) |
| POST | `/internal/threads/:threadId/read` | – | `{ ok }` (unreadAgency = 0) |
| POST | `/internal/tenants/:tenantId/closed` | – | `{ updated }` (open threads → `agency_closed`) |
| POST | `/internal/tenants/:tenantId/reopened` | – | `{ updated }` (`agency_closed` threads → `open`) |
| DELETE | `/internal/users/:userId` | – | `{ ok }` (profile/saved/searches deleted; messages anonymised `senderName: 'Deleted user'`) |

### MarketplaceTable `<env>-realestateflow-marketplace`

| Entity | PK | SK | GSI1 (PK/SK) | GSI2 (PK/SK) |
|---|---|---|---|---|
| Profile | `USER#<userId>` | `PROFILE` | | |
| Saved | `USER#<userId>` | `SAVED#<propertyId>` | | |
| Search | `USER#<userId>` | `SEARCH#<searchId>` | | |
| ThreadLookup | `USER#<userId>` | `THREAD_FOR#<propertyId>` | | |
| Thread | `THREAD#<threadId>` | `META` | `USER#<buyerUserId>` / `THREAD#<lastMessageAt>` | `TENANT#<tenantId>` / `THREAD#<lastMessageAt>` |
| Message | `THREAD#<threadId>` | `MSG#<ISO>#<ulid>` | | |
| Guard | `GUARD#<scope>#<key>` | `WINDOW#<bucket>` | | (TTL attr `expiresAt`) |

Attributes `GSI1PK, GSI1SK, GSI2PK, GSI2SK`; PAY_PER_REQUEST; PITR; `DeletionPolicy: Retain`.

---

## 3. marketplace-authentication — `public-app/auth/`

TypeScript Express on Lambda, own Cognito user pool (`UsernameAttributes: [phone_number]`, email optional), own tables
`<env>-realestateflow-marketplace-auth-{users,identities,otp}`. Base URL
`https://<MARKETPLACE_AUTH_DOMAIN_NAME>/<MARKETPLACE_AUTH_BASE_PATH>`.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | – | `{ ok }` |
| POST | `/auth/phone/start` | `{ phone }` (E.164 or 10-digit Indian; normalised to `+91…`) | `{ session, phone, expiresInSeconds }` — 429 after 3 per 15 min |
| POST | `/auth/phone/confirm` | `{ phone, otp, session }` | `{ accessToken, idToken, expiresIn, user: { userId, phone, email, name, isNew } }` + `Set-Cookie: mp_refresh=<httpOnly>` |
| GET | `/auth/google/url` | `?redirectUri` | `{ url, state, codeVerifier }` |
| POST | `/auth/token` | `{ code, codeVerifier, redirectUri }` | same as confirm |
| POST | `/auth/refresh` | cookie | `{ accessToken, idToken, expiresIn }` |
| POST | `/auth/logout` | cookie | `{ ok }` (clears cookie) |
| GET | `/auth/me` | Bearer | `{ user: { userId, phone, email, name, createdAt } }` |
| PATCH | `/auth/profile` | Bearer `{ name?, email? }` | `{ user }` |
| DELETE | `/auth/me` | Bearer | `{ ok }` → calls marketplace-api `DELETE /internal/users/:id` with `AUTH_CALLER_API_KEY`, disables Cognito user |
| GET | `/internal/users/:userId` | `x-internal-api-key` | `{ user }` |

JWT claims used by marketplace-api: `sub` (= userId), `phone_number`, `email`, `name`, `token_use: 'id'` (or `'access'`). `userId` is the Cognito `sub`.
`TEST_OTP_ENABLED=true` + `TEST_OTP_CODE` short-circuit SMS in dev.

---

## 4. marketplace-web — `public-app/web/`

Vite React SPA. Env: `VITE_MARKETPLACE_API_URL`, `VITE_MARKETPLACE_AUTH_URL`, `VITE_GOOGLE_MAPS_EMBED_KEY?`, `VITE_HCAPTCHA_SITE_KEY?`.
Routes: `/`, `/search`, `/p/:slug/:propertyId`, `/agency/:slug`, `/me/saved`, `/me/enquiries`, `/me/enquiries/:threadId`, `/me/searches`, `/me/profile`.
Access token kept in memory; refresh via `POST /auth/refresh` (cookie, `credentials: 'include'`).

---

## 5. CRM agent-facing — `/api/crm/marketplace/*` (JWT)

`GET /status` → `{ configured }`; `GET /threads`; `GET /threads/:id?since`; `POST /threads/:id/messages { text }`; `POST /threads/:id/read`. Thin proxies to marketplace-api `/internal/*` with `MARKETPLACE_CALLER_API_KEY`.
