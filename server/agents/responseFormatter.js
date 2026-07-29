/**
 * Response formatter orchestrator for WhatsApp SyncBot.
 *
 * Templates and helpers live in ./formatting/ (Interaction Design v1).
 * Spec: docs/interaction-design/SYNC_BOT_INTERACTION_DESIGN_v1.md
 */

import {
  emptyStateMessage,
  formatCompactConfirmation,
} from './formatting/confirmations.js';
import {
  formatMetricsCard,
  formatSingleCard,
} from './formatting/entityCards.js';
import { formatList } from './formatting/listItems.js';
import { formatLeadsSummary } from './formatting/summaries.js';
import {
  isValidWhatsAppReply,
  preferLlmReply,
  LIST_TOOLS,
  DETAIL_ENTITY_TOOLS,
  FORMATTED_SUMMARY_TOOLS,
} from './formatting/routing.js';
import { capitalize, pluralize } from './formatting/utils.js';

const MAX_LIST_ITEMS = parseInt(process.env.RESPONSE_MAX_LIST_ITEMS || '10', 10);
const MAX_LIST_ITEMS_WITH_MORE = parseInt(process.env.RESPONSE_MAX_LIST_ITEMS_WITH_MORE || '5', 10);

const ENTITY_ID_KEYS = [
  'leadId', 'propertyId', 'contactId', 'buyerId', 'ownerId',
  'customerId', 'tenantRecordId', 'meetingId',
];

function isAiDtoEnvelope(data) {
  return data && typeof data === 'object'
    && data.metadata && typeof data.metadata === 'object'
    && 'data' in data;
}

function unwrapAiDto(data) {
  if (!data || typeof data !== 'object') return data;
  return isAiDtoEnvelope(data) ? data.data : data;
}

function isSingleEntity(payload) {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    && ENTITY_ID_KEYS.some(k => payload[k] !== undefined && payload[k] !== null);
}

function normalizeList(data) {
  const payload = unwrapAiDto(data);
  if (Array.isArray(payload)) return payload;
  if (isSingleEntity(payload)) return null;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.leads)) return payload.leads;
    if (Array.isArray(payload.buyers)) return payload.buyers;
    if (Array.isArray(payload.owners)) return payload.owners;
    if (Array.isArray(payload.customers)) return payload.customers;
    if (Array.isArray(payload.properties)) return payload.properties;
    if (Array.isArray(payload.contacts)) return payload.contacts;
    if (Array.isArray(payload.meetings)) return payload.meetings;
    if (Array.isArray(payload.notes)) return payload.notes;
    if (Array.isArray(payload.documents)) return payload.documents;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return null;
}

function detectEntityType(item) {
  if (!item || typeof item !== 'object') return 'generic';
  if (item.leadId) return 'lead';
  if (item.leadType) return 'lead';
  if (item.propertyId) return 'property';
  if (item.contactId) return 'contact';
  if (item.buyerId) return 'buyer';
  if (item.ownerId) return 'owner';
  if (item.customerId || item.tenantRecordId) return 'tenant';
  if (item.meetingId) return 'meeting';
  if (item.noteId || item.noteID) return 'note';
  if (item.documentId || item.docId) return 'document';
  return 'generic';
}

function entityTypeFromToolName(toolName) {
  if (toolName.includes('lead')) return 'lead';
  if (toolName.includes('buyer')) return 'buyer';
  if (toolName.includes('seller')) return 'seller';
  if (toolName.includes('owner')) return 'owner';
  if (toolName.includes('tenant') || toolName.includes('customer')) return 'tenant';
  if (toolName.includes('contact')) return 'contact';
  if (toolName.includes('document')) return 'document';
  if (toolName.includes('property') || toolName.includes('properties')) return 'property';
  if (toolName.includes('meeting')) return 'meeting';
  if (toolName.includes('note')) return 'note';
  if (toolName.includes('metrics')) return 'metrics';
  return 'generic';
}

