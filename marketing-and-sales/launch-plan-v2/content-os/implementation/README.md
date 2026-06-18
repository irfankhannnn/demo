# Implementation — GTM Engineering Work

Technical work to make **RealEstateFlow itself power the GTM motion** — attribution, automation, scoring, dashboards, referrals — so marketing/sales aren't bolt-ons but product features. Derived from `../automation-os/`.

## Grounded in the real stack
Express + AWS Lambda (`server/lambda-handler.js`) · DynamoDB single-table (`PK/SK/GSI`, `EntityType`, `TENANT#`) · multi-tenant (`tenantMiddleware.js`) · notification + scheduled-notification engine (`notificationDynamodbService.js`) · `ai-calling-service/` (Exotel+ElevenLabs) · React/Vite frontend · RBAC (`rbac.ts`) · MCPs (higgsfield/meta-ads/blotato). **Confirmed gap:** leads have no source/UTM/attribution/score today.

## Files
| File | Purpose |
|---|---|
| `epics.md` | the 7 epics + goals/metrics |
| `user-stories.md` | stories per epic (As a…/I want…/so that…/acceptance) |
| `engineering-tasks.md` | granular BE/FE/INT/INF/QA tasks w/ acceptance criteria |
| `technical-design.md` | architecture, full data model, scoring algorithms, flows |
| `api-requirements.md` | new/changed endpoints w/ schemas + examples |
| `database-requirements.md` | entities, attributes, GSIs, access patterns, migration |
| `ui-requirements.md` | new screens/components, RBAC, states |
| `infrastructure-requirements.md` | Lambda/SQS/EventBridge/secrets/GSIs/observability/CI |
| `backlog.md` | prioritized, estimated, sprint-sequenced |

## Guiding constraints
Additive (no rewrite) · multi-tenant (`TENANT#`) · reuse notification/scheduled engine · consent/PII-safe · idempotent · measure-before-optimize. Every item references its epic (`EP-*`) and the automation workflow it serves.

## Read order
`epics.md` → `technical-design.md` → `database-requirements.md` + `api-requirements.md` → `ui-requirements.md` → `engineering-tasks.md` → `backlog.md`.
