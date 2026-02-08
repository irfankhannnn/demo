# Real Estate CRM - Architectural Redesign

## Business Problem
Current system confuses **prospective customers (leads)** with **transacted customers (buyers/tenants)**. BUYER entity has "requirements" and "budget" which are pre-purchase fields. Post-purchase, we need transaction records, KYC documents, and property ownership tracking.

## Correct Business Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROSPECTIVE STAGE                             │
│  LEAD → contacted → site-visit → negotiation → CONVERTED         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSACTION STAGE                             │
│  Agreement → Payment → Registration → Documentation              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 POST-TRANSACTION MANAGEMENT                      │
│  BUYER (purchased) / TENANT (leased) / OWNER (registered)        │
└─────────────────────────────────────────────────────────────────┘
```

## Entity Model

### **1. LEAD** (Unchanged - Prospective Customers)
- **Purpose**: Track prospects BEFORE any transaction
- **Types**: buyer-lead, tenant-lead, owner-lead
- **Key Fields**:
  - Basic: name, phone, email, source, assignedTo, priority, status
  - leadType: 'buyer' | 'tenant' | 'owner'
  - buyerRequirement: {requirement, budget, preferredArea, bhk, propertyType, timeline}
  - tenantRequirement: {requirement, budget, preferredArea, moveInDate}
  - ownerProperty: {propertyType, area, address, expectedPrice}
  - Activity notes, call history, meetings
  - convertedTo: {entityType, entityId}

### **2. BUYER** (REDESIGNED - Post-Purchase Only)
- **Purpose**: Track customers who have PURCHASED properties
- **Creation**: Only created AFTER a purchase transaction
- **Key Fields**:
  ```javascript
  {
    // Identity
    buyerId, tenantId, name, phone, email, address, status,
    source: 'lead:leadId' | 'direct',
    createdFrom: 'lead:leadId', // if converted
    
    // KYC Documents (MANDATORY for property purchase)
    panNumber, panDocS3Key, panDocUrl,
    aadharNumber, aadharDocS3Key, aadharDocUrl,
    photoS3Key, photoUrl,
    
    // Purchases (one-to-many)
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
      loanDetails: {
        bankName, loanAmount, loanAccountNumber, sanctionLetterS3Key
      },
      notes
    }],
    
    // History
    activityNotes, meetings, callHistory
  }
  ```

### **3. TENANT** (REDESIGNED - Post-Lease Only)
- **Purpose**: Track customers who have LEASED properties
- **Creation**: Only created AFTER a lease agreement
- **Key Fields**:
  ```javascript
  {
    // Identity
    customerId, tenantId, name, phone, email, address, status,
    source: 'lead:leadId' | 'direct',
    createdFrom: 'lead:leadId',
    
    // KYC Documents (required for lease)
    aadharNumber, aadharDocS3Key, aadharDocUrl,
    photoS3Key, photoUrl,
    
    // Current Rental
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
    
    // Rental History (when they move out, archive to history)
    rentalHistory: [{ ...same structure as currentRental }],
    
    // History
    activityNotes, meetings
  }
  ```

### **4. OWNER** (ENHANCED)
- **Purpose**: Property owners (may list for rent or sale)
- **Key Fields**:
  ```javascript
  {
    // Identity
    ownerId, tenantId, name, phone, email, address, status,
    
    // KYC Documents (FULL SET - required for property transactions)
    panNumber, panDocS3Key, panDocUrl,
    aadharNumber, aadharDocS3Key, aadharDocUrl,
    photoS3Key, photoUrl,
    
    // Bank Details (for rent/sale payments)
    bankName, accountNumber, ifscCode,
    cancelledChequeS3Key, cancelledChequeUrl,
    
    // Properties (managed via PROPERTY.ownerId)
    // properties: [propertyId1, propertyId2, ...]
    
    // History
    activityNotes, meetings
  }
  ```

### **5. PROPERTY** (ENHANCED)
- **Purpose**: Real estate assets with lifecycle tracking
- **Key Fields**:
  ```javascript
  {
    // Basic
    propertyId, tenantId, title, area, city, address, bhk, propertyType,
    furnishing, facing, floorNumber, totalFloors, carpetArea, builtUpArea,
    
    // Ownership
    ownerId, // links to OWNER entity
    ownerName, ownerPhone, // denormalized for quick display
    
    // Property Status Lifecycle
    status: 
      | 'owner-occupied'  // Owner living in it
      | 'vacant'          // Empty, not listed
      | 'for-rent'        // Owner wants to rent out (LISTED)
      | 'rented'          // Currently rented to tenant
      | 'for-sale'        // Owner wants to sell (LISTED)
      | 'sold'            // Sold to buyer
      | 'under-construction', // New property being built
    
    listingStatus: 'active' | 'inactive', // Marketing visibility
    
    // Rental Information (if status = for-rent or rented)
    rentalInfo: {
      expectedRent,        // Listing price
      currentRent,         // Actual rent (if rented)
      currentTenantId,     // Link to TENANT (if rented)
      leaseStartDate,
      leaseEndDate,
      securityDeposit
    },
    
    // Sale Information (if status = for-sale or sold)
    saleInfo: {
      listedPrice,         // Asking price (if for-sale)
      soldPrice,           // Actual sale price (if sold)
      soldDate,
      soldToBuyerId        // Link to BUYER (if sold)
    },
    
    // Property Documents
    titleDeedS3Key, titleDeedUrl,
    occupancyCertificateS3Key, occupancyCertificateUrl,
    propertyTaxReceiptS3Key, propertyTaxReceiptUrl,
    photos: [{ s3Key, url, description }],
    
    // Meta
    amenities: [],
    description,
    createdAt, updatedAt
  }
  ```

### **SELLER Entity → DELETED**
- **Reason**: A "seller" is just an OWNER who wants to sell their property
- **Implementation**: Set `property.status = 'for-sale'` and manage via OWNER + PROPERTY

## Database Schema (DynamoDB Single Table)

### Primary Keys
```
LEAD:     PK: TENANT#{tenantId}#LEAD#{leadId},           SK: PROFILE
BUYER:    PK: TENANT#{tenantId}#BUYER#{buyerId},         SK: PROFILE
TENANT:   PK: TENANT#{tenantId}#CUSTOMER#{customerId},   SK: PROFILE
OWNER:    PK: TENANT#{tenantId}#OWNER#{ownerId},         SK: PROFILE
PROPERTY: PK: TENANT#{tenantId}#PROPERTY#{propertyId},   SK: PROFILE
```

### Notes (Activity History)
```
LEAD NOTE:   PK: TENANT#{tenantId}#LEAD#{leadId},      SK: NOTE#{noteId}
BUYER NOTE:  PK: TENANT#{tenantId}#BUYER#{buyerId},    SK: NOTE#{noteId}
TENANT NOTE: PK: TENANT#{tenantId}#CUSTOMER#{customerId}, SK: NOTE#{noteId}
OWNER NOTE:  PK: TENANT#{tenantId}#OWNER#{ownerId},    SK: NOTE#{noteId}
```

## Updated Lead Conversion Flow

### Old Flow (BROKEN)
```
Lead (buyer-type) → BUYER with requirements/budget ❌
```

### New Flow (CORRECT)
```
Lead (buyer-type) → 
  Option 1: Convert to BUYER (requires purchase transaction details)
  Option 2: Mark as "closed-won" but keep as Lead (not yet purchased)

