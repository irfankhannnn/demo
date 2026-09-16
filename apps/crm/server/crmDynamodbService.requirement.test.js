/**
 * Unit tests for requirement/property merge + validation helpers in
 * apps/crm/server/crmDynamodbService.js.
 *
 * Covers:
 *  - validateRequirementFields: rejects mismatched requirement field by lead type
 *  - mergeRequirementObjects: partial-update merge preserves existing fields
 *  - mergeRequirementObjects: null/undefined do not wipe existing data
 *  - LEAD_TYPE_REQUIREMENT_FIELD mapping uses sellerProperty/ownerProperty (not sellerRequirement/ownerRequirement)
 */

import {
  LEAD_TYPE_REQUIREMENT_FIELD,
  REQUIREMENT_FIELDS,
  validateRequirementFields,
  mergeRequirementObjects,
} from './crmDynamodbService.js';

describe('LEAD_TYPE_REQUIREMENT_FIELD mapping', () => {
  test('uses sellerProperty (not sellerRequirement) for seller leads', () => {
    expect(LEAD_TYPE_REQUIREMENT_FIELD.seller).toBe('sellerProperty');
    expect(LEAD_TYPE_REQUIREMENT_FIELD.seller).not.toBe('sellerRequirement');
  });

  test('uses ownerProperty (not ownerRequirement) for owner leads', () => {
    expect(LEAD_TYPE_REQUIREMENT_FIELD.owner).toBe('ownerProperty');
    expect(LEAD_TYPE_REQUIREMENT_FIELD.owner).not.toBe('ownerRequirement');
  });

  test('uses buyerRequirement for buyer leads', () => {
    expect(LEAD_TYPE_REQUIREMENT_FIELD.buyer).toBe('buyerRequirement');
  });

  test('uses tenantRequirement for tenant leads', () => {
    expect(LEAD_TYPE_REQUIREMENT_FIELD.tenant).toBe('tenantRequirement');
  });

  test('REQUIREMENT_FIELDS contains all four fields', () => {
    expect(REQUIREMENT_FIELDS).toEqual(
      expect.arrayContaining([
        'buyerRequirement',
        'sellerProperty',
        'tenantRequirement',
        'ownerProperty',
      ])
    );
    expect(REQUIREMENT_FIELDS).not.toContain('sellerRequirement');
    expect(REQUIREMENT_FIELDS).not.toContain('ownerRequirement');
  });
});

