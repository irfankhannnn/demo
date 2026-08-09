/**
 * The executor is the only place where an AI-proposed action becomes a CRM
 * write, so these tests pin the allowlist, the status bookkeeping and the
 * approval gate.
 */

import { jest } from '@jest/globals';

const invokeSkill = jest.fn();
const logAgentAction = jest.fn();
const updateActionStatus = jest.fn();
const refreshCompletionStatus = jest.fn();

jest.unstable_mockModule('../../skillInvoker.js', () => ({ invokeSkill }));
jest.unstable_mockModule('../../agents/agentAuditService.js', () => ({ logAgentAction }));
jest.unstable_mockModule('./callRecordingRepository.js', () => ({
  updateActionStatus,
  refreshCompletionStatus,
}));

const { executeAction, applyAutomaticActions } = await import('./actionExecutor.js');
const { ACTION_STATUS } = await import('./constants.js');

function action(overrides = {}) {
  return {
    actionId: 'a1',
    tool: 'create_lead_note',
    arguments: { leadId: 'L1', content: 'Call summary' },
    requiresApproval: false,
    status: ACTION_STATUS.PENDING,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  updateActionStatus.mockResolvedValue({ ok: true });
  refreshCompletionStatus.mockResolvedValue({});
  logAgentAction.mockResolvedValue(undefined);
});

describe('executeAction', () => {
  it('invokes the CRM tool and records the action as applied', async () => {
    invokeSkill.mockResolvedValue({ ok: true, data: { noteId: 'N1' } });

    const result = await executeAction({
      tenantId: 't1', recordingId: 'r1', action: action(), userId: 'u1',
    });

    expect(invokeSkill).toHaveBeenCalledWith(
      't1', 'create_lead_note', { leadId: 'L1', content: 'Call summary' },
      { userId: 'u1', source: 'call-intelligence-approval' },
    );
    expect(updateActionStatus).toHaveBeenCalledWith(
      't1', 'r1', 'a1',
      expect.objectContaining({ status: ACTION_STATUS.APPLIED, executedBy: 'u1' }),
      expect.any(Array),
    );
    expect(result).toEqual({ ok: true, result: { noteId: 'N1' } });
  });

  it('refuses a tool outside the proposable allowlist without calling the CRM', async () => {
    const result = await executeAction({
      tenantId: 't1', recordingId: 'r1', action: action({ tool: 'delete_lead' }),
    });

    expect(invokeSkill).not.toHaveBeenCalled();
    expect(updateActionStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'tool_not_allowed: delete_lead' });
  });

  it('records a failure when the tool reports an error', async () => {
    invokeSkill.mockResolvedValue({ ok: false, error: 'Lead not found' });

    const result = await executeAction({ tenantId: 't1', recordingId: 'r1', action: action() });

    expect(updateActionStatus).toHaveBeenCalledWith(
      't1', 'r1', 'a1',
      expect.objectContaining({ status: ACTION_STATUS.FAILED, executionError: 'Lead not found' }),
      expect.any(Array),
    );
    expect(result).toEqual({ ok: false, error: 'Lead not found' });
  });

  it('turns a thrown tool error into a recorded failure rather than a crash', async () => {
    invokeSkill.mockRejectedValue(new Error('DynamoDB timeout'));

    const result = await executeAction({ tenantId: 't1', recordingId: 'r1', action: action() });

    expect(result).toEqual({ ok: false, error: 'DynamoDB timeout' });
    expect(updateActionStatus).toHaveBeenCalledWith(
      't1', 'r1', 'a1',
      expect.objectContaining({ status: ACTION_STATUS.FAILED }),
      expect.any(Array),
    );
  });

  it('writes an audit entry for both automatic and approved runs', async () => {
    invokeSkill.mockResolvedValue({ ok: true, data: {} });

    await executeAction({ tenantId: 't1', recordingId: 'r1', action: action(), automatic: true });
    expect(logAgentAction).toHaveBeenCalledWith(
      't1', 'call-recording-analyzer', 'auto_apply',
      expect.objectContaining({ recordingId: 'r1', tool: 'create_lead_note' }),
      { ok: true }, 0,
    );

    await executeAction({ tenantId: 't1', recordingId: 'r1', action: action(), automatic: false });
    expect(logAgentAction).toHaveBeenLastCalledWith(
      't1', 'call-recording-analyzer', 'approve_apply',
      expect.anything(), { ok: true }, 0,
    );
  });
});

describe('applyAutomaticActions', () => {
  it('applies only the actions that do not need approval', async () => {
    invokeSkill.mockResolvedValue({ ok: true, data: {} });

    const applied = await applyAutomaticActions({
      tenantId: 't1',
      recordingId: 'r1',
      actions: [
        action({ actionId: 'note', requiresApproval: false }),
        action({ actionId: 'meeting', tool: 'create_meeting', requiresApproval: true }),
        action({ actionId: 'lead', tool: 'create_lead', requiresApproval: true }),
      ],
    });

    expect(invokeSkill).toHaveBeenCalledTimes(1);
    expect(applied.map((entry) => entry.actionId)).toEqual(['note']);
    expect(refreshCompletionStatus).toHaveBeenCalledWith('t1', 'r1');
  });

  it('ignores actions that are no longer pending', async () => {
    const applied = await applyAutomaticActions({
      tenantId: 't1',
      recordingId: 'r1',
      actions: [action({ status: ACTION_STATUS.APPLIED, requiresApproval: false })],
    });

    expect(invokeSkill).not.toHaveBeenCalled();
    expect(applied).toEqual([]);
    expect(refreshCompletionStatus).not.toHaveBeenCalled();
  });
});
