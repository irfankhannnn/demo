# RealtyFlow: Comprehensive Testing & Operational Improvements Strategy

**Version:** 1.0  
**Date:** 2024  
**Status:** Design Document  
**Audience:** Engineering, DevOps, QA Teams

---

## Executive Summary

This document outlines a comprehensive testing and operational improvements strategy for RealtyFlow, a multi-tenant real estate CRM platform. The strategy encompasses:

- **Unit, Integration, and E2E Testing** across frontend, backend, and microservices
- **Agent Behavior Testing** for AI-powered calling and automation
- **Message Handling & Tool Invocation Testing** for MCP integration
- **Multi-tenant Isolation Testing** with security validation
- **Load Testing & Performance Validation** for production readiness
- **Observability & Monitoring** infrastructure
- **Debugging Tools & Incident Response** procedures

**Current State:**
- ✅ Playwright E2E tests (28 test suites, 100+ test cases)
- ✅ API security tests (cross-tenant, penetration, validation)
- ✅ Multi-project configuration (public, API, CRM)
- ❌ Unit tests (minimal coverage)
- ❌ Integration tests (limited)
- ❌ Agent behavior tests (none)
- ❌ Load testing infrastructure (none)
- ❌ Structured observability (basic Sentry/PostHog)

**Target State:**
- 80%+ unit test coverage across backend services
- 95%+ API integration test coverage
- Comprehensive agent behavior testing framework
- Load testing for 10,000+ concurrent users
- Real-time observability with distributed tracing
- Automated incident response procedures

---

## 1. Test Strategy & Architecture

### 1.1 Testing Pyramid

```
                    ▲
                   / \
                  /   \  E2E Tests (10%)
                 /     \  - Full user journeys
                /       \ - Cross-service flows
               /_________\
              /           \
             /             \ Integration Tests (30%)
            /               \ - API contracts
           /                 \ - Service interactions
          /___________________\
         /                     \
        /                       \ Unit Tests (60%)
       /                         \ - Business logic
      /                           \ - Utilities
     /_____________________________\
```

### 1.2 Test Categories & Coverage Goals

| Test Type | Coverage Goal | Tools | Scope |
|-----------|---------------|-------|----------|
| **Unit Tests** | 80% | Jest, Vitest | Business logic, utilities, helpers |
| **Integration Tests** | 95% | Jest, Supertest | API routes, database, services |
| **E2E Tests** | 70% | Playwright | User workflows, critical paths |
| **Agent Tests** | 85% | Custom framework | AI behavior, tool invocation |
| **Security Tests** | 100% | Playwright, OWASP | Cross-tenant, auth, injection |
| **Performance Tests** | 95% | k6, Artillery | Load, stress, spike testing |
| **Accessibility Tests** | 90% | axe-core, Playwright | WCAG 2.1 AA compliance |

### 1.3 Test Environment Strategy

```
Development (Local)
├─ Jest unit tests (watch mode)
├─ Supertest integration tests
├─ Playwright E2E (headed mode)
└─ Mock services (DynamoDB Local, LocalStack)
         ↓
CI/CD Pipeline (GitHub Actions)
├─ Lint & type checks
├─ Unit tests (coverage gates)
├─ Integration tests (real DynamoDB)
├─ E2E tests (headless, parallel)
└─ Security scans (SAST, dependency)
         ↓
Staging Environment
├─ Full E2E suite (all browsers)
├─ Performance baseline tests
├─ Load testing (5,000 users)
└─ Chaos engineering tests
         ↓
Production Environment
├─ Synthetic monitoring (Datadog)
├─ Real user monitoring (RUM)
├─ Distributed tracing (OpenTelemetry)
└─ Error tracking (Sentry)
```

---

## 2. Unit Testing Framework

### 2.1 Backend Unit Tests (Jest)

**Location:** `server/src/__tests__/`

