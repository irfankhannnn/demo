/**
 * Shared semantic retrieval — the ONE query path for every channel.
 *
 * The AI calling agent, the webpage SSE chat, WhatsApp/Baileys and MCP all reach
 * semantic search through this module. Do not add a second implementation: the
 * tenant-isolation and score-threshold guarantees below are only guarantees
 * because there is exactly one way in.
 *
 * Three inverted-intuition facts, all from
 * docs/proposals/agent-channel-architecture/05-retrieval-and-vector-search.md:
 *
 *  1. COSINE here is a DISTANCE, not a similarity. Lower is closer, range 0→2.
 *     A "score > 0.8 means good" check would be exactly backwards.
 *  2. SearchVectors always returns topK results, even when nothing matches.
 *     Result count tells you nothing about quality — only Score does. Without a
 *     threshold, "find properties for this buyer" confidently returns five
 *     unrelated flats for a buyer whose requirements match nothing.
 *  3. Inline filters support equality ONLY. Ranges (budget, dates, area) cannot
 *     be expressed in SearchConditionExpression and must be post-filtered after
 *     over-fetching — hence OVER_FETCH_FACTOR.
 */

import { DynamoDBClient, SearchVectorsCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';
import { embedText } from './embeddingService.js';

const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

/**
 * COSINE distance ceiling. Results scoring above this are dropped as irrelevant.
 * Tuned conservatively: better to return three good matches than ten padded with
 * noise the agent will then read aloud to a customer as if they were real.
 */
export const DEFAULT_SCORE_THRESHOLD = Number(process.env.VECTOR_SCORE_THRESHOLD || 0.55);

/**
 * Range predicates can't be inline filters, so fetch extra and post-filter.
 * Costs VectorSearchRequestBytes; the alternative is under-filled result sets.
 */
const OVER_FETCH_FACTOR = 4;
const MAX_TOP_K = 100;

let client = null;

function getClient() {
  if (!client) {
    // SearchVectors uses a separate endpoint (search-dynamodb.{region}.amazonaws.com).
    // If a VPC endpoint or egress allowlist is ever added, it must permit that host:
    // the failure mode is that writes and Query keep working and only search breaks,
    // usually as an opaque connection error. DAX does not support SearchVectors.
    client = wrapAwsClient(
      new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
      'DynamoDBVectorSearch'
    );
  }
  return client;
}

/**
 * Low-level vector search. Tenant scope is mandatory and enforced here.
 *
 * @param {object} params
 * @param {string} params.tenantId              REQUIRED — throws if absent
 * @param {number[]} params.vector              query embedding
 * @param {string} params.indexName             vector index name
 * @param {number} [params.topK]                results wanted AFTER filtering
 * @param {object} [params.equalityFilters]     inline equality filters, e.g. { EntityType: 'PROPERTY' }
 * @param {number} [params.scoreThreshold]      COSINE distance ceiling
 * @param {string} [params.tableName]
 * @returns {Promise<Array<{score:number, item:object}>>}
 */
export async function searchVectors({
  tenantId,
  vector,
  indexName,
  topK = 5,
  equalityFilters = {},
  scoreThreshold = DEFAULT_SCORE_THRESHOLD,
  tableName = CRM_TABLE_NAME,
}) {
  // Belt and braces. The vector index declares tenantId as its SearchSchema HASH,
  // so AWS rejects a call that omits it — but failing here gives a clear error
  // instead of an opaque service one, and documents the invariant at the call site.
  if (!tenantId) throw new Error('tenantId is required for vector search (cross-tenant isolation)');
  if (!Array.isArray(vector) || vector.length === 0) throw new Error('A query vector is required');
  if (!indexName) throw new Error('indexName is required');
  if (!tableName) throw new Error('CRM_DYNAMODB_TABLE_NAME is not configured');

  const conditions = ['tenantId = :tenantId'];
  const values = { ':tenantId': { S: tenantId } };

  for (const [key, value] of Object.entries(equalityFilters)) {
    if (value === undefined || value === null || value === '') continue;
    conditions.push(`${key} = :${key}`);
    values[`:${key}`] = { S: String(value) };
  }

  const requestedK = Math.min(Math.max(topK * OVER_FETCH_FACTOR, topK), MAX_TOP_K);

  const response = await getClient().send(
    new SearchVectorsCommand({
      TableName: tableName,
      IndexName: indexName,
      // Query vectors take no `L` wrapper, unlike the stored form.
      SearchVector: vector.map((n) => ({ N: String(n) })),
      TopK: requestedK,
      SearchConditionExpression: conditions.join(' AND '),
      ExpressionAttributeValues: values,
    })
  );

  // SearchVectors returns `SearchResults`, not `Items` — an easy one to get
  // wrong, and it fails silently as "no matches" rather than as an error.
  const matches = (response.SearchResults || [])
    .map((entry) => ({
      score: Number(entry.Score ?? entry.score ?? Number.POSITIVE_INFINITY),
      item: unmarshallShallow(entry.Item || entry),
    }))
    // Lower COSINE distance = more similar. Sort ascending, threshold is a ceiling.
    .filter((m) => Number.isFinite(m.score) && m.score <= scoreThreshold)
    .sort((a, b) => a.score - b.score);

  logger.info('vectorSearch.completed', {
    tenantId,
    indexName,
    requestedK,
    returned: response.SearchResults?.length || 0,
    keptAfterThreshold: matches.length,
    scoreThreshold,
  });

  return matches;
}

/**
 * Embed a natural-language query and search in one step.
 * This is what channel-facing code should call.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.query            free text, e.g. "3BHK under 80 lakhs near Whitefield"
 * @param {function} [params.postFilter]   applied AFTER search, for range predicates
 * @returns {Promise<Array<{score:number, item:object}>>}
 */
export async function semanticSearch({
  tenantId,
  query,
  indexName,
  topK = 5,
  equalityFilters = {},
  postFilter = null,
  scoreThreshold = DEFAULT_SCORE_THRESHOLD,
  tableName = CRM_TABLE_NAME,
}) {
  if (!tenantId) throw new Error('tenantId is required for semantic search');

  const text = (query || '').trim();
  if (text.length < 2) return [];

  const vector = await embedText(text);
  if (!vector) return [];

  const matches = await searchVectors({
    tenantId,
    vector,
    indexName,
    topK,
    equalityFilters,
    scoreThreshold,
    tableName,
  });

  const filtered = typeof postFilter === 'function' ? matches.filter((m) => postFilter(m.item)) : matches;

  return filtered.slice(0, topK);
}

/**
 * DynamoDB attribute-value → plain JS, one level deep with recursion for M/L.
 * Vector attributes are stripped: they are large, never useful downstream, and
 * would otherwise be serialised into an LLM prompt.
 */
function unmarshallShallow(item) {
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!value || typeof value !== 'object') continue;
    if (key.endsWith('Vector')) continue;

    if ('S' in value) out[key] = value.S;
    else if ('N' in value) out[key] = Number(value.N);
    else if ('BOOL' in value) out[key] = value.BOOL;
    else if ('NULL' in value) out[key] = null;
    else if ('M' in value) out[key] = unmarshallShallow(value.M);
    else if ('L' in value) {
      out[key] = value.L.map((v) =>
        'S' in v ? v.S : 'N' in v ? Number(v.N) : 'M' in v ? unmarshallShallow(v.M) : null
      );
    }
  }
  return out;
}

export default {
  DEFAULT_SCORE_THRESHOLD,
  searchVectors,
  semanticSearch,
};
