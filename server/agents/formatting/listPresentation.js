/**
 * List presentation layer — filters vs layout.
 *
 * The LLM (or API) chooses *which fields* or *named template* to show.
 * This module maps that to deterministic WhatsApp lines. Add new fields or
 * templates here when product needs new list shapes — do not let the LLM format.
 */

import { getLeadRequirement } from './sections.js';
import {
  capitalize,
  formatDate,
  formatMoney,
  formatPhoneDisplay,
  cleanPhone,
  formatRelativeDate,
  joinNonEmpty,
} from './utils.js';

/** @typedef {'lead_card'|'contact'|'followup'|'assignment'|'name_only'|'custom'} ListTemplateId */

/**
 * Named templates → ordered body field ids (name is always the title line).
 * Add new presets when a recurring list shape appears in product.
 */
export const LIST_TEMPLATE_PRESETS = {
  /** Default business card */
  lead_card: ['typeStatus', 'area', 'requirement', 'budget'],
  /** Name + phone + type (dialing lists) */
  contact: ['phone', 'leadType'],
  /** Callback / overdue style */
  followup: ['phone', 'lastActivityAt', 'status'],
  /** Who owns the lead */
  assignment: ['assignedTo', 'status', 'leadType'],
  /** Names only */
  name_only: [],
};

/** All supported lead list field ids (extend when CRM exposes new list-safe fields). */
export const LEAD_LIST_FIELD_IDS = new Set([
  'phone',
  'leadType',
  'status',
  'typeStatus',
  'area',
  'requirement',
  'budget',
  'assignedTo',
  'lastActivityAt',
  'source',
  'priority',
  'email',
]);

const LEAD_TYPE_EMOJI = {
  buyer: '🛒',
  seller: '🏠',
  tenant: '🔑',
  owner: '🏢',
};

const PROPERTY_TYPE_EMOJI = {
  apartment: '🏠',
  flat: '🏠',
  house: '🏡',
  villa: '🏡',
  plot: '🏗️',
  commercial: '🏢',
  office: '🏢',
};

function leadTypeEmoji(type) {
  return LEAD_TYPE_EMOJI[String(type || '').toLowerCase()] || '🔸';
}

function propertyTypeEmoji(propertyType) {
  return PROPERTY_TYPE_EMOJI[String(propertyType || '').toLowerCase()] || '🏠';
}

