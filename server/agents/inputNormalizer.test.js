/**
 * Unit tests for inputNormalizer.js
 */

import {
  normalizeMoney,
  normalizeDate,
  normalizePhone,
  normalizeToolInput,
} from './inputNormalizer.js';

describe('normalizeMoney', () => {
  test('converts crore values', () => {
    expect(normalizeMoney('1.5Cr')).toBe(15000000);
    expect(normalizeMoney('1 crore')).toBe(10000000);
    expect(normalizeMoney('2.5cr')).toBe(25000000);
  });

  test('converts lakh values', () => {
    expect(normalizeMoney('80L')).toBe(8000000);
    expect(normalizeMoney('80 lakh')).toBe(8000000);
    expect(normalizeMoney('1.5l')).toBe(150000);
  });

  test('converts thousand values', () => {
    expect(normalizeMoney('45k')).toBe(45000);
    expect(normalizeMoney('100 thousand')).toBe(100000);
  });

  test('converts plain numbers', () => {
    expect(normalizeMoney('5000000')).toBe(5000000);
    expect(normalizeMoney('500')).toBe(500000); // small number assumed to be thousands
  });

  test('returns null for invalid values', () => {
    expect(normalizeMoney('')).toBeNull();
    expect(normalizeMoney(null)).toBeNull();
    expect(normalizeMoney('abc')).toBeNull();
  });
});

describe('normalizeDate', () => {
  test('passes through ISO date strings', () => {
    expect(normalizeDate('2026-06-27')).toBe('2026-06-27');
  });

  test('extracts date from ISO datetime', () => {
    expect(normalizeDate('2026-06-27T15:00:00')).toBe('2026-06-27');
  });

  test('returns tomorrow', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(normalizeDate('tomorrow')).toBe(expected);
    expect(normalizeDate('kal')).toBe(expected);
  });

  test('returns next week', () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const expected = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    expect(normalizeDate('next week')).toBe(expected);
    expect(normalizeDate('agle hafte')).toBe(expected);
  });

  test('returns correct next occurrence of day of week', () => {
    // Test English days
    const today = new Date();
    const todayDay = today.getDay();
    const daysToNextMonday = (1 - todayDay + 7) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    const expected = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`;
    expect(normalizeDate('monday')).toBe(expected);
  });

  test('returns correct Hindi day mappings', () => {
    const today = new Date();
    const todayDay = today.getDay();
    // Somvar = Monday = day 1
    const daysToNextMonday = (1 - todayDay + 7) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    const expectedMonday = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`;
    expect(normalizeDate('somvar')).toBe(expectedMonday);

    // Ravivar = Sunday = day 0
    const daysToNextSunday = (0 - todayDay + 7) % 7 || 7;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysToNextSunday);
    const expectedSunday = `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, '0')}-${String(nextSunday.getDate()).padStart(2, '0')}`;
    expect(normalizeDate('ravivar')).toBe(expectedSunday);
  });

  test('returns null for invalid dates', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('abc')).toBeNull();
  });
});

describe('normalizePhone', () => {
  test('normalizes 10-digit Indian mobile numbers', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  test('normalizes +91 numbers', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('91-9876543210')).toBe('9876543210');
  });

  test('rejects invalid numbers', () => {
    expect(normalizePhone('1234567890')).toBeNull(); // starts with 1
    expect(normalizePhone('5678901234')).toBeNull(); // starts with 5
    expect(normalizePhone('987654321')).toBeNull();  // 9 digits
    expect(normalizePhone('abcdefghij')).toBeNull();
  });

  test('returns null for empty or null values', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('normalizeToolInput', () => {
  test('normalizes money fields', () => {
    const input = {
      minBudget: '80L',
      maxBudget: '1.5Cr',
      rentExpected: '45k',
    };
    const result = normalizeToolInput('search_leads', input);
    expect(result.minBudget).toBe(8000000);
    expect(result.maxBudget).toBe(15000000);
    expect(result.rentExpected).toBe(45000);
  });

  test('normalizes date fields', () => {
    const input = { scheduledDate: 'tomorrow' };
    const result = normalizeToolInput('create_meeting', input);
    expect(result.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('normalizes phone fields', () => {
    const input = { phone: '+91 98765 43210' };
    const result = normalizeToolInput('create_lead', input);
    expect(result.phone).toBe('9876543210');
  });

  test('preserves non-string values', () => {
    const input = { minBudget: 5000000, phone: 9876543210 };
    const result = normalizeToolInput('search_leads', input);
    expect(result.minBudget).toBe(5000000);
    expect(result.phone).toBe(9876543210);
  });

  test('returns non-object input as-is', () => {
    expect(normalizeToolInput('tool', null)).toBeNull();
    expect(normalizeToolInput('tool', 'string')).toBe('string');
  });
});
