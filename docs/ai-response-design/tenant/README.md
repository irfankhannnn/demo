# Tenant AI Response Design

This folder contains the design documentation for the WhatsApp AI agent response architecture for tenant entities.

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
| `COMPLETE_TENANT_MANAGEMENT.md` | Complete operation inventory for all tenant operations |
| `TENANT_AI_DTO_CONTRACT.md` | The exact data shapes the AI will receive for all tenant operations |
| `TENANT_AI_VIEW_BUILDER.md` | The API for `TenantAIViewBuilder` and helpers |
| `PHASED_PLAN.md` | Implementation plan from contract to production |

## Core Principles

1. **Backend-first.** `crmDynamodbService.js` remains untouched.
2. **AI-specific contract.** The DTOs are for the LLM, not a universal backend contract.
3. **Layered separation.**
   - `crmDynamodbService` → data access
   - `TenantService` → business logic
   - `TenantNormalizer` → enrichment and normalization
   - `TenantAIViewBuilder` → AI DTO projection
   - LLM → natural language
   - Sanitizer → safety cleanup
4. **Complete tenant management.** All tenant operations are covered: CRUD, notes, rental history, current rental, phone lookup, archive.
5. **Define the contract before touching code.**

## Status

### Design
- [x] Contract defined (all tenant views)
- [x] View builder API designed
- [x] Architecture documented
- [x] Phased plan documented
- [x] Complete tenant management inventory documented

### TenantNormalizer
- [ ] Remove internal fields (PK, SK, GSI*, EntityType, tenantId)
- [ ] Normalize timestamps to ISO
- [ ] Normalize enum values (status, source)
- [ ] Compute derived fields (lastActivityAt, rentalHistoryCount, hasCurrentRental)
- [ ] Normalize phone to last 10 digits
- [ ] Unit tests

### TenantAIViewBuilder — Tenant CRUD
- [ ] Implement `buildSearchResults`
- [ ] Implement `buildTenantDetails`
- [ ] Implement `buildCreateConfirmation`
- [ ] Implement `buildUpdateConfirmation`
- [ ] Implement `buildDeactivateConfirmation`
- [ ] Implement `buildFullTenant`
- [ ] Add `formatDate` helper
- [ ] Add `formatMoney` helper
- [ ] Add `formatPhone` helper
- [ ] Add KYC masking helpers (Aadhar)
- [ ] Unit tests for all tenant types

### TenantAIViewBuilder — Rental
- [ ] Implement `buildCurrentRentalDetails`
- [ ] Implement `buildRentalHistoryList`
- [ ] Implement `buildCurrentRentalUpdateConfirmation`
- [ ] Implement `buildArchiveRentalConfirmation`
- [ ] Unit tests for rental views

### TenantAIViewBuilder — Notes
- [ ] Implement `buildNoteCreateConfirmation`
- [ ] Implement `buildNotesList`
- [ ] Implement `buildNoteUpdateConfirmation`
- [ ] Implement `buildNoteDeleteConfirmation`
- [ ] Unit tests for notes

### TenantAIViewBuilder — Error DTOs
- [ ] Implement `buildTenantNotFoundError`
- [ ] Implement `buildPhoneRequiredError`
- [ ] Implement `buildNameRequiredError`
- [ ] Implement `buildDuplicatePhoneError`
- [ ] Implement `buildEmptySearchResults`
- [ ] Unit tests for error DTOs

### TenantService
- [ ] Implement tenant CRUD methods
- [ ] Implement tenant notes methods
- [ ] Implement tenant rental history method
- [ ] Implement current rental update method
- [ ] Implement archive rental method
- [ ] Implement phone lookup method (deduplication)
- [ ] Implement tenant search method
- [ ] Unit tests

### Tool Wiring (skillInvoker.js)
- [ ] Add missing tool schemas (`update_tenant_note`, `delete_tenant_note`, `search_tenants`, `get_tenant_rental_history`, `update_tenant_current_rental`, `archive_tenant_rental`)
- [ ] Update `search_tenants` schema (add sort, pagination, filters)
- [ ] Update `get_tenant` schema (add includeNotes, includeRentalHistory, full flags)
- [ ] Wire `search_tenants` to new pipeline
- [ ] Wire `get_tenant` to new pipeline
- [ ] Wire `create_tenant` to new pipeline
- [ ] Wire `update_tenant` to new pipeline
- [ ] Wire `delete_tenant` to new pipeline
- [ ] Wire `get_tenant_by_phone` to new pipeline
- [ ] Wire `create_tenant_note` to new pipeline
- [ ] Wire `get_tenant_notes` to new pipeline
- [ ] Wire `update_tenant_note` to new pipeline
- [ ] Wire `delete_tenant_note` to new pipeline
- [ ] Wire `get_tenant_rental_history` to new pipeline
- [ ] Wire `update_tenant_current_rental` to new pipeline
- [ ] Wire `archive_tenant_rental` to new pipeline
- [ ] Add feature flag for rollback
- [ ] Integration tests

### Prompt & Formatter
- [ ] Rewrite WhatsApp prompt for clean DTOs
- [ ] Remove JSON output requirement
- [ ] Remove fake "+5 more" prompt
- [ ] Simplify `responseFormatter.js`
- [ ] Tighten `sanitizeAgentReply`

### Pagination
- [ ] Add real pagination in `TenantService` (without touching `crmDynamodbService`)
- [ ] Implement "show more" using cursor-based pagination

## Version

v1.0 — 2026-06-26
