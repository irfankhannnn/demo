/**
 * ContactAIViewBuilder — AI DTOs for contacts.
 */

import { formatDate, buildEnvelope, buildPaginationMetadata } from './utils.js';
import { buildContactRecommendation } from './recommendations.js';

function latestNote(contact) {
  const notes = Array.isArray(contact.notes) ? contact.notes : [];
  if (!notes.length) return null;
  const n = notes[0];
  return typeof n === 'string' ? n : (n.content || n.text || null);
}

export function buildSearchResults(contacts, pagination = {}) {
  const { total = contacts.length, shown = contacts.length, hasMore = false } = pagination;
  return buildEnvelope(
    contacts.map(c => ({
      contactId: c.contactId,
      name: c.name,
      phone: c.phone,
      email: c.email || null,
      role: c.role || null,
      status: c.status || 'active',
    })),
    buildPaginationMetadata(total, shown, hasMore),
  );
}

export function buildContactDetails(contact, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;
  const notes = Array.isArray(contact.notes) ? contact.notes.slice(0, maxNotes) : [];
  return buildEnvelope(
    {
      contactId: contact.contactId,
      name: contact.name,
      phone: contact.phone,
      email: contact.email || null,
      role: contact.role || null,
      status: contact.status || 'active',
      createdAt: formatDate(contact.createdAt),
      lastActivityAt: formatDate(contact.lastActivityAt),
      latestNote: latestNote(contact),
      notes: includeNotes ? notes : undefined,
    },
    {
      notes: includeNotes ? {
        total: (contact.notes || []).length,
        shown: notes.length,
        hasMore: (contact.notes || []).length > maxNotes,
      } : null,
      recommendation: buildContactRecommendation(contact),
    },
  );
}

export function buildCreateConfirmation(contact) {
  return buildEnvelope(
    {
      contactId: contact.contactId,
      name: contact.name,
      phone: contact.phone,
      role: contact.role || null,
      status: contact.status || 'active',
    },
    { action: 'created' },
  );
}

export function buildUpdateConfirmation(contact, updatedFields = {}) {
  return buildEnvelope(
    {
      contactId: contact.contactId,
      name: contact.name,
      role: contact.role || null,
      status: contact.status || 'active',
    },
    { action: 'updated', updatedFields: Object.keys(updatedFields) },
  );
}

export function buildDeleteConfirmation(contact) {
  return buildEnvelope(
    { contactId: contact.contactId, name: contact.name, status: 'deleted' },
    { action: 'deleted' },
  );
}

export function buildNoteCreateConfirmation(contact, note) {
  return buildEnvelope(
    {
      contactId: contact.contactId,
      contactName: contact.name,
      noteId: note.noteId,
      content: note.content,
      createdAt: formatDate(note.createdAt),
    },
    { action: 'note_added' },
  );
}

export function buildNotesList(notes, pagination = {}) {
  const { total = notes.length, limit = 5 } = pagination;
  return buildEnvelope(
    notes.slice(0, limit).map(n => ({
      noteId: n.noteId,
      content: n.content,
      createdBy: n.createdBy,
      createdAt: formatDate(n.createdAt),
    })),
    { total, shown: Math.min(limit, notes.length), hasMore: total > limit },
  );
}

export function buildEmptySearchResults() {
  return buildEnvelope([], { total: 0, hasMore: false });
}

export function buildContactNotFoundError(contactId) {
  return buildEnvelope(
    { contactId },
    { error: 'contact_not_found', message: 'Contact not found' },
  );
}

export default {
  buildSearchResults,
  buildContactDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeleteConfirmation,
  buildNoteCreateConfirmation,
  buildNotesList,
  buildEmptySearchResults,
  buildContactNotFoundError,
};
