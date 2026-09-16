# Lead AI DTO Contract

## Purpose

This document defines the data contract between the AI agent and the backend for **all lead-related operations**: CRUD, notes, conversion, meetings, metrics, and rich queries.

For the complete operation inventory and tool-to-view mapping, see `COMPLETE_LEAD_MANAGEMENT.md`.

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
- The tool name (e.g., `search_leads`, `get_lead`) carries the entity and view semantics.

---

## Views

### 1. `searchResults`

Used when returning a list of leads from `search_leads` or `get_leads`.

```json
{
  "metadata": {
    "total": 18,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  },
  "data": [
    {
      "name": "Geeta Chatterjee",
      "leadType": "buyer",
      "status": "lost",
      "priority": "high",
      "area": "Vikhroli",
      "propertyType": "Villa",
      "bhk": 5,
      "budget": "₹1.7 Cr"
    },
    {
      "name": "Ashok Menon",
      "leadType": "buyer",
      "status": "negotiating",
      "priority": "high",
      "area": "Churchgate",
      "propertyType": "Apartment",
      "bhk": 3,
      "budget": "₹1.34 Cr"
    }
  ]
}
```

**Fields to expose:**
| Field | Source | Reason |
|---|---|---|
| `name` | `lead.name` | Identification |
| `leadType` | `lead.leadType` | Type context |
| `status` | `lead.status` | State |
| `priority` | `lead.priority` | Importance |
| `area` | Derived from requirement | Location |
| `propertyType` | Derived from requirement | Property type |
| `bhk` | Derived from requirement | Size |
| `budget` | Derived from requirement | Price (formatted as money) |

**Fields to hide:**
- `leadId`
- `phone`
- `email`
- `source`
- `assignedTo`
- `notes`
- `history`
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`

---

### 2. `details`

Used when returning a single lead from `get_lead` or when the user asks for details.

```json
{
  "metadata": {},
  "data": {
    "leadId": "lead-ashok-123",
    "name": "Ashok Menon",
    "leadType": "buyer",
    "status": "negotiating",
    "priority": "high",
    "phone": "7001062572",
    "email": "ashok.1.1782400065671@test.com",
    "source": "whatsapp",
    "assignedTo": "Faizan",
    "createdAt": "2026-06-24",
    "requirement": {
      "propertyType": "Apartment",
      "bhk": 3,
      "area": "Churchgate",
      "budget": "₹1.34 Cr",
      "furnishing": "Semi-furnished",
      "requirement": "Looking for a sea-facing apartment"
    },
    "notes": [
      "Called on 24 June — interested in 3BHK.",
      "Budget flexible up to ₹1.5 Cr."
    ]
  }
}
```

**Fields to expose:**
- Basic: `name`, `leadType`, `status`, `priority`, `phone`, `email`, `source`, `assignedTo`, `createdAt`
- Requirement: flattened based on `leadType`
- Notes: last 5 notes only (with pagination if more)

**Fields to hide:**
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`
- Full `history` (unless view is `full`)

---

### 3. `createConfirmation`

Used after `create_lead` succeeds.

```json
{
  "metadata": {
    "action": "created"
  },
  "data": {
    "name": "Joy Shah",
    "leadType": "owner",
    "status": "new",
    "phone": "9769141234",
    "area": "Sakinaka",
    "leadId": "lead-abc123"
  }
}
```

Note: `leadId` is included here because the user may need to reference it later. In normal views it is hidden.

---

### 4. `updateConfirmation`

Used after `update_lead` succeeds.

```json
{
  "metadata": {
    "action": "updated",
    "updatedFields": ["status", "buyerRequirement.budget"]
  },
  "data": {
    "leadId": "lead-ashok-123",
    "name": "Ashok Menon",
    "leadType": "buyer",
    "status": "negotiating"
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
    "name": "Ashok Menon",
    "leadType": "buyer",
    "status": "negotiating",
    "priority": "high",
    "phone": "7001062572",
    "email": "ashok.1.1782400065671@test.com",
    "source": "whatsapp",
    "assignedTo": "Faizan",
    "createdAt": "2026-06-24",
    "updatedAt": "2026-06-25",
    "requirement": { ... },
    "notes": [ ... ],
    "history": [ ... ]
  }
}
```

