# CRM Data Model Redesign - Implementation Status

## ✅ COMPLETED: Backend Schema & Services

### Schema Changes Implemented

#### 1. BUYER Entity - Redesigned (Post-Purchase Only) ✅
**Location:** `server/crmDynamodbService.js` lines 2704-2768

**Key Changes:**
- ❌ Removed: `requirement`, `budget`, `preferredArea`, `bhk`, `propertyType`, `timeline`, `priority`, `assignedTo`
- ✅ Added: `purchases[]` array for tracking multiple property purchases
- ✅ Added: `createdFrom` field to track conversion from lead
- ✅ Enhanced: KYC documents with URLs (`panDocUrl`, `aadharDocUrl`, `photoUrl`)
- ✅ Simplified: status to `active | inactive`

**Usage Example:**
```javascript
const buyer = await createBuyer(tenantId, {
  name: 'John Doe',
  phone: '+919876543210',
  email: 'john@example.com',
  address: '123 Main St',
  createdFrom: 'lead:lead-123',
  panNumber: 'ABCDE1234F',
  aadharNumber: '1234-5678-9012',
  purchases: [{
    propertyId: 'prop-456',
    purchaseDate: '2024-01-28',
    saleAmount: 5000000,
    registrationDate: '2024-02-15',
    registrationNumber: 'REG-2024-001',
    stampDutyPaid: 300000,
    brokeragePaid: 50000
  }]
});
```

#### 2. TENANT (CUSTOMER) Entity - Redesigned (Post-Lease Only) ✅
**Location:** `server/crmDynamodbService.js` lines 56-125

**Key Changes:**
- ❌ Removed: `requirement`, `budget`, `preferredArea`, `priority`, `assignedTo`
- ✅ Added: `currentRental{}` object for active lease
- ✅ Added: `rentalHistory[]` array for past leases
- ✅ Added: `createdFrom` field
- ✅ Added: `policeVerificationS3Key` for security checks
- ✅ Enhanced: KYC documents with URLs

**Usage Example:**
```javascript
const tenant = await createCustomer(tenantId, {
  name: 'Jane Smith',
  phone: '+919876543211',
  createdFrom: 'lead:lead-456',
  aadharNumber: '9012-3456-7890',
  currentRental: {
    propertyId: 'prop-789',
    leaseStartDate: '2024-02-01',
    leaseEndDate: '2025-01-31',
    monthlyRent: 25000,
    securityDeposit: 50000,
    leaseAgreementS3Key: 'agreements/lease-789.pdf'
  },
  rentalHistory: []
});
```

#### 3. PROPERTY Entity - Enhanced with Lifecycle Status ✅
**Location:** `server/crmDynamodbService.js` lines 620-715

**Key Changes:**
- ✅ Added: `status` enum for property lifecycle
  - `owner-occupied` | `vacant` | `for-rent` | `rented` | `for-sale` | `sold` | `under-construction`
- ✅ Added: `listingStatus` for marketing visibility (`active | inactive`)
- ✅ Added: `rentalInfo{}` object with rental-specific fields
- ✅ Added: `saleInfo{}` object with sale-specific fields
- ✅ Added: `ownerName`, `ownerPhone` denormalized fields
- ✅ Added: Property document S3 keys (`titleDeed`, `occupancyCertificate`, `propertyTaxReceipt`)
- ✅ Added: `builtUpArea`, `facing` fields

**Usage Example:**
```javascript
const property = await createProperty(tenantId, {
  ownerId: 'owner-123',
  ownerName: 'Ram Kumar',
  title: '3BHK Apartment in Bandra',
  status: 'for-sale',
  listingStatus: 'active',
  saleInfo: {
    listedPrice: 15000000,
    soldPrice: null,
    soldDate: null,
    soldToBuyerId: null
  },
  rentalInfo: {
    expectedRent: 0,
    currentRent: null,
    currentTenantId: null
  }
});
```

#### 4. SELLER Entity - DELETED ✅
**Rationale:** Sellers are property owners who want to sell. No separate entity needed.

