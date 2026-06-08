# Real Estate CRM - Comprehensive Testing Checklist
**Generated:** March 2026  
**Environment:** https://services-api.cloudberrysolutions.in/devrealestatecrm  
**Frontend:** http://localhost:8086 (or deployed URL)

---

## 🔐 SECTION 1: AUTHENTICATION & SECURITY

### 1.1 Login Page (`/login`)
**Base URL:** `/login`

#### Functional Tests
- [ ] **Valid Login**: Use correct username/password → Should redirect to `/crm`
- [ ] **Invalid Credentials**: Wrong password → Should show error message
- [ ] **Empty Fields**: Submit without filling → Should show validation errors
- [ ] **JWT Token Storage**: After login → Check `localStorage.admin_token` exists
- [ ] **Tenant ID Header**: Check `x-tenant-id` header is sent with API requests
- [ ] **Session Persistence**: Refresh page after login → Should stay logged in
- [ ] **Logout**: Click logout → Should clear token and redirect to `/login`

#### Security Tests
- [ ] **SQL Injection**: Try `admin' OR '1'='1` in username field
- [ ] **XSS Attack**: Try `<script>alert('xss')</script>` in login fields
- [ ] **CSRF Protection**: Verify CORS headers in OPTIONS response
- [ ] **Password Visibility**: Click eye icon → Should toggle password visibility
- [ ] **Brute Force**: Multiple failed attempts → Should not leak user existence
- [ ] **Token Expiration**: Use expired token → Should redirect to login
- [ ] **Unauthorized Access**: Try accessing `/crm` without token → Should redirect to `/login`

#### Performance Tests
- [ ] **Login Response Time**: Should complete in < 2 seconds
- [ ] **Network Tab**: Check for unnecessary API calls on load

---

### 1.2 Forgot Password Page (`/forgot-password`)
- [ ] **Email Validation**: Invalid email format → Should show error
- [ ] **Submit Form**: Valid email → Should show success/pending message
- [ ] **Back to Login**: Link works → Navigate to `/login`

---

### 1.3 Profile Page (`/profile`)
**URL:** `/profile`

- [ ] **Load User Data**: Profile information displays correctly
- [ ] **Update Profile**: Edit and save → Changes should persist
- [ ] **Image Upload**: Upload profile picture → Should display new image
- [ ] **Navigation**: Back button works correctly

---

## 📊 SECTION 2: CRM DASHBOARD

### 2.1 Main Dashboard (`/crm`)
**URL:** `/crm`

#### Dashboard Metrics
- [ ] **Leads Count**: Displays correct number
- [ ] **Buyers Count**: Displays correct number
- [ ] **Owners Count**: Displays correct number
- [ ] **Properties Count**: Displays total, available, rented counts
- [ ] **Tenants Count**: Displays correct number
- [ ] **Sellers Count**: Displays correct number

#### Navigation Cards
- [ ] **Leads Card**: Click → Navigate to `/crm/leads`
- [ ] **Buyers Card**: Click → Navigate to `/crm/buyers`
- [ ] **Owners Card**: Click → Navigate to `/crm/owners`
- [ ] **Properties Card**: Click → Navigate to `/crm/properties`
- [ ] **Tenants Card**: Click → Navigate to `/crm/tenants`
- [ ] **Sellers Card**: Click → Navigate to `/crm/owners?sellers=1`

#### Quick Actions
- [ ] **Add New Buyer**: Click → Navigate to `/crm/buyers/new`
- [ ] **Add New Tenant**: Click → Navigate to `/crm/tenants/new`
- [ ] **Create Lead**: Click → Navigate to `/crm/leads/new`

#### Quick Links Section
- [ ] **Calendar Link**: Navigate to `/crm/calendar`
- [ ] **Analytics Link**: Navigate to `/crm/analytics`
- [ ] **Khata Book Link**: Navigate to `/crm/khata`
- [ ] **Rented List Link**: Navigate to `/crm/rented-properties`
- [ ] **Tenants Link**: Navigate to `/crm/tenants`
- [ ] **Owners Link**: Navigate to `/crm/owners`
- [ ] **Buyers Link**: Navigate to `/crm/buyers`
- [ ] **AI Calling Link**: Navigate to `/crm/ai-calling`

#### Real Estate Management
- [ ] **Developers**: Navigate to `/crm/developers`
- [ ] **Areas & Communities**: Navigate to `/crm/real-estate-areas`
- [ ] **Projects**: Navigate to `/crm/projects`

#### Compliance Tracking
- [ ] **Agreements Pending**: Shows correct count
- [ ] **Verifications Pending**: Shows correct count
- [ ] **View Items Button**: Navigate to properties page

#### Performance
- [ ] **Page Load Time**: Dashboard loads in < 3 seconds
- [ ] **API Calls**: Check Network tab for efficient API usage
- [ ] **Duplicate Leads**: Verify NO duplicate leads cards appear

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the end user of this app is real estate agency admin or agent user - use case is a real estate agency using this tool to manage leads, properties, owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done
use localhost:3000 for testing this application 
use test user credentials for login: 
username: 8291537522
otp: 123456

## 👥 SECTION 3: LEADS MANAGEMENT
### 3.1 Lead List (`/crm/leads`)
**URL:** `/crm/leads`

#### List View
- [ ] **Load All Leads**: Page displays lead list
- [ ] **Lead Count**: Header shows correct total
- [ ] **Search Functionality**: Search by name/phone → Results filter correctly
- [ ] **Filter by Type**: Buyer/Owner/Tenant filters work
- [ ] **Filter by Status**: Active/Contacted/Converted filters work
- [ ] **Sort Options**: Sort by date/name/status works

#### Actions
- [ ] **View Lead Details**: Click lead → Navigate to `/crm/leads/:id`
- [ ] **Create New Lead**: Click "Add Lead" → Navigate to `/crm/leads/new`
- [ ] **Quick Convert**: Convert lead to buyer/owner/tenant → Updates status
- [ ] **Delete Lead**: Click delete → Confirm modal → Lead removed
- [ ] **Export Leads**: Export button → Download CSV/Excel

#### Performance
- [ ] **Pagination**: Load 50+ leads → Pagination works smoothly
- [ ] **Infinite Scroll**: Scroll performance with large dataset

---

### 3.2 Lead Details (`/crm/leads/:id` & `/crm/leads/new`)
**URLs:** `/crm/leads/new`, `/crm/leads/:id`

#### Create New Lead (All Lead Types) 
- [ ] **Form Validation**: Required fields marked
- [ ] **Name Input**: Enter name → Saves correctly
- [ ] **Phone Input**: Enter phone → Validates format (10 digits)
- [ ] **Email Input**: Enter email → Validates format
- [ ] **Lead Type (Buyer)**: Create a Buyer-type lead → Saves correctly; list shows type = Buyer
- [ ] **Lead Type (Owner)**: Create an Owner-type lead → Saves correctly; list shows type = Owner
- [ ] **Lead Type (Tenant)**: Create a Tenant-type lead → Saves correctly; list shows type = Tenant
- [ ] **Status**: Select status → Saves correctly
- [ ] **Source**: Select source → Saves correctly
- [ ] **Budget**: Enter budget → Saves correctly
- [ ] **Requirements**: Enter text → Saves correctly
- [ ] **Notes**: Add notes → Saves correctly
- [ ] **Save Lead**: Click save → Lead created, navigate to list

#### Edit Existing Lead
- [ ] **Load Lead Data**: All fields populated correctly
- [ ] **Update Fields**: Modify data → Save → Changes persist
- [ ] **Change Lead Type**: Switch type Buyer → Owner (if allowed) → Persisted and reflected in list

#### Conversations / Messages (Lead Activity History)
- [ ] **Open Conversations/Activity Tab**: Lead details shows a section/tab for conversations/messages/activity (if present)
- [ ] **Add Conversation Note**: Add a new message/note → Appears in history with timestamp and user
- [ ] **Message Ordering**: Latest appears at top (or consistent ordering) and persists after refresh
- [ ] **Edit Message**: Edit an existing message (if supported) → Updated text persists
- [ ] **Delete Message**: Delete an existing message (if supported) → Removed from history
- [ ] **Validation**: Prevent empty message submission
- [ ] **Long Text**: Add a long message (5000+ chars) → UI remains responsive and text renders safely
- [ ] **XSS Safety**: Message containing `<script>alert(1)</script>` renders as plain text (no execution)

#### Meetings (Create / Reschedule / Cancel) From a Lead
- [ ] **Create Meeting from Lead**: Create a meeting/site visit from lead details → Meeting is saved
- [ ] **Meeting Appears in Calendar**: Newly created meeting appears on `/crm/calendar`
- [ ] **Meeting Details Link Back**: From calendar event → Navigate back to lead (or shows linked contact) consistently
- [ ] **Reschedule Meeting**: Change date/time → Both lead and calendar show updated schedule
- [ ] **Cancel Meeting**: Cancel meeting (with reason if required) → Removed/marked cancelled in calendar and lead history
- [ ] **Past Meeting Status**: Mark meeting as completed → Status visible in meeting details and lead activity
- [ ] **Duplicate Prevention**: Double-click save on meeting → Should not create duplicates

