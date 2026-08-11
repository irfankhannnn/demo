/**
 * Input Normalizer — converts natural language values to structured formats
 * Handles money, dates, phone numbers for the AI agent
 */

import { logger } from '../logger.js';
import { parseResponseFields } from './formatting/listPresentation.js';

/**
 * Format a Date object as YYYY-MM-DD using local timezone.
 * Avoids toISOString() which converts to UTC and can shift the date.
 * @param {Date} date - Date object
 * @returns {string} YYYY-MM-DD format
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalize money from natural language to rupees (integer)
 * Examples: "80 lakh" → 8000000, "1.5 crore" → 15000000, "45k" → 45000
 * @param {string} value - Natural language money value
 * @returns {number|null} Normalized rupees or null if not recognized
 */
export function normalizeMoney(value) {
  if (!value || typeof value !== 'string') return null;

  const lower = value.toLowerCase().trim();

  // Remove spaces and common separators
  const cleaned = lower.replace(/\s+/g, '').replace(/,/g, '');

  // Crore: 1.5cr, 1cr, 1.5crore, etc.
  const croreMatch = cleaned.match(/^([\d.]+)c(?:r(?:ore)?)?$/);
  if (croreMatch) {
    return Math.round(parseFloat(croreMatch[1]) * 10000000);
  }

  // Lakh: 80l, 80lakh, 80 lakh, etc.
  const lakhMatch = cleaned.match(/^([\d.]+)l(?:akh)?$/);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100000);
  }

  // Thousand/K: 45k, 45000, 45 thousand, etc.
  const kMatch = cleaned.match(/^([\d.]+)(?:k|thousand)$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // Plain number (already in rupees)
  const numMatch = cleaned.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    // If it's a small number (< 1000), assume it's thousands
    if (num < 1000) return Math.round(num * 1000);
    return Math.round(num);
  }

  return null;
}

/**
 * Normalize date from natural language to YYYY-MM-DD
 * Examples: "tomorrow" → tomorrow's date, "next Monday" → next Monday's date, "2026-06-27" → "2026-06-27"
 * @param {string} value - Natural language date
 * @returns {string|null} YYYY-MM-DD format or null if not recognized
 */
export function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null;

  const lower = value.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower;
  }

  // ISO datetime with time component (e.g., "2026-06-27T15:00:00")
  if (/^\d{4}-\d{2}-\d{2}[t ]/.test(lower)) {
    return lower.slice(0, 10);
  }

  // Tomorrow
  if (lower === 'tomorrow' || lower === 'kal' || lower === 'aaj ke baad') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatLocalDate(tomorrow);
  }

  // Today
  if (lower === 'today' || lower === 'aaj') {
    return formatLocalDate(today);
  }

  // Next week (7 days from now)
  if (lower === 'next week' || lower === 'agle hafte') {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return formatLocalDate(nextWeek);
  }

  // Next month (30 days from now)
  if (lower === 'next month' || lower === 'agle mahine') {
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    return formatLocalDate(nextMonth);
  }

  // Day of week (next occurrence)
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hindiDayMap = {
    'ravivar': 0,    // Sunday
    'somvar': 1,     // Monday
    'mangalvar': 2,  // Tuesday
    'budhvar': 3,    // Wednesday
    'guruvar': 4,    // Thursday
    'shukravar': 5,  // Friday
    'shanivar': 6,    // Saturday
  };

  const dayIndex = daysOfWeek.indexOf(lower) !== -1
    ? daysOfWeek.indexOf(lower)
    : hindiDayMap[lower];

  if (dayIndex !== undefined && dayIndex !== -1) {
    const targetDay = new Date(today);
    const currentDay = targetDay.getDay();
    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
    targetDay.setDate(targetDay.getDate() + daysToAdd);
    return formatLocalDate(targetDay);
  }

  // Relative days: "in 3 days", "3 din baad"
  const relativeMatch = lower.match(/^(?:in\s+)?(\d+)\s+(?:days?|din)/);
  if (relativeMatch) {
    const daysToAdd = parseInt(relativeMatch[1], 10);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    return formatLocalDate(targetDate);
  }

  return null;
}

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '';
const DEFAULT_COUNTRY_PREFIX = DEFAULT_COUNTRY_CODE.replace(/^\+/, '');

/**
 * Normalize phone number to standard format.
 * Examples: "9876543210" → "9876543210", "+91 98765 43210" → "9876543210"
 * The country code prefix is controlled via DEFAULT_COUNTRY_CODE.
 * @param {string} value - Phone number in any format
 * @returns {string|null} Normalized 10-digit phone or null if invalid
 */
