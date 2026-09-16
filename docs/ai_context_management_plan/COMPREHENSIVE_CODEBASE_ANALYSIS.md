# Comprehensive Codebase Analysis: RealtyFlow CRM
## Complete Product, Architecture & DynamoDB-to-PostgreSQL Migration Guide

**Date:** June 18, 2026  
**Project:** Cloudberry Real Estate CRM (RealtyFlow)  
**Current Status:** Production-ready with multi-tenant support  
**Migration Goal:** DynamoDB → PostgreSQL

---

## EXECUTIVE SUMMARY

**RealtyFlow** is a full-stack, multi-tenant real estate CRM platform built for Indian real estate agents. It manages buyers, sellers, owners, properties, and includes AI-powered calling capabilities. The system currently uses DynamoDB with a single-table design and is ready for migration to PostgreSQL for improved query flexibility, transaction support, and operational simplicity.

### Key Metrics
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express (ES modules)
- **Database:** DynamoDB (11+ tables) → **Target: PostgreSQL**
- **Auth:** Amazon Cognito (Google + Phone OTP)
- **Deployment:** AWS Lambda + API Gateway
- **Multi-Tenancy:** Tenant ID prefixing in all PKs
- **Users:** Indian real estate agencies (solo to small teams)

---

## PART 1: PRODUCT VISION & MISSION

### 1.1 What is RealtyFlow?

**RealtyFlow** is a comprehensive real estate CRM platform designed specifically for Indian real estate agents and small agencies. It provides:

- **Contact Management:** Buyers, sellers, owners, tenants, developers
- **Property Management:** Listings, agreements, verifications, documents
- **Lead Management:** Lead capture, conversion tracking, lifecycle stages
- **AI Calling:** Automated phone calls via Exotel + ElevenLabs
- **Khata Book:** Traditional Indian property ledger system
- **Team Collaboration:** Multi-user support with role-based access
- **Subscriptions:** Trial → Paid tiers with seat management
- **Analytics:** Business metrics, NPS surveys, performance tracking

### 1.2 Core Problems Solved

| Problem | Solution |
|---------|----------|
| Manual lead tracking | Centralized CRM with lead lifecycle |
| No property inventory | Property database with status tracking |
| Inefficient communication | AI-powered calling agent |
| Scattered documentation | Unified S3 + DynamoDB storage |
| No team collaboration | Multi-tenant RBAC system |
| Lack of insights | Analytics dashboard + NPS tracking |
| Manual follow-ups | Automated notifications & reminders |
| Compliance gaps | Grievance management + DPDP compliance |

### 1.3 Go-to-Market Strategy

- **ICP:** Indian real estate agents (solo to small teams)
- **Brand:** RealtyFlow (Hinglish: 70% English + 30% Hindi romanized)
- **Pricing:** Freemium → Trial (14 days) → Paid subscriptions
- **Lead Gen:** 3,000 qualified leads via Meta Ads + Google Maps scraping
- **Markets:** India (primary) + Dubai (secondary)

---

