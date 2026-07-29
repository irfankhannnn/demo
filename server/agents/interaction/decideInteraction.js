/**
 * Interaction Design layer (Fix #4).
 *
 * Given the business instruction (from planToToolCall) and the tool result,
 * decide HOW to respond: who owns the reply (deterministic formatter vs LLM),
 * whether a short intro is allowed, whether a follow-up/confirmation is needed,
 * and what canned text to use for non-tool turns.
 *
 * It reads presentation intent from the tool registry meta (single source of
 * truth) instead of re-deriving rules here. The Presentation layer
 * (responseFormatter.renderDecision) turns this decision into WhatsApp text.
 *
 * InteractionDecision:
 * {
 *   mode: 'chat'|'clarify'|'confirm'|'cancelled'|'list'|'detail'|'summary'|'mutation'|'error'|'empty',
 *   replyOwner: 'formatter'|'llm',
 *   toolName: string|null,
 *   input: object|null,
 *   introPolicy: 'none'|'allow-short',
 *   text: string|null,        // canned text for chat/clarify/confirm/cancelled
 *   autoOpenDetail: boolean,
 *   followUp: string|null,
 *   pending: object|null,     // pending confirmation to persist in session
 * }
 */

import { getToolMeta } from '../../shared/toolDefinitions.js';

const CHAT_TEXT = 'Hi! I can help you manage leads, buyers, owners, tenants, properties, contacts and meetings. Try: "show new leads", "how many buyers", or "open lead <name>".';

function base(overrides = {}) {
  return {
    mode: 'chat',
    replyOwner: 'formatter',
    toolName: null,
    input: null,
    introPolicy: 'none',
    text: null,
    autoOpenDetail: false,
    followUp: null,
    pending: null,
    ...overrides,
  };
}

function isOkResult(result) {
  return !!(result && result.ok === true && result.data != null);
}

function isEmptyList(result) {
  const data = result?.data;
  const payload = data && typeof data === 'object' && 'data' in data ? data.data : data;
  if (Array.isArray(payload)) return payload.length === 0;
  if (payload && Array.isArray(payload.items)) return payload.items.length === 0;
  if (payload && Array.isArray(payload.results)) return payload.results.length === 0;
  return false;
}

/**
 * @param {object} instruction - output of planToToolCall
 * @param {object} [result] - invokeSkill result envelope { ok, data, error }
 * @returns {object} InteractionDecision
 */
export function decideInteraction(instruction, result) {
  if (!instruction || typeof instruction !== 'object') {
    return base({ mode: 'clarify', text: 'Could you clarify what you need?' });
  }

  switch (instruction.kind) {
    case 'chat':
      return base({ mode: 'chat', replyOwner: 'formatter', text: CHAT_TEXT });

    case 'clarify':
      return base({ mode: 'clarify', replyOwner: 'formatter', text: instruction.clarifyQuestion });

    case 'confirm':
      return base({
        mode: 'confirm',
        replyOwner: 'formatter',
        text: instruction.confirm?.promptText || 'Are you sure? Reply "yes" or "no".',
        pending: {
          entity: instruction.confirm?.entity || null,
          toolName: instruction.confirm?.toolName || null,
          input: instruction.confirm?.input || {},
        },
      });

    case 'cancelled':
      return base({ mode: 'cancelled', replyOwner: 'formatter', text: 'Okay, cancelled. Nothing was changed.' });

    case 'tool':
    case 'confirmed': {
      const toolName = instruction.toolName;
      const meta = getToolMeta(toolName) || {};

      if (!isOkResult(result)) {
        return base({ mode: 'error', replyOwner: 'formatter', toolName, input: instruction.input || {} });
      }

      if ((meta.operationKind === 'list') && isEmptyList(result)) {
        return base({ mode: 'empty', replyOwner: 'formatter', toolName, input: instruction.input || {} });
      }

      const common = { toolName, input: instruction.input || {}, autoOpenDetail: !!instruction.autoOpenDetail };

      switch (meta.operationKind) {
        case 'list':
          return base({ ...common, mode: 'list', replyOwner: 'formatter', introPolicy: 'allow-short' });
        case 'detail':
          return base({ ...common, mode: 'detail', replyOwner: 'formatter' });
        case 'summary':
          return base({ ...common, mode: 'summary', replyOwner: meta.replyOwner || 'llm' });
        case 'mutate':
        case 'delete':
          return base({ ...common, mode: 'mutation', replyOwner: meta.replyOwner || 'formatter' });
        default:
          return base({ ...common, mode: 'detail', replyOwner: meta.replyOwner || 'formatter' });
      }
    }

    default:
      return base({ mode: 'clarify', replyOwner: 'formatter', text: 'Could you rephrase what you need?' });
  }
}

export const _internal = { isEmptyList, isOkResult, CHAT_TEXT };
