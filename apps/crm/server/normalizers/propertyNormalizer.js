/**
 * PropertyNormalizer — strip internal fields and normalize property records.
 */

const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId',
];

function removeInternalFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = { ...obj };
  INTERNAL_FIELDS.forEach(field => { delete cleaned[field]; });
  return cleaned;
}

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

export function normalizeProperty(property) {
  if (!property) return null;
  const cleaned = removeInternalFields(property);
  return {
    ...cleaned,
    status: cleaned.status ? String(cleaned.status).toLowerCase() : null,
    listingStatus: cleaned.listingStatus ? String(cleaned.listingStatus).toLowerCase() : null,
    propertyType: cleaned.propertyType ? String(cleaned.propertyType).toLowerCase() : null,
    createdAt: normalizeTimestamp(cleaned.createdAt),
    updatedAt: normalizeTimestamp(cleaned.updatedAt),
    availableFrom: normalizeTimestamp(cleaned.availableFrom),
    lastActivityAt: normalizeTimestamp(cleaned.lastActivityAt || cleaned.updatedAt || cleaned.createdAt),
  };
}

export function normalizeProperties(properties) {
  if (!Array.isArray(properties)) return [];
  return properties.map(normalizeProperty).filter(Boolean);
}

export default { normalizeProperty, normalizeProperties };
