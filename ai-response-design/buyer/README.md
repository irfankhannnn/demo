# Buyer AI Response Design

This folder contains the design documentation for the WhatsApp AI agent response architecture for buyer entities.

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
| `COMPLETE_BUYER_MANAGEMENT.md` | Complete operation inventory for all buyer operations |
| `BUYER_AI_DTO_CONTRACT.md` | The exact data shapes the AI will receive for all buyer operations |
| `BUYER_AI_VIEW_BUILDER.md` | The API for `BuyerAIViewBuilder` and helpers |
| `PHASED_PLAN.md` | Implementation plan from contract to production |

## Core Principles

1. **Backend-first.** `crmDynamodbService.js` remains untouched.
2. **AI-specific contract.** The DTOs are for the LLM, not a universal backend contract.
3. **Layered separation.**
   - `crmDynamodbService` → data access
   - `BuyerService` → business logic
   - `BuyerNormalizer` → enrichment and normalization
   - `BuyerAIViewBuilder` → AI DTO projection
   - LLM → natural language
   - Sanitizer → safety cleanup
4. **Complete buyer management.** All buyer operations are covered: CRUD, notes, purchase history, phone lookup, project interest, and project-based listing.
5. **Define the contract before touching code.**

## Status

### Design
- [x] Contract defined (all buyer views)
- [x] View builder API designed
- [x] Architecture documented
- [x] Phased plan documented
- [x] Complete buyer management inventory documented

### BuyerNormalizer
- [ ] Remove internal fields (PK, SK, GSI*, EntityType, tenantId, isFromContact, contactId, buyerProfile)
- [ ] Normalize timestamps to ISO
- [ ] Normalize enum values (status, priority, source)
- [ ] Compute derived fields (kycStatus, hasNotes, purchaseCount, projectInterestCount, area)
- [ ] Normalize phone to last 10 digits
- [ ] Flatten `buyerProfile` for CONTACT-as-buyer records
- [ ] Unit tests

### BuyerAIViewBuilder — Buyer CRUD
- [ ] Implement `buildSearchResults`
- [ ] Implement `buildBuyerDetails`
- [ ] Implement `buildCreateConfirmation`
- [ ] Implement `buildUpdateConfirmation`
- [ ] Implement `buildFullBuyer`
- [ ] Add `formatDate` helper
- [ ] Add `formatMoney` helper
- [ ] Add `formatPhone` helper
- [ ] Add `buildEnvelope` helper
- [ ] Add `buildPaginationMetadata` helper
- [ ] Unit tests for all buyer types

### BuyerAIViewBuilder — Project Interest
- [ ] Implement `buildProjectInterestList`
- [ ] Implement `buildProjectInterestAddConfirmation`
- [ ] Implement `buildProjectInterestUpdateConfirmation`
- [ ] Implement `buildBuyersByProjectList`
- [ ] Unit tests for project interest views

### BuyerAIViewBuilder — Purchases
- [ ] Implement `buildPurchaseHistory`
- [ ] Implement `buildPurchaseHistoryList`
- [ ] Unit tests for purchase history views

### BuyerAIViewBuilder — Notes
- [ ] Implement `buildNoteCreateConfirmation`
- [ ] Implement `buildNotesList`
- [ ] Implement `buildNoteUpdateConfirmation`
- [ ] Implement `buildNoteDeleteConfirmation`
- [ ] Unit tests for notes

### BuyerAIViewBuilder — Error DTOs
- [ ] Implement `buildBuyerNotFoundError`
- [ ] Implement `buildPhoneRequiredError`
- [ ] Implement `buildNameRequiredError`
- [ ] Implement `buildDuplicatePhoneError`
- [ ] Implement `buildEmptySearchResults`
- [ ] Unit tests for error DTOs

### BuyerService
- [ ] Implement buyer CRUD methods
- [ ] Implement buyer notes methods
- [ ] Implement buyer purchase history method
- [ ] Implement phone lookup method (deduplication)
- [ ] Implement buyer search method
- [ ] Implement project interest methods
- [ ] Implement project-based buyer listing method
- [ ] Unit tests

### Tool Wiring (skillInvoker.js)
- [ ] Add missing tool schemas (`update_buyer_note`, `delete_buyer_note`, `add_buyer_project_interest`, `update_buyer_project_interest`, `remove_buyer_project_interest`, `get_buyers_by_project`, `search_buyers`)
- [ ] Update `get_buyers` schema (add sort, pagination, filters)
- [ ] Update `get_buyer` schema (add includeNotes, includeProjectInterests, full flags)
- [ ] Wire `search_buyers` to new pipeline
- [ ] Wire `get_buyers` to new pipeline
- [ ] Wire `get_buyer` to new pipeline
- [ ] Wire `create_buyer` to new pipeline
- [ ] Wire `update_buyer` to new pipeline
- [ ] Wire `delete_buyer` to new pipeline
- [ ] Wire `get_buyer_by_phone` to new pipeline
- [ ] Wire `create_buyer_note` to new pipeline
- [ ] Wire `get_buyer_notes` to new pipeline
- [ ] Wire `update_buyer_note` to new pipeline
- [ ] Wire `delete_buyer_note` to new pipeline
- [ ] Wire `add_buyer_project_interest` to new pipeline
- [ ] Wire `update_buyer_project_interest` to new pipeline
- [ ] Wire `remove_buyer_project_interest` to new pipeline
- [ ] Wire `get_buyers_by_project` to new pipeline
- [ ] Add feature flag `USE_AI_DTO_FOR_BUYERS` for rollback
- [ ] Integration tests

### Prompt & Formatter
- [ ] Rewrite WhatsApp prompt for clean DTOs
- [ ] Remove JSON output requirement
- [ ] Remove fake "+5 more" prompt
- [ ] Simplify `responseFormatter.js`
- [ ] Tighten `sanitizeAgentReply`

### Pagination
- [ ] Add real pagination in `BuyerService` (without touching `crmDynamodbService`)
- [ ] Implement "show more" using cursor-based pagination

### Non-Buyer Entities (Phase J)
- [ ] `ContactAIViewBuilder`
- [ ] `PropertyAIViewBuilder`
- [ ] `OwnerAIViewBuilder`
- [ ] `TenantAIViewBuilder`
- [ ] `LeadAIViewBuilder`

## Version

v1.0 — 2026-06-26
