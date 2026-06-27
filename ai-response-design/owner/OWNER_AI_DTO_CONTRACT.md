# Owner AI DTO Contract

## Purpose

This document defines the data contract between the AI agent and the backend for **all owner-related operations**: CRUD, notes, properties lookup, phone deduplication, meetings, and metrics.

For the complete operation inventory and tool-to-view mapping, see `COMPLETE_OWNER_MANAGEMENT.md`.

The goal is to replace raw DynamoDB records with clean, purpose-built data so the LLM can respond naturally without being exposed to internal storage fields.

---

## Standard Envelope

All AI DTOs share a simple envelope:

```json
{
  "metadata": {},
  "data": {}
}
```

Rules:
- `data` is an **array** for collections.
- `data` is an **object** for singletons.
- The tool name (e.g., `search_owners`, `get_owner`) carries the entity and view semantics.

---

## Views

### 1. `searchResults`

Used when returning a list of owners from `search_owners` or `get_owners`.

```json
{
  "metadata": {
    "total": 18,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  },
  "data": [
    {
      "name": "Rajesh Kumar",
      "status": "active",
      "source": "referral",
      "area": "Bandra West",
      "propertyCount": 3
    },
    {
      "name": "Priya Sharma",
      "status": "active",
      "source": "walk-in",
      "area": "Andheri East",
      "propertyCount": 1
    }
  ]
}
```

**Fields to expose:**
| Field | Source | Reason |
|---|---|---|
| `name` | `owner.name` | Identification |
| `status` | `owner.status` | State (active/inactive) |
| `source` | `owner.source` | Origin |
| `area` | Derived from properties | Location |
| `propertyCount` | Derived from properties | Portfolio size |

**Fields to hide:**
- `ownerId`
- `phone`
- `email`
- `address`
- `notes`
- `tags`
- `panNumber`, `aadharNumber`, `bankDetails`
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`

---

### 2. `details`

Used when returning a single owner from `get_owner` or when the user asks for details.

```json
{
  "metadata": {},
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
    "status": "active",
    "phone": "9876543210",
    "email": "rajesh.kumar@example.com",
    "source": "referral",
    "address": "12, Hill Road, Bandra West, Mumbai",
    "createdAt": "2026-06-24",
    "tags": ["premium", "bandra"],
    "propertiesSummary": {
      "total": 3,
      "available": 2,
      "sold": 1,
      "rented": 0
    },
    "notes": [
      "Met on 24 June — interested in listing 3BHK.",
      "Bank details confirmed for rental payouts."
    ]
  }
}
```

**Fields to expose:**
- Basic: `name`, `status`, `phone`, `email`, `source`, `address`, `createdAt`, `tags`
- Properties summary: `total`, `available`, `sold`, `rented`
- Notes: last 5 notes only (with pagination if more)

**Fields to hide:**
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`
- KYC fields (`panNumber`, `aadharNumber`, bank details) — unless view is `full`

---

### 3. `createConfirmation`

Used after `create_owner` succeeds.

```json
{
  "metadata": {
    "action": "created"
  },
  "data": {
    "name": "Rajesh Kumar",
    "status": "active",
    "phone": "9876543210",
    "source": "referral",
    "ownerId": "owner-abc123"
  }
}
```

Note: `ownerId` is included here because the user may need to reference it later. In normal views it is hidden.

---

### 4. `updateConfirmation`

Used after `update_owner` succeeds.

```json
{
  "metadata": {
    "action": "updated",
    "updatedFields": ["status", "address"]
  },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
    "status": "active"
  }
}
```

---

### 5. `full`

Used only when the user explicitly asks for everything. Rarely used in normal WhatsApp conversations.

```json
{
  "metadata": {
    "view": "full"
  },
  "data": {
    "name": "Rajesh Kumar",
    "status": "active",
    "phone": "9876543210",
    "email": "rajesh.kumar@example.com",
    "source": "referral",
    "address": "12, Hill Road, Bandra West, Mumbai",
    "createdAt": "2026-06-24",
    "updatedAt": "2026-06-25",
    "tags": ["premium", "bandra"],
    "kyc": {
      "panNumber": "ABCDE1234F",
      "aadharNumber": "1234-5678-9012",
      "panDocS3Key": "documents/owner-abc123/pan.pdf",
      "aadharDocS3Key": "documents/owner-abc123/aadhar.pdf",
      "photoS3Key": "documents/owner-abc123/photo.jpg"
    },
    "bankDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "12345678901234",
      "ifscCode": "HDFC0001234"
    },
    "properties": [
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
    ],
    "notes": [ ... ]
  }
}
```

---

## Optional Fields and Null Handling

### Always present
These fields exist in every owner DTO:

- `name`
- `status`

### Optional fields
These fields may be `null` or omitted if not available:

- `phone`
- `email`
- `source`
- `address`
- `tags`
- `area`
- `propertyCount`
- `panNumber`
- `aadharNumber`
- `bankName`
- `accountNumber`
- `ifscCode`
- `panDocS3Key`
- `aadharDocS3Key`
- `photoS3Key`
- `notes`
- `properties`

### Missing KYC object
If an owner has no KYC data, the `kyc` field should be an empty object with all optional fields set to `null`:

```json
"kyc": {
  "panNumber": null,
  "aadharNumber": null,
  "panDocS3Key": null,
  "aadharDocS3Key": null,
  "photoS3Key": null
}
```

### Missing bank details object
If an owner has no bank details, the `bankDetails` field should be an empty object with all optional fields set to `null`:

```json
"bankDetails": {
  "bankName": null,
  "accountNumber": null,
  "ifscCode": null
}
```

---

## Pagination Metadata

```json
{
  "metadata": {
    "total": 132,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  }
}
```

