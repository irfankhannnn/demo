/**
 * Numbered list row formatters (Interaction Design v1).
 */

import {
  capitalize,
  cleanPhone,
  formatDate,
  formatMoney,
  formatPhoneDisplay,
  joinNonEmpty,
  pluralize,
} from './utils.js';

import {
  formatLeadListItemWithPresentation,
  resolveListPresentation,
  LIST_TEMPLATE_PRESETS,
} from './listPresentation.js';

export function formatLeadListItem(lead, index, options = {}) {
  const presentation = options.presentation
    || resolveListPresentation('lead', options.input || {})
    || { templateId: 'lead_card', bodyFields: LIST_TEMPLATE_PRESETS.lead_card };
  return formatLeadListItemWithPresentation(lead, index, presentation);
}

export function formatBuyerListItem(buyer, index) {
  return `${index}. *${buyer.name}* ${buyer.status ? `(${capitalize(buyer.status)})` : ''}\n   ${joinNonEmpty([formatMoney(buyer.budget), buyer.preferredArea, buyer.bhk ? `${buyer.bhk} BHK` : null])}`;
}

export function formatOwnerListItem(owner, index) {
  return `${index}. *${owner.name}* ${owner.status ? `(${capitalize(owner.status)})` : ''}\n   ${joinNonEmpty([formatPhoneDisplay(owner.phone) || cleanPhone(owner.phone), owner.propertyCount != null ? `${owner.propertyCount} props` : null])}`;
}

export function formatTenantListItem(tenant, index) {
  return `${index}. *${tenant.name}* ${tenant.status ? `(${capitalize(tenant.status)})` : ''}\n   ${joinNonEmpty([formatMoney(tenant.budget), tenant.preferredArea])}`;
}

export function formatPropertyListItem(property, index) {
  const title = property.title || `${property.propertyType || 'Property'} in ${property.area || property.city || 'Unknown'}`;
  return `${index}. *${title}* ${property.status ? `(${capitalize(property.status)})` : ''}\n   ${joinNonEmpty([formatMoney(property.monthlyRent || property.salePrice || property.price), property.area, property.bhk ? `${property.bhk} BHK` : null])}`;
}

export function formatContactListItem(contact, index) {
  return `${index}. *${contact.name}* ${contact.role ? `(${capitalize(contact.role)})` : ''}\n   ${joinNonEmpty([formatPhoneDisplay(contact.phone) || cleanPhone(contact.phone), contact.email])}`;
}

export function formatMeetingListItem(meeting, index) {
  return `${index}. *${meeting.title}* ${meeting.status ? `(${capitalize(meeting.status)})` : ''}\n   ${joinNonEmpty([formatDate(meeting.scheduledDate), meeting.location || meeting.relatedEntityName])}`;
}

export function formatNoteListItem(note, index) {
  const text = (note.content || note.text || '').slice(0, 60);
  return `${index}. *${note.title || 'Note'}* ${note.createdAt ? `(${formatDate(note.createdAt)})` : ''}\n   ${text}${text.length >= 60 ? '...' : ''}`;
}

export function formatDocumentListItem(doc, index) {
  return `${index}. *${doc.title || 'Document'}* ${doc.documentType ? `(${capitalize(doc.documentType)})` : ''}`;
}

export function formatGenericListItem(item, index) {
  const name = item.name || item.title || `Result ${index}`;
  const detail = Object.entries(item)
    .filter(([k, v]) => !k.startsWith('PK') && !k.startsWith('SK') && !k.startsWith('GSI')
      && k !== 'history' && k !== 'tenantId' && k !== 'name' && k !== 'title'
      && !k.endsWith('Id') && !k.endsWith('ID')
      && v !== undefined && v !== null && typeof v !== 'object')
    .slice(0, 3)
    .map(([k, v]) => `${capitalize(k)}: ${v}`)
    .join(' | ');
  return `${index}. *${name}*${detail ? `\n   ${detail}` : ''}`;
}

