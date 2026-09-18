# RealtyFlow CRM: Observability & Debugging Roadmap
## Integrating OpenClaw Patterns for Production-Grade Visibility

**Generated:** June 25, 2026  
**Scope:** Observability architecture, logging, debugging, monitoring, and audit trails  
**Target:** Production-grade visibility with minimal performance overhead

---

## Part 1: Current State vs OpenClaw

### RealtyFlow Current Observability (Score: 4.5/10)

**Strengths:**
- ✅ CloudWatch integration for Lambda logs
- ✅ Agent audit table with 90-day TTL
- ✅ Basic error logging in agent runtime
- ✅ DynamoDB query logs via CloudWatch

**Gaps:**
- ❌ No structured diagnostic events (separate from logs)
- ❌ No OpenTelemetry integration
- ❌ No raw stream logging for model output
- ❌ No tool loop detection
- ❌ No session cost/usage tracking
- ❌ No cache tracing or execution pipeline visibility
- ❌ No security audit framework
- ❌ No subsystem-based hierarchical logging
- ❌ No diagnostic flags for targeted debugging
- ❌ No webhook error tracking with categorization

### OpenClaw Observability (Score: 8.5/10)

**Key Strengths:**
- ✅ Dual-surface logging (file + console with separate levels)
- ✅ Structured diagnostic events separate from logs
- ✅ OpenTelemetry/OTLP integration
- ✅ Raw stream logging for model output debugging
- ✅ Tool loop detection with multiple strategies
- ✅ Session cost/usage tracking with time-series data
- ✅ Cache tracing for execution pipeline visibility
- ✅ Comprehensive security audit framework
- ✅ Subsystem-based hierarchical logging
- ✅ Diagnostic flags for targeted debugging without raising log level

---

## Part 2: Architecture Design

### 2.1 Dual-Surface Logging Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
   ┌─────────────┐               ┌──────────────────┐
   │ Application │               │ Diagnostic Event │
   │    Logs     │               │    Emitter       │
   └─────────────┘               └──────────────────┘
        │                                 │
        ├─ File (JSONL)                  ├─ OpenTelemetry/OTLP
        ├─ Console (TTY-aware)           ├─ Metrics Aggregator
        └─ CloudWatch                    ├─ Trace Exporter
                                         └─ Custom Handlers
```

**Key Principles:**
1. **Separation of Concerns:** Logs ≠ Telemetry
2. **Dual Levels:** File and console can have different verbosity
3. **Structured Events:** Machine-readable telemetry
4. **Subsystem Hierarchy:** Organized logging with prefixes
5. **Performance:** No blocking on logging failures

### 2.2 Logging Configuration

```typescript
// agency-app/api/config/logging.ts
export interface LoggingConfig {
  // File logging
  file?: {
    enabled: boolean;
    path: string;                    // e.g., /var/log/realtyflow/app.jsonl
    maxSizeBytes: number;            // Default: 500MB
    maxAgeDays: number;              // Default: 7 days
    level: LogLevel;                 // Default: info
  };
  
  // Console logging
  console?: {
    enabled: boolean;
    level: LogLevel;                 // Default: info
    style: 'pretty' | 'compact' | 'json';
    colorize: boolean;
    subsystemFilter?: string[];      // e.g., ['agent.*', 'webhook']
  };
  
  // Diagnostic events
  diagnostics?: {
    enabled: boolean;
    otlpEndpoint?: string;           // e.g., http://localhost:4318
    flags?: string[];                // e.g., ['agent.*', 'tool.*']
    sampleRate?: number;             // 0-1, default 1.0
  };
  
  // Redaction
  redaction?: {
    mode: 'off' | 'tools' | 'strict';
    patterns?: string[];
  };
}
```

### 2.3 Diagnostic Events System

```typescript
// agency-app/api/services/diagnostics/events.ts
export type DiagnosticEventType =
  | 'webhook.received'
  | 'webhook.processed'
  | 'webhook.error'
  | 'message.queued'
  | 'message.processed'
  | 'agent.invoked'
  | 'agent.completed'
  | 'agent.error'
  | 'tool.called'
  | 'tool.completed'
  | 'tool.error'
  | 'tool.loop'
  | 'session.state'
  | 'session.stuck'
  | 'model.usage'
  | 'cache.hit'
  | 'cache.miss'
  | 'context.loaded'
  | 'context.summarized'
  | 'command.authorized'
  | 'command.rejected'
  | 'echo.detected'
  | 'echo.suppressed';

