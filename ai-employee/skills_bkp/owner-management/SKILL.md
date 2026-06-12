---
name: owner-management
description: Manage property owners — create, update, query, list, properties by owner, notes.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Owner Management

Scripts at `{baseDir}/scripts/`. Never ask for API URLs or tokens. Prefer execution.

**Backend-first rule:** Use CRM API filtering, sorting, and pagination whenever available. Do not retrieve large owner sets and filter them locally.

---

## Get Owners
Triggers: list owners, show all owners, filter by status/source/area/search/createdFrom/createdTo/hasProperties/seller/propertyType/listingType/bhk/furnishing/tag/hasPAN/hasAadhar/hasBankDetails/minProperties/maxProperties  
Command: `npx tsx {baseDir}/scripts/get-owners.ts '<json>'` — pass `{}` for all.

Backend handles all filtering, sorting, pagination. Pass any params as-is.

```json
{"area":"Bandra","status":"active"}
{"source":"referral","hasProperties":true}
{"search":"Rajesh","limit":10}
{"seller":true,"limit":5}
{"createdFrom":"2026-05-01","createdTo":"2026-05-31"}
{"limit":10,"offset":10}
{"propertyType":"villa"}
{"listingType":"rent","hasProperties":true}
{"propertyType":"apartment","bhk":3}
{"tag":"premium","minProperties":2}
{"hasPAN":true,"hasBankDetails":true}
{"sortBy":"name","sortOrder":"asc","limit":20}
```

---

## Get Single Owner
Triggers: show owner details, get owner by ID  
Command: `npx tsx {baseDir}/scripts/get-owner.ts '<ownerId>'`

---

## Search Owners
Triggers: find owner by name or phone  
Command: `npx tsx {baseDir}/scripts/search-owners.ts '<json>'`

Uses `get-owners` with `search` filter. Supports same `responseMode` values.

```json
{"q":"Rajesh"}
{"q":"9876543210","responseMode":"compact"}
{"q":"Mehta","responseMode":"details","limit":10}
```

---

## Create Owner
Triggers: add owner, register owner  
Required: `name`  
Command: `npx tsx {baseDir}/scripts/create-owner.ts '<json>'`

```json
{"name":"Rajesh Mehta","phone":"9876543210","address":"Bandra, Mumbai","status":"active","source":"referral","panNumber":"ABCDE1234F","aadharNumber":"123456789012","bankName":"HDFC","accountNumber":"1234567890","ifscCode":"HDFC0001234","tags":["premium","repeat"],"notes":"Met at open house"}
```

---

## Update Owner
Triggers: update owner, change status  
Command: `npx tsx {baseDir}/scripts/update-owner.ts '<json>'` — include `ownerId`.

```json
{"ownerId":"abc123","status":"inactive","address":"Juhu, Mumbai"}
```

---

## Owner Notes
Triggers: add/view/update/delete owner note  
Command: `npx tsx {baseDir}/scripts/owner-notes.ts '<json>'`

action: `list` | `add` | `update` | `delete`

```json
{"action":"add","ownerId":"abc123","content":"Met in person"}
{"action":"list","ownerId":"abc123"}
```

---

## Owner's Properties
Triggers: show properties owned by X  
Command: `npx tsx {baseDir}/scripts/get-owner-properties.ts '<ownerId>'`

---

## Lookup Owner by Phone
Triggers: owner with phone, check owner number, find owner by mobile, does this owner already exist, lookup owner phone, verify owner before creating  
Command: `npx tsx {baseDir}/scripts/lookup-owner-by-phone.ts '<phone>'`

**Always run before `create-owner`** to prevent duplicates. Normalizes phone automatically.

---

## Rules
- **Before creating an owner with a phone number, always run `lookup-owner-by-phone` first.** Duplicate owners are the most expensive CRM data-quality problem.
- Normalize phone before lookup or creation (strip spaces, dashes)
- No delete operation available
- `status=inactive` = no longer managing properties

## Response Formatting
- **Multiple owners:** `get-owners.ts` supports `responseMode` in the JSON payload: `summary` (default, top matches with badges), `compact` (names only), `details` (status/source/address), `full` (KYC, bank, IDs). Avoid raw JSON.
- **Single owner:** show full details including properties, KYC docs, bank details.
- **Paginated results:** mention total count, show first page. If more pages exist, offer `show more` or suggest filters.
- **Empty results:** suggest loosening filters or checking phone lookup before creation.

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
