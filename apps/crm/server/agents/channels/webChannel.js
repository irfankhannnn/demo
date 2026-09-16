/**
 * Web channel adapter (Phase 5) — the in-CRM chat surface.
 *
 * Sits alongside `apps/crm/server/scripts/whatsapp-message-processor.js` as the second
 * adapter over the shared agent core. Both do the same job: turn a channel's
 * inbound event into a `Turn`, call the core, and render the result back in
 * the channel's own idiom. Neither owns any CRM logic.
 *
 * WHAT THIS DELIBERATELY DOES NOT REUSE FROM THE WHATSAPP ADAPTER
 *
 * `prepareConversationalTurn()` applies business-hours pausing, phone-based
 * access control and phone-based category resolution. Every one of those is
 * wrong here:
 *
 *   - Business hours exist so the bot does not answer a *customer* at 2am. The
 *     web user is the broker themselves, inside their own CRM. Refusing to
 *     answer them out of hours would be a bug, not a policy.
 *   - Phone allowlists answer "is this stranger allowed to message us?". A web
 *     turn has already passed JWT auth and tenant scoping.
 *   - `resolveCategory(phone)` classifies an outside contact as lead/customer/
 *     spam. A logged-in colleague is none of those.
 *
 * Identity is the authenticated CRM user, which is strictly better than what
 * WhatsApp has: a real per-user id, so RBAC is per-person rather than
 * per-number.
 */

import { invokeAgent } from '../agentRuntime.js';
import { categoryForCrmRole } from '../../userCategoryService.js';
import {
  getConversationState,
  initializeConversationState,
  recordMessageInConversation,
  resetConversationStateIfStale,
} from '../../conversationStateService.js';
import { logger } from '../../logger.js';

/** Longest inbound message accepted. Bounds prompt cost and DynamoDB item size. */
export const MAX_WEB_MESSAGE_CHARS = 4000;

/** How many prior turns the client may replay into the prompt. */
export const MAX_WEB_HISTORY_TURNS = 20;

/**
 * Tool-loop budget for a web turn.
 *
 * The loop's own default is 25s, and classify + compose add several more on
 * top. The API Lambda's timeout is 30s (`LambdaTimeout` in cfn-backend.yaml),
 * so a long multi-step turn can be killed by the platform mid-flight and
 * return nothing at all. Stopping the loop early and answering with what it
 * already has is strictly better than that.
 *
 * Raise this only alongside the Lambda timeout — the plan's dedicated
 * longer-timeout Lambda for this route is what makes a bigger budget safe.
 */
export const WEB_TOOL_LOOP_BUDGET_MS = parseInt(
  process.env.AGENT_WEB_TOOL_LOOP_BUDGET_MS || '18000', 10,
);

/**
 * Session key for a web conversation.
 *
 * Mirrors `buildWhatsAppPrincipal`'s `wa:<phone>` so both channels key the
 * same store. Scoped per user, not per tenant: two colleagues in one agency
 * must not share a conversation, and the focus entity ("us lead ka number
 * kya hai") is exactly the kind of state that would leak between them.
 */
export function buildWebPrincipal(userId) {
  return `web:${userId}`;
}

/**
 * Normalise client-supplied history into the shape the planner expects.
 *
 * The client sends this rather than the server reading a log, because the web
 * transcript lives in the browser session. It is therefore untrusted input:
 * capped in length and in item count, and coerced to the two roles the planner
 * understands. It only ever becomes prompt context — it is never persisted and
 * never reaches a tool argument.
 */
export function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-MAX_WEB_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, MAX_WEB_MESSAGE_CHARS),
    }));
}

/**
 * Run one web chat turn.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId   authenticated CRM user id
 * @param {string} [params.role]   CRM role from the JWT, drives RBAC category
 * @param {string} params.text     the user's message
 * @param {Array}  [params.history] prior turns from the client
 * @param {(event: {type: string, [k: string]: any}) => void} [params.onEvent]
 *        progress sink. Called with `{type:'status'|'tool'}` as the turn
 *        advances so the UI can show activity instead of a spinner.
 * @returns {Promise<object>} `{ ok, text, toolResults, error }`
 */
export async function runWebTurn({ tenantId, userId, role, text, history, onEvent }) {
  const emit = (event) => {
    try { onEvent?.(event); } catch (err) {
      // A failed progress write must never abort the turn — the client may
      // simply have disconnected mid-stream.
      logger.debug('webChannel.emit.failed', { tenantId, error: err.message });
    }
  };

  const message = typeof text === 'string' ? text.trim() : '';
  if (!message) return { ok: false, error: 'empty_message' };
  if (message.length > MAX_WEB_MESSAGE_CHARS) {
    return { ok: false, error: 'message_too_long' };
  }

  const principal = buildWebPrincipal(userId);

  // Conversation state is best-effort, exactly as on the WhatsApp path: losing
  // the focus entity degrades the reply, it does not invalidate the turn.
  emit({ type: 'status', stage: 'thinking' });
  try {
    await resetConversationStateIfStale(tenantId, principal, 2, { source: 'web' });
    const existing = await getConversationState(tenantId, principal);
    if (!existing) {
      await initializeConversationState(tenantId, principal, { source: 'web' });
    }
    await recordMessageInConversation(tenantId, principal);
  } catch (err) {
    logger.warn('webChannel.conversation_state.failed', { tenantId, principal, error: err.message });
  }

  const agentResult = await invokeAgent(tenantId, 'web', message, {
    source: 'web',
    channel: 'web',
    principal,
    userId,
    // No CATEGORY#USER row exists for any user (setUserCategory is never
    // called), so without this every web tool call fails closed. The JWT role
    // is the populated identity model — see categoryForCrmRole.
    fallbackCategory: categoryForCrmRole(role),
    toolLoopBudgetMs: WEB_TOOL_LOOP_BUDGET_MS,
    conversationHistory: sanitizeHistory(history),
    onToolStart: (toolName) => emit({ type: 'tool', stage: 'running', toolName }),
    onToolEnd: (toolName, ok) => emit({ type: 'tool', stage: 'done', toolName, ok }),
  });

  if (!agentResult.ok) {
    return { ok: false, error: agentResult.error || 'agent_failed' };
  }

  return {
    ok: true,
    text: agentResult.result?.text || '',
    toolResults: agentResult.result?.toolResults || agentResult.toolResults || [],
    durationMs: agentResult.result?.durationMs,
  };
}