**Structure:**
```
server/src/__tests__/
├── unit/
│   ├── services/
│   │   ├── crm.service.test.ts
│   │   ├── subscription.service.test.ts
│   │   ├── ai-employee.service.test.ts
│   │   └── khata.service.test.ts
│   ├── utils/
│   │   ├── validators.test.ts
│   │   ├── formatters.test.ts
│   │   └── helpers.test.ts
│   ├── middleware/
│   │   ├── auth.test.ts
│   │   ├── tenant-isolation.test.ts
│   │   └── error-handler.test.ts
│   └── models/
│       ├── buyer.model.test.ts
│       ├── lead.model.test.ts
│       └── property.model.test.ts
├── fixtures/
│   ├── buyers.json
│   ├── leads.json
│   └── properties.json
└── setup.ts
```

### 2.2 Frontend Unit Tests (Vitest)

**Location:** `real-estate-crm-app/src/__tests__/`

**Structure:**
```
real-estate-crm-app/src/__tests__/
├── unit/
│   ├── components/
│   │   ├── LeadCard.test.tsx
│   │   ├── BuyerForm.test.tsx
│   │   └── Dashboard.test.tsx
│   ├── hooks/
│   │   ├── useBuyers.test.ts
│   │   ├── useLeads.test.ts
│   │   └── useTenant.test.ts
│   ├── utils/
│   │   ├── formatters.test.ts
│   │   ├── validators.test.ts
│   │   └── api.test.ts
│   └── services/
│       ├── api.service.test.ts
│       └── storage.service.test.ts
├── fixtures/
│   └── mockData.ts
└── setup.ts
```

---

## 3. Integration Testing Framework

### 3.1 API Integration Tests (Supertest + Jest)

**Location:** `server/src/__tests__/integration/`

**Structure:**
```
server/src/__tests__/integration/
├── api/
│   ├── crm.routes.test.ts
│   ├── subscriptions.routes.test.ts
│   ├── ai-employee.routes.test.ts
│   ├── khata.routes.test.ts
│   └── billing.routes.test.ts
├── services/
│   ├── crm-service.integration.test.ts
│   ├── subscription-service.integration.test.ts
│   └── ai-employee-service.integration.test.ts
├── database/
│   ├── dynamodb.integration.test.ts
│   └── migrations.test.ts
└── fixtures/
    ├── testData.ts
    └── seedDatabase.ts
```

---

## 4. Agent Behavior Testing Framework

### 4.1 Agent Testing Architecture

RealtyFlow uses AI agents (Claude, Bedrock) for:
- AI Employee (call handling, lead qualification)
- AI Calling Service (voice interactions)
- MCP-based tool invocation

**Testing Framework:**
```typescript
// server/src/__tests__/agents/agent-testing.framework.ts
export interface AgentTestCase {
  name: string;
  input: string;
  expectedToolCalls: ToolInvocation[];
  expectedResponse: string | RegExp;
  expectedState: Record<string, any>;
}

export interface ToolInvocation {
  toolName: string;
  args: Record<string, any>;
  expectedResult?: any;
}

export interface AgentTestContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  conversationHistory: Message[];
}

export class AgentTestRunner {
  async runTestCase(
    agent: Agent,
    testCase: AgentTestCase,
    context: AgentTestContext
  ): Promise<void> {
    // Run agent with input
    const result = await agent.process(testCase.input, context);

    // Verify tool calls
    for (const expectedCall of testCase.expectedToolCalls) {
      const actualCall = result.toolCalls.find(
        (c) => c.toolName === expectedCall.toolName
      );
      expect(actualCall).toBeDefined();
      expect(actualCall?.args).toEqual(expectedCall.args);
    }

    // Verify response
    if (typeof testCase.expectedResponse === 'string') {
      expect(result.response).toContain(testCase.expectedResponse);
    } else {
      expect(result.response).toMatch(testCase.expectedResponse);
    }

    // Verify state changes
    for (const [key, value] of Object.entries(testCase.expectedState)) {
      expect(result.state[key]).toEqual(value);
    }
  }
}
```

### 4.2 AI Employee Agent Tests

**Location:** `server/src/__tests__/agents/ai-employee.agent.test.ts`

