/**
 * The shared lead-adapter entry point.
 *
 * The point of ingestLead() is that every source — ManyChat, the self-hosted
 * Instagram agent, the website later — gets *identical* treatment: one table,
 * one quality bar, one idempotency rule, one lead.created event. These tests
 * pin the parts of that contract which are easy to break by accident:
 * the rental-vs-buyer split, the "don't guess an unclassifiable lead" rule, and
 * the dedupe guard that lets an adapter retry a batch safely.
 */

import { jest } from '@jest/globals';

const createLead = jest.fn();
const updateLead = jest.fn();
const findLeadByPhone = jest.fn();
const notifyNewLead = jest.fn();
const logEventIfNotProcessed = jest.fn();
const send = jest.fn();

// Must mirror crmDynamodbService's real normalizer: dedupe keys on exactly this
// value, and '' (an unparseable number) must never be a usable key.
const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  const bare = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(bare) ? bare : '';
};

jest.unstable_mockModule('./crmDynamodbService.js', () => ({
  createLead, updateLead, findLeadByPhone, normalizePhone,
}));
jest.unstable_mockModule('./leadNotifications.js', () => ({ notifyNewLead }));
jest.unstable_mockModule('./webhookLogService.js', () => ({ logEventIfNotProcessed }));
jest.unstable_mockModule('./logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(() => ({ send })),
  PutEventsCommand: jest.fn((input) => ({ input })),
}));

const { ingestLead, intentToLeadType, parseBudgetBracket } = await import('./leadIngestion.js');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.AGENTS_ENABLED;
  logEventIfNotProcessed.mockResolvedValue({ isDuplicate: false });
  createLead.mockImplementation(async (_t, data) => ({ leadId: 'LEAD1', ...data }));
  updateLead.mockImplementation(async (_t, leadId, patch) => ({ leadId, ...patch }));
  findLeadByPhone.mockResolvedValue(null);
  notifyNewLead.mockResolvedValue(undefined);
});

describe('intentToLeadType', () => {
  test('a rental enquiry is a tenant lead, not a buyer lead', () => {
    expect(intentToLeadType('rent')).toBe('tenant');
    // "heavy deposit" is a rental arrangement, so it belongs with tenants too.
    expect(intentToLeadType('heavy_deposit_ok')).toBe('tenant');
  });

  test('maps the remaining known intents', () => {
    expect(intentToLeadType('buy')).toBe('buyer');
    expect(intentToLeadType('sell')).toBe('seller');
  });

  test('refuses to guess an unclassifiable intent', () => {
    // Guessing here would put a miscategorised lead in front of an agent.
    expect(intentToLeadType('unknown')).toBeNull();
    expect(intentToLeadType('')).toBeNull();
    expect(intentToLeadType(undefined)).toBeNull();
  });
});

describe('parseBudgetBracket', () => {
  test('takes the lower bound of a range, in rupees', () => {
    expect(parseBudgetBracket('80L-1Cr')).toBe(8_000_000);
    expect(parseBudgetBracket('1Cr-2Cr')).toBe(10_000_000);
  });

  test('handles open-ended brackets', () => {
    expect(parseBudgetBracket('1Cr+')).toBe(10_000_000);
    expect(parseBudgetBracket('<50L')).toBe(4_900_000);
  });

  test('understands the Instagram enum form as well as the ManyChat form', () => {
    // Both adapters used to parse budgets separately and could drift apart.
    expect(parseBudgetBracket('above_5Cr')).toBe(50_000_000);
    expect(parseBudgetBracket('25L_50L')).toBe(2_500_000);
    expect(parseBudgetBracket('under_25L')).toBe(2_400_000);
  });

  test('passes numbers through and gives up safely on junk', () => {
    expect(parseBudgetBracket(7500000)).toBe(7500000);
    expect(parseBudgetBracket('')).toBeNull();
    expect(parseBudgetBracket(null)).toBeNull();
    expect(parseBudgetBracket('whatever')).toBeNull();
  });
});

