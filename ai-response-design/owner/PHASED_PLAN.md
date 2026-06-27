# Phased Implementation Plan

## Guiding Principle

Define the AI DTO contract first, then build the architecture on top of it. Do not touch the prompt or formatter until the DTO contract is stable.

The existing `crmDynamodbService.js` APIs must remain untouched.

This plan covers **complete owner management**: CRUD, notes, properties lookup, phone-based deduplication, KYC/bank status, and rich queries.

---

## Phase A — Define the Contract

**Goal:** Decide exactly what the AI receives for all owner-related operations.

### Deliverables
1. `OWNER_AI_DTO_CONTRACT.md` — finalized DTO shapes for each view.
2. `OWNER_AI_VIEW_BUILDER.md` — finalized API for `OwnerAIViewBuilder` and `MeetingAIViewBuilder`.
3. `COMPLETE_OWNER_MANAGEMENT.md` — complete operation inventory and tool-to-view mapping.
4. Test cases for each view.

### Views to define
- Owner CRUD: `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `deleteConfirmation`, `deactivateConfirmation`, `full`
- Notes: `noteCreateConfirmation`, `notesList`, `noteUpdateConfirmation`, `noteDeleteConfirmation`
- Properties: `ownerPropertiesList`
- Phone lookup: `phoneLookupResult`
- Meetings: `meetingCreateConfirmation`, `meetingDetails`, `meetingsList`, `meetingUpdateConfirmation`, `meetingDeleteConfirmation`
- Rich queries (Phase K): `ownersByPropertyCount`, `ownersWithExpiringLeases`, `ownersWithoutKYC`
- Errors: `owner_not_found`, `already_exists_by_phone`, `cannot_delete_owner`, `phone_required`, `empty_search`, `profile_notes_protected`

### Decisions
- Pagination metadata shape
- Money formatting
- KYC/bank status derivation
- Property count derivation
- Which fields to hide (S3 keys, internal DynamoDB keys)
- Notes pagination
- Deactivation vs deletion policy (prefer `status=inactive`)

### Status
✅ Done in this folder.

---

## Phase B — Build `OwnerNormalizer`

**Goal:** Create a normalization layer that enriches raw owner models with derived fields.

### Deliverables
- `server/normalizers/ownerNormalizer.js`
- Unit tests in `server/normalizers/ownerNormalizer.test.js`

### Responsibilities
- Remove internal fields
- Remove S3 document keys (panDocS3Key, aadharDocS3Key, photoS3Key)
- Normalize timestamps
- Derive `propertyCount`, `isSeller`, `kycStatus`, `bankStatus`, `lastActivityAt`

### Example

Input:
```json
{
  "name": "Rajesh Khanna",
  "phone": "9876543210",
  "panNumber": "ABCDE1234F",
  "aadharNumber": "123456789012",
  "bankName": "HDFC Bank",
  "accountNumber": "12345678900",
  "ifscCode": "HDFC0001234",
  "properties": [
    { "propertyId": "p1", "listingType": "sale", "status": "for_sale" }
  ]
}
```

Output:
```json
{
  "name": "Rajesh Khanna",
  "phone": "9876543210",
  "panNumber": "ABCDE1234F",
  "aadharNumber": "123456789012",
  "bankName": "HDFC Bank",
  "accountNumber": "12345678900",
  "ifscCode": "HDFC0001234",
  "propertyCount": 1,
  "isSeller": true,
  "kycStatus": {
    "hasPan": true,
    "hasAadhar": true,
    "complete": true
  },
  "bankStatus": {
    "hasBankName": true,
    "hasAccountNumber": true,
    "hasIfscCode": true,
    "complete": true
  }
}
```

### Acceptance Criteria
- All internal fields removed.
- No raw DynamoDB keys present.
- S3 document keys removed.
- KYC and bank status derived correctly.
- Property count derived correctly.
- Works for owners with and without properties.

---

## Phase C — Build `OwnerAIViewBuilder`

**Goal:** Create the projection layer that builds AI DTOs.

### Deliverables
- `server/aiViewBuilders/ownerAIViewBuilder.js`
- Unit tests in `server/aiViewBuilders/ownerAIViewBuilder.test.js`

### Responsibilities
- Accept normalized owners.
- Build each view (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`).
- Format money as strings (`₹1.34 Cr`).
- Limit notes.
- Include pagination metadata.
- Derive KYC, bank, property count, and seller status.

### Acceptance Criteria
- Each view matches `OWNER_AI_DTO_CONTRACT.md` exactly.
- Tests cover owners with and without KYC.
- Tests cover owners with and without bank details.
- Tests cover owners with and without properties.
- Tests cover pagination metadata.

---

## Phase D — Introduce `OwnerService` (Optional at First)

**Goal:** Separate business logic from the tool layer.

