# Tenant AI Agent Architecture

## Goal

Replace the current generic formatter with a clean, layered architecture where the LLM receives purpose-built AI DTOs instead of raw DynamoDB records for tenant entities.

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
- `currentRental`, `rentalHistory`, `aadharNumber`, and S3 keys are leaked to the LLM.
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
Tool (search_tenants)
  ↓
TenantService
  ↓
crmDynamodbService
  ↓
DynamoDB


TenantService
  ↓
TenantNormalizer
  ↓
TenantAIViewBuilder
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

**Returns:** Raw domain models.

**Must remain unchanged.** Existing CRM APIs and tests depend on it.

---

### 2. `TenantService`

**Responsibility:** Business logic and orchestration.

- Search interpretation
- Filtering and sorting semantics
- Combining a tenant with notes or rental history
- Permission checks
- Query building
- Phone deduplication logic
- Current rental archive logic

**Returns:** Domain models.

Example functions:

```js
export async function searchTenants(tenantId, query, filters, options) { ... }
export async function getTenantWithNotes(tenantId, customerId, options) { ... }
export async function getTenantWithRentalHistory(tenantId, customerId, options) { ... }
export async function updateTenantCurrentRental(tenantId, customerId, rentalDetails) { ... }
export async function archiveTenantRental(tenantId, customerId) { ... }
```

---

### 3. `TenantNormalizer`

**Responsibility:** Enrich and normalize tenant data for **any** consumer.

This is NOT a formatting layer. It does not produce English strings like "₹25,000" or "2 BHK".

Examples:
- Remove internal fields (`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`)
- Normalize timestamps to ISO format
- Normalize enum values to lowercase
- Normalize phone to last 10 digits
- Compute `lastActivityAt` from the most recent note or rental update
- Compute `rentalHistoryCount` from `rentalHistory`
- Compute `hasCurrentRental` from `currentRental`

What it does NOT do:
- Format money as strings
- Select fields for a specific view
- Build the final AI DTO

**Returns:** Normalized tenant objects with derived fields but no presentation decisions.

---

### 4. `TenantAIViewBuilder`

**Responsibility:** Transform normalized tenants into AI-friendly DTOs.

It does NOT:
- Generate English text
- Decide business rules
- Execute queries
- Query the database

It DOES:
- Format phone as strings
- Format money as strings (e.g., `₹25,000`)
- Mask KYC fields (Aadhar) for non-full views
- Select which fields appear in each view
- Add pagination metadata
- Limit notes and rental history
- Build the `{ metadata, data }` envelope

**Returns:** `{ metadata, data }` DTO.

Views:
- `searchResults`
- `details`
- `createConfirmation`
- `updateConfirmation`
- `deactivateConfirmation`
- `full`
- `currentRental`
- `rentalHistory`
- `archiveRentalConfirmation`

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
| Business logic | `TenantService` | Orchestration and rules |
| Normalization | `TenantNormalizer` | Derived fields useful to any consumer |
| AI projection | `TenantAIViewBuilder` | Purpose-built DTOs for the LLM |
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
| `TenantService` | Catches raw errors and transforms them into domain errors (e.g., `TenantNotFoundError`, `SearchFailedError`, `DuplicatePhoneError`) |
| `TenantAIViewBuilder` | Never throws for malformed input; returns a safe fallback DTO with an `error` in metadata if needed |
| `Agent Runtime` | Handles domain errors by returning a friendly message to the user |
| `Sanitizer` | If the final reply is invalid, falls back to a safe default |

### Example error DTO

If the requested tenant is not found:

```json
{
  "metadata": {
    "error": "tenant_not_found",
    "message": "Tenant not found"
  },
  "data": null
}
```

The LLM can then respond:

> "Sorry, woh tenant nahi mila. Koi aur detail doges?"

---

## File Locations

```
server/
  services/
    tenantService.js
  normalizers/
    tenantNormalizer.js
  aiViewBuilders/
    tenantAIViewBuilder.js
  agents/
    agentRuntime.js
    prompts.js
    responseFormatter.js
  crmDynamodbService.js   ← untouched
```

Alternative names:
- `tenantService.js` → `tenantToolService.js`
- `tenantNormalizer.js` → `tenantEnricher.js`
- `tenantAIViewBuilder.js` → `tenantAgentViewBuilder.js`

Choose the names that feel most natural for the team.

---

## Version

v1.0 — 2026-06-26
