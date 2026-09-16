# OwnerAIViewBuilder API

## Purpose

`OwnerAIViewBuilder` is a projection layer that transforms normalized owner domain models into AI-friendly DTOs.

It covers **all owner management operations**: CRUD, notes, properties lookup, phone-based deduplication, KYC/bank status, and rich queries.

It does not contain business logic. It does not generate English text. It only decides which fields to expose for a given AI interaction.

For the complete operation inventory, see `COMPLETE_OWNER_MANAGEMENT.md`.

---

## Location

```
apps/crm/server/aiViewBuilders/ownerAIViewBuilder.js
```

Or, if preferred:

```
apps/crm/server/aiViewBuilders/ownerAIViewBuilder.js
```

---

## Naming

We use `OwnerAIViewBuilder` instead of `OwnerViewBuilder` to make it explicit that this is for AI consumption only, not a universal presentation contract.

---

## API

### Core Method

```js
export function buildOwnerAIResponse({ view, owner, owners, metadata, pagination }) {
  // ...
}
```

Parameters:
- `view` (string): One of `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`.
- `owner` (object): Single owner domain model.
- `owners` (array): Array of owner domain models.
- `metadata` (object): Additional context (pagination, action, updatedFields).
- `pagination` (object): `{ total, page, pageSize, hasMore, nextCursor }`.

Returns:
- `{ metadata, data }` DTO.

---

### Explicit Helper Methods

```js
export function buildSearchResults(owners, pagination, options = {}) {
  // Returns searchResults DTO
}

export function buildOwnerDetails(owner, options = {}) {
  // Returns details DTO
}

export function buildCreateConfirmation(owner) {
  // Returns createConfirmation DTO
}

export function buildUpdateConfirmation(owner, updatedFields) {
  // Returns updateConfirmation DTO
}

export function buildFullOwner(owner) {
  // Returns full DTO
}
```

---

## Implementation Sketch