describe('ingestLead', () => {
  const base = { name: 'Rahul Sharma', phone: '9876543210', leadType: 'buyer', source: 'Instagram' };

  test('writes a buyer lead with its budget in buyerRequirement', async () => {
    const result = await ingestLead('T1', {
      ...base,
      sourceAdapter: 'manychat',
      requirement: { requirement: 'buy', budget: 8_000_000, preferredArea: 'Andheri West' },
    });

    expect(result.ok).toBe(true);
    expect(createLead).toHaveBeenCalledWith('T1', expect.objectContaining({
      leadType: 'buyer',
      sourceAdapter: 'manychat',
      buyerRequirement: { requirement: 'buy', budget: 8_000_000, preferredArea: 'Andheri West' },
    }));
  });

  test('a rental lead puts its budget in tenantRequirement, not buyerRequirement', async () => {
    await ingestLead('T1', {
      ...base, leadType: 'tenant',
      requirement: { requirement: 'rent', budget: 45_000 },
    });

    const written = createLead.mock.calls[0][1];
    expect(written.tenantRequirement).toEqual({ requirement: 'rent', budget: 45_000 });
    expect(written.buyerRequirement).toBeUndefined();
  });

  test("a seller's budget is the price they expect, so it maps to sellerProperty", async () => {
    await ingestLead('T1', {
      ...base, leadType: 'seller',
      requirement: { requirement: 'sell', budget: 12_000_000, preferredArea: 'Bandra' },
    });

    expect(createLead.mock.calls[0][1].sellerProperty).toEqual({
      expectedPrice: 12_000_000, area: 'Bandra',
    });
  });

  test('a lead nobody can ring is not created', async () => {
    const noPhone = await ingestLead('T1', { ...base, phone: '' });
    const noName = await ingestLead('T1', { ...base, name: '   ' });

    expect(noPhone).toMatchObject({ skipped: true, reason: 'missing_name_or_phone' });
    expect(noName).toMatchObject({ skipped: true, reason: 'missing_name_or_phone' });
    expect(createLead).not.toHaveBeenCalled();
  });

  test('an unresolved lead type is held back rather than guessed', async () => {
    const result = await ingestLead('T1', { ...base, leadType: null });

    expect(result).toMatchObject({ skipped: true, reason: 'unresolved_lead_type' });
    expect(createLead).not.toHaveBeenCalled();
  });

  test('re-delivering the same enquiry does not create a second lead', async () => {
    logEventIfNotProcessed.mockResolvedValue({ isDuplicate: true });

    const result = await ingestLead('T1', base, { dedupeKey: 'adapter:T1:ENQ-1' });

    expect(result).toMatchObject({ duplicate: true });
    expect(createLead).not.toHaveBeenCalled();
  });

  test('a notification failure does not cost us the lead', async () => {
    notifyNewLead.mockRejectedValue(new Error('SES down'));

    const result = await ingestLead('T1', base);

    expect(result.ok).toBe(true);
    expect(result.lead.leadId).toBe('LEAD1');
  });

  test('publishes lead.created only when the agent pipeline is enabled', async () => {
    await ingestLead('T1', base);
    expect(send).not.toHaveBeenCalled();

    process.env.AGENTS_ENABLED = 'true';
    await ingestLead('T1', base);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('an EventBridge outage does not fail the ingest', async () => {
    process.env.AGENTS_ENABLED = 'true';
    send.mockRejectedValue(new Error('eventbridge unavailable'));

    await expect(ingestLead('T1', base)).resolves.toMatchObject({ ok: true });
  });
});

describe('ingestLead — one person is one lead', () => {
  const base = { name: 'Rahul Sharma', phone: '9876543210', leadType: 'buyer', source: 'Instagram' };

  const existingLead = (over = {}) => ({
    leadId: 'EXISTING1',
    leadType: 'buyer',
    name: 'Rahul Sharma',
    normalizedPhone: '9876543210',
    status: 'qualified',
    score: 'HOT',
    assignedTo: 'agent-7',
    notes: 'Called once.',
    buyerRequirement: { budget: 8_000_000 },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  test('a returning enquiry updates the existing lead instead of creating a second', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ buyerRequirement: {} }));

    const result = await ingestLead('T1', {
      ...base, sourceAdapter: 'insta-agent',
      requirement: { budget: 9_000_000 },
    });

    expect(result).toMatchObject({ ok: true, updated: true });
    expect(createLead).not.toHaveBeenCalled();
    expect(updateLead).toHaveBeenCalledWith('T1', 'EXISTING1', expect.any(Object), expect.any(Object));
  });

  test('never overwrites the human/AI state already on the lead', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ buyerRequirement: {} }));

    await ingestLead('T1', {
      ...base, sourceAdapter: 'insta-agent',
      requirement: { budget: 9_000_000 },
    });

    const patch = updateLead.mock.calls[0][2];
    // These belong to a human or the qualification pipeline — a new DM is not a
    // reason to reset any of them.
    for (const field of ['status', 'score', 'scoreValue', 'assignedTo', 'leadType', 'createdBy', 'name']) {
      expect(patch).not.toHaveProperty(field);
    }
  });

  test('fills genuine blanks but does not revise a budget an agent already recorded', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ buyerRequirement: { budget: 8_000_000 } }));

    await ingestLead('T1', {
      ...base,
      requirement: { budget: 5_000_000, preferredArea: 'Powai' },
    });

    const patch = updateLead.mock.calls[0][2];
    // preferredArea was missing, so it is added; budget was already set, so the
    // incoming (different) value is ignored rather than silently overwriting.
    expect(patch.buyerRequirement).toEqual({ preferredArea: 'Powai' });
  });

  test('a different intent from the same person is recorded, not forced into the wrong blob', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ leadType: 'buyer' }));

    await ingestLead('T1', {
      ...base, leadType: 'tenant',
      requirement: { requirement: 'rent', budget: 45_000 },
    });

    const patch = updateLead.mock.calls[0][2];
    // Writing rental values into a buyer's blob would fail updateLead's type
    // validation and corrupt the record.
    expect(patch.tenantRequirement).toBeUndefined();
    expect(patch.buyerRequirement).toBeUndefined();
    expect(patch.notes).toMatch(/Repeat enquiry/);
  });

  test('merges channel ids without discarding the ones already there', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ externalRef: { igUsername: 'rahul.s' } }));

    await ingestLead('T1', { ...base, externalRef: { igSenderId: 'IGSID9' } });

    expect(updateLead.mock.calls[0][2].externalRef).toEqual({
      igUsername: 'rahul.s', igSenderId: 'IGSID9',
    });
  });

  test('an update does not re-notify or re-trigger AI qualification', async () => {
    process.env.AGENTS_ENABLED = 'true';
    findLeadByPhone.mockResolvedValue(existingLead({ buyerRequirement: {} }));

    await ingestLead('T1', { ...base, requirement: { budget: 9_000_000 } });

    // The person is already in the pipeline; firing these again would spam the
    // agent and re-run qualification on someone already qualified.
    expect(notifyNewLead).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test('a lookup failure creates the lead rather than dropping it', async () => {
    findLeadByPhone.mockRejectedValue(new Error('DynamoDB throttled'));

    const result = await ingestLead('T1', base);

    // A duplicate lead is recoverable by merging later; a lost lead is not.
    expect(result).toMatchObject({ ok: true, created: true });
    expect(createLead).toHaveBeenCalled();
  });

  test('two enquiries from one person in a single batch collapse onto one lead', async () => {
    const phoneIndex = new Map();

    const first = await ingestLead('T1', base, { phoneIndex });
    const second = await ingestLead('T1', { ...base, requirement: { preferredArea: 'Powai' } }, { phoneIndex });


    expect(first).toMatchObject({ created: true });
    expect(second).toMatchObject({ updated: true });
    expect(createLead).toHaveBeenCalledTimes(1);
    // The batch index is consulted instead of a per-item round trip.
    expect(findLeadByPhone).not.toHaveBeenCalled();
  });

  test('unparseable phone numbers never dedupe into each other', async () => {
    const phoneIndex = new Map();

    // Two different people whose numbers both normalize to '' must not merge.
    await ingestLead('T1', { ...base, name: 'A', phone: '+1-555-0100' }, { phoneIndex });
    await ingestLead('T1', { ...base, name: 'B', phone: '+44 20 7946 0958' }, { phoneIndex });

    expect(createLead).toHaveBeenCalledTimes(2);
  });
});

