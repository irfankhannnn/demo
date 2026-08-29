# RealtyFlow: Observability & Monitoring Implementation Guide

**Version:** 1.0  
**Focus:** Distributed Tracing, Metrics, Logging, and Alerting  
**Target:** Production-ready observability stack

---

## 1. Distributed Tracing with OpenTelemetry

### 1.1 OpenTelemetry Setup

**File:** `server/src/instrumentation/tracing.ts`

```typescript
import { NodeTracerProvider } from '@opentelemetry/node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { CompositePropagator } from '@opentelemetry/core';
import { JaegerPropagator } from '@opentelemetry/jaeger-propagator';

// Initialize Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

// Create tracer provider
const tracerProvider = new NodeTracerProvider();

// Add auto-instrumentation
tracerProvider.addInstrumentation(getNodeAutoInstrumentations());

// Add span processor
tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));

// Set up propagation
const propagator = new CompositePropagator({
  propagators: [
    new W3CTraceContextPropagator(),
    new JaegerPropagator(),
  ],
});

// Register tracer provider
tracerProvider.register({
  propagator,
});

// Create meter provider
const metricReader = new PeriodicExportingMetricReader({
  exporter: jaegerExporter,
});

const meterProvider = new MeterProvider({
  readers: [metricReader],
});

export { tracerProvider, meterProvider };
```

### 1.2 Trace Context Propagation

**File:** `server/src/instrumentation/trace-context.ts`

```typescript
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export interface TraceContext {
  traceId: string;
  spanId: string;
  tenantId: string;
  userId: string;
  requestId: string;
}

// Middleware to extract/create trace context
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const tracer = trace.getTracer('realtyflow-backend');
  const span = tracer.startSpan(`${req.method} ${req.path}`);

  // Extract context from request
  const traceId = req.headers['x-trace-id'] as string || uuidv4();
  const spanId = req.headers['x-span-id'] as string || uuidv4();
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Get tenant and user from JWT
  const tenantId = (req.user as any)?.tenantId || 'unknown';
  const userId = (req.user as any)?.userId || 'unknown';

  // Create trace context
  const traceContext: TraceContext = {
    traceId,
    spanId,
    tenantId,
    userId,
    requestId,
  };

  // Add attributes to span
  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'http.target': req.path,
    'http.host': req.hostname,
    'http.scheme': req.protocol,
    'trace.id': traceId,
    'request.id': requestId,
    'tenant.id': tenantId,
    'user.id': userId,
  });

  // Store context for use in handlers
  context.with(trace.setSpan(context.active(), span), () => {
    // Store in request for access in handlers
    (req as any).traceContext = traceContext;

    // Add to response headers
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-request-id', requestId);

    // Call next middleware
    next();
  });

  // Handle response
  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response_content_length': res.get('content-length'),
    });

    if (res.statusCode >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  });
}

// Helper to get current trace context
export function getTraceContext(): TraceContext {
  const span = trace.getActiveSpan();
  const attributes = span?.attributes || {};

  return {
    traceId: attributes['trace.id'] as string,
    spanId: attributes['span.id'] as string,
    tenantId: attributes['tenant.id'] as string,
    userId: attributes['user.id'] as string,
    requestId: attributes['request.id'] as string,
  };
}
```

---

## 2. Structured Logging

### 2.1 Logger Setup

**File:** `server/src/instrumentation/logger.ts`

```typescript
import winston from 'winston';
import { getTraceContext } from './trace-context';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const traceContext = getTraceContext();

    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      trace: {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
      },
      tenant: {
        tenantId: traceContext.tenantId,
      },
      user: {
        userId: traceContext.userId,
      },
      request: {
        requestId: traceContext.requestId,
      },
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'realtyflow-backend',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File transports
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Business events
    new winston.transports.File({
      filename: 'logs/business-events.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

// Log levels
export const logLevels = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'silly',
};

// Business event logging
export function logBusinessEvent(
  event: string,
  data: Record<string, any>,
  level: string = 'info'
) {
  logger.log(level, event, {
    eventType: 'business',
    eventName: event,
    ...data,
  });
}

// Error logging
export function logError(
  error: Error,
  context: Record<string, any> = {}
) {
  logger.error('Error occurred', {
    errorType: error.constructor.name,
    errorMessage: error.message,
    errorStack: error.stack,
    ...context,
  });
}

// Performance logging
export function logPerformance(
  operation: string,
  duration: number,
  metadata: Record<string, any> = {}
) {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger.log(level, `Performance: ${operation}`, {
    operation,
    duration,
    durationMs: duration,
    ...metadata,
  });
}

export default logger;
```

