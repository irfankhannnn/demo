# AI Response Design

This folder contains the design documentation for the WhatsApp AI agent response architecture.

## Purpose

The current WhatsApp AI agent is returning raw DynamoDB records to the LLM, which causes:
- Leaked internal reasoning
- Inconsistent formatting
- Fake pagination
- Confusing prompts

This design introduces a clean, layered architecture where the LLM receives **purpose-built AI DTOs** instead of raw database records.

## Documents

| Document | Description |
|---|---|
| `ARCHITECTURE.md` | The layered architecture and separation of concerns |
| `COMPLETE_LEAD_MANAGEMENT.md` | Complete operation inventory for all lead operations |
| `LEAD_AI_DTO_CONTRACT.md` | The exact data shapes the AI will receive for all lead operations |
| `LEAD_AI_VIEW_BUILDER.md` | The API for `LeadAIViewBuilder`, `MeetingAIViewBuilder`, and helpers |
| `PHASED_PLAN.md` | Implementation plan from contract to production |

## Core Principles

1. **Backend-first.** `crmDynamodbService.js` remains untouched.
2. **AI-specific contract.** The DTOs are for the LLM, not a universal backend contract.
3. **Layered separation.**
   - `crmDynamodbService` → data access
   - `LeadService` → business logic
   - `LeadNormalizer` → enrichment and normalization
   - `LeadAIViewBuilder` → AI DTO projection
   - `MeetingAIViewBuilder` → meeting AI DTOs (shared across entities)
   - LLM → natural language
   - Sanitizer → safety cleanup
4. **Complete lead management.** All lead operations are covered: CRUD, notes, conversion, meetings, metrics, rich queries.
5. **Define the contract before touching code.**

## Status

### Design
- [x] Contract defined (all lead views)
- [x] View builder API designed (lead + meeting)
- [x] Architecture documented
- [x] Phased plan documented
- [x] Complete lead management inventory documented

### LeadNormalizer
- [ ] Remove internal fields (PK, SK, GSI*, EntityType, tenantId, normalizedPhone)
- [ ] Flatten requirement references (derive area, budget, bhk, propertyType)
- [ ] Normalize timestamps to ISO
- [ ] Normalize enum values (status, priority, leadType)
- [ ] Compute derived fields (displayBudget, lastActivityAt)
- [ ] Unit tests

### LeadAIViewBuilder — Lead CRUD
- [ ] Implement `buildSearchResults`
- [ ] Implement `buildLeadDetails`
- [ ] Implement `buildCreateConfirmation`
- [ ] Implement `buildUpdateConfirmation`
- [ ] Implement `buildDeleteConfirmation`
- [ ] Implement `buildFullLead`
- [ ] Add `formatDate` helper
- [ ] Add `formatMoney` helper
- [ ] Add `formatBhk` helper
- [ ] Add requirement flattening helpers
- [ ] Unit tests for all lead types

### LeadAIViewBuilder — Notes
- [ ] Implement `buildNoteCreateConfirmation`
- [ ] Implement `buildNotesList`
- [ ] Implement `buildNoteUpdateConfirmation`
- [ ] Implement `buildNoteDeleteConfirmation`
- [ ] Unit tests for notes

### LeadAIViewBuilder — Conversion
- [ ] Implement `buildConversionConfirmation`
- [ ] Unit tests for all 4 conversion types (buyer, seller, tenant, owner)

### LeadAIViewBuilder — Metrics
- [ ] Implement `buildMetricsSummary`
- [ ] Unit tests for metrics

### LeadAIViewBuilder — Rich Queries (Phase K)
- [ ] Implement `buildBudgetRanking`
- [ ] Implement `buildStaleLeads`
- [ ] Implement `buildPriorityRanking`
- [ ] Implement `buildFollowUpQueue`
- [ ] Implement `buildConversionCandidates`
- [ ] Unit tests for rich queries

### LeadAIViewBuilder — Error DTOs
- [ ] Implement `buildLeadNotFoundError`
- [ ] Implement `buildAlreadyConvertedError`
- [ ] Implement `buildCannotDeleteConvertedError`
- [ ] Implement `buildPhoneRequiredError`
- [ ] Implement `buildEmptySearchResults`
- [ ] Unit tests for error DTOs

### MeetingAIViewBuilder
- [ ] Implement `buildMeetingCreateConfirmation`
- [ ] Implement `buildMeetingDetails`
- [ ] Implement `buildMeetingsList`
- [ ] Implement `buildMeetingUpdateConfirmation`
- [ ] Implement `buildMeetingDeleteConfirmation`
- [ ] Unit tests for meetings

### LeadService
- [ ] Implement lead CRUD methods
- [ ] Implement lead notes methods
- [ ] Implement lead conversion method
- [ ] Implement lead meeting methods (delegate to MeetingService)
- [ ] Implement lead metrics method
- [ ] Implement rich query methods (Phase K)
- [ ] Unit tests

### Tool Wiring (skillInvoker.js)
- [ ] Add missing tool schemas (`update_lead_note`, `delete_lead_note`, `get_meeting`)
- [ ] Update `search_leads` schema (add sort, pagination, filters)
- [ ] Update `get_lead` schema (add includeNotes, includeMeetings, full flags)
- [ ] Update `convert_lead` schema (add conversion options)
- [ ] Wire `search_leads` to new pipeline
- [ ] Wire `get_lead` to new pipeline
- [ ] Wire `create_lead` to new pipeline
- [ ] Wire `update_lead` to new pipeline
- [ ] Wire `delete_lead` to new pipeline
- [ ] Wire `convert_lead` to new pipeline
- [ ] Wire `create_lead_note` to new pipeline
- [ ] Wire `get_lead_notes` to new pipeline
- [ ] Wire `update_lead_note` to new pipeline
- [ ] Wire `delete_lead_note` to new pipeline
- [ ] Wire `create_meeting` to new pipeline
- [ ] Wire `get_meeting` to new pipeline
- [ ] Wire `get_upcoming_meetings` to new pipeline
- [ ] Wire `update_meeting` to new pipeline
- [ ] Wire `delete_meeting` to new pipeline
- [ ] Wire `get_crm_metrics` to new pipeline
- [ ] Add feature flag for rollback
- [ ] Integration tests

### Prompt & Formatter
- [ ] Rewrite WhatsApp prompt for clean DTOs
- [ ] Remove JSON output requirement
- [ ] Remove fake "+5 more" prompt
- [ ] Simplify `responseFormatter.js`
- [ ] Tighten `sanitizeAgentReply`

### Pagination
- [ ] Add real pagination in `LeadService` (without touching `crmDynamodbService`)
- [ ] Implement "show more" using cursor-based pagination

### Non-Lead Entities (Phase J)
- [ ] `ContactAIViewBuilder`
- [ ] `PropertyAIViewBuilder`
- [ ] `OwnerAIViewBuilder`
- [ ] `TenantAIViewBuilder`
- [ ] `BuyerAIViewBuilder`

## Version

v2.0 — 2026-06-26 (expanded for complete lead management)
