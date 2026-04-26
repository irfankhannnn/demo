# CRM Comprehensive Test Suite

Modular Playwright test suite for the CRM application with separate flows for Leads, Admin UI, CRM Operations (Calendar, Analytics, Hierarchy, B2B Leads), Dashboard, and Khata Book.

## Directory Structure

```
test/script/
├── flows/                          # Feature-specific test flows
│   ├── leadFlow.ts                 # Lead creation, filtering, details
│   ├── adminUiFlow.ts              # Admin dashboard and settings
│   ├── dashboardCoreFlow.ts        # Core dashboard metrics
│   ├── crmOperationsFlow.ts        # Calendar, Analytics, Hierarchy, B2B Leads
│   └── khata/                      # Khata Book flows
│       ├── khataData.ts            # Test data generation
│       ├── khataSetupFlow.ts       # Owner/Property setup
│       ├── khataBookFlow.ts        # Khata list and filtering
│       ├── khataEntryFlow.ts       # Entry creation and management
│       └── khataSettlementFlow.ts  # Settlement and reports
├── helpers/                        # Shared utilities
│   ├── auth.ts                     # Phone + OTP login
│   ├── config.ts                   # Base URL, timeouts, test credentials
│   ├── evidence.ts                 # Screenshot and logging helpers
│   └── seedData.ts                 # Realistic test data generation
├── *.spec.ts                       # Spec files (entry points)
│   ├── lead-flows.spec.ts          # Lead flow tests
│   ├── admin-ui-flows.spec.ts      # Admin UI tests
│   ├── dashboard-core-flows.spec.ts # Dashboard tests
│   ├── crm-operations-flows.spec.ts # CRM operations tests
│   ├── khata-flows.spec.ts         # Khata book tests
│   └── all-flows.spec.ts           # Master suite (all flows in one session)
├── playwright.config.ts            # Playwright configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies and scripts
```

## Test Coverage

### Lead Flows (`lead-flows.spec.ts`)
- Phone + OTP authentication
- Create 7 leads (buyers, sellers, tenants, owners)
- Lead list verification
- Lead details and notes management
- Filter by type and search by name
- Lead conversion workflows

### Admin UI Flows (`admin-ui-flows.spec.ts`)
- Admin dashboard navigation
- Settings page access
- User management
- System configuration

### CRM Operations Flows (`crm-operations-flows.spec.ts`)
- **Calendar:** View toggles (Month/Week/Day/List), metrics cards, status filter, meeting popup, reschedule modal
- **Analytics:** KPI cards, secondary metrics, agreement expiry table with filters/sort, verification status table, CSV export
- **Hierarchy:** City→Area→Building→Property drill-down with breadcrumb navigation
- **B2B Leads:** Search, filter, lead detail drawer, schedule meeting

### Dashboard Core Flows (`dashboard-core-flows.spec.ts`)
- Dashboard metrics and KPIs
- Quick action buttons
- Navigation to feature pages

### Khata Book Flows (`khata-flows.spec.ts`)
- Owner and property setup
- Khata book list and filtering
- Entry creation with validation
- Settlement view and reports
- Transaction management

## Installation

```bash
# Navigate to test script directory
cd real-estate-crm-app/test/scrip

# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

## Running Tests

```bash
# Individual feature test suites
npm run test:leads       # Lead flows only
npm run test:admin       # Admin UI flows only
npm run test:dashboard   # Dashboard flows only
npm run test:ops         # CRM operations (Calendar, Analytics, Hierarchy, B2B) only
npm run test:khata       # Khata book flows only

# Master suite (all flows in one session)
npm run test:all         # Runs all flows sequentially after single login

# General commands
npm run test:headed      # All tests in headed mode (visible browser)
npm run test             # All tests in headless mode
npm run test:debug       # Debug mode with step-by-step execution

# View test report
npm run test:report      # Opens HTML report in browser
```

## Test Artifacts & Evidence

After test execution, evidence is saved to:

```
evidences/
├── playwright-report/           # HTML test report
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
- Browser settings
- Screenshot/video options
- Retry attempts

## Test Data

### Seed Data (`helpers/seedData.ts`)
Realistic test data with Indian names, phone numbers, and addresses:
- **Owners, Buyers, Tenants:** 10 each
- **Properties:** 10 titles, areas, cities, types, BHK counts
- **Lead Requirements:** Buyer, tenant, seller, owner requirements
- **Sources & Statuses:** Realistic options for filtering

### Dynamic Data Generation
Use `generateTestPhone()` and `generateTestEmail()` to create unique test data per run:
```typescript
import { generateTestPhone, generateTestEmail, getItemByIndex } from '../helpers/seedData';

const phone = generateTestPhone(1, 7000000000);  // 7000000001
const email = generateTestEmail('john', 1, 'test.com');  // john.1@test.com
```

## Adding New Test Flows

1. Create a new flow file in `flows/` directory:
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

2. Create a spec file to run it independently:
   ```typescript
   import { test } from '@playwright/test';
   import { setupEvidence, createLogger } from './helpers/evidence';
   import { loginWithPhoneOtp } from './helpers/auth';
   import { runMyFlow } from './flows/myFlow';

   test('My feature flows', async ({ page }) => {
     const ctx = setupEvidence('my-feature');
     await loginWithPhoneOtp(page, ctx);
     await runMyFlow(page, ctx);
   });
   ```

3. Add npm script to `package.json`:
   ```json
   "test:myfeature": "npx playwright test my-feature-flows.spec.ts --headed"
   ```

4. (Optional) Add to `all-flows.spec.ts` for master suite integration.

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
