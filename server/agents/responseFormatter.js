/**
 * Response formatter for WhatsApp agent replies.
 *
 * ARCHITECTURE NOTE (2026-06-26):
 * This formatter now works with AI DTOs from the view builders (LeadAIViewBuilder, OwnerAIViewBuilder, TenantAIViewBuilder, etc.).
 * Results come pre-formatted with { metadata, data } structure.
 * The formatter can be simplified over time as the LLM learns to work with clean DTOs directly.
 *
 * Takes CRM tool results (either raw or AI DTOs) and produces a structured, scannable WhatsApp message.
 * Each entity type has a deterministic format so users can glance at the message instead of reading long paragraphs.
 *
 * Formatting principles (inspired by OpenClaw skill response modes):
 * - Single entity: bold header + bullet fields
 * - Multiple entities: numbered list with key fields
 * - Empty results: concise guidance
 * - Money: human readable (80L, 1.5Cr, 45k)
 * - Dates: short DD MMM YYYY
 * - WhatsApp markdown: *bold*, bullets, numbered lists
 */

import { logger } from '../logger.js';

const MAX_LIST_ITEMS = 10;
const MAX_LIST_ITEMS_WITH_MORE = 5;

/**
 * Format a number as compact Indian currency.
 * @param {number|string|null} value
 * @returns {string|null}
 */
function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;

  const crore = 10000000;
  const lakh = 100000;
  const thousand = 1000;

  function trimDecimal(n) {
    // Remove trailing zeros and optional decimal point (e.g., 1.50 -> 1.5, 1.00 -> 1)
    return String(n).replace(/\.?0+$/, '');
  }

  if (Math.abs(num) >= crore) {
    return `₹${trimDecimal((num / crore).toFixed(2))}Cr`;
  }
  if (Math.abs(num) >= lakh) {
    return `₹${trimDecimal((num / lakh).toFixed(2))}L`;
  }
  if (Math.abs(num) >= thousand) {
    return `₹${trimDecimal((num / thousand).toFixed(1))}k`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Format a date string to a short readable form.
 * @param {string|null} value
 * @returns {string|null}
 */
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

function present(value) {
  return value !== undefined && value !== null && value !== '';
}

function cleanPhone(phone) {
  if (!phone) return null;
  const s = String(phone).replace(/\D/g, '');
  return s.length > 0 ? s : null;
}

function joinNonEmpty(parts, sep = ' | ') {
  return parts.filter(Boolean).join(sep);
}

function bulletLine(label, value) {
  return value !== undefined && value !== null && value !== '' ? `• ${label}: ${value}` : null;
}

function boldHeader(text) {
  return text ? `*${text}*` : '';
}

function isArrayLike(data) {
  return Array.isArray(data) || (data && typeof data === 'object' && 'items' in data);
}

/**
 * Detect the AI DTO envelope shape from the view builders:
 * { metadata: {...}, data: <payload> }
 */
function isAiDtoEnvelope(data) {
  return data && typeof data === 'object' &&
    data.metadata && typeof data.metadata === 'object' &&
    'data' in data;
}

function unwrapAiDto(data) {
  if (!data || typeof data !== 'object') return data;
  return isAiDtoEnvelope(data) ? data.data : data;
}

function normalizeList(data) {
  const payload = unwrapAiDto(data);
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    // Common wrapped list shapes from CRM service
    if (Array.isArray(payload.leads)) return payload.leads;
    if (Array.isArray(payload.buyers)) return payload.buyers;
    if (Array.isArray(payload.owners)) return payload.owners;
    if (Array.isArray(payload.customers)) return payload.customers;
    if (Array.isArray(payload.properties)) return payload.properties;
    if (Array.isArray(payload.contacts)) return payload.contacts;
    if (Array.isArray(payload.meetings)) return payload.meetings;
    if (Array.isArray(payload.notes)) return payload.notes;
    if (Array.isArray(payload.documents)) return payload.documents;
  }
  return null;
}

