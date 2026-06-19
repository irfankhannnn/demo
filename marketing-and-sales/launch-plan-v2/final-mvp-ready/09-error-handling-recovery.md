# 09 — Error Handling & Recovery Strategy

**Scope:** Retry logic, fallbacks, DLQ strategy, soft vs hard credit limits, error recovery for critical paths.

---

## (1) MCP Bedrock Agent Error Handling

### **Bedrock Invoke Failure**
```
Scenario: Bedrock returns error (model unavailable, timeout, quota exceeded)
Recovery:
  1. Catch BedrockRuntimeException in agentRuntime.js
  2. Log error + tenantId + attempt count
  3. If first attempt: retry after 2s exponential backoff (max 3 tries)
  4. If all retries fail: 
     - Do NOT charge credits (pre-deduct was tentative)
     - Write audit: status='FAILED', reason='bedrock_timeout'
     - Publish EventBridge event 'agent.failed' for manual review
     - Return error to caller (caller handles gracefully)
  5. If manual review needed: admin sees in agent-activity log

Implementation:
  - agentRuntime.js: try/catch with exponential backoff
  - Max retry budget: 6s total (2s + 4s + 8s... cut at 6s)
  - No automatic escalation (agent just fails; user sees no change)
```

### **Tool Invocation Failure (skillInvoker)**
```
Scenario: skillInvoker.invokeSkill() fails (CRM API down, invalid input, schema mismatch)
Recovery:
  1. Catch error in agent loop
  2. Log: error type, tenantId, toolName, attempt
  3. Retry logic:
     - Network error (CRM API timeout): retry 2x with 1s + 2s backoff
     - Schema validation error: fail immediately (user error, not retriable)
     - Authorization error: fail immediately (tenant/scope issue)
  4. On failure: agent stops; returns error response to Bedrock
  5. Bedrock may retry or fail gracefully (depends on agent design)

Implementation:
  - skillInvoker.js: wrap HTTP calls with retry logic
  - Use exponential backoff for transient errors only
```

### **Low Confidence Recovery**
```
Scenario: Bedrock agent returns score='HOT' with confidence=0.3 (unreliable)
Recovery:
  1. If confidence < threshold (default 0.5):
     - Route to Sonnet for second opinion (longer model, higher cost)
     - Deduct additional credits for escalated run (15→25)
     - Update lead.scoreMethod = 'haiku_escalated_to_sonnet'
  2. If Sonnet also low confidence (< 0.5):
     - Flag lead for manual review
     - Mark as lead.qualityStatus = 'needs_review'
     - Do NOT auto-assign (stay unassigned for admin triage)
  3. Log all escalations in agentAuditService

Implementation:
  - agentRuntime.js: post-invoke check on confidence field
  - If escalating: deduct credits BEFORE sonnet call (like agent_action cost)
```

---

## (2) Error Recovery Paths

### **Email Delivery (SES Primary, Brevo Fallback)**
```
Path 1: sendEmail() called
  ├─ Try SES (SendEmailCommand)
  │  ├─ Success: log 'provider=ses', return messageId
  │  └─ Failure (timeout, quota, auth):
  │     ├─ Log error at warn level
  │     └─ Fall through to Brevo
  ├─ Try Brevo (fetch to api.brevo.com)
  │  ├─ Success: log 'provider=brevo', return messageId
  │  └─ Failure:
  │     ├─ Log error at error level
  │     ├─ Publish EventBridge event 'email.failed'
  │     ├─ Do NOT retry here (caller may retry)
  │     └─ Throw Error('Both SES and Brevo failed')
  └─ Caller (route/cron) wraps in try/catch:
     └─ If error: log, send alert to admin Slack, continue (non-fatal)

SLA:
  - SES timeout: 5s before fallback to Brevo
  - Brevo timeout: 5s before fail
  - Total E2E: max 10s per email
```

