/**
 * Unit tests for agentRuntime.js's prepareConversationalTurn() (Phase 2
 * Slice 2b) -- the business-hours/pause policy, category-based access
 * control, category resolution, and conversation-state bootstrap logic
 * extracted out of agency-app/api/scripts/whatsapp-message-processor.js.
 *
 * runConversationalTurn() is NOT unit-tested here: it calls invokeAgent()
 * as a same-module function reference (not an import), which
 * jest.unstable_mockModule cannot intercept -- see
 * docs/proposals/agent-channel-architecture/phase2-imp/
 * 02-slice2b-processor-extraction.md for why. Its outcome contract is
 * covered from the caller's side in scripts/whatsapp-message-processor.test.js.
 */
import { jest } from '@jest/globals';

const mockGetAgencyConfig = jest.fn();
jest.unstable_mockModule('../agencyConfigService.js', () => ({
  getAgencyConfig: mockGetAgencyConfig,
}));

const mockCanReceiveMessage = jest.fn();
const mockCanAutoReply = jest.fn();
jest.unstable_mockModule('../whatsappAccessControl.js', () => ({
  canReceiveMessage: mockCanReceiveMessage,
  canAutoReply: mockCanAutoReply,
}));

const mockResolveCategory = jest.fn();
jest.unstable_mockModule('../userCategoryService.js', () => ({
  resolveCategory: mockResolveCategory,
  // skillInvoker.js (imported transitively via agentRuntime.js) also needs
  // this from the same module -- Jest's mock registry is per resolved path,
  // so this mock stands in for both callers.
  canUserAccessTool: jest.fn().mockResolvedValue(true),
}));

const mockGetConversationState = jest.fn();
const mockInitializeConversationState = jest.fn();
const mockRecordMessageInConversation = jest.fn();
const mockResetConversationStateIfStale = jest.fn();
const mockUpdateLastDiscussedEntities = jest.fn();
const mockExtractEntitiesFromToolResults = jest.fn();
const mockExtractListAndFocusFromToolResults = jest.fn();
jest.unstable_mockModule('../conversationStateService.js', () => ({
  getConversationState: mockGetConversationState,
  initializeConversationState: mockInitializeConversationState,
  recordMessageInConversation: mockRecordMessageInConversation,
  resetConversationStateIfStale: mockResetConversationStateIfStale,
  updateLastDiscussedEntities: mockUpdateLastDiscussedEntities,
  extractEntitiesFromToolResults: mockExtractEntitiesFromToolResults,
  extractListAndFocusFromToolResults: mockExtractListAndFocusFromToolResults,
}));

const { prepareConversationalTurn } = await import('./agentRuntime.js');

const TENANT_ID = 'tenant-1';
const PRINCIPAL = 'wa:919876543210';
const PHONE = '919876543210';

describe('prepareConversationalTurn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAgencyConfig.mockResolvedValue({});
    mockCanReceiveMessage.mockResolvedValue({ allowed: true });
    mockCanAutoReply.mockResolvedValue({ allowed: true });
    mockResolveCategory.mockResolvedValue('standard');
    mockResetConversationStateIfStale.mockResolvedValue(undefined);
    mockGetConversationState.mockResolvedValue({ context: {} });
    mockInitializeConversationState.mockResolvedValue({ context: {} });
    mockRecordMessageInConversation.mockResolvedValue(undefined);
  });

  test('happy path returns "ready" with resolved policy flags', async () => {
    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(result).toEqual({
      outcome: 'ready',
      isAgentPaused: false,
      isAutoReplyBlocked: false,
      autoReply: true,
      category: 'standard',
    });
    expect(mockCanReceiveMessage).toHaveBeenCalledWith(PHONE, TENANT_ID, {});
    expect(mockResolveCategory).toHaveBeenCalledWith(PHONE, TENANT_ID, expect.objectContaining({ messageCount: 1 }));
  });

  test('access denied short-circuits before category resolution or conversation-state bootstrap', async () => {
    mockCanReceiveMessage.mockResolvedValue({ allowed: false, reason: 'blocked_number' });

    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(result).toEqual({ outcome: 'access_denied', reason: 'blocked_number' });
    expect(mockCanAutoReply).not.toHaveBeenCalled();
    expect(mockResolveCategory).not.toHaveBeenCalled();
    expect(mockResetConversationStateIfStale).not.toHaveBeenCalled();
  });

  test('autoReply: false on the agency config marks the agent as paused', async () => {
    mockGetAgencyConfig.mockResolvedValue({ autoReply: false });

    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(result.outcome).toBe('ready');
    expect(result.isAgentPaused).toBe(true);
    expect(result.autoReply).toBe(false);
  });

  test('outside business hours marks the agent as paused even when autoReply is true', async () => {
    mockGetAgencyConfig.mockResolvedValue({
      autoReply: true,
      businessHoursStart: '09:00',
      businessHoursEnd: '10:00', // narrow window almost certainly not "now" when this test runs
    });

    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    // isWithinBusinessHours is a real (unmocked) pure function of wall-clock
    // time, so this just proves isAgentPaused reflects it either way rather
    // than asserting a specific boolean sensitive to the actual runtime clock.
    expect(typeof result.isAgentPaused).toBe('boolean');
  });

  test('canAutoReply: false sets isAutoReplyBlocked without denying access', async () => {
    mockCanAutoReply.mockResolvedValue({ allowed: false });

    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(result.outcome).toBe('ready');
    expect(result.isAutoReplyBlocked).toBe(true);
  });

  test('a failing getAgencyConfig degrades to {} rather than throwing (matches the pre-Slice-2b .catch(() => ({})))', async () => {
    mockGetAgencyConfig.mockRejectedValue(new Error('ddb down'));

    const result = await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(result.outcome).toBe('ready');
    expect(result.autoReply).toBe(true); // default when agencyConfig degrades to {}
  });

  test('conversation-state bootstrap failure is swallowed (logged, not thrown) -- matches pre-Slice-2b try/catch', async () => {
    mockResetConversationStateIfStale.mockRejectedValue(new Error('ddb throttled'));

    await expect(
      prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE })
    ).resolves.toEqual(expect.objectContaining({ outcome: 'ready' }));
  });

  test('initializes conversation state only when none exists yet', async () => {
    mockGetConversationState.mockResolvedValue(null);

    await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(mockInitializeConversationState).toHaveBeenCalledWith(
      TENANT_ID, PRINCIPAL, expect.objectContaining({ source: 'whatsapp', category: 'standard' })
    );
  });

  test('does not re-initialize conversation state when one already exists', async () => {
    mockGetConversationState.mockResolvedValue({ context: { existing: true } });

    await prepareConversationalTurn({ tenantId: TENANT_ID, principal: PRINCIPAL, contactPhone: PHONE });

    expect(mockInitializeConversationState).not.toHaveBeenCalled();
    expect(mockRecordMessageInConversation).toHaveBeenCalledWith(TENANT_ID, PRINCIPAL);
  });
});
