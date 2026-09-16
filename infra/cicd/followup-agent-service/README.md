# infra/cicd/followup-agent-service

CI/CD wrapper for the follow-up agent microservice (`services/followup-agent-service/`).
Same design as the `ai-calling-service`, `property-pages-ms` and
`backend_insta_sol_ms` wrappers in this folder.

## What this service is

Schedules, retries and escalates AI follow-up calls (site-visit confirmation and
post-visit feedback). Two Lambdas from one zip: an API Lambda the CRM backend
calls, and a worker Lambda driven by EventBridge (a 5-minute dispatch schedule
plus `crm.leads`, `crm.meetings` and `aicalling.calls` event rules).

## What this adds over the raw deploy script

`services/followup-agent-service/infra/deploy.sh` does the real work: test, install,
package, upload, generate `cfn-params.json`, `cloudformation deploy`. This
wrapper adds release bookkeeping:

- a **global 4-digit build number** (one counter across dev and prod)
- a `manifest.json` per build (env, stack, status, git commit/branch/dirty, deployer, exact S3 keys)
- a **permanent S3 archive** at `<prefix>/builds/<build>/<env>/`
- S3 object tags `Branch`, `DeployDate`, `Status`, `CommitId` on the primary keys and the archive copies
- `rollback-code` (updates **both** Lambdas) / `rollback-full` / `config-deploy` / `rollback-config`, all refusing to cross dev and prod

A failed deploy is still recorded with `status: failed`.

## Prerequisites

- AWS CLI v2 with the `cloudberry-main` (dev) / `cloudberry-prod-new` (prod) profiles
- Node 20+, `zip`
- `services/followup-agent-service/.env.<env>` filled in (see its `.env.example`)
- The CRM and ai-calling-service stacks deployed in the same environment (this service calls both)

## Usage

```bash
./deploy.sh dev                      # deploy, record a new build
./deploy.sh list                     # all builds
./deploy.sh show 0003                # one build's manifest
./deploy.sh rollback-code prod 0002  # fast: point both Lambdas at build 0002's code
./deploy.sh rollback-full prod 0002  # full: redeploy build 0002's template + params
./deploy.sh config-deploy dev        # parameter-only change (allowlisted)
```

## Environment

Reads `services/followup-agent-service/.env.<env>` (gitignored). Stack name is
`<env>-realestateflow-followup-stack`; every physical resource is
`<env>-realestateflow-followup-<resource>`. Artifact bucket
`<env>-realestateflow-artifacts`, prefix `followup`.

## Custom domain only

`https://services-api.cloudberrysolutions.in/devrealestatefollowup` (dev) and
`https://services-api.realestateflow.in/prodrealestatefollowup` (prod).
`ENABLE_CUSTOM_DOMAIN_MAPPING=true` and `ENABLE_BASE_PATH_STRIP=true` are both
required and enforced.

## Secrets

`cfn-params.json` carries the three shared api keys as NoEcho parameters that
populate one Secrets Manager secret. Archived to S3 for rollback fidelity; the
local copies under `deploy-versions/` and `config-versions/` are gitignored.

## Troubleshooting

- Worker errors / DLQ depth: alarms fire on `ALERTS_TOPIC_ARN` when set. Replay a DLQ message by invoking the worker with the original event JSON.
- Calls never placed: check the tenant's `followupCallsEnabled` and `aiEmployeeEnabled`, then the worker log's `dispatch result` lines (`result: outside_business_hours`, `followup_calls_disabled`, `crm_unavailable`, `lead_has_no_phone`).
- 401 from the CRM: `CRM_INTERNAL_API_KEY` must equal the CRM's `FOLLOWUP_INTERNAL_API_KEY`.
