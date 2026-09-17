# LeadAIViewBuilder API

## Purpose

`LeadAIViewBuilder` is a projection layer that transforms normalized lead domain models into AI-friendly DTOs.

It covers **all lead management operations**: CRUD, notes, conversion, meetings, metrics, and rich queries.

It does not contain business logic. It does not generate English text. It only decides which fields to expose for a given AI interaction.

For the complete operation inventory, see `COMPLETE_LEAD_MANAGEMENT.md`.

---

## Location

```
server/viewBuilders/leadAIViewBuilder.js
```

Or, if preferred:

```
agency-app/api/aiViewBuilders/leadAIViewBuilder.js
```

---

## Naming

We use `LeadAIViewBuilder` instead of `LeadViewBuilder` to make it explicit that this is for AI consumption only, not a universal presentation contract.

---

## API

### Core Method

```js
export function buildLeadAIResponse({ view, lead, leads, metadata, pagination }) {
  // ...
}
```

Parameters:
- `view` (string): One of `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`.
- `lead` (object): Single lead domain model.
- `leads` (array): Array of lead domain models.
- `metadata` (object): Additional context (pagination, action, updatedFields).
- `pagination` (object): `{ total, page, pageSize, hasMore, nextCursor }`.

Returns:
- `{ metadata, data }` DTO.

---

### Explicit Helper Methods

```js
export function buildSearchResults(leads, pagination, options = {}) {
  // Returns searchResults DTO
}

export function buildLeadDetails(lead, options = {}) {
  // Returns details DTO
}

export function buildCreateConfirmation(lead) {
  // Returns createConfirmation DTO
}

export function buildUpdateConfirmation(lead, updatedFields) {
  // Returns updateConfirmation DTO
}

export function buildFullLead(lead) {
  // Returns full DTO
}
```

---

## Implementation Sketch

```js
import { formatMoney } from './utils.js';

export function buildSearchResults(leads, pagination, options = {}) {
  return {
    metadata: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore: pagination.hasMore,
      nextCursor: pagination.nextCursor,
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      priority: lead.priority,
      area: deriveArea(lead),
      propertyType: derivePropertyType(lead),
      bhk: formatBhk(deriveBhk(lead)),
      budget: formatMoney(deriveBudget(lead)),
    })),
  };
}

export function buildLeadDetails(lead, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;

  return {
    metadata: {
      notes: includeNotes ? {
        total: lead.notes?.length || 0,
        shown: Math.min(maxNotes, lead.notes?.length || 0),
        hasMore: (lead.notes?.length || 0) > maxNotes,
      } : null,
    },
    data: {
      leadId: lead.leadId,
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      priority: lead.priority,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      assignedTo: lead.assignedTo,
      createdAt: formatDate(lead.createdAt),
      requirement: buildRequirement(lead),
      notes: includeNotes ? (lead.notes || []).slice(0, maxNotes).map(n => n.content || n.text) : undefined,
    },
  };
}

export function buildCreateConfirmation(lead) {
  return {
    metadata: { action: 'created' },
    data: {
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      phone: lead.phone,
      area: deriveArea(lead),
      leadId: lead.leadId,
    },
  };
}

export function buildUpdateConfirmation(lead, updatedFields) {
  return {
    metadata: {
      action: 'updated',
      updatedFields: Object.keys(updatedFields || {}),
    },
    data: {
      leadId: lead.leadId,
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
    },
  };
}

export function buildFullLead(lead) {
  return {
    metadata: { view: 'full' },
    data: {
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      priority: lead.priority,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      assignedTo: lead.assignedTo,
      createdAt: formatDate(lead.createdAt),
      updatedAt: formatDate(lead.updatedAt),
      requirement: buildRequirement(lead),
      notes: (lead.notes || []).map(n => n.content || n.text),
      history: lead.history || [],
    },
  };
}
```

---

## Helper Functions

### `formatDate(value)`

```js
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
```

### `deriveArea(lead)`

