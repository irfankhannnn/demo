---
name: buyer-management
description: Manage buyers — create, update, query, search, notes, metrics.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Buyer Management

Scripts at `{baseDir}/scripts/`. Never ask for API URLs or tokens. Prefer execution.

**Backend-first rule:** Use CRM API filtering, sorting, and pagination whenever available. Do not retrieve large buyer sets and filter them locally.

---

## Get Buyers
Triggers: list buyers, show all buyers, find buyer, search buyer, buyer named, filter by status/priority/propertyType/source/bhk/furnishing/area/search/minBudget/maxBudget/createdFrom/createdTo/tag/sortBy/sortOrder/limit/offset  
Command: `npx tsx {baseDir}/scripts/get-buyers.ts '<json>'` — pass `{}` for all.

Backend handles all filtering, sorting, pagination. Pass any params as-is.

```json
{"status":"active","priority":"high","propertyType":"apartment"}
{"area":"Andheri","minBudget":10000000}
{"search":"Rahul","limit":10}
{"search":"9876543210","responseMode":"compact"}
{"propertyType":"villa","furnishing":"furnished"}
{"bhk":3,"propertyType":"apartment"}
{"source":"referral","status":"active"}
{"minBudget":5000000,"maxBudget":15000000}
{"createdFrom":"2026-05-01","createdTo":"2026-05-31"}
{"tag":"premium","limit":5}
{"sortBy":"name","sortOrder":"asc","limit":20}
{"limit":10,"offset":10}
```

---

## Create Buyer
Triggers: add buyer, register buyer  
Required: `name`  
Command: `npx tsx {baseDir}/scripts/create-buyer.ts '<json>'`

```json
{"name":"Rahul Sharma","phone":"9876543210","budget":8000000,"propertyType":"apartment","bhk":3,"priority":"high"}
```

---

## Update Buyer
Triggers: update buyer details  
Command: `npx tsx {baseDir}/scripts/update-buyer.ts '<json>'` — include `buyerId`.

```json
{"buyerId":"b1","budget":9500000,"status":"on-hold"}
```

---

## Buyer Notes
Triggers: add/view buyer note  
Command: `npx tsx {baseDir}/scripts/buyer-notes.ts '<json>'`

action: `list` | `add`

```json
{"action":"add","buyerId":"b1","content":"Looking for properties near metro"}
{"action":"list","buyerId":"b1"}
```

---

## Buyer Metrics
Triggers: buyer stats, summary, average budget  
Command: `npx tsx {baseDir}/scripts/buyer-metrics.ts`

---

## Lookup Buyer by Phone
Triggers: buyer with phone, check buyer number, find buyer by mobile, does this buyer already exist, lookup buyer phone, verify buyer before creating  
Command: `npx tsx {baseDir}/scripts/lookup-buyer-by-phone.ts '<phone>'`

**Always run before `create-buyer`** to prevent duplicates. Normalizes phone automatically.

---

## Rules
- **Before creating a buyer with a phone number, always run `lookup-buyer-by-phone` first.** Duplicate buyers are the most expensive CRM data-quality problem.
- Normalize phone before lookup or creation (strip spaces, dashes)
- No delete operation available
- `status=inactive` = no longer actively looking for property
- Cross-role linking: if phone matches owner/tenant, `linkedRoles` populated automatically

## Response Formatting
- **Multiple buyers:** `get-buyers.ts` supports `responseMode` in the JSON payload: `summary` (default, top matches with badges), `compact` (names only), `details` (priority/budget/area), `full` (IDs, requirement, source, createdAt). Avoid raw JSON.
- **Single buyer:** show full details including requirements, budget, area, priority, and purchase history.
- **Paginated results:** mention total count, show first page. If more pages exist, offer `show more` or suggest filters.
- **Empty results:** suggest loosening filters or checking phone lookup before creation.

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
