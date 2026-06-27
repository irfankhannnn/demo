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
  deleteLead: jest.fn().mockResolvedValue(true),
  convertLead: jest.fn().mockResolvedValue({ leadId: 'lead-1', convertedAt: '2026-01-01' }),
  createLeadNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getLeadNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  getContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  getContacts: jest.fn().mockResolvedValue([{ contactId: 'c1', name: 'Test' }]),
  updateContact: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Updated' }),
  deleteContact: jest.fn().mockResolvedValue(true),
  updateContactRole: jest.fn().mockResolvedValue({ contactId: 'c1', roles: { owner: true } }),
  findContactByPhone: jest.fn().mockResolvedValue({ contactId: 'c1', name: 'Test' }),
  createContactNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getContactNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Test' }),
  getProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Test' }),
  getProperties: jest.fn().mockResolvedValue([{ propertyId: 'p1', title: 'Test' }]),
  updateProperty: jest.fn().mockResolvedValue({ propertyId: 'p1', title: 'Updated' }),
  deleteProperty: jest.fn().mockResolvedValue(true),
  searchProperties: jest.fn().mockResolvedValue([{ propertyId: 'p1', title: 'Test' }]),
  getPropertyDocuments: jest.fn().mockResolvedValue([{ documentId: 'd1', title: 'Doc' }]),
  createPropertyDocument: jest.fn().mockResolvedValue({ documentId: 'd1', title: 'Doc' }),
  deletePropertyDocument: jest.fn().mockResolvedValue(true),

  createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Test' }),
  getCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Test' }),
  getCustomers: jest.fn().mockResolvedValue([{ customerId: 'cust-1', name: 'Test' }]),
  updateCustomer: jest.fn().mockResolvedValue({ customerId: 'cust-1', name: 'Updated' }),
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
  deleteBuyer: jest.fn().mockResolvedValue(true),
  searchBuyers: jest.fn().mockResolvedValue([{ buyerId: 'b1', name: 'Test' }]),
  createBuyerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getBuyerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),

  createMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Test' }),
  getMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Test' }),
  getMeetings: jest.fn().mockResolvedValue([{ meetingId: 'm1', title: 'Test' }]),
  updateMeeting: jest.fn().mockResolvedValue({ meetingId: 'm1', title: 'Updated' }),
  deleteMeeting: jest.fn().mockResolvedValue(true),
  getUpcomingMeetings: jest.fn().mockResolvedValue([{ meetingId: 'm1', title: 'Test' }]),

  getCRMMetrics: jest.fn().mockResolvedValue({ totalLeads: 10, totalProperties: 5 }),

  searchLeads: jest.fn().mockResolvedValue([{ leadId: 'lead-1', name: 'Test' }]),
}));

jest.unstable_mockModule('./userCategoryService.js', () => ({
  canUserAccessTool: jest.fn().mockResolvedValue(true),
}));

const { invokeSkill, ALLOWED_TOOLS, TOOL_SCHEMAS } = await import('./skillInvoker.js');
const crm = await import('./crmDynamodbService.js');

const TENANT_ID = 'tenant-123';

describe('skillInvoker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exposes all expected tools', () => {
    const expected = [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'delete_lead', 'convert_lead',
      'create_lead_note', 'get_lead_notes',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'delete_contact',
      'update_contact_role', 'create_contact_note', 'get_contact_notes',
      'create_property', 'get_property', 'search_properties', 'update_property', 'delete_property',
      'get_property_documents', 'create_property_document', 'delete_property_document',
      'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant', 'delete_tenant',
      'create_tenant_note', 'get_tenant_notes',
      'create_owner', 'get_owner', 'get_owners', 'update_owner', 'delete_owner',
      'create_owner_note', 'get_owner_notes',
      'create_buyer', 'get_buyer', 'search_buyers', 'update_buyer', 'delete_buyer',
      'create_buyer_note', 'get_buyer_notes',
      'find_contact_by_phone', 'get_owner_by_phone', 'get_tenant_by_phone',
      'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting', 'delete_meeting',
      'get_crm_metrics',
    ];
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

  test('delete_lead calls deleteLead', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_lead', { leadId: 'lead-1' });
    expect(crm.deleteLead).toHaveBeenCalledWith(TENANT_ID, 'lead-1');
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

  test('find_contact_by_phone calls findContactByPhone', async () => {
    const result = await invokeSkill(TENANT_ID, 'find_contact_by_phone', { phone: '9876543210' });
    expect(crm.findContactByPhone).toHaveBeenCalledWith(TENANT_ID, '9876543210');
    expect(result.ok).toBe(true);
  });

  test('delete_property calls deleteProperty', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_property', { propertyId: 'p1' });
    expect(crm.deleteProperty).toHaveBeenCalledWith(TENANT_ID, 'p1');
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
    expect(crm.getCRMMetrics).toHaveBeenCalledWith(TENANT_ID);
    expect(result.ok).toBe(true);
  });

  test('delete_buyer calls deleteBuyer', async () => {
    const result = await invokeSkill(TENANT_ID, 'delete_buyer', { buyerId: 'b1' });
    expect(crm.deleteBuyer).toHaveBeenCalledWith(TENANT_ID, 'b1');
    expect(result.ok).toBe(true);
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
});
