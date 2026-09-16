# Backend Schema Changes - Implementation Summary

## Completed Changes

### 1. BUYER Entity - Redesigned ✅
**Old Schema (Prospective):**
- requirement, budget, preferredArea, bhk, propertyType, timeline
- status: active, contacted, site-visit, negotiation, agreement
- Priority-based lead tracking

**New Schema (Post-Purchase):**
```javascript
{
  buyerId, tenantId, name, phone, email, address,
  source: 'lead:leadId' | 'direct',
  createdFrom: 'lead:leadId', // conversion tracking
  
  // KYC Documents (MANDATORY for purchase)
  panNumber, panDocS3Key, panDocUrl,
  aadharNumber, aadharDocS3Key, aadharDocUrl,
  photoS3Key, photoUrl,
  
  // Purchase Records (array - can buy multiple properties)
  purchases: [{
    propertyId,
    purchaseDate,
    saleAmount,
    registrationDate,
    registrationNumber,
    saleDeedS3Key, saleDeedUrl,
    registrationDocS3Key, registrationDocUrl,
    stampDutyPaid,
    registrationCharges,
    brokeragePaid,
    loanDetails: { bankName, loanAmount, loanAccountNumber, sanctionLetterS3Key },
    notes
  }],
  
  status: 'active' | 'inactive',
  notes, tags, createdAt, updatedAt
}
```

### 2. TENANT (CUSTOMER) Entity - Redesigned ✅
**Old Schema (Prospective):**
- requirement, budget, preferredArea
- Lead-like tracking fields

**New Schema (Post-Lease):**
```javascript
{
  customerId, tenantId, name, phone, email, address,
  source: 'lead:leadId' | 'direct',
  createdFrom: 'lead:leadId',
  
  // KYC Documents (required for lease)
  aadharNumber, aadharDocS3Key, aadharDocUrl,
  photoS3Key, photoUrl,
  policeVerificationS3Key, policeVerificationUrl,
  
  // Current Active Rental
  currentRental: {
    propertyId,
    leaseStartDate,
    leaseEndDate,
    monthlyRent,
    securityDeposit,
    leaseAgreementS3Key, leaseAgreementUrl,
    depositReceiptS3Key, depositReceiptUrl,
    policeVerificationS3Key, policeVerificationUrl,
    notes
  },
  
  // Past Rentals
  rentalHistory: [{ ...same structure as currentRental }],
  
  status: 'active' | 'inactive',
  notes, tags, createdAt, updatedAt
}
```

### 3. PROPERTY Entity - Enhanced ✅
**Added Fields:**
```javascript
{
  // Ownership
  ownerId, ownerName, ownerPhone,
  
  // Lifecycle Status (NEW)
  status: 'owner-occupied' | 'vacant' | 'for-rent' | 'rented' | 'for-sale' | 'sold' | 'under-construction',
  listingStatus: 'active' | 'inactive', // marketing visibility
  
  // Rental Information (NEW)
  rentalInfo: {
    expectedRent,
    currentRent,
    currentTenantId, // links to CUSTOMER
    leaseStartDate,
    leaseEndDate,
    securityDeposit
  },
  
  // Sale Information (NEW)
  saleInfo: {
    listedPrice,
    soldPrice,
    soldDate,
    soldToBuyerId // links to BUYER
  },
  
  // Property Documents (NEW)
  titleDeedS3Key, titleDeedUrl,
  occupancyCertificateS3Key, occupancyCertificateUrl,
  propertyTaxReceiptS3Key, propertyTaxReceiptUrl,
  
  // Enhanced details
  builtUpArea, facing, images: [{s3Key, url, description}]
}
```

### 4. SELLER Entity - REMOVED ✅
**Rationale:** A "seller" is an OWNER who wants to sell. No separate entity needed.

**Replacement Flow:**
```
Old: Lead (seller-type) → SELLER entity
New: Lead (seller-type) → OWNER + PROPERTY (status='for-sale')
```

**Search Replacement:**
- `searchSellers()` removed
- Use: `searchOwners()` + filter properties by `status='for-sale'`

### 5. Lead Conversion - Updated ✅
**New Requirements:**

