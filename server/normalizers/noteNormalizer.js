/**
 * NoteNormalizer — Clean and normalize note data from DynamoDB.
 *
 * Notes are stored as sub-items under leads, owners, and customers (tenants).
 * They share the same internal fields as other entities and must be cleaned
 * before being exposed to AI view builders.
 */

const INTERNAL_FIELDS = [
  'PK', 'SK', 'EntityType', 'tenantId', 'leadId', 'ownerId', 'customerId',
];

/**
 * Normalize a single note
 * @param {Object} note Raw note from DynamoDB
 * @returns {Object} Cleaned note
 */
export function normalizeNote(note) {
  if (!note || typeof note !== 'object') return note;

  const cleaned = { ...note };
  INTERNAL_FIELDS.forEach(field => {
    delete cleaned[field];
  });

  return {
    ...cleaned,
    noteId: cleaned.noteId || null,
    content: cleaned.content || null,
    createdBy: cleaned.createdBy || null,
    createdAt: cleaned.createdAt || null,
    updatedAt: cleaned.updatedAt || null,
  };
}

/**
 * Normalize an array of notes
 * @param {Array} notes
 * @returns {Array} Cleaned notes
 */
export function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map(normalizeNote);
}

export default {
  normalizeNote,
  normalizeNotes,
};
