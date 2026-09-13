/**
 * Embedding generation — Amazon Titan Text Embeddings V2.
 *
 * Implements the write-path half of docs/proposals/agent-channel-architecture/
 * 05-retrieval-and-vector-search.md. Read that document before changing anything
 * here; several of the constants below are immutable once a vector index exists.
 *
 * Two rules that are easy to get wrong:
 *  - Query and stored vectors MUST use the same model and the same dimension
 *    count, or similarity scores are meaningless rather than merely wrong.
 *  - DynamoDB keeps the vector *index* in sync with the item, but it does NOT
 *    generate embeddings. A changed description with a stale vector produces
 *    confidently wrong results and no error anywhere. That is what
 *    embeddingSourceHash exists to make detectable.
 */

import crypto from 'crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';

/**
 * Immutable once any vector index has been built with them.
 * Changing the model or dimension count invalidates every stored vector and
 * requires delete + recreate + full backfill of the index.
 */
export const EMBEDDING_MODEL_ID = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 1024);

/** Titan v2 accepts only these three. */
const VALID_DIMENSIONS = [256, 512, 1024];

/** Titan has an input ceiling; truncate rather than fail a whole write. */
const MAX_EMBEDDING_CHARS = 8000;

let client = null;

function getClient() {
  if (!client) {
    if (!VALID_DIMENSIONS.includes(EMBEDDING_DIMENSIONS)) {
      throw new Error(
        `EMBEDDING_DIMENSIONS must be one of ${VALID_DIMENSIONS.join(', ')}, got ${EMBEDDING_DIMENSIONS}`
      );
    }
    client = wrapAwsClient(
      new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
      'BedrockRuntime'
    );
  }
  return client;
}

/**
 * Assemble embedding input from labelled fields.
 *
 * Deterministic by construction: callers pass an ordered array of
 * [label, value] pairs, empty values are dropped, and the result is trimmed and
 * whitespace-collapsed. Two items with the same meaningful content always
 * produce the same string, which is what makes hashing a valid staleness check.
 *
 * Labels are included ("Area: Whitefield" rather than "Whitefield") because the
 * embedding of a bare token is ambiguous — "Whitefield" alone could be an area,
 * a building, or an owner's surname.
 *
 * @param {Array<[string, unknown]>} fields
 * @returns {string}
 */
export function buildEmbeddingSource(fields) {
  if (!Array.isArray(fields)) return '';

  return fields
    .map(([label, value]) => {
      if (value === null || value === undefined) return null;
      if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join(', ');
        return joined ? `${label}: ${joined}` : null;
      }
      const str = String(value).trim();
      if (!str || str === '0') return null;
      return `${label}: ${str}`;
    })
    .filter(Boolean)
    .join('. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_EMBEDDING_CHARS);
}

/**
 * Stable hash of the embedding source, used to skip regeneration when nothing
 * meaningful changed and to find drift during reconciliation.
 */
export function hashEmbeddingSource(source) {
  return crypto.createHash('sha256').update(source || '', 'utf8').digest('hex');
}

/**
 * Embed a single piece of text.
 *
 * @param {string} text
 * @returns {Promise<number[]|null>} null when there is nothing worth embedding
 */
export async function embedText(text) {
  const input = (text || '').trim();
  if (input.length < 3) return null;

  const body = JSON.stringify({
    inputText: input.slice(0, MAX_EMBEDDING_CHARS),
    dimensions: EMBEDDING_DIMENSIONS,
    // normalize:true is what makes COSINE meaningful for Titan output.
    normalize: true,
  });

  const response = await getClient().send(
    new InvokeModelCommand({
      modelId: EMBEDDING_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body,
    })
  );

  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const embedding = parsed?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Titan returned ${Array.isArray(embedding) ? embedding.length : 'no'} dimensions, expected ${EMBEDDING_DIMENSIONS}`
    );
  }

  return embedding;
}

/**
 * Build the attributes to merge onto an item so its vector, and the metadata
 * needed to detect staleness later, are written in the same put/update.
 *
 * Returns null when the source is unchanged (caller should skip the write) or
 * when there is nothing to embed.
 *
 * @param {Array<[string, unknown]>} fields   ordered label/value pairs
 * @param {string} vectorAttribute            e.g. 'descriptionVector'
 * @param {string|null} existingHash          item.embeddingSourceHash, if any
 */
export async function buildEmbeddingAttributes(fields, vectorAttribute, existingHash = null) {
  const source = buildEmbeddingSource(fields);
  if (!source) return null;

  const sourceHash = hashEmbeddingSource(source);
  if (existingHash && existingHash === sourceHash) return null;

  const vector = await embedText(source);
  if (!vector) return null;

  return {
    [vectorAttribute]: vector,
    embeddingSourceHash: sourceHash,
    embeddingModel: `${EMBEDDING_MODEL_ID}:${EMBEDDING_DIMENSIONS}`,
    embeddedAt: new Date().toISOString(),
  };
}

/**
 * Never let an embedding failure fail the business write.
 *
 * A property that saves without a vector is merely unsearchable-by-meaning and
 * will be picked up by the next backfill; a property that fails to save because
 * Bedrock was throttled is data loss. The asymmetry is the whole point.
 */
export async function buildEmbeddingAttributesSafe(fields, vectorAttribute, existingHash = null, context = {}) {
  try {
    return await buildEmbeddingAttributes(fields, vectorAttribute, existingHash);
  } catch (error) {
    logger.warn('embeddings.generation.failed', {
      ...context,
      vectorAttribute,
      error: error.message,
    });
    return null;
  }
}

export default {
  EMBEDDING_MODEL_ID,
  EMBEDDING_DIMENSIONS,
  buildEmbeddingSource,
  hashEmbeddingSource,
  embedText,
  buildEmbeddingAttributes,
  buildEmbeddingAttributesSafe,
};
