/**
 * Cross-agency reads: GSI4 browse puts the price range in the KEY condition,
 * AI search hydrates hits and drops anything that lost its keys in between,
 * and nothing leaves without passing the public allowlist + agency card.
 */
import { jest } from '@jest/globals';

const mockSend = jest.fn();
class MockQueryCommand { constructor(input) { this.input = input; } }
class MockBatchGetCommand { constructor(input) { this.input = input; } }

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: class {}, PutCommand: class {}, UpdateCommand: class {}, ScanCommand: class {},
  DeleteCommand: class {}, QueryCommand: MockQueryCommand, BatchGetCommand: MockBatchGetCommand,
}));

const mockGetProperty = jest.fn();
jest.unstable_mockModule('./crmDynamodbService.js', () => ({ getProperty: mockGetProperty }));

const mockGetAgencyConfig = jest.fn();
jest.unstable_mockModule('./agencyConfigService.js', () => ({ getAgencyConfig: mockGetAgencyConfig }));

const mockSemantic = jest.fn();
const mockVectors = jest.fn();
jest.unstable_mockModule('./services/embeddings/marketplaceSearchService.js', () => ({
  semanticMarketplaceSearch: mockSemantic,
  searchMarketplaceVectors: mockVectors,
}));

// publicListingService is used for real (allowlist + slug lookup); its own
// DynamoDB clients hit the same mocked send.
const {
  listMarketplaceProperties,
  searchMarketplace,
  getMarketplaceProperty,
  similarMarketplaceProperties,
  toMarketplaceListing,
  localityMatches,
} = await import('./marketplaceListingService.js');

const agency = {
  TenantId: 't-1', agencyName: 'Sharma Realty', agencySlug: 'sharma', marketplaceEnabled: true,
  publicPagesEnabled: true, adminPasswordHash: 'secret', brandPrimaryColor: '#123456',
};

function item(overrides = {}) {
  return {
    PK: 'TENANT#t-1#PROPERTY#p-1', SK: 'PROFILE', tenantId: 't-1', propertyId: 'p-1',
    title: '2 BHK Andheri', description: 'Bright flat', city: 'Mumbai', area: 'Andheri West',
    status: 'for-sale', publicVisibility: 'public', saleInfo: { listedPrice: 8500000 },
    bhk: 2, propertyType: 'apartment', ownerPhone: '9999999999', titleDeedS3Key: 'legal/deed.pdf',
    images: ['img/a.jpg', 'img/b.jpg'],
    GSI4PK: 'CITY#mumbai#sale', GSI4SK: 'PRICE#0000008500000#p-1',
    mktCityKey: 'mumbai', mktLocalityKey: 'andheri-west', mktMode: 'sale', mktListedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockSend.mockReset(); mockGetProperty.mockReset(); mockGetAgencyConfig.mockReset();
  mockSemantic.mockReset(); mockVectors.mockReset();
  mockGetAgencyConfig.mockResolvedValue(agency);
});

