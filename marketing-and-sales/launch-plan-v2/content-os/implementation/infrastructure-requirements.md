# Implementation — Infrastructure Requirements

AWS (existing: Lambda + API Gateway + DynamoDB + S3 + CloudFormation). Additive.

## Compute
- Extend `server/lambda-handler.js` with marketing routes, OR a dedicated `marketing-service` Lambda.
- **Scheduled worker** Lambda (EventBridge cron) for sequences + nightly scoring (reuse scheduled-notification pattern).
- Reuse `ai-calling-service` Lambda for auto-qualify.

## Messaging
- **SQS** queue for event routing (reliable async) + **DLQ**.
- EventBridge schedule for due-sequence + scoring jobs.

## Data
- DynamoDB new GSIs (database-requirements.md). Consider TTL on raw events for cost.

## Secrets/config
- SSM Parameter Store / Secrets Manager: per-tenant Meta/WhatsApp/SES tokens, webhook signing secrets.

## Networking/security
- API Gateway webhook routes with signature verification + throttling.
- WAF/rate-limit on public webhooks.

## Observability
- CloudWatch metrics: events ingested, routing latency, sequence sends, automation failures, funnel counts.
- Alarms: ingest errors, DLQ depth, scoring job failure, webhook signature failures.

## CI/CD
- Extend existing CloudFormation/`deploy-lambda` scripts; infra-as-code for new queues/GSIs/secrets; staged rollout per tenant (feature flag).

## Cost guardrails
On-demand DynamoDB or capacity planning for new GSIs; SQS batching; event TTL.
