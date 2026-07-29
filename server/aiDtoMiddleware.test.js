/**
 * AI DTO Middleware Tests — Verify transformation of tool results into AI DTOs.
 *
 * Mocks crmDynamodbService so the middleware can be tested without DynamoDB.
 */

process.env.CRM_DYNAMODB_TABLE_NAME = 'test-crm-table';
process.env.USE_AI_DTO_FOR_LEADS = 'true';
process.env.USE_AI_DTO_FOR_OWNERS = 'true';
process.env.USE_AI_DTO_FOR_TENANTS = 'true';
process.env.USE_AI_DTO_FOR_MEETINGS = 'true';

import { jest, describe, test, expect } from '@jest/globals';

jest.unstable_mockModule('./crmDynamodbService.js', () => ({
  // Lead functions used by leadService
  getLead: jest.fn().mockResolvedValue({
    leadId: 'lead-001',
    name: 'Raj Kumar',
    phone: '9876543210',
    status: 'new',
    leadType: 'buyer',
  }),
  searchLeads: jest.fn().mockResolvedValue([]),
  getLeads: jest.fn().mockResolvedValue([]),
  createLead: jest.fn().mockResolvedValue({
    leadId: 'lead-001',
    name: 'Raj Kumar',
    phone: '9876543210',
    status: 'new',
    leadType: 'buyer',
  }),
  updateLead: jest.fn().mockResolvedValue({
    leadId: 'lead-001',
    name: 'Raj Kumar',
    phone: '9876543210',
    status: 'contacted',
    leadType: 'buyer',
  }),
  deleteLead: jest.fn().mockResolvedValue(true),
  convertLead: jest.fn().mockResolvedValue({
    entity: { ownerId: 'owner-001', name: 'Raj Kumar' },
    entityType: 'owner',
    conversionSnapshotId: 'snap-001',
    leadId: 'lead-001',
    role: 'owner',
    lead: null,
  }),
  createLeadNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getLeadNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),
  updateLeadNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'updated' }),
  deleteLeadNote: jest.fn().mockResolvedValue(true),
  unwrapLeadsList: (result) => (Array.isArray(result) ? result : (result?.leads ?? [])),
  hasLeadConversionTarget: () => false,
  isLeadConverted: () => false,
  isLeadConversionInProgress: () => false,

  // Owner functions used by ownerService
  getOwner: jest.fn().mockResolvedValue({
    ownerId: 'owner-001',
    name: 'Priya Shah',
    phone: '9876543211',
    status: 'active',
  }),
  getOwners: jest.fn().mockResolvedValue([]),
  searchOwners: jest.fn().mockResolvedValue([]),
  createOwner: jest.fn().mockResolvedValue({
    ownerId: 'owner-001',
    name: 'Priya Shah',
    phone: '9876543211',
    status: 'active',
  }),
  updateOwner: jest.fn().mockResolvedValue({
    ownerId: 'owner-001',
    name: 'Priya Shah',
    phone: '9876543211',
    status: 'active',
  }),
  deleteOwner: jest.fn().mockResolvedValue(true),
  getOwnerByPhone: jest.fn().mockResolvedValue(null),
  createOwnerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getOwnerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),
  updateOwnerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'updated' }),
  deleteOwnerNote: jest.fn().mockResolvedValue(true),

  // Customer functions used by tenantService
  getCustomer: jest.fn().mockResolvedValue({
    customerId: 'cust-001',
    name: 'Amit Patel',
    phone: '9876543212',
    status: 'active',
  }),
  getCustomers: jest.fn().mockResolvedValue([]),
  searchCustomers: jest.fn().mockResolvedValue([]),
  createCustomer: jest.fn().mockResolvedValue({
    customerId: 'cust-001',
    name: 'Amit Patel',
    phone: '9876543212',
    status: 'active',
  }),
  updateCustomer: jest.fn().mockResolvedValue({
    customerId: 'cust-001',
    name: 'Amit Patel',
    phone: '9876543212',
    status: 'active',
  }),
  deleteCustomer: jest.fn().mockResolvedValue(true),
  getCustomerByPhone: jest.fn().mockResolvedValue(null),
  createCustomerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'note' }),
  getCustomerNotes: jest.fn().mockResolvedValue([{ noteId: 'n1', content: 'note' }]),
  updateCustomerNote: jest.fn().mockResolvedValue({ noteId: 'n1', content: 'updated' }),
  deleteCustomerNote: jest.fn().mockResolvedValue(true),

  // Meeting functions used directly by skillInvoker
  createMeeting: jest.fn().mockResolvedValue({
    meetingId: 'meet-001',
    title: 'Site visit',
    scheduledDate: '2026-02-01T10:00:00Z',
  }),
  getMeeting: jest.fn().mockResolvedValue({
    meetingId: 'meet-001',
    title: 'Site visit',
    scheduledDate: '2026-02-01T10:00:00Z',
  }),
  getMeetings: jest.fn().mockResolvedValue([]),
  getUpcomingMeetings: jest.fn().mockResolvedValue([]),
  updateMeeting: jest.fn().mockResolvedValue({
    meetingId: 'meet-001',
    title: 'Site visit updated',
    scheduledDate: '2026-02-01T10:00:00Z',
  }),
  deleteMeeting: jest.fn().mockResolvedValue(true),

  CRM_TABLE_NAME: 'test-crm-table',
  docClient: {},
  default: {},
}));