function detectEntityType(item) {
  if (!item || typeof item !== 'object') return 'generic';
  if (item.leadId) return 'lead';
  if (item.propertyId) return 'property';
  if (item.contactId) return 'contact';
  if (item.buyerId) return 'buyer';
  if (item.ownerId) return 'owner';
  if (item.customerId) return 'tenant';
  if (item.tenantRecordId) return 'tenant';
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

function detectEntityTypeFromList(list, toolName) {
  if (!Array.isArray(list) || list.length === 0) return entityTypeFromToolName(toolName);
  return detectEntityType(list[0]);
}

// ─── Single entity card formatters ─────────────────────────────────────────────

function formatLeadCard(lead) {
  const type = lead.leadType || 'lead';
  const typeField = {
    buyer: lead.buyerRequirement,
    seller: lead.sellerProperty,
    tenant: lead.tenantRequirement,
    owner: lead.ownerProperty,
  }[type];

  const money = formatMoney(pick(typeField, 'budget', 'expectedPrice', 'rentExpected'));
  const area = pick(typeField, 'preferredArea', 'area', 'city');
  const bhk = pick(typeField, 'bhk');

  const lines = [
    boldHeader(`${lead.name} (${capitalize(type)} Lead)`),
    bulletLine('Status', lead.status && capitalize(lead.status)),
    bulletLine('Priority', lead.priority && capitalize(lead.priority)),
    bulletLine('Phone', cleanPhone(lead.phone)),
    bulletLine('Assigned to', lead.assignedTo),
    bulletLine('Source', lead.source),
    bulletLine('Budget/Price', money),
    bulletLine('Area', area),
    bhk ? `• BHK: ${bhk}BHK` : null,
    bulletLine('Notes', lead.notes),
    bulletLine('Lead ID', lead.leadId),
  ].filter(Boolean);

  return lines.join('\n');
}

function formatBuyerCard(buyer) {
  const lines = [
    boldHeader(buyer.name),
    bulletLine('Phone', cleanPhone(buyer.phone)),
    bulletLine('Email', buyer.email),
    bulletLine('Budget', formatMoney(buyer.budget)),
    bulletLine('Preferred Area', buyer.preferredArea),
    bulletLine('Property Type', buyer.propertyType),
    bulletLine('BHK', buyer.bhk),
    bulletLine('Status', buyer.status && capitalize(buyer.status)),
    bulletLine('Buyer ID', buyer.buyerId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatOwnerCard(owner) {
  const lines = [
    boldHeader(owner.name),
    bulletLine('Phone', cleanPhone(owner.phone)),
    bulletLine('Email', owner.email),
    bulletLine('Status', owner.status && capitalize(owner.status)),
    bulletLine('Owner ID', owner.ownerId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatTenantCard(tenant) {
  const lines = [
    boldHeader(tenant.name),
    bulletLine('Phone', cleanPhone(tenant.phone)),
    bulletLine('Email', tenant.email),
    bulletLine('Budget', formatMoney(tenant.budget)),
    bulletLine('Preferred Area', tenant.preferredArea),
    bulletLine('Status', tenant.status && capitalize(tenant.status)),
    bulletLine('Tenant ID', tenant.customerId || tenant.tenantRecordId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatPropertyCard(property) {
  const lines = [
    boldHeader(property.title || `${property.propertyType || 'Property'} in ${property.area || property.city || 'Unknown'}`),
    bulletLine('Type', property.propertyType),
    bulletLine('Status', property.status && capitalize(property.status)),
    bulletLine('Area', property.area),
    bulletLine('City', property.city),
    property.bhk ? `• BHK: ${property.bhk}BHK` : null,
    bulletLine('Furnishing', property.furnishing),
    bulletLine('Rent', formatMoney(property.monthlyRent)),
    bulletLine('Sale Price', formatMoney(property.salePrice)),
    bulletLine('Owner', property.ownerName || property.ownerId),
    bulletLine('Property ID', property.propertyId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatContactCard(contact) {
  const lines = [
    boldHeader(contact.name),
    bulletLine('Phone', cleanPhone(contact.phone)),
    bulletLine('Email', contact.email),
    bulletLine('Role', contact.role && capitalize(contact.role)),
    bulletLine('Status', contact.status && capitalize(contact.status)),
    bulletLine('Contact ID', contact.contactId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatMeetingCard(meeting) {
  const lines = [
    boldHeader(meeting.title),
    bulletLine('Date', formatDate(meeting.scheduledDate)),
    bulletLine('Status', meeting.status && capitalize(meeting.status)),
    bulletLine('Location', meeting.location),
    bulletLine('Related to', `${meeting.relatedEntityType} ${meeting.relatedEntityId || ''}`),
    bulletLine('Meeting ID', meeting.meetingId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatNoteCard(note) {
  const lines = [
    boldHeader(note.title || 'Note'),
    bulletLine('Date', formatDate(note.createdAt || note.date)),
    bulletLine('By', note.createdBy || note.author),
    bulletLine('Content', note.content || note.text),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatDocumentCard(doc) {
  const lines = [
    boldHeader(doc.title || 'Document'),
    bulletLine('Type', capitalize(doc.documentType || doc.type)),
    bulletLine('URL', doc.url || doc.documentUrl),
    bulletLine('Document ID', doc.documentId),
  ].filter(Boolean);
  return lines.join('\n');
}

function formatMetricsCard(metrics) {
  const lines = [boldHeader('CRM Metrics')];
  for (const [k, v] of Object.entries(metrics)) {
    if (v !== undefined && v !== null && typeof v !== 'object') {
      lines.push(bulletLine(humanize(k), v));
    }
  }
  return lines.filter(Boolean).join('\n') || boldHeader('Metrics updated');
}

function formatGenericCard(item) {
  const lines = [
    boldHeader(item.name || item.title || 'Result'),
    ...Object.entries(item)
      .filter(([k]) => !k.startsWith('PK') && !k.startsWith('SK') && !k.startsWith('GSI') && k !== 'history' && k !== 'tenantId')
      .slice(0, 8)
      .map(([k, v]) => bulletLine(capitalize(k), typeof v === 'object' ? null : v))
      .filter(Boolean),
  ].filter(Boolean);
  return lines.join('\n') || boldHeader('Result received');
}

function formatSingleCard(item) {
  const type = detectEntityType(item);
  switch (type) {
    case 'lead': return formatLeadCard(item);
    case 'buyer': return formatBuyerCard(item);
    case 'owner': return formatOwnerCard(item);
    case 'tenant': return formatTenantCard(item);
    case 'property': return formatPropertyCard(item);
    case 'contact': return formatContactCard(item);
    case 'meeting': return formatMeetingCard(item);
    case 'note': return formatNoteCard(item);
    case 'document': return formatDocumentCard(item);
    case 'metrics': return formatMetricsCard(item);
    default: return formatGenericCard(item);
  }
}

// ─── List item formatters ──────────────────────────────────────────────────────

function formatLeadListItem(lead, index) {
  const type = lead.leadType || 'lead';
  const typeField = {
    buyer: lead.buyerRequirement,
    seller: lead.sellerProperty,
    tenant: lead.tenantRequirement,
    owner: lead.ownerProperty,
  }[type];

  const money = formatMoney(pick(typeField, 'budget', 'expectedPrice', 'rentExpected'));
  const area = pick(typeField, 'preferredArea', 'area', 'city');
  const bhk = pick(typeField, 'bhk');

  const tags = [
    capitalize(type),
    lead.status && capitalize(lead.status),
    lead.priority && capitalize(lead.priority),
  ].filter(Boolean);

  const body = joinNonEmpty([
    money,
    area,
    bhk ? `${bhk}BHK` : null,
  ]);

  return `${index}. *${lead.name}* ${tags.length ? `(${tags.join(', ')})` : ''}${body ? `\n   ${body}` : ''}`;
}

function formatBuyerListItem(buyer, index) {
  return `${index}. *${buyer.name}* ${buyer.status ? `(${capitalize(buyer.status)})` : ''}\n   ${joinNonEmpty([formatMoney(buyer.budget), buyer.preferredArea, buyer.bhk ? `${buyer.bhk}BHK` : null])}`;
}

function formatOwnerListItem(owner, index) {
  return `${index}. *${owner.name}* ${owner.status ? `(${capitalize(owner.status)})` : ''}\n   ${joinNonEmpty([cleanPhone(owner.phone), owner.email])}`;
}

function formatTenantListItem(tenant, index) {
  return `${index}. *${tenant.name}* ${tenant.status ? `(${capitalize(tenant.status)})` : ''}\n   ${joinNonEmpty([formatMoney(tenant.budget), tenant.preferredArea])}`;
}

function formatPropertyListItem(property, index) {
  const title = property.title || `${property.propertyType || 'Property'} in ${property.area || property.city || 'Unknown'}`;
  return `${index}. *${title}* ${property.status ? `(${capitalize(property.status)})` : ''}\n   ${joinNonEmpty([formatMoney(property.monthlyRent || property.salePrice), property.area, property.bhk ? `${property.bhk}BHK` : null])}`;
}

function formatContactListItem(contact, index) {
  return `${index}. *${contact.name}* ${contact.role ? `(${capitalize(contact.role)})` : ''}\n   ${joinNonEmpty([cleanPhone(contact.phone), contact.email])}`;
}

function formatMeetingListItem(meeting, index) {
  return `${index}. *${meeting.title}* ${meeting.status ? `(${capitalize(meeting.status)})` : ''}\n   ${joinNonEmpty([formatDate(meeting.scheduledDate), meeting.location])}`;
}

function formatNoteListItem(note, index) {
  const text = (note.content || note.text || '').slice(0, 60);
  return `${index}. *${note.title || 'Note'}* ${note.createdAt ? `(${formatDate(note.createdAt)})` : ''}\n   ${text}${text.length >= 60 ? '...' : ''}`;
}

function formatDocumentListItem(doc, index) {
  return `${index}. *${doc.title || 'Document'}* ${doc.documentType ? `(${capitalize(doc.documentType)})` : ''}`;
}

function formatGenericListItem(item, index) {
  const name = item.name || item.title || `Result ${index}`;
  const detail = Object.entries(item)
    .filter(([k, v]) => !k.startsWith('PK') && !k.startsWith('SK') && !k.startsWith('GSI') && k !== 'history' && k !== 'tenantId' && k !== 'name' && k !== 'title' && v !== undefined && v !== null && typeof v !== 'object')
    .slice(0, 3)
    .map(([k, v]) => `${capitalize(k)}: ${v}`)
    .join(' | ');
  return `${index}. *${name}*${detail ? `\n   ${detail}` : ''}`;
}

function formatListItem(type, item, index) {
  switch (type) {
    case 'lead': return formatLeadListItem(item, index);
    case 'buyer': return formatBuyerListItem(item, index);
    case 'owner': return formatOwnerListItem(item, index);
    case 'tenant': return formatTenantListItem(item, index);
    case 'property': return formatPropertyListItem(item, index);
    case 'contact': return formatContactListItem(item, index);
    case 'meeting': return formatMeetingListItem(item, index);
    case 'note': return formatNoteListItem(item, index);
    case 'document': return formatDocumentListItem(item, index);
    default: return formatGenericListItem(item, index);
  }
}

// ─── Main list formatter ─────────────────────────────────────────────────────

function formatList(list, total, entityType, toolName) {
  const type = entityType || detectEntityTypeFromList(list, toolName);
  const items = list.slice(0, MAX_LIST_ITEMS_WITH_MORE);
  const lines = items.map((item, idx) => formatListItem(type, item, idx + 1));

  const totalCount = total !== undefined ? total : list.length;
  const intro = totalCount === 1
    ? `Here is the 1 ${type}:`
    : `Here are the ${totalCount} ${pluralize(type)}:`;
  let result = `${intro}\n\n${lines.join('\n\n')}`;

  if (totalCount > items.length) {
    const remaining = totalCount - items.length;
    result += `\n\n+${remaining} more. Reply *show more* or refine your query.`;
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .split(/[-_\s]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

function humanize(key) {
  if (!key || typeof key !== 'string') return key;
  // Split camelCase and snake_case, then capitalize each word
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

function pluralize(type) {
  const map = {
    lead: 'leads',
    buyer: 'buyers',
    seller: 'sellers',
    owner: 'owners',
    tenant: 'tenants',
    property: 'properties',
    contact: 'contacts',
    meeting: 'meetings',
    note: 'notes',
    document: 'documents',
  };
  return map[type] || `${type}s`;
}

function detectAction(toolName) {
  if (toolName.includes('create')) return 'created';
  if (toolName.includes('update')) return 'updated';
  if (toolName.includes('delete')) return 'deleted';
  if (toolName.includes('convert')) return 'converted';
  if (toolName.includes('search') || toolName.includes('find') || toolName.includes('lookup')) return 'found';
  if (toolName.includes('get') && toolName.includes('by')) return 'found';
  if (toolName.includes('get')) return 'loaded';
  return 'processed';
}

function buildConfirmationLine(toolName, data, entityType) {
  const action = detectAction(toolName);
  const name = data?.name || data?.title || '';
  const type = entityType === 'lead' && data?.leadType ? `${data.leadType} lead` : pluralize(entityType);
  return `✅ ${capitalize(type)} ${name ? `*${name}* ` : ''}${action}.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Format a single CRM tool result into a structured WhatsApp message.
 * @param {string} toolName
 * @param {any} toolResult
 * @returns {string|null}
 */
export function formatToolResult(toolName, toolResult) {
  if (!toolResult || typeof toolResult !== 'object') return null;
  if (toolResult.ok === false || toolResult.error) {
    // Let the agent handle errors with conversational context
    return null;
  }

  const data = unwrapAiDto(toolResult.data);
  const metadata = isAiDtoEnvelope(toolResult.data) ? toolResult.data.metadata : {};

  // Handle delete / boolean success results
  if (data === true || data === false) {
    if (data === true) {
      const type = entityTypeFromToolName(toolName);
      return `✅ ${capitalize(pluralize(type).replace(/s$/, ''))} ${detectAction(toolName)} successfully.`;
    }
    return null;
  }

  if (data === null || data === undefined) {
    return null;
  }

  // Determine if the result is a list or single entity
  const list = normalizeList(data);
  const entityType = list && list.length > 0
    ? detectEntityType(list[0])
    : entityTypeFromToolName(toolName);

  if (list && list.length === 0) {
    return `No ${pluralize(entityType)} found. Try a different filter or check the phone/ID.`;
  }

  if (list && list.length > 0) {
    const total = metadata.total || data.total || list.length;
    return formatList(list, total, entityType, toolName);
  }

  // Metrics object
  if (entityType === 'metrics') {
    return formatMetricsCard(data);
  }

  // Single entity action result (create/update/get)
  return `${buildConfirmationLine(toolName, data, entityType)}\n\n${formatSingleCard(data)}`;
}

/**
 * Format the final agent reply.  If the agent made CRM tool calls, prefer the
 * deterministic formatter for the tool results; otherwise return the original
 * conversational reply.
 *
 * @param {string} replyText
 * @param {Array<{tool:string, result:any}>|undefined} toolResults
 * @returns {string}
 */
export function formatAgentReply(replyText, toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return replyText || '';
  }

  // Find the most recent tool result that contains data
  const relevant = toolResults
    .slice()
    .reverse()
    .find(t => t && t.result && t.result.ok === true && t.result.data);

  if (!relevant) {
    return replyText || '';
  }

  const formatted = formatToolResult(relevant.tool, relevant.result);
  if (!formatted) {
    return replyText || '';
  }

  // Trust the deterministic formatter for tool results. The formatter generates
  // a clear intro + structured data, so we do not prepend the LLM's reply here.
  // This prevents awkward closing remarks (e.g., "Aur koi details chahiye?")
  // from appearing before the actual data.
  return formatted;
}

/**
 * Validate that a reply is reasonably structured (not a raw JSON dump).
 * @param {string} reply
 * @returns {boolean}
 */
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
 * Sanitize and validate a final reply.  Falls back to a safe formatter if the
 * reply is invalid and tool results are available.
 *
 * @param {string} replyText
 * @param {Array<{tool:string, result:any}>|undefined} toolResults
 * @returns {string}
 */
export function sanitizeAndFormatReply(replyText, toolResults) {
  const formatted = formatAgentReply(replyText, toolResults);
  if (isValidWhatsAppReply(formatted)) {
    return formatted;
  }
  if (toolResults && toolResults.length > 0) {
    const fallback = formatToolResult(
      toolResults[toolResults.length - 1].tool,
      toolResults[toolResults.length - 1].result,
    );
    if (fallback) return fallback;
  }
  return isValidWhatsAppReply(replyText) ? replyText : 'Done. Let me know if you need anything else.';
}
