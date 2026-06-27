# Property AI Agent Architecture

## Goal

Replace the current generic formatter with a clean, layered architecture where the LLM receives purpose-built AI DTOs instead of raw DynamoDB records for property entities.

The existing CRM data access APIs (`crmDynamodbService.js`) must remain untouched.

---

## Backend-First Rule

The property AI agent is **backend-first**.

- The agent never answers from memory, hallucination, or general knowledge about a property.
- Every property fact (status, rent, owner, documents, agreements, verifications) must come from a backend tool call.
- If the backend returns no data, the agent must say it does not know or that the record was not found.
- The agent may ask clarifying questions, but it may not invent property details.

---

## Current State

```
User
  ↓
Agent Runtime
  ↓
Tool
  ↓
crmDynamodbService
  ↓
Raw DynamoDB record
  ↓
Generic responseFormatter.js
  ↓
WhatsApp text
```

Problems:
- Raw `PK`, `SK`, `GSI*`, `EntityType`, `tenantId` reach the LLM.
- S3 document keys (`titleDeedS3Key`, `occupancyCertificateS3Key`, `propertyTaxReceiptS3Key`) and internal URLs are leaked to the LLM.
- Rental history, sale info, and owner snapshot are sent as raw nested objects with inconsistent shapes.
- `responseFormatter.js` tries to handle every entity with one pipeline.
- Fake pagination: "+5 more" with no actual pagination support.
- Conflicting prompt: asks for JSON but also says "output only final text."

---

## Target State

```
User
  ↓
Agent Runtime
  ↓
Tool (get_properties)
  ↓
PropertyService
  ↓
crmDynamodbService
  ↓
DynamoDB


PropertyService
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish
  ↓
Sanitizer
  ↓
WhatsApp
```

---

## Feature Flag

### `USE_AI_DTO_FOR_PROPERTIES`

- When `false` (default), the property agent continues to use the existing formatter and raw DynamoDB records.
- When `true`, the agent uses the new pipeline: `PropertyService → PropertyNormalizer → PropertyAIViewBuilder → LLM → Sanitizer`.
- The flag is evaluated per-tenant and per-request by the agent runtime.
- It must be checked before any property AI response is generated.
- If the flag is missing, the runtime defaults to `false` (safe fallback).

This allows gradual rollout, A/B testing, and instant rollback without changing `crmDynamodbService.js`.

---

## Layer Responsibilities

### 1. `crmDynamodbService.js`

**Responsibility:** Data access.

- CRUD operations
- Queries and scans
- Pagination at the DynamoDB level
- GSI queries (owner-property-index, status-index, search-index)
- Property documents, agreements, verifications
- Owner/tenant enrichment via `getPropertiesWithDetails`

**Returns:** Raw domain models.

**Must remain unchanged.** Existing CRM APIs and tests depend on it.

---

### 2. `PropertyService`

**Responsibility:** Business logic and orchestration.

- Search interpretation
- Filtering and sorting semantics
- Combining a property with documents, agreements, verifications, or owner/tenant details
- Status transition validation (leverages the rules already in `updateProperty`)
- Owner/lead linkage
- Permission checks (e.g., prevent delete of sold/rented properties)
- Query building

**Returns:** Domain models.

Example functions:

```js
export async function searchProperties(tenantId, query, filters, options) { ... }
export async function getPropertyWithDetails(tenantId, propertyId, options) { ... }
export async function getPropertyDocuments(tenantId, propertyId, options) { ... }
export async function getPropertyAgreements(tenantId, propertyId, options) { ... }
export async function getPropertyVerifications(tenantId, propertyId, options) { ... }
export async function createPropertyWithOwnerCheck(tenantId, data) { ... }
```

---

### 3. `PropertyNormalizer`

**Responsibility:** Enrich and normalize property data for **any** consumer.

This is NOT a formatting layer. It does not produce English strings like "₹1.34 Cr" or "3 BHK".

