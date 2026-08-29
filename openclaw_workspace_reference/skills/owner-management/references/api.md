# Owner Management API Reference

## Base URL
`${CRM_API_BASE}/api/crm`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/owners` | Query owners (filters + pagination) |
| GET | `/owners/:id` | Get single owner |
| POST | `/owners` | Create owner |
| PUT | `/owners/:id` | Update owner |
| GET | `/owners/:id/notes` | List owner notes |
| POST | `/owners/:id/notes` | Add note |
| PUT | `/owners/:id/notes/:noteId` | Update note |
| DELETE | `/owners/:id/notes/:noteId` | Delete note |
| GET | `/owners/:id/properties` | Get owner's properties |
| GET | `/owners/lookup/by-phone?phone=` | Lookup owner by phone |

## GET /owners Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `active` \| `inactive` |
| `source` | string | Exact match on source |
| `area` | string | Substring match on address |
| `search` | string | Substring match on name or phone |
| `createdFrom` | ISO date | `createdAt >= date` |
| `createdTo` | ISO date | `createdAt <= date` |
| `hasProperties` | boolean | Only owners with `propertyCount > 0` |
| `seller` | boolean | Only owners with for-sale/sold properties |
| `propertyType` | string | Owners who own properties of this type (e.g. `villa`, `apartment`) |
| `listingType` | string | `sale` \| `rent` — owners with properties of this listing type |
| `bhk` | number | Owners with properties matching BHK |
| `furnishing` | string | Owners with properties matching furnishing |
| `minProperties` | number | Owners with at least N properties |
| `maxProperties` | number | Owners with at most N properties |
| `tag` | string | Owners who have this tag |
| `hasPAN` | boolean | Owners with PAN number set |
| `hasAadhar` | boolean | Owners with Aadhar number set |
| `hasBankDetails` | boolean | Owners with bankName + accountNumber + ifscCode set |
| `sortBy` | string | `createdAt` (default) \| `name` \| `status` \| `source` \| `updatedAt` |
| `sortOrder` | string | `asc` \| `desc` (default) |
| `limit` | number | Page size (default 50) |
| `offset` | number | Skip N results |

## GET /owners Response

```json
{
  "owners": [...],
  "total": 120,
  "limit": 50,
  "offset": 0,
  "sellerCount": 15
}
```

Each owner in `owners` includes computed fields:
- `propertyCount` — number of linked properties
- `isSeller` — true if owner has for-sale or sold properties

## Owner Schema

| Field | Type | Notes |
|-------|------|-------|
| `ownerId` | string | Auto-generated UUID |
| `name` | string | **Required** |
| `phone` | string | Recommended for dedup |
| `email` | string | Optional |
| `address` | string | Optional |
| `status` | string | `active` (default) \| `inactive` |
| `source` | string | How owner was acquired |
| `notes` | string | General notes text |
| `tags` | string[] | e.g. `["premium", "repeat"]` |
| `panNumber` | string | KYC |
| `aadharNumber` | string | KYC |
| `bankName` | string | Banking detail |
| `accountNumber` | string | Banking detail |
| `ifscCode` | string | Banking detail |
| `bankDetails` | object | Additional banking info |
| `photoS3Key` | string | S3 key for photo (upload via UI) |
| `panDocS3Key` | string | S3 key for PAN doc |
| `aadharDocS3Key` | string | S3 key for Aadhar doc |
| `propertyCount` | number | Computed (read-only) |
| `isSeller` | boolean | Computed (read-only) |
| `createdAt` | ISO string | Auto |
| `updatedAt` | ISO string | Auto |

## Note Schema

| Field | Type | Notes |
|-------|------|-------|
| `noteId` | string | Auto-generated |
| `content` | string | Required |
| `createdAt` | ISO string | Auto |
| `createdBy` | string | Auto from auth |

## Auth Header

All requests require: `Authorization: Bearer <CRM_TOKEN>`
