# Known Issues

## API & Performance
- **Scan-heavy queries**: `getMeetings`, `getContacts`, `getLeads`, `getBuyers`, `getOwners` all use `ScanCommand` on the CRM table. At scale this will hit DynamoDB throughput limits and slow down.
- **No pagination on CRM lists**: Server-side pagination exists only for leads (`limit`/`offset` params). Owners, customers, properties, contacts all return full table scans.
- **Inconsistent error formats**: CRM routes return `{ error: "..." }` while developers/projects routes return `{ success: false, message: "..." }`. Frontend must handle both shapes.
- **No rate limiting on public endpoints**: `/api/enquiries/contact` and `/api/b2b-leads` are open to spam/abuse.

## Data Integrity
- **Legacy entity drift**: `OWNER` and `CUSTOMER` entities still exist alongside unified `CONTACT`. `getOwners` backfills from contacts on every read, which is expensive and non-deterministic if contact data changes.
- **Lead conversion phone dedup**: `convertLead` deduplicates by phone, but if an existing contact has a different name than the lead, the contact name is overwritten (merge logic uses `existingContact.name || data.name`, so existing wins — but UI may show stale lead name after conversion).
- **Meeting reminder failures silently swallowed**: If `scheduleMeetingReminder` throws, the meeting is still created and the error is only logged to console.

## Security
- **Owner/property delete disabled but not soft-deleted**: Routes return 403 or are commented out. There is no `status=archived` or `deletedAt` field, so "deleted" owners/properties still appear in lists if fetched directly by ID.
- **Public property endpoint only strips top-level ownerId**: Nested `ownerPhone` inside property objects may still leak in some edge cases (depends on what `getProperties` returns).
- **JWT secret rotation**: No mechanism for rotating `JWT_SECRET` without invalidating all active sessions.

## Infrastructure
- **Manual deployment only**: `deploy-lambda.ps1` is the only deployment path. No rollback, no staging environment, no automated tests before deploy.
- **CloudFormation template has hardcoded resource names in some places**: Parameter defaults are set but some logical resource names may conflict if stack is redeployed to a different region.
- **No CloudWatch alarms**: No automated alerting for Lambda errors, API Gateway 5xx, or DynamoDB throttling.

## Frontend
- **Image upload one-at-a-time UX**: Users must upload images individually because of API Gateway 10MB limit, but the UI may not clearly indicate this restriction.
- **Video batch size guard is frontend-only**: The ~9MB total check in PropertyDetails.tsx can be bypassed if the API is called directly.
- **Tenant ID baked at build time**: `VITE_TENANT_ID` requires a separate frontend build per tenant; no runtime tenant switching.

## Mobile
- **Capacitor config may need platform-specific adjustments**: No documented iOS/Android build/release process in the repo.
