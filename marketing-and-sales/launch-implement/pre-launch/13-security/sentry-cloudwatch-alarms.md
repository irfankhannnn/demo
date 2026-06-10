# Sentry + CloudWatch + WAF Alarm Specifications

> **For Founder to configure** — these are spec documents, not infrastructure-as-code.

---

## Sentry Alerts

| Alert Name | Condition | Action |
|------------|-----------|--------|
| P0 Fatal Error | Any `level=fatal` event | Immediate email + WhatsApp to founder |
| Error Rate Spike | Error rate >1% over 5 min window | Email founder |
| New Issue in Billing | New issue in `server/routes/billing.js` | Email founder + Slack |
| Unhandled Rejection | Any unhandled promise rejection | Email founder |

### Sentry Configuration Steps
1. Go to Sentry → Alerts → Create Alert Rule
2. Set condition: `event.level` is `fatal` → send notification to founder email
3. Set condition: `When the number of events in an issue is more than 50 in 5 minutes` → email
4. Environment filter: `production` only (ignore `development`)

---

## CloudWatch Alarms

### Lambda Alarms

| Alarm Name | Metric | Threshold | Period | Action |
|------------|--------|-----------|--------|--------|
| `rf-lambda-5xx-rate` | Lambda `5xxError` | >1% per minute | 5 min | SNS → founder email |
| `rf-lambda-error-count` | Lambda `Errors` | >5 errors | 5 min | SNS → founder email |
| `rf-lambda-duration-p99` | Lambda `Duration` p99 | >10s | 5 min | SNS (performance alert) |
| `rf-lambda-throttle` | Lambda `Throttles` | >0 | 5 min | SNS |

### DynamoDB Alarms

| Alarm Name | Metric | Threshold | Period | Action |
|------------|--------|-----------|--------|--------|
| `rf-ddb-system-errors` | `SystemErrors` | >0 | 1 min | SNS → founder email (immediate) |
| `rf-ddb-throttled` | `ThrottledRequests` | >0 for 3 consecutive periods | 5 min | SNS |
| `rf-ddb-consumed-rcu` | `ConsumedReadCapacityUnits` | >80% of provisioned | 5 min | SNS (cost alert) |

### API Gateway Alarms

| Alarm Name | Metric | Threshold | Period | Action |
|------------|--------|-----------|--------|--------|
| `rf-apigw-4xx-rate` | `4XXError` | >5% per minute | 5 min | SNS (cross-tenant 403 spike) |
| `rf-apigw-5xx-rate` | `5XXError` | >1% per minute | 5 min | SNS → founder email |
| `rf-apigw-latency-p99` | `Latency` p99 | >5000ms | 5 min | SNS |

### Cognito Alarms

| Alarm Name | Metric | Threshold | Period | Action |
|------------|--------|-----------|--------|--------|
| `rf-cognito-signin-failures` | `SignInFailures` | >10 per 5 min (same IP) | 5 min | SNS (brute force indicator) |
| `rf-cognito-signup-failures` | `SignUpFailures` | >20 per 5 min | 5 min | SNS |

---

## WAF Rule Specifications

### Rate Limit Rules

| Rule Name | Scope | Limit | Window | Action |
|-----------|-------|-------|--------|--------|
| `rf-grievance-rate-limit` | URI: `/api/grievance` | 100 requests/IP | 5 min | BLOCK |
| `rf-phone-login-rate-limit` | URI: `/api/auth/phone-login` | 50 requests/IP | 5 min | BLOCK |
| `rf-b2b-leads-rate-limit` | URI: `/api/b2b-leads` (POST) | 20 requests/IP | 5 min | BLOCK |
| `rf-billing-webhook-rate` | URI: `/api/billing/webhook` | 200 requests/IP | 5 min | COUNT (monitoring, not blocking) |

### AWS Managed Rules

| Rule Group | Priority | Action |
|------------|----------|--------|
| `AWSManagedRulesCommonRuleSet` | 1 | BLOCK |
| `AWSManagedRulesKnownBadInputsRuleSet` | 2 | BLOCK |
| `AWSManagedRulesAmazonIpReputationList` | 3 | BLOCK |
| `AWSManagedRulesSQLiRuleSet` | 4 | COUNT (monitor first, then BLOCK) |

### Custom Rules

| Rule Name | Condition | Action |
|-----------|-----------|--------|
| `rf-block-missing-useragent` | Request has no User-Agent header | BLOCK |
| `rf-block-oversized-body` | Request body >1MB on non-upload routes | BLOCK |

---

## SNS Topic Configuration

Create one SNS topic: `rf-production-alerts`

**Subscribers:**
- Founder email: `{FOUNDER_EMAIL}`
- Founder phone (SMS): `{FOUNDER_PHONE}` (for P0/fatal only)
- Ops Slack webhook: `{SLACK_WEBHOOK_URL}` (optional)

## Implementation Priority

1. **Day T-2 (before launch):** Lambda 5xx + DDB SystemErrors + WAF managed rules
2. **Day 1:** Sentry alerts + Cognito brute-force + API Gateway 4xx
3. **Day 3:** Rate limit WAF rules + performance alarms
4. **Day 7:** Review alarm thresholds based on actual traffic patterns
