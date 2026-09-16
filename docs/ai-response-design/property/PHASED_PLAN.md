# Phased Implementation Plan

## Guiding Principle

Define the AI DTO contract first, then build the architecture on top of it. Do not touch the prompt or formatter until the DTO contract is stable.

The existing `crmDynamodbService.js` and `crmHelpers.js` APIs must remain untouched.

This plan covers **complete property management**: CRUD, documents, agreements, verifications, search, filters, owner/lead linkage, and rich queries.

---

## Overview

This document is a contract-first, 8-phase roadmap for migrating the WhatsApp AI agent's property handling from raw DynamoDB records to clean, purpose-built AI DTOs.

The pipeline is:

```
Raw CRM data
  → PropertyNormalizer (clean + enrich)
  → PropertyService (business logic + composition)
  → PropertyAIViewBuilder (DTO projection)
  → aiDtoMiddleware (tool registry + wiring)
  → LLM
  → responseFormatter (final WhatsApp text)
```

Each phase is small, reversible, and independently testable. Production behavior is controlled by the feature flag `USE_AI_DTO_FOR_PROPERTIES`.

---

## Phase 1 — Contract & Design

**Goal:** Finalize the design documents so every downstream phase has a clear target.

### Files

- `docs/ai-response-design/property/PROPERTY_AI_DTO_CONTRACT.md`
- `docs/ai-response-design/property/PROPERTY_AI_VIEW_BUILDER.md` (create if missing)
- `docs/ai-response-design/property/COMPLETE_PROPERTY_MANAGEMENT.md` (reference)

### Steps

