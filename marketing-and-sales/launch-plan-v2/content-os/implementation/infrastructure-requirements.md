# Implementation — Infrastructure Requirements

AWS (existing: Lambda + API Gateway + DynamoDB + S3 + CloudFormation). Additive, multi-tenant.

## Compute
- Extend `server/lambda-handler.js` with marketing routes, OR a dedicated `marketing-service` Lambda (recommended for blast-radius isolation).
- **Scheduled worker** Lambda (EventBridge cron) for sequence sends + nightly scoring (reuse SCHEDULED_NOTIFICATION pattern).
- Reuse `ai-calling-service` Lambda for auto-qualify.

## Messaging / async
- **SQS** queue for event routing (reliable async) + **DLQ** (poison events).
- **EventBridge** schedules: due-sequence (every 5–15 min), nightly scoring, daily attribution rollup.

## Data
- DynamoDB new GSIs (see `database-requirements.md`): `GSI-EventType`, `GSI-LeadSource`, `GSI-LeadScore`, `GSI-ReferralStatus`, `GSI-SeqDue`.
- TTL on raw `MKT_EVENT` payloads (cost) once rolled up.
- On-demand capacity or capacity planning for new GSIs.

## Secrets / config
- SSM Parameter Store / Secrets Manager: per-tenant Meta/WhatsApp/SES tokens, webhook signing secrets. No secrets in code/env committed.

## Networking / security
- API Gateway webhook routes with **HMAC signature verification** + throttling.
- WAF / rate-limit on public webhook endpoints.
- Reuse JWT + `tenantMiddleware` for authenticated routes.

## Observability
- CloudWatch metrics: events ingested, routing latency, sequence sends, automation failures, funnel counts per stage.
- Alarms: ingest errors, **DLQ depth > 0**, scoring-job failure, webhook signature failures, WhatsApp send failures.
- Structured logs (reuse `logger.js` + `requestId.js`).

## CI/CD
- Extend existing CloudFormation / `deploy-lambda` scripts; IaC for new queues/GSIs/secrets; **feature-flag + staged per-tenant rollout**.

## Cost guardrails
SQS batching; event TTL; GSI projection minimization; scoring as batch nightly (not per-request).