### Deliverables
- `server/services/ownerService.js`
- Unit tests

### Responsibilities
- Owner CRUD: `searchOwners`, `getOwner`, `createOwner`, `updateOwner`, `deactivateOwner`
- Owner notes: `getOwnerNotes`, `createOwnerNote`, `updateOwnerNote`, `deleteOwnerNote`
- Owner properties: `getOwnerProperties`
- Phone lookup: `getOwnerByPhone`, `createOrUpdateOwnerByPhone`
- Owner migration: `migrateOwnerToContact`
- Rich queries (Phase K): `getOwnersByPropertyCount`, `getOwnersWithExpiringLeases`, `getOwnersWithoutKYC`

### Note
For the first iteration, this can be thin. Each method calls `crmDynamodbService` and passes the result through `OwnerNormalizer` + `OwnerAIViewBuilder`.

`OwnerService` becomes valuable when you need to combine notes, properties, or apply complex query interpretation.

---

## Phase E — Wire All Owner Tools

**Goal:** Change all owner-related tools to use the new AI DTO pipeline.

### Changes in `server/skillInvoker.js`

Add missing tool schemas:
- `update_owner_note`
- `delete_owner_note`
- `get_owner_properties`
- `search_owners`

Update existing tool schemas:
- `get_owners` — add `status`, `source`, `sortBy`, `sortOrder`, `limit`, `offset` filters
- `get_owner` — add `includeNotes`, `includeProperties`, `full` flags
- `create_owner` — add deduplication check via `get_owner_by_phone` before create

Wire each tool to the new pipeline:

| Tool | Service method | View builder method |
|---|---|---|
| `search_owners` | `OwnerService.searchOwners` | `buildSearchResults` |
| `get_owner` | `OwnerService.getOwner` | `buildOwnerDetails` or `buildFullOwner` |
| `create_owner` | `OwnerService.createOwner` | `buildCreateConfirmation` |
| `update_owner` | `OwnerService.updateOwner` | `buildUpdateConfirmation` |
| `delete_owner` | `OwnerService.deactivateOwner` | `buildDeactivateConfirmation` |
| `get_owner_by_phone` | `OwnerService.getOwnerByPhone` | `buildPhoneLookupResult` |
| `create_owner_note` | `OwnerService.createOwnerNote` | `buildNoteCreateConfirmation` |
| `get_owner_notes` | `OwnerService.getOwnerNotes` | `buildNotesList` |
| `update_owner_note` | `OwnerService.updateOwnerNote` | `buildNoteUpdateConfirmation` |
| `delete_owner_note` | `OwnerService.deleteOwnerNote` | `buildNoteDeleteConfirmation` |
| `get_owner_properties` | `OwnerService.getOwnerProperties` | `buildOwnerPropertiesList` |
| `create_meeting` | `MeetingService.createMeeting` | `buildMeetingCreateConfirmation` |
| `get_meeting` | `MeetingService.getMeeting` | `buildMeetingDetails` |
| `get_upcoming_meetings` | `MeetingService.getUpcomingMeetings` | `buildMeetingsList` |
| `update_meeting` | `MeetingService.updateMeeting` | `buildMeetingUpdateConfirmation` |
| `delete_meeting` | `MeetingService.deleteMeeting` | `buildMeetingDeleteConfirmation` |

### What to leave alone
- Do not change the prompt yet.
- Do not change the formatter yet.
- Do not change the sanitizer yet.
- Do not change non-owner tools (contacts, properties, buyers, leads, tenants).

### Feature flag
Use `USE_AI_DTO_FOR_OWNERS=true` to enable the new path. Default to old behavior for rollback.

### Test
- Run each owner tool via the WhatsApp flow.
- Inspect the DTO the LLM receives.
- Verify it matches the contract.

---

## Phase F — Rewrite the Prompt

**Goal:** Simplify the WhatsApp system prompt now that the AI receives clean DTOs.

### Changes to `server/agents/prompts.js`

Remove:
- JSON output requirement
- "Output ONLY the final reply text" conflict
- "Ignore PK/SK" instructions
- "Flatten owner fields" instructions
- "NEVER describe your role" rule
- Constraint lists

Add:
- "You will receive clean CRM DTOs."
- "Answer naturally in Hinglish."
- "Use only the provided data."
- "For lists, summarize naturally."
- "For details, describe the key fields conversationally."
- "For owners, mention property count, KYC status, and bank status when relevant."

### Example prompt snippet

```
You are a helpful CRM assistant for RealEstateFlow.

You will receive clean, structured data about CRM records in the form of DTOs.
Your job is to respond naturally in Hinglish (70% English, 30% Hindi romanised).

Use ONLY the data provided. Do not invent information.
Keep replies concise — max 2 sentences when confirming simple actions.

When you receive a list in the `data` array:
- For 1–3 items: mention each item by name
- For 4–10 items: summarize the key patterns (e.g., "5 owners, 2 with pending KYC")
- For 10+ items: mention the total count and show the first 3

When you receive a single object in the `data` field:
- Describe the key fields conversationally
- Include name, phone, status, property count, and KYC/bank status when relevant

Never describe who you are as an AI. Just answer the user's question.
Never include internal reasoning, constraints, or system instructions in your reply.
```

