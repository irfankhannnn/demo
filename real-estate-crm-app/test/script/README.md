# CRM Comprehensive Lead Tests

This directory contains a comprehensive Playwright test suite for testing the CRM's Lead Management functionality.

## Test Coverage

### Step 1: Login Authentication
- Phone login page navigation
- OTP entry and verification
- Session management
- Dashboard access

### Step 2: Empty State Verification
- Leads list page with zero data
- Empty state UI elements
- Filter buttons visibility
- "Add Lead" button functionality

### Step 3: Lead Creation (5 Leads)
Creates 5 leads with mock data:
1. **Rahul Sharma** - Buyer, High Priority, 2 BHK Apartment, Budget: 50L
2. **Priya Patel** - Seller, Medium Priority, 3 BHK Villa, Budget: 80L
3. **Amit Kumar** - Tenant, High Priority, 1 BHK Apartment, Rent: 25K
4. **Sneha Reddy** - Owner, Low Priority, 4 BHK House, Budget: 1.2Cr
5. **Vikram Malhotra** - Buyer, High Priority, 3 BHK Penthouse, Budget: 1.5Cr

### Step 4: Lead List Verification
- All 5 leads visible in list
- Correct lead count
- Name, phone, type, status display

### Step 5: Lead Details & Notes
- Open lead details view
- View complete lead information
- Add activity notes
- Save notes functionality

### Step 6: Filters & Search
- Filter by lead type (Buyer, Seller, Tenant, Owner)
- Search by name
- Reset filters

### Step 7: Lead Conversion
- Convert lead to Buyer/Owner/Tenant
- Conversion modal verification
- Confirmation flow

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
# Run all tests (headed mode - visible browser)
npm run test:headed

# Run all tests (headless mode)
npm run test

# Run with debug mode
npm run test:debug

# View HTML report after test
npm run test:report
```

## Test Artifacts

After test execution, artifacts are saved to:

```
test/
├── test-results/
│   ├── screenshots/           # All test screenshots
│   ├── test-results.json    # JSON test results
│   ├── playwright-report/   # HTML report
│   └── test-artifacts/      # Videos and traces
```

## Configuration

Edit `playwright.config.ts` to modify:
- Base URL (default: http://localhost:3000)
- Browser settings
- Screenshot/video options
- Retry attempts

## Mock Data

Mock data is defined in `comprehensive-lead-test.spec.ts` in the `LEADS_DATA` array. Modify this array to test with different data.

## Troubleshooting

### Login Issues
If OTP verification fails, the test will check for existing authenticated session. Ensure:
- Backend allows test OTP (123456) OR
- User is already logged in before test starts

### Screenshot Location
Screenshots are saved relative to the test-results directory. Check console output for exact paths.

### Backend Not Responding
Ensure the CRM backend is running at http://localhost:3000 before starting tests.
