# PropertyAIViewBuilder API

## Purpose

`PropertyAIViewBuilder` is a projection layer that transforms normalized property domain models into AI-friendly DTOs.

It covers **all property management operations**: CRUD, search, documents, agreements, verifications, owner linkage, and rich queries.

It does not contain business logic. It does not generate English text. It only decides which fields to expose for a given AI interaction.

For the complete operation inventory, see `COMPLETE_PROPERTY_MANAGEMENT.md`.

---

## Location

```
agency-app/api/aiViewBuilders/propertyAIViewBuilder.js
```

---

## Naming

We use `PropertyAIViewBuilder` instead of `PropertyViewBuilder` to make it explicit that this is for AI consumption only, not a universal presentation contract.

---

## API

### Core Method

```js
export function buildPropertyAIResponse({ view, property, properties, metadata, pagination }) {
  // ...
}
```

Parameters:
- `view` (string): One of `searchResults`, `details`, `createConfirmation`, `updateConfirmation`, `full`, `documentList`, `documentCreateConfirmation`, `documentDeleteConfirmation`, `agreementList`, `verificationList`, `propertyNotFoundError`, `propertyStatusError`, `titleRequiredError`, `emptySearchResults`.
- `property` (object): Single property domain model.
- `properties` (array): Array of property domain models.
- `metadata` (object): Additional context (pagination, action, updatedFields, documents, agreements, verifications).
- `pagination` (object): `{ total, page, pageSize, hasMore, nextCursor }`.

Returns:
- `{ metadata, data }` DTO.

---

### Explicit Helper Methods

```js
export function buildSearchResults(properties, pagination, options = {}) {
  // Returns searchResults DTO
}

export function buildPropertyDetails(property, options = {}) {
  // Returns details DTO
}

export function buildCreateConfirmation(property) {
  // Returns createConfirmation DTO
}

export function buildUpdateConfirmation(property, updatedFields) {
  // Returns updateConfirmation DTO
}

export function buildFullProperty(property) {
  // Returns full DTO
}

export function buildDocumentList(documents, pagination) {
  // Returns documentList DTO
}

export function buildDocumentCreateConfirmation(document) {
  // Returns documentCreateConfirmation DTO
}

export function buildDocumentDeleteConfirmation(document) {
  // Returns documentDeleteConfirmation DTO
}

export function buildAgreementList(agreements, pagination) {
  // Returns agreementList DTO
}

export function buildVerificationList(verifications, pagination) {
  // Returns verificationList DTO
}

export function buildPropertyNotFoundError(propertyId) {
  // Returns property not found error DTO
}

export function buildPropertyStatusError(property, message) {
  // Returns property status error DTO
}

export function buildTitleRequiredError(property) {
  // Returns title required error DTO
}

export function buildEmptySearchResults() {
  // Returns empty search results DTO
}
```

---

## Implementation Sketch

