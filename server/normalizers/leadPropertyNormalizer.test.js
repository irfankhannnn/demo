import { describe, expect, test } from '@jest/globals';
import {
  normalizeLeadPropertyBlob,
  normalizeOwnerProperty,
  normalizeSellerProperty,
} from './leadPropertyNormalizer.js';

describe('leadPropertyNormalizer', () => {
  test('normalizes owner property numeric and string fields', () => {
    const result = normalizeOwnerProperty({
      propertyType: 'Villa',
      bhk: '3',
      carpetArea: '2200',
      rentExpected: '85000',
      securityDeposit: '255000',
      buildingName: ' Palm Grove ',
      area: 'Powai',
      city: 'Mumbai',
      address: 'Full address here',
    });

    expect(result).toEqual({
      propertyType: 'villa',
      bhk: 3,
      carpetArea: 2200,
      rentExpected: 85000,
      securityDeposit: 255000,
      buildingName: 'Palm Grove',
      area: 'Powai',
      city: 'Mumbai',
      address: 'Full address here',
    });
  });

  test('normalizes seller timeline fields', () => {
    const result = normalizeSellerProperty({
      propertyType: 'apartment',
      expectedPrice: '12500000',
      timelineValue: '3',
      timelineUnit: 'months',
      timeline: '3 months',
    });

    expect(result).toEqual({
      propertyType: 'apartment',
      expectedPrice: 12500000,
      timelineValue: 3,
      timelineUnit: 'months',
      timeline: '3 months',
    });
  });

  test('returns null for empty blobs', () => {
    expect(normalizeLeadPropertyBlob({})).toBeNull();
    expect(normalizeLeadPropertyBlob(null)).toBeNull();
  });

  test('preserves extra keys for forward compatibility', () => {
    const result = normalizeOwnerProperty({
      propertyType: 'office',
      customField: 'kept',
    });
    expect(result.customField).toBe('kept');
  });
});
