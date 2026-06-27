# Complete Property Management — End-to-End Design

## Scope

This document covers **every property-related operation** the AI agent must support, mapped to backend functions, tool schemas, and AI DTO views.

Nothing property-related is left out.

---

## Complete Operation Inventory

Each operation lists: **Tool** (as exposed in `skillInvoker.js`), **Input**, **Backend function** (`crmDynamodbService.js`), **Output**, **AI view**, and **Notes**.

### Property CRUD

| # | Operation | Tool | Input | Backend function | Output | AI view | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Create property | `create_property` | `{ title, propertyType, description, bhk, area, city, address, flatNumber, floor, buildingName, carpetArea, builtUpArea, furnishing, facing, amenities, status, listingStatus, ownerId, ownerName, ownerPhone, expectedBrokerage, rentAmount, depositAmount, salePrice, availableFrom, featured, verified, latitude, longitude, images, videos, convertedFromLeadId }` | `createProperty(tenantId, data)` | Property object | `createConfirmation` | Title is required. `propertyType` defaults to `apartment`. `status` defaults to `available`. `listingStatus` defaults to `inactive`. Owner is optional. `convertedFromLeadId` links to the lead that was converted. |
| 2 | Get single property | `get_property` | `{ propertyId, includeDocuments?, includeAgreements?, includeVerifications?, includeOwner?, full? }` | `getProperty(tenantId, propertyId)` | Property object or `null` | `details` / `full` | `propertyId` is required. The AI view switches to `full` when `full=true` or when the caller explicitly asks for "all details". Include flags are handled by the service layer before returning the DTO. |
| 3 | List properties with filters | `get_properties` | `{ status, listingStatus, propertyType, bhk, furnishing, area, city, ownerId, search, minRent, maxRent, minSalePrice, maxSalePrice, createdFrom, createdTo, tag, featured, verified, sortBy, sortOrder, limit, offset, responseMode }` | `getProperties(tenantId, filters)` | `{ properties, total, limit, offset }` | `searchResults` | Use for filter-based listing. For free-text search across owner/tenant names, use `search_properties`. |
| 4 | Search properties (free text) | `search_properties` | `{ query, status, propertyType, bhk, furnishing, minRent, maxRent }` | `searchProperties(tenantId, query, filters)` | Array of enriched property objects | `searchResults` | Searches title, area, building name, address, owner name, owner phone, and tenant name. Requires `query` to be at least 2 characters. Returns up to 100 results. |
| 5 | Update property | `update_property` | `{ propertyId, ...fieldsToUpdate }` | `updateProperty(tenantId, propertyId, data)` | Updated property object | `updateConfirmation` | `propertyId` is required. `status` changes are validated against transition rules. `ownerId` can be set to `null` to unassign. |
| 6 | Delete property | `delete_property` | `{ propertyId }` | `deleteProperty(tenantId, propertyId)` | `true` | `deleteConfirmation` | Cannot delete sold properties or properties with an active tenant (`tenantCustomerId` or `rentalInfo.currentTenantId`). |
| 7 | Increment property views | `increment_property_views` | `{ propertyId }` | `incrementPropertyViews(tenantId, propertyId)` | `undefined` | `viewCountConfirmation` | Used to track listing views. No return value. |

### Property Documents

| # | Operation | Tool | Input | Backend function | Output | AI view | Notes |
|---|---|---|---|---|---|---|---|
| 8 | List documents | `get_property_documents` | `{ propertyId }` | `getPropertyDocuments(tenantId, propertyId)` | Array of document objects | `documentList` | Returns all `PROPERTY_DOCUMENT` items for a property. |
| 9 | Add document | `create_property_document` | `{ propertyId, documentType, fileName, s3Key, fileSize?, mimeType?, description? }` | `createPropertyDocument(tenantId, propertyId, data)` | Document object | `documentCreateConfirmation` | `documentType`, `fileName`, and `s3Key` are required. `documentType` enum: `PHOTO`, `VIDEO`, `AGREEMENT`, `VERIFICATION`, `OTHER`. **Note:** `skillInvoker.js` currently maps `title` → `fileName` and `url` → `s3Key`; this schema should be updated to match the backend. |
| 10 | Delete document | `delete_property_document` | `{ propertyId, documentId }` | `deletePropertyDocument(tenantId, propertyId, documentId)` | `true` | `documentDeleteConfirmation` | Confirm with the user before executing. |

