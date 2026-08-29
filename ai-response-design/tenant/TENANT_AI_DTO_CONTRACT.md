# Tenant AI DTO Contract

## Purpose

This document defines the data contract between the AI agent and the backend for **all tenant-related operations**: CRUD, notes, rental history, current rental, archive, meetings, and metrics.

The backend entity is `customer` (with `customerId`), but the AI agent tool names and this contract use `tenant` for consistency. The API endpoints are `/api/crm/customers`.

For the complete operation inventory and tool-to-view mapping, see `COMPLETE_TENANT_MANAGEMENT.md`.

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
- The tool name (e.g., `search_tenants`, `get_tenant`) carries the entity and view semantics.

---

## Views

### 1. `searchResults`

Used when returning a list of tenants from `search_tenants`.

```json
{
  "metadata": {
    "total": 18,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  },
  "data": [
    {
      "name": "Sarah Gupta",
      "status": "active",
      "area": "Andheri East",
      "hasCurrentRental": true,
      "currentRent": "₹50k",
      "leaseEndDate": "2026-12-31"
    },
    {
      "name": "Rahul Mehta",
      "status": "inactive",
      "area": "Bandra",
      "hasCurrentRental": false,
      "rentalHistoryCount": 1
    }
  ]
}
```

**Fields to expose:**
| Field | Source | Reason |
|---|---|---|
| `name` | `customer.name` | Identification |
| `status` | `customer.status` | State (active/inactive/past) |
| `area` | Derived from `address` | Location |
| `hasCurrentRental` | Derived from `currentRental` | Rental status |
| `currentRent` | `currentRental.monthlyRent` | Monthly rent |
| `leaseEndDate` | `currentRental.leaseEndDate` | Lease ending |

**Fields to hide:**
- `customerId`
- `phone`
- `email`
- `aadharNumber`, `aadharDocS3Key`, `photoS3Key`, `policeVerificationS3Key`
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`

---

### 2. `details`

Used when returning a single tenant from `get_tenant` or when the user asks for details.

```json
{
  "metadata": {
    "notes": {
      "total": 10,
      "shown": 5,
      "hasMore": true
    },
    "rental": {
      "hasCurrentRental": true,
      "historyCount": 1
    }
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "active",
    "phone": "9876543210",
    "email": "sarah@example.com",
    "address": "12, Lokhandwala, Andheri West, Mumbai",
    "source": "direct",
    "createdAt": "2026-06-24",
    "tags": ["family", "long-term"],
    "kycStatus": {
      "hasAadhar": true,
      "hasPhoto": true,
      "hasPoliceVerification": false,
      "complete": false
    },
    "currentRental": {
      "propertyId": "prop-abc123",
      "propertyName": "2BHK in Andheri East",
      "leaseStartDate": "2026-01-01",
      "leaseEndDate": "2026-12-31",
      "monthlyRent": "₹50k",
      "securityDeposit": "₹1 L"
    },
    "rentalHistoryCount": 1,
    "notes": [
      "Called on 24 June — rent paid on time.",
      "Aadhar submitted for verification."
    ]
  }
}
```

**Fields to expose:**
- Basic: `name`, `status`, `phone`, `email`, `address`, `source`, `createdAt`, `tags`
- Rental: `currentRental` summary, `rentalHistoryCount`
- KYC status: `kycStatus` object
- Notes: last 5 notes only

**Fields to hide:**
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`
- S3 keys and raw KYC document numbers

---

### 3. `createConfirmation`

Used after `create_tenant` succeeds.

```json
{
  "metadata": {
    "action": "created"
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "active",
    "phone": "9876543210",
    "source": "direct"
  }
}
```

---

### 4. `updateConfirmation`

Used after `update_tenant` succeeds.

```json
{
  "metadata": {
    "action": "updated",
    "updatedFields": ["status", "address"]
  },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "active",
    "address": "12, Lokhandwala, Andheri West, Mumbai"
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
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "active",
    "phone": "9876543210",
    "email": "sarah@example.com",
    "address": "12, Lokhandwala, Andheri West, Mumbai",
    "source": "direct",
    "createdAt": "2026-06-24",
    "updatedAt": "2026-06-25",
    "tags": ["family", "long-term"],
    "kyc": {
      "aadharNumber": "1234-5678-9012",
      "aadharDocS3Key": "documents/cust-abc123/aadhar.pdf",
      "photoS3Key": "documents/cust-abc123/photo.jpg",
      "policeVerificationS3Key": "documents/cust-abc123/pv.pdf"
    },
    "kycStatus": {
      "hasAadhar": true,
      "hasPhoto": true,
      "hasPoliceVerification": false,
      "complete": false
    },
    "currentRental": {
      "propertyId": "prop-abc123",
      "propertyName": "2BHK in Andheri East",
      "leaseStartDate": "2026-01-01",
      "leaseEndDate": "2026-12-31",
      "monthlyRent": "₹50k",
      "securityDeposit": "₹1 L",
      "notes": "Rent paid via bank transfer"
    },
    "rentalHistory": [
      {
        "propertyId": "prop-def456",
        "propertyName": "1BHK in Bandra",
        "leaseStartDate": "2025-01-01",
        "leaseEndDate": "2025-12-31",
        "monthlyRent": "₹40k",
        "securityDeposit": "₹80k"
      }
    ],
    "notes": [
      {
        "noteId": "note-xyz789",
        "content": "Called on 24 June — rent paid on time.",
        "createdBy": "Faizan",
        "createdAt": "2026-06-24"
      }
    ]
  }
}
```