## PART 2: COMPLETE ARCHITECTURE OVERVIEW

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                               │
│  React + TypeScript + Vite + TailwindCSS                        │
│  - CRM Dashboard (contacts, leads, properties)                  │
│  - Khata Book (ledger management)                               │
│  - Team Management & Invites                                    │
│  - Billing & Subscriptions                                      │
│  - Mobile Support (Capacitor for iOS/Android)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                             │
│  - CORS (allowlist-based)                                       │
│  - Rate Limiting                                                │
│  - JWT Validation (Cognito)                                     │
│  - Security Headers (CSP, X-Frame-Options)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MICROSERVICES LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  1. AUTH SERVICE (reality-flow-authentication)                  │
│     - Cognito integration (Google + Phone OTP)                  │
│     - User onboarding & registration                            │
│     - Invite management                                         │
│                                                                  │
│  2. CRM SERVICE (apps/crm/server/)                                       │
│     - Contact/Lead/Property management                          │
│     - Khata book operations                                     │
│     - Notifications & reminders                                 │
│     - Subscriptions & billing                                   │
│     - Grievances & feedback                                     │
│                                                                  │
│  3. AI CALLING SERVICE (services/ai-calling-service/)                    │
│     - Call orchestration                                        │
│     - Exotel integration (telephony)                            │
│     - ElevenLabs integration (AI voice)                         │
│     - Bedrock knowledge base                                    │
│                                                                  │
│  4. ONBOARDING SERVICE (apps/onboarding/)                       │
│     - Agency registration flow                                  │
│     - Member onboarding                                         │
│                                                                  │
│  5. VIDEO SERVICE (marketing-and-sales/video-projects/my-video/)                                   │
│     - Remotion-based video generation                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (AWS)                              │
├─────────────────────────────────────────────────────────────────┤
│  PRIMARY: DynamoDB (11+ tables, single-table design)            │
│  ├─ real-estate-core                                            │
│  ├─ real-estate-crm (CRM entities)                              │
│  ├─ cloudberry-real-estate-khata (ledger)                       │
│  ├─ cloudberry-real-estate-notifications                        │
│  └─ ... (subscriptions, grievances, etc.)                       │
│                                                                  │
│  SECONDARY: S3 (Documents & Media)                              │
│  ├─ KYC documents (Aadhar, PAN)                                 │
│  ├─ Property agreements & verifications                         │
│  └─ Media uploads                                               │
│                                                                  │
│  TERTIARY: Cognito (Auth State)                                 │
│  ├─ User pools (phone + Google IdP)                             │
│  └─ Token management                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------| 
| **Frontend** | React 18 + TypeScript + Vite | Web UI |
| **Mobile** | Capacitor 7 | iOS/Android wrapper |
| **Styling** | TailwindCSS 3 | Responsive design |
| **Backend** | Node.js + Express 4 | API server |
| **Auth** | Amazon Cognito | User authentication |
| **Database** | DynamoDB → **PostgreSQL** | Data store |
| **Storage** | S3 | Documents & media |
| **Deployment** | AWS Lambda + API Gateway | Serverless |
| **IaC** | CloudFormation | Infrastructure |
| **Monitoring** | CloudWatch + Sentry | Logging & errors |
| **Analytics** | PostHog | Product analytics |

---

## PART 3: BACKEND ARCHITECTURE DEEP DIVE

### 3.1 Microservice Structure

#### Authentication Service (`services/reality-flow-authentication/`)

**Purpose:** Centralized auth, user onboarding, invite management

**Key Endpoints:**
```
POST   /auth/phone/start           - Initiate phone OTP
POST   /auth/phone/confirm         - Verify OTP → tokens
POST   /auth/phone/onboard         - Register new user
POST   /auth/register-admin        - Register as admin
POST   /auth/accept-invite         - Accept team invite
GET    /auth/me                    - Get current user
POST   /invites                    - Create invite
GET    /invites                    - List invites
```

**Data Model:**
```
UsersTable (PK: TenantId, SK: SK)
├─ USER#<cognitoSub>              - User profile
├─ INVITE#<inviteCode>            - Pending invites
└─ GSIs: SubIndex, EmailIndex

AgencyConfigTable (PK: TenantId)
└─ Agency metadata, subscription info
```

#### CRM Service (`apps/crm/server/`)

**Purpose:** Core business logic for CRM operations

**Key Endpoints:**
```
/api/crm/contacts          - Contact CRUD
/api/crm/leads             - Lead management
/api/crm/buyers            - Buyer profiles
/api/crm/properties        - Property management
/api/crm/owners            - Owner management
/api/khata                 - Khata book operations
/api/notifications         - Notification management
/api/subscriptions         - Subscription tracking
/api/billing               - Billing & Razorpay webhooks
/api/grievances            - Grievance management
```