export interface DiagnosticEvent {
  type: DiagnosticEventType;
  timestamp: number;                 // ms since epoch
  sequenceNumber: number;            // For ordering
  
  // Context
  tenantId: string;
  sessionKey?: string;
  sessionId?: string;
  
  // Event-specific data
  data: Record<string, any>;
  
  // Performance
  durationMs?: number;
  
  // Metadata
  provider?: string;
  channel?: string;
  userId?: string;
}

export function emitDiagnosticEvent(event: DiagnosticEvent): void;
export function onDiagnosticEvent(handler: (event: DiagnosticEvent) => void): void;
```

### 2.4 Subsystem-Based Logging

```typescript
// server/logging/subsystem.ts
export interface SubsystemLogger {
  debug(msg: string, data?: any): void;
  info(msg: string, data?: any): void;
  warn(msg: string, data?: any): void;
  error(msg: string, data?: any): void;
  
  // Child logger for nested context
  child(subsystem: string): SubsystemLogger;
}

// Usage
const logger = createSubsystemLogger('agent');
const toolLogger = logger.child('tools');

logger.info('Agent invoked', { tenantId, agentId });
toolLogger.info('Tool called', { toolName, input });
// Output: [agent/tools] Tool called {...}
```

### 2.5 Raw Stream Logging

```typescript
// server/logging/raw-stream.ts
export interface RawStreamLogger {
  logModelOutput(
    sessionKey: string,
    provider: string,
    modelId: string,
    chunk: string,
    metadata?: any
  ): void;
  
  logToolResult(
    sessionKey: string,
    toolName: string,
    result: any,
    metadata?: any
  ): void;
  
  logContext(
    sessionKey: string,
    context: MsgContext,
    metadata?: any
  ): void;
}

// Enabled via environment variable
// REALTYFLOW_RAW_STREAM=1
// Output: ~/.realtyflow/logs/raw-stream.jsonl
```

---

## Part 3: Structured Event Types

### 3.1 Webhook Events

```typescript
interface WebhookReceivedEvent extends DiagnosticEvent {
  type: 'webhook.received';
  data: {
    webhookEventId: string;
    eventType: string;
    from: string;
    to: string;
    messageType: string;
    timestamp: number;
  };
}

interface WebhookProcessedEvent extends DiagnosticEvent {
  type: 'webhook.processed';
  data: {
    webhookEventId: string;
    status: 'success' | 'failed' | 'skipped';
    durationMs: number;
    messageCount: number;
    toolCallCount: number;
  };
}

interface WebhookErrorEvent extends DiagnosticEvent {
  type: 'webhook.error';
  data: {
    webhookEventId: string;
    errorCode: string;
    errorMessage: string;
    stack?: string;
    retryable: boolean;
  };
}
```

### 3.2 Agent Events

```typescript
interface AgentInvokedEvent extends DiagnosticEvent {
  type: 'agent.invoked';
  data: {
    agentId: string;
    intent: string;
    inputTokens: number;
    contextLength: number;
  };
}

interface AgentCompletedEvent extends DiagnosticEvent {
  type: 'agent.completed';
  data: {
    agentId: string;
    status: 'success' | 'failed' | 'timeout';
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
    toolCallCount: number;
  };
}

interface AgentErrorEvent extends DiagnosticEvent {
  type: 'agent.error';
  data: {
    agentId: string;
    errorCode: string;
    errorMessage: string;
    recoverable: boolean;
  };
}
```

### 3.3 Tool Events

```typescript
interface ToolCalledEvent extends DiagnosticEvent {
  type: 'tool.called';
  data: {
    toolName: string;
    input: Record<string, any>;
    agentId: string;
  };
}

