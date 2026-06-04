---
name: lead-management
description: CRM lead lifecycle — create, update, get, search, convert, notes, delete, metrics.
metadata: { "openclaw": { "requires": { "env": ["CRM_API_BASE", "CRM_TOKEN"] }, "primaryEnv": "CRM_TOKEN" } }
user-invocable: true
---

# Lead Management

Scripts at `{baseDir}/scripts/`. Never ask for API URLs or tokens. Prefer execution.

**Backend-first rule:** Use CRM API filtering, sorting, and pagination whenever available. Do not retrieve large lead sets and filter them locally.

---

## Create Lead
Triggers: add lead, new buyer/seller/tenant/owner  
Required: `name`, `leadType` (buyer|seller|tenant|owner)  
Command: `npx tsx {baseDir}/scripts/create-lead.ts '<json>'`

```json
{"name":"Faizan","leadType":"buyer","phone":"9876543210","priority":"high","buyerRequirement":{"budget":8000000,"preferredArea":"Andheri West","bhk":2}}
```

---

## Get Leads
Triggers: list leads, show leads, filter by type/status/priority/date/budget/area/assignedTo/source/city/propertyType  
Command: `npx tsx {baseDir}/scripts/get-leads.ts '<json>'` — pass `{}` for all.

Backend handles all filtering, sorting, pagination. Pass any params as-is.

**responseMode:** `summary` (default) | `compact` | `details` | `full`
- `summary` — User asks broad lists ("show leads in Kurla", "hot buyers"). Top matches only. No phone/email/IDs.
- `compact` — User wants a quick numbered list.
- `details` — User asks for more info ("show me details", "who are they").
- `full` — User explicitly asks for complete/raw data ("show everything", "all fields").

```json
{"leadType":"buyer","area":"Andheri","minBudget":10000000,"sortBy":"priority","sortOrder":"desc","responseMode":"summary"}
{"assignedTo":"Faizan","status":"contacted","responseMode":"compact"}
{"search":"Faizan","limit":5}
{"city":"Mumbai","leadType":"buyer","responseMode":"details"}
{"propertyType":"commercial","leadType":"buyer","responseMode":"full"}
{"converted":true,"leadType":"tenant"}
```

---

## Get Single Lead
Triggers: show lead details, get lead by ID  
Command: `npx tsx {baseDir}/scripts/get-lead.ts '<leadId>'`

---

## Update Lead
Triggers: update lead, change status, set priority  
Command: `npx tsx {baseDir}/scripts/update-lead.ts '<json>'` — include `leadId`.

```json
{"leadId":"abc123","status":"contacted","priority":"high"}
{"leadId":"abc123","status":"lost","lostReason":"Price too high"}
```

---

## Search Leads
Triggers: find lead by name, phone, email  
Command: `npx tsx {baseDir}/scripts/search-leads.ts '<json>'`

Uses `get-leads` with `search` filter. Supports same `responseMode` values.

```json
{"q":"Faizan"}
{"q":"9876543210","responseMode":"compact"}
{"q":"Ahmed","responseMode":"details","limit":10}
```

---

## Delete Lead
Triggers: delete lead  
Confirm before executing.  
Command: `npx tsx {baseDir}/scripts/delete-lead.ts '<leadId>'`

---

## Lead Notes
Triggers: add/view/update/delete lead note  
Command: `npx tsx {baseDir}/scripts/lead-notes.ts '<json>'`

action: `list` | `add` | `update` | `delete`

```json
{"action":"add","leadId":"abc123","content":"Called — will visit Saturday"}
{"action":"list","leadId":"abc123"}
```

---

## Lead Metrics
Triggers: lead stats, summary, conversion rate  
Command: `npx tsx {baseDir}/scripts/get-lead-metrics.ts '<json>'` — pass `{}` for all-time.

```json
{"from":"2026-05-01","to":"2026-05-31"}
```

---

## Convert Lead
Triggers: convert lead to buyer/tenant/owner  
Confirm before executing. Requires phone on lead.  
Command: `npx tsx {baseDir}/scripts/convert-lead.ts '<json>'` — include `leadId`.

```json
{"leadId":"abc123","purchaseDetails":{"propertyId":"p1","saleAmount":8000000,"purchaseDate":"2026-06-01"}}
{"leadId":"abc123","leaseDetails":{"propertyId":"p1","leaseStartDate":"2026-06-01","monthlyRent":45000}}
{"leadId":"abc123","createPropertyListing":true}
```

See `{baseDir}/references/api.md` for full conversion schemas.

---

## Rules
- Normalize money to integers before passing (80L → 8000000, 45k → 45000)
- Confirm before delete or convert
- `status=lost` requires `lostReason`
- Converted leads cannot be updated (notes excepted)
- If search returns multiple matches, list them and ask user to confirm by ID

## Response Formatting
Multiple leads: Use `responseMode` in get-leads script. Default is `summary` (top matches, no dump). Options: `compact`, `details`, `full`.
Single lead: Show concise overview by default. Show additional details only when requested.
Large result sets: Mention total count, show first page, suggest refinement or pagination.

## References
`{baseDir}/references/api.md` | `{baseDir}/references/examples.md` | `{baseDir}/references/edge-cases.md`