export function normalizePhone(value) {
  if (!value || typeof value !== 'string') return null;

  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // If local length + prefix length and starts with the configured country prefix, remove it and validate
  const localLength = 10;
  const fullLength = localLength + DEFAULT_COUNTRY_PREFIX.length;
  if (digits.length === fullLength && digits.startsWith(DEFAULT_COUNTRY_PREFIX)) {
    const phone = digits.slice(DEFAULT_COUNTRY_PREFIX.length);
    if (/^[6-9]\d{9}$/.test(phone)) {
      return phone;
    }
  }

  // If 10 digits, validate as local mobile number
  if (digits.length === 10) {
    if (/^[6-9]\d{9}$/.test(digits)) {
      return digits;
    }
  }

  return null;
}

const LEAD_STATUS_VALUES = new Set(['new', 'contacted', 'qualified', 'negotiating', 'lost', 'converted']);
const LEAD_TYPE_VALUES = new Set(['buyer', 'seller', 'tenant', 'owner']);
const LEAD_PRIORITY_VALUES = new Set(['low', 'medium', 'high']); // Buyer entity only — Lead uses LEAD_TEMPERATURE_VALUES
const LEAD_TEMPERATURE_VALUES = new Set(['hot', 'warm', 'cold']);
const ENTITY_STATUS_VALUES = new Set(['active', 'inactive']);
const BUYER_STATUS_VALUES = new Set(['active', 'inactive', 'purchased']);
const PROPERTY_STATUS_VALUES = new Set([
  'not-listed', 'for-sale', 'for-rent', 'rented', 'sold', 'archived',
  'available', 'inactive', 'active', 'on-hold',
]);
const PROPERTY_STATUS_ALIASES = {
  available: 'not-listed',
  inactive: 'not-listed',
  'on-hold': 'not-listed',
  active: 'for-sale',
  occupied: 'rented',
};
const CONTACT_ROLE_VALUES = new Set(['owner', 'buyer', 'seller', 'tenant']);
const PROPERTY_TYPE_VALUES = new Set(['apartment', 'house', 'villa', 'office', 'land', 'plot', 'commercial']);
const FURNISHING_VALUES = new Set(['furnished', 'semi-furnished', 'unfurnished', 'semifurnished']);

const LEAD_STATUS_TYPOS = {
  contracted: 'contacted',
  contact: 'contacted',
  qualify: 'qualified',
  qualifying: 'qualified',
  qulaified: 'qualified',
  qualifed: 'qualified',
  qualifeid: 'qualified',
  negociating: 'negotiating',
  negotiation: 'negotiating',
};

const SEARCH_QUERY_FILLER = new Set([
  'all', 'sari', 'sare', 'show', 'list', 'leads', 'lead', 'buyers', 'buyer', 'sellers', 'seller',
  'tenants', 'tenant', 'owners', 'owner', 'properties', 'property', 'contacts', 'contact',
  'customers', 'customer', 'dikhao', 'batao', 'every', 'the', 'with', 'only', 'please',
  'mujhe', 'mujhko', 'ko', 'ke', 'ka', 'records', 'record', 'crm',
]);

const TOOLS_USING_SEARCH_FIELD = new Set([
  'get_owners', 'search_contacts', 'search_tenants',
]);