### Property Agreements

| # | Operation | Tool | Input | Backend function | Output | AI view | Notes |
|---|---|---|---|---|---|---|---|
| 11 | List agreements | `get_property_agreements` | `{ propertyId }` | `getPropertyAgreements(tenantId, propertyId)` | Array of agreement objects | `agreementList` | Returns all `PROPERTY_AGREEMENT` items for a property. |
| 12 | Create agreement | `create_property_agreement` | `{ propertyId, startDate, endDate, monthlyRent, securityDeposit?, status?, documentName?, notes? }` | `createPropertyAgreement(tenantId, propertyId, data)` | Agreement object | `agreementCreateConfirmation` | `startDate`, `endDate`, and `monthlyRent` are required. `status` defaults to `pending`. Also updates the property's `agreementStatus`. |
| 13 | Update agreement | `update_property_agreement` | `{ propertyId, agreementId, ...fieldsToUpdate }` | `updatePropertyAgreement(tenantId, propertyId, agreementId, data)` | `{ success: true }` | `agreementUpdateConfirmation` | `propertyId` and `agreementId` are required. If `status` is updated, the property's `agreementStatus` is synchronized. |

### Property Verifications

| # | Operation | Tool | Input | Backend function | Output | AI view | Notes |
|---|---|---|---|---|---|---|---|
| 14 | List verifications | `get_property_verifications` | `{ propertyId }` | `getPropertyVerifications(tenantId, propertyId)` | Array of verification objects | `verificationList` | Returns all `PROPERTY_VERIFICATION` items for a property. |
| 15 | Create verification | `create_property_verification` | `{ propertyId, verificationType, status?, verificationDate?, expiryDate?, documentName?, notes? }` | `createPropertyVerification(tenantId, propertyId, data)` | Verification object | `verificationCreateConfirmation` | `verificationType` is required. `status` defaults to `pending`. `verificationType` enum: `police`, `background`, `other`. Also updates the property's `verificationStatus`. |
| 16 | Update verification | `update_property_verification` | `{ propertyId, verificationId, ...fieldsToUpdate }` | `updatePropertyVerification(tenantId, propertyId, verificationId, data)` | `{ success: true }` | `verificationUpdateConfirmation` | `propertyId` and `verificationId` are required. If `status` is updated, the property's `verificationStatus` is synchronized. |

### Property Lookup by Status / Owner / Lead / Project

| # | Operation | Tool | Input | Backend function | Output | AI view | Notes |
|---|---|---|---|---|---|---|---|
| 17 | Get properties by status | `get_properties_by_status` | `{ status }` | `getPropertiesByStatus(tenantId, status)` | Array of property objects | `searchResults` | Uses the `status-index` GSI. `status` is required. |
| 18 | Get properties by owner | `get_properties_by_owner` | `{ ownerId }` | `getPropertiesByOwner(tenantId, ownerId)` | Array of property objects | `searchResults` | Uses the `owner-property-index` GSI. `ownerId` is required. |
| 19 | Get properties by lead | `get_properties_by_lead` | `{ leadId }` | `getPropertiesByLeadId(tenantId, leadId)` | Array of property objects | `searchResults` | Scans for `convertedFromLeadId = leadId`. Used to prevent duplicate conversions. |
| 20 | Get properties by project | `get_properties_by_project` | `{ projectId }` | `getPropertiesByProject(tenantId, projectId)` | Array of property objects | `searchResults` | Scans for properties linked to the given projectId. |
| 21 | Get properties with details | `get_properties_with_details` | `{ limit?, offset? }` | `getPropertiesWithDetails(tenantId)` | Array of enriched property objects | `searchResults` | Enriches each property with `owner` and `tenant` objects. `limit` and `offset` are not currently consumed by the backend but should be passed for future pagination. |