#### Phone Lookup
- [ ] **Duplicate Check**: Enter existing phone → Shows existing records
- [ ] **Cross-Role Detection**: Shows if person exists as buyer/owner/tenant

#### Conversion (Buyer / Owner / Tenant) + Post-Conversion History Checks
- [ ] **Convert to Buyer**: Convert lead → Buyer record created; lead status updated to Converted
- [ ] **Convert to Owner**: Convert lead → Owner record created; lead status updated to Converted
- [ ] **Convert to Tenant**: Convert lead → Tenant record created; lead status updated to Converted
- [ ] **Conversion Creates/Links Correct Entity**: Converted entity has same phone/name and is reachable from lead (or via search)
- [ ] **Conversation History After Conversion**: Conversations/messages added on lead remain visible/accessible after conversion (via lead detail or converted entity)
- [ ] **Meeting History After Conversion**: Meetings created while lead existed remain visible and open correctly after conversion
- [ ] **Meeting Links Still Work**: Calendar event still opens correct details after conversion and does not break due to new entity type
- [ ] **Post-Conversion Add Activity**: Add a new message/note after conversion → Appears in correct history and is not lost

#### Delete Lead
- [ ] **Delete Lead**: Click delete → Confirm → Lead removed
- [ ] **Delete Safety**: If lead has meetings/conversations, confirm behaviour (blocked, soft delete, or cascade) is correct and user-friendly

#### Performance
- [ ] **Form Responsiveness**: Typing/selection should be instant
- [ ] **Save Time**: Save operation < 1 second
- [ ] **Activity Load Time**: Conversations/meetings history loads in < 1 second

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 🏠 SECTION 4: OWNERS MANAGEMENT

### 4.1 Owner List (`/crm/owners`)
**URL:** `/crm/owners`

#### List View
- [ ] **Load All Owners**: Display owner list with properties count
- [ ] **Search**: Search by name/phone/address → Filters correctly
- [ ] **Filter by Status**: Active/Inactive filters work
- [ ] **Property Count**: Shows number of properties per owner
- [ ] **Sort Options**: Sort by name/properties/date

#### Actions
- [ ] **View Owner**: Click → Navigate to `/crm/owners/:id`
- [ ] **Add Owner**: Click "Add Owner" → Navigate to `/crm/owners/new`
- [ ] **Quick View Properties**: Show owner's properties inline
- [ ] **Seller Filter**: URL param `?sellers=1` → Shows only sellers

#### Seller List View (Real-World Flow)
- [ ] **Open Seller Mode**: Navigate to `/crm/owners?sellers=1` → Only seller-tagged records are shown
- [ ] **Seller Search**: Search by name/phone → Filters correctly
- [ ] **Seller Details Navigation**: Click seller → Opens `/crm/owners/:id` correctly

#### Performance
- [ ] **Load Time**: List loads in < 2 seconds
- [ ] **Seller Backfill**: Contacts with seller role auto-create owner records

---

### 4.2 Owner Details (`/crm/owners/:id` & `/crm/owners/new`)
**URLs:** `/crm/owners/new`, `/crm/owners/:id`

#### Create New Owner
- [ ] **Name**: Required, saves correctly
- [ ] **Phone**: Required, 10-digit validation, deduplication check
- [ ] **Email**: Optional, email format validation
- [ ] **Address**: Text area, saves correctly
- [ ] **PAN Number**: Optional, format validation
- [ ] **Aadhaar Number**: Optional, format validation
- [ ] **Bank Details**: Account number, IFSC, bank name
- [ ] **Notes**: Free text, saves correctly
- [ ] **Status**: Active/Inactive dropdown
- [ ] **Save Owner**: Creates record, redirects to list

#### Edit Owner
- [ ] **Load Owner Data**: All fields populated
- [ ] **Update Fields**: Modify → Save → Changes persist
- [ ] **Add Property**: Link new property to owner
- [ ] **View Properties**: List of owner's properties
- [ ] **Navigate to Property**: Click property → Go to property details

#### Post-Conversion Validation (If Owner Was Created via Lead Conversion)
- [ ] **Source Traceability**: Owner record indicates it was created from a lead (UI link, reference ID, or discoverable via phone search)
- [ ] **Conversation History**: Lead conversations/messages remain accessible (either still on the lead or visible on owner activity/history if supported)
- [ ] **Meeting History**: Meetings created from the lead are still visible and open correctly from Calendar

#### Document Uploads
- [ ] **Upload PAN Card**: PDF/Image → Upload success
- [ ] **Upload Aadhaar**: PDF/Image → Upload success
- [ ] **Upload Bank Passbook**: PDF/Image → Upload success
- [ ] **View Documents**: Click document → Opens in new tab
- [ ] **Delete Document**: Remove document → Confirms deletion
- [ ] **File Size Limit**: Upload 10MB+ file → Should show size error
- [ ] **File Type Validation**: Upload .exe file → Should reject

#### Notes Management
- [ ] **Add Note**: Enter text → Save → Note added with timestamp
- [ ] **Edit Note**: Modify existing note → Changes saved
- [ ] **Delete Note**: Remove note → Confirms deletion
- [ ] **Note History**: Shows created/updated timestamps

#### Conversations / Discussion History (Real-World Agency Use)
- [ ] **Record First Call Summary**: Add a discussion note like “Owner asked 2 weeks notice, prefers family tenants” → Persists
- [ ] **Negotiation Notes**: Add multiple notes over time (pricing, availability, objections) → Visible as a chronological thread
- [ ] **Internal vs Customer Notes**: If UI supports visibility types, verify internal-only notes are not exposed in any customer-facing view
- [ ] **Attachments in Conversation**: If supported, attach a document/image to a note → Upload succeeds and can be opened
- [ ] **Audit Trail**: Note shows created by user and timestamp

#### Meetings (Site Visit / Owner Meeting) (Real-World Agency Use)
- [ ] **Schedule Owner Meeting**: Create a meeting from Owner details (property inspection/key pickup) → Saved successfully
- [ ] **Reschedule Owner Meeting**: Move meeting time due to owner availability → Updates on Owner and Calendar
- [ ] **Cancel Owner Meeting**: Cancel with reason “Owner out of station” → Calendar shows cancelled/removed and history retains context
- [ ] **No-show Handling**: Mark as no-show (if supported) → Status visible and follow-up suggested
- [ ] **Create Follow-up Meeting**: Create follow-up from meeting details → Linked correctly

#### Khata Integration
- [ ] **View Khata Button**: Click → Navigate to khata filtered by owner
- [ ] **Add Khata Entry**: Click → Navigate to khata form with owner prefilled

#### Performance
- [ ] **Form Load**: < 1 second
- [ ] **Document Upload**: Shows progress bar
- [ ] **Large Documents**: 5MB+ upload handles correctly

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done -- usename is admin and password is admin123098

## 🏢 SECTION 5: PROPERTIES MANAGEMENT ---- done

### 5.1 Property List (`/crm/properties`)
**URL:** `/crm/properties`

#### List View
- [ ] **Load Properties**: Grid/List view with thumbnails
- [ ] **Search**: By address/area/type → Filters correctly
- [ ] **Filter by Status**: Available/Rented/Sold/On-hold
- [ ] **Filter by Type**: Residential/Commercial
- [ ] **Filter by Category**: 1BHK/2BHK/3BHK/Villa/Plot
- [ ] **Filter by Owner**: Select owner → Show their properties
- [ ] **Sort**: By price/area/date/status

#### Actions
- [ ] **View Property**: Click → Navigate to `/crm/properties/:id`
- [ ] **Add Property**: Click "Add Property" → Navigate to `/crm/properties/new`
- [ ] **Quick Actions**: Mark as rented/sold from list
- [ ] **Bulk Actions**: Select multiple → Bulk status update
- [ ] **Export**: Download property list

#### Map View
- [ ] **Toggle Map**: Switch to map view
- [ ] **Property Markers**: Properties show on Google Maps
- [ ] **Click Marker**: Shows property preview
- [ ] **Navigate from Map**: Click property → Go to details

#### Performance
- [ ] **Image Loading**: Lazy load thumbnails
- [ ] **Map Performance**: Handles 100+ markers
- [ ] **Filter Speed**: Instant filtering

---

### 5.2 Property Details (`/crm/properties/:id` & `/crm/properties/new`)
**URLs:** `/crm/properties/new`, `/crm/properties/:id`

