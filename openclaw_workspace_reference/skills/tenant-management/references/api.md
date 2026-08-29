# Tenant Management API Reference

## Base URL
`${CRM_API_BASE}/api/crm`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/customers` | Query tenants (filters + pagination) |
| GET | `/customers/:id` | Get single tenant |
| POST | `/customers` | Create tenant |
| PUT | `/customers/:id` | Update tenant |
| GET | `/customers/:id/notes` | List notes |
| POST | `/customers/:id/notes` | Add note |
| PUT | `/customers/:id/notes/:noteId` | Update note |
| DELETE | `/customers/:id/notes/:noteId` | Delete note |
| GET | `/customers/:id/rental-history` | Get current + history |
| PUT | `/customers/:id/current-rental` | Update current rental |
| POST | `/customers/:id/archive-rental` | Archive current rental |

## GET /customers Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `active` \| `inactive` \| `past` |
| `search` | string | Substring match on name/phone/address |
| `area` | string | Substring match on address |
| `source` | string | Exact match on source |
| `tag` | string | Exact match on tags |
| `hasCurrentRental` | boolean | `true` or `false` |
| `hasRentalHistory` | boolean | `true` or `false` |
| `leaseEndingWithinDays` | number | Lease ends within N days |
| `propertyId` | string | Exact match on `currentRental.propertyId` |
| `monthlyRentMin` | number | `currentRental.monthlyRent >= value` |
| `monthlyRentMax` | number | `currentRental.monthlyRent <= value` |
| `createdFrom` | ISO date | `createdAt >= date` |
| `createdTo` | ISO date | `createdAt <= date` |
| `sortBy` | string | `createdAt` (default) \| `name` \| `status` \| `updatedAt` \| `monthlyRent` \| `leaseEndDate` |
| `sortOrder` | string | `asc` \| `desc` (default) |
| `limit` | number | Page size (default 50, max 200) |
| `offset` | number | Skip N results |

## GET /customers Response

```json
{
  "customers": [...],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```

## Tenant (Customer) Schema

| Field | Type | Notes |
|-------|------|-------|
| `customerId` | string | Auto UUID |
| `name` | string | **Required** |
| `phone` | string | Recommended for dedup |
| `email` | string | Optional |
| `address` | string | Optional |
| `status` | string | `active` \| `inactive` \| `past` |
| `source` | string | Optional — how the tenant was acquired |
| `tags` | string[] | Optional — array of labels |
| `notes` | string | General notes text |
| `currentRental` | object | `{ propertyId, leaseStartDate, leaseEndDate, monthlyRent, securityDeposit }` |
| `rentalHistory` | array | Previous rentals |
| `createdAt` | ISO string | Auto |
| `updatedAt` | ISO string | Auto |

## currentRental Schema

| Field | Type | Notes |
|-------|------|-------|
| `propertyId` | string | Required |
| `leaseStartDate` | ISO date | Required |
| `leaseEndDate` | ISO date | Optional |
| `monthlyRent` | number | Required |
| `securityDeposit` | number | Optional |

## Money Normalization
| Input | Value |
|-------|-------|
| 45k / 45,000 | 45000 |
| 1.2 lakh / 1.2L | 120000 |

## Auth Header
All requests require: `Authorization: Bearer <CRM_TOKEN>`