describe('toMarketplaceListing', () => {
  test('emits the public allowlist + agency card and never the private fields', async () => {
    const listing = await toMarketplaceListing(item());
    expect(listing.propertyId).toBe('p-1');
    expect(listing.tenantId).toBe('t-1');
    expect(listing.agencySlug).toBe('sharma');
    expect(listing.agency).toEqual({ name: 'Sharma Realty', slug: 'sharma', logoS3Key: null, brandPrimaryColor: '#123456' });
    expect(listing.pricing).toEqual({ mode: 'sale', amount: 8500000, deposit: null });
    expect(listing.imageCount).toBe(2);
    expect(listing.listedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(listing).not.toHaveProperty('ownerPhone');
    expect(listing).not.toHaveProperty('titleDeedS3Key');
    expect(listing).not.toHaveProperty('descriptionVector');
    expect(listing).not.toHaveProperty('_assetKeys');
    expect(listing).not.toHaveProperty('adminPasswordHash');
  });
});

describe('listMarketplaceProperties', () => {
  test('queries GSI4 with the price range in the key condition and serialises', async () => {
    mockSend.mockResolvedValue({ Items: [item(), item({ propertyId: 'p-2', bhk: 3, GSI4SK: 'PRICE#0000009000000#p-2' })] });
    const result = await listMarketplaceProperties({ city: 'Mumbai', mode: 'sale', minPrice: 5000000, maxPrice: 9000000, bhk: 2 });

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(MockQueryCommand);
    expect(cmd.input.IndexName).toBe('marketplace-index');
    expect(cmd.input.KeyConditionExpression).toBe('GSI4PK = :pk AND GSI4SK BETWEEN :lo AND :hi');
    expect(cmd.input.ExpressionAttributeValues[':pk']).toBe('CITY#mumbai#sale');
    expect(cmd.input.ExpressionAttributeValues[':lo']).toBe('PRICE#0000005000000#');
    expect(cmd.input.ExpressionAttributeValues[':hi'].startsWith('PRICE#0000009000000#')).toBe(true);

    // bhk=2 post-filter drops the 3 BHK
    expect(result.items.map((i) => i.propertyId)).toEqual(['p-1']);
    expect(result.nextCursor).toBeNull();
    expect(result.cityKey).toBe('mumbai');
  });

  test('empty city → empty result without a query', async () => {
    const result = await listMarketplaceProperties({ city: '' });
    expect(result.items).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('locality filter is applied after the query', async () => {
    mockSend.mockResolvedValue({ Items: [item(), item({ propertyId: 'p-3', mktLocalityKey: 'bandra' })] });
    const result = await listMarketplaceProperties({ city: 'Mumbai', locality: 'Andheri West' });
    expect(result.items.map((i) => i.propertyId)).toEqual(['p-1']);
  });
});

describe('getMarketplaceProperty', () => {
  test('null when the agency has the marketplace off, even if the property is public', async () => {
    mockGetProperty.mockResolvedValue(item());
    mockGetAgencyConfig.mockResolvedValue({ ...agency, marketplaceEnabled: false });
    expect(await getMarketplaceProperty('t-1', 'p-1')).toBeNull();
  });
  test('null when unlisted by the agent', async () => {
    mockGetProperty.mockResolvedValue(item({ marketplaceVisibility: 'unlisted' }));
    expect(await getMarketplaceProperty('t-1', 'p-1')).toBeNull();
  });
  test('listing with asset keys server-side only', async () => {
    mockGetProperty.mockResolvedValue(item());
    const l = await getMarketplaceProperty('t-1', 'p-1', { includeAssetKeys: true });
    expect(l._assetKeys.images).toEqual(['img/a.jpg', 'img/b.jpg']);
  });
});

describe('searchMarketplace', () => {
  test('embeds via the marketplace index, hydrates hits, attaches matchScore, drops de-listed hits', async () => {
    mockSemantic.mockResolvedValue([
      { score: 0.2, item: { tenantId: 't-1', propertyId: 'p-1' } },
      { score: 0.4, item: { tenantId: 't-1', propertyId: 'p-gone' } },
    ]);
    mockSend.mockImplementation(async (cmd) => {
      if (cmd instanceof MockBatchGetCommand) {
        const table = Object.keys(cmd.input.RequestItems)[0];
        expect(cmd.input.RequestItems[table].Keys).toEqual([
          { PK: 'TENANT#t-1#PROPERTY#p-1', SK: 'PROFILE' },
          { PK: 'TENANT#t-1#PROPERTY#p-gone', SK: 'PROFILE' },
        ]);
        // p-gone was unpublished after the index was read: no mktCityKey.
        return { Responses: { [table]: [item(), item({ PK: 'TENANT#t-1#PROPERTY#p-gone', propertyId: 'p-gone', mktCityKey: undefined })] } };
      }
      return {};
    });

    const result = await searchMarketplace({ query: '2 bhk near metro', city: 'Mumbai', mode: 'sale', maxPrice: 9000000 });
    expect(mockSemantic).toHaveBeenCalledTimes(1);
    const args = mockSemantic.mock.calls[0][0];
    expect(args.cityKey).toBe('mumbai');
    expect(args.mode).toBe('sale');
    expect(args.query).toBe('2 bhk near metro');
    expect(typeof args.postFilter).toBe('function');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].propertyId).toBe('p-1');
    expect(result.items[0].matchScore).toBe(0.8);
  });

  test('city is required', async () => {
    const result = await searchMarketplace({ query: 'anything' });
    expect(result).toEqual({ items: [], cityKey: null, reason: 'city_required' });
    expect(mockSemantic).not.toHaveBeenCalled();
  });

  test('a search failure degrades to empty with a reason, never throws', async () => {
    mockSemantic.mockRejectedValue(new Error('index backfilling'));
    const result = await searchMarketplace({ query: 'x y', city: 'Pune' });
    expect(result.reason).toBe('search_unavailable');
  });
});

describe('similarMarketplaceProperties', () => {
  test('uses the stored vector in the same city + mode and excludes itself', async () => {
    mockGetProperty.mockResolvedValue(item({ descriptionVector: [0.1, 0.2] }));
    mockVectors.mockResolvedValue([
      { score: 0, item: { tenantId: 't-1', propertyId: 'p-1' } },
      { score: 0.3, item: { tenantId: 't-1', propertyId: 'p-2' } },
    ]);
    mockSend.mockImplementation(async (cmd) => {
      if (cmd instanceof MockBatchGetCommand) {
        const table = Object.keys(cmd.input.RequestItems)[0];
        return { Responses: { [table]: [item({ PK: 'TENANT#t-1#PROPERTY#p-2', propertyId: 'p-2' })] } };
      }
      return {};
    });
    const items = await similarMarketplaceProperties('t-1', 'p-1', { limit: 3 });
    expect(mockVectors.mock.calls[0][0]).toMatchObject({ cityKey: 'mumbai', mode: 'sale', vector: [0.1, 0.2] });
    expect(items.map((i) => i.propertyId)).toEqual(['p-2']);
  });
  test('no vector → no similar', async () => {
    mockGetProperty.mockResolvedValue(item());
    expect(await similarMarketplaceProperties('t-1', 'p-1')).toEqual([]);
  });
});

describe('localityMatches', () => {
  test('a shorter name matches the longer one that contains its words', () => {
    expect(localityMatches('andheri-east', 'andheri')).toBe(true);
    expect(localityMatches('andheri', 'andheri-east')).toBe(true);
    expect(localityMatches('whitefield', 'whitefield')).toBe(true);
  });
  test('sibling localities do not match each other', () => {
    expect(localityMatches('andheri-west', 'andheri-east')).toBe(false);
    expect(localityMatches('bandra', 'andheri')).toBe(false);
    expect(localityMatches(null, 'andheri')).toBe(false);
  });
});
