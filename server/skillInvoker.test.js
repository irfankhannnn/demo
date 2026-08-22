/**
 * Unit tests for server/skillInvoker.js
 * Mocks crmDynamodbService to verify tool routing and validation.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('./crmDynamodbService.js', () => ({
  createLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', name: 'Test' }),
  getLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', name: 'Test' }),
  getLeads: jest.fn().mockResolvedValue([{ leadId: 'lead-1', name: 'Test' }]),
  updateLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', name: 'Updated' }),
  archiveLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', status: 'archived' }),
  deleteLead: jest.fn().mockResolvedValue(true),
  convertLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', convertedAt: '2026-01-01' }),
  createLeadNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getLeadNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  getContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  getContacts: jest.fn().mockResolvedValue([{ contactId: 'c1', name: 'Test' }]),
  updateContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Updated' }),
  archiveContact: jest.fn().mockResolvedValue({ contactId: 'c1', archivedAt: '2026-01-01T00:00:00.000Z' }),
  deleteContact: jest.fn().mockResolvedValue(true),
  updateContactRole: jest.fn().mockResolvedValue({ contactId: 'c1', roles: { owner: true } }),
  findContactByPhone: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  findPerson: jest.fn().mockResolvedValue({ found: true, matchCount: 1, matches: [{ recordType: 'lead', id: 'lead-1', name: 'Rajesh' }] }),
  searchKhataEntries: jest.fn().mockResolvedValue({ total: 2, shown: 2, entries: [] }),
  getKhataSummary: jest.fn().mockResolvedValue({ entryCount: 2, totalReceived: 50000, totalPaid: 20000, net: 30000, pendingCount: 1, pendingAmount: 15000, topPending: [] }),
  createContactNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getContactNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Test' }),
  getProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Test' }),
  getProperties: jest.fn().mockResolvedValue([{ propertyId: 'p1', title: 'Test' }]),
  updateProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Updated' }),
  archiveProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', status: 'archived' }),
  deleteProperty: jest.fn().mockResolvedValue(true),
  searchProperties: jest.fn().mockResolvedValue([{ propertyId: 'p1', title: 'Test' }]),
  getPropertyDocuments: jest.fn().mockResolvedValue([{ documentId: 'd1', title: 'Doc' }]),
  createPropertyDocument: jest.fn().mockResolvedValue({ documentId: 'd1', title: 'Doc' }),
  archivePropertyDocument: jest.fn().mockResolvedValue({ documentId: 'd1', archivedAt: '2026-01-01T00:00:00.000Z' }),
  deletePropertyDocument: jest.fn().mockResolvedValue(true),

  createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Test' }),
  getCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Test' }),
  getCustomers: jest.fn().mockResolvedValue([{ customerId: 'cust-1', name: 'Test' }]),
  updateCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Updated' }),
  archiveCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', status: 'inactive' }),
  deleteCustomer: jest.fn().mockResolvedValue(true),
  getCustomerByPhone: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Test' }),
  createCustomerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getCustomerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),
  updateCustomerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'updated' }),
  deleteCustomerNote: jest.fn().mockResolvedValue(true),
  searchCustomers: jest.fn().mockResolvedValue([{ customerId: 'cust-1', name: 'Test' }]),

  createOwner: jest.fn().mockResolvedValue({ ownerId: 'o1', name: 'Test' }),
  getOwner: jest.fn().mockResolvedValue({ ownerId: 'o1', name: 'Test' }),
  getOwners: jest.fn().mockResolvedValue([{ ownerId: 'o1', name: 'Test' }]),
  updateOwner: jest.fn().mockResolvedValue({ ownerId: 'o1', name: 'Updated' }),
  archiveOwner: jest.fn().mockResolvedValue({ ownerId: 'o1', status: 'inactive' }),
  deleteOwner: jest.fn().mockResolvedValue(true),
  getOwnerByPhone: jest.fn().mockResolvedValue({ ownerId: 'o1', name: 'Test' }),
  createOwnerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getOwnerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),
  updateOwnerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'updated' }),
  deleteOwnerNote: jest.fn().mockResolvedValue(true),
  searchOwners: jest.fn().mockResolvedValue([{ ownerId: 'o1', name: 'Test' }]),

  CRM_TABLE_NAME: 'test-crm-table',
  docClient: {},
  default: {},

  createBuyer: jest.fn().mockResolvedValue({ buyerId: 'b1', name: 'Test' }),
  getBuyer: jest.fn().mockResolvedValue({ buyerId: 'b1', name: 'Test' }),
  getBuyers: jest.fn().mockResolvedValue([{ buyerId: 'b1', name: 'Test' }]),
  updateBuyer: jest.fn().mockResolvedValue({ buyerId: 'b1', name: 'Updated' }),
  archiveBuyer: jest.fn().mockResolvedValue({ buyerId: 'b1', status: 'inactive' }),
  deleteBuyer: jest.fn().mockResolvedValue(true),
  searchBuyers: jest.fn().mockResolvedValue([{ buyerId: 'b1', name: 'Test' }]),
  createBuyerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getBuyerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Test' }),
  getMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Test' }),
  getMeetings: jest.fn().mockResolvedValue([{ meetingId: 'm1', title: 'Test' }]),
  updateMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Updated' }),
  archiveMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', status: 'archived' }),
  deleteMeeting: jest.fn().mockResolvedValue(true),
  getUpcomingMeetings: jest.fn().mockResolvedValue([{ meetingId: 'm1', title: 'Test' }]),

  getCRMMetrics: jest.fn().mockResolvedValue({ totalLeads: 10, totalProperties: 5 }),

  searchLeads: jest.fn().mockResolvedValue([{ leadId: 'lead-1', name: 'Test' }]),
  unwrapLeadsList: (result) => (Array.isArray(result) ? result : (result?.leads ?? [])),
  hasLeadConversionTarget: (lead) => !!(lead?.convertedTo && (lead.convertedTo.entityId || lead.convertedTo.contactId)),
  isLeadConverted: (lead) => !!(lead?.convertedTo && (lead.convertedTo.entityId || lead.convertedTo.contactId)),
  isLeadConversionInProgress: () => false,
  getLeadConversionSnapshots: jest.fn().mockResolvedValue([]),
  getLeadConversionSnapshotsByLeadId: jest.fn().mockResolvedValue([]),
}));

const canUserAccessTool = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('./userCategoryService.js', () => ({ canUserAccessTool }));

const { invokeSkill, SOURCE_TOOL_ALLOWLIST } = await import('./skillInvoker.js');
const { ALLOWED_TOOL_NAMES: ALLOWED_TOOLS, TOOL_SCHEMAS } = await import('./shared/toolDefinitions.js');
const crm = await import('./crmDynamodbService.js');

const TENANT_ID = 'tenant-123';

describe('skillInvoker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exposes all expected tools', () => {
    const expected = [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'archive_lead', 'convert_lead',
      'create_lead_note', 'get_lead_notes',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'archive_contact',
      'update_contact_role', 'create_contact_note', 'get_contact_notes',
      'create_property', 'get_property', 'search_properties', 'update_property', 'archive_property',
      'get_property_documents', 'create_property_document', 'archive_property_document',
      'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant', 'archive_tenant',
      'create_tenant_note', 'get_tenant_notes',
      'create_owner', 'get_owner', 'get_owners', 'update_owner', 'archive_owner',
      'create_owner_note', 'get_owner_notes',
      'create_buyer', 'get_buyer', 'search_buyers', 'update_buyer', 'archive_buyer',
      'create_buyer_note', 'get_buyer_notes',
      'find_contact_by_phone', 'get_owner_by_phone', 'get_tenant_by_phone',
      'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting', 'archive_meeting',
      'get_crm_metrics',
    ];
    // No delete_* tool remains exposed to the AI agent -- see
    // docs/proposals/agent-channel-architecture/phase1-imp/05-slice5-remove-delete-tools.md
    for (const tool of ALLOWED_TOOLS) {
      expect(tool.startsWith('delete_')).toBe(false);
    }
    for (const tool of expected) {
      expect(ALLOWED_TOOLS).toContain(tool);
      expect(TOOL_SCHEMAS[tool]).toBeDefined();
    }
  });

  test('create_lead calls createLead', async () => {
    const result = await invokeSkill(TENANT_ID, 'create_lead', { name: 'Test', leadType: 'buyer' });
    expect(crm.createLead).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ name: 'Test', leadType: 'buyer' }));
    expect(result.ok).toBe(true);
  });

  // isValidEntityId (skillInvoker.js) requires a real UUID or a 20+ char
  // hex-ish id -- short slug-style fixtures like 'lead-1'/'p1' are rejected
  // before the handler is ever called, exactly as it would reject a model
  // that invented an id instead of using one from a prior search/get.
  const FIXTURE_LEAD_ID = '11111111-1111-4111-8111-111111111111';
  const FIXTURE_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';
  const FIXTURE_BUYER_ID = '33333333-3333-4333-8333-333333333333';
  const FIXTURE_CONTACT_ID = '44444444-4444-4444-8444-444444444444';
  const FIXTURE_TENANT_ID = '55555555-5555-4555-8555-555555555555';
  const FIXTURE_OWNER_ID = '66666666-6666-4666-8666-666666666666';
  const FIXTURE_MEETING_ID = '77777777-7777-4777-8777-777777777777';

  test('archive_lead calls archiveLead', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_lead', { leadId: FIXTURE_LEAD_ID });
    expect(crm.archiveLead).toHaveBeenCalledWith(TENANT_ID, FIXTURE_LEAD_ID);
    expect(result.ok).toBe(true);
  });

  test('delete_lead is no longer a callable tool', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_lead', { leadId: FIXTURE_LEAD_ID });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not allowed');
    expect(crm.deleteLead).not.toHaveBeenCalled();
  });

  test('get_lead passes leadId string not input object', async () => {
    const result = await invokeSkill(TENANT_ID, 'get_lead', { leadId: FIXTURE_LEAD_ID });
    expect(crm.getLead).toHaveBeenCalledWith(TENANT_ID, FIXTURE_LEAD_ID);
    expect(result.ok).toBe(true);
  });

  test('get_property passes propertyId string', async () => {
    const result = await invokeSkill(TENANT_ID, 'get_property', { propertyId: FIXTURE_PROPERTY_ID });
    expect(crm.getProperty).toHaveBeenCalledWith(TENANT_ID, FIXTURE_PROPERTY_ID);
    expect(result.ok).toBe(true);
  });

  test('get_lead_notes calls getLeadNotes', async () => {
    const result = await invokeSkill(TENANT_ID, 'get_lead_notes', { leadId: 'lead-1' });
    expect(crm.getLeadNotes).toHaveBeenCalledWith(TENANT_ID, 'lead-1');
    expect(result.ok).toBe(true);
  });

  test('update_contact_role calls updateContactRole', async () => {
    const result = await invokeSkill(TENANT_ID, 'update_contact_role', { contactId: 'c1', role: 'owner', enabled: true });
    expect(crm.updateContactRole).toHaveBeenCalledWith(TENANT_ID, 'c1', 'owner', true, null);
    expect(result.ok).toBe(true);
  });

  test('search_khata_entries dispatches with its filters', async () => {
    const result = await invokeSkill(TENANT_ID, 'search_khata_entries', { settlementStatus: 'PENDING' });
    expect(crm.searchKhataEntries).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ settlementStatus: 'PENDING' }));
    expect(result.ok).toBe(true);
  });

  test('get_khata_summary dispatches with no required args', async () => {
    const result = await invokeSkill(TENANT_ID, 'get_khata_summary', {});
    expect(crm.getKhataSummary).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  test('khata exposes NO write tool to the agent (money is mutated by a human)', () => {
    // Guard for the design rule in server/khataDynamodbService.js: the agent
    // may read the ledger but never create/update/settle an entry. If someone
    // adds a khata write tool later, this fails and forces the conversation.
    const khataWrites = ALLOWED_TOOLS.filter(
      (n) => n.includes('khata') && /^(create|update|delete|archive|settle)_/.test(n),
    );
    expect(khataWrites).toEqual([]);
  });

  test('find_person passes the input object through to findPerson', async () => {
    // Dispatch-shape guard (Phase 3 Slice 3d). findPerson is declared as
    // (tenantId, filters = {}), so Function.length reports 1 -- NOT 2 -- and
    // it therefore misses skillInvoker's `handler.length === 2` branch and
    // lands in the final else. That still passes (tenantId, input), which is
    // correct, but only by luck of the fallback. This test pins the actual
    // call shape so a future reshuffle of that dispatch chain can't silently
    // start passing findPerson the wrong thing.
    const result = await invokeSkill(TENANT_ID, 'find_person', { query: 'Rajesh' });
    expect(crm.findPerson).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ query: 'Rajesh' }));
    expect(result.ok).toBe(true);
  });

  test('find_person requires a query', async () => {
    const result = await invokeSkill(TENANT_ID, 'find_person', {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('query');
  });

  test('archive_contact calls archiveContact', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_contact', { contactId: FIXTURE_CONTACT_ID });
    expect(crm.archiveContact).toHaveBeenCalledWith(TENANT_ID, FIXTURE_CONTACT_ID);
    expect(result.ok).toBe(true);
  });

  test('find_contact_by_phone calls findContactByPhone', async () => {
    const result = await invokeSkill(TENANT_ID, 'find_contact_by_phone', { phone: '9876543210' });
    expect(crm.findContactByPhone).toHaveBeenCalledWith(TENANT_ID, '9876543210');
    expect(result.ok).toBe(true);
  });

  test('delete_property is no longer a callable tool', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_property', { propertyId: FIXTURE_PROPERTY_ID });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not allowed');
    expect(crm.deleteProperty).not.toHaveBeenCalled();
  });

  test('archive_property calls archiveProperty', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_property', { propertyId: FIXTURE_PROPERTY_ID });
    expect(crm.archiveProperty).toHaveBeenCalledWith(TENANT_ID, FIXTURE_PROPERTY_ID);
    expect(result.ok).toBe(true);
  });

  test('create_meeting calls createMeeting', async () => {
    const result = await invokeSkill(TENANT_ID, 'create_meeting', {
      title: 'Site Visit',
      scheduledDate: '2026-07-01T10:00:00Z',
      relatedEntityType: 'lead',
      relatedEntityId: 'lead-1',
    });
    expect(crm.createMeeting).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ title: 'Site Visit' }));
    expect(result.ok).toBe(true);
  });

  test('get_crm_metrics calls getCRMMetrics', async () => {
    const result = await invokeSkill(TENANT_ID, 'get_crm_metrics', {});
    // getCRMMetrics(tenantId) has arity 1 and ignores a 2nd arg, but
    // skillInvoker's generic dispatch can't tell that apart from sibling
    // summary handlers like getLeadsSummary(tenantId, filters={}) which DO
    // use one -- so it must keep passing input through for all of them.
    expect(crm.getCRMMetrics).toHaveBeenCalledWith(TENANT_ID, {});
    expect(result.ok).toBe(true);
  });

  test('archive_buyer calls archiveBuyer', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_buyer', { buyerId: FIXTURE_BUYER_ID });
    expect(crm.archiveBuyer).toHaveBeenCalledWith(TENANT_ID, FIXTURE_BUYER_ID);
    expect(result.ok).toBe(true);
  });

  test('delete_buyer is no longer a callable tool', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_buyer', { buyerId: FIXTURE_BUYER_ID });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not allowed');
    expect(crm.deleteBuyer).not.toHaveBeenCalled();
  });

  test('archive_tenant calls archiveCustomer', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_tenant', { tenantRecordId: FIXTURE_TENANT_ID });
    expect(crm.archiveCustomer).toHaveBeenCalledWith(TENANT_ID, FIXTURE_TENANT_ID);
    expect(result.ok).toBe(true);
  });

  test('archive_owner calls archiveOwner', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_owner', { ownerId: FIXTURE_OWNER_ID });
    expect(crm.archiveOwner).toHaveBeenCalledWith(TENANT_ID, FIXTURE_OWNER_ID);
    expect(result.ok).toBe(true);
  });

  test('archive_meeting calls archiveMeeting', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_meeting', { meetingId: FIXTURE_MEETING_ID });
    expect(crm.archiveMeeting).toHaveBeenCalledWith(TENANT_ID, FIXTURE_MEETING_ID);
    expect(result.ok).toBe(true);
  });

  // Regression coverage for a pre-existing bug found while wiring up
  // archive_property_document: create/archive/delete_property_document all
  // take TWO id-shaped fields (propertyId AND documentId). The generic
  // dispatch's extractEntityId() only ever picks the first *Id field it
  // finds, so documentId was silently dropped -- delete_property_document
  // never actually deleted the intended document.
  test('create_property_document calls createPropertyDocument with propertyId and data', async () => {
    const result = await invokeSkill(TENANT_ID, 'create_property_document', {
      propertyId: FIXTURE_PROPERTY_ID,
      title: 'Sale Deed',
      url: 's3://bucket/deed.pdf',
    });
    expect(crm.createPropertyDocument).toHaveBeenCalledWith(
      TENANT_ID,
      FIXTURE_PROPERTY_ID,
      expect.objectContaining({ propertyId: FIXTURE_PROPERTY_ID, title: 'Sale Deed' }),
    );
    expect(result.ok).toBe(true);
  });

  test('archive_property_document calls archivePropertyDocument with both ids', async () => {
    const result = await invokeSkill(TENANT_ID, 'archive_property_document', {
      propertyId: FIXTURE_PROPERTY_ID,
      documentId: 'd1',
    });
    expect(crm.archivePropertyDocument).toHaveBeenCalledWith(TENANT_ID, FIXTURE_PROPERTY_ID, 'd1');
    expect(result.ok).toBe(true);
  });

  test('delete_property_document is no longer a callable tool', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_property_document', {
      propertyId: FIXTURE_PROPERTY_ID,
      documentId: 'd1',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not allowed');
    expect(crm.deletePropertyDocument).not.toHaveBeenCalled();
  });

  test('rejects unknown tools', async () => {
    const result = await invokeSkill(TENANT_ID, 'unknown_tool', {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Tool not allowed');
  });

  test('validates missing required parameter', async () => {
    const result = await invokeSkill(TENANT_ID, 'create_lead', { name: 'Test' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('leadType');
  });

  describe('per-source tool allowlist (Phase 5b)', () => {
    test('an unattended cron may call the tools it is allowed', async () => {
      const result = await invokeSkill(TENANT_ID, 'get_lead', { leadId: FIXTURE_LEAD_ID }, {
        source: 'cron.lead_qualifier',
      });
      expect(result.ok).toBe(true);
    });

    test('the same cron is refused a tool outside its allowlist', async () => {
      // The qualifier needs get_lead and update_lead. Nothing stops it reaching
      // for archive_lead except this bound -- and nobody is watching it run.
      const result = await invokeSkill(TENANT_ID, 'archive_lead', { leadId: FIXTURE_LEAD_ID }, {
        source: 'cron.lead_qualifier',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not permitted for this caller');
      expect(crm.archiveLead).not.toHaveBeenCalled();
    });

    test('an unlisted source stays unrestricted', async () => {
      // agent.pipeline and mcp legitimately need the whole registry; there a
      // human is asking and the RBAC category is the right control.
      const result = await invokeSkill(TENANT_ID, 'archive_lead', { leadId: FIXTURE_LEAD_ID }, {
        source: 'agent.pipeline',
      });
      expect(result.ok).toBe(true);
    });

    test('every allowlisted tool name is a real tool', () => {
      // A typo here silently bricks a cron: the tool it needs is never callable.
      for (const [source, tools] of Object.entries(SOURCE_TOOL_ALLOWLIST)) {
        for (const tool of tools) {
          expect({ source, tool, known: ALLOWED_TOOLS.includes(tool) })
            .toEqual({ source, tool, known: true });
        }
      }
    });
  });

  describe('permission check', () => {
    test('is skipped entirely when no userId is supplied', async () => {
      // This is the WhatsApp bypass: the check does not run, and nothing in
      // the logs says so. agentRuntime now always supplies an identity.
      await invokeSkill(TENANT_ID, 'search_leads', {});
      expect(canUserAccessTool).not.toHaveBeenCalled();
    });

    test('forwards fallbackCategory so a non-human identity does not fail closed', async () => {
      await invokeSkill(TENANT_ID, 'search_leads', {}, {
        userId: 'wa:919876543210',
        fallbackCategory: 'admin',
      });
      expect(canUserAccessTool).toHaveBeenCalledWith(
        TENANT_ID, 'wa:919876543210', 'search_leads', { fallbackCategory: 'admin' },
      );
    });

    test('denies the call when the category check says no', async () => {
      canUserAccessTool.mockResolvedValueOnce(false);
      const result = await invokeSkill(TENANT_ID, 'search_leads', {}, { userId: 'u1' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('does not have access');
    });
  });
});
