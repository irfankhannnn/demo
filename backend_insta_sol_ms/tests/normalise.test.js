import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toBudgetBracket,
  toRupees,
  normalisePhone,
  maskPhone,
  normaliseIntent,
  normaliseTemperature,
  normaliseStatus,
  normaliseWindowState,
  toDateKey,
  BUDGET_BRACKETS,
} from '../services/normalise.js';

test('budget brackets cover the boundaries without gaps or overlaps', () => {
  assert.equal(toBudgetBracket(24_99_999), 'under_25L');
  assert.equal(toBudgetBracket(25_00_000), '25L_50L');
  assert.equal(toBudgetBracket(49_99_999), '25L_50L');
  assert.equal(toBudgetBracket(50_00_000), '50L_1Cr');
  assert.equal(toBudgetBracket(99_99_999), '50L_1Cr');
  assert.equal(toBudgetBracket(1_00_00_000), '1Cr_2Cr');
  assert.equal(toBudgetBracket(1_99_99_999), '1Cr_2Cr');
  assert.equal(toBudgetBracket(2_00_00_000), '2Cr_5Cr');
  assert.equal(toBudgetBracket(5_00_00_000), 'above_5Cr');
});

test('every bracket returned is a member of the published enum', () => {
  const inputs = [0, 10_00_000, '45 lakh', '2.5cr', 'no idea', null, undefined, '₹75,00,000'];
  for (const i of inputs) {
    assert.ok(BUDGET_BRACKETS.includes(toBudgetBracket(i)), `bad bracket for ${String(i)}`);
  }
});

test('budget shorthand from a DM parses to rupees', () => {
  assert.equal(toRupees('50L'), 50_00_000);
  assert.equal(toRupees('45 lakhs'), 45_00_000);
  assert.equal(toRupees('1.2 Cr'), 1_20_00_000);
  assert.equal(toRupees('2.5cr'), 2_50_00_000);
  assert.equal(toRupees('budget 60 lakh'), 60_00_000);
  assert.equal(toRupees('₹75,00,000'), 75_00_000);
  assert.equal(toRupees('35k'), 35_000);
});

test('a range is bracketed by its floor', () => {
  assert.equal(toBudgetBracket('50-60 lakh'), '50L_1Cr');
});

test('a unit only counts when it is adjacent to the number', () => {
  // "rental" ends in an l; reading that as lakhs would be wrong.
  assert.equal(toRupees('rental 2 cr'), 2_00_00_000);
});

test('unparseable budgets fall back to unknown rather than throwing', () => {
  assert.equal(toBudgetBracket('kuch bhi'), 'unknown');
  assert.equal(toBudgetBracket(null), 'unknown');
  assert.equal(toBudgetBracket(undefined), 'unknown');
  assert.equal(toBudgetBracket({}), 'unknown');
  assert.equal(toBudgetBracket(-5), 'unknown');
});

test('Indian phone numbers normalise to E.164', () => {
  assert.equal(normalisePhone('9876543210'), '+919876543210');
  assert.equal(normalisePhone('09876543210'), '+919876543210');
  assert.equal(normalisePhone('+91 98765 43210'), '+919876543210');
  assert.equal(normalisePhone('91-9876-543210'), '+919876543210');
  assert.equal(normalisePhone('0091 9876543210'), '+919876543210');
  assert.equal(normalisePhone('(987) 654-3210'), '+919876543210');
  assert.equal(normalisePhone(9876543210), '+919876543210');
});

test('an explicit international number is kept as written', () => {
  assert.equal(normalisePhone('+971501234567'), '+971501234567');
});

test('an unusable number normalises to null rather than a guess', () => {
  // A wrong phone number costs a sales call; a null one is a visible gap.
  assert.equal(normalisePhone('12345'), null);
  assert.equal(normalisePhone('1234567890'), null); // does not start 6-9
  assert.equal(normalisePhone('call me'), null);
  assert.equal(normalisePhone(''), null);
  assert.equal(normalisePhone(null), null);
  assert.equal(normalisePhone(undefined), null);
});

test('masking leaves only the last four digits', () => {
  assert.equal(maskPhone('+919876543210'), '*********3210');
  assert.equal(maskPhone(null), '****');
  assert.equal(maskPhone(''), '****');
  assert.ok(!maskPhone('+919876543210').includes('98765'));
});

test('enum guards coerce unknown values to the safe member', () => {
  assert.equal(normaliseIntent('BUY'), 'buy');
  assert.equal(normaliseIntent('heavy_deposit_ok'), 'heavy_deposit_ok');
  assert.equal(normaliseIntent('flying'), 'unknown');
  assert.equal(normaliseIntent(undefined), 'unknown');

  assert.equal(normaliseTemperature('HOT'), 'hot');
  assert.equal(normaliseTemperature('lukewarm'), 'cold');

  assert.equal(normaliseStatus('site_visit'), 'site_visit');
  assert.equal(normaliseStatus('nonsense'), null);

  assert.equal(normaliseWindowState('human_agent'), 'HUMAN_AGENT');
  assert.equal(normaliseWindowState('OPEN'), null);
});

test('date keys are YYYY-MM-DD and survive bad input', () => {
  assert.equal(toDateKey(new Date('2026-03-04T10:00:00Z')), '2026-03-04');
  assert.equal(toDateKey('2026-03-04T10:00:00Z'), '2026-03-04');
  assert.match(toDateKey('garbage'), /^\d{4}-\d{2}-\d{2}$/);
});
