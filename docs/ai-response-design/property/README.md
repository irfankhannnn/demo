# Property AI Response Design

This folder contains the design documentation for the WhatsApp AI agent response architecture for property entities.

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
| `README.md` | This overview document |
| `ARCHITECTURE.md` | The layered architecture and separation of concerns |
| `COMPLETE_PROPERTY_MANAGEMENT.md` | Complete operation inventory for all property operations |
| `PROPERTY_AI_DTO_CONTRACT.md` | The exact data shapes the AI will receive for all property operations |
| `PROPERTY_AI_VIEW_BUILDER.md` | The API for `PropertyAIViewBuilder` and helpers |
| `PHASED_PLAN.md` | Implementation plan from contract to production |

## Core Principles

1. **Backend-first.** `crmDynamodbService.js` remains untouched.
2. **AI-specific contract.** The DTOs are for the LLM, not a universal backend contract.
3. **Layered separation.**
   - `crmDynamodbService` → data access
   - `PropertyService` → business logic
   - `PropertyNormalizer` → enrichment and normalization
   - `PropertyAIViewBuilder` → AI DTO projection
   - LLM → natural language
   - Sanitizer → safety cleanup
4. **Complete property management.** All property operations are covered: CRUD, documents, agreements, verifications, search, filters, and owner/tenant/lead linkage.
5. **Define the contract before touching code.**

## Status

### Design
- [x] Contract defined (all property views)
- [x] View builder API designed
- [x] Architecture documented
- [x] Phased plan documented
- [x] Complete property management inventory documented

### PropertyNormalizer
- [ ] Remove internal fields (PK, SK, GSI*, EntityType, tenantId)
- [ ] Remove S3 document keys (titleDeedS3Key, occupancyCertificateS3Key, propertyTaxReceiptS3Key)
- [ ] Normalize timestamps to ISO
- [ ] Normalize enum values (status, listingStatus, propertyType, furnishing)
- [ ] Normalize owner snapshot
- [ ] Compute derived fields (hasImages, imageCount, rentalHistoryCount, documentCount, isRented, isSold, isListed)
- [ ] Unit tests

### PropertyAIViewBuilder — Property CRUD
- [ ] Implement `buildSearchResults`
- [ ] Implement `buildPropertyDetails`
- [ ] Implement `buildCreateConfirmation`
- [ ] Implement `buildUpdateConfirmation`
- [ ] Implement `buildFullProperty`
- [ ] Implement `buildOwnerSummary`
- [ ] Implement `buildRentalInfo`
- [ ] Implement `buildSaleInfo`
- [ ] Add `formatDate` helper
- [ ] Add `formatMoney` helper
- [ ] Add `formatPhone` helper
- [ ] Add `buildEnvelope` helper
- [ ] Add `buildPaginationMetadata` helper
- [ ] Unit tests for all property types

### PropertyAIViewBuilder — Documents
- [ ] Implement `buildDocumentList`
- [ ] Implement `buildDocumentCreateConfirmation`
- [ ] Implement `buildDocumentDeleteConfirmation`
- [ ] Unit tests for documents

### PropertyAIViewBuilder — Agreements & Verifications
- [ ] Implement `buildAgreementList`
- [ ] Implement `buildAgreementCreateConfirmation`
- [ ] Implement `buildVerificationList`
- [ ] Implement `buildVerificationCreateConfirmation`
- [ ] Unit tests for agreements and verifications

### PropertyAIViewBuilder — Error DTOs
- [ ] Implement `buildPropertyNotFoundError`
- [ ] Implement `buildPropertyStatusError`
- [ ] Implement `buildTitleRequiredError`
- [ ] Implement `buildDuplicatePropertyError`
- [ ] Implement `buildEmptySearchResults`
- [ ] Implement `buildOwnerRequiredError`
- [ ] Unit tests for error DTOs

### PropertyService
- [ ] Implement property CRUD methods
- [ ] Implement property search and filter methods
- [ ] Implement property document methods
- [ ] Implement property agreement methods
- [ ] Implement property verification methods
- [ ] Implement property status lookup methods
- [ ] Implement property owner/lead linkage methods
- [ ] Unit tests

### Tool Wiring (skillInvoker.js)
- [ ] Add missing tool schemas (`search_properties`, `update_property`, `delete_property`, `get_property_documents`, `create_property_document`, `delete_property_document`, `get_property_agreements`, `create_property_agreement`, `get_property_verifications`, `create_property_verification`, `get_properties_by_owner`, `get_properties_by_status`)
- [ ] Update `get_properties` schema (add sort, pagination, filters)
- [ ] Update `get_property` schema (add includeDocuments, includeAgreements, includeVerifications, full flags)
- [ ] Wire `search_properties` to new pipeline
- [ ] Wire `get_properties` to new pipeline
- [ ] Wire `get_property` to new pipeline
- [ ] Wire `create_property` to new pipeline
- [ ] Wire `update_property` to new pipeline
- [ ] Wire `delete_property` to new pipeline
- [ ] Wire `get_property_documents` to new pipeline
- [ ] Wire `create_property_document` to new pipeline
- [ ] Wire `delete_property_document` to new pipeline
- [ ] Wire `get_property_agreements` to new pipeline
- [ ] Wire `create_property_agreement` to new pipeline
- [ ] Wire `get_property_verifications` to new pipeline
- [ ] Wire `create_property_verification` to new pipeline
- [ ] Wire `get_properties_by_owner` to new pipeline
- [ ] Wire `get_properties_by_status` to new pipeline
- [ ] Add feature flag for rollback (`USE_AI_DTO_FOR_PROPERTIES`)
- [ ] Integration tests

### Prompt & Formatter
- [ ] Rewrite WhatsApp prompt for clean DTOs
- [ ] Remove JSON output requirement
- [ ] Remove fake "+5 more" prompt
- [ ] Simplify `responseFormatter.js`
- [ ] Tighten `sanitizeAgentReply`

### Pagination
- [ ] Add real pagination in `PropertyService` (without touching `crmDynamodbService`)
- [ ] Implement "show more" using cursor-based pagination

## Version

v1.0 — 2026-06-26
