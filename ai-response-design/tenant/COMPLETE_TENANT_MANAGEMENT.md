# Complete Tenant Management — End-to-End Design

## Scope

This document covers **every tenant-related operation** the AI agent must support, mapped to backend functions, tool schemas, and AI DTO views.

The backend entity is `customer` (with `customerId`), but the AI agent tool names and views use `tenant` for consistency. The API endpoints are `/api/crm/customers`.

Nothing tenant-related is left out.

---

## Complete Operation Inventory

### Tenant CRUD

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 1 | Create tenant | `create_tenant` | `createCustomer(tenantId, data)` | `createConfirmation` |
| 2 | Get single tenant | `get_tenant` | `getCustomer(tenantId, customerId)` | `details` |
| 3 | Get tenants (list with filters) | `search_tenants` | `getCustomers(tenantId, filters)` | `searchResults` |
| 4 | Search tenants (by name/phone) | `search_tenants` | `searchCustomers(tenantId, query)` | `searchResults` |
| 5 | Update tenant | `update_tenant` | `updateCustomer(tenantId, customerId, data)` | `updateConfirmation` |
| 6 | Deactivate tenant | `update_tenant` (with status=inactive) | `updateCustomer(tenantId, customerId, {status:'inactive'})` | `deactivateConfirmation` |
| 7 | Full tenant data | `get_tenant` (with flag) | `getCustomer(tenantId, customerId)` | `full` |

### Tenant Rental

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 8 | Get rental history | `get_tenant_rental_history` | `getCustomer(tenantId, customerId)` | `rentalHistory` |
| 9 | Update current rental | `update_tenant_current_rental` | `updateCurrentRental(tenantId, customerId, rentalDetails)` | `currentRentalUpdateConfirmation` |
| 10 | Archive current rental | `archive_tenant_rental` | `moveTenantToHistory(tenantId, customerId)` | `rentalArchiveConfirmation` |

### Tenant Notes

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 11 | Add note | `create_tenant_note` | `createCustomerNote(tenantId, customerId, data)` | `noteCreateConfirmation` |
| 12 | List notes | `get_tenant_notes` | `getCustomerNotes(tenantId, customerId)` | `notesList` |
| 13 | Update note | `update_tenant_note` | `updateCustomerNote(tenantId, customerId, noteId, data)` | `noteUpdateConfirmation` |
| 14 | Delete note | `delete_tenant_note` | `deleteCustomerNote(tenantId, customerId, noteId)` | `noteDeleteConfirmation` |

### Tenant Meetings (shared)

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 15 | Create meeting | `create_meeting` | `createMeeting(tenantId, data)` | `meetingCreateConfirmation` |
| 16 | Get meeting | `get_meeting` | `getMeeting(tenantId, meetingId)` | `meetingDetails` |
| 17 | Upcoming meetings | `get_upcoming_meetings` | `getUpcomingMeetings(tenantId, days)` / `getMeetings(tenantId, filters)` | `meetingsList` |
| 18 | Update meeting | `update_meeting` | `updateMeeting(tenantId, meetingId, data)` | `meetingUpdateConfirmation` |
| 19 | Delete meeting | `delete_meeting` | `deleteMeeting(tenantId, meetingId)` | `meetingDeleteConfirmation` |

### Tenant Metrics (shared)

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 20 | CRM metrics | `get_crm_metrics` | `getCRMMetrics(tenantId)` | `metricsSummary` |

---

## Data Sources in `crmDynamodbService.js`

All of these functions already exist and are tested. They must remain unchanged.

### Tenant functions
```js
createCustomer(tenantId, data)
getCustomer(tenantId, customerId)
getCustomers(tenantId, filters)
searchCustomers(tenantId, query)
updateCustomer(tenantId, customerId, data)
deleteCustomer(tenantId, customerId)              // exists but prefer status=inactive
getCustomerByPhone(tenantId, phone)               // normalizes phone, matches last 10 digits
createOrUpdateCustomerByPhone(tenantId, data)     // deduplication via phone
migrateCustomerToContact(tenantId, customerId)
```

### Tenant note functions
```js
createCustomerNote(tenantId, customerId, data)
getCustomerNotes(tenantId, customerId)            // fallback to PROFILE_NOTES if no NOTE items
updateCustomerNote(tenantId, customerId, noteId, data)
deleteCustomerNote(tenantId, customerId, noteId)
```

