# API Contracts

## Auth

### POST /api/auth/login
**Auth**: None  
**Headers**: `x-tenant-id` (optional)  
**Body**:
```json
{
  "username": "string",
  "password": "string"
}
```
**Response**:
```json
{
  "token": "jwt",
  "user": { "id": "tenantId|null", "username": "string", "tenantId": "string|null" }
}
```
**Behavior**: If `x-tenant-id` is provided, looks up `AgencyConfig` table for tenant-specific admin. Falls back to global admin in core table.

### POST /api/auth/change-password
**Auth**: Bearer token  
**Body**: `{ "currentPassword", "newPassword" }`  
**Response**: `{ "message": "Password changed successfully" }`

## CRM — Customers

### GET /api/crm/customers
**Auth**: Bearer + `x-tenant-id` (required)  
**Response**: Array of CUSTOMER entities

### GET /api/crm/customers/lookup/by-phone?phone=...
**Auth**: Bearer + tenant  
**Response**: `{ found: boolean, customer: object|null }`

### GET /api/crm/customers/:id
**Auth**: Bearer + tenant  
**Response**: Single CUSTOMER entity

### POST /api/crm/customers
**Auth**: Bearer + tenant  
**Body**: `{ name, phone, email?, address?, requirement?, budget?, preferredArea?, status?, notes? }`  
**Response**: Created CUSTOMER

### PUT /api/crm/customers/:id
**Auth**: Bearer + tenant  
**Body**: Partial update fields  
**Response**: Updated CUSTOMER

### GET|POST|PUT|DELETE /api/crm/customers/:id/notes
**Auth**: Bearer + tenant  
Standard note CRUD with `{ content, createdBy }`

## CRM — Owners

### GET /api/crm/owners
**Auth**: Bearer + tenant  
**Response**: `{ owners: Owner[], sellerCount: number }`  
**Behavior**: Enriches each owner with `propertyCount`. Backfills legacy contacts into owners if missing.

### GET /api/crm/owners/:id
**Auth**: Bearer + tenant  
**Response**: Single OWNER with property count

### POST /api/crm/owners
**Auth**: Bearer + tenant  
**Body**: `{ name, phone, email?, address?, panNumber?, aadharNumber?, bankName?, accountNumber?, ifscCode?, notes?, tags?, source?, status? }`  
**Response**: Created OWNER

### PUT /api/crm/owners/:id
**Auth**: Bearer + tenant  
**Body**: Partial update  
**Response**: Updated OWNER

### GET /api/crm/owners/lookup/by-phone?phone=...
**Auth**: Bearer + tenant  
**Response**: `{ found: boolean, owner: object|null }` with presigned URLs for photo, PAN, Aadhar docs.

### POST /api/crm/owners/:id/documents
**Auth**: Bearer + tenant  
**Content-Type**: multipart/form-data  
**Fields**: `photo` (max 1), `pan` (max 1), `aadhar` (max 1)  
**Response**: Updated OWNER with `photoUrl`, `panDocUrl`, `aadharDocUrl`

### GET /api/crm/owners/:id/properties
**Auth**: Bearer + tenant  
**Response**: Properties owned by this owner with presigned image/video URLs

### GET|POST|PUT|DELETE /api/crm/owners/:id/notes
Standard note CRUD.

## CRM — Properties

### GET /api/crm/properties
**Auth**: Bearer + tenant  
**Query**: `?status=` optional filter  
**Response**: Array of properties enriched with owner, tenant, and presigned image/video URLs

### GET /api/crm/properties/public/list
**Auth**: None (tenant optional)  
**Query**: `?status=` optional  
**Response**: Properties with images/videos but **ownerId stripped** for privacy

### GET /api/crm/properties/:id
**Auth**: Bearer + tenant  
**Response**: Property with owner, tenant, images, videos

### GET /api/crm/properties/public/:id
**Auth**: None (tenant required)  
**Response**: Property with images/videos, ownerId stripped. Increments view count.

### POST /api/crm/properties
**Auth**: Bearer + tenant  
**Body**: `{ title, area, city, address, propertyType, bhk?, furnishing?, rentAmount?, deposit?, status?, ownerId?, ownerName?, ownerPhone?, images?, videos? ... }`  
**Response**: Created PROPERTY

### PUT /api/crm/properties/:id
**Auth**: Bearer + tenant  
**Body**: Partial update  
**Response**: Updated PROPERTY

### POST /api/crm/properties/:id/images
**Auth**: Bearer + tenant  
**Content-Type**: multipart/form-data  
**Field**: `images` (max 10 files, frontend restricts to 1 at a time)  
**Response**: `{ message, images: [s3Keys] }`

