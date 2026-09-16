# Property AI DTO Contract

## Purpose

This document defines the data contract between the AI agent and the backend for **all property-related operations**: CRUD, documents, agreements, verifications, search, filters, and owner/lead linkage.

For the complete operation inventory and tool-to-view mapping, see `COMPLETE_PROPERTY_MANAGEMENT.md`.

The goal is to replace raw DynamoDB records with clean, purpose-built data so the LLM can respond naturally without being exposed to internal storage fields.

---

## Standard Envelope

All AI DTOs share a simple envelope:

```json
{
  "metadata": {},
  "data": {}
}
```

Rules:
- `data` is an **array** for collections.
- `data` is an **object** for singletons.
- The tool name (e.g., `search_properties`, `get_property`) carries the entity and view semantics.

---

## Formatting Helpers

All fields in the DTOs below are produced by backend helpers before they reach the AI. Never expose raw DynamoDB values directly.

| Helper | Purpose | Example |
|---|---|---|
| `formatMoney(value)` | Compact Indian currency | `4500000` → `₹4.5 Cr`, `45000` → `₹45k` |
| `formatDate(isoString)` | Human-readable date | `2026-06-25T00:00:00.000Z` → `2026-06-25` |
| `formatDateTime(isoString)` | Human-readable date-time | `2026-06-25T14:30:00.000Z` → `2026-06-25 14:30` |

Money fields that must be formatted:
- `price`, `rent`, `expectedBrokerage`
- `saleInfo.listedPrice`, `saleInfo.soldPrice`
- `rentalInfo.expectedRent`, `rentalInfo.currentRent`, `rentalInfo.securityDeposit`
- `agreements.monthlyRent`, `agreements.securityDeposit`
- `documents` do not contain money values

Date fields that must be formatted:
- `availableFrom`, `createdAt`, `updatedAt`
- `saleInfo.soldDate`
- `rentalInfo.leaseStartDate`, `rentalInfo.leaseEndDate`
- `agreements.startDate`, `agreements.endDate`
- `verifications.verificationDate`, `verifications.expiryDate`
- `documents.createdAt`

---

## Views

### 1. `searchResults`

Used when returning a list of properties from `search_properties`, `get_properties`, `get_properties_by_owner`, `get_properties_by_status`, `get_properties_by_lead`, or `get_properties_with_details`.

```json
{
  "metadata": {
    "total": 24,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  },
  "data": [
    {
      "propertyId": "prop-abc123",
      "title": "3BHK Apartment in Bandra West",
      "propertyType": "apartment",
      "bhk": 3,
      "area": "Bandra West",
      "city": "Mumbai",
      "status": "for-sale",
      "listingStatus": "active",
      "listingType": "sale",
      "price": "₹4.5 Cr",
      "rent": null,
      "isRented": false,
      "isSold": false,
      "isListed": true,
      "hasImages": true,
      "imageCount": 5,
      "ownerName": "Rajesh Kumar"
    },
    {
      "propertyId": "prop-def456",
      "title": "2BHK Flat in Andheri East",
      "propertyType": "apartment",
      "bhk": 2,
      "area": "Andheri East",
      "city": "Mumbai",
      "status": "rented",
      "listingStatus": "active",
      "listingType": "rent",
      "price": null,
      "rent": "₹45k",
      "isRented": true,
      "isSold": false,
      "isListed": true,
      "hasImages": false,
      "imageCount": 0,
      "ownerName": "Priya Sharma"
    }
  ]
}
```

**Fields to expose:**
| Field | Source | Reason |
|---|---|---|
| `propertyId` | `property.propertyId` | Reference (allowed in search results) |
| `title` | `property.title` | Identification |
| `propertyType` | `property.propertyType` | Type filter |
| `bhk` | `property.bhk` | Configuration filter |
| `area` | `property.area` | Location |
| `city` | `property.city` | City |
| `status` | `property.status` | Lifecycle state |
| `listingStatus` | `property.listingStatus` | Marketing state |
| `listingType` | Derived from `status` | Quick category: `sale`, `rent`, or `none` |
| `price` | `saleInfo.listedPrice` or `saleInfo.soldPrice` | Sale value |
| `rent` | `rentalInfo.expectedRent` or `rentalInfo.currentRent` | Rental value |
| `isRented` | Derived from `status` | Quick state |
| `isSold` | Derived from `status` | Quick state |
| `isListed` | Derived from `listingStatus` | Marketing visibility |
| `hasImages` | Derived from `images` | Media presence |
| `imageCount` | Derived from `images` | Media count |
| `ownerName` | `ownerSnapshot.name` or `owner.name` | Owner identification |