---

## Property Status Transition Rules

The property lifecycle status is stored in `status`. Valid values are:

- `available` — default, ready for listing
- `for-sale` — listed for sale
- `for-rent` — listed for rent
- `rented` — currently rented out
- `sold` — permanently sold
- `on-hold` — temporarily paused
- `out-of-stock` — unavailable for an extended period

Allowed transitions are enforced in `updateProperty`:

| Current status | Allowed next statuses |
|---|---|
| `available` | `for-sale`, `for-rent`, `on-hold`, `out-of-stock` |
| `for-sale` | `sold`, `on-hold`, `available`, `out-of-stock` |
| `for-rent` | `rented`, `on-hold`, `available`, `out-of-stock` |
| `rented` | `available`, `on-hold` |
| `sold` | *(none — sold is terminal)* |
| `on-hold` | `available`, `for-sale`, `for-rent` |
| `out-of-stock` | `available` |

### Rules & side effects

1. **Terminal status** — `sold` properties cannot be deleted or moved to any other status.
2. **Active tenant guard** — A property cannot be deleted if `tenantCustomerId` or `rentalInfo.currentTenantId` is set.
3. **Rental history sync** — When a property is updated to `rented` and it has `tenantCustomerId`, the backend automatically appends a rental-history entry if one is not already active.
4. **GSI2 update** — `status` changes automatically rewrite `GSI2PK` to `TENANT#{tenantId}#PROPERTY_STATUS#{newStatus}`.
5. **Owner unassignment** — Setting `ownerId` to `null` moves the property to `TENANT#{tenantId}#OWNER#UNASSIGNED` in GSI1.
6. **Agreement & verification sync** — Creating or updating a property agreement/verification updates the denormalized `agreementStatus` / `verificationStatus` fields on the property profile.

---

## Data Sources in `crmDynamodbService.js`

All of these functions already exist and are tested. They must remain unchanged.

### Property functions

```js
createProperty(tenantId, data)
getProperties(tenantId, filters)
getPropertiesByStatus(tenantId, status)
getPropertiesByOwner(tenantId, ownerId)
getPropertiesByLeadId(tenantId, leadId)
getPropertiesByProject(tenantId, projectId)
getProperty(tenantId, propertyId)
updateProperty(tenantId, propertyId, data)
deleteProperty(tenantId, propertyId)
searchProperties(tenantId, query, filters)
getPropertiesWithDetails(tenantId)
incrementPropertyViews(tenantId, propertyId)
```

### Property document functions

```js
createPropertyDocument(tenantId, propertyId, data)
getPropertyDocuments(tenantId, propertyId)
deletePropertyDocument(tenantId, propertyId, documentId)
```

### Property agreement functions

```js
createPropertyAgreement(tenantId, propertyId, data)
getPropertyAgreements(tenantId, propertyId)
updatePropertyAgreement(tenantId, propertyId, agreementId, data)
```

### Property verification functions

```js
createPropertyVerification(tenantId, propertyId, data)
getPropertyVerifications(tenantId, propertyId)
updatePropertyVerification(tenantId, propertyId, verificationId, data)
```

### Owner functions (for cross-entity enrichment)

```js
getOwner(tenantId, ownerId)
getOwners(tenantId, filters)
```

### Customer functions (for tenant enrichment)

```js
getCustomer(tenantId, customerId)
getCustomers(tenantId, filters)
```

---

## Tool Schemas to Add or Update

### Missing tool schemas in `skillInvoker.js`

The following tools exist in the backend but are NOT exposed in `TOOL_SCHEMAS`:

```js
// Property sub-resource operations
get_property_agreements: {
  required: ['propertyId'],
  types: { propertyId: 'string' },
  description: 'Get all rental agreements for a property.',
},
create_property_agreement: {
  required: ['propertyId', 'startDate', 'endDate', 'monthlyRent'],
  types: {
    propertyId: 'string',
    startDate: 'string',
    endDate: 'string',
    monthlyRent: 'number',
    securityDeposit: 'number',
    status: 'string',           // pending | done
    documentName: 'string',
    notes: 'string',
  },
  description: 'Create a rental agreement for a property.',
},
update_property_agreement: {
  required: ['propertyId', 'agreementId'],
  types: {
    propertyId: 'string',
    agreementId: 'string',
    startDate: 'string',
    endDate: 'string',
    monthlyRent: 'number',
    securityDeposit: 'number',
    status: 'string',
    documentName: 'string',
    notes: 'string',
  },
  description: 'Update a property agreement.',
},
get_property_verifications: {
  required: ['propertyId'],
  types: { propertyId: 'string' },
  description: 'Get all verification records for a property.',
},
create_property_verification: {
  required: ['propertyId', 'verificationType'],
  types: {
    propertyId: 'string',
    verificationType: 'string', // police | background | other
    status: 'string',             // pending | done | not_done
    verificationDate: 'string',
    expiryDate: 'string',
    documentName: 'string',
    notes: 'string',
  },
  description: 'Create a verification record for a property.',
},
update_property_verification: {
  required: ['propertyId', 'verificationId'],
  types: {
    propertyId: 'string',
    verificationId: 'string',
    verificationType: 'string',
    status: 'string',
    verificationDate: 'string',
    expiryDate: 'string',
    documentName: 'string',
    notes: 'string',
  },
  description: 'Update a property verification.',
},

// Property lookup tools
get_properties_by_status: {
  required: ['status'],
  types: { status: 'string' },
  description: 'Get all properties with a specific status.',
},
get_properties_by_owner: {
  required: ['ownerId'],
  types: { ownerId: 'string' },
  description: 'Get all properties owned by a specific owner.',
},
get_properties_by_lead: {
  required: ['leadId'],
  types: { leadId: 'string' },
  description: 'Get all properties converted from a specific lead.',
},
get_properties_by_project: {
  required: ['projectId'],
  types: { projectId: 'string' },
  description: 'Get all properties linked to a real-estate project.',
},
get_properties_with_details: {
  required: [],
  types: { limit: 'number', offset: 'number' },
  description: 'Get all properties enriched with owner and tenant details.',
},

// Utility
increment_property_views: {
  required: ['propertyId'],
  types: { propertyId: 'string' },
  description: 'Increment the view counter for a property listing.',
},
```

### Tool schemas to update