interface ToolCompletedEvent extends DiagnosticEvent {
  type: 'tool.completed';
  data: {
    toolName: string;
    status: 'success' | 'failed';
    durationMs: number;
    resultSize: number;
  };
}

interface ToolLoopEvent extends DiagnosticEvent {
  type: 'tool.loop';
  data: {
    toolName: string;
    level: 'warning' | 'critical';
    action: 'warn' | 'block';
    detector: string;  // e.g., 'generic_repeat', 'ping_pong'
    count: number;
    message: string;
    pairedToolName?: string;
  };
}
```

### 3.4 Context Events

```typescript
interface ContextLoadedEvent extends DiagnosticEvent {
  type: 'context.loaded';
  data: {
    sessionKey: string;
    messageCount: number;
    tokenCount: number;
    summaryCount: number;
    contextAge: number;  // ms since oldest message
  };
}

interface ContextSummarizedEvent extends DiagnosticEvent {
  type: 'context.summarized';
  data: {
    sessionKey: string;
    messageCount: number;
    summaryLength: number;
    compressionRatio: number;
  };
}

interface CacheHitEvent extends DiagnosticEvent {
  type: 'cache.hit';
  data: {
    cacheKey: string;
    cacheAge: number;  // ms
    hitRate: number;   // 0-1
  };
}
```

### 3.5 Command & Echo Events

```typescript
interface CommandAuthorizedEvent extends DiagnosticEvent {
  type: 'command.authorized';
  data: {
    commandName: string;
    sender: string;
    category: string;
    scope: string;
  };
}

interface CommandRejectedEvent extends DiagnosticEvent {
  type: 'command.rejected';
  data: {
    commandName: string;
    sender: string;
    reason: string;
  };
}

interface EchoDetectedEvent extends DiagnosticEvent {
  type: 'echo.detected';
  data: {
    messageId: string;
    originalSender: string;
    detectionMethod: string;  // e.g., 'outbound_tracking', 'self_chat'
  };
}

interface EchoSuppressedEvent extends DiagnosticEvent {
  type: 'echo.suppressed';
  data: {
    messageId: string;
    originalMessageId: string;
    suppressionReason: string;
  };
}
```

---

## Part 4: Tool Loop Detection

### 4.1 Detection Strategies

```typescript
// agency-app/api/services/diagnostics/tool-loop-detector.ts

export type LoopDetectionStrategy =
  | 'generic_repeat'           // Same tool called N times in a row
  | 'unknown_tool_repeat'      // Unknown tool called repeatedly
  | 'known_poll_no_progress'   // Known polling tool with no state change
  | 'global_circuit_breaker'   // Too many tool calls in session
  | 'ping_pong'                // Two tools calling each other
  | 'timeout_exceeded';        // Tool loop taking too long

export interface LoopDetectionResult {
  detected: boolean;
  strategy: LoopDetectionStrategy;
  confidence: number;           // 0-1
  toolName: string;
  count: number;
  message: string;
  recommendation: 'warn' | 'block' | 'escalate';
}

export function detectToolLoop(
  sessionKey: string,
  toolName: string,
  history: ToolCall[],
  config: LoopDetectionConfig
): LoopDetectionResult;
```

### 4.2 Configuration

```typescript
export interface LoopDetectionConfig {
  // Generic repeat detection
  genericRepeatThreshold: number;      // Default: 3
  
  // Unknown tool detection
  unknownToolThreshold: number;        // Default: 2
  
  // Polling detection
  pollingToolThreshold: number;        // Default: 5
  pollingStateChangeRequired: boolean; // Default: true
  
  // Global circuit breaker
  maxToolCallsPerSession: number;      // Default: 50
  
  // Ping pong detection
  pingPongThreshold: number;           // Default: 2
  
  // Timeout
  maxToolLoopDurationMs: number;       // Default: 30000
  
  // Actions
  blockOnCritical: boolean;            // Default: true
  escalateOnBlock: boolean;            // Default: true
}
```

---

## Part 5: Session Cost & Usage Tracking

### 5.1 Usage Aggregation

```typescript
// agency-app/api/services/diagnostics/session-usage.ts

export interface SessionUsage {
  sessionKey: string;
  date: string;                        // YYYY-MM-DD
  
