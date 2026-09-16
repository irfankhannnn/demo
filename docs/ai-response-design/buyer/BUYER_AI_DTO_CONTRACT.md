# Buyer AI DTO Contract

See also: [`docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md`](../../interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md)

## Envelope

```json
{ "metadata": {}, "data": {} }
```

## details

```json
{
  "metadata": {
    "notes": { "total": 1, "shown": 1, "hasMore": false },
    "recommendation": null
  },
  "data": {
    "buyerId": "b-1",
    "name": "Sakina Shaikh",
    "phone": "9876512345",
    "email": null,
    "status": "active",
    "budget": "₹90L",
    "preferredArea": "Andheri",
    "propertyType": "Apartment",
    "bhk": 2,
    "createdAt": "2026-07-12",
    "lastActivityAt": "2026-07-18",
    "nextFollowUpDate": "2026-07-20",
    "latestNote": "Site visit weekend",
    "interactions": 3
  }
}
```

## searchResults

Compact: name, status, budget, preferredArea, bhk, propertyType.

## Internal fields to remove

`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `normalizedPhone`.