Lead (tenant-type) →
  Option 1: Convert to TENANT (requires lease agreement details)
  Option 2: Mark as "closed-won" but keep as Lead (not yet leased)

Lead (owner-type) →
  Convert to OWNER + Create PROPERTY
```

## Frontend Changes

### Remove
- `/crm/sellers` (entire SellerList page)
- `/crm/sellers/:id` (entire SellerDetails page)
- Seller navigation links

### Update
- `/crm/buyers/new` → Remove requirement/budget fields, add purchase transaction form
- `/crm/buyers/:id` → Show purchases[], KYC docs, no requirements
- `/crm/tenants/:id` → Show currentRental, rentalHistory[], KYC docs
- `/crm/owners/:id` → Add property listing management, show properties with for-sale status
- `/crm/properties/:id` → Enhanced status management, sale/rental tracking

### New Components
- `PurchaseTransactionForm` - Capture sale details when converting buyer lead
- `LeaseAgreementForm` - Capture lease details when converting tenant lead  
- `PropertyListingManager` - Owner can list/unlist properties for rent/sale
- `DocumentUploadSection` - Unified KYC/transaction doc upload (already exists)

## Backend Service Changes

### Update `crmDynamodbService.js`
1. **Modify `createBuyer()`**
   - Remove: requirement, budget, preferredArea, bhk, propertyType, timeline
   - Add: purchases: [], KYC fields, createdFrom
   
2. **Modify `createCustomer()` (Tenant)**
   - Remove: requirement, budget, preferredArea
   - Add: currentRental: {}, rentalHistory: [], KYC fields, createdFrom

3. **Delete `createSeller()`, `getSellers()`, `updateSeller()`, `deleteSeller()`**

4. **Enhance `createProperty()` / `updateProperty()`**
   - Add: status enum, listingStatus, rentalInfo{}, saleInfo{}
   
5. **Update `convertLead()`**
   - Buyer conversion: Require purchase transaction details
   - Tenant conversion: Require lease agreement details
   - Owner conversion: Create OWNER + PROPERTY

### Update Routes
- Delete `routes/sellers.js`
- Update `routes/buyers.js` - new schema
- Update `routes/customers.js` - new schema
- Update `routes/properties.js` - enhanced status management

## Implementation Priority

### Phase 1: Backend Schema (CURRENT)
1. ✅ Update BUYER entity schema
2. ✅ Update TENANT (CUSTOMER) entity schema  
3. ✅ Delete SELLER entity
4. ✅ Update PROPERTY entity schema
5. ✅ Update Lead conversion logic

### Phase 2: Frontend Refactor
1. Delete SellerList, SellerDetails pages
2. Refactor BuyerDetails (remove requirements, add purchases)
3. Refactor TenantDetails (add rental tracking)
4. Enhance OwnerDetails (listing management)
5. Update PropertyDetails (status workflow)

### Phase 3: Conversion UI
1. Update LeadDetails conversion flow
2. Add transaction capture modals
3. Update navigation and routes

### Phase 4: Document Management
1. Enhance document upload for each entity
2. Add document preview/download
3. Transaction document management

## Testing Scenarios

1. **Lead → Buyer Conversion**
   - Create buyer lead with requirements
   - Add activity notes
   - Convert with purchase transaction details
   - Verify: BUYER created with purchases[], notes migrated, KYC uploaded

2. **Lead → Tenant Conversion**
   - Create tenant lead
   - Convert with lease agreement details
   - Verify: TENANT created with currentRental{}, documents uploaded

3. **Owner Listing Property**
   - Create owner with KYC
   - Create property
   - Set property status to 'for-sale'
   - Verify: Property shows in available listings

4. **Property Sale Transaction**
   - Property status 'for-sale'
   - Convert buyer lead with purchase
   - Link purchase to property
   - Verify: Property status → 'sold', saleInfo populated, buyer has purchase record