**Core Services:**
- `crmDynamodbService.js` - CRM entity operations
- `khataRoutes.js` - Ledger management
- `notificationDynamodbService.js` - Notifications
- `subscriptionService.js` - Subscription logic
- `grievanceDynamodbService.js` - Grievance handling

#### AI Calling Service (`services/ai-calling-service/`)

**Purpose:** AI-powered voice calling for leads/customers

**Key Endpoints:**
```
POST   /api/ai-calling/calls/start           - Initiate call
GET    /api/ai-calling/calls/:id/status      - Call status
GET    /api/ai-calling/calls/:id/transcript  - Get transcript
POST   /webhooks/exotel/status               - Exotel callback
POST   /webhooks/elevenlabs/intent           - ElevenLabs callback
```

### 3.2 DynamoDB Schema Analysis

#### CRM Table (`real-estate-crm`) - Single Table Design

**Primary Key Pattern:**
```
PK: TENANT#{tenantId}#{EntityType}#{entityId}
SK: PROFILE | NOTE#{noteId} | INTERACTION#{id} | AGREEMENT#{id}
```

**Entity Types:**
```
TENANT#{tenantId}#CUSTOMER#{customerId}
├─ SK: PROFILE                    - Customer profile
├─ SK: NOTE#{noteId}              - Discussion notes
└─ SK: INTERACTION#{id}           - Call/meeting logs

TENANT#{tenantId}#OWNER#{ownerId}
├─ SK: PROFILE                    - Owner profile
├─ SK: NOTE#{noteId}              - Notes
└─ SK: PROPERTY#{propertyId}      - Properties owned

TENANT#{tenantId}#PROPERTY#{propertyId}
├─ SK: PROFILE                    - Property details
├─ SK: AGREEMENT#{agreementId}    - Lease agreements
├─ SK: VERIFICATION#{id}          - Property verification
└─ SK: DOCUMENT#{type}#{id}       - Property documents

TENANT#{tenantId}#MEETING#{meetingId}
├─ SK: PROFILE                    - Meeting details
└─ SK: EVENT#{eventId}            - Meeting events
```

**Global Secondary Indexes:**

```
GSI1: Owner-Property Index
├─ GSI1PK: TENANT#{tenantId}#OWNER#{ownerId}
├─ GSI1SK: PROPERTY#{propertyId}
└─ Use: Find all properties by owner

GSI2: Status Index
├─ GSI2PK: TENANT#{tenantId}#PROPERTY_STATUS#{status}
├─ GSI2SK: PROPERTY#{propertyId}
└─ Use: Find properties by status

GSI3: Search Index
├─ GSI3PK: TENANT#{tenantId}#SEARCH
├─ GSI3SK: CUSTOMER#name#phone | OWNER#name#phone
└─ Use: Full-text search across entities
```

**Customer Entity Example:**
```javascript
{
  PK: "TENANT#agency-123#CUSTOMER#cust-456",
  SK: "PROFILE",
  EntityType: "CUSTOMER",
  tenantId: "agency-123",
  customerId: "cust-456",
  
  // Identity
  name: "Rajesh Kumar",
  email: "rajesh@example.com",
  phone: "+919876543210",
  address: "Mumbai, India",
  
  // Source tracking
  source: "lead:lead-789",
  createdFrom: "lead:lead-789",
  
  // KYC
  aadharNumber: "1234-5678-9012",
  aadharDocS3Key: "kyc/aadhar/cust-456.pdf",
  
  // Status
  status: "active",
  conversionDate: "2026-06-01T10:30:00Z",
  
  // Metadata
  createdAt: "2026-05-15T08:00:00Z",
  updatedAt: "2026-06-18T14:30:00Z",
  createdBy: "System",
  
  // Search indexes
  GSI3PK: "TENANT#agency-123#SEARCH",
  GSI3SK: "CUSTOMER#rajesh kumar#9876543210"
}
```

#### Other DynamoDB Tables

