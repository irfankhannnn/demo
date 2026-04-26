# CRM E2E Tests

Playwright-based end-to-end tests for the CRM application.

## Overview

This test suite covers the full CRM application functionality including:
- Lead management (creation, filtering, conversion)
- Owner, Property, Tenant, and Buyer CRUD operations
- File uploads (KYC documents, property images, videos, PDFs)
- Admin UI (invites, member management)
- CRM Operations (Calendar, Analytics, Hierarchy, B2B Leads)
- Khata Book (rental ledger, entries, settlements)

## Directory Structure

```
test/
├── script/                           # Test sources
│   ├── helpers/                      # Shared utilities
│   │   ├── auth.ts                   # Phone + OTP login flow
│   │   ├── config.ts                 # Base URL, test credentials, timeouts
│   │   ├── evidence.ts               # Screenshot + logging helpers
│   │   ├── seedData.ts               # Realistic test data generation
│   │   └── uploadHelpers.ts          # File upload helpers (KYC, property media, docs)
│   ├── flows/                        # Feature-specific test flows
│   │   ├── leadFlow.ts               # Lead creation, filtering, details
│   │   ├── adminUiFlow.ts            # Admin dashboard and settings
│   │   ├── dashboardCoreFlow.ts      # Dashboard metrics + entity operations
│   │   ├── crmOperationsFlow.ts      # Calendar, Analytics, Hierarchy, B2B Leads
│   │   └── khata/                    # Khata Book flows
│   │       ├── khataData.ts          # Test data generation
│   │       ├── khataSetupFlow.ts     # Owner/Property setup
│   │       ├── khataBookFlow.ts      # Khata list and filtering
│   │       ├── khataEntryFlow.ts     # Entry creation and management
│   │       └── khataSettlementFlow.ts # Settlement and reports
│   ├── *.spec.ts                     # Spec files (entry points)
│   │   ├── lead-flows.spec.ts        # Independent: leads only
│   │   ├── admin-ui-flows.spec.ts    # Independent: admin UI only
│   │   ├── dashboard-core-flows.spec.ts # Independent: dashboard + entity ops
│   │   ├── crm-operations-flows.spec.ts # Independent: CRM ops only
│   │   ├── khata-flows.spec.ts       # Independent: Khata book only
│   │   └── all-flows.spec.ts         # Master: all flows in one session
│   ├── playwright.config.ts          # Playwright configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   └── package.json                  # Dependencies and scripts
├── evidences/                        # Screenshots + logs, categorized by feature
│   ├── admin-ui/                     # Admin UI screenshots
│   ├── all-flows/                    # Master suite screenshots
│   ├── crm-operations/               # Calendar, Analytics, Hierarchy, B2B screenshots
│   ├── dashboard-operations/         # Dashboard screenshots
│   ├── khata-flows/                  # Khata book screenshots
│   ├── lead-flows/                   # Lead flow screenshots
│   ├── assets/                       # Dummy asset files for upload tests
│   │   ├── Adhar_Card.jpg
│   │   ├── Pan_Card.jpg
│   │   ├── agreemnet_doc.pdf
│   │   ├── property_doc.pdf
│   │   ├── property_image.jpg
│   │   └── property_video.mp4
│   └── playwright-report/            # HTML test report (index.html)
└── README.md
```

## Test Spec Details

### 1. Lead Flows (`lead-flows.spec.ts`)

**What it tests:**
- Phone + OTP authentication
- Create 7 leads (buyers, sellers, tenants, owners)
- Lead list verification
- Lead details and notes management
- Filter by type and search by name
- Lead conversion workflows

**Flow file:** `flows/leadFlow.ts`

**Run command:**
```bash
cd test/script
npm run test:leads
```

### 2. Admin UI Flows (`admin-ui-flows.spec.ts`)

**What it tests:**
- Admin dashboard navigation
- Settings page access
- User management (invite creation)
- System configuration

**Flow file:** `flows/adminUiFlow.ts`

**Run command:**
```bash
cd test/script
npm run test:admin
```

### 3. Dashboard Core Flows (`dashboard-core-flows.spec.ts`)

