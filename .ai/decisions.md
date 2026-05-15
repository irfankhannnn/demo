# Decisions

## Architecture

### ADR-001: Single-Table DynamoDB Design Per Domain
- **Decision**: Use separate DynamoDB tables for each domain (core, CRM, enquiries, khata, developers, projects) rather than one giant table.
- **Rationale**: Tenant isolation is simpler with separate tables; CRM table uses TENANT# prefix keys while core table does not. Avoids GSI hot-partitioning for high-traffic public endpoints.
- **Status**: Implemented. 11 tables defined in cfn-template.yaml.

### ADR-002: Multi-Tenancy via Header, Not Subdomain
- **Decision**: Pass tenant ID via `x-tenant-id` header instead of subdomain path prefix.
- **Rationale**: Simplifies frontend deployment (single build per tenant), easier API Gateway route mapping, and supports both public and private endpoints without CORS complexity.
- **Status**: Implemented. `extractTenantId` and `extractTenantIdOptional` middleware enforce this.

### ADR-003: Lambda + API Gateway, Not ECS/Fargate
- **Decision**: Deploy Express backend as Lambda behind API Gateway instead of containerized service.
- **Rationale**: Serverless scales to zero, fits CRM bursty usage patterns, and simplifies infra management via CloudFormation. Cold start acceptable for admin-facing CRM.
- **Status**: Implemented. `lambda-handler.js` wraps Express with `@vendia/serverless-express`.

### ADR-004: Explicit API Gateway Routes (No Proxy+)
- **Decision**: Define every API route explicitly in API Gateway instead of a single `/{proxy+}` catch-all.
- **Rationale**: Enables fine-grained CORS, auth, throttling, and request validation per route. Prevents accidental exposure of internal/debug endpoints.
- **Status**: Implemented. cfn-template.yaml declares all routes individually.

## Data Model

### ADR-101: Unified CONTACT Entity Replaces SELLER
- **Decision**: Deprecate standalone SELLER entity; sellers become CONTACT with `roles.seller=true` + OWNER with a for-sale property listing.
- **Rationale**: Real-world sellers are also property owners. Reduces entity duplication and simplifies Khata party search.
- **Status**: SELLER routes/services removed. Migration path: createOwner + createProperty(status=for-sale).
- **Impact**: `crmDynamodbService.js` still has legacy BUYER/CUSTOMER alongside CONTACT.

### ADR-102: Phone Number as Deduplication Key
- **Decision**: Normalize phone numbers (remove spaces/dashes/parentheses, keep last 10 digits) and use as the primary deduplication key across contacts, leads, buyers, and owners.
- **Rationale**: Phone is the most reliable identity signal in Indian real estate market; agents often know clients by phone before name.
- **Status**: Implemented in `createOrUpdateContactByPhone`, `convertLead`, and `findPersonByPhone`.

### ADR-103: Property Status Lifecycle Over Separate Tables
- **Decision**: Track property availability via `status` field (`available`, `on_hold`, `rented`, `for-sale`, `sold`) within a single PROPERTY entity instead of separate Rental/Sale tables.
- **Rationale**: A property can transition between rental and sale markets; separate tables would require migration. Single entity with lifecycle helpers (crmHelpers.js) is simpler.
- **Status**: Implemented. Backend property statuses: `available`, `on_hold`, `rented`, `for-sale`, `sold`. Frontend TypeScript type also includes `out_of_stock` (legacy). Project status uses `under_construction` separately in `projectsDynamodbService.js`.

### ADR-104: Meeting Reminders via Notification Table, Not EventBridge
- **Decision**: Store meeting reminders as NOTIFICATION items in DynamoDB with a scheduled date, and rely on client polling instead of AWS EventBridge/Scheduler.
- **Rationale**: Avoids additional AWS service cost and complexity. CRM users are active during business hours; polling every 5 minutes is acceptable.
- **Status**: Implemented. `scheduleMeetingReminder` creates notification; client polls `/api/notifications`.

## API & Security

### ADR-201: Soft Delete Instead of Hard Delete
- **Decision**: Disable DELETE endpoints for owners and properties (return 403 or skip route entirely).
- **Rationale**: Real estate records have legal/financial audit requirements. Data loss from accidental deletion is unacceptable.
- **Status**: Delete routes commented out in `crm.js`. No soft-delete status exists yet (gap).
- **Future**: Implement `status=archived` or `deletedAt` timestamp instead of 403.

### ADR-202: Presigned URLs Generated On-the-Fly
- **Decision**: Generate S3 presigned URLs at read-time in route handlers instead of storing public URLs in DynamoDB.
- **Rationale**: Reduces data exposure if URLs leak; allows fine-grained access control; URLs expire after 15 minutes.
- **Status**: Implemented across crm.js, buyers.js, developers.js.

### ADR-203: Image Upload One-at-a-Time, Videos Batched
- **Decision**: Frontend uploads images individually but videos in a single batch request.
- **Rationale**: API Gateway 10MB payload limit. Images can be large; one-at-a-time avoids partial failures. Videos are fewer and need atomic association with a property.
- **Status**: Implemented in PropertyDetails.tsx frontend guards.

### ADR-204: Public Property Endpoint Strips Owner Data
- **Decision**: Separate `/api/crm/properties/public/list` and `/api/crm/properties/public/:id` endpoints that explicitly remove `ownerId`, `owner`, and `ownerPhone` from response.
- **Rationale**: Prevents accidental PII exposure on public-facing property listing pages.
- **Status**: Implemented. `public/list` uses `getProperties` then maps over and destructures out ownerId.

## Frontend

### ADR-301: Capacitor for Mobile, Not React Native
- **Decision**: Use Capacitor to wrap the React web app for iOS/Android instead of maintaining a separate React Native codebase.
- **Rationale**: Team is web-first; most CRM features are form/data-heavy and work well as responsive web views. Single codebase for web + mobile.
- **Status**: Implemented. Capacitor 7.4.3 configured in real-estate-crm-app.

### ADR-302: No Global State Library (Context + Local State)
- **Decision**: Use React Context only for auth and Google Maps; all entity data fetched per-page via api.ts and stored in local component state.
- **Rationale**: CRM pages are independent dashboards/lists; cross-page state sharing is minimal. Avoids Redux/Zustand boilerplate.
- **Status**: Implemented. `AuthContext` + `GoogleMapsContext` only contexts. api.ts is a class with static methods.

## Operations

### ADR-401: Manual PowerShell Deployment Scripts
- **Decision**: Use `deploy-lambda.ps1` for backend deployment instead of GitHub Actions or AWS CodePipeline.
- **Rationale**: Simple stack, single developer team, and AWS credentials managed via CLI profiles. Avoids CI/CD infra complexity.
- **Status**: Implemented. PS script packages node_modules, uploads to S3, updates CloudFormation stack.
- **Risk**: Manual step, no rollback automation, no deployment approval gates.