```js
import { formatMoney } from './utils.js';

export function buildSearchResults(owners, pagination, options = {}) {
  return {
    metadata: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore: pagination.hasMore,
      nextCursor: pagination.nextCursor,
    },
    data: owners.map(owner => ({
      name: owner.name,
      phone: owner.phone,
      status: owner.status,
      propertyCount: derivePropertyCount(owner),
      isSeller: deriveIsSeller(owner),
      kycStatus: deriveKycStatus(owner),
      area: owner.address || null,
    })),
  };
}

export function buildOwnerDetails(owner, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;

  return {
    metadata: {
      notes: includeNotes ? {
        total: owner.notes?.length || 0,
        shown: Math.min(maxNotes, owner.notes?.length || 0),
        hasMore: (owner.notes?.length || 0) > maxNotes,
      } : null,
      properties: {
        total: derivePropertyCount(owner),
      },
    },
    data: {
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      status: owner.status,
      source: owner.source,
      address: owner.address,
      propertyCount: derivePropertyCount(owner),
      isSeller: deriveIsSeller(owner),
      kycStatus: deriveKycStatus(owner),
      bankStatus: deriveBankStatus(owner),
      createdAt: formatDate(owner.createdAt),
      notes: includeNotes ? (owner.notes || []).slice(0, maxNotes).map(n => n.content) : undefined,
    },
  };
}

export function buildCreateConfirmation(owner) {
  return {
    metadata: { action: 'created' },
    data: {
      name: owner.name,
      phone: owner.phone,
      status: owner.status,
      ownerId: owner.ownerId,
    },
  };
}

export function buildUpdateConfirmation(owner, updatedFields) {
  return {
    metadata: {
      action: 'updated',
      updatedFields: Object.keys(updatedFields || {}),
    },
    data: {
      ownerId: owner.ownerId,
      name: owner.name,
      status: owner.status,
    },
  };
}

export function buildFullOwner(owner) {
  return {
    metadata: { view: 'full' },
    data: {
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      status: owner.status,
      source: owner.source,
      address: owner.address,
      tags: owner.tags || [],
      panNumber: owner.panNumber || null,
      aadharNumber: owner.aadharNumber || null,
      bankDetails: owner.bankDetails || null,
      bankName: owner.bankName || null,
      accountNumber: owner.accountNumber || null,
      ifscCode: owner.ifscCode || null,
      kycStatus: deriveKycStatus(owner),
      bankStatus: deriveBankStatus(owner),
      propertyCount: derivePropertyCount(owner),
      isSeller: deriveIsSeller(owner),
      createdAt: formatDate(owner.createdAt),
      updatedAt: formatDate(owner.updatedAt),
      notes: (owner.notes || []).map(n => n.content),
      properties: buildOwnerProperties(owner.properties || []),
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

### `derivePropertyCount(owner)`

Returns the count of properties linked to the owner.

```js
function derivePropertyCount(owner) {
  if (owner.propertyCount !== undefined) return owner.propertyCount;
  if (Array.isArray(owner.properties)) return owner.properties.length;
  return 0;
}
```

### `deriveIsSeller(owner)`

Returns true if the owner has any for-sale or sold properties.

```js
function deriveIsSeller(owner) {
  const properties = owner.properties || [];
  return properties.some(p =>
    p.listingType === 'sale' ||
    p.status === 'sold' ||
    p.status === 'for_sale'
  );
}
```

### `deriveKycStatus(owner)`

Returns an object indicating whether PAN and Aadhar are present.

```js
function deriveKycStatus(owner) {
  return {
    hasPan: Boolean(owner.panNumber),
    hasAadhar: Boolean(owner.aadharNumber),
    complete: Boolean(owner.panNumber) && Boolean(owner.aadharNumber),
  };
}
```

### `deriveBankStatus(owner)`

Returns an object indicating whether bank details are present.

```js
function deriveBankStatus(owner) {
  return {
    hasBankName: Boolean(owner.bankName),
    hasAccountNumber: Boolean(owner.accountNumber),
    hasIfscCode: Boolean(owner.ifscCode),
    complete: Boolean(owner.bankName) && Boolean(owner.accountNumber) && Boolean(owner.ifscCode),
  };
}
```

### `buildOwnerSummary(owner)`

Builds a compact summary for list views.

```js
function buildOwnerSummary(owner) {
  return {
    ownerId: owner.ownerId,
    name: owner.name,
    phone: owner.phone,
    status: owner.status,
    propertyCount: derivePropertyCount(owner),
    isSeller: deriveIsSeller(owner),
    kycStatus: deriveKycStatus(owner).complete,
    bankStatus: deriveBankStatus(owner).complete,
  };
}
```

### `buildOwnerProperties(properties)`

Builds a property list for owner details views.

```js
function buildOwnerProperties(properties) {
  return properties.map(p => ({
    propertyId: p.propertyId,
    title: p.title || p.name || null,
    type: p.propertyType || null,
    status: p.status || null,
    listingType: p.listingType || null,
    area: p.area || p.city || null,
    price: formatMoney(p.expectedPrice || p.price),
    rent: formatMoney(p.rentExpected || p.rent),
  }));
}
```

---

## Internal Field Removal

Before any owner reaches the view builder, the following should be removed:

```js
const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
  'panDocS3Key', 'aadharDocS3Key', 'photoS3Key',
];
```

This can be done in `OwnerNormalizer` or directly at the boundary of `OwnerAIViewBuilder`.

---

## Tests

The view builder should be heavily unit tested. Each view should have tests for:

- Owner with full KYC and bank details
- Owner with no KYC or bank details
- Owner with linked properties
- Owner with no linked properties
- Owner who is a seller (has for-sale/sold properties)
- Owner who is not a seller
- Internal fields removed
- Money formatted correctly
- Property count derived correctly
- KYC status derived correctly
- Bank status derived correctly
- Pagination metadata passed through
- Notes limited correctly
- Delete/deactivate confirmation
- Note views (create, list, update, delete)
- Properties list
- Phone lookup result
- Error DTOs (owner not found, already exists by phone, phone required, cannot delete owner, empty search, profile notes protected)

---

## Additional View Builders

The following methods cover the remaining owner management operations. Full DTO examples are in `OWNER_AI_DTO_CONTRACT.md` and `COMPLETE_OWNER_MANAGEMENT.md`.

### Delete/deactivate confirmation

Per OpenClaw policy, delete is disabled in the REST API. Use `status=inactive` for deactivation.

```js
export function buildDeactivateConfirmation(owner) {
  return {
    metadata: { action: 'deactivated' },
    data: {
      ownerId: owner.ownerId,
      name: owner.name,
      status: 'inactive',
    },
  };
}