**What it tests:**
- Dashboard overview cards (Leads, Buyers, Owners, Total Properties, Tenants, Sellers)
- Owner creation with form fill and save
- Owner KYC document uploads (Photo, PAN, Aadhar) on edit page
- Property creation with pending uploads (image, video, agreement PDF, verification PDF)
- Property generic document upload in edit mode
- Tenant creation
- Buyer creation
- Lead creation and conversion to owner/tenant/buyer
- Session loss detection and re-authentication

**Flow file:** `flows/dashboardCoreFlow.ts`

**Run command:**
```bash
cd test/script
npm run test:dashboard
```

### 4. CRM Operations Flows (`crm-operations-flows.spec.ts`)

**What it tests:**
- **Calendar:** View toggles (Month/Week/Day/List), metrics cards, status filter, meeting popup, reschedule modal
- **Analytics:** KPI cards, secondary metrics, agreement expiry table with filters/sort, verification status table, CSV export
- **Hierarchy:** City→Area→Building→Property drill-down with breadcrumb navigation
- **B2B Leads:** Search, filter, lead detail drawer, schedule meeting

**Flow file:** `flows/crmOperationsFlow.ts`

**Run command:**
```bash
cd test/script
npm run test:ops
```

### 5. Khata Book Flows (`khata-flows.spec.ts`)

**What it tests:**
- Owner and property setup via UI
- Khata book list and filtering
- Entry creation with validation
- Settlement view and reports
- Transaction management
- Settlement Intelligence dashboard (aging, properties, history)

**Flow files:** `flows/khata/*.ts`

**Run command:**
```bash
cd test/script
npm run test:khata
```

### 6. All Flows (`all-flows.spec.ts`)

**What it tests:**
- Runs all the above flows in a single browser session after one login
- Ensures cross-feature session stability
- Tests the entire application workflow end-to-end

**Run command:**
```bash
cd test/script
npm run test:all
```

## NPM Commands

### Individual Test Suites

Run from `test/script` directory:

```bash
# Lead management tests
npm run test:leads

# Admin UI tests
npm run test:admin

# Dashboard + entity operations tests
npm run test:dashboard

# CRM operations (Calendar, Analytics, Hierarchy, B2B) tests
npm run test:ops

# Khata Book tests
npm run test:khata
```

### All Tests at Once

```bash
# Master suite - all flows in one session
npm run test:all

# All tests in headless mode (no visible browser)
npm run test

# All tests in headed mode (visible browser)
npm run test:headed
```

### Other Commands

```bash
# Debug mode with step-by-step execution
npm run test:debug

# View HTML test report
npm run test:report

# Install Playwright browsers
npm run install:browsers
```

### Direct Playwright Commands

```bash
# Run specific spec file
npx playwright test lead-flows.spec.ts --headed
npx playwright test dashboard-core-flows.spec.ts --headed

# Run with specific reporter
npx playwright test --reporter=list

# Run specific line
npx playwright test --line 123
```

## Test Data & Helpers

### Config (`helpers/config.ts`)
- `BASE_URL`: `http://localhost:3000`
- `TEST_PHONE`: `8291537522`
- `TEST_OTP`: `123456`
- `TEST_TIMEOUT_MS`: `300000` (5 minutes)
- `ASSETS_DIR`: Path to dummy upload files

### Seed Data (`helpers/seedData.ts`)
Realistic test data with Indian names, phone numbers, and addresses:
- **Owners, Buyers, Tenants:** 10 each
- **Properties:** 10 titles, areas, cities, types, BHK counts
- **Lead Requirements:** Buyer, tenant, seller, owner requirements
- **Sources & Statuses:** Realistic options for filtering

### Upload Helpers (`helpers/uploadHelpers.ts`)
Reusable upload functions for file-input tests:
- **Owner KYC:** `uploadOwnerPhoto()`, `uploadOwnerPan()`, `uploadOwnerAadhar()`, `assertOwnerKycUploadsVisible()`
- **Property pending:** `setPropertyImageInput()`, `setPropertyVideoInput()`, `setPropertyAgreementDocInput()`, `setPropertyVerificationDocInput()`, `assertPropertyPendingUploadsVisible()`
- **Property edit:** `selectPropertyDocumentType()`, `setPropertyGenericDocInput()`, `clickPropertyDocumentUploadButton()`, `assertPropertyDocumentInList()`

