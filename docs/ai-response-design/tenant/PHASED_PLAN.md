# Phased Implementation Plan

## Guiding Principle

Define the AI DTO contract first, then build the architecture on top of it. Do not touch the prompt or formatter until the DTO contract is stable.

The existing `crmDynamodbService.js` and `crmHelpers.js` APIs must remain untouched.

This plan covers **complete tenant management**: CRUD, notes, rental history, current rental, archive, phone-based deduplication, KYC status, and rich queries.

The backend entity is `customer` (with `customerId`), but the AI agent tool names and this plan use `tenant` for consistency.

---

## Phase A — Define the Contract

**Goal:** Decide exactly what the AI receives for all tenant-related operations.

### Deliverables
1. `TENANT_AI_DTO_CONTRACT.md` — finalized DTO shapes for each view.
2. `TENANT_AI_VIEW_BUILDER.md` — finalized API for `TenantAIViewBuilder` and `MeetingAIViewBuilder`.
3. `COMPLETE_TENANT_MANAGEMENT.md` — complete operation inventory and tool-to-view mapping.
4. Test cases for each view.

### Views to define
- Tenant CRUD: `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `deactivateConfirmation`, `full`
- Rental: `rentalHistory`, `currentRentalUpdateConfirmation`, `rentalArchiveConfirmation`
- Notes: `noteCreateConfirmation`, `notesList`, `noteUpdateConfirmation`, `noteDeleteConfirmation`
- Phone lookup: `phoneLookupResult`
- Meetings: `meetingCreateConfirmation`, `meetingDetails`, `meetingsList`, `meetingUpdateConfirmation`, `meetingDeleteConfirmation`
- Metrics: `metricsSummary`
- Rich queries (Phase K): `tenantsWithLeaseEnding`, `tenantsWithoutKYC`, `tenantsByRentRange`
- Errors: `tenant_not_found`, `phone_required`, `name_required`, `duplicate_phone`, `empty_search`, `profile_notes_protected`, `rental_required`

### Decisions
- Pagination metadata shape
- Money formatting
- KYC status derivation
- Rental status derivation
- Which fields to hide (S3 keys, internal DynamoDB keys)
- Notes pagination
- Deactivation vs deletion policy (prefer `status=inactive`)

### Status
✅ Done in this folder.

---

## Phase B — Build `TenantNormalizer`

**Goal:** Create a normalization layer that enriches raw tenant models with derived fields.

### Deliverables
- `agency-app/api/normalizers/tenantNormalizer.js`
- Unit tests in `agency-app/api/normalizers/tenantNormalizer.test.js`

### Responsibilities
- Remove internal fields
- Remove S3 document keys (aadharDocS3Key, photoS3Key, policeVerificationS3Key, leaseAgreementS3Key, depositReceiptS3Key)
- Normalize timestamps
- Derive `kycStatus`, `hasCurrentRental`, `rentalHistoryCount`, `lastActivityAt`, `area`
- Normalize phone to last 10 digits
- Normalize status enum

### Example

Input:
```json
{
  "name": "Sarah Gupta",
  "phone": "9876543210",
  "aadharNumber": "123456789012",
  "address": "Andheri, Mumbai",
  "currentRental": {
    "propertyId": "p1",
    "monthlyRent": 50000,
    "leaseEndDate": "2026-12-31"
  },
  "rentalHistory": [
    { "propertyId": "p2", "monthlyRent": 40000, "leaseEndDate": "2025-12-31" }
  ]
}
```

Output:
```json
{
  "name": "Sarah Gupta",
  "phone": "9876543210",
  "aadharNumber": "123456789012",
  "address": "Andheri, Mumbai",
  "area": "Andheri",
  "kycStatus": {
    "hasAadhar": true,
    "hasPhoto": false,
    "hasPoliceVerification": false,
    "complete": false
  },
  "hasCurrentRental": true,
  "rentalHistoryCount": 1,
  "currentRental": {
    "propertyId": "p1",
    "monthlyRent": 50000,
    "leaseEndDate": "2026-12-31"
  }
}
```

### Acceptance Criteria
- All internal fields removed.
- No raw DynamoDB keys present.
- S3 document keys removed.
- KYC status derived correctly.
- Rental status derived correctly.
- Works for tenants with and without current rentals.

---

## Phase C — Build `TenantAIViewBuilder`

**Goal:** Create the projection layer that builds AI DTOs.

### Deliverables
- `agency-app/api/aiViewBuilders/tenantAIViewBuilder.js`
- Unit tests in `agency-app/api/aiViewBuilders/tenantAIViewBuilder.test.js`

### Responsibilities
- Accept normalized tenants.
- Build each view (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`, `rentalHistory`, `currentRentalUpdateConfirmation`, `rentalArchiveConfirmation`).
- Format money as strings (`₹50k`).
- Format dates as `YYYY-MM-DD`.
- Limit notes.
- Include pagination metadata.
- Derive KYC, rental status, and rent range.