---

## Optional Fields and Null Handling

### Always present
These fields exist in every lead DTO:

- `name`
- `leadType`
- `status`

### Optional fields
These fields may be `null` or omitted if not available:

- `phone`
- `email`
- `priority`
- `source`
- `assignedTo`
- `area`
- `propertyType`
- `bhk`
- `budget` / `expectedPrice` / `rentExpected`
- `furnishing`
- `requirement`

### Missing requirement object
If a lead has no active requirement object (e.g., a malformed or incomplete lead), the `requirement` field should be an empty object with all optional fields set to `null`:

```json
"requirement": {
  "propertyType": null,
  "bhk": null,
  "furnishing": null,
  "budget": null,
  "preferredArea": null,
  "requirement": null
}
```

---

## History Format

The `history` field in the `full` view contains audit records. Each entry follows this structure:

```json
"history": [
  {
    "action": "status_changed",
    "details": "Lost → Negotiating",
    "updatedBy": "Faizan",
    "timestamp": "2026-06-25T10:30:00Z"
  },
  {
    "action": "note_added",
    "details": "Budget flexible up to ₹1.5 Cr",
    "updatedBy": "system",
    "timestamp": "2026-06-24T14:00:00Z"
  }
]
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

For lead details, notes are limited to the most recent 5.

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

The LLM should never receive raw integers for budget/price/rent.

---

## Internal Fields to Always Remove

Before any lead reaches the AI, remove:

- `PK`
- `SK`
- `GSI1PK`
- `GSI1SK`
- `GSI2PK`
- `GSI2SK`
- `GSI3PK`
- `GSI3SK`
- `EntityType`
- `tenantId`
- `normalizedPhone`
- `history` (unless `view: "full"`)
- Any field starting with `internal_`

---

## Requirement Flattening

The requirement object is flattened based on `leadType`:

| leadType | Source object | Exposed fields |
|---|---|---|
| `buyer` | `buyerRequirement` | `budget`, `preferredArea`, `bhk`, `propertyType`, `furnishing`, `requirement` |
| `seller` | `sellerProperty` | `expectedPrice`, `area`, `city`, `propertyType`, `bhk`, `furnishing`, `buildingName`, `flatNumber`, `floor`, `carpetArea`, `address` |
| `owner` | `ownerProperty` | `rentExpected`, `securityDeposit`, `area`, `city`, `propertyType`, `bhk`, `furnishing`, `buildingName`, `flatNumber`, `floor`, `carpetArea`, `address` |
| `tenant` | `tenantRequirement` | `budget`, `preferredArea`, `bhk`, `propertyType`, `furnishing`, `requirement` |

The AI DTO should expose these as a flat `requirement` object with consistent naming.

---

## Additional Views

The views above (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`) are the core lead views.

The following views cover the remaining lead management operations. Full DTO examples are in `COMPLETE_LEAD_MANAGEMENT.md`.

### 6. `deleteConfirmation`

Returned after `delete_lead` succeeds.

```json
{
  "metadata": { "action": "deleted" },
  "data": {
    "leadId": "lead-abc123",
    "name": "Ramesh Bedi",
    "leadType": "tenant"
  }
}
```

### 7. `noteCreateConfirmation`

Returned after `create_lead_note` succeeds.

```json
{
  "metadata": { "action": "note_added" },
  "data": {
    "leadId": "lead-abc123",
    "leadName": "Ashok Menon",
    "noteId": "note-xyz789",
    "content": "Called on 25 June — interested in 3BHK.",
    "createdAt": "2026-06-25"
  }
}
```

### 8. `notesList`

Returned from `get_lead_notes`.

```json
{
  "metadata": { "total": 23, "shown": 5, "hasMore": true },
  "data": [
    {
      "noteId": "note-xyz789",
      "content": "Called on 25 June — interested in 3BHK.",
      "createdBy": "Faizan",
      "createdAt": "2026-06-25"
    }
  ]
}
```