1. Confirm every property operation in `COMPLETE_PROPERTY_MANAGEMENT.md` has a matching AI DTO view.
2. Define all views in `PROPERTY_AI_DTO_CONTRACT.md`:
   - Property CRUD: `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `deleteConfirmation`, `full`
   - Documents: `documentList`, `documentCreateConfirmation`, `documentDeleteConfirmation`
   - Agreements: `agreementList`, `agreementCreateConfirmation`
   - Verifications: `verificationList`, `verificationCreateConfirmation`
   - Errors: `propertyNotFoundError`, `propertyStatusError`, `titleRequiredError`, `duplicatePropertyError`, `emptySearchResults`, `ownerRequiredError`
3. Design the public API of `PropertyAIViewBuilder` in `PROPERTY_AI_VIEW_BUILDER.md`:
   - `buildSearchResults(properties, pagination)`
   - `buildPropertyDetails(property)`
   - `buildCreateConfirmation(property)`
   - `buildUpdateConfirmation(property, updatedFields)`
   - `buildDeleteConfirmation(property)`
   - `buildFullProperty(property)`
   - `buildDocumentList(documents)`
   - `buildDocumentCreateConfirmation(property, document)`
   - `buildDocumentDeleteConfirmation(propertyId, documentId)`
   - `buildAgreementList(agreements)`
   - `buildAgreementCreateConfirmation(property, agreement)`
   - `buildVerificationList(verifications)`
   - `buildVerificationCreateConfirmation(property, verification)`
   - `buildPropertyNotFoundError(propertyId)`
   - `buildPropertyStatusError(property, attemptedStatus, reason)`
   - `buildTitleRequiredError()`
   - `buildDuplicatePropertyError(property)`
   - `buildEmptySearchResults()`
   - `buildOwnerRequiredError()`
   - Helpers: `formatMoney`, `formatDate`, `formatPhone`, `buildEnvelope`, `buildPaginationMetadata`, `buildOwnerSummary`, `buildRentalInfo`, `buildSaleInfo`
4. Decide the pagination metadata shape (total, hasMore, nextCursor, shown per sub-resource).
5. Decide money formatting rules (compact Indian currency: `₹4.5 Cr`, `₹50k`).
6. List internal fields to remove (PK, SK, GSI*, EntityType, tenantId, S3 keys, internal_* fields).
7. List derived fields to compute (hasImages, imageCount, hasVideos, videoCount, isRented, isSold, isListed, documentCount, rentalHistoryCount).
8. Define the feature flag: `USE_AI_DTO_FOR_PROPERTIES`.

### Verification

- [ ] `PROPERTY_AI_DTO_CONTRACT.md` contains every view listed above.
- [ ] `PROPERTY_AI_VIEW_BUILDER.md` defines every method signature.
- [ ] `COMPLETE_PROPERTY_MANAGEMENT.md` maps every tool to a view.
- [ ] No view is missing for operations in the tool inventory.

### Risks

| Risk | Mitigation |
|---|---|
| Contract changes late in the project | Lock the contract before Phase 2. Require a re-review if any change is needed. |
| Missing property sub-entities (documents, agreements, verifications) | Use the operation inventory as a checklist. |

---

## Phase 2 — Build `PropertyNormalizer`

**Goal:** Create a normalization layer that enriches raw property models with derived fields and hides internal storage details.

### Files

- `apps/crm/server/normalizers/propertyNormalizer.js`
- `apps/crm/server/normalizers/propertyNormalizer.test.js`

### Steps

1. Create `normalizeProperty(rawProperty)` for a single property.
2. Create `normalizeProperties(properties)` for arrays.
3. Remove internal fields:
   - `PK`, `SK`, `GSI1PK`, `GSI1SK`, `GSI2PK`, `GSI2SK`, `GSI3PK`, `GSI3SK`
   - `EntityType`, `tenantId`
   - S3 keys: `titleDeedS3Key`, `occupancyCertificateS3Key`, `propertyTaxReceiptS3Key`
   - Any field starting with `internal_`
4. Remove or hide on nested documents and agreements:
   - `s3Key` on property documents
   - `documentS3Key` on agreements and verifications
5. Normalize timestamps to ISO (`createdAt`, `updatedAt`, `availableFrom`, `soldDate`, `startDate`, `endDate`, `verificationDate`, `expiryDate`).
6. Normalize enum values to lowercase kebab-case:
   - `status`, `listingStatus`, `propertyType`, `furnishing`, `facing`
7. Normalize owner snapshot into a clean `owner` object:
   - `{ ownerId, name, phone }`
8. Compute derived fields:
   - `hasImages` / `imageCount` from `images`
   - `hasVideos` / `videoCount` from `videos`
   - `documentCount` from `documents`
   - `rentalHistoryCount` from `rentalHistory`
   - `isRented` from `status === 'rented'`
   - `isSold` from `status === 'sold'`
   - `isListed` from `listingStatus === 'active'`
9. Keep money as raw numbers for the view builder to format.
10. Write unit tests for:
    - Property with and without owner
    - Property with and without sale info
    - Property with and without rental info
    - Property with and without images/videos/documents
    - Property in every relevant status
    - All internal fields removed

### Example

Input:
```json
{
  "propertyId": "prop-abc123",
  "title": "3BHK Apartment in Bandra West",
  "propertyType": "apartment",
  "bhk": 3,
  "area": "Bandra West",
  "city": "Mumbai",
  "status": "for-sale",
  "listingStatus": "active",
  "saleInfo": { "listedPrice": 45000000 },
  "ownerSnapshot": { "ownerId": "owner-abc123", "name": "Rajesh Kumar", "phone": "9876543210" },
  "images": ["img1.jpg", "img2.jpg"],
  "PK": "TENANT#123#PROPERTY#prop-abc123",
  "SK": "METADATA",
  "titleDeedS3Key": "s3://..."
}
```

Output:
```json
{
  "propertyId": "prop-abc123",
  "title": "3BHK Apartment in Bandra West",
  "propertyType": "apartment",
  "bhk": 3,
  "area": "Bandra West",
  "city": "Mumbai",
  "status": "for-sale",
  "listingStatus": "active",
  "saleInfo": { "listedPrice": 45000000 },
  "owner": { "ownerId": "owner-abc123", "name": "Rajesh Kumar", "phone": "9876543210" },
  "images": ["img1.jpg", "img2.jpg"],
  "hasImages": true,
  "imageCount": 2,
  "hasVideos": false,
  "videoCount": 0,
  "documentCount": 0,
  "rentalHistoryCount": 0,
  "isRented": false,
  "isSold": false,
  "isListed": true
}
```

### Verification

- [ ] All internal fields removed in tests.
- [ ] No S3 keys present in normalized output.
- [ ] Derived fields computed correctly.
- [ ] Money values remain as numbers.
- [ ] All unit tests pass.

### Risks

| Risk | Mitigation |
|---|---|
| Hidden fields leak to the AI | Add a whitelist of allowed fields and test for their absence. |
| Derived fields inconsistent with status | Add explicit tests for `rented`, `sold`, `for-sale`, `for-rent`, `available`. |

---

## Phase 3 — Build `PropertyAIViewBuilder`

**Goal:** Create the projection layer that builds AI DTOs from normalized properties.

### Files

- `apps/crm/server/aiViewBuilders/propertyAIViewBuilder.js`
- `apps/crm/server/aiViewBuilders/propertyAIViewBuilder.test.js`

### Steps

1. Implement helpers:
   - `formatMoney(amount)` — compact Indian currency
   - `formatDate(date)` — ISO date
   - `formatPhone(phone)` — last 10 digits
   - `buildEnvelope(metadata, data)` — standard `{ metadata, data }` envelope
   - `buildPaginationMetadata(total, shown, hasMore, nextCursor)`
   - `buildOwnerSummary(owner)`
   - `buildRentalInfo(rentalInfo)`
   - `buildSaleInfo(saleInfo)`
2. Implement CRUD views:
   - `buildSearchResults(properties, pagination)` — array of compact property cards
   - `buildPropertyDetails(property)` — single property with documents, agreements, verifications limited to 5 each
   - `buildCreateConfirmation(property)`
   - `buildUpdateConfirmation(property, updatedFields)`
   - `buildDeleteConfirmation(property)`
   - `buildFullProperty(property)` — all allowed fields including lat/long and pre-signed URLs
3. Implement document views:
   - `buildDocumentList(documents)`
   - `buildDocumentCreateConfirmation(property, document)`
   - `buildDocumentDeleteConfirmation(propertyId, documentId)`
4. Implement agreement views:
   - `buildAgreementList(agreements)`
   - `buildAgreementCreateConfirmation(property, agreement)`
5. Implement verification views:
   - `buildVerificationList(verifications)`
   - `buildVerificationCreateConfirmation(property, verification)`
6. Implement error DTOs:
   - `buildPropertyNotFoundError(propertyId)`
   - `buildPropertyStatusError(property, attemptedStatus, reason)`
   - `buildTitleRequiredError()`
   - `buildDuplicatePropertyError(property)`
   - `buildEmptySearchResults()`
   - `buildOwnerRequiredError()`
7. Write unit tests for:
   - Each view against `PROPERTY_AI_DTO_CONTRACT.md`
   - Properties with and without owner
   - Properties with sale vs rental info
   - Properties with documents, agreements, verifications
   - Empty lists
   - Pagination metadata

### Verification

- [ ] Each view output matches `PROPERTY_AI_DTO_CONTRACT.md` exactly.
- [ ] Money values are formatted strings (e.g., `₹4.5 Cr`, `₹50k`).
- [ ] No internal fields leak into any view.
- [ ] All unit tests pass.

### Risks

| Risk | Mitigation |
|---|---|
| View drift from the contract | Use the contract examples as fixtures in tests. |
| Full view exposes S3 keys | Only expose pre-signed URLs; keep S3 keys in the normalizer. |

---

## Phase 4 — Introduce `PropertyService`

**Goal:** Separate property business logic from the tool layer and provide a clean boundary for the middleware.

### Files

- `apps/crm/server/services/propertyService.js`
- `apps/crm/server/services/propertyService.test.js`

### Steps

1. Create a thin `PropertyService` that wraps `crmDynamodbService`.
2. Implement property CRUD methods:
   - `searchProperties(tenantId, query, filters)`
   - `getProperties(tenantId, filters)`
   - `getProperty(tenantId, propertyId)`
   - `createProperty(tenantId, data)`
   - `updateProperty(tenantId, propertyId, data)`
   - `deleteProperty(tenantId, propertyId)`
3. Implement document methods:
   - `getPropertyDocuments(tenantId, propertyId)`
   - `createPropertyDocument(tenantId, propertyId, data)`
   - `deletePropertyDocument(tenantId, propertyId, documentId)`
4. Implement agreement methods:
   - `getPropertyAgreements(tenantId, propertyId)`
   - `createPropertyAgreement(tenantId, propertyId, data)`
5. Implement verification methods:
   - `getPropertyVerifications(tenantId, propertyId)`
   - `createPropertyVerification(tenantId, propertyId, data)`
6. Implement lookup methods:
   - `getPropertiesByOwner(tenantId, ownerId)`
   - `getPropertiesByStatus(tenantId, status)`
   - `getPropertiesByLead(tenantId, leadId)`
   - `getPropertiesWithDetails(tenantId)`
7. Implement in-memory pagination (optional, can be added in Phase 6):
   - `searchPropertiesPaginated(tenantId, query, filters, options)`
8. Pass every result through `PropertyNormalizer` and `PropertyAIViewBuilder`.
9. Write unit tests using mocked `crmDynamodbService`.

### Verification

- [ ] Each service method calls the correct `crmDynamodbService` function.
- [ ] Each method returns a view from `PropertyAIViewBuilder`.
- [ ] `crmDynamodbService.js` is never modified.
- [ ] All unit tests pass.

### Risks

| Risk | Mitigation |
|---|---|
| Service becomes too thick | Keep it thin for the first iteration; add business logic only when needed. |
| In-memory pagination is slow for large datasets | Add a TODO for DynamoDB-level pagination without touching `crmDynamodbService`. |

---

## Phase 5 — Middleware Wiring

**Goal:** Update `apps/crm/server/aiDtoMiddleware.js` to route property tool results through the new pipeline.

### Files

- `apps/crm/server/aiDtoMiddleware.js`
- `apps/crm/server/aiDtoMiddleware.test.js`

### Steps

1. Add the feature flag:
   ```js
   const USE_AI_DTO_FOR_PROPERTIES = process.env.USE_AI_DTO_FOR_PROPERTIES === 'true';
   ```
2. Import the normalizer and view builder:
   ```js
   import { normalizeProperty, normalizeProperties } from './normalizers/propertyNormalizer.js';
   import * as PropertyAIViewBuilder from './aiViewBuilders/propertyAIViewBuilder.js';
   ```
3. Import `PropertyService` if the middleware needs to re-fetch related data; otherwise, keep the middleware stateless and rely on the raw tool result.
4. Define the property tool registry:
   ```js
   const PROPERTY_TOOLS = new Set([
     'create_property', 'get_property', 'get_properties', 'search_properties',
     'update_property', 'delete_property',
     'get_property_documents', 'create_property_document', 'delete_property_document',
     'get_property_agreements', 'create_property_agreement',
     'get_property_verifications', 'create_property_verification',
     'get_properties_by_owner', 'get_properties_by_status', 'get_properties_by_lead',
     'get_properties_with_details',
   ]);
   ```
5. Add a branch in `transformWithAiDto`:
   ```js
   if (USE_AI_DTO_FOR_PROPERTIES && PROPERTY_TOOLS.has(toolName)) {
     return transformPropertyResult(toolName, result, context.tenantId, context.input || {});
   }
   ```
6. Implement `transformPropertyResult(toolName, result, tenantId, input)`:
   - Handle null results with `buildPropertyNotFoundError` for `get_property`.
   - Handle array results for search/list tools.
   - Map each tool to the correct view builder method.
   | Tool | Service/View builder method |
   |---|---|
   | `search_properties` | `buildSearchResults` or `buildEmptySearchResults` |
   | `get_properties` | `buildSearchResults` or `buildEmptySearchResults` |
   | `get_properties_by_owner` | `buildSearchResults` |
   | `get_properties_by_status` | `buildSearchResults` |
   | `get_properties_by_lead` | `buildSearchResults` |
   | `get_properties_with_details` | `buildSearchResults` |
   | `get_property` | `buildPropertyDetails` or `buildPropertyNotFoundError` |
   | `create_property` | `buildCreateConfirmation` |
   | `update_property` | `buildUpdateConfirmation` |
   | `delete_property` | `buildDeleteConfirmation` |
   | `get_property_documents` | `buildDocumentList` |
   | `create_property_document` | `buildDocumentCreateConfirmation` |
   | `delete_property_document` | `buildDocumentDeleteConfirmation` |
   | `get_property_agreements` | `buildAgreementList` |
   | `create_property_agreement` | `buildAgreementCreateConfirmation` |
   | `get_property_verifications` | `buildVerificationList` |
   | `create_property_verification` | `buildVerificationCreateConfirmation` |
7. Export the feature flag in the default export.
8. Add middleware tests for every property tool:
   - DTO output matches the contract.
   - Feature flag off = original result passes through.
   - Null results produce correct error DTOs.

### Verification

- [ ] `USE_AI_DTO_FOR_PROPERTIES` is checked in `transformWithAiDto`.
- [ ] Every property tool is in `PROPERTY_TOOLS`.
- [ ] Middleware tests cover all property tools.
- [ ] When the flag is off, the old result is returned unchanged.
- [ ] All tests pass.

### Risks

| Risk | Mitigation |
|---|---|
| Tool schema not yet updated in `skillInvoker.js` | The middleware works independently; update schemas in parallel or as a separate PR. |
| Middleware swallows errors | Always return the original `result` on unexpected errors to avoid breaking the chat flow. |

---

## Phase 6 — Prompts & Formatter

**Goal:** Simplify the WhatsApp system prompt and response formatter now that the AI receives clean DTOs.

### Files

- `apps/crm/server/agents/prompts.js`
- `apps/crm/server/agents/responseFormatter.js`

### Steps

1. Update `apps/crm/server/agents/prompts.js`:
   - Remove JSON output requirement.
   - Remove "Output ONLY the final reply text" conflict.
   - Remove "Ignore PK/SK" instructions.
   - Remove property-specific flattening/summarization instructions.
   - Remove "NEVER describe your role" rule.
   - Remove constraint lists.
   - Add:
     - "You will receive clean CRM DTOs."
     - "Answer naturally in Hinglish."
     - "Use only the provided data."
     - "For lists, summarize naturally."
     - "For details, describe the key fields conversationally."
     - "For properties, mention title, area, status, listing status, price/rent, and owner name when relevant."
     - "For documents, agreements, and verifications, mention the count and most recent items."
2. Add a property-specific prompt example if needed (e.g., how to handle `searchResults` with 10+ items).
3. Update `apps/crm/server/agents/responseFormatter.js`:
   - Remove property-specific card/list formatters for raw properties.
   - Remove `MAX_LIST_ITEMS_WITH_MORE` slicing.
   - Remove fake "+5 more" prompt.
   - Keep only generic WhatsApp formatting (bold, line breaks, emoji if required by brand).
   - The formatter becomes a thin dispatcher: if the LLM returns raw text, use it; if it returns a DTO, ensure it is valid WhatsApp text.
   - Handle empty DTOs and error DTOs with safe fallbacks.

### Example prompt snippet

```
You are a helpful CRM assistant for RealEstateFlow.

