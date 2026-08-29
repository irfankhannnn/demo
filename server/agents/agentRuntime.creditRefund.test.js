/**
 * Credit refund on a failed turn.
 *
 * `invokeAgent` deducts AGENT_ACTION_CREDITS *before* running the pipeline. Any
 * exception after that — Gemini timeout, DynamoDB throttle, malformed model
 * response — used to leave the customer charged for the "Sorry, I could not
 * process that" message. `refundCredits` had existed for exactly this case
 * since before the agent was written; nothing called it.
 *
 * Separate file from agentRuntime.pipeline.test.js because that one sets
 * AI_EMPLOYEE_BYPASS_PROVISIONING, which makes LOCAL_DEV_BYPASS true and skips
 * the credit path entirely. Refund behaviour can only be exercised with the
 * bypass OFF, and LOCAL_DEV_BYPASS is read once at module load.
 */

import { jest } from '@jest/globals';

const gateway = {
  classify: jest.fn(),
  plan: jest.fn(),
  planAndRun: jest.fn(),
  compose: jest.fn(),
};
const invokeSkill = jest.fn();
const getBalance = jest.fn();
const deductCredits = jest.fn();
const refundCredits = jest.fn();

jest.unstable_mockModule('./modelGateway/index.js', () => gateway);
jest.unstable_mockModule('../skillInvoker.js', () => ({
  invokeSkill,
  enrichContextWithLead: jest.fn().mockResolvedValue({}),
}));
jest.unstable_mockModule('../creditService.js', () => ({ getBalance, deductCredits, refundCredits }));
jest.unstable_mockModule('./agentAuditService.js', () => ({ logAgentAction: jest.fn() }));
jest.unstable_mockModule('../conversationStateService.js', () => ({
  getConversationState: jest.fn().mockResolvedValue(null),
  initializeConversationState: jest.fn(),
  recordMessageInConversation: jest.fn(),
  resetConversationStateIfStale: jest.fn(),
  updateLastDiscussedEntities: jest.fn(),
  extractEntitiesFromToolResults: jest.fn().mockReturnValue([]),
  extractListAndFocusFromToolResults: jest.fn().mockReturnValue({}),
}));
jest.unstable_mockModule('../agencyConfigService.js', () => ({
  // aiEmployeeEnabled must be true or invokeAgent bails before the credit path.
  getAgencyConfig: jest.fn().mockResolvedValue({ aiPersonality: 'friendly', aiEmployeeEnabled: true }),
}));
jest.unstable_mockModule('../whatsappConversationService.js', () => ({
  getConversationContext: jest.fn().mockResolvedValue([]),
}));
jest.unstable_mockModule('../aiEmployeeProvisioningService.js', () => ({
  getProvisioningByTenant: jest.fn().mockResolvedValue({ status: 'live' }),
}));
jest.unstable_mockModule('../whatsappAccessControl.js', () => ({
  canReceiveMessage: jest.fn().mockResolvedValue({ allowed: true }),
  canAutoReply: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.unstable_mockModule('../userCategoryService.js', () => ({
  resolveCategory: jest.fn().mockResolvedValue('lead'),
}));
jest.unstable_mockModule('../observability/cloudwatch.js', () => ({
  metrics: { agentActionInvoked: jest.fn(), agentActionFailed: jest.fn(), creditInsufficient: jest.fn() },
}));

process.env.AGENTS_ENABLED = 'true';
// The bypass must be OFF for credits to be charged at all.
delete process.env.AI_EMPLOYEE_BYPASS_PROVISIONING;
process.env.NODE_ENV = 'test';

const { invokeAgent } = await import('./agentRuntime.js');

const CREDITS = 15; // AGENT_ACTION_CREDITS default

beforeEach(() => {
  jest.clearAllMocks();
  getBalance.mockResolvedValue(1000);
  deductCredits.mockResolvedValue(true);
  refundCredits.mockResolvedValue(true);
  gateway.classify.mockResolvedValue({ domains: ['lead'], smalltalk: false });
  gateway.compose.mockResolvedValue('ok');
  invokeSkill.mockResolvedValue({ ok: true, data: {} });
});

describe('a turn that fails without touching the CRM', () => {
  it('refunds the credits it charged', async () => {
    gateway.classify.mockRejectedValue(new Error('Gemini 503'));

    const result = await invokeAgent('t1', 'whatsapp', 'leads dikhao', { principal: 'wa:91' });

    expect(deductCredits).toHaveBeenCalledWith('t1', CREDITS, 'agent_action', expect.any(Object));
    expect(refundCredits).toHaveBeenCalledWith('t1', CREDITS, 'agent_action', expect.objectContaining({
      reason: expect.stringContaining('Gemini 503'),
    }));
    // The user still gets the graceful message, not an error.
    expect(result.ok).toBe(true);
  });

  it('refunds when the planner throws', async () => {
    gateway.plan.mockRejectedValue(new Error('planner exploded'));

    await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(refundCredits).toHaveBeenCalledTimes(1);
  });

  it('refunds when the tool ran but FAILED — no write landed', async () => {
    // get_crm_summary rather than search_leads: only tools whose meta says
    // replyOwner 'llm' reach the composer at all, so a composer failure is
    // unreachable for a formatter-rendered tool.
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'get_crm_summary', input: { scope: 'all' } });
    invokeSkill.mockResolvedValue({ ok: false, error: 'dynamo throttled' });
    gateway.compose.mockRejectedValue(new Error('compose died'));

    await invokeAgent('t1', 'whatsapp', 'summary dikhao', { principal: 'wa:91' });

    expect(refundCredits).toHaveBeenCalledTimes(1);
  });
});

describe('a turn that failed AFTER a CRM write landed', () => {
  it('does NOT refund — the customer got what they asked for', async () => {
    // "create a lead for Rahul" creates the lead, then compose throws.
    // Refunding here would pay the customer for work that was done.
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'create_lead', input: { name: 'Rahul', leadType: 'buyer' } });
    invokeSkill.mockResolvedValue({ ok: true, data: { leadId: 'L1' } });
    gateway.compose.mockRejectedValue(new Error('compose died after the write'));

    await invokeAgent('t1', 'whatsapp', 'create lead Rahul', { principal: 'wa:91' });

    expect(invokeSkill).toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });
});

describe('a turn that succeeds', () => {
  it('never refunds', async () => {
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: {} });

    const result = await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(result.ok).toBe(true);
    expect(refundCredits).not.toHaveBeenCalled();
  });
});

describe('refund robustness', () => {
  it('a failing refund does not replace the user-facing error', async () => {
    // The customer already hit one failure; a second one from the refund path
    // must not surface instead of the graceful message.
    gateway.classify.mockRejectedValue(new Error('Gemini 503'));
    refundCredits.mockRejectedValue(new Error('ledger unavailable'));

    const result = await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(result.ok).toBe(true);
    expect(result.result.text).toMatch(/could not process/i);
  });

  it('does not refund a turn that was never charged (insufficient credits)', async () => {
    getBalance.mockResolvedValue(0);

    const result = await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(result).toMatchObject({ ok: false, error: 'insufficient_credits' });
    expect(deductCredits).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });
});
