# Complete Lead Management — End-to-End Design

## Scope

This document covers **every lead-related operation** the AI agent must support, mapped to backend functions, tool schemas, and AI DTO views.

Nothing lead-related is left out.

---

## Complete Operation Inventory

### Lead CRUD

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 1 | Create lead | `create_lead` | `createLead(tenantId, data)` | `createConfirmation` |
| 2 | Get single lead | `get_lead` | `getLead(tenantId, leadId)` | `details` |
| 3 | Search leads | `search_leads` | `searchLeads(tenantId, query)` / `getLeads(tenantId, filters)` | `searchResults` |
| 4 | Update lead | `update_lead` | `updateLead(tenantId, leadId, data)` | `updateConfirmation` |
| 5 | Delete lead | `delete_lead` | `deleteLead(tenantId, leadId)` | `deleteConfirmation` |
| 6 | Full lead data | `get_lead` (with flag) | `getLead(tenantId, leadId)` | `full` |

### Lead Notes

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 7 | Add note | `create_lead_note` | `createLeadNote(tenantId, leadId, data)` | `noteCreateConfirmation` |
| 8 | List notes | `get_lead_notes` | `getLeadNotes(tenantId, leadId)` | `notesList` |
| 9 | Update note | `update_lead_note` | `updateLeadNote(tenantId, leadId, noteId, data)` | `noteUpdateConfirmation` |
| 10 | Delete note | `delete_lead_note` | `deleteLeadNote(tenantId, leadId, noteId)` | `noteDeleteConfirmation` |

### Lead Conversion

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 11 | Convert lead | `convert_lead` | `convertLead(tenantId, leadId, options)` | `conversionConfirmation` |

### Lead Meetings

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 12 | Create meeting | `create_meeting` | `createMeeting(tenantId, data)` | `meetingCreateConfirmation` |
| 13 | Get meeting | `get_meeting` | `getMeeting(tenantId, meetingId)` | `meetingDetails` |
| 14 | Upcoming meetings | `get_upcoming_meetings` | `getUpcomingMeetings(tenantId, days)` / `getMeetings(tenantId, filters)` | `meetingsList` |
| 15 | Update meeting | `update_meeting` | `updateMeeting(tenantId, meetingId, data)` | `meetingUpdateConfirmation` |
| 16 | Delete meeting | `delete_meeting` | `deleteMeeting(tenantId, meetingId)` | `meetingDeleteConfirmation` |

### Lead Metrics

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 17 | CRM metrics | `get_crm_metrics` | `getCRMMetrics(tenantId)` | `metricsSummary` |

### Rich Lead Queries (Phase K)

| # | Operation | Tool name | Backend function | AI view |
|---|---|---|---|---|
| 18 | Budget ranking | `search_leads` (with sortBy) | `getLeads(tenantId, {sortBy:'budget', sortOrder:'desc'})` | `budgetRanking` |
| 19 | Stale leads | `search_leads` (with filter) | `getLeads(tenantId, {stale:true})` | `staleLeads` |
| 20 | Priority ranking | `search_leads` (with sortBy) | `getLeads(tenantId, {sortBy:'priority', sortOrder:'desc'})` | `priorityRanking` |
| 21 | Follow-up queue | `search_leads` (with filter) | `getLeads(tenantId, {needsFollowUp:true})` | `followUpQueue` |
| 22 | Conversion candidates | `search_leads` (with filter) | `getLeads(tenantId, {readyToConvert:true})` | `conversionCandidates` |

---

## Data Sources in `crmDynamodbService.js`

All of these functions already exist and are tested. They must remain unchanged.

### Lead functions
```js
createLead(tenantId, data)
getLead(tenantId, leadId)
getLeads(tenantId, filters)
searchLeads(tenantId, query, filters)
updateLead(tenantId, leadId, data)
deleteLead(tenantId, leadId)
convertLead(tenantId, leadId, options)
```

### Lead note functions
```js
createLeadNote(tenantId, leadId, data)
getLeadNotes(tenantId, leadId)
updateLeadNote(tenantId, leadId, noteId, data)
deleteLeadNote(tenantId, leadId, noteId)
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
update_lead_note: {
  required: ['leadId', 'noteId', 'content'],
  types: { leadId: 'string', noteId: 'string', content: 'string' },
},
delete_lead_note: {
  required: ['leadId', 'noteId'],
  types: { leadId: 'string', noteId: 'string' },
  description: 'Delete a lead note. Confirm with the user before executing.',
},
get_meeting: {
  required: ['meetingId'],
  types: { meetingId: 'string' },
},
```

### Tool schemas to update