### **Webhook Processing (Razorpay, Bailey, EventBridge)**
```
Path: Webhook received (POST /api/webhooks/X)
  ├─ 1. Verify signature (HMAC-SHA256, timing-safe)
  │     └─ Invalid: return 401 immediately (do not process)
  ├─ 2. Check idempotency via webhookLogService.logEventIfNotProcessed(id)
  │     └─ Duplicate: return 200 (already processed)
  ├─ 3. Parse & validate payload (schema)
  │     └─ Invalid: log error, return 400 (bad request)
  ├─ 4. Core logic (grant credits, publish event, update subscription)
  │     ├─ Success: log success, return 200
  │     └─ Failure:
  │        ├─ Catch specific errors:
  │        │  ├─ DynamoDB error: send to SQS DLQ (manual retry)
  │        │  ├─ EventBridge error: log + alert, retry in 30s via Lambda
  │        │  └─ Other: log error + alert
  │        └─ Return 202 (accepted, processing async)
  └─ Caller never retries (we return 200/202 fast)

Webhook DLQ Strategy:
  - SQS queue: nabi-webhook-dlq (reserved for failed webhooks)
  - Lambda scheduled rule: daily scan DLQ, alert admin, optionally replay
  - Manual replay: admin endpoint (PUT /api/admin/webhooks/replay?id=...)
```

### **Cron Failures (Credit Reset, Data Quality, Agents)**
```
Path: Cron Lambda invoked (EventBridge trigger)
  ├─ Try: main cron logic (query tenants, process each)
  │     ├─ Per-tenant failure:
  │     │  ├─ Catch error
  │     │  ├─ Log: tenantId, error, attempt
  │     │  ├─ Continue (process next tenant; don't cascade fail)
  │     │  └─ Publish CloudWatch metric: CronTenantFailure (for alerting)
  │     └─ All tenants processed: return success (even if some failed)
  └─ Lambda timeout or crash:
     ├─ EventBridge retries max 2x (default)
     ├─ On persistent failure:
     │  ├─ Send to DLQ
     │  ├─ Alert ops via SNS
     │  └─ Manual re-run: aws lambda invoke
     └─ Impact: one day's run skipped (recoverable on next cycle)

Example: credit-reset-cron
  - Process 10,000 tenants
  - 99 fail (network hiccup)
  - Cron succeeds (9,901 reset); alerts ops: "99 failed"
  - Next day: retries those 99 (DLQ handler)
```

### **Agent Invocation Chain Failure**
```
Path: Lead created → EventBridge lead.created event → lead-qualifier-handler
  ├─ 1. Handler invoked
  │  ├─ Resolve tenantId + leadId
  │  ├─ Load lead via skillInvoker (CRM query)
  │  │   └─ CRM down: log + DLQ + alert (no charge yet)
  │  ├─ Deduct credits (15 for agent_action)
  │  │   └─ Insufficient: skip agent; log warning
  │  ├─ Invoke Bedrock
  │  │   └─ Timeout/error: retry 3x (2s+4s+8s backoff)
  │  │      └─ Exhausted: refund credits, log, alert
  │  ├─ Update lead with score (skillInvoker update)
  │  │   └─ CRM error: score lost but credits charged (unlikely, acceptable)
  │  ├─ Publish lead.qualified event (trigger router)
  │  │   └─ EventBridge error: log, alert; will retry
  │  └─ Write audit log (agentAuditService)
  │      └─ Audit failure: non-fatal (log only)
  └─ Handler returns success (even if some steps failed)

Total timeout: 30s (Bedrock max 10s × 3 retries = 30s)
If handler timeout: EventBridge retries 2x total; then DLQ
```

---

## (3) Soft vs Hard Credit Limits

### **Soft Limit (Warning)**
```
Trigger: credits remaining < 10% of monthly allotment
Response:
  - Show banner: "⚠️ Low credits: only {remaining} left"
  - Color: orange/yellow (not red)
  - Allow user to continue creating (no block)
  - CTA: "Buy Credits" button prominently placed
  - Frequency: shown once per session (not on every action)

Implementation:
  - Frontend: SubscriptionContext calculates percentRemaining
  - CreditBalanceCard: if (balance < allotment * 0.1) show warning
  - No API call needed (client-side only)
```

