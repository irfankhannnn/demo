/**
 * Input Normalizer — converts natural language values to structured formats
 * Handles money, dates, phone numbers for the AI agent
 */

import { logger } from '../logger.js';

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

/**
 * Normalize phone number to standard format
 * Examples: "9876543210" → "9876543210", "+91 98765 43210" → "9876543210"
 * @param {string} value - Phone number in any format
 * @returns {string|null} Normalized 10-digit phone or null if invalid
 */
export function normalizePhone(value) {
  if (!value || typeof value !== 'string') return null;

  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // If 12 digits and starts with 91, remove the 91 and validate
  if (digits.length === 12 && digits.startsWith('91')) {
    const phone = digits.slice(2);
    // Validate Indian mobile number format (starts with 6-9)
    if (/^[6-9]\d{9}$/.test(phone)) {
      return phone;
    }
  }

  // If 10 digits, validate as Indian mobile number
  if (digits.length === 10) {
    if (/^[6-9]\d{9}$/.test(digits)) {
      return digits;
    }
  }

  return null;
}

/**
 * Extract and normalize parameters from tool input
 * Applies normalizers to known fields
 * @param {string} toolName - Name of the tool
 * @param {object} input - Raw tool input
 * @returns {object} Normalized input
 */
export function normalizeToolInput(toolName, input) {
  if (!input || typeof input !== 'object') return input;

  const normalized = { ...input };

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

  // Normalize date fields
  const dateFields = ['scheduledDate', 'leaseStartDate', 'leaseEndDate', 'purchaseDate', 'moveInDate', 'fromDate', 'toDate'];
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

  return normalized;
}

export default {
  normalizeMoney,
  normalizeDate,
  normalizePhone,
  normalizeToolInput,
};