Returns the location from the active requirement object regardless of lead type.

```js
function deriveArea(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};
  return req.preferredArea || req.area || req.city || null;
}
```

### `derivePropertyType(lead)`

```js
function derivePropertyType(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};
  return req.propertyType || null;
}
```

### `deriveBhk(lead)`

```js
function deriveBhk(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};
  return req.bhk || null;
}
```

### `deriveBudget(lead)`

```js
function deriveBudget(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};
  return req.budget || req.expectedPrice || req.rentExpected || null;
}
```

### `buildRequirement(lead)`

Flattens the active requirement into a consistent shape.

```js
function buildRequirement(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};

  const common = {
    propertyType: req.propertyType || null,
    bhk: req.bhk || null,
    furnishing: req.furnishing || null,
  };

  if (!lead.leadType) {
    return {
      ...common,
      budget: null,
      preferredArea: null,
      requirement: null,
    };
  }

  if (lead.leadType === 'buyer' || lead.leadType === 'tenant') {
    return {
      ...common,
      budget: formatMoney(req.budget),
      preferredArea: req.preferredArea || null,
      requirement: req.requirement || null,
    };
  }

  if (lead.leadType === 'seller') {
    return {
      ...common,
      expectedPrice: formatMoney(req.expectedPrice),
      area: req.area || null,
      city: req.city || null,
      buildingName: req.buildingName || null,
      flatNumber: req.flatNumber || null,
      floor: req.floor || null,
      carpetArea: req.carpetArea || null,
      address: req.address || null,
    };
  }

  if (lead.leadType === 'owner') {
    return {
      ...common,
      rentExpected: formatMoney(req.rentExpected),
      securityDeposit: formatMoney(req.securityDeposit),
      area: req.area || null,
      city: req.city || null,
      buildingName: req.buildingName || null,
      flatNumber: req.flatNumber || null,
      floor: req.floor || null,
      carpetArea: req.carpetArea || null,
      address: req.address || null,
    };
  }

  // Unknown or unrecognized leadType: return minimal common fields
  return {
    ...common,
    budget: null,
    preferredArea: null,
    requirement: null,
  };
}
```

### `formatBhk(bhk)`

```js
function formatBhk(bhk) {
  if (!bhk) return null;
  return `${bhk} BHK`;
}
```

### `formatMoney(value)`

Uses compact Indian currency formatting.

```js
function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;

  const crore = 10000000;
  const lakh = 100000;
  const thousand = 1000;

  if (Math.abs(num) >= crore) return `₹${(num / crore).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (Math.abs(num) >= lakh) return `₹${(num / lakh).toFixed(2).replace(/\.?0+$/, '')}L`;
  if (Math.abs(num) >= thousand) return `₹${(num / thousand).toFixed(1).replace(/\.?0+$/, '')}k`;
  return `₹${num.toLocaleString('en-IN')}`;
}
```

---

## Internal Field Removal

Before any lead reaches the view builder, the following should be removed:

```js
const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
];
```

This can be done in `LeadNormalizer` or directly at the boundary of `LeadAIViewBuilder`.

---

## Tests

The view builder should be heavily unit tested. Each view should have tests for:

- Lead of each type (buyer, seller, tenant, owner)
- Internal fields removed
- Money formatted correctly
- Area/propertyType/bhk derived correctly
- Empty requirement handled
- Pagination metadata passed through
- Notes limited correctly
- Delete confirmation
- Conversion confirmation (all 4 lead types)
- Meeting confirmations (create, update, delete)
- Meeting details and list
- Metrics summary
- Error DTOs (lead not found, already converted, phone required)

---

## Additional View Builders

The following methods cover the remaining lead management operations. Full DTO examples are in `LEAD_AI_DTO_CONTRACT.md` and `COMPLETE_LEAD_MANAGEMENT.md`.

### Delete confirmation

```js
export function buildDeleteConfirmation(lead) {
  return {
    metadata: { action: 'deleted' },
    data: {
      leadId: lead.leadId,
      name: lead.name,
      leadType: lead.leadType,
    },
  };
}
```

### Note views

```js
export function buildNoteCreateConfirmation(lead, note) {
  return {
    metadata: { action: 'note_added' },
    data: {
      leadId: lead.leadId,
      leadName: lead.name,
      noteId: note.noteId,
      content: note.content,
      createdAt: formatDate(note.createdAt),
    },
  };
}

