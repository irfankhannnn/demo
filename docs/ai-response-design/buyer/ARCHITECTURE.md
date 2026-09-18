# Buyer AI Agent Architecture

## Goal

Replace the current generic formatter with a clean, layered architecture where the LLM receives purpose-built AI DTOs instead of raw DynamoDB records for buyer entities.

The existing CRM data access APIs (`crmDynamodbService.js`) must remain untouched.

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
- `panNumber`, `aadharNumber`, `interestedProjects`, `purchases`, and S3 keys are leaked to the LLM.
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
Tool (search_buyers)
  ↓
BuyerService
  ↓
crmDynamodbService
  ↓
DynamoDB


BuyerService
  ↓
BuyerNormalizer
  ↓
BuyerAIViewBuilder
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

## Layer Responsibilities

### 1. `crmDynamodbService.js`

**Responsibility:** Data access.

- CRUD operations
- Queries
- Pagination at the DynamoDB level
- GSI queries (search index)
- Phone-based deduplication
- Project interest tracking

**Returns:** Raw domain models.

**Must remain unchanged.** Existing CRM APIs and tests depend on it.

---

### 2. `BuyerService`

**Responsibility:** Business logic and orchestration.

- Search interpretation
- Filtering and sorting semantics
- Combining a buyer with notes, purchase history, or project interests
- Permission checks
- Query building
- Phone deduplication logic
- Project interest add/update/remove logic
- Purchase history projection

**Returns:** Domain models.

Example functions:

```js
export async function searchBuyers(tenantId, query, filters, options) { ... }
export async function getBuyerWithNotes(tenantId, buyerId, options) { ... }
export async function getBuyerWithProjectInterests(tenantId, buyerId, options) { ... }
export async function getBuyerPurchaseHistory(tenantId, buyerId) { ... }
export async function addBuyerProjectInterest(tenantId, buyerId, projectInterest) { ... }
export async function getBuyersByProject(tenantId, projectId, options) { ... }
```

---

### 3. `BuyerNormalizer`

**Responsibility:** Enrich and normalize buyer data for **any** consumer.

This is NOT a formatting layer. It does not produce English strings like "₹1.34 Cr" or "3 BHK".

Examples:
- Remove internal fields (`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`, `isFromContact`, `contactId`, `buyerProfile`)
- Normalize timestamps to ISO format
- Normalize enum values to lowercase
- Normalize phone to last 10 digits
- Flatten `buyerProfile` fields for CONTACT-as-buyer records
- Compute `kycStatus` from PAN, Aadhar, and document URLs
- Compute `hasNotes` from linked note items
- Compute `purchaseCount` from `purchases`
- Compute `projectInterestCount` from `interestedProjects`
- Compute `area` from `preferredArea` or `address`

What it does NOT do:
- Format money as strings
- Select fields for a specific view
- Build the final AI DTO

**Returns:** Normalized buyer objects with derived fields but no presentation decisions.

---

### 4. `BuyerAIViewBuilder`

**Responsibility:** Transform normalized buyers into AI-friendly DTOs.

It does NOT:
- Generate English text
- Decide business rules
- Execute queries
- Query the database

It DOES:
- Format phone as strings
- Format money as strings (e.g., `₹1.34 Cr`)
- Mask KYC fields (PAN, Aadhar) for non-full views
- Select which fields appear in each view
- Add pagination metadata
- Limit notes and project interests
- Build the `{ metadata, data }` envelope

**Returns:** `{ metadata, data }` DTO.

Views:
- `searchResults`
- `details`
- `createConfirmation`
- `updateConfirmation`
- `full`
- `projectInterestList`
- `projectInterestAddConfirmation`
- `projectInterestUpdateConfirmation`
- `buyersByProjectList`
- `purchaseHistory`
- `purchaseHistoryList`
- `phoneLookupResult`
- Error views

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
| Business logic | `BuyerService` | Orchestration and rules |
| Normalization | `BuyerNormalizer` | Derived fields useful to any consumer |
| AI projection | `BuyerAIViewBuilder` | Purpose-built DTOs for the LLM |
| Language | LLM | Natural Hinglish generation |
| Safety | Sanitizer | Remove leaked reasoning |

---

## Why This Architecture

1. **Preserves existing CRM APIs.** `crmDynamodbService.js` is untouched.
2. **No universal DTO assumption.** The AI contract is separate from React UI and REST API contracts.
3. **LLM's job is simple.** It receives clean data and writes naturally.
4. **Scales to other entities.** The same pattern applies to `PropertyAIViewBuilder`, `LeadAIViewBuilder`, etc.
5. **Testable layers.** Each layer can be unit tested independently.

---

## Error Handling

| Layer | Responsibility |
|---|---|
| `crmDynamodbService` | Throws raw errors (e.g., DynamoDB exceptions) |
| `BuyerService` | Catches raw errors and transforms them into domain errors (e.g., `BuyerNotFoundError`, `SearchFailedError`, `DuplicatePhoneError`) |
| `BuyerAIViewBuilder` | Never throws for malformed input; returns a safe fallback DTO with an `error` in metadata if needed |
| `Agent Runtime` | Handles domain errors by returning a friendly message to the user |
| `Sanitizer` | If the final reply is invalid, falls back to a safe default |

### Example error DTO

If the requested buyer is not found:

```json
{
  "metadata": {
    "error": "buyer_not_found",
    "message": "Buyer not found"
  },
  "data": null
}
```

The LLM can then respond:

> "Sorry, woh buyer nahi mila. Koi aur detail doges?"

---

## File Locations

```
agency-app/api/
  services/
    buyerService.js
  normalizers/
    buyerNormalizer.js
  aiViewBuilders/
    buyerAIViewBuilder.js
  agents/
    agentRuntime.js
    prompts.js
    responseFormatter.js
  crmDynamodbService.js   ← untouched
```

Alternative names:
- `buyerService.js` → `buyerToolService.js`
- `buyerNormalizer.js` → `buyerEnricher.js`
- `buyerAIViewBuilder.js` → `buyerAgentViewBuilder.js`

Choose the names that feel most natural for the team.

---

## Version

v1.0 — 2026-06-26