Test cases for:
- Lead qualification workflows
- Multi-turn conversations
- Error handling and recovery
- Tool invocation validation
- State management across turns

### 4.3 Tool Invocation Testing

**Location:** `server/src/__tests__/agents/tool-invocation.test.ts`

Test cases for:
- CRM tools (createBuyer, getBuyer, updateLead, etc.)
- Message handling tools (sendSMS, sendWhatsApp, sendEmail)
- MCP tool integration
- Tool argument validation
- Tenant isolation in tools

---

## 5. Message Handling Testing

### 5.1 Message Handling Test Cases

**Location:** `server/src/__tests__/integration/messaging/message-handling.test.ts`

Test coverage for:
- SMS message queuing and delivery
- WhatsApp message handling with media
- Email with attachments
- Message batching and progress tracking
- Delivery status updates and retries
- Message deduplication with idempotency keys

### 5.2 Message Queue Testing

Test cases for:
- Queue persistence
- Retry logic with exponential backoff
- Dead letter queue handling
- Batch processing
- Concurrent message handling

---

## 6. Multi-Tenant Testing Strategy

### 6.1 Multi-Tenant Test Cases

**Location:** `server/src/__tests__/integration/multi-tenant/multi-tenant.test.ts`

Test coverage for:
- **Data Isolation:** Tenant A cannot read/write/delete Tenant B data
- **List Filtering:** Each tenant only sees their own data
- **Query Parameter Injection:** Cannot bypass tenant filters
- **Subscription Limits:** Independent per tenant
- **Audit Logging:** Separate logs per tenant
- **Resource Quotas:** Enforced per tenant

### 6.2 Cross-Tenant Security Tests

Test cases for:
- JWT token validation per tenant
- Tenant ID extraction from token
- Tenant prefix validation in resource IDs
- Batch operation isolation
- Webhook isolation per tenant

---

## 7. Load Testing & Performance Validation

### 7.1 Load Testing with k6

**Location:** `tests/load/`

Test scenarios:
- **Ramp-up:** 0 → 100 → 200 users over 16 minutes
- **Sustained Load:** 200 concurrent users for 5 minutes
- **Spike Test:** Sudden jump to 500 users
- **Stress Test:** Gradual increase until system breaks

Performance thresholds:
- p95 response time: < 500ms
- p99 response time: < 1000ms
- Error rate: < 0.1%
- Throughput: > 1000 req/sec

### 7.2 Performance Baseline Tests

**Location:** `tests/performance/performance-baseline.test.ts`

Baseline metrics for:
- Create buyer: p95 < 200ms, p99 < 500ms
- Get buyer: p95 < 100ms, p99 < 300ms
- List buyers: p95 < 300ms, p99 < 800ms
- Update buyer: p95 < 200ms, p99 < 500ms
- Delete buyer: p95 < 150ms, p99 < 400ms

### 7.3 Database Performance Tests

Test cases for:
- Query performance with various indexes
- Pagination efficiency
- Batch operation performance
- Cache hit rates
- Connection pool utilization

---

## 8. Observability & Monitoring Design

### 8.1 Distributed Tracing (OpenTelemetry)

**Implementation:**
```typescript
// server/src/instrumentation/tracing.ts
import { NodeTracerProvider } from '@opentelemetry/node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/tracing';

const provider = new NodeTracerProvider();
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT,
});

provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
provider.register();
```

**Trace Context:**
- Request ID propagation
- Tenant ID in all spans
- User ID in all spans
- Service name and version
- Operation duration and status

### 8.2 Structured Logging

**Implementation:**
```typescript
// server/src/instrumentation/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: {
    service: 'realtyflow-backend',
    version: process.env.APP_VERSION,
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Usage
logger.info('Buyer created', {
  buyerId: 'BUYER#123',
  tenantId: 'TENANT#A',
  userId: 'USER#456',
  traceId: 'trace-123',
});
```

**Log Levels:**
- ERROR: System failures, exceptions
- WARN: Deprecated APIs, performance issues
- INFO: Business events (create, update, delete)
- DEBUG: Detailed flow information
- TRACE: Variable values, function entry/exit

### 8.3 Metrics Collection

**Key Metrics:**
- Request count by endpoint
- Request duration (p50, p95, p99)
- Error rate by endpoint
- Database query count and duration
- Cache hit/miss ratio
- Message queue depth
- Active user sessions
- Subscription usage (seats, features)

**Implementation:**
```typescript
// server/src/instrumentation/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active database connections',
});
```

### 8.4 Error Tracking (Sentry)

**Configuration:**
```typescript
// server/src/instrumentation/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({
      request: true,
      serverName: true,
      transaction: true,
    }),
  ],
});

// Capture errors with context
Sentry.captureException(error, {
  tags: {
    tenantId: 'TENANT#123',
    userId: 'USER#456',
  },
  extra: {
    buyerId: 'BUYER#789',
    operation: 'create_lead',
  },
});
```

### 8.5 Real User Monitoring (RUM)

**Frontend Integration:**
```typescript
// real-estate-crm-app/src/instrumentation/rum.ts
import { BrowserTracer } from '@opentelemetry/instrumentation-browser';
import { WebTracerProvider } from '@opentelemetry/web';

const provider = new WebTracerProvider();
provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));

// Track user interactions
const tracer = provider.getTracer('realtyflow-frontend');
const span = tracer.startSpan('user_interaction', {
  attributes: {
    'user.id': userId,
    'tenant.id': tenantId,
    'interaction.type': 'button_click',
  },
});
```

---

## 9. Debugging Tools & Utilities

### 9.1 Debug CLI Tool

**Location:** `scripts/debug-cli.ts`

**Features:**
- Query DynamoDB directly
- Inspect tenant data
- View audit logs
- Trace request flow
- Replay failed requests

**Usage:**
```bash
# Query buyer
npm run debug -- query-buyer --buyerId BUYER#123 --tenantId TENANT#A

# View audit log
npm run debug -- audit-log --tenantId TENANT#A --limit 100

# Trace request
npm run debug -- trace-request --requestId req-123

# Replay request
npm run debug -- replay-request --requestId req-123
```

### 9.2 Test Data Management

**Location:** `scripts/test-data/`

**Features:**
- Generate test data
- Seed databases
- Clean up test data
- Create test tenants
- Generate test tokens

**Usage:**
```bash
# Generate test data
npm run test-data:generate --count 1000

# Seed database
npm run test-data:seed --file test-data.json

# Create test tenant
npm run test-data:create-tenant --name "Test Tenant"

# Generate token
npm run test-data:generate-token --tenantId TENANT#test
```

### 9.3 Performance Profiling

**Location:** `scripts/profiling/`

**Tools:**
- Node.js built-in profiler
- Clinic.js for diagnostics
- Autocannon for benchmarking

**Usage:**
```bash
# CPU profiling
node --prof server.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
clinic doctor -- npm start

# Benchmark
autocannon http://localhost:3001/api/crm/buyers
```

### 9.4 Log Analysis Tools

**Location:** `scripts/log-analysis/`

**Features:**
- Parse structured logs
- Filter by tenant/user/operation
- Identify error patterns
- Generate reports
- Export to CSV

**Usage:**
```bash
# Analyze logs
npm run analyze-logs -- --file combined.log --tenantId TENANT#A

# Find errors
npm run analyze-logs -- --file error.log --pattern "timeout"

# Generate report
npm run analyze-logs -- --file combined.log --report daily
```

---

## 10. Incident Response Procedures

### 10.1 Incident Classification

| Severity | Response Time | Example |
|----------|---------------|---------|
| **P1 - Critical** | 15 minutes | Complete system outage, data loss |
| **P2 - High** | 1 hour | API errors for 10%+ users, security breach |
| **P3 - Medium** | 4 hours | Feature broken, performance degradation |
| **P4 - Low** | 24 hours | Minor UI issue, documentation error |

### 10.2 Incident Response Workflow