export function buildNotesList(notes, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || notes.length,
      shown: Math.min(pagination.limit || 5, notes.length),
      hasMore: (pagination.total || notes.length) > (pagination.limit || 5),
    },
    data: notes.slice(0, pagination.limit || 5).map(note => ({
      noteId: note.noteId,
      content: note.content,
      createdBy: note.createdBy,
      createdAt: formatDate(note.createdAt),
    })),
  };
}

export function buildNoteUpdateConfirmation(lead, note) {
  return {
    metadata: { action: 'note_updated' },
    data: {
      leadId: lead.leadId,
      noteId: note.noteId,
      content: note.content,
      updatedAt: formatDate(note.updatedAt),
    },
  };
}

export function buildNoteDeleteConfirmation(lead, noteId) {
  return {
    metadata: { action: 'note_deleted' },
    data: {
      leadId: lead.leadId,
      noteId,
    },
  };
}
```

### Conversion confirmation

```js
export function buildConversionConfirmation(lead, convertedEntity) {
  return {
    metadata: {
      action: 'converted',
      convertedTo: lead.leadType,
    },
    data: {
      leadId: lead.leadId,
      leadName: lead.name,
      leadType: lead.leadType,
      convertedTo: lead.leadType,
      contactId: convertedEntity.contactId || null,
      entityId: convertedEntity.entityId || convertedEntity.buyerId || convertedEntity.ownerId || convertedEntity.customerId || null,
      entityType: convertedEntity.entityType || lead.leadType,
      convertedAt: formatDate(convertedEntity.convertedAt || new Date().toISOString()),
    },
  };
}
```

### Meeting views

These delegate to `MeetingAIViewBuilder` but are listed here for completeness.

```js
import { buildMeetingCreateConfirmation, buildMeetingDetails, buildMeetingsList, buildMeetingUpdateConfirmation, buildMeetingDeleteConfirmation } from './meetingAIViewBuilder.js';

// Re-exported for convenience
export {
  buildMeetingCreateConfirmation,
  buildMeetingDetails,
  buildMeetingsList,
  buildMeetingUpdateConfirmation,
  buildMeetingDeleteConfirmation,
};
```

### Metrics summary

```js
export function buildMetricsSummary(metrics) {
  return {
    metadata: {},
    data: {
      leads: {
        total: metrics.leadsCount || 0,
        byType: metrics.leadsByType || {},
        byStatus: metrics.leadsByStatus || {},
      },
      meetings: {
        upcoming: metrics.upcomingMeetings || 0,
        completed: metrics.completedMeetings || 0,
        cancelled: metrics.cancelledMeetings || 0,
      },
      properties: {
        total: metrics.propertiesCount || 0,
        available: metrics.availableProperties || 0,
        sold: metrics.soldProperties || 0,
        rented: metrics.rentedProperties || 0,
      },
    },
  };
}
```

### Rich query views (Phase K)

```js
export function buildBudgetRanking(leads, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || leads.length,
      hasMore: pagination.hasMore || false,
      sortBy: 'budget',
      sortOrder: 'desc',
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      budget: formatMoney(deriveBudget(lead)),
      area: deriveArea(lead),
    })),
  };
}

export function buildStaleLeads(leads, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || leads.length,
      hasMore: pagination.hasMore || false,
      criteria: 'no_update_30_days',
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      lastActivityAt: formatDate(lead.lastActivityAt || lead.updatedAt),
      daysSinceUpdate: lead.daysSinceUpdate || null,
    })),
  };
}

