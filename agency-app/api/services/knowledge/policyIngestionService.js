/**
 * Policy ingestion — turns an agency's authored policy documents into
 * embedded, searchable chunks.
 *
 * Where things live, and why:
 *
 *  - The SOURCE documents live on the agency's own record in the AgencyConfig
 *    table (one item per TenantId). That is the agency's own data, edited
 *    during onboarding and in CRM settings, and it is what an agency owner
 *    expects to see and change.
 *  - The CHUNKS live in a separate KnowledgeChunks table. They are derived
 *    data: disposable, regenerable from the source, and written at a different
 *    rate than the agency record.
 *
 * The chunks are deliberately NOT in the CRM table alongside property vectors.
 * A DynamoDB vector index's projection is immutable — adding one projected
 * field later means deleting and rebuilding the index. Sharing one index would
 * mean any future policy field forces a rebuild that re-embeds every property
 * in the system. Separate indexes keep those two blast radii apart.
 *
 * Ingestion is idempotent. Re-running with unchanged content is a few cheap
 * Queries and no Bedrock calls at all, which matters because the CRM settings
 * screen re-saves the whole policy set on every edit.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';
import {
  embedText,
  hashEmbeddingSource,
  EMBEDDING_MODEL_ID,
  EMBEDDING_DIMENSIONS,
} from '../embeddings/embeddingService.js';
import { chunkPolicyContent, buildChunkEmbeddingText } from './policyChunker.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';

/** Resolved per call, not at import: tests and Lambda set this at different times. */
function tableName() {
  return process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME;
}

export const POLICY_CATEGORIES = ['faq', 'policies', 'agency_info', 'pricing'];
export const DEFAULT_CATEGORY = 'policies';

/** DynamoDB caps BatchWrite at 25 items. */
const BATCH_SIZE = 25;

/** Bedrock calls in flight per document. Quick enough, low enough not to throttle. */
const EMBED_CONCURRENCY = 4;

let docClient = null;

function getClient() {
  if (!docClient) {
    const table = tableName();
    if (!table) throw new Error('KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME is not configured');
    docClient = DynamoDBDocumentClient.from(
      wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: table })
    );
  }
  return docClient;
}

/** Exposed for tests, which swap the table name between cases. */
export function resetClientForTests() {
  docClient = null;
}

const docPk = (tenantId, policyId) => `TENANT#${tenantId}#DOC#${policyId}`;
const chunkSk = (index) => `CHUNK#${String(index).padStart(5, '0')}`;

/** Normalise a category to one we actually index; never trust caller input. */
export function normaliseCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  return POLICY_CATEGORIES.includes(value) ? value : DEFAULT_CATEGORY;
}

/**
 * Hash covering everything that changes the stored chunks. Title is included
 * because it is embedded into every chunk; category because it is an inline
 * filter on the index, so a category change alters what a search can reach.
 */
function documentHashOf(policy) {
  return hashEmbeddingSource(
    [
      String(policy.title || '').trim(),
      normaliseCategory(policy.category),
      String(policy.content || '').trim(),
      `${EMBEDDING_MODEL_ID}:${EMBEDDING_DIMENSIONS}`,
    ].join('|')
  );
}

/** All chunk keys currently stored for one document. */
async function listChunkKeys(tenantId, policyId) {
  const keys = [];
  let lastKey;

  do {
    const result = await getClient().send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': docPk(tenantId, policyId) },
        ProjectionExpression: 'PK, SK, documentHash',
        ExclusiveStartKey: lastKey,
      })
    );
    keys.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

async function batchDelete(items) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    await getClient().send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName()]: slice.map((it) => ({ DeleteRequest: { Key: { PK: it.PK, SK: it.SK } } })),
        },
      })
    );
  }
}

async function batchPut(items) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    await getClient().send(
      new BatchWriteCommand({
        RequestItems: { [tableName()]: slice.map((Item) => ({ PutRequest: { Item } })) },
      })
    );
  }
}

/** Embed an array of texts with bounded concurrency, preserving order. */
async function embedAll(texts) {
  const out = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await embedText(texts[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(EMBED_CONCURRENCY, texts.length) }, worker));
  return out;
}

