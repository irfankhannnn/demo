# Implementation — GTM Engineering Work

Technical work to make RealEstateFlow itself power the GTM motion (attribution, automation, scoring, dashboards, referrals). Derived from `automation-os/`. Grounded in the real stack: Express + Lambda + DynamoDB single-table (`PK/SK/GSI`, `EntityType`, `TENANT#`), React/Vite frontend, `ai-calling-service/`, MCPs (higgsfield/meta-ads/blotato).

## Files
- `epics.md` — the 7 epics
- `user-stories.md` — stories per epic (As a… I want… so that…)
- `engineering-tasks.md` — concrete tasks (BE/FE/Integ/Infra)
- `technical-design.md` — designs + architecture diagram + data model
- `api-requirements.md` — new/changed endpoints
- `database-requirements.md` — new entities + fields + GSIs
- `ui-requirements.md` — new screens/components
- `infrastructure-requirements.md` — Lambda/queues/secrets/webhooks
- `backlog.md` — prioritized, estimated, sequenced

## Guiding constraints
Additive (no rewrite) · multi-tenant (`TENANT#`) · reuse notification/scheduled engine · consent/PII-safe · measure-before-optimize.
