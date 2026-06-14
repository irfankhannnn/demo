---
name: sre-observability-review
description: >
  Review logging, metrics, tracing, alerting, timeouts, retries, circuit breakers,
  and health checks. Recommends post-deployment monitoring.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# SRE & Observability Review

Review observability and resilience in: $ARGUMENTS

## Checklist

- [ ] Structured logging for new code paths
- [ ] Error handling doesn't swallow exceptions silently
- [ ] Timeouts configured for external calls
- [ ] Retry logic with exponential backoff
- [ ] Health check endpoints maintained
- [ ] Metrics for new critical paths
- [ ] Alerts recommended for failure modes

## Post-Deploy Monitoring

Recommend specific metrics:
- Lambda: Errors, Duration, Throttles, ConcurrentExecutions
- API Gateway: 5XXError, Latency (p99)
- DynamoDB: ConsumedReadCapacity, ThrottledRequests
- Frontend: Error rate, page load time

## Output

Save to `<output_dir>/sre-observability.md`