```js
// search_leads: add pagination + sort + responseMode
search_leads: {
  required: [],
  types: {
    query: 'string',
    status: 'string',
    leadType: 'string',
    priority: 'string',
    assignedTo: 'string',
    sortBy: 'string',        // createdAt | priority | budget | name | status | updatedAt
    sortOrder: 'string',     // asc | desc
    limit: 'number',
    offset: 'number',
    minBudget: 'number',
    maxBudget: 'number',
    fromDate: 'string',
    toDate: 'string',
    excludeConverted: 'boolean',
  },
  description: 'Search leads by name, phone, email, area, address, property type, or requirement. Supports filtering by status, leadType, priority, budget, date range, and sorting.',
},

// get_lead: add includeNotes and includeMeetings flags
get_lead: {
  required: ['leadId'],
  types: {
    leadId: 'string',
    includeNotes: 'boolean',     // default: true
    includeMeetings: 'boolean',  // default: false
    full: 'boolean',             // default: false — includes history
  },
},

// convert_lead: add conversion options
convert_lead: {
  required: ['leadId'],
  types: {
    leadId: 'string',
    existingContactId: 'string',
    purchaseDetails: 'object',   // for buyer conversion
    leaseDetails: 'object',      // for tenant conversion
    createPropertyListing: 'boolean', // for seller/owner conversion
    brokeragePaid: 'number',
  },
  nestedSchemas: {
    purchaseDetails: {
      propertyId: 'string',
      saleAmount: 'number',
      purchaseDate: 'string',
      registrationDate: 'string',
      registrationNumber: 'string',
      stampDutyPaid: 'number',
      brokeragePaid: 'number',
    },
    leaseDetails: {
      propertyId: 'string',
      leaseStartDate: 'string',
      leaseEndDate: 'string',
      monthlyRent: 'number',
      securityDeposit: 'number',
      brokeragePaid: 'number',
    },
  },
  description: 'Convert a lead to a buyer, seller, tenant, or owner entity. Requires phone on the lead. Confirm with the user before executing.',
},
```

---

## Complete AI DTO Views

### 1. `searchResults` (already designed)

See `LEAD_AI_DTO_CONTRACT.md`.

### 2. `details` (already designed)

See `LEAD_AI_DTO_CONTRACT.md`.

### 3. `createConfirmation` (already designed)

See `LEAD_AI_DTO_CONTRACT.md`.

### 4. `updateConfirmation` (already designed)

See `LEAD_AI_DTO_CONTRACT.md`.

### 5. `full` (already designed)

See `LEAD_AI_DTO_CONTRACT.md`.

### 6. `deleteConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "deleted"
  },
  "data": {
    "leadId": "lead-abc123",
    "name": "Ramesh Bedi",
    "leadType": "tenant"
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
    "leadId": "lead-abc123",
    "leadName": "Ashok Menon",
    "noteId": "note-xyz789",
    "content": "Called on 25 June — interested in 3BHK.",
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
      "content": "Called on 25 June — interested in 3BHK.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    },
    {
      "noteId": "note-abc456",
      "content": "Budget flexible up to ₹1.5 Cr.",
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
    "leadId": "lead-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Called on 25 June — very interested in 3BHK.",
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
    "leadId": "lead-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `conversionConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "converted",
    "convertedTo": "buyer"
  },
  "data": {
    "leadId": "lead-abc123",
    "leadName": "Ashok Menon",
    "leadType": "buyer",
    "convertedTo": "buyer",
    "contactId": "contact-def456",
    "entityId": "buyer-ghi789",
    "entityType": "buyer",
    "convertedAt": "2026-06-25"
  }
}
```

### 12. `meetingCreateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_created"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "relatedEntityType": "lead",
    "relatedEntityId": "lead-abc123",
    "location": "Vikhroli office",
    "attendees": ["Ashok Menon", "Faizan"]
  }
}
```

### 13. `meetingDetails` (NEW)

```json
{
  "metadata": {},
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok",
    "scheduledDate": "2026-06-28",
    "status": "scheduled",
    "location": "Vikhroli office",
    "description": "3BHK apartment viewing",
    "relatedEntityType": "lead",
    "relatedEntityId": "lead-abc123",
    "attendees": ["Ashok Menon", "Faizan"],
    "createdBy": "Faizan",
    "createdAt": "2026-06-25"
  }
}
```

### 14. `meetingsList` (NEW)

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
      "title": "Site visit with Ashok",
      "scheduledDate": "2026-06-28",
      "status": "scheduled",
      "relatedEntityType": "lead",
      "relatedEntityName": "Ashok Menon",
      "location": "Vikhroli office"
    },
    {
      "meetingId": "mtg-def456",
      "title": "Call with Neha",
      "scheduledDate": "2026-06-29",
      "status": "scheduled",
      "relatedEntityType": "lead",
      "relatedEntityName": "Neha Mehta",
      "location": null
    }
  ]
}
```