function tokenizeQueryText(query) {
  return String(query || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Promote filter tokens from natural-language query text into structured fields.
 * @param {object} input
 * @param {{ statusValues?: Set<string>, typeValues?: Set<string>, priorityValues?: Set<string>, priorityField?: string, roleValues?: Set<string>, statusTypos?: object }} spec
 * @returns {object}
 */
function coerceQueryToFilters(input, spec = {}) {
  if (!input || typeof input !== 'object') return input;

  const out = { ...input };
  const q = typeof out.query === 'string' ? out.query.trim() : '';
  if (!q) return out;

  const tokens = tokenizeQueryText(q);
  if (tokens.length === 0) {
    delete out.query;
    return out;
  }

  const statusValues = spec.statusValues || new Set();
  const statusTypos = spec.statusTypos || {};
  const typeValues = spec.typeValues || new Set();
  const priorityValues = spec.priorityValues || new Set();
  const priorityField = spec.priorityField || 'priority';
  const roleValues = spec.roleValues || new Set();
  const furnishingValues = spec.furnishingValues || new Set();
  const typeField = spec.typeField || null;

  if (!out.status && statusValues.size > 0) {
    for (const token of tokens) {
      const mapped = statusTypos[token] || token;
      if (statusValues.has(mapped)) {
        out.status = mapped;
        break;
      }
    }
  }

  if (typeField && !out[typeField] && typeValues.size > 0) {
    for (const token of tokens) {
      const normalized = token === 'semifurnished' ? 'semi-furnished' : token;
      if (typeValues.has(normalized)) {
        out[typeField] = normalized;
        break;
      }
      if (typeValues.has(token)) {
        out[typeField] = token;
        break;
      }
    }
  }

  if (!out[priorityField] && priorityValues.size > 0) {
    for (const token of tokens) {
      if (priorityValues.has(token)) {
        out[priorityField] = token;
        break;
      }
    }
  }

  if (!out.role && roleValues.size > 0) {
    for (const token of tokens) {
      if (roleValues.has(token)) {
        out.role = token;
        break;
      }
    }
  }

  if (!out.furnishing && furnishingValues.size > 0) {
    for (const token of tokens) {
      const normalized = token === 'semifurnished' ? 'semi-furnished' : token;
      if (furnishingValues.has(normalized)) {
        out.furnishing = normalized;
        break;
      }
    }
  }

  const meaningful = tokens.filter((token) => {
    const mappedStatus = statusTypos[token] || token;
    const normalizedType = token === 'semifurnished' ? 'semi-furnished' : token;
    return !SEARCH_QUERY_FILLER.has(token)
      && !statusValues.has(mappedStatus)
      && !typeValues.has(token)
      && !typeValues.has(normalizedType)
      && !priorityValues.has(token)
      && !roleValues.has(token)
      && !furnishingValues.has(normalizedType);
  });

  if (meaningful.length === 0) {
    delete out.query;
  }

  return out;
}

/**
 * Planner often puts "qualified buyer leads" into query instead of status/leadType.
 * Promote known tokens to structured filters and drop filler-only query text.
 * @param {object} input
 * @returns {object}
 */
export function coerceSearchLeadsFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: LEAD_STATUS_VALUES,
    statusTypos: LEAD_STATUS_TYPOS,
    typeValues: LEAD_TYPE_VALUES,
    typeField: 'leadType',
    priorityValues: LEAD_TEMPERATURE_VALUES,
    priorityField: 'temperature',
  });
}

export function coerceSearchBuyersFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: BUYER_STATUS_VALUES,
    priorityValues: LEAD_PRIORITY_VALUES,
  });
}

export function coerceSearchPropertiesFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: PROPERTY_STATUS_VALUES,
    typeValues: PROPERTY_TYPE_VALUES,
    typeField: 'propertyType',
    furnishingValues: FURNISHING_VALUES,
  });
}

/**
 * Map agent-facing scheduledDate → backend meetingDate + meetingTime.
 * Backend createMeeting/updateMeeting require both fields.
 */
export function normalizeMeetingFields(input = {}) {
  const out = { ...input };
  const raw = out.scheduledDate;
  let meetingDate = out.meetingDate;
  let meetingTime = out.meetingTime;

  if (raw != null && raw !== '') {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}[t ]\d{1,2}:\d{2}/i.test(s)) {
      meetingDate = s.slice(0, 10);
      const timePart = s.includes('T') ? s.split('T')[1] : s.split(/\s+/)[1];
      meetingTime = timePart ? timePart.slice(0, 5) : meetingTime;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      meetingDate = s;
    } else {
      const normalized = normalizeDate(s);
      if (normalized) meetingDate = normalized;
    }
  }

  if (meetingDate && typeof meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(meetingDate)) {
    out.meetingDate = meetingDate.slice(0, 10);
  }
  if (!out.meetingTime && meetingTime) {
    out.meetingTime = String(meetingTime).slice(0, 5);
  } else if (out.meetingDate && !out.meetingTime) {
    out.meetingTime = '10:00';
  }
  if (out.meetingTime && typeof out.meetingTime === 'string') {
    const t = out.meetingTime.trim();
    if (/^\d{1,2}:\d{2}/.test(t)) {
      const [h, m] = t.split(':');
      out.meetingTime = `${String(h).padStart(2, '0')}:${m.slice(0, 2)}`;
    }
  }

  if (out.notes && !out.description) {
    out.description = out.notes;
    delete out.notes;
  }

  delete out.scheduledDate;
  return out;
}

/** Normalize property status tokens to canonical CRM values. */
export function normalizePropertyStatus(status) {
  if (status == null || status === '') return status;
  const value = String(status).trim().toLowerCase();
  return PROPERTY_STATUS_ALIASES[value] || value;
}

export function coerceSearchContactsFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: ENTITY_STATUS_VALUES,
    roleValues: CONTACT_ROLE_VALUES,
  });
}

export function coerceGetOwnersFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: ENTITY_STATUS_VALUES,
  });
}

export function coerceSearchTenantsFilters(input) {
  return coerceQueryToFilters(input, {
    statusValues: ENTITY_STATUS_VALUES,
  });
}

