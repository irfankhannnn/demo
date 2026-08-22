/**
 * Regression tests for Slice 2a of docs/proposals/agent-channel-architecture
 * (Phase 2): conversationStateService.js re-keyed from a raw phone to a
 * `principal` (e.g. `wa:<phone>`), with a dual-read fallback to the legacy
 * phone-only key so an in-flight conversation isn't dropped at deploy time.
 *
 * Mocks @aws-sdk/lib-dynamodb directly (same pattern as agencyConfigService.test.js
 * from Phase 1) so no real DynamoDB calls happen.
 */
import { jest } from '@jest/globals';

const mockSend = jest.fn();

class MockGetCommand {
  constructor(input) { this.input = input; this.__type = 'Get'; }
}
class MockPutCommand {
  constructor(input) { this.input = input; this.__type = 'Put'; }
}
class MockUpdateCommand {
  constructor(input) { this.input = input; this.__type = 'Update'; }
}
class MockDeleteCommand {
  constructor(input) { this.input = input; this.__type = 'Delete'; }
}

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: MockGetCommand,
  PutCommand: MockPutCommand,
  UpdateCommand: MockUpdateCommand,
  DeleteCommand: MockDeleteCommand,
}));

process.env.CRM_DYNAMODB_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME || 'test-crm-table';

const {
  getConversationState,
  initializeConversationState,
  updateConversationState,
  deleteConversationState,
} = await import('./conversationStateService.js');

const TENANT_ID = 'tenant-1';
const PHONE = '919876543210';
const PRINCIPAL = `wa:${PHONE}`;

describe('conversationStateService — principal-keyed with legacy dual-read', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test('getConversationState: hit on the new principal key issues exactly one GetCommand', async () => {
    mockSend.mockResolvedValueOnce({ Item: { principal: PRINCIPAL, status: 'active' } });

    const state = await getConversationState(TENANT_ID, PRINCIPAL);

    expect(state).toEqual({ principal: PRINCIPAL, status: 'active' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Key.PK).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PRINCIPAL}`);
  });

  test('getConversationState: miss on principal key falls back to the legacy phone-only key', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined }) // new key miss
      .mockResolvedValueOnce({ Item: { contactPhone: PHONE, status: 'active' } }); // legacy key hit

    const state = await getConversationState(TENANT_ID, PRINCIPAL);

    expect(state).toEqual({ contactPhone: PHONE, status: 'active' });
    expect(mockSend).toHaveBeenCalledTimes(2);
    const firstKey = mockSend.mock.calls[0][0].input.Key.PK;
    const secondKey = mockSend.mock.calls[1][0].input.Key.PK;
    expect(firstKey).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PRINCIPAL}`);
    // Legacy key has no `wa:` prefix -- just the raw phone, matching what
    // buildPk(tenantId, phone) produced before this migration.
    expect(secondKey).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PHONE}`);
  });

  test('getConversationState: miss on both keys returns null', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: undefined });

    const state = await getConversationState(TENANT_ID, PRINCIPAL);

    expect(state).toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test('getConversationState: a non-WhatsApp principal (future channel) does not attempt the legacy phone fallback', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const state = await getConversationState(TENANT_ID, 'web:user-123');

    expect(state).toBeNull();
    // Only the one lookup -- no wa:-prefix means no legacy-phone fallback attempt.
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('initializeConversationState stores the principal (not a raw phone) as the item field', async () => {
    mockSend.mockResolvedValueOnce({});

    const state = await initializeConversationState(TENANT_ID, PRINCIPAL, { source: 'whatsapp' });

    expect(state.principal).toBe(PRINCIPAL);
    expect(state.PK).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PRINCIPAL}`);
    const command = mockSend.mock.calls[0][0];
    expect(command.__type).toBe('Put');
    expect(command.input.Item.principal).toBe(PRINCIPAL);
  });

  test('updateConversationState keys on the principal, not a raw phone', async () => {
    mockSend.mockResolvedValueOnce({ Attributes: { principal: PRINCIPAL, intent: 'inquiry' } });

    await updateConversationState(TENANT_ID, PRINCIPAL, { intent: 'inquiry' });

    const command = mockSend.mock.calls[0][0];
    expect(command.__type).toBe('Update');
    expect(command.input.Key.PK).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PRINCIPAL}`);
  });

  test('deleteConversationState keys on whatever string is passed -- callers can target the legacy key explicitly', async () => {
    mockSend.mockResolvedValueOnce({});
    await deleteConversationState(TENANT_ID, PHONE); // raw phone, e.g. from the ops-script legacy-key cleanup pass

    const command = mockSend.mock.calls[0][0];
    expect(command.__type).toBe('Delete');
    expect(command.input.Key.PK).toBe(`TENANT#${TENANT_ID}#WHATSAPP#STATE#${PHONE}`);
  });
});
