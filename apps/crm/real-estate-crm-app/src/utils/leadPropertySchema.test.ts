import { describe, expect, it } from 'vitest';
import {
  applyPropertyTypeChange,
  getPropertyFieldVisibility,
  normalizePropertyType,
} from './leadPropertySchema';

describe('leadPropertySchema', () => {
  it('hides flat number and floor for villa', () => {
    const visibility = getPropertyFieldVisibility('villa', 'owner');
    expect(visibility.flatNumber).toBe(false);
    expect(visibility.floor).toBe(false);
    expect(visibility.bhk).toBe(true);
  });

  it('hides bhk for office and land', () => {
    expect(getPropertyFieldVisibility('office', 'owner').bhk).toBe(false);
    expect(getPropertyFieldVisibility('land', 'seller').bhk).toBe(false);
  });

  it('clears irrelevant fields when property type changes to villa', () => {
    const next = applyPropertyTypeChange(
      {
        propertyType: 'apartment',
        flatNumber: '401',
        floor: '4th',
        bhk: 2,
        area: 'Bandra',
      },
      'villa',
    );

    expect(next.propertyType).toBe('villa');
    expect(next.bhk).toBe(2);
    expect(next.area).toBe('Bandra');
    expect(next.flatNumber).toBeUndefined();
    expect(next.floor).toBeUndefined();
  });

  it('normalizes property type casing', () => {
    expect(normalizePropertyType('Villa')).toBe('villa');
    expect(normalizePropertyType('')).toBe('');
  });
});