### Evidence (`helpers/evidence.ts`)
- `setupEvidence(feature)`: Creates evidence folder for a feature
- `createLogger(feature)`: Creates a logging function
- `snap(page, ctx, name)`: Takes a screenshot with sequential naming

### Auth (`helpers/auth.ts`)
- `loginWithPhoneOtp(page, ctx)`: Performs phone + OTP authentication

## Prerequisites

1. **Frontend running** at `http://localhost:3000`
2. **Backend/auth services** configured to accept test OTP `123456` for phone `8291537522`
3. **.env file** with `VITE_API_URL` pointing to backend
4. **Node.js 18+** installed

## Installation

```bash
# Navigate to test script directory
cd test/script

# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

## Test Artifacts & Evidence

After test execution, evidence is saved to:

```
evidences/
├── playwright-report/           # HTML test report (index.html)
├── lead-flows/                  # Lead flow screenshots
├── admin-ui/                    # Admin UI screenshots
├── dashboard-operations/        # Dashboard screenshots
├── crm-operations/              # Calendar, Analytics, Hierarchy, B2B screenshots
├── khata-flows/                 # Khata book screenshots
└── all-flows/                   # Master suite screenshots
```

Each feature folder contains:
- Sequential numbered screenshots (01-, 02-, etc.)
- Evidence logs with test step details
- Failure traces if tests fail

## Configuration

Edit `playwright.config.ts` to modify:
- Base URL (default: http://localhost:3000)
- Browser settings (viewport, headless mode)
- Screenshot/video options
- Retry attempts
- Timeout values

## Troubleshooting

### Login Issues
If OTP verification fails:
- Ensure backend allows test OTP (123456)
- Check that test phone number (8291537522) is configured in backend
- Verify `.env` has correct `VITE_API_URL`

### Screenshot Location
Screenshots are saved to `evidences/<feature>/` with sequential numbering (01-, 02-, etc.).
Check console output for exact paths and feature names.

### Backend Not Responding
Ensure the CRM backend is running at `http://localhost:3000` before starting tests.
Set `VITE_API_URL` in `.env` if using a different backend URL.

### Test Timeout
If tests timeout:
- Increase `TEST_TIMEOUT_MS` in `helpers/config.ts` (default: 300,000 ms = 5 min)
- Check network latency and backend response times
- Run individual feature tests instead of master suite

### Session Loss Errors
If tests fail with "redirected to login":
- Check token expiration settings in backend
- Ensure auth session persistence is working
- Tests now include automatic re-authentication on session loss

## Adding New Test Flows

1. **Create flow file** in `flows/` directory:
   ```typescript
   import { Page, test } from '@playwright/test';
   import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';

   export async function runMyFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
     const log = createLogger(ctx.feature);
     
     await test.step('My feature: step 1', async () => {
       // Test logic
       await snap(page, ctx, '01-step-description');
       log('MyFeature', 'PASS', 'Step completed');
     });
   }
   ```

2. **Create spec file** to run it independently:
   ```typescript
   import { test } from '@playwright/test';
   import { TEST_TIMEOUT_MS } from './helpers/config';
   import { setupEvidence } from './helpers/evidence';
   import { loginWithPhoneOtp } from './helpers/auth';
   import { runMyFlow } from './flows/myFlow';

   test('My feature flows', async ({ page }) => {
     test.setTimeout(TEST_TIMEOUT_MS);
     const ctx = setupEvidence('my-feature');
     await loginWithPhoneOtp(page, ctx);
     await runMyFlow(page, ctx);
   });
   ```

3. **Add npm script** to `package.json`:
   ```json
   "test:myfeature": "npx playwright test my-feature-flows.spec.ts --headed"
   ```

4. **(Optional) Add to master suite** `all-flows.spec.ts`:
   ```typescript
   import { runMyFlow } from './flows/myFlow';
   
   // In test step:
   await test.step('Run my-feature', async () => {
     const ctx = setupEvidence('my-feature');
     await runMyFlow(page, ctx);
   });
   ```