### **Hard Limit (Block)**
```
Trigger: credits remaining == 0
Response:
  - Action rejected: 402 Insufficient Credits
  - Modal: "Out of credits. Buy more to continue."
  - No warning phase; immediate block
  - Allow view-only operations (read/query)
  - Block mutations: create, update, delete, agent invoke, send

Implementation:
  - meterCredits middleware: check balance before action
  - If balance < cost: return 402 immediately
  - No charge attempted (skip deductCredits call)
  - UI handles 402: show "Buy Credits" modal
```

### **Grace Period (Deprecated, Future)**
```
Out of scope for MVP. Could add later:
  - Grace buffer: 48h after hitting hard limit
  - During grace: all actions allowed (at risk)
  - Alert: "Your subscription expires in 2 days"
  - On expiry: hard block again
  
Not needed for MVP; keep simple (soft → hard → block).
```

---

## (4) DLQ & Manual Recovery

### **SQS Dead Letter Queue Setup**
```
Queue: nabi-webhook-dlq
  - Retention: 14 days (long enough for investigation)
  - Message format: { webhookId, type, payload, error, timestamp, attempts: 1 }

Consumer: Lambda scheduled daily (cron(0 2 * * ? *) = 8:30 AM IST)
  - Scan DLQ
  - Group by type (razorpay, bailey, eventbridge)
  - Count failures: if > threshold (e.g., 5), alert ops
  - Optionally auto-replay safe ones (e.g., payment.captured)
  - Manual replay: admin endpoint (PUT /api/admin/webhooks/{id}/replay)
```

### **Manual Webhook Replay**
```
Endpoint: PUT /api/admin/webhooks/{webhookId}/replay
  - Auth: admin only
  - Action: fetch from DLQ, re-process (same logic as original)
  - Idempotency: webhookLogService ensures no double-charge
  - Response: { status: 'replayed'|'failed', reason: '...' }
```

### **Cron DLQ & Replay**
```
Per-cron S3 backup:
  - Each cron writes manifest to S3: s3://nabi-backups/crons/{cron-name}/{date}/manifest.json
  - Manifest: { totalTenants: 10000, failed: 99, errors: [...] }
  - Manual re-run: admin CLI: aws lambda invoke --function-name lead-qualifier-handler --payload '{"date":"2026-07-01"}' /tmp/out.json
```

---

## (5) Observability & Alerting

### **CloudWatch Metrics**
```
Emit custom metrics:
  - creditService.deductCredits.success (count)
  - creditService.deductCredits.insufficient (count)
  - agentRuntime.invoke.success (count, latency)
  - agentRuntime.invoke.timeout (count)
  - emailService.fallback_to_brevo (count)
  - webhook.signature_invalid (count)
  - webhook.replayed (count)
```

### **Alarms**
```
AlertIfAny:
  - creditService.insufficient > 100 in 1h (users running out fast)
  - agentRuntime.timeout > 50 in 1h (Bedrock issues)
  - emailService.brevo_fallback > 10 in 1h (SES down?)
  - webhook.dlq_depth > 5 (backlog)
  - cron.failed_tenants > 50 (cron health check)
  
Notify: SNS → Slack #alerts + on-call email
```

### **Logging**
```
All errors logged with:
  - timestamp
  - tenantId (if available)
  - error type + message
  - stack trace (in debug mode)
  - retry count + next action

Log levels:
  - ERROR: critical path failures (Bedrock, CRM API, payment)
  - WARN: fallbacks (SES→Brevo, agent escalation)
  - INFO: success paths (webhook processed, cron completed)
  - DEBUG: retry attempts, input validation failures
```

---

## Summary: Error Budget for MVP

| Component | Error SLA | Recovery |
|-----------|-----------|----------|
| Credit deduction | 99.99% (atomicity guaranteed) | TransactWrite handles concurrency |
| Email send | 95% (SES 90% + Brevo fallback 99.5%) | SES→Brevo fallback |
| Agent qualification | 95% (Bedrock + retry 3×) | Refund credits on failure; manual review |
| Webhooks | 99.9% (signature + idempotency) | DLQ + manual replay |
| Crons | 95% per-tenant (continue on failure) | Retry next cycle; DLQ for manual |
| Overall MVP | 95% happy path | Users can work around; alerts + recovery paths exist |

**Philosophy:** Fail gracefully; no data loss; audit trail complete.