```
1. DETECT
   ├─ Automated alerts (Datadog, PagerDuty)
   ├─ User reports
   └─ Manual monitoring

2. ASSESS
   ├─ Determine severity
   ├─ Identify affected users/tenants
   └─ Gather initial metrics

3. RESPOND
   ├─ Page on-call engineer
   ├─ Open incident channel
   ├─ Collect logs and traces
   └─ Implement mitigation

4. RESOLVE
   ├─ Fix root cause
   ├─ Verify resolution
   ├─ Communicate status
   └─ Close incident

5. RETROSPECT
   ├─ Post-mortem meeting
   ├─ Document findings
   ├─ Create action items
   └─ Update runbooks
```

### 10.3 Runbooks

**Location:** `docs/runbooks/`

**Runbooks for:**
- Database connection failures
- API rate limiting
- Message queue backlog
- Memory leaks
- Cross-tenant data leaks
- Authentication failures
- Payment processing failures

**Example Runbook:**
```markdown
# Runbook: Database Connection Failures

## Symptoms
- API returns 500 errors
- Logs show "Connection timeout"
- Metrics show high latency

## Diagnosis
1. Check DynamoDB status in AWS console
2. Check connection pool metrics
3. Check network connectivity
4. Check IAM permissions

## Mitigation
1. Increase connection pool size
2. Restart service
3. Failover to replica

## Resolution
1. Identify root cause
2. Fix configuration
3. Monitor for recurrence
4. Update documentation
```

### 10.4 Alert Configuration

**Location:** `infra/monitoring/alerts.yaml`

**Alert Rules:**
- Error rate > 1%
- p99 latency > 2000ms
- Database connection pool > 80%
- Message queue depth > 10,000
- Disk usage > 80%
- Memory usage > 85%
- Cross-tenant data access attempts
- Failed authentication > 10/min

---

## 11. Implementation Approach

### Phase 1: Foundation (Weeks 1-4)

**Deliverables:**
- Jest configuration for backend unit tests
- Vitest configuration for frontend unit tests
- Basic test structure and fixtures
- 20% unit test coverage

**Tasks:**
1. Set up Jest with TypeScript support
2. Create test fixtures and factories
3. Write 50 unit tests for core services
4. Configure coverage reporting
5. Set up pre-commit hooks for tests

**Effort:** 80 hours

### Phase 2: Integration Testing (Weeks 5-8)

**Deliverables:**
- Supertest integration tests
- Database integration tests
- API contract tests
- 50% integration test coverage

**Tasks:**
1. Set up Supertest with test database
2. Write 100 integration tests for API routes
3. Create database seeding utilities
4. Set up test data factories
5. Configure CI/CD integration

**Effort:** 120 hours

### Phase 3: Agent & Message Testing (Weeks 9-12)

**Deliverables:**
- Agent testing framework
- AI Employee agent tests
- Message handling tests
- Tool invocation tests
- 80% agent behavior coverage

**Tasks:**
1. Design agent testing framework
2. Write 50 agent behavior tests
3. Create message handling test suite
4. Implement tool invocation tests
5. Set up agent mocking utilities

**Effort:** 160 hours

### Phase 4: Multi-Tenant & Security Testing (Weeks 13-16)

**Deliverables:**
- Multi-tenant isolation tests
- Security penetration tests
- Cross-tenant data leak tests
- 100% security test coverage

**Tasks:**
1. Write 30 multi-tenant tests
2. Create security test suite
3. Implement penetration tests
4. Set up automated security scanning
5. Document security test procedures

**Effort:** 100 hours

### Phase 5: Performance & Load Testing (Weeks 17-20)

**Deliverables:**
- k6 load tests
- Performance baseline tests
- Stress testing suite
- Performance monitoring dashboard

**Tasks:**
1. Set up k6 and Artillery
2. Write load test scenarios
3. Create performance baselines
4. Set up performance monitoring
5. Document performance procedures

**Effort:** 120 hours

### Phase 6: Observability & Monitoring (Weeks 21-24)

**Deliverables:**
- OpenTelemetry integration
- Structured logging
- Metrics collection
- Dashboards and alerts
- Incident response procedures