#### Create New Property
- [ ] **Owner Selection**: Dropdown/search, required
- [ ] **Property Type**: Residential/Commercial
- [ ] **Category**: 1BHK/2BHK/3BHK/Villa/Plot/Shop/Office
- [ ] **Address**: Full address with pincode
- [ ] **Area/Location**: Select from dropdown or add new
- [ ] **Carpet Area**: Number input with unit (sq ft)
- [ ] **Built-up Area**: Number input
- [ ] **Plot Area**: For plots/villas
- [ ] **Rent Amount**: For rental properties
- [ ] **Sale Price**: For sale properties
- [ ] **Deposit Amount**: Security deposit
- [ ] **Description**: Rich text area
- [ ] **Amenities**: Checkboxes for parking/lift/gym/pool/security
- [ ] **Floor Number**: For flats
- [ ] **Total Floors**: Building floors
- [ ] **Facing**: North/South/East/West
- [ ] **Furnishing**: Furnished/Semi/Unfurnished
- [ ] **Age of Property**: Years
- [ ] **Possession Status**: Ready/Under construction
- [ ] **Save Property**: Creates record

#### Edit Property
- [ ] **Load Property Data**: All fields populated
- [ ] **Update Fields**: Modify → Save → Changes persist
- [ ] **Change Status**: Available → Rented → Update tenant details
- [ ] **Change Status**: Available → Sold → Update buyer details
- [ ] **Mark On Hold**: Status → On hold
- [ ] **Vacate Property**: Rented → Available → Move tenant to history

#### Image & Document Uploads
- [ ] **Upload Property Images**: Multiple images (JPEG/PNG/WebP)
- [ ] **Image Preview**: Click → View full size
- [ ] **Set Featured Image**: Mark one as primary
- [ ] **Reorder Images**: Drag and drop to reorder
- [ ] **Delete Image**: Remove → Confirms deletion
- [ ] **Upload Videos**: MP4/MOV up to 100MB
- [ ] **Video Player**: Play video inline
- [ ] **Upload Documents**: Agreements, NOC, blueprints (PDF)
- [ ] **Document Preview**: PDF opens in new tab
- [ ] **File Type Validation**: Reject invalid file types
- [ ] **File Size Limits**: Images 10MB, Videos 100MB
- [ ] **Batch Upload**: Select 10+ images → Upload all

#### Agreement Management
- [ ] **Create Agreement**: Add rental/sale agreement
- [ ] **Agreement Template**: Generate from template
- [ ] **Upload Signed Agreement**: PDF upload
- [ ] **Agreement Status**: Pending/Signed/Expired
- [ ] **View Agreement**: Download/preview PDF
- [ ] **Delete Agreement**: Remove agreement

#### Verification Management
- [ ] **Create Verification**: Add verification record
- [ ] **Verification Type**: Police/Owner/Document
- [ ] **Verification Status**: Pending/Completed/Failed
- [ ] **Upload Verification Docs**: Police clearance, ID proofs
- [ ] **Update Status**: Mark as completed
- [ ] **View Verification**: All verification history

#### Rental Details (for rented properties)
- [ ] **Tenant Selection**: Link to existing tenant
- [ ] **Rent Start Date**: Date picker
- [ ] **Rent Amount**: Monthly rent
- [ ] **Deposit Paid**: Security deposit amount
- [ ] **Rent Due Date**: Day of month
- [ ] **Lock-in Period**: Duration in months
- [ ] **Rent History**: Track rent payments
- [ ] **Generate Rent Receipt**: PDF receipt

#### Sale Details (for sold properties)
- [ ] **Buyer Selection**: Link to existing buyer
- [ ] **Sale Price**: Final sale amount
- [ ] **Sale Date**: Transaction date
- [ ] **Sale Agreement**: Upload agreement
- [ ] **Commission**: Agent commission amount
- [ ] **Payment Terms**: Full/Installment

#### Google Maps Integration
- [ ] **Address Autocomplete**: Type address → Google suggestions
- [ ] **Select Location on Map**: Drag marker to exact location
- [ ] **Latitude/Longitude**: Auto-populate from map
- [ ] **View on Map**: Property location displayed correctly
- [ ] **Nearby Properties**: Show nearby listings

#### Performance
- [ ] **Image Upload**: Progress indicator for each file
- [ ] **Large Images**: Auto-resize before upload
- [ ] **Video Upload**: Chunked upload for large files
- [ ] **Save Time**: Property save < 2 seconds

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done -- usename is admin and password is admin123098
## 👨‍👩‍👧‍👦 SECTION 6: TENANTS MANAGEMENT

### 6.1 Tenant List (`/crm/tenants`)
**URL:** `/crm/tenants`

#### List View
- [ ] **Load Tenants**: Display all tenant records
- [ ] **Current Tenants**: Filter by active rentals
- [ ] **Past Tenants**: Filter by historical rentals
- [ ] **Search**: Name/phone/property address
- [ ] **Property Info**: Shows current rented property
- [ ] **Rent Status**: Paid/Pending/Overdue indicator

#### Actions
- [ ] **View Tenant**: Click → Navigate to `/crm/tenants/:id`
- [ ] **Add Tenant**: Click → Navigate to `/crm/tenants/new`
- [ ] **Quick Contact**: Phone/email/WhatsApp buttons
- [ ] **Rent Reminder**: Send payment reminder

---

### 6.2 Tenant Details (`/crm/tenants/:id` & `/crm/tenants/new`)
**URLs:** `/crm/tenants/new`, `/crm/tenants/:id`

#### Create New Tenant
- [ ] **Name**: Required field
- [ ] **Phone**: 10-digit validation, duplicate check
- [ ] **Email**: Email format validation
- [ ] **Address**: Current address
- [ ] **ID Proof Type**: Aadhaar/PAN/Passport/Driving License
- [ ] **ID Proof Number**: Format validation
- [ ] **Occupation**: Text field
- [ ] **Company Name**: Employer details
- [ ] **Emergency Contact**: Name and phone
- [ ] **Family Members**: Count
- [ ] **Save Tenant**: Creates record

#### Edit Tenant
- [ ] **Update Details**: Modify fields → Save
- [ ] **Link Property**: Assign to rental property
- [ ] **Unlink Property**: Vacate tenant
- [ ] **Rent History**: View all past rentals

#### Post-Conversion Validation (If Tenant Was Created via Lead Conversion)
- [ ] **Source Traceability**: Tenant record indicates it was created from a lead (UI link, reference ID, or discoverable via phone search)
- [ ] **Conversation History**: Lead conversations/messages remain accessible (either still on the lead or visible on tenant activity/history if supported)
- [ ] **Meeting History**: Meetings created from the lead are still visible and open correctly from Calendar

#### Document Uploads
- [ ] **Upload ID Proof**: Aadhaar/PAN (PDF/Image)
- [ ] **Upload Photo**: Profile picture
- [ ] **Upload Police Verification**: PDF
- [ ] **Upload Previous Rent Receipts**: Multiple PDFs
- [ ] **View Documents**: Click to preview/download
- [ ] **Delete Documents**: Remove document

#### Rent Management
- [ ] **Record Rent Payment**: Add payment entry
- [ ] **Payment Date**: Date picker
- [ ] **Amount Paid**: Number input
- [ ] **Payment Mode**: Cash/UPI/Cheque/Bank Transfer
- [ ] **Transaction ID**: For digital payments
- [ ] **Late Fee**: Calculate if overdue
- [ ] **Generate Receipt**: PDF rent receipt
- [ ] **Payment History**: View all payments
- [ ] **Pending Amount**: Shows outstanding rent

#### Notes & Communication
- [ ] **Add Note**: Tenant interaction notes
- [ ] **Communication Log**: Call/email history
- [ ] **Set Reminders**: Rent payment reminders

#### Conversations / Discussion History (Real-World Agency Use)
- [ ] **Onboarding Conversation**: Add notes for “KYC pending, needs move-in date confirmation” → Persists and is time-stamped
- [ ] **Complaint/Request Thread**: Add multiple notes for a maintenance request (water leakage) → Thread remains readable and ordered
- [ ] **Payment Follow-up Notes**: Add notes for “Sent rent reminder on WhatsApp” → Saved correctly
- [ ] **XSS Safety**: Notes/messages render safely as plain text

#### Meetings (Tenant) (Real-World Agency Use)
- [ ] **Schedule Move-in Inspection**: Create meeting “Move-in inspection” linked to tenant + property → Appears in Calendar
- [ ] **Reschedule Inspection**: Tenant requests different time → Calendar + tenant history update
- [ ] **Cancel Inspection**: Cancel with reason “Tenant postponed move-in” → Visible in Calendar and history
- [ ] **Post-Meeting Notes**: Add meeting outcome notes (keys handed over, meter reading) → Stored and visible

#### Khata Integration
- [ ] **View Khata**: Navigate to tenant's khata entries
- [ ] **Add Khata Entry**: Prefilled with tenant details

---
---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done
## 🛒 SECTION 7: BUYERS MANAGEMENT

### 7.1 Buyer List (`/crm/buyers`)
**URL:** `/crm/buyers`

