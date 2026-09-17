# RealEstateFlow Launch Tables — CI/CD entry point

Deploys `agency-app/api/infra/launch-tables-cfn.yaml` — six standalone DynamoDB
tables shared across services that are **not** owned by any other stack:

| Table | Purpose |
|---|---|
| `Grievances` | DPDP Act 2023 grievance records |
| `WebhookLog` | inbound webhook idempotency (TTL-expired) |
| `TenantApiKeys` | per-tenant API keys |
| `Subscriptions` | tenant plan, seats, trial/billing status — read/written by `agency-app/api/subscriptionService.js` + `agency-app/api/routes/subscriptions.js`, and read-only by `reality-flow-authentication`'s invite flow (seat-limit check) |
| `NPSResponses` | Net Promoter Score survey responses |
| `BetaInvites` | beta program invite list |

`AIEmployeeProvisioning` is deliberately **not** here — `agency-app/api/infra/cfn-backend.yaml`
owns that table; declaring it in both places causes "Table already exists"
on whichever stack deploys second (this collided in the past — see
`infra/cicd/README.md` Discrepancy 1 for the historical incident on
an older, un-env-prefixed version of this template).

## Why this pipeline didn't exist until now

Until this was added, `launch-tables-cfn.yaml` had no `cfn-templates-cicd`
wrapper and no `deploy.sh` anywhere called it — it was deploy-by-hand-only.
In `cloudberry-main` (nonprod), the tables that back this template
(`realestate-flow-dev-subscriptions`, from an old un-env-prefixed manual
deploy) existed with **no CloudFormation stack managing them at all** —
confirmed via `aws dynamodb list-tables` + `aws cloudformation list-stacks`
showing no owning stack. That legacy table was left alone (flagged, not
deleted) during the 2026-09-10 `cloudberry-main` nonprod rollout specifically
because no pipeline could recreate it. This folder is that pipeline.

## Running it

```
cd infra/cicd/agency-app/launch-tables
./deploy.sh dev                    # deploy — records a new numbered build
./deploy.sh prod
./deploy.sh list                   # list every recorded build (any env)
./deploy.sh list prod              # list only prod builds
./deploy.sh show 0001              # print one build's manifest.json
./deploy.sh rollback prod 0001     # redeploy that build's saved CFN template
```

`dev`/`prod` is required for a deploy — the script refuses to run without
it. `agency-app/api/.env.launch-tables.dev` / `.env.launch-tables.prod` must exist
first (copy from the `.sample` file in `agency-app/api/`) — these are separate from
`agency-app/api/.env.dev` / `.env.prod` (which are for `cfn-backend.yaml`) because
the two templates own completely different resources and deploy
independently.

## No code artifact, no `rollback-code`

Every other wrapper in this folder (`server`, `reality-flow-authentication`,
etc.) tracks a Lambda/container code artifact alongside the CFN template and
offers a fast `rollback-code` path. This stack is pure
`AWS::DynamoDB::Table` — there's no code to package or roll back
independently, so there's only one `rollback` command, which always means
"redeploy an older template." All six tables carry `DeletionPolicy: Retain`
and `UpdateReplacePolicy: Retain`, so a template rollback changes schema
(indexes, TTL, billing mode) only — it never touches existing table data or
deletes a table CloudFormation stops managing.

## Build numbers are global, not per-environment

Same convention as every other wrapper here — one counter across dev
**and** prod, env recorded inside each build's `manifest.json`.
`rollback` double-checks the target build was actually for the env you're
rolling back, and refuses otherwise.

## S3 layout

One artifact bucket per environment (`dev-realestateflow-artifacts` /
`prod-realestateflow-artifacts` — see
`infra/cicd/common-infra/vpc-networking.yaml`):

```
realestateflow-launch-tables/launch-tables-cfn-<hash>.yaml         content-hashed,
                                                                     new key per
                                                                     template change
realestateflow-launch-tables/builds/0001/dev/launch-tables-cfn.yaml permanent,
realestateflow-launch-tables/builds/0002/prod/launch-tables-cfn.yaml build+env-scoped
                                                                     archive copy
```

Every object gets S3 tags: `Branch`, `DeployDate`, `Status`
(`deployed`/`failed`), `CommitId`.

## Naming convention

Every table is named `<EnvironmentName>-realestateflow-<table>` (e.g.
`dev-realestateflow-subscriptions`), matching the env-first convention used
across this repo — `launch-tables-cfn.yaml`'s `EnvironmentName` parameter
(`AllowedValues: [dev, prod]`) drives it directly via `!Sub`. This is a
correction from an earlier, un-env-prefixed version of the template
(`TableName: Subscriptions`, no environment separation) that predates this
pipeline — see `project_subscriptions_launch_tables_orphan.md` in
project memory for the full history.

## Stack name

`<env>-realestateflow-tables-stack` (e.g. `dev-realestateflow-tables-stack`)
— no IAM resources in this template, so the deploy needs no `CAPABILITY_*`
flag. This wrapper was written to match the exact stack name already live
in `cloudberry-main` (created 2026-09-09, out-of-band, before this pipeline
existed) rather than the more conventional `<env>-realestateflow-launch-tables`
— adopting the existing name lets `deploy.sh` manage that stack going
forward as an update, instead of colliding with it on a fresh create.