  // Token usage
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  
  // Cost
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
  
  // Metrics
  modelId: string;
  requestCount: number;
  averageLatencyMs: number;
  
  // Tools
  toolCallCount: number;
  toolErrorCount: number;
  
  // Timestamps
  firstRequestAt: number;
  lastRequestAt: number;
}

export async function aggregateSessionUsage(
  sessionKey: string,
  date: string
): Promise<SessionUsage>;

export async function getSessionUsageTrend(
  sessionKey: string,
  days: number
): Promise<SessionUsage[]>;
```

### 5.2 Cost Calculation

```typescript
export interface ModelPricing {
  modelId: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  cacheReadCostPer1kTokens: number;
  cacheWriteCostPer1kTokens: number;
}

export function calculateCost(
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  },
  pricing: ModelPricing
): number;
```

---

## Part 6: Cache Tracing

### 6.1 Execution Pipeline Stages

```typescript
// agency-app/api/services/diagnostics/cache-trace.ts

export type CacheTraceStage =
  | 'cache:result'              // Cache lookup result
  | 'cache:state'               // Cache state before/after
  | 'session:loaded'            // Session loaded from DB
  | 'session:sanitized'         // Session after sanitization
  | 'session:limited'           // Session after limiting
  | 'prompt:before'             // Prompt before model call
  | 'prompt:images'             // Image processing
  | 'stream:context'            // Streaming context
  | 'session:after'             // Session after model call
  | 'context:summarized'        // Context after summarization
  | 'output:validated'          // Output after validation
  | 'output:sanitized';         // Output after sanitization

export interface CacheTraceEntry {
  stage: CacheTraceStage;
  timestamp: number;
  duration?: number;
  data?: Record<string, any>;
  fingerprint?: string;         // SHA-256 of data
}

export interface CacheTrace {
  sessionKey: string;
  runId: string;
  startTime: number;
  entries: CacheTraceEntry[];
  
  // Summary
  totalDuration: number;
  cacheHit: boolean;
  stages: CacheTraceStage[];
}

export function createCacheTrace(sessionKey: string, runId: string): CacheTrace;
export function recordStage(trace: CacheTrace, stage: CacheTraceStage, data?: any): void;
export function saveCacheTrace(trace: CacheTrace): Promise<void>;
```

---

## Part 7: Security Audit Framework

### 7.1 Audit Types

```typescript
// agency-app/api/services/security/audit.ts

export type SecurityAuditSeverity = 'critical' | 'warn' | 'info';

export interface SecurityAuditFinding {
  checkId: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  remediation?: string;
  affectedResource?: string;
}

export interface SecurityAuditReport {
  timestamp: number;
  tenantId: string;
  
  // Summary
  criticalCount: number;
  warnCount: number;
  infoCount: number;
  
  // Findings
  findings: SecurityAuditFinding[];
  
  // Deep probe results
  deep?: {
    gateway?: {
      status: 'ok' | 'warning' | 'error';
      details: Record<string, any>;
    };
    database?: {
      status: 'ok' | 'warning' | 'error';
      details: Record<string, any>;
    };
    credentials?: {
      status: 'ok' | 'warning' | 'error';
      details: Record<string, any>;
    };
  };
}
```

### 7.2 Audit Checks

```typescript
export interface SecurityAuditConfig {
  checks: {
    // Filesystem checks
    credentialPermissions: boolean;     // Check file permissions
    credentialEncryption: boolean;      // Check encryption
    
    // Database checks
    tableEncryption: boolean;           // Check DynamoDB encryption
    tableAccessControl: boolean;        // Check IAM policies
    
    // API checks
    apiKeyRotation: boolean;            // Check key age
    apiKeyUsage: boolean;               // Check usage patterns
    
    // Command checks
    commandAuthorization: boolean;      // Check command auth
    commandAudit: boolean;              // Check audit logs
    
    // Agent checks
    agentOutputValidation: boolean;     // Check output schema
    agentContextInjection: boolean;     // Check context loading
    agentToolAccess: boolean;           // Check tool allowlists
  };
}