```js
// get_properties: add all filter parameters + pagination + sort + responseMode
get_properties: {
  required: [],
  types: {
    status: 'string',              // available | for-sale | for-rent | rented | sold | on-hold | out-of-stock
    listingStatus: 'string',       // active | inactive
    propertyType: 'string',        // apartment | house | villa | office
    bhk: 'string',
    furnishing: 'string',          // furnished | semi-furnished | unfurnished
    area: 'string',
    city: 'string',
    ownerId: 'string',
    search: 'string',
    minRent: 'number',
    maxRent: 'number',
    minSalePrice: 'number',
    maxSalePrice: 'number',
    createdFrom: 'string',
    createdTo: 'string',
    tag: 'string',
    featured: 'boolean',
    verified: 'boolean',
    sortBy: 'string',              // createdAt | title | area | city | status | propertyType | rent | salePrice | updatedAt
    sortOrder: 'string',           // asc | desc
    limit: 'number',
    offset: 'number',
    responseMode: 'string',        // summary | compact | details | full
  },
  description: 'List properties with filters. Supports status, listing status, property type, BHK, furnishing, area, city, rent/sale price range, date range, tags, sorting, and pagination.',
},

// search_properties: currently maps to getProperties via query; schema should support backend free-text search
search_properties: {
  required: [],
  types: {
    query: 'string',
    status: 'string',
    propertyType: 'string',
    bhk: 'string',
    furnishing: 'string',
    minRent: 'number',
    maxRent: 'number',
  },
  description: 'Free-text search properties by title, area, building name, address, owner name, owner phone, or tenant name.',
},

// get_property: add include flags and full mode
get_property: {
  required: ['propertyId'],
  types: {
    propertyId: 'string',
    includeDocuments: 'boolean',      // default: false
    includeAgreements: 'boolean',     // default: false
    includeVerifications: 'boolean',  // default: false
    includeOwner: 'boolean',          // default: true
    full: 'boolean',                  // default: false
  },
},

// create_property: add full field set
// Current schema in skillInvoker.js only requires title + propertyType.
// The backend requires only title, but supports the full field set below.
create_property: {
  required: ['title', 'propertyType'],
  types: {
    title: 'string',
    description: 'string',
    propertyType: 'string',        // apartment | house | villa | office
    bhk: 'number',
    area: 'string',
    city: 'string',
    address: 'string',
    flatNumber: 'string',
    floor: 'string',
    buildingName: 'string',
    carpetArea: 'number',
    builtUpArea: 'number',
    furnishing: 'string',          // furnished | semi-furnished | unfurnished
    facing: 'string',            // north | south | east | west
    amenities: 'array',
    status: 'string',
    listingStatus: 'string',
    ownerId: 'string',
    ownerName: 'string',
    ownerPhone: 'string',
    expectedBrokerage: 'number',
    rentAmount: 'number',
    depositAmount: 'number',
    salePrice: 'number',
    availableFrom: 'string',
    featured: 'boolean',
    verified: 'boolean',
    latitude: 'number',
    longitude: 'number',
    images: 'array',
    videos: 'array',
    convertedFromLeadId: 'string',
  },
  description: 'Create a new property. Title and propertyType are required. Owner is optional.',
},

// update_property: add full field set
update_property: {
  required: ['propertyId'],
  types: {
    propertyId: 'string',
    title: 'string',
    description: 'string',
    propertyType: 'string',
    bhk: 'number',
    area: 'string',
    city: 'string',
    address: 'string',
    flatNumber: 'string',
    floor: 'string',
    buildingName: 'string',
    carpetArea: 'number',
    builtUpArea: 'number',
    furnishing: 'string',
    facing: 'string',
    amenities: 'array',
    status: 'string',
    listingStatus: 'string',
    ownerId: 'string',
    ownerName: 'string',
    ownerPhone: 'string',
    expectedBrokerage: 'number',
    rentAmount: 'number',
    depositAmount: 'number',
    salePrice: 'number',
    availableFrom: 'string',
    featured: 'boolean',
    verified: 'boolean',
    latitude: 'number',
    longitude: 'number',
    images: 'array',
    videos: 'array',
  },
  description: 'Update a property. Property ID is required. Status transitions are validated.',
},

// delete_property: keep current schema
// delete_property: { required: ['propertyId'], types: { propertyId: 'string' }, description: 'Delete a property. Cannot delete sold properties or properties with active tenants.' }

// get_property_documents: keep current schema
// get_property_documents: { required: ['propertyId'], types: { propertyId: 'string' }, description: 'Get all documents attached to a property.' }

// create_property_document: update to match backend
// Current skillInvoker.js maps title/url, but the backend expects fileName/s3Key.
create_property_document: {
  required: ['propertyId', 'documentType', 'fileName', 's3Key'],
  types: {
    propertyId: 'string',
    documentType: 'string',   // PHOTO | VIDEO | AGREEMENT | VERIFICATION | OTHER
    fileName: 'string',
    s3Key: 'string',
    fileSize: 'number',
    mimeType: 'string',
    description: 'string',
  },
  description: 'Attach a document to a property.',
},

// delete_property_document: keep current schema
// delete_property_document: { required: ['propertyId', 'documentId'], types: { propertyId: 'string', documentId: 'string' }, description: 'Delete a document from a property.' }
```

---

## Complete AI DTO Views

### 1. `searchResults` (already designed)

See `PROPERTY_AI_DTO_CONTRACT.md`.

### 2. `details` (already designed)

See `PROPERTY_AI_DTO_CONTRACT.md`.