#### List View
- [ ] **Load Buyers**: Display all buyer records
- [ ] **Active Buyers**: Currently searching
- [ ] **Converted Buyers**: Already purchased
- [ ] **Search**: Name/phone/budget/requirements
- [ ] **Filter by Budget**: Price range filter
- [ ] **Filter by Property Type**: 1BHK/2BHK/Villa/Plot
- [ ] **Filter by Status**: Active/Contacted/Site-visit/Negotiation/Closed
- [ ] **Filter by Priority**: Hot/Warm/Cold

#### Actions
- [ ] **View Buyer**: Click → Navigate to `/crm/buyers/:id`
- [ ] **Add Buyer**: Click → Navigate to `/crm/buyers/new`
- [ ] **Match Properties**: Show matching properties for buyer
- [ ] **Schedule Site Visit**: Create calendar event
- [ ] **Send Property Links**: Share via email/WhatsApp

---

### 7.2 Buyer Details (`/crm/buyers/:id` & `/crm/buyers/new`)
**URLs:** `/crm/buyers/new`, `/crm/buyers/:id`

#### Create New Buyer
- [ ] **Name**: Required
- [ ] **Phone**: 10-digit validation, duplicate check
- [ ] **Email**: Email validation
- [ ] **Budget Range**: Min-Max price
- [ ] **Property Type**: 1BHK/2BHK/3BHK/Villa/Plot/Commercial
- [ ] **Preferred Locations**: Multiple area selection
- [ ] **Purpose**: Investment/Self-use/Rental
- [ ] **Timeline**: Immediate/1-3 months/3-6 months/6+ months
- [ ] **Funding**: Cash/Loan/Pre-approved
- [ ] **Requirements**: Specific requirements text
- [ ] **Status**: Active/Contacted/Site-visit/Negotiation/Closed
- [ ] **Priority**: Hot/Warm/Cold
- [ ] **Source**: Website/Referral/Walk-in/Advertisement
- [ ] **Save Buyer**: Creates record

#### Edit Buyer
- [ ] **Update Details**: Modify → Save
- [ ] **Add Purchase**: Record property purchase
- [ ] **Purchase Details**: Property, price, date
- [ ] **Commission Earned**: Calculate agent commission

#### Post-Conversion Validation (If Buyer Was Created via Lead Conversion)
- [ ] **Source Traceability**: Buyer record indicates it was created from a lead (UI link, reference ID, or discoverable via phone search)
- [ ] **Conversation History**: Lead conversations/messages remain accessible (either still on the lead or visible on buyer activity/history if supported)
- [ ] **Meeting History**: Meetings created from the lead are still visible and open correctly from Calendar

#### Cross-Role Detection
- [ ] **Phone Lookup**: Shows if buyer exists as owner/tenant/lead
- [ ] **Linked Roles**: Display all roles for same person
- [ ] **Unified Profile**: View all interactions

#### Property Matching
- [ ] **Auto-Match**: System suggests matching properties
- [ ] **Manual Match**: Agent adds properties to shortlist
- [ ] **Send Shortlist**: Email/WhatsApp property links
- [ ] **Track Views**: Monitor which properties viewed
- [ ] **Feedback**: Record buyer feedback on properties

#### Conversations / Discussion History (Real-World Agency Use)
- [ ] **Qualification Notes**: Record buyer requirements refinement (budget stretch, preferred areas, deal breakers)
- [ ] **Negotiation Thread**: Add notes for offers/counter-offers → Maintains a clear history
- [ ] **Sharing Links Proof**: Add note “Sent 3 properties on WhatsApp” + attach screenshots/files if supported
- [ ] **Follow-up Reminders**: Add a follow-up note and schedule a meeting → Both appear consistently

#### Meetings (Site Visits / Negotiation / Follow-up)
- [ ] **Create Site Visit Meeting**: Schedule site visit for selected property → Appears in Calendar
- [ ] **Multi-visit Scenario**: Schedule 2 visits for same buyer, different properties → Both show and remain distinct
- [ ] **Cancel Visit**: Cancel one visit “Buyer unavailable” → Cancellation reflected everywhere
- [ ] **Meeting Outcome**: Mark completed and record buyer feedback → Visible in buyer history

#### Site Visit Management
- [ ] **Schedule Visit**: Add to calendar
- [ ] **Property Selection**: Which property to visit
- [ ] **Visit Date/Time**: Date-time picker
- [ ] **Assign Agent**: Select agent for visit
- [ ] **Visit Status**: Scheduled/Completed/Cancelled
- [ ] **Visit Feedback**: Record buyer impressions
- [ ] **Follow-up**: Set follow-up reminder

#### Purchase History
- [ ] **View Purchases**: List of properties bought
- [ ] **Purchase Details**: Property, price, commission
- [ ] **Sale Documents**: Upload sale agreements
- [ ] **Commission Tracking**: Track earnings per buyer

#### Documents
- [ ] **Upload ID Proof**: PAN/Aadhaar
- [ ] **Upload Loan Documents**: Pre-approval letters
- [ ] **Upload Bank Statements**: Financial proof
- [ ] **View/Download Documents**: Access uploaded files

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done --- usename is admin and password is admin123098

## 📅 SECTION 8: CALENDAR & MEETINGS

### 8.1 Calendar View (`/crm/calendar`)
**URL:** `/crm/calendar`

#### Calendar Display
- [ ] **Month View**: Shows month calendar with events
- [ ] **Week View**: Shows week calendar
- [ ] **Day View**: Shows single day schedule
- [ ] **Today Button**: Jump to today's date
- [ ] **Navigate Months**: Previous/Next month arrows
- [ ] **Event Display**: Meetings shown with color coding

#### Meeting Management
- [ ] **Create Meeting**: Click date/time → Create meeting
- [ ] **Meeting Title**: Enter title
- [ ] **Meeting Type**: Site-visit/Client-meeting/Follow-up/Inspection
- [ ] **Select Property**: Link to property (if applicable)
- [ ] **Select Contact**: Link to buyer/owner/tenant
- [ ] **Date & Time**: Date-time picker
- [ ] **Duration**: Meeting length
- [ ] **Location**: Meeting address
- [ ] **Notes**: Meeting agenda/notes
- [ ] **Reminder**: Set reminder notification
- [ ] **Save Meeting**: Creates calendar entry

#### Meeting Details
- [ ] **View Meeting**: Click event → Show details
- [ ] **Edit Meeting**: Modify details → Save
- [ ] **Reschedule**: Drag event to new date/time
- [ ] **Cancel Meeting**: Delete with reason
- [ ] **Mark Complete**: Update meeting status
- [ ] **Add Follow-up**: Create follow-up meeting
- [ ] **Linked Entity Integrity (Post-Conversion)**: If meeting was created from a lead that later converted, meeting still opens correctly and links to the right profile/details

#### Real-World Agency Owner/Agent Scenarios
- [ ] **Scenario: Site Visit Pipeline**: Create lead → schedule site visit → reschedule → mark completed → create follow-up → verify full chain is visible on Calendar and in entity history
- [ ] **Scenario: Owner Key Handover**: Schedule “Key pickup” with owner → cancel → recreate with new time → ensure old cancellation is not silently lost (audit/history or UI indication)
- [ ] **Scenario: Tenant Move-in Inspection**: Create tenant + link property → schedule inspection → attach notes/outcome → verify it remains accessible later
- [ ] **Scenario: Buyer No-show**: Mark meeting as no-show (or cancel with reason) → verify reminders/overdue indicators behave correctly
- [ ] **Scenario: Multiple Meetings Same Time**: Create overlapping meetings → UI warns or handles overlap gracefully (no hidden data loss)
- [ ] **Scenario: Reminder Validation**: Set reminder and verify notification appears (UI badge/notifications area) at the expected time window

#### Notifications
- [ ] **Meeting Reminders**: 1 hour before notification
- [ ] **Upcoming Meetings**: Dashboard widget
- [ ] **Overdue Meetings**: Alert for missed meetings

#### Performance
- [ ] **Calendar Load**: < 1 second for month view
- [ ] **Event Rendering**: Smooth display of 50+ events

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 📖 SECTION 9: KHATA BOOK (ACCOUNTING)

### 9.1 Khata Book List (`/crm/khata`)
**URL:** `/crm/khata`

#### List View
- [ ] **Load Entries**: Display all khata entries
- [ ] **Filter by Party Type**: Owner/Tenant/Buyer/Seller
- [ ] **Filter by Property**: Select property
- [ ] **Filter by Type**: Credit/Debit
- [ ] **Filter by Date Range**: Start-End date
- [ ] **Search**: Party name/property address/description
- [ ] **Running Balance**: Calculate total balance
- [ ] **Party-wise Balance**: Balance per party

#### Actions
- [ ] **Add Entry**: Click → Navigate to `/crm/khata/new`
- [ ] **View Entry**: Click → Navigate to `/crm/khata/:entryId`
- [ ] **Edit Entry**: Click edit → Navigate to `/crm/khata/:entryId/edit`
- [ ] **Delete Entry**: Delete with confirmation
- [ ] **Settlement**: Navigate to `/crm/khata/settlement`

