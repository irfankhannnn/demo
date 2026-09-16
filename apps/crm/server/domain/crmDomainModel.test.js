/**
 * Domain model unit tests — lifecycle vocabulary (no DynamoDB).
 */
import { describe, expect, test } from '@jest/globals';
import {
  SELLER_LIFECYCLE,
  OWNER_LIFECYCLE,
  BUYER_STATUS,
  PROPERTY_STATUS,
  SALE_VIA,
  buildSellerProfile,
  buildOwnerProfile,
  buildOwnershipTransferEntry,
  resolveCurrentOwnerContactId,
  propertyIsCurrentlyOwnedBy,
  propertyOwnerGsi1Pk,
  saleTransactionPk,
  isPropertyNotListed,
  normalizePropertyMarketStatus,
  isValidPropertyStatusTransition,
  propertyStatusLabel,
  buyerStatusLabel,
} from './crmDomainModel.js';

describe('crmDomainModel', () => {
  test('buildSellerProfile defaults to active lifecycle', () => {
    const profile = buildSellerProfile();
    expect(profile.lifecycleStatus).toBe(SELLER_LIFECYCLE.ACTIVE);
    expect(profile.soldPropertyIds).toEqual([]);
  });

  test('buildOwnerProfile defaults to active lifecycle', () => {
    const profile = buildOwnerProfile({ ownedPropertyIds: ['p1'] });
    expect(profile.lifecycleStatus).toBe(OWNER_LIFECYCLE.ACTIVE);
    expect(profile.ownedPropertyIds).toEqual(['p1']);
  });

  test('buildOwnershipTransferEntry creates immutable transfer shape', () => {
    const entry = buildOwnershipTransferEntry({
      fromContactId: 'c-seller',
      toContactId: 'c-buyer',
      fromOwnerName: 'Ahmed',
      toOwnerName: 'Zaid',
      salePrice: 5000000,
      soldVia: SALE_VIA.DIRECT,
      saleTransactionId: 'sale-1',
    });
    expect(entry.fromContactId).toBe('c-seller');
    expect(entry.toContactId).toBe('c-buyer');
    expect(entry.buyerContactId).toBe('c-buyer');
    expect(entry.sellerContactId).toBe('c-seller');
    expect(entry.salePrice).toBe(5000000);
    expect(entry.saleTransactionId).toBe('sale-1');
    expect(entry.saleDate).toBeTruthy();
  });

  test('resolveCurrentOwnerContactId prefers currentOwnerContactId', () => {
    expect(resolveCurrentOwnerContactId({
      currentOwnerContactId: 'c1',
      ownerContactId: 'c2',
      ownerId: 'o1',
    })).toBe('c1');
    expect(resolveCurrentOwnerContactId({
      ownerContactId: 'c2',
      ownerId: 'o1',
    })).toBe('c2');
    expect(resolveCurrentOwnerContactId({ ownerId: 'o1' })).toBeNull();
  });

  test('propertyOwnerGsi1Pk uses CONTACT prefix', () => {
    expect(propertyOwnerGsi1Pk('t1', 'c1')).toBe('TENANT#t1#CONTACT#c1');
    expect(propertyOwnerGsi1Pk('t1', null)).toBe('TENANT#t1#OWNER#UNASSIGNED');
  });

  test('saleTransactionPk builds SALE key', () => {
    expect(saleTransactionPk('t1', 's1')).toBe('TENANT#t1#SALE#s1');
  });

  test('propertyIsCurrentlyOwnedBy matches contact or legacy ownerId', () => {
    expect(propertyIsCurrentlyOwnedBy(
      { currentOwnerContactId: 'c-buyer', ownerId: null },
      { contactId: 'c-buyer', ownerId: 'o-seller' },
    )).toBe(true);
    expect(propertyIsCurrentlyOwnedBy(
      { currentOwnerContactId: 'c-buyer', ownerId: 'o-buyer' },
      { contactId: 'c-other', ownerId: 'o-buyer' },
    )).toBe(true);
  });

  test('property status transitions are flexible between listing states', () => {
    expect(isValidPropertyStatusTransition('for-sale', 'for-rent')).toBe(true);
    expect(isValidPropertyStatusTransition('for-rent', 'for-sale')).toBe(true);
    expect(isValidPropertyStatusTransition('for-sale', 'not-listed')).toBe(true);
    expect(isValidPropertyStatusTransition('sold', 'for-rent')).toBe(true);
    expect(isValidPropertyStatusTransition('for-sale', 'for-sale')).toBe(true);
    expect(isValidPropertyStatusTransition('for-sale', 'bogus')).toBe(false);
  });

  test('buyer purchased status and property not-listed vocabulary', () => {
    expect(BUYER_STATUS.PURCHASED).toBe('purchased');
    expect(PROPERTY_STATUS.NOT_LISTED).toBe('not-listed');
    expect(isPropertyNotListed('inactive')).toBe(true);
    expect(isPropertyNotListed('available')).toBe(true);
    expect(isPropertyNotListed('not-listed')).toBe(true);
    expect(isPropertyNotListed('for-sale')).toBe(false);
    expect(normalizePropertyMarketStatus('inactive')).toBe('not-listed');
    expect(normalizePropertyMarketStatus('available')).toBe('not-listed');
    expect(propertyStatusLabel('for-sale')).toBe('Available for Sale');
    expect(propertyStatusLabel('rented')).toBe('Occupied');
    expect(propertyStatusLabel('inactive')).toBe('Not Listed');
    expect(buyerStatusLabel('purchased')).toBe('Purchased');
  });
});