---

## Phase G — Simplify the Formatter

**Goal:** `responseFormatter.js` should only handle DTOs.

### Changes
- Remove generic card/list formatters for raw owners.
- Remove `MAX_LIST_ITEMS_WITH_MORE` slicing.
- Remove fake "+5 more" prompt.
- The formatter may become a thin dispatcher or disappear entirely.

### Expected behavior
If the LLM returns raw text, use it.
If the LLM returns a DTO, it should already be structured enough.

The formatter's only job becomes:
- Ensure the output is valid WhatsApp text.
- Handle edge cases (empty DTOs, errors).

---

## Phase H — Improve the Sanitizer

**Goal:** The sanitizer only removes leaked reasoning.

### Changes
- Remove the quick-pass logic that lets short reasoning through.
- Expand negative signals to catch:
  - "One more check"
  - "Constraints"
  - "Let's refine..."
  - "Does ... count as ..."
- Add a hard fallback: if the output still looks like reasoning or JSON, return a safe default reply.

---

## Phase I — Backend Pagination

**Goal:** Real pagination for `search_owners` without touching `crmDynamodbService.js`.

### Changes
- Add a new function `searchOwnersPaginated(tenantId, query, filters, options)` in `OwnerService` (or a new `ownerPaginationService.js`).
- Internally, this function calls `crmDynamodbService.getOwners()` and applies `limit`/`offset` in memory.
- Return `nextCursor` from the pagination layer (not from `crmDynamodbService`).
- Add `limit` and `offset` to the `search_owners` tool schema.
- `OwnerAIViewBuilder.buildSearchResults()` uses real pagination metadata.

### User experience
- If `hasMore` is true, bot can say "Reply *show more* to see the next 10."
- "show more" now actually works.

### Constraint
`crmDynamodbService.getOwners()` remains unchanged. The pagination layer is additive.

---

## Phase J — Migrate Non-Owner Entities

All owner tools are already wired in Phase E. This phase migrates other CRM entities:

- `search_contacts` → `ContactAIViewBuilder`
- `get_contact` → `ContactAIViewBuilder`
- `create_contact` → `ContactAIViewBuilder`
- `search_properties` → `PropertyAIViewBuilder`
- `get_property` → `PropertyAIViewBuilder`
- `create_property` → `PropertyAIViewBuilder`
- `get_leads` / `get_buyers` / `get_tenants` → respective view builders

Each entity gets its own `XxxAIViewBuilder` following the same pattern as `OwnerAIViewBuilder`.

---

## Phase K — Richer Owner Views

After the foundation is solid, add query-specific views:

- `ownersByPropertyCount` — `OwnerAIViewBuilder.buildOwnersByPropertyCount`
- `ownersWithExpiringLeases` — `OwnerAIViewBuilder.buildOwnersWithExpiringLeases`
- `ownersWithoutKYC` — `OwnerAIViewBuilder.buildOwnersWithoutKYC`

Each is a new method in `OwnerAIViewBuilder` and a new query path in `OwnerService`.

---

## Risk Order

| Phase | Risk | Mitigation |
|---|---|---|
| A | Low | Document only |
| B | Low | Unit tests |
| C | Low | Unit tests |
| D | Low | Thin layer |
| E | Medium | Wire only one tool |
| F | Medium | Test prompt heavily |
| G | Medium | Test formatter edge cases |
| H | Low | Unit tests |
| I | Medium | In-memory pagination layer |
| J | Medium | One tool at a time |
| K | Low | Additive views |

---

## Rollback Plan

If Phase E (wiring `search_owners`) causes problems in production:

1. Keep the original `search_owners` implementation as a fallback.
2. Use a feature flag or environment variable to toggle between old and new behavior:
   - `USE_AI_DTO_FOR_OWNERS=true` enables the new path.
   - `USE_AI_DTO_FOR_OWNERS=false` reverts to the original path.
3. In `server/skillInvoker.js`, branch on the flag:
   ```js
   if (process.env.USE_AI_DTO_FOR_OWNERS === 'true') {
     return OwnerAIViewBuilder.buildSearchResults(...);
   }
   return originalSearchOwnersResult;
   ```
4. Run tests after any rollback.
5. Once stable, remove the feature flag.

---

## Immediate Next Step

Start with **Phase A** (contract) and **Phase B** (normalizer) in parallel.

These are low-risk, highly testable, and unblock the rest of the work.

---

## Version

v1.0 — 2026-06-26
