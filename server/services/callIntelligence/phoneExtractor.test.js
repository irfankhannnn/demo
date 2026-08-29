import { describe, it, expect } from '@jest/globals';
import {
  extractPhoneFromFilename,
  normalizePhoneForMatch,
  phonesEqual,
  toE164,
  MATCH_CONFIDENCE,
} from './phoneExtractor.js';

describe('extractPhoneFromFilename', () => {
  it('reads a bare 10-digit number', () => {
    const result = extractPhoneFromFilename('9876543210.mp3');
    expect(result.phone).toBe('9876543210');
    expect(result.confidence).toBe(MATCH_CONFIDENCE.HIGH);
    expect(result.e164).toBe('+919876543210');
  });

  it('handles a +91 prefix with spaces', () => {
    expect(extractPhoneFromFilename('+91 98765 43210.m4a').phone).toBe('9876543210');
  });

  it('handles a 91 country prefix without separators', () => {
    expect(extractPhoneFromFilename('919876543210.wav').phone).toBe('9876543210');
  });

  it('handles a 0 trunk prefix', () => {
    expect(extractPhoneFromFilename('09876543210.amr').phone).toBe('9876543210');
  });

  it('handles a 0091 international prefix', () => {
    expect(extractPhoneFromFilename('0091-9876543210 (owner).mp3').phone).toBe('9876543210');
  });

  it('picks the phone out of a call-recorder file name with a timestamp', () => {
    const result = extractPhoneFromFilename('Call recording Rahul_919876543210_20260809_101500.mp3');
    expect(result.phone).toBe('9876543210');
  });

  it('reads a number embedded in a WhatsApp export name', () => {
    const result = extractPhoneFromFilename('WhatsApp Audio 2026-08-09 at 9876543210.opus');
    expect(result.phone).toBe('9876543210');
  });

  it('ignores a date-only file name', () => {
    const result = extractPhoneFromFilename('20260809_101500.mp3');
    expect(result.phone).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it('rejects landline-style numbers that are not mobile', () => {
    expect(extractPhoneFromFilename('02212345678.mp3').phone).toBeNull();
  });

  it('lowers confidence when several numbers are present', () => {
    const result = extractPhoneFromFilename('9876543210_and_9812345678.mp3');
    expect(result.candidates).toHaveLength(2);
    expect(result.confidence).toBe(MATCH_CONFIDENCE.MEDIUM);
  });

  it('returns an empty result for missing input', () => {
    expect(extractPhoneFromFilename('').phone).toBeNull();
    expect(extractPhoneFromFilename(undefined).phone).toBeNull();
    expect(extractPhoneFromFilename(null).phone).toBeNull();
  });

  it('does not treat the file extension digits as a phone', () => {
    expect(extractPhoneFromFilename('recording.mp3').phone).toBeNull();
  });
});

describe('normalizePhoneForMatch', () => {
  it('collapses every Indian format to the last 10 digits', () => {
    expect(normalizePhoneForMatch('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhoneForMatch('919876543210')).toBe('9876543210');
    expect(normalizePhoneForMatch('09876543210')).toBe('9876543210');
    expect(normalizePhoneForMatch('9876543210')).toBe('9876543210');
  });

  it('is safe with empty values', () => {
    expect(normalizePhoneForMatch(null)).toBe('');
    expect(normalizePhoneForMatch('abc')).toBe('');
  });
});

describe('phonesEqual', () => {
  it('matches across formats', () => {
    expect(phonesEqual('+919876543210', '9876543210')).toBe(true);
    expect(phonesEqual('09876543210', '91 98765 43210')).toBe(true);
  });

  it('does not match different numbers or empty values', () => {
    expect(phonesEqual('9876543210', '9812345678')).toBe(false);
    expect(phonesEqual('', '9876543210')).toBe(false);
    expect(phonesEqual(null, null)).toBe(false);
  });
});

describe('toE164', () => {
  it('adds the country code to a national number', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
  });

  it('leaves an already-prefixed number alone', () => {
    expect(toE164('919876543210')).toBe('+919876543210');
  });
});
