# Demo Tenant — Deploy & Operate Guide

Source task: ZEE-001 (PR-A) · spec: `marketing-and-sales/launch-plan-v2/pre-launch-prep/P5-demo-environment.md`

This guide covers seeding, deploying, and operating the RealEstateFlow demo tenant
that powers `demo.realestateflow.in`.

> **NOTE:** This document references `cron/reset-demo.yaml` which is now obsolete. The demo reset cron has been merged into `server/infra/cfn-backend.yaml` (2026-06-21). For current deployment, run `./deploy.sh` from `server/infra/` to deploy all cron jobs including demo reset.

## Files

| File | Purpose |
|---|---|
| `server/scripts/seed-demo-tenant.js` | Idempotent seeder (20 buyers, 15 owners, 10 properties, 8 pipeline leads, 2 team members, 5 khata entries, 5 AI transcripts) |
| `server/scripts/reset-demo-tenant.js` | Thin `--reset` wrapper + Lambda `handler()` for the cron |
| `cron/reset-demo.yaml` | EventBridge rule + Lambda spec (daily 02:00 IST) |
| `real-estate-crm-app/src/components/DemoBanner.tsx` | Yellow "DEMO TENANT" banner (gated on `VITE_IS_DEMO=true`) |

## 1. Environment variables

Backend (Lambda / shell):

```
AWS_REGION=ap-south-1
DEMO_TENANT_ID=DEMO_REALESTATEFLOW
CRM_DYNAMODB_TABLE_NAME=<your CRM table>
KHATA_TABLE_NAME=cloudberry-real-estate-khata
NOTIFICATIONS_TABLE_NAME=cloudberry-real-estate-notifications
# DYNAMODB_ENDPOINT=http://localhost:8000   # local testing only
```

Frontend demo build (`real-estate-crm-app/.env`):

```
VITE_IS_DEMO=true
```

## 2. Test the seed locally

Against real AWS (uses your default AWS credentials):

```bash
node server/scripts/seed-demo-tenant.js --tenant=DEMO_TEST          # seed
node server/scripts/seed-demo-tenant.js --reset --tenant=DEMO_TEST  # purge + re-seed
```

Against DynamoDB Local (no AWS account needed):

```bash
# start DynamoDB Local on :8000, create the 3 tables, then:
DYNAMODB_ENDPOINT=http://localhost:8000 \
CRM_DYNAMODB_TABLE_NAME=crm \
KHATA_TABLE_NAME=khata \
NOTIFICATIONS_TABLE_NAME=notifications \
AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy \
node server/scripts/seed-demo-tenant.js --reset --tenant=DEMO_TEST
```

Verify: the script logs row counts (should be 20/15/10/8/2/5/5 = 65 total) and
writes `server/scripts/node-trace.json` with elapsed time + counts. It exits
non-zero on any error.

## 3. Deploy the reset Lambda

1. Package the `server/` tree into the Lambda (or reuse the existing API Lambda
   bundle, which already contains `server/scripts/*`).
2. Create a Lambda `realestateflow-demo-reset` with handler
   `server/scripts/reset-demo-tenant.handler`, runtime `nodejs22.x`,
   timeout `60s`, memory `256MB`, and the env vars from §1.
3. Grant the execution role `dynamodb:Scan`, `dynamodb:BatchWriteItem`, and
   `dynamodb:PutItem` on the CRM / khata / notifications tables.
4. **Test manually** before scheduling:
   `aws lambda invoke --function-name realestateflow-demo-reset /dev/stdout`.

## 4. Schedule the daily reset

Apply `cron/reset-demo.yaml`:
- EventBridge rule `realestateflow-demo-daily-reset`,
  `cron(30 20 * * ? *)` (= 20:30 UTC = **02:00 IST**).
- Target = the reset Lambda; add the `lambda:InvokeFunction` permission for
  `events.amazonaws.com`.

### Timezone math
IST = UTC+5:30, so 02:00 IST = 20:30 UTC the previous day → `cron(30 20 * * ? *)`.

## 5. CloudWatch alarm (reset failure)

Create an alarm on the Lambda `Errors` metric: `>= 1` in a 5-minute window →
notify via SNS (email/Slack) so a failed reset never goes unnoticed.

## 6. Frontend demo deploy

Build the CRM SPA with `VITE_IS_DEMO=true` and deploy to `demo.realestateflow.in`.
The `DemoBanner` then renders the yellow reset notice on every page.

## Fallback

If EventBridge is troublesome, use a GitHub Actions cron
(`schedule: '30 20 * * *'`) that calls an authenticated webhook which runs
`reset-demo-tenant.js`.
