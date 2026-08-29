# Owner AI Response Design

This folder contains the design documentation for the WhatsApp AI agent response architecture for owner entities.

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
| `COMPLETE_OWNER_MANAGEMENT.md` | Complete operation inventory for all owner operations |
| `OWNER_AI_DTO_CONTRACT.md` | The exact data shapes the AI will receive for all owner operations |
| `OWNER_AI_VIEW_BUILDER.md` | The API for `OwnerAIViewBuilder` and helpers |
| `PHASED_PLAN.md` | Implementation plan from contract to production |

## Core Principles

1. **Backend-first.** `crmDynamodbService.js` remains untouched.
2. **AI-specific contract.** The DTOs are for the LLM, not a universal backend contract.
3. **Layered separation.**
   - `crmDynamodbService` → data access
   - `OwnerService` → business logic
   - `OwnerNormalizer` → enrichment and normalization
   - `OwnerAIViewBuilder` → AI DTO projection
   - LLM → natural language
   - Sanitizer → safety cleanup
4. **Complete owner management.** All owner operations are covered: CRUD, notes, properties, phone lookup, migration.
5. **Define the contract before touching code.**

## Status

### Design
- [x] Contract defined (all owner views)
- [x] View builder API designed
- [x] Architecture documented
- [x] Phased plan documented
- [x] Complete owner management inventory documented

### OwnerNormalizer
- [ ] Remove internal fields (PK, SK, GSI*, EntityType, tenantId)
- [ ] Normalize timestamps to ISO
- [ ] Normalize enum values (status, source)
- [ ] Compute derived fields (lastActivityAt, propertyCount)
- [ ] Normalize phone to last 10 digits
- [ ] Unit tests

### OwnerAIViewBuilder — Owner CRUD
- [ ] Implement `buildSearchResults`
- [ ] Implement `buildOwnerDetails`
- [ ] Implement `buildCreateConfirmation`
- [ ] Implement `buildUpdateConfirmation`
- [ ] Implement `buildDeactivateConfirmation`
- [ ] Implement `buildFullOwner`
- [ ] Add `formatDate` helper
- [ ] Add `formatMoney` helper
- [ ] Add `formatPhone` helper
- [ ] Add KYC masking helpers (PAN, Aadhar)
- [ ] Unit tests for all owner types

### OwnerAIViewBuilder — Notes
- [ ] Implement `buildNoteCreateConfirmation`
- [ ] Implement `buildNotesList`
- [ ] Implement `buildNoteUpdateConfirmation`
- [ ] Implement `buildNoteDeleteConfirmation`
- [ ] Unit tests for notes

### OwnerAIViewBuilder — Properties
- [ ] Implement `buildPropertiesList`
- [ ] Implement `buildPropertySummary`
- [ ] Unit tests for properties

### OwnerAIViewBuilder — Error DTOs
- [ ] Implement `buildOwnerNotFoundError`
- [ ] Implement `buildPhoneRequiredError`
- [ ] Implement `buildNameRequiredError`
- [ ] Implement `buildDuplicatePhoneError`
- [ ] Implement `buildEmptySearchResults`
- [ ] Unit tests for error DTOs

### OwnerService
- [ ] Implement owner CRUD methods
- [ ] Implement owner notes methods
- [ ] Implement owner properties method
- [ ] Implement phone lookup method (deduplication)
- [ ] Implement owner search method
- [ ] Implement owner migration method
- [ ] Unit tests

### Tool Wiring (skillInvoker.js)
- [ ] Add missing tool schemas (`update_owner_note`, `delete_owner_note`, `get_owner_properties`, `search_owners`)
- [ ] Update `get_owners` schema (add sort, pagination, filters)
- [ ] Update `get_owner` schema (add includeNotes, includeProperties, full flags)
- [ ] Wire `get_owners` to new pipeline
- [ ] Wire `get_owner` to new pipeline
- [ ] Wire `create_owner` to new pipeline
- [ ] Wire `update_owner` to new pipeline
- [ ] Wire `delete_owner` to new pipeline
- [ ] Wire `search_owners` to new pipeline
- [ ] Wire `get_owner_by_phone` to new pipeline
- [ ] Wire `create_owner_note` to new pipeline
- [ ] Wire `get_owner_notes` to new pipeline
- [ ] Wire `update_owner_note` to new pipeline
- [ ] Wire `delete_owner_note` to new pipeline
- [ ] Wire `get_owner_properties` to new pipeline
- [ ] Add feature flag for rollback
- [ ] Integration tests

### Prompt & Formatter
- [ ] Rewrite WhatsApp prompt for clean DTOs
- [ ] Remove JSON output requirement
- [ ] Remove fake "+5 more" prompt
- [ ] Simplify `responseFormatter.js`
- [ ] Tighten `sanitizeAgentReply`

### Pagination
- [ ] Add real pagination in `OwnerService` (without touching `crmDynamodbService`)
- [ ] Implement "show more" using cursor-based pagination

## Version

v1.0 — 2026-06-26