export async function runSecurityAudit(
  tenantId: string,
  config: SecurityAuditConfig
): Promise<SecurityAuditReport>;
```

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)

#### 1.1 Logging Infrastructure
- [ ] Implement dual-surface logger (file + console)
- [ ] Add subsystem-based hierarchical logging
- [ ] Implement log rotation and cleanup
- [ ] Add redaction support
- [ ] Integration with CloudWatch

**Files:**
- `server/logging/logger.ts` (new)
- `server/logging/subsystem.ts` (new)
- `server/logging/redact.ts` (new)
- `agency-app/api/config/logging.ts` (new)

**Effort:** 1 week

#### 1.2 Diagnostic Events System
- [ ] Define event types and interfaces
- [ ] Implement event emitter
- [ ] Add event handlers registry
- [ ] Implement event filtering
- [ ] Add sequence numbering

**Files:**
- `agency-app/api/services/diagnostics/events.ts` (new)
- `agency-app/api/services/diagnostics/event-types.ts` (new)
- `agency-app/api/services/diagnostics/event-emitter.ts` (new)

**Effort:** 1 week

#### 1.3 OpenTelemetry Integration
- [ ] Add OpenTelemetry SDK
- [ ] Implement OTLP exporter
- [ ] Add trace context propagation
- [ ] Implement metric collection
- [ ] Add span decorators

**Files:**
- `agency-app/api/services/diagnostics/otel.ts` (new)
- `agency-app/api/services/diagnostics/otel-exporter.ts` (new)

**Effort:** 1 week

**Phase 1 Summary:**
- Total Effort: 2-3 weeks
- Impact: Foundation for all observability features
- Risk: Low (new services, no breaking changes)

---

### Phase 2: Event Instrumentation (3-4 weeks)

#### 2.1 Webhook Event Instrumentation
- [ ] Add webhook received event
- [ ] Add webhook processed event
- [ ] Add webhook error event
- [ ] Implement error categorization
- [ ] Add duration tracking

**Files:**
- `agency-app/api/routes/webhooks.js` (update)

**Effort:** 1 week

#### 2.2 Agent Event Instrumentation
- [ ] Add agent invoked event
- [ ] Add agent completed event
- [ ] Add agent error event
- [ ] Track token usage
- [ ] Track cost

**Files:**
- `agency-app/api/agents/agentRuntime.js` (update)

**Effort:** 1 week

#### 2.3 Tool Event Instrumentation
- [ ] Add tool called event
- [ ] Add tool completed event
- [ ] Add tool error event
- [ ] Implement tool loop detection
- [ ] Add loop warning events

**Files:**
- `agency-app/api/agents/agentRuntime.js` (update)
- `agency-app/api/services/diagnostics/tool-loop-detector.ts` (new)

**Effort:** 1 week

#### 2.4 Context Event Instrumentation
- [ ] Add context loaded event
- [ ] Add context summarized event
- [ ] Add cache hit/miss events
- [ ] Track context metrics
- [ ] Add fingerprinting

**Files:**
- `agency-app/api/whatsappConversationService.js` (update)
- `agency-app/api/services/diagnostics/cache-trace.ts` (new)

**Effort:** 1 week

**Phase 2 Summary:**
- Total Effort: 3-4 weeks
- Impact: Full visibility into system behavior
- Risk: Low (additive instrumentation)

---

### Phase 3: Advanced Features (2-3 weeks)

#### 3.1 Tool Loop Detection
- [ ] Implement generic repeat detection
- [ ] Implement unknown tool detection
- [ ] Implement polling detection
- [ ] Implement ping pong detection
- [ ] Implement circuit breaker
- [ ] Add blocking and escalation

**Files:**
- `agency-app/api/services/diagnostics/tool-loop-detector.ts` (new)

**Effort:** 1 week

#### 3.2 Session Cost & Usage Tracking
- [ ] Implement usage aggregation
- [ ] Add cost calculation
- [ ] Implement daily aggregation
- [ ] Add trend analysis
- [ ] Add reporting

**Files:**
- `agency-app/api/services/diagnostics/session-usage.ts` (new)
- `agency-app/api/services/diagnostics/usage-aggregator.ts` (new)

**Effort:** 1 week

#### 3.3 Raw Stream Logging
- [ ] Implement raw model output logging
- [ ] Add tool result logging
- [ ] Add context logging
- [ ] Implement log rotation
- [ ] Add environment variable control

**Files:**
- `server/logging/raw-stream.ts` (new)

**Effort:** 1 week

**Phase 3 Summary:**
- Total Effort: 2-3 weeks
- Impact: Advanced debugging and analysis capabilities
- Risk: Low (optional features)

---

### Phase 4: Security & Audit (2-3 weeks)

#### 4.1 Security Audit Framework
- [ ] Define audit checks
- [ ] Implement filesystem checks
- [ ] Implement database checks
- [ ] Implement API checks
- [ ] Implement command checks
- [ ] Implement agent checks
- [ ] Add remediation guidance

**Files:**
- `agency-app/api/services/security/audit.ts` (new)
- `agency-app/api/services/security/audit-checks.ts` (new)

**Effort:** 2 weeks

#### 4.2 Audit Trail Management
- [ ] Implement audit log storage
- [ ] Add audit log rotation
- [ ] Implement audit log search
- [ ] Add audit log export
- [ ] Implement compliance reporting

**Files:**
- `agency-app/api/services/security/audit-logger.ts` (new)

**Effort:** 1 week

**Phase 4 Summary:**
- Total Effort: 2-3 weeks
- Impact: Security visibility and compliance
- Risk: Low (new features)

---

## Part 9: Debugging Tools

### 9.1 CLI Commands

```bash
# View logs with filtering
realtyflow logs --follow
realtyflow logs --level debug
realtyflow logs --subsystem agent.*
realtyflow logs --json

