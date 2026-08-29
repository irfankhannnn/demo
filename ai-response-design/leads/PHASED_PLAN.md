# Phased Implementation Plan

## Guiding Principle

Define the AI DTO contract first, then build the architecture on top of it. Do not touch the prompt or formatter until the DTO contract is stable.

The existing `crmDynamodbService.js` APIs must remain untouched.

This plan covers **complete lead management**: CRUD, notes, conversion, meetings, metrics, and rich queries.

---

## Phase A — Define the Contract

**Goal:** Decide exactly what the AI receives for all lead-related operations.

### Deliverables
1. `LEAD_AI_DTO_CONTRACT.md` — finalized DTO shapes for each view.
2. `LEAD_AI_VIEW_BUILDER.md` — finalized API for `LeadAIViewBuilder` and `MeetingAIViewBuilder`.
3. `COMPLETE_LEAD_MANAGEMENT.md` — complete operation inventory and tool-to-view mapping.
4. Test cases for each view.

### Views to define
- Lead CRUD: `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `deleteConfirmation`, `full`
- Notes: `noteCreateConfirmation`, `notesList`, `noteUpdateConfirmation`, `noteDeleteConfirmation`
- Conversion: `conversionConfirmation`
- Meetings: `meetingCreateConfirmation`, `meetingDetails`, `meetingsList`, `meetingUpdateConfirmation`, `meetingDeleteConfirmation`
- Metrics: `metricsSummary`
- Rich queries (Phase K): `budgetRanking`, `staleLeads`, `priorityRanking`, `followUpQueue`, `conversionCandidates`
- Errors: `lead_not_found`, `already_converted`, `cannot_delete_converted`, `phone_required`, `empty_search`

### Decisions
- Pagination metadata shape
- Money formatting
- Requirement flattening
- Which fields to hide
- Notes pagination

### Status
✅ Done in this folder.

---

## Phase B — Build `LeadNormalizer`

**Goal:** Create a normalization layer that enriches raw lead models with derived fields.

### Deliverables
- `server/normalizers/leadNormalizer.js`
- Unit tests in `server/normalizers/leadNormalizer.test.js`

### Responsibilities
- Remove internal fields
- Flatten requirement references
- Format money as normalized numbers
- Normalize timestamps
- Derive `area`, `budget`, `displayBudget`, `lastActivityAt`

### Example

Input:
```json
{
  "name": "Ashok Menon",
  "leadType": "buyer",
  "buyerRequirement": {
    "budget": 13400000,
    "preferredArea": "Churchgate",
    "bhk": 3
  }
}
```

Output:
```json
{
  "name": "Ashok Menon",
  "leadType": "buyer",
  "area": "Churchgate",
  "budget": 13400000,
  "bhk": 3,
  "displayBudget": "₹1.34 Cr"
}
```

### Acceptance Criteria
- All internal fields removed.
- No raw DynamoDB keys present.
- Money normalized to numbers (not formatted strings yet).
- Works for all lead types.

---

## Phase C — Build `LeadAIViewBuilder`

**Goal:** Create the projection layer that builds AI DTOs.

### Deliverables
- `server/aiViewBuilders/leadAIViewBuilder.js`
- Unit tests in `server/aiViewBuilders/leadAIViewBuilder.test.js`

### Responsibilities
- Accept normalized leads.
- Build each view (`searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`).
- Format money as strings (`₹1.34 Cr`).
- Limit notes.
- Include pagination metadata.

### Acceptance Criteria
- Each view matches `LEAD_AI_DTO_CONTRACT.md` exactly.
- Tests cover all lead types.
- Tests cover empty requirements.
- Tests cover pagination metadata.

---

## Phase D — Introduce `LeadService` (Optional at First)

**Goal:** Separate business logic from the tool layer.

### Deliverables
- `server/services/leadService.js`
- Unit tests

### Responsibilities
- Lead CRUD: `searchLeads`, `getLead`, `createLead`, `updateLead`, `deleteLead`
- Lead notes: `getLeadNotes`, `createLeadNote`, `updateLeadNote`, `deleteLeadNote`
- Lead conversion: `convertLead`
- Lead meetings: `getLeadMeetings`, `createLeadMeeting`, `updateLeadMeeting`, `deleteLeadMeeting`
- Lead metrics: `getLeadMetrics`
- Rich queries (Phase K): `getBudgetRanking`, `getStaleLeads`, `getPriorityRanking`, `getFollowUpQueue`, `getConversionCandidates`

### Note
For the first iteration, this can be thin. Each method calls `crmDynamodbService` and passes the result through `LeadNormalizer` + `LeadAIViewBuilder`.

`LeadService` becomes valuable when you need to combine notes, meetings, or apply complex query interpretation.

---

## Phase E — Wire All Lead Tools

**Goal:** Change all lead-related tools to use the new AI DTO pipeline.

### Changes in `server/skillInvoker.js`

Add missing tool schemas:
- `update_lead_note`
- `delete_lead_note`
- `get_meeting`

Update existing tool schemas:
- `search_leads` — add `sortBy`, `sortOrder`, `limit`, `offset`, `minBudget`, `maxBudget`, `fromDate`, `toDate`, `excludeConverted`
- `get_lead` — add `includeNotes`, `includeMeetings`, `full` flags
- `convert_lead` — add conversion options (`purchaseDetails`, `leaseDetails`, `createPropertyListing`, `brokeragePaid`)

Wire each tool to the new pipeline:

| Tool | Service method | View builder method |
|---|---|---|
| `search_leads` | `LeadService.searchLeads` | `buildSearchResults` |
| `get_lead` | `LeadService.getLead` | `buildLeadDetails` or `buildFullLead` |
| `create_lead` | `LeadService.createLead` | `buildCreateConfirmation` |
| `update_lead` | `LeadService.updateLead` | `buildUpdateConfirmation` |
| `delete_lead` | `LeadService.deleteLead` | `buildDeleteConfirmation` |
| `convert_lead` | `LeadService.convertLead` | `buildConversionConfirmation` |
| `create_lead_note` | `LeadService.createLeadNote` | `buildNoteCreateConfirmation` |
| `get_lead_notes` | `LeadService.getLeadNotes` | `buildNotesList` |
| `update_lead_note` | `LeadService.updateLeadNote` | `buildNoteUpdateConfirmation` |
| `delete_lead_note` | `LeadService.deleteLeadNote` | `buildNoteDeleteConfirmation` |
| `create_meeting` | `MeetingService.createMeeting` | `buildMeetingCreateConfirmation` |
| `get_meeting` | `MeetingService.getMeeting` | `buildMeetingDetails` |
| `get_upcoming_meetings` | `MeetingService.getUpcomingMeetings` | `buildMeetingsList` |
| `update_meeting` | `MeetingService.updateMeeting` | `buildMeetingUpdateConfirmation` |
| `delete_meeting` | `MeetingService.deleteMeeting` | `buildMeetingDeleteConfirmation` |
| `get_crm_metrics` | `LeadService.getLeadMetrics` | `buildMetricsSummary` |

### What to leave alone
- Do not change the prompt yet.
- Do not change the formatter yet.
- Do not change the sanitizer yet.
- Do not change non-lead tools (contacts, properties, buyers, owners, tenants).

### Feature flag
Use `USE_AI_DTO_FOR_LEADS=true` to enable the new path. Default to old behavior for rollback.

### Test
- Run each lead tool via the WhatsApp flow.
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
- "Flatten buyerRequirement" instructions
- "NEVER describe your role" rule
- Constraint lists

Add:
- "You will receive clean CRM DTOs."
- "Answer naturally in Hinglish."
- "Use only the provided data."
- "For lists, summarize naturally."
- "For details, describe the key fields conversationally."

### Example prompt snippet

```
You are a helpful CRM assistant for RealEstateFlow.