### 3. `createConfirmation` (already designed)

See `PROPERTY_AI_DTO_CONTRACT.md`.

### 4. `updateConfirmation` (already designed)

See `PROPERTY_AI_DTO_CONTRACT.md`.

### 5. `full` (already designed)

See `PROPERTY_AI_DTO_CONTRACT.md`.

### 6. `deleteConfirmation` (already designed)

See above.

### 7. `documentList` (already designed)

See above.

### 8. `documentCreateConfirmation` (already designed)

See above.

### 9. `documentDeleteConfirmation` (already designed)

See above.

### 10. `agreementList` (already designed)

See above.

### 11. `agreementCreateConfirmation` (already designed)

See above.

### 12. `agreementUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "agreement_updated"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "agreementId": "agr-abc123",
    "updatedFields": ["status"],
    "status": "done"
  }
}
```

### 13. `verificationList` (already designed)

See above.

### 14. `verificationCreateConfirmation` (already designed)

See above.

### 15. `verificationUpdateConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "verification_updated"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "verificationId": "ver-abc123",
    "updatedFields": ["status", "verificationDate"],
    "status": "done"
  }
}
```

### 16. `viewCountConfirmation` (NEW)

```json
{
  "metadata": {
    "action": "view_counted"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "views": 42
  }
}
```

---

## PropertyAIViewBuilder — Complete API

### Property views

```js
buildSearchResults(properties, pagination, options)
buildPropertyDetails(property, options)
buildCreateConfirmation(property)
buildUpdateConfirmation(property, updatedFields)
buildFullProperty(property)
buildDeleteConfirmation(property)
buildOwnerSummary(property)
buildRentalInfo(property)
buildSaleInfo(property)
buildViewCountConfirmation(property)
```

### Document views

```js
buildDocumentList(documents, pagination)
buildDocumentCreateConfirmation(property, document)
buildDocumentDeleteConfirmation(property, documentId)
```

### Agreement views

```js
buildAgreementList(agreements, pagination)
buildAgreementCreateConfirmation(property, agreement)
buildAgreementUpdateConfirmation(property, agreement, updatedFields)
```

### Verification views

```js
buildVerificationList(verifications, pagination)
buildVerificationCreateConfirmation(property, verification)
buildVerificationUpdateConfirmation(property, verification, updatedFields)
```

### Error DTOs

```js
buildPropertyNotFoundError(propertyId)
buildPropertyStatusError(property, attemptedStatus, reason)
buildTitleRequiredError()
buildDuplicatePropertyError(property)
buildEmptySearchResults()
buildOwnerRequiredError()
```

---

## PropertyService — Complete API

```js
// Property CRUD
getProperties(tenantId, filters, options)
searchProperties(tenantId, query, filters, options)
getProperty(tenantId, propertyId, options)
createProperty(tenantId, data)
updateProperty(tenantId, propertyId, data)
deleteProperty(tenantId, propertyId)

// Property lookup
getPropertiesByStatus(tenantId, status)
getPropertiesByOwner(tenantId, ownerId)
getPropertiesByLeadId(tenantId, leadId)
getPropertiesByProject(tenantId, projectId)
getPropertiesWithDetails(tenantId, options)

// Property views
incrementPropertyViews(tenantId, propertyId)

// Property documents
getPropertyDocuments(tenantId, propertyId)
createPropertyDocument(tenantId, propertyId, data)
deletePropertyDocument(tenantId, propertyId, documentId)

// Property agreements
getPropertyAgreements(tenantId, propertyId)
createPropertyAgreement(tenantId, propertyId, data)
updatePropertyAgreement(tenantId, propertyId, agreementId, data)