**Removed Functions:**
- `createSeller()` ❌
- `getSellers()` ❌
- `getSeller()` ❌
- `updateSeller()` ❌
- `createSellerNote()` ❌
- `getSellerNotes()` ❌
- `searchSellers()` ❌

**Removed Files:**
- `server/routes/sellers.js` ❌

**Migration Path:**
```
OLD: Lead (seller-type) → SELLER entity with property details
NEW: Lead (seller-type) → OWNER + PROPERTY (status='for-sale')
```

#### 5. Lead Conversion - Updated ✅
**Location:** `server/crmDynamodbService.js` lines 2377-2580

**Breaking Changes:**

**Buyer Conversion** now requires `purchaseDetails`:
```javascript
await convertLead(tenantId, leadId, {
  convertedBy: 'Agent Name',
  purchaseDetails: {
    propertyId: 'prop-123',      // REQUIRED
    purchaseDate: '2024-01-28',
    saleAmount: 5000000,
    registrationDate: '2024-02-15',
    registrationNumber: 'REG-2024-001',
    stampDutyPaid: 300000,
    brokeragePaid: 50000,
    loanDetails: {
      bankName: 'HDFC Bank',
      loanAmount: 3500000,
      loanAccountNumber: 'LOAN-12345'
    }
  },
  kycDetails: {
    panNumber: 'ABCDE1234F',
    aadharNumber: '1234-5678-9012'
  }
});
```

**Tenant Conversion** now requires `leaseDetails`:
```javascript
await convertLead(tenantId, leadId, {
  convertedBy: 'Agent Name',
  leaseDetails: {
    propertyId: 'prop-456',      // REQUIRED
    leaseStartDate: '2024-02-01',
    leaseEndDate: '2025-01-31',
    monthlyRent: 25000,
    securityDeposit: 50000
  },
  kycDetails: {
    aadharNumber: '1234-5678-9012'
  }
});
```

**Seller-type Lead** now converts to OWNER + creates PROPERTY:
```javascript
await convertLead(tenantId, leadId, {
  convertedBy: 'Agent Name',
  createPropertyListing: true  // default true
});
// Creates OWNER entity + PROPERTY with status='for-sale'
```

### Helper Functions Created ✅
**Location:** `server/crmHelpers.js`

#### Buyer Management
- `addPurchaseToBuyer(tenantId, buyerId, purchaseDetails)` - Add new purchase record
- `updateBuyerPurchase(tenantId, buyerId, propertyId, updates)` - Update existing purchase

#### Tenant Management
- `updateCurrentRental(tenantId, customerId, rentalDetails)` - Update active lease
- `moveTenantToHistory(tenantId, customerId)` - Archive current lease when it ends

#### Property Listing Management
- `listPropertyForSale(tenantId, propertyId, listedPrice)` - Set status to 'for-sale'
- `listPropertyForRent(tenantId, propertyId, expectedRent, securityDeposit)` - Set status to 'for-rent'
- `markPropertySold(tenantId, propertyId, soldPrice, buyerId)` - Set status to 'sold'
- `markPropertyRented(tenantId, propertyId, customerId, rentalDetails)` - Set status to 'rented'
- `vacateProperty(tenantId, propertyId)` - Archive tenant, set status to 'vacant'

### Routes Updated ✅
- `server/routes/sellers.js` - DELETED
- `server/server.js` - Removed sellers route import and registration

---

## ✅ COMPLETED: Backend Routes

### All Routes Implemented in `server/routes/crm.js`

#### 1. `server/routes/leads.js` - Conversion Endpoint ✅
- `/convert` POST endpoint accepts `purchaseDetails`, `leaseDetails`, `kycDetails`, `createPropertyListing`
- Validation for required transaction fields included

#### 2. Property Status Management ✅ (in `server/routes/crm.js`)
```javascript
POST   /api/crm/properties/:id/list-for-sale    ✅
POST   /api/crm/properties/:id/list-for-rent     ✅
POST   /api/crm/properties/:id/mark-sold          ✅
POST   /api/crm/properties/:id/mark-rented        ✅
POST   /api/crm/properties/:id/vacate             ✅
```