describe('validateRequirementFields', () => {
  test('allows the correct requirement field for a buyer lead', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', name: 'Raj' };
    const data = { buyerRequirement: { budget: 28000000 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('throws when updating sellerProperty on a buyer lead', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', name: 'Raj' };
    const data = { sellerProperty: { expectedPrice: 50000000 } };
    expect(() => validateRequirementFields(existing, data)).toThrow(/buyer.*sellerProperty/);
  });

  test('throws when updating buyerRequirement on a seller lead', () => {
    const existing = { leadId: 'L2', leadType: 'seller', name: 'Priya' };
    const data = { buyerRequirement: { budget: 28000000 } };
    expect(() => validateRequirementFields(existing, data)).toThrow(/seller.*buyerRequirement/);
  });

  test('allows sellerProperty on a seller lead', () => {
    const existing = { leadId: 'L2', leadType: 'seller', name: 'Priya' };
    const data = { sellerProperty: { expectedPrice: 50000000 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('allows ownerProperty on an owner lead', () => {
    const existing = { leadId: 'L3', leadType: 'owner', name: 'Amit' };
    const data = { ownerProperty: { rentExpected: 45000 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('throws when updating ownerProperty on a tenant lead', () => {
    const existing = { leadId: 'L4', leadType: 'tenant', name: 'Sneha' };
    const data = { ownerProperty: { rentExpected: 45000 } };
    expect(() => validateRequirementFields(existing, data)).toThrow(/tenant.*ownerProperty/);
  });

  test('skips validation when leadType is missing', () => {
    const existing = { leadId: 'L5', name: 'NoType' };
    const data = { buyerRequirement: { budget: 100 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('skips validation for unknown leadType', () => {
    const existing = { leadId: 'L6', leadType: 'investor', name: 'X' };
    const data = { buyerRequirement: { budget: 100 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('ignores undefined requirement fields', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', name: 'Raj' };
    const data = { sellerProperty: undefined, buyerRequirement: { budget: 100 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
  });

  test('ignores empty object requirement fields for wrong lead type', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', name: 'Raj' };
    const data = { tenantRequirement: {}, buyerRequirement: { budget: 100 } };
    expect(() => validateRequirementFields(existing, data)).not.toThrow();
    expect(data).not.toHaveProperty('tenantRequirement');
  });
});

describe('mergeRequirementObjects', () => {
  test('merges partial buyerRequirement update, preserving existing fields', () => {
    const existing = {
      leadId: 'L1',
      leadType: 'buyer',
      buyerRequirement: { budget: 20000000, preferredArea: 'Kurla', bhk: '2BHK' },
    };
    const data = { buyerRequirement: { budget: 28000000 } };
    mergeRequirementObjects(existing, data);
    expect(data.buyerRequirement).toEqual({
      budget: 28000000,
      preferredArea: 'Kurla',
      bhk: '2BHK',
    });
  });

  test('null requirement field does not wipe existing data and is removed from payload', () => {
    const existing = {
      leadId: 'L1',
      leadType: 'buyer',
      buyerRequirement: { budget: 20000000, preferredArea: 'Kurla' },
    };
    const data = { buyerRequirement: null };
    mergeRequirementObjects(existing, data);
    expect(data).not.toHaveProperty('buyerRequirement');
    // existing is untouched
    expect(existing.buyerRequirement.budget).toBe(20000000);
  });

  test('undefined requirement field is removed from payload', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', buyerRequirement: { budget: 100 } };
    const data = { buyerRequirement: undefined, status: 'hot' };
    mergeRequirementObjects(existing, data);
    expect(data).not.toHaveProperty('buyerRequirement');
    expect(data.status).toBe('hot');
  });

  test('non-object requirement value is left as-is for downstream validation', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', buyerRequirement: { budget: 100 } };
    const data = { buyerRequirement: 'not-an-object' };
    mergeRequirementObjects(existing, data);
    expect(data.buyerRequirement).toBe('not-an-object');
  });

  test('array requirement value is not merged (treated as non-object)', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', buyerRequirement: { budget: 100 } };
    const data = { buyerRequirement: [1, 2, 3] };
    mergeRequirementObjects(existing, data);
    expect(data.buyerRequirement).toEqual([1, 2, 3]);
  });

  test('merges sellerProperty partial update', () => {
    const existing = {
      leadId: 'L2',
      leadType: 'seller',
      sellerProperty: { expectedPrice: 50000000, city: 'Mumbai', bhk: '3BHK' },
    };
    const data = { sellerProperty: { expectedPrice: 55000000 } };
    mergeRequirementObjects(existing, data);
    expect(data.sellerProperty).toEqual({
      expectedPrice: 55000000,
      city: 'Mumbai',
      bhk: '3BHK',
    });
  });

  test('merges ownerProperty partial update', () => {
    const existing = {
      leadId: 'L3',
      leadType: 'owner',
      ownerProperty: { rentExpected: 45000, city: 'Pune', bhk: '2BHK' },
    };
    const data = { ownerProperty: { rentExpected: 50000 } };
    mergeRequirementObjects(existing, data);
    expect(data.ownerProperty).toEqual({
      rentExpected: 50000,
      city: 'Pune',
      bhk: '2BHK',
    });
  });

  test('new field in update payload overrides existing field', () => {
    const existing = {
      leadId: 'L1',
      leadType: 'buyer',
      buyerRequirement: { budget: 20000000, preferredArea: 'Kurla' },
    };
    const data = { buyerRequirement: { preferredArea: 'Bandra', bhk: '3BHK' } };
    mergeRequirementObjects(existing, data);
    expect(data.buyerRequirement).toEqual({
      budget: 20000000,
      preferredArea: 'Bandra',
      bhk: '3BHK',
    });
  });

  test('handles missing existing requirement object gracefully', () => {
    const existing = { leadId: 'L1', leadType: 'buyer' };
    const data = { buyerRequirement: { budget: 28000000 } };
    mergeRequirementObjects(existing, data);
    expect(data.buyerRequirement).toEqual({ budget: 28000000 });
  });

  test('returns the mutated data object', () => {
    const existing = { leadId: 'L1', leadType: 'buyer', buyerRequirement: { budget: 100 } };
    const data = { buyerRequirement: { bhk: '2BHK' } };
    const result = mergeRequirementObjects(existing, data);
    expect(result).toBe(data);
  });
});