# View diagnostic events
realtyflow events --follow
realtyflow events --type webhook.processed
realtyflow events --type tool.loop

# View session usage
realtyflow usage <sessionKey>
realtyflow usage <sessionKey> --trend 7

# Run security audit
realtyflow audit
realtyflow audit --deep
realtyflow audit --fix

# View cache trace
realtyflow trace <sessionKey>
realtyflow trace <sessionKey> --stage prompt:before

# View raw streams
realtyflow raw-stream --follow
realtyflow raw-stream --type model-output
```

### 9.2 Environment Variables

```bash
# Logging
REALTYFLOW_LOG_LEVEL=debug
REALTYFLOW_LOG_FILE=/var/log/realtyflow/app.jsonl
REALTYFLOW_LOG_STYLE=pretty|compact|json

# Diagnostics
REALTYFLOW_DIAGNOSTICS=agent.*,tool.*
REALTYFLOW_OTLP_ENDPOINT=http://localhost:4318
REALTYFLOW_OTLP_ENABLED=1

# Debugging
REALTYFLOW_RAW_STREAM=1
REALTYFLOW_CACHE_TRACE=1
REALTYFLOW_VERBOSE=1

# Security
REALTYFLOW_AUDIT_ENABLED=1
REALTYFLOW_REDACTION_MODE=strict
```

---

## Part 10: Monitoring & Alerting

### 10.1 Key Metrics

**Webhook Processing:**
- Webhook received rate (per minute)
- Webhook processing latency (p50, p95, p99)
- Webhook error rate
- Webhook idempotency rate

**Agent Execution:**
- Agent invocation rate
- Agent success rate
- Agent error rate
- Agent latency (p50, p95, p99)
- Tool loop detection rate

**Tool Execution:**
- Tool call rate
- Tool success rate
- Tool error rate
- Tool latency (p50, p95, p99)
- Tool loop incidents

**Context & Memory:**
- Context load latency
- Context size (messages, tokens)
- Summarization rate
- Cache hit rate
- Cache miss rate

**Cost & Usage:**
- Token usage per session
- Cost per session
- Cost per tenant
- Model usage breakdown
- Tool usage breakdown

### 10.2 Alert Rules

```yaml
# Tool loop detection
- alert: ToolLoopDetected
  expr: tool_loop_events_total > 0
  for: 1m
  severity: critical
  action: escalate

