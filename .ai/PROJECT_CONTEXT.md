# Project Overview

**Cloudberry Real Estate CRM** — Multi-tenant SaaS for real estate agencies in India. Manages property listings, owners, tenants, buyers, leads, enquiries, Khata (ledger) bookkeeping, meetings, and AI-powered calling.

## System Architecture

- **Frontend**: React 18 SPA (Vite + TypeScript + TailwindCSS), deployed as static site. Capacitor wrapper for iOS/Android.
- **Backend**: Express.js 4 deployed as AWS Lambda via `@vendia/serverless-express`, behind API Gateway with custom domain.
- **Data**: DynamoDB single-table design per domain (core, CRM, enquiries, khata, developers, projects). 11 tables total. S3 for media/documents.
- **Auth**: JWT (24h expiry) + bcryptjs. Per-tenant admin configs in `cloudberry-real-estate-agencies` table.
- **Multi-tenancy**: Tenant ID passed via `x-tenant-id` header. Frontend `VITE_TENANT_ID` baked at build time.
- **Deployment**: Manual PowerShell script (`server/deploy-lambda.ps1`) packages code, uploads to S3, updates CloudFormation stack. No CI/CD pipeline.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3.1, Vite 5.4.2, TypeScript 5.5.3, TailwindCSS 3.4.1, React Router DOM 7.8.2 |
| Mobile | Capacitor 7.4.3 (iOS + Android) |
| Maps | @react-google-maps/api |
| Backend | Node.js 20.x, Express 4.18.2, @vendia/serverless-express 4.12.6 |
| Database | AWS DynamoDB (SDK v3), single-table per domain, PAY_PER_REQUEST |
| Storage | AWS S3 (media, documents, Lambda deployment artifacts) |
| Auth | jsonwebtoken + bcryptjs |
| Uploads | multer (memory storage) |
| Infra | AWS CloudFormation, API Gateway, Lambda (nodejs20.x), ap-south-1 |

## Current Focus (Top 3 Priorities)

1. **Complete CONTACT entity migration** — Auto-migrate legacy OWNER and CUSTOMER records to unified CONTACT on read. Deprecate separate OWNER/CUSTOMER GSIs.
2. **Add server-side pagination** — Replace ScanCommand + client-side filtering for CRM lists (leads, properties, contacts, owners). Currently only leads have pagination params.
3. **Implement soft-delete** — Replace disabled delete routes (403) with `status=archived` or `deletedAt` timestamp for owners and properties.

## Full Backlog

See `.ai/tasks.md` for complete prioritized backlog (high / medium / low / technical-debt / feature).