### Rental helper functions (crmHelpers.js)
```js
updateCurrentRental(tenantId, customerId, rentalDetails)
moveTenantToHistory(tenantId, customerId)
markPropertyRented(tenantId, propertyId, customerId, rentalDetails, sourceRef)
vacateProperty(tenantId, propertyId)
```

### Meeting functions
```js
createMeeting(tenantId, data)
getMeeting(tenantId, meetingId)
getMeetings(tenantId, filters)
getUpcomingMeetings(tenantId, days)
getMeetingsByEntity(tenantId, entityType, entityId)
updateMeeting(tenantId, meetingId, data)
deleteMeeting(tenantId, meetingId)
```

### Metrics functions
```js
getCRMMetrics(tenantId)
getMeetingMetrics(tenantId)
```

---

## Tool Schemas to Add or Update

### Missing tool schemas in `skillInvoker.js`

The following tools exist in the backend but are NOT exposed in `TOOL_SCHEMAS`:

```js
// Missing from TOOL_SCHEMAS:
update_tenant_note: {
  required: ['tenantRecordId', 'noteId', 'content'],
  types: { tenantRecordId: 'string', noteId: 'string', content: 'string' },
},
delete_tenant_note: {
  required: ['tenantRecordId', 'noteId'],
  types: { tenantRecordId: 'string', noteId: 'string' },
  description: 'Delete a tenant note. Confirm with the user before executing.',
},
get_tenant_rental_history: {
  required: ['tenantRecordId'],
  types: { tenantRecordId: 'string' },
  description: 'Get the rental history and current rental for a tenant.',
},
update_tenant_current_rental: {
  required: ['tenantRecordId', 'propertyId', 'monthlyRent'],
  types: {
    tenantRecordId: 'string',
    propertyId: 'string',
    leaseStartDate: 'string',
    leaseEndDate: 'string',
    monthlyRent: 'number',
    securityDeposit: 'number',
  },
  description: 'Update the current rental for a tenant.',
},
archive_tenant_rental: {
  required: ['tenantRecordId'],
  types: { tenantRecordId: 'string' },
  description: 'Archive the current rental into rental history. Confirm with the user before executing.',
},
```

### Tool schemas to update

```js
// create_tenant: phone should be required
// Note: Backend createCustomer requires both name AND phone. Current schema only requires name.
create_tenant: {
  required: ['name', 'phone'],
  types: {
    name: 'string',
    phone: 'string',
    email: 'string',
    address: 'string',
    source: 'string',
    notes: 'string',
    tags: 'array',
    aadharNumber: 'string',
  },
  description: 'Create a new tenant. Name and phone are required. Use get_tenant_by_phone first to check for duplicates.',
},

// search_tenants: add all filter parameters + pagination + sort + responseMode
search_tenants: {
  required: [],
  types: {
    query: 'string',
    status: 'string',              // active | inactive | past
    source: 'string',
    area: 'string',
    search: 'string',
    tag: 'string',
    hasCurrentRental: 'boolean',
    hasRentalHistory: 'boolean',
    leaseEndingWithinDays: 'number',
    propertyId: 'string',
    monthlyRentMin: 'number',
    monthlyRentMax: 'number',
    createdFrom: 'string',
    createdTo: 'string',
    sortBy: 'string',              // createdAt | name | status | updatedAt | monthlyRent | leaseEndDate
    sortOrder: 'string',           // asc | desc
    limit: 'number',
    offset: 'number',
    responseMode: 'string',        // summary | compact | details | full
  },
  description: 'List or search tenants. Supports free-text query, filters by status, area, rental status, date range, rent range, sorting, and pagination.',
},

// get_tenant: add includeNotes and includeRental flags
get_tenant: {
  required: ['tenantRecordId'],
  types: {
    tenantRecordId: 'string',
    includeNotes: 'boolean',       // default: true
    includeRental: 'boolean',      // default: true
    full: 'boolean',               // default: false — includes KYC, rental history, S3 keys
  },
},

// update_tenant: add full field set
update_tenant: {
  required: ['tenantRecordId'],
  types: {
    tenantRecordId: 'string',
    name: 'string',
    phone: 'string',
    email: 'string',
    address: 'string',
    status: 'string',
    source: 'string',
    notes: 'string',
    tags: 'array',
    aadharNumber: 'string',
  },
  description: 'Update a tenant. Use status=inactive to deactivate.',
},

// delete_tenant: keep but note it is discouraged; prefer status=inactive
delete_tenant: {
  required: ['tenantRecordId'],
  types: { tenantRecordId: 'string' },
  description: 'Permanently delete a tenant. Not recommended. Prefer status=inactive. Confirm with the user before executing.',
},
```

