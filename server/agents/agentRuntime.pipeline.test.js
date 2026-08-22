/**
 * End-to-end drive of the conversational pipeline with every collaborator
 * mocked — classify → plan → execute → compose.
 *
 * WHY THIS EXISTS: the permission-identity work moved a `userId` onto the
 * `invokeSkill` calls inside `runConversationalPipeline`, but derived it in
 * `invokeAgent` — a *different function*. Every WhatsApp tool call would have
 * thrown `ReferenceError: permissionIdentity is not defined`, and the full
 * 614-test suite stayed green, because nothing drove the tool-execution branch
 * with the module actually loaded.
 *
 * A suite that never executes a code path cannot regress it. These tests run
 * the real pipeline body, so a scope error, a renamed field or a dropped
 * argument fails here instead of in production.
 */

import { jest } from '@jest/globals';

const gateway = {
  classify: jest.fn(),
  plan: jest.fn(),
  planAndRun: jest.fn(),
  compose: jest.fn(),
};
const invokeSkill = jest.fn();
const logAgentAction = jest.fn();
const getConversationState = jest.fn();
const updateLastDiscussedEntities = jest.fn();

jest.unstable_mockModule('./modelGateway/index.js', () => gateway);
jest.unstable_mockModule('../skillInvoker.js', () => ({
  invokeSkill,
  enrichContextWithLead: jest.fn().mockResolvedValue({}),
}));
jest.unstable_mockModule('./agentAuditService.js', () => ({ logAgentAction }));
jest.unstable_mockModule('../conversationStateService.js', () => ({
  getConversationState,
  initializeConversationState: jest.fn(),
  recordMessageInConversation: jest.fn(),
  resetConversationStateIfStale: jest.fn(),
  updateLastDiscussedEntities,
  extractEntitiesFromToolResults: jest.fn().mockReturnValue([]),
  extractListAndFocusFromToolResults: jest.fn().mockReturnValue({}),
}));
jest.unstable_mockModule('../agencyConfigService.js', () => ({
  getAgencyConfig: jest.fn().mockResolvedValue({ aiPersonality: 'friendly' }),
}));
jest.unstable_mockModule('../whatsappConversationService.js', () => ({
  getConversationContext: jest.fn().mockResolvedValue([]),
}));
jest.unstable_mockModule('../creditService.js', () => ({
  getBalance: jest.fn().mockResolvedValue(1000),
  deductCredits: jest.fn().mockResolvedValue(true),
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
  metrics: {
    agentActionInvoked: jest.fn(),
    agentActionFailed: jest.fn(),
  },
}));

process.env.AGENTS_ENABLED = 'true';
process.env.AI_EMPLOYEE_BYPASS_PROVISIONING = 'true';

const { invokeAgent } = await import('./agentRuntime.js');

beforeEach(() => {
  jest.clearAllMocks();
  gateway.classify.mockResolvedValue({ domains: ['lead'], smalltalk: false });
  gateway.compose.mockResolvedValue('Composed reply.');
  getConversationState.mockResolvedValue(null);
  invokeSkill.mockResolvedValue({ ok: true, data: { leads: [], total: 0 } });
  delete process.env.AGENT_TOOL_LOOP_ENABLED;
  delete process.env.WHATSAPP_FALLBACK_CATEGORY;
});

describe('runConversationalPipeline — single-shot planner path', () => {
  it('executes the planned tool and returns a reply', async () => {
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: { status: 'new' } });

    const result = await invokeAgent('t1', 'whatsapp', 'naye leads dikhao', {
      principal: 'wa:919876543210',
      contactPhone: '919876543210',
    });

    expect(result.ok).toBe(true);
    expect(invokeSkill).toHaveBeenCalledTimes(1);
    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'search_leads', { status: 'new' },
      expect.objectContaining({ source: 'agent.pipeline' }),
    );
  });

  it('passes the principal as the permission identity, with the admin fallback', async () => {
    // The regression guard. `permissionIdentity` was derived in invokeAgent
    // but referenced here, so this call used to throw before reaching the tool.
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: {} });

    await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:919876543210' });

    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'search_leads', {},
      expect.objectContaining({
        userId: 'wa:919876543210',
        fallbackCategory: 'admin',
      }),
    );
  });

  it('prefers an explicit userId over the principal, and then does NOT fall back', async () => {
    // A named human must fail closed against their provisioned category —
    // quietly upgrading an unprovisioned user to admin would be the bypass.
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: {} });

    await invokeAgent('t1', 'web', 'leads', { principal: 'web:u1', userId: 'u1' });

    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'search_leads', {},
      expect.objectContaining({ userId: 'u1', fallbackCategory: undefined }),
    );
  });

  it('honours WHATSAPP_FALLBACK_CATEGORY when set', async () => {
    process.env.WHATSAPP_FALLBACK_CATEGORY = 'whatsapp_bot';
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: {} });

    await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'search_leads', {},
      expect.objectContaining({ fallbackCategory: 'whatsapp_bot' }),
    );
  });
});

