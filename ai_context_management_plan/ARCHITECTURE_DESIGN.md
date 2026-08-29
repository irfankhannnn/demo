# RealtyFlow Architecture Improvement Design Document

**Version:** 1.0  
**Date:** 2026  
**Status:** Design Phase  
**Audience:** Engineering Team, DevOps, Product Leadership

---

## Executive Summary

This document outlines a comprehensive architectural and infrastructure improvement strategy for RealtyFlow, a multi-tenant real estate CRM platform. The current monolithic backend is being decomposed into domain-driven microservices with clear service boundaries, improved CloudFormation infrastructure-as-code, optimized DynamoDB schemas, and enhanced deployment automation.

**Key Outcomes:**
- Reduced Lambda cold starts and response times (5-10s → 1-2s)
- Improved scalability and independent service deployment
- Better operational observability and debugging
- Clearer service contracts and API boundaries
- Reduced blast radius of failures
- Faster feature development cycles

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Vision](#architecture-vision)
3. [Microservice Decomposition Strategy](#microservice-decomposition-strategy)
4. [Service Boundaries & Contracts](#service-boundaries--contracts)
5. [CloudFormation Improvements](#cloudformation-improvements)
6. [DynamoDB Schema Optimization](#dynamodb-schema-optimization)
7. [Lambda Function Organization](#lambda-function-organization)
8. [API Gateway Routing](#api-gateway-routing)
9. [Deployment Automation](#deployment-automation)
10. [Monitoring & Observability](#monitoring--observability)
11. [Backward Compatibility Strategy](#backward-compatibility-strategy)
12. [Scalability Improvements](#scalability-improvements)
13. [Implementation Phases](#implementation-phases)
14. [Testing Strategy](#testing-strategy)
15. [Risk Assessment](#risk-assessment)
16. [Effort Estimation](#effort-estimation)

---

## Current State Analysis

### Existing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│              real-estate-crm-app, onboarding-page            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (Public + CRM)                 │
│         /api/crm/*, /api/billing/*, /api/webhooks/*         │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌──────────┐
   │ Lambda  │      │ Lambda  │      │ Lambda   │
   │ (Main)  │      │ (Cron)  │      │ (AI Call)│
   └────┬────┘      └────┬────┘      └────┬─────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌──────────┐
   │DynamoDB │      │   S3    │      │Secrets   │
   │ (Multi) │      │(Docs)   │      │Manager   │
   └─────────┘      └─────────┘      └──────────┘
```

### Current Issues

| Issue | Impact | Priority |
|-------|--------|----------|
| **Monolithic Lambda** | 512MB+ package, slow cold starts (5-10s) | HIGH |
| **Single DynamoDB Table** | Inefficient queries, full table scans, high costs | HIGH |
| **No Service Boundaries** | Tight coupling, difficult to test, hard to scale | HIGH |
| **Implicit API Contracts** | Breaking changes, version management issues | MEDIUM |
| **Manual Deployment** | Error-prone, inconsistent environments | MEDIUM |
| **Limited Observability** | Difficult to debug cross-service issues | MEDIUM |
| **No Rate Limiting per Service** | One service's spike affects all | MEDIUM |
| **Shared IAM Permissions** | Over-privileged Lambda role | MEDIUM |
| **No Service-to-Service Auth** | Internal APIs lack authentication | LOW |

### Current Technology Stack

- **Runtime:** Node.js 20.x (ES Modules)
- **Framework:** Express.js
- **Database:** DynamoDB (single table, multi-tenant)
- **Storage:** S3 (documents, recordings)
- **Auth:** JWT + Cognito (external service)
- **Deployment:** CloudFormation + Lambda + API Gateway
- **Monitoring:** CloudWatch Logs, Sentry, PostHog
- **Secrets:** AWS Secrets Manager

---

## Architecture Vision

### Target State (Phase 3)

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend Layer                                 │
│         React App (CRM) + Onboarding + Public Site               │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              API Gateway (Unified Entry Point)                    │
│  - Route-based service discovery                                  │
│  - Request/Response logging & tracing                             │
│  - Rate limiting per service                                      │
│  - CORS & security headers                                        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   ┌─────────────┐        ┌──────────────┐      ┌──────────────┐
   │  CRM Core   │        │  Billing &   │      │  AI Calling  │
   │  Service    │        │  Credits     │      │  Service     │
   │             │        │  Service     │      │              │
   │ - Customers │        │              │      │ - Call Mgmt  │
   │ - Owners    │        │ - Invoices   │      │ - Transcripts│
   │ - Properties│        │ - Payments   │      │ - Knowledge  │
   │ - Leads     │        │ - Subscriptions│    │              │
   └─────────────┘        └──────────────┘      └──────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
   ┌─────────────┐        ┌──────────────┐      ┌──────────────┐
   │  CRM Table  │        │ Billing Table│      │ AI Call Table│
   │  (Optimized)│        │              │      │              │
   └─────────────┘        └──────────────┘      └──────────────┘
        │
        ├─────────────────────────────────────────┐
        │                                         │
        ▼                                         ▼
   ┌─────────────┐                        ┌──────────────┐
   │ Shared Libs │                        │ Shared Infra │
   │ (Validation,│                        │ (Logging,    │
   │  Auth,      │                        │  Tracing,    │
   │  Errors)    │                        │  Monitoring) │
   └─────────────┘                        └──────────────┘
```

### Design Principles

1. **Domain-Driven Design:** Services organized around business domains
2. **Single Responsibility:** Each service has one reason to change
3. **Clear Contracts:** Explicit API boundaries with versioning
4. **Loose Coupling:** Services communicate via async events where possible
5. **High Cohesion:** Related functionality stays together
6. **Independent Deployment:** Services deployable without others
7. **Observability First:** Structured logging, tracing, metrics built-in
8. **Security by Default:** Least privilege, service-to-service auth
9. **Backward Compatible:** Gradual migration, no breaking changes
10. **Cost Optimized:** Right-sized resources, efficient queries

---

## Microservice Decomposition Strategy

### Phase 1: Identify Service Boundaries

Based on domain analysis and current code structure, decompose into:

#### **1. CRM Core Service** (Highest Priority)

**Responsibility:** Customer relationship management  
**Entities:** Customers, Owners, Properties, Leads, Notes, Interactions  
**Current Code:** `crmDynamodbService.js`, `routes/crm.js`, `routes/leads.js`, `routes/buyers.js`

**API Endpoints:**
```
POST   /api/crm/customers
GET    /api/crm/customers/:id
PUT    /api/crm/customers/:id
DELETE /api/crm/customers/:id
GET    /api/crm/customers?search=...&status=...

POST   /api/crm/owners
GET    /api/crm/owners/:id
PUT    /api/crm/owners/:id

POST   /api/crm/properties
GET    /api/crm/properties/:id
PUT    /api/crm/properties/:id
GET    /api/crm/properties?owner=...&status=...

POST   /api/crm/leads
GET    /api/crm/leads/:id
PUT    /api/crm/leads/:id
POST   /api/crm/leads/:id/convert

POST   /api/crm/notes
GET    /api/crm/notes?entity=...&entityId=...
PUT    /api/crm/notes/:id
DELETE /api/crm/notes/:id
```

**Dependencies:**
- Shared Auth Service (token validation)
- Shared Notification Service (async events)
- Shared Audit Service (change tracking)

**Database:** Dedicated DynamoDB table `crm-core-prod`

---

#### **2. Billing & Credits Service** (High Priority)

**Responsibility:** Subscription management, billing, credit ledger  
**Entities:** Subscriptions, Invoices, Payments, Credit Ledger, Credit Config  
**Current Code:** `routes/billing.js`, `routes/subscriptions.js`, `routes/creditAdmin.js`, `creditService.js`

**API Endpoints:**
```
POST   /api/billing/subscriptions
GET    /api/billing/subscriptions/:id
PUT    /api/billing/subscriptions/:id
GET    /api/billing/subscriptions?tenant=...

POST   /api/billing/invoices
GET    /api/billing/invoices/:id
GET    /api/billing/invoices?tenant=...&status=...

POST   /api/billing/payments/webhook (Razorpay)
GET    /api/billing/payments/:id

POST   /api/billing/credits/debit
POST   /api/billing/credits/credit
GET    /api/billing/credits/balance?tenant=...
GET    /api/billing/credits/ledger?tenant=...

POST   /api/billing/credits/config (admin)
GET    /api/billing/credits/config/:id (admin)
```

**Dependencies:**
- Shared Auth Service
- Shared Notification Service
- External: Razorpay API

**Database:** Dedicated DynamoDB table `billing-prod`

---

#### **3. AI Calling Service** (Medium Priority)

**Responsibility:** Voice calling, transcription, knowledge base  
**Entities:** Call Sessions, Transcripts, Knowledge Docs, Call Recordings  
**Current Code:** `ai-calling-service/` (already separate)

**API Endpoints:**
```
POST   /api/ai-calling/calls
GET    /api/ai-calling/calls/:id
GET    /api/ai-calling/calls?tenant=...&status=...

GET    /api/ai-calling/transcripts/:callId
POST   /api/ai-calling/knowledge
GET    /api/ai-calling/knowledge/:id
DELETE /api/ai-calling/knowledge/:id

POST   /api/ai-calling/webhooks/exotel (Exotel callbacks)
```

**Dependencies:**
- Shared Auth Service
- Shared Notification Service
- External: Exotel API, ElevenLabs API

**Database:** Dedicated DynamoDB table `ai-calling-prod`

---

#### **4. Notifications Service** (Medium Priority)

**Responsibility:** In-app notifications, reminders, scheduled events  
**Entities:** Notifications, Scheduled Reminders, Notification Preferences  
**Current Code:** `notificationDynamodbService.js`, `routes/notifications.js`

**API Endpoints:**
```
GET    /api/notifications?tenant=...&read=...
PUT    /api/notifications/:id/read
DELETE /api/notifications/:id

POST   /api/notifications/reminders
GET    /api/notifications/reminders/:id
DELETE /api/notifications/reminders/:id

POST   /api/notifications/preferences
GET    /api/notifications/preferences?tenant=...
```

**Dependencies:**
- Shared Auth Service
- EventBridge (async event processing)

**Database:** Dedicated DynamoDB table `notifications-prod`

---

#### **5. Admin & Configuration Service** (Low Priority)

**Responsibility:** Tenant configuration, feature toggles, audit logs  
**Entities:** Agency Config, Feature Toggles, Audit Logs, User Categories  
**Current Code:** `routes/admin.js`, `agencyConfigService.js`, `featureToggleService.js`

**API Endpoints:**
```
GET    /api/admin/config/:tenantId
PUT    /api/admin/config/:tenantId
GET    /api/admin/audit-logs?tenant=...
GET    /api/admin/feature-toggles
PUT    /api/admin/feature-toggles/:id
```

**Dependencies:**
- Shared Auth Service (admin-only)

**Database:** Dedicated DynamoDB table `admin-config-prod`

---

### Shared Services & Libraries

#### **Auth & Token Validation**
- Centralized JWT validation
- Cognito integration
- Token caching
- Rate limiting per tenant

**Location:** `shared/auth/`

#### **Notification & Event Bus**
- EventBridge integration
- Async event publishing
- Event schema validation

**Location:** `shared/events/`

#### **Logging & Tracing**
- Structured logging (JSON)
- X-Ray tracing
- Request ID propagation
- Correlation IDs

**Location:** `shared/observability/`

#### **Error Handling**
- Standardized error responses
- Error classification
- Retry logic

**Location:** `shared/errors/`

#### **Validation**
- Zod schemas
- Request body validation
- Response validation

**Location:** `shared/validation/`

---

## Service Boundaries & Contracts

### API Contract Definition

Each service exposes a **Service Contract** document defining:
- Endpoints (path, method, auth)
- Request/response schemas
- Error codes
- Rate limits
- Dependencies

**Example: CRM Service Contract**

```yaml
service: crm-core
version: "1.0"
baseUrl: /api/crm
auth: JWT (Cognito)
rateLimit: 1000 req/min per tenant

endpoints:
  - path: /customers
    method: POST
    description: Create a new customer
    auth: required
    requestBody:
      type: object
      required: [name, phone, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 255
        phone:
          type: string
          pattern: '^\+?[0-9]{10,15}$'
        email:
          type: string
          format: email
    responses:
      201:
        description: Customer created
        schema:
          type: object
          properties:
            id: { type: string, format: uuid }
            tenantId: { type: string, format: uuid }
            name: { type: string }
            phone: { type: string }
            email: { type: string }
            status: { type: string, enum: [active, inactive, archived] }
            createdAt: { type: string, format: date-time }
            updatedAt: { type: string, format: date-time }
      400:
        description: Validation error
        schema:
          type: object
          properties:
            error: { type: string }
            code: { type: string }
            details: { type: object }
      401:
        description: Unauthorized
      429:
        description: Rate limit exceeded
```

### Service-to-Service Communication

**Synchronous (HTTP):**
- CRM Service → Notification Service (internal API)
- Billing Service → CRM Service (customer lookup)

**Asynchronous (EventBridge):**
- CRM Service publishes: `customer.created`, `property.updated`, `lead.converted`
- Billing Service publishes: `subscription.activated`, `payment.received`
- Notification Service subscribes to all events

**Example Event Schema:**
```json
{
  "source": "crm-service",
  "detail-type": "Customer Created",
  "detail": {
    "customerId": "uuid",
    "tenantId": "uuid",
    "name": "John Doe",
    "phone": "+919876543210",
    "createdAt": "2026-01-15T10:30:00Z",
    "createdBy": "user-id"
  },
  "time": "2026-01-15T10:30:00Z"
}
```

---

## CloudFormation Improvements

### Current Issues

1. **Monolithic Template:** Single 2500+ line template for all resources
2. **No Nested Stacks:** Difficult to manage and update independently
3. **Implicit Dependencies:** Hard to understand resource relationships
4. **No Reusability:** Difficult to create new services with same pattern
5. **Manual Parameter Management:** Error-prone parameter files
6. **Limited Outputs:** Missing critical resource identifiers

### Improved Structure

```
infra/
├── main-stack.yaml                 # Root template (orchestrator)
├── parameters/
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
├── nested/
│   ├── iam-roles.yaml              # Shared IAM roles
│   ├── dynamodb-tables.yaml        # All DynamoDB tables
│   ├── s3-buckets.yaml             # S3 buckets
│   ├── secrets.yaml                # Secrets Manager
│   ├── api-gateway.yaml            # API Gateway setup
│   ├── cloudwatch.yaml             # Logging & monitoring
│   └── services/
│       ├── crm-service.yaml        # CRM Lambda + permissions
│       ├── billing-service.yaml    # Billing Lambda + permissions
│       ├── ai-calling-service.yaml # AI Calling Lambda + permissions
│       ├── notifications-service.yaml
│       └── admin-service.yaml
├── deploy.sh                       # Deployment orchestrator
└── validate.sh                     # Template validation
```

### Deployment Script

```bash
#!/bin/bash
# infra/deploy.sh

set -euo pipefail

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="realtyflow-${ENVIRONMENT}"

echo "🚀 Deploying RealtyFlow to ${ENVIRONMENT} (${REGION})"

# Validate templates
echo "📋 Validating CloudFormation templates..."
for template in nested/*.yaml nested/services/*.yaml; do
  aws cloudformation validate-template \
    --template-body "file://${template}" \
    --region "${REGION}" > /dev/null
  echo "  ✓ ${template}"
done

# Deploy main stack
echo "🔨 Deploying main stack..."
aws cloudformation deploy \
  --template-file main-stack.yaml \
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

## DynamoDB Schema Optimization

### CRM Core Table (`crm-core-prod`)

```
PK: TENANT#{tenantId}#ENTITY#{entityType}#{entityId}
SK: PROFILE | NOTE#{noteId} | INTERACTION#{interactionId}

Attributes:
  tenantId (S)           - Tenant identifier
  entityType (S)         - CUSTOMER | OWNER | PROPERTY | LEAD
  entityId (S)           - Entity UUID
  status (S)             - active | inactive | archived
  createdAt (S)          - ISO 8601 timestamp
  updatedAt (S)          - ISO 8601 timestamp
  createdBy (S)          - User ID
  updatedBy (S)          - User ID
  ttl (N)                - Unix timestamp for auto-deletion
  
  # Customer-specific
  name (S)
  phone (S)
  email (S)
  address (M)
  
  # Owner-specific
  ownerName (S)
  ownerPhone (S)
  bankDetails (M)
  
  # Property-specific
  propertyType (S)
  location (S)
  price (N)
  ownerRef (S)           - Reference to owner entity
  
  # Lead-specific
  leadSource (S)
  leadScore (N)
  assignedTo (S)
  conversionDate (S)

Global Secondary Indexes:

1. GSI1: tenant-status-index
   PK: GSI1PK = TENANT#{tenantId}#STATUS#{status}
   SK: GSI1SK = createdAt
   Projection: ALL
   Use: List customers/properties by status, sorted by date

2. GSI2: tenant-type-index
   PK: GSI2PK = TENANT#{tenantId}#TYPE#{entityType}
   SK: GSI2SK = createdAt
   Projection: ALL
   Use: List all entities of a type

3. GSI3: owner-property-index
   PK: GSI3PK = TENANT#{tenantId}#OWNER#{ownerId}
   SK: GSI3SK = createdAt
   Projection: ALL
   Use: List properties for an owner

4. GSI4: search-index
   PK: GSI4PK = TENANT#{tenantId}#SEARCH
   SK: GSI4SK = searchableText (name, phone, email)
   Projection: KEYS_ONLY
   Use: Full-text search (with FilterExpression)
```

### Billing Table (`billing-prod`)

```
PK: TENANT#{tenantId}#BILLING#{entityType}#{entityId}
SK: PROFILE | INVOICE#{invoiceId} | PAYMENT#{paymentId}

Attributes:
  tenantId (S)
  entityType (S)         - SUBSCRIPTION | INVOICE | PAYMENT | CREDIT_LEDGER
  entityId (S)
  status (S)
  createdAt (S)
  updatedAt (S)
  
  # Subscription-specific
  planId (S)
  seats (N)
  monthlyRate (N)
  renewalDate (S)
  
  # Invoice-specific
  invoiceNumber (S)
  amount (N)
  dueDate (S)
  
  # Payment-specific
  razorpayId (S)
  amount (N)
  method (S)
  
  # Credit Ledger-specific
  operation (S)          - DEBIT | CREDIT
  amount (N)
  reason (S)
  balance (N)

Global Secondary Indexes:

1. GSI1: tenant-status-index
   PK: GSI1PK = TENANT#{tenantId}#STATUS#{status}
   SK: GSI1SK = createdAt

2. GSI2: tenant-type-index
   PK: GSI2PK = TENANT#{tenantId}#TYPE#{entityType}
   SK: GSI2SK = createdAt
```

### AI Calling Table (`ai-calling-prod`)

```
PK: TENANT#{tenantId}#CALL#{callId}
SK: PROFILE | TRANSCRIPT | RECORDING

Attributes:
  tenantId (S)
  callId (S)
  status (S)             - initiated | in-progress | completed | failed
  startTime (S)
  endTime (S)
  duration (N)           - seconds
  exotelCallId (S)
  transcriptUrl (S)
  recordingUrl (S)
  agentId (S)
  customerId (S)
  knowledgeBaseId (S)
  ttl (N)                - Auto-delete after 90 days

Global Secondary Indexes:

1. GSI1: tenant-date-index
   PK: GSI1PK = TENANT#{tenantId}#CALLS
   SK: GSI1SK = startTime

2. GSI2: customer-calls-index
   PK: GSI2PK = TENANT#{tenantId}#CUSTOMER#{customerId}
   SK: GSI2SK = startTime
```

---

## Lambda Function Organization

### Improved Directory Structure

```
services/
├── crm-service/
│   ├── src/
│   │   ├── index.ts            # Lambda handler
│   │   ├── app.ts              # Express app factory
│   │   ├── local-server.ts     # Local dev entry
│   │   ├── routes/
│   │   │   ├── customers.ts
│   │   │   ├── owners.ts
│   │   │   ├── properties.ts
│   │   │   ├── leads.ts
│   │   │   └── notes.ts
│   │   ├── controllers/
│   │   │   ├── customerController.ts
│   │   │   ├── ownerController.ts
│   │   │   ├── propertyController.ts
│   │   │   ├── leadController.ts
│   │   │   └── noteController.ts
│   │   ├── models/
│   │   │   ├── customerModel.ts
│   │   │   ├── ownerModel.ts
│   │   │   ├── propertyModel.ts
│   │   │   ├── leadModel.ts
│   │   │   └── noteModel.ts
│   │   ├── middleware/
│   │   │   ├── validateCustomer.ts
│   │   │   ├── validateProperty.ts
│   │   │   └── validateLead.ts
│   │   ├── schemas/
│   │   │   ├── customer.ts
│   │   │   ├── property.ts
│   │   │   └── lead.ts
│   │   ├── types/
│   │   │   ├── customer.ts
│   │   │   ├── property.ts
│   │   │   └── lead.ts
│   │   └── utils/
│   │       ├── validators.ts
│   │       ├── formatters.ts
│   │       └── helpers.ts
│   ├── infra/
│   │   ├── cfn-backend.yaml
│   │   ├── cfn-params.sample.json
│   │   ├── deploy.sh
│   │   └── validate.sh
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md

├── billing-service/
│   ├── src/
│   ├── infra/
│   └── tests/

├── ai-calling-service/
│   ├── src/
│   ├── infra/
│   └── tests/

├── shared/
│   ├── auth/
│   │   ├── index.ts
│   │   ├── tokenValidator.ts
│   │   ├── cognitoClient.ts
│   │   └── types.ts
│   ├── events/
│   │   ├── index.ts
│   │   ├── eventBus.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── observability/
│   │   ├── index.ts
│   │   ├── logger.ts
│   │   ├── tracer.ts
│   │   ├── metrics.ts
│   │   └── types.ts
│   ├── errors/
│   │   ├── index.ts
│   │   ├── AppError.ts
│   │   ├── errorHandler.ts
│   │   └── types.ts
│   ├── validation/
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   └── validators.ts
│   ├── types/
│   │   ├── common.ts
│   │   ├── tenant.ts
│   │   └── api.ts
│   └── package.json

└── infra/
    ├── main-stack.yaml
    ├── nested/
    ├── parameters/
    ├── deploy.sh
    └── validate.sh
```

### Lambda Handler Pattern

```typescript
// services/crm-service/src/index.ts
import serverlessExpress from '@vendia/serverless-express';
import { app } from './app.js';
import { logger } from '../../shared/observability/index.js';

let cachedServer: any;

export const handler = async (event: any, context: any) => {
  logger.info('lambda.invoked', {
    requestId: context.awsRequestId,
    path: event.path,
    method: event.httpMethod,
    sourceIp: event.requestContext?.identity?.sourceIp,
  });

  try {
    if (!cachedServer) {
      cachedServer = serverlessExpress({ app });
    }

    const response = await cachedServer(event, context);

    logger.info('lambda.completed', {
      requestId: context.awsRequestId,
      statusCode: response.statusCode,
      duration: context.getRemainingTime(),
    });

    return response;
  } catch (error) {
    logger.error('lambda.error', {
      requestId: context.awsRequestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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

---

## Monitoring & Observability

### Structured Logging

```typescript
// shared/observability/logger.ts
import { logger as pinoLogger } from 'pino';

const logger = pinoLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

export const logger = {
  info: (event: string, data?: any) => {
    logger.info({ event, ...data });
  },
  error: (event: string, data?: any) => {
    logger.error({ event, ...data });
  },
  warn: (event: string, data?: any) => {
    logger.warn({ event, ...data });
  },
  debug: (event: string, data?: any) => {
    logger.debug({ event, ...data });
  },
};
```

### CloudWatch Metrics

```typescript
// shared/observability/metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export async function recordMetric(
  metricName: string,
  value: number,
  unit: string = 'Count',
  dimensions?: Record<string, string>
) {
  const params = {
    Namespace: 'RealtyFlow',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: Object.entries(dimensions || {}).map(([name, value]) => ({
          Name: name,
          Value: value,
        })),
      },
    ],
  };

  await cloudwatch.send(new PutMetricDataCommand(params));
}
```

### X-Ray Tracing

```typescript
// shared/observability/tracer.ts
import AWSXRay from 'aws-xray-sdk-core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamodbClient = AWSXRay.client(new DynamoDBClient());

export { dynamodbClient };
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Objectives:**
- Create shared libraries
- Set up new service structure
- Implement deployment automation

**Deliverables:**
1. `shared/` directory with auth, observability, errors, validation
2. Service template structure
3. Deployment scripts
4. CI/CD pipeline

**Effort:** 80 hours

---

### Phase 2: CRM Service Migration (Weeks 5-12)

**Objectives:**
- Extract CRM logic into standalone service
- Create optimized DynamoDB table
- Implement service contracts
- Dual-write to old and new tables

**Deliverables:**
1. `crm-service/` with all CRM endpoints
2. New `crm-core-prod` DynamoDB table
3. Service contract documentation
4. Integration tests

**Effort:** 160 hours

---

### Phase 3: Billing Service Migration (Weeks 13-18)

**Objectives:**
- Extract billing logic
- Create billing DynamoDB table
- Implement payment webhooks
- Credit ledger optimization

**Deliverables:**
1. `billing-service/` with all billing endpoints
2. New `billing-prod` DynamoDB table
3. Razorpay webhook integration
4. Credit system tests

**Effort:** 120 hours

---

### Phase 4: Notifications & Admin Services (Weeks 19-22)

**Objectives:**
- Extract notifications service
- Extract admin service
- Implement EventBridge integration
- Service-to-service communication

**Deliverables:**
1. `notifications-service/`
2. `admin-service/`
3. EventBridge event schemas
4. Internal API documentation

**Effort:** 100 hours

---

### Phase 5: Cleanup & Optimization (Weeks 23-26)

**Objectives:**
- Deprecate old monolithic Lambda
- Optimize queries
- Performance testing
- Documentation

**Deliverables:**
1. Decommissioned old Lambda
2. Query optimization report
3. Performance benchmarks
4. Runbook documentation

**Effort:** 80 hours

---

## Testing Strategy

### Unit Tests

```typescript
// services/crm-service/tests/unit/customerController.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createCustomer, getCustomer, updateCustomer } from '../../src/controllers/customerController';
import * as customerModel from '../../src/models/customerModel';

jest.mock('../../src/models/customerModel');

describe('CustomerController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create a customer with valid data', async () => {
      const mockRequest = {
        body: {
          name: 'John Doe',
          phone: '+919876543210',
          email: 'john@example.com',
        },
        user: { tenantId: 'tenant-123' },
      };

      const mockCustomer = {
        id: 'customer-123',
        tenantId: 'tenant-123',
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        createdAt: new Date().toISOString(),
      };

      (customerModel.createCustomer as jest.Mock).mockResolvedValue(mockCustomer);

      const result = await createCustomer(mockRequest as any);

      expect(result).toEqual(mockCustomer);
      expect(customerModel.createCustomer).toHaveBeenCalledWith('tenant-123', mockRequest.body);
    });

    it('should reject invalid email', async () => {
      const mockRequest = {
        body: {
          name: 'John Doe',
          phone: '+919876543210',
          email: 'invalid-email',
        },
        user: { tenantId: 'tenant-123' },
      };

      await expect(createCustomer(mockRequest as any)).rejects.toThrow('Invalid email');
    });
  });
});
```

### Integration Tests

```typescript
// services/crm-service/tests/integration/customer-api.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('Customer API Integration', () => {
  let dynamodbClient: DynamoDBDocumentClient;

  beforeAll(async () => {
    // Setup test DynamoDB table
    dynamodbClient = setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestDatabase();
  });

  describe('POST /api/crm/customers', () => {
    it('should create a customer and return 201', async () => {
      const response = await request(app)
        .post('/api/crm/customers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
          phone: '+919876543210',
          email: 'john@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('John Doe');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/crm/customers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
          // Missing phone and email
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/crm/customers/:id', () => {
    it('should retrieve a customer', async () => {
      // Create a customer first
      const createResponse = await request(app)
        .post('/api/crm/customers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Jane Doe',
          phone: '+919876543211',
          email: 'jane@example.com',
        });

      const customerId = createResponse.body.id;

      // Retrieve the customer
      const getResponse = await request(app)
        .get(`/api/crm/customers/${customerId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(customerId);
      expect(getResponse.body.name).toBe('Jane Doe');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/crm/customers/non-existent-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });
  });
});
```

### E2E Tests

```typescript
// services/crm-service/tests/e2e/crm-workflow.test.ts
describe('CRM Workflow E2E', () => {
  it('should complete a full customer lifecycle', async () => {
    // 1. Create a customer
    const customerResponse = await request(app)
      .post('/api/crm/customers')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
      });

    const customerId = customerResponse.body.id;
    expect(customerResponse.status).toBe(201);

    // 2. Create a property for the customer
    const propertyResponse = await request(app)
      .post('/api/crm/properties')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        type: 'apartment',
        location: 'Mumbai',
        price: 5000000,
        ownerRef: customerId,
      });

    const propertyId = propertyResponse.body.id;
    expect(propertyResponse.status).toBe(201);

    // 3. Create a lead
    const leadResponse = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        source: 'website',
        customerId: customerId,
        propertyId: propertyId,
      });

    const leadId = leadResponse.body.id;
    expect(leadResponse.status).toBe(201);

    // 4. Convert the lead
    const convertResponse = await request(app)
      .post(`/api/crm/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        conversionType: 'sale',
      });

    expect(convertResponse.status).toBe(200);
    expect(convertResponse.body.status).toBe('converted');
  });
});
```

---

## Risk Assessment

### High-Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| **Data Loss During Migration** | Critical | Low | Dual-write strategy, backup before cutover, rollback plan |
| **Service Coupling** | High | Medium | Clear contracts, integration tests, canary deployments |
| **Performance Regression** | High | Medium | Load testing, query optimization, monitoring |
| **Deployment Failures** | High | Medium | Automated rollback, staging environment, runbooks |

### Medium-Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| **Increased Operational Complexity** | Medium | High | Comprehensive documentation, runbooks, training |
| **Cold Start Latency** | Medium | Medium | Lambda provisioned concurrency, code optimization |
| **Cost Increase** | Medium | Medium | Cost monitoring, right-sizing, reserved capacity |
| **Breaking Changes** | Medium | Medium | API versioning, backward compatibility layer |

### Mitigation Strategies

1. **Dual-Write Pattern:** Write to both old and new systems during migration
2. **Canary Deployments:** Roll out to 5% of traffic first, monitor for issues
3. **Feature Flags:** Control service activation per tenant
4. **Comprehensive Testing:** Unit, integration, E2E, load, chaos testing
5. **Monitoring & Alerting:** Real-time dashboards, automated alerts
6. **Rollback Plan:** Automated rollback on error detection
7. **Documentation:** Runbooks, architecture diagrams, API docs

---

## Effort Estimation

### Summary

| Phase | Duration | Effort (Hours) | Team Size |
|-------|----------|----------------|-----------|
| Phase 1: Foundation | 4 weeks | 80 | 2 engineers |
| Phase 2: CRM Service | 8 weeks | 160 | 2 engineers |
| Phase 3: Billing Service | 6 weeks | 120 | 2 engineers |
| Phase 4: Notifications & Admin | 4 weeks | 100 | 2 engineers |
| Phase 5: Cleanup & Optimization | 4 weeks | 80 | 1 engineer |
| **Total** | **26 weeks** | **540** | **2 engineers** |

### Detailed Breakdown

**Phase 1: Foundation (80 hours)**
- Shared libraries setup: 20 hours
- Service template structure: 15 hours
- Deployment automation: 25 hours
- CI/CD pipeline: 20 hours

**Phase 2: CRM Service (160 hours)**
- Extract CRM logic: 40 hours
- Create DynamoDB table: 20 hours
- Implement endpoints: 50 hours
- Testing & QA: 30 hours
- Documentation: 20 hours

**Phase 3: Billing Service (120 hours)**
- Extract billing logic: 30 hours
- Create DynamoDB table: 15 hours
- Implement endpoints: 40 hours
- Testing & QA: 25 hours
- Documentation: 10 hours

**Phase 4: Notifications & Admin (100 hours)**
- Extract notifications: 25 hours
- Extract admin service: 25 hours
- EventBridge integration: 30 hours
- Testing & QA: 15 hours
- Documentation: 5 hours

**Phase 5: Cleanup & Optimization (80 hours)**
- Deprecate old Lambda: 20 hours
- Query optimization: 30 hours
- Performance testing: 20 hours
- Documentation & runbooks: 10 hours

---

## Backward Compatibility Strategy

### API Versioning

```
/api/v1/crm/customers      # Current (deprecated)
/api/v2/crm/customers      # New microservice
```

### Gradual Migration

1. **Week 1-2:** Deploy new services alongside old Lambda
2. **Week 3-4:** Route 5% of traffic to new services (canary)
3. **Week 5-6:** Route 25% of traffic to new services
4. **Week 7-8:** Route 50% of traffic to new services
5. **Week 9-10:** Route 100% of traffic to new services
6. **Week 11-12:** Keep old Lambda running for 2 weeks (safety net)
7. **Week 13+:** Decommission old Lambda

### Compatibility Layer

```typescript
// services/api-gateway/compatibility.ts
// Routes old API calls to new microservices

app.get('/api/v1/crm/customers/:id', async (req, res) => {
  // Translate v1 request to v2
  const response = await fetch(`${CRM_SERVICE_URL}/api/crm/customers/${req.params.id}`, {
    headers: req.headers,
  });
  
  // Translate v2 response back to v1 format
  const data = await response.json();
  res.json(translateToV1Format(data));
});
```

---

## Scalability Improvements

### Horizontal Scaling

- **Independent Lambda Scaling:** Each service scales independently based on demand
- **Auto-Scaling Groups:** Lambda provisioned concurrency for predictable load
- **DynamoDB On-Demand:** Automatic scaling for unpredictable workloads

### Vertical Scaling

- **Right-Sized Memory:** CRM Service: 512MB, Billing Service: 256MB, AI Calling: 1024MB
- **Optimized Code:** Reduce package size, lazy load dependencies
- **Connection Pooling:** Reuse DynamoDB connections

### Query Optimization

- **GSI Usage:** Replace full table scans with GSI queries
- **Projection Expressions:** Load only needed attributes
- **Batch Operations:** Use BatchGetItem for multiple reads
- **Caching:** Redis for frequently accessed data (future)

### Cost Optimization

- **DynamoDB:** Move from provisioned to on-demand billing
- **Lambda:** Right-size memory allocation
- **S3:** Implement lifecycle policies for old data
- **CloudWatch:** Aggregate logs, set retention policies

---

## Conclusion

This architectural improvement design provides a comprehensive roadmap for transforming RealtyFlow from a monolithic architecture to a scalable, maintainable microservices platform. The phased approach minimizes risk while delivering incremental value, and the detailed implementation guidance ensures successful execution.

**Key Success Factors:**
1. Clear communication with stakeholders
2. Comprehensive testing at each phase
3. Continuous monitoring and observability
4. Gradual migration with rollback capabilities
5. Team training and documentation

**Expected Outcomes:**
- 50-70% reduction in Lambda cold starts
- 30-40% improvement in query performance
- 25-35% reduction in operational costs
- Faster feature development cycles
- Improved system reliability and maintainability

