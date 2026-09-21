/**
 * The marketplace visibility rule and the sparse-key bookkeeping it drives.
 * Every gate is exercised both ways: a listing that should be visible gets
 * exactly the key set, and a listing that should not gets every key REMOVEd.
 */
import { jest } from '@jest/globals';

const mockSend = jest.fn();

class MockUpdateCommand { constructor(input) { this.input = input; this.__type = 'Update'; } }
class MockQueryCommand { constructor(input) { this.input = input; this.__type = 'Query'; } }

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: class {},
  PutCommand: class {},
  UpdateCommand: MockUpdateCommand,
  QueryCommand: MockQueryCommand,
  ScanCommand: class {},
  DeleteCommand: class {},
  BatchGetCommand: class {},
}));

const mockGetAgencyConfig = jest.fn();
jest.unstable_mockModule('./agencyConfigService.js', () => ({
  getAgencyConfig: mockGetAgencyConfig,
}));

// publicListingService pulls in crmDynamodbService (and its full SDK surface);
// only the two publish gates are needed here, so mirror them.
jest.unstable_mockModule('./publicListingService.js', () => ({
  isPubliclyVisible: (p) => Boolean(p) && p.publicVisibility === 'public'
    && ['available', 'for-sale', 'for-rent'].includes(p.status),
}));

const {
  computeMarketplaceKeys,
  isMarketplaceVisible,
  normaliseLocationKey,
  normaliseCityKey,
  priceSortKey,
  keysAlreadyApplied,
  applyMarketplaceKeys,
  syncPropertyMarketplaceKeys,
  syncTenantMarketplaceKeys,
  invalidateAgencyCache,
  MARKETPLACE_KEY_ATTRIBUTES,
} = await import('./marketplaceIndexing.js');

const agencyOn = { TenantId: 't1', marketplaceEnabled: true };
const agencyOff = { TenantId: 't1', marketplaceEnabled: false };

function property(overrides = {}) {
  return {
    tenantId: 't1',
    propertyId: 'p1',
    publicVisibility: 'public',
    status: 'for-sale',
    city: 'Mumbai',
    area: 'Andheri West',
    saleInfo: { listedPrice: 8500000 },
    ...overrides,
  };
}

describe('normaliseCityKey', () => {
  test('folds the common alternate spellings of a city onto one partition', () => {
    expect(normaliseCityKey('Bangalore')).toBe('bengaluru');
    expect(normaliseCityKey('Bengaluru')).toBe('bengaluru');
    expect(normaliseCityKey(' Gurgaon ')).toBe('gurugram');
    expect(normaliseCityKey('New Delhi')).toBe('delhi');
    expect(normaliseCityKey('Pune')).toBe('pune');
    expect(normaliseCityKey('')).toBeNull();
  });
});

describe('normaliseLocationKey', () => {
  test('collapses case, whitespace and punctuation', () => {
    expect(normaliseLocationKey(' Navi  Mumbai ')).toBe('navi-mumbai');
    expect(normaliseLocationKey('navi mumbai')).toBe('navi-mumbai');
    expect(normaliseLocationKey('Bengaluru, Karnataka')).toBe('bengaluru-karnataka');
    expect(normaliseLocationKey('')).toBeNull();
    expect(normaliseLocationKey(null)).toBeNull();
  });
});

describe('priceSortKey', () => {
  test('zero-pads to 13 digits so lexical order is numeric order', () => {
    expect(priceSortKey(8500000, 'p1')).toBe('PRICE#0000008500000#p1');
    expect(priceSortKey(15000000, 'p2') > priceSortKey(8500000, 'p1')).toBe(true);
  });
  test('unpriced listings sort after every real price', () => {
    expect(priceSortKey(null, 'p9')).toBe('PRICE#9999999999999#p9');
    expect(priceSortKey(null, 'p9') > priceSortKey(999999999999, 'p1')).toBe(true);
  });
});

describe('visibility rule', () => {
  test('visible when public + marketable + agency on + city present', () => {
    expect(isMarketplaceVisible(property(), agencyOn)).toBe(true);
  });
  test.each([
    ['agency off', property(), agencyOff],
    ['no agency config', property(), null],
    ['not published', property({ publicVisibility: 'private' }), agencyOn],
    ['sold', property({ status: 'sold' }), agencyOn],
    ['rented', property({ status: 'rented' }), agencyOn],
    ['archived', property({ status: 'archived' }), agencyOn],
    ['unlisted by agent', property({ marketplaceVisibility: 'unlisted' }), agencyOn],
    ['no city', property({ city: '' }), agencyOn],
  ])('hidden: %s', (_label, prop, agency) => {
    expect(isMarketplaceVisible(prop, agency)).toBe(false);
    const keys = computeMarketplaceKeys(prop, agency);
    expect(keys.set).toBeNull();
    expect(keys.remove).toEqual(MARKETPLACE_KEY_ATTRIBUTES);
  });
});

