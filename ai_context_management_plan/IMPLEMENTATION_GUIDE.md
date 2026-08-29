# RealtyFlow Microservices Implementation Guide

**Version:** 1.0  
**Status:** Ready for Implementation  
**Last Updated:** 2026

---

## Quick Start

This guide provides step-by-step instructions for implementing the architectural improvements outlined in `ARCHITECTURE_DESIGN.md`.

---

## Phase 1: Foundation Setup (Weeks 1-4)

### Step 1.1: Create Shared Libraries

```bash
# Create shared directory structure
mkdir -p services/shared/{auth,events,observability,errors,validation,types}

# Initialize shared package
cd services/shared
npm init -y
npm install \
  @aws-sdk/client-dynamodb \
  @aws-sdk/lib-dynamodb \
  @aws-sdk/client-eventbridge \
  @aws-sdk/client-cloudwatch \
  jsonwebtoken \
  zod \
  pino \
  pino-pretty \
  aws-xray-sdk-core
```

### Step 1.2: Implement Shared Auth Module

**File:** `services/shared/auth/tokenValidator.ts`

```typescript
import jwt from 'jsonwebtoken';
import { CognitoIdentityServiceProvider } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION || 'ap-south-1',
});

interface DecodedToken {
  sub: string;
  email: string;
  'custom:tenantId': string;
  iat: number;
  exp: number;
}

export async function validateToken(token: string): Promise<DecodedToken> {
  try {
    // Verify JWT signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as DecodedToken;
    
    // Validate token hasn't expired
    if (decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Invalid token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function extractTenantId(token: string): string {
  const decoded = jwt.decode(token) as DecodedToken;
  return decoded['custom:tenantId'];
}

export function extractUserId(token: string): string {
  const decoded = jwt.decode(token) as DecodedToken;
  return decoded.sub;
}
```

### Step 1.3: Implement Shared Observability Module

**File:** `services/shared/observability/logger.ts`

```typescript
import pino from 'pino';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' 
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

export const logger = {
  info: (event: string, data?: Record<string, any>) => {
    pinoLogger.info({ event, ...data });
  },
  error: (event: string, error?: Error | string, data?: Record<string, any>) => {
    pinoLogger.error({
      event,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      ...data,
    });
  },
  warn: (event: string, data?: Record<string, any>) => {
    pinoLogger.warn({ event, ...data });
  },
  debug: (event: string, data?: Record<string, any>) => {
    pinoLogger.debug({ event, ...data });
  },
};
```

### Step 1.4: Implement Shared Error Handling

**File:** `services/shared/errors/AppError.ts`

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', `${resource} with id ${id} not found`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(409, 'CONFLICT', message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', details?: Record<string, any>) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}
```

### Step 1.5: Create Service Template

```bash
# Create template for new services
mkdir -p services/crm-service/{src/{routes,controllers,models,middleware,schemas,types,utils},infra,tests/{unit,integration,e2e}}