| Table | Purpose | PK/SK Pattern |
|-------|---------|---------------| 
| `real-estate-core` | Legacy data (areas, buildings, flats) | AREA#{id}, BUILDING#{id} |
| `real-estate-agencies` | Agency configuration | TENANT#{tenantId} |
| `real-estate-enquiries` | Lead enquiries | TENANT#{tenantId}#ENQUIRY#{id} |
| `real-estate-areas` | Geographic areas | AREA#{areaId} |
| `cloudberry-real-estate-khata` | Ledger entries | TENANT#{tenantId}#ENTRY#{entryId} |
| `cloudberry-real-estate-notifications` | Notifications | TENANT#{tenantId}#NOTIFICATION#{id} |
| `cloudberry-real-estate-developers` | Developer profiles | DEVELOPER#{developerId} |
| `cloudberry-real-estate-communities` | Community/area data | AREA#{areaId} |
| `cloudberry-real-estate-projects` | Developer projects | PROJECT#{projectId} |
| `Subscriptions` | Subscription records | TENANT#{tenantId}#SUBSCRIPTION#{id} |
| `Grievances` | Grievance records | TENANT#{tenantId}#GRIEVANCE#{id} |

### 3.3 API Routes Structure

```
apps/crm/server/
├── routes/
│   ├── auth.js                 - Authentication
│   ├── crm.js                  - CRM dashboard & metrics
│   ├── contacts.js             - Contact CRUD
│   ├── leads.js                - Lead management
│   ├── buyers.js               - Buyer profiles
│   ├── enquiries.js            - Enquiry handling
│   ├── b2bLeads.js             - B2B lead management
│   ├── khata.js                - Khata book operations
│   ├── notifications.js        - Notification management
│   ├── grievance.js            - Grievance handling
│   ├── billing.js              - Billing & Razorpay
│   ├── aiEmployeeStatus.js     - AI employee status
│   ├── subscriptions.js        - Subscription management
│   └── feedback.js             - NPS & feedback
│
├── middleware/
│   ├── rateLimiter.js          - Rate limiting
│   ├── requestLogger.js        - Request logging
│   ├── csp.js                  - Content Security Policy
│   └── authMiddleware.js       - JWT validation
│
└── Services (Database Layer):
    ├── crmDynamodbService.js        - CRM operations
    ├── dynamodbService.js           - Legacy operations
    ├── khataRoutes.js               - Ledger operations
    ├── notificationDynamodbService.js
    ├── grievanceDynamodbService.js
    ├── subscriptionService.js
    ├── areasDynamodbService.js
    ├── enquiryDynamodbService.js
    ├── developersDynamodbService.js
    ├── projectsDynamodbService.js
    ├── realEstateAreasDynamodbService.js
    ├── agencyConfigService.js
    ├── s3Service.js
    ├── aiEmployeeProvisioningService.js
    └── webhookLogService.js
```

### 3.4 Multi-Tenancy Implementation

**Tenant Isolation Strategy:**

1. **Tenant ID Extraction:**
   ```javascript
   // From JWT claims (Cognito sub)
   const tenantId = req.user.tenantId || req.user.sub;
   
   // Or from header (x-tenant-id)
   const tenantId = req.headers['x-tenant-id'];
   ```

2. **Data Isolation:**
   - All DynamoDB PKs prefixed with `TENANT#{tenantId}`
   - All queries filtered by tenantId
   - S3 paths: `/{tenantId}/{category}/`
   - No cross-tenant data access possible

3. **RBAC (Role-Based Access Control):**
   ```javascript
   // User roles
   - ADMIN: Full access to agency
   - MEMBER: Limited access (assigned by admin)
   - GUEST: Read-only access
   ```

4. **Subscription Enforcement:**
   - Trial: 14 days free, limited features
   - Paid: Unlimited features, seat limits
   - Seat management: Track active users per tier

---

## PART 4: FRONTEND ARCHITECTURE

