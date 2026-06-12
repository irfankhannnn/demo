---
name: tenant-management
description: Manage tenants (customers) — query, filter, create, update, notes, rental history, archive.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Tenant Management

Scripts at `{baseDir}/scripts/`. Tenants are called "customers" in the API. Never ask for API URLs or tokens. Prefer execution.

**Backend-first rule:** Use CRM API filtering, sorting, and pagination whenever available. Do not retrieve large tenant sets and filter them locally.

---

## Get Tenants
Triggers: list tenants, show tenants by status/area, filter by status/search/area/source/tag/hasCurrentRental/hasRentalHistory/leaseEndingWithinDays/propertyId/monthlyRentMin/monthlyRentMax/createdFrom/createdTo/sortBy/sortOrder/limit/offset  
Command: `npx tsx {baseDir}/scripts/get-tenants.ts '<json>'` — pass `{}` for all.

Backend handles all filtering, sorting, pagination. Pass any params as-is.

```json
{"status":"active"}
{"area":"Powai"}
{"search":"sarah"}
{"hasCurrentRental":true}
{"leaseEndingWithinDays":30}
{"propertyId":"p1"}
{"monthlyRentMin":30000,"monthlyRentMax":60000}
{"status":"active","sortBy":"monthlyRent","sortOrder":"desc","limit":20}
{"createdFrom":"2026-05-01","createdTo":"2026-05-31"}
{"limit":10,"offset":10}
```

---

## Search Tenants
Triggers: find tenant by name or phone  
Command: `npx tsx {baseDir}/scripts/search-tenants.ts '<json>'`

Uses `get-tenants` with `search` filter. Supports same `responseMode` values.

```json
{"q":"sarah"}
{"q":"987654","responseMode":"compact"}
{"q":"powai","hasCurrentRental":true,"limit":20}
```

---

## Create Tenant
Triggers: add tenant, register tenant  
Required: `name`, `phone`  
Command: `npx tsx {baseDir}/scripts/create-tenant.ts '<json>'`

```json
{"name":"Sarah Gupta","phone":"9876543210","address":"Powai, Mumbai"}
```

---

## Update Tenant
Triggers: update tenant details  
Command: `npx tsx {baseDir}/scripts/update-tenant.ts '<json>'` — include `customerId`.

```json
{"customerId":"c1","status":"inactive","address":"Bandra, Mumbai"}
```

---

## Tenant Notes
Triggers: add/view/update/delete tenant note  
Command: `npx tsx {baseDir}/scripts/tenant-notes.ts '<json>'`

action: `list` | `add` | `update` | `delete`

```json
{"action":"add","customerId":"c1","content":"Prefers quiet building"}
{"action":"list","customerId":"c1"}
```

---

## Rental Operations
Triggers: show rental history, update rental, archive rental  
Command: `npx tsx {baseDir}/scripts/tenant-rental.ts '<json>'`

action: `history` | `update` | `archive`

```json
{"action":"history","customerId":"c1"}
{"action":"update","customerId":"c1","leaseStartDate":"2026-06-01","monthlyRent":45000,"propertyId":"p1"}
{"action":"archive","customerId":"c1"}
```

---

## Field Reference
**Required:** `name`, `phone`  
**Optional:** `email`, `address`, `status` (active|inactive|past), `source`, `tags`  
**Rental fields:** `propertyId`, `leaseStartDate`, `leaseEndDate`, `monthlyRent`, `securityDeposit`  
**Delete:** not allowed

**Money:** normalize to integers (45k → 45000)

## Rules
- **Always lookup by phone before creating.** Use `/customers/lookup/by-phone` or search to avoid duplicates.
- Use `customerId` not `tenantId` (API naming)
- `archive` ends current rental and moves to history — confirm first

## Response Formatting
- **Multiple tenants:** `get-tenants.ts` supports `responseMode` in the JSON payload: `summary` (default, name/phone/status/rental), `compact` (name/status only), `details` (address, rental), `full` (email, source, tags, past rentals). Avoid raw JSON.
- **Single tenant:** show full details including current rental, rental history, documents.
- **Paginated results:** mention total count, show first page. If more pages exist, offer `show more` or suggest filters.
- **Empty results:** suggest loosening filters or checking if the tenant exists.

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
