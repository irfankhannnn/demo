# CRM Fix Plan — Detailed Step-by-Step

> **Status:** Draft  
> **Total Phases:** 5  
> **Estimated Tasks:** 35  
> **Priority:** High → Medium  

---

## Phase 1: Lead Conversion (P0 — Critical Business Flow)

### 1.1 Converted Lead → Clickable Link to Created Entity
**Goal:** After conversion, the "Lead Converted" banner must let the user navigate to the buyer/tenant/owner that was created.

- [ ] **Backend:** Ensure `convertLead` API response includes `convertedToEntityId` (the actual buyerId/tenantId/ownerId).
  - File: `agency-app/api/routes/leads.js` or equivalent
  - Check: Does backend already return this? If yes, expose it in the frontend types.
- [ ] **Types:** Add `convertedToEntityId?: string` to `CRMLead` type.
  - File: `src/types/crm.ts`
- [ ] **UI (LeadDetails):** Make the converted banner show a clickable link.
  - File: `src/pages/crm/LeadDetails.tsx` (converted banner section)
  - Pattern: `navigate(`/crm/${lead.convertedTo?.role}s/${lead.convertedToEntityId}`)`
- [ ] **UI (LeadDrawer):** Same clickable link in the drawer converted banner.
  - File: `src/pages/crm/LeadDrawer.tsx`

**Validation:** Convert a lead → click link → land on buyer/tenant/owner details page.

---

### 1.2 Buyer Conversion — Filter to Available Properties Only
**Goal:** The property dropdown in buyer conversion must only show properties with `status === 'available'`.

- [ ] **API Helper:** Add `api.getAvailableProperties()` that calls backend with `?status=available`.
  - File: `src/services/api.ts`
  - Or reuse existing `api.getCRMProperties('available')` if it supports it.
- [ ] **LeadDetails:** Replace `loadProperties()` to fetch only `available` properties.
  - File: `src/pages/crm/LeadDetails.tsx` (~line 248)
- [ ] **LeadDrawer:** Same fix — if drawer also has conversion UI for buyers.
  - File: `src/pages/crm/LeadDrawer.tsx`

**Validation:** Open buyer conversion modal → dropdown shows only properties marked available.

---

### 1.3 Seller Lead Conversion — Capture Property Details
**Goal:** Seller lead conversion must create a property using the `sellerProperty` data already captured on the lead.

- [ ] **Backend (check):** Verify `/leads/:id/convert` for `seller` type accepts a property payload or auto-creates one.
  - If backend doesn't support this, backend task needed.
- [ ] **Frontend — Build Conversion Modal for Seller:**
  - Reuse the property creation form fields (type, area, expected price, BHK).
  - Prefill from `lead.sellerProperty`.
  - File: `src/pages/crm/LeadDetails.tsx` — add a seller-specific conversion section
- [ ] **Frontend — Send Property Data in Payload:**
  - Modify `handleConvert` to include `sellerProperty` details in the conversion payload.
  - File: `src/pages/crm/LeadDetails.tsx` (~line 497)

**Validation:** Convert a seller lead → a new property is created with the correct title, area, expected price.

---

### 1.4 Owner Lead Conversion — Capture Property + Link to Owner
**Goal:** Owner lead conversion must create an owner AND prompt for the property they want to rent out.

- [ ] **Frontend — Add Owner Conversion Flow:**
  - After owner is created, show a mini "Add Property" form inline (or redirect to property creation with `ownerId` preselected).
  - File: `src/pages/crm/LeadDetails.tsx` — owner conversion section
- [ ] **Frontend — Prefill Property Data:**
  - Use `lead.ownerProperty` (area, expected rent) to prefill the property form.
  - File: `src/pages/crm/LeadDetails.tsx`

**Validation:** Convert an owner lead → owner created → property created with owner linked.

---

### 1.5 Allow Lead Type Change After Creation
**Goal:** An existing lead's type should be editable until converted.

- [ ] **UI:** Move the lead type dropdown outside the `isNew` guard.
  - File: `src/pages/crm/LeadDetails.tsx` (~line 687)
- [ ] **UI (Drawer):** Same change in `LeadDrawer.tsx`.
- [ ] **State Reset:** When type changes, show a confirmation: "Changing lead type will reset type-specific data. Continue?"
  - Clear `buyerRequirement`, `sellerProperty`, `tenantRequirement`, `ownerProperty` on type change.

