# CRM Data Model Redesign - Progress Summary

## ✅ COMPLETED WORK

### Backend Implementation (100% Complete)

#### 1. Database Schema Updates ✅
**Files Modified:**
- `server/crmDynamodbService.js` (lines 56-125, 620-715, 2704-2768, 2985-2987)

**Changes:**
- **BUYER Entity**: Removed prospective fields (requirement, budget, preferredArea), added `purchases[]` array, `createdFrom` tracking, enhanced KYC with URLs
- **TENANT (CUSTOMER) Entity**: Removed prospective fields, added `currentRental{}` object, `rentalHistory[]` array, police verification fields
- **PROPERTY Entity**: Added lifecycle `status` enum, `listingStatus`, `rentalInfo{}`, `saleInfo{}`, property document S3 keys
- **SELLER Entity**: Completely removed - all functions deleted

#### 2. Helper Functions ✅
**File Created:** `server/crmHelpers.js`

**Functions:**
- `addPurchaseToBuyer()` - Add purchase record to buyer
- `updateBuyerPurchase()` - Update specific purchase
- `updateCurrentRental()` - Update tenant's active lease
- `moveTenantToHistory()` - Archive lease when it ends
- `listPropertyForSale()` - Set property status to for-sale
- `listPropertyForRent()` - Set property status to for-rent
- `markPropertySold()` - Record sale transaction
- `markPropertyRented()` - Record rental transaction
- `vacateProperty()` - Archive tenant and set property to vacant

#### 3. Backend Routes ✅
**Files Modified:**
- `server/routes/leads.js` - Updated conversion endpoint to accept `purchaseDetails`, `leaseDetails`, `kycDetails`
- `server/routes/crm.js` - Added 11 new endpoints:
  - Property: `/list-for-sale`, `/list-for-rent`, `/mark-sold`, `/mark-rented`, `/vacate`
  - Buyer: `/purchases` (POST/PUT)
  - Tenant: `/current-rental` (PUT), `/archive-rental` (POST), `/rental-history` (GET)
- `server/routes/sellers.js` - **DELETED**
- `server/server.js` - Removed sellers route registration

#### 4. Lead Conversion Logic ✅
**Updated Behavior:**
- **Buyer conversion**: Now requires `purchaseDetails.propertyId` - creates buyer with first purchase
- **Tenant conversion**: Now requires `leaseDetails.propertyId` - creates tenant with current rental
- **Seller-type lead**: Converts to OWNER + creates PROPERTY with `status='for-sale'`
- **Owner conversion**: Creates OWNER only (unchanged)

### Frontend Cleanup (100% Complete)

#### 1. Pages Deleted ✅
- `SellerList.tsx` - DELETED
- `SellerDetails.tsx` - DELETED

#### 2. Routes & Navigation ✅
**Files Modified:**
- `App.tsx` - Removed seller route imports and 3 seller routes
- `CRMDashboard.tsx` - Removed:
  - Seller stat card
  - "Add New Seller" quick action
  - Sellers navigation link
  - `sellers` count from state

#### 3. API Layer ✅
**File:** `services/api.ts`

**Removed Methods:**
- `getSellers()`, `getSeller()`, `createSeller()`, `updateSeller()`
- `getSellerNotes()`, `createSellerNote()`, `getSellerMetrics()`
- `uploadSellerDocuments()`, `getSellerWithDocuments()`
- `getContactSellers()`, `getSellerLeads()`

**Updated:**
- `getContactsByRole()` - Removed 'seller' from type union
- Contact create/update - Removed `sellerProfile` parameter

#### 4. TypeScript Types ✅
**File:** `types/crm.ts`

**Removed:**
- `SellerProfile` interface
- `seller: boolean` from `ContactRoles`
- `sellerProfile` from contact interfaces
- `seller` from lead metrics byType

**Kept:**
- `LeadType` still includes 'seller' (leads can be seller-type before conversion to owner)
- `SellerProperty` interface (for lead data before conversion)

---

## 🚧 REMAINING WORK

### Component Refactoring (Major Updates Needed)

#### 1. BuyerDetails.tsx ⏳
**Current State:** Shows prospect fields (requirement, budget, preferredArea, bhk)
**Target State:** Show post-purchase data

**Required Changes:**
- Remove: Buyer Requirements section (budget, preferred area, BHK, property type, timeline)
- Remove: Priority dropdown
- Remove: Status dropdown with prospect stages
- Add: Purchases section displaying `purchases[]` array
- Add: Purchase detail cards showing:
  - Property ID/name
  - Purchase date, sale amount
  - Registration number, registration date
  - Documents (sale deed, registration doc)
  - Loan details if applicable