function detectAction(toolName) {
  if (toolName.includes('_note')) {
    if (toolName.startsWith('create_')) return 'note added';
    if (toolName.startsWith('update_')) return 'note updated';
    if (toolName.startsWith('delete_')) return 'note deleted';
    return 'note updated';
  }
  if (toolName.includes('create')) return 'created';
  if (toolName.includes('update')) return 'updated';
  if (toolName.includes('delete')) return 'deleted';
  if (toolName.includes('convert')) return 'converted';
  if (toolName.includes('search') || toolName.includes('find') || toolName.includes('lookup')) return 'found';
  if (toolName.includes('get') && toolName.includes('by')) return 'found';
  if (toolName.includes('get')) return 'loaded';
  return 'processed';
}

function resolveDisplayName(data) {
  return data?.name || data?.leadName || data?.ownerName || data?.buyerName
    || data?.contactName || data?.title || '';
}

function formatNoteActionResult(data, action) {
  const name = resolveDisplayName(data);
  const verb = action === 'note_added' ? 'added' : action === 'note_updated' ? 'updated' : 'deleted';
  const target = name ? `*${name}*` : 'record';
  const lines = [`✅ Note ${verb} on ${target}.`];
  if (data?.content && action !== 'note_deleted') {
    const preview = String(data.content).slice(0, 300);
    lines.push('', `_"${preview}${data.content.length > 300 ? '...' : ''}"_`);
  }
  return lines.join('\n');
}

function buildConfirmationLine(toolName, data, entityType, metadata = {}) {
  const name = resolveDisplayName(data);
  if (toolName.includes('_note')) {
    const action = detectAction(toolName);
    return `✅ Note ${action.replace('note ', '')} on ${name ? `*${name}*` : entityType}.`;
  }
  if (metadata.action === 'updated' && Array.isArray(metadata.updatedFields) && metadata.updatedFields.length) {
    return `✅ Updated ${name ? `*${name}*` : capitalize(entityType)} — ${metadata.updatedFields.slice(0, 4).join(', ')}`;
  }
  const action = detectAction(toolName);
  const typeLabel = entityType === 'lead' && data?.leadType
    ? `${data.leadType} lead`
    : entityType;
  return `✅ ${capitalize(typeLabel)} ${name ? `*${name}* ` : ''}${action}.`;
}

function formatErrorEnvelope(metadata, data) {
  const err = String(metadata.error || '');
  if (err.includes('not_found')) {
    return `Couldn't find that ${entityHint(err)}. Try searching by name or phone.`;
  }
  if (err === 'duplicate_phone') {
    return `A record with that phone already exists${data?.name ? ` (*${data.name}*)` : ''}.`;
  }
  if (err === 'already_converted') {
    return `Already converted${data?.name ? ` (*${data.name}*)` : ''}. Open the buyer/owner/tenant record instead.`;
  }
  if (err === 'cannot_delete_converted') {
    return `Can't delete a converted lead${data?.name ? ` (*${data.name}*)` : ''}.`;
  }
  if (err === 'phone_required') {
    return 'Phone number is required for this action.';
  }
  return metadata.message || 'Something went wrong. Try again.';
}

function entityHint(error) {
  const e = String(error);
  if (e.includes('lead')) return 'lead';
  if (e.includes('buyer')) return 'buyer';
  if (e.includes('owner')) return 'owner';
  if (e.includes('tenant')) return 'tenant';
  if (e.includes('property')) return 'property';
  if (e.includes('contact')) return 'contact';
  if (e.includes('meeting')) return 'meeting';
  return 'record';
}

/**
 * Format a single CRM tool result into a structured WhatsApp message.
 */
