/**
 * Follow-up caller settings (CONTRACTS.md section 6): defaults, ranges, and
 * the two read shapes staying in step.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import {
  followupConfigResponseFields,
  resolveFollowupConfig,
  validateFollowupConfigPatch,
  isFollowupCallsEnabled,
} from './followupConfig.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

describe('defaults', () => {
  test('GET fields fall back to the contract defaults on an empty config', () => {
    assert.deepEqual(followupConfigResponseFields(null), {
      followupCallsEnabled: false,
      followupCallOnNewInstagramLead: false,
      followupMaxAttempts: 2,
      followupRetryGapMinutes: 45,
      followupPostVisitDelayMinutes: 120,
      followupEscalationUserIds: [],
    });
  });

  test('followupCallsEnabled defaults to the AI Employee toggle until set explicitly', () => {
    assert.equal(isFollowupCallsEnabled({ aiEmployeeEnabled: true }), true);
    assert.equal(isFollowupCallsEnabled({ aiEmployeeEnabled: true, followupCallsEnabled: false }), false);
    assert.equal(isFollowupCallsEnabled({ aiEmployeeEnabled: false, followupCallsEnabled: true }), true);
  });

  test('the snapshot block reuses the same values plus the business-hours window', () => {
    const snap = resolveFollowupConfig({ aiEmployeeEnabled: true, followupMaxAttempts: 3, followupEscalationUserIds: ['u1', ' ', 'u2'] });
    assert.deepEqual(snap, {
      enabled: true,
      callOnNewInstagramLead: false,
      maxAttempts: 3,
      retryGapMinutes: 45,
      postVisitDelayMinutes: 120,
      businessHoursStart: '10:00',
      businessHoursEnd: '19:00',
      timezone: 'Asia/Kolkata',
      escalationUserIds: ['u1', 'u2'],
    });
    assert.equal(resolveFollowupConfig({ businessHoursStart: '09:30', timezone: 'Asia/Dubai' }).businessHoursStart, '09:30');
  });
});

describe('validateFollowupConfigPatch', () => {
  test('accepts a full valid patch and coerces numeric strings', () => {
    const { update, error } = validateFollowupConfigPatch({
      followupCallsEnabled: true,
      followupCallOnNewInstagramLead: false,
      followupMaxAttempts: '5',
      followupRetryGapMinutes: 10,
      followupPostVisitDelayMinutes: 0,
      followupEscalationUserIds: ['u1'],
      aiPersonality: 'friendly', // unrelated key, ignored here
    });
    assert.equal(error, null);
    assert.deepEqual(update, {
      followupCallsEnabled: true,
      followupCallOnNewInstagramLead: false,
      followupMaxAttempts: 5,
      followupRetryGapMinutes: 10,
      followupPostVisitDelayMinutes: 0,
      followupEscalationUserIds: ['u1'],
    });
  });

  test('leaves absent keys alone', () => {
    assert.deepEqual(validateFollowupConfigPatch({}), { update: {}, error: null });
  });

  test('rejects out-of-range integers and wrong types', () => {
    assert.match(validateFollowupConfigPatch({ followupMaxAttempts: 0 }).error, /between 1 and 5/);
    assert.match(validateFollowupConfigPatch({ followupMaxAttempts: 6 }).error, /between 1 and 5/);
    assert.match(validateFollowupConfigPatch({ followupMaxAttempts: 2.5 }).error, /integer/);
    assert.match(validateFollowupConfigPatch({ followupRetryGapMinutes: 9 }).error, /between 10 and 240/);
    assert.match(validateFollowupConfigPatch({ followupRetryGapMinutes: 241 }).error, /between 10 and 240/);
    assert.match(validateFollowupConfigPatch({ followupPostVisitDelayMinutes: -1 }).error, /between 0 and 1440/);
    assert.match(validateFollowupConfigPatch({ followupPostVisitDelayMinutes: 1441 }).error, /between 0 and 1440/);
    assert.match(validateFollowupConfigPatch({ followupCallsEnabled: 'yes' }).error, /boolean/);
    assert.match(validateFollowupConfigPatch({ followupEscalationUserIds: 'u1' }).error, /array/);
    assert.match(validateFollowupConfigPatch({ followupEscalationUserIds: [1] }).error, /array/);
  });
});