export function buildDeleteConfirmation(owner) {
  return {
    metadata: { action: 'deleted' },
    data: {
      ownerId: owner.ownerId,
      name: owner.name,
    },
  };
}
```

### Note views

```js
export function buildNoteCreateConfirmation(owner, note) {
  return {
    metadata: { action: 'note_added' },
    data: {
      ownerId: owner.ownerId,
      ownerName: owner.name,
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

export function buildNoteUpdateConfirmation(owner, note) {
  return {
    metadata: { action: 'note_updated' },
    data: {
      ownerId: owner.ownerId,
      noteId: note.noteId,
      content: note.content,
      updatedAt: formatDate(note.updatedAt),
    },
  };
}

export function buildNoteDeleteConfirmation(owner, noteId) {
  return {
    metadata: { action: 'note_deleted' },
    data: {
      ownerId: owner.ownerId,
      noteId,
    },
  };
}
```

### Properties list

```js
export function buildOwnerPropertiesList(properties, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || properties.length,
      hasMore: pagination.hasMore || false,
    },
    data: buildOwnerProperties(properties),
  };
}
```

### Phone lookup result

Used for deduplication check before creating a new owner.

```js
export function buildPhoneLookupResult(existingOwner, phone) {
  if (!existingOwner) {
    return {
      metadata: { action: 'phone_lookup', exists: false },
      data: {
        phone,
        existingOwner: null,
      },
    };
  }

  return {
    metadata: { action: 'phone_lookup', exists: true },
    data: {
      phone,
      existingOwner: {
        ownerId: existingOwner.ownerId,
        name: existingOwner.name,
        status: existingOwner.status,
        propertyCount: derivePropertyCount(existingOwner),
      },
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

### Error DTOs

```js
export function buildOwnerNotFoundError(ownerId) {
  return {
    metadata: { error: 'owner_not_found', message: 'Owner not found' },
    data: { ownerId },
  };
}

export function buildAlreadyExistsByPhoneError(existingOwner) {
  return {
    metadata: { error: 'already_exists_by_phone', message: 'An owner with this phone number already exists' },
    data: {
      ownerId: existingOwner.ownerId,
      name: existingOwner.name,
      phone: existingOwner.phone,
    },
  };
}

export function buildCannotDeleteOwnerError(owner) {
  return {
    metadata: { error: 'cannot_delete_owner', message: 'Cannot delete an owner with linked properties. Use status=inactive instead.' },
    data: {
      ownerId: owner.ownerId,
      name: owner.name,
      propertyCount: derivePropertyCount(owner),
    },
  };
}

export function buildPhoneRequiredError(owner) {
  return {
    metadata: { error: 'phone_required', message: 'Phone number is required to create an owner' },
    data: {
      ownerId: owner?.ownerId || null,
      ownerName: owner?.name || null,
    },
  };
}

export function buildEmptySearchResults() {
  return {
    metadata: { total: 0, hasMore: false },
    data: [],
  };
}

export function buildProfileNotesProtectedError(owner, noteId) {
  return {
    metadata: { error: 'profile_notes_protected', message: 'This note is protected and cannot be modified' },
    data: {
      ownerId: owner.ownerId,
      noteId,
    },
  };
}
```

---

## MeetingAIViewBuilder — Separate File

Meetings are not owner-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

File: `apps/crm/server/aiViewBuilders/meetingAIViewBuilder.js`

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