**Buyer Conversion:**
```javascript
convertLead(tenantId, leadId, {
  convertedBy: 'AgentName',
  purchaseDetails: {
    propertyId: 'prop-123',
    purchaseDate: '2024-01-28',
    saleAmount: 5000000,
    registrationDate: '2024-02-15',
    registrationNumber: 'REG-2024-001',
    stampDutyPaid: 300000,
    brokeragePaid: 50000,
    loanDetails: { ... }
  },
  kycDetails: {
    panNumber: 'ABCDE1234F',
    aadharNumber: '1234-5678-9012'
  }
})
```

**Tenant Conversion:**
```javascript
convertLead(tenantId, leadId, {
  convertedBy: 'AgentName',
  leaseDetails: {
    propertyId: 'prop-456',
    leaseStartDate: '2024-02-01',
    leaseEndDate: '2025-01-31',
    monthlyRent: 25000,
    securityDeposit: 50000
  },
  kycDetails: {
    aadharNumber: '1234-5678-9012'
  }
})
```

**Seller Conversion (now OWNER):**
```javascript
convertLead(tenantId, leadId, {
  convertedBy: 'AgentName',
  createPropertyListing: true // default true
})
// Creates OWNER + PROPERTY with status='for-sale'
```

**Owner Conversion:**
```javascript
convertLead(tenantId, leadId, {
  convertedBy: 'AgentName'
})
// Creates OWNER only
```

### 6. Functions Removed
- `createSeller()`
- `getSellers()`
- `getSeller()`
- `updateSeller()`
- `createSellerNote()`
- `getSellerNotes()`
- `searchSellers()`

### 7. Functions Updated
- `createBuyer()` - new schema with purchases[]
- `updateBuyer()` - new updateable fields
- `createCustomer()` - new schema with currentRental{}, rentalHistory[]
- `createProperty()` - enhanced with status, rentalInfo{}, saleInfo{}
- `convertLead()` - requires transaction details
- `findPersonByPhone()` - removed seller lookup

## Required Helper Functions (TO BE IMPLEMENTED)

### Buyer Management
```javascript
async function addPurchaseToBuyer(tenantId, buyerId, purchaseDetails)
async function getBuyerPurchases(tenantId, buyerId)
async function updateBuyerPurchase(tenantId, buyerId, purchaseIndex, updates)
```

### Tenant Management
```javascript
async function updateCurrentRental(tenantId, customerId, rentalDetails)
async function moveTenantToHistory(tenantId, customerId) // moves currentRental to rentalHistory
async function getTenantRentalHistory(tenantId, customerId)
```

### Property Listing Management
```javascript
async function listPropertyForSale(tenantId, propertyId, listedPrice)
async function listPropertyForRent(tenantId, propertyId, expectedRent, securityDeposit)
async function markPropertySold(tenantId, propertyId, soldPrice, buyerId)
async function markPropertyRented(tenantId, propertyId, tenantId, rentalDetails)
async function vacateProperty(tenantId, propertyId) // moves tenant to history, sets status to vacant
```

## Database Migration Notes

**Backward Compatibility:**
- Legacy fields maintained in PROPERTY for gradual migration
- `tenantCustomerId`, `tenantMoveInDate`, `tenureMonths` still present

**Migration Strategy:**
1. Deploy new schema (backward compatible)
2. Run data migration script to transform existing BUYERs/SELLERs/TENANTs
3. Update frontend to use new schemas
4. Remove legacy fields in future release

## Next Steps

### Backend Routes
- [x] Delete `routes/sellers.js`
- [ ] Update `routes/buyers.js` - remove requirement fields from validation
- [ ] Update `routes/customers.js` - remove requirement fields
- [ ] Update `routes/properties.js` - add status management endpoints
- [ ] Update `routes/leads.js` - modify conversion endpoint to accept transaction details

### Frontend
- [ ] Delete `SellerList.tsx`, `SellerDetails.tsx`
- [ ] Refactor `BuyerDetails.tsx` - remove requirements UI, add purchases display
- [ ] Refactor `TenantDetails.tsx` - add rental tracking UI
- [ ] Enhance `OwnerDetails.tsx` - add property listing management
- [ ] Update `LeadDetails.tsx` - add transaction capture modals
- [ ] Update `App.tsx` - remove seller routes, update navigation

### Documentation
- [ ] Update API documentation
- [ ] Create frontend integration guide
- [ ] Document new conversion workflows
