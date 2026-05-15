# Tasks

## High Priority
- [ ] Complete CONTACT entity migration: auto-migrate legacy OWNER and CUSTOMER records on read; deprecate separate OWNER/CUSTOMER GSIs
- [ ] Add rate limiting to public enquiry and B2B lead submission endpoints (prevent spam)
- [ ] Implement delete operations for owners/properties with soft-delete (status=deleted) instead of hard 403
- [ ] Replace manual ScanCommand in getMeetings with GSI query on GSI1PK (TENANT#t#MEETING_DATE#date) for performance
- [ ] Add server-side pagination for leads, properties, and contacts (currently all client-side scan + filter)

## Medium Priority
- [ ] Implement automated CI/CD pipeline (GitHub Actions or AWS CodePipeline) to replace deploy-lambda.ps1
- [ ] Add Lambda Provisioned Concurrency or caching layer for API Gateway cold starts
- [ ] Standardize error response format across all routes (some return {error}, others {success, message})
- [ ] Add input validation middleware (Joi/Zod) to all POST/PUT routes instead of inline checks
- [ ] Implement proper CORS preflight handling via API Gateway instead of lambda-handler workarounds
- [ ] Add request/response logging to CloudWatch with structured JSON (requestLogger is basic text)
- [ ] Create database backup/restore strategy for DynamoDB (Point-in-Time Recovery enabled but no documented restore flow)
- [ ] Add DynamoDB TTL for soft-deleted items and expired notifications

## Low Priority
- [ ] Migrate frontend from React Router DOM v7 to latest stable if needed
- [ ] Add E2E tests with Playwright for critical flows (login, property create, lead convert)
- [ ] Implement Progressive Web App (PWA) features for Capacitor web build
- [ ] Add real-time updates via API Gateway WebSockets or DynamoDB Streams for notifications
- [ ] Optimize S3 presigned URL generation (batch generation instead of per-item in loops)
- [ ] Add monitoring dashboard (CloudWatch alarms for Lambda errors, API Gateway 5xx)
- [ ] Document all environment variables in .env.example files (both frontend and backend)

## Technical Debt
- [ ] Remove commented-out delete routes in crm.js and buyers.js (clean code)
- [ ] Consolidate duplicate presigned URL logic across crm.js, buyers.js, developers.js into middleware or helper
- [ ] Refactor crmDynamodbService.js (~3600 lines) into domain-specific modules (contacts, leads, meetings, properties)
- [ ] Remove legacy dynamodbService.js flat entity types (FLAT, BUILDING, AREA) if fully migrated
- [ ] Standardize route response wrappers: all routes should use { success, data } or { error } consistently

## Feature Backlog
- [ ] Add SMS/WhatsApp notification integration for meeting reminders
- [ ] Implement property map view with clustering using Google Maps
- [ ] Add rental payment tracking (monthly rent collection status per property)
- [ ] Add document e-sign integration for agreements
- [ ] Implement role-based access control (RBAC) beyond single admin per tenant
