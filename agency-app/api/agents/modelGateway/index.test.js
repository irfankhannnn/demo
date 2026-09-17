/**
 * Unit tests for the model gateway (Phase 2 Slice 2c).
 *
 * The gateway is deliberately a thin, pure delegation to the existing
 * domainRouter.js/llm/planTurn.js/llm/composeReply.js -- these tests assert
 * exactly that: classify()/plan()/compose() forward their arguments
 * unchanged and return whatever the underlying function returns, with no
 * added logic. See agency-app/api/agents/modelGateway/index.js for why.
 */
import { jest } from '@jest/globals';

const mockRouteDomains = jest.fn();
jest.unstable_mockModule('../domainRouter.js', () => ({
  routeDomains: mockRouteDomains,
}));

const mockPlanTurn = jest.fn();
jest.unstable_mockModule('../llm/planTurn.js', () => ({
  planTurn: mockPlanTurn,
}));

const mockComposeReply = jest.fn();
jest.unstable_mockModule('../llm/composeReply.js', () => ({
  composeReply: mockComposeReply,
}));

const { classify, plan, compose } = await import('./index.js');

describe('modelGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('classify() forwards to routeDomains() unchanged, args and return value', async () => {
    const opts = { conversationState: { foo: 'bar' }, onApiCall: jest.fn() };
    mockRouteDomains.mockResolvedValue({ domains: ['leads'], smalltalk: false, source: 'rules' });

    const result = await classify('list hot leads', opts);

    expect(mockRouteDomains).toHaveBeenCalledWith('list hot leads', opts);
    expect(result).toEqual({ domains: ['leads'], smalltalk: false, source: 'rules' });
  });

  test('plan() forwards to planTurn() unchanged, args and return value', async () => {
    const opts = { tenantId: 't1', personality: 'friendly', toolNames: ['search_leads'], onApiCall: jest.fn() };
    mockPlanTurn.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: { temperature: 'hot' } });

    const result = await plan('hot leads dikhao', opts);

    expect(mockPlanTurn).toHaveBeenCalledWith('hot leads dikhao', opts);
    expect(result).toEqual({ kind: 'tool', toolName: 'search_leads', input: { temperature: 'hot' } });
  });

  test('compose() forwards to composeReply() unchanged, args and return value', async () => {
    const params = { userMessage: 'hi', tenantId: 't1', toolName: 'get_pipeline_summary', onApiCall: jest.fn() };
    mockComposeReply.mockResolvedValue('Here is your pipeline summary...');

    const result = await compose(params);

    expect(mockComposeReply).toHaveBeenCalledWith(params);
    expect(result).toBe('Here is your pipeline summary...');
  });

  test('compose() forwards a null result unchanged (composeReply returns null on invalid output)', async () => {
    mockComposeReply.mockResolvedValue(null);
    const result = await compose({ userMessage: 'hi' });
    expect(result).toBeNull();
  });
});
