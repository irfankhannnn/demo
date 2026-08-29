/**
 * ContactNormalizer — strip internal fields and normalize contact records.
 */

const INTERNAL_FIELDS = [
  'PK', 'SK',
  'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'EntityType', 'tenantId', 'normalizedPhone',
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

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10) || null;
}

export function normalizeContact(contact) {
  if (!contact) return null;
  const cleaned = removeInternalFields(contact);
  return {
    ...cleaned,
    phone: normalizePhone(cleaned.phone),
    status: cleaned.status ? String(cleaned.status).toLowerCase() : 'active',
    role: cleaned.role ? String(cleaned.role).toLowerCase() : null,
    createdAt: normalizeTimestamp(cleaned.createdAt),
    updatedAt: normalizeTimestamp(cleaned.updatedAt),
    lastActivityAt: normalizeTimestamp(cleaned.lastActivityAt || cleaned.updatedAt || cleaned.createdAt),
    hasNotes: Array.isArray(cleaned.notes) && cleaned.notes.length > 0,
  };
}

export function normalizeContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.map(normalizeContact).filter(Boolean);
}

export default { normalizeContact, normalizeContacts };
