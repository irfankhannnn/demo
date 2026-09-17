# TenantAIViewBuilder API

## Purpose

`TenantAIViewBuilder` is a projection layer that transforms normalized tenant domain models into AI-friendly DTOs.

It covers **all tenant management operations**: CRUD, notes, rental history, current rental, phone-based deduplication, KYC status, and archive.

It does not contain business logic. It does not generate English text. It only decides which fields to expose for a given AI interaction.

For the complete operation inventory, see `COMPLETE_TENANT_MANAGEMENT.md`.

---

## Location

```
agency-app/api/aiViewBuilders/tenantAIViewBuilder.js
```

---

## Naming

We use `TenantAIViewBuilder` instead of `TenantViewBuilder` to make it explicit that this is for AI consumption only, not a universal presentation contract.

The backend entity is `customer` (with `customerId`), but the AI agent tool names and this view builder use `tenant` for consistency. The DTOs expose `customerId` where appropriate.

---

## API

### Core Method

```js
export function buildTenantAIResponse({ view, tenant, tenants, metadata, pagination }) {
  // ...
}
```

Parameters:
- `view` (string): One of `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `deactivateConfirmation`, `full`, `rentalHistory`, `currentRentalUpdateConfirmation`, `rentalArchiveConfirmation`, `phoneLookupResult`.
- `tenant` (object): Single tenant domain model.
- `tenants` (array): Array of tenant domain models.
- `metadata` (object): Additional context (pagination, action, updatedFields).
- `pagination` (object): `{ total, page, pageSize, hasMore, nextCursor }`.

Returns:
- `{ metadata, data }` DTO.

---

### Explicit Helper Methods

```js
export function buildSearchResults(tenants, pagination, options = {}) {
  // Returns searchResults DTO
}

export function buildTenantDetails(tenant, options = {}) {
  // Returns details DTO
}

export function buildCreateConfirmation(tenant) {
  // Returns createConfirmation DTO
}

export function buildUpdateConfirmation(tenant, updatedFields) {
  // Returns updateConfirmation DTO
}

export function buildDeactivateConfirmation(tenant) {
  // Returns deactivateConfirmation DTO
}

export function buildFullTenant(tenant) {
  // Returns full DTO
}

export function buildPhoneLookupResult(tenant, phone) {
  // Returns phoneLookupResult DTO
}
```

---

## Implementation Sketch

```js
import { formatMoney } from './utils.js';

export function buildSearchResults(tenants, pagination, options = {}) {
  return {
    metadata: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasMore: pagination.hasMore,
      nextCursor: pagination.nextCursor,
    },
    data: tenants.map(tenant => ({
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
      kycStatus: deriveKycStatus(tenant),
      currentRental: deriveCurrentRentalSummary(tenant),
      rentalHistoryCount: deriveRentalHistoryCount(tenant),
      area: tenant.address || null,
    })),
  };
}

export function buildTenantDetails(tenant, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;

  return {
    metadata: {
      notes: includeNotes ? {
        total: tenant.notes?.length || 0,
        shown: Math.min(maxNotes, tenant.notes?.length || 0),
        hasMore: (tenant.notes?.length || 0) > maxNotes,
      } : null,
      rentalHistory: {
        total: deriveRentalHistoryCount(tenant),
      },
    },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      status: tenant.status,
      source: tenant.source,
      address: tenant.address,
      kycStatus: deriveKycStatus(tenant),
      tenantStatus: deriveTenantStatus(tenant),
      currentRental: deriveCurrentRentalSummary(tenant),
      rentalHistoryCount: deriveRentalHistoryCount(tenant),
      createdAt: formatDate(tenant.createdAt),
      notes: includeNotes ? (tenant.notes || []).slice(0, maxNotes).map(n => n.content) : undefined,
    },
  };
}

export function buildCreateConfirmation(tenant) {
  return {
    metadata: { action: 'created' },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
    },
  };
}

export function buildUpdateConfirmation(tenant, updatedFields) {
  return {
    metadata: {
      action: 'updated',
      updatedFields: Object.keys(updatedFields || {}),
    },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      status: tenant.status,
    },
  };
}

export function buildDeactivateConfirmation(tenant) {
  return {
    metadata: { action: 'deactivated' },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      status: 'inactive',
    },
  };
}