**Validation:** Open an existing lead → change type from buyer to tenant → type-specific fields update.

---

### 1.6 Remove Hard `selectedOwner` Requirement for Tenant Conversion
**Goal:** Allow tenant conversion on properties without an external owner (agency-managed).

- [ ] **Validation Logic:** Make `selectedOwner` optional in tenant conversion.
  - File: `src/pages/crm/LeadDetails.tsx` (~line 471)
- [ ] **Payload Logic:** Only include `ownerId` in payload if an owner was selected.

**Validation:** Convert a tenant on an unassigned property → succeeds without owner.

---

## Phase 2: Property Status & Lifecycle (P0 — Data Integrity)

### 2.1 Unify Property Status Enums
**Goal:** One canonical set of statuses used everywhere.

- [ ] **Decision:** Define the unified enum:
  ```ts
type PropertyStatus = 
  | 'available'      // Vacant, for rent or sale
  | 'on_hold'        // Temporarily blocked
  | 'rented'         // Active lease
  | 'for_sale'       // Explicitly listed for sale
  | 'sold'           // Transaction complete
  | 'under_construction' // Not ready
  ```
- [ ] **Type Update:** Update `CRMProperty` type.
  - File: `src/types/crm.ts`
- [ ] **OwnerDetails Badge:** Replace owner-specific statuses with unified ones.
  - File: `src/pages/crm/OwnerDetails.tsx` (~line 293)
- [ ] **PropertyDetails Form:** Update the status dropdown.
  - File: `src/pages/crm/PropertyDetails.tsx`
- [ ] **PropertyList Filters:** Update filter options.
  - File: `src/pages/crm/PropertyList.tsx`
- [ ] **RentedProperties:** Ensure it still filters correctly.
  - File: `src/pages/crm/RentedProperties.tsx`

**Validation:** Create a property → set each status → verify badges render correctly in all views.

---

### 2.2 Add "Sold" Status & Sale Recording
**Goal:** When a buyer converts, the property gets marked "Sold" with permanent sale details.

- [ ] **Backend (check):** Does buyer conversion API update the property status? If not, add it.
- [ ] **Property Model:** Add `saleDetails?: { buyerId, saleAmount, saleDate, brokeragePaid, registrationNumber, stampDutyPaid }`.
  - File: `src/types/crm.ts`
- [ ] **PropertyDetails UI:** If `status === 'sold'`, show a read-only "Sale Details" section.
  - File: `src/pages/crm/PropertyDetails.tsx`
- [ ] **PropertyList:** Add a "Sold" status filter option.

**Validation:** Convert buyer lead → property status becomes "Sold" → sale details visible.

---

### 2.3 Assigning Tenant Auto-Updates Status + Prompts for Lease Details
**Goal:** When a tenant is assigned to a property via the form, enforce status = "rented" and capture lease details.

- [ ] **PropertyDetails:** When `tenantCustomerId` changes from empty to a value:
  - Auto-set `status` to `'rented'` (or prompt user to confirm).
  - Show inline lease detail inputs: `rentAmount`, `securityDeposit`, `tenantMoveInDate`, `tenureMonths`.
  - File: `src/pages/crm/PropertyDetails.tsx`
- [ ] **Validation:** Block save if tenant is set but `rentAmount` or `moveInDate` is missing.

**Validation:** Edit property → assign tenant → lease fields appear → save → property status = rented.

---

## Phase 3: Tenant Lifecycle (P1 — Daily Operations)

### 3.1 Add KYC Section to TenantDetails
**Goal:** Tenants need PAN, Aadhar, bank details, photo upload — same as owners.

- [ ] **Types:** Extend tenant/customer type with KYC fields.
  - File: `src/types/crm.ts`
- [ ] **UI:** Add KYC & Bank Details section to `TenantDetails.tsx`.
  - Copy pattern from `OwnerDetails.tsx` (~line 430 onwards).
  - Fields: PAN number, Aadhar number, bank name, account number, IFSC, photo upload.
- [ ] **API:** Wire to `api.uploadCustomerDocuments` or equivalent.
  - File: `src/services/api.ts` (check if exists, add if needed)

**Validation:** Open tenant page → fill KYC → save → reload → data persists.

---

### 3.2 Show Property Name (Not UUID) in Current Rental
**Goal:** Replace raw `propertyId` with a human-readable property link.

