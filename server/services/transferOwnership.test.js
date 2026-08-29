/**
 * transferOwnership domain contracts — pure helpers used by the sale path.
 * Full DynamoDB integration is covered by mark-sold / convertLead flows.
 */

import { describe, test, expect } from '@jest/globals';
import {
  buildOwnershipTransferEntry,
  buildSellerProfile,
  buildOwnerProfile,
  resolveCurrentOwnerContactId,
  propertyIsCurrentlyOwnedBy,
  propertyOwnerGsi1Pk,
  saleTransactionPk,
  listingPk,
  SELLER_LIFECYCLE,
  OWNER_LIFECYCLE,
  SALE_VIA,
  PROPERTY_STATUS,
} from '../domain/crmDomainModel.js';

describe('transferOwnership domain contracts', () => {
  test('sale clears seller as current owner and points to buyer contact', () => {
    const history = buildOwnershipTransferEntry({
      fromContactId: 'seller-c',
      toContactId: 'buyer-c',
      fromOwnerId: 'legacy-owner',
      salePrice: 100,
      soldVia: SALE_VIA.DIRECT,
      saleTransactionId: 'sale-1',
    });

    expect(history.sellerContactId).toBe('seller-c');
    expect(history.buyerContactId).toBe('buyer-c');
    expect(history.toOwnerId).toBeNull();
    expect(history.saleTransactionId).toBe('sale-1');
  });

  test('seller becomes past when no active listings remain', () => {
    const profile = buildSellerProfile({
      lifecycleStatus: SELLER_LIFECYCLE.PAST,
      soldPropertyIds: ['p1'],
      activeListingIds: [],
    });
    expect(profile.lifecycleStatus).toBe('past');
    expect(profile.soldPropertyIds).toEqual(['p1']);
    expect(profile.activeListingIds).toEqual([]);
  });

  test('buyer owner shell starts active', () => {
    const owner = buildOwnerProfile({
      lifecycleStatus: OWNER_LIFECYCLE.ACTIVE,
      ownedPropertyIds: ['p1'],
    });
    expect(owner.lifecycleStatus).toBe('active');
    expect(owner.ownedPropertyIds).toContain('p1');
  });

  test('GSI keys prefer CONTACT after transfer', () => {
    expect(propertyOwnerGsi1Pk('t1', 'buyer-c')).toBe('TENANT#t1#CONTACT#buyer-c');
    expect(saleTransactionPk('t1', 's1')).toBe('TENANT#t1#SALE#s1');
    expect(listingPk('t1', 'l1')).toBe('TENANT#t1#LISTING#l1');
  });

  test('resolveCurrentOwnerContactId ignores legacy ownerId alone', () => {
    expect(resolveCurrentOwnerContactId({ ownerId: 'o1' })).toBeNull();
    expect(resolveCurrentOwnerContactId({
      ownerId: 'o1',
      currentOwnerContactId: 'c1',
    })).toBe('c1');
  });

  test('propertyIsCurrentlyOwnedBy prefers contact then ownerId', () => {
    expect(propertyIsCurrentlyOwnedBy(
      { ownerId: null, currentOwnerContactId: 'buyer-c' },
      { ownerId: 'seller-o', contactId: 'buyer-c' },
    )).toBe(true);
    expect(propertyIsCurrentlyOwnedBy(
      { ownerId: null, currentOwnerContactId: 'buyer-c' },
      { ownerId: 'seller-o', contactId: 'seller-c' },
    )).toBe(false);
    expect(propertyIsCurrentlyOwnedBy(
      { ownerId: 'buyer-o', currentOwnerContactId: null },
      { ownerId: 'buyer-o', contactId: null },
    )).toBe(true);
  });

  test('sold property status constant matches transfer target', () => {
    expect(PROPERTY_STATUS.SOLD).toBe('sold');
    expect(PROPERTY_STATUS.FOR_SALE).toBe('for-sale');
    expect(PROPERTY_STATUS.NOT_LISTED).toBe('not-listed');
  });
});
