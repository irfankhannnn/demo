/**
 * Golden conversation / response regression tests.
 * Covers detail cards, lists, create confirmations, empty states, recommendations
 * across all entities — not just leads.
 */

import {
  formatAgentReply,
  formatToolResult,
  sanitizeAndFormatReply,
} from './responseFormatter.js';
import { buildLeadDetails } from '../aiViewBuilders/leadAIViewBuilder.js';
import { buildBuyerDetails } from '../aiViewBuilders/buyerAIViewBuilder.js';
import { buildOwnerDetails } from '../aiViewBuilders/ownerAIViewBuilder.js';
import { buildTenantDetails } from '../aiViewBuilders/tenantAIViewBuilder.js';
import { buildPropertyDetails } from '../aiViewBuilders/propertyAIViewBuilder.js';
import { buildContactDetails } from '../aiViewBuilders/contactAIViewBuilder.js';
import { buildMeetingDetails } from '../aiViewBuilders/meetingAIViewBuilder.js';

function assertNoInternalIds(text) {
  expect(text).not.toMatch(/\bLead ID\b/i);
  expect(text).not.toMatch(/\bProperty ID\b/i);
  expect(text).not.toMatch(/\bOwner ID\b/i);
  expect(text).not.toMatch(/\bContact ID\b/i);
  expect(text).not.toMatch(/\bMeeting ID\b/i);
  expect(text).not.toMatch(/\bBuyer ID\b/i);
  expect(text).not.toMatch(/\bPK\b/);
  expect(text).not.toMatch(/\btenantId\b/);
}

describe('Golden conversations — detail cards', () => {
  test('buyer lead detail (Sakina-style)', () => {
    const lead = {
      leadId: 'uuid-hide',
      name: 'Sakina Shaikh',
      leadType: 'buyer',
      phone: '9876512345',
      email: 'sakina@email.com',
      status: 'qualified',
      score: 'HOT',
      scoreValue: 91,
      source: 'magicbricks',
      assignedTo: 'Imran Khan',
      createdAt: '2026-07-12',
      lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
      nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
      buyerRequirement: { budget: 9000000, preferredArea: 'Andheri, Powai', bhk: 2, propertyType: 'Apartment' },
      notes: [{ content: 'Wants site visit this weekend.', createdAt: '2026-07-18' }],
      history: [1, 2, 3, 4, 5, 6, 7],
    };
    const dto = buildLeadDetails(lead);
    const text = formatToolResult('get_lead', { ok: true, data: dto });
    expect(text).toContain('*Sakina Shaikh*');
    expect(text).toContain('Buyer Lead');
    expect(text).toContain('Looking For');
    expect(text).toContain('Recommendation');
    expect(dto.metadata.recommendation).toBeTruthy();
    assertNoInternalIds(text);
  });

  test('owner detail with recommendation', () => {
    const owner = {
      ownerId: 'o1',
      name: 'Sakina Shaikh',
      phone: '9876512345',
      status: 'active',
      properties: [
        { propertyType: 'Apartment', area: 'Andheri West', status: 'available' },
        { propertyType: 'Commercial Shop', area: 'Andheri West', status: 'available' },
      ],
      notes: [{ content: 'Ready to negotiate.', createdAt: '2026-07-15' }],
    };
    const dto = buildOwnerDetails(owner);
    const text = formatToolResult('get_owner', { ok: true, data: dto });
    expect(text).toContain('Property Owner');
    expect(text).toContain('Properties');
    expect(text).toContain('Recommendation');
    expect(dto.metadata.recommendation?.action).toMatch(/Match/i);
    assertNoInternalIds(text);
  });

  test('buyer detail with recommendation', () => {
    const dto = buildBuyerDetails({
      buyerId: 'b1',
      name: 'Rahul Sharma',
      phone: '9876543210',
      status: 'active',
      budget: 9500000,
      preferredArea: 'Andheri',
      bhk: 3,
      propertyType: 'apartment',
    });
    const text = formatToolResult('get_buyer', { ok: true, data: dto });
    expect(text).toContain('Rahul Sharma');
    expect(text).toContain('Looking For');
    expect(text).toContain('Recommendation');
    assertNoInternalIds(text);
  });

  test('property detail with recommendation', () => {
    const dto = buildPropertyDetails({
      propertyId: 'p1',
      title: '3BHK in Bandra',
      propertyType: 'apartment',
      status: 'for-sale',
      area: 'Bandra West',
      city: 'Mumbai',
      bhk: 3,
      salePrice: 25000000,
      ownerName: 'Kapoor',
      ownerId: 'secret',
    });
    const text = formatToolResult('get_property', { ok: true, data: dto });
    expect(text).toContain('3BHK in Bandra');
    expect(text).toContain('Kapoor');
    expect(text).toContain('Recommendation');
    expect(text).not.toContain('secret');
    assertNoInternalIds(text);
  });

  test('tenant / contact / meeting details', () => {
    const tenant = formatToolResult('get_tenant', {
      ok: true,
      data: buildTenantDetails({
        customerId: 't1',
        name: 'Neha',
        phone: '9888888888',
        status: 'active',
        budget: 35000,
        preferredArea: 'Kurla',
      }),
    });
    expect(tenant).toContain('Neha');
    expect(tenant).toContain('Recommendation');
    assertNoInternalIds(tenant);

    const contact = formatToolResult('get_contact', {
      ok: true,
      data: buildContactDetails({
        contactId: 'c1',
        name: 'Ravi Broker',
        phone: '9777777777',
        role: 'broker',
        status: 'active',
      }),
    });
    expect(contact).toContain('Broker');
    expect(contact).toContain('Recommendation');
    assertNoInternalIds(contact);

    const meeting = formatToolResult('get_meeting', {
      ok: true,
      data: buildMeetingDetails({
        meetingId: 'm1',
        title: 'Site Visit',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        status: 'scheduled',
        location: 'Andheri',
        relatedEntityName: 'Sakina Shaikh',
      }),
    });
    expect(meeting).toContain('Site Visit');
    expect(meeting).toContain('Sakina Shaikh');
    expect(meeting).toContain('Recommendation');
    assertNoInternalIds(meeting);
  });
});