// Property verifications
getPropertyVerifications(tenantId, propertyId)
createPropertyVerification(tenantId, propertyId, data)
updatePropertyVerification(tenantId, propertyId, verificationId, data)
```

---

## Tool-to-View Mapping

| Tool | PropertyService method | View builder method | AI view |
|---|---|---|---|
| `create_property` | `createProperty` | `buildCreateConfirmation` | `createConfirmation` |
| `get_property` | `getProperty` | `buildPropertyDetails` or `buildFullProperty` | `details` / `full` |
| `get_properties` | `getProperties` | `buildSearchResults` | `searchResults` |
| `search_properties` | `searchProperties` | `buildSearchResults` | `searchResults` |
| `update_property` | `updateProperty` | `buildUpdateConfirmation` | `updateConfirmation` |
| `delete_property` | `deleteProperty` | `buildDeleteConfirmation` | `deleteConfirmation` |
| `increment_property_views` | `incrementPropertyViews` | `buildViewCountConfirmation` | `viewCountConfirmation` |
| `get_property_documents` | `getPropertyDocuments` | `buildDocumentList` | `documentList` |
| `create_property_document` | `createPropertyDocument` | `buildDocumentCreateConfirmation` | `documentCreateConfirmation` |
| `delete_property_document` | `deletePropertyDocument` | `buildDocumentDeleteConfirmation` | `documentDeleteConfirmation` |
| `get_property_agreements` | `getPropertyAgreements` | `buildAgreementList` | `agreementList` |
| `create_property_agreement` | `createPropertyAgreement` | `buildAgreementCreateConfirmation` | `agreementCreateConfirmation` |
| `update_property_agreement` | `updatePropertyAgreement` | `buildAgreementUpdateConfirmation` | `agreementUpdateConfirmation` |
| `get_property_verifications` | `getPropertyVerifications` | `buildVerificationList` | `verificationList` |
| `create_property_verification` | `createPropertyVerification` | `buildVerificationCreateConfirmation` | `verificationCreateConfirmation` |
| `update_property_verification` | `updatePropertyVerification` | `buildVerificationUpdateConfirmation` | `verificationUpdateConfirmation` |
| `get_properties_by_status` | `getPropertiesByStatus` | `buildSearchResults` | `searchResults` |
| `get_properties_by_owner` | `getPropertiesByOwner` | `buildSearchResults` | `searchResults` |
| `get_properties_by_lead` | `getPropertiesByLeadId` | `buildSearchResults` | `searchResults` |
| `get_properties_by_project` | `getPropertiesByProject` | `buildSearchResults` | `searchResults` |
| `get_properties_with_details` | `getPropertiesWithDetails` | `buildSearchResults` | `searchResults` |

---

## Error DTOs

### Property not found

```json
{
  "metadata": {
    "error": "property_not_found",
    "message": "Property not found"
  },
  "data": null
}
```

### Property status error

```json
{
  "metadata": {
    "error": "property_status_error",
    "message": "Invalid property status transition"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "currentStatus": "rented",
    "attemptedStatus": "sold",
    "reason": "Cannot transition from rented to sold"
  }
}
```

### Title required

```json
{
  "metadata": {
    "error": "title_required",
    "message": "Title is required to create a property"
  },
  "data": null
}
```

### Duplicate property

```json
{
  "metadata": {
    "error": "duplicate_property",
    "message": "A property with the same title and address already exists"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "address": "12, Hill Road, Bandra West"
  }
}
```

### Empty search

```json
{
  "metadata": {
    "total": 0,
    "hasMore": false
  },
  "data": []
}
```

### Owner required

```json
{
  "metadata": {
    "error": "owner_required",
    "message": "Owner ID is required for this operation"
  },
  "data": null
}
```

---

## File Structure

```
server/
  services/
    propertyService.js              # Property business logic
  normalizers/
    propertyNormalizer.js           # Property normalization
  aiViewBuilders/
    propertyAIViewBuilder.js        # Property AI DTOs
    ownerAIViewBuilder.js           # Owner AI DTOs (shared)
    meetingAIViewBuilder.js         # Meeting AI DTOs (shared)
    metricsAIViewBuilder.js         # Metrics AI DTOs (shared)
  crmDynamodbService.js             # Untouched
  skillInvoker.js                   # Updated tool schemas + wiring
```

---

## Version

v1.1 — 2026-06-26