### 2.2 Logger Middleware

**File:** `server/src/middleware/logging.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '../instrumentation/logger';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB

    // Log response
    logger.info('Outgoing response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      durationMs: duration,
      memoryDelta,
      contentLength: Buffer.byteLength(data),
    });

    return originalSend.call(this, data);
  };

  next();
}
```

---

## 3. Metrics Collection

### 3.1 Prometheus Metrics

**File:** `server/src/instrumentation/metrics.ts`

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const activeConnections = new Gauge({
  name: 'db_active_connections',
  help: 'Number of active database connections',
});

export const connectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Size of database connection pool',
});

// Business metrics
export const buyersCreated = new Counter({
  name: 'buyers_created_total',
  help: 'Total number of buyers created',
  labelNames: ['tenant_id'],
});

export const leadsCreated = new Counter({
  name: 'leads_created_total',
  help: 'Total number of leads created',
  labelNames: ['tenant_id', 'status'],
});

export const leadConversionRate = new Gauge({
  name: 'lead_conversion_rate',
  help: 'Lead conversion rate',
  labelNames: ['tenant_id'],
});

// Subscription metrics
export const seatCapExceeded = new Counter({
  name: 'seat_cap_exceeded_total',
  help: 'Total times seat cap was exceeded',
  labelNames: ['tenant_id', 'plan'],
});

export const trialExpired = new Counter({
  name: 'trial_expired_total',
  help: 'Total number of expired trials',
  labelNames: ['tenant_id'],
});

// Error metrics
export const errorTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
});

export const crossTenantAccessAttempts = new Counter({
  name: 'cross_tenant_access_attempts_total',
  help: 'Total cross-tenant access attempts',
  labelNames: ['tenant_id'],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_name'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_name'],
});

// Message metrics
export const messagesQueued = new Counter({
  name: 'messages_queued_total',
  help: 'Total messages queued',
  labelNames: ['message_type', 'tenant_id'],
});

export const messagesSent = new Counter({
  name: 'messages_sent_total',
  help: 'Total messages sent',
  labelNames: ['message_type', 'status'],
});

export const messageQueueDepth = new Gauge({
  name: 'message_queue_depth',
  help: 'Current message queue depth',
  labelNames: ['message_type'],
});