### 4.1 React App Structure

```
apps/crm/real-estate-crm-app/src/
├── pages/
│   ├── AdminLogin.tsx              - Admin authentication
│   ├── PhoneLogin.tsx              - Phone OTP login
│   ├── AuthCallback.tsx            - OAuth callback
│   ├── RoleSelection.tsx           - Role selection
│   ├── AcceptInvite.tsx            - Accept team invite
│   ├── Profile.tsx                 - User profile
│   │
│   ├── crm/
│   │   ├── CRMDashboard.tsx        - Main dashboard
│   │   ├── ContactList.tsx         - Contact CRUD
│   │   ├── LeadList.tsx            - Lead management
│   │   ├── BuyerList.tsx           - Buyer profiles
│   │   ├── OwnerList.tsx           - Owner management
│   │   ├── PropertyList.tsx        - Property inventory
│   │   ├── PropertyDetails.tsx     - Property detail view
│   │   ├── CustomerList.tsx        - Customer management
│   │   ├── TenantList.tsx          - Tenant management
│   │   ├── KhataBook.tsx           - Ledger management
│   │   ├── Calendar.tsx            - Meeting calendar
│   │   ├── BusinessAnalytics.tsx   - Analytics dashboard
│   │   ├── AIEmployeeStatus.tsx    - AI agent status
│   │   └── ... (more CRM pages)
│   │
│   ├── admin/
│   │   ├── InviteManagement.tsx    - Team invite management
│   │   ├── MemberManagement.tsx    - Team member management
│   │   └── GrievanceList.tsx       - Grievance handling
│   │
│   └── public/
│       ├── Grievance.tsx           - Public grievance form
│       └── NpsEmailLanding.tsx     - NPS survey landing
│
├── components/
│   ├── GlassDataTable.tsx          - Reusable data table
│   ├── LoadingSpinner.tsx          - Loading indicator
│   ├── Toast.tsx                   - Toast notifications
│   ├── ConfirmDialog.tsx           - Confirmation modal
│   ├── SearchableSelect.tsx        - Searchable dropdown
│   ├── PhoneInput.tsx              - Phone input with validation
│   ├── LocationPicker.tsx          - Google Maps location picker
│   ├── MediaUploadSection.tsx      - File upload
│   ├── ScheduleMeetingModal.tsx    - Meeting scheduler
│   ├── CreateOwnerModal.tsx        - Owner creation
│   ├── AddPropertyModal.tsx        - Property creation
│   ├── NotificationCenter.tsx      - Notifications
│   ├── PermissionGuard.tsx         - RBAC guard
│   ├── DemoBanner.tsx              - Demo mode banner
│   ├── TrialCountdownBanner.tsx    - Trial countdown
│   ├── PaywallModal.tsx            - Paywall modal
│   ├── NpsModal.tsx                - NPS survey modal
│   └── ... (more components)
│
├── contexts/
│   ├── GoogleMapsContext.tsx       - Google Maps API context
│   └── SubscriptionContext.tsx     - Subscription state
│
├── services/
│   └── api.ts                      - API client (axios)
│
├── utils/
│   ├── authStorage.ts              - Auth token management
│   ├── cognitoAuth.ts              - Cognito integration
│   └── formatters.ts               - Data formatting
│
├── lib/
│   └── analytics.ts                - PostHog analytics
│
├── App.tsx                         - Main app component
└── main.tsx                        - Entry point
```

### 4.2 Key Frontend Features

**Authentication Flow:**
```
1. User visits /phone-login
2. Enters phone number → POST /auth/phone/start
3. Receives OTP via SMS (Cognito trigger)
4. Enters OTP → POST /auth/phone/confirm
5. If new user → show onboarding UI
6. If existing user → redirect to dashboard
7. Tokens stored in localStorage (authStorage)
```