describe('computeMarketplaceKeys', () => {
  test('sale listing keys', () => {
    const keys = computeMarketplaceKeys(property(), agencyOn, { now: '2026-09-17T00:00:00.000Z' });
    expect(keys.set).toEqual({
      GSI4PK: 'CITY#mumbai#sale',
      GSI4SK: 'PRICE#0000008500000#p1',
      mktCityKey: 'mumbai',
      mktLocalityKey: 'andheri-west',
      mktMode: 'sale',
      mktListedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(keys.remove).toEqual([]);
  });

  test('rental listing keys use expected rent and mode rent', () => {
    const keys = computeMarketplaceKeys(
      property({ status: 'for-rent', rentalInfo: { expectedRent: 45000 }, saleInfo: null }),
      agencyOn,
    );
    expect(keys.set.GSI4PK).toBe('CITY#mumbai#rent');
    expect(keys.set.GSI4SK).toBe('PRICE#0000000045000#p1');
    expect(keys.set.mktMode).toBe('rent');
  });

  test('price on request gets the sentinel sort key', () => {
    const keys = computeMarketplaceKeys(property({ saleInfo: {} }), agencyOn);
    expect(keys.set.GSI4SK).toBe('PRICE#9999999999999#p1');
  });

  test('keeps the original mktListedAt across re-keys', () => {
    const keys = computeMarketplaceKeys(property({ mktListedAt: '2026-01-01T00:00:00.000Z' }), agencyOn, { now: '2026-09-17T00:00:00.000Z' });
    expect(keys.set.mktListedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('missing locality falls back to "unknown" so the inline filter attribute always exists', () => {
    const keys = computeMarketplaceKeys(property({ area: '' }), agencyOn);
    expect(keys.set.mktLocalityKey).toBe('unknown');
  });
});

describe('keysAlreadyApplied', () => {
  test('true when every key matches', () => {
    const keys = computeMarketplaceKeys(property(), agencyOn, { now: 'T' });
    expect(keysAlreadyApplied({ ...property(), ...keys.set }, keys)).toBe(true);
  });
  test('false when a key differs (price changed)', () => {
    const keys = computeMarketplaceKeys(property(), agencyOn, { now: 'T' });
    expect(keysAlreadyApplied({ ...property(), ...keys.set, GSI4SK: 'PRICE#0000001000000#p1' }, keys)).toBe(false);
  });
  test('true for a hidden item that carries no keys', () => {
    expect(keysAlreadyApplied(property(), { set: null, remove: MARKETPLACE_KEY_ATTRIBUTES })).toBe(true);
  });
  test('false for a hidden item that still carries a key', () => {
    expect(keysAlreadyApplied({ ...property(), GSI4PK: 'CITY#mumbai#sale' }, { set: null, remove: MARKETPLACE_KEY_ATTRIBUTES })).toBe(false);
  });
});

describe('applyMarketplaceKeys', () => {
  beforeEach(() => mockSend.mockReset());

  test('SETs every key with a direct UpdateCommand guarded by attribute_exists', async () => {
    mockSend.mockResolvedValue({});
    const keys = computeMarketplaceKeys(property(), agencyOn, { now: 'T' });
    await applyMarketplaceKeys('t1', 'p1', keys);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(MockUpdateCommand);
    expect(cmd.input.Key).toEqual({ PK: 'TENANT#t1#PROPERTY#p1', SK: 'PROFILE' });
    expect(cmd.input.ConditionExpression).toBe('attribute_exists(PK)');
    expect(cmd.input.UpdateExpression.startsWith('SET ')).toBe(true);
    expect(Object.values(cmd.input.ExpressionAttributeNames).sort()).toEqual([...MARKETPLACE_KEY_ATTRIBUTES].sort());
    expect(Object.values(cmd.input.ExpressionAttributeValues)).toContain('CITY#mumbai#sale');
  });

  test('REMOVEs every key when hidden, with no values', async () => {
    mockSend.mockResolvedValue({});
    await applyMarketplaceKeys('t1', 'p1', { set: null, remove: MARKETPLACE_KEY_ATTRIBUTES });
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.UpdateExpression.startsWith('REMOVE ')).toBe(true);
    expect(cmd.input.ExpressionAttributeValues).toBeUndefined();
    expect(Object.values(cmd.input.ExpressionAttributeNames).sort()).toEqual([...MARKETPLACE_KEY_ATTRIBUTES].sort());
  });

  test('a deleted property (condition failed) is treated as done, not an error', async () => {
    const err = new Error('gone'); err.name = 'ConditionalCheckFailedException';
    mockSend.mockRejectedValue(err);
    await expect(applyMarketplaceKeys('t1', 'p1', { set: null, remove: MARKETPLACE_KEY_ATTRIBUTES })).resolves.toBe(false);
  });
});

describe('syncPropertyMarketplaceKeys', () => {
  beforeEach(() => { mockSend.mockReset(); mockGetAgencyConfig.mockReset(); invalidateAgencyCache(); });

  test('writes keys for a visible listing and reports them', async () => {
    mockGetAgencyConfig.mockResolvedValue(agencyOn);
    mockSend.mockResolvedValue({});
    const result = await syncPropertyMarketplaceKeys('t1', property());
    expect(result.visible).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.keys.set.mktCityKey).toBe('mumbai');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('skips the write when the item already carries the keys', async () => {
    mockGetAgencyConfig.mockResolvedValue(agencyOn);
    const keys = computeMarketplaceKeys(property(), agencyOn, { now: 'T' });
    const result = await syncPropertyMarketplaceKeys('t1', { ...property(), ...keys.set });
    expect(result.changed).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('unpublishing removes the keys', async () => {
    mockGetAgencyConfig.mockResolvedValue(agencyOn);
    mockSend.mockResolvedValue({});
    const listed = { ...property(), ...computeMarketplaceKeys(property(), agencyOn).set, publicVisibility: 'private' };
    const result = await syncPropertyMarketplaceKeys('t1', listed);
    expect(result.visible).toBe(false);
    expect(result.changed).toBe(true);
    expect(mockSend.mock.calls[0][0].input.UpdateExpression.startsWith('REMOVE ')).toBe(true);
  });

  test('never throws: a DynamoDB failure is logged and reported as unchanged', async () => {
    mockGetAgencyConfig.mockResolvedValue(agencyOn);
    mockSend.mockRejectedValue(new Error('boom'));
    await expect(syncPropertyMarketplaceKeys('t1', property())).resolves.toEqual({ visible: false, changed: false });
  });

  test('caches the agency lookup across writes', async () => {
    mockGetAgencyConfig.mockResolvedValue(agencyOn);
    mockSend.mockResolvedValue({});
    await syncPropertyMarketplaceKeys('t1', property({ propertyId: 'a' }));
    await syncPropertyMarketplaceKeys('t1', property({ propertyId: 'b' }));
    expect(mockGetAgencyConfig).toHaveBeenCalledTimes(1);
  });
});

describe('syncTenantMarketplaceKeys', () => {
  beforeEach(() => { mockSend.mockReset(); mockGetAgencyConfig.mockReset(); invalidateAgencyCache(); });

  test('walks GSI3 and applies the rule to every property; agency off removes all', async () => {
    const listedKeys = computeMarketplaceKeys(property(), agencyOn).set;
    mockSend.mockImplementation(async (cmd) => {
      if (cmd instanceof MockQueryCommand) {
        expect(cmd.input.IndexName).toBe('search-index');
        expect(cmd.input.ExpressionAttributeValues[':pk']).toBe('TENANT#t1#SEARCH');
        return { Items: [
          { ...property({ propertyId: 'a' }), ...listedKeys },
          property({ propertyId: 'b' }), // never listed → unchanged
        ] };
      }
      return {};
    });
    const stats = await syncTenantMarketplaceKeys('t1', { agency: agencyOff });
    expect(stats).toEqual({ scanned: 2, listed: 0, removed: 1, unchanged: 1 });
    const updates = mockSend.mock.calls.map((c) => c[0]).filter((c) => c instanceof MockUpdateCommand);
    expect(updates).toHaveLength(1);
    expect(updates[0].input.Key.PK).toBe('TENANT#t1#PROPERTY#a');
  });

  test('dry run counts without writing', async () => {
    mockSend.mockImplementation(async (cmd) => (cmd instanceof MockQueryCommand ? { Items: [property()] } : {}));
    const stats = await syncTenantMarketplaceKeys('t1', { agency: agencyOn, dryRun: true });
    expect(stats.listed).toBe(1);
    expect(mockSend.mock.calls.filter((c) => c[0] instanceof MockUpdateCommand)).toHaveLength(0);
  });
});