describe('runConversationalPipeline — bounded tool loop path', () => {
  it('injects an executeTool that carries the same permission identity', async () => {
    process.env.AGENT_TOOL_LOOP_ENABLED = 'true';
    let captured = null;
    gateway.planAndRun.mockImplementation(async (_msg, opts) => {
      captured = opts.executeTool;
      return { kind: 'chat', text: 'done' };
    });

    await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(typeof captured).toBe('function');
    await captured('search_leads', { status: 'new' });
    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'search_leads', { status: 'new' },
      expect.objectContaining({ userId: 'wa:91', fallbackCategory: 'admin' }),
    );
  });
});

describe('deadline budget (Phase 5)', () => {
  it('lets an adapter shrink the tool-loop budget to fit its request deadline', async () => {
    // A turn killed by the Lambda timeout returns nothing at all; a turn that
    // stops early answers with what it has.
    process.env.AGENT_TOOL_LOOP_ENABLED = 'true';
    gateway.planAndRun.mockResolvedValue({ kind: 'chat', text: 'ok' });

    await invokeAgent('t1', 'web', 'leads', {
      principal: 'web:u1', userId: 'u1', toolLoopBudgetMs: 18000,
    });

    expect(gateway.planAndRun.mock.calls.at(-1)[1].budgetMs).toBe(18000);
  });

  it('leaves the loop default alone when no budget is supplied', async () => {
    process.env.AGENT_TOOL_LOOP_ENABLED = 'true';
    gateway.planAndRun.mockResolvedValue({ kind: 'chat', text: 'ok' });

    await invokeAgent('t1', 'whatsapp', 'leads', { principal: 'wa:91' });

    expect(gateway.planAndRun.mock.calls.at(-1)[1].budgetMs).toBeUndefined();
  });
});

describe('channel-aware compose (Phase 4)', () => {
  it('defaults the composer to the whatsapp channel', async () => {
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'get_daily_brief', input: {} });

    await invokeAgent('t1', 'whatsapp', 'brief', { principal: 'wa:91' });

    const composeArgs = gateway.compose.mock.calls.at(-1)?.[0];
    expect(composeArgs?.channel).toBe('whatsapp');
  });

  it('passes channel: web when the web adapter sets it', async () => {
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'get_daily_brief', input: {} });

    await invokeAgent('t1', 'web', 'brief', {
      principal: 'web:u1', userId: 'u1', channel: 'web',
    });

    const composeArgs = gateway.compose.mock.calls.at(-1)?.[0];
    expect(composeArgs?.channel).toBe('web');
  });
});

describe('web is a first-class conversational channel', () => {
  it('runs the full pipeline rather than the single-shot path', async () => {
    // 'web' had to be added to CONVERSATIONAL_AGENTS. Without it the web
    // channel silently fell through to runSingleShotAgent — no tools at all.
    gateway.plan.mockResolvedValue({ kind: 'tool', toolName: 'search_leads', input: {} });

    await invokeAgent('t1', 'web', 'show my leads', { principal: 'web:u1', userId: 'u1' });

    expect(gateway.classify).toHaveBeenCalled();
    expect(invokeSkill).toHaveBeenCalled();
  });

  it('uses caller-supplied history instead of the phone-keyed WhatsApp log', async () => {
    gateway.plan.mockResolvedValue({ kind: 'chat', source: 'router_smalltalk' });
    const history = [{ role: 'user', content: 'earlier question' }];

    await invokeAgent('t1', 'web', 'follow up', {
      principal: 'web:u1', userId: 'u1', conversationHistory: history,
    });

    const planOpts = gateway.plan.mock.calls.at(-1)?.[1];
    expect(planOpts?.historyMessages).toEqual(history);
  });
});
