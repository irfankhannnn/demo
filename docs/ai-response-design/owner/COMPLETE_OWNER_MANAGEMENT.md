# Complete Owner Management — End-to-End Design

## Scope

This document covers **every owner-related operation** the AI agent must support, mapped to backend functions, tool schemas, and AI DTO views.

Nothing owner-related is left out.

---

## Complete Operation Inventory

### Owner CRUD

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 1 | Create owner | `create_owner` | `createOwner(tenantId, data)` | `createConfirmation` |
| 2 | Get single owner | `get_owner` | `getOwner(tenantId, ownerId)` | `details` |
| 3 | Get owners (list with filters) | `get_owners` | `getOwners(tenantId, filters)` | `searchResults` |
| 4 | Search owners (by name/phone) | `search_owners` | `searchOwners(tenantId, query)` | `searchResults` |
| 5 | Update owner | `update_owner` | `updateOwner(tenantId, ownerId, data)` | `updateConfirmation` |
| 6 | Deactivate owner | `update_owner` (with status=inactive) | `updateOwner(tenantId, ownerId, {status:'inactive'})` | `deactivateConfirmation` |
| 7 | Full owner data | `get_owner` (with flag) | `getOwner(tenantId, ownerId)` | `full` |

### Owner Notes

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 8 | Add note | `create_owner_note` | `createOwnerNote(tenantId, ownerId, data)` | `noteCreateConfirmation` |
| 9 | List notes | `get_owner_notes` | `getOwnerNotes(tenantId, ownerId)` | `notesList` |
| 10 | Update note | `update_owner_note` | `updateOwnerNote(tenantId, ownerId, noteId, data)` | `noteUpdateConfirmation` |
| 11 | Delete note | `delete_owner_note` | `deleteOwnerNote(tenantId, ownerId, noteId)` | `noteDeleteConfirmation` |

### Owner Properties

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 12 | Get owner's properties | `get_owner_properties` | `getPropertiesByOwner(tenantId, ownerId)` | `ownerPropertiesList` |

### Owner Phone Lookup

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 13 | Lookup owner by phone | `get_owner_by_phone` | `getOwnerByPhone(tenantId, phone)` | `phoneLookupResult` |

### Owner Meetings (shared)

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 14 | Create meeting | `create_meeting` | `createMeeting(tenantId, data)` | `meetingCreateConfirmation` |
| 15 | Get meeting | `get_meeting` | `getMeeting(tenantId, meetingId)` | `meetingDetails` |
| 16 | Upcoming meetings | `get_upcoming_meetings` | `getUpcomingMeetings(tenantId, days)` / `getMeetings(tenantId, filters)` | `meetingsList` |
| 17 | Update meeting | `update_meeting` | `updateMeeting(tenantId, meetingId, data)` | `meetingUpdateConfirmation` |
| 18 | Delete meeting | `delete_meeting` | `deleteMeeting(tenantId, meetingId)` | `meetingDeleteConfirmation` |

### Owner Metrics (shared)

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 19 | CRM metrics | `get_crm_metrics` | `getCRMMetrics(tenantId)` | `metricsSummary` |

---

## Data Sources in `crmDynamodbService.js`

All of these functions already exist and are tested. They must remain unchanged.

### Owner functions
```js
createOwner(tenantId, data)
getOwner(tenantId, ownerId)
getOwners(tenantId, filters)
searchOwners(tenantId, query)
updateOwner(tenantId, ownerId, data)
deleteOwner(tenantId, ownerId)              // exists but DELETE endpoint is DISABLED in REST API
getOwnerByPhone(tenantId, phone)            // normalizes phone, matches last 10 digits
createOrUpdateOwnerByPhone(tenantId, data)  // deduplication via phone
getPropertiesByOwner(tenantId, ownerId)     // queries GSI1 (owner-property-index)
migrateOwnerToContact(tenantId, ownerId)
```

