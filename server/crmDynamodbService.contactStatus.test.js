import { describe, expect, test } from '@jest/globals';
import { deriveContactStatus } from './crmDynamodbService.js';

describe('deriveContactStatus', () => {
  const contact = {
    contactId: 'contact-1',
    linkedOwnerId: 'owner-1',
    linkedCustomerId: 'customer-1',
    phone: '9876543210',
    roles: {},
  };

  test('is active when the contact currently owns a property', () => {
    expect(deriveContactStatus(contact, {
      properties: [{ currentOwnerContactId: 'contact-1' }],
    })).toBe('active');
  });

  test('is active when the contact has an active listing', () => {
    expect(deriveContactStatus(contact, {
      listings: [{ listedByContactId: 'contact-1', status: 'active' }],
    })).toBe('active');
  });

  test('is active for an active buyer role', () => {
    expect(deriveContactStatus({
      ...contact,
      roles: { buyer: true },
      buyerProfile: {},
    })).toBe('active');
  });

  test('is active for a tenant with a current lease', () => {
    expect(deriveContactStatus(contact, {
      customers: [{
        customerId: 'customer-1',
        status: 'active',
        currentRental: { leaseEndDate: '2099-01-01' },
      }],
    })).toBe('active');
  });

  test('is inactive without a current CRM relationship', () => {
    expect(deriveContactStatus(contact)).toBe('inactive');
  });
});