/**
 * Re-index a single policy document.
 *
 * @returns {Promise<{policyId:string, status:'unchanged'|'indexed'|'empty', chunks:number}>}
 */
export async function indexPolicyDocument(tenantId, policy) {
  if (!tenantId) throw new Error('tenantId is required');
  const policyId = String(policy?.policyId || '').trim();
  if (!policyId) throw new Error('policyId is required');

  const existing = await listChunkKeys(tenantId, policyId);
  const hash = documentHashOf(policy);

  if (existing.length && existing[0].documentHash === hash) {
    return { policyId, status: 'unchanged', chunks: existing.length };
  }

  const title = String(policy.title || '').trim();
  const category = normaliseCategory(policy.category);
  const chunks = chunkPolicyContent(policy.content);

  if (!chunks.length) {
    // Content was cleared. Remove what is there so the agent stops citing a
    // policy the agency has deleted.
    if (existing.length) await batchDelete(existing);
    return { policyId, status: 'empty', chunks: 0 };
  }

  const vectors = await embedAll(chunks.map((c) => buildChunkEmbeddingText(title, c)));
  const now = new Date().toISOString();

  const items = [];
  chunks.forEach((chunkText, index) => {
    const vector = vectors[index];
    // A chunk whose embedding failed is skipped rather than stored vectorless:
    // a chunk with no vector is invisible to search but still counted, which
    // would make a partial index look complete.
    if (!vector) return;
    items.push({
      PK: docPk(tenantId, policyId),
      SK: chunkSk(index),
      tenantId,
      policyId,
      documentTitle: title,
      // Always present, never empty — it is an inline filter on the vector
      // index, and an item missing a filter attribute is not reliably matchable.
      category,
      chunkIndex: index,
      chunkText,
      contentVector: vector,
      documentHash: hash,
      embeddingModel: `${EMBEDDING_MODEL_ID}:${EMBEDDING_DIMENSIONS}`,
      embeddedAt: now,
    });
  });

  if (!items.length) throw new Error(`Every chunk of policy ${policyId} failed to embed`);

  // Delete first, then write. The reverse order can leave orphaned chunks from
  // a previous, longer version of the document.
  if (existing.length) await batchDelete(existing);
  await batchPut(items);

  logger.info('policyIngestion.indexed', {
    tenantId,
    policyId,
    chunks: items.length,
    skipped: chunks.length - items.length,
  });

  return { policyId, status: 'indexed', chunks: items.length };
}

/** Remove every chunk of a document, e.g. when the agency deletes a policy. */
export async function deletePolicyDocument(tenantId, policyId) {
  const existing = await listChunkKeys(tenantId, policyId);
  if (existing.length) await batchDelete(existing);
  return { policyId, status: 'deleted', chunks: existing.length };
}

/**
 * Re-index a tenant's full policy set, and remove chunks for documents that
 * are no longer in it.
 *
 * @param {string} tenantId
 * @param {Array<{policyId:string,title:string,category:string,content:string}>} policies
 * @param {string[]} [previousPolicyIds] ids present before this save
 */
export async function reindexTenantPolicies(tenantId, policies = [], previousPolicyIds = []) {
  if (!tenantId) throw new Error('tenantId is required');

  const results = [];
  for (const policy of policies) {
    results.push(await indexPolicyDocument(tenantId, policy));
  }

  const liveIds = new Set(policies.map((p) => String(p.policyId)));
  const removed = previousPolicyIds.filter((id) => !liveIds.has(String(id)));
  for (const policyId of removed) {
    results.push(await deletePolicyDocument(tenantId, policyId));
  }

  return {
    indexed: results.filter((r) => r.status === 'indexed').length,
    unchanged: results.filter((r) => r.status === 'unchanged').length,
    deleted: results.filter((r) => r.status === 'deleted').length,
    totalChunks: results.reduce((n, r) => n + (r.status === 'deleted' ? 0 : r.chunks), 0),
    results,
  };
}

export default {
  POLICY_CATEGORIES,
  DEFAULT_CATEGORY,
  normaliseCategory,
  indexPolicyDocument,
  deletePolicyDocument,
  reindexTenantPolicies,
  resetClientForTests,
};
