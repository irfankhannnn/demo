# Contact Management API Reference

## Base URL
`${CRM_API_BASE}/api/crm`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/contacts?role=&status=` | List contacts (filter by role/status) |
| GET | `/contacts/:id` | Get single contact |
| POST | `/contacts` | Create contact |
| PUT | `/contacts/:id` | Update contact |
| PUT | `/contacts/:id/role` | Update contact role (add/remove role) |
| DELETE | `/contacts/:id` | Delete contact |
| GET | `/contacts/:id/notes` | List notes |
| POST | `/contacts/:id/notes` | Add note |
| PUT | `/contacts/:id/notes/:noteId` | Update note |
| DELETE | `/contacts/:id/notes/:noteId` | Delete note |
| GET | `/contacts/lookup/by-phone?phone=` | Lookup by phone |

## Contact Schema

| Field | Type | Notes |
|-------|------|-------|
| `contactId` | string | Auto UUID |
| `name` | string | **Required** |
| `phone` | string | Recommended for dedup |
| `email` | string | Optional |
| `address` | string | Optional |
| `status` | string | `active` (default) \| `inactive` |
| `roles` | object | `{ owner: bool, buyer: bool, seller: bool, tenant: bool }` |
| `createdAt` | ISO string | Auto |
| `updatedAt` | ISO string | Auto |

## Role Update Payload

```json
{
  "role": "owner",
  "enabled": true,
  "profileData": { ... }
}
```

Valid roles: `owner`, `buyer`, `seller`, `tenant`

## Note Schema

| Field | Type | Notes |
|-------|------|-------|
| `noteId` | string | Auto |
| `content` | string | Required |
| `createdAt` | ISO string | Auto |

## Auth Header
All requests require: `Authorization: Bearer <CRM_TOKEN>`