- [ ] **UI:** In `TenantDetails.tsx` Current Rental section (~line 363):
  - Fetch the property by `propertyId` (or include it in the customer API response).
  - Display: `{property.title} — {property.area} — {property.flatNumber}`
  - Make it a `<Link>` to `/crm/properties/{propertyId}`.
- [ ] **UI:** Same fix in Rental History section.

**Validation:** Tenant page → Current Rental shows property title → click → navigates to property.

---

### 3.3 Add "Vacated" Status + Move-Out Flow
**Goal:** Track when a tenant leaves and free the property.

- [ ] **Types:** Add `vacated` to customer status options.
  - File: `src/types/crm.ts`
- [ ] **UI (TenantDetails):** Add "Vacate Tenant" button (only when `status === 'active'`).
  - On click: prompt for `moveOutDate` and `vacateReason`.
  - Set tenant status to `'vacated'`, record `moveOutDate`.
- [ ] **UI (PropertyDetails):** When tenant is vacated, auto-set property `tenantCustomerId` to `''` and status to `'available'`.
- [ ] **UI (TenantDetails):** Show Rental History entry for the vacated tenancy.

**Validation:** Tenant active → click Vacate → enter date → tenant status = vacated → property becomes available.

---

### 3.4 Lease Renewal Flow
**Goal:** Renew an expiring lease without losing the old record.

- [ ] **Types:** Add `rentalHistory` array to property type (if not already there).
  - Each entry: `{ tenantId, rentAmount, leaseStartDate, leaseEndDate, securityDeposit }`
- [ ] **UI (RentedProperties):** On expiring property cards, add "Renew Lease" action.
- [ ] **UI:** Open renewal modal with pre-filled existing terms. Agent can adjust rent, deposit, new dates.
- [ ] **Backend (or Frontend Logic):** On renewal:
  - Append current tenancy to `rentalHistory`.
  - Update active tenancy fields with new values.

**Validation:** Property with 6-month lease → click Renew → adjust rent → save → history shows old lease, active shows new.

---

### 3.5 Fix Expiry Calculation to Prefer `leaseEndDate`
**Goal:** `RentedProperties` should use `leaseEndDate` when available.

- [ ] **Logic:** In `RentedProperties.tsx` (~line 25):
  ```ts
  const expiryDate = property.leaseEndDate 
    ? property.leaseEndDate 
    : calculateExpiryDate(property.tenantMoveInDate, property.tenureMonths);
  ```
- [ ] **PropertyDetails:** Ensure `leaseEndDate` is editable in the property form.

**Validation:** Set `leaseEndDate` to a date that doesn't match `moveInDate + tenureMonths` → RentedProperties shows correct expiry.

---

## Phase 4: Buyer & Enquiry Flows (P1)

### 4.1 Show Purchase History on Buyer Profile
**Goal:** Buyer page must show the property they actually bought, not just available ones.

- [ ] **API:** `api.getContactWithDocuments` (or buyer API) must return `purchasedProperties`.
- [ ] **UI (BuyerDetails):** Add a "Purchased Properties" section.
  - Shows: property title, sale amount, purchase date, registration number.
  - Each item is a link to the property page.
- [ ] **UI:** Keep existing "Interested Properties" (available/on-hold) but separate from "Purchased".

**Validation:** Convert buyer lead → open buyer profile → "Purchased Properties" shows the bought property with sale details.

---

### 4.2 Bridge Enquiry → Lead Conversion
**Goal:** An enquiry should be promotable to a lead (to enter the richer lead pipeline).

- [ ] **UI (EnquiryList):** Add "Convert to Lead" button in enquiry detail drawer.
  - File: `src/pages/crm/EnquiryList.tsx`
- [ ] **API:** Create `api.convertEnquiryToLead(enquiryId)` or implement client-side:
  - Create a new lead with: `name`, `phone`, `email`, `source: enquiry.source`, `leadType` derived from `convertedTo` or `userType`.
  - Link back: set `enquiryId` on the created lead.
- [ ] **UI (EnquiryList):** Allow enquiry conversion to `buyer` role (currently only owner/tenant).

**Validation:** Open enquiry → click "Convert to Lead" → new lead created with same details → enquiry status becomes "converted".

---

### 4.3 Sync Meeting Status → Enquiry Status
**Goal:** If a scheduled meeting is cancelled, revert enquiry status.

