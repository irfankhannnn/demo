/**
 * Tests for policy chunking, ingestion idempotence, and the retrieval
 * behaviour the voice agent depends on.
 *
 * The assertions worth keeping honest here are the ones with a customer-facing
 * consequence: that chunking keeps one rule per vector, that re-saving
 * unchanged policies costs no Bedrock calls, that a stale document's old
 * chunks are removed rather than left to be quoted, and that a weak match
 * returns nothing instead of a confidently wrong policy.
 *
 * Bedrock and DynamoDB are mocked — this asserts our logic, not AWS's.
 */

import { jest } from '@jest/globals';

const mockBedrockSend = jest.fn();
const mockDynamoSend = jest.fn();
const mockDocSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockSend })),
  InvokeModelCommand: jest.fn((input) => ({ input })),
}));

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({ send: mockDynamoSend })),
  SearchVectorsCommand: jest.fn((input) => ({ input, __type: 'SearchVectors' })),
}));

// agencyConfigService (reached through policyStore) imports more of this
// module than the ingestion path does, so the mock has to cover its surface
// too or the whole suite fails to link.
jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDocSend })) },
  QueryCommand: jest.fn((input) => ({ input, __type: 'Query' })),
  BatchWriteCommand: jest.fn((input) => ({ input, __type: 'BatchWrite' })),
  GetCommand: jest.fn((input) => ({ input, __type: 'Get' })),
  PutCommand: jest.fn((input) => ({ input, __type: 'Put' })),
  UpdateCommand: jest.fn((input) => ({ input, __type: 'Update' })),
  DeleteCommand: jest.fn((input) => ({ input, __type: 'Delete' })),
  ScanCommand: jest.fn((input) => ({ input, __type: 'Scan' })),
}));

jest.unstable_mockModule('../../awsClientWrapper.js', () => ({
  wrapAwsClient: (client) => client,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    span: (_a, _b, fn) => fn(),
    child: () => ({ span: (_a, _b, fn) => fn() }),
  },
}));

process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME = 'test-knowledge-chunks';

const { chunkPolicyContent, buildChunkEmbeddingText } = await import('./policyChunker.js');
const { indexPolicyDocument, reindexTenantPolicies, normaliseCategory, resetClientForTests } =
  await import('./policyIngestionService.js');
const { searchPolicies, answerPolicyQuestion, POLICY_SCORE_THRESHOLD } = await import(
  './policySearchService.js'
);
const { normalisePolicies, PolicyValidationError, MAX_POLICY_CHARS } = await import('./policyStore.js');

const vectorOf = (fill) => new Array(1024).fill(fill);

function bedrockReturns(embedding) {
  mockBedrockSend.mockResolvedValue({
    body: new TextEncoder().encode(JSON.stringify({ embedding })),
  });
}

/** Queue DynamoDB document-client responses in call order. */
function docReturns(...responses) {
  mockDocSend.mockReset();
  responses.forEach((r) => mockDocSend.mockResolvedValueOnce(r));
  mockDocSend.mockResolvedValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
  resetClientForTests();
  bedrockReturns(vectorOf(0.1));
});

// ---------------------------------------------------------------------------

describe('chunkPolicyContent', () => {
  it('keeps one rule per chunk instead of packing to a size target', () => {
    const doc = [
      'Tenants must pay a security deposit of two months rent before moving in.',
      'Brokerage is one month rent plus GST, payable at agreement signing.',
      'Pets are allowed only in independent houses, not in apartment societies.',
    ].join('\n\n');

    const chunks = chunkPolicyContent(doc);

    // Packing these into one vector would average three unrelated rules and
    // match none of them well.
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain('security deposit');
    expect(chunks[1]).toContain('Brokerage');
    expect(chunks[2]).toContain('Pets');
  });

  it('merges a bare heading into the rule it introduces', () => {
    const chunks = chunkPolicyContent(
      'Security Deposit Policy\n\nTenants pay two months rent as a refundable deposit before moving in, returned within 30 days of vacating.'
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Security Deposit Policy');
    expect(chunks[0]).toContain('two months rent');
  });

  it('splits a paragraph that exceeds the ceiling on its own', () => {
    const long = Array.from(
      { length: 40 },
      (_, i) => `Clause ${i + 1} states that the tenant shall observe the rule in full.`
    ).join(' ');

    const chunks = chunkPolicyContent(long);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(1100));
  });

  it('does not split on abbreviations common in Indian policy text', () => {
    const chunks = chunkPolicyContent('The deposit is Rs. 50,000 for a 2 B.H.K. unit. Mr. Sharma confirms it.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Rs. 50,000');
  });

  it('returns nothing for empty content', () => {
    expect(chunkPolicyContent('')).toEqual([]);
    expect(chunkPolicyContent('   \n  ')).toEqual([]);
  });

  it('prefixes the document title so a chunk carries its own subject', () => {
    expect(buildChunkEmbeddingText('Deposit Policy', 'Two months, refundable.')).toBe(
      'Deposit Policy. Two months, refundable.'
    );
  });
});

// ---------------------------------------------------------------------------

