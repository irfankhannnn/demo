/**
 * TenantNormalizer — Enrich and normalize tenant (customer) data for any consumer.
 *
 * Responsibilities:
 * - Remove internal DynamoDB fields (PK, SK, GSI*, EntityType, tenantId)
 * - Remove S3 document keys (aadharDocS3Key, photoS3Key, policeVerificationS3Key, etc.)
 * - Normalize timestamps to ISO format
 * - Normalize enum values (status, source)
 * - Compute derived fields (lastActivityAt, hasNotes, rentalHistoryCount, hasCurrentRental, kycStatus)
 * - Normalize phone to last 10 digits
 */

const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
];

const S3_KEY_FIELDS = [
  'aadharDocS3Key', 'photoS3Key', 'policeVerificationS3Key',
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

  // Remove S3 keys
  S3_KEY_FIELDS.forEach(field => {
    delete cleaned[field];
  });

  // Remove S3 keys from currentRental
  if (cleaned.currentRental && typeof cleaned.currentRental === 'object') {
    const rental = { ...cleaned.currentRental };
    delete rental.leaseAgreementS3Key;
    delete rental.depositReceiptS3Key;
    delete rental.policeVerificationS3Key;
    cleaned.currentRental = rental;
  }

  // Remove S3 keys from rentalHistory
  if (Array.isArray(cleaned.rentalHistory)) {
    cleaned.rentalHistory = cleaned.rentalHistory.map(rental => {
      const r = { ...rental };
      delete r.leaseAgreementS3Key;
      delete r.depositReceiptS3Key;
      delete r.policeVerificationS3Key;
      return r;
    });
  }

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
 * Normalize tenant status enum
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
 * Derive KYC status from tenant data
 * @param {Object} tenant
 * @returns {Object} KYC status object
 */
function deriveKycStatus(tenant) {
  return {
    hasAadhar: Boolean(tenant.aadharNumber),
    hasAadharDoc: Boolean(tenant.aadharDocUrl),
    hasPhoto: Boolean(tenant.photoUrl),
    hasPoliceVerification: Boolean(tenant.policeVerificationUrl),
    complete: Boolean(tenant.aadharNumber) && Boolean(tenant.aadharDocUrl) && Boolean(tenant.photoUrl),
  };
}

/**
 * Compute derived fields for a tenant
 * @param {Object} tenant
 * @returns {Object} Derived fields
 */
function derivedFields(tenant) {
  const hasNotes = Array.isArray(tenant.notes) && tenant.notes.length > 0;
  const lastActivityAt = tenant.lastInteractionAt || tenant.updatedAt || tenant.createdAt;
  const hasCurrentRental = Boolean(tenant.currentRental);
  const rentalHistoryCount = Array.isArray(tenant.rentalHistory) ? tenant.rentalHistory.length : 0;

  return {
    hasNotes,
    lastActivityAt: normalizeTimestamp(lastActivityAt),
    hasCurrentRental,
    rentalHistoryCount,
    kycStatus: deriveKycStatus(tenant),
  };
}

/**
 * Normalize a single tenant
 * @param {Object} tenant Raw tenant from DynamoDB
 * @returns {Object} Normalized tenant
 */
export function normalizeTenant(tenant) {
  if (!tenant || typeof tenant !== 'object') return tenant;

  const cleaned = removeInternalFields(tenant);

  return {
    ...cleaned,
    customerId: cleaned.customerId || cleaned.id,
    name: cleaned.name || null,
    phone: normalizePhone(cleaned.phone),
    email: cleaned.email || null,
    address: cleaned.address || null,
    status: normalizeStatus(cleaned.status),
    source: cleaned.source || null,
    createdAt: normalizeTimestamp(cleaned.createdAt),
    updatedAt: normalizeTimestamp(cleaned.updatedAt),
    lastInteractionAt: normalizeTimestamp(cleaned.lastInteractionAt),
    notes: Array.isArray(cleaned.notes) ? cleaned.notes : (cleaned.notes ? [cleaned.notes] : []),
    tags: Array.isArray(cleaned.tags) ? cleaned.tags : [],
    aadharNumber: cleaned.aadharNumber || null,
    aadharDocUrl: cleaned.aadharDocUrl || null,
    photoUrl: cleaned.photoUrl || null,
    policeVerificationUrl: cleaned.policeVerificationUrl || null,
    currentRental: cleaned.currentRental || null,
    rentalHistory: Array.isArray(cleaned.rentalHistory) ? cleaned.rentalHistory : [],
    ...derivedFields(cleaned),
  };
}

/**
 * Normalize an array of tenants
 * @param {Array} tenants
 * @returns {Array} Normalized tenants
 */
export function normalizeTenants(tenants) {
  if (!Array.isArray(tenants)) return [];
  return tenants.map(normalizeTenant);
}

export default {
  normalizeTenant,
  normalizeTenants,
};
