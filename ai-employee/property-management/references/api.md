# Property Management API Reference

## Base URL
`${CRM_API_BASE}/api/crm`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/properties` | Query properties (filters + pagination) |
| GET | `/properties/:id` | Get single property with owner, tenant, signed URLs |
| POST | `/properties` | Create property |
| PUT | `/properties/:id` | Update property |
| GET | `/properties/:id/rental-history` | Get rental history |
| GET | `/properties/:id/documents` | List property documents |
| POST | `/properties/:id/list-for-sale` | List property for sale |
| POST | `/properties/:id/list-for-rent` | List property for rent |
| POST | `/properties/:id/mark-sold` | Mark as sold |
| POST | `/properties/:id/mark-rented` | Mark as rented |
| POST | `/properties/:id/vacate` | Vacate property |

## GET /properties Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `available` \| `for-sale` \| `for-rent` \| `rented` \| `sold` \| `on-hold` \| `out-of-stock` |
| `propertyType` | string | Exact match on propertyType |
| `bhk` | number | Exact match on BHK |
| `furnishing` | string | Exact match on furnishing |
| `area` | string | Substring match on area/buildingName/address |
| `city` | string | Substring match on city |
| `ownerId` | string | Exact match on ownerId |
| `search` | string | Substring match on title/area/buildingName/address/city |
| `minRent` | number | `rentAmount >= value` |
| `maxRent` | number | `rentAmount <= value` |
| `minSalePrice` | number | `saleInfo.listedPrice >= value` |
| `maxSalePrice` | number | `saleInfo.listedPrice <= value` |
| `createdFrom` | ISO date | `createdAt >= date` |
| `createdTo` | ISO date | `createdAt <= date` |
| `tag` | string | Exact match on tags |
| `sortBy` | string | `createdAt` (default) \| `title` \| `area` \| `city` \| `status` \| `propertyType` \| `rent` \| `salePrice` \| `updatedAt` |
| `sortOrder` | string | `asc` \| `desc` (default) |
| `limit` | number | Page size (default 50) |
| `offset` | number | Skip N results |

## GET /properties Response

```json
{
  "properties": [...],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```

Each property in `properties` includes light enrichment:
- `ownerName` — resolved from owner record
- `ownerPhone` — resolved from owner record

## Property Schema

| Field | Type | Notes |
|-------|------|-------|
| `propertyId` | string | Auto UUID |
| `ownerId` | string | **Required** |
| `propertyType` | string | **Required** — apartment\|house\|villa\|commercial\|land\|office\|shop\|warehouse |
| `title` | string | Optional display name |
| `status` | string | available (default) \| for-sale \| for-rent \| rented \| sold \| on-hold \| out-of-stock |
| `bhk` | number | Bedrooms |
| `floor` | number/string | Floor number |
| `furnishing` | string | unfurnished \| semi-furnished \| fully-furnished |
| `carpetArea` | string | e.g. "850 sqft" |
| `area` | string | Locality |
| `city` | string | City |
| `address` | string | Full address |
| `description` | string | Free text |
| `monthlyRent` | number | In rupees (integer) |
| `securityDeposit` | number | In rupees |
| `salePrice` | number | In rupees |
| `listedPrice` | number | For-sale listing price |
| `images` | string[] | S3 keys (upload via UI) |
| `videos` | string[] | S3 keys (upload via UI) |
| `tenantCustomerId` | string | ID of current tenant |
| `createdAt` | ISO string | Auto |

## Status Action Payloads

### list-for-sale
```json
{"listedPrice": 8500000}
```

### list-for-rent
```json
{"expectedRent": 45000, "securityDeposit": 90000}
```

### mark-sold
```json
{"soldPrice": 8500000, "buyerId": "b1", "saleType": "direct", "brokerageAmount": 100000}
```
`saleType`: `direct` (requires `buyerId`) | `lost` (requires `reasonLost`)

### mark-rented
```json
{
  "customerId": "c1",
  "rentalDetails": {
    "leaseStartDate": "2026-06-01",
    "leaseEndDate": "2027-05-31",
    "monthlyRent": 45000,
    "securityDeposit": 90000
  }
}
```

### vacate
No body required.

## Money Normalization
| Input | Value |
|-------|-------|
| 80 lakh / 80L | 8000000 |
| 1.5 crore / 1.5Cr | 15000000 |
| 45k / 45,000 | 45000 |
| ₹50,000 | 50000 |

## Auth Header
All requests require: `Authorization: Bearer <CRM_TOKEN>`