describe('Golden conversations — lists / empty / create / routing', () => {
  test('search list header and no UUID', () => {
    const text = formatToolResult('search_leads', {
      ok: true,
      data: {
        metadata: { total: 2, hasMore: false },
        data: [
          { leadId: 'a', name: 'Asha', leadType: 'buyer', status: 'new', buyerRequirement: { budget: 5000000, preferredArea: 'Powai' } },
          { leadId: 'b', name: 'Bala', leadType: 'owner', status: 'contacted', ownerProperty: { rentExpected: 45000, area: 'Kurla' } },
        ],
      },
    });
    expect(text).toContain('*Leads (2)*');
    expect(text).toContain('1. *Asha*');
    expect(text).toContain('2. *Bala*');
    assertNoInternalIds(text);
  });

  test('lead card list — dynamic title from filters + card layout', () => {
    const reply = formatAgentReply('intro', [
      {
        tool: 'search_leads',
        input: { temperature: 'hot' },
        result: {
          ok: true,
          data: {
            metadata: { view: 'searchResults', entityType: 'lead', total: 2, hasMore: false },
            data: [
              { leadId: 'l1', name: 'Danish Shaikh', leadType: 'buyer', status: 'new', area: 'Andheri', bhk: 2, propertyType: 'apartment', budget: 15000000 },
              { leadId: 'l2', name: 'Anita Acharya', leadType: 'seller', status: 'contacted', propertyType: 'house', budget: 16200000 },
            ],
          },
        },
      },
    ]);
    expect(reply).toContain('🔥 *Hot Leads (2)*');
    expect(reply).toContain('1. *Danish Shaikh*');
    expect(reply).toContain('🛒 Buyer • New');
    expect(reply).toContain('📍 Andheri');
    expect(reply).toContain('🏠 2 BHK Apartment');
    expect(reply).toContain('💰 ₹1.5Cr');
  });

  test('lead card list — composite title', () => {
    const reply = formatAgentReply('', [
      {
        tool: 'search_leads',
        input: { temperature: 'hot', leadType: 'buyer', area: 'Pune' },
        result: {
          ok: true,
          data: {
            metadata: { view: 'searchResults', entityType: 'lead', total: 1 },
            data: [{ leadId: 'l3', name: 'Ravi', leadType: 'buyer', status: 'new', area: 'Pune', budget: 5000000 }],
          },
        },
      },
    ]);
    expect(reply).toContain('*Hot Buyer Leads in Pune (1)*');
  });

  test('empty search warm message', () => {
    const text = formatToolResult('search_buyers', {
      ok: true,
      data: { metadata: { total: 0 }, data: [] },
    });
    expect(text).toMatch(/No buyers found/i);
    expect(text).toMatch(/create|area|budget/i);
  });

  test('create confirmation is compact', () => {
    const text = formatToolResult('create_owner', {
      ok: true,
      data: { ownerId: 'o1', name: 'Mr Kapoor', phone: '9000000000', status: 'active', propertyCount: 2 },
    });
    expect(text).toContain('created');
    expect(text).toContain('Kapoor');
    expect(text).not.toContain('Quick Stats');
    assertNoInternalIds(text);
  });

  test('get_lead ignores short LLM intro', () => {
    const lead = {
      leadId: 'x',
      name: 'Sakina Shaikh',
      leadType: 'buyer',
      status: 'qualified',
      phone: '9876512345',
      buyerRequirement: { budget: 8000000, preferredArea: 'Andheri' },
    };
    const reply = formatAgentReply('Yeh rahi details:', [
      { tool: 'get_lead', result: { ok: true, data: lead } },
    ]);
    expect(reply).toContain('*Sakina Shaikh*');
    expect(reply).toContain('Looking For');
  });

  test('summary tool uses formatter for get_leads_summary', () => {
    const llm = 'Total *15* leads with pipes • Buyer: 5 | Seller: 2';
    const reply = formatAgentReply(llm, [
      {
        tool: 'get_leads_summary',
        result: {
          ok: true,
          data: {
            total: 16,
            active: 14,
            unassigned: 13,
            byType: { buyer: 8, seller: 2, tenant: 4, owner: 2 },
            byTemperature: { hot: 5, warm: 9, cold: 2, unscored: 0 },
          },
        },
      },
    ]);
    expect(reply).toContain('📊 Lead Summary');
    expect(reply).toContain('Total Leads: 16');
    expect(reply).toContain('Active: 14');
    expect(reply).toContain('• Buyer: 8');
    expect(reply).toContain('🔥 Hot: 5');
    expect(reply).toContain('⚠️ Unassigned: 13');
    expect(reply).not.toContain('|');
    expect(reply).not.toBe(llm);
  });

  test('sanitize falls back safely', () => {
    const reply = sanitizeAndFormatReply('{"ok":true}', [
      { tool: 'get_lead', result: { ok: true, data: { leadId: '1', name: 'Test', leadType: 'buyer', status: 'new' } } },
    ]);
    expect(reply).toContain('Test');
  });
});

describe('LLM pipeline presentation contract', () => {
  test('search_leads with temperature filter uses formatter list (not total-only card)', async () => {
    const { decideInteraction } = await import('./interaction/decideInteraction.js');
    const { renderDecision } = await import('./responseFormatter.js');
    const result = {
      ok: true,
      data: {
        metadata: { total: 2 },
        data: [
          { leadId: 'l1', name: 'Low One', leadType: 'buyer', status: 'new', score: 'COLD' },
          { leadId: 'l2', name: 'Low Two', leadType: 'seller', status: 'contacted', score: 'COLD' },
        ],
      },
    };
    const decision = decideInteraction(
      { kind: 'tool', toolName: 'search_leads', input: { temperature: 'cold' } },
      result,
    );
    expect(decision.mode).toBe('list');
    const text = renderDecision(decision, result, null);
    expect(text).toContain('Low One');
    expect(text).toContain('Low Two');
    expect(text).not.toMatch(/^\* Total:/m);
  });
});
