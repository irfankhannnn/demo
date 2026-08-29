/**
 * Executes approved CRM actions.
 *
 * All writes go through `skillInvoker.invokeSkill`, the same path the WhatsApp
 * AI Employee and the MCP server use, so permission checks, input
 * normalization and tool-level logging are shared rather than reimplemented.
 */

import { logger } from '../../logger.js';
import { invokeSkill } from '../../skillInvoker.js';
import { logAgentAction } from '../../agents/agentAuditService.js';
import { ACTION_STATUS, PROPOSABLE_TOOLS } from './constants.js';
import { updateActionStatus, refreshCompletionStatus } from './callRecordingRepository.js';

export const CALL_INTEL_AGENT_ID = 'call-recording-analyzer';

/**
 * Run a single proposed action against the CRM.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.recordingId
 * @param {object} params.action proposed action record
 * @param {string|null} params.userId acting user (permission check + audit)
 * @param {boolean} params.automatic true when applied without an approval click
 */
export async function executeAction({ tenantId, recordingId, action, userId = null, automatic = false }) {
  if (!PROPOSABLE_TOOLS.includes(action?.tool)) {
    return { ok: false, error: `tool_not_allowed: ${action?.tool}` };
  }

  const startedAt = Date.now();
  let result;

  try {
    result = await invokeSkill(tenantId, action.tool, action.arguments || {}, {
      userId: userId || undefined,
      source: automatic ? 'call-intelligence-auto' : 'call-intelligence-approval',
    });
  } catch (err) {
    logger.error('callIntelligence.action.exception', {
      tenantId, recordingId, actionId: action.actionId, tool: action.tool, error: err.message,
    });
    result = { ok: false, error: err.message };
  }

  const succeeded = Boolean(result?.ok);
  const executedAt = new Date().toISOString();

  await updateActionStatus(
    tenantId,
    recordingId,
    action.actionId,
    {
      status: succeeded ? ACTION_STATUS.APPLIED : ACTION_STATUS.FAILED,
      executedAt,
      executedBy: userId || 'system',
      executionResult: succeeded ? truncateForStorage(result?.data ?? result) : null,
      executionError: succeeded ? null : String(result?.error || 'Unknown error').slice(0, 500),
    },
    // A failed action may be retried; an applied one may not.
    [ACTION_STATUS.PENDING, ACTION_STATUS.APPROVED, ACTION_STATUS.FAILED],
  );

  // Audit trail (best-effort; never blocks the response).
  await logAgentAction(
    tenantId,
    CALL_INTEL_AGENT_ID,
    automatic ? 'auto_apply' : 'approve_apply',
    { recordingId, actionId: action.actionId, tool: action.tool, arguments: action.arguments },
    succeeded ? { ok: true } : { error: result?.error },
    0,
  );

  logger.info('callIntelligence.action.executed', {
    tenantId,
    recordingId,
    actionId: action.actionId,
    tool: action.tool,
    automatic,
    ok: succeeded,
    durationMs: Date.now() - startedAt,
  });

  return succeeded
    ? { ok: true, result: result?.data ?? null }
    : { ok: false, error: String(result?.error || 'Tool execution failed') };
}

/**
 * Apply every action that does not require an approval click.
 *
 * Each action is claimed with a conditional write *before* the CRM is touched,
 * the same order the /approve route uses. Reading `action.status` off the
 * in-memory list was not enough: the list is a snapshot taken when the analysis
 * stage planned it, so an owner who rejected the note in the seconds between
 * planning and applying still got it written to the customer record. The claim
 * fails against a rejected row, and the action is skipped.
 */
export async function applyAutomaticActions({ tenantId, recordingId, actions, userId = null }) {
  const applied = [];
  for (const action of actions) {
    if (action.requiresApproval) continue;
    if (action.status !== ACTION_STATUS.PENDING) continue;

    const claimed = await updateActionStatus(
      tenantId,
      recordingId,
      action.actionId,
      { status: ACTION_STATUS.APPROVED, reviewedBy: 'system', reviewedAt: new Date().toISOString() },
      [ACTION_STATUS.PENDING],
    );
    if (!claimed?.ok) {
      logger.info('callIntelligence.action.claim_lost', {
        tenantId, recordingId, actionId: action.actionId, tool: action.tool,
      });
      continue;
    }

    const outcome = await executeAction({ tenantId, recordingId, action, userId, automatic: true });
    applied.push({ actionId: action.actionId, tool: action.tool, ...outcome });
  }
  if (applied.length > 0) {
    await refreshCompletionStatus(tenantId, recordingId);
  }
  return applied;
}

/** DynamoDB items must stay small — keep only a readable slice of the result. */
function truncateForStorage(value) {
  if (value == null) return null;
  try {
    const text = JSON.stringify(value);
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : JSON.parse(text);
  } catch (_) {
    return null;
  }
}
