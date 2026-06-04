# Business Rules & Edge Cases

## Missing Fields
- Ask for `name` only if completely absent from the message
- Ask for `leadType` only if cannot be inferred (e.g., "buyer" context is clear even without explicit label)
- Do NOT ask for phone, email, source, or budget — create lead without them and let user add later
- For `status=lost`, require `lostReason` before proceeding

## Immutability
- Converted leads (`convertedAt` is set) CANNOT be updated except for the `notes` field
- Attempting to update a converted lead returns: `Cannot update a converted lead`
- Attempting to delete a converted lead is blocked by the backend
- `leadType` change in an existing lead resets all type-specific nested fields

## Duplicate Phone
- Backend returns HTTP 409 if a lead with the same phone already exists
- Inform user: "A lead with this phone already exists" and offer to search instead

## Conversion Prerequisites
- All lead types: phone number MUST be set before conversion (update lead first if missing)
- **Buyer conversion**: requires `propertyId` + `saleAmount` + `purchaseDate` in `purchaseDetails`
- **Tenant conversion**: requires `propertyId` + `leaseStartDate` + `monthlyRent` in `leaseDetails`
- **Seller conversion**: auto-creates owner entity + property listing (set `createPropertyListing: false` to skip listing)
- **Owner conversion**: auto-creates owner entity + optional listing

## Ambiguous Name Matches
- If user says "find Faizan's lead" and search returns multiple results, list all with lead type + status + phone
- Ask user to confirm by responding with the correct lead's number or ID
- Never auto-select when ambiguous

## Status Transitions
- Valid: new → contacted → qualified → negotiating → converted (auto-set) / lost
- Any status can move to `lost` — always ask/capture `lostReason`
- `converted` status is set automatically by the backend on successful conversion — do NOT manually set it via update
- Natural language → status mapping:
  - "called him", "reached out" → contacted
  - "interested", "meeting done" → qualified
  - "in discussion", "negotiating price" → negotiating
  - "not interested", "gave up", "dropped" → lost

## Date Computations for Queries
- "last 3 days" → fromDate = today minus 3, toDate = today (YYYY-MM-DD)
- "this week" → fromDate = Monday of current week
- "this month" → fromDate = first day of current month
- "today" → fromDate = toDate = today
- Always compute dates before building the filter JSON

## Priority Sorting
- Priority weight for sorting: high=3, medium=2, low=1
- "top leads by priority" → sortBy=priority, sortOrder=desc
- "least priority first" → sortBy=priority, sortOrder=asc

## Budget Field Mapping
- `budget` filter (`minBudget`/`maxBudget`) works across all lead types:
  - buyer → buyerRequirement.budget
  - tenant → tenantRequirement.budget
  - seller → sellerProperty.expectedPrice
  - owner → ownerProperty.rentExpected
- Always normalize money before sending (see api.md for rules)

## Confirmation Requirements
- Delete: always confirm with user before running `delete-lead.ts`
- Convert: always confirm with user before running `convert-lead.ts`
- Status change to `lost`: confirm lostReason is intentional
- No confirmation needed for: create, update (non-destructive), search, get, notes, metrics

## API Error Codes
- 400 Bad Request: validation error (missing required field, invalid enum value, converted lead update)
- 404 Not Found: lead or note does not exist
- 409 Conflict: duplicate phone number
- 500 Internal Server Error: backend failure — report as "CRM system error, please try again"