jest.unstable_mockModule('./logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { transformWithAiDto } = await import('./aiDtoMiddleware.js');

describe('aiDtoMiddleware', () => {
  test('passes through results when no feature flag matches', async () => {
    const result = { foo: 'bar' };
    const transformed = await transformWithAiDto('unknown_tool', result, { tenantId: 't1' });

    expect(transformed).toEqual(result);
  });

  test('create_lead returns AI DTO confirmation', async () => {
    const result = {
      leadId: 'lead-001',
      name: 'Raj Kumar',
      phone: '9876543210',
      status: 'new',
      leadType: 'buyer',
    };
    const transformed = await transformWithAiDto('create_lead', result, { tenantId: 't1', input: {} });

    expect(transformed.metadata.action).toBe('created');
    expect(transformed.data.leadId).toBe('lead-001');
  });

  test('get_lead returns not-found DTO when result is null', async () => {
    const transformed = await transformWithAiDto('get_lead', null, { tenantId: 't1', input: { leadId: 'lead-999' } });

    expect(transformed.metadata.error).toBe('lead_not_found');
    expect(transformed.data.leadId).toBe('lead-999');
  });

  test('delete_lead uses input ID for deleted DTO', async () => {
    const transformed = await transformWithAiDto('delete_lead', true, { tenantId: 't1', input: { leadId: 'lead-001' } });

    expect(transformed.metadata.action).toBe('deleted');
    expect(transformed.data.leadId).toBe('lead-001');
  });

  test('convert_lead returns converted DTO', async () => {
    const result = {
      lead: { leadId: 'lead-001', name: 'Raj Kumar', status: 'converted' },
      entity: { ownerId: 'owner-001' },
      entityType: 'owner',
    };
    const transformed = await transformWithAiDto('convert_lead', result, { tenantId: 't1', input: { leadId: 'lead-001' } });

    expect(transformed.metadata.action).toBe('converted');
    expect(transformed.data.leadId).toBe('lead-001');
    expect(transformed.data.convertedTo).toBe('owner');
  });

  test('delete_meeting uses input ID for deleted DTO', async () => {
    const transformed = await transformWithAiDto('delete_meeting', true, { tenantId: 't1', input: { meetingId: 'meet-001' } });

    expect(transformed.metadata.action).toBe('deleted');
    expect(transformed.data.meetingId).toBe('meet-001');
  });

  test('create_lead_note fetches lead and returns DTO', async () => {
    const result = { noteId: 'n1', content: 'Interested', createdBy: 'agent-001' };
    const transformed = await transformWithAiDto('create_lead_note', result, {
      tenantId: 't1',
      input: { leadId: 'lead-001' },
    });

    expect(transformed.metadata.action).toBe('note_added');
    expect(transformed.data.leadId).toBe('lead-001');
    expect(transformed.data.content).toBe('Interested');
  });

  test('get_owner_by_phone returns not-found DTO when null', async () => {
    const transformed = await transformWithAiDto('get_owner_by_phone', null, {
      tenantId: 't1',
      input: { phone: '9999999999' },
    });

    expect(transformed.data.found).toBe(false);
    expect(transformed.data.phone).toBe('9999999999');
  });
});
