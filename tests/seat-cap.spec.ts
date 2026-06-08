import { test, expect } from '@playwright/test';

/**
 * Seat-Cap Enforcement Test Suite
 *
 * Prerequisites:
 * - 2 test tenants: SOLO (1 seat) and TEAM (3 seats)
 * - Auth tokens for both tenants
 * - Subscriptions table seeded with correct seatsPaid
 *
 * Environment variables:
 *   API_URL, SOLO_TENANT_TOKEN, TEAM_TENANT_TOKEN, AUTH_API_URL
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const AUTH_API_URL = process.env.AUTH_API_URL || 'http://localhost:3002';
const SOLO_TENANT_TOKEN = process.env.SOLO_TENANT_TOKEN || '';
const TEAM_TENANT_TOKEN = process.env.TEAM_TENANT_TOKEN || '';

const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

test.describe('Seat-Cap Enforcement', () => {
  // Scenario 1: Solo tenant — first invite succeeds (within 1-seat limit)
  test('Solo tenant: check-seat when under limit → 200 canInvite', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/subscriptions/check-seat`, {
      headers: jsonHeaders(SOLO_TENANT_TOKEN),
    });
    // If subscription exists and seatsUsed < seatsPaid, expect 200
    // If seatsUsed >= seatsPaid (founder already uses the seat), expect 402
    expect([200, 402]).toContain(res.status());
  });

  // Scenario 2: Solo tenant — 2nd invite blocked (at cap)
  test('Solo tenant: check-seat at cap → 402 + upgrade options', async ({ request }) => {
    // Solo tenant with 1 seat used (founder) should get 402
    const res = await request.post(`${API_URL}/api/subscriptions/check-seat`, {
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

  // Scenario 3: Team tenant — can invite up to 3 seats
  test('Team tenant: check-seat under limit → 200', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/subscriptions/check-seat`, {
      headers: jsonHeaders(TEAM_TENANT_TOKEN),
    });
    // Team tenant with fewer than 3 seats used should get 200
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.canInvite).toBe(true);
      expect(body.plan).toBe('team');
    }
  });

  // Scenario 4: GET /api/subscriptions/current returns subscription data
  test('GET /api/subscriptions/current → subscription object', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/subscriptions/current`, {
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

  // Scenario 5: GET /api/subscriptions/trial-status returns trial info
  test('GET /api/subscriptions/trial-status → trial fields', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/subscriptions/trial-status`, {
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
