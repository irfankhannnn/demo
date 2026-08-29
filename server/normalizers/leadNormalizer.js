/**
 * LeadNormalizer — Enrich and normalize lead data for any consumer.
 *
 * Responsibilities:
 * - Remove internal DynamoDB fields (PK, SK, GSI*, EntityType, tenantId)
 * - Normalize timestamps to ISO format
 * - Normalize enum values (status, leadType, source)
 * - Compute derived fields (lastActivityAt, hasNotes, leadScore)
 * - Normalize phone to last 10 digits
 *
 * This is NOT a formatting layer. It does not produce English strings like "₹25,000".
 * It only enriches and normalizes data for downstream consumers.
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
 * Normalize lead status enum
 * @param {string|null} status
 * @returns {string|null}
 */
function normalizeStatus(status) {
  if (!status) return null;
  const normalized = String(status).toLowerCase();
  const valid = ['new', 'contacted', 'qualified', 'negotiating', 'converted', 'lost', 'inactive'];
  return valid.includes(normalized) ? normalized : status;
}

/**
 * Normalize lead type enum
 * @param {string|null} leadType
 * @returns {string|null}
 */
function normalizeLeadType(leadType) {
  if (!leadType) return null;
  const normalized = String(leadType).toLowerCase();
  const valid = ['buyer', 'seller', 'investor', 'tenant', 'owner', 'other'];
  return valid.includes(normalized) ? normalized : leadType;
}

/**
 * Compute derived fields for a lead
 * @param {Object} lead
 * @returns {Object} Derived fields
 */
function derivedFields(lead) {
  const hasNotes = Array.isArray(lead.notes) && lead.notes.length > 0;
  const lastActivityAt = lead.lastInteractionAt || lead.updatedAt || lead.createdAt;

  return {
    hasNotes,
    lastActivityAt: normalizeTimestamp(lastActivityAt),
    leadScore: lead.score || 0,
  };
}

/**
 * Normalize a single lead
 * @param {Object} lead Raw lead from DynamoDB
 * @returns {Object} Normalized lead
 */
export function normalizeLead(lead) {
  if (!lead || typeof lead !== 'object') return lead;

  const cleaned = removeInternalFields(lead);

  return {
    ...cleaned,
    leadId: cleaned.leadId || cleaned.id,
    name: cleaned.name || null,
    phone: normalizePhone(cleaned.phone),
    email: cleaned.email || null,
    status: normalizeStatus(cleaned.status),
    leadType: normalizeLeadType(cleaned.leadType),
    source: cleaned.source || null,
    score: cleaned.score || null, // HOT|WARM|COLD|null — see scoreValue for the 0-100 number
    scoreValue: typeof cleaned.scoreValue === 'number' ? cleaned.scoreValue : null,
    createdAt: normalizeTimestamp(cleaned.createdAt),
    updatedAt: normalizeTimestamp(cleaned.updatedAt),
    lastInteractionAt: normalizeTimestamp(cleaned.lastInteractionAt),
    notes: Array.isArray(cleaned.notes) ? cleaned.notes : (cleaned.notes ? [cleaned.notes] : []),
    tags: Array.isArray(cleaned.tags) ? cleaned.tags : [],
    ...derivedFields(cleaned),
  };
}

/**
 * Normalize an array of leads
 * @param {Array} leads
 * @returns {Array} Normalized leads
 */
export function normalizeLeads(leads) {
  if (!Array.isArray(leads)) return [];
  return leads.map(normalizeLead);
}

export default {
  normalizeLead,
  normalizeLeads,
};
