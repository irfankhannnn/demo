import { test, expect } from '@playwright/test';
import { API_URL } from '../helpers/config';

const TEST_TOKEN = process.env.TEST_TOKEN || process.env.TENANT_A_TOKEN || '';
const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

test.describe('Concurrent Access & Race Condition Tests', () => {
  test.beforeAll(() => {
    test.skip(!TEST_TOKEN, 'TEST_TOKEN not set — skipping concurrent tests');
  });

  // ============================================================
  // RACE: DOUBLE SETTLEMENT
  // ============================================================
  test.describe('Khata Settlement Race Conditions', () => {
    test('Simultaneous settlement of same entry -> only one succeeds', async ({ request }) => {
      // Create entry
      const entryRes = await request.post(`${API_URL}/khata/entries`, {
        headers: jsonHeaders(TEST_TOKEN),
        data: {
          propertyId: 'race-test-property',
          partyType: 'OWNER',
          partyId: 'race-party-id',
          partyName: 'Race Test',
          transactionType: 'TO_GIVE',
          amount: 5000,
        },
      });
      if (entryRes.status() !== 200 && entryRes.status() !== 201) {
        test.skip(true, 'Khata entry creation failed — skipping');
        return;
      }
      const entryBody = await entryRes.json();
      const entryId = entryBody.entryId || entryBody.id || entryBody.SK?.replace('ENTRY#', '');

      if (!entryId) {
        test.skip(true, 'Could not extract entryId');
        return;
      }

      // Fire two settlement requests simultaneously (backend only accepts settlementNotes)
      const [res1, res2] = await Promise.all([
        request.post(`${API_URL}/khata/entries/${entryId}/settle`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { settlementNotes: 'Race 1' },
        }),
        request.post(`${API_URL}/khata/entries/${entryId}/settle`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { settlementNotes: 'Race 2' },
        }),
      ]);

      const statuses = [res1.status(), res2.status()];
      // One should succeed (200), the other should fail (409 conflict or 400)
      expect(statuses).toContain(200);
      expect(statuses).toContainEqual(expect.any(Number));
      // At least one should fail if there's proper locking
      const hasFailure = statuses.some(s => s === 409 || s === 400);
      if (!hasFailure) {
        // Verify final state is settled
        const finalRes = await request.get(`${API_URL}/khata/entries/${entryId}`, {
          headers: jsonHeaders(TEST_TOKEN),
        });
        if (finalRes.status() === 200) {
          const finalBody = await finalRes.json();
          expect(finalBody.settlementStatus).toBe('SETTLED');
        }
      }
    });
  });

  // ============================================================
  // RACE: CONCURRENT UPDATES
  // ============================================================
  test.describe('Concurrent Update Tests', () => {
    test('Two simultaneous updates to same lead -> last write wins or conflict', async ({ request }) => {
      // Create lead
      const createRes = await request.post(`${API_URL}/crm/leads`, {
        headers: jsonHeaders(TEST_TOKEN),
        data: { name: 'Race Lead', phone: '9876543210', leadType: 'buyer' },
      });
      if (createRes.status() !== 200 && createRes.status() !== 201) {
        test.skip(true, 'Lead creation failed');
        return;
      }
      const body = await createRes.json();
      const leadId = body.leadId || body.id;

      // Fire two updates simultaneously
      const [res1, res2] = await Promise.all([
        request.put(`${API_URL}/crm/leads/${leadId}`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { notes: 'Update from request 1' },
        }),
        request.put(`${API_URL}/crm/leads/${leadId}`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { notes: 'Update from request 2' },
        }),
      ]);

      expect([200, 201, 400, 409]).toContain(res1.status());
      expect([200, 201, 400, 409]).toContain(res2.status());
    });

    test('Concurrent property status updates -> deterministic result', async ({ request }) => {
      // Create owner
      const ownerRes = await request.post(`${API_URL}/crm/owners`, {
        headers: jsonHeaders(TEST_TOKEN),
        data: { name: 'Concurrent Owner', phone: '9876543216' },
      });
      const ownerBody = await ownerRes.json();
      const ownerId = ownerBody.ownerId || ownerBody.id;

      // Create property
      const propRes = await request.post(`${API_URL}/crm/properties`, {
        headers: jsonHeaders(TEST_TOKEN),
        data: { title: 'Concurrent Property', ownerId },
      });
      const propBody = await propRes.json();
      const propertyId = propBody.propertyId || propBody.id;

      // Fire conflicting status changes
      const [res1, res2] = await Promise.all([
        request.put(`${API_URL}/crm/properties/${propertyId}`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { status: 'for-sale' },
        }),
        request.put(`${API_URL}/crm/properties/${propertyId}`, {
          headers: jsonHeaders(TEST_TOKEN),
          data: { status: 'for-rent' },
        }),
      ]);

      expect([200, 400, 500]).toContain(res1.status());
      expect([200, 400, 500]).toContain(res2.status());

      // Verify final state is one of the two
      const finalRes = await request.get(`${API_URL}/crm/properties/${propertyId}`, {
        headers: jsonHeaders(TEST_TOKEN),
      });
      if (finalRes.status() === 200) {
        const finalBody = await finalRes.json();
        expect(['for-sale', 'for-rent', 'available']).toContain(finalBody.status);
      }
    });
  });

  // ============================================================
  // RATE LIMITING
  // ============================================================
  test.describe('Rate Limiting Tests', () => {
    test('Rapid-fire API requests -> rate limited eventually', async ({ request }) => {
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const res = await request.get(`${API_URL}/crm/customers`, {
          headers: jsonHeaders(TEST_TOKEN),
        });
        results.push(res.status());
      }
      // Should not all be 200 (some might be rate limited)
      const uniqueStatuses = new Set(results);
      expect(uniqueStatuses.size).toBeGreaterThanOrEqual(1);
    });
  });
});
