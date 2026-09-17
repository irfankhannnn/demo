# platform/gateway — API Gateway by audience

Design note; no stack lives here yet. It records what exists and the target so
the gateway work (step 4 of the regroup plan) starts from facts.

## Today

- Every unit has its own REST (v1) API Gateway, all mapped onto **one custom
  domain** by base path: `services-api.realestateflow.in` (prod) /
  `services-api.cloudberrysolutions.in` (dev).

| Base path | Unit | Route style |
|---|---|---|
| `api` (public CRM API) and `<env>realestatecrm` | `agency-app/api` | explicit routes in nested stacks (`apigw-explicit-routes-part1/2.yaml`) + `/api/{proxy+}` |
| `<env>realestateauth` | `platform/auth` | explicit routes (`auth-explicit-routes.yaml`) |
| `<env>realestatemcp` | `platform/mcp` | `/mcp`, `/oauth/*`, `/.well-known/*`, `/health` |
| `InstaApiBasePath` | `agency-app/instagram-api` | `{proxy+}` |
| `PagesApiBasePath` | `public-app/property-pages` | `{proxy+}` behind its own CloudFront |
| `AiCallingApiBasePath` | `agency-app/ai-calling` | `{proxy+}` |
| `FollowupApiBasePath` | `agency-app/followup-agent` | `{proxy+}` |

- Auth: `agency-app/api`, `agency-app/instagram-api` and `platform/mcp` each
  validate the bearer token by calling `platform/auth`'s `GET /auth/me` on
  every request (60 s cache). Service-to-service calls use four different
  shared `x-api-key` secrets.

## Target

One gateway stack, three audience prefixes, auth enforced once at the edge.

| Prefix | Audience | Auth at gateway | Routes to |
|---|---|---|---|
| `/public/*` | public-app | none, or optional consumer JWT | `listings-api`, `property-pages` |
| `/agency/*` | agency-app | Cognito JWT authorizer + tenant claim check | `api`, `instagram-api`, `ai-calling`, `followup-agent` |
| `/auth/*` | both | none | `platform/auth` |
| service → service | internal | IAM SigV4, or an event instead of a call | replaces the four shared secrets |

Existing routes stay on REST v1; `/public` is built on HTTP API v2 (cheaper,
native JWT authorizer). Per-unit `/auth/me` calls go away once the authorizer
passes verified claims in the request context.
