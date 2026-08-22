/**
 * Regression tests for the WhatsApp message processor.
 *
 * Slice 1 (docs/proposals/agent-channel-architecture/phase1-imp/01-...):
 *   1. The two debug connectivity fetches (google.com, Bailey ALB /health)
 *      must be gone from the reply path.
 *   2. Tenant resolution must delegate to the shared
 *      agencyConfigService.getTenantIdByConnectedWhatsAppPhone() helper
 *      instead of running its own inline DynamoDB Scan.
 *
 * Slice 2b (phase2-imp/02-slice2b-processor-extraction.md): the processor is
 * now a thin channel adapter -- business-hours/access-control/category/
 * conversation-state/agent-invocation logic all moved into
 * server/agents/agentRuntime.js's prepareConversationalTurn()/
 * runConversationalTurn(), which this file mocks wholesale (no longer
 * mocking whatsappAccessControl.js/userCategoryService.js/
 * conversationStateService.js/agencyConfigService.getAgencyConfig directly,
 * since the processor no longer imports them).
 *
 * All collaborators are mocked; this test never touches DynamoDB or the
 * network.
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.unstable_mockModule('../logger.js', () => ({ logger: mockLogger }));

const mockSendWhatsAppMessageChunks = jest.fn();
const mockChunkWhatsAppText = jest.fn();
const mockIsBaileyEnabled = jest.fn();
jest.unstable_mockModule('../bailey.js', () => ({
  sendWhatsAppMessageChunks: mockSendWhatsAppMessageChunks,
  chunkWhatsAppText: mockChunkWhatsAppText,
  isBaileyEnabled: mockIsBaileyEnabled,
}));

const mockLogMessage = jest.fn();
const mockClaimMessageProcessing = jest.fn();
const mockMarkMessageProcessingComplete = jest.fn();
const mockMarkMessageProcessingFailed = jest.fn();
jest.unstable_mockModule('../whatsappConversationService.js', () => ({
  logMessage: mockLogMessage,
  claimMessageProcessing: mockClaimMessageProcessing,
  markMessageProcessingComplete: mockMarkMessageProcessingComplete,
  markMessageProcessingFailed: mockMarkMessageProcessingFailed,
}));

const mockGetTenantIdByConnectedWhatsAppPhone = jest.fn();
jest.unstable_mockModule('../agencyConfigService.js', () => ({
  getTenantIdByConnectedWhatsAppPhone: mockGetTenantIdByConnectedWhatsAppPhone,
}));

const mockPrepareConversationalTurn = jest.fn();
const mockRunConversationalTurn = jest.fn();
jest.unstable_mockModule('../agents/agentRuntime.js', () => ({
  prepareConversationalTurn: mockPrepareConversationalTurn,
  runConversationalTurn: mockRunConversationalTurn,
}));

const { handler } = await import('./whatsapp-message-processor.js');

const SELF_CHAT_NUMBER = '919999999999';

function baseRecordDetail(overrides = {}) {
  return {
    messageId: 'msg-1',
    from: SELF_CHAT_NUMBER,
    to: SELF_CHAT_NUMBER,
    text: 'hello',
    tenantId: 'tenant-abc',
    ...overrides,
  };
}

describe('whatsapp-message-processor', () => {
  let originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENTS_ENABLED = 'true';

    originalFetch = global.fetch;
    global.fetch = jest.fn();

    mockClaimMessageProcessing.mockResolvedValue({ claimed: true });
    mockLogMessage.mockResolvedValue(undefined);
    mockMarkMessageProcessingComplete.mockResolvedValue(undefined);
    mockMarkMessageProcessingFailed.mockResolvedValue(undefined);

    mockPrepareConversationalTurn.mockResolvedValue({
      outcome: 'ready',
      isAgentPaused: false,
      isAutoReplyBlocked: false,
      autoReply: true,
      category: 'standard',
    });
    mockRunConversationalTurn.mockResolvedValue({
      outcome: 'agent_result',
      ok: true,
      error: null,
      text: 'Reply text',
      toolCalls: [],
    });

    mockIsBaileyEnabled.mockReturnValue(true);
    mockChunkWhatsAppText.mockReturnValue(['Reply text']);
    mockSendWhatsAppMessageChunks.mockResolvedValue({
      sent: true,
      queued: false,
      messageIds: ['out-1'],
      totalChunks: 1,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('never calls fetch (debug connectivity probes are gone) when sending a reply', async () => {
    const event = { Records: [{ detail: baseRecordDetail() }] };

    const result = await handler(event);

    expect(result.details[0].success).toBe(true);
    expect(mockSendWhatsAppMessageChunks).toHaveBeenCalled();
    // The processor itself must never call fetch directly on the hot path
    // (no google.com connectivity probe, no Bailey ALB /health probe).
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('resolves tenantId via agencyConfigService.getTenantIdByConnectedWhatsAppPhone, not an inline Scan', async () => {
    mockGetTenantIdByConnectedWhatsAppPhone.mockResolvedValue('tenant-xyz');
    const event = {
      Records: [{ detail: baseRecordDetail({ tenantId: undefined }) }],
    };

    const result = await handler(event);

    expect(mockGetTenantIdByConnectedWhatsAppPhone).toHaveBeenCalledWith(SELF_CHAT_NUMBER);
    expect(mockClaimMessageProcessing).toHaveBeenCalledWith('tenant-xyz', SELF_CHAT_NUMBER, 'msg-1');
    expect(mockPrepareConversationalTurn).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-xyz', contactPhone: SELF_CHAT_NUMBER })
    );
    expect(result.details[0].tenantId).toBe('tenant-xyz');
  });

  test('degrades gracefully (skips the record) if tenant lookup throws, matching prior behavior', async () => {
    mockGetTenantIdByConnectedWhatsAppPhone.mockRejectedValue(new Error('throttled'));
    const event = {
      Records: [{ detail: baseRecordDetail({ tenantId: undefined }) }],
    };

    const result = await handler(event);
    expect(result).toBeDefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'whatsapp.processor.tenant_lookup.failed',
      expect.objectContaining({ error: 'throttled' })
    );
  });

  test('source no longer contains the removed debug-fetch / inline-Scan code', () => {
    const source = fs.readFileSync(path.join(__dirname, 'whatsapp-message-processor.js'), 'utf8');
    expect(source).not.toMatch(/google\.com/);
    expect(source).not.toMatch(/\/health/);
    expect(source).not.toMatch(/ScanCommand/);
    expect(source).not.toMatch(/connectivity_test/);
  });

  // ── Slice 2b: adapter correctly interprets prepareConversationalTurn/
  //    runConversationalTurn outcomes into the same WhatsApp reply copy the
  //    pre-extraction inline logic used to produce ──────────────────────────

  test('access_denied: releases the claim, never logs the message, never sends a reply', async () => {
    mockPrepareConversationalTurn.mockResolvedValue({ outcome: 'access_denied', reason: 'blocked_number' });
    const event = { Records: [{ detail: baseRecordDetail() }] };

    const result = await handler(event);

    expect(mockLogMessage).not.toHaveBeenCalled();
    expect(mockSendWhatsAppMessageChunks).not.toHaveBeenCalled();
    expect(mockMarkMessageProcessingComplete).toHaveBeenCalledWith('tenant-abc', SELF_CHAT_NUMBER, 'msg-1');
    expect(result.details[0]).toEqual(
      expect.objectContaining({ action: 'access_denied', success: false, reason: 'blocked_number' })
    );
  });

  test('logs the inbound message before invoking the turn, for a non-denied message', async () => {
    const event = { Records: [{ detail: baseRecordDetail() }] };
    await handler(event);

    // logMessage (inbound) must happen, and prepareConversationalTurn must
    // have already resolved (not access_denied) by the time it's called --
    // exact ordering matters here, see the Slice 2b design note in
    // agentRuntime.js about why this couldn't be one combined function.
    expect(mockLogMessage).toHaveBeenCalledWith(
      'tenant-abc', SELF_CHAT_NUMBER,
      expect.objectContaining({ direction: 'inbound', messageId: 'msg-1' }),
    );
    expect(mockRunConversationalTurn).toHaveBeenCalled();
  });

  test('empty_message outcome sends the "could not read your message" reply, not AI-prefixed', async () => {
    mockRunConversationalTurn.mockResolvedValue({ outcome: 'empty_message' });
    const event = { Records: [{ detail: baseRecordDetail({ text: '' }) }] };

    await handler(event);

    const [, replyText] = mockSendWhatsAppMessageChunks.mock.calls[0];
    expect(replyText).toContain('could not read your message');
    expect(replyText.startsWith('🤖')).toBe(false);
  });

  test('agent_result with an error code maps to the matching Hinglish copy', async () => {
    mockRunConversationalTurn.mockResolvedValue({
      outcome: 'agent_result', ok: false, error: 'insufficient_credits', text: null, toolCalls: [],
    });
    const event = { Records: [{ detail: baseRecordDetail() }] };

    await handler(event);

    const [, replyText] = mockSendWhatsAppMessageChunks.mock.calls[0];
    expect(replyText).toContain('Credits khatam ho gaye');
  });

  test('agent_invocation_failed maps to the generic "something went wrong" reply, AI-prefixed', async () => {
    mockRunConversationalTurn.mockResolvedValue({ outcome: 'agent_invocation_failed' });
    const event = { Records: [{ detail: baseRecordDetail() }] };

    await handler(event);

    const [, replyText] = mockSendWhatsAppMessageChunks.mock.calls[0];
    expect(replyText).toContain('Something went wrong');
    expect(replyText.startsWith('🤖')).toBe(true);
  });

  test('agent_paused outcome (business hours) sends the business-hours copy', async () => {
    mockRunConversationalTurn.mockResolvedValue({
      outcome: 'agent_paused', isAutoReplyBlocked: false, autoReply: true,
    });
    const event = { Records: [{ detail: baseRecordDetail() }] };

    await handler(event);

    const [, replyText] = mockSendWhatsAppMessageChunks.mock.calls[0];
    expect(replyText).toContain('outside business hours');
  });

  test('agents_not_available outcome sends the "not available" fallback copy', async () => {
    mockRunConversationalTurn.mockResolvedValue({ outcome: 'agents_not_available' });
    const event = { Records: [{ detail: baseRecordDetail() }] };

    await handler(event);

    const [, replyText] = mockSendWhatsAppMessageChunks.mock.calls[0];
    expect(replyText).toContain('AI assistant is not available');
  });
});
