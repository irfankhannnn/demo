/**
 * The property projection behind GET /api/internal/properties/available and
 * /properties/search (Bugs B and C in APPROVAL-PLAN.md).
 *
 * Pins: values come from the real PROPERTY attributes, the owner's contact
 * details and legal keys never come out, the query maps onto getProperties'
 * filter names, and the listable-status set includes real listings.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import {
  simplifyPropertyForAgent,
  toAgentPropertyContext,
  buildAvailablePropertyFilters,
  selectAvailableProperties,
  LISTABLE_STATUSES,
} from './propertyProjection.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const rental = {
  propertyId: 'p-rent',
  title: '2 BHK in Andheri West',
  propertyType: 'apartment',
  bhk: 2,
  area: 'Andheri West',
  city: 'Mumbai',
  address: 'Lokhandwala',
  buildingName: 'Lodha Park',
  carpetArea: 950,
  furnishing: 'semi-furnished',
  amenities: ['gym', 'pool', 'lift', 'parking', 'security', 'garden'],
  status: 'for-rent',
  rentAmount: 45000,
  rentalInfo: { expectedRent: 45000, securityDeposit: 200000 },
  saleInfo: { listedPrice: null },
  ownerPhone: '+919800000000',
  ownerSnapshot: { name: 'Owner', phone: '+919800000000' },
  titleDeed: 's3://legal/deed.pdf',
};

const sale = {
  propertyId: 'p-sale',
  propertyType: 'villa',
  bhk: 4,
  area: 'Whitefield',
  city: 'Bengaluru',
  status: 'for-sale',
  saleInfo: { listedPrice: 18000000 },
  carpetArea: 2400,
};

describe('simplifyPropertyForAgent', () => {
  test('reads bhk / rentAmount / rentalInfo.securityDeposit / carpetArea, not the old names', () => {
    const out = simplifyPropertyForAgent(rental);
    assert.equal(out.bedrooms, 2);
    assert.equal(out.bhk, 2);
    assert.equal(out.rent, 45000);
    assert.equal(out.rentAmount, 45000);
    assert.equal(out.deposit, 200000);
    assert.equal(out.squareFeet, 950);
    assert.equal(out.carpetArea, 950);
    assert.equal(out.buildingName, 'Lodha Park');
    assert.equal(out.title, '2 BHK in Andheri West');
    assert.equal(out.amenities.length, 5);
  });

  test('a sale listing exposes its asking price under both price and rent', () => {
    const out = simplifyPropertyForAgent(sale);
    assert.equal(out.price, 18000000);
    assert.equal(out.rent, 18000000);
    assert.equal(out.rentAmount, null);
    assert.equal(out.deposit, null);
  });

  test('never carries owner contact details or legal-document keys', () => {
    for (const out of [simplifyPropertyForAgent(rental), toAgentPropertyContext(rental)]) {
      assert.equal('ownerPhone' in out, false);
      assert.equal('ownerSnapshot' in out, false);
      assert.equal('titleDeed' in out, false);
      assert.equal('ownerId' in out, false);
    }
    assert.equal(simplifyPropertyForAgent(null), null);
  });

  test('toAgentPropertyContext matches the CONTRACTS 2.1 property shape', () => {
    assert.deepEqual(Object.keys(toAgentPropertyContext(sale)).sort(), [
      'address', 'area', 'bhk', 'buildingName', 'carpetArea', 'city', 'furnishing', 'price', 'propertyId', 'propertyType', 'rentAmount', 'status', 'title',
    ]);
  });
});

describe('buildAvailablePropertyFilters', () => {
  test('maps the agent tool vocabulary onto getProperties filters', () => {
    const { filters, status, priceRange, limit } = buildAvailablePropertyFilters({
      type: 'Apartment', location: 'Andheri', bedrooms: '2', minPrice: '30000', maxPrice: '60000', limit: '3',
    });
    assert.deepEqual(filters, { propertyType: 'apartment', search: 'Andheri', bhk: '2' });
    assert.equal(status, null);
    assert.deepEqual(priceRange, { min: 30000, max: 60000 });
    assert.equal(limit, 3);
  });

  test('accepts the CRM names too and passes rent/sale bounds straight through', () => {
    const { filters, status } = buildAvailablePropertyFilters({
      propertyType: 'villa', bhk: 4, area: 'Whitefield', city: 'Bengaluru', minSalePrice: 10000000, maxRent: '50000', status: 'for-sale',
    });
    assert.deepEqual(filters, { propertyType: 'villa', bhk: '4', area: 'Whitefield', city: 'Bengaluru', maxRent: 50000, minSalePrice: 10000000 });
    assert.equal(status, 'for-sale');
  });

  test('ignores an unknown status and caps the limit', () => {
    const { status, limit } = buildAvailablePropertyFilters({ status: 'sold', limit: '500' });
    assert.equal(status, null);
    assert.equal(limit, 50);
    assert.equal(buildAvailablePropertyFilters({}).limit, 10);
  });
});

describe('selectAvailableProperties', () => {
  const items = [
    rental,
    sale,
    { propertyId: 'p-legacy', status: 'available', rentAmount: 20000 },
    { propertyId: 'p-sold', status: 'sold', saleInfo: { listedPrice: 1 } },
    { propertyId: 'p-rented', status: 'rented', rentAmount: 30000 },
  ];

  test('keeps for-sale, for-rent and legacy available listings; drops sold/rented', () => {
    const out = selectAvailableProperties(items, { status: null, priceRange: {}, limit: 10 });
    assert.deepEqual(out.map((p) => p.propertyId), ['p-rent', 'p-sale', 'p-legacy']);
    assert.deepEqual(LISTABLE_STATUSES, ['available', 'for-sale', 'for-rent']);
  });

  test('narrows to one status when asked and applies the generic price band to rent-or-price', () => {
    const rentOnly = selectAvailableProperties(items, { status: 'for-rent', priceRange: {}, limit: 10 });
    assert.deepEqual(rentOnly.map((p) => p.propertyId), ['p-rent']);

    const band = selectAvailableProperties(items, { status: null, priceRange: { min: 25000, max: 50000 }, limit: 10 });
    assert.deepEqual(band.map((p) => p.propertyId), ['p-rent']);

    const limited = selectAvailableProperties(items, { status: null, priceRange: {}, limit: 2 });
    assert.equal(limited.length, 2);
  });
});
