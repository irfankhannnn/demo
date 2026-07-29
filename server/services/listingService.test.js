/**
 * Unit tests for listingService pure builders / domain wiring.
 * DynamoDB calls are not exercised here — see integration/E2E for those.
 */

import { describe, test, expect } from '@jest/globals';
import { buildListingItem } from './listingService.js';
import { LISTING_STATUS } from '../domain/crmDomainModel.js';

describe('listingService', () => {
  test('buildListingItem creates LISTING entity with sale defaults', () => {
    const item = buildListingItem('agency-1', {
      listingId: 'list-1',
      propertyId: 'prop-1',
      listingType: 'sale',
      listedPrice: 5000000,
      listedByContactId: 'c-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(item.EntityType).toBe('LISTING');
    expect(item.PK).toBe('TENANT#agency-1#LISTING#list-1');
    expect(item.SK).toBe('PROFILE');
    expect(item.listingType).toBe('sale');
    expect(item.status).toBe(LISTING_STATUS.ACTIVE);
    expect(item.listedPrice).toBe(5000000);
    expect(item.GSI2PK).toBe('TENANT#agency-1#LISTING_STATUS#active');
    expect(item.GSI3SK).toContain('LISTING#prop-1#');
  });

  test('buildListingItem supports rent listings', () => {
    const item = buildListingItem('agency-1', {
      propertyId: 'prop-2',
      listingType: 'rent',
      expectedRent: 45000,
      securityDeposit: 90000,
      status: LISTING_STATUS.DRAFT,
    });

    expect(item.listingType).toBe('rent');
    expect(item.expectedRent).toBe(45000);
    expect(item.securityDeposit).toBe(90000);
    expect(item.status).toBe(LISTING_STATUS.DRAFT);
    expect(item.listingId).toBeTruthy();
  });
});