export function buildPriorityRanking(leads, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || leads.length,
      hasMore: pagination.hasMore || false,
      sortBy: 'priority',
      sortOrder: 'desc',
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      priority: lead.priority,
      area: deriveArea(lead),
    })),
  };
}

export function buildFollowUpQueue(leads, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || leads.length,
      hasMore: pagination.hasMore || false,
      criteria: 'needs_follow_up',
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      priority: lead.priority,
      lastActivityAt: formatDate(lead.lastActivityAt || lead.updatedAt),
      daysSinceUpdate: lead.daysSinceUpdate || null,
    })),
  };
}

export function buildConversionCandidates(leads, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || leads.length,
      hasMore: pagination.hasMore || false,
      criteria: 'qualified_with_phone',
    },
    data: leads.map(lead => ({
      name: lead.name,
      leadType: lead.leadType,
      status: lead.status,
      phone: lead.phone,
      area: deriveArea(lead),
    })),
  };
}
```

### Error DTOs

```js
export function buildLeadNotFoundError(leadId) {
  return {
    metadata: { error: 'lead_not_found', message: 'Lead not found' },
    data: { leadId },
  };
}

export function buildAlreadyConvertedError(lead) {
  return {
    metadata: { error: 'already_converted', message: 'Lead has already been converted' },
    data: {
      leadId: lead.leadId,
      convertedAt: formatDate(lead.convertedAt),
      convertedTo: lead.convertedTo || lead.leadType,
    },
  };
}

export function buildCannotDeleteConvertedError(lead) {
  return {
    metadata: { error: 'cannot_delete_converted', message: 'Cannot delete a converted lead' },
    data: {
      leadId: lead.leadId,
      convertedAt: formatDate(lead.convertedAt),
    },
  };
}

export function buildPhoneRequiredError(lead) {
  return {
    metadata: { error: 'phone_required', message: 'Phone number is required to convert a lead' },
    data: {
      leadId: lead.leadId,
      leadName: lead.name,
    },
  };
}

export function buildEmptySearchResults() {
  return {
    metadata: { total: 0, hasMore: false },
    data: [],
  };
}
```

---

## MeetingAIViewBuilder — Separate File

Meetings are not lead-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

File: `agency-app/api/aiViewBuilders/meetingAIViewBuilder.js`

```js
import { formatDate } from './utils.js';

export function buildMeetingCreateConfirmation(meeting) {
  return {
    metadata: { action: 'meeting_created' },
    data: {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status || 'scheduled',
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityId: meeting.relatedEntityId || null,
      location: meeting.location || null,
      attendees: meeting.attendees || [],
    },
  };
}

export function buildMeetingDetails(meeting, relatedEntityName = null) {
  return {
    metadata: {},
    data: {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
      location: meeting.location || null,
      description: meeting.description || null,
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityId: meeting.relatedEntityId || null,
      relatedEntityName,
      attendees: meeting.attendees || [],
      createdBy: meeting.createdBy || null,
      createdAt: formatDate(meeting.createdAt),
    },
  };
}

export function buildMeetingsList(meetings, pagination = {}, relatedEntityNames = {}) {
  return {
    metadata: {
      total: pagination.total || meetings.length,
      days: pagination.days || 7,
      hasMore: pagination.hasMore || false,
    },
    data: meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityName: relatedEntityNames[meeting.relatedEntityId] || null,
      location: meeting.location || null,
    })),
  };
}

export function buildMeetingUpdateConfirmation(meeting, updatedFields = {}) {
  return {
    metadata: {
      action: 'meeting_updated',
      updatedFields: Object.keys(updatedFields),
    },
    data: {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
    },
  };
}

export function buildMeetingDeleteConfirmation(meeting) {
  return {
    metadata: { action: 'meeting_deleted' },
    data: {
      meetingId: meeting.meetingId,
      title: meeting.title,
    },
  };
}
```

---

## Version

v1.0 — 2026-06-26