**Tasks:**
1. Integrate OpenTelemetry
2. Set up structured logging
3. Configure Prometheus metrics
4. Create Grafana dashboards
5. Set up PagerDuty alerts
6. Document incident procedures

**Effort:** 140 hours

### Phase 7: Debugging Tools & Documentation (Weeks 25-26)

**Deliverables:**
- Debug CLI tool
- Test data management scripts
- Runbooks and procedures
- Comprehensive documentation

**Tasks:**
1. Build debug CLI tool
2. Create test data utilities
3. Write runbooks
4. Document all testing procedures
5. Create training materials

**Effort:** 80 hours

---

## 12. Effort Estimation

### Total Effort: 800 hours (20 weeks, 1 FTE)

**Breakdown by Phase:**
| Phase | Duration | Effort | FTE |
|-------|----------|--------|-----|
| 1. Foundation | 4 weeks | 80 hours | 0.5 |
| 2. Integration | 4 weeks | 120 hours | 0.75 |
| 3. Agent & Message | 4 weeks | 160 hours | 1.0 |
| 4. Multi-Tenant & Security | 4 weeks | 100 hours | 0.625 |
| 5. Performance & Load | 4 weeks | 120 hours | 0.75 |
| 6. Observability | 4 weeks | 140 hours | 0.875 |
| 7. Debugging & Docs | 2 weeks | 80 hours | 1.0 |
| **Total** | **26 weeks** | **800 hours** | **0.77 FTE** |

### Resource Requirements

**Team:**
- 1 Senior QA Engineer (lead)
- 1 Backend Engineer (integration & agent tests)
- 1 Frontend Engineer (UI tests)
- 1 DevOps Engineer (infrastructure & monitoring)

**Tools & Services:**
- Jest, Vitest, Playwright (open source)
- k6, Artillery (open source)
- OpenTelemetry, Jaeger (open source)
- Datadog or New Relic (SaaS, ~$500/month)
- PagerDuty (SaaS, ~$200/month)

---

## 13. Success Metrics

### Testing Metrics

- Unit test coverage: 80%+
- Integration test coverage: 95%+
- E2E test coverage: 70%+
- Agent behavior test coverage: 85%+
- Security test coverage: 100%
- Test execution time: < 10 minutes (CI)
- Test flakiness: < 1%

### Quality Metrics

- Bug escape rate: < 5%
- Critical bugs in production: 0
- Security vulnerabilities: 0
- Cross-tenant data leaks: 0
- Mean time to detection (MTTD): < 5 minutes
- Mean time to resolution (MTTR): < 30 minutes

### Performance Metrics

- p95 API latency: < 500ms
- p99 API latency: < 1000ms
- Error rate: < 0.1%
- Availability: 99.9%+
- Database query time: < 100ms (p95)

---

## 14. Next Steps

1. **Week 1:** Review and approve this strategy
2. **Week 2:** Set up Jest and Vitest configurations
3. **Week 3:** Create test fixtures and factories
4. **Week 4:** Begin writing unit tests
5. **Ongoing:** Weekly progress reviews and adjustments

---

## Appendix A: Test Configuration Files

### Jest Configuration (Backend)

```javascript
// server/jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/local-server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Vitest Configuration (Frontend)

```typescript
// real-estate-crm-app/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Playwright Configuration (E2E)

Already configured in `tests/playwright/playwright.config.ts`

---

## Appendix B: CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      dynamodb:
        image: amazon/dynamodb-local
        ports:
          - 8000:8000

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Integration tests
        run: npm run test:integration
        env:
          DYNAMODB_ENDPOINT: http://localhost:8000
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Appendix C: Monitoring Dashboard Queries

### Grafana Queries

**Request Rate:**
```promql
rate(http_requests_total[5m])
```

**Error Rate:**
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

**Latency (p95):**
```promql
histogram_quantile(0.95, http_request_duration_seconds_bucket)
```

**Database Connections:**
```promql
db_connections_active
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024 | QA Lead | Initial comprehensive strategy |

---

**End of Document**