**CRM Dashboard:**
- Real-time metrics (contacts, leads, properties)
- Quick actions (create contact, add property)
- Recent activities timeline
- Subscription status & seat counter
- Trial countdown banner

**Contact Management:**
- Search & filter contacts
- Create/edit/delete contacts
- Add notes & interactions
- Track conversion from lead
- Schedule meetings
- View activity timeline

**Property Management:**
- Property listing with filters
- Property details with agreements
- Document upload & management
- Verification tracking
- Owner assignment
- Status tracking (available, rented, sold)

---

## PART 5: DATA MIGRATION STRATEGY (DynamoDB → PostgreSQL)

### 5.1 Migration Overview

**Current State:** DynamoDB (NoSQL, single-table design)  
**Target State:** PostgreSQL (SQL, normalized schema)  
**Scope:** All 11+ DynamoDB tables → PostgreSQL tables

### 5.2 PostgreSQL Schema Design

**Core Tables:**

```sql
-- Tenants (Agencies)
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Customers (Buyers)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  source VARCHAR(100),
  created_from VARCHAR(100),
  aadhar_number VARCHAR(50),
  aadhar_doc_s3_key VARCHAR(500),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(255),
  UNIQUE(tenant_id, phone),
  INDEX(tenant_id, status)
);

-- Owners (Landlords)
CREATE TABLE owners (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(255),
  UNIQUE(tenant_id, phone),
  INDEX(tenant_id)
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  owner_id UUID REFERENCES owners(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50),
  sub_type VARCHAR(50),
  area VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  price BIGINT,
  currency VARCHAR(10),
  price_per_sqft BIGINT,
  built_up_area DECIMAL(10, 2),
  carpet_area DECIMAL(10, 2),
  bedrooms INT,
  bathrooms INT,
  status VARCHAR(50),
  listed_date TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(255),
  INDEX(tenant_id, status),
  INDEX(owner_id),
  INDEX(area, city)
);

-- Customer Notes
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(255),
  INDEX(customer_id)
);

-- Owner Notes
CREATE TABLE owner_notes (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  owner_id UUID REFERENCES owners(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(255),
  INDEX(owner_id)
);

-- Property Agreements
CREATE TABLE property_agreements (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  property_id UUID REFERENCES properties(id),
  type VARCHAR(50),
  status VARCHAR(50),
  start_date DATE,
  end_date DATE,
  terms TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX(property_id)
);

-- Property Verifications
CREATE TABLE property_verifications (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  property_id UUID REFERENCES properties(id),
  type VARCHAR(50),
  status VARCHAR(50),
  verified_date TIMESTAMP,
  verified_by VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX(property_id)
);

-- Property Documents
CREATE TABLE property_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  property_id UUID REFERENCES properties(id),
  type VARCHAR(50),
  s3_key VARCHAR(500),
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP,
  uploaded_by VARCHAR(255),
  INDEX(property_id)
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  title VARCHAR(255),
  description TEXT,
  scheduled_at TIMESTAMP,
  location VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX(tenant_id, status)
);

-- Meeting Events
CREATE TABLE meeting_events (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  meeting_id UUID REFERENCES meetings(id),
  event_type VARCHAR(50),
  details TEXT,
  created_at TIMESTAMP,
  INDEX(meeting_id)
);

-- Khata Categories
CREATE TABLE khata_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  UNIQUE(tenant_id, name)
);

-- Khata Entries
CREATE TABLE khata_entries (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  property_id UUID REFERENCES properties(id),
  category_id UUID REFERENCES khata_categories(id),
  description TEXT,
  amount DECIMAL(15, 2),
  entry_date DATE,
  settlement_status VARCHAR(50),
  settled_at TIMESTAMP,
  settled_by VARCHAR(255),
  settlement_notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX(tenant_id, property_id),
  INDEX(settlement_status)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id VARCHAR(255),
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP,
  INDEX(tenant_id, user_id, read)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  plan VARCHAR(50),
  status VARCHAR(50),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  trial_days INT,
  trial_end_date TIMESTAMP,
  seats INT,
  razorpay_subscription_id VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(tenant_id)
);

-- Grievances
CREATE TABLE grievances (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  complainant_name VARCHAR(255),
  complainant_email VARCHAR(255),
  complainant_phone VARCHAR(20),
  subject VARCHAR(255),
  description TEXT,
  status VARCHAR(50),
  resolution TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX(status, created_at)
);
```