### 15. `meetingUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_updated",
    "updatedFields": ["scheduledDate", "status"]
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok",
    "scheduledDate": "2026-06-30",
    "status": "rescheduled"
  }
}
```

### 16. `meetingDeleteConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "meeting_deleted"
  },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok"
  }
}
```

### 17. `metricsSummary` (NEW)

```json
{
  "metadata": {},
  "data": {
    "leads": {
      "total": 132,
      "byType": {
        "buyer": 48,
        "seller": 21,
        "owner": 36,
        "tenant": 27
      },
      "byStatus": {
        "new": 40,
        "contacted": 30,
        "qualified": 20,
        "negotiating": 15,
        "lost": 27
      }
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

### 18. `budgetRanking` (NEW — Phase K)

```json
{
  "metadata": {
    "total": 18,
    "hasMore": false,
    "sortBy": "budget",
    "sortOrder": "desc"
  },
  "data": [
    {
      "name": "Ashok Menon",
      "leadType": "buyer",
      "status": "negotiating",
      "budget": "₹3.2 Cr",
      "area": "Churchgate"
    },
    {
      "name": "Raj Shah",
      "leadType": "buyer",
      "status": "new",
      "budget": "₹2.9 Cr",
      "area": "Bandra"
    }
  ]
}
```

### 19. `staleLeads` (NEW — Phase K)

```json
{
  "metadata": {
    "total": 8,
    "hasMore": false,
    "criteria": "no_update_30_days"
  },
  "data": [
    {
      "name": "Ashok Menon",
      "leadType": "buyer",
      "status": "negotiating",
      "lastActivityAt": "2026-04-15",
      "daysSinceUpdate": 72
    },
    {
      "name": "Rahul Shah",
      "leadType": "buyer",
      "status": "contacted",
      "lastActivityAt": "2026-04-21",
      "daysSinceUpdate": 66
    }
  ]
}
```

### 20. `priorityRanking` (NEW — Phase K)

```json
{
  "metadata": {
    "total": 12,
    "hasMore": false,
    "sortBy": "priority",
    "sortOrder": "desc"
  },
  "data": [
    {
      "name": "Geeta Chatterjee",
      "leadType": "buyer",
      "status": "lost",
      "priority": "high",
      "area": "Vikhroli"
    }
  ]
}
```

### 21. `followUpQueue` (NEW — Phase K)

```json
{
  "metadata": {
    "total": 6,
    "hasMore": false,
    "criteria": "needs_follow_up"
  },
  "data": [
    {
      "name": "Neha Mehta",
      "leadType": "owner",
      "status": "negotiating",
      "priority": "medium",
      "lastActivityAt": "2026-06-20",
      "daysSinceUpdate": 5
    }
  ]
}
```

### 22. `conversionCandidates` (NEW — Phase K)

```json
{
  "metadata": {
    "total": 4,
    "hasMore": false,
    "criteria": "qualified_with_phone"
  },
  "data": [
    {
      "name": "Ramesh Bedi",
      "leadType": "tenant",
      "status": "qualified",
      "phone": "7001062576",
      "area": "Pune Camp"
    }
  ]
}
```

---

## LeadAIViewBuilder — Complete API

### Lead views

```js
buildSearchResults(leads, pagination, options)
buildLeadDetails(lead, options)
buildCreateConfirmation(lead)
buildUpdateConfirmation(lead, updatedFields)
buildDeleteConfirmation(lead)
buildFullLead(lead)
```

### Note views

```js
buildNoteCreateConfirmation(lead, note)
buildNotesList(notes, pagination)
buildNoteUpdateConfirmation(lead, note)
buildNoteDeleteConfirmation(lead, noteId)
```

### Conversion views

```js
buildConversionConfirmation(lead, convertedEntity)
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

### Rich query views (Phase K)

```js
buildBudgetRanking(leads, pagination)
buildStaleLeads(leads, pagination)
buildPriorityRanking(leads, pagination)
buildFollowUpQueue(leads, pagination)
buildConversionCandidates(leads, pagination)
```

---

## MeetingAIViewBuilder — Separate File

Meetings are not lead-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

Therefore, meeting views should live in a separate file:

```
server/aiViewBuilders/meetingAIViewBuilder.js
```

The `LeadAIViewBuilder` can import and delegate to `MeetingAIViewBuilder` when a lead-related meeting operation is performed.

### MeetingAIViewBuilder API

```js
buildMeetingCreateConfirmation(meeting)
buildMeetingDetails(meeting, relatedEntityName)
buildMeetingsList(meetings, pagination, relatedEntityNames)
buildMeetingUpdateConfirmation(meeting, updatedFields)
buildMeetingDeleteConfirmation(meeting)
```

---

## LeadService — Complete API

```js
// Lead CRUD
searchLeads(tenantId, query, filters, options)
getLead(tenantId, leadId, options)  // options: { includeNotes, includeMeetings, full }
createLead(tenantId, data)
updateLead(tenantId, leadId, data)
deleteLead(tenantId, leadId)

// Lead notes
getLeadNotes(tenantId, leadId, options)  // options: { limit, offset }
createLeadNote(tenantId, leadId, data)
updateLeadNote(tenantId, leadId, noteId, data)
deleteLeadNote(tenantId, leadId, noteId)

// Lead conversion
convertLead(tenantId, leadId, options)

// Lead meetings (delegates to MeetingService)
getLeadMeetings(tenantId, leadId, options)
createLeadMeeting(tenantId, leadId, data)
updateLeadMeeting(tenantId, meetingId, data)
deleteLeadMeeting(tenantId, meetingId)

// Lead metrics
getLeadMetrics(tenantId)  // derived from getCRMMetrics

// Rich queries (Phase K)
getBudgetRanking(tenantId, options)
getStaleLeads(tenantId, daysThreshold, options)
getPriorityRanking(tenantId, options)
getFollowUpQueue(tenantId, options)
getConversionCandidates(tenantId, options)
```

---

## Tool-to-View Mapping

| Tool | LeadService method | View builder method | AI view |
|---|---|---|---|
| `create_lead` | `createLead` | `buildCreateConfirmation` | `createConfirmation` |
| `get_lead` | `getLead` | `buildLeadDetails` or `buildFullLead` | `details` or `full` |
| `search_leads` | `searchLeads` | `buildSearchResults` | `searchResults` |
| `update_lead` | `updateLead` | `buildUpdateConfirmation` | `updateConfirmation` |
| `delete_lead` | `deleteLead` | `buildDeleteConfirmation` | `deleteConfirmation` |
| `convert_lead` | `convertLead` | `buildConversionConfirmation` | `conversionConfirmation` |
| `create_lead_note` | `createLeadNote` | `buildNoteCreateConfirmation` | `noteCreateConfirmation` |
| `get_lead_notes` | `getLeadNotes` | `buildNotesList` | `notesList` |
| `update_lead_note` | `updateLeadNote` | `buildNoteUpdateConfirmation` | `noteUpdateConfirmation` |
| `delete_lead_note` | `deleteLeadNote` | `buildNoteDeleteConfirmation` | `noteDeleteConfirmation` |
| `create_meeting` | `createLeadMeeting` | `buildMeetingCreateConfirmation` | `meetingCreateConfirmation` |
| `get_meeting` | `getMeeting` | `buildMeetingDetails` | `meetingDetails` |
| `get_upcoming_meetings` | `getLeadMeetings` | `buildMeetingsList` | `meetingsList` |
| `update_meeting` | `updateLeadMeeting` | `buildMeetingUpdateConfirmation` | `meetingUpdateConfirmation` |
| `delete_meeting` | `deleteLeadMeeting` | `buildMeetingDeleteConfirmation` | `meetingDeleteConfirmation` |
| `get_crm_metrics` | `getLeadMetrics` | `buildMetricsSummary` | `metricsSummary` |

---

## Error DTOs

### Lead not found

```json
{
  "metadata": {
    "error": "lead_not_found",
    "message": "Lead not found"
  },
  "data": null
}
```

### Already converted

```json
{
  "metadata": {
    "error": "already_converted",
    "message": "Lead has already been converted"
  },
  "data": {
    "leadId": "lead-abc123",
    "convertedAt": "2026-06-20",
    "convertedTo": "buyer"
  }
}
```

### Cannot delete converted lead

```json
{
  "metadata": {
    "error": "cannot_delete_converted",
    "message": "Cannot delete a converted lead"
  },
  "data": {
    "leadId": "lead-abc123",
    "convertedAt": "2026-06-20"
  }
}
```

### Phone required for conversion

```json
{
  "metadata": {
    "error": "phone_required",
    "message": "Phone number is required to convert a lead"
  },
  "data": {
    "leadId": "lead-abc123",
    "leadName": "Ashok Menon"
  }
}
```

### Search returned no results

```json
{
  "metadata": {
    "total": 0,
    "hasMore": false
  },
  "data": []
}
```

---

## File Structure

```
server/
  services/
    leadService.js              # Lead business logic
    meetingService.js           # Meeting business logic (shared)
  normalizers/
    leadNormalizer.js           # Lead normalization
    meetingNormalizer.js        # Meeting normalization
  aiViewBuilders/
    leadAIViewBuilder.js        # Lead AI DTOs
    meetingAIViewBuilder.js     # Meeting AI DTOs (shared)
    metricsAIViewBuilder.js     # Metrics AI DTOs (shared)
  crmDynamodbService.js         # Untouched
  skillInvoker.js               # Updated tool schemas + wiring
```

---

## Version

v1.0 — 2026-06-26
