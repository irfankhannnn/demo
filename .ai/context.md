# Current State
- Active module: Multi-tenant CRM with unified CONTACT entity migration in progress
- Active issue: Legacy OWNER/CUSTOMER entities coexist with new CONTACT roles; migration helpers exist but not auto-triggered
- Environment: AWS ap-south-1, DynamoDB PAY_PER_REQUEST, API Gateway custom domain
- Frontend build: Vite-based React app deployed to static hosting (Netlify/CloudFront)
- Backend: Lambda + API Gateway via CloudFormation (server/cfn-template.yaml)
- Auth: JWT tokens 24h expiry, per-tenant admin configs in AgencyConfig table
- Tenant ID: Set at build time via VITE_TENANT_ID env var

## Recently Implemented
- Unified CONTACT entity with roles (owner/seller/buyer/tenant)
- Lead conversion pipeline with deduplication by phone
- Property lifecycle (available -> on_hold -> rented -> for-sale -> sold)
- Khata ledger contextual navigation from Owner/Tenant/Buyer/Property details
- Meeting scheduler with 15-min reminders and history tracking
- AI Calling module (dashboard, start call, call history, knowledge base)
- Buyer project interest tracking for developer project sales
- Owner document upload (photo, PAN, Aadhar) with presigned URLs
- Public property list endpoint (no owner data exposed)

## Migration Status
- SELLER entity removed from codebase; sellers now OWNERS + properties for-sale
- Legacy BUYER and CUSTOMER still active in crmDynamodbService alongside CONTACT
- Migration helpers (migrateOwnerToContact, migrateCustomerToContact) exist but manual

## Known Limitations
- Delete operations disabled for owners/properties (routes commented out returning 403)
- Frontend image uploads restricted to 1 at a time; video batch restricted to ~9MB total
- API Gateway 10MB limit enforced at frontend; no Lambda streaming
- No automated deployment pipeline (manual PS scripts)
- No rate limiting on public enquiry/B2B endpoints

# Notes
- Keep this updated frequently