### POST /api/crm/properties/:id/videos
**Auth**: Bearer + tenant  
**Content-Type**: multipart/form-data  
**Field**: `videos` (max 5 files)  
**Response**: `{ message, videos: [s3Keys] }`

### DELETE /api/crm/properties/:id/images/:key
**Auth**: Bearer + tenant  
**Response**: `{ message: "Image deleted successfully" }`

### DELETE /api/crm/properties/:id/videos/:key
**Auth**: Bearer + tenant  
**Response**: `{ message: "Video deleted successfully" }`

## CRM — Leads

### GET /api/crm/leads
**Auth**: Bearer + tenant  
**Query**: `?leadType=buyer|seller|tenant|owner&status=&priority=`  
**Response**: Array of LEAD entities

### GET /api/crm/leads/metrics
**Auth**: Bearer + tenant  
**Response**: `{ total, byType: {}, byStatus: {}, convertedCount, conversionRate }`

### GET /api/crm/leads/:id
**Auth**: Bearer + tenant  
**Response**: Single LEAD with history and notes

### POST /api/crm/leads
**Auth**: Bearer + tenant  
**Body**: `{ name, phone, email?, leadType, source?, status?, priority?, assignedTo?, buyerRequirement?, sellerProperty?, tenantRequirement?, ownerProperty?, notes? }`  
**Response**: Created LEAD

### PUT /api/crm/leads/:id
**Auth**: Bearer + tenant  
**Body**: Partial update (status changes append to history array)  
**Response**: Updated LEAD

### POST /api/crm/leads/:id/convert
**Auth**: Bearer + tenant  
**Body**: `{ purchaseDetails?, leaseDetails?, kycDetails?, existingContactId?, createPropertyListing? }`  
**Response**: `{ lead, entity, entityType }`  
**Behavior**: Converts lead to CONTACT/OWNER/BUYER/CUSTOMER based on leadType. Seller leads auto-create a property listing if `createPropertyListing` is not false.

### DELETE /api/crm/leads/:id
**Auth**: Bearer + tenant  
**Behavior**: Rejects deletion if lead is already converted.

## CRM — Buyers

### GET /api/crm/buyers
**Auth**: Bearer + tenant  
**Query**: `?status=&priority=&propertyType=`  
**Response**: Array of BUYER entities (legacy + CONTACTs with buyer role, deduped by phone)

### GET /api/crm/buyers/:id
**Auth**: Bearer + tenant  
**Response**: Single BUYER with `interestedProjects`

### POST /api/crm/buyers
**Auth**: Bearer + tenant  
**Body**: `{ name, phone, email?, address?, panNumber?, aadharNumber?, purchases?, status?, notes?, tags?, source? }`  
**Response**: Created BUYER with cross-role info if phone exists elsewhere

### PUT /api/crm/buyers/:id
**Auth**: Bearer + tenant  
**Body**: Partial update of whitelisted fields  
**Response**: Updated BUYER

## CRM — Contacts (Unified)

### GET /api/crm/contacts
**Auth**: Bearer + tenant  
**Query**: `?role=owner|seller|buyer|tenant&status=`  
**Response**: Array of CONTACT entities

### GET /api/crm/contacts/:id
**Auth**: Bearer + tenant  
**Response**: Single CONTACT with roles and profile sub-objects

### POST /api/crm/contacts
**Auth**: Bearer + tenant  
**Body**: `{ name, phone, email?, address?, roles: {owner,seller,buyer,tenant}, ownerProfile?, sellerProfile?, buyerProfile?, tenantProfile?, panNumber?, aadharNumber?, bankName?, accountNumber?, ifscCode?, notes?, tags?, source?, status? }`  
**Response**: Created CONTACT

### PUT /api/crm/contacts/:id
**Auth**: Bearer + tenant  
**Body**: Partial update (protected keys: PK, SK, EntityType, tenantId, contactId, createdAt)  
**Response**: Updated CONTACT

### PUT /api/crm/contacts/:id/role
**Auth**: Bearer + tenant  
**Body**: `{ role, enabled: boolean, profileData? }`  
**Response**: Updated CONTACT

## CRM — Meetings

### GET /api/crm/meetings
**Auth**: Bearer + tenant  
**Query**: `?startDate=&endDate=&status=`  
**Response**: Array of MEETING entities sorted by date/time

### GET /api/crm/meetings/upcoming
**Auth**: Bearer + tenant  
**Query**: `?days=7` (default 7)  
**Response**: Scheduled meetings in date range