- Add: "Add Purchase" button/modal
- Keep: KYC documents, notes, meetings
- Update: Form validation to match new schema

#### 2. TenantDetails.tsx ⏳
**Current State:** Shows prospect fields (requirement, budget, preferredArea)
**Target State:** Show post-lease data

**Required Changes:**
- Remove: Tenant Requirements section
- Add: Current Rental section showing:
  - Property details
  - Lease start/end dates
  - Monthly rent, security deposit
  - Lease agreement document link
  - Deposit receipt link
- Add: Rental History table showing `rentalHistory[]`
- Add: "Update Lease" button
- Add: "Archive to History" button (moves current to history)
- Keep: KYC documents, notes, meetings
- Update: Form validation

#### 3. OwnerDetails.tsx ⏳
**Current State:** Basic owner info
**Target State:** Property listing management

**Required Changes:**
- Add: Properties section listing all owned properties
- Add: Property management actions per property:
  - "List for Sale" button → modal with price input
  - "List for Rent" button → modal with rent/deposit
  - Status badges (for-sale, for-rent, rented, sold)
- Add: Bank details section (for receiving payments)
- Keep: KYC documents, notes, meetings
- Enhance: Show property count in header

#### 4. LeadDetails.tsx ⏳
**Current State:** Simple conversion without transaction data
**Target State:** Transaction capture during conversion

**Required Changes:**
- Update conversion modal for **BUYER leads**:
  - Add: Property selection dropdown
  - Add: Purchase details form (sale amount, registration date, etc.)
  - Add: Loan details section
  - Add: KYC quick capture (PAN, Aadhar numbers)
  - Validation: Require property ID and sale amount

- Update conversion modal for **TENANT leads**:
  - Add: Property selection dropdown
  - Add: Lease details form (start/end dates, rent, deposit)
  - Add: KYC quick capture (Aadhar)
  - Validation: Require property ID and lease details

- Update conversion for **SELLER leads**:
  - Show: Property creation preview
  - Add: Option to auto-create property listing
  - Pre-fill: Property data from lead.sellerProperty

- Keep **OWNER** conversion simple (unchanged)

---

## 📝 Implementation Notes

### Data Migration Considerations
- Existing BUYER records have old schema - frontend should handle gracefully
- Check if `purchases` array exists before rendering
- Show "No purchases yet" state for legacy buyers
- Similar handling for tenant `currentRental` and `rentalHistory`

### API Integration
New endpoints to use in components:
```typescript
// Buyer purchases
POST   /api/crm/buyers/:id/purchases
PUT    /api/crm/buyers/:id/purchases/:propertyId

// Tenant rentals
PUT    /api/crm/customers/:id/current-rental
POST   /api/crm/customers/:id/archive-rental
GET    /api/crm/customers/:id/rental-history

// Property status
POST   /api/crm/properties/:id/list-for-sale
POST   /api/crm/properties/:id/list-for-rent
POST   /api/crm/properties/:id/mark-sold
POST   /api/crm/properties/:id/mark-rented
POST   /api/crm/properties/:id/vacate
```

### Testing Strategy
1. Create new buyer lead → convert with purchase details → verify buyer has purchases[]
2. Create new tenant lead → convert with lease details → verify currentRental
3. Archive tenant rental → verify rentalHistory updated
4. Create owner → list property for sale → verify status change
5. Mark property as sold → verify buyer link and saleInfo

---

## 🎯 Next Steps (Priority Order)

1. **BuyerDetails.tsx** - Remove requirements, add purchases display
2. **TenantDetails.tsx** - Add rental tracking
3. **OwnerDetails.tsx** - Add property listing management
4. **LeadDetails.tsx** - Add transaction capture modals
5. **End-to-end testing** - Verify complete flows

---

## 📊 Completion Status

| Category | Progress |
|----------|----------|
| Backend Schema | ✅ 100% |
| Backend Routes | ✅ 100% |
| Helper Functions | ✅ 100% |
| Frontend Cleanup | ✅ 100% |
| Type Definitions | ✅ 100% |
| **Component Refactoring** | ⏳ 0% |
| **Testing** | ⏳ 0% |
| **Overall** | **70%** |

The foundation is solid. Now implementing the UI layer to complete the transformation.
