/**
 * Normalize owner/seller property blobs on lead create/update.
 * Coerces numeric fields and trims strings; preserves all applicable keys.
 */

const VALID_PROPERTY_TYPES = new Set(['apartment', 'house', 'villa', 'office', 'land']);

const STRING_FIELDS = [
  'propertyType',
  'propertySubType',
  'area',
  'city',
  'bhk',
  'buildingName',
  'flatNumber',
  'floor',
  'furnishing',
  'address',
  'timeline',
  'notes',
  'title',
  'description',
];

const NUMBER_FIELDS = [
  'carpetArea',
  'rentExpected',
  'securityDeposit',
  'expectedPrice',
  'timelineValue',
];

function trimString(value) {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizePropertyType(value) {
  const trimmed = trimString(value);
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return VALID_PROPERTY_TYPES.has(lower) ? lower : trimmed;
}

/**
 * @param {object|null|undefined} blob
 * @returns {object|null}
 */
export function normalizeLeadPropertyBlob(blob) {
  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) {
    return blob ?? null;
  }

  const normalized = {};

  for (const key of STRING_FIELDS) {
    if (blob[key] !== undefined && blob[key] !== null) {
      const val = trimString(blob[key]);
      if (val !== undefined) {
        normalized[key] = key === 'propertyType' ? normalizePropertyType(val) : val;
      }
    }
  }

  for (const key of NUMBER_FIELDS) {
    if (blob[key] !== undefined && blob[key] !== null && blob[key] !== '') {
      const val = coerceNumber(blob[key]);
      if (val !== undefined) {
        normalized[key] = val;
      }
    }
  }

  if (blob.timelineUnit !== undefined && blob.timelineUnit !== null) {
    const unit = trimString(blob.timelineUnit);
    if (unit === 'days' || unit === 'months') {
      normalized.timelineUnit = unit;
    }
  }

  // Preserve any additional keys the client may send (forward compatibility)
  for (const [key, value] of Object.entries(blob)) {
    if (normalized[key] !== undefined) continue;
    if (value === null || value === undefined || value === '') continue;
    normalized[key] = value;
  }

  return Object.keys(normalized).length ? normalized : null;
}

export function normalizeOwnerProperty(ownerProperty) {
  return normalizeLeadPropertyBlob(ownerProperty);
}

export function normalizeSellerProperty(sellerProperty) {
  return normalizeLeadPropertyBlob(sellerProperty);
}

export default {
  normalizeLeadPropertyBlob,
  normalizeOwnerProperty,
  normalizeSellerProperty,
};
