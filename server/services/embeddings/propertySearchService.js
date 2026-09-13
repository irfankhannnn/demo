/**
 * Property semantic matching — the domain layer every channel calls.
 *
 * Channels wired to this: AI voice calling (via the internal API), the webpage
 * SSE agent chat, WhatsApp/Baileys, and MCP — all through the single
 * `match_properties` tool in server/shared/toolDefinitions.js.
 *
 * Hybrid by design. Pure vector search is worse than the status quo for the
 * queries this product actually gets: "3BHK under 80 lakhs in Whitefield" is
 * two hard constraints (bedrooms, budget) plus one soft one (the area, and
 * whatever "near the metro, needs parking" implies). Hard constraints belong in
 * filters where they are exact; only the soft remainder benefits from meaning.
 */

import { logger } from '../../logger.js';
import { semanticSearch, DEFAULT_SCORE_THRESHOLD } from './vectorSearchService.js';
import { buildEmbeddingAttributesSafe } from './embeddingService.js';

/** Must match the index declared in server/infra/cfn-backend.yaml. */
export const PROPERTY_VECTOR_INDEX = 'property-vector-index';
export const PROPERTY_VECTOR_ATTRIBUTE = 'descriptionVector';

/**
 * Ordered fields that make up a property's embedding.
 *
 * Deliberately excluded: owner name, owner phone, flat number, exact address.
 * Two reasons. They are identity, not meaning — §7 of the design doc reserves
 * exact indexes for identity and vectors for free text. And they would let a
 * semantic query surface a property by matching its owner's name, which is both
 * surprising and a small privacy leak into a channel the owner never consented to.
 */
export function propertyEmbeddingFields(property = {}) {
  const rentalInfo = property.rentalInfo || {};
  const saleInfo = property.saleInfo || {};

  return [
    ['Title', property.title],
    ['Description', property.description],
    ['Property type', property.propertyType],
    ['Bedrooms', property.bhk ? `${property.bhk} BHK` : null],
    ['Area', property.area],
    ['City', property.city],
    ['Building', property.buildingName],
    ['Furnishing', property.furnishing],
    ['Facing', property.facing],
    ['Carpet area', property.carpetArea ? `${property.carpetArea} sq ft` : null],
    ['Amenities', property.amenities],
    ['Status', property.status],
    ['Expected rent', rentalInfo.expectedRent || property.rentAmount],
    ['Expected price', saleInfo.listedPrice || property.price],
  ];
}

/**
 * Build the vector attributes for a property write.
 * Returns null when nothing meaningful changed, so callers skip the extra write.
 */
export async function buildPropertyEmbedding(property, existingHash = null) {
  return buildEmbeddingAttributesSafe(
    propertyEmbeddingFields(property),
    PROPERTY_VECTOR_ATTRIBUTE,
    existingHash,
    { propertyId: property?.propertyId, tenantId: property?.tenantId }
  );
}

/**
 * Range predicates, applied after the vector search because inline filters
 * support equality only (design doc §5, option A).
 */
function buildPostFilter({ minPrice, maxPrice, minBedrooms, maxBedrooms, status }) {
  const hasAny =
    minPrice != null || maxPrice != null || minBedrooms != null || maxBedrooms != null || status;
  if (!hasAny) return null;

  const allowedStatuses = status
    ? new Set((Array.isArray(status) ? status : [status]).map((s) => String(s).toLowerCase()))
    : null;

  return (item) => {
    const price =
      item.rentAmount ?? item.price ?? item.rentalInfo?.expectedRent ?? item.saleInfo?.listedPrice ?? null;

    if (minPrice != null && (price == null || price < minPrice)) return false;
    if (maxPrice != null && (price == null || price > maxPrice)) return false;

    const bhk = item.bhk != null ? Number(item.bhk) : null;
    if (minBedrooms != null && (bhk == null || bhk < minBedrooms)) return false;
    if (maxBedrooms != null && (bhk == null || bhk > maxBedrooms)) return false;

    if (allowedStatuses && !allowedStatuses.has(String(item.status || '').toLowerCase())) return false;

    return true;
  };
}

/**
 * Find properties matching a natural-language description plus hard constraints.
 *
 * @param {string} tenantId                REQUIRED
 * @param {object} options
 * @param {string} options.query           free text, e.g. "quiet 3BHK near the metro with parking"
 * @param {string} [options.propertyType]  exact match, pushed into the index as an inline filter
 * @param {number} [options.minPrice]      post-filtered range
 * @param {number} [options.maxPrice]
 * @param {number} [options.minBedrooms]
 * @param {number} [options.maxBedrooms]
 * @param {string|string[]} [options.status]  post-filtered; one status or a list of allowed statuses
 * @param {number} [options.limit]
 * @returns {Promise<Array<object>>} properties, best match first, each with _score
 */
export async function matchProperties(tenantId, options = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const {
    query,
    propertyType,
    minPrice,
    maxPrice,
    minBedrooms,
    maxBedrooms,
    status,
    limit = 5,
    scoreThreshold = DEFAULT_SCORE_THRESHOLD,
  } = options;

  const text = (query || '').trim();
  if (text.length < 2) return [];

  // Same contract as the write path's buildEmbeddingAttributesSafe: a Bedrock
  // or index problem must not become an exception in a live conversation. The
  // caller falls back to the plain filtered property lookup, which is a worse
  // answer but still an answer.
  let matches;
  try {
    matches = await semanticSearch({
      tenantId,
      query: text,
      indexName: PROPERTY_VECTOR_INDEX,
      topK: limit,
      // EntityType is essential: the CRM table is single-table, so without it
      // one index would mix leads, contacts and properties into one vector space.
      equalityFilters: { EntityType: 'PROPERTY', ...(propertyType ? { propertyType } : {}) },
      postFilter: buildPostFilter({ minPrice, maxPrice, minBedrooms, maxBedrooms, status }),
      scoreThreshold,
    });
  } catch (error) {
    logger.error('propertySearch.semantic.failed', {
      tenantId,
      error: error.message,
      errorName: error.name,
    });
    return [];
  }

  logger.info('propertySearch.semantic', {
    tenantId,
    queryLength: text.length,
    matched: matches.length,
    hasRangeFilters: minPrice != null || maxPrice != null,
  });

  return matches.map(({ item, score }) => ({ ...item, _score: score }));
}

export default {
  PROPERTY_VECTOR_INDEX,
  PROPERTY_VECTOR_ATTRIBUTE,
  propertyEmbeddingFields,
  buildPropertyEmbedding,
  matchProperties,
};