---

## Optional Fields and Null Handling

### Always present
These fields exist in every tenant DTO:

- `name`
- `status`

### Optional fields
These fields may be `null` or omitted if not available:

- `phone`
- `email`
- `address`
- `source`
- `tags`
- `area`
- `currentRental`
- `rentalHistory`
- `rentalHistoryCount`
- `kycStatus`
- `notes`

### Missing KYC object
If a tenant has no KYC data, the `kyc` field should be an empty object with all optional fields set to `null`:

```json
"kyc": {
  "aadharNumber": null,
  "aadharDocS3Key": null,
  "photoS3Key": null,
  "policeVerificationS3Key": null
}
```

### Missing current rental
If a tenant has no active rental, `currentRental` should be `null`:

```json
"currentRental": null
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

For tenant details, notes are limited to the most recent 5.

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
| 100000 | ₹1 L |

The LLM should never receive raw integers for monthlyRent/securityDeposit.

---

## Internal Fields to Always Remove

Before any tenant reaches the AI, remove:

- `PK`
- `SK`
- `GSI1PK`
- `GSI1SK`
- `GSI3PK`
- `GSI3SK`
- `EntityType`
- `tenantId`
- `normalizedPhone`
- `aadharDocS3Key`, `photoS3Key`, `policeVerificationS3Key`, `leaseAgreementS3Key`, `depositReceiptS3Key` (unless view is `full`)
- Any field starting with `internal_`

---

## Additional Views

The views above (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`) are the core tenant views.

The following views cover the remaining tenant management operations. Full DTO examples are in `COMPLETE_TENANT_MANAGEMENT.md`.

### 6. `deactivateConfirmation`

```json
{
  "metadata": { "action": "deactivated" },
  "data": {
    "customerId": "cust-abc123",
    "name": "Sarah Gupta",
    "status": "inactive"
  }
}
```

### 7. `noteCreateConfirmation`

```json
{
  "metadata": { "action": "note_added" },
  "data": {
    "customerId": "cust-abc123",
    "tenantName": "Sarah Gupta",
    "noteId": "note-xyz789",
    "content": "Called on 25 June — rent paid on time.",
    "createdAt": "2026-06-25"
  }
}
```

### 8. `notesList`

```json
{
  "metadata": { "total": 23, "shown": 5, "hasMore": true },
  "data": [
    {
      "noteId": "note-xyz789",
      "content": "Called on 25 June — rent paid on time.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    }
  ]
}
```

### 9. `noteUpdateConfirmation`

```json
{
  "metadata": { "action": "note_updated" },
  "data": {
    "customerId": "cust-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Called on 25 June — rent paid early.",
    "updatedAt": "2026-06-25"
  }
}
```

### 10. `noteDeleteConfirmation`

```json
{
  "metadata": { "action": "note_deleted" },
  "data": {
    "customerId": "cust-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `rentalHistory`

```json
{
  "metadata": { "current": true, "historyCount": 2 },
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

### 12. `currentRentalUpdateConfirmation`

```json
{
  "metadata": { "action": "rental_updated" },
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

### 13. `rentalArchiveConfirmation`

```json
{
  "metadata": { "action": "rental_archived" },
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

### 14–18. Meeting Views

See `COMPLETE_TENANT_MANAGEMENT.md` and `leads/LEAD_AI_VIEW_BUILDER.md`.

### 19. `metricsSummary`

```json
{
  "metadata": {},
  "data": {
    "tenants": { "total": 45, "active": 38, "inactive": 5, "past": 2 },
    "meetings": { "upcoming": 5, "completed": 12, "cancelled": 2 },
    "properties": { "total": 80, "available": 45, "sold": 15, "rented": 20 }
  }
}
```

### 20. `phoneLookupResult`

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

## Error DTOs

### Tenant not found

```json
{
  "metadata": { "error": "tenant_not_found", "message": "Tenant not found" },
  "data": { "customerId": "cust-abc123" }
}
```

### Phone required

```json
{
  "metadata": { "error": "phone_required", "message": "Phone number is required to create a tenant" },
  "data": { "name": "Sarah Gupta" }
}
```

### Name required

```json
{
  "metadata": { "error": "name_required", "message": "Name is required to create a tenant" },
  "data": null
}
```

### Duplicate phone

```json
{
  "metadata": { "error": "duplicate_phone", "message": "A tenant with this phone number already exists" },
  "data": { "customerId": "cust-abc123", "name": "Sarah Gupta", "phone": "9876543210" }
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
  "metadata": { "error": "profile_notes_protected", "message": "The system-generated profile note cannot be edited or deleted" },
  "data": { "noteId": "PROFILE_NOTES" }
}
```

### Rental required

```json
{
  "metadata": { "error": "rental_required", "message": "Tenant does not have an active rental to archive" },
  "data": { "customerId": "cust-abc123" }
}
```

---

## Version

v1.0 — 2026-06-26
