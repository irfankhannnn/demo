/**
 * Tool → presentation mode registry (Interaction Design v1).
 *
 * These Sets are the single source of truth derived from the tool registry meta
 * in server/shared/toolDefinitions.js. Do NOT hand-maintain parallel copies.
 */

import {
  SUMMARY_INSIGHT_TOOLS,
  FORMATTED_SUMMARY_TOOLS,
  DETAIL_ENTITY_TOOLS,
  LIST_TOOLS,
} from '../../shared/toolDefinitions.js';

export { SUMMARY_INSIGHT_TOOLS, FORMATTED_SUMMARY_TOOLS, DETAIL_ENTITY_TOOLS, LIST_TOOLS };

export function isValidWhatsAppReply(reply) {
  if (!reply || typeof reply !== 'string') return false;
  const trimmed = reply.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;
  if (trimmed.includes('"data":') && trimmed.includes('"ok":')) return false;
  return true;
}

/**
 * @param {string} toolName
 * @param {string} replyText
 * @returns {boolean} true = send LLM reply as-is
 */
export function preferLlmReply(toolName, replyText) {
  if (!isValidWhatsAppReply(replyText)) return false;

  const trimmed = replyText.trim();
  if (trimmed.length === 0) return false;

  if (SUMMARY_INSIGHT_TOOLS.has(toolName)) return true;

  if (/_note$/.test(toolName) || toolName.includes('_note')) {
    // Note list tools are LIST_TOOLS; mutations prefer LLM.
    if (LIST_TOOLS.has(toolName) || toolName.startsWith('get_')) return false;
    return true;
  }

  if (LIST_TOOLS.has(toolName)) return false;
  if (/^(search|find|list|lookup)_/.test(toolName)) return false;
  if (/^(create|update|delete|convert)_/.test(toolName)) return false;
  if (DETAIL_ENTITY_TOOLS.has(toolName)) return false;

  if (/^get_/.test(toolName) && trimmed.length >= 20) return true;
  if (trimmed.length < 20) return false;

  return true;
}
