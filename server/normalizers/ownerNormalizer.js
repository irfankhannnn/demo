/**
 * OwnerNormalizer — Enrich and normalize owner data for any consumer.
 *
 * Responsibilities:
 * - Remove internal DynamoDB fields (PK, SK, GSI*, EntityType, tenantId)
 * - Normalize timestamps to ISO format
 * - Normalize enum values (status, source)
 * - Compute derived fields (lastActivityAt, hasNotes, propertyCount)
 * - Normalize phone to last 10 digits
 */

const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
];

/**
 * Remove internal DynamoDB fields from an object
 * @param {Object} obj
 * @returns {Object} Cleaned object
 */
function removeInternalFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const cleaned = { ...obj };
  INTERNAL_FIELDS.forEach(field => {
    delete cleaned[field];
  });
  return cleaned;
}

/**
 * Normalize a timestamp to ISO format
 * @param {string|number|Date|null} value
 * @returns {string|null} ISO string or null
 */
function normalizeTimestamp(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalize phone to last 10 digits
 * @param {string|null} phone
 * @returns {string|null}
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10) || null;
}

/**
 * Normalize owner status enum
 * @param {string|null} status
 * @returns {string|null}
 */
function normalizeStatus(status) {
  if (!status) return null;
  const normalized = String(status).toLowerCase();
  const valid = ['active', 'inactive', 'past'];
  return valid.includes(normalized) ? normalized : status;
}

/**
 * Compute derived fields for an owner
 * @param {Object} owner
 * @returns {Object} Derived fields
 */
function derivedFields(owner) {
  const hasNotes = Array.isArray(owner.notes) && owner.notes.length > 0;
  const lastActivityAt = owner.lastInteractionAt || owner.updatedAt || owner.createdAt;
  const propertyCount = Array.isArray(owner.properties) ? owner.properties.length : 0;

  return {
    hasNotes,
    lastActivityAt: normalizeTimestamp(lastActivityAt),
    propertyCount,
  };
}

/**
 * Normalize a single owner
 * @param {Object} owner Raw owner from DynamoDB
 * @returns {Object} Normalized owner
 */
export function normalizeOwner(owner) {
  if (!owner || typeof owner !== 'object') return owner;

  const cleaned = removeInternalFields(owner);

  return {
    ...cleaned,
    ownerId: cleaned.ownerId || cleaned.id,
    name: cleaned.name || null,
    phone: normalizePhone(cleaned.phone),
    email: cleaned.email || null,
    status: normalizeStatus(cleaned.status),
    source: cleaned.source || null,
    createdAt: normalizeTimestamp(cleaned.createdAt),
    updatedAt: normalizeTimestamp(cleaned.updatedAt),
    lastInteractionAt: normalizeTimestamp(cleaned.lastInteractionAt),
    notes: Array.isArray(cleaned.notes) ? cleaned.notes : (cleaned.notes ? [cleaned.notes] : []),
    tags: Array.isArray(cleaned.tags) ? cleaned.tags : [],
    properties: Array.isArray(cleaned.properties) ? cleaned.properties : [],
    ...derivedFields(cleaned),
  };
}

/**
 * Normalize an array of owners
 * @param {Array} owners
 * @returns {Array} Normalized owners
 */
export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  return owners.map(normalizeOwner);
}

export default {
  normalizeOwner,
  normalizeOwners,
};
