# marketplace-api

Consumer-facing API of the AI property-matching marketplace (the
MagicBricks-style portal): catalogue reads across every opted-in agency, a
Hinglish-aware AI search, saved homes and searches, buyer↔agency
conversations, "I'm interested" pings and site-visit booking.

Express on Lambda, ESM, Node 20. Contract:
[`docs/public-app/api/API-CONTRACT.md`](../../docs/public-app/api/API-CONTRACT.md).

## The one thing to know before changing anything

**No property or agency data is copied here.** This service holds consumer
data only — profiles, saved items, searches, threads, messages, rate-limit
counters — in one DynamoDB table. Every listing is fetched from the CRM's
`/api/internal/marketplace/*` at request time (cached 60 s in-process) and
serialised there through an allowlist. Which listings are visible at all is
decided by the CRM's sparse indexes in
[`agency-app/api/marketplaceIndexing.js`](../../agency-app/api/marketplaceIndexing.js);
there is no sync job and no second store that could drift.

The Lambda role therefore grants exactly one table (its own), plus
`ses:SendEmail` only when a sender is configured and `bedrock:InvokeModel`
only for the configured model when `MODEL_PROVIDER=bedrock`. Widening the
policy in `infra/cfn-marketplace-api.yaml`, or reaching for CRM tables
directly, removes the guarantee.

## Endpoints

| Group | Auth | Routes |
|---|---|---|
| Public | none (IP guard) | `GET /health`, `/cities`, `/listings`, `/agencies/:slug`, `/agencies/:slug/listings/:propertyId` (+ `saved` when logged in), `…/similar`, `POST /search/ai`, `GET /i/:slug/:id/:n`, `/d/:slug/:id/:n` (302 to presigned), `/share/p/:slug/:id` (OG + JSON-LD + redirect), `/sitemap.xml`, `/robots.txt` |
| Consumer | `Authorization: Bearer <Cognito token>` | `GET/PUT /me`, `GET /me/saved`, `PUT/DELETE /me/saved/:slug/:id`, `GET/POST/DELETE /me/searches[/:id]`, `GET/POST /me/threads`, `GET /me/threads/:id?since`, `POST /me/threads/:id/messages`, `POST /me/threads/:id/read`, `POST /listings/:slug/:id/ping`, `GET /listings/:slug/:id/availability`, `POST /listings/:slug/:id/visit` |
| Internal | `x-api-key` = CRM or auth caller key | `GET /internal/tenants/:t/threads`, `GET /internal/threads/:id`, `POST /internal/threads/:id/messages`, `POST /internal/threads/:id/read`, `POST /internal/tenants/:t/closed`, `DELETE /internal/users/:id` |

Errors are always `{ error, details? }`. A CRM outage is a 503 with
`details: 'upstream_unavailable'`, never a 404.

### AI search

