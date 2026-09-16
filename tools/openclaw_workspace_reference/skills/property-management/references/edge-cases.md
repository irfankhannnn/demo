# Property Management — Edge Cases & Business Rules

## Required Fields
- `ownerId` and `propertyType` are required to create a property.
- If user says "add a property for Rajesh Mehta", first search for the owner, get `ownerId`, then create.

## Status Flow
```
available → for-sale → sold
available → for-rent → rented → available (after vacate)
any → on-hold
```
- Cannot go back from `sold` — permanent.
- `vacate` moves current rental to history and sets status back to `available`.

## Confirmation Required
Always confirm with the user before executing:
- `list-for-sale`
- `list-for-rent`
- `mark-sold`
- `mark-rented`
- `vacate`

## mark-sold Rules
- `saleType=direct` requires `buyerId` (existing buyer in CRM).
- `saleType=lost` requires `reasonLost` — used when the deal was lost to another party.
- `brokerageAmount` optional, logs brokerage earned.
- `brokerageLost` optional, logs brokerage lost (for `lost` type).

## mark-rented Rules
- `customerId` must be an existing tenant/customer.
- `rentalDetails` must include `leaseStartDate` and `monthlyRent`.
- If the tenant already has a current rental, archive it first.

## vacate Rules
- Sets property status back to `available`.
- Moves current `currentRental` to `rentalHistory`.
- Does not delete the tenant.

## Search Limitations
- `searchProperties` does server-side text search on area/city + filters.
- `bhk` parameter is string in query (e.g. `2` for 2BHK).

## Money Normalization
| Input | Value |
|-------|-------|
| 80 lakh / 80L | 8000000 |
| 1.5 crore / 1.5Cr | 15000000 |
| 45k / 45,000 | 45000 |

## Document Uploads
- Images, videos, and documents require file upload via the web UI.
- Chat cannot upload files. Mention this if user asks.

## Property Type Values
`apartment`, `house`, `villa`, `commercial`, `land`, `office`, `shop`, `warehouse`