# High error rate
- alert: HighWebhookErrorRate
  expr: webhook_error_rate > 0.05
  for: 5m
  severity: warning
  action: notify

# High latency
- alert: HighAgentLatency
  expr: agent_latency_p99 > 10000
  for: 5m
  severity: warning
  action: notify

# Stuck session
- alert: StuckSession
  expr: session_stuck_events_total > 0
  for: 1m
  severity: warning
  action: escalate

# High cost
- alert: HighSessionCost
  expr: session_cost_usd > 100
  for: 1h
  severity: info
  action: notify
```

---

## Part 11: Integration with Existing Systems

### 11.1 CloudWatch Integration

```typescript
// agency-app/api/services/diagnostics/cloudwatch-exporter.ts

export class CloudWatchExporter {
  async exportMetric(
    namespace: string,
    metricName: string,
    value: number,
    unit: string,
    dimensions?: Record<string, string>
  ): Promise<void>;
  
  async exportLog(
    logGroup: string,
    logStream: string,
    message: string,
    timestamp?: number
  ): Promise<void>;
}
```

### 11.2 DynamoDB Integration

```typescript
// New tables for observability

// DiagnosticEvents table
{
  PK: "DIAG#{timestamp}#{sequenceNumber}",
  SK: "#{tenantId}#{sessionKey}",
  GSI1: "tenantId-timestamp",
  GSI2: "eventType-timestamp",
  TTL: 30 days
}

// SessionUsage table
{
  PK: "USAGE#{sessionKey}",
  SK: "#{date}",
  GSI1: "tenantId-date",
  TTL: 90 days
}

// SecurityAudit table
{
  PK: "AUDIT#{tenantId}",
  SK: "#{timestamp}",
  GSI1: "severity-timestamp",
  TTL: 1 year
}

// CacheTrace table
{
  PK: "TRACE#{sessionKey}",
  SK: "#{runId}",
  GSI1: "tenantId-timestamp",
  TTL: 7 days
}
```

---

## Part 12: Success Metrics

### Observability Improvements

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Time to diagnose issue | 30+ min | <5 min | Manual review |
| Tool loop detection rate | 0% | 100% | Automated detection |
| Session cost visibility | None | 100% | Cost tracking |
| Cache hit rate visibility | None | 100% | Cache tracing |
| Security audit coverage | 0% | 100% | Audit framework |
| Raw stream logging | None | Available | Debug logs |

### Operational Improvements

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| MTTR (Mean Time To Repair) | 30+ min | <10 min | Incident tracking |
| False positive rate | N/A | <5% | Alert tuning |
| Observability overhead | N/A | <5% | Performance testing |
| Log storage cost | Baseline | +10% | Cost tracking |
| Debugging capability | Low | High | User feedback |

---

## Part 13: Rollout Strategy

### Phase 1: Staging Deployment
1. Deploy logging infrastructure to staging
2. Enable diagnostic events in staging
3. Run load tests to measure overhead
4. Validate log output and event streams
5. Tune sampling rates and filters

### Phase 2: Gradual Production Rollout
1. Deploy to 10% of production traffic
2. Monitor for issues and performance impact
3. Gradually increase to 50%, then 100%
4. Collect baseline metrics
5. Tune alert thresholds

### Phase 3: Feature Enablement
1. Enable tool loop detection
2. Enable session cost tracking
3. Enable cache tracing
4. Enable security audits
5. Enable raw stream logging (on-demand)

### Phase 4: Optimization
1. Tune sampling rates based on volume
2. Optimize storage and retention
3. Implement log compression
4. Implement event aggregation
5. Fine-tune alert thresholds

---

## Conclusion

By implementing OpenClaw-inspired observability patterns, RealtyFlow CRM can achieve:

✅ **Production-grade visibility** into system behavior  
✅ **Rapid issue diagnosis** with structured events and tracing  
✅ **Cost transparency** with session usage tracking  
✅ **Security compliance** with comprehensive audit trails  
✅ **Performance optimization** with cache and tool loop analysis  
✅ **Operational excellence** with automated alerting and remediation  

**Expected Timeline:** 6-8 weeks for full implementation  
**Expected Outcome:** World-class observability and debugging capabilities

