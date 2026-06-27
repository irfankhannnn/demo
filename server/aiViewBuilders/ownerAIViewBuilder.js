/**
 * OwnerAIViewBuilder — Transform normalized owners into AI-friendly DTOs.
 *
 * Covers all owner management operations: CRUD, notes, properties, meetings, metrics.
 * Does not contain business logic or generate English text.
 * Only decides which fields to expose for each AI interaction.
 */

import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveOwnerStatus(owner) {
  return {
    status: owner.status || 'active',
    isActive: owner.status === 'active',
    hasProperties: (owner.propertyCount || 0) > 0,
  };
}

function buildOwnerSummary(owner) {
  return {
    ownerId: owner.ownerId,
    name: owner.name,
    phone: owner.phone,
    status: owner.status,
    propertyCount: owner.propertyCount || 0,
    hasNotes: owner.hasNotes || false,
  };
}

function buildOwnerProperties(properties) {
  if (!Array.isArray(properties)) return [];

  return properties.map(property => ({
    propertyId: property.propertyId || property.id || null,
    title: property.title || null,
    area: property.area || null,
    city: property.city || null,
    propertyType: property.propertyType || null,
    status: property.status || null,
    rentExpected: formatMoney(property.rentExpected || property.rentAmount || property.monthlyRent),
    salePrice: formatMoney(property.salePrice || property.expectedPrice || property.listedPrice),
  }));
}

// ─── View Builders ───────────────────────────────────────────────────────────

/**
 * Build searchResults view for owner lists
 */
export function buildSearchResults(owners, pagination = {}, options = {}) {
  const { total = owners.length, shown = owners.length, hasMore = false } = pagination;

  return buildEnvelope(
    owners.map(buildOwnerSummary),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build details view for single owner
 */
export function buildOwnerDetails(owner, options = {}) {
  const { includeNotes = true, maxNotes = 5, includeProperties = true } = options;
  const notes = Array.isArray(owner.notes) ? owner.notes.slice(0, maxNotes) : [];

  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      status: owner.status,
      source: owner.source || null,
      createdAt: formatDate(owner.createdAt),
      lastActivityAt: formatDate(owner.lastActivityAt),
      propertyCount: owner.propertyCount || 0,
      tags: owner.tags || [],
      notes: includeNotes ? notes : undefined,
      properties: includeProperties ? buildOwnerProperties(owner.properties || []) : undefined,
    },
    {
      notes: includeNotes ? {
        total: (owner.notes || []).length,
        shown: notes.length,
        hasMore: (owner.notes || []).length > maxNotes,
      } : null,
      properties: includeProperties ? {
        total: (owner.properties || []).length,
      } : null,
    }
  );
}

/**
 * Build createConfirmation view
 */
export function buildCreateConfirmation(owner) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      status: owner.status || 'active',
    },
    { action: 'created' }
  );
}

/**
 * Build updateConfirmation view
 */
export function buildUpdateConfirmation(owner, updatedFields = {}) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      status: owner.status,
    },
    {
      action: 'updated',
      updatedFields: Object.keys(updatedFields),
    }
  );
}

/**
 * Build deactivateConfirmation view
 */
export function buildDeactivateConfirmation(owner) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      status: 'inactive',
    },
    { action: 'deactivated' }
  );
}

/**
 * Build deleteConfirmation view
 */
export function buildDeleteConfirmation(owner) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      status: 'deleted',
    },
    { action: 'deleted' }
  );
}

/**
 * Build full view with all details
 */
export function buildFullOwner(owner) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      status: owner.status,
      source: owner.source || null,
      createdAt: formatDate(owner.createdAt),
      updatedAt: formatDate(owner.updatedAt),
      lastActivityAt: formatDate(owner.lastActivityAt),
      propertyCount: owner.propertyCount || 0,
      tags: owner.tags || [],
      notes: owner.notes || [],
      properties: buildOwnerProperties(owner.properties || []),
      ...deriveOwnerStatus(owner),
    },
    { view: 'full' }
  );
}

/**
 * Build ownerPropertiesList view
 */