### Acceptance Criteria
- Each view matches `TENANT_AI_DTO_CONTRACT.md` exactly.
- Tests cover tenants with and without KYC.
- Tests cover tenants with and without current rentals.
- Tests cover tenants with and without rental history.
- Tests cover pagination metadata.

---

## Phase D — Introduce `TenantService` (Optional at First)

**Goal:** Separate business logic from the tool layer.

### Deliverables
- `agency-app/api/services/tenantService.js`
- Unit tests

### Responsibilities
- Tenant CRUD: `searchTenants`, `getTenant`, `createTenant`, `updateTenant`, `deactivateTenant`
- Tenant notes: `getTenantNotes`, `createTenantNote`, `updateTenantNote`, `deleteTenantNote`
- Tenant rental: `getTenantRentalHistory`, `updateCurrentRental`, `archiveTenantRental`
- Phone lookup: `getTenantByPhone`
- Tenant metrics: `getTenantMetrics`
- Rich queries (Phase K): `getTenantsWithLeaseEnding`, `getTenantsWithoutKYC`, `getTenantsByRentRange`

### Note
For the first iteration, this can be thin. Each method calls `crmDynamodbService` or `crmHelpers.js` and passes the result through `TenantNormalizer` + `TenantAIViewBuilder`.

`TenantService` becomes valuable when you need to combine notes, rental history, or apply complex query interpretation.

---

## Phase E — Wire All Tenant Tools

**Goal:** Change all tenant-related tools to use the new AI DTO pipeline.

### Changes in `agency-app/api/skillInvoker.js`

Add missing tool schemas:
- `update_tenant_note`
- `delete_tenant_note`
- `get_tenant_rental_history`
- `update_tenant_current_rental`
- `archive_tenant_rental`

Update existing tool schemas:
- `create_tenant` — add `phone` to required parameters
- `search_tenants` — add all filter params, sort, pagination, responseMode
- `get_tenant` — add `includeNotes`, `includeRental`, `full` flags
- `update_tenant` — add full field set

Wire each tool to the new pipeline:

| Tool | Service method | View builder method |
|---|---|---|
| `create_tenant` | `TenantService.createTenant` | `buildCreateConfirmation` |
| `get_tenant` | `TenantService.getTenant` | `buildTenantDetails` or `buildFullTenant` |
| `search_tenants` | `TenantService.searchTenants` | `buildSearchResults` |
| `update_tenant` | `TenantService.updateTenant` | `buildUpdateConfirmation` |
| `delete_tenant` | `TenantService.deactivateTenant` | `buildDeactivateConfirmation` |
| `get_tenant_by_phone` | `TenantService.getTenantByPhone` | `buildPhoneLookupResult` |
| `create_tenant_note` | `TenantService.createTenantNote` | `buildNoteCreateConfirmation` |
| `get_tenant_notes` | `TenantService.getTenantNotes` | `buildNotesList` |
| `update_tenant_note` | `TenantService.updateTenantNote` | `buildNoteUpdateConfirmation` |
| `delete_tenant_note` | `TenantService.deleteTenantNote` | `buildNoteDeleteConfirmation` |
| `get_tenant_rental_history` | `TenantService.getTenantRentalHistory` | `buildRentalHistory` |
| `update_tenant_current_rental` | `TenantService.updateCurrentRental` | `buildCurrentRentalUpdateConfirmation` |
| `archive_tenant_rental` | `TenantService.archiveTenantRental` | `buildRentalArchiveConfirmation` |
| `create_meeting` | `MeetingService.createMeeting` | `buildMeetingCreateConfirmation` |
| `get_meeting` | `MeetingService.getMeeting` | `buildMeetingDetails` |
| `get_upcoming_meetings` | `MeetingService.getUpcomingMeetings` | `buildMeetingsList` |
| `update_meeting` | `MeetingService.updateMeeting` | `buildMeetingUpdateConfirmation` |
| `delete_meeting` | `MeetingService.deleteMeeting` | `buildMeetingDeleteConfirmation` |
| `get_crm_metrics` | `TenantService.getTenantMetrics` | `buildMetricsSummary` |

### What to leave alone
- Do not change the prompt yet.
- Do not change the formatter yet.
- Do not change the sanitizer yet.
- Do not change non-tenant tools (contacts, properties, buyers, leads, owners).

### Feature flag
Use `USE_AI_DTO_FOR_TENANTS=true` to enable the new path. Default to old behavior for rollback.

### Test
- Run each tenant tool via the WhatsApp flow.
- Inspect the DTO the LLM receives.
- Verify it matches the contract.

---

## Phase F — Rewrite the Prompt

**Goal:** Simplify the WhatsApp system prompt now that the AI receives clean DTOs.