#### 3. Buyer Purchase Management ✅ (in `server/routes/crm.js`)
```javascript
GET    /api/crm/buyers/:id/purchases              ✅
POST   /api/crm/buyers/:id/purchases              ✅
PUT    /api/crm/buyers/:id/purchases/:propertyId   ✅
```

#### 4. Tenant Rental Management ✅ (in `server/routes/crm.js`)
```javascript
PUT    /api/crm/customers/:id/current-rental       ✅
POST   /api/crm/customers/:id/archive-rental       ✅
GET    /api/crm/customers/:id/rental-history        ✅
```

### CFN / API Gateway ✅
- `server/cfn/nested/apigw-explicit-resources.yaml` uses `{proxy+}` catch-all for `/api/crm/*`
- No CFN changes needed for new routes

---

## ✅ COMPLETED: Frontend Implementation

### Phase 1: Remove Seller Pages ✅
- [x] `SellerList.tsx` and `SellerDetails.tsx` do not exist (never created or already removed)
- [x] `App.tsx` has no `/crm/sellers` routes
- [x] `api.ts` - seller entity methods removed, comments document removal
- [x] `types/crm.ts` - `SellerProfile` removed (comment: "SellerProfile removed - sellers are now owners with properties listed for sale")
- [x] `CRMDashboard.tsx` - "Sellers" card shows count from `getOwners()` + `getSellerCount()` (owners with for-sale properties)

### Phase 2: Refactor BuyerDetails ✅
**File:** `real-estate-crm-app/src/pages/crm/BuyerDetails.tsx`

- [x] Purchases List section loads actual purchase records from `GET /crm/buyers/:id/purchases`
- [x] Purchase details display (saleAmount, registrationDate, stampDuty, brokerage, loanBank, notes)
- [x] Loading state and empty state handled
- [x] `BuyerPurchase` type added to `types/crm.ts`

### Phase 3: Refactor TenantDetails ✅
**File:** `real-estate-crm-app/src/pages/crm/TenantDetails.tsx`

- [x] Current Rental section shows active lease details (propertyId, rent, dates, deposit)
- [x] Rental History table shows past leases
- [x] "Archive Rental to History" button with confirmation dialog
- [x] `archiveTenantRental()` API method wired up

### Phase 4: Enhance OwnerDetails ✅
**File:** `real-estate-crm-app/src/pages/crm/OwnerDetails.tsx`

- [x] Properties List section shows all properties owned by this owner
- [x] "List for Sale" / "List for Rent" buttons with modal input
- [x] Property status badges (vacant, for-sale, for-rent, rented, sold, etc.)
- [x] Sale/rent info displayed on property cards
- [x] Listing modal fixed to use `api.listPropertyForSale()` / `api.listPropertyForRent()` (was using raw fetch with wrong auth)
- [x] Bank details section (bankName, accountNumber, ifscCode)
- [x] KYC section (PAN, Aadhar)
- [x] Document upload section

### Phase 5: Update LeadDetails Conversion ✅
**File:** `real-estate-crm-app/src/pages/crm/LeadDetails.tsx`

- [x] Buyer conversion: Transaction capture form (property selection, saleAmount, registrationDate, stampDuty, brokerage, KYC)
- [x] Tenant conversion: Lease capture form (owner lookup, property selection, rent, dates, deposit, KYC)
- [x] Seller conversion: Creates OWNER + PROPERTY with `createPropertyListing: true`
- [x] Owner conversion: Simple (no extra fields)

### Frontend API Service ✅
**File:** `real-estate-crm-app/src/services/api.ts`

- [x] `listPropertyForSale()`, `listPropertyForRent()`, `markPropertySold()`, `markPropertyRented()`, `vacateProperty()`
- [x] `getBuyerPurchases()`, `addBuyerPurchase()`, `updateBuyerPurchase()`
- [x] `updateTenantCurrentRental()`, `archiveTenantRental()`, `getTenantRentalHistory()`