export function buildFullTenant(tenant) {
  return {
    metadata: { view: 'full' },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      status: tenant.status,
      source: tenant.source,
      address: tenant.address,
      tags: tenant.tags || [],
      aadharNumber: tenant.aadharNumber || null,
      kycStatus: deriveKycStatus(tenant),
      tenantStatus: deriveTenantStatus(tenant),
      currentRental: buildCurrentRental(tenant.currentRental),
      rentalHistory: buildRentalHistory(tenant.rentalHistory || []),
      createdAt: formatDate(tenant.createdAt),
      updatedAt: formatDate(tenant.updatedAt),
      notes: (tenant.notes || []).map(n => n.content),
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

### `deriveCurrentRentalSummary(tenant)`

Returns a compact summary of the tenant's current rental for list and details views.

```js
function deriveCurrentRentalSummary(tenant) {
  const rental = tenant.currentRental;
  if (!rental) return null;

  return {
    propertyId: rental.propertyId || null,
    leaseStartDate: formatDate(rental.leaseStartDate),
    leaseEndDate: formatDate(rental.leaseEndDate),
    monthlyRent: formatMoney(rental.monthlyRent),
    securityDeposit: formatMoney(rental.securityDeposit),
  };
}
```

### `deriveRentalHistoryCount(tenant)`

Returns the number of past rentals.

```js
function deriveRentalHistoryCount(tenant) {
  if (Array.isArray(tenant.rentalHistory)) return tenant.rentalHistory.length;
  return 0;
}
```

### `deriveKycStatus(tenant)`

Returns an object indicating whether Aadhar is present and documents are uploaded.

```js
function deriveKycStatus(tenant) {
  return {
    hasAadhar: Boolean(tenant.aadharNumber),
    hasAadharDoc: Boolean(tenant.aadharDocUrl),
    hasPhoto: Boolean(tenant.photoUrl),
    hasPoliceVerification: Boolean(tenant.policeVerificationUrl),
    complete: Boolean(tenant.aadharNumber) && Boolean(tenant.aadharDocUrl) && Boolean(tenant.photoUrl),
  };
}
```

### `deriveTenantStatus(tenant)`

Returns a human-readable summary of the tenant's lifecycle status.

```js
function deriveTenantStatus(tenant) {
  return {
    status: tenant.status || 'active',
    hasCurrentRental: Boolean(tenant.currentRental),
    hasRentalHistory: deriveRentalHistoryCount(tenant) > 0,
    isActive: tenant.status === 'active',
  };
}
```

### `buildTenantSummary(tenant)`

Builds a compact summary for list views.

```js
function buildTenantSummary(tenant) {
  return {
    customerId: tenant.customerId,
    name: tenant.name,
    phone: tenant.phone,
    status: tenant.status,
    kycStatus: deriveKycStatus(tenant).complete,
    currentRental: deriveCurrentRentalSummary(tenant),
    rentalHistoryCount: deriveRentalHistoryCount(tenant),
  };
}
```

### `buildCurrentRental(rental)`

Builds the full current rental object for the `full` view.

```js
function buildCurrentRental(rental) {
  if (!rental) return null;

  return {
    propertyId: rental.propertyId || null,
    leaseStartDate: formatDate(rental.leaseStartDate),
    leaseEndDate: formatDate(rental.leaseEndDate),
    monthlyRent: formatMoney(rental.monthlyRent),
    securityDeposit: formatMoney(rental.securityDeposit),
    leaseAgreementUrl: rental.leaseAgreementUrl || null,
    depositReceiptUrl: rental.depositReceiptUrl || null,
    policeVerificationUrl: rental.policeVerificationUrl || null,
    notes: rental.notes || null,
  };
}
```

### `buildRentalHistory(rentals)`

Builds the rental history array for the `full` view.

```js
function buildRentalHistory(rentals) {
  return rentals.map(rental => buildCurrentRental(rental));
}
```

---

## Internal Field Removal

Before any tenant reaches the view builder, the following should be removed:

```js
const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
  'aadharDocS3Key', 'photoS3Key', 'policeVerificationS3Key',
  'currentRental.leaseAgreementS3Key',
  'currentRental.depositReceiptS3Key',
  'currentRental.policeVerificationS3Key',
  'rentalHistory.*.leaseAgreementS3Key',
  'rentalHistory.*.depositReceiptS3Key',
  'rentalHistory.*.policeVerificationS3Key',
];
```

This can be done in `TenantNormalizer` or directly at the boundary of `TenantAIViewBuilder`.

---

## Tests

The view builder should be heavily unit tested. Each view should have tests for:

- Tenant with full KYC and current rental
- Tenant with no KYC or rental history
- Tenant with rental history only
- Tenant with active vs inactive status
- Internal fields removed
- Money formatted correctly
- KYC status derived correctly
- Tenant status derived correctly
- Current rental summary derived correctly
- Rental history count derived correctly
- Pagination metadata passed through
- Notes limited correctly
- Deactivate confirmation
- Note views (create, list, update, delete)
- Rental history list
- Current rental update confirmation
- Rental archive confirmation
- Phone lookup result (found and not found)
- Error DTOs (tenant not found, phone required, name required, duplicate phone, empty search, profile notes protected, rental required)

---

## Additional View Builders

The following methods cover the remaining tenant management operations. Full DTO examples are in `TENANT_AI_DTO_CONTRACT.md` and `COMPLETE_TENANT_MANAGEMENT.md`.

### Deactivate confirmation

Per OpenClaw policy, delete is disabled in the REST API. Use `status=inactive` for deactivation.

```js
export function buildDeactivateConfirmation(tenant) {
  return {
    metadata: { action: 'deactivated' },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      status: 'inactive',
    },
  };
}
```

### Note views

```js
export function buildNoteCreateConfirmation(tenant, note) {
  return {
    metadata: { action: 'note_added' },
    data: {
      customerId: tenant.customerId,
      tenantName: tenant.name,
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

export function buildNoteUpdateConfirmation(tenant, note) {
  return {
    metadata: { action: 'note_updated' },
    data: {
      customerId: tenant.customerId,
      noteId: note.noteId,
      content: note.content,
      updatedAt: formatDate(note.updatedAt),
    },
  };
}

export function buildNoteDeleteConfirmation(tenant, noteId) {
  return {
    metadata: { action: 'note_deleted' },
    data: {
      customerId: tenant.customerId,
      noteId,
    },
  };
}
```

### Rental history

```js
export function buildRentalHistoryList(rentals, pagination = {}) {
  return {
    metadata: {
      total: pagination.total || rentals.length,
      hasMore: pagination.hasMore || false,
    },
    data: buildRentalHistory(rentals),
  };
}

export function buildCurrentRentalUpdateConfirmation(tenant, updatedFields = {}) {
  return {
    metadata: {
      action: 'rental_updated',
      updatedFields: Object.keys(updatedFields),
    },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      currentRental: buildCurrentRental(tenant.currentRental),
    },
  };
}

export function buildRentalArchiveConfirmation(tenant, archivedRental) {
  return {
    metadata: { action: 'rental_archived' },
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      archivedRental: buildCurrentRental(archivedRental),
      rentalHistoryCount: deriveRentalHistoryCount(tenant),
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
export function buildTenantNotFoundError(customerId) {
  return {
    metadata: { error: 'tenant_not_found', message: 'Tenant not found' },
    data: { customerId },
  };
}

export function buildPhoneRequiredError(tenant) {
  return {
    metadata: { error: 'phone_required', message: 'Phone number is required to create a tenant' },
    data: {
      customerId: tenant?.customerId || null,
      tenantName: tenant?.name || null,
    },
  };
}

export function buildNameRequiredError(tenant) {
  return {
    metadata: { error: 'name_required', message: 'Name is required to create a tenant' },
    data: {
      customerId: tenant?.customerId || null,
      phone: tenant?.phone || null,
    },
  };
}

export function buildDuplicatePhoneError(existingTenant) {
  return {
    metadata: { error: 'duplicate_phone', message: 'A tenant with this phone number already exists' },
    data: {
      customerId: existingTenant.customerId,
      name: existingTenant.name,
      phone: existingTenant.phone,
    },
  };
}

export function buildEmptySearchResults() {
  return {
    metadata: { total: 0, hasMore: false },
    data: [],
  };
}

export function buildProfileNotesProtectedError(tenant, noteId) {
  return {
    metadata: { error: 'profile_notes_protected', message: 'The system-generated profile note cannot be edited or deleted' },
    data: {
      customerId: tenant.customerId,
      noteId,
    },
  };
}

export function buildRentalRequiredError(customerId) {
  return {
    metadata: { error: 'rental_required', message: 'Current rental is required to perform this operation' },
    data: { customerId },
  };
}

export function buildPhoneLookupResult(tenant, phone) {
  if (!tenant) {
    return {
      metadata: {},
      data: {
        phone,
        found: false,
      },
    };
  }

  return {
    metadata: {},
    data: {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
      found: true,
    },
  };
}
```

---

## MeetingAIViewBuilder — Separate File

Meetings are not tenant-specific. They can be tied to leads, contacts, properties, buyers, sellers, owners, or tenants.

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