#### Summary Section
- [ ] **Total Credits**: Sum of all credit entries
- [ ] **Total Debits**: Sum of all debit entries
- [ ] **Net Balance**: Credits - Debits
- [ ] **Party-wise Report**: Export party ledgers

---

### 9.2 Khata Entry Form (`/crm/khata/new` & `/crm/khata/:entryId`)
**URLs:** `/crm/khata/new`, `/crm/khata/:entryId`, `/crm/khata/:entryId/edit`

#### Create New Entry
- [ ] **Entry Type**: Credit (Received) / Debit (Paid)
- [ ] **Party Type**: Owner/Tenant/Buyer/Seller
- [ ] **Select Party**: Dropdown with search
- [ ] **Property**: Select from party's properties
- [ ] **Amount**: Number input, required
- [ ] **Date**: Date picker, defaults to today
- [ ] **Payment Mode**: Cash/UPI/Cheque/Bank/Online
- [ ] **Transaction ID**: For digital payments
- [ ] **Category**: Rent/Deposit/Commission/Maintenance/Repair/Purchase
- [ ] **Description**: Text area for details
- [ ] **Receipt Upload**: Upload payment receipt (PDF/Image)
- [ ] **Save Entry**: Creates khata entry

#### Edit Entry
- [ ] **Load Entry Data**: All fields populated
- [ ] **Modify Fields**: Update → Save
- [ ] **Change Amount**: Recalculate balance
- [ ] **Update Receipt**: Replace uploaded receipt
- [ ] **Delete Entry**: With confirmation

#### Prefilled Navigation
- [ ] **From Owner Details**: Owner prefilled
- [ ] **From Tenant Details**: Tenant prefilled
- [ ] **From Buyer Details**: Buyer prefilled
- [ ] **From Property Details**: Property prefilled
- [ ] **Query Params**: Read partyType/partyId/propertyId from URL

#### Receipt Management
- [ ] **Upload Receipt**: PDF/Image up to 5MB
- [ ] **View Receipt**: Click to preview/download
- [ ] **Delete Receipt**: Remove receipt
- [ ] **Multiple Receipts**: Support multiple receipts per entry

#### Auto-calculations
- [ ] **Running Balance**: Update after entry
- [ ] **Party Balance**: Show party's total balance
- [ ] **Property Balance**: Show property-wise balance

---

### 9.3 Khata Settlement (`/crm/khata/settlement`)
**URL:** `/crm/khata/settlement`

- [ ] **Load Outstanding Balances**: Show all parties with pending amounts
- [ ] **Select Party**: Choose party for settlement
- [ ] **Show History**: Display all transactions
- [ ] **Settlement Amount**: Calculate total outstanding
- [ ] **Record Settlement**: Create settlement entry
- [ ] **Generate Receipt**: PDF settlement receipt
- [ ] **Update Status**: Mark as settled

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 📊 SECTION 10: ANALYTICS & REPORTS

### 10.1 Business Analytics (`/crm/analytics`)
**URL:** `/crm/analytics`

#### Dashboard Widgets
- [ ] **Revenue Chart**: Monthly/Quarterly/Yearly revenue
- [ ] **Property Status**: Pie chart of available/rented/sold
- [ ] **Lead Conversion**: Conversion funnel
- [ ] **Commission Earned**: Total earnings
- [ ] **Occupancy Rate**: Rented vs available
- [ ] **Rent Collection**: Paid vs pending

#### Reports
- [ ] **Property Report**: List with filters
- [ ] **Revenue Report**: Date range selection
- [ ] **Commission Report**: Agent-wise earnings
- [ ] **Tenant Report**: Active/past tenants
- [ ] **Owner Report**: Owner-wise properties
- [ ] **Buyer Report**: Purchase history

#### Export Options
- [ ] **Export to Excel**: Download XLSX
- [ ] **Export to PDF**: Generate PDF report
- [ ] **Export to CSV**: Download CSV
- [ ] **Email Report**: Send via email
- [ ] **Schedule Reports**: Auto-generate and email

#### Date Filters
- [ ] **Date Range Picker**: Custom date selection
- [ ] **Quick Filters**: Today/This Week/This Month/This Year
- [ ] **Apply Filters**: Update charts/tables

#### Performance
- [ ] **Chart Rendering**: < 2 seconds for complex charts
- [ ] **Data Export**: Handle 1000+ records

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 🏗️ SECTION 11: REAL ESTATE MANAGEMENT

### 11.1 Developers (`/crm/developers`)
**URL:** `/crm/developers`, `/crm/developers/new`, `/crm/developers/:id`

#### Developer List
- [ ] **Load Developers**: Display all developers
- [ ] **Search**: By name/location
- [ ] **Filter by City**: Mumbai/Pune/Delhi/Bangalore/Dubai
- [ ] **Projects Count**: Show number of projects per developer

#### Developer Details
- [ ] **Developer Name**: Required
- [ ] **Logo Upload**: Company logo (PNG/JPG)
- [ ] **Description**: About the developer
- [ ] **Established Year**: Year input
- [ ] **Website**: URL validation
- [ ] **Contact Person**: Name, phone, email
- [ ] **Office Address**: Full address
- [ ] **City/State**: Location details
- [ ] **RERA Number**: Registration number
- [ ] **Certifications**: Upload certificates
- [ ] **Total Projects**: Count display
- [ ] **Completed Projects**: List view
- [ ] **Ongoing Projects**: List view
- [ ] **Save Developer**: Create/Update

#### Document Uploads
- [ ] **Upload Logo**: Image up to 2MB
- [ ] **Upload Certificates**: PDF/Image
- [ ] **Upload RERA Docs**: PDF
- [ ] **View Documents**: Preview/download

---

### 11.2 Real Estate Areas (`/crm/real-estate-areas`)
**URL:** `/crm/real-estate-areas`, `/crm/real-estate-areas/new`, `/crm/real-estate-areas/:id`

#### Area List
- [ ] **Load Areas**: All areas/communities
- [ ] **Filter by City**: Mumbai/Pune/Delhi/Bangalore/Dubai
- [ ] **Filter by Type**: Residential/Commercial/Mixed
- [ ] **Search**: By area name
- [ ] **Properties Count**: Number of properties in area

#### Area Details
- [ ] **Area Name**: Required
- [ ] **City**: Dropdown selection
- [ ] **Area Type**: Residential/Commercial/Mixed
- [ ] **Description**: Rich text
- [ ] **Pincode**: 6-digit validation
- [ ] **Average Price**: Price per sq ft
- [ ] **Connectivity**: Transport details
- [ ] **Nearby Landmarks**: List landmarks
- [ ] **Schools**: Nearby schools
- [ ] **Hospitals**: Nearby hospitals
- [ ] **Shopping**: Malls/markets nearby
- [ ] **Image Upload**: Area photos
- [ ] **Save Area**: Create/Update

#### Map Integration
- [ ] **Location on Map**: Google Maps integration
- [ ] **Boundary Drawing**: Draw area boundary
- [ ] **Nearby Areas**: Show adjacent areas
---

### 11.3 Projects (`/crm/projects`)
**URL:** `/crm/projects`, `/crm/projects/new`, `/crm/projects/:id`

#### Project List
- [ ] **Load Projects**: All real estate projects
- [ ] **Filter by Developer**: Select developer
- [ ] **Filter by Area**: Select location
- [ ] **Filter by Status**: Upcoming/Under-construction/Ready/Completed
- [ ] **Filter by City**: Location filter
- [ ] **Search**: By project name

#### Project Details
- [ ] **Project Name**: Required
- [ ] **Developer**: Select from dropdown
- [ ] **Area/Location**: Select area
- [ ] **Project Type**: Residential/Commercial/Mixed
- [ ] **Description**: Rich text editor
- [ ] **Launch Date**: Date picker
- [ ] **Possession Date**: Expected completion
- [ ] **Status**: Upcoming/Under-construction/Ready/Completed
- [ ] **Total Units**: Number of units
- [ ] **Available Units**: Unsold count
- [ ] **Sold Units**: Count
- [ ] **Price Range**: Min-Max price
- [ ] **Unit Types**: 1BHK/2BHK/3BHK configurations
- [ ] **Amenities**: Checkboxes for facilities
- [ ] **RERA Number**: Registration ID
- [ ] **Brochure Upload**: PDF brochure
- [ ] **Image Gallery**: Multiple images
- [ ] **Floor Plans**: Upload floor plan PDFs
- [ ] **Save Project**: Create/Update

#### Document Uploads
- [ ] **Upload Images**: 10+ images, batch upload
- [ ] **Upload Brochure**: PDF up to 10MB
- [ ] **Upload Floor Plans**: PDF/Image
- [ ] **Upload RERA Docs**: PDF
- [ ] **Video Upload**: Project walkthrough video
- [ ] **View Gallery**: Image carousel
- [ ] **Download Brochure**: PDF download

#### Units Management
- [ ] **Add Unit**: Create individual unit in project
- [ ] **Unit Details**: Floor, unit number, size, price
- [ ] **Unit Status**: Available/Sold/Blocked
- [ ] **Link to Property**: Convert unit to property listing