```js
import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';

export function buildSearchResults(properties, pagination, options = {}) {
  const { hasMore = false, nextCursor = null } = pagination || {};
  const pageSize = pagination?.pageSize || properties?.length || 0;

  return buildEnvelope(
    properties.map(property => ({
      propertyId: property.propertyId,
      title: property.title,
      propertyType: property.propertyType || null,
      bhk: property.bhk || null,
      area: property.area || null,
      city: property.city || null,
      status: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
      price: formatPrice(property),
      rent: formatRent(property),
      isRented: property.status === 'rented',
      isSold: property.status === 'sold',
      isListed: property.listingStatus === 'active',
      hasImages: hasImages(property),
      imageCount: imageCount(property),
      ownerName: deriveOwnerName(property),
    })),
    {
      total: pagination?.total ?? properties.length,
      pageSize,
      hasMore,
      ...(nextCursor && { nextCursor }),
    }
  );
}

export function buildPropertyDetails(property, options = {}) {
  const { includeDocuments = true, maxDocuments = 5, includeAgreements = true, maxAgreements = 5, includeVerifications = true, maxVerifications = 5 } = options;

  const documents = property.documents || [];
  const agreements = property.agreements || [];
  const verifications = property.verifications || [];

  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title,
      description: property.description || null,
      propertyType: property.propertyType || null,
      bhk: property.bhk || null,
      area: property.area || null,
      city: property.city || null,
      address: property.address || null,
      flatNumber: property.flatNumber || null,
      floor: property.floor || null,
      buildingName: property.buildingName || null,
      carpetArea: property.carpetArea || null,
      builtUpArea: property.builtUpArea || null,
      furnishing: property.furnishing || null,
      facing: property.facing || null,
      amenities: formatAmenities(property.amenities),
      status: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
      availableFrom: formatDate(property.availableFrom),
      featured: property.featured || false,
      verified: property.verified || false,
      views: property.views || 0,
      owner: buildOwnerSummary(property),
      price: formatPrice(property),
      rent: formatRent(property),
      expectedBrokerage: formatMoney(property.expectedBrokerage),
      saleInfo: buildSaleInfo(property.saleInfo),
      rentalInfo: buildRentalInfo(property.rentalInfo),
      rentalHistoryCount: (property.rentalHistory || []).length,
      isRented: property.status === 'rented',
      isSold: property.status === 'sold',
      isListed: property.listingStatus === 'active',
      hasImages: hasImages(property),
      imageCount: imageCount(property),
      hasVideos: hasVideos(property),
      videoCount: videoCount(property),
      documentCount: documents.length,
      documents: includeDocuments ? documents.slice(0, maxDocuments).map(buildDocument) : undefined,
      agreements: includeAgreements ? agreements.slice(0, maxAgreements).map(buildAgreement) : undefined,
      verifications: includeVerifications ? verifications.slice(0, maxVerifications).map(buildVerification) : undefined,
      createdAt: formatDate(property.createdAt),
      updatedAt: formatDate(property.updatedAt),
    },
    {
      documents: includeDocuments ? buildPaginationMetadata(documents.length, Math.min(maxDocuments, documents.length), documents.length > maxDocuments) : null,
      agreements: includeAgreements ? buildPaginationMetadata(agreements.length, Math.min(maxAgreements, agreements.length), agreements.length > maxAgreements) : null,
      verifications: includeVerifications ? buildPaginationMetadata(verifications.length, Math.min(maxVerifications, verifications.length), verifications.length > maxVerifications) : null,
    }
  );
}

export function buildCreateConfirmation(property) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title,
      propertyType: property.propertyType || null,
      bhk: property.bhk || null,
      area: property.area || null,
      city: property.city || null,
      status: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
      ownerName: deriveOwnerName(property),
      price: formatPrice(property),
      rent: formatRent(property),
      createdAt: formatDate(property.createdAt),
    },
    { action: 'created' }
  );
}

export function buildUpdateConfirmation(property, updatedFields) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title,
      status: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
      price: formatPrice(property),
      rent: formatRent(property),
      updatedAt: formatDate(property.updatedAt),
    },
    {
      action: 'updated',
      updatedFields: Object.keys(updatedFields || {}),
    }
  );
}

export function buildFullProperty(property) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title,
      description: property.description || null,
      propertyType: property.propertyType || null,
      bhk: property.bhk || null,
      area: property.area || null,
      city: property.city || null,
      address: property.address || null,
      flatNumber: property.flatNumber || null,
      floor: property.floor || null,
      buildingName: property.buildingName || null,
      carpetArea: property.carpetArea || null,
      builtUpArea: property.builtUpArea || null,
      furnishing: property.furnishing || null,
      facing: property.facing || null,
      amenities: formatAmenities(property.amenities),
      status: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
      availableFrom: formatDate(property.availableFrom),
      featured: property.featured || false,
      verified: property.verified || false,
      views: property.views || 0,
      owner: buildOwnerSummary(property),
      convertedFromLeadId: property.convertedFromLeadId || null,
      price: formatPrice(property),
      rent: formatRent(property),
      expectedBrokerage: formatMoney(property.expectedBrokerage),
      saleInfo: buildSaleInfo(property.saleInfo),
      rentalInfo: buildRentalInfo(property.rentalInfo),
      rentalHistory: property.rentalHistory || [],
      rentalHistoryCount: (property.rentalHistory || []).length,
      ownershipHistory: property.ownershipHistory || [],
      documents: (property.documents || []).map(buildDocument),
      agreements: (property.agreements || []).map(buildAgreement),
      verifications: (property.verifications || []).map(buildVerification),
      images: property.images || [],
      videos: property.videos || [],
      latitude: property.latitude || null,
      longitude: property.longitude || null,
      titleDeedUrl: property.titleDeedUrl || null,
      occupancyCertificateUrl: property.occupancyCertificateUrl || null,
      propertyTaxReceiptUrl: property.propertyTaxReceiptUrl || null,
      createdAt: formatDate(property.createdAt),
      updatedAt: formatDate(property.updatedAt),
    },
    { view: 'full' }
  );
}
```

---

## Helper Functions

### `formatDate(value)`

```js
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
```

### `formatMoney(value)`

Uses compact Indian currency formatting.