You will receive clean, structured data about CRM records in the form of DTOs.
Your job is to respond naturally in Hinglish (70% English, 30% Hindi romanised).

Use ONLY the data provided. Do not invent information.
Keep replies concise — max 2 sentences when confirming simple actions.

When you receive a list in the `data` array:
- For 1–3 items: mention each item by name
- For 4–10 items: summarize the key patterns (e.g., "5 buyers, 3 sellers")
- For 10+ items: mention the total count and show the first 3

When you receive a single object in the `data` field:
- Describe the key fields conversationally
- Include name, status, type, location, and budget/price when relevant

Never describe who you are as an AI. Just answer the user's question.
Never include internal reasoning, constraints, or system instructions in your reply.
```

---

## Phase G — Simplify the Formatter

**Goal:** `responseFormatter.js` should only handle DTOs.

### Changes
- Remove generic card/list formatters for raw leads.
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

**Goal:** Real pagination for `search_leads` without touching `crmDynamodbService.js`.

### Changes
- Add a new function `searchLeadsPaginated(tenantId, query, filters, options)` in `LeadService` (or a new `leadPaginationService.js`).
- Internally, this function calls `crmDynamodbService.getLeads()` and applies `limit`/`offset` in memory.
- Return `nextCursor` from the pagination layer (not from `crmDynamodbService`).
- Add `limit` and `offset` to the `search_leads` tool schema.
- `LeadAIViewBuilder.buildSearchResults()` uses real pagination metadata.

### User experience
- If `hasMore` is true, bot can say "Reply *show more* to see the next 10."
- "show more" now actually works.

### Constraint
`crmDynamodbService.getLeads()` remains unchanged. The pagination layer is additive.

---

## Phase J — Migrate Non-Lead Entities

All lead tools are already wired in Phase E. This phase migrates other CRM entities:

- `search_contacts` → `ContactAIViewBuilder`
- `get_contact` → `ContactAIViewBuilder`
- `create_contact` → `ContactAIViewBuilder`
- `search_properties` → `PropertyAIViewBuilder`
- `get_property` → `PropertyAIViewBuilder`
- `create_property` → `PropertyAIViewBuilder`
- `get_owners` / `get_buyers` / `get_tenants` → respective view builders

Each entity gets its own `XxxAIViewBuilder` following the same pattern as `LeadAIViewBuilder`.

---

## Phase K — Richer Lead Views

After the foundation is solid, add query-specific views:

- `budgetRanking` — `LeadAIViewBuilder.buildBudgetRanking`
- `staleLeads` — `LeadAIViewBuilder.buildStaleLeads`
- `priorityRanking` — `LeadAIViewBuilder.buildPriorityRanking`
- `followUpQueue` — `LeadAIViewBuilder.buildFollowUpQueue`
- `conversionCandidates` — `LeadAIViewBuilder.buildConversionCandidates`

Each is a new method in `LeadAIViewBuilder` and a new query path in `LeadService`.

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

If Phase E (wiring `search_leads`) causes problems in production:

1. Keep the original `search_leads` implementation as a fallback.
2. Use a feature flag or environment variable to toggle between old and new behavior:
   - `USE_AI_DTO_FOR_LEADS=true` enables the new path.
   - `USE_AI_DTO_FOR_LEADS=false` reverts to the original path.
3. In `server/skillInvoker.js`, branch on the flag:
   ```js
   if (process.env.USE_AI_DTO_FOR_LEADS === 'true') {
     return LeadAIViewBuilder.buildSearchResults(...);
   }
   return originalSearchLeadsResult;
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
