/**
 * Tests for the deterministic halves of semantic retrieval: embedding source
 * assembly, staleness hashing, and the tenant-isolation / score-threshold
 * guarantees that make the shared retrieval service safe to expose to four
 * channels at once.
 *
 * Bedrock and DynamoDB are mocked — this asserts our logic, not AWS's.
 */

import { jest } from '@jest/globals';

const mockBedrockSend = jest.fn();
const mockDynamoSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockSend })),
  InvokeModelCommand: jest.fn((input) => ({ input })),
}));

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  SearchVectorsCommand: jest.fn((input) => ({ input, constructor: { name: 'SearchVectorsCommand' } })),
}));

jest.unstable_mockModule('../../awsClientWrapper.js', () => ({
  wrapAwsClient: (client) => client,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), child: () => ({ span: (_a, _b, fn) => fn() }) },
}));

const { buildEmbeddingSource, hashEmbeddingSource, buildEmbeddingAttributesSafe } = await import(
  './embeddingService.js'
);
const { searchVectors, semanticSearch } = await import('./vectorSearchService.js');
const { propertyEmbeddingFields, matchProperties } = await import('./propertySearchService.js');

const vectorOf = (fill) => new Array(1024).fill(fill);

function bedrockReturns(embedding) {
  mockBedrockSend.mockResolvedValue({
    body: new TextEncoder().encode(JSON.stringify({ embedding })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  bedrockReturns(vectorOf(0.1));
});

describe('buildEmbeddingSource', () => {
  it('labels values so bare tokens are not ambiguous', () => {
    const source = buildEmbeddingSource([['Area', 'Whitefield'], ['City', 'Bangalore']]);
    expect(source).toBe('Area: Whitefield. City: Bangalore');
  });

  it('drops empty, null and zero values rather than emitting noise', () => {
    const source = buildEmbeddingSource([
      ['Title', 'Sea view flat'],
      ['Description', ''],
      ['Carpet area', null],
      ['Floor', undefined],
      ['Rent', 0],
    ]);
    expect(source).toBe('Title: Sea view flat');
  });

  it('joins array values such as amenities', () => {
    const source = buildEmbeddingSource([['Amenities', ['Gym', 'Pool', 'Parking']]]);
    expect(source).toBe('Amenities: Gym, Pool, Parking');
  });

  it('is deterministic — identical content always yields an identical hash', () => {
    const fields = [['Title', 'Flat'], ['Area', 'Bandra']];
    expect(hashEmbeddingSource(buildEmbeddingSource(fields))).toBe(
      hashEmbeddingSource(buildEmbeddingSource([...fields]))
    );
  });

  it('collapses whitespace so formatting changes do not look like content changes', () => {
    const a = hashEmbeddingSource(buildEmbeddingSource([['Description', 'A  quiet   flat']]));
    const b = hashEmbeddingSource(buildEmbeddingSource([['Description', 'A quiet flat']]));
    expect(a).toBe(b);
  });
});

describe('embedding staleness', () => {
  it('skips regeneration when the source is unchanged', async () => {
    const fields = [['Title', 'Sea view flat']];
    const hash = hashEmbeddingSource(buildEmbeddingSource(fields));

    const result = await buildEmbeddingAttributesSafe(fields, 'descriptionVector', hash);

    expect(result).toBeNull();
    expect(mockBedrockSend).not.toHaveBeenCalled();
  });

  it('regenerates when the source changed, and records model and timestamp', async () => {
    const result = await buildEmbeddingAttributesSafe(
      [['Title', 'Sea view flat']],
      'descriptionVector',
      'a-stale-hash'
    );

    expect(result.descriptionVector).toHaveLength(1024);
    expect(result.embeddingModel).toContain('titan-embed-text-v2');
    expect(result.embeddedAt).toBeTruthy();
    expect(mockBedrockSend).toHaveBeenCalledTimes(1);
  });

  it('never fails the business write when Bedrock is unavailable', async () => {
    mockBedrockSend.mockRejectedValue(new Error('ThrottlingException'));

    const result = await buildEmbeddingAttributesSafe([['Title', 'Flat']], 'descriptionVector');

    // Null, not a throw: an unsearchable property is recoverable by backfill,
    // a property that failed to save is data loss.
    expect(result).toBeNull();
  });
});

describe('tenant isolation', () => {
  it('refuses to search without a tenantId', async () => {
    await expect(
      searchVectors({ vector: vectorOf(0.1), indexName: 'property-vector-index' })
    ).rejects.toThrow(/tenantId is required/);
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });

  it('always sends tenantId in the search condition', async () => {
    mockDynamoSend.mockResolvedValue({ SearchResults: [] });

    await searchVectors({
      tenantId: 'tenant-a',
      vector: vectorOf(0.1),
      indexName: 'property-vector-index',
    });

    const sent = mockDynamoSend.mock.calls[0][0].input;
    expect(sent.SearchConditionExpression).toContain('tenantId = :tenantId');
    expect(sent.ExpressionAttributeValues[':tenantId']).toEqual({ S: 'tenant-a' });
  });

  it('scopes the property search to PROPERTY items so one index cannot mix entities', async () => {
    mockDynamoSend.mockResolvedValue({ SearchResults: [] });

    await matchProperties('tenant-a', { query: 'quiet 3bhk' });

    const sent = mockDynamoSend.mock.calls[0][0].input;
    expect(sent.SearchConditionExpression).toContain('EntityType = :EntityType');
    expect(sent.ExpressionAttributeValues[':EntityType']).toEqual({ S: 'PROPERTY' });
  });
});

describe('score thresholding and ordering', () => {
  const item = (id, score) => ({
    Score: score,
    Item: { propertyId: { S: id }, tenantId: { S: 'tenant-a' }, bhk: { N: '3' } },
  });

  it('drops results beyond the distance ceiling instead of padding the list', async () => {
    // SearchVectors always returns topK, even when nothing matches — count
    // means nothing, only score does.
    mockDynamoSend.mockResolvedValue({
      SearchResults: [item('close', 0.1), item('far', 1.4), item('alsoFar', 1.9)],
    });

    const results = await searchVectors({
      tenantId: 'tenant-a',
      vector: vectorOf(0.1),
      indexName: 'property-vector-index',
    });

    expect(results).toHaveLength(1);
    expect(results[0].item.propertyId).toBe('close');
  });

  it('sorts ascending because COSINE here is a distance, not a similarity', async () => {
    mockDynamoSend.mockResolvedValue({
      SearchResults: [item('mid', 0.3), item('best', 0.05), item('worst', 0.5)],
    });

    const results = await searchVectors({
      tenantId: 'tenant-a',
      vector: vectorOf(0.1),
      indexName: 'property-vector-index',
    });

    expect(results.map((r) => r.item.propertyId)).toEqual(['best', 'mid', 'worst']);
  });

  it('strips vector attributes so embeddings never reach an LLM prompt', async () => {
    mockDynamoSend.mockResolvedValue({
      SearchResults: [
        {
          Score: 0.1,
          Item: {
            propertyId: { S: 'p1' },
            descriptionVector: { L: [{ N: '0.1' }, { N: '0.2' }] },
          },
        },
      ],
    });

    const results = await searchVectors({
      tenantId: 'tenant-a',
      vector: vectorOf(0.1),
      indexName: 'property-vector-index',
    });

    expect(results[0].item).not.toHaveProperty('descriptionVector');
    expect(results[0].item.propertyId).toBe('p1');
  });
});

describe('range post-filtering', () => {
  const propertyItem = (id, price, bhk) => ({
    Score: 0.1,
    Item: {
      propertyId: { S: id },
      tenantId: { S: 'tenant-a' },
      rentAmount: { N: String(price) },
      bhk: { N: String(bhk) },
      status: { S: 'available' },
    },
  });

  it('applies budget ranges that inline filters cannot express', async () => {
    mockDynamoSend.mockResolvedValue({
      SearchResults: [
        propertyItem('cheap', 5000000, 3),
        propertyItem('affordable', 7500000, 3),
        propertyItem('tooExpensive', 12000000, 3),
      ],
    });

    const results = await matchProperties('tenant-a', {
      query: '3bhk near the metro',
      maxPrice: 8000000,
    });

    expect(results.map((r) => r.propertyId)).toEqual(['cheap', 'affordable']);
  });

  it('over-fetches so range filtering does not under-fill the result set', async () => {
    mockDynamoSend.mockResolvedValue({ SearchResults: [] });

    await matchProperties('tenant-a', { query: '3bhk', limit: 5, maxPrice: 8000000 });

    // topK is multiplied because post-filtering discards some of what comes back.
    expect(mockDynamoSend.mock.calls[0][0].input.TopK).toBeGreaterThan(5);
  });

  it('filters on bedrooms as a range', async () => {
    mockDynamoSend.mockResolvedValue({
      SearchResults: [propertyItem('small', 5000000, 1), propertyItem('right', 5000000, 3)],
    });

    const results = await matchProperties('tenant-a', { query: 'flat', minBedrooms: 2 });

    expect(results.map((r) => r.propertyId)).toEqual(['right']);
  });
});

describe('propertyEmbeddingFields', () => {
  it('excludes owner identity and exact address from the embedding', () => {
    const fields = propertyEmbeddingFields({
      title: 'Flat',
      ownerName: 'Rajesh Kumar',
      ownerPhone: '+919876543210',
      address: '402, Sunrise Apartments, MG Road',
      flatNumber: '402',
      area: 'Whitefield',
    });

    const source = buildEmbeddingSource(fields).toLowerCase();
    expect(source).not.toContain('rajesh');
    expect(source).not.toContain('9876543210');
    expect(source).not.toContain('402');
    expect(source).toContain('whitefield');
  });

  it('includes the free-text fields that carry meaning', () => {
    const source = buildEmbeddingSource(
      propertyEmbeddingFields({
        title: 'Spacious sea-facing flat',
        description: 'Close to the metro, quiet street',
        bhk: 3,
        amenities: ['Parking', 'Gym'],
      })
    );

    expect(source).toContain('Spacious sea-facing flat');
    expect(source).toContain('Close to the metro');
    expect(source).toContain('3 BHK');
    expect(source).toContain('Parking');
  });
});

describe('semanticSearch guards', () => {
  it('returns nothing for a query too short to carry meaning', async () => {
    const results = await semanticSearch({
      tenantId: 'tenant-a',
      query: 'a',
      indexName: 'property-vector-index',
    });

    expect(results).toEqual([]);
    expect(mockBedrockSend).not.toHaveBeenCalled();
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });
});