### Frontend Types ✅
**File:** `real-estate-crm-app/src/types/crm.ts`

- [x] `CRMProperty.status` updated with lifecycle enum (`vacant`, `for-sale`, `for-rent`, `rented`, `sold`, etc.)
- [x] `CRMProperty` updated with `saleInfo`, `rentalInfo`, `listingStatus`, `ownerName`, `ownerPhone`
- [x] `BuyerPurchase` interface added
- [x] `CreatePropertyData` and `UpdatePropertyData` updated with new status values

---

## 🔄 Migration Strategy

### For Existing Data

**Phase 1: Backward Compatible Deployment**
- Deploy new backend with legacy field support
- Old frontend continues to work

**Phase 2: Data Transformation**
Run migration script to:
1. Convert existing BUYERs:
   - Move requirement/budget to notes
   - Initialize empty purchases[]
   - Set createdFrom = null (legacy data)

2. Convert existing TENANTs:
   - Move requirement/budget to notes
   - Initialize currentRental = null
   - Initialize rentalHistory = []

3. Convert existing PROPERTYs:
   - Map old status to new status enum
   - Initialize rentalInfo{} and saleInfo{}
   - Set listingStatus based on old status

4. Convert existing SELLERs:
   - Create OWNER entity
   - Create PROPERTY with status='for-sale'
   - Migrate notes
   - Delete SELLER record

**Phase 3: Frontend Update**
- Deploy new frontend
- Remove legacy code

**Phase 4: Cleanup**
- Remove legacy fields from schema
- Drop old indexes

---

## 📊 Testing Checklist

### Backend Tests
- [ ] Create new BUYER with purchases[]
- [ ] Add purchase to existing buyer
- [ ] Create new TENANT with currentRental
- [ ] Archive tenant rental to history
- [ ] Create PROPERTY with status='for-sale'
- [ ] List property for rent
- [ ] Mark property as sold
- [ ] Convert buyer lead WITH purchase details
- [ ] Convert tenant lead WITH lease details
- [ ] Convert seller lead to OWNER + PROPERTY
- [ ] Verify SELLER entity functions removed

### Frontend Tests
- [ ] Seller pages deleted and routes removed
- [ ] Buyer page shows purchases list (not requirements)
- [ ] Tenant page shows rental tracking
- [ ] Owner page shows property listing management
- [ ] Lead conversion captures transaction details
- [ ] Navigation updated (no Sellers link)

### End-to-End Tests
1. **Buyer Journey:**
   - Create buyer lead with requirements
   - Add activity notes
   - Convert with purchase transaction
   - Verify buyer created with purchases[]
   - Verify notes migrated
   - Add second purchase to same buyer

2. **Tenant Journey:**
   - Create tenant lead
   - Convert with lease details
   - Verify tenant created with currentRental
   - Update lease details
   - Archive rental (move to history)
   - Lease new property (new currentRental)

3. **Owner Journey:**
   - Create owner with KYC
   - Create property
   - List property for sale
   - Mark as sold to buyer
   - Verify property.saleInfo populated

4. **Seller to Owner Migration:**
   - Create seller-type lead
   - Convert to owner
   - Verify OWNER created
   - Verify PROPERTY created with status='for-sale'

---

## 📝 Documentation Updates Needed

- [ ] API documentation for new endpoints
- [ ] Update Postman collection
- [ ] Frontend integration guide
- [ ] Migration guide for existing data
- [ ] Updated entity relationship diagram
- [ ] New conversion workflow documentation

---

## 🎯 Next Immediate Steps

1. **Update `server/routes/leads.js`** - Add transaction details to conversion endpoint
2. **Update `server/routes/properties.js`** - Add status management endpoints
3. **Update `server/routes/buyers.js`** - Add purchase management endpoints
4. **Update `server/routes/customers.js`** - Add rental management endpoints
5. **Test backend changes** with Postman/API testing
6. **Begin frontend refactoring** - Start with deleting seller pages
