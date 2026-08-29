import { test, expect } from '@playwright/test';
import { API_URL } from '../helpers/config';

const SOLO_TENANT_TOKEN = process.env.SOLO_TENANT_TOKEN || '';
const TEAM_TENANT_TOKEN = process.env.TEAM_TENANT_TOKEN || '';

const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

test.describe('Seat-Cap Enforcement', () => {
  test.beforeAll(() => {
    test.skip(!SOLO_TENANT_TOKEN, 'SOLO_TENANT_TOKEN not set — skipping seat-cap tests');
  });

  test('Solo tenant: check-seat when under limit -> 200 canInvite', async ({ request }) => {
    const res = await request.post(`${API_URL}/subscriptions/check-seat`, {
      headers: jsonHeaders(SOLO_TENANT_TOKEN),
    });
    expect([200, 402]).toContain(res.status());
  });

  test('Solo tenant: check-seat at cap -> 402 + upgrade options', async ({ request }) => {
    const res = await request.post(`${API_URL}/subscriptions/check-seat`, {
      headers: jsonHeaders(SOLO_TENANT_TOKEN),
    });
    if (res.status() === 402) {
      const body = await res.json();
      expect(body.error).toBe('paywall_seat_limit');
      expect(body.tier).toBe('solo');
      expect(body.upgradeOptions).toBeDefined();
      expect(body.upgradeOptions.length).toBeGreaterThan(0);
      expect(body.upgradeOptions[0].planId).toBe('plan_team_monthly');
    }
  });

  test('Team tenant: check-seat under limit -> 200', async ({ request }) => {
    test.skip(!TEAM_TENANT_TOKEN, 'TEAM_TENANT_TOKEN not set');
    const res = await request.post(`${API_URL}/subscriptions/check-seat`, {
      headers: jsonHeaders(TEAM_TENANT_TOKEN),
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.canInvite).toBe(true);
      expect(body.plan).toBe('team');
    }
  });

  test('GET /api/subscriptions/current -> subscription object', async ({ request }) => {
    const res = await request.get(`${API_URL}/subscriptions/current`, {
      headers: jsonHeaders(SOLO_TENANT_TOKEN),
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.plan).toBeDefined();
      expect(body.seatsPaid).toBeDefined();
      expect(body.seatsUsed).toBeDefined();
      expect(body.paymentStatus).toBeDefined();
    }
  });

  test('GET /api/subscriptions/trial-status -> trial fields', async ({ request }) => {
    const res = await request.get(`${API_URL}/subscriptions/trial-status`, {
      headers: jsonHeaders(SOLO_TENANT_TOKEN),
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.trialDaysLeft).toBe('number');
      expect(body.trialDaysLeft).toBeGreaterThanOrEqual(0);
      expect(typeof body.isTrialing).toBe('boolean');
      expect(typeof body.isPaying).toBe('boolean');
    }
  });
});