---

## Complete AI DTO Views

### 1. `searchResults` (already designed)

See `TENANT_AI_DTO_CONTRACT.md`.

### 2. `details` (already designed)

See `TENANT_AI_DTO_CONTRACT.md`.

### 3. `createConfirmation` (already designed)

See `TENANT_AI_DTO_CONTRACT.md`.

### 4. `updateConfirmation` (already designed)

See `TENANT_AI_DTO_CONTRACT.md`.

### 5. `full` (already designed)

See `TENANT_AI_DTO_CONTRACT.md`.

### 6. `deactivateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "deactivated"
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "inactive"
  }
}
```

### 7. `noteCreateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "note_added"
  },
  "data": {
    "customerId": "cust-abc123",
    "tenantName": "Sarah Gupta",
    "noteId": "note-xyz789",
    "content": "Called on 25 June — rent paid on time.",
    "createdAt": "2026-06-25"
  }
}
```

### 8. `notesList` (NEW)

```json
{
  "metadata": {
    "total": 23,
    "shown": 5,
    "hasMore": true
  },
  "data": [
    {
      "noteId": "note-xyz789",
      "content": "Called on 25 June — rent paid on time.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    },
    {
      "noteId": "note-abc456",
      "content": "Aadhar submitted for verification.",
      "createdBy": "system",
      "createdAt": "2026-06-24"
    }
  ]
}
```

### 9. `noteUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "note_updated"
  },
  "data": {
    "customerId": "cust-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Called on 25 June — rent paid early.",
    "updatedAt": "2026-06-25"
  }
}
```

### 10. `noteDeleteConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "note_deleted"
  },
  "data": {
    "customerId": "cust-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `rentalHistory` (NEW)

```json
{
  "metadata": {
    "current": true,
    "historyCount": 2
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "currentRental": {
      "propertyId": "prop-abc123",
      "propertyName": "2BHK in Andheri East",
      "leaseStartDate": "2026-01-01",
      "leaseEndDate": "2026-12-31",
      "monthlyRent": "₹50k",
      "securityDeposit": "₹1 L",
      "status": "active"
    },
    "rentalHistory": [
      {
        "propertyId": "prop-def456",
        "propertyName": "1BHK in Bandra",
        "leaseStartDate": "2025-01-01",
        "leaseEndDate": "2025-12-31",
        "monthlyRent": "₹40k",
        "securityDeposit": "₹80k",
        "status": "past"
      }
    ]
  }
}
```

### 12. `currentRentalUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "rental_updated"
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "currentRental": {
      "propertyId": "prop-abc123",
      "propertyName": "2BHK in Andheri East",
      "leaseStartDate": "2026-01-01",
      "leaseEndDate": "2027-01-01",
      "monthlyRent": "₹55k",
      "securityDeposit": "₹1.1 L"
    }
  }
}
```

### 13. `rentalArchiveConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "rental_archived"
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "archivedRental": {
      "propertyId": "prop-abc123",
      "propertyName": "2BHK in Andheri East",
      "leaseStartDate": "2026-01-01",
      "leaseEndDate": "2026-06-25",
      "monthlyRent": "₹50k",
      "securityDeposit": "₹1 L"
    }
  }
}
```

### 14. `meetingCreateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_created"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Rent renewal discussion",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "relatedEntityType": "customer",
    "relatedEntityId": "cust-abc123",
    "location": "Office",
    "attendees": ["Sarah Gupta", "Faizan"]
  }
}
```

### 15. `meetingDetails` (NEW)

```json
{
  "metadata": {},
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Rent renewal discussion",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "location": "Office",
    "description": "Discuss renewal terms",
    "relatedEntityType": "customer",
    "relatedEntityId": "cust-abc123",
    "attendees": ["Sarah Gupta", "Faizan"],
    "createdBy": "Faizan",
    "createdAt": "2026-06-25"
  }
}
```

### 16. `meetingsList` (NEW)

```json
{
  "metadata": {
    "total": 5,
    "days": 7,
    "hasMore": false
  },
  "data": [
    {
      "meetingId": "mtg-abc123",
      "title": "Rent renewal discussion",
      "scheduledDate": "2026-06-28",
      "status": "scheduled",
      "relatedEntityType": "customer",
      "relatedEntityName": "Sarah Gupta",
      "location": "Office"
    }
  ]
}
```

### 17. `meetingUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_updated",
    "updatedFields": ["scheduledDate"]
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Rent renewal discussion",
    "scheduledDate": "2026-06-30",
    "status": "rescheduled"
  }
}
```

### 18. `meetingDeleteConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_deleted"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Rent renewal discussion"
  }
}
```

### 19. `metricsSummary` (NEW)

```json
{
  "metadata": {},
  "data": {
    "tenants": {
      "total": 45,
      "active": 38,
      "inactive": 5,
      "past": 2
    },
    "meetings": {
      "upcoming": 5,
      "completed": 12,
      "cancelled": 2
    },
    "properties": {
      "total": 80,
      "available": 45,
      "sold": 15,
      "rented": 20
    }
  }
}
```

### 20. `phoneLookupResult` (NEW)

Used when looking up a tenant by phone number.

```json
{
  "metadata": {},
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "phone": "9876543210",
    "status": "active",
    "found": true
  }
}
```

If no tenant is found:

```json
{
  "metadata": {},
  "data": {
    "phone": "9876543210",
    "found": false
  }
}
```

---

## TenantAIViewBuilder — Complete API

### Tenant views

```js
buildSearchResults(tenants, pagination, options)
buildTenantDetails(tenant, options)
buildCreateConfirmation(tenant)
buildUpdateConfirmation(tenant, updatedFields)
buildDeactivateConfirmation(tenant)
buildFullTenant(tenant)
buildPhoneLookupResult(tenant, phone)
```

### Rental views

```js
buildRentalHistory(tenant)
buildCurrentRentalUpdateConfirmation(tenant, rentalDetails)
buildRentalArchiveConfirmation(tenant, archivedRental)
```

### Note views

```js
buildNoteCreateConfirmation(tenant, note)
buildNotesList(notes, pagination)
buildNoteUpdateConfirmation(tenant, note)
buildNoteDeleteConfirmation(tenant, noteId)
```

### Meeting views

```js
buildMeetingCreateConfirmation(meeting)
buildMeetingDetails(meeting, relatedEntityName)
buildMeetingsList(meetings, pagination, relatedEntityNames)
buildMeetingUpdateConfirmation(meeting, updatedFields)
buildMeetingDeleteConfirmation(meeting)
```

### Metrics views

```js
buildMetricsSummary(metrics)
```

---

## MeetingAIViewBuilder — Separate File

Meetings are not tenant-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

Therefore, meeting views should live in a separate file:

```
server/aiViewBuilders/meetingAIViewBuilder.js
```

The `TenantAIViewBuilder` can import and delegate to `MeetingAIViewBuilder` when a tenant-related meeting operation is performed.

See `leads/LEAD_AI_VIEW_BUILDER.md` for the full `MeetingAIViewBuilder` API.

---

## TenantService — Complete API

```js
// Tenant CRUD
searchTenants(tenantId, query, filters, options)
getTenant(tenantId, customerId, options)  // options: { includeNotes, includeRental, full }
createTenant(tenantId, data)
updateTenant(tenantId, customerId, data)
deactivateTenant(tenantId, customerId)

