# CRM Domain Model — Phase 0–6 Spec

## Canonical entities

| Entity | Purpose |
|--------|---------|
| **Contact** | Person identity (name, phone, email, KYC, bank) |
| **BuyerProfile** | Business data for buyers (budget, prefs, purchaseHistory) |
| **SellerProfile** | Business data for sellers (`lifecycleStatus`: active \| past \| inactive) |
| **OwnerProfile** | Business data for owners (`lifecycleStatus`: active \| passive \| inactive, ownedPropertyIds) |
| **TenantProfile** | Business data for tenants |
| **Property** | Asset; `currentOwnerContactId` is who owns it **now** |
| **Listing** | Marketing state (`EntityType: LISTING`) — sale/rent offer |
| **SaleTransaction** | First-class sale event (`EntityType: SALE_TRANSACTION`) |

## DynamoDB keys

```
CONTACT#{id} / PROFILE
PROPERTY#{id} / PROFILE
LISTING#{id} / PROFILE
SALE#{id} / PROFILE

GSI1 (properties by owner):
  TENANT#{t}#CONTACT#{currentOwnerContactId}   ← preferred
  TENANT#{t}#OWNER#{ownerId}                   ← legacy bridge (dual-read)

GSI2 (listings by status):
  TENANT#{t}#LISTING_STATUS#{status}
```

## Ownership rules

1. On direct sale, `Property.currentOwnerContactId` = buyer Contact id.
2. `ownerId` is cleared (seller is no longer current owner).
3. `previousOwnerContactId` / `previousOwnerId` retain seller references.
4. `ownershipHistory[]` is append-only.
5. All mark-sold / buyer-purchase paths go through `transferOwnership()`.
6. Active sale Listings are closed (`status=sold`) on transfer.

## Listing rules

1. `list-for-sale` / `list-for-rent` create a `LISTING` record via `listingService.createListing()`.
2. Property `status` + `listingStatus` stay in sync for backward-compatible filters.
3. Seller existence is **not** inferred only from `property.status === 'for-sale'`.
4. Lead conversion seller/owner paths create Listing + Contact profiles.

## Seller lifecycle

| Status | Meaning |
|--------|---------|
| `active` | Currently selling / has active sale listings |
| `past` | Sold through agency; no active listings |
| `inactive` | Manually closed relationship |

## List screens

| Screen | Rule |
|--------|------|
| **Owners** | OWNER entities (+ Contact owner role) |
| **Sellers** | Contact with `roles.seller` / SellerProfile |
| **Buyers** | BUYER entities (+ Contact buyer role) |
| **Tenants** | CUSTOMER entities (+ Contact tenant role) |

## API surface

- `GET/POST /api/crm/contacts`
- `GET /api/crm/contacts/sellers?sellerLifecycle=`
- `GET /api/crm/listings?status=&listingType=`
- `POST /api/crm/listings/:id/withdraw`
- `POST /api/crm/properties/:id/list-for-sale` → Listing + property sync
- `POST /api/crm/properties/:id/mark-sold` → `transferOwnership()`
- Lead convert → Contact upsert + optional Listing + optional transferOwnership

## Frontend routes

- `/crm/contacts`, `/crm/contacts/new`, `/crm/contacts/:id`
- `/crm/owners`, `/crm/owners?sellers=1` (sellers from Contact profiles)
- `/crm/properties`, `/crm/buyers`, `/crm/tenants`

## Phase status

| Phase | Status |
|-------|--------|
| 0 Schema | ✅ |
| 1 Contact + profiles | ✅ |
| 2 Ownership transfer | ✅ |
| 3 Listing entity | ✅ |
| 4 Lead → Contact + Listing | ✅ |
| 5 List screens | ✅ |
| 6 Tests | ✅ (unit); Playwright optional |