- [ ] **Logic:** In `EnquiryList.tsx` meeting status handler:
  - If meeting cancelled → check if it was the last scheduled meeting → if yes, set enquiry status back to `contacted`.
  - If meeting completed → set enquiry status to `contacted` (or a new `meeting_done` status if desired).

**Validation:** Enquiry status = meeting_scheduled → cancel meeting → enquiry status reverts.

---

## Phase 5: Khata Book & Cross-Cutting (P2)

### 5.1 Fix Predefined Category IDs
**Goal:** Predefined categories must use real backend IDs or be handled server-side.

- [ ] **Decision:** Move predefined categories to the backend.
  - Backend seeds `BROKERAGE`, `RENT`, `MAINTENANCE`, etc. as real rows in `khata_categories` table.
- [ ] **Frontend:** Remove `PREDEFINED_CATEGORIES` from `KhataEntryForm.tsx`.
  - Only fetch from `api.getKhataCategories()`.

**Validation:** Fresh tenant → Khata categories load correctly → filtering by category works in reports.

---

### 5.2 Auto-Create Khata Entry on Brokerage Collection
**Goal:** When a buyer lead is converted with `brokeragePaid`, automatically record it in Khata.

- [ ] **Backend:** In buyer conversion endpoint, after creating purchase record, call Khata creation with:
  - `category: 'Brokerage'`, `amount: brokeragePaid`, `transactionType: 'TO_TAKE'`.
- [ ] **Frontend (optional):** Show a toast: "Brokerage of ₹X recorded in Khata Book."

**Validation:** Convert buyer with ₹50,000 brokerage → Khata Book shows new entry.

---

### 5.3 Replace All `alert()` Calls with Toast
**Goal:** Consistent UX — no native browser alerts.

| File | Lines | Action |
|------|-------|--------|
| `OwnerDetails.tsx` | ~107, ~129, ~149, ~219 | Replace with `Toast` component |
| `BuyerDetails.tsx` | ~94, ~129 | Replace with `Toast` component |
| `LeadDrawer.tsx` | ~147, ~284, ~289 | Replace with `Toast` component |

- [ ] Audit all `alert()` calls in CRM pages.
- [ ] Replace with the existing `Toast` pattern (used in `TenantDetails.tsx`).

**Validation:** Trigger each error path → custom toast appears, no browser alert.

---

### 5.4 Add Owner Duplicate Detection (Phone Lookup)
**Goal:** Prevent duplicate owner records.

- [ ] **UI (OwnerDetails):** Add `onBlur` phone lookup.
  - Copy pattern from `TenantDetails.tsx` (~line 282).
  - On blur: call `api.getOwners()` and check for matching phone.
  - If match: show dialog "Owner with this phone already exists. Load existing record?"
- [ ] **API:** Consider adding `api.findOwnerByPhone(phone)` for efficiency.

**Validation:** Create owner with phone 9876543210 → create another with same phone → duplicate warning appears.

---

### 5.5 Convert "Source" to Dropdown
**Goal:** Standardize lead source tracking for analytics.

- [ ] **UI (LeadDetails, LeadDrawer):** Replace free-text `source` input with `<select>`.
  - Options: `Website`, `Referral`, `Walk-in`, `Google Ads`, `Social Media`, `Property Portal`, `Broker Network`, `Other`
- [ ] **Allow Custom:** Add "Other" option that reveals a text input for free-form entry.

**Validation:** Create lead → source dropdown → select "Referral" → analytics bucketed correctly.

---

### 5.6 Guard Reschedule Button to Scheduled Meetings Only
**Goal:** Completed/cancelled meetings should not be reschedulable.

- [ ] **UI (LeadDetails):** Add condition: `m.status === 'scheduled'` before rendering Reschedule button.
  - File: `src/pages/crm/LeadDetails.tsx` (~line 649)
- [ ] **UI (LeadDrawer):** Same fix.

**Validation:** Meeting completed → no Reschedule button shown.

---

### 5.7 Add "Lost Reason" to Leads
**Goal:** Track why leads are lost for pipeline improvement.

- [ ] **Types:** Add `lostReason?: string` and `lostAt?: string` to `CRMLead`.
- [ ] **UI (LeadDetails, LeadDrawer):** When status changes to `'lost'`:
  - Show a required dropdown: `Price too high`, `Found another property`, `Not interested anymore`, `Couldn't reach`, `Other`.
  - Record `lostAt = new Date().toISOString()`.
