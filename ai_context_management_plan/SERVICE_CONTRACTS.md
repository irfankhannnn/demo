# RealtyFlow Service Contracts & API Specifications

**Version:** 1.0  
**Status:** Reference Document  
**Last Updated:** 2026

---

## Overview

This document defines the API contracts for all RealtyFlow microservices. Each service exposes a well-defined API with clear request/response schemas, error handling, and rate limits.

---

## CRM Core Service

**Base URL:** `/api/crm`  
**Authentication:** JWT (Cognito)  
**Rate Limit:** 1000 requests/min per tenant  
**Timeout:** 30 seconds

### Endpoints

#### Create Customer

```http
POST /api/crm/customers
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "address": "123 Main St, Mumbai"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "address": "123 Main St, Mumbai",
  "status": "active",
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z",
  "createdBy": "user-123"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Invalid email format"
  }
}

// 401 Unauthorized
{
  "error": "Invalid or missing token",
  "code": "UNAUTHORIZED"
}

// 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 60
  }
}
```

---

#### Get Customer

```http
GET /api/crm/customers/{customerId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "status": "active",
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Customer not found",
  "code": "NOT_FOUND"
}
```

---

#### List Customers

```http
GET /api/crm/customers?status=active&limit=50&offset=0
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `status` (string): Filter by status (active, inactive, archived) - default: active
- `limit` (number): Number of results (1-100) - default: 50
- `offset` (number): Pagination offset - default: 0
- `search` (string): Search by name, phone, or email

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "tenant-123",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "status": "active",
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

---

#### Update Customer

```http
PUT /api/crm/customers/{customerId}
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "John Doe Updated",
  "phone": "+919876543211",
  "email": "john.updated@example.com"
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "name": "John Doe Updated",
  "phone": "+919876543211",
  "email": "john.updated@example.com",
  "status": "active",
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T11:00:00Z"
}
```

---

#### Delete Customer

```http
DELETE /api/crm/customers/{customerId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (204):** No Content

---

#### Create Property

```http
POST /api/crm/properties
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "type": "apartment",
  "location": "Mumbai",
  "price": 5000000,
  "ownerRef": "owner-123",
  "bedrooms": 2,
  "bathrooms": 2,
  "squareFeet": 1200
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "tenantId": "tenant-123",
  "type": "apartment",
  "location": "Mumbai",
  "price": 5000000,
  "ownerRef": "owner-123",
  "bedrooms": 2,
  "bathrooms": 2,
  "squareFeet": 1200,
  "status": "active",
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

---

#### Create Lead

```http
POST /api/crm/leads
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "source": "website",
  "customerId": "customer-123",
  "propertyId": "property-123",
  "notes": "Interested in buying"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "tenantId": "tenant-123",
  "source": "website",
  "customerId": "customer-123",
  "propertyId": "property-123",
  "notes": "Interested in buying",
  "status": "open",
  "score": 50,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

---

#### Convert Lead

```http
POST /api/crm/leads/{leadId}/convert
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "conversionType": "sale",
  "amount": 5000000
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "tenantId": "tenant-123",
  "status": "converted",
  "conversionType": "sale",
  "amount": 5000000,
  "convertedAt": "2026-01-15T11:00:00Z"
}
```

---

#### Create Note

```http
POST /api/crm/notes
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "entityType": "customer",
  "entityId": "customer-123",
  "content": "Customer called to inquire about properties"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "tenantId": "tenant-123",
  "entityType": "customer",
  "entityId": "customer-123",
  "content": "Customer called to inquire about properties",
  "createdAt": "2026-01-15T10:30:00Z",
  "createdBy": "user-123"
}
```

---

#### List Notes

```http
GET /api/crm/notes?entityType=customer&entityId=customer-123
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "tenantId": "tenant-123",
      "entityType": "customer",
      "entityId": "customer-123",
      "content": "Customer called to inquire about properties",
      "createdAt": "2026-01-15T10:30:00Z",
      "createdBy": "user-123"
    }
  ],
  "count": 1
}
```

---

## Billing Service

**Base URL:** `/api/billing`  
**Authentication:** JWT (Cognito)  
**Rate Limit:** 500 requests/min per tenant  
**Timeout:** 30 seconds

### Endpoints

#### Create Subscription

```http
POST /api/billing/subscriptions
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "planId": "plan-pro",
  "seats": 5,
  "billingCycle": "monthly"
}
```

**Response (201):**
```json
{
  "id": "sub-123",
  "tenantId": "tenant-123",
  "planId": "plan-pro",
  "seats": 5,
  "monthlyRate": 9999,
  "billingCycle": "monthly",
  "status": "active",
  "renewalDate": "2026-02-15",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

#### Get Subscription

```http
GET /api/billing/subscriptions/{subscriptionId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "id": "sub-123",
  "tenantId": "tenant-123",
  "planId": "plan-pro",
  "seats": 5,
  "monthlyRate": 9999,
  "status": "active",
  "renewalDate": "2026-02-15",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

#### Get Credit Balance

```http
GET /api/billing/credits/balance
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "tenantId": "tenant-123",
  "balance": 1000,
  "currency": "INR",
  "lastUpdated": "2026-01-15T10:30:00Z"
}
```

---

#### Debit Credits

```http
POST /api/billing/credits/debit
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 100,
  "reason": "Lead generation",
  "metadata": {
    "leadId": "lead-123"
  }
}
```

**Response (200):**
```json
{
  "id": "ledger-123",
  "tenantId": "tenant-123",
  "operation": "DEBIT",
  "amount": 100,
  "reason": "Lead generation",
  "balance": 900,
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

#### Get Credit Ledger

```http
GET /api/billing/credits/ledger?limit=50&offset=0
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "ledger-123",
      "tenantId": "tenant-123",
      "operation": "DEBIT",
      "amount": 100,
      "reason": "Lead generation",
      "balance": 900,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "total": 50
}
```

---

#### Payment Webhook (Razorpay)

```http
POST /api/billing/payments/webhook
Content-Type: application/json
X-Razorpay-Signature: <HMAC_SHA256>

{
  "event": "payment.authorized",
  "created_at": 1234567890,
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_123",
        "amount": 999900,
        "currency": "INR",
        "status": "authorized",
        "notes": {
          "tenantId": "tenant-123",
          "subscriptionId": "sub-123"
        }
      }
    }
  }
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Payment processed"
}
```

---

## AI Calling Service

**Base URL:** `/api/ai-calling`  
**Authentication:** JWT (Cognito)  
**Rate Limit:** 100 requests/min per tenant  
**Timeout:** 60 seconds

### Endpoints

#### Initiate Call

```http
POST /api/ai-calling/calls
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "customerId": "customer-123",
  "phoneNumber": "+919876543210",
  "knowledgeBaseId": "kb-123",
  "agentId": "agent-123"
}
```

**Response (201):**
```json
{
  "id": "call-123",
  "tenantId": "tenant-123",
  "customerId": "customer-123",
  "phoneNumber": "+919876543210",
  "status": "initiated",
  "exotelCallId": "exotel-123",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

#### Get Call Details

```http
GET /api/ai-calling/calls/{callId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "id": "call-123",
  "tenantId": "tenant-123",
  "customerId": "customer-123",
  "phoneNumber": "+919876543210",
  "status": "completed",
  "duration": 300,
  "startTime": "2026-01-15T10:30:00Z",
  "endTime": "2026-01-15T10:35:00Z",
  "transcriptUrl": "s3://bucket/transcripts/call-123.json",
  "recordingUrl": "s3://bucket/recordings/call-123.wav"
}
```

---

#### Get Transcript

```http
GET /api/ai-calling/transcripts/{callId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "callId": "call-123",
  "transcript": [
    {
      "speaker": "agent",
      "text": "Hello, how can I help you?",
      "timestamp": 0
    },
    {
      "speaker": "customer",
      "text": "I'm interested in the apartment listing",
      "timestamp": 2
    }
  ],
  "summary": "Customer inquired about apartment listing",
  "sentiment": "positive"
}
```

---

#### Upload Knowledge Document

```http
POST /api/ai-calling/knowledge
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

{
  "file": <PDF_FILE>,
  "title": "Property Listings",
  "category": "properties"
}
```

**Response (201):**
```json
{
  "id": "doc-123",
  "tenantId": "tenant-123",
  "title": "Property Listings",
  "category": "properties",
  "url": "s3://bucket/knowledge/doc-123.pdf",
  "uploadedAt": "2026-01-15T10:30:00Z"
}
```

---

## Notifications Service

**Base URL:** `/api/notifications`  
**Authentication:** JWT (Cognito)  
**Rate Limit:** 500 requests/min per tenant  
**Timeout:** 10 seconds

### Endpoints

#### Get Notifications

```http
GET /api/notifications?read=false&limit=50
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "notif-123",
      "tenantId": "tenant-123",
      "title": "New lead received",
      "message": "A new lead has been assigned to you",
      "type": "lead",
      "read": false,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "unreadCount": 5
}
```

---

#### Mark Notification as Read

```http
PUT /api/notifications/{notificationId}/read
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "id": "notif-123",
  "read": true,
  "readAt": "2026-01-15T10:35:00Z"
}
```

---

#### Create Reminder

```http
POST /api/notifications/reminders
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Follow up with customer",
  "description": "Call John Doe about property",
  "scheduledFor": "2026-01-16T10:00:00Z",
  "entityType": "customer",
  "entityId": "customer-123"
}
```

**Response (201):**
```json
{
  "id": "reminder-123",
  "tenantId": "tenant-123",
  "title": "Follow up with customer",
  "description": "Call John Doe about property",
  "scheduledFor": "2026-01-16T10:00:00Z",
  "status": "scheduled",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

## Admin Service

**Base URL:** `/api/admin`  
**Authentication:** JWT (Cognito, admin role required)  
**Rate Limit:** 100 requests/min per tenant  
**Timeout:** 30 seconds

### Endpoints

#### Get Tenant Configuration

```http
GET /api/admin/config/{tenantId}
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "tenantId": "tenant-123",
  "name": "Acme Real Estate",
  "logo": "https://example.com/logo.png",
  "settings": {
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "language": "en",
    "emailNotifications": true
  },
  "features": {
    "aiCalling": true,
    "whatsappIntegration": true,
    "billingModule": true
  },
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

---

#### Update Tenant Configuration

```http
PUT /api/admin/config/{tenantId}
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "settings": {
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "emailNotifications": false
  }
}
```

**Response (200):**
```json
{
  "tenantId": "tenant-123",
  "settings": {
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "emailNotifications": false
  },
  "updatedAt": "2026-01-15T10:35:00Z"
}
```

---

#### Get Audit Logs

```http
GET /api/admin/audit-logs?action=create&limit=50
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "audit-123",
      "tenantId": "tenant-123",
      "userId": "user-123",
      "action": "create",
      "resource": "customer",
      "resourceId": "customer-123",
      "changes": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "timestamp": "2026-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists or state conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Common Request Headers

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
X-Request-ID: <UUID>
X-Tenant-ID: <TENANT_ID> (optional, extracted from token)
User-Agent: <CLIENT_USER_AGENT>
```

---

## Common Response Headers

```
Content-Type: application/json
X-Request-ID: <UUID>
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
Cache-Control: no-cache, no-store, must-revalidate
```

---

## Pagination

All list endpoints support pagination using `limit` and `offset` query parameters:

```
GET /api/crm/customers?limit=50&offset=100
```

**Response:**
```json
{
  "data": [...],
  "count": 50,
  "total": 1000,
  "limit": 50,
  "offset": 100,
  "hasMore": true
}
```

---

## Filtering & Searching

Services support filtering and searching:

```
GET /api/crm/customers?status=active&search=john&limit=50
```

**Supported Filters:**
- `status`: Filter by entity status
- `search`: Full-text search across name, phone, email
- `createdAfter`: Filter by creation date (ISO 8601)
- `createdBefore`: Filter by creation date (ISO 8601)
- `sortBy`: Sort field (default: createdAt)
- `sortOrder`: asc or desc (default: desc)

---

## Versioning

Services support API versioning through URL paths:

```
/api/v1/crm/customers      # Legacy API (deprecated)
/api/v2/crm/customers      # Current API
```

Version headers are also supported:

```
GET /api/crm/customers
API-Version: 2
```

---

## Rate Limiting

Each service has rate limits per tenant:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 1000,
    "remaining": 0,
    "resetAt": "2026-01-15T11:00:00Z"
  }
}
```

---

## Webhooks

Services publish webhooks for important events:

### Webhook Format

```json
{
  "id": "webhook-123",
  "event": "customer.created",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "customerId": "customer-123",
    "tenantId": "tenant-123",
    "name": "John Doe"
  }
}
```

### Webhook Events

**CRM Service:**
- `customer.created`
- `customer.updated`
- `customer.deleted`
- `property.created`
- `property.updated`
- `lead.created`
- `lead.converted`

**Billing Service:**
- `subscription.activated`
- `subscription.renewed`
- `payment.received`
- `invoice.issued`

**AI Calling Service:**
- `call.initiated`
- `call.completed`
- `transcript.ready`

---

## Testing API Endpoints

### Using cURL

```bash
# Create customer
curl -X POST https://api.example.com/api/crm/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com"
  }'

# Get customer
curl -X GET https://api.example.com/api/crm/customers/customer-123 \
  -H "Authorization: Bearer $TOKEN"

# List customers
curl -X GET "https://api.example.com/api/crm/customers?status=active&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman

1. Import the OpenAPI specification
2. Set environment variables: `BASE_URL`, `TOKEN`, `TENANT_ID`
3. Run requests from the collection

### Using Insomnia

1. Import the OpenAPI specification
2. Configure authentication in workspace settings
3. Execute requests

---

## Support

For API support, contact:
- **Email:** api-support@realestateflow.in
- **Slack:** #api-support
- **Documentation:** https://docs.realestateflow.in