### Owner note functions
```js
createOwnerNote(tenantId, ownerId, data)
getOwnerNotes(tenantId, ownerId)            // fallback to PROFILE_NOTES if no NOTE items
updateOwnerNote(tenantId, ownerId, noteId, data)
deleteOwnerNote(tenantId, ownerId, noteId)
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
update_owner_note: {
  required: ['ownerId', 'noteId', 'content'],
  types: { ownerId: 'string', noteId: 'string', content: 'string' },
},
delete_owner_note: {
  required: ['ownerId', 'noteId'],
  types: { ownerId: 'string', noteId: 'string' },
  description: 'Delete an owner note. Confirm with the user before executing.',
},
get_owner_properties: {
  required: ['ownerId'],
  types: { ownerId: 'string' },
  description: 'Get all properties owned by a specific owner.',
},
search_owners: {
  required: ['query'],
  types: { query: 'string' },
  description: 'Search owners by name or phone. Use this for free-text search. Use get_owners for filter-based listing.',
},
```

### Tool schemas to update

```js
// get_owners: add all filter parameters + pagination + sort + responseMode
get_owners: {
  required: [],
  types: {
    status: 'string',          // active | inactive
    source: 'string',
    area: 'string',
    search: 'string',
    createdFrom: 'string',
    createdTo: 'string',
    hasProperties: 'boolean',
    seller: 'boolean',
    propertyType: 'string',
    listingType: 'string',
    bhk: 'string',
    furnishing: 'string',
    minProperties: 'number',
    maxProperties: 'number',
    tag: 'string',
    hasPAN: 'boolean',
    hasAadhar: 'boolean',
    hasBankDetails: 'boolean',
    sortBy: 'string',          // createdAt | name | status | source | updatedAt
    sortOrder: 'string',       // asc | desc
    limit: 'number',
    offset: 'number',
    responseMode: 'string',    // summary | compact | details | full
  },
  description: 'List owners with filters. Supports status, source, area, date range, property filters, KYC filters, tags, sorting, and pagination.',
},

// get_owner: add includeNotes and includeProperties flags
get_owner: {
  required: ['ownerId'],
  types: {
    ownerId: 'string',
    includeNotes: 'boolean',        // default: true
    includeProperties: 'boolean',   // default: false
    full: 'boolean',                // default: false — includes KYC, bank details, all properties
  },
},

// create_owner: add full field set
create_owner: {
  required: ['name', 'phone'],
  types: {
    name: 'string',
    phone: 'string',
    email: 'string',
    address: 'string',
    source: 'string',
    notes: 'string',
    tags: 'array',
    panNumber: 'string',
    aadharNumber: 'string',
    bankName: 'string',
    accountNumber: 'string',
    ifscCode: 'string',
  },
  description: 'Create a new owner. Name and phone are required. Use get_owner_by_phone first to check for duplicates.',
},
```

---

## Complete AI DTO Views

### 1. `searchResults` (already designed)

See `OWNER_AI_DTO_CONTRACT.md`.

### 2. `details` (already designed)

See `OWNER_AI_DTO_CONTRACT.md`.

### 3. `createConfirmation` (already designed)

See `OWNER_AI_DTO_CONTRACT.md`.

### 4. `updateConfirmation` (already designed)

See `OWNER_AI_DTO_CONTRACT.md`.

### 5. `full` (already designed)

See `OWNER_AI_DTO_CONTRACT.md`.

