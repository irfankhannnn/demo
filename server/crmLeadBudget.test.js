/**
 * Lead budget filter helpers (search_leads minBudget/maxBudget).
 */

import { applyLeadBudgetRangeFilter, leadBudgetRupee } from './crmDynamodbService.js';

describe('leadBudgetRupee', () => {
  test('reads buyer budget', () => {
    expect(leadBudgetRupee({ buyerRequirement: { budget: 17000000 } })).toBe(17000000);
  });

  test('reads seller expected price', () => {
    expect(leadBudgetRupee({ sellerProperty: { expectedPrice: 16200000 } })).toBe(16200000);
  });
});

describe('applyLeadBudgetRangeFilter', () => {
  const leads = [
    { name: 'Low', buyerRequirement: { budget: 800000 } },
    { name: 'High', buyerRequirement: { budget: 15000000 } },
    { name: 'NoBudget' },
    { name: 'Seller', sellerProperty: { expectedPrice: 17000000 } },
  ];

  test('minBudget 1Cr keeps only >= 1Cr', () => {
    const out = applyLeadBudgetRangeFilter(leads, { minBudget: 10000000 });
    expect(out.map((l) => l.name)).toEqual(['High', 'Seller']);
  });

  test('maxBudget excludes above cap', () => {
    const out = applyLeadBudgetRangeFilter(leads, { maxBudget: 10000000 });
    expect(out.map((l) => l.name)).toEqual(['Low', 'NoBudget']);
  });
});
