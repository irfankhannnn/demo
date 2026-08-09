import { describe, it, expect } from '@jest/globals';
import { resolveEntityByPhone, summarizeEntityForPrompt } from './entityResolver.js';
import { ENTITY_TYPE } from './constants.js';

function crmStub({ leads = [], roles = [], contact = null, failures = {} } = {}) {
  return {
    getLeads: async () => {
      if (failures.leads) throw new Error('leads exploded');
      return { leads };
    },
    findPersonByPhone: async () => {
      if (failures.person) throw new Error('person exploded');
      return { found: roles.length > 0, roles };
    },
    findContactByPhone: async () => {
      if (failures.contact) throw new Error('contact exploded');
      return contact;
    },
  };
}

describe('resolveEntityByPhone', () => {
  it('matches a lead regardless of phone formatting', async () => {
    const crmService = crmStub({
      leads: [{ leadId: 'L1', name: 'Rahul', phone: '+91 98765 43210', status: 'new' }],
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched).toMatchObject({ entityType: ENTITY_TYPE.LEAD, entityId: 'L1', name: 'Rahul' });
  });

  it('matches on the alternate phone number', async () => {
    const crmService = crmStub({
      leads: [{ leadId: 'L1', name: 'Rahul', phone: '9000000000', alternatePhone: '9876543210' }],
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched.entityId).toBe('L1');
  });

  it('prefers the lead when the same person exists in several roles', async () => {
    const crmService = crmStub({
      leads: [{ leadId: 'L1', name: 'Rahul', phone: '9876543210' }],
      roles: [
        { role: 'owner', id: 'O1', data: { name: 'Rahul', phone: '9876543210' } },
        { role: 'tenant', id: 'T1', data: { name: 'Rahul', phone: '9876543210' } },
      ],
      contact: { contactId: 'C1', name: 'Rahul', phone: '9876543210' },
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched.entityType).toBe(ENTITY_TYPE.LEAD);
    expect(result.candidates.map((c) => c.entityType))
      .toEqual([ENTITY_TYPE.LEAD, ENTITY_TYPE.TENANT, ENTITY_TYPE.OWNER, ENTITY_TYPE.CONTACT]);
  });

  it('falls back to the tenant record when there is no lead', async () => {
    const crmService = crmStub({
      roles: [{ role: 'tenant', id: 'T1', data: { name: 'Priya', phone: '9876543210' } }],
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched).toMatchObject({ entityType: ENTITY_TYPE.TENANT, entityId: 'T1' });
  });

  it('returns no match when the phone is unknown', async () => {
    const crmService = crmStub({ leads: [{ leadId: 'L1', phone: '9111111111' }] });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it('de-duplicates the same record surfaced by two lookups', async () => {
    const crmService = crmStub({
      roles: [
        { role: 'owner', id: 'O1', data: { name: 'A', phone: '9876543210' } },
        { role: 'owner', id: 'O1', data: { name: 'A', phone: '9876543210' } },
      ],
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.candidates).toHaveLength(1);
  });

  it('degrades gracefully when one lookup fails', async () => {
    const crmService = crmStub({
      failures: { leads: true },
      roles: [{ role: 'buyer', id: 'B1', data: { name: 'Sam', phone: '9876543210' } }],
    });
    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });
    expect(result.matched.entityType).toBe(ENTITY_TYPE.BUYER);
  });

  it('returns an empty result without a phone', async () => {
    const result = await resolveEntityByPhone('t1', '', { crmService: crmStub() });
    expect(result.matched).toBeNull();
  });

  it('retries the role lookup with the country code for records saved as +91...', async () => {
    const seen = [];
    const crmService = {
      getLeads: async () => ({ leads: [] }),
      findContactByPhone: async () => null,
      findPersonByPhone: async (_tenantId, phone) => {
        seen.push(phone);
        return phone === '919876543210'
          ? { found: true, roles: [{ role: 'owner', id: 'O1', data: { name: 'Anil', phone: '+919876543210' } }] }
          : { found: false, roles: [] };
      },
    };

    const result = await resolveEntityByPhone('t1', '9876543210', { crmService });

    expect(seen).toEqual(['9876543210', '919876543210']);
    expect(result.matched).toMatchObject({ entityType: ENTITY_TYPE.OWNER, entityId: 'O1' });
  });

  it('does not repeat the role lookup when the national form already matched', async () => {
    const seen = [];
    const crmService = {
      getLeads: async () => ({ leads: [] }),
      findContactByPhone: async () => null,
      findPersonByPhone: async (_tenantId, phone) => {
        seen.push(phone);
        return { found: true, roles: [{ role: 'tenant', id: 'T1', data: { name: 'Priya' } }] };
      },
    };

    await resolveEntityByPhone('t1', '9876543210', { crmService });

    expect(seen).toEqual(['9876543210']);
  });
});

describe('summarizeEntityForPrompt', () => {
  it('projects only the fields the prompt needs for a lead', () => {
    const summary = summarizeEntityForPrompt(ENTITY_TYPE.LEAD, {
      name: 'Rahul',
      phone: '9876543210',
      status: 'contacted',
      budgetMax: 15000000,
      secretInternalField: 'should not matter',
    });
    expect(summary).toMatchObject({ name: 'Rahul', status: 'contacted', budgetMax: 15000000 });
    expect(summary.secretInternalField).toBeUndefined();
  });

  it('returns null for a missing record', () => {
    expect(summarizeEntityForPrompt(ENTITY_TYPE.LEAD, null)).toBeNull();
  });
});