### 6. `deactivateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "deactivated"
  },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
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
    "ownerId": "owner-abc123",
    "ownerName": "Rajesh Kumar",
    "noteId": "note-xyz789",
    "content": "Met on 25 June — interested in listing 3BHK.",
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
      "content": "Met on 25 June — interested in listing 3BHK.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    },
    {
      "noteId": "note-abc456",
      "content": "Owner confirmed bank details for rental payouts.",
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
    "ownerId": "owner-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Met on 25 June — very interested in listing 3BHK in Bandra.",
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
    "ownerId": "owner-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `ownerPropertiesList` (NEW)

```json
{
  "metadata": {
    "total": 3,
    "hasMore": false
  },
  "data": [
    {
      "propertyId": "prop-abc123",
      "title": "3BHK Apartment in Bandra West",
      "propertyType": "Apartment",
      "bhk": 3,
      "area": "Bandra West",
      "listingType": "sale",
      "expectedPrice": "₹4.5 Cr",
      "status": "available"
    },
    {
      "propertyId": "prop-def456",
      "title": "2BHK Flat in Andheri East",
      "propertyType": "Apartment",
      "bhk": 2,
      "area": "Andheri East",
      "listingType": "rent",
      "rentExpected": "₹45k",
      "status": "rented"
    }
  ]
}
```

### 12. `phoneLookupResult` (NEW)

```json
{
  "metadata": {
    "action": "phone_lookup",
    "found": true
  },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
    "phone": "9876543210",
    "status": "active",
    "propertyCount": 3,
    "existingOwner": true
  }
}
```

When no owner is found:

```json
{
  "metadata": {
    "action": "phone_lookup",
    "found": false
  },
  "data": {
    "phone": "9876543210",
    "existingOwner": false
  }
}
```

### 13. `meetingCreateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_created"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "relatedEntityType": "owner",
    "relatedEntityId": "owner-abc123",
    "location": "Bandra office",
    "attendees": ["Rajesh Kumar", "Faizan"]
  }
}
```

### 14. `meetingDetails` (NEW)

```json
{
  "metadata": {},
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "location": "Bandra office",
    "description": "Discuss listing 3BHK in Bandra West",
    "relatedEntityType": "owner",
    "relatedEntityId": "owner-abc123",
    "attendees": ["Rajesh Kumar", "Faizan"],
    "createdBy": "Faizan",
    "createdAt": "2026-06-25"
  }
}
```

### 15. `meetingsList` (NEW)

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
      "title": "Property discussion with Rajesh",
      "scheduledDate": "2026-06-28",
      "status": "scheduled",
      "relatedEntityType": "owner",
      "relatedEntityName": "Rajesh Kumar",
      "location": "Bandra office"
    },
    {
      "meetingId": "mtg-def456",
      "title": "Call with Priya",
      "scheduledDate": "2026-06-29",
      "status": "scheduled",
      "relatedEntityType": "owner",
      "relatedEntityName": "Priya Sharma",
      "location": null
    }
  ]
}
```

### 16. `meetingUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_updated",
    "updatedFields": ["scheduledDate", "status"]
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh",
    "scheduledDate": "2026-06-30",
    "status": "rescheduled"
  }
}
```

### 17. `meetingDeleteConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_deleted"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh"
  }
}
```

---

## OwnerAIViewBuilder — Complete API

### Owner views

```js
buildSearchResults(owners, pagination, options)
buildOwnerDetails(owner, options)
buildCreateConfirmation(owner)
buildUpdateConfirmation(owner, updatedFields)
buildDeactivateConfirmation(owner)
buildFullOwner(owner)
```

### Note views

```js
buildNoteCreateConfirmation(owner, note)
buildNotesList(notes, pagination)
buildNoteUpdateConfirmation(owner, note)
buildNoteDeleteConfirmation(owner, noteId)
```

### Property views

```js
buildOwnerPropertiesList(properties, pagination)
```

### Phone lookup views

```js
buildPhoneLookupResult(owner, phone)
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

Meetings are not owner-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

Therefore, meeting views should live in a separate file:

```
apps/crm/server/aiViewBuilders/meetingAIViewBuilder.js
```

The `OwnerAIViewBuilder` can import and delegate to `MeetingAIViewBuilder` when an owner-related meeting operation is performed.

### MeetingAIViewBuilder API

```js
buildMeetingCreateConfirmation(meeting)
buildMeetingDetails(meeting, relatedEntityName)
buildMeetingsList(meetings, pagination, relatedEntityNames)
buildMeetingUpdateConfirmation(meeting, updatedFields)
buildMeetingDeleteConfirmation(meeting)
```

---

## OwnerService — Complete API

```js
// Owner CRUD
getOwners(tenantId, filters, options)
searchOwners(tenantId, query, options)
getOwner(tenantId, ownerId, options)  // options: { includeNotes, includeProperties, full }
createOwner(tenantId, data)
updateOwner(tenantId, ownerId, data)
deactivateOwner(tenantId, ownerId)    // sets status=inactive

// Owner phone lookup
getOwnerByPhone(tenantId, phone)
createOrUpdateOwnerByPhone(tenantId, data)  // deduplication

// Owner notes
getOwnerNotes(tenantId, ownerId, options)  // options: { limit, offset }
createOwnerNote(tenantId, ownerId, data)
updateOwnerNote(tenantId, ownerId, noteId, data)
deleteOwnerNote(tenantId, ownerId, noteId)

// Owner properties
getOwnerProperties(tenantId, ownerId)

// Owner meetings (delegates to MeetingService)
getOwnerMeetings(tenantId, ownerId, options)
createOwnerMeeting(tenantId, ownerId, data)
updateOwnerMeeting(tenantId, meetingId, data)
deleteOwnerMeeting(tenantId, meetingId)

// Owner metrics
getOwnerMetrics(tenantId)  // derived from getCRMMetrics

// Owner migration
migrateOwnerToContact(tenantId, ownerId)
```