`POST /search/ai` → `modelGateway.parseIntent` (Gemini or Bedrock Claude,
strict JSON, understands "2 bhk andheri under 80 lakh", "1.2 cr", "50k
kiraye pe") → CRM `POST /search` (vector search in one city) →
`modelGateway.explain` (a one-line *why* per result, two follow-ups). Every
model call has a non-model fallback: a deterministic parser
(`heuristicIntent` in `services/aiSearch.js`, tested on its own), a plain
filtered listing read if vector search is unavailable, and `why: null` when
explanation fails. A buyer always gets flats.

Rate: 20/IP/hour anonymous, 60/user/hour logged in.

### Threads

One thread per buyer + property, enforced with a conditional pointer item
written in the same transaction as the thread. The first message becomes a
CRM lead (`POST /enquiries`); later ones raise alerts. Agency replies arrive
via `/internal/threads/:id/messages` from the CRM inbox and bump
`unreadBuyer` (+ an SES email when the buyer has one). Deleting an account
removes the buyer's partition and anonymises their side of every thread; the
agency's record is kept.

## Environment

See [`.env.sample`](.env.sample) — every variable is annotated there.
Required at cold start: `MARKETPLACE_TABLE_NAME`,
`CRM_INTERNAL_API_DOMAIN_NAME`, `CRM_INTERNAL_API_BASE_PATH`,
`MARKETPLACE_INTERNAL_API_KEY`, `CRM_CALLER_API_KEY`, `AUTH_CALLER_API_KEY`,
`COGNITO_USER_POOL_ID`. Placeholder until the web domain is decided:
`MARKETPLACE_WEB_ORIGIN` (CORS + share redirect; empty = CORS closed in prod).
`MARKETPLACE_API_DOMAIN_NAME` is the shared `services-api.*` custom domain,
with base path `<env>realestatemarketplace`, like every other backend.

## Running locally

Needs the CRM server on `localhost:3001` with `MARKETPLACE_INTERNAL_API_KEY`
set in its `.env`.

```bash
npm install
cp .env.sample .env
# CRM_INTERNAL_API_DOMAIN_NAME=http://localhost:3001   (a scheme is allowed for local dev)
# CRM_INTERNAL_API_BASE_PATH=                          (empty locally)
# MARKETPLACE_INTERNAL_API_KEY=<same as the CRM's>
# CRM_CALLER_API_KEY / AUTH_CALLER_API_KEY / COGNITO_USER_POOL_ID / MARKETPLACE_TABLE_NAME
# NODE_ENV=development                                  (in-memory rate counters)
npm run dev                  # http://localhost:3006
```

`NODE_ENV=development` (or `GUARD_STORE=memory`) uses in-memory rate
counters. Everything else needs the real table; point `MARKETPLACE_TABLE_NAME`
at the dev stack's table with an AWS profile in the environment.

## Tests

```bash
npm test
```

`node --test`, no AWS: the heuristic intent parser (lakh/crore/k, rent vs
sale, Hinglish, city aliases) and the search flow with a failing model;
thread dedupe, the lost-race recovery, unread counters, `since` cursors and
anonymisation against a scripted DocumentClient; the caller-key check end to
end through Express; share-page escaping and JSON-LD; cache TTL.
`infra/deploy.sh` runs them before it packages anything.

## Deploying

```bash
# Preferred — build tracking, tagging, rollback, config-only deploys
infra/cicd/public-app/api/deploy.sh dev

# Direct
./infra/deploy.sh dev
```

Requires `.env.dev` or `.env.prod` (never a bare `.env`). Stack
`<env>-realestateflow-marketplace-api-stack`; table
`<env>-realestateflow-marketplace` (PITR, retained on delete). The API is
mapped onto the shared custom domain (`ENABLE_CUSTOM_DOMAIN_MAPPING=true`,
`ENABLE_BASE_PATH_STRIP=true`); the stack publishes no raw invoke URL. The
CRM's `MARKETPLACE_API_DOMAIN_NAME` / `_BASE_PATH` point at the same place,
and its inbox reports "not configured" while they are blank.

## Layout

```
config/env.js                  validated config; fails the cold start if misconfigured
middleware/auth.js             Cognito JWT (jwks-rsa + jsonwebtoken); authOptional / authRequired
middleware/internalAuth.js     constant-time caller-key check for /internal
middleware/cors.js             allowlist from MARKETPLACE_WEB_ORIGIN
middleware/rateLimit.js        429 wrappers over services/abuseGuard.js
routes/public.js               catalogue, AI search, assets, share, SEO
routes/me.js                   consumer surface (+ per-listing ping/availability/visit)
routes/internal.js             agency inbox + account deletion
services/crmClient.js          the only door to listing data; 60 s cache, assets never cached
services/aiSearch.js           parse → search → explain, with fallbacks; heuristicIntent()
services/modelGateway/         gemini.js, bedrockClaude.js, shared prompts; picked by MODEL_PROVIDER
services/threadsRepo.js        threads + messages, GSI1/GSI2, ThreadLookup dedupe
services/usersRepo.js          profile, saved, searches, delete-user
services/abuseGuard.js         DynamoDB counters under GUARD# keys in the same table
services/buyerNotify.js        SES email on agency reply
services/share.js              OG/JSON-LD share page; esc() is not optional
services/sitemap.js            sitemap.xml / robots.txt
```
