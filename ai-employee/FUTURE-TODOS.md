# AI-Employee Skills — Future Tasks

> Last reviewed: 2026-06-04
> Rule: Stop polishing mature skills. Work on unfinished ones or system-wide concerns.

---

## Mature Skills (Do Not Iterate)

### Owner Management
- All filters, sort, pagination, response modes in place.
- **One future item:** add `sortBy: "propertyCount"` to backend + route + script.

### Property Management
- All filters, sort, pagination, response modes in place.
- Unified `/properties` endpoint replaces `/search/properties`.

### Buyer Management
- All filters (status, priority, propertyType, source, bhk, furnishing, area, search, minBudget, maxBudget, createdFrom, createdTo, tag), sort, pagination, response modes in place.
- Unified search via `get-buyers.ts` with `search` param. `search-buyers.ts` removed.
- `lookup-buyer-by-phone.ts` created for dedup workflow.
- Dual-model backend fixes: `updateBuyer`, notes, priority consistency for BUYER + CONTACT entities.

### Tenant Management
- All filters (status, search, area, source, tag, hasCurrentRental, hasRentalHistory, leaseEndingWithinDays, propertyId, monthlyRentMin, monthlyRentMax, createdFrom, createdTo), sort, pagination, response modes in place.
- Unified search via `get-tenants.ts` with `search` param.
- Backend `getCustomers()` supports full query model + tenant-specific filters.

---

## Skills Needing Enhancement

### Lead Management
- [ ] Audit if `search-leads.ts` still calls separate `/search/leads` endpoint. If yes, rewrite to use unified `/leads?search=` like owner/property pattern.
- [ ] Verify `get-leads.ts` has safe destructuring (`res.data.items ?? res.data`) and pagination metadata handling. Align with owner/property pattern.
- [ ] Ensure `SKILL.md` documents `responseMode` and backend-first rule.

### Contact Management
- [ ] Rewrite `get-contacts.ts` to accept JSON filters, handle paginated response, and support `responseMode`.
- [ ] Expand backend `getContacts()` with sort + pagination if not present.
- [ ] Update `SKILL.md` with full triggers, filter examples, response formatting rules.

---

## System-Wide Concerns

### 1. Standardize Query Contract
All CRM entity get-* functions should use consistent shape:
```json
{
  "properties": [...],
  "total": 120,
  "limit": 50,
  "offset": 0
}
```
Check: leads, buyers, tenants, contacts may still return bare arrays.

### 2. Query Analytics / Logging
Eventually log:
```
User Query → Extracted Filters → API Call → Result Count
```
Useful for debugging OpenClaw intent extraction.
Not urgent — add when conversational debugging becomes painful.

### 3. Backend Search Strategy (Future Infrastructure)
Current pattern: `Scan → Filter → Sort → Paginate` (in-memory).
Works fine up to ~1,000 records per tenant.

When growth justifies it, move to GSI-backed queries:
- `TENANT#123#OWNER_STATUS#active`
- `TENANT#123#PROPERTY_STATUS#for-rent`
- `TENANT#123#LEAD_STATUS#new`

Do not change today. Create a separate infrastructure ticket when needed.

### 4. Owner vs Property Boundary
Watch for scope creep. Owner queries with `propertyType/bhk/furnishing` are fine for now, but as Property Management matures, keep the boundary clear:
- Owner query = about the person
- Property query = about the asset

---

## Acceptance Criteria for Skill Completion

A skill is "mature" when:
1. `get-*.ts` accepts JSON filters, passes them as query params
2. `get-*.ts` has safe destructuring with fallbacks
3. `get-*.ts` supports `responseMode` (summary/compact/details/full)
4. `search-*.ts` uses unified endpoint with `search` param
5. Backend `get*()` supports filters + sort + pagination
6. Route returns `{ items, total, limit, offset }` shape
7. `SKILL.md` has backend-first rule, triggers, examples, response formatting
8. `references/api.md` documents all query params and response shape

---

## Next Recommended Skill to Enhance

**Lead Management** — it already has response modes. Likely the quickest to standardize.