Examples:
- Remove internal fields (`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`)
- Remove S3 document keys (`titleDeedS3Key`, `occupancyCertificateS3Key`, `propertyTaxReceiptS3Key`)
- Normalize timestamps to ISO format
- Normalize enum values to lowercase (`status`, `listingStatus`, `propertyType`, `furnishing`)
- Normalize owner snapshot (ensure `name` and `phone` are clean)
- Compute `hasImages`, `imageCount`, `videoCount` from media arrays
- Compute `isRented`, `isSold`, `isListed` from status enums
- Compute `rentalHistoryCount` from `rentalHistory`
- Compute `documentCount` from documents
- Flatten `rentalInfo` and `saleInfo` for easier consumption

What it does NOT do:
- Format money as strings
- Select fields for a specific view
- Build the final AI DTO

**Returns:** Normalized property objects with derived fields but no presentation decisions.

---

### 4. `PropertyAIViewBuilder`

**Responsibility:** Transform normalized properties into AI-friendly DTOs.

It does NOT:
- Generate English text
- Decide business rules
- Execute queries
- Query the database

It DOES:
- Format money as strings (`₹1.34 Cr`, `₹45k`)
- Format phone numbers as strings
- Format dates as `YYYY-MM-DD`
- Select which fields appear in each view
- Add pagination metadata
- Build the `{ metadata, data }` envelope
- Summarize owner info, rental info, sale info, documents, agreements, and verifications

**Returns:** `{ metadata, data }` DTO.

Views:
- `searchResults`
- `details`
- `createConfirmation`
- `updateConfirmation`
- `deleteConfirmation`
- `full`
- `documentList`
- `documentCreateConfirmation`
- `documentDeleteConfirmation`
- `agreementList`
- `agreementCreateConfirmation`
- `agreementDeleteConfirmation`
- `verificationList`
- `verificationCreateConfirmation`
- `verificationDeleteConfirmation`
- `ownerSummary`
- `rentalInfo`
- `saleInfo`

---

### 5. LLM

**Responsibility:** Generate natural language in Hinglish.

It receives clean DTOs and simply responds conversationally.

It does NOT:
- Decide which fields matter
- Flatten nested objects
- Remove nulls
- Handle pagination metadata directly

---

### 6. Sanitizer

**Responsibility:** Remove any leaked reasoning, meta-commentary, or raw JSON.

After the DTO contract is stable, the sanitizer should only need to catch:
- Internal reasoning
- Constraint lists
- "Let's refine..." style meta-commentary
- Raw JSON dumps

---

## Data Flow by Operation Type

### CRUD

```
User intent (create/update/delete/get property)
  ↓
Agent Runtime
  ↓
PropertyService
  ↓
crmDynamodbService  (create/update/delete/read)
  ↓
DynamoDB
  ↓
PropertyService  (re-fetch if needed)
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder  (createConfirmation / updateConfirmation / deleteConfirmation / details)
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish confirmation
  ↓
Sanitizer
  ↓
WhatsApp
```

- Create flows validate the owner/lead link before calling `crmDynamodbService`.
- Update flows validate status transitions before persisting.
- Delete flows check for active rentals or sales before allowing removal.
- Read flows return the `details` view.

### Search

```
User intent (search properties)
  ↓
Agent Runtime
  ↓
PropertyService  (parse query, apply filters, build GSI query)
  ↓
crmDynamodbService  (query/search-index)
  ↓
DynamoDB
  ↓
PropertyService  (sort, apply business filters)
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder  (searchResults)
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish list
  ↓
Sanitizer
  ↓
WhatsApp
```

- Search results are paginated at the DynamoDB level.
- The view builder adds pagination metadata so the LLM can ask the user to load more.

### Documents

```
User intent (list/add/remove property documents)
  ↓
Agent Runtime
  ↓
PropertyService
  ↓
crmDynamodbService  (document CRUD)
  ↓
DynamoDB
  ↓
PropertyService
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder  (documentList / documentCreateConfirmation / documentDeleteConfirmation)
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish summary
  ↓
Sanitizer
  ↓
WhatsApp
```

- S3 keys are stripped by `PropertyNormalizer`.
- Public URLs are generated only when required by the view builder.

### Agreements

```
User intent (list/add/remove property agreements)
  ↓
Agent Runtime
  ↓
PropertyService
  ↓
crmDynamodbService  (agreement CRUD)
  ↓
DynamoDB
  ↓
PropertyService
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder  (agreementList / agreementCreateConfirmation / agreementDeleteConfirmation)
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish summary
  ↓
Sanitizer
  ↓
WhatsApp
```

