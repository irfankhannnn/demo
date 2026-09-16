# Priority 3 — AI DTO / Tool Response Shapes

Source: `apps/crm/server/skillInvoker.js`, `apps/crm/server/aiDtoMiddleware.js`, `apps/crm/server/aiViewBuilders/`, `apps/crm/server/crmDynamodbService.js`

---

## Universal tool result wrapper

Every tool returns through `skillInvoker`:

```json
{
  "ok": true,
  "data": { }
}
```

On failure:

```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

The LLM sees a **truncated** version of successful results (`truncateToolResultForLlm` in `agentRuntime.js`):

- Lists: count + top 3 items (name + one key field)
- Single entities: all fields (usually small)
- Summary/insight tools: **never truncated**
- Errors: unchanged

---

## AI DTO envelope (when feature flags enabled)

View builders wrap payloads as:

```json
{
  "metadata": {
    "total": 15,
    "shown": 5,
    "hasMore": true,
    "action": "created",
    "updatedFields": ["status", "budget"]
  },
  "data": { }
}
```

`data` may be a **single object** or an **array** depending on the tool.

Feature flags: `USE_AI_DTO_FOR_LEADS`, `USE_AI_DTO_FOR_OWNERS`, `USE_AI_DTO_FOR_TENANTS`, `USE_AI_DTO_FOR_MEETINGS` (all default `false` unless set in env).

---

## Lead — search list (`search_leads`)

**AI DTO** (`buildSearchResults`):

```json
{
  "metadata": { "total": 3, "shown": 3, "hasMore": false },
  "data": [
    {
      "leadId": "lead-abc123",
      "name": "Rahul Shah",
      "phone": "9876543210",
      "status": "qualified",
      "leadType": "buyer",
      "priority": "high",
      "score": 85,
      "source": "whatsapp",
      "assignedTo": "Aman",
      "area": "Andheri",
      "budget": "₹2Cr",
      "propertyType": "apartment",
      "bhk": "3",
      "lastActivityAt": "12 Jul 2026"
    }
  ]
}
```

**Raw** (when AI DTO off): array of full lead objects with nested `buyerRequirement` / `sellerProperty` / etc.

---

## Lead — detail (`get_lead`)

```json
{
  "metadata": {
    "notes": { "total": 8, "shown": 5, "hasMore": true }
  },
  "data": {
    "leadId": "lead-abc123",
    "name": "Rahul Shah",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "status": "qualified",
    "leadType": "buyer",
    "priority": "high",
    "score": 85,
    "source": "whatsapp",
    "assignedTo": "Aman",
    "createdAt": "1 Jun 2026",
    "lastActivityAt": "12 Jul 2026",
    "requirement": {
      "propertyType": "apartment",
      "bhk": "3",
      "furnishing": "semi-furnished",
      "budget": "₹2Cr",
      "preferredArea": "Andheri",
      "requirement": "Sea-facing preferred"
    },
    "tags": ["hot"],
    "notes": [
      { "noteId": "n1", "content": "Called — interested", "createdBy": "Aman", "createdAt": "10 Jul 2026" }
    ],
    "history": []
  }
}
```

---

## Lead — create confirmation (`create_lead`)

```json
{
  "metadata": { "action": "created" },
  "data": {
    "leadId": "lead-new456",
    "name": "Faizan",
    "phone": "9876543210",
    "leadType": "buyer",
    "status": "new",
    "area": null,
    "budget": "₹80L"
  }
}
```

---

## Lead — note added (`create_lead_note`)

```json
{
  "metadata": { "action": "note_added" },
  "data": {
    "leadId": "lead-abc123",
    "leadName": "Ashok Menon",
    "noteId": "note-xyz",
    "content": "Site visit Saturday 11am",
    "createdAt": "19 Jul 2026"
  }
}
```

---

## Owner — search list (`get_owners`)

```json
{
  "metadata": { "total": 2, "shown": 2, "hasMore": false },
  "data": [
    {
      "ownerId": "owner-1",
      "name": "Raj Kumar",
      "phone": "9123456780",
      "status": "active",
      "propertyCount": 3,
      "area": "Bandra"
    }
  ]
}
```

---

## Tenant — detail (`get_tenant`)

```json
{
  "data": {
    "customerId": "tenant-1",
    "name": "Priya Sharma",
    "phone": "9988776655",
    "status": "active",
    "currentRental": {
      "propertyTitle": "3BHK Andheri West",
      "monthlyRent": "₹45k",
      "leaseStart": "1 Jan 2026",
      "leaseEnd": "31 Dec 2026"
    },
    "requirement": {
      "budget": "₹50k",
      "preferredArea": "Powai",
      "bhk": "2"
    }
  }
}
```

---

## Meeting — upcoming list (`get_upcoming_meetings`)

```json
{
  "metadata": { "total": 2, "shown": 2, "hasMore": false },
  "data": [
    {
      "meetingId": "meet-1",
      "title": "Site visit — Rahul",
      "scheduledDate": "20 Jul 2026",
      "status": "scheduled",
      "relatedEntityType": "lead",
      "relatedEntityName": "Rahul Shah"
    }
  ]
}
```

---

## Property — search list (`search_properties`)

**Raw shape** (no AI DTO yet):

```json
[
  {
    "propertyId": "prop-1",
    "title": "3BHK Andheri West",
    "propertyType": "apartment",
    "city": "Mumbai",
    "area": "Andheri",
    "status": "available",
    "bhk": 3,
    "furnishing": "semi-furnished",
    "monthlyRent": 45000,
    "salePrice": null,
    "ownerId": "owner-1"
  }
]
```

---

## Buyer — search list (`search_buyers`)

**Raw shape**:

```json
[
  {
    "buyerId": "buyer-1",
    "name": "Rohan",
    "phone": "9876501234",
    "status": "active",
    "budget": 15000000,
    "propertyType": "apartment",
    "bhk": 3,
    "priority": "high"
  }
]
```

---

## Layer 2 — Summary tools (always raw aggregates)

### `get_leads_summary`

```json
{
  "total": 15,
  "active": 12,
  "byType": { "buyer": 5, "seller": 2, "tenant": 5, "owner": 3 },
  "byStatus": { "new": 4, "contacted": 3, "qualified": 5, "negotiating": 2, "converted": 1, "lost": 0 },
  "byPriority": { "high": 4, "medium": 8, "low": 3 },
  "unassigned": 2
}
```

### `get_properties_summary`

```json
{
  "total": 24,
  "available": 10,
  "onHold": 2,
  "rented": 8,
  "sold": 4,
  "agreementsPending": 3,
  "verificationsPending": 1,
  "byType": { "apartment": 18, "house": 4, "villa": 2 }
}
```

### `get_pipeline_summary`

```json
{
  "stages": {
    "new": 4,
    "contacted": 3,
    "qualified": 5,
    "negotiating": 2,
    "converted": 1,
    "lost": 0
  },
  "activeInPipeline": 14,
  "conversionRate": 0.067
}
```

### `get_followup_summary`

```json
{
  "overdueCount": 4,
  "meetingsTodayCount": 2,
  "meetingsTomorrowCount": 1,
  "topOverdue": [
    { "leadId": "...", "name": "Rahul Shah", "daysSinceContact": 6, "leadType": "buyer" }
  ],
  "meetingsToday": [
    { "meetingId": "...", "title": "Site visit", "scheduledDate": "2026-07-19T10:00:00Z" }
  ]
}
```

### `get_priority_leads`

```json
{
  "items": [
    {
      "leadId": "lead-abc",
      "name": "Rahul Shah",
      "phone": "9876543210",
      "leadType": "buyer",
      "status": "qualified",
      "priority": "high",
      "budget": 20000000,
      "area": "Andheri",
      "daysSinceContact": 6,
      "score": 72,
      "reason": "high budget, no contact in 6 days"
    }
  ]
}
```

### `get_daily_brief`

```json
{
  "newLeadsToday": 2,
  "meetingsTodayCount": 3,
  "overdueFollowups": 4,
  "pendingAgreements": 2,
  "pendingVerifications": 1,
  "hotLeads": [
    { "leadId": "...", "name": "Rahul Shah", "budget": 20000000, "reason": "high budget, ..." }
  ],
  "meetingsToday": [
    { "meetingId": "...", "title": "Site visit", "scheduledDate": "2026-07-19T10:00:00Z" }
  ]
}
```

### `suggest_next_actions`

```json
{
  "actions": [
    {
      "action": "Call Rahul Shah",
      "entityType": "lead",
      "entityId": "lead-abc",
      "reason": "high budget, no contact in 6 days",
      "priority": "high"
    },
    {
      "action": "Attend meeting: Site visit — Priya",
      "entityType": "meeting",
      "entityId": "meet-1",
      "reason": "Scheduled today",
      "priority": "high"
    }
  ]
}
```

### `get_crm_metrics` (legacy broad metrics)

```json
{
  "totalCustomers": 12,
  "activeCustomers": 10,
  "totalOwners": 8,
  "activeOwners": 7,
  "totalProperties": 24,
  "availableProperties": 10,
  "onHoldProperties": 2,
  "rentedProperties": 8,
  "soldProperties": 4,
  "agreementsDone": 20,
  "agreementsPending": 3,
  "verificationsDone": 22,
  "verificationsPending": 1,
  "leadsCount": 15,
  "buyersCount": 6,
  "sellersCount": 3,
  "tenantsCount": 12
}
```

### `get_dashboard_snapshot`

```json
{
  "leads": { "total": 15, "active": 12, "byType": { }, "byStatus": { } },
  "properties": { "total": 24, "available": 10 },
  "pipeline": { "stages": { }, "conversionRate": 0.067 },
  "followups": { "overdue": 4, "meetingsToday": 2, "meetingsTomorrow": 1 },
  "topPriority": [
    { "name": "Rahul Shah", "budget": 20000000, "reason": "high budget, ..." }
  ]
}
```

---

## Delete operations

Many delete tools return:

```json
{ "ok": true, "data": true }
```

Formatter renders: `✅ Lead deleted successfully.`

---

## Design notes for WhatsApp cards

| Data available | Good for card |
|----------------|---------------|
| `name`, `status`, `budget` (formatted), `area` | List row |
| `reason`, `score` | Priority / recommendation |
| `byType`, `byStatus` counts | Summary headline + bullets |
| `leadId`, `propertyId` | Internal — ideally hidden from user |
| `phone` | Show on detail or on explicit request |
| `metadata.hasMore` | "...and 10 more" pagination hint |

When AI DTO is off, money may arrive as raw integers — formatter applies `formatMoney()` at display time.