// Tenant notes
getTenantNotes(tenantId, customerId, options)
createTenantNote(tenantId, customerId, data)
updateTenantNote(tenantId, customerId, noteId, data)
deleteTenantNote(tenantId, customerId, noteId)

// Tenant rental
getTenantRentalHistory(tenantId, customerId)
updateCurrentRental(tenantId, customerId, rentalDetails)
archiveTenantRental(tenantId, customerId)

// Tenant phone lookup
getTenantByPhone(tenantId, phone)

// Tenant metrics
getTenantMetrics(tenantId)  // derived from getCRMMetrics

// Rich queries (Phase K)
getTenantsWithLeaseEnding(tenantId, days, options)
getTenantsWithoutKYC(tenantId, options)
getTenantsByRentRange(tenantId, minRent, maxRent, options)
```

---

## Tool-to-View Mapping

| Tool | Service method | View builder method | AI view |
|---|---|---|---|
| `create_tenant` | `TenantService.createTenant` | `buildCreateConfirmation` | `createConfirmation` |
| `get_tenant` | `TenantService.getTenant` | `buildTenantDetails` or `buildFullTenant` | `details` or `full` |
| `search_tenants` | `TenantService.searchTenants` | `buildSearchResults` | `searchResults` |
| `update_tenant` | `TenantService.updateTenant` | `buildUpdateConfirmation` | `updateConfirmation` |
| `delete_tenant` | `TenantService.deactivateTenant` | `buildDeactivateConfirmation` | `deactivateConfirmation` |
| `get_tenant_by_phone` | `TenantService.getTenantByPhone` | `buildPhoneLookupResult` | `phoneLookupResult` |
| `create_tenant_note` | `TenantService.createTenantNote` | `buildNoteCreateConfirmation` | `noteCreateConfirmation` |
| `get_tenant_notes` | `TenantService.getTenantNotes` | `buildNotesList` | `notesList` |
| `update_tenant_note` | `TenantService.updateTenantNote` | `buildNoteUpdateConfirmation` | `noteUpdateConfirmation` |
| `delete_tenant_note` | `TenantService.deleteTenantNote` | `buildNoteDeleteConfirmation` | `noteDeleteConfirmation` |
| `get_tenant_rental_history` | `TenantService.getTenantRentalHistory` | `buildRentalHistory` | `rentalHistory` |
| `update_tenant_current_rental` | `TenantService.updateCurrentRental` | `buildCurrentRentalUpdateConfirmation` | `currentRentalUpdateConfirmation` |
| `archive_tenant_rental` | `TenantService.archiveTenantRental` | `buildRentalArchiveConfirmation` | `rentalArchiveConfirmation` |
| `create_meeting` | `MeetingService.createMeeting` | `buildMeetingCreateConfirmation` | `meetingCreateConfirmation` |
| `get_meeting` | `MeetingService.getMeeting` | `buildMeetingDetails` | `meetingDetails` |
| `get_upcoming_meetings` | `MeetingService.getUpcomingMeetings` | `buildMeetingsList` | `meetingsList` |
| `update_meeting` | `MeetingService.updateMeeting` | `buildMeetingUpdateConfirmation` | `meetingUpdateConfirmation` |
| `delete_meeting` | `MeetingService.deleteMeeting` | `buildMeetingDeleteConfirmation` | `meetingDeleteConfirmation` |
| `get_crm_metrics` | `TenantService.getTenantMetrics` | `buildMetricsSummary` | `metricsSummary` |

---

## Error DTOs

### Tenant not found

```json
{
  "metadata": {
    "error": "tenant_not_found",
    "message": "Tenant not found"
  },
  "data": { "customerId": "cust-abc123" }
}
```

### Phone required

```json
{
  "metadata": {
    "error": "phone_required",
    "message": "Phone number is required to create a tenant"
  },
  "data": { "name": "Sarah Gupta" }
}
```

### Name required

```json
{
  "metadata": {
    "error": "name_required",
    "message": "Name is required to create a tenant"
  },
  "data": null
}
```

### Duplicate phone

```json
{
  "metadata": {
    "error": "duplicate_phone",
    "message": "A tenant with this phone number already exists"
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "phone": "9876543210"
  }
}
```

### Empty search

```json
{
  "metadata": {
    "total": 0,
    "hasMore": false
  },
  "data": []
}
```

### Profile notes protected

```json
{
  "metadata": {
    "error": "profile_notes_protected",
    "message": "The system-generated profile note cannot be edited or deleted"
  },
  "data": { "noteId": "PROFILE_NOTES" }
}
```

### Rental required

```json
{
  "metadata": {
    "error": "rental_required",
    "message": "Tenant does not have an active rental to archive"
  },
  "data": { "customerId": "cust-abc123" }
}
```

---

## File Structure

```
server/
  services/
    tenantService.js              # Tenant business logic
  normalizers/
    tenantNormalizer.js           # Tenant normalization
  aiViewBuilders/
    tenantAIViewBuilder.js        # Tenant AI DTOs
    meetingAIViewBuilder.js       # Meeting AI DTOs (shared)
  crmDynamodbService.js           # Untouched
  crmHelpers.js                   # Untouched
  skillInvoker.js                 # Updated tool schemas + wiring
```

---

## Version

v1.0 — 2026-06-26