---

## Tool-to-View Mapping

| Tool | OwnerService method | View builder method | AI view |
|---|---|---|---|
| `create_owner` | `createOwner` | `buildCreateConfirmation` | `createConfirmation` |
| `get_owner` | `getOwner` | `buildOwnerDetails` or `buildFullOwner` | `details` or `full` |
| `get_owners` | `getOwners` | `buildSearchResults` | `searchResults` |
| `search_owners` | `searchOwners` | `buildSearchResults` | `searchResults` |
| `update_owner` | `updateOwner` | `buildUpdateConfirmation` | `updateConfirmation` |
| `update_owner` (status=inactive) | `deactivateOwner` | `buildDeactivateConfirmation` | `deactivateConfirmation` |
| `delete_owner` | `deactivateOwner` | `buildDeactivateConfirmation` | `deactivateConfirmation` |
| `get_owner_by_phone` | `getOwnerByPhone` | `buildPhoneLookupResult` | `phoneLookupResult` |
| `create_owner_note` | `createOwnerNote` | `buildNoteCreateConfirmation` | `noteCreateConfirmation` |
| `get_owner_notes` | `getOwnerNotes` | `buildNotesList` | `notesList` |
| `update_owner_note` | `updateOwnerNote` | `buildNoteUpdateConfirmation` | `noteUpdateConfirmation` |
| `delete_owner_note` | `deleteOwnerNote` | `buildNoteDeleteConfirmation` | `noteDeleteConfirmation` |
| `get_owner_properties` | `getOwnerProperties` | `buildOwnerPropertiesList` | `ownerPropertiesList` |
| `create_meeting` | `createOwnerMeeting` | `buildMeetingCreateConfirmation` | `meetingCreateConfirmation` |
| `get_meeting` | `getMeeting` | `buildMeetingDetails` | `meetingDetails` |
| `get_upcoming_meetings` | `getOwnerMeetings` | `buildMeetingsList` | `meetingsList` |
| `update_meeting` | `updateOwnerMeeting` | `buildMeetingUpdateConfirmation` | `meetingUpdateConfirmation` |
| `delete_meeting` | `deleteOwnerMeeting` | `buildMeetingDeleteConfirmation` | `meetingDeleteConfirmation` |
| `get_crm_metrics` | `getOwnerMetrics` | `buildMetricsSummary` | `metricsSummary` |

---

## Error DTOs

### Owner not found

```json
{
  "metadata": {
    "error": "owner_not_found",
    "message": "Owner not found"
  },
  "data": null
}
```

### Already exists by phone

```json
{
  "metadata": {
    "error": "already_exists_by_phone",
    "message": "An owner with this phone number already exists"
  },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
    "phone": "9876543210"
  }
}
```

### Cannot delete owner

```json
{
  "metadata": {
    "error": "cannot_delete_owner",
    "message": "Owner deletion is disabled. Use status=inactive to deactivate instead."
  },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar"
  }
}
```

### Phone required

```json
{
  "metadata": {
    "error": "phone_required",
    "message": "Phone number is required to create an owner"
  },
  "data": {
    "name": "Rajesh Kumar"
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
    "message": "The PROFILE_NOTES item cannot be modified or deleted directly"
  },
  "data": {
    "ownerId": "owner-abc123",
    "noteId": "PROFILE_NOTES"
  }
}
```

---

## File Structure

```
apps/crm/server/
  services/
    ownerService.js              # Owner business logic
    meetingService.js            # Meeting business logic (shared)
  normalizers/
    ownerNormalizer.js           # Owner normalization
    meetingNormalizer.js         # Meeting normalization
  aiViewBuilders/
    ownerAIViewBuilder.js        # Owner AI DTOs
    meetingAIViewBuilder.js      # Meeting AI DTOs (shared)
    metricsAIViewBuilder.js      # Metrics AI DTOs (shared)
  crmDynamodbService.js          # Untouched
  skillInvoker.js                # Updated tool schemas + wiring
```

---

## Version

v1.0 — 2026-06-26
