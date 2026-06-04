# Buyer Management API Reference

## Base URL
`${CRM_API_BASE}/api/crm`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/buyers?search=&status=&priority=&propertyType=&bhk=&furnishing=&area=&minBudget=&maxBudget=&createdFrom=&createdTo=&tag=&sortBy=&sortOrder=&limit=&offset=` | List buyers with full filters, sorting, pagination |
| GET | `/buyers/:id` | Get single buyer |
| POST | `/buyers` | Create buyer |
| PUT | `/buyers/:id` | Update buyer |
| GET | `/buyers/:id/notes` | List notes |
| POST | `/buyers/:id/notes` | Add note |
| GET | `/buyers/metrics/summary` | Buyer metrics |
| GET | `/buyers/lookup/by-phone?phone=` | Lookup by phone |

## Query Parameters (`GET /buyers`)

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Free-text search on name, phone, preferredArea, requirement (min 2 chars) |
| `status` | string | `active` \| `inactive` (pass `all` to skip) |
| `priority` | string | `low` \| `medium` \| `high` (pass `all` to skip) |
| `propertyType` | string | `apartment` \| `house` \| `villa` \| `commercial` \| `land` \| `office` \| `shop` (pass `all` to skip) |
| `source` | string | Exact match on `source` |
| `bhk` | number | Bedroom count (exact match) |
| `furnishing` | string | `furnished` \| `semi-furnished` \| `unfurnished` |
| `area` | string | Substring match on `preferredArea` |
| `minBudget` | number | Minimum budget in rupees |
| `maxBudget` | number | Maximum budget in rupees |
| `createdFrom` | ISO date | `createdAt >= date` |
| `createdTo` | ISO date | `createdAt <= date` |
| `tag` | string | Exact tag match in `tags` array |
| `sortBy` | string | `name` \| `priority` \| `budget` \| `propertyType` \| `preferredArea` \| `status` \| `createdAt` \| `updatedAt` (default: `createdAt`) |
| `sortOrder` | string | `asc` \| `desc` (default: `desc`) |
| `limit` | number | Page size, max 200 (default: 50) |
| `offset` | number | Items to skip (default: 0) |

## Paginated Response (`GET /buyers`)

```json
{
  "buyers": [ /* Buyer objects */ ],
  "total": 124,
  "limit": 20,
  "offset": 0
}
```

## Buyer Schema

| Field | Type | Notes |
|-------|------|-------|
| `buyerId` | string | Auto UUID |
| `name` | string | **Required** |
| `phone` | string | Recommended for dedup |
| `email` | string | Optional |
| `budget` | number | In rupees (integer) |
| `preferredArea` | string | Locality preference |
| `propertyType` | string | apartment\|house\|villa\|commercial\|land\|office\|shop |
| `bhk` | number | Bedroom count |
| `furnishing` | string | furnished \| semi-furnished \| unfurnished |
| `requirement` | string | Free-text requirement notes |
| `priority` | string | low \| medium (default) \| high |
| `status` | string | active (default) \| inactive |
| `source` | string | Where buyer came from |
| `tags` | array | String tags |
| `purchaseHistory` | array | Properties purchased |
| `linkedRoles` | object | Cross-role info if phone matches owner/tenant |
| `createdAt` | ISO string | Auto |

## Note Schema

| Field | Type | Notes |
|-------|------|-------|
| `noteId` | string | Auto |
| `content` | string | Required |
| `createdAt` | ISO string | Auto |

## Money Normalization
| Input | Value |
|-------|-------|
| 80 lakh / 80L | 8000000 |
| 1.5 crore / 1.5Cr | 15000000 |
| 50k / 50,000 | 50000 |

## Auth Header
All requests require: `Authorization: Bearer <CRM_TOKEN>`
