# Contact AI DTO Contract

## Envelope

```json
{ "metadata": {}, "data": {} }
```

## searchResults

```json
{
  "metadata": { "total": 3, "shown": 3, "hasMore": false },
  "data": [
    {
      "contactId": "c-1",
      "name": "Ravi Broker",
      "phone": "9876543210",
      "role": "broker",
      "status": "active",
      "email": null
    }
  ]
}
```

List rows hide `contactId` in WhatsApp; ID is kept for tool chaining.

## details

```json
{
  "metadata": {
    "notes": { "total": 2, "shown": 1, "hasMore": true },
    "recommendation": null
  },
  "data": {
    "contactId": "c-1",
    "name": "Ravi Broker",
    "phone": "9876543210",
    "email": "ravi@example.com",
    "role": "broker",
    "status": "active",
    "createdAt": "2026-06-01",
    "lastActivityAt": "2026-07-15",
    "notes": ["Introduced Sakina for Andheri deals."],
    "latestNote": "Introduced Sakina for Andheri deals."
  }
}
```

## createConfirmation / updateConfirmation / deleteConfirmation

Minimal: `name`, `role`, `phone`, `status` + `metadata.action`.

## noteCreateConfirmation

Same pattern as lead notes: `contactName`, `content`, `metadata.action: note_added`.

## Internal fields to remove

`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`.