describe('indexPolicyDocument', () => {
  const policy = {
    policyId: 'pol_1',
    title: 'Deposit Policy',
    category: 'policies',
    content: 'Tenants pay two months rent as a deposit.\n\nIt is refunded within 30 days.',
  };

  it('embeds and writes one item per chunk, tagged for tenant isolation', async () => {
    docReturns({ Items: [] }); // no existing chunks

    const result = await indexPolicyDocument('tenant-a', policy);

    expect(result.status).toBe('indexed');
    expect(result.chunks).toBe(2);

    const writes = mockDocSend.mock.calls.filter((c) => c[0].__type === 'BatchWrite');
    expect(writes).toHaveLength(1);

    const items = writes[0][0].input.RequestItems['test-knowledge-chunks'].map((r) => r.PutRequest.Item);
    expect(items).toHaveLength(2);
    items.forEach((item) => {
      expect(item.tenantId).toBe('tenant-a');
      expect(item.PK).toBe('TENANT#tenant-a#DOC#pol_1');
      expect(item.contentVector).toHaveLength(1024);
      // Always present: it is an inline filter on the vector index.
      expect(item.category).toBe('policies');
    });
    expect(items[0].SK).toBe('CHUNK#00000');
    expect(items[1].SK).toBe('CHUNK#00001');
  });

  it('skips re-embedding when the document is unchanged', async () => {
    docReturns({ Items: [] });
    await indexPolicyDocument('tenant-a', policy);
    const hash = mockDocSend.mock.calls
      .filter((c) => c[0].__type === 'BatchWrite')[0][0]
      .input.RequestItems['test-knowledge-chunks'][0].PutRequest.Item.documentHash;

    mockBedrockSend.mockClear();
    docReturns({ Items: [{ PK: 'x', SK: 'y', documentHash: hash }] });

    const result = await indexPolicyDocument('tenant-a', policy);

    expect(result.status).toBe('unchanged');
    // The settings screen re-saves everything on every edit; this is what keeps
    // that from costing a full re-embed each time.
    expect(mockBedrockSend).not.toHaveBeenCalled();
  });

  it('re-embeds when only the title changed, because the title is embedded', async () => {
    docReturns({ Items: [{ PK: 'x', SK: 'y', documentHash: 'stale-hash' }] });

    const result = await indexPolicyDocument('tenant-a', { ...policy, title: 'Renamed Policy' });

    expect(result.status).toBe('indexed');
    expect(mockBedrockSend).toHaveBeenCalled();
  });

  it('deletes existing chunks before writing, so a shortened document leaves no orphans', async () => {
    docReturns({
      Items: [
        { PK: 'TENANT#tenant-a#DOC#pol_1', SK: 'CHUNK#00000', documentHash: 'old' },
        { PK: 'TENANT#tenant-a#DOC#pol_1', SK: 'CHUNK#00001', documentHash: 'old' },
        { PK: 'TENANT#tenant-a#DOC#pol_1', SK: 'CHUNK#00002', documentHash: 'old' },
      ],
    });

    await indexPolicyDocument('tenant-a', policy);

    const batches = mockDocSend.mock.calls.filter((c) => c[0].__type === 'BatchWrite');
    const requests = batches[0][0].input.RequestItems['test-knowledge-chunks'];
    expect(requests[0].DeleteRequest).toBeDefined();
    expect(requests).toHaveLength(3);
  });

  it('removes chunks when the content is cleared rather than leaving them quotable', async () => {
    docReturns({ Items: [{ PK: 'a', SK: 'b', documentHash: 'old' }] });

    const result = await indexPolicyDocument('tenant-a', { ...policy, content: '' });

    expect(result.status).toBe('empty');
    expect(result.chunks).toBe(0);
    const batches = mockDocSend.mock.calls.filter((c) => c[0].__type === 'BatchWrite');
    expect(batches[0][0].input.RequestItems['test-knowledge-chunks'][0].DeleteRequest).toBeDefined();
  });

  it('rejects an unknown category rather than indexing something unfilterable', () => {
    expect(normaliseCategory('nonsense')).toBe('policies');
    expect(normaliseCategory('PRICING')).toBe('pricing');
    expect(normaliseCategory(undefined)).toBe('policies');
  });
});

describe('reindexTenantPolicies', () => {
  it('deletes chunks for documents removed from the set', async () => {
    mockDocSend.mockResolvedValue({ Items: [] });

    const result = await reindexTenantPolicies(
      'tenant-a',
      [{ policyId: 'pol_keep', title: 'Kept', category: 'faq', content: 'Office hours are 10 to 7.' }],
      ['pol_keep', 'pol_gone']
    );

    expect(result.indexed).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.results.find((r) => r.policyId === 'pol_gone').status).toBe('deleted');
  });
});

// ---------------------------------------------------------------------------

