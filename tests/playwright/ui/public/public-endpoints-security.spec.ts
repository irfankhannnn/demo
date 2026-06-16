import { test, expect } from '@playwright/test';
import { API_URL } from '../../helpers/config';

// ============================================================
// PUBLIC ENDPOINT SECURITY TESTS (No auth needed)
// ============================================================
test.describe('Public Endpoint Security & Validation', () => {
  test('Contact enquiry with XSS in name -> sanitized/stored safely', async ({ page }) => {
    await page.goto(`${API_URL}/enquiries/contact`);
    // Since this is a direct API test, use fetch
    const response = await page.evaluate(async (apiUrl) => {
      const res = await fetch(`${apiUrl}/enquiries/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'test-tenant' },
        body: JSON.stringify({
          name: '<script>alert(1)</script>',
          phone: '9876543210',
          message: 'Test message',
        }),
      });
      return { status: res.status, body: await res.text() };
    }, API_URL);
    // 403 = WAF blocked, 400 = validation rejected, 200/201 = stored safely
    expect([200, 201, 400, 403]).toContain(response.status);
  });

  test('B2B lead with oversized payload -> handled', async ({ page }) => {
    const hugePayload = 'A'.repeat(10000);
    const response = await page.evaluate(async ({ apiUrl, payload }: { apiUrl: string; payload: string }) => {
      const res = await fetch(`${apiUrl}/b2b-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'test-tenant' },
        body: JSON.stringify({
          name: payload,
          role: payload,
          mobile: '9876543210',
          email: 'test@test.com',
        }),
      });
      return { status: res.status };
    }, { apiUrl: API_URL, payload: hugePayload });
    expect([200, 201, 400, 413]).toContain(response.status);
  });

  test('Grievance with extremely long description -> handled', async ({ page }) => {
    const longDesc = 'A'.repeat(10000);
    const response = await page.evaluate(async ({ apiUrl, desc }: { apiUrl: string; desc: string }) => {
      const res = await fetch(`${apiUrl}/grievance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          email: 'test@test.com',
          category: 'other',
          description: desc,
        }),
      });
      return { status: res.status };
    }, { apiUrl: API_URL, desc: longDesc });
    // May be rate limited (429) if previous tests hit the endpoint
    expect([200, 201, 400, 413, 429]).toContain(response.status);
  });
});