---

## 🤖 SECTION 12: AI CALLING MODULE

### 12.1 AI Calling Dashboard (`/crm/ai-calling`)
**URL:** `/crm/ai-calling`

#### Dashboard Stats
- [ ] **Total Calls**: Count of all calls
- [ ] **Active Calls**: Currently ongoing
- [ ] **Completed Calls**: Finished calls
- [ ] **Success Rate**: Conversion percentage
- [ ] **Average Duration**: Call duration stats
- [ ] **Today's Calls**: Count for current day

#### Quick Actions
- [ ] **Start Call**: Navigate to `/crm/ai-calling/start`
- [ ] **Call History**: Navigate to `/crm/ai-calling/history`
- [ ] **Knowledge Base**: Navigate to `/crm/ai-calling/knowledge`
- [ ] **Settings**: Navigate to `/crm/ai-calling/settings`

---

### 12.2 Start Call (`/crm/ai-calling/start`)
**URL:** `/crm/ai-calling/start`

#### Call Setup
- [ ] **Select Contact**: Choose buyer/owner/tenant/lead
- [ ] **Call Type**: Outbound/Follow-up/Site-visit/Reminder
- [ ] **Script Selection**: Choose AI script template
- [ ] **Language**: English/Hindi/Hinglish
- [ ] **Voice Selection**: Male/Female voice
- [ ] **Custom Instructions**: Additional context for AI
- [ ] **Phone Number**: Validate phone number
- [ ] **Start Call**: Initiate AI call

#### Call Monitoring
- [ ] **Call Status**: Connecting/Ringing/Connected/Ended
- [ ] **Real-time Transcript**: Live conversation text
- [ ] **Call Duration**: Timer
- [ ] **Interrupt Call**: Manual intervention option
- [ ] **End Call**: Terminate call

---

### 12.3 Call Details (`/crm/ai-calling/calls/:callSessionId`)
**URL:** `/crm/ai-calling/calls/:callSessionId`

#### Call Information
- [ ] **Call ID**: Display session ID
- [ ] **Contact Details**: Who was called
- [ ] **Call Date/Time**: When call occurred
- [ ] **Duration**: Call length
- [ ] **Status**: Success/Failed/No-answer/Busy
- [ ] **Recording**: Play call recording
- [ ] **Transcript**: Full conversation text
- [ ] **Sentiment**: Positive/Neutral/Negative
- [ ] **Intent Detected**: What customer wanted
- [ ] **Follow-up Required**: Flag for follow-up

#### Actions
- [ ] **Play Recording**: Audio player
- [ ] **Download Recording**: Save MP3
- [ ] **Download Transcript**: Save TXT/PDF
- [ ] **Add to Lead**: Create lead from call
- [ ] **Schedule Follow-up**: Add to calendar
- [ ] **Send Summary**: Email call summary

---

### 12.4 Call History (`/crm/ai-calling/history`)
**URL:** `/crm/ai-calling/history`

#### List View
- [ ] **All Calls**: Paginated list
- [ ] **Filter by Status**: Success/Failed/No-answer
- [ ] **Filter by Date**: Date range
- [ ] **Filter by Contact**: Search by name/phone
- [ ] **Filter by Type**: Call type filter
- [ ] **Sort**: By date/duration/status

#### Actions
- [ ] **View Call Details**: Navigate to call details
- [ ] **Replay Call**: Listen to recording
- [ ] **Export History**: Download CSV/Excel

---

### 12.5 Knowledge Manager (`/crm/ai-calling/knowledge`)
**URL:** `/crm/ai-calling/knowledge`

#### Knowledge Base
- [ ] **View Knowledge Items**: List all FAQs/scripts
- [ ] **Add Knowledge**: Create new entry
- [ ] **Edit Knowledge**: Update existing
- [ ] **Delete Knowledge**: Remove entry
- [ ] **Categories**: Organize by category
- [ ] **Search Knowledge**: Find specific items

#### Content Management
- [ ] **FAQ Management**: Add Q&A pairs
- [ ] **Script Templates**: Call scripts
- [ ] **Property Info**: Property-specific details
- [ ] **Objection Handling**: Responses to common objections
- [ ] **Upload Documents**: PDF/Word knowledge docs

---

### 12.6 AI Calling Settings (`/crm/ai-calling/settings`)
**URL:** `/crm/ai-calling/settings`

#### Configuration
- [ ] **API Keys**: Exotel/AI provider keys
- [ ] **Default Voice**: Select default AI voice
- [ ] **Default Language**: Set language preference
- [ ] **Call Recording**: Enable/disable recording
- [ ] **Transcript Storage**: Auto-save transcripts
- [ ] **Notification Settings**: Call notifications
- [ ] **Working Hours**: Set call time restrictions
- [ ] **Save Settings**: Update configuration

---

## 📋 SECTION 13: B2B LEADS

### 13.1 B2B Leads List (`/crm/b2b-leads`)
**URL:** `/crm/b2b-leads`

#### List View
- [ ] **Load B2B Leads**: Agency/broker leads
- [ ] **Search**: By agency name/contact
- [ ] **Filter by Status**: New/Contacted/Partner/Rejected
- [ ] **Filter by City**: Location filter
- [ ] **Agency Info**: Name, contact, properties count

#### Actions
- [ ] **View Details**: Click for full details
- [ ] **Convert to Partner**: Mark as active partner
- [ ] **Add Note**: Interaction notes
- [ ] **Send Proposal**: Email partnership proposal

---

## 🏢 SECTION 14: HIERARCHY & ORGANIZATION

### 14.1 Hierarchy View (`/crm/hierarchy`)
**URL:** `/crm/hierarchy`

#### Organization Chart
- [ ] **Load Hierarchy**: Team structure display
- [ ] **Add Team Member**: Create user
- [ ] **Assign Role**: Admin/Manager/Agent
- [ ] **View Reporting**: Who reports to whom
- [ ] **Performance Metrics**: Per-agent stats

#### Team Management
- [ ] **Add Agent**: Create new agent
- [ ] **Edit Agent**: Update details
- [ ] **Assign Properties**: Allocate listings
- [ ] **Assign Leads**: Allocate leads
- [ ] **Commission Split**: Set commission rules

---

## 🔔 SECTION 15: NOTIFICATIONS

### 15.1 Notification Center (All pages - Header)
**Icon:** Bell icon in header

#### Notification List
- [ ] **Unread Count**: Badge shows unread count
- [ ] **Click Bell**: Opens notification dropdown
- [ ] **Load Notifications**: List of recent notifications
- [ ] **Notification Types**: Rent due/Meeting/Document/Lead
- [ ] **Mark as Read**: Click notification → Mark read
- [ ] **Mark All Read**: Clear all unread
- [ ] **Navigate**: Click → Go to relevant page

#### Notification Types
- [ ] **Rent Due**: Tenant rent payment due
- [ ] **Meeting Reminder**: Upcoming meeting alert
- [ ] **New Lead**: New lead assigned
- [ ] **Document Expiry**: Agreement expiring soon
- [ ] **Property Status**: Property status changed
- [ ] **System Alerts**: Important system messages

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## ⚙️ SECTION 16: SETTINGS & ADMIN

### 16.1 Admin Settings (`/settings`)
**URL:** `/settings`

#### General Settings
- [ ] **Agency Name**: Update agency name
- [ ] **Agency Logo**: Upload logo
- [ ] **Contact Details**: Phone, email, address
- [ ] **Business Hours**: Set working hours
- [ ] **Currency**: INR/AED/USD
- [ ] **Tax Settings**: GST/VAT configuration
- [ ] **Save Settings**: Update configuration

#### User Management
- [ ] **Add User**: Create admin/agent account
- [ ] **Edit User**: Update user details
- [ ] **Reset Password**: Password reset for users
- [ ] **Deactivate User**: Disable user access
- [ ] **Role Assignment**: Admin/Manager/Agent roles

#### Commission Settings
- [ ] **Default Commission**: Set percentage
- [ ] **Property Type**: Different rates per type
- [ ] **Agent Commission**: Individual agent rates
- [ ] **Save Commission**: Update rates

#### Notification Settings
- [ ] **Email Notifications**: Enable/disable
- [ ] **SMS Notifications**: Enable/disable
- [ ] **WhatsApp Notifications**: Enable/disable
- [ ] **Notification Frequency**: Configure timing

#### Backup & Export
- [ ] **Export All Data**: Download complete database
- [ ] **Export Properties**: Properties CSV
- [ ] **Export Contacts**: Contacts CSV
- [ ] **Backup Settings**: Auto-backup config

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 🔒 SECTION 17: SECURITY TESTING

### 17.1 Authentication Security
- [ ] **Session Timeout**: Idle timeout after 30 mins
- [ ] **Token Refresh**: JWT refresh mechanism
- [ ] **Logout from All Devices**: Clear all sessions
- [ ] **Password Strength**: Min 8 chars, special chars required
- [ ] **Password Reset**: Secure reset flow
- [ ] **Brute Force Protection**: Rate limiting

