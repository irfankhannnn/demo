import {
  calculateLeaseEndDateFromTenure,
  getDaysUntilLeaseExpiry,
  resolveLeaseEndDate,
  resolvePropertyMonthlyRent,
} from './businessAnalyticsHelpers.js';

describe('businessAnalyticsHelpers', () => {
  it('resolves monthly rent from rentalInfo.currentRent', () => {
    expect(resolvePropertyMonthlyRent({
      rentalInfo: { currentRent: 25000, expectedRent: 20000 },
      rentAmount: 15000,
    })).toBe(25000);
  });

  it('resolves lease end date from rentalInfo first', () => {
    const property = {
      rentalInfo: { leaseEndDate: '2026-08-06', leaseStartDate: '2025-07-08' },
      tenantMoveInDate: '2025-07-08',
      tenureMonths: 11,
    };

    expect(resolveLeaseEndDate(property, { endDate: '2027-01-01' })).toBe('2026-08-06');
  });

  it('falls back to move-in date plus tenure when lease end date is missing', () => {
    const property = {
      tenantMoveInDate: '2025-07-08',
      tenureMonths: 11,
    };

    expect(resolveLeaseEndDate(property, null)).toBe(
      calculateLeaseEndDateFromTenure('2025-07-08', 11),
    );
  });

  it('calculates days until expiry using start-of-day comparison', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    const year = future.getFullYear();
    const month = String(future.getMonth() + 1).padStart(2, '0');
    const day = String(future.getDate()).padStart(2, '0');
    const localFuture = `${year}-${month}-${day}`;

    expect(getDaysUntilLeaseExpiry(localFuture)).toBe(5);
  });
});
