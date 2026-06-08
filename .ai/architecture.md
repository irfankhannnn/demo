# Architecture

## System Overview
Cloudberry Real Estate CRM is a multi-tenant property management platform for real estate agencies. It manages property listings, owners, tenants, buyers, lead pipelines, enquiries, Khata bookkeeping, meetings/calendar, and AI-powered calling.

## Tech Stack

**Frontend**
- React 18.3.1 + Vite 5.4.2 + TypeScript 5.5.3
- React Router DOM 7.8.2
- TailwindCSS 3.4.1 + Lucide React icons
- Capacitor 7.4.3 (iOS + Android)
- @react-google-maps/api for maps/places

**Backend**
- Express 4.18.2 on AWS Lambda via @vendia/serverless-express 4.12.6
- DynamoDB single-table design per domain
- S3 for media/documents
- JWT auth + bcryptjs
- multer for file uploads (memory storage)

**Infrastructure**
- CloudFormation (server/cfn-template.yaml)
- API Gateway with custom domains + explicit route mappings
- Lambda runtime: nodejs20.x
- Region: ap-south-1

## Data Model

### DynamoDB Tables
| Table | Purpose |
|-------|---------|
| cloudberry-real-estate-core | Legacy property/building/flat/area data |
| cloudberry-real-estate-crm | Multi-tenant CRM (customers, owners, buyers, properties, leads, contacts, meetings, notes) |
| cloudberry-real-estate-agencies | Per-tenant admin credentials |
| cloudberry-real-estate-areas | Area/community profiles with banners |
| cloudberry-real-estate-enquiries | Contact form submissions |
| cloudberry-real-estate-b2b-details | B2B partnership leads |
| cloudberry-real-estate-khata | Ledger transactions |
| cloudberry-real-estate-notifications | In-app alerts & reminders |
| cloudberry-real-estate-developers | Developer profiles |
| cloudberry-real-estate-communities | Area/community details |
| cloudberry-real-estate-projects | Real estate projects |

### CRM Entity Types
- CUSTOMER (tenant/renter)
- OWNER
- BUYER
- PROPERTY (rentalInfo, saleInfo sub-objects)
- LEAD (pipeline: new -> contacted -> qualified -> negotiating -> converted/lost)
- CONTACT (unified person with roles: owner/seller/buyer/tenant)
- MEETING (calendar events linked to entities)
- NOTE (discussion threads)
- PROPERTY_AGREEMENT, PROPERTY_VERIFICATION, PROPERTY_DOCUMENT

### CRM GSIs
- owner-property-index (GSI1): query properties by owner
- status-index (GSI2): query properties by status
- search-index (GSI3): text search across entities

## Backend Routes

| Route File | Base Path | Auth |
|------------|-----------|------|
| auth.js | /api/auth | Optional (tenant-aware) |
| crm.js | /api/crm | JWT + tenant |
| leads.js | /api/crm/leads | JWT + tenant |
| buyers.js | /api/crm/buyers | JWT + tenant |
| contacts.js | /api/crm/contacts | JWT + tenant |
| khata.js | /api/khata | JWT + tenant |
| enquiries.js | /api/enquiries | Mixed (public contact form + private mgmt) |
| b2bLeads.js | /api | Mixed |
| developers.js | /api/crm/developers | JWT + tenant |
| realEstateAreas.js | /api/crm/real-estate-areas | JWT + tenant |
| projects.js | /api/crm/projects | JWT + tenant |
| notifications.js | /api/notifications | JWT + tenant |
| aiCallingInternal.js | /api/internal | JWT + tenant |
| flats.js | /api/flats | JWT |
| areasBuildings.js | /api | JWT |
| publicAreas.js | /api/areas/public | None |

## Auth & Multi-Tenancy

1. Login: POST /api/auth/login with username, password, optional x-tenant-id
2. If tenantId provided: lookup AgencyConfig table for tenant-specific admin
3. Fallback to global admin in core table
4. JWT token returned; stored in localStorage as admin_token
5. All requests send Authorization: Bearer <token> + x-tenant-id
6. CRM DynamoDB keys prefixed with TENANT#{tenantId}#
7. Frontend VITE_TENANT_ID hardcoded at build time

## Media Handling
- Images: uploaded individually to avoid API Gateway 10MB limit; stored in S3 under crm/properties/images/{tenantId}/
- Videos: batched with ~9MB frontend guard; stored under crm/properties/videos/{tenantId}/
- KYC docs: owner/customer/buyer PAN, Aadhar, photos under crm/{entity}/documents/{tenantId}/
- Presigned URLs generated on-the-fly (photoUrl, panDocUrl, etc.)

## Key Frontend Pages
- /crm (dashboard)
- /crm/tenants, /crm/owners, /crm/buyers, /crm/leads
- /crm/properties, /crm/hierarchy, /crm/rented-properties
- /crm/khata, /crm/khata/new, /crm/khata/settlement
- /crm/developers, /crm/real-estate-areas, /crm/projects
- /crm/calendar, /crm/analytics, /crm/b2b-leads
- /crm/ai-calling/* (dashboard, start, history, knowledge, settings)
- /login, /settings, /profile

## Deployment
- Frontend: vite build -> static hosting
- Backend: server/deploy-lambda.ps1 packages code, uploads to S3, deploys CFN stack
- API Gateway custom domain: services-api.cloudberrysolutions.in
- Local dev: node server.js (port 3001), npm run dev (Vite)
