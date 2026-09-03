/**
 * Policy documents as authored by the agency.
 *
 * Source of truth is a `policies` array on the agency's AgencyConfig item —
 * the same record onboarding creates, so an agency can write its policies
 * during onboarding and edit them later in CRM settings without a second
 * storage concept.
 *
 * Storing them on the agency item rather than in their own table is a
 * deliberate trade. It costs a size ceiling (a DynamoDB item is capped at
 * 400KB, and this record already carries the agency's configuration), and buys
 * a single read for "everything about this agency" — which is how the
 * onboarding and settings screens actually load. The derived chunks, which
 * have no such ceiling, live in their own table; see policyIngestionService.
 *
 * Every write re-indexes. Re-indexing is idempotent and skips unchanged
 * documents, so saving a settings form that touched one policy of ten costs
 * one document's embeddings, not ten.
 */

import crypto from 'crypto';
import { getAgencyConfig, updateAgencyConfig } from '../../agencyConfigService.js';
import { reindexTenantPolicies, normaliseCategory, POLICY_CATEGORIES } from './policyIngestionService.js';
import { logger } from '../../logger.js';

/**
 * Per-document and total ceilings, enforced so a paste of a 300-page PDF
 * cannot make the agency record unwritable. The failure without these is
 * nasty: the item exceeds 400KB and EVERY subsequent agency config write
 * fails, not just the policy save.
 */
export const MAX_POLICY_CHARS = 20000;
export const MAX_POLICIES = 50;
export const MAX_TOTAL_CHARS = 150000;

const MAX_TITLE_CHARS = 200;

export class PolicyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyValidationError';
    this.statusCode = 400;
  }
}

function newPolicyId() {
  return `pol_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Validate and normalise an incoming policy set.
 *
 * Ids are preserved when supplied and minted otherwise, so editing an existing
 * policy updates its chunks in place instead of orphaning them and creating a
 * duplicate set under a new id.
 */
export function normalisePolicies(input) {
  if (!Array.isArray(input)) {
    throw new PolicyValidationError('policies must be an array');
  }
  if (input.length > MAX_POLICIES) {
    throw new PolicyValidationError(`At most ${MAX_POLICIES} policy documents are supported`);
  }

  const seenIds = new Set();
  let total = 0;

  const policies = input.map((raw, index) => {
    const title = String(raw?.title || '').trim();
    const content = String(raw?.content || '').trim();

    if (!title) throw new PolicyValidationError(`Policy ${index + 1} needs a title`);
    if (title.length > MAX_TITLE_CHARS) {
      throw new PolicyValidationError(`Policy "${title.slice(0, 40)}" has a title longer than ${MAX_TITLE_CHARS} characters`);
    }
    if (!content) throw new PolicyValidationError(`Policy "${title}" has no content`);
    if (content.length > MAX_POLICY_CHARS) {
      throw new PolicyValidationError(
        `Policy "${title}" is ${content.length} characters; the limit is ${MAX_POLICY_CHARS}. Split it into separate documents.`
      );
    }

    total += content.length + title.length;
    if (total > MAX_TOTAL_CHARS) {
      throw new PolicyValidationError(
        `Policies total more than ${MAX_TOTAL_CHARS} characters, which will not fit on the agency record.`
      );
    }

    let policyId = String(raw?.policyId || '').trim() || newPolicyId();
    // A duplicate id would make two documents fight over the same chunk keys,
    // leaving whichever indexed last as the only survivor.
    if (seenIds.has(policyId)) policyId = newPolicyId();
    seenIds.add(policyId);

    return {
      policyId,
      title,
      category: normaliseCategory(raw?.category),
      content,
      updatedAt: new Date().toISOString(),
    };
  });

  return policies;
}

/** Read an agency's policy documents. Never returns null. */
export async function getPolicies(tenantId) {
  if (!tenantId) throw new Error('tenantId is required');
  const config = await getAgencyConfig(tenantId);
  return Array.isArray(config?.policies) ? config.policies : [];
}

/**
 * Replace an agency's policy set and re-index it.
 *
 * Order matters: the agency record is written first. If indexing then fails,
 * the agency still sees the policy text they saved and a retry re-indexes it;
 * the reverse order can index passages that no longer exist on the record.
 *
 * @returns {Promise<{policies:Array, indexing:object|null, indexingError:string|null}>}
 */
export async function replacePolicies(tenantId, input) {
  if (!tenantId) throw new Error('tenantId is required');

  const policies = normalisePolicies(input);
  const previous = await getPolicies(tenantId);
  const previousIds = previous.map((p) => p.policyId).filter(Boolean);

  await updateAgencyConfig(tenantId, { policies });

  try {
    const indexing = await reindexTenantPolicies(tenantId, policies, previousIds);
    logger.info('policyStore.replaced', { tenantId, count: policies.length, ...indexing, results: undefined });
    return { policies, indexing, indexingError: null };
  } catch (error) {
    // Surfaced to the caller rather than thrown: the save succeeded and the
    // agency must not be told it failed, but they do need to know the voice
    // agent cannot answer from these policies yet.
    logger.error('policyStore.indexFailed', { tenantId, error: error.message });
    return { policies, indexing: null, indexingError: error.message };
  }
}

/** Force a re-index without changing the documents. Used by the backfill script. */
export async function reindexPolicies(tenantId) {
  const policies = await getPolicies(tenantId);
  if (!policies.length) return { indexed: 0, unchanged: 0, deleted: 0, totalChunks: 0, results: [] };
  return reindexTenantPolicies(tenantId, policies, policies.map((p) => p.policyId));
}

export default {
  MAX_POLICY_CHARS,
  MAX_POLICIES,
  MAX_TOTAL_CHARS,
  POLICY_CATEGORIES,
  PolicyValidationError,
  normalisePolicies,
  getPolicies,
  replacePolicies,
  reindexPolicies,
};
