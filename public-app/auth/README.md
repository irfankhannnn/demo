# marketplace-authentication

Consumer authentication for the RealEstateFlow property marketplace: the
people who browse, save and enquire about listings (buyers and renters). It
is a trimmed clone of `platform/auth` with the agency
concepts removed — no tenants, invites, roles or agency config. One Cognito
user pool, phone OTP and Google sign-in, three DynamoDB tables.

The API contract lives in `docs/public-app/api/API-CONTRACT.md`
(section 3). marketplace-api verifies the access tokens this service issues
against the same pool; `sub` is the consumer's `userId` everywhere.

## Stack

- Node 20 + TypeScript + Express, on Lambda via `@vendia/serverless-express`
- Amazon Cognito: `UsernameAttributes: [phone_number]` (the E.164 phone is
  the username, email optional), CUSTOM_AUTH triggers for OTP, Google IdP
  through managed login v2
- DynamoDB: `<env>-realestateflow-marketplace-auth-{users,identities,otp}`
- REST API Gateway with a single `{proxy+}` ANY route; the app checks
  bearer tokens (JWKS) and `x-internal-api-key` itself
- CloudFormation in `infra/cfn-backend.yaml`; deploy via
  `infra/cicd/public-app/auth/deploy.sh`

## Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | – | `{ ok, service }` |
| POST | `/auth/phone/start` | – | `{ session, phone, expiresInSeconds }` — 429 after 3 per 15 min per IP |
| POST | `/auth/phone/confirm` | – | `{ accessToken, idToken, expiresIn, user: { userId, phone, email, name, createdAt, isNew } }` + `Set-Cookie: mp_refresh` |
| GET | `/auth/google/url?redirectUri=…&state=…` | – | `{ url, state, codeVerifier }` |
| POST | `/auth/token` | – | same as confirm (body `{ code, codeVerifier, redirectUri }`) |
| POST | `/auth/refresh` | cookie | `{ accessToken, idToken, expiresIn }` |
| POST | `/auth/logout` | cookie | `{ ok }` — revokes the refresh token, clears the cookie |
| GET | `/auth/me` | Bearer | `{ user: { userId, phone, email, name, createdAt } }` |
| PATCH | `/auth/profile` | Bearer | `{ user }` (body `{ name?, email? }`) |
| DELETE | `/auth/me` | Bearer | `{ ok }` |
| GET | `/internal/users/:userId` | `x-internal-api-key` | `{ user }` |

Errors are always `{ error, details? }`. A wrong OTP returns
`400 { error: 'invalid_otp', details, session }` — the extra `session` is
the fresh Cognito session the client must use for its next attempt (three
attempts per session, then `/auth/phone/start` again).

Phone input accepts `+91XXXXXXXXXX`, `91XXXXXXXXXX`, `0XXXXXXXXXX` or
`XXXXXXXXXX` (Indian mobile, first digit 6-9) and any valid E.164 number
for other countries; everything is normalised in `src/utils/phone.ts`.

### Account deletion

`DELETE /auth/me` calls marketplace-api
`DELETE https://<MARKETPLACE_API_DOMAIN_NAME>/<MARKETPLACE_API_BASE_PATH>/internal/users/:userId`
with `x-api-key: AUTH_CALLER_API_KEY` (best-effort, logged on failure),
signs the user out everywhere, disables the Cognito user and soft-deletes
the users row (`status: DELETED`, `deletedAt`). If the same phone signs in
again later, `/auth/phone/start` re-enables the Cognito user and the row is
reactivated with `isNew: true`.

## Data model

| Table | Key | Indexes | Notes |
|---|---|---|---|
| `…-users` | `UserId` (= Cognito `sub`) | `SubIndex` (sub), `PhoneIndex` (phone), `EmailIndex` (email) | `provider`, `cognitoUsername`, `name`, `status`, timestamps |
| `…-identities` | `sub` | – | create-only `sub → userId`; today always `userId === sub`, kept for future identity linking |
| `…-otp` | `PhoneNumber` | – | written/read only by the Cognito trigger Lambdas; TTL on `ttl` |

## Local development

```bash
npm install
cp sample.env .env          # or .env.local pointing at the deployed dev stack
npm run dev                 # http://localhost:3007
```

Point `COGNITO_*`, `USERS_TABLE`, `IDENTITIES_TABLE` at the deployed dev
stack (outputs `UserPoolId`, `UserPoolClientId`, `HostedUiDomain`) — the
app talks to real Cognito/DynamoDB with your AWS credentials. With the dev
stack deployed with `TEST_OTP_ENABLED=true`, every OTP is `TEST_OTP_CODE`
(default `123456`) and no SMS is sent. Set `RATE_LIMIT_DISABLED=true`
locally to get past the 3-per-15-minutes OTP limit.

```bash
curl -s localhost:3007/auth/phone/start -H 'content-type: application/json' -d '{"phone":"9876543210"}'
curl -s localhost:3007/auth/phone/confirm -H 'content-type: application/json' \
  -d '{"phone":"9876543210","otp":"123456","session":"<session from start>"}'
```

## Tests

```bash
npm test        # tsc, then node --test over dist/**/*.test.js
```

Tests run against in-memory fakes of the Cognito and DynamoDB clients
(`src/testing/fakes.ts`, injected via `src/utils/aws.ts`), a stub token
verifier, and a stub `fetch` for marketplace-api / the Cognito token
endpoint. They cover phone normalisation, request validation on every
route, the start → confirm flow (including `isNew`, cookies, wrong-OTP
retry and reactivation after deletion), profile patch, deletion, refresh,
logout and the internal lookup.

## Deploy

```bash
cd infra/cicd/public-app/auth
./deploy.sh dev              # full deploy, records build #NNNN
./deploy.sh config-deploy dev
./deploy.sh list | show | rollback-code | rollback-full | rollback-config
```

The wrapper delegates to `infra/deploy.sh <env>` here, which loads
`.env.<env>`, forces `ENV`/`ENVIRONMENT_NAME` from the CLI argument,
cross-checks `infra/lib/params.sh` against the template's Parameters block,
builds, zips (tests and fakes excluded), uploads to
`<env>-realestateflow-artifacts`, runs `cloudformation deploy` on
`<env>-realestateflow-marketplace-auth-stack` and publishes a fresh API
Gateway deployment.

The API is mapped onto the shared `services-api.*` custom domain with base
path `<env>realestatemarketplaceauth` (`ENABLE_CUSTOM_DOMAIN_MAPPING=true` and
`ENABLE_BASE_PATH_STRIP=true`, always together). The `ApiBaseUrl` output is
that URL; the stack never publishes a raw invoke URL.

Google Cloud Console: the authorised redirect URI is
`https://<env>-realestateflow-marketplace-auth.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`.