describe('searchPolicies', () => {
  function searchReturns(items) {
    mockDynamoSend.mockResolvedValue({ SearchResults: items });
  }

  const chunk = (text, score, title = 'Deposit Policy') => ({
    Score: score,
    Item: {
      chunkText: { S: text },
      documentTitle: { S: title },
      category: { S: 'policies' },
      policyId: { S: 'pol_1' },
      tenantId: { S: 'tenant-a' },
      contentVector: { L: [{ N: '0.1' }] },
    },
  });

  it('requires a tenant, so a bug cannot search across agencies', async () => {
    await expect(searchPolicies('', 'what is the deposit')).rejects.toThrow(/tenantId is required/);
  });

  it('scopes the search to the calling tenant', async () => {
    searchReturns([chunk('Two months rent.', 0.2)]);

    await searchPolicies('tenant-a', 'what is the deposit');

    const call = mockDynamoSend.mock.calls[0][0].input;
    expect(call.SearchConditionExpression).toContain('tenantId = :tenantId');
    expect(call.ExpressionAttributeValues[':tenantId']).toEqual({ S: 'tenant-a' });
  });

  it('drops weak matches instead of quoting an unrelated rule', async () => {
    searchReturns([chunk('Pets are not allowed.', POLICY_SCORE_THRESHOLD + 0.2)]);

    const results = await searchPolicies('tenant-a', 'what is the deposit');

    expect(results).toEqual([]);
  });

  it('is stricter than property search, because a wrong policy is stated as fact', () => {
    expect(POLICY_SCORE_THRESHOLD).toBeLessThan(0.7);
  });

  it('only applies a category filter when one was actually supplied', async () => {
    searchReturns([chunk('Two months rent.', 0.2)]);

    await searchPolicies('tenant-a', 'what is the deposit');
    expect(mockDynamoSend.mock.calls[0][0].input.SearchConditionExpression).not.toContain('category');

    mockDynamoSend.mockClear();
    await searchPolicies('tenant-a', 'what is the deposit', { category: 'pricing' });
    expect(mockDynamoSend.mock.calls[0][0].input.SearchConditionExpression).toContain('category');
  });

  it('never returns the raw vector, which would otherwise reach an LLM prompt', async () => {
    searchReturns([chunk('Two months rent.', 0.2)]);

    const results = await searchPolicies('tenant-a', 'deposit');

    expect(results[0]).not.toHaveProperty('contentVector');
    expect(results[0].chunkText).toBe('Two months rent.');
  });
});

describe('answerPolicyQuestion', () => {
  function searchReturns(items) {
    mockDynamoSend.mockResolvedValue({ SearchResults: items });
  }

  it('returns a null answer on no match, so the agent offers a human', async () => {
    searchReturns([]);

    const result = await answerPolicyQuestion('tenant-a', 'do you accept crypto');

    expect(result.answer).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.sources).toEqual([]);
  });

  it('joins passages and names the documents they came from', async () => {
    searchReturns([
      {
        Score: 0.1,
        Item: {
          chunkText: { S: 'Deposit is two months rent.' },
          documentTitle: { S: 'Deposit Policy' },
          category: { S: 'policies' },
          policyId: { S: 'pol_1' },
        },
      },
      {
        Score: 0.2,
        Item: {
          chunkText: { S: 'Refunded within 30 days.' },
          documentTitle: { S: 'Deposit Policy' },
          category: { S: 'policies' },
          policyId: { S: 'pol_1' },
        },
      },
    ]);

    const result = await answerPolicyQuestion('tenant-a', 'what is the deposit');

    expect(result.answer).toContain('two months rent');
    expect(result.answer).toContain('30 days');
    // Deduplicated: both passages come from one document.
    expect(result.sources).toEqual(['Deposit Policy']);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

// ---------------------------------------------------------------------------

describe('normalisePolicies', () => {
  it('mints ids for new documents and preserves existing ones', () => {
    const result = normalisePolicies([
      { title: 'New', content: 'Some rule text here.' },
      { policyId: 'pol_existing', title: 'Old', content: 'Another rule.' },
    ]);

    expect(result[0].policyId).toMatch(/^pol_[0-9a-f]{16}$/);
    // Preserved, so editing updates chunks in place instead of orphaning them.
    expect(result[1].policyId).toBe('pol_existing');
  });

  it('reassigns a duplicate id so two documents cannot fight over chunk keys', () => {
    const result = normalisePolicies([
      { policyId: 'pol_same', title: 'A', content: 'Rule A.' },
      { policyId: 'pol_same', title: 'B', content: 'Rule B.' },
    ]);

    expect(result[0].policyId).not.toBe(result[1].policyId);
  });

  it('rejects a document large enough to threaten the agency record', () => {
    expect(() =>
      normalisePolicies([{ title: 'Huge', content: 'x'.repeat(MAX_POLICY_CHARS + 1) }])
    ).toThrow(PolicyValidationError);
  });

  it('rejects a policy with no title or no content', () => {
    expect(() => normalisePolicies([{ title: '', content: 'text' }])).toThrow(/needs a title/);
    expect(() => normalisePolicies([{ title: 'T', content: '' }])).toThrow(/no content/);
  });

  it('rejects a non-array payload', () => {
    expect(() => normalisePolicies({ title: 'x' })).toThrow(/must be an array/);
  });
});
