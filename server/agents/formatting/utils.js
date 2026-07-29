/**
 * Shared formatting utilities for WhatsApp response templates.
 */

export function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && value.includes('₹')) return value;
  const num = Number(value);
  if (Number.isNaN(num)) return null;

  const crore = 10000000;
  const lakh = 100000;
  const thousand = 1000;

  function trimDecimal(n) {
    return String(n).replace(/\.?0+$/, '');
  }

  if (Math.abs(num) >= crore) return `₹${trimDecimal((num / crore).toFixed(2))}Cr`;
  if (Math.abs(num) >= lakh) return `₹${trimDecimal((num / lakh).toFixed(2))}L`;
  if (Math.abs(num) >= thousand) return `₹${trimDecimal((num / thousand).toFixed(1))}k`;
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Parse ISO / date-only strings into a Date using local calendar for YYYY-MM-DD
 * (avoids UTC midnight shifting the day in IST).
 */
function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Absolute short date: 19 Jul 2026
 */
export function formatDate(value) {
  const d = parseDateValue(value);
  if (!d) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Relative when within ±1 calendar day; otherwise absolute.
 * With time when hour/minute present and not midnight-only noise.
 */
export function formatRelativeDate(value, { includeTime = true } = {}) {
  const d = parseDateValue(value);
  if (!d) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86400000);

  const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const hasTime = includeTime && !isDateOnly && (d.getHours() !== 0 || d.getMinutes() !== 0);
  const timePart = hasTime
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  let label;
  if (dayDiff === 0) label = 'Today';
  else if (dayDiff === -1) label = 'Yesterday';
  else if (dayDiff === 1) label = 'Tomorrow';
  else return formatDate(value);

  return timePart ? `${label} (${timePart})` : label;
}

export function formatBudgetRange(min, max, single) {
  const a = formatMoney(min);
  const b = formatMoney(max);
  if (a && b && a !== b) return `${a} – ${b}`;
  return formatMoney(single) || a || b || null;
}

export function formatPhoneDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const ten = digits.slice(-10);
  if (ten.length === 10) return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  return `+${digits}`;
}

export function cleanPhone(phone) {
  if (!phone) return null;
  const s = String(phone).replace(/\D/g, '');
  return s.length > 0 ? s : null;
}

export function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

export function joinNonEmpty(parts, sep = ' | ') {
  return parts.filter(Boolean).join(sep);
}

export function bulletLine(label, value) {
  return value !== undefined && value !== null && value !== '' ? `• ${label}: ${value}` : null;
}

export function boldHeader(text) {
  return text ? `*${text}*` : '';
}

export function capitalize(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .split(/[-_\s]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function humanize(key) {
  if (!key || typeof key !== 'string') return key;
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function pluralize(type) {
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

export const STATUS_DOT = {
  new: '🔵',
  contacted: '🟠',
  qualified: '🟢',
  negotiating: '🟡',
  converted: '✅',
  lost: '🔴',
  active: '🟢',
  inactive: '⚪',
  deleted: '⚪',
  available: '🟢',
  'for-sale': '🟢',
  'for-rent': '🟢',
  scheduled: '🔵',
  completed: '✅',
  cancelled: '🔴',
  pending: '🟠',
};

export function statusDot(status) {
  return STATUS_DOT[String(status || '').toLowerCase()] || '🟢';
}