You will receive clean, structured data about CRM records in the form of DTOs.
Your job is to respond naturally in Hinglish (70% English, 30% Hindi romanised).

Use ONLY the data provided. Do not invent information.
Keep replies concise — max 2 sentences when confirming simple actions.

When you receive a list in the `data` array:
- For 1–3 items: mention each item by name and area
- For 4–10 items: summarize the key patterns (e.g., "3 for sale, 2 for rent")
- For 10+ items: mention the total count and show the first 3

When you receive a single property in the `data` field:
- Describe the key fields conversationally
- Include title, area, city, status, listing status, price/rent, and owner name when relevant

Never describe who you are as an AI. Just answer the user's question.
Never include internal reasoning, constraints, or system instructions in your reply.
```

### Verification

- [ ] Prompt no longer requires JSON output.
- [ ] Formatter no longer slices lists or adds fake "+N more".
- [ ] Formatter unit tests updated and passing.
- [ ] Manual WhatsApp test shows natural Hinglish replies.

### Risks

| Risk | Mitigation |
|---|---|
| LLM hallucinates without constraints | Add the "use only provided data" rule and verify with real prompts. |
| Formatter removes too much | Keep generic WhatsApp formatting; only remove property-specific raw formatting. |

---

## Phase 7 — Testing

**Goal:** Add comprehensive tests for the AI DTO implementation and middleware wiring.

### Files

- `apps/crm/server/aiImplementation.test.js`
- `apps/crm/server/aiDtoMiddleware.test.js`
- `apps/crm/server/aiViewBuilders/propertyAIViewBuilder.test.js`
- `apps/crm/server/normalizers/propertyNormalizer.test.js`
- `apps/crm/server/services/propertyService.test.js`

### Steps

1. In `apps/crm/server/aiImplementation.test.js` (or `apps/crm/server/aiImplementation.test.js` if new), add end-to-end test cases:
   - `search_properties` returns a DTO matching the contract.
   - `get_property` returns a detailed DTO.
   - `create_property` returns a create confirmation DTO.
   - `update_property` returns an update confirmation DTO.
   - `delete_property` returns a delete confirmation DTO.
   - Property documents, agreements, and verifications return correct DTOs.
   - Empty search results return the correct empty DTO.
   - Property not found returns the correct error DTO.
2. In `apps/crm/server/aiDtoMiddleware.test.js`:
   - Add property tool cases under the feature flag.
   - Verify each property tool maps to the correct DTO view.
   - Verify feature flag off = original result unchanged.
   - Verify error DTOs are returned when `result` is null.
3. Run all existing tests to ensure no regression.
4. Run a manual WhatsApp test for each property tool.

### Verification

- [ ] `aiImplementation.test.js` covers all property CRUD and sub-entity flows.
- [ ] `aiDtoMiddleware.test.js` covers all property tools.
- [ ] All tests pass with `USE_AI_DTO_FOR_PROPERTIES=true`.
- [ ] All tests pass with `USE_AI_DTO_FOR_PROPERTIES=false` (backward compatibility).

### Risks

| Risk | Mitigation |
|---|---|
| Tests only cover happy paths | Add error cases: null, empty arrays, missing owner, invalid status. |
| Tests tightly coupled to formatting | Test shape and presence, not exact text strings. |

---

## Phase 8 — Production

**Goal:** Roll out the property AI DTO pipeline safely with feature flags and a clear rollback plan.

### Files

- `.env.example`
- `apps/crm/server/config.js` (if feature flags are centralized)
- `apps/crm/server/aiDtoMiddleware.js`
- `apps/crm/server/agents/prompts.js`
- `apps/crm/server/agents/responseFormatter.js`

### Steps

1. Document the feature flag in `.env.example`:
   ```
   # AI DTO pipeline
   USE_AI_DTO_FOR_PROPERTIES=false
   ```
2. Set the default to `false` in every environment until verification is complete.
3. Enable the flag in a non-production environment first:
   - Run the full property test suite.
   - Run manual WhatsApp conversations for each property tool.
   - Monitor for leaked internal fields or unnatural replies.
4. Roll out to a small percentage of production traffic (e.g., 1 tenant) if possible.
5. Monitor for 24–48 hours:
   - LLM response quality
   - Error rates
   - Customer complaints
   - Internal field leakage
6. Increase to 100% of production traffic.
7. Once stable for 1–2 weeks, remove the feature flag and old code path.

### Rollback Plan

If the new pipeline causes issues in production:

1. Set `USE_AI_DTO_FOR_PROPERTIES=false`.
2. Restart the service.
3. The WhatsApp agent reverts to the old behavior.
4. Fix the issue.
5. Re-enable the flag.

```js
const USE_AI_DTO_FOR_PROPERTIES = process.env.USE_AI_DTO_FOR_PROPERTIES === 'true';

