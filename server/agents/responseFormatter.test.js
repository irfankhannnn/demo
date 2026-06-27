/**
 * Unit tests for server/agents/responseFormatter.js
 */

import {
  formatToolResult,
  formatAgentReply,
  isValidWhatsAppReply,
  sanitizeAndFormatReply,
} from './responseFormatter.js';

describe('Response Formatter', () => {
  const buyerLead = {
    leadId: 'lead-1',
    name: 'Faizan',
    leadType: 'buyer',
    phone: '9876543210',
    status: 'new',
    priority: 'high',
    source: 'Referral',
    assignedTo: 'Aman',
    buyerRequirement: { budget: 8000000, preferredArea: 'Andheri West', bhk: 2, propertyType: 'apartment' },
  };

  const sellerLead = {
    leadId: 'lead-2',
    name: 'Raj',
    leadType: 'seller',
    phone: '9123456780',
    status: 'contacted',
    priority: 'medium',
    sellerProperty: { expectedPrice: 15000000, area: 'Bandra', bhk: 3, propertyType: 'apartment' },
  };

  const property = {
    propertyId: 'prop-1',
    title: 'Sea View Apartment',
    propertyType: 'apartment',
    status: 'for-rent',
    city: 'Mumbai',
    area: 'Bandra',
    bhk: 2,
    furnishing: 'fully-furnished',
    monthlyRent: 65000,
  };

  const buyer = {
    buyerId: 'buyer-1',
    name: 'Rahul Sharma',
    phone: '9876543210',
    budget: 9500000,
    preferredArea: 'Andheri',
    propertyType: 'apartment',
    bhk: 3,
    status: 'active',
  };

  const owner = {
    ownerId: 'owner-1',
    name: 'Mr. Kapoor',
    phone: '9000000000',
    email: 'kapoor@example.com',
    status: 'active',
  };

  const tenant = {
    customerId: 'cust-1',
    name: 'Neha',
    phone: '9888888888',
    budget: 35000,
    preferredArea: 'Kurla',
    status: 'active',
  };

  const contact = {
    contactId: 'contact-1',
    name: 'Sunita',
    phone: '9777777777',
    email: 'sunita@example.com',
    role: 'broker',
    status: 'active',
  };

  describe('formatToolResult', () => {
    test('formats a single buyer lead', () => {
      const result = formatToolResult('create_lead', { ok: true, data: buyerLead });
      expect(result).toContain('Faizan');
      expect(result).toContain('Buyer Lead');
      expect(result).toContain('High');
      expect(result).toContain('₹80L');
      expect(result).toContain('Andheri West');
      expect(result).toContain('BHK: 2BHK');
      expect(result).toContain('Lead ID');
    });

    test('formats a single seller lead', () => {
      const result = formatToolResult('get_lead', { ok: true, data: sellerLead });
      expect(result).toContain('Raj');
      expect(result).toContain('Seller Lead');
      expect(result).toContain('₹1.5Cr');
      expect(result).toContain('Bandra');
    });

    test('formats a single property', () => {
      const result = formatToolResult('get_property', { ok: true, data: property });
      expect(result).toContain('Sea View Apartment');
      expect(result).toContain('For Rent');
      expect(result).toContain('₹65k');
      expect(result).toContain('Bandra');
      expect(result).toContain('BHK: 2BHK');
    });

    test('formats a single buyer', () => {
      const result = formatToolResult('create_buyer', { ok: true, data: buyer });
      expect(result).toContain('Rahul Sharma');
      expect(result).toContain('Active');
      expect(result).toContain('₹95L');
      expect(result).toContain('Andheri');
    });

    test('formats a single owner', () => {
      const result = formatToolResult('get_owner', { ok: true, data: owner });
      expect(result).toContain('Mr. Kapoor');
      expect(result).toContain('9000000000');
    });

    test('formats a single tenant', () => {
      const result = formatToolResult('get_tenant', { ok: true, data: tenant });
      expect(result).toContain('Neha');
      expect(result).toContain('₹35k');
      expect(result).toContain('Kurla');
    });

    test('formats a single contact', () => {
      const result = formatToolResult('get_contact', { ok: true, data: contact });
      expect(result).toContain('Sunita');
      expect(result).toContain('Broker');
      expect(result).toContain('9777777777');
    });

    test('formats a list of leads', () => {
      const result = formatToolResult('search_leads', { ok: true, data: { leads: [buyerLead, sellerLead], total: 2 } });
      expect(result).toContain('1. *Faizan*');
      expect(result).toContain('2. *Raj*');
      expect(result).toContain('₹80L');
      expect(result).toContain('₹1.5Cr');
    });

    test('formats an empty list', () => {
      const result = formatToolResult('search_leads', { ok: true, data: { leads: [], total: 0 } });
      expect(result).toContain('No leads found');
    });

    test('formats AI DTO envelope for lead search results', () => {
      const aiDto = {
        metadata: { view: 'searchResults', entityType: 'lead', total: 2, shown: 2, hasMore: false },
        data: [buyerLead, sellerLead],
      };
      const result = formatToolResult('search_leads', { ok: true, data: aiDto });
      expect(result).toContain('1. *Faizan*');
      expect(result).toContain('2. *Raj*');
      expect(result).toContain('₹80L');
      expect(result).toContain('₹1.5Cr');
    });

    test('formats AI DTO envelope with pagination and has more', () => {
      const aiDto = {
        metadata: { view: 'searchResults', entityType: 'lead', total: 5, shown: 2, hasMore: true },
        data: [buyerLead, sellerLead],
      };
      const result = formatToolResult('search_leads', { ok: true, data: aiDto });
      expect(result).toContain('Here are the 5 leads');
      expect(result).toContain('+3 more');
      expect(result).toContain('show more');
    });

    test('formats AI DTO envelope for single lead details', () => {
      const aiDto = {
        metadata: { view: 'details', entityType: 'lead' },
        data: buyerLead,
      };
      const result = formatToolResult('get_lead', { ok: true, data: aiDto });
      expect(result).toContain('Faizan');
      expect(result).toContain('Buyer Lead');
      expect(result).toContain('₹80L');
    });

    test('returns null for error results', () => {
      const result = formatToolResult('get_lead', { ok: false, error: 'Not found' });
      expect(result).toBeNull();
    });

    test('truncates long lists and mentions remaining count', () => {
      const leads = Array.from({ length: 8 }, (_, i) => ({ ...buyerLead, leadId: `lead-${i}`, name: `Person ${i}` }));
      const result = formatToolResult('get_leads', { ok: true, data: { leads, total: 8 } });
      expect(result).toContain('+3 more');
      expect(result).toContain('show more');
    });

    test('formats a single meeting', () => {
      const meeting = {
        meetingId: 'm1',
        title: 'Site Visit',
        scheduledDate: '2026-07-01T10:00:00Z',
        status: 'scheduled',
        location: 'Andheri West',
        relatedEntityType: 'lead',
        relatedEntityId: 'lead-1',
      };
      const result = formatToolResult('create_meeting', { ok: true, data: meeting });
      expect(result).toContain('*Site Visit*');
      expect(result).toContain('1 Jul 2026');
      expect(result).toContain('Scheduled');
      expect(result).toContain('Andheri West');
      expect(result).toContain('Meeting ID');
    });

    test('formats a list of meetings', () => {
      const meetings = [
        { meetingId: 'm1', title: 'Site Visit', scheduledDate: '2026-07-01T10:00:00Z', status: 'scheduled' },
        { meetingId: 'm2', title: 'Follow-up Call', scheduledDate: '2026-07-02T14:00:00Z', status: 'pending' },
      ];
      const result = formatToolResult('get_upcoming_meetings', { ok: true, data: { meetings, total: 2 } });
      expect(result).toContain('1. *Site Visit*');
      expect(result).toContain('2. *Follow-up Call*');
      expect(result).toContain('1 Jul 2026');
      expect(result).toContain('2 Jul 2026');
    });

    test('formats a note', () => {
      const note = {
        noteId: 'n1',
        content: 'Met client at site visit. Interested in 2BHK.',
        createdAt: '2026-07-01T10:00:00Z',
        createdBy: 'agent',
      };
      const result = formatToolResult('create_lead_note', { ok: true, data: note });
      expect(result).toContain('*Note*');
      expect(result).toContain('Met client at site visit');
      expect(result).toContain('1 Jul 2026');
      expect(result).toContain('agent');
    });

    test('formats a list of notes', () => {
      const notes = [
        { noteId: 'n1', content: 'First note', createdAt: '2026-07-01T10:00:00Z' },
        { noteId: 'n2', content: 'Second note', createdAt: '2026-07-02T10:00:00Z' },
      ];
      const result = formatToolResult('get_lead_notes', { ok: true, data: { notes, total: 2 } });
      expect(result).toContain('1. *Note*');
      expect(result).toContain('2. *Note*');
      expect(result).toContain('First note');
      expect(result).toContain('Second note');
    });

    test('formats a property document', () => {
      const doc = {
        documentId: 'd1',
        title: 'Sale Deed',
        url: 'https://example.com/deed.pdf',
        documentType: 'legal',
      };
      const result = formatToolResult('create_property_document', { ok: true, data: doc });
      expect(result).toContain('*Sale Deed*');
      expect(result).toContain('Legal');
      expect(result).toContain('https://example.com/deed.pdf');
      expect(result).toContain('Document ID');
    });

    test('formats CRM metrics', () => {
      const metrics = { totalLeads: 42, totalProperties: 12, totalOwners: 7 };
      const result = formatToolResult('get_crm_metrics', { ok: true, data: metrics });
      expect(result).toContain('*CRM Metrics*');
      expect(result).toContain('Total Leads: 42');
      expect(result).toContain('Total Properties: 12');
      expect(result).toContain('Total Owners: 7');
    });

    test('formats delete confirmation', () => {
      const result = formatToolResult('delete_lead', { ok: true, data: true });
      expect(result).toContain('Lead deleted successfully');
    });

    test('does not misclassify generic id-only objects as notes', () => {
      const generic = { id: 'some-id', name: 'Generic', value: 123 };
      const result = formatToolResult('unknown', { ok: true, data: generic });
      expect(result).toContain('Generic');
      expect(result).not.toContain('*Note*');
    });
  });

  describe('formatAgentReply', () => {
    test('keeps conversational reply when no tool results', () => {
      const result = formatAgentReply('Hello! Kaise help kar sakta hoon?', undefined);
      expect(result).toBe('Hello! Kaise help kar sakta hoon?');
    });

    test('uses structured formatter for tool results and ignores LLM reply', () => {
      const result = formatAgentReply('Done!', [{ tool: 'create_lead', result: { ok: true, data: buyerLead } }]);
      expect(result).toContain('Faizan');
      expect(result).toContain('₹80L');
      expect(result).not.toContain('Done!');
    });

    test('replaces long LLM reply with structured data', () => {
      const longReply = 'The tool has successfully created the lead with all the details you provided...';
      const result = formatAgentReply(longReply, [{ tool: 'create_lead', result: { ok: true, data: buyerLead } }]);
      expect(result).toContain('Faizan');
      expect(result).not.toContain('all the details you provided');
    });
  });

  describe('isValidWhatsAppReply', () => {
    test('accepts normal text', () => {
      expect(isValidWhatsAppReply('Hello! Kaise help kar sakta hoon?')).toBe(true);
    });

    test('rejects raw JSON', () => {
      expect(isValidWhatsAppReply('{"ok":true,"data":{}}')).toBe(false);
    });

    test('replies empty strings', () => {
      expect(isValidWhatsAppReply('')).toBe(false);
    });
  });

  describe('sanitizeAndFormatReply', () => {
    test('uses formatter when reply is invalid but tool results exist', () => {
      const result = sanitizeAndFormatReply('{"ok":true}', [{ tool: 'create_lead', result: { ok: true, data: buyerLead } }]);
      expect(result).toContain('Faizan');
      expect(result).toContain('₹80L');
    });

    test('falls back to safe message when nothing is valid', () => {
      const result = sanitizeAndFormatReply('{"ok":true}', []);
      expect(result).toBe('Done. Let me know if you need anything else.');
    });
  });
});