export function formatToolResult(toolName, toolResult, input = {}) {
  if (!toolResult || typeof toolResult !== 'object') return null;
  if (toolResult.ok === false || toolResult.error) return null;

  const envelope = toolResult.data;
  const data = unwrapAiDto(envelope);
  const metadata = isAiDtoEnvelope(envelope) ? envelope.metadata : {};

  if (metadata.error) {
    return formatErrorEnvelope(metadata, data);
  }

  if (data === true || data === false) {
    if (data === true) {
      const type = entityTypeFromToolName(toolName);
      return `✅ ${capitalize(type)} ${detectAction(toolName)} successfully.`;
    }
    return null;
  }

  if (data === null || data === undefined) return null;

  if (metadata.action === 'note_added' || metadata.action === 'note_updated' || metadata.action === 'note_deleted') {
    return formatNoteActionResult(data, metadata.action);
  }
  if (toolName.includes('_note') && (toolName.startsWith('create_') || toolName.startsWith('update_'))) {
    return formatNoteActionResult(data, toolName.startsWith('create_') ? 'note_added' : 'note_updated');
  }

  if (toolName === 'get_leads_summary' && data && typeof data === 'object' && !Array.isArray(data)) {
    return formatLeadsSummary(data);
  }

  const list = normalizeList(data);
  const entityType = list && list.length > 0
    ? detectEntityType(list[0])
    : entityTypeFromToolName(toolName);

  if (list && list.length === 0) {
    return emptyStateMessage(entityType);
  }

  if (list && list.length > 0) {
    const total = metadata.total || data.total || list.length;
    const hasMore = metadata.hasMore || total > list.length;
    const maxItems = hasMore ? MAX_LIST_ITEMS_WITH_MORE : Math.min(MAX_LIST_ITEMS, MAX_LIST_ITEMS_WITH_MORE);
    return formatList(list, total, entityType, maxItems, { toolName, input });
  }

  if (entityType === 'metrics') {
    return formatMetricsCard(data);
  }

  const isReadTool = /^(get|search|find|lookup)_/.test(toolName);
  if (isReadTool) {
    return formatSingleCard(data, metadata);
  }

  // Mutations: confirmation line + compact key fields (not a full mini-profile dump).
  // Documents keep a small dedicated card (title/type/url).
  const header = buildConfirmationLine(toolName, data, entityType, metadata);
  if (entityType === 'document') {
    return `${header}\n\n${formatSingleCard(data, metadata)}`;
  }
  const compact = formatCompactConfirmation(entityType, data);
  return compact ? `${header}\n\n${compact}` : header;
}

/**
 * Format the final agent reply.
 */
export function formatAgentReply(replyText, toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return replyText || '';
  }

  const relevant = toolResults
    .slice()
    .reverse()
    .find(t => t && t.result && t.result.ok === true && t.result.data != null);

  if (!relevant) {
    return replyText || '';
  }

  const envelope = relevant.result.data;
  const meta = envelope?.metadata;
  if (meta?.error) {
    const errFmt = formatToolResult(relevant.tool, relevant.result, relevant.input);
    if (errFmt) return errFmt;
  }

  const formatted = formatToolResult(relevant.tool, relevant.result, relevant.input);

  // Lists, detail cards, and formatted summaries win over LLM prose.
  if (formatted && (
    LIST_TOOLS.has(relevant.tool)
    || DETAIL_ENTITY_TOOLS.has(relevant.tool)
    || FORMATTED_SUMMARY_TOOLS.has(relevant.tool)
  )) {
    if (
      replyText
      && isValidWhatsAppReply(replyText)
      && replyText.trim().length > 0
      && replyText.trim().length <= 200
      && LIST_TOOLS.has(relevant.tool)
      && /^(search_|get_owners|get_upcoming_meetings|get_.*_notes|get_property_documents)/.test(relevant.tool)
    ) {
      const intro = replyText.trim();
      if (!intro.includes('*') && !intro.startsWith('1.')) {
        return `${intro}\n\n${formatted}`;
      }
    }
    return formatted;
  }

  if (preferLlmReply(relevant.tool, replyText)) {
    return replyText.trim();
  }

  if (!formatted) {
    return replyText || '';
  }

  // Optional short intro prepend for search/list tools only
  if (
    replyText
    && isValidWhatsAppReply(replyText)
    && replyText.trim().length > 0
    && replyText.trim().length <= 200
    && /^(search_|get_owners|get_upcoming_meetings|get_.*_notes|get_property_documents)/.test(relevant.tool)
  ) {
    const intro = replyText.trim();
    if (!intro.includes('*') && !intro.startsWith('1.')) {
      return `${intro}\n\n${formatted}`;
    }
  }

  return formatted;
}