- Agreement DTOs include tenant/owner summary, rent amount, start date, and end date.
- Sensitive fields are masked for non-full views.

### Verifications

```
User intent (list/add/remove property verifications)
  ↓
Agent Runtime
  ↓
PropertyService
  ↓
crmDynamodbService  (verification CRUD)
  ↓
DynamoDB
  ↓
PropertyService
  ↓
PropertyNormalizer
  ↓
PropertyAIViewBuilder  (verificationList / verificationCreateConfirmation / verificationDeleteConfirmation)
  ↓
AI DTO
  ↓
LLM
  ↓
Natural Hinglish summary
  ↓
Sanitizer
  ↓
WhatsApp
```

- Verification records are normalized to show status, verifiedBy, and verifiedAt.
- KYC/document details are summarized, not dumped.

---

## AI DTO Envelope

```json
{
  "metadata": {},
  "data": {}
}
```

- `data` is an **array** for collections.
- `data` is an **object** for singletons.
- The tool name carries the entity and view semantics.

This is an **AI-specific contract**, not a universal backend contract.

React UI, REST API, and other consumers may have their own DTOs.

---

## Separation of Concerns

| Concern | Layer | Why |
|---|---|---|
| Storage | `crmDynamodbService` | One responsibility: fetch/persist |
| Business logic | `PropertyService` | Orchestration and rules |
| Normalization | `PropertyNormalizer` | Derived fields useful to any consumer |
| AI projection | `PropertyAIViewBuilder` | Purpose-built DTOs for the LLM |
| Language | LLM | Natural Hinglish generation |
| Safety | Sanitizer | Remove leaked reasoning |

---

## Why This Architecture

1. **Preserves existing CRM APIs.** `crmDynamodbService.js` is untouched.
2. **No universal DTO assumption.** The AI contract is separate from React UI and REST API contracts.
3. **LLM's job is simple.** It receives clean data and writes naturally.
4. **Scales to other entities.** The same pattern applies to `LeadAIViewBuilder`, `BuyerAIViewBuilder`, `TenantAIViewBuilder`, etc.
5. **Testable layers.** Each layer can be unit tested independently.

---

## Error Handling

| Layer | Responsibility |
|---|---|
| `crmDynamodbService` | Throws raw errors (e.g., DynamoDB exceptions, "Property not found") |
| `PropertyService` | Catches raw errors and transforms them into domain errors (e.g., `PropertyNotFoundError`, `PropertyStatusError`, `DuplicatePropertyError`) |
| `PropertyAIViewBuilder` | Never throws for malformed input; returns a safe fallback DTO with an `error` in metadata if needed |
| `Agent Runtime` | Handles domain errors by returning a friendly message to the user |
| `Sanitizer` | If the final reply is invalid, falls back to a safe default |

### Example error DTO

If the requested property is not found:

```json
{
  "metadata": {
    "error": "property_not_found",
    "message": "Property not found"
  },
  "data": null
}
```

The LLM can then respond:

> "Sorry, woh property nahi mili. Koi aur detail doge?"

---

## Rollback Strategy

If the new AI DTO pipeline fails in production:

1. Flip `USE_AI_DTO_FOR_PROPERTIES` to `false` for the affected tenant.
2. The agent runtime immediately falls back to the existing formatter and raw DynamoDB records.
3. No changes to `crmDynamodbService.js` are required.
4. `PropertyService`, `PropertyNormalizer`, and `PropertyAIViewBuilder` can remain deployed and fixed offline.
5. Monitor fallback rates and fix the root cause before re-enabling the flag.

Rollback can be done per tenant, so a global deployment never needs to be reverted.

---

## File Locations

```
server/
  services/
    propertyService.js
  normalizers/
    propertyNormalizer.js
  aiViewBuilders/
    propertyAIViewBuilder.js
  agents/
    agentRuntime.js
    prompts.js
    responseFormatter.js
  crmDynamodbService.js   ← untouched
```

Alternative names:
- `propertyService.js` → `propertyToolService.js`
- `propertyNormalizer.js` → `propertyEnricher.js`
- `propertyAIViewBuilder.js` → `propertyAgentViewBuilder.js`

Choose the names that feel most natural for the team.

---

## Version

v1.0 — 2026-06-26