**Fields to hide:**
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`
- `ownerId`, `ownerPhone`, `ownerSnapshot` (use summarized `ownerName` instead)
- `convertedFromLeadId`
- `tenantCustomerId`, `tenantMoveInDate`, `tenureMonths`
- S3 keys: `titleDeedS3Key`, `occupancyCertificateS3Key`, `propertyTaxReceiptS3Key`
- Internal `rentAmount`, `depositAmount`, `salePrice`, `brokerageAmount` (use formatted values)
- Raw `rentalHistory`, `ownershipHistory`
- `latitude`, `longitude` (unless `full` view)

---

### 2. `details`

Used when returning a single property from `get_property` or when the user asks for details.

```json
{
  "metadata": {
    "documents": {
      "total": 4,
      "shown": 4,
      "hasMore": false
    },
    "agreements": {
      "total": 1,
      "shown": 1,
      "hasMore": false
    },
    "verifications": {
      "total": 1,
      "shown": 1,
      "hasMore": false
    }
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "description": "Spacious 3BHK with sea view",
    "propertyType": "apartment",
    "bhk": 3,
    "area": "Bandra West",
    "city": "Mumbai",
    "address": "12, Hill Road, Bandra West",
    "flatNumber": "12A",
    "floor": "7",
    "buildingName": "Ocean View",
    "carpetArea": 1200,
    "builtUpArea": 1450,
    "furnishing": "semi-furnished",
    "facing": "west",
    "amenities": ["lift", "parking", "gym"],
    "status": "for-sale",
    "listingStatus": "active",
    "listingType": "sale",
    "availableFrom": "2026-07-01",
    "featured": true,
    "verified": true,
    "views": 142,
    "owner": {
      "ownerId": "owner-abc123",
      "name": "Rajesh Kumar",
      "phone": "9876543210"
    },
    "price": "₹4.5 Cr",
    "rent": null,
    "expectedBrokerage": "₹4.5 L",
    "saleInfo": {
      "listedPrice": "₹4.5 Cr",
      "soldPrice": null,
      "soldDate": null,
      "soldToBuyerId": null
    },
    "rentalInfo": null,
    "rentalHistoryCount": 0,
    "isRented": false,
    "isSold": false,
    "isListed": true,
    "hasImages": true,
    "imageCount": 5,
    "hasVideos": false,
    "videoCount": 0,
    "documentCount": 4,
    "documents": [
      {
        "documentId": "doc-abc123",
        "documentType": "AGREEMENT",
        "fileName": "rental_agreement.pdf",
        "fileSize": 1024000,
        "mimeType": "application/pdf",
        "description": "Rental agreement 2026",
        "documentUrl": "https://cdn.example.com/doc-abc123",
        "createdAt": "2026-06-25"
      }
    ],
    "agreements": [
      {
        "agreementId": "agr-abc123",
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "monthlyRent": "₹50k",
        "securityDeposit": "₹1 L",
        "status": "done",
        "documentUrl": "https://cdn.example.com/agr-abc123",
        "notes": "12-month lease"
      }
    ],
    "verifications": [
      {
        "verificationId": "ver-abc123",
        "verificationType": "police",
        "status": "done",
        "verificationDate": "2026-06-20",
        "expiryDate": "2027-06-20",
        "documentUrl": "https://cdn.example.com/ver-abc123",
        "notes": "Tenant verification complete"
      }
    ],
    "createdAt": "2026-06-24",
    "updatedAt": "2026-06-25"
  }
}
```

**Fields to expose:**
| Field | Source | Reason |
|---|---|---|
| `propertyId` | `property.propertyId` | Reference |
| `title` | `property.title` | Identification |
| `description` | `property.description` | Marketing text |
| `propertyType` | `property.propertyType` | Type |
| `bhk` | `property.bhk` | Configuration |
| `area` | `property.area` | Location |
| `city` | `property.city` | City |
| `address` | `property.address` | Full address |
| `flatNumber` | `property.flatNumber` | Unit |
| `floor` | `property.floor` | Floor |
| `buildingName` | `property.buildingName` | Building |
| `carpetArea` | `property.carpetArea` | Carpet area (sq ft) |
| `builtUpArea` | `property.builtUpArea` | Built-up area (sq ft) |
| `furnishing` | `property.furnishing` | Furnishing status |
| `facing` | `property.facing` | Facing direction |
| `amenities` | `property.amenities` | Amenities list |
| `status` | `property.status` | Lifecycle state |
| `listingStatus` | `property.listingStatus` | Marketing state |
| `listingType` | Derived from `status` | sale / rent / none |
| `availableFrom` | `property.availableFrom` | Availability date |
| `featured` | `property.featured` | Featured flag |
| `verified` | `property.verified` | Verified flag |
| `views` | `property.views` | View count |
| `owner` | `ownerSnapshot` / `owner` | Owner summary |
| `price` | `saleInfo.listedPrice` or `saleInfo.soldPrice` | Sale value |
| `rent` | `rentalInfo.expectedRent` or `rentalInfo.currentRent` | Rental value |
| `expectedBrokerage` | `property.expectedBrokerage` | Brokerage expectation |
| `saleInfo` | `property.saleInfo` | Sale details |
| `rentalInfo` | `property.rentalInfo` | Rental details |
| `rentalHistoryCount` | Derived from `rentalHistory` | Past rentals count |
| `isRented` | Derived from `status` | Quick state |
| `isSold` | Derived from `status` | Quick state |
| `isListed` | Derived from `listingStatus` | Marketing visibility |
| `hasImages` | Derived from `images` | Media presence |
| `imageCount` | Derived from `images` | Media count |
| `hasVideos` | Derived from `videos` | Video presence |
| `videoCount` | Derived from `videos` | Video count |
| `documentCount` | Derived from `documents` | Document count |
| `documents` | `property` documents (limited) | Document previews |
| `agreements` | `property` agreements (limited) | Agreement previews |
| `verifications` | `property` verifications (limited) | Verification previews |
| `createdAt` | `property.createdAt` | Created date |
| `updatedAt` | `property.updatedAt` | Updated date |

**Fields to hide:**
- `PK`, `SK`, `GSI*`, `EntityType`, `tenantId`
- S3 keys: `titleDeedS3Key`, `occupancyCertificateS3Key`, `propertyTaxReceiptS3Key`
- `ownerSnapshot` (use normalized `owner` object)
- `convertedFromLeadId`, `tenantCustomerId`
- `tenantMoveInDate`, `tenureMonths`
- `latitude`, `longitude` (unless `full` view)

---

### 3. `full`

Used only when the user explicitly asks for everything. Rarely used in normal WhatsApp conversations.

```json
{
  "metadata": {
    "view": "full"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "description": "Spacious 3BHK with sea view",
    "propertyType": "apartment",
    "bhk": 3,
    "area": "Bandra West",
    "city": "Mumbai",
    "address": "12, Hill Road, Bandra West",
    "flatNumber": "12A",
    "floor": "7",
    "buildingName": "Ocean View",
    "carpetArea": 1200,
    "builtUpArea": 1450,
    "furnishing": "semi-furnished",
    "facing": "west",
    "amenities": ["lift", "parking", "gym"],
    "status": "for-sale",
    "listingStatus": "active",
    "listingType": "sale",
    "availableFrom": "2026-07-01",
    "featured": true,
    "verified": true,
    "views": 142,
    "owner": {
      "ownerId": "owner-abc123",
      "name": "Rajesh Kumar",
      "phone": "9876543210"
    },
    "convertedFromLeadId": null,
    "price": "₹4.5 Cr",
    "rent": null,
    "expectedBrokerage": "₹4.5 L",
    "saleInfo": {
      "listedPrice": "₹4.5 Cr",
      "soldPrice": null,
      "soldDate": null,
      "soldToBuyerId": null
    },
    "rentalInfo": null,
    "rentalHistory": [
      {
        "tenantId": "cust-abc123",
        "tenantName": "Sarah Gupta",
        "leaseStartDate": "2025-01-01",
        "leaseEndDate": "2025-12-31",
        "monthlyRent": "₹45k",
        "securityDeposit": "₹90k",
        "brokeragePaid": "₹45k"
      }
    ],
    "rentalHistoryCount": 1,
    "ownershipHistory": [
      {
        "ownerId": "owner-old123",
        "ownerName": "Previous Owner",
        "startDate": "2020-01-01",
        "endDate": "2024-12-31"
      }
    ],
    "isRented": false,
    "isSold": false,
    "isListed": true,
    "hasImages": true,
    "imageCount": 5,
    "hasVideos": false,
    "videoCount": 0,
    "images": [
      {
        "s3Key": "properties/prop-abc123/img1.jpg",
        "url": "https://cdn.example.com/img1.jpg",
        "description": "Living room"
      }
    ],
    "videos": [],
    "documents": [
      {
        "documentId": "doc-abc123",
        "documentType": "AGREEMENT",
        "fileName": "rental_agreement.pdf",
        "fileSize": 1024000,
        "mimeType": "application/pdf",
        "description": "Rental agreement 2026",
        "documentUrl": "https://cdn.example.com/doc-abc123",
        "createdAt": "2026-06-25"
      }
    ],
    "agreements": [
      {
        "agreementId": "agr-abc123",
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "monthlyRent": "₹50k",
        "securityDeposit": "₹1 L",
        "status": "done",
        "documentUrl": "https://cdn.example.com/agr-abc123",
        "documentName": "rental_agreement.pdf",
        "notes": "12-month lease"
      }
    ],
    "verifications": [
      {
        "verificationId": "ver-abc123",
        "verificationType": "police",
        "status": "done",
        "verificationDate": "2026-06-20",
        "expiryDate": "2027-06-20",
        "documentUrl": "https://cdn.example.com/ver-abc123",
        "documentName": "police_verification.pdf",
        "notes": "Tenant verification complete"
      }
    ],
    "latitude": 19.076,
    "longitude": 72.8777,
    "titleDeedUrl": "https://cdn.example.com/title-deed.pdf",
    "occupancyCertificateUrl": "https://cdn.example.com/occupancy-cert.pdf",
    "propertyTaxReceiptUrl": "https://cdn.example.com/tax-receipt.pdf",
    "createdAt": "2026-06-24",
    "updatedAt": "2026-06-25"
  }
}
```

In `full` view, S3 keys are still hidden; only pre-signed URLs are exposed.

---

### 4. `createConfirmation`

Used after `create_property` succeeds.

```json
{
  "metadata": {
    "action": "created"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "propertyType": "apartment",
    "bhk": 3,
    "area": "Bandra West",
    "city": "Mumbai",
    "status": "available",
    "listingStatus": "inactive",
    "listingType": "none",
    "ownerName": "Rajesh Kumar",
    "price": null,
    "rent": null,
    "createdAt": "2026-06-24"
  }
}
```

Note: `propertyId` is included because the user may need to reference it later.

---

### 5. `updateConfirmation`

Used after `update_property` succeeds.

```json
{
  "metadata": {
    "action": "updated",
    "updatedFields": ["status", "listingStatus"]
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "status": "for-sale",
    "listingStatus": "active",
    "listingType": "sale",
    "price": "₹4.5 Cr",
    "rent": null,
    "updatedAt": "2026-06-25"
  }
}
```

---

### 6. `deleteConfirmation`

Returned after `delete_property` succeeds.

```json
{
  "metadata": {
    "action": "deleted"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "status": "available"
  }
}
```

---

### 7. `documentList`

Returned from `get_property_documents`.

```json
{
  "metadata": {
    "total": 4,
    "shown": 4,
    "hasMore": false
  },
  "data": [
    {
      "documentId": "doc-abc123",
      "documentType": "AGREEMENT",
      "fileName": "rental_agreement.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf",
      "description": "Rental agreement 2026",
      "documentUrl": "https://cdn.example.com/doc-abc123",
      "createdAt": "2026-06-25"
    },
    {
      "documentId": "doc-def456",
      "documentType": "VERIFICATION",
      "fileName": "police_verification.pdf",
      "fileSize": 512000,
      "mimeType": "application/pdf",
      "description": "Police verification",
      "documentUrl": "https://cdn.example.com/doc-def456",
      "createdAt": "2026-06-24"
    }
  ]
}
```

**Document DTO fields:**
| Field | Source | Reason |
|---|---|---|
| `documentId` | `document.documentId` | Reference |
| `documentType` | `document.documentType` | Type: PHOTO, VIDEO, AGREEMENT, VERIFICATION, OTHER |
| `fileName` | `document.fileName` | Display name |
| `fileSize` | `document.fileSize` | Size in bytes |
| `mimeType` | `document.mimeType` | MIME type |
| `description` | `document.description` | Description |
| `documentUrl` | Pre-signed URL from `document.s3Key` | Download/view |
| `createdAt` | `document.createdAt` | Upload date |

**Internal fields to remove for documents:**
- `PK`, `SK`, `EntityType`, `tenantId`, `propertyId`
- `s3Key` (replace with `documentUrl`)

---

### 8. `documentCreateConfirmation`

Returned after `create_property_document` succeeds.

```json
{
  "metadata": {
    "action": "document_added"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "documentId": "doc-abc123",
    "documentType": "AGREEMENT",
    "fileName": "rental_agreement.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "documentUrl": "https://cdn.example.com/doc-abc123",
    "createdAt": "2026-06-25"
  }
}
```

---

### 9. `documentDeleteConfirmation`

Returned after `delete_property_document` succeeds.

```json
{
  "metadata": {
    "action": "document_deleted"
  },
  "data": {
    "propertyId": "prop-abc123",
    "documentId": "doc-abc123",
    "fileName": "rental_agreement.pdf"
  }
}
```

---

### 10. `agreementList`

Returned from `get_property_agreements`.

```json
{
  "metadata": {
    "total": 2,
    "shown": 2,
    "hasMore": false
  },
  "data": [
    {
      "agreementId": "agr-abc123",
      "propertyId": "prop-abc123",
      "startDate": "2026-01-01",
      "endDate": "2026-12-31",
      "monthlyRent": "₹50k",
      "securityDeposit": "₹1 L",
      "status": "done",
      "documentUrl": "https://cdn.example.com/agr-abc123",
      "documentName": "rental_agreement.pdf",
      "notes": "12-month lease"
    },
    {
      "agreementId": "agr-def456",
      "propertyId": "prop-abc123",
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "monthlyRent": "₹45k",
      "securityDeposit": "₹90k",
      "status": "done",
      "documentUrl": "https://cdn.example.com/agr-def456",
      "documentName": "old_rental_agreement.pdf",
      "notes": "Previous tenant"
    }
  ]
}
```

**Agreement DTO fields:**
| Field | Source | Reason |
|---|---|---|
| `agreementId` | `agreement.agreementId` | Reference |
| `propertyId` | `agreement.propertyId` | Parent reference |
| `startDate` | `agreement.startDate` | Lease start |
| `endDate` | `agreement.endDate` | Lease end |
| `monthlyRent` | `agreement.monthlyRent` | Monthly rent (formatted) |
| `securityDeposit` | `agreement.securityDeposit` | Security deposit (formatted) |
| `status` | `agreement.status` | pending / done |
| `documentUrl` | Pre-signed URL from `agreement.documentS3Key` | Agreement document |
| `documentName` | `agreement.documentName` | Document name |
| `notes` | `agreement.notes` | Notes |
| `createdAt` | `agreement.createdAt` | Created date |
| `updatedAt` | `agreement.updatedAt` | Updated date |

**Internal fields to remove for agreements:**
- `PK`, `SK`, `EntityType`, `tenantId`
- `documentS3Key` (replace with `documentUrl`)

---

### 11. `agreementCreateConfirmation`

Returned after `create_property_agreement` succeeds.

```json
{
  "metadata": {
    "action": "agreement_created"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "agreementId": "agr-abc123",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "monthlyRent": "₹50k",
    "securityDeposit": "₹1 L",
    "status": "pending"
  }
}
```

---

### 12. `verificationList`

Returned from `get_property_verifications`.

```json
{
  "metadata": {
    "total": 1,
    "shown": 1,
    "hasMore": false
  },
  "data": [
    {
      "verificationId": "ver-abc123",
      "propertyId": "prop-abc123",
      "verificationType": "police",
      "status": "done",
      "verificationDate": "2026-06-20",
      "expiryDate": "2027-06-20",
      "documentUrl": "https://cdn.example.com/ver-abc123",
      "documentName": "police_verification.pdf",
      "notes": "Tenant verification complete",
      "createdAt": "2026-06-20",
      "updatedAt": "2026-06-20"
    }
  ]
}
```

**Verification DTO fields:**
| Field | Source | Reason |
|---|---|---|
| `verificationId` | `verification.verificationId` | Reference |
| `propertyId` | `verification.propertyId` | Parent reference |
| `verificationType` | `verification.verificationType` | police / background / other |
| `status` | `verification.status` | pending / done / not_done |
| `verificationDate` | `verification.verificationDate` | Date completed |
| `expiryDate` | `verification.expiryDate` | Expiry date |
| `documentUrl` | Pre-signed URL from `verification.documentS3Key` | Verification document |
| `documentName` | `verification.documentName` | Document name |
| `notes` | `verification.notes` | Notes |
| `createdAt` | `verification.createdAt` | Created date |
| `updatedAt` | `verification.updatedAt` | Updated date |

**Internal fields to remove for verifications:**
- `PK`, `SK`, `EntityType`, `tenantId`
- `documentS3Key` (replace with `documentUrl`)

---

### 13. `verificationCreateConfirmation`

Returned after `create_property_verification` succeeds.

```json
{
  "metadata": {
    "action": "verification_created"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "verificationId": "ver-abc123",
    "verificationType": "police",
    "status": "pending"
  }
}
```

---

### 14. `empty`

Returned when a collection query returns no results.

```json
{
  "metadata": {
    "total": 0,
    "hasMore": false
  },
  "data": []
}
```

---

### 15. `error`

Generic error envelope returned when any property operation fails.

```json
{
  "metadata": {
    "error": "error_code",
    "message": "Human-readable error message"
  },
  "data": null
}
```

Use this envelope for any error not covered by a specific error DTO below.

---

## Derived Fields

The following fields are computed from raw DynamoDB values and must be included in the appropriate views.

| Field | Logic | Views |
|---|---|---|
| `isRented` | `status === 'rented'` | `searchResults`, `details`, `full` |
| `isSold` | `status === 'sold'` | `searchResults`, `details`, `full` |
| `isListed` | `listingStatus === 'active'` | `searchResults`, `details`, `full` |
| `listingType` | `status === 'for-sale' \|\| status === 'sold'` → `sale`; `status === 'for-rent' \|\| status === 'rented'` → `rent`; otherwise `none` | `searchResults`, `details`, `full`, `createConfirmation` |
| `hasImages` | `Array.isArray(images) && images.length > 0` | `searchResults`, `details`, `full` |
| `imageCount` | `images?.length \|\| 0` | `searchResults`, `details`, `full` |
| `hasVideos` | `Array.isArray(videos) && videos.length > 0` | `details`, `full` |
| `videoCount` | `videos?.length \|\| 0` | `details`, `full` |
| `documentCount` | `documents?.length \|\| 0` | `details`, `full` |
| `rentalHistoryCount` | `rentalHistory?.length \|\| 0` | `details`, `full` |
| `price` | `saleInfo.soldPrice` if `isSold`, else `saleInfo.listedPrice` (formatted) | `searchResults`, `details`, `full`, `updateConfirmation` |
| `rent` | `rentalInfo.currentRent` if `isRented`, else `rentalInfo.expectedRent` (formatted) | `searchResults`, `details`, `full`, `updateConfirmation` |
| `ownerName` | `ownerSnapshot.name` or joined `owner.name` | `searchResults`, `createConfirmation` |
| `owner` | Normalized from `ownerSnapshot` or joined owner record | `details`, `full` |

---

## Optional Fields and Null Handling

### Always present
These fields exist in every property DTO:

- `propertyId`
- `title`
- `status`
- `listingStatus`

### Optional fields
These fields may be `null` or omitted if not available:

- `description`
- `propertyType`
- `bhk`
- `area`
- `city`
- `address`
- `flatNumber`
- `floor`
- `buildingName`
- `carpetArea`
- `builtUpArea`
- `furnishing`
- `facing`
- `amenities`
- `availableFrom`
- `featured`
- `verified`
- `views`
- `ownerName`
- `owner`
- `price`
- `rent`
- `expectedBrokerage`
- `saleInfo`
- `rentalInfo`
- `rentalHistoryCount`
- `hasImages`
- `imageCount`
- `hasVideos`
- `videoCount`
- `documentCount`
- `documents`
- `agreements`
- `verifications`
- `images`
- `videos`
- `latitude`
- `longitude`
- `titleDeedUrl`
- `occupancyCertificateUrl`
- `propertyTaxReceiptUrl`
- `convertedFromLeadId` (only in `full`)

### Missing `saleInfo` object
If a property has no sale data, the `saleInfo` field should be an empty object with all optional fields set to `null`:

```json
"saleInfo": {
  "listedPrice": null,
  "soldPrice": null,
  "soldDate": null,
  "soldToBuyerId": null
}
```

### Missing `rentalInfo` object
If a property has no rental data, the `rentalInfo` field should be `null`:

```json
"rentalInfo": null
```

### Missing `owner` object
If a property has no owner, the `owner` field should be `null`:

```json
"owner": null
```

---

## Pagination Metadata

```json
{
  "metadata": {
    "total": 132,
    "hasMore": true,
    "nextCursor": "base64CursorString"
  }
}
```

Rules:
- `hasMore` is `true` only if more pages exist.
- `nextCursor` is optional; used for DynamoDB `ExclusiveStartKey` or in-memory offset encoding.
- The agent should not expose `nextCursor` to the user.
- Page numbers are not included because DynamoDB uses cursor-based pagination.

---

## Document/Agreement/Verification Pagination

For property details, related items are limited to the most recent 5 each.

```json
{
  "metadata": {
    "documents": {
      "total": 12,
      "shown": 5,
      "hasMore": true
    },
    "agreements": {
      "total": 2,
      "shown": 2,
      "hasMore": false
    },
    "verifications": {
      "total": 1,
      "shown": 1,
      "hasMore": false
    }
  }
}
```

---

## Money Format

All money values should be formatted as compact Indian currency:

| Raw value | Formatted |
|---|---|
| 17000000 | ₹1.7 Cr |
| 13400000 | ₹1.34 Cr |
| 4500000 | ₹4.5 Cr |
| 800000 | ₹8 L |
| 100000 | ₹1 L |
| 90000 | ₹90k |
| 45000 | ₹45k |

The LLM should never receive raw integers for `price`, `rent`, `expectedBrokerage`, `monthlyRent`, `securityDeposit`, or `soldPrice`.

---

## Internal Fields to Always Remove

Before any property reaches the AI, remove:

- `PK`
- `SK`
- `GSI1PK`
- `GSI1SK`
- `GSI2PK`
- `GSI2SK`
- `GSI3PK`
- `GSI3SK`
- `EntityType`
- `tenantId`
- `titleDeedS3Key`
- `occupancyCertificateS3Key`
- `propertyTaxReceiptS3Key`
- `documentS3Key` (on agreements and verifications)
- `s3Key` (on property documents and media)
- Any field starting with `internal_`

---

## Error DTOs

### Property not found

```json
{
  "metadata": {
    "error": "property_not_found",
    "message": "Property not found"
  },
  "data": {
    "propertyId": "prop-abc123"
  }
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

### Owner not found

```json
{
  "metadata": {
    "error": "owner_not_found",
    "message": "Owner not found"
  },
  "data": {
    "ownerId": "owner-xyz789"
  }
}
```

### Document not found

```json
{
  "metadata": {
    "error": "document_not_found",
    "message": "Document not found for this property"
  },
  "data": {
    "propertyId": "prop-abc123",
    "documentId": "doc-xyz789"
  }
}
```

### Agreement not found

```json
{
  "metadata": {
    "error": "agreement_not_found",
    "message": "Agreement not found for this property"
  },
  "data": {
    "propertyId": "prop-abc123",
    "agreementId": "agr-xyz789"
  }
}
```

### Verification not found

```json
{
  "metadata": {
    "error": "verification_not_found",
    "message": "Verification not found for this property"
  },
  "data": {
    "propertyId": "prop-abc123",
    "verificationId": "ver-xyz789"
  }
}
```

### Cannot delete property

```json
{
  "metadata": {
    "error": "cannot_delete_property",
    "message": "Cannot delete property with active tenant or sold status"
  },
  "data": {
    "propertyId": "prop-abc123",
    "title": "3BHK Apartment in Bandra West",
    "status": "rented",
    "reason": "Active tenant exists"
  }
}
```

### Invalid property type

```json
{
  "metadata": {
    "error": "invalid_property_type",
    "message": "Invalid property type"
  },
  "data": {
    "propertyType": "castle",
    "allowed": ["apartment", "house", "villa", "office"]
  }
}
```

### Invalid status

```json
{
  "metadata": {
    "error": "invalid_status",
    "message": "Invalid property status"
  },
  "data": {
    "status": "under-construction",
    "allowed": ["available", "for-sale", "for-rent", "rented", "sold", "on-hold", "out-of-stock"]
  }
}
```

### Empty search results

```json
{
  "metadata": {
    "total": 0,
    "hasMore": false
  },
  "data": []
}
```

---

## Version

v1.1 — 2026-06-26
