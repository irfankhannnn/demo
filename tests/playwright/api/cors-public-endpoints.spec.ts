import { test, expect } from '@playwright/test';
import { API_URL } from '../helpers/config';

const TEST_TOKEN = process.env.TEST_TOKEN || process.env.TENANT_A_TOKEN || '';

test.describe('CORS & Public Endpoint Security', () => {
  // ============================================================
  // CORS HEADERS
  // ============================================================
  test.describe('CORS Configuration', () => {
    test('OPTIONS preflight returns CORS headers', async ({ request }) => {
      const res = await request.fetch(`${API_URL}/crm/customers`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization,x-tenant-id',
        },
      });
      expect([200, 204]).toContain(res.status());
      const allowOrigin = res.headers()['access-control-allow-origin'];
      const allowHeaders = res.headers()['access-control-allow-headers'];
      const allowMethods = res.headers()['access-control-allow-methods'];

      expect(allowOrigin).toBeTruthy();
      expect(allowHeaders).toBeTruthy();
      expect(allowMethods).toBeTruthy();
      // x-tenant-id must be allowed
      expect(allowHeaders.toLowerCase()).toContain('x-tenant-id');
    });

    test('GET request includes CORS headers', async ({ request }) => {
      const res = await request.get(`${API_URL}/crm/customers`, {
        headers: {
          Origin: 'https://example.com',
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      });
      expect([200, 401, 403]).toContain(res.status());
      const allowOrigin = res.headers()['access-control-allow-origin'];
      expect(allowOrigin).toBeTruthy();
    });
  });

  // ============================================================
  // PUBLIC ENDPOINTS - TENANT SPOOFING
  // ============================================================
  test.describe('Public Endpoint Tenant Protection', () => {
    test('B2B lead with invalid tenantId format -> 400', async ({ request }) => {
      const res = await request.post(`${API_URL}/b2b-leads`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '../../../etc/passwd', // path traversal attempt
        },
        data: {
          name: 'Test Lead',
          role: 'Agent',
          mobile: '9876543210',
          email: 'test@example.com',
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid');
    });

    test('B2B lead with SQL injection-like tenantId -> 400', async ({ request }) => {
      const res = await request.post(`${API_URL}/b2b-leads`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': "tenant' OR '1'='1",
        },
        data: {
          name: 'Test Lead',
          role: 'Agent',
          mobile: '9876543210',
        },
      });
      expect(res.status()).toBe(400);
    });

    test('Enquiry contact without tenantId -> 400/401/403', async ({ request }) => {
      const res = await request.post(`${API_URL}/enquiries/contact`, {
        headers: {
          'Content-Type': 'application/json',
          // No x-tenant-id header
        },
        data: {
          name: 'Test Enquiry',
          phone: '9876543210',
          message: 'Test message',
        },
      });
      // API Gateway blocks unauthenticated requests (403) before tenant validation runs
      expect([400, 401, 403]).toContain(res.status());
    });
  });

  // ============================================================
  // AUTH REQUIRED ON PROTECTED ROUTES
  // ============================================================
  test.describe('Authentication Enforcement', () => {
    test('GET /api/crm/customers without token -> 401', async ({ request }) => {
      const res = await request.get(`${API_URL}/crm/customers`);
      expect(res.status()).toBe(401);
    });

    test('POST /api/crm/leads without token -> 401', async ({ request }) => {
      const res = await request.post(`${API_URL}/crm/leads`, {
        headers: { 'Content-Type': 'application/json' },
        data: { name: 'Test', phone: '9876543210', leadType: 'buyer' },
      });
      expect(res.status()).toBe(401);
    });

    test('GET /api/khata/entries without token -> 401', async ({ request }) => {
      const res = await request.get(`${API_URL}/khata/entries`);
      expect(res.status()).toBe(401);
    });

    test('POST /api/khata/entries without token -> 401', async ({ request }) => {
      const res = await request.post(`${API_URL}/khata/entries`, {
        headers: { 'Content-Type': 'application/json' },
        data: { propertyId: 'test', partyType: 'OWNER', partyId: 'test', partyName: 'Test', transactionType: 'TO_GIVE' },
      });
      expect(res.status()).toBe(401);
    });
  });

  // ============================================================
  // ADMIN-ONLY ENDPOINTS
  // ============================================================
  test.describe('Admin Endpoint RBAC', () => {
    test('GET /api/grievance without admin token -> 403', async ({ request }) => {
      const res = await request.get(`${API_URL}/grievance`, {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      });
      expect([403, 401, 404]).toContain(res.status());
    });

    test('PUT /api/grievance/:id without admin token -> 403', async ({ request }) => {
      const res = await request.put(`${API_URL}/grievance/test-id`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        data: { status: 'resolved' },
      });
      expect([403, 401, 404]).toContain(res.status());
    });
  });
});
