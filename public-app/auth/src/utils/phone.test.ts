import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isIndianMobile, formatPhoneForDisplay } from './phone';

test('normalizePhone accepts the four Indian input forms', () => {
  assert.equal(normalizePhone('+919876543210'), '+919876543210');
  assert.equal(normalizePhone('919876543210'), '+919876543210');
  assert.equal(normalizePhone('09876543210'), '+919876543210');
  assert.equal(normalizePhone('9876543210'), '+919876543210');
});

test('normalizePhone strips spaces, dashes, dots and parentheses', () => {
  assert.equal(normalizePhone(' +91 98765 43210 '), '+919876543210');
  assert.equal(normalizePhone('98765-43210'), '+919876543210');
  assert.equal(normalizePhone('(0) 98765.43210'), '+919876543210');
});

test('normalizePhone rejects Indian numbers that do not start with 6-9', () => {
  assert.equal(normalizePhone('1234567890'), null);
  assert.equal(normalizePhone('+911234567890'), null);
  assert.equal(normalizePhone('05234567890'), null);
});

test('normalizePhone rejects wrong lengths and junk', () => {
  assert.equal(normalizePhone('98765'), null);
  assert.equal(normalizePhone('+91987654321'), null);
  assert.equal(normalizePhone('+9198765432101'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone('+91abcdefghij'), null);
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone(9876543210 as unknown as string), null);
});

test('normalizePhone passes through valid non-Indian E.164 numbers', () => {
  assert.equal(normalizePhone('+971501234567'), '+971501234567');
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalizePhone('+12025550123'), '+12025550123');
});

test('normalizePhone rejects non-E.164 international forms', () => {
  assert.equal(normalizePhone('00971501234567'), null);
  assert.equal(normalizePhone('+0501234567'), null);
  assert.equal(normalizePhone('+1'), null);
  assert.equal(normalizePhone('+1234567890123456'), null);
});

test('isIndianMobile and formatPhoneForDisplay', () => {
  assert.equal(isIndianMobile('+919876543210'), true);
  assert.equal(isIndianMobile('+971501234567'), false);
  assert.equal(formatPhoneForDisplay('+919876543210'), '+91 98765 43210');
  assert.equal(formatPhoneForDisplay('+971501234567'), '+971501234567');
});
