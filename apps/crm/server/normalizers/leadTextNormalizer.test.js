import { describe, expect, test } from '@jest/globals';
import { toTitleCase } from '../utils/titleCase.js';
import { normalizeLeadTextFields } from '../normalizers/leadTextNormalizer.js';

describe('titleCase', () => {
  test('title-cases multi-word strings', () => {
    expect(toTitleCase('bandra west')).toBe('Bandra West');
    expect(toTitleCase('SEA BREEZE TOWERS')).toBe('Sea Breeze Towers');
    expect(toTitleCase('Rahul Rao GPJH4')).toBe('Rahul Rao GPJH4');
  });

  test('preserves emails and numeric tokens', () => {
    expect(toTitleCase('user@example.com')).toBe('user@example.com');
    expect(toTitleCase('within 3 months')).toBe('Within 3 Months');
  });
});

describe('normalizeLeadTextFields', () => {
  test('title-cases lead profile and requirement text fields', () => {
    const data = {
      name: 'arjun gokhale',
      email: 'arjun@example.com',
      buyerRequirement: {
        requirement: 'looking for sea view flat',
        preferredArea: 'worli',
        city: 'mumbai',
        propertyType: 'apartment',
        bhk: '3 BHK',
      },
    };

    normalizeLeadTextFields(data);

    expect(data.name).toBe('Arjun Gokhale');
    expect(data.email).toBe('arjun@example.com');
    expect(data.buyerRequirement.requirement).toBe('looking for sea view flat');
    expect(data.buyerRequirement.preferredArea).toBe('Worli');
    expect(data.buyerRequirement.city).toBe('Mumbai');
    expect(data.buyerRequirement.propertyType).toBe('apartment');
    expect(data.buyerRequirement.bhk).toBe('3 BHK');
  });
});