function getLeadCardFields(lead) {
  const type = lead.leadType || 'lead';
  let area = lead.area || null;
  let budget = lead.budget != null && lead.budget !== '' ? lead.budget : null;
  let bhk = lead.bhk || null;
  let propertyType = lead.propertyType || null;

  if (!area && !budget && !bhk && !propertyType) {
    const req = getLeadRequirement(lead);
    area = req.area;
    budget = req.budget;
    bhk = req.bhk;
    propertyType = req.propertyType;
  }

  return {
    type,
    status: lead.status || null,
    area,
    budget: formatMoney(budget) || (typeof budget === 'string' ? budget : null),
    bhk,
    propertyType,
  };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseResponseFields(raw) {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Map legacy responseMode to a template when listTemplate / responseFields omitted.
 * @param {string} [responseMode]
 * @returns {ListTemplateId|null}
 */
function templateFromResponseMode(responseMode) {
  const mode = String(responseMode || '').toLowerCase();
  if (mode === 'summary') return 'name_only';
  return null;
}

/**
 * @param {string[]} normalized field ids (no name)
 * @returns {ListTemplateId|null}
 */
function matchExactPreset(normalized) {
  const key = (arr) => [...arr].sort().join(',');
  const want = key(normalized);
  for (const [id, fields] of Object.entries(LIST_TEMPLATE_PRESETS)) {
    if (key(fields) === want) return /** @type {ListTemplateId} */ (id);
  }
  return null;
}

/**
 * @param {string} entityType
 * @param {Record<string, unknown>} [input]
 * @returns {{ templateId: ListTemplateId, bodyFields: string[] } | null}
 */
export function resolveListPresentation(entityType, input = {}) {
  if (entityType !== 'lead') return null;

  const src = input && typeof input === 'object' ? input : {};
  const rawTemplate = src.listTemplate ? String(src.listTemplate).toLowerCase().replace(/-/g, '_') : '';
  const explicitFields = parseResponseFields(src.responseFields);

  let templateId = /** @type {ListTemplateId} */ ('lead_card');
  let bodyFields = LIST_TEMPLATE_PRESETS.lead_card;

  if (rawTemplate && LIST_TEMPLATE_PRESETS[rawTemplate]) {
    templateId = /** @type {ListTemplateId} */ (rawTemplate);
    bodyFields = LIST_TEMPLATE_PRESETS[rawTemplate];
  } else if (explicitFields.length > 0) {
    const normalized = explicitFields
      .map((f) => (f === 'type' ? 'leadType' : f))
      .filter((f) => f !== 'name' && LEAD_LIST_FIELD_IDS.has(f));
    const matched = matchExactPreset(normalized);
    if (matched) {
      templateId = matched;
      bodyFields = LIST_TEMPLATE_PRESETS[matched];
    } else {
      templateId = 'custom';
      bodyFields = normalized;
    }
  } else {
    const fromMode = templateFromResponseMode(src.responseMode);
    if (fromMode) {
      templateId = fromMode;
      bodyFields = LIST_TEMPLATE_PRESETS[fromMode];
    }
  }

  return { templateId, bodyFields };
}

/**
 * Render one body line for a field id, or null if empty.
 */
function renderLeadFieldLine(fieldId, lead, f) {
  switch (fieldId) {
    case 'phone': {
      const phone = formatPhoneDisplay(lead.phone) || cleanPhone(lead.phone);
      return phone ? `   📞 ${phone}` : null;
    }
    case 'leadType':
      return `   ${leadTypeEmoji(f.type)} ${capitalize(f.type)}`;
    case 'status':
      return f.status ? `   ${capitalize(f.status)}` : null;
    case 'typeStatus': {
      const typeStatus = joinNonEmpty([
        `${leadTypeEmoji(f.type)} ${capitalize(f.type)}`,
        f.status ? capitalize(f.status) : null,
      ], ' • ');
      return typeStatus ? `   ${typeStatus}` : null;
    }
    case 'area':
      return f.area ? `   📍 ${capitalize(f.area)}` : null;
    case 'requirement': {
      const requirement = joinNonEmpty([
        f.bhk ? `${f.bhk} BHK` : null,
        f.propertyType ? capitalize(f.propertyType) : null,
      ], ' ');
      return requirement ? `   ${propertyTypeEmoji(f.propertyType)} ${requirement}` : null;
    }
    case 'budget':
      return f.budget ? `   💰 ${f.budget}` : null;
    case 'assignedTo':
      return lead.assignedTo ? `   👤 ${lead.assignedTo}` : null;
    case 'lastActivityAt': {
      const when = formatRelativeDate(lead.lastActivityAt, { includeTime: false })
        || formatDate(lead.lastActivityAt);
      return when ? `   🕒 ${when}` : null;
    }
    case 'source':
      return lead.source ? `   🌐 ${capitalize(lead.source)}` : null;
    case 'priority':
      return lead.priority ? `   ${capitalize(lead.priority)} priority` : null;
    case 'email':
      return lead.email ? `   📧 ${lead.email}` : null;
    default:
      return null;
  }
}

/**
 * Format one lead row using resolved presentation.
 * @param {object} lead
 * @param {number} index
 * @param {{ bodyFields: string[] }} presentation
 */
export function formatLeadListItemWithPresentation(lead, index, presentation) {
  const f = getLeadCardFields(lead);
  const lines = [`${index}. *${lead.name || 'Unknown'}*`];
  for (const fieldId of presentation.bodyFields) {
    const line = renderLeadFieldLine(fieldId, lead, f);
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