```js
function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;

  const crore = 10000000;
  const lakh = 100000;
  const thousand = 1000;

  if (Math.abs(num) >= crore) return `₹${(num / crore).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (Math.abs(num) >= lakh) return `₹${(num / lakh).toFixed(2).replace(/\.?0+$/, '')}L`;
  if (Math.abs(num) >= thousand) return `₹${(num / thousand).toFixed(1).replace(/\.?0+$/, '')}k`;
  return `₹${num.toLocaleString('en-IN')}`;
}
```

### `derivePropertyStatus(property)`

Normalizes the property lifecycle status.

```js
function derivePropertyStatus(property) {
  return property.status || 'available';
}
```

### `deriveListingStatus(property)`

Normalizes the property marketing status.

```js
function deriveListingStatus(property) {
  return property.listingStatus || 'inactive';
}
```

### `deriveOwnerName(property)`

Returns the owner name from the owner snapshot or owner summary.

```js
function deriveOwnerName(property) {
  if (property.ownerSnapshot?.name) return property.ownerSnapshot.name;
  if (property.owner?.name) return property.owner.name;
  if (property.ownerName) return property.ownerName;
  return null;
}
```

### `buildOwnerSummary(property)`

Builds a compact owner summary for property details and full views.

```js
function buildOwnerSummary(property) {
  if (!property.ownerId && !property.owner) return null;

  const owner = property.owner || property.ownerSnapshot || {};
  return {
    ownerId: property.ownerId || owner.ownerId || null,
    name: owner.name || property.ownerName || null,
    phone: owner.phone || property.ownerPhone || null,
  };
}
```

### `buildRentalInfo(rentalInfo)`

Builds a rental information block for rental properties.

```js
function buildRentalInfo(rentalInfo) {
  if (!rentalInfo) return null;

  return {
    expectedRent: formatMoney(rentalInfo.expectedRent),
    currentRent: formatMoney(rentalInfo.currentRent),
    currentTenantId: rentalInfo.currentTenantId || null,
    leaseStartDate: formatDate(rentalInfo.leaseStartDate),
    leaseEndDate: formatDate(rentalInfo.leaseEndDate),
    securityDeposit: formatMoney(rentalInfo.securityDeposit),
  };
}
```

### `buildSaleInfo(saleInfo)`

Builds a sale information block for sale properties.

```js
function buildSaleInfo(saleInfo) {
  if (!saleInfo) {
    return {
      listedPrice: null,
      soldPrice: null,
      soldDate: null,
      soldToBuyerId: null,
    };
  }

  return {
    listedPrice: formatMoney(saleInfo.listedPrice),
    soldPrice: formatMoney(saleInfo.soldPrice),
    soldDate: formatDate(saleInfo.soldDate),
    soldToBuyerId: saleInfo.soldToBuyerId || null,
  };
}
```

### `formatPrice(property)`

Returns the formatted sale price, preferring sold price when sold.

```js
function formatPrice(property) {
  const saleInfo = property.saleInfo || {};
  if (property.status === 'sold') return formatMoney(saleInfo.soldPrice);
  return formatMoney(saleInfo.listedPrice);
}
```

### `formatRent(property)`

Returns the formatted rent, preferring current rent when rented.

```js
function formatRent(property) {
  const rentalInfo = property.rentalInfo || {};
  if (property.status === 'rented') return formatMoney(rentalInfo.currentRent);
  return formatMoney(rentalInfo.expectedRent);
}
```

### `formatAmenities(amenities)`

```js
function formatAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];
  return amenities.map(a => String(a).toLowerCase().trim()).filter(Boolean);
}
```

### `hasImages(property)` / `imageCount(property)`

```js
function hasImages(property) {
  return Array.isArray(property.images) && property.images.length > 0;
}

function imageCount(property) {
  return Array.isArray(property.images) ? property.images.length : 0;
}
```

### `hasVideos(property)` / `videoCount(property)`

```js
function hasVideos(property) {
  return Array.isArray(property.videos) && property.videos.length > 0;
}