### 5.3 Migration Execution Plan

**Phase 1: Preparation (Week 1)**
- [ ] Set up PostgreSQL instance (RDS)
- [ ] Create all tables with indexes
- [ ] Set up migration scripts
- [ ] Test connection & permissions
- [ ] Create backup of DynamoDB data

**Phase 2: Data Export (Week 2)**
- [ ] Export all DynamoDB tables to JSON/CSV
- [ ] Validate data integrity
- [ ] Transform data to PostgreSQL schema
- [ ] Handle data type conversions
- [ ] Resolve missing/invalid data

**Phase 3: Data Import (Week 2-3)**
- [ ] Bulk import to PostgreSQL
- [ ] Verify row counts match
- [ ] Validate foreign key relationships
- [ ] Check index creation
- [ ] Test query performance

**Phase 4: Application Migration (Week 3-4)**
- [ ] Update backend to use PostgreSQL
- [ ] Replace DynamoDB SDK with PostgreSQL driver (pg)
- [ ] Update all service layer queries
- [ ] Implement connection pooling
- [ ] Add transaction support

**Phase 5: Testing (Week 4-5)**
- [ ] Unit tests for data access layer
- [ ] Integration tests for APIs
- [ ] Load testing
- [ ] Backup/recovery testing
- [ ] Rollback plan testing

**Phase 6: Deployment (Week 5)**
- [ ] Blue-green deployment setup
- [ ] Gradual traffic migration
- [ ] Monitor error rates & performance
- [ ] Rollback if issues detected
- [ ] Decommission DynamoDB

### 5.4 Code Changes Required

**Backend Service Layer Changes:**

```javascript
// BEFORE (DynamoDB)
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

export async function getCustomer(tenantId, customerId) {
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE'
    }
  }));
  return result.Item;
}

// AFTER (PostgreSQL)
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function getCustomer(tenantId, customerId) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND id = $2',
    [tenantId, customerId]
  );
  return result.rows[0] || null;
}
```

**Query Pattern Changes:**

```javascript
// DynamoDB: Scan + Filter
const result = await docClient.send(new ScanCommand({
  TableName: CRM_TABLE_NAME,
  FilterExpression: 'tenantId = :tid AND EntityType = :type',
  ExpressionAttributeValues: {
    ':tid': tenantId,
    ':type': 'CUSTOMER'
  }
}));

// PostgreSQL: Direct Query
const result = await pool.query(
  'SELECT * FROM customers WHERE tenant_id = $1',
  [tenantId]
);
```

**Transaction Support:**

