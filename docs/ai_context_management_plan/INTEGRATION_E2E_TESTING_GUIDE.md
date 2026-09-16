# RealtyFlow: Integration & E2E Testing Implementation Guide

**Version:** 1.0  
**Focus:** API Integration Tests and End-to-End Testing  
**Target Coverage:** 95% API, 70% E2E

---

## 1. Integration Testing Framework

### 1.1 Supertest Setup

**File:** `server/src/__tests__/integration/setup.ts`

```typescript
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, CreateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize test DynamoDB
const dynamoClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  region: 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Test data seeding
export async function seedTestData() {
  const testBuyer = {
    PK: 'TENANT#test#BUYER#1',
    SK: 'METADATA',
    buyerId: 'BUYER#1',
    tenantId: 'TENANT#test',
    name: 'Test Buyer',
    phone: '+919876543210',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new CreateCommand({
      TableName: 'RealtyFlowCRM',
      Item: testBuyer,
    })
  );
}

// Cleanup
export async function cleanupTestData() {
  // Delete test data
}

// Test token generation
export function generateTestToken(tenantId: string, userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { tenantId, userId, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}
```

### 1.2 API Integration Tests

**File:** `server/src/__tests__/integration/api/crm.routes.test.ts`

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import app from '../../../app';
import { seedTestData, cleanupTestData, generateTestToken } from '../setup';

const API_URL = '/api/crm';

