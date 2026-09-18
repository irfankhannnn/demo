import { describe, expect, it } from 'vitest';
import {
  formatCompactRupees,
  formatRupees,
  formatFullRupees,
  formatIndianNumber,
  formatRelativeTime,
  formatMatchPercent,
  formatTimeLabel,
  maskPhone,
  normalisePhone,
  formatBhk,
  titleCase,
  truncate,
} from './format';

describe('formatCompactRupees / formatRupees', () => {
  it('formats lakhs', () => {
    expect(formatCompactRupees(8_000_000)).toBe('₹80 L');
    expect(formatCompactRupees(8_500_000)).toBe('₹85 L');
    expect(formatCompactRupees(4_550_000)).toBe('₹45.5 L');
  });

  it('formats crores', () => {
    expect(formatCompactRupees(12_000_000)).toBe('₹1.2 Cr');
    expect(formatCompactRupees(10_000_000)).toBe('₹1 Cr');
    expect(formatCompactRupees(125_500_000)).toBe('₹12.55 Cr');
  });

  it('formats thousands and small numbers', () => {
    expect(formatCompactRupees(45_000)).toBe('₹45k');
    expect(formatCompactRupees(1_500)).toBe('₹1.5k');
    expect(formatCompactRupees(900)).toBe('₹900');
  });

  it('adds /mo for rent and handles null', () => {
    expect(formatRupees(45_000, 'rent')).toBe('₹45k/mo');
    expect(formatRupees(8_000_000, 'sale')).toBe('₹80 L');
    expect(formatRupees(null)).toBe('Price on request');
  });

  it('uses Indian digit grouping for full prices', () => {
    expect(formatIndianNumber(8_500_000)).toBe('85,00,000');
    expect(formatFullRupees(1_23_45_678)).toBe('₹1,23,45,678');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-17T12:00:00Z');
  it('buckets by seconds/minutes/hours/days', () => {
    expect(formatRelativeTime('2026-09-17T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-09-17T11:55:00Z', now)).toBe('5m ago');
    expect(formatRelativeTime('2026-09-17T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-09-15T12:00:00Z', now)).toBe('2d ago');
  });
  it('falls back to a date beyond a week', () => {
    expect(formatRelativeTime('2026-08-12T12:00:00Z', now)).toMatch(/Aug/);
  });
  it('is empty for garbage', () => {
    expect(formatRelativeTime('nope', now)).toBe('');
    expect(formatRelativeTime(null, now)).toBe('');
  });
});

describe('misc helpers', () => {
  it('formats match percent', () => {
    expect(formatMatchPercent(0.81)).toBe('81%');
    expect(formatMatchPercent(1.4)).toBe('100%');
    expect(formatMatchPercent(undefined)).toBeNull();
  });
  it('formats 24h time labels', () => {
    expect(formatTimeLabel('10:00')).toBe('10:00 AM');
    expect(formatTimeLabel('15:30')).toBe('3:30 PM');
    expect(formatTimeLabel('00:15')).toBe('12:15 AM');
  });
  it('masks and normalises phones', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98•••• ••210');
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalisePhone('12345')).toBeNull();
  });
  it('title-cases and formats bhk', () => {
    expect(titleCase('semi-furnished')).toBe('Semi furnished');
    expect(formatBhk(2)).toBe('2 BHK');
    expect(formatBhk(null)).toBeNull();
  });
  it('truncates', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
    expect(truncate('hi', 6)).toBe('hi');
  });
});
