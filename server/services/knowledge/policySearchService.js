/**
 * Policy retrieval — the read half of the knowledge base.
 *
 * This replaces the Bedrock Knowledge Base path that `ragService` used to call.
 * The reasons for moving are worth recording, because "use a managed RAG
 * service" is the obvious choice and we deliberately did not:
 *
 *  - A Bedrock Knowledge Base needs a separate vector store, most of which bill
 *    for provisioned capacity whether or not anyone asks a question. Policy
 *    queries are low-volume and bursty — the worst possible fit for an
 *    always-on minimum.
 *  - We already run Titan embeddings and DynamoDB vector search for property
 *    matching. A second retrieval stack means two sets of tenant-isolation
 *    guarantees to keep correct, and tenant isolation is the thing that must
 *    never be subtly wrong.
 *
 * The one capability given up is generation: RetrieveAndGenerate returned a
 * written answer, this returns passages. That turns out to be the better shape
 * for a phone call — the voice agent's own LLM already holds the conversation
 * and phrases the reply, so we avoid a second LLM round trip inside the
 * caller's silence. See `answerPolicyQuestion` in the AI calling service.
 */

import { semanticSearch } from '../embeddings/vectorSearchService.js';
import { normaliseCategory } from './policyIngestionService.js';
import { logger } from '../../logger.js';

export const POLICY_VECTOR_INDEX = 'knowledge-vector-index';
export const POLICY_VECTOR_ATTRIBUTE = 'contentVector';

/**
 * COSINE distance ceiling for policy passages.
 *
 * Tighter than property search (0.7) on purpose. A loose property match shows
 * the customer a flat they did not ask about, which is recoverable. A loose
 * policy match has the agent state a rule that does not apply to the question
 * — on a recorded call, to a customer who will act on it. Returning nothing is
 * the better failure: the agent then offers a human, which is correct.
 */
export const POLICY_SCORE_THRESHOLD = 0.55;

/** Passages returned. Enough to cover a multi-part rule, few enough to stay terse. */
const DEFAULT_LIMIT = 3;

/** Ceiling on the assembled context handed to the voice agent. */
const MAX_CONTEXT_CHARS = 900;

function tableName() {
  return process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME;
}

/**
 * Find policy passages answering a question.
 *
 * @param {string} tenantId
 * @param {string} question
 * @param {object} [options]
 * @param {string} [options.category] one of the indexed categories; ignored if unknown
 * @param {number} [options.limit]
 * @returns {Promise<Array<{chunkText:string, documentTitle:string, category:string, policyId:string, score:number}>>}
 */
export async function searchPolicies(tenantId, question, options = {}) {
  if (!tenantId) throw new Error('tenantId is required for policy search');

  const table = tableName();
  if (!table) {
    // Not configured is different from no match, and the difference matters
    // when debugging why an agent says it does not know something.
    logger.warn('policySearch.notConfigured', { tenantId });
    return [];
  }

  const query = String(question || '').trim();
  if (query.length < 3) return [];

  // Only constrain by category when the caller supplied a real one. Passing a
  // defaulted category would silently hide every policy filed elsewhere.
  const requested = String(options.category || '').trim().toLowerCase();
  const category = requested ? normaliseCategory(requested) : null;

  const matches = await semanticSearch({
    tenantId,
    query,
    indexName: POLICY_VECTOR_INDEX,
    tableName: table,
    topK: options.limit || DEFAULT_LIMIT,
    equalityFilters: category ? { category } : {},
    scoreThreshold: options.scoreThreshold ?? POLICY_SCORE_THRESHOLD,
  });

  return matches.map(({ score, item }) => ({
    chunkText: item.chunkText,
    documentTitle: item.documentTitle,
    category: item.category,
    policyId: item.policyId,
    score,
  }));
}

/**
 * Retrieval shaped for the voice agent's `answer_policy_question` tool.
 *
 * Returns passages joined into a context block plus the documents they came
 * from, so the agent can say "as per our tenancy policy" rather than asserting
 * a rule from nowhere.
 *
 * `answer` is null when nothing cleared the threshold. Callers must treat that
 * as "say you do not know and offer a human", never as an empty answer to read
 * out.
 */
export async function answerPolicyQuestion(tenantId, question, category = null) {
  const passages = await searchPolicies(tenantId, question, { category });

  if (!passages.length) {
    return { answer: null, sources: [], confidence: 0 };
  }

  let context = '';
  const sources = [];
  for (const passage of passages) {
    const next = context ? `${context} ${passage.chunkText}` : passage.chunkText;
    if (next.length > MAX_CONTEXT_CHARS) break;
    context = next;
    if (passage.documentTitle && !sources.includes(passage.documentTitle)) {
      sources.push(passage.documentTitle);
    }
  }

  // Guard the case where the single best passage alone exceeds the ceiling.
  if (!context) {
    context = passages[0].chunkText.slice(0, MAX_CONTEXT_CHARS);
    if (passages[0].documentTitle) sources.push(passages[0].documentTitle);
  }

  // Distance → confidence. COSINE distance is 0 (identical) to 2 (opposite);
  // over the range we actually accept, 1 - distance is a fair reading and is
  // only ever used for logging and thresholding upstream, never spoken.
  const confidence = Math.max(0, Math.min(1, 1 - passages[0].score));

  return { answer: context, sources, confidence, passages: passages.length };
}

export default {
  POLICY_VECTOR_INDEX,
  POLICY_VECTOR_ATTRIBUTE,
  POLICY_SCORE_THRESHOLD,
  searchPolicies,
  answerPolicyQuestion,
};
