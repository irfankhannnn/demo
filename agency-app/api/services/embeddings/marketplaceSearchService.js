/**
 * Cross-agency semantic search for the consumer marketplace.
 *
 * Deliberately a SEPARATE entry point from vectorSearchService.searchVectors():
 * that function's whole contract is "tenantId is mandatory", and the CRM
 * channels (voice, WhatsApp, MCP) rely on it. The marketplace is the one
 * caller that legitimately ranks listings from every agency at once, so it
 * gets its own function against its own index rather than an escape hatch in
 * the tenant-scoped one.
 *
 * The index (`marketplace-vector-index`, created by infra/create-vector-index.mjs
 * target `marketplace`) is over the SAME `descriptionVector` attribute as the
 * tenant index — no re-embedding, no copy — but HASH-keyed by `mktCityKey`,
 * which only marketplace-visible items carry (see marketplaceIndexing.js). An
 * unlisted property is absent from the index, not filtered out of it.
 */

import { DynamoDBClient, SearchVectorsCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';
import { embedText } from './embeddingService.js';
import { DEFAULT_SCORE_THRESHOLD, unmarshallShallow } from './vectorSearchService.js';

export const MARKETPLACE_VECTOR_INDEX = 'marketplace-vector-index';

const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const OVER_FETCH_FACTOR = 4;
const MAX_TOP_K = 100;

let client = null;
function getClient() {
  if (!client) {
    client = wrapAwsClient(
      new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
      'DynamoDBVectorSearch',
    );
  }
  return client;
}

/**
 * Rank marketplace-visible listings in one city against a query vector.
 *
 * @param {object} params
 * @param {string} params.cityKey          REQUIRED — the index partition (normaliseLocationKey(city))
 * @param {number[]} params.vector
 * @param {number} [params.topK]           results wanted AFTER filtering
 * @param {string} [params.localityKey]    inline equality filter
 * @param {string} [params.mode]           'sale' | 'rent'
 * @param {string} [params.propertyType]
 * @param {number} [params.scoreThreshold] COSINE distance ceiling
 * @returns {Promise<Array<{score:number, item:object}>>}
 */
export async function searchMarketplaceVectors({
  cityKey,
  vector,
  topK = 12,
  localityKey = null,
  mode = null,
  propertyType = null,
  scoreThreshold = DEFAULT_SCORE_THRESHOLD,
  tableName = CRM_TABLE_NAME,
}) {
  if (!cityKey) throw new Error('cityKey is required for marketplace vector search');
  if (!Array.isArray(vector) || vector.length === 0) throw new Error('A query vector is required');
  if (!tableName) throw new Error('CRM_DYNAMODB_TABLE_NAME is not configured');

  const conditions = ['mktCityKey = :city'];
  const values = { ':city': { S: cityKey } };
  if (localityKey) { conditions.push('mktLocalityKey = :loc'); values[':loc'] = { S: localityKey }; }
  if (mode) { conditions.push('mktMode = :mode'); values[':mode'] = { S: mode }; }
  if (propertyType) { conditions.push('propertyType = :pt'); values[':pt'] = { S: propertyType }; }

  const requestedK = Math.min(Math.max(topK * OVER_FETCH_FACTOR, topK), MAX_TOP_K);

  const response = await getClient().send(new SearchVectorsCommand({
    TableName: tableName,
    IndexName: MARKETPLACE_VECTOR_INDEX,
    SearchVector: vector.map((n) => ({ N: String(n) })),
    TopK: requestedK,
    SearchConditionExpression: conditions.join(' AND '),
    ExpressionAttributeValues: values,
  }));

  const matches = (response.SearchResults || [])
    .map((entry) => ({
      score: Number(entry.Score ?? entry.score ?? Number.POSITIVE_INFINITY),
      item: unmarshallShallow(entry.Item || entry),
    }))
    .filter((m) => Number.isFinite(m.score) && m.score <= scoreThreshold)
    .sort((a, b) => a.score - b.score);

  logger.info('marketplaceVectorSearch.completed', {
    cityKey, localityKey, mode, propertyType, requestedK,
    returned: response.SearchResults?.length || 0,
    keptAfterThreshold: matches.length,
  });

  return matches;
}

/**
 * Embed free text and search. Returns [] for a query too short to mean anything.
 */
export async function semanticMarketplaceSearch({ query, postFilter = null, topK = 12, ...rest }) {
  const text = (query || '').trim();
  if (text.length < 2) return [];
  const vector = await embedText(text);
  if (!vector) return [];
  const matches = await searchMarketplaceVectors({ vector, topK, ...rest });
  const filtered = typeof postFilter === 'function' ? matches.filter((m) => postFilter(m.item)) : matches;
  return filtered.slice(0, topK);
}

export default { MARKETPLACE_VECTOR_INDEX, searchMarketplaceVectors, semanticMarketplaceSearch };
