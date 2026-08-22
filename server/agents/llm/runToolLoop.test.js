/**
 * Unit tests for the bounded tool loop (Phase 3 Slice 3a).
 *
 * Mocks the Gemini SDK at the chat-session level (startChat/sendMessage) so
 * a whole multi-step conversation can be scripted turn by turn, and injects
 * a fake executeTool so no DynamoDB is touched.
 */
import { jest } from '@jest/globals';

const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGenAI {
    getGenerativeModel() {
      return { startChat: mockStartChat };
    }
  },
}));

const { runToolLoop } = await import('./runToolLoop.js');

/** Build a fake Gemini response that asks for tool call(s). */
function toolCallResponse(calls) {
  return {
    response: {
      text: () => '',
      functionCalls: () => calls,
    },
  };
}

/** Build a fake Gemini response that is plain text (model is done). */
function textResponse(text) {
  return {
    response: {
      text: () => text,
      functionCalls: () => [],
    },
  };
}

const BASE_OPTS = { tenantId: 't1', domains: ['leads'] };

describe('runToolLoop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test';
  });

  test('no tool calls -> chat plan with the model text', async () => {
    mockSendMessage.mockResolvedValueOnce(textResponse('Namaste! Kaise help karun?'));
    const executeTool = jest.fn();

    const plan = await runToolLoop('hello', { ...BASE_OPTS, executeTool });

    expect(plan).toEqual({ kind: 'chat', text: 'Namaste! Kaise help karun?' });
    expect(executeTool).not.toHaveBeenCalled();
  });

  test('no tool calls and no text -> clarify plan', async () => {
    mockSendMessage.mockResolvedValueOnce(textResponse(''));

    const plan = await runToolLoop('???', { ...BASE_OPTS, executeTool: jest.fn() });

    expect(plan.kind).toBe('clarify');
    expect(plan.text).toContain('did not catch that');
  });

  test('exactly one tool call returns the single-shot-compatible `tool` shape (so the formatter path is unchanged)', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'search_leads', args: { temperature: 'hot' } }]))
      .mockResolvedValueOnce(textResponse('Found 3 hot leads.'));
    const executeTool = jest.fn().mockResolvedValue({ ok: true, data: [{ leadId: 'l1' }] });

    const plan = await runToolLoop('hot leads dikhao', { ...BASE_OPTS, executeTool });

    expect(plan.kind).toBe('tool');
    expect(plan.toolName).toBe('search_leads');
    expect(plan.input).toMatchObject({ temperature: 'hot' });
    // The result is carried on the plan so the caller does NOT re-execute it.
    expect(plan.result).toEqual({ ok: true, data: [{ leadId: 'l1' }] });
    expect(plan.steps).toHaveLength(1);
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  test('COMPOUND REQUEST: two sequential tool calls both run, and are both returned', async () => {
    // This is the case the single-shot planner could not do at all --
    // planTurn.js took functionCalls[0] and dropped everything after it.
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'create_lead', args: { name: 'Rajesh', leadType: 'buyer' } }]))
      .mockResolvedValueOnce(toolCallResponse([{
        name: 'create_meeting',
        args: {
          title: 'Site visit', scheduledDate: '2026-08-22T10:00',
          relatedEntityType: 'lead', relatedEntityId: '11111111-1111-4111-8111-111111111111',
        },
      }]))
      .mockResolvedValueOnce(textResponse('Rajesh ka lead bana diya aur kal ka site visit book kar diya.'));

    const executeTool = jest.fn()
      .mockResolvedValueOnce({ ok: true, data: { leadId: '11111111-1111-4111-8111-111111111111' } })
      .mockResolvedValueOnce({ ok: true, data: { meetingId: 'm1' } });

    const plan = await runToolLoop('Rajesh ke liye lead banao aur kal site visit schedule karo', {
      ...BASE_OPTS, executeTool,
    });

    expect(plan.kind).toBe('tool_loop');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].toolName).toBe('create_lead');
    expect(plan.steps[1].toolName).toBe('create_meeting');
    expect(plan.text).toContain('site visit book kar diya');
    expect(plan.stopReason).toBe('done');
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  test('MULTIPLE calls in ONE response all execute (the functionCalls[0] bug)', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([
        { name: 'search_leads', args: { temperature: 'hot' } },
        { name: 'search_buyers', args: {} },
      ]))
      .mockResolvedValueOnce(textResponse('Here is both.'));
    const executeTool = jest.fn().mockResolvedValue({ ok: true, data: [] });

    const plan = await runToolLoop('hot leads aur buyers dono dikhao', { ...BASE_OPTS, executeTool });

    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenNthCalledWith(1, 'search_leads', expect.objectContaining({ temperature: 'hot' }));
    expect(executeTool).toHaveBeenNthCalledWith(2, 'search_buyers', expect.anything());
    expect(plan.kind).toBe('tool_loop');
    expect(plan.steps).toHaveLength(2);
  });

  test('step cap is enforced and reported, keeping the results gathered so far', async () => {
    // Model never stops asking for tools.
    mockSendMessage.mockResolvedValue(toolCallResponse([{ name: 'search_leads', args: {} }]));
    const executeTool = jest.fn().mockResolvedValue({ ok: true, data: [] });

    const plan = await runToolLoop('loop forever', { ...BASE_OPTS, executeTool, maxSteps: 3 });

    expect(executeTool).toHaveBeenCalledTimes(3);
    expect(plan.kind).toBe('tool_loop');
    expect(plan.steps).toHaveLength(3);
    expect(plan.stopReason).toBe('step_cap');
  });

  test('wall-clock budget stops the loop even when steps remain', async () => {
    mockSendMessage.mockImplementation(async () => {
      // Each model round-trip "takes" longer than the whole budget.
      await new Promise((r) => setTimeout(r, 25));
      return toolCallResponse([{ name: 'search_leads', args: {} }]);
    });
    const executeTool = jest.fn().mockResolvedValue({ ok: true, data: [] });

    const plan = await runToolLoop('slow', { ...BASE_OPTS, executeTool, maxSteps: 6, budgetMs: 10 });

    expect(plan.stopReason).toBe('time_budget');
    // Stopped well before the step cap.
    expect(executeTool.mock.calls.length).toBeLessThan(6);
  });

  test('a disallowed tool name is refused and fed back to the model, not executed', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'delete_lead', args: { leadId: 'x' } }]))
      .mockResolvedValueOnce(textResponse('I cannot delete; would you like to archive instead?'));
    const executeTool = jest.fn();

    const plan = await runToolLoop('delete this lead', { ...BASE_OPTS, executeTool });

    // delete_* tools were removed from the registry in Phase 1 Slice 5, so
    // the ALLOWED check must reject this rather than execute it.
    expect(executeTool).not.toHaveBeenCalled();
    expect(plan.kind).toBe('chat');
    expect(plan.text).toContain('archive');
    // The refusal was handed back to the model as a functionResponse so it
    // could self-correct within the remaining budget.
    const secondCallArg = mockSendMessage.mock.calls[1][0];
    expect(secondCallArg[0].functionResponse.response.ok).toBe(false);
  });

  test('a call missing required params is refused, not executed', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'create_lead', args: { name: 'X' } }])) // leadType missing
      .mockResolvedValueOnce(textResponse('What type of lead is X?'));
    const executeTool = jest.fn();

    const plan = await runToolLoop('create lead X', { ...BASE_OPTS, executeTool });

    expect(executeTool).not.toHaveBeenCalled();
    expect(plan.kind).toBe('chat');
    const secondCallArg = mockSendMessage.mock.calls[1][0];
    expect(secondCallArg[0].functionResponse.response.error).toContain('leadType');
  });

  test('a tool that throws is captured as a failed step, not a thrown turn', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'search_leads', args: {} }]))
      .mockResolvedValueOnce(textResponse('Something went wrong looking that up.'));
    const executeTool = jest.fn().mockRejectedValue(new Error('ddb throttled'));

    const plan = await runToolLoop('show leads', { ...BASE_OPTS, executeTool });

    expect(plan.kind).toBe('tool');
    expect(plan.result).toEqual({ ok: false, error: 'ddb throttled' });
  });

  test('tool results are truncated before going back to the model', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'search_leads', args: {} }]))
      .mockResolvedValueOnce(textResponse('done'));
    const bigResult = { ok: true, data: Array.from({ length: 500 }, (_, i) => ({ leadId: `l${i}` })) };
    const executeTool = jest.fn().mockResolvedValue(bigResult);
    const truncateForModel = jest.fn(() => ({ ok: true, data: 'TRUNCATED' }));

    const plan = await runToolLoop('show leads', { ...BASE_OPTS, executeTool, truncateForModel });

    expect(truncateForModel).toHaveBeenCalledWith('search_leads', bigResult);
    const sentBack = mockSendMessage.mock.calls[1][0];
    expect(sentBack[0].functionResponse.response).toEqual({ ok: true, data: 'TRUNCATED' });
    // The caller still gets the FULL untruncated result for rendering.
    expect(plan.result).toBe(bigResult);
  });

  test('onApiCall fires once per model round-trip (credit/telemetry accounting)', async () => {
    mockSendMessage
      .mockResolvedValueOnce(toolCallResponse([{ name: 'search_leads', args: {} }]))
      .mockResolvedValueOnce(textResponse('done'));
    const onApiCall = jest.fn();

    await runToolLoop('show leads', {
      ...BASE_OPTS, executeTool: jest.fn().mockResolvedValue({ ok: true, data: [] }), onApiCall,
    });

    expect(onApiCall).toHaveBeenCalledTimes(2);
  });

  test('throws if executeTool is not provided (programmer error, fail loudly)', async () => {
    await expect(runToolLoop('hi', { tenantId: 't1' })).rejects.toThrow('executeTool');
  });

  // ── Slice 3b: scope escalation (router = ranker, not hard gate) ──────────

  test('a mis-scoped turn escalates to the full registry and recovers', async () => {
    // Router scoped to 'leads', but the user asked about properties: with a
    // hard gate the planner has no property tool and the turn dies here.
    mockSendMessage
      .mockResolvedValueOnce(textResponse('I do not have a tool for that.'))
      .mockResolvedValueOnce(toolCallResponse([{ name: 'search_properties', args: { city: 'Mumbai' } }]))
      .mockResolvedValueOnce(textResponse('Found 4 properties in Mumbai.'));
    const executeTool = jest.fn().mockResolvedValue({ ok: true, data: [] });

    const plan = await runToolLoop('Mumbai ki properties dikhao', {
      ...BASE_OPTS, executeTool, toolNames: ['search_leads'], allowScopeEscalation: true,
    });

    expect(plan.kind).toBe('tool');
    expect(plan.toolName).toBe('search_properties');
    expect(executeTool).toHaveBeenCalledWith('search_properties', expect.objectContaining({ city: 'Mumbai' }));
  });

  test('escalation happens at most once, and not at all when disabled', async () => {
    mockSendMessage.mockResolvedValue(textResponse('Nothing I can do.'));
    const executeTool = jest.fn();

    const plan = await runToolLoop('something odd', {
      ...BASE_OPTS, executeTool, toolNames: ['search_leads'], allowScopeEscalation: false,
    });

    // Disabled -> one round-trip, straight to the model's text, no retry.
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(plan.kind).toBe('chat');
  });
});