if (USE_AI_DTO_FOR_PROPERTIES && PROPERTY_TOOLS.has(toolName)) {
  return transformPropertyResult(toolName, result, context.tenantId, context.input || {});
}
return result;
```

### Verification

- [ ] Feature flag is documented in `.env.example`.
- [ ] Rollback tested by toggling the flag and re-running a property query.
- [ ] Production rollout is staged and monitored.
- [ ] Old code path is removed only after sustained stability.

### Risks

| Risk | Mitigation |
|---|---|
| Production replies degrade | Roll back immediately via feature flag; investigate offline. |
| Feature flag left in code forever | Add a calendar reminder to remove the flag after stabilization. |
| Partial rollout confuses monitoring | Use tenant-level or environment-level flags, not random percentages. |

---

## Risk Order

| Phase | Risk | Mitigation |
|---|---|---|
| 1 | Low | Document only; review contract before moving on. |
| 2 | Low | Pure data transformation; unit tests. |
| 3 | Low | Unit tests per view; contract fixtures. |
| 4 | Low | Thin service layer; mocked crmDynamodbService. |
| 5 | Medium | Feature flag + middleware tests; preserve old path. |
| 6 | Medium | Test prompt and formatter heavily with real WhatsApp prompts. |
| 7 | Medium | Cover happy paths and error paths; run both flag states. |
| 8 | High | Staged rollout, monitoring, and immediate rollback via flag. |

---

## Immediate Next Step

Start with **Phase 1** (contract lock) and **Phase 2** (normalizer) in parallel.

These are low-risk, highly testable, and unblock the rest of the work.

---

## Version

v1.0 — 2026-06-26