### 17.2 Authorization Testing
- [ ] **Role-Based Access**: Admin vs Agent permissions
- [ ] **Tenant Isolation**: Cannot access other tenant data
- [ ] **API Authorization**: All APIs require valid token
- [ ] **Direct URL Access**: Protected routes block unauthorized
- [ ] **API Response Filtering**: Only show authorized data

### 17.3 Input Validation & Sanitization
- [ ] **XSS Prevention**: HTML/Script injection blocked
- [ ] **SQL Injection**: Parameterized queries used
- [ ] **File Upload Validation**: Only allowed file types
- [ ] **File Size Limits**: Enforced on all uploads
- [ ] **Email Validation**: Proper email format check
- [ ] **Phone Validation**: 10-digit format enforced
- [ ] **Special Characters**: Sanitized in all inputs

### 17.4 Data Security
- [ ] **HTTPS**: All traffic encrypted
- [ ] **CORS Headers**: Proper CORS configuration
- [ ] **Headers Security**: Check for security headers
- [ ] **Sensitive Data**: PAN/Aadhaar masked in UI
- [ ] **API Keys**: Never exposed in frontend
- [ ] **Password Storage**: Hashed (not plain text)

### 17.5 API Security
- [ ] **Rate Limiting**: Prevent API abuse
- [ ] **Request Validation**: Validate all inputs
- [ ] **Response Sanitization**: No sensitive data leaked
- [ ] **Error Messages**: Don't reveal system details
- [ ] **OPTIONS Method**: CORS preflight works
- [ ] **Binary Media**: Handles images/videos correctly

### 17.6 File Upload Security
- [ ] **File Type Check**: Magic number validation
- [ ] **Virus Scan**: Malware detection (if applicable)
- [ ] **File Name Sanitization**: Remove special chars
- [ ] **Direct File Access**: S3 signed URLs used
- [ ] **Upload Directory**: Isolated from executable paths

### 17.7 Infrastructure Security
- [ ] **Database Access**: Not publicly accessible
- [ ] **S3 Bucket**: Private, signed URLs only
- [ ] **Lambda Security**: Minimal permissions
- [ ] **API Gateway**: Proper authorization
- [ ] **CloudFormation**: No hardcoded secrets

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 🚀 SECTION 18: PERFORMANCE TESTING

### 18.1 Page Load Performance
- [ ] **Login Page**: < 1 second
- [ ] **Dashboard**: < 3 seconds
- [ ] **Property List**: < 2 seconds (50 properties)
- [ ] **Property Details**: < 2 seconds
- [ ] **Image Heavy Pages**: < 3 seconds
- [ ] **Calendar**: < 1 second
- [ ] **Analytics**: < 3 seconds (complex charts)

### 18.2 API Response Time
- [ ] **GET /api/auth/login**: < 1 second
- [ ] **GET /api/crm/metrics**: < 1 second
- [ ] **GET /api/crm/owners**: < 1 second
- [ ] **GET /api/crm/properties**: < 1 second
- [ ] **GET /api/crm/buyers**: < 1 second
- [ ] **GET /api/crm/leads**: < 1 second
- [ ] **POST /api/crm/properties**: < 2 seconds
- [ ] **File Upload**: Progress indicator, < 10s for 5MB

### 18.3 Database Query Performance
- [ ] **Complex Queries**: < 500ms
- [ ] **Pagination**: Efficient for 1000+ records
- [ ] **Search Queries**: < 500ms with indexes
- [ ] **Aggregations**: Analytics queries < 2s

### 18.4 Frontend Performance
- [ ] **First Contentful Paint**: < 1.5s
- [ ] **Time to Interactive**: < 3s
- [ ] **Largest Contentful Paint**: < 2.5s
- [ ] **Cumulative Layout Shift**: < 0.1
- [ ] **First Input Delay**: < 100ms

### 18.5 Resource Optimization
- [ ] **Image Optimization**: WebP format, lazy loading
- [ ] **Code Splitting**: Lazy load routes
- [ ] **Bundle Size**: < 500KB initial bundle
- [ ] **Caching**: Static assets cached
- [ ] **CDN**: Images served from S3/CloudFront

### 18.6 Scalability Testing
- [ ] **Concurrent Users**: Handle 50+ simultaneous users
- [ ] **Large Dataset**: 10,000+ properties load correctly
- [ ] **Bulk Operations**: 100+ records at once
- [ ] **File Upload**: Multiple 10MB files concurrently

### 18.7 Mobile Performance
- [ ] **Mobile Load Time**: < 4 seconds on 4G
- [ ] **Touch Responsiveness**: < 100ms
- [ ] **Viewport Rendering**: No horizontal scroll
- [ ] **Mobile Navigation**: Smooth, no lag

---

## 📱 SECTION 19: RESPONSIVE & CROSS-BROWSER TESTING

### 19.1 Desktop Browsers
- [ ] **Chrome (Latest)**: Full functionality
- [ ] **Firefox (Latest)**: Full functionality
- [ ] **Safari (Latest)**: Full functionality
- [ ] **Edge (Latest)**: Full functionality

### 19.2 Mobile Browsers
- [ ] **Chrome Mobile**: Full functionality
- [ ] **Safari iOS**: Full functionality
- [ ] **Samsung Internet**: Full functionality

### 19.3 Screen Sizes
- [ ] **Desktop (1920x1080)**: Layout correct
- [ ] **Laptop (1366x768)**: Layout correct
- [ ] **Tablet (768x1024)**: Layout correct
- [ ] **Mobile (375x667)**: Layout correct
- [ ] **Large Mobile (414x896)**: Layout correct

### 19.4 Responsive Features
- [ ] **Navigation**: Mobile hamburger menu works
- [ ] **Forms**: Mobile keyboard friendly
- [ ] **Tables**: Horizontal scroll on mobile
- [ ] **Images**: Responsive sizing
- [ ] **Touch Targets**: Min 44x44px
- [ ] **Modals**: Full screen on mobile

---

## 🧪 SECTION 20: EDGE CASES & ERROR HANDLING

### 20.1 Network Errors
- [ ] **No Internet**: Shows offline message
- [ ] **API Timeout**: Shows timeout error
- [ ] **500 Server Error**: Shows user-friendly error
- [ ] **404 Not Found**: Shows not found page
- [ ] **Network Retry**: Retry button works

### 20.2 Data Validation
- [ ] **Empty Form Submit**: Shows validation errors
- [ ] **Invalid Email**: Email format validation
- [ ] **Invalid Phone**: 10-digit validation
- [ ] **Future Date**: Prevents invalid dates
- [ ] **Negative Numbers**: Prevents where applicable
- [ ] **Max Length**: Enforces character limits

### 20.3 Upload Edge Cases
- [ ] **Zero Byte File**: Rejects empty files
- [ ] **Huge File**: Shows size limit error
- [ ] **Corrupted File**: Handles gracefully
- [ ] **Simultaneous Uploads**: Handles multiple files
- [ ] **Network Interruption**: Shows upload failed

### 20.4 Concurrent Operations
- [ ] **Edit Conflict**: Two users editing same record
- [ ] **Duplicate Submit**: Prevent double-click submit
- [ ] **Stale Data**: Refresh on conflict

### 20.5 Boundary Conditions
- [ ] **Empty Lists**: Shows "No data" message
- [ ] **Single Item**: Displays correctly
- [ ] **Maximum Items**: Pagination handles 10,000+
- [ ] **Very Long Text**: Truncates with ellipsis
- [ ] **Special Characters**: Unicode/Emoji support

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 📝 SECTION 21: FILE UPLOAD TESTING MATRIX

### 21.1 Image Uploads (All Modules)

#### Valid File Types
- [ ] **JPEG/JPG**: Upload .jpg file → Success
- [ ] **PNG**: Upload .png file → Success
- [ ] **WebP**: Upload .webp file → Success
- [ ] **GIF**: Upload .gif file → Success (if supported)
- [ ] **HEIC/HEIF**: Upload iPhone photos → Success/Convert

#### Invalid File Types
- [ ] **PDF**: Upload .pdf as image → Should reject
- [ ] **EXE**: Upload .exe → Should reject with security error
- [ ] **DOC**: Upload .doc as image → Should reject
- [ ] **Renamed File**: Upload .exe renamed to .jpg → Should detect and reject

#### File Sizes
- [ ] **Small File**: 50KB image → Upload success
- [ ] **Medium File**: 2MB image → Upload success
- [ ] **Large File**: 8MB image → Upload success
- [ ] **Huge File**: 15MB image → Should show size limit error
- [ ] **Maximum Allowed**: 10MB exactly → Upload success

#### Image Dimensions
- [ ] **Small Dimensions**: 100x100px → Upload success
- [ ] **Large Dimensions**: 5000x5000px → Upload success/Auto-resize
- [ ] **Portrait**: 1080x1920 → Display correctly
- [ ] **Landscape**: 1920x1080 → Display correctly
- [ ] **Square**: 1000x1000 → Display correctly