function mapQueryToSearchField(input) {
  if (!input?.query || input.search) return input;
  const { query, ...rest } = input;
  return { ...rest, search: query };
}

const SEARCH_FILTER_COERCERS = {
  search_leads: coerceSearchLeadsFilters,
  search_buyers: coerceSearchBuyersFilters,
  search_properties: coerceSearchPropertiesFilters,
  search_contacts: coerceSearchContactsFilters,
  get_owners: coerceGetOwnersFilters,
  search_tenants: coerceSearchTenantsFilters,
};

/**
 * Extract and normalize parameters from tool input
 * Applies normalizers to known fields
 * @param {string} toolName - Name of the tool
 * @param {object} input - Raw tool input
 * @returns {object} Normalized input
 */
export function normalizeToolInput(toolName, input) {
  if (!input || typeof input !== 'object') return input;

  const coercer = SEARCH_FILTER_COERCERS[toolName];
  let normalized = coercer ? coercer(input) : { ...input };

  if (TOOLS_USING_SEARCH_FIELD.has(toolName)) {
    normalized = mapQueryToSearchField(normalized);
  }

  if (toolName === 'create_meeting' || toolName === 'update_meeting') {
    normalized = normalizeMeetingFields(normalized);
  }

  // Normalize money fields
  const moneyFields = ['minBudget', 'maxBudget', 'budget', 'expectedPrice', 'rentExpected', 'securityDeposit', 'saleAmount', 'monthlyRent'];
  for (const field of moneyFields) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      const normalizedMoney = normalizeMoney(normalized[field]);
      if (normalizedMoney !== null) {
        normalized[field] = normalizedMoney;
      } else {
        logger.debug('inputNormalizer.money_failed', { toolName, field, value: normalized[field] });
      }
    }
  }

  // Normalize date fields (scheduledDate handled by normalizeMeetingFields for meetings)
  const dateFields = ['leaseStartDate', 'leaseEndDate', 'purchaseDate', 'moveInDate', 'fromDate', 'toDate'];
  for (const field of dateFields) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      const normalizedDate = normalizeDate(normalized[field]);
      if (normalizedDate !== null) {
        normalized[field] = normalizedDate;
      } else {
        logger.debug('inputNormalizer.date_failed', { toolName, field, value: normalized[field] });
      }
    }
  }

  // Normalize phone fields
  const phoneFields = ['phone'];
  for (const field of phoneFields) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      const normalizedPhone = normalizePhone(normalized[field]);
      if (normalizedPhone !== null) {
        normalized[field] = normalizedPhone;
      } else {
        logger.debug('inputNormalizer.phone_failed', { toolName, field, value: normalized[field] });
      }
    }
  }

  // Enum-like CRM filters must be lowercase. The planner often copies Title Case
  // labels from WhatsApp history ("Qualified", "Contacted", "Buyer") while DB
  // stores lowercase ("qualified", "contacted", "buyer") — strict === then
  // returns zero rows.
  const enumFields = [
    'status', 'leadType', 'priority', 'role', 'propertyType', 'furnishing',
    'sortBy', 'responseMode', 'relatedEntityType',
  ];
  for (const field of enumFields) {
    if (typeof normalized[field] === 'string' && normalized[field].trim()) {
      let value = normalized[field].trim().toLowerCase();
      if (field === 'status' && LEAD_STATUS_TYPOS[value]) {
        value = LEAD_STATUS_TYPOS[value];
      }
      if (field === 'furnishing' && value === 'semifurnished') {
        value = 'semi-furnished';
      }
      normalized[field] = value;
    }
  }

  if (normalized.listTemplate) {
    normalized.listTemplate = String(normalized.listTemplate).toLowerCase().replace(/-/g, '_');
  }
  if (normalized.responseFields != null) {
    const fields = parseResponseFields(normalized.responseFields);
    if (fields.length) normalized.responseFields = fields;
    else delete normalized.responseFields;
  }

  if (
    toolName === 'search_properties'
    || toolName === 'update_property'
    || toolName === 'create_property'
  ) {
    if (normalized.status) {
      normalized.status = normalizePropertyStatus(normalized.status);
    }
  }

  return normalized;
}

export default {
  normalizeMoney,
  normalizeDate,
  normalizePhone,
  coerceSearchLeadsFilters,
  coerceSearchBuyersFilters,
  coerceSearchPropertiesFilters,
  coerceSearchContactsFilters,
  coerceGetOwnersFilters,
  coerceSearchTenantsFilters,
  normalizeMeetingFields,
  normalizePropertyStatus,
  normalizeToolInput,
};