# Copy package.json template
cat > services/crm-service/package.json << 'EOF'
{
  "name": "crm-service",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "node --watch dist/local-server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "deploy": "bash infra/deploy.sh"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.669.0",
    "@aws-sdk/lib-dynamodb": "^3.669.0",
    "@vendia/serverless-express": "^4.12.6",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
EOF
```

### Step 1.6: Setup Deployment Automation

**File:** `infra/deploy.sh`

```bash
#!/bin/bash
set -euo pipefail

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="realtyflow-${ENVIRONMENT}"

echo "🚀 Deploying RealtyFlow to ${ENVIRONMENT} (${REGION})"

# Validate templates
echo "📋 Validating CloudFormation templates..."
for template in infra/nested/*.yaml infra/nested/services/*.yaml; do
  if [ -f "$template" ]; then
    aws cloudformation validate-template \
      --template-body "file://${template}" \
      --region "${REGION}" > /dev/null
    echo "  ✓ ${template}"
  fi
done

# Deploy main stack
echo "🔨 Deploying main stack..."
aws cloudformation deploy \
  --template-file infra/main-stack.yaml \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides \
    EnvironmentName="${ENVIRONMENT}" \
    LambdaCodeS3Bucket="${LAMBDA_CODE_BUCKET}" \
    PublicApiDomainName="${PUBLIC_API_DOMAIN}" \
    CrmApiDomainName="${CRM_API_DOMAIN}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --no-fail-on-empty-changeset

echo "✅ Deployment complete!"

# Get outputs
echo ""
echo "📊 Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
```

---

## Phase 2: CRM Service Migration (Weeks 5-12)

### Step 2.1: Create CRM Service Structure

```bash
cd services/crm-service

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF
```

### Step 2.2: Implement CRM Models

**File:** `services/crm-service/src/models/customerModel.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/observability/logger';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME || 'crm-core-prod';

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export async function createCustomer(
  tenantId: string,
  data: Omit<Customer, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<Customer> {
  const customerId = uuidv4();
  const now = new Date().toISOString();

  const customer: Customer = {
    id: customerId,
    tenantId,
    ...data,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const pk = `TENANT#${tenantId}#ENTITY#CUSTOMER#${customerId}`;
  const sk = 'PROFILE';

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: pk,
          SK: sk,
          ...customer,
          GSI1PK: `TENANT#${tenantId}#STATUS#active`,
          GSI1SK: now,
          GSI2PK: `TENANT#${tenantId}#TYPE#CUSTOMER`,
          GSI2SK: now,
        },
      })
    );

    logger.info('customer.created', { customerId, tenantId });
    return customer;
  } catch (error) {
    logger.error('customer.creation_failed', error as Error, { tenantId });
    throw error;
  }
}

export async function getCustomer(tenantId: string, customerId: string): Promise<Customer | null> {
  const pk = `TENANT#${tenantId}#ENTITY#CUSTOMER#${customerId}`;
  const sk = 'PROFILE';

  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
      })
    );

    return (response.Item as Customer) || null;
  } catch (error) {
    logger.error('customer.get_failed', error as Error, { tenantId, customerId });
    throw error;
  }
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  data: Partial<Omit<Customer, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>
): Promise<Customer> {
  const pk = `TENANT#${tenantId}#ENTITY#CUSTOMER#${customerId}`;
  const sk = 'PROFILE';
  const now = new Date().toISOString();

  try {
    const response = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #data = :data, updatedAt = :now',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':data': data,
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    logger.info('customer.updated', { customerId, tenantId });
    return response.Attributes as Customer;
  } catch (error) {
    logger.error('customer.update_failed', error as Error, { tenantId, customerId });
    throw error;
  }
}

export async function listCustomers(
  tenantId: string,
  status: string = 'active',
  limit: number = 50
): Promise<Customer[]> {
  const gsi1pk = `TENANT#${tenantId}#STATUS#${status}`;

  try {
    const response = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'tenant-status-index',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': gsi1pk,
        },
        Limit: limit,
        ScanIndexForward: false, // Newest first
      })
    );

    return (response.Items as Customer[]) || [];
  } catch (error) {
    logger.error('customer.list_failed', error as Error, { tenantId });
    throw error;
  }
}
```

### Step 2.3: Implement CRM Controllers

**File:** `services/crm-service/src/controllers/customerController.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import * as customerModel from '../models/customerModel';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError';
import { logger } from '../../../shared/observability/logger';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer';

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    // Validate request body
    const validatedData = createCustomerSchema.parse(req.body);

    // Create customer
    const customer = await customerModel.createCustomer(tenantId, validatedData);

    logger.info('customer.create_endpoint', { customerId: customer.id, tenantId });
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const customer = await customerModel.getCustomer(tenantId, id);
    if (!customer) {
      throw new NotFoundError('Customer', id);
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    // Validate request body
    const validatedData = updateCustomerSchema.parse(req.body);

    // Update customer
    const customer = await customerModel.updateCustomer(tenantId, id, validatedData);

    logger.info('customer.update_endpoint', { customerId: id, tenantId });
    res.json(customer);
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user?.tenantId;
    const { status = 'active', limit = '50' } = req.query;

    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const customers = await customerModel.listCustomers(tenantId, String(status), parseInt(String(limit)));

    res.json({
      data: customers,
      count: customers.length,
    });
  } catch (error) {
    next(error);
  }
}
```

### Step 2.4: Implement CRM Routes

**File:** `services/crm-service/src/routes/customers.ts`

```typescript
import { Router } from 'express';
import * as customerController from '../controllers/customerController';

const router = Router();

router.post('/', customerController.createCustomer);
router.get('/', customerController.listCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);

export default router;
```

### Step 2.5: Create Express App

**File:** `services/crm-service/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { validateToken } from '../../../shared/auth/tokenValidator';
import { errorHandler } from '../../../shared/errors/errorHandler';
import { logger } from '../../../shared/observability/logger';
import customerRoutes from './routes/customers';

export const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info('request.received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'crm-service' });
});

// Token validation middleware
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = validateToken(token);
    req.user = { tenantId: decoded['custom:tenantId'], userId: decoded.sub };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Routes
app.use('/api/crm/customers', customerRoutes);

// Error handling
app.use(errorHandler);

export default app;
```

### Step 2.6: Create Lambda Handler

**File:** `services/crm-service/src/index.ts`

```typescript
import serverlessExpress from '@vendia/serverless-express';
import { app } from './app';
import { logger } from '../../../shared/observability/logger';

let cachedServer: any;

export const handler = async (event: any, context: any) => {
  logger.info('lambda.invoked', {
    requestId: context.awsRequestId,
    path: event.path,
    method: event.httpMethod,
  });

  try {
    if (!cachedServer) {
      cachedServer = serverlessExpress({ app });
    }

    const response = await cachedServer(event, context);

    logger.info('lambda.completed', {
      requestId: context.awsRequestId,
      statusCode: response.statusCode,
    });

    return response;
  } catch (error) {
    logger.error('lambda.error', error as Error, {
      requestId: context.awsRequestId,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        requestId: context.awsRequestId,
      }),
    };
  }
};
```

### Step 2.7: Create Local Server

**File:** `services/crm-service/src/local-server.ts`

```typescript
import 'dotenv/config';
import { app } from './app';
import { logger } from '../../../shared/observability/logger';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info('server.started', {
    port: PORT,
    environment: process.env.NODE_ENV,
    service: 'crm-service',
  });

  console.log(`\n🚀 CRM Service running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});
```

### Step 2.8: Create Validation Schemas

**File:** `services/crm-service/src/schemas/customer.ts`

```typescript
import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  email: z.string().email(),
  address: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
```

### Step 2.9: Create Unit Tests

**File:** `services/crm-service/tests/unit/customerModel.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as customerModel from '../../src/models/customerModel';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock DynamoDB
jest.mock('@aws-sdk/lib-dynamodb');

describe('CustomerModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create a customer with valid data', async () => {
      const tenantId = 'tenant-123';
      const data = {
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        createdBy: 'user-123',
      };

      const customer = await customerModel.createCustomer(tenantId, data);

      expect(customer).toHaveProperty('id');
      expect(customer.tenantId).toBe(tenantId);
      expect(customer.name).toBe('John Doe');
      expect(customer.status).toBe('active');
    });
  });

  describe('getCustomer', () => {
    it('should retrieve a customer by ID', async () => {
      const tenantId = 'tenant-123';
      const customerId = 'customer-123';

      const customer = await customerModel.getCustomer(tenantId, customerId);

      expect(customer).toBeDefined();
      expect(customer?.id).toBe(customerId);
    });

    it('should return null for non-existent customer', async () => {
      const tenantId = 'tenant-123';
      const customerId = 'non-existent';

      const customer = await customerModel.getCustomer(tenantId, customerId);

      expect(customer).toBeNull();
    });
  });
});
```

---

## Phase 3: Billing Service Migration (Weeks 13-18)

Follow the same pattern as Phase 2, but for billing entities:
- Subscriptions
- Invoices
- Payments
- Credit Ledger

**Key Files:**
- `services/billing-service/src/models/subscriptionModel.ts`
- `services/billing-service/src/controllers/subscriptionController.ts`
- `services/billing-service/src/routes/subscriptions.ts`
- `services/billing-service/tests/integration/billing-api.test.ts`

---

## Phase 4: Notifications & Admin Services (Weeks 19-22)

### Step 4.1: Implement EventBridge Integration

**File:** `services/shared/events/eventBus.ts`

```typescript
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../observability/logger';

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

export async function publishEvent(
  source: string,
  detailType: string,
  detail: Record<string, any>
) {
  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: source,
            DetailType: detailType,
            Detail: JSON.stringify(detail),
            EventBusName: 'default',
          },
        ],
      })
    );

    logger.info('event.published', { source, detailType });
  } catch (error) {
    logger.error('event.publish_failed', error as Error, { source, detailType });
    throw error;
  }
}
```

### Step 4.2: Publish Events from CRM Service

**File:** `services/crm-service/src/models/customerModel.ts` (updated)

```typescript
import { publishEvent } from '../../../shared/events/eventBus';

export async function createCustomer(
  tenantId: string,
  data: Omit<Customer, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<Customer> {
  // ... existing code ...

  // Publish event
  await publishEvent('crm-service', 'Customer Created', {
    customerId: customer.id,
    tenantId,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    createdAt: customer.createdAt,
    createdBy: customer.createdBy,
  });

  return customer;
}
```

---

## Phase 5: Cleanup & Optimization (Weeks 23-26)

### Step 5.1: Performance Testing

```bash
# Install k6 for load testing
npm install -g k6

# Create load test script
cat > tests/load/crm-api.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m30s', target: 100 },
    { duration: '20s', target: 0 },
  ],
};

export default function () {
  const url = 'https://api.example.com/api/crm/customers';
  const payload = JSON.stringify({
    name: 'Test Customer',
    phone: '+919876543210',
    email: 'test@example.com',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  };

  const response = http.post(url, payload, params);

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF

# Run load test
k6 run tests/load/crm-api.js --vus 10 --duration 30s
```

### Step 5.2: Query Optimization

```typescript
// Before: Full table scan
const response = await docClient.send(
  new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'tenantId = :tenantId AND #status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
      ':status': 'active',
    },
  })
);

// After: GSI query
const response = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'tenant-status-index',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#STATUS#active`,
    },
  })
);
```

---

## Monitoring & Alerting

### CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name RealtyFlow-Services \
  --dashboard-body file://infra/dashboards/services.json
```

**File:** `infra/dashboards/services.json`

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", {"stat": "Average"}],
          ["AWS/Lambda", "Errors", {"stat": "Sum"}],
          ["AWS/Lambda", "Throttles", {"stat": "Sum"}],
          ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", {"stat": "Sum"}],
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-south-1",
        "title": "Service Health"
      }
    }
  ]
}
```

### CloudWatch Alarms

```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name crm-service-errors \
  --alarm-description "Alert when CRM service has errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

---

## Rollback Procedures

### Automated Rollback

```bash
# Rollback to previous CloudFormation stack
aws cloudformation cancel-update-stack \
  --stack-name realtyflow-prod

# Or update to previous template
aws cloudformation update-stack \
  --stack-name realtyflow-prod \
  --template-body file://infra/main-stack.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=prod
```

### Data Rollback

```bash
# Restore from DynamoDB backup
aws dynamodb restore-table-from-backup \
  --target-table-name crm-core-prod-restored \
  --backup-arn arn:aws:dynamodb:ap-south-1:123456789:table/crm-core-prod/backup/01234567890123-abcdef01
```

---

## Troubleshooting

### Lambda Cold Starts

```bash
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=crm-service \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum
```

### DynamoDB Throttling

```bash
# Check consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=crm-core-prod \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-02T00:00:00Z \
  --period 300 \
  --statistics Sum
```

---

## Checklist for Each Phase

### Pre-Deployment
- [ ] Code review completed
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Load tests completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Runbooks prepared

### Deployment
- [ ] Backup created
- [ ] Monitoring enabled
- [ ] Alarms configured
- [ ] Team notified
- [ ] Rollback plan ready

### Post-Deployment
- [ ] Health checks passing
- [ ] Error rate normal
- [ ] Performance metrics acceptable
- [ ] User feedback collected
- [ ] Incident log updated

---

## Support & Resources

- **Architecture Design:** See `ARCHITECTURE_DESIGN.md`
- **API Documentation:** See `SERVICE_CONTRACTS.md`
- **Runbooks:** See `RUNBOOKS.md`
- **Troubleshooting:** See `TROUBLESHOOTING.md`