### GET /api/crm/meetings/:id
**Auth**: Bearer + tenant  
**Response**: Single MEETING with history events

### POST /api/crm/meetings
**Auth**: Bearer + tenant  
**Body**: `{ title, meetingDate, meetingTime, duration?, location?, relatedEntityType, relatedEntityId, relatedEntityName?, relatedEntityPhone?, attendeeName?, attendeePhone?, attendeeEmail?, notes?, createdBy? }`  
**Response**: Created MEETING with scheduled reminder notification

### PUT /api/crm/meetings/:id
**Auth**: Bearer + tenant  
**Body**: Partial update (status/date/time changes create history events; reminders rescheduled/cancelled)  
**Response**: Updated MEETING

### DELETE /api/crm/meetings/:id
**Auth**: Bearer + tenant  
**Response**: `true`

## Khata (Ledger)

### GET /api/khata/parties/search
**Auth**: None (tenant required via header)  
**Query**: `?q=searchText&partyType=OWNER|TENANT|BUYER|SELLER`  
**Response**: Array of matching parties with deduplication

### GET /api/khata/properties
**Auth**: Bearer + tenant  
**Query**: `?partyId=&partyType=`  
**Response**: Properties associated with the party

### GET|POST /api/khata/entries
Ledger entry CRUD for a party + property.

### GET|POST /api/khata/settlements
Batch settlement of ledger entries.

## Enquiries

### POST /api/enquiries/contact
**Auth**: None (public)  
**Body**: `{ name, email?, phone, message, userType?, propertyType?, wantPropertyManagement? }`  
**Response**: `{ success: true, message, enquiryId }`

### GET /api/enquiries
**Auth**: Bearer + tenant  
**Response**: Array of enquiries

### GET|POST|PUT /api/enquiries/:id/notes
Enquiry note management.

## Notifications

### GET /api/notifications
**Auth**: Bearer + tenant  
**Response**: Array of notifications, sorted by createdAt desc

### PUT /api/notifications/:id/read
**Auth**: Bearer + tenant  
**Response**: Mark single notification as read

### PUT /api/notifications/read-all
**Auth**: Bearer + tenant  
**Response**: Mark all unread as read

## B2B Leads

### POST /api/b2b-leads
**Auth**: None (public)  
**Body**: `{ name, email, phone, company?, message?, interestedIn?, budget?, timeline? }`  
**Response**: `{ success: true, leadId }`

### GET /api/b2b-leads
**Auth**: Bearer + tenant  
**Response**: Array of B2B leads

## Developers & Projects

### GET /api/crm/developers
**Auth**: Bearer + tenant  
**Query**: `?status=&featured=&verified=&visibility=&limit=&offset=`  
**Response**: `{ success, data, count }`

### GET /api/crm/developers/:id
**Auth**: Bearer + tenant  
**Response**: `{ success, data }` with projects

### GET /api/crm/projects
**Auth**: Bearer + tenant  
**Query**: `?status=&developerId=&areaId=&projectType=&propertyCategory=&constructionStatus=&handoverYear=&city=&country=&featured=&trending=&newLaunch=&soldOut=&priceMin=&priceMax=&sortBy=&sortOrder=&limit=&offset=`  
**Response**: `{ success, data, count }`

### GET /api/crm/projects/:id
**Auth**: Bearer + tenant  
**Response**: `{ success, data }` with presigned media URLs

## AI Calling

### GET /api/internal/ai-calling/dashboard
**Auth**: Bearer + tenant  
**Response**: AI calling metrics and recent sessions

### POST /api/internal/ai-calling/start
**Auth**: Bearer + tenant  
**Body**: `{ phone, script?, knowledgeBaseId?, schedule? }`  
**Response**: `{ sessionId, status }`

### GET /api/internal/ai-calling/history
**Auth**: Bearer + tenant  
**Response**: Past call sessions

### GET|POST|PUT /api/internal/ai-calling/knowledge
Knowledge base CRUD for AI scripts.

## Legacy Core API (flats.js, areasBuildings.js)

Still active but considered legacy:
- `GET|POST /api/flats` — Flat listings with owner/tenant assignment
- `GET|POST /api/buildings` — Building management
- `GET|POST /api/areas` — Area management
- `GET /api/areas/public` — Public area listings (no auth)

## Common Response Patterns

**Success (CRM routes)**: `200 OK` with entity array or object.  
**Success (developers/projects)**: `200 OK` `{ success: true, data, count? }`.  
**Error (CRM)**: `500` `{ error: "message" }` or `400/404` `{ error: "message" }`.  
**Error (dev/projects)**: `500` `{ success: false, message: "..." }`.
