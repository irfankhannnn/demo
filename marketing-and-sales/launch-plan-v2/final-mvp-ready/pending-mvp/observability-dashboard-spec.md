# Observability Dashboard Specification

## Overview

Three dashboards covering business KPIs, infrastructure health, and security.  
CloudWatch namespace: `RealEstateFlow/MVP`  
All metrics emitted via `agency-app/api/observability/cloudwatch.js` (gated: `CLOUDWATCH_METRICS_ENABLED=true`).

---

## Dashboard 1: Business Metrics

### Widgets

| Widget | Metric / Source | Alarm Threshold |
|--------|----------------|-----------------|
| Credits deducted (sum/hour) | `creditService.deductCredits.count` | — |
| Insufficient credit rejections | `creditService.deductCredits.insufficient` | > 20/hour → SNS alert |
| Credit resets triggered | `creditService.creditReset` | — |
| Leads created today | CRM DynamoDB item count (Lambda scheduled) | — |
| Daily active tenants | Subscriptions Scan count | — |
| WhatsApp messages received | `webhooks.whatsapp.received` | — |
| WhatsApp signature failures | `webhooks.whatsapp.signatureInvalid` | > 5/hour → SNS alert |
| Emails sent (SES) | `emailService.sent_via_ses` | — |
| Email fallback to Brevo | `emailService.fallback_to_brevo` | > 10/hour → SNS alert |
| Email delivery failures | `emailService.both_failed` | > 0 → SNS alert (P1) |

### KPI Cards (single-stat)
- Total active subscriptions (Paid) — from Subscriptions table
- Avg credits remaining per tenant
- Conversion rate: trial → paid (weekly)
- Leads added this week

---

## Dashboard 2: Infrastructure Health

### Lambda Functions

| Function | Metric | Alarm |
|----------|--------|-------|
| All crons | `Errors` (CloudWatch default) | > 3 in 10 min |
| `credit-reset-cron` | Duration p95 | > 25 s |
| `incomplete-data-cron` | Throttles | > 0 |
| `expiring-agreements-cron` | Errors | > 0 |
| `team-summary-cron` | Errors | > 0 |
| `lead-qualifier` (agent) | `agentAction.invoked` | — |
| `lead-qualifier` (agent) | `agentAction.failed` | > 0 → SNS |

### DynamoDB

| Table | Metric | Alarm |
|-------|--------|-------|
| CRM table | `SystemErrors` | > 0 |
| CRM table | `ConsumedWriteCapacityUnits` | > 80% provisioned |
| Subscriptions | `ThrottledRequests` | > 5/min |
| AgentLogs (CRM table) | Query latency p99 | > 500 ms |

### API Gateway

| Metric | Alarm |
|--------|-------|
| `5XXError` | > 1% of requests |
| `4XXError` (all) | > 5% (may indicate auth issues) |
| `Latency` p99 | > 3 s |
| `Count` (requests/min) | Baseline ± 3σ anomaly detection |

### SES

| Metric | Alarm |
|--------|-------|
| Bounce rate | > 5% |
| Complaint rate | > 0.1% |
| `Reputation.BounceRate` | > 2% → suspend SES, fall back to Brevo |

---

## Dashboard 3: Security & Audit

### Widgets

| Widget | Source | Alert |
|--------|--------|-------|
| WAF blocked requests | AWS WAF CloudWatch | > 50/min |
| Rate limit violations (429) | `webhookRateLimit.exceeded` custom metric | > 100/hour |
| Auth failures (401/403) | API GW 4XX + CloudTrail | > 10/min from single IP |
| Internal API key mismatches | Auth service log filter | > 0 |
| Agent credit charge anomaly | Sudden spike > 2× avg | SNS P1 |
| Cross-tenant access attempts | Custom log metric filter | Any → P0 SNS |

### Structured Log Metric Filters (CloudWatch Logs Insights)

```
# Credit insufficient events
fields @timestamp, tenantId, required, balance
| filter message = "creditService.insufficient"
| stats count() by bin(1h)

# Cron per-tenant failures
fields @timestamp, tenantId, error, stack
| filter message like /cron.*error/
| sort @timestamp desc
| limit 50

# Agent actions
fields @timestamp, tenantId, agentId, action, creditsCharged
| filter message = "agentRuntime.toolResult"
| stats sum(creditsCharged) as totalCredits by tenantId
```

---

## Alert Runbook

### P0 — Immediate page (< 5 min)
- Email both failed (no delivery path)
- Cross-tenant data access attempt
- Credit deduction anomaly (> 5× avg in 5 min)
- DynamoDB SystemErrors on CRM table

### P1 — Respond within 30 min
- SES bounce rate > 5%
- WhatsApp signature invalid > 5/hour (possible replay attack)
- Agent action failed count > 0
- API Gateway 5XX > 1%

### P2 — Business hours
- Email fallback to Brevo > 10/hour
- Credit insufficient > 20/hour (upsell opportunity)
- Lambda throttles on any cron

---

## Setup Instructions

### 1. Enable CloudWatch metrics
```
CLOUDWATCH_METRICS_ENABLED=true
```
Set on all Lambda functions and ECS tasks.

### 2. Create SNS topic
```bash
aws sns create-topic --name RealEstateFlow-MVP-Alerts --region ap-south-1
aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint ops@realestateflow.in
```

### 3. Deploy CloudWatch dashboards (CDK/CFN)
Add `AWS::CloudWatch::Dashboard` resource in `agency-app/api/infra/cfn-backend.yaml` referencing the widgets above.

### 4. Log metric filters
```bash
aws logs put-metric-filter \
  --log-group-name /aws/lambda/credit-reset-cron \
  --filter-name CreditResetError \
  --filter-pattern "{ $.level = \"error\" }" \
  --metric-transformations metricName=CreditResetErrors,metricNamespace=RealEstateFlow/MVP,metricValue=1
```

### 5. Existing metrics auto-emitted
Once `CLOUDWATCH_METRICS_ENABLED=true`:
- `creditService.deductCredits.insufficient` — from `agency-app/api/middleware/meterCredits.js`
- `emailService.fallback_to_brevo` — from `agency-app/api/emailService.js`
- `emailService.both_failed` — from `agency-app/api/emailService.js`
- `emailService.sent_via_ses` — from `agency-app/api/emailService.js`
- `webhooks.whatsapp.*` — from `agency-app/api/observability/cloudwatch.js`
- `agentAction.*` — from `agency-app/api/agents/agentRuntime.js`
- `cron.tenantFailed` — from all cron scripts (to be wired)

---

## Post-MVP Observability

- Integrate with Grafana (CloudWatch data source)
- Add X-Ray tracing on all Lambda functions (`AWS_XRAY_TRACING_NAME=RealEstateFlow`)
- Ship structured logs to OpenSearch for full-text search
- Add RUM (Real User Monitoring) via CloudWatch RUM on the React frontend
