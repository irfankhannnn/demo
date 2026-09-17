---
name: sre-observability-review
description: >
  Review logging, CloudWatch metrics and alarms, X-Ray tracing, timeouts,
  retries, ECS health checks and graceful degradation, then recommend what to
  watch after the manual deploy.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# SRE & Observability Review

Review observability and resilience in: $ARGUMENTS

Telemetry here is CloudWatch only (about 16 alarms, one dashboard, metric filters defined in the CFN templates). X-Ray `TracingConfig` is on in `agency-app/ai-calling` and `agency-app/followup-agent`. Health checks exist only for `platform/whatsapp-platform` on ECS Fargate; Lambda has no liveness or readiness probe. There is no Prometheus, Grafana or Datadog, and no Kubernetes. Deploys are manual, so post-deploy monitoring is a human checklist.

## Checklist

- [ ] Structured logging on the new code path, with no token, key or PII in the log line
- [ ] A new Lambda has a matching `AWS::Logs::LogGroup` with `RetentionInDays`
- [ ] Errors are not swallowed silently; removed logging or error handling is flagged
- [ ] Timeouts set on every outbound call (DynamoDB SDK, Exotel, ElevenLabs, Gemini/Bedrock, WhatsApp, Razorpay)
- [ ] Lambda `Timeout` still under the API Gateway 29-second integration limit for request/response paths
- [ ] Retries use backoff and jitter, and the operation is idempotent
- [ ] Fallback or graceful degradation when a vendor API fails, so a CRM write is not blocked by an AI call
- [ ] ECS health check path and `HealthCheckGracePeriodSeconds` still valid after a startup change
- [ ] A changed resource keeps its existing alarm; a new failure mode gets one
- [ ] X-Ray subsegment around a new external call in the two traced services
- [ ] No heavy new import at Lambda module scope that worsens cold start

## Post-deploy monitoring

Recommend concrete metrics:

- Lambda: `Errors`, `Throttles`, `Duration` p99, `ConcurrentExecutions`
- API Gateway: `5XXError`, `4XXError`, `Latency` p99, `IntegrationLatency`
- DynamoDB: `ThrottledRequests`, `UserErrors`, `ConsumedWriteCapacityUnits`
- ECS Fargate: `CPUUtilization`, `MemoryUtilization`, `UnHealthyHostCount`
- CloudFront: `5xxErrorRate`, cache hit rate
- SQS: `ApproximateAgeOfOldestMessage`
- Frontend: error rate, page load time

Name the existing alarm or dashboard widget when there is one, rather than asking for a new one.

## Output

Save to `<output_dir>/sre-observability.md`.