### 9. `noteUpdateConfirmation`

Returned after `update_lead_note` succeeds.

```json
{
  "metadata": { "action": "note_updated" },
  "data": {
    "leadId": "lead-abc123",
    "noteId": "note-xyz789",
    "content": "Updated: Called on 25 June — very interested in 3BHK.",
    "updatedAt": "2026-06-25"
  }
}
```

### 10. `noteDeleteConfirmation`

Returned after `delete_lead_note` succeeds.

```json
{
  "metadata": { "action": "note_deleted" },
  "data": {
    "leadId": "lead-abc123",
    "noteId": "note-xyz789"
  }
}
```

### 11. `conversionConfirmation`

Returned after `convert_lead` succeeds.

```json
{
  "metadata": { "action": "converted", "convertedTo": "buyer" },
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

### 12. `meetingCreateConfirmation`

Returned after `create_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_created" },
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

### 13. `meetingDetails`

Returned from `get_meeting`.

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

### 14. `meetingsList`

Returned from `get_upcoming_meetings`.

```json
{
  "metadata": { "total": 5, "days": 7, "hasMore": false },
  "data": [
    {
      "meetingId": "mtg-abc123",
      "title": "Site visit with Ashok",
      "scheduledDate": "2026-06-28",
      "status": "scheduled",
      "relatedEntityType": "lead",
      "relatedEntityName": "Ashok Menon",
      "location": "Vikhroli office"
    }
  ]
}
```

### 15. `meetingUpdateConfirmation`

Returned after `update_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_updated", "updatedFields": ["scheduledDate", "status"] },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok",
    "scheduledDate": "2026-06-30",
    "status": "rescheduled"
  }
}
```

### 16. `meetingDeleteConfirmation`

Returned after `delete_meeting` succeeds.

```json
{
  "metadata": { "action": "meeting_deleted" },
  "data": {
    "meetingId": "mtg-abc123",
    "title": "Site visit with Ashok"
  }
}
```

### 17. `metricsSummary`

Returned from `get_crm_metrics`.

```json
{
  "metadata": {},
  "data": {
    "leads": {
      "total": 132,
      "byType": { "buyer": 48, "seller": 21, "owner": 36, "tenant": 27 },
      "byStatus": { "new": 40, "contacted": 30, "qualified": 20, "negotiating": 15, "lost": 27 }
    },
    "meetings": { "upcoming": 5, "completed": 12, "cancelled": 2 },
    "properties": { "total": 80, "available": 45, "sold": 15, "rented": 20 }
  }
}
```

### 18–22. Rich Query Views (Phase K)

These views are defined in `COMPLETE_LEAD_MANAGEMENT.md`:

- `budgetRanking` — leads sorted by budget
- `staleLeads` — leads with no recent updates
- `priorityRanking` — leads sorted by priority
- `followUpQueue` — leads needing follow-up
- `conversionCandidates` — qualified leads with phone ready for conversion

---

## Error DTOs

### Lead not found

```json
{
  "metadata": { "error": "lead_not_found", "message": "Lead not found" },
  "data": null
}
```

### Already converted

```json
{
  "metadata": { "error": "already_converted", "message": "Lead has already been converted" },
  "data": { "leadId": "lead-abc123", "convertedAt": "2026-06-20", "convertedTo": "buyer" }
}
```

### Cannot delete converted lead

```json
{
  "metadata": { "error": "cannot_delete_converted", "message": "Cannot delete a converted lead" },
  "data": { "leadId": "lead-abc123", "convertedAt": "2026-06-20" }
}
```

### Phone required for conversion

```json
{
  "metadata": { "error": "phone_required", "message": "Phone number is required to convert a lead" },
  "data": { "leadId": "lead-abc123", "leadName": "Ashok Menon" }
}
```

### Empty search results

```json
{
  "metadata": { "total": 0, "hasMore": false },
  "data": []
}
```

---

## Version

v2.0 — 2026-06-26 (expanded for complete lead management)