export { isValidWhatsAppReply };

/**
 * Pure renderer for the V2 pipeline (Fix #5).
 *
 * Turns an InteractionDecision (from decideInteraction) + the tool result +
 * optional LLM text into the final WhatsApp string. It contains NO routing or
 * business logic — the decision already carries mode, replyOwner and intro
 * policy. This is the single place WhatsApp formatting happens for V2.
 *
 * @param {object} decision - InteractionDecision
 * @param {object} [result] - invokeSkill envelope { ok, data }
 * @param {string} [llmText] - optional LLM-authored prose
 * @returns {string}
 */
export function renderDecision(decision, result, llmText) {
  if (!decision || typeof decision !== 'object') {
    return 'Done. Let me know if you need anything else.';
  }

  const { mode, replyOwner, toolName, input = {}, introPolicy } = decision;

  // Non-tool turns: decision.text is authoritative.
  if (mode === 'chat' || mode === 'clarify' || mode === 'confirm' || mode === 'cancelled') {
    return decision.text || 'Okay.';
  }

  if (mode === 'error') {
    const errFmt = toolName ? formatToolResult(toolName, result, input) : null;
    if (errFmt && isValidWhatsAppReply(errFmt)) return errFmt;
    return 'Sorry, something went wrong while processing that. Please try again.';
  }

  if (mode === 'empty') {
    const emptyFmt = toolName ? formatToolResult(toolName, result, input) : null;
    if (emptyFmt && isValidWhatsAppReply(emptyFmt)) return emptyFmt;
    return 'No matching records found.';
  }

  // Summary: LLM owns prose unless a formatter card exists (e.g. leads summary).
  if (mode === 'summary') {
    if (replyOwner === 'llm') {
      if (llmText && isValidWhatsAppReply(llmText) && llmText.trim().length > 0) {
        return llmText.trim();
      }
    }
    const card = toolName ? formatToolResult(toolName, result, input) : null;
    if (card && isValidWhatsAppReply(card)) return card;
    if (llmText && isValidWhatsAppReply(llmText)) return llmText.trim();
    return 'Done.';
  }

  // list / detail / mutation
  if (replyOwner === 'llm') {
    if (llmText && isValidWhatsAppReply(llmText) && llmText.trim().length > 0) {
      return llmText.trim();
    }
  }

  const formatted = toolName ? formatToolResult(toolName, result, input) : null;
  if (formatted && isValidWhatsAppReply(formatted)) {
    if (
      introPolicy === 'allow-short'
      && llmText
      && isValidWhatsAppReply(llmText)
      && llmText.trim().length > 0
      && llmText.trim().length <= 200
    ) {
      const intro = llmText.trim();
      if (!intro.includes('*') && !intro.startsWith('1.')) {
        return `${intro}\n\n${formatted}`;
      }
    }
    return formatted;
  }

  if (llmText && isValidWhatsAppReply(llmText)) return llmText.trim();
  return 'Done. Let me know if you need anything else.';
}

/**
 * Sanitize and validate a final reply.
 */
export function sanitizeAndFormatReply(replyText, toolResults) {
  if (toolResults && toolResults.length > 0) {
    const summaryTool = toolResults
      .slice()
      .reverse()
      .find((t) => t?.result?.ok && FORMATTED_SUMMARY_TOOLS.has(t.tool));
    if (summaryTool) {
      const card = formatToolResult(summaryTool.tool, summaryTool.result);
      if (card && isValidWhatsAppReply(card)) {
        return card;
      }
    }
  }

  const formatted = formatAgentReply(replyText, toolResults);
  if (isValidWhatsAppReply(formatted)) {
    return formatted;
  }
  if (toolResults && toolResults.length > 0) {
    const fallback = formatToolResult(
      toolResults[toolResults.length - 1].tool,
      toolResults[toolResults.length - 1].result,
      toolResults[toolResults.length - 1].input,
    );
    if (fallback) return fallback;
  }
  return isValidWhatsAppReply(replyText) ? replyText : 'Done. Let me know if you need anything else.';
}