export function formatListItem(type, item, index, options = {}) {
  switch (type) {
    case 'lead': return formatLeadListItem(item, index, options);
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

const ENTITY_LIST_EMOJI = {
  lead: '📋',
  buyer: '🛒',
  seller: '🏠',
  owner: '🏢',
  tenant: '🔑',
  property: '🏢',
  contact: '👤',
  meeting: '📅',
  note: '📝',
  document: '📄',
};

const TEMPERATURE_TITLE = {
  hot: ['🔥', 'Hot'],
  warm: ['🌤️', 'Warm'],
  cold: ['❄️', 'Cold'],
};

const STATUS_TITLE = {
  new: ['🆕', 'New'],
  contacted: ['☎️', 'Contacted'],
  qualified: ['✅', 'Qualified'],
  negotiating: ['🤝', 'Negotiating'],
  lost: ['❌', 'Lost'],
  converted: ['🎉', 'Converted'],
};

const LEAD_TYPE_TITLE = {
  buyer: ['🛒', 'Buyer'],
  seller: ['🏠', 'Seller'],
  tenant: ['🔑', 'Tenant'],
  owner: ['🏢', 'Owner'],
};

/**
 * Build a dynamic "Lead Card List" title from the filters used in the query.
 * The card layout never changes — only the title reflects the query.
 */
export function buildLeadListTitle(input = {}, total = 0, items = []) {
  const src = input && typeof input === 'object' ? input : {};
  const temperature = String(src.temperature || '').toLowerCase();
  const status = String(src.status || '').toLowerCase();
  const type = String(src.leadType || src.type || '').toLowerCase();
  const propertyType = src.propertyType ? capitalize(src.propertyType) : null;
  const bhk = src.bhk || null;
  const area = src.area || src.city || null;
  const source = src.source ? capitalize(src.source) : null;
  const query = typeof src.query === 'string' ? src.query.trim() : '';
  const minBudget = src.minBudget || src.budgetMin || null;
  const maxBudget = src.maxBudget || src.budgetMax || null;

  let emoji = '📋';
  let emojiSet = false;
  const setEmoji = (e) => { if (!emojiSet && e) { emoji = e; emojiSet = true; } };

  const words = [];
  if (TEMPERATURE_TITLE[temperature]) { setEmoji(TEMPERATURE_TITLE[temperature][0]); words.push(TEMPERATURE_TITLE[temperature][1]); }
  if (STATUS_TITLE[status]) { setEmoji(STATUS_TITLE[status][0]); words.push(STATUS_TITLE[status][1]); }
  if (bhk) { setEmoji('🛏️'); words.push(`${bhk} BHK`); }
  if (propertyType) { setEmoji('🏢'); words.push(propertyType); }
  if (LEAD_TYPE_TITLE[type]) { setEmoji(LEAD_TYPE_TITLE[type][0]); words.push(LEAD_TYPE_TITLE[type][1]); }

  let label = joinNonEmpty([words.join(' '), 'Leads'], ' ');

  // A bare query that matches the area of the returned leads reads as a location filter.
  const queryLooksLikeArea = query && query.length >= 2
    && Array.isArray(items) && items.length > 0
    && items.some((it) => String(it?.area || '').toLowerCase().includes(query.toLowerCase()));

  const suffixes = [];
  if (area) { setEmoji('📍'); suffixes.push(`in ${capitalize(area)}`); }
  else if (queryLooksLikeArea) { setEmoji('📍'); suffixes.push(`in ${capitalize(query)}`); }
  else if (query && query.length >= 2) { setEmoji('🔍'); suffixes.push(`matching "${query}"`); }

  if (minBudget && maxBudget) { setEmoji('💰'); suffixes.push(`(${formatMoney(minBudget)} – ${formatMoney(maxBudget)})`); }
  else if (minBudget) { setEmoji('💰'); suffixes.push(`above ${formatMoney(minBudget)}`); }
  else if (maxBudget) { setEmoji('💰'); suffixes.push(`below ${formatMoney(maxBudget)}`); }

  if (source) { setEmoji('🌐'); suffixes.push(`from ${source}`); }

  const suffix = suffixes.length ? ` ${suffixes.join(' ')}` : '';
  return `${emoji} *${label}${suffix} (${total})*`;
}

function buildListTitle(entityType, totalCount, options = {}) {
  if (entityType === 'lead') {
    return buildLeadListTitle(options.input || {}, totalCount, options.items || []);
  }
  const emoji = ENTITY_LIST_EMOJI[entityType] || '📋';
  return `${emoji} *${capitalize(pluralize(entityType))} (${totalCount})*`;
}

export function formatList(list, total, entityType, maxItems, options = {}) {
  const items = list.slice(0, maxItems);
  const presentation = entityType === 'lead'
    ? resolveListPresentation('lead', options.input || {})
    : null;
  const rowOptions = presentation
    ? { ...options, presentation }
    : options;
  const lines = items.map((item, idx) => formatListItem(entityType, item, idx + 1, rowOptions));
  const totalCount = total !== undefined ? total : list.length;
  const title = buildListTitle(entityType, totalCount, { ...options, items });
  let result = `${title}\n\n${lines.join('\n\n')}`;
  if (totalCount > items.length) {
    const remaining = totalCount - items.length;
    result += `\n\n+${remaining} more. Reply *show more* or refine your query.`;
  }
  return result;
}