Rules:
- `hasMore` is `true` only if more pages exist.
- `nextCursor` is optional; used for DynamoDB `ExclusiveStartKey`.
- The agent should not expose `nextCursor` to the user.
- Page numbers are not included because DynamoDB uses cursor-based pagination.

---

## Notes Pagination

For owner details, notes are limited to the most recent 5.

```json
{
  "metadata": {
    "notes": {
      "total": 23,
      "shown": 5,
      "hasMore": true
    }
  }
}
```

---

## Money Format

All money values should be formatted as compact Indian currency:

| Raw value | Formatted |
|---|---|
| 17000000 | ₹1.7 Cr |
| 13400000 | ₹1.34 Cr |
| 800000 | ₹8 L |
| 45000 | ₹45k |

The LLM should never receive raw integers for expectedPrice/rentExpected/securityDeposit.

---

## Internal Fields to Always Remove

Before any owner reaches the AI, remove:

- `PK`
- `SK`
- `GSI1PK`
- `GSI1SK`
- `GSI3PK`
- `GSI3SK`
- `EntityType`
- `tenantId`
- `normalizedPhone`
- `panDocS3Key`, `aadharDocS3Key`, `photoS3Key` (unless view is `full`)
- Any field starting with `internal_`

---

## Additional Views

The views above (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`) are the core owner views.

The following views cover the remaining owner management operations. Full DTO examples are in `COMPLETE_OWNER_MANAGEMENT.md`.

### 6. `deactivateConfirmation`

Returned after `update_owner` with `status=inactive` succeeds (used instead of delete since DELETE endpoint is disabled).

```json
{
  "metadata": { "action": "deactivated" },
  "data": {
    "ownerId": "owner-abc123",
    "name": "Rajesh Kumar",
    "status": "inactive"
  }
}
```

### 7. `noteCreateConfirmation`

Returned after `create_owner_note` succeeds.

```json
{
  "metadata": { "action": "note_added" },
  "data": {
    "ownerId": "owner-abc123",
    "ownerName": "Rajesh Kumar",
    "noteId": "note-xyz789",
    "content": "Met on 25 June — interested in listing 3BHK.",
    "createdAt": "2026-06-25"
  }
}
```

### 8. `notesList`

Returned from `get_owner_notes`.

```json
{
  "metadata": { "total": 23, "shown": 5, "hasMore": true },
  "data": [
    {
      "noteId": "note-xyz789",
      "content": "Met on 25 June — interested in listing 3BHK.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    }
  ]
}
```

### 9. `noteUpdateConfirmation`

Returned after `update_owner_note` succeeds.

```json
{
  "metadata": { "action": "note_updated" },
  "data": {
    "ownerId": "owner-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Met on 25 June — very interested in listing 3BHK in Bandra.",
    "updatedAt": "2026-06-25"
  }
}
```

### 10. `noteDeleteConfirmation`

Returned after `delete_owner_note` succeeds.

```json
{
  "metadata": { "action": "note_deleted" },
  "data": {
    "ownerId": "owner-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `ownerPropertiesList`

Returned from `get_owner_properties`.

```json
{
  "metadata": { "total": 3, "hasMore": false },
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

### 12. `phoneLookupResult`

Returned from `get_owner_by_phone` — used for deduplication check before creating a new owner.

When an owner is found:

```json
{
  "metadata": { "action": "phone_lookup", "found": true },
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
  "metadata": { "action": "phone_lookup", "found": false },
  "data": {
    "phone": "9876543210",
    "existingOwner": false
  }
}
```

### 13. `meetingCreateConfirmation`

Returned after `create_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_created" },
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

### 14. `meetingDetails`

Returned from `get_meeting`.

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

### 15. `meetingsList`

Returned from `get_upcoming_meetings`.

```json
{
  "metadata": { "total": 5, "days": 7, "hasMore": false },
  "data": [
    {
      "meetingId": "mtg-abc123",
      "title": "Property discussion with Rajesh",
      "scheduledDate": "2026-06-28",
      "status": "scheduled",
      "relatedEntityType": "owner",
      "relatedEntityName": "Rajesh Kumar",
      "location": "Bandra office"
    }
  ]
}
```

### 16. `meetingUpdateConfirmation`

Returned after `update_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_updated", "updatedFields": ["scheduledDate", "status"] },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh",
    "scheduledDate": "2026-06-30",
    "status": "rescheduled"
  }
}
```

### 17. `meetingDeleteConfirmation`

Returned after `delete_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_deleted" },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Property discussion with Rajesh"
  }
}
```

---

## Error DTOs

### Owner not found

```json
{
  "metadata": { "error": "owner_not_found", "message": "Owner not found" },
  "data": null
}
```

### Already exists by phone

```json
{
  "metadata": { "error": "already_exists_by_phone", "message": "An owner with this phone number already exists" },
  "data": { "ownerId": "owner-abc123", "name": "Rajesh Kumar", "phone": "9876543210" }
}
```

### Cannot delete owner

```json
{
  "metadata": { "error": "cannot_delete_owner", "message": "Owner deletion is disabled. Use status=inactive to deactivate instead." },
  "data": { "ownerId": "owner-abc123", "name": "Rajesh Kumar" }
}
```

### Phone required

```json
{
  "metadata": { "error": "phone_required", "message": "Phone number is required to create an owner" },
  "data": { "name": "Rajesh Kumar" }
}
```

### Empty search results

```json
{
  "metadata": { "total": 0, "hasMore": false },
  "data": []
}
```

### Profile notes protected

```json
{
  "metadata": { "error": "profile_notes_protected", "message": "The PROFILE_NOTES item cannot be modified or deleted directly" },
  "data": { "ownerId": "owner-abc123", "noteId": "PROFILE_NOTES" }
}
```

---

## Version

v1.0 — 2026-06-26