describe('CRM API Integration Tests', () => {
  let testToken: string;
  let testTenantId: string;

  beforeAll(async () => {
    testTenantId = 'TENANT#test';
    testToken = generateTestToken(testTenantId, 'USER#test');
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /buyers - Create Buyer', () => {
    it('should create a buyer with valid data', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
          phone: '+919876543210',
          email: 'john@example.com',
          propertyType: 'apartment',
          budget: 5000000,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('buyerId');
      expect(response.body.name).toBe('John Doe');
      expect(response.body.tenantId).toBe(testTenantId);
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should return 400 for invalid phone', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
          phone: 'invalid',
          email: 'john@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('phone');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
          phone: '+919876543210',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'John Doe',
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .send({
          name: 'John Doe',
          phone: '+919876543210',
          email: 'john@example.com',
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', 'Bearer invalid-token')
        .send({
          name: 'John Doe',
          phone: '+919876543210',
          email: 'john@example.com',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /buyers/:id - Get Buyer', () => {
    let buyerId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Buyer',
          phone: '+919876543210',
          email: 'test@example.com',
        });
      buyerId = response.body.buyerId;
    });

    it('should retrieve buyer by ID', async () => {
      const response = await request(app)
        .get(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.buyerId).toBe(buyerId);
      expect(response.body.name).toBe('Test Buyer');
    });

    it('should return 404 for non-existent buyer', async () => {
      const response = await request(app)
        .get(`${API_URL}/buyers/BUYER#nonexistent`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 for cross-tenant access', async () => {
      const otherTenantToken = generateTestToken('TENANT#other', 'USER#other');
      const response = await request(app)
        .get(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /buyers/:id - Update Buyer', () => {
    let buyerId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Buyer',
          phone: '+919876543210',
          email: 'test@example.com',
        });
      buyerId = response.body.buyerId;
    });

    it('should update buyer with valid data', async () => {
      const response = await request(app)
        .put(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Updated Name',
          email: 'updated@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.email).toBe('updated@example.com');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 400 for invalid email on update', async () => {
      const response = await request(app)
        .put(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });

    it('should not allow updating tenantId', async () => {
      const response = await request(app)
        .put(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          tenantId: 'TENANT#other',
        });

      expect(response.status).toBe(400);
    });

    it('should return 403 for cross-tenant update', async () => {
      const otherTenantToken = generateTestToken('TENANT#other', 'USER#other');
      const response = await request(app)
        .put(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({
          name: 'Hacked Name',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /buyers/:id - Delete Buyer', () => {
    let buyerId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Buyer',
          phone: '+919876543210',
          email: 'test@example.com',
        });
      buyerId = response.body.buyerId;
    });

    it('should delete buyer', async () => {
      const response = await request(app)
        .delete(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 403 for cross-tenant delete', async () => {
      const otherTenantToken = generateTestToken('TENANT#other', 'USER#other');
      const response = await request(app)
        .delete(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /buyers - List Buyers', () => {
    beforeEach(async () => {
      // Create 25 test buyers
      for (let i = 0; i < 25; i++) {
        await request(app)
          .post(`${API_URL}/buyers`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Buyer ${i}`,
            phone: `+9198765432${String(i).padStart(2, '0')}`,
            email: `buyer${i}@example.com`,
          });
      }
    });

    it('should list buyers with pagination', async () => {
      const response = await request(app)
        .get(`${API_URL}/buyers?limit=10`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(10);
      expect(response.body.nextToken).toBeDefined();
    });

    it('should handle pagination with nextToken', async () => {
      const page1 = await request(app)
        .get(`${API_URL}/buyers?limit=10`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.items).toHaveLength(10);

      const page2 = await request(app)
        .get(`${API_URL}/buyers?limit=10&nextToken=${page1.body.nextToken}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.items).toHaveLength(10);
      expect(page2.body.items[0].buyerId).not.toBe(page1.body.items[0].buyerId);
    });

    it('should filter by search term', async () => {
      const response = await request(app)
        .get(`${API_URL}/buyers?search=Buyer%205`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0].name).toContain('Buyer 5');
    });

    it('should only return own tenant data', async () => {
      const response = await request(app)
        .get(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      for (const buyer of response.body.items) {
        expect(buyer.tenantId).toBe(testTenantId);
      }
    });
  });

  describe('Complex Workflows', () => {
    it('should handle buyer-lead-property workflow', async () => {
      // Create buyer
      const buyerRes = await request(app)
        .post(`${API_URL}/buyers`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Workflow Buyer',
          phone: '+919876543210',
          email: 'workflow@example.com',
        });

      expect(buyerRes.status).toBe(201);
      const buyerId = buyerRes.body.buyerId;

      // Create property
      const propertyRes = await request(app)
        .post(`${API_URL}/properties`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          address: '123 Test Street',
          city: 'Mumbai',
          price: 5000000,
          propertyType: 'apartment',
        });

      expect(propertyRes.status).toBe(201);
      const propertyId = propertyRes.body.propertyId;

      // Create lead
      const leadRes = await request(app)
        .post(`${API_URL}/leads`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          buyerId,
          propertyId,
          status: 'interested',
        });

      expect(leadRes.status).toBe(201);
      expect(leadRes.body.leadId).toBeDefined();

      // Verify relationships
      const updatedBuyer = await request(app)
        .get(`${API_URL}/buyers/${buyerId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(updatedBuyer.body.leads).toContain(leadRes.body.leadId);
    });
  });
});
```

---

## 2. E2E Testing with Playwright

### 2.1 Enhanced Playwright Configuration

**File:** `tests/playwright/playwright.config.ts` (Updated)

```typescript
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_CI = !!process.env.CI;

const sharedUse = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
  headless: !process.env.PW_HEADED,
  trace: IS_CI ? 'retain-on-failure' : 'on-first-retry',
  screenshot: 'only-on-failure',
  video: IS_CI ? 'retain-on-failure' : 'off',
  actionTimeout: 15_000,
  navigationTimeout: 20_000,
  viewport: { width: 1280, height: 720 },
  ignoreHTTPSErrors: true,
} as const;

export default defineConfig({
  name: 'realtyflow-e2e',
  testDir: __dirname,
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 1,
  workers: IS_CI ? 4 : 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: IS_CI ? [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, 'reports', 'json', 'results.json') }],
    ['junit', { outputFile: path.join(__dirname, 'reports', 'junit', 'results.xml') }],
  ] : [
    ['line'],
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html'), open: 'never' }],
  ],

  outputDir: path.join(__dirname, 'reports', 'artifacts'),

  projects: [
    {
      name: 'setup',
      testMatch: /setup\/auth\.setup\.ts/,
    },
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'], ...sharedUse },
      testMatch: [/ui\/public\/.*\.spec\.ts/],
    },
    {
      name: 'chromium-api',
      use: { ...devices['Desktop Chrome'], ...sharedUse },
      testMatch: [/api\/.*\.spec\.ts/],
    },
    {
      name: 'chromium-crm',
      use: {
        ...devices['Desktop Chrome'],
        ...sharedUse,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/crm\/.*\.spec\.ts/],
    },
    ...(IS_CI ? [{
      name: 'firefox-crm',
      use: {
        ...devices['Desktop Firefox'],
        ...sharedUse,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/crm\/.*\.spec\.ts/],
    }] : []),
  ],

  webServer: {
    command: 'cd ../../real-estate-crm-app && npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    timeout: 120_000,
    reuseExistingServer: !IS_CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

### 2.2 E2E Test Example - Lead Management

**File:** `tests/playwright/ui/crm/lead-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';

test.describe('Lead Management E2E', () => {
  test.setTimeout(TEST_TIMEOUT_MS);

  let ctx: any;
  let log: any;

  test.beforeEach(async ({ page }) => {
    ctx = setupEvidence('lead-management');
    log = createLogger(ctx.feature);
    setupDialogHandler(page, log);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should create and manage a lead', async ({ page }) => {
    // Navigate to leads page
    log('Navigation', 'INFO', 'Navigating to leads page');
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Click create lead button
    log('Action', 'INFO', 'Clicking create lead button');
    await page.click('button:has-text("Create Lead")');
    await page.waitForSelector('[data-testid="lead-form"]');

    // Fill lead form
    log('Action', 'INFO', 'Filling lead form');
    await page.fill('[data-testid="buyer-select"]', 'John Doe');
    await page.click('text=John Doe');

    await page.fill('[data-testid="property-select"]', '123 Main Street');
    await page.click('text=123 Main Street');

    await page.selectOption('[data-testid="status-select"]', 'interested');

    // Submit form
    log('Action', 'INFO', 'Submitting lead form');
    await page.click('button:has-text("Create Lead")');

    // Verify success
    log('Verification', 'INFO', 'Verifying lead creation');
    await page.waitForSelector('[data-testid="success-message"]');
    const successMessage = await page.textContent('[data-testid="success-message"]');
    expect(successMessage).toContain('Lead created successfully');

    // Verify lead appears in list
    log('Verification', 'INFO', 'Verifying lead in list');
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');
    const leadRow = page.locator('text=John Doe').first();
    await expect(leadRow).toBeVisible();
  });

  test('should update lead status', async ({ page }) => {
    // Navigate to leads
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Find and click first lead
    log('Action', 'INFO', 'Clicking first lead');
    const firstLead = page.locator('[data-testid="lead-row"]').first();
    await firstLead.click();

    // Change status
    log('Action', 'INFO', 'Changing lead status');
    await page.selectOption('[data-testid="status-select"]', 'qualified');
    await page.click('button:has-text("Save")');

    // Verify update
    log('Verification', 'INFO', 'Verifying status update');
    await page.waitForSelector('[data-testid="success-message"]');
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toContainText('qualified');
  });

  test('should filter leads by status', async ({ page }) => {
    // Navigate to leads
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Click filter button
    log('Action', 'INFO', 'Opening filter panel');
    await page.click('[data-testid="filter-button"]');

    // Select status filter
    log('Action', 'INFO', 'Filtering by status');
    await page.click('label:has-text("Qualified")');
    await page.click('button:has-text("Apply")');

    // Verify filtered results
    log('Verification', 'INFO', 'Verifying filtered results');
    const leads = page.locator('[data-testid="lead-row"]');
    const count = await leads.count();

    for (let i = 0; i < count; i++) {
      const status = await leads.nth(i).locator('[data-testid="status-badge"]').textContent();
      expect(status).toContain('qualified');
    }
  });

  test('should search leads by buyer name', async ({ page }) => {
    // Navigate to leads
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Enter search term
    log('Action', 'INFO', 'Searching for leads');
    await page.fill('[data-testid="search-input"]', 'John');
    await page.waitForLoadState('networkidle');

    // Verify search results
    log('Verification', 'INFO', 'Verifying search results');
    const leads = page.locator('[data-testid="lead-row"]');
    const count = await leads.count();
    expect(count).toBeGreaterThan(0);

    const firstLeadName = await leads.first().locator('[data-testid="buyer-name"]').textContent();
    expect(firstLeadName).toContain('John');
  });

  test('should handle pagination', async ({ page }) => {
    // Navigate to leads
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Check if next button is visible
    const nextButton = page.locator('button:has-text("Next")');
    const isVisible = await nextButton.isVisible();

    if (isVisible) {
      log('Action', 'INFO', 'Clicking next page');
      const firstPageLeads = await page.locator('[data-testid="lead-row"]').count();

      await nextButton.click();
      await page.waitForLoadState('networkidle');

      const secondPageLeads = await page.locator('[data-testid="lead-row"]').count();

      log('Verification', 'INFO', 'Verifying pagination');
      expect(secondPageLeads).toBeGreaterThan(0);
    }
  });

  test('should delete lead', async ({ page }) => {
    // Navigate to leads
    await page.goto('/crm/leads');
    await page.waitForLoadState('networkidle');

    // Click delete button on first lead
    log('Action', 'INFO', 'Deleting lead');
    const firstLead = page.locator('[data-testid="lead-row"]').first();
    const deleteButton = firstLead.locator('[data-testid="delete-button"]');
    await deleteButton.click();

    // Confirm deletion
    log('Action', 'INFO', 'Confirming deletion');
    await page.click('button:has-text("Confirm")');

    // Verify deletion
    log('Verification', 'INFO', 'Verifying deletion');
    await page.waitForSelector('[data-testid="success-message"]');
    const successMessage = await page.textContent('[data-testid="success-message"]');
    expect(successMessage).toContain('Lead deleted');
  });
});
```

### 2.3 E2E Test Example - Authentication Flow

**File:** `tests/playwright/setup/auth.setup.ts`

```typescript
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const authFile = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');

  // Enter credentials
  const testPhone = process.env.TEST_PHONE || '+919876543210';
  const testOTP = process.env.TEST_OTP || '000000';

  await page.fill('[data-testid="phone-input"]', testPhone);
  await page.click('button:has-text("Send OTP")');

  // Wait for OTP input
  await page.waitForSelector('[data-testid="otp-input"]');

  // Enter OTP
  await page.fill('[data-testid="otp-input"]', testOTP);
  await page.click('button:has-text("Verify")');

  // Wait for navigation to dashboard
  await page.waitForURL('/crm/dashboard');

  // Save auth state
  await page.context().storageState({ path: authFile });
});
```

---

## 3. API Contract Testing

### 3.1 API Contract Tests

**File:** `server/src/__tests__/integration/api/contracts.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { generateTestToken } from '../setup';

describe('API Contracts', () => {
  const testToken = generateTestToken('TENANT#test', 'USER#test');

  describe('Buyer Response Schema', () => {
    it('should return buyer with correct schema', async () => {
      const response = await request(app)
        .post('/api/crm/buyers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Buyer',
          phone: '+919876543210',
          email: 'test@example.com',
        });

      expect(response.status).toBe(201);

      // Verify schema
      const buyer = response.body;
      expect(buyer).toHaveProperty('buyerId');
      expect(buyer).toHaveProperty('tenantId');
      expect(buyer).toHaveProperty('name');
      expect(buyer).toHaveProperty('phone');
      expect(buyer).toHaveProperty('email');
      expect(buyer).toHaveProperty('createdAt');
      expect(buyer).toHaveProperty('updatedAt');

      // Verify types
      expect(typeof buyer.buyerId).toBe('string');
      expect(typeof buyer.tenantId).toBe('string');
      expect(typeof buyer.name).toBe('string');
      expect(typeof buyer.phone).toBe('string');
      expect(typeof buyer.email).toBe('string');
      expect(typeof buyer.createdAt).toBe('string');
      expect(typeof buyer.updatedAt).toBe('string');

      // Verify formats
      expect(buyer.buyerId).toMatch(/^BUYER#/);
      expect(buyer.tenantId).toMatch(/^TENANT#/);
      expect(buyer.phone).toMatch(/^\+91/);
      expect(buyer.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return error with correct schema', async () => {
      const response = await request(app)
        .post('/api/crm/buyers')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test',
          phone: 'invalid',
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);

      // Verify error schema
      const error = response.body;
      expect(error).toHaveProperty('error');
      expect(typeof error.error).toBe('string');
      expect(error.error.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination Schema', () => {
    it('should return paginated response with correct schema', async () => {
      const response = await request(app)
        .get('/api/crm/buyers?limit=10')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);

      // Verify pagination schema
      const result = response.body;
      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result).toHaveProperty('nextToken');
      expect(typeof result.nextToken).toBe('string' || 'null');
    });
  });
});
```

---

## 4. Cross-Browser Testing

### 4.1 Multi-Browser Configuration

Update `playwright.config.ts` to include multiple browsers:

```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'mobile-chrome',
    use: { ...devices['Pixel 5'] },
  },
  {
    name: 'mobile-safari',
    use: { ...devices['iPhone 12'] },
  },
],
```

---

## 5. Running Tests

### 5.1 Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration -- crm.routes.test.ts

# Run with coverage
npm run test:integration -- --coverage
```

### 5.2 E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- lead-management.spec.ts

# Run in UI mode
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug
```

---

**End of Document**