- [ ] **UI:** Show lost reason in the lead list (tooltip or column).

**Validation:** Change lead status to Lost → prompted for reason → reason saved → visible in list.

---

### 5.8 Optimize Dashboard API Calls
**Goal:** Dashboard should make 1 API call for counts, not 6.

- [ ] **Backend:** Ensure `api.getCRMMetrics()` returns:
  ```json
  {
    "buyerCount": 12,
    "sellerCount": 5,
    "ownerCount": 30,
    "tenantCount": 18,
    "leadCount": 45,
    "agreementsPending": 3,
    "verificationsPending": 2
  }
  ```
- [ ] **Frontend (CRMDashboard):** Replace 5 collection fetches + `getSellerCount()` with a single call to `getCRMMetrics()`.
  - File: `src/pages/crm/CRMDashboard.tsx` (~line 66)

**Validation:** Open dashboard → Network tab shows 1 metrics call → no full buyer/owner/tenant/lead arrays fetched.

---

### 5.9 Replace Raw `fetch()` in Owner Listing with API Service
**Goal:** Use the centralized `api` service for all calls.

- [ ] **API Service:** Add `api.listPropertyForSale(propertyId, listedPrice)` and `api.listPropertyForRent(propertyId, expectedRent, securityDeposit)`.
  - File: `src/services/api.ts`
- [ ] **OwnerDetails:** Replace `fetch()` calls with new API methods.
  - File: `src/pages/crm/OwnerDetails.tsx` (~line 248)

**Validation:** List property for sale → request goes through `api` service → auth handled consistently.

---

### 5.10 Add Backend-Filtered Owner/Tenant Properties
**Goal:** Stop fetching all properties to filter client-side.

- [ ] **Backend:** Add query params: `GET /api/crm/properties?ownerId=xyz` and `?tenantCustomerId=abc`.
- [ ] **API Service:** Add `api.getPropertiesByOwner(ownerId)` and `api.getPropertiesByTenant(tenantId)`.
- [ ] **OwnerDetails:** Replace client-side filter with new API.
- [ ] **TenantDetails:** Replace client-side filter with new API.

**Validation:** Open owner with 500 total properties in system → only their 3 properties fetched.

---

## Appendix: Files to Modify

| File | Phase | Tasks |
|------|-------|-------|
| `src/pages/crm/LeadDetails.tsx` | 1, 2, 3, 5 | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.3, 3.3, 5.6, 5.7 |
| `src/pages/crm/LeadDrawer.tsx` | 1, 5 | 1.1, 1.2, 5.6 |
| `src/pages/crm/PropertyDetails.tsx` | 2, 3 | 2.1, 2.2, 2.3, 3.3 |
| `src/pages/crm/PropertyList.tsx` | 2 | 2.1 |
| `src/pages/crm/RentedProperties.tsx` | 2, 3 | 2.1, 3.5 |
| `src/pages/crm/OwnerDetails.tsx` | 2, 5 | 2.1, 5.3, 5.4, 5.9, 5.10 |
| `src/pages/crm/TenantDetails.tsx` | 3, 5 | 3.1, 3.2, 3.3, 5.3, 5.10 |
| `src/pages/crm/BuyerDetails.tsx` | 4, 5 | 4.1, 5.3 |
| `src/pages/crm/EnquiryList.tsx` | 4, 5 | 4.2, 4.3 |
| `src/pages/crm/KhataEntryForm.tsx` | 5 | 5.1 |
| `src/pages/crm/CRMDashboard.tsx` | 5 | 5.8 |
| `src/types/crm.ts` | All | Type extensions |
| `src/services/api.ts` | All | New API methods |
| `agency-app/api/` (backend) | 1, 2, 4, 5 | Backend adjustments |

---

## Execution Order (Recommended)

1. **Backend prep first** — ensure APIs support what frontend needs (Phase 1.1, 1.3, 2.2, 4.1, 5.2, 5.8, 5.10).
2. **Phase 1** (Lead Conversion) — highest user impact.
3. **Phase 2** (Property Status) — data integrity foundation.
4. **Phase 3** (Tenant Lifecycle) — daily operations.
5. **Phase 4** (Buyer + Enquiry) — pipeline completeness.
6. **Phase 5** (Khata + Polish) — cross-cutting improvements.