describe('ingestLead — repeat-contact channels (Bailey/WhatsApp)', () => {
  const base = { name: 'Rahul Sharma', phone: '9876543210', leadType: 'buyer', source: 'WhatsApp' };

  const existingLead = (over = {}) => ({
    leadId: 'EXISTING1',
    leadType: 'buyer',
    name: 'Rahul Sharma',
    normalizedPhone: '9876543210',
    status: 'contacted',
    notes: 'First contact.',
    buyerRequirement: { budget: 8_000_000, preferredArea: 'Powai' },
    externalRef: { waJid: '919876543210@s.whatsapp.net' },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  test('a chatty thread that adds nothing writes nothing at all', async () => {
    findLeadByPhone.mockResolvedValue(existingLead());

    // The same person messaging repeatedly with no new information.
    for (let i = 0; i < 5; i += 1) {
      const result = await ingestLead('T1', {
        ...base, sourceAdapter: 'bailey',
        requirement: { budget: 8_000_000, preferredArea: 'Powai' },
        externalRef: { waJid: '919876543210@s.whatsapp.net' },
      });
      expect(result).toMatchObject({ ok: true, unchanged: true, reason: 'no_new_information' });
    }

    // No writes means no note-line pile-up, no history growth, and no drift
    // toward DynamoDB's 400KB item cap on a long-running conversation.
    expect(updateLead).not.toHaveBeenCalled();
    expect(createLead).not.toHaveBeenCalled();
  });

  test('but a message carrying genuinely new information does write', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ buyerRequirement: { budget: 8_000_000 } }));

    const result = await ingestLead('T1', {
      ...base, sourceAdapter: 'bailey',
      requirement: { budget: 8_000_000, preferredArea: 'Andheri' },
    });

    expect(result).toMatchObject({ updated: true });
    expect(updateLead.mock.calls[0][2].buyerRequirement).toEqual({ preferredArea: 'Andheri' });
  });

  test('a new channel identifier counts as new information', async () => {
    findLeadByPhone.mockResolvedValue(existingLead({ externalRef: {} }));

    const result = await ingestLead('T1', {
      ...base, sourceAdapter: 'bailey',
      requirement: { budget: 8_000_000, preferredArea: 'Powai' },
      externalRef: { waJid: '919876543210@s.whatsapp.net' },
    });

    expect(result).toMatchObject({ updated: true });
  });

  test('a person switching intent is always recorded, even with no new values', async () => {
    findLeadByPhone.mockResolvedValue(existingLead());

    const result = await ingestLead('T1', {
      ...base, leadType: 'tenant', sourceAdapter: 'bailey',
      requirement: { requirement: 'rent' },
    });

    expect(result).toMatchObject({ updated: true });
    expect(updateLead.mock.calls[0][2].notes).toMatch(/this time about/);
  });
});
