---
name: property-management
description: Manage properties — create, update, query, filter, status actions, documents.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Property Management

Scripts at `{baseDir}/scripts/`. Never ask for API URLs or tokens. Prefer execution.

**Backend-first rule:** Use CRM API filtering, sorting, and pagination whenever available. Do not retrieve large property sets and filter them locally.

---

## Get Properties
Triggers: list properties, show properties by status/type/area/city/owner, filter by status/propertyType/bhk/furnishing/area/city/ownerId/search/minRent/maxRent/minSalePrice/maxSalePrice/createdFrom/createdTo/tag  
Command: `npx tsx {baseDir}/scripts/get-properties.ts '<json>'` — pass `{}` for all.

Backend handles all filtering, sorting, pagination. Pass any params as-is.

```json
{"status":"for-rent","area":"Andheri"}
{"propertyType":"apartment","bhk":2,"furnishing":"fully-furnished"}
{"search":"villa Bandra","limit":10}
{"ownerId":"o1","status":"available"}
{"minRent":30000,"maxRent":60000,"city":"Mumbai"}
{"tag":"premium","sortBy":"rent","sortOrder":"desc","limit":20}
{"createdFrom":"2026-05-01","createdTo":"2026-05-31"}
{"limit":10,"offset":10}
```

---

## Search Properties
Triggers: find property by area, type, BHK, rent  
Command: `npx tsx {baseDir}/scripts/search-properties.ts '<json>'`

Uses `get-properties` with `search` filter. Supports same `responseMode` values.

```json
{"q":"Andheri"}
{"q":"villa","status":"for-sale","responseMode":"compact"}
{"q":"2BHK","minRent":30000,"maxRent":60000,"limit":20}
```

---

## Create Property
Triggers: add property, register property  
Required: `ownerId`, `propertyType`  
Command: `npx tsx {baseDir}/scripts/create-property.ts '<json>'`

```json
{"ownerId":"o1","propertyType":"apartment","bhk":2,"area":"Andheri West","city":"Mumbai","monthlyRent":45000}
```

---

## Update Property
Triggers: update property details  
Command: `npx tsx {baseDir}/scripts/update-property.ts '<json>'` — include `propertyId`.

```json
{"propertyId":"p1","monthlyRent":50000,"furnishing":"fully-furnished"}
```

---

## Property Status Actions
Triggers: list for sale, list for rent, mark sold, mark rented, vacate  
Confirm before executing.  
Command: `npx tsx {baseDir}/scripts/property-status.ts '<json>'`

action: `list-for-sale` | `list-for-rent` | `mark-sold` | `mark-rented` | `vacate`

```json
{"action":"list-for-sale","propertyId":"p1","listedPrice":8500000}
{"action":"mark-rented","propertyId":"p1","customerId":"c1","rentalDetails":{"leaseStartDate":"2026-06-01","monthlyRent":45000}}
{"action":"vacate","propertyId":"p1"}
```

---

## Property Documents
Triggers: show documents for a property  
Command: `npx tsx {baseDir}/scripts/get-property-documents.ts '<propertyId>'`

---

## Field Reference
**Required:** `ownerId`, `propertyType` (apartment|house|villa|commercial|land|office|shop|warehouse)  
**Optional:** `bhk`, `furnishing`, `area`, `city`, `address`, `monthlyRent`, `securityDeposit`, `salePrice`  
**Delete:** not allowed

**Money:** normalize to integers (80L → 8000000, 45k → 45000)

## Rules
- Confirm before any status-changing action
- `mark-sold` with `saleType=direct` requires `buyerId`
- `mark-rented` requires `customerId` + `rentalDetails.leaseStartDate` + `rentalDetails.monthlyRent`
- File uploads (images, videos) not supported via chat

## Response Formatting
- **Multiple properties:** `get-properties.ts` supports `responseMode` in the JSON payload: `summary` (default, type/area/status/rent), `compact` (type/area/status only), `details` (owner, rent, sale price), `full` (building, address, owner phone). Avoid raw JSON.
- **Single property:** show full details including owner, tenant, rent/sale info, documents.
- **Paginated results:** mention total count, show first page. If more pages exist, offer `show more` or suggest filters.
- **Empty results:** suggest loosening filters or checking owner exists first.

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
