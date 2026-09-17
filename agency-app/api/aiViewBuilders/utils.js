/**
 * Shared utilities for AI view builders.
 * Used by LeadAIViewBuilder, OwnerAIViewBuilder, TenantAIViewBuilder, MeetingAIViewBuilder.
 */

/**
 * Format a date string to YYYY-MM-DD
 * @param {string|Date|null} value
 * @returns {string|null}
 */
export function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Format a number as compact Indian currency.
 * @param {number|string|null} value
 * @returns {string|null}
 */
export function formatMoney(value) {
  if (value === undefined || value === null || value === '') return null;
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
 * Format a phone number to last 10 digits
 * @param {string|null} phone
 * @returns {string|null}
 */
export function formatPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10) || null;
}

/**
 * Build standard AI DTO envelope
 * @param {Object} data
 * @param {Object} metadata
 * @returns {Object} { metadata, data }
 */
export function buildEnvelope(data, metadata = {}) {
  return {
    metadata,
    data,
  };
}

/**
 * Build pagination metadata
 * @param {number} total
 * @param {number} shown
 * @param {boolean} hasMore
 * @param {string|null} nextCursor
 * @returns {Object}
 */
export function buildPaginationMetadata(total, shown, hasMore, nextCursor = null) {
  return {
    total,
    shown,
    hasMore,
    ...(nextCursor && { nextCursor }),
  };
}

export default {
  formatDate,
  formatMoney,
  formatPhone,
  buildEnvelope,
  buildPaginationMetadata,
};