### 21.2 Document Uploads (PDFs)

#### Valid Documents
- [ ] **PDF**: Upload .pdf → Success
- [ ] **Small PDF**: 500KB → Upload success
- [ ] **Large PDF**: 5MB → Upload success
- [ ] **Scanned PDF**: Multi-page → Upload success
- [ ] **Password Protected PDF**: Should upload (may not preview)

#### Invalid Documents
- [ ] **Word Doc**: Upload .doc → Should reject (if PDF-only)
- [ ] **Excel File**: Upload .xlsx → Should reject
- [ ] **Zip File**: Upload .zip → Should reject

#### File Sizes
- [ ] **Tiny PDF**: 10KB → Upload success
- [ ] **Medium PDF**: 3MB → Upload success
- [ ] **Large PDF**: 10MB → Upload success
- [ ] **Huge PDF**: 25MB → Should show size limit error

### 21.3 Video Uploads (Properties)

#### Valid Video Types
- [ ] **MP4**: Upload .mp4 → Success
- [ ] **MOV**: Upload .mov → Success
- [ ] **WebM**: Upload .webm → Success
- [ ] **AVI**: Upload .avi → Success/Convert

#### Invalid Video Types
- [ ] **MKV**: Upload .mkv → Should reject/convert
- [ ] **FLV**: Upload .flv → Should reject

#### Video Sizes
- [ ] **Small Video**: 5MB → Upload success with progress
- [ ] **Medium Video**: 25MB → Upload success with chunking
- [ ] **Large Video**: 50MB → Upload success
- [ ] **Huge Video**: 150MB → Should show size limit error
- [ ] **Maximum Allowed**: 100MB → Upload success

#### Video Quality
- [ ] **720p Video**: Upload → Success
- [ ] **1080p Video**: Upload → Success
- [ ] **4K Video**: Large file → Check size limits

### 21.4 Batch Upload Testing

#### Multiple Files
- [ ] **2 Images**: Upload simultaneously → Both succeed
- [ ] **5 Images**: Batch upload → All succeed
- [ ] **10+ Images**: Batch upload → All succeed with queue
- [ ] **Mixed Sizes**: Small + Large files → All succeed
- [ ] **One Invalid**: 4 valid + 1 invalid → 4 succeed, 1 rejected

#### Progress Indicators
- [ ] **Single Upload**: Shows progress bar
- [ ] **Batch Upload**: Shows progress per file
- [ ] **Upload Speed**: Shows MB/s or percentage
- [ ] **Cancel Upload**: Cancel button works mid-upload
- [ ] **Retry Failed**: Retry button for failed uploads

### 21.5 Upload UI/UX Testing

#### Drag & Drop
- [ ] **Drag Image**: Drag file to dropzone → Upload initiated
- [ ] **Multiple Drag**: Drag 5 files → All queued
- [ ] **Invalid Drag**: Drag .exe → Shows error

#### File Browser
- [ ] **Click to Upload**: Click button → File browser opens
- [ ] **Multi-select**: Select multiple files → All queued
- [ ] **Cancel Selection**: Close browser → No upload

#### Preview & Thumbnail
- [ ] **Image Preview**: Shows thumbnail after upload
- [ ] **Video Preview**: Shows video player
- [ ] **PDF Preview**: Shows PDF icon/first page
- [ ] **Delete Preview**: Remove button works

### 21.6 Upload Error Scenarios

#### Network Errors
- [ ] **Slow Connection**: Upload on 3G → Shows progress
- [ ] **Connection Lost**: Disconnect during upload → Shows error
- [ ] **Server Timeout**: Long upload times out → Retry option
- [ ] **Resume Upload**: Continue after network restore

#### Server Errors
- [ ] **500 Server Error**: Upload fails → User-friendly message
- [ ] **Storage Full**: Disk space error → Clear error message
- [ ] **Permission Error**: No write access → Error message

#### Client Errors
- [ ] **File Locked**: File in use → Error message
- [ ] **Browser Crash**: Upload interrupted → Can retry
- [ ] **Tab Close**: Close tab during upload → Warning message

---
i want you to test this application for below mentioned section, please test each and every point keeping in mind for real world use cases, the owner of this app is real estate agency admin/agent and customers are owner, tenant, sellers and buyers please note for uploading pdfs,images, videos i have kept at location C:\Users\qures\Downloads\nabi-app-git\cloudberry-real-estate\assets you can upload the respective files from this folder while testing --- provide me complete report once all tests are done

## 🎯 SECTION 22: CRITICAL USER JOURNEYS

### 22.1 Complete Owner Journey
1. [ ] Login to CRM
2. [ ] Navigate to Owners
3. [ ] Click "Add Owner"
4. [ ] Fill all required fields
5. [ ] Upload PAN & Aadhaar documents
6. [ ] Save owner
7. [ ] Navigate to owner details
8. [ ] Add a property to this owner
9. [ ] Upload property images (5+ images)
10. [ ] Mark property as "For Rent"
11. [ ] View property in property list
12. [ ] Add khata entry for this owner
13. [ ] Upload payment receipt
14. [ ] View khata balance

### 22.2 Complete Tenant Journey
1. [ ] Navigate to Properties
2. [ ] Find available property
3. [ ] Click "Mark as Rented"
4. [ ] Create new tenant or select existing
5. [ ] Fill rental details (rent, deposit, start date)
6. [ ] Upload tenant documents
7. [ ] Upload rental agreement
8. [ ] Save rental transaction
9. [ ] View property status changed to "Rented"
10. [ ] Navigate to tenant details
11. [ ] Record rent payment
12. [ ] Generate rent receipt
13. [ ] View tenant in rented properties list

### 22.3 Complete Buyer Journey
1. [ ] Create new lead (buyer type)
2. [ ] Fill buyer requirements (budget, area, BHK)
3. [ ] Save lead
4. [ ] View matching properties
5. [ ] Schedule site visit via calendar
6. [ ] Convert lead to buyer
7. [ ] Record site visit feedback
8. [ ] Mark property as "Sold"
9. [ ] Link buyer to sold property
10. [ ] Upload sale agreement
11. [ ] Record commission earned
12. [ ] Add khata entry for sale

### 22.4 Complete Property Lifecycle
1. [ ] Add new property with owner
2. [ ] Upload 10 property images
3. [ ] Upload property documents
4. [ ] Mark as "Available"
5. [ ] Buyer shows interest
6. [ ] Schedule site visit
7. [ ] Receive offer
8. [ ] Mark as "On Hold"
9. [ ] Finalize deal
10. [ ] Mark as "Sold"
11. [ ] Upload sale agreement
12. [ ] Record commission
13. [ ] Update owner payment in khata

---

## 🔍 TESTING NOTES FOR CLAUDE BROWSER EXTENSION

### Environment Setup
```
Base URL: http://localhost:8086
API URL: https://services-api.cloudberrysolutions.in/devrealestatecrm
Tenant ID: [Your tenant ID from .env]
Test Credentials: [Login credentials]
```

### Testing Order
1. Start with Authentication (Section 1)
2. Test Dashboard load (Section 2)
3. Test each major module one by one (Sections 3-11)
4. Test specialized features (Sections 12-14)
5. Run security tests (Section 17)
6. Perform performance tests (Section 18)
7. Test edge cases (Section 20)

### Priority Levels
- **P0 (Critical)**: Authentication, Dashboard, Create/Edit operations
- **P1 (High)**: List views, Search/Filter, File uploads
- **P2 (Medium)**: Reports, Analytics, Secondary features
- **P3 (Low)**: Edge cases, Advanced features

### Test Data Requirements
- At least 5 owners
- At least 10 properties
- At least 5 tenants
- At least 5 buyers
- At least 10 leads
- Sample images (various sizes: 100KB, 1MB, 5MB, 10MB)
- Sample PDFs (various sizes)
- Sample videos (various sizes)

### Browser Console Checks
- No JavaScript errors
- No 404/500 API errors
- No CORS errors
- Network requests complete successfully
- Proper request/response headers

### Known Issues to Monitor
- Custom domain base path (should be stripped by Lambda)
- OPTIONS preflight (should return 200)
- Binary media types (images/videos/PDFs)
- Tenant isolation (check x-tenant-id header)

---

## ✅ CHECKLIST SUMMARY

**Total Test Cases:** 500+

- Authentication & Security: 30 tests
- Dashboard: 25 tests
- Leads Management: 35 tests
- Owners Management: 40 tests
- Properties Management: 60 tests
- Tenants Management: 35 tests
- Buyers Management: 40 tests
- Calendar & Meetings: 25 tests
- Khata Book: 30 tests
- Analytics: 20 tests
- Real Estate Management: 35 tests
- AI Calling: 30 tests
- Security Testing: 35 tests
- Performance Testing: 30 tests
- File Upload Testing: 60 tests
- Critical User Journeys: 4 flows

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Status:** Ready for Testing