### Changes to `agency-app/api/agents/prompts.js`

Remove:
- JSON output requirement
- "Output ONLY the final reply text" conflict
- "Ignore PK/SK" instructions
- "Flatten tenant fields" instructions
- "NEVER describe your role" rule
- Constraint lists

Add:
- "You will receive clean CRM DTOs."
- "Answer naturally in Hinglish."
- "Use only the provided data."
- "For lists, summarize naturally."
- "For details, describe the key fields conversationally."
- "For tenants, mention rental status, KYC status, and rent amount when relevant."

### Example prompt snippet

```
You are a helpful WhatsApp assistant for a real estate CRM.
You receive clean CRM DTOs from backend tools.
Reply in casual Hinglish (70% English, 30% Hindi).
Use only the data provided.
Do not explain your reasoning or mention constraints.
For tenant lists, mention name, area, rental status, and rent.
For tenant details, mention KYC status, current rental, and lease dates.
```

---

## Phase G — Simplify the Formatter

**Goal:** Remove the complex formatting logic since the LLM now receives clean DTOs.

### Changes to `agency-app/api/agents/responseFormatter.js`
- Remove tenant-specific formatting
- Keep only generic WhatsApp formatting (bold, line breaks)
- Remove fake pagination logic

### Expected behavior
- The formatter only adds light formatting.
- The LLM receives the final DTO and produces the natural language response.

---

## Phase H — Improve the Sanitizer

**Goal:** The sanitizer only removes leaked reasoning.

### Changes to `agency-app/api/agents/sanitizeAgentReply`
- Remove the quick-pass logic that lets short reasoning through.
- Expand negative signals to catch:
  - "One more check"
  - "Constraints"
  - "Let's refine..."
  - "Does ... count as ..."
- Add a hard fallback: if the output still looks like reasoning or JSON, return a safe default reply.

---

## Phase I — Backend Pagination

**Goal:** Real pagination for `search_tenants` without touching `crmDynamodbService.js`.

### Changes
- Add a new function `searchTenantsPaginated(tenantId, query, filters, options)` in `TenantService` (or a new `tenantPaginationService.js`).
- Internally, this function calls `crmDynamodbService.getCustomers()` and applies `limit`/`offset` in memory.
- Return `nextCursor` from the pagination layer (not from `crmDynamodbService`).
- Add `limit` and `offset` to the `search_tenants` tool schema.
- `TenantAIViewBuilder.buildSearchResults()` uses real pagination metadata.

### User experience
- If `hasMore` is true, bot can say "Reply *show more* to see the next 10."
- "show more" now actually works.

### Constraint
`crmDynamodbService.getCustomers()` remains unchanged. The pagination layer is additive.

---

## Phase J — Migrate Non-Tenant Entities

All tenant tools are already wired in Phase E. This phase migrates other CRM entities:

- `buyer/` → `BuyerAIViewBuilder`
- `contact/` → `ContactAIViewBuilder`
- `property/` → `PropertyAIViewBuilder`
- `owner/` → already done
- `leads/` → already done

Each entity gets its own `XxxAIViewBuilder`.

---

## Phase K — Richer Tenant Views

After the foundation is solid, add query-specific views:

- `tenantsWithLeaseEnding` — leases ending in N days
- `tenantsWithoutKYC` — missing KYC documents
- `tenantsByRentRange` — tenants within a monthly rent range

Each is a new method in `TenantAIViewBuilder` and a new query path in `TenantService`.

---

## Risk Order

| Phase | Risk | Mitigation |
|---|---|---|
| A | Low | Document only |
| B | Low | Pure data transformation |
| C | Low | Unit tests per view |
| D | Low | Thin service layer |
| E | Medium | Feature flag + one tool at a time |
| F | Medium | Test with real WhatsApp prompts |
| G | Medium | Compare formatter output before/after |
| H | Low | Unit tests for sanitizer |
| I | Low | Additive pagination layer |
| J | Medium | Do not migrate until tenant is stable |
| K | Low | New query paths only |

---

## Rollback Plan

If anything goes wrong, disable the feature flag:

```js
const USE_AI_DTO_FOR_TENANTS = process.env.USE_AI_DTO_FOR_TENANTS === 'true';

if (USE_AI_DTO_FOR_TENANTS) {
  return TenantAIViewBuilder.buildSearchResults(...);
}
// Old behavior preserved
return originalSearchTenantsResult;
```

Steps:
1. Set `USE_AI_DTO_FOR_TENANTS=false`.
2. Restart the service.
3. The WhatsApp agent reverts to the old formatter.
4. Fix the issue.
5. Re-enable the flag.

---

## Immediate Next Step

Build `TenantNormalizer` and `TenantAIViewBuilder` with unit tests. Do not touch the prompt, formatter, or `crmDynamodbService.js`.

---

## Version

v1.0 — 2026-06-26
