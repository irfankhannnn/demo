import { describe, expect, it } from 'vitest';
import { getConvertResultPath } from './leadConversion';

describe('getConvertResultPath', () => {
  it('routes owner conversion to owners page even when contactId is present', () => {
    expect(
      getConvertResultPath({
        entityType: 'owner',
        role: 'owner',
        entity: { ownerId: 'owner-1' },
        contactId: 'contact-1',
      }),
    ).toBe('/crm/owners/owner-1');
  });

  it('routes seller conversion to owners page', () => {
    expect(
      getConvertResultPath({
        entityType: 'seller',
        role: 'seller',
        entity: { ownerId: 'owner-2' },
        contactId: 'contact-2',
      }),
    ).toBe('/crm/owners/owner-2');
  });

  it('routes buyer conversion to buyers page', () => {
    expect(
      getConvertResultPath({
        entityType: 'buyer',
        entity: { buyerId: 'buyer-1' },
        contactId: 'contact-3',
      }),
    ).toBe('/crm/buyers/buyer-1');
  });

  it('routes tenant conversion to tenants page', () => {
    expect(
      getConvertResultPath({
        entityType: 'tenant',
        entity: { customerId: 'tenant-1' },
        contactId: 'contact-4',
      }),
    ).toBe('/crm/tenants/tenant-1');
  });

  it('falls back to contact when no entity id is available', () => {
    expect(getConvertResultPath({ contactId: 'contact-only' })).toBe('/crm/contacts/contact-only');
  });
});
