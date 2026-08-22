/**
 * Regression test for Slice 2 of docs/proposals/agent-channel-architecture:
 * getTenantIdByConnectedWhatsAppPhone must Query the connectedWhatsAppPhone-index
 * GSI, not Scan the whole AgencyConfig table.
 */
import { jest } from '@jest/globals';

const mockSend = jest.fn();

class MockQueryCommand {
  constructor(input) {
    this.input = input;
    this.__type = 'Query';
  }
}
class MockScanCommand {
  constructor(input) {
    this.input = input;
    this.__type = 'Scan';
  }
}

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: class {},
  PutCommand: class {},
  UpdateCommand: class {},
  ScanCommand: MockScanCommand,
  QueryCommand: MockQueryCommand,
}));

process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME || 'test-agency-config-table';

const { getTenantIdByConnectedWhatsAppPhone } = await import('./agencyConfigService.js');

describe('agencyConfigService.getTenantIdByConnectedWhatsAppPhone', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test('queries the connectedWhatsAppPhone-index GSI, not a Scan', async () => {
    mockSend.mockResolvedValue({ Items: [{ TenantId: 'tenant-abc' }] });

    const tenantId = await getTenantIdByConnectedWhatsAppPhone('+91 98765 43210');

    expect(tenantId).toBe('tenant-abc');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(MockQueryCommand);
    expect(command.input.IndexName).toBe('connectedWhatsAppPhone-index');
    expect(command.input.KeyConditionExpression).toBe('connectedWhatsAppPhone = :phone');
    expect(command.input.ExpressionAttributeValues[':phone']).toBe('919876543210');
    // The point of the fix: this must never construct a ScanCommand.
    expect(command).not.toBeInstanceOf(MockScanCommand);
  });

  test('returns null for an empty/invalid phone without calling DynamoDB', async () => {
    const tenantId = await getTenantIdByConnectedWhatsAppPhone('');
    expect(tenantId).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('returns null when no item matches', async () => {
    mockSend.mockResolvedValue({ Items: [] });
    const tenantId = await getTenantIdByConnectedWhatsAppPhone('919999999999');
    expect(tenantId).toBeNull();
  });
});