// Metrics endpoint
export function metricsHandler(req: any, res: any) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}
```

### 3.2 Metrics Middleware

**File:** `server/src/middleware/metrics.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
} from '../instrumentation/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestSize = parseInt(req.get('content-length') || '0', 10);

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = (Date.now() - startTime) / 1000;
    const responseSize = Buffer.byteLength(data);

    // Record metrics
    const route = req.route?.path || req.path;
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestSize.observe(
      { method: req.method, route },
      requestSize
    );

    httpResponseSize.observe(
      { method: req.method, route, status_code: res.statusCode },
      responseSize
    );

    return originalSend.call(this, data);
  };

  next();
}
```

---

## 4. Alerting Rules

### 4.1 Prometheus Alert Rules

**File:** `infra/monitoring/prometheus-rules.yaml`

```yaml
groups:
  - name: realtyflow_alerts
    interval: 30s
    rules:
      # HTTP Errors
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "p95 latency is {{ $value }}s"

      # Database
      - alert: DatabaseConnectionPoolExhausted
        expr: db_active_connections / db_connection_pool_size > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections in use"

      # Cross-tenant access
      - alert: CrossTenantAccessAttempt
        expr: rate(cross_tenant_access_attempts_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Cross-tenant access attempt detected"
          description: "Possible security breach"

      # Seat cap
      - alert: SeatCapExceeded
        expr: rate(seat_cap_exceeded_total[5m]) > 0
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "Seat cap exceeded"
          description: "Tenant {{ $labels.tenant_id }} exceeded seat limit"

      # Message queue
      - alert: MessageQueueBacklog
        expr: message_queue_depth > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Message queue backlog detected"
          description: "Queue depth is {{ $value }} messages"

      # Memory
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}GB"
```

---

## 5. Grafana Dashboards

### 5.1 Dashboard JSON

**File:** `infra/monitoring/dashboards/realtyflow-overview.json`

```json
{
  "dashboard": {
    "title": "RealtyFlow Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "API Latency (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Queries",
        "targets": [
          {
            "expr": "rate(db_queries_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "db_active_connections"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Buyers Created (24h)",
        "targets": [
          {
            "expr": "increase(buyers_created_total[24h])"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Leads Created (24h)",
        "targets": [
          {
            "expr": "increase(leads_created_total[24h])"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Message Queue Depth",
        "targets": [
          {
            "expr": "message_queue_depth"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## 6. Error Tracking with Sentry

### 6.1 Sentry Integration

**File:** `server/src/instrumentation/sentry.ts`

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Profiling
  profilesSampleRate: 0.1,
  
  // Integrations
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({
      request: true,
      serverName: true,
      transaction: true,
    }),
    new ProfilingIntegration(),
  ],
  
  // Ignore certain errors
  ignoreErrors: [
    'NetworkError',
    'TimeoutError',
  ],
  
  // Before send hook
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
    }
    
    return event;
  },
});

// Capture exceptions with context
export function captureException(
  error: Error,
  context: Record<string, any> = {}
) {
  Sentry.captureException(error, {
    tags: {
      tenantId: context.tenantId,
      userId: context.userId,
      operation: context.operation,
    },
    extra: context,
  });
}

// Capture messages
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context: Record<string, any> = {}
) {
  Sentry.captureMessage(message, level);
}
```

---

## 7. Health Checks

### 7.1 Health Check Endpoint

**File:** `server/src/routes/health.ts`

```typescript
import { Router } from 'express';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const router = Router();
const dynamoClient = new DynamoDBClient({});

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; latency: number };
    cache: { status: string; latency: number };
    memory: { status: string; usage: number };
  };
}

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', latency: 0 },
      cache: { status: 'unknown', latency: 0 },
      memory: { status: 'unknown', usage: 0 },
    },
  };

  // Check database
  try {
    const dbStart = Date.now();
    await dynamoClient.send(
      new DescribeTableCommand({ TableName: 'RealtyFlowCRM' })
    );
    health.checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = { status: 'unhealthy', latency: 0 };
    health.status = 'unhealthy';
  }

  // Check memory
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = {
    status: memPercent > 90 ? 'degraded' : 'healthy',
    usage: memPercent,
  };

  if (memPercent > 90) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (req, res) => {
  // Readiness check - can accept traffic?
  const health = await getHealthStatus();
  const isReady = health.status !== 'unhealthy';
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});

export default router;
```

---

## 8. Monitoring Dashboard Setup

### 8.1 Docker Compose for Monitoring Stack

**File:** `infra/monitoring/docker-compose.yml`

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus-rules.yaml:/etc/prometheus/rules.yaml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./dashboards:/etc/grafana/provisioning/dashboards
      - ./datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "6831:6831/udp"
      - "16686:16686"
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
```

---

## 9. Running Monitoring Stack

### 9.1 Local Development

```bash
# Start monitoring stack
cd infra/monitoring
docker-compose up -d

# Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
# Jaeger: http://localhost:16686
# AlertManager: http://localhost:9093
```

### 9.2 Production Deployment

```bash
# Deploy with Kubernetes
kubectl apply -f infra/monitoring/k8s/

# Or with Docker Swarm
docker stack deploy -c infra/monitoring/docker-compose.yml monitoring
```

---

## 10. Incident Response Dashboard

### 10.1 On-Call Dashboard

Create a Grafana dashboard with:
- Real-time error rate
- API latency trends
- Database performance
- Message queue depth
- Active user sessions
- Recent errors (Sentry)
- Alert status

---

**End of Document**
