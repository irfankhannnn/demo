import { describe, expect, it } from 'vitest';
import {
  normalizeBuyerRequirement,
  buyerRequirementShowsBhk,
  BUYER_PROPERTY_TYPES,
} from './buyerRequirementSchema';

describe('buyerRequirementSchema', () => {
  it('keeps flat property types unchanged', () => {
    expect(normalizeBuyerRequirement({ propertyType: 'apartment', bhk: '2 BHK' })).toEqual({
      propertyType: 'apartment',
      bhk: '2 BHK',
    });
  });

  it('maps residential + subType to flat propertyType', () => {
    expect(
      normalizeBuyerRequirement({
        propertyType: 'residential',
        propertySubType: 'villa',
        bhk: '4 BHK',
      }),
    ).toEqual({
      propertyType: 'villa',
      propertySubType: undefined,
      bhk: '4 BHK',
    });
  });

  it('maps commercial to office', () => {
    expect(
      normalizeBuyerRequirement({
        propertyType: 'commercial',
        propertySubType: 'shop',
      }),
    ).toEqual({
      propertyType: 'office',
      propertySubType: undefined,
    });
  });

  it('shows BHK for residential flat types only', () => {
    expect(buyerRequirementShowsBhk('apartment')).toBe(true);
    expect(buyerRequirementShowsBhk('office')).toBe(false);
    expect(buyerRequirementShowsBhk('')).toBe(true);
  });

  it('exports canonical buyer property types', () => {
    expect(BUYER_PROPERTY_TYPES).toEqual(['apartment', 'house', 'villa', 'office']);
  });
});
