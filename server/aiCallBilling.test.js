/**
 * Per-minute AI call billing.
 *
 * Two properties matter more than the arithmetic here:
 *
 *  - **Never double-charge.** Both the Exotel status webhook and the ElevenLabs
 *    post-call webhook can deliver a duration for the same call, so call-outcome
 *    legitimately fires twice. The idempotency guard on callSessionId is the
 *    only thing standing between that and a customer billed twice per call.
 *
 *  - **Never lose the call outcome to a billing problem.** The call has already
 *    happened by the time this runs; a credit failure must degrade to an
 *    uncharged call, not a lost qualification result. So nothing here throws.
 */

import { jest } from '@jest/globals';

const deductCredits = jest.fn();
const getBalance = jest.fn();
const getCosts = jest.fn();
const logEventIfNotProcessed = jest.fn();

class InsufficientCreditsError extends Error {
  constructor(balance, required) {
    super('insufficient');
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.required = required;
  }
}

jest.unstable_mockModule('./creditService.js', () => ({
  deductCredits,
  getBalance,
  InsufficientCreditsError,
}));
jest.unstable_mockModule('./creditConfig.js', () => ({ getCosts }));
jest.unstable_mockModule('./webhookLogService.js', () => ({ logEventIfNotProcessed }));
jest.unstable_mockModule('./logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { chargeForAiCall, billableMinutes, hasCreditForAiCall } = await import('./aiCallBilling.js');

beforeEach(() => {
  jest.clearAllMocks();
  getCosts.mockResolvedValue({ ai_call_per_minute: 15 });
  logEventIfNotProcessed.mockResolvedValue({ isDuplicate: false });
  deductCredits.mockResolvedValue({ balance: 500, ledgerId: 'L1' });
});

describe('hasCreditForAiCall', () => {
  test('refuses a tenant who cannot cover one started minute', async () => {
    getBalance.mockResolvedValue(2);
    await expect(hasCreditForAiCall('t1')).resolves.toEqual({ ok: false, balance: 2, required: 15 });
  });

  test('allows a tenant whose balance exactly covers one minute', async () => {
    getBalance.mockResolvedValue(15);
    await expect(hasCreditForAiCall('t1')).resolves.toMatchObject({ ok: true });
  });

  test('skips the balance lookup entirely when calls are free', async () => {
    getCosts.mockResolvedValue({ ai_call_per_minute: 0 });
    await expect(hasCreditForAiCall('t1')).resolves.toEqual({ ok: true });
    expect(getBalance).not.toHaveBeenCalled();
  });

  test('fails open when the credit service is unavailable, rather than blocking work', async () => {
    getBalance.mockRejectedValue(new Error('credit service down'));
    await expect(hasCreditForAiCall('t1')).resolves.toEqual({ ok: true });
  });
});

describe('billableMinutes', () => {
  test('bills per started minute, so a short call still costs one', () => {
    expect(billableMinutes(1)).toBe(1);
    expect(billableMinutes(59)).toBe(1);
    expect(billableMinutes(60)).toBe(1);
    expect(billableMinutes(61)).toBe(2);
    expect(billableMinutes(150)).toBe(3);
  });

  test('a call that never connected is not a free minute, it is no charge', () => {
    expect(billableMinutes(0)).toBe(0);
    expect(billableMinutes(null)).toBe(0);
    expect(billableMinutes(undefined)).toBe(0);
    expect(billableMinutes('nonsense')).toBe(0);
    expect(billableMinutes(-30)).toBe(0);
  });
});

describe('chargeForAiCall', () => {
  test('charges minutes x rate and records why on the ledger entry', async () => {
    const result = await chargeForAiCall({
      tenantId: 'T1', callSessionId: 'CS1', durationSecs: 90, leadId: 'L9', callPurpose: 'lead_qualification',
    });

    expect(result).toMatchObject({ charged: true, credits: 30, minutes: 2 });
    expect(deductCredits).toHaveBeenCalledWith('T1', 30, 'ai_call_per_minute', expect.objectContaining({
      callSessionId: 'CS1', leadId: 'L9', durationSecs: 90, minutes: 2, perMinute: 15,
    }));
  });

  test('a repeated delivery for the same call does not charge again', async () => {
    logEventIfNotProcessed.mockResolvedValue({ isDuplicate: true });

    const result = await chargeForAiCall({ tenantId: 'T1', callSessionId: 'CS1', durationSecs: 90 });

    expect(result).toMatchObject({ charged: false, reason: 'already_billed' });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  test('without a session id it skips rather than risk double-charging', async () => {
    const result = await chargeForAiCall({ tenantId: 'T1', durationSecs: 90 });

    expect(result).toMatchObject({ charged: false, reason: 'missing_call_session_id' });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  test('an unanswered call is not billed', async () => {
    const result = await chargeForAiCall({ tenantId: 'T1', callSessionId: 'CS1', durationSecs: 0 });

    expect(result).toMatchObject({ charged: false, reason: 'no_billable_duration' });
    expect(deductCredits).not.toHaveBeenCalled();
    // The idempotency key must stay unconsumed, or a later corrected duration
    // for this same call could never be billed.
    expect(logEventIfNotProcessed).not.toHaveBeenCalled();
  });

  test('a zero rate disables call billing entirely', async () => {
    getCosts.mockResolvedValue({ ai_call_per_minute: 0 });

    const result = await chargeForAiCall({ tenantId: 'T1', callSessionId: 'CS1', durationSecs: 120 });

    expect(result).toMatchObject({ charged: false, reason: 'rate_zero' });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  test('running out of credits mid-flight does not throw — the call already happened', async () => {
    deductCredits.mockRejectedValue(new InsufficientCreditsError(5, 15));

    const result = await chargeForAiCall({ tenantId: 'T1', callSessionId: 'CS1', durationSecs: 60 });

    expect(result).toMatchObject({ charged: false, reason: 'insufficient_credits', balance: 5 });
  });

  test('an unexpected credit-system failure is swallowed, never rethrown', async () => {
    deductCredits.mockRejectedValue(new Error('DynamoDB throttled'));

    await expect(
      chargeForAiCall({ tenantId: 'T1', callSessionId: 'CS1', durationSecs: 60 })
    ).resolves.toMatchObject({ charged: false, reason: 'error' });
  });
});
