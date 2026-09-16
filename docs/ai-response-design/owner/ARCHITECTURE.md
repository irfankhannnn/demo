# Owner AI Agent Architecture

## Goal

Replace the current generic formatter with a clean, layered architecture where the LLM receives purpose-built AI DTOs instead of raw DynamoDB records for owner entities.

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
- `bankDetails`, `panNumber`, `aadharNumber`, and S3 keys are leaked to the LLM.
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
Tool (get_owners)
  ↓
OwnerService
  ↓
crmDynamodbService
  ↓
DynamoDB


OwnerService
  ↓
OwnerNormalizer
  ↓
OwnerAIViewBuilder
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
- GSI queries (owner-property-index, search index)
- Phone-based deduplication

**Returns:** Raw domain models.

**Must remain unchanged.** Existing CRM APIs and tests depend on it.

---

### 2. `OwnerService`

**Responsibility:** Business logic and orchestration.

- Search interpretation
- Filtering and sorting semantics
- Combining an owner with notes or properties
- Permission checks
- Query building
- Phone deduplication logic

**Returns:** Domain models.

Example functions:

```js
export async function searchOwners(tenantId, query, filters, options) { ... }
export async function getOwnerWithNotes(tenantId, ownerId, options) { ... }
export async function getOwnerWithProperties(tenantId, ownerId, options) { ... }
```

---

### 3. `OwnerNormalizer`

**Responsibility:** Enrich and normalize owner data for **any** consumer.

This is NOT a formatting layer. It does not produce English strings like "₹1.34 Cr" or "3 BHK".

Examples:
- Remove internal fields (`PK`, `SK`, `GSI*`, `EntityType`, `tenantId`)
- Normalize timestamps to ISO format
- Normalize enum values to lowercase
- Normalize phone to last 10 digits
- Compute `lastActivityAt` from the most recent note
- Compute `propertyCount` from linked properties

What it does NOT do:
- Format money as strings
- Select fields for a specific view
- Build the final AI DTO

**Returns:** Normalized owner objects with derived fields but no presentation decisions.

---

### 4. `OwnerAIViewBuilder`

**Responsibility:** Transform normalized owners into AI-friendly DTOs.

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
- Limit notes
- Build the `{ metadata, data }` envelope

**Returns:** `{ metadata, data }` DTO.

Views:
- `searchResults`
- `details`
- `createConfirmation`
- `updateConfirmation`
- `full`

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
| Business logic | `OwnerService` | Orchestration and rules |
| Normalization | `OwnerNormalizer` | Derived fields useful to any consumer |
| AI projection | `OwnerAIViewBuilder` | Purpose-built DTOs for the LLM |
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
| `OwnerService` | Catches raw errors and transforms them into domain errors (e.g., `OwnerNotFoundError`, `SearchFailedError`, `DuplicatePhoneError`) |
| `OwnerAIViewBuilder` | Never throws for malformed input; returns a safe fallback DTO with an `error` in metadata if needed |
| `Agent Runtime` | Handles domain errors by returning a friendly message to the user |
| `Sanitizer` | If the final reply is invalid, falls back to a safe default |

### Example error DTO

If the requested owner is not found:

```json
{
  "metadata": {
    "error": "owner_not_found",
    "message": "Owner not found"
  },
  "data": null
}
```

The LLM can then respond:

> "Sorry, woh owner nahi mila. Koi aur detail doges?"

---

## File Locations

```
apps/crm/server/
  services/
    ownerService.js
  normalizers/
    ownerNormalizer.js
  aiViewBuilders/
    ownerAIViewBuilder.js
  agents/
    agentRuntime.js
    prompts.js
    responseFormatter.js
  crmDynamodbService.js   ← untouched
```

Alternative names:
- `ownerService.js` → `ownerToolService.js`
- `ownerNormalizer.js` → `ownerEnricher.js`
- `ownerAIViewBuilder.js` → `ownerAgentViewBuilder.js`

Choose the names that feel most natural for the team.

---

## Version

v1.0 — 2026-06-26