export function buildOwnerPropertiesList(properties, pagination = {}) {
  const { total = properties.length, shown = properties.length, hasMore = false } = pagination;

  return buildEnvelope(
    buildOwnerProperties(properties),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build noteCreateConfirmation view
 */
export function buildNoteCreateConfirmation(owner, note) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      ownerName: owner.name,
      noteId: note.noteId,
      content: note.content,
      createdAt: formatDate(note.createdAt),
    },
    { action: 'note_added' }
  );
}

/**
 * Build notesList view
 */
export function buildNotesList(notes, pagination = {}) {
  const { total = notes.length, limit = 5 } = pagination;
  const shown = Math.min(limit, notes.length);

  return buildEnvelope(
    notes.slice(0, limit).map(note => ({
      noteId: note.noteId,
      content: note.content,
      createdBy: note.createdBy,
      createdAt: formatDate(note.createdAt),
    })),
    {
      total,
      shown,
      hasMore: total > limit,
    }
  );
}

/**
 * Build noteUpdateConfirmation view
 */
export function buildNoteUpdateConfirmation(owner, note) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      noteId: note.noteId,
      content: note.content,
      updatedAt: formatDate(note.updatedAt),
    },
    { action: 'note_updated' }
  );
}

/**
 * Build noteDeleteConfirmation view
 */
export function buildNoteDeleteConfirmation(owner, noteId) {
  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      noteId,
    },
    { action: 'note_deleted' }
  );
}

/**
 * Build phoneLookupResult view
 */
export function buildPhoneLookupResult(owner, phone) {
  if (!owner) {
    return buildEnvelope(
      { phone, found: false },
      {}
    );
  }

  return buildEnvelope(
    {
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      status: owner.status,
      found: true,
    },
    {}
  );
}

// ─── Error DTOs ──────────────────────────────────────────────────────────────

export function buildOwnerNotFoundError(ownerId) {
  return buildEnvelope(
    { ownerId },
    { error: 'owner_not_found', message: 'Owner not found' }
  );
}

export function buildAlreadyExistsByPhoneError(existingOwner) {
  return buildEnvelope(
    {
      ownerId: existingOwner.ownerId,
      name: existingOwner.name,
      phone: existingOwner.phone,
    },
    { error: 'already_exists_by_phone', message: 'An owner with this phone number already exists' }
  );
}

export function buildCannotDeleteOwnerError(owner) {
  return buildEnvelope(
    { ownerId: owner?.ownerId || null, name: owner?.name || null },
    { error: 'cannot_delete_owner', message: 'Owner cannot be deleted because they have active properties or listings' }
  );
}

export function buildProfileNotesProtectedError(owner, noteId) {
  return buildEnvelope(
    { ownerId: owner.ownerId, noteId },
    { error: 'profile_notes_protected', message: 'The system-generated profile note cannot be edited or deleted' }
  );
}

export function buildPhoneRequiredError(owner) {
  return buildEnvelope(
    { ownerId: owner?.ownerId || null, name: owner?.name || null },
    { error: 'phone_required', message: 'Phone number is required to create an owner' }
  );
}

export function buildNameRequiredError(owner) {
  return buildEnvelope(
    { ownerId: owner?.ownerId || null, phone: owner?.phone || null },
    { error: 'name_required', message: 'Name is required to create an owner' }
  );
}

export function buildDuplicatePhoneError(existingOwner) {
  return buildEnvelope(
    {
      ownerId: existingOwner.ownerId,
      name: existingOwner.name,
      phone: existingOwner.phone,
    },
    { error: 'duplicate_phone', message: 'An owner with this phone number already exists' }
  );
}

export function buildEmptySearchResults() {
  return buildEnvelope(
    [],
    { total: 0, hasMore: false }
  );
}

export default {
  buildSearchResults,
  buildOwnerDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeactivateConfirmation,
  buildDeleteConfirmation,
  buildFullOwner,
  buildOwnerPropertiesList,
  buildNoteCreateConfirmation,
  buildNotesList,
  buildNoteUpdateConfirmation,
  buildNoteDeleteConfirmation,
  buildPhoneLookupResult,
  buildOwnerNotFoundError,
  buildAlreadyExistsByPhoneError,
  buildCannotDeleteOwnerError,
  buildProfileNotesProtectedError,
  buildPhoneRequiredError,
  buildNameRequiredError,
  buildDuplicatePhoneError,
  buildEmptySearchResults,
};
