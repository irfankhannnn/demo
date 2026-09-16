# Lifecycle Status Vocabulary (locked)

Agent-facing rules aligned with Seller → Buyer → Owner / Owner → Tenant BRDs.

## People modules

| Module | Who appears | Statuses |
|--------|-------------|----------|
| Leads | Prospects not yet converted | lead pipeline statuses |
| Sellers | Currently marketing a sale listing | active / past / inactive |
| Buyers | Seeking or purchased via agency | active / **purchased** / inactive |
| Owners | Currently own ≥1 property (even if not listing) | active / inactive |
| Tenants | Occupants | active / past / inactive |
| Contacts | Everyone forever | history hub |

## Property (ownership ≠ listing)

| Agent label | `property.status` |
|-------------|-------------------|
| Available for Sale | `for-sale` |
| Available for Rent | `for-rent` |
| Occupied | `rented` |
| Not Listed | `not-listed` (aliases: `inactive`, `available`, `on-hold`) |
| Archived | `archived` |
| Sold (listing history) | LISTING.status = `sold` |

After purchase: ownership transfers immediately; property → **Not Listed**; sale LISTING → **sold**.
Buyer → **purchased** + **active Owner** (visible even if never lists again).
Previous owner leaves Owners if they own 0 properties.

## Key services

- `apps/crm/server/domain/crmDomainModel.js` — constants + labels
- `apps/crm/server/services/transferOwnership.js` — sale path
- `apps/crm/server/services/listingService.js` — listing create/withdraw
- `apps/crm/server/crmDynamodbService.js` — `convertLead`
