import { describe, expect, it } from 'vitest';
import { buildIntentChips, parseSearchParams, searchReducer, toSearchFilters, toSearchParams, type SearchState } from './searchState';
import type { SearchIntent } from '@/types/api';

const base: SearchState = { q: '2 bhk andheri under 80 lakh', city: 'Mumbai' };

const intent: SearchIntent = {
  cityKey: 'mumbai',
  city: 'Mumbai',
  mode: 'sale',
  propertyType: 'apartment',
  bhk: 2,
  minPrice: null,
  maxPrice: 8_000_000,
  locality: 'Andheri West',
  mustHaves: ['near metro'],
  canonicalQuery: '2 BHK apartment in Andheri West, Mumbai under 80 lakh near metro',
};

describe('parse / serialise', () => {
  it('round-trips a full state through URLSearchParams', () => {
    const state: SearchState = {
      q: 'near metro',
      city: 'Pune',
      mode: 'rent',
      bhk: 3,
      minPrice: 20_000,
      maxPrice: 45_000,
      locality: 'Baner',
      propertyType: 'apartment',
      furnishing: 'furnished',
      sort: 'price_asc',
    };
    const parsed = parseSearchParams(toSearchParams(state));
    expect(parsed).toEqual(state);
  });

  it('drops invalid enum values and negative numbers', () => {
    const p = new URLSearchParams('mode=lease&sort=random&bhk=-2&maxPrice=abc&city=Mumbai');
    const s = parseSearchParams(p);
    expect(s.mode).toBeUndefined();
    expect(s.sort).toBeUndefined();
    expect(s.bhk).toBeUndefined();
    expect(s.maxPrice).toBeUndefined();
    expect(s.city).toBe('Mumbai');
  });

  it('swaps a min/max typo', () => {
    const s = parseSearchParams(new URLSearchParams('minPrice=90&maxPrice=10'));
    expect(s.minPrice).toBe(10);
    expect(s.maxPrice).toBe(90);
  });

  it('omits empty keys when serialising', () => {
    expect(toSearchParams({ q: '', city: 'Mumbai' }).toString()).toBe('city=Mumbai');
  });

  it('maps to the /search/ai filters payload', () => {
    expect(toSearchFilters({ q: 'x', city: 'Mumbai', bhk: 2, maxPrice: 100, locality: 'Bandra' })).toEqual({
      bhk: 2,
      maxPrice: 100,
      locality: 'Bandra',
    });
  });
});

describe('searchReducer', () => {
  it('applies parsed intent without overriding manual filters', () => {
    const s = searchReducer({ ...base, bhk: 3 }, { type: 'applyIntent', intent });
    expect(s.bhk).toBe(3);
    expect(s.maxPrice).toBe(8_000_000);
    expect(s.locality).toBe('Andheri West');
    expect(s.mode).toBe('sale');
    expect(s.propertyType).toBe('apartment');
    expect(s.city).toBe('Mumbai');
  });

  it('removes a chip', () => {
    const s = searchReducer({ ...base, bhk: 2, locality: 'Andheri' }, { type: 'removeChip', key: 'locality' });
    expect(s.locality).toBeUndefined();
    expect(s.bhk).toBe(2);
    expect(searchReducer(s, { type: 'removeChip', key: 'q' }).q).toBe('');
  });

  it('sets and validates filters', () => {
    expect(searchReducer(base, { type: 'setFilter', key: 'mode', value: 'rent' }).mode).toBe('rent');
    expect(searchReducer(base, { type: 'setFilter', key: 'mode', value: 'lease' }).mode).toBeUndefined();
    expect(searchReducer(base, { type: 'setFilter', key: 'bhk', value: '2' }).bhk).toBe(2);
    expect(searchReducer(base, { type: 'setFilter', key: 'bhk', value: 'x' }).bhk).toBeUndefined();
    expect(searchReducer({ ...base, bhk: 2 }, { type: 'setFilter', key: 'bhk', value: undefined }).bhk).toBeUndefined();
    expect(searchReducer(base, { type: 'setFilter', key: 'locality', value: '  Powai ' }).locality).toBe('Powai');
  });

  it('normalises a price range', () => {
    const s = searchReducer(base, { type: 'setPriceRange', minPrice: 100, maxPrice: 50 });
    expect(s).toMatchObject({ minPrice: 50, maxPrice: 100 });
    const cleared = searchReducer(s, { type: 'setPriceRange' });
    expect(cleared.minPrice).toBeUndefined();
    expect(cleared.maxPrice).toBeUndefined();
  });

  it('clears filters but keeps q, city and sort', () => {
    const s = searchReducer({ ...base, bhk: 2, mode: 'rent', sort: 'newest' }, { type: 'clearFilters' });
    expect(s).toEqual({ q: base.q, city: 'Mumbai', sort: 'newest' });
  });
});

describe('buildIntentChips', () => {
  const fmt = { price: (n: number) => `₹${n}` };

  it('marks chips that came from the AI parse', () => {
    const chips = buildIntentChips(base, intent, fmt);
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
    expect(byKey.city.fromIntent).toBe(false);
    expect(byKey.bhk).toMatchObject({ label: '2 BHK', fromIntent: true });
    expect(byKey.maxPrice).toMatchObject({ label: 'Under ₹8000000', fromIntent: true });
    expect(byKey.locality.label).toBe('Andheri West');
  });

  it('prefers manual filters over intent and renders a range', () => {
    const chips = buildIntentChips({ ...base, minPrice: 10, maxPrice: 20, bhk: 3 }, intent, fmt);
    expect(chips.find((c) => c.key === 'bhk')).toMatchObject({ label: '3 BHK', fromIntent: false });
    expect(chips.find((c) => c.key === 'maxPrice')?.label).toBe('₹10 – ₹20');
  });

  it('works with no intent at all', () => {
    const chips = buildIntentChips({ q: '', city: '', mode: 'rent' }, null, fmt);
    expect(chips).toEqual([{ key: 'mode', label: 'Rent', fromIntent: false }]);
  });
});