```javascript
// PostgreSQL transactions
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // Multiple operations
  await client.query('INSERT INTO customers ...', [...]);
  await client.query('INSERT INTO customer_notes ...', [...]);
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

## PART 6: CRITICAL FINDINGS & RECOMMENDATIONS

### 6.1 Current Architecture Strengths

✅ **Multi-Tenant Isolation:** Excellent implementation with tenant ID prefixing  
✅ **Scalability:** Serverless architecture (Lambda) scales automatically  
✅ **Security:** JWT-based auth, CORS protection, rate limiting  
✅ **Modularity:** Separate microservices for auth, CRM, AI calling  
✅ **Documentation:** Comprehensive API documentation  
✅ **Error Handling:** Centralized error middleware with Sentry integration  
✅ **Analytics:** PostHog integration for product insights  

### 6.2 Current Architecture Weaknesses

⚠️ **DynamoDB Limitations:**
- Scan operations inefficient for large datasets
- Limited query flexibility (key-based only)
- No native joins (data denormalization required)
- Higher costs at scale

⚠️ **Single-Table Design Complexity:**
- Difficult to maintain (PK/SK patterns hard to understand)
- Prone to errors in key construction
- Limited ability to add new entity types

⚠️ **Missing Indexes:**
- TODO comment indicates missing tenant-index GSI
- Scan operations currently full-table (performance issue)

⚠️ **Transaction Support:**
- Limited to single-item transactions
- No multi-item ACID transactions
- Risk of data inconsistency in complex operations

### 6.3 Migration Benefits

✅ **Improved Query Performance:** Direct SQL queries vs DynamoDB scans  
✅ **Better Data Integrity:** ACID transactions, foreign keys  
✅ **Easier Maintenance:** Normalized schema, standard SQL  
✅ **Cost Optimization:** Fixed instance cost vs pay-per-request  
✅ **Advanced Features:** Full-text search, complex joins, window functions  
✅ **Operational Simplicity:** Standard database tools & monitoring  

### 6.4 Pre-Migration Checklist

- [ ] Audit all DynamoDB queries for migration compatibility
- [ ] Document all custom indexes & access patterns
- [ ] Create comprehensive test suite for data access layer
- [ ] Set up PostgreSQL monitoring & alerting
- [ ] Plan maintenance window (low-traffic period)
- [ ] Create detailed runbook for migration day
- [ ] Brief all team members on changes
- [ ] Prepare customer communication plan
- [ ] Set up parallel running (both DBs) for validation
- [ ] Create detailed rollback procedures

---

## PART 7: SUMMARY & NEXT STEPS

### 7.1 Current State Summary

**Product:** Full-featured real estate CRM for Indian agents  
**Users:** Agencies with multi-tenant support  
**Data:** 11+ DynamoDB tables with single-table design  
**Architecture:** Serverless (Lambda + API Gateway)  
**Frontend:** React + TypeScript + TailwindCSS  
**Auth:** Cognito (Google + Phone OTP)  
**Integrations:** Exotel, ElevenLabs, Razorpay, Brevo, etc.  

### 7.2 Migration Readiness Assessment

| Aspect | Status | Risk |
|--------|--------|------|
| Data Volume | Medium (< 1M records) | Low |
| Complexity | High (11 tables, GSIs) | Medium |
| Downtime Tolerance | Low (production app) | High |
| Team Expertise | Medium (Node.js, AWS) | Medium |
| Testing Coverage | Medium (E2E tests exist) | Medium |
| Documentation | Good (API docs exist) | Low |

### 7.3 Recommended Migration Timeline

- **Week 1:** Preparation & setup
- **Week 2:** Data export & transformation
- **Week 3:** Import & validation
- **Week 4:** Application code changes & testing
- **Week 5:** Deployment & monitoring

**Total Effort:** ~4-6 weeks for a team of 2-3 engineers

### 7.4 Critical Success Factors

1. ✅ Comprehensive data backup before migration
2. ✅ Parallel running (both DBs) for validation
3. ✅ Extensive testing of all API endpoints
4. ✅ Clear rollback procedures
5. ✅ Team training on PostgreSQL
6. ✅ Monitoring & alerting setup
7. ✅ Customer communication plan
8. ✅ Gradual traffic migration (blue-green)

---

## CONCLUSION

RealtyFlow is a well-architected, production-ready real estate CRM with excellent multi-tenancy implementation and scalable serverless infrastructure. The migration from DynamoDB to PostgreSQL is a strategic move that will improve query flexibility, data integrity, and operational simplicity while reducing long-term costs.

The migration is feasible within 4-6 weeks with proper planning, comprehensive testing, and a clear rollback strategy. The benefits of improved performance, ACID transactions, and operational simplicity far outweigh the migration effort.

**Recommendation:** Proceed with migration planning and begin Phase 1 (Preparation) immediately.