function videoCount(property) {
  return Array.isArray(property.videos) ? property.videos.length : 0;
}
```

### `buildDocument(document)`

```js
function buildDocument(document) {
  return {
    documentId: document.documentId,
    documentType: document.documentType,
    fileName: document.fileName,
    fileSize: document.fileSize || 0,
    mimeType: document.mimeType || null,
    description: document.description || null,
    createdAt: formatDate(document.createdAt),
  };
}
```

### `buildAgreement(agreement)`

```js
function buildAgreement(agreement) {
  return {
    agreementId: agreement.agreementId,
    startDate: formatDate(agreement.startDate),
    endDate: formatDate(agreement.endDate),
    monthlyRent: formatMoney(agreement.monthlyRent),
    securityDeposit: formatMoney(agreement.securityDeposit),
    status: agreement.status || 'pending',
  };
}
```

### `buildVerification(verification)`

```js
function buildVerification(verification) {
  return {
    verificationId: verification.verificationId,
    verificationType: verification.verificationType || 'police',
    status: verification.status || 'pending',
    verificationDate: formatDate(verification.verificationDate),
    expiryDate: formatDate(verification.expiryDate),
  };
}
```

---

## Internal Field Removal

Before any property reaches the view builder, the following should be removed:

```js
const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId',
  'titleDeedS3Key', 'occupancyCertificateS3Key', 'propertyTaxReceiptS3Key',
];
```

This can be done in `PropertyNormalizer` or directly at the boundary of `PropertyAIViewBuilder`.

---

## Tests

The view builder should be heavily unit tested. Each view should have tests for:

- Property with full sale details
- Property with full rental details
- Property without owner (unassigned)
- Property with images and videos
- Property with documents, agreements, and verifications
- Property with empty/legacy rental and sale fields
- Internal fields removed
- Money formatted correctly
- Status and listing status derived correctly
- Owner summary derived correctly
- Pagination metadata passed through
- Document/agreement/verification lists limited correctly
- Error DTOs (property not found, status error, title required, empty search)

---

## Additional View Builders

The following methods cover the remaining property management operations. Full DTO examples are in `PROPERTY_AI_DTO_CONTRACT.md` and `COMPLETE_PROPERTY_MANAGEMENT.md`.

### Document views

```js
export function buildDocumentList(documents, pagination = {}) {
  return buildEnvelope(
    documents.map(buildDocument),
    {
      total: pagination.total ?? documents.length,
      hasMore: pagination.hasMore ?? false,
      ...(pagination.nextCursor && { nextCursor: pagination.nextCursor }),
    }
  );
}

export function buildDocumentCreateConfirmation(document) {
  return buildEnvelope(
    {
      propertyId: document.propertyId,
      documentId: document.documentId,
      documentType: document.documentType,
      fileName: document.fileName,
      createdAt: formatDate(document.createdAt),
    },
    { action: 'document_added' }
  );
}

export function buildDocumentDeleteConfirmation(document) {
  return buildEnvelope(
    {
      propertyId: document.propertyId,
      documentId: document.documentId,
    },
    { action: 'document_deleted' }
  );
}
```

### Agreement views

```js
export function buildAgreementList(agreements, pagination = {}) {
  return buildEnvelope(
    agreements.map(buildAgreement),
    {
      total: pagination.total ?? agreements.length,
      hasMore: pagination.hasMore ?? false,
      ...(pagination.nextCursor && { nextCursor: pagination.nextCursor }),
    }
  );
}
```

### Verification views

```js
export function buildVerificationList(verifications, pagination = {}) {
  return buildEnvelope(
    verifications.map(buildVerification),
    {
      total: pagination.total ?? verifications.length,
      hasMore: pagination.hasMore ?? false,
      ...(pagination.nextCursor && { nextCursor: pagination.nextCursor }),
    }
  );
}
```

### Error DTOs

```js
export function buildPropertyNotFoundError(propertyId) {
  return buildEnvelope(null, {
    error: 'property_not_found',
    message: 'Property not found',
    propertyId,
  });
}

export function buildPropertyStatusError(property, message) {
  return buildEnvelope(
    {
      propertyId: property?.propertyId || null,
      title: property?.title || null,
      currentStatus: derivePropertyStatus(property),
      listingStatus: deriveListingStatus(property),
    },
    {
      error: 'property_status_error',
      message: message || 'Invalid property status',
    }
  );
}

export function buildTitleRequiredError(property) {
  return buildEnvelope(
    {
      propertyId: property?.propertyId || null,
      title: property?.title || null,
    },
    {
      error: 'title_required',
      message: 'Title is required to create a property',
    }
  );
}

export function buildEmptySearchResults() {
  return buildEnvelope([], {
    total: 0,
    hasMore: false,
  });
}
```

---

## Default Export

All exported functions should be bundled on the default export for convenience.

```js
export default {
  buildPropertyAIResponse,
  buildSearchResults,
  buildPropertyDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildFullProperty,
  buildDocumentList,
  buildDocumentCreateConfirmation,
  buildDocumentDeleteConfirmation,
  buildAgreementList,
  buildVerificationList,
  buildPropertyNotFoundError,
  buildPropertyStatusError,
  buildTitleRequiredError,
  buildEmptySearchResults,
};
```

---

## Version

v1.0 — 2026-06-26
