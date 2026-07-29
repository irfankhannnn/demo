/**
 * TenantAIViewBuilder — Transform normalized tenants into AI-friendly DTOs.
 *
 * Covers all tenant management operations: CRUD, notes, rental history, current rental, archive, meetings, metrics.
 * Does not contain business logic or generate English text.
 * Only decides which fields to expose for each AI interaction.
 */

import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';
import { buildTenantRecommendation } from './recommendations.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveCurrentRentalSummary(tenant) {
  const rental = tenant.currentRental;
  if (!rental) return null;

  return {
    propertyId: rental.propertyId || null,
    leaseStartDate: formatDate(rental.leaseStartDate),
    leaseEndDate: formatDate(rental.leaseEndDate),
    monthlyRent: formatMoney(rental.monthlyRent),
    securityDeposit: formatMoney(rental.securityDeposit),
  };
}

function buildCurrentRental(rental) {
  if (!rental) return null;

  return {
    propertyId: rental.propertyId || null,
    leaseStartDate: formatDate(rental.leaseStartDate),
    leaseEndDate: formatDate(rental.leaseEndDate),
    monthlyRent: formatMoney(rental.monthlyRent),
    securityDeposit: formatMoney(rental.securityDeposit),
    leaseAgreementUrl: rental.leaseAgreementUrl || null,
    depositReceiptUrl: rental.depositReceiptUrl || null,
    policeVerificationUrl: rental.policeVerificationUrl || null,
    notes: rental.notes || null,
  };
}

function buildRentalHistoryItems(rentals) {
  if (!Array.isArray(rentals)) return [];
  return rentals.map(buildCurrentRental);
}

function deriveTenantStatus(tenant) {
  return {
    status: tenant.status || 'active',
    hasCurrentRental: tenant.hasCurrentRental || false,
    hasRentalHistory: tenant.rentalHistoryCount > 0,
    isActive: tenant.status === 'active',
  };
}

// ─── View Builders ───────────────────────────────────────────────────────────

/**
 * Build searchResults view for tenant lists
 */
export function buildSearchResults(tenants, pagination = {}, options = {}) {
  const { total = tenants.length, shown = tenants.length, hasMore = false } = pagination;

  return buildEnvelope(
    tenants.map(tenant => ({
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
      area: tenant.address ? tenant.address.split(',')[0] : null,
      hasCurrentRental: tenant.hasCurrentRental,
      currentRent: deriveCurrentRentalSummary(tenant)?.monthlyRent || null,
      leaseEndDate: deriveCurrentRentalSummary(tenant)?.leaseEndDate || null,
    })),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build details view for single tenant
 */
export function buildTenantDetails(tenant, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;
  const notes = Array.isArray(tenant.notes) ? tenant.notes.slice(0, maxNotes) : [];
  const latestNote = notes.length
    ? (typeof notes[0] === 'string' ? notes[0] : (notes[0].content || notes[0].text || null))
    : null;
  const currentRental = deriveCurrentRentalSummary(tenant);

  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
      status: tenant.status,
      source: tenant.source,
      budget: tenant.budget || null,
      preferredArea: tenant.preferredArea || null,
      createdAt: formatDate(tenant.createdAt),
      lastActivityAt: formatDate(tenant.lastActivityAt || tenant.updatedAt),
      tags: tenant.tags || [],
      kycStatus: tenant.kycStatus,
      currentRental,
      rentalHistoryCount: tenant.rentalHistoryCount || 0,
      latestNote,
      notes: includeNotes ? notes : undefined,
    },
    {
      notes: includeNotes ? {
        total: (tenant.notes || []).length,
        shown: notes.length,
        hasMore: (tenant.notes || []).length > maxNotes,
      } : null,
      rental: {
        hasCurrentRental: tenant.hasCurrentRental,
        historyCount: tenant.rentalHistoryCount || 0,
      },
      recommendation: buildTenantRecommendation({ ...tenant, currentRental }),
    }
  );
}

/**
 * Build createConfirmation view
 */
export function buildCreateConfirmation(tenant) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status || 'active',
    },
    { action: 'created' }
  );
}

/**
 * Build updateConfirmation view
 */
export function buildUpdateConfirmation(tenant, updatedFields = {}) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      status: tenant.status,
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
export function buildDeactivateConfirmation(tenant) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      status: 'inactive',
    },
    { action: 'deactivated' }
  );
}

/**
 * Build full view with all details
 */
export function buildFullTenant(tenant) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
      status: tenant.status,
      source: tenant.source,
      createdAt: formatDate(tenant.createdAt),
      updatedAt: formatDate(tenant.updatedAt),
      tags: tenant.tags || [],
      aadharNumber: tenant.aadharNumber || null,
      kycStatus: tenant.kycStatus,
      currentRental: buildCurrentRental(tenant.currentRental),
      rentalHistory: buildRentalHistoryItems(tenant.rentalHistory),
      notes: tenant.notes || [],
      ...deriveTenantStatus(tenant),
    },
    { view: 'full' }
  );
}

/**
 * Build rentalHistoryList view
 */
export function buildRentalHistoryList(rentals, pagination = {}) {
  const { total = rentals.length, shown = rentals.length, hasMore = false } = pagination;

  return buildEnvelope(
    buildRentalHistoryItems(rentals),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build rentalHistory view for a tenant
 */
export function buildRentalHistory(tenant) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      currentRental: buildCurrentRental(tenant.currentRental),
      rentalHistory: buildRentalHistoryItems(tenant.rentalHistory || []),
    },
    {
      current: tenant.hasCurrentRental,
      historyCount: tenant.rentalHistoryCount || 0,
    }
  );
}

/**
 * Build currentRentalUpdateConfirmation view
 */
export function buildCurrentRentalUpdateConfirmation(tenant, updatedFields = {}) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      currentRental: buildCurrentRental(tenant.currentRental),
    },
    {
      action: 'rental_updated',
      updatedFields: Object.keys(updatedFields),
    }
  );
}

/**
 * Build rentalArchiveConfirmation view
 */
export function buildRentalArchiveConfirmation(tenant, archivedRental) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      archivedRental: buildCurrentRental(archivedRental),
    },
    { action: 'rental_archived' }
  );
}

/**
 * Build noteCreateConfirmation view
 */
export function buildNoteCreateConfirmation(tenant, note) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      tenantName: tenant.name,
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
export function buildNoteUpdateConfirmation(tenant, note) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
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
export function buildNoteDeleteConfirmation(tenant, noteId) {
  return buildEnvelope(
    {
      customerId: tenant.customerId,
      noteId,
    },
    { action: 'note_deleted' }
  );
}

/**
 * Build phoneLookupResult view
 */
export function buildPhoneLookupResult(tenant, phone) {
  if (!tenant) {
    return buildEnvelope(
      { phone, found: false },
      {}
    );
  }

  return buildEnvelope(
    {
      customerId: tenant.customerId,
      name: tenant.name,
      phone: tenant.phone,
      status: tenant.status,
      found: true,
    },
    {}
  );
}

// ─── Error DTOs ──────────────────────────────────────────────────────────────

export function buildTenantNotFoundError(customerId) {
  return buildEnvelope(
    { customerId },
    { error: 'tenant_not_found', message: 'Tenant not found' }
  );
}

export function buildPhoneRequiredError(tenant) {
  return buildEnvelope(
    { customerId: tenant?.customerId || null, name: tenant?.name || null },
    { error: 'phone_required', message: 'Phone number is required to create a tenant' }
  );
}

export function buildNameRequiredError(tenant) {
  return buildEnvelope(
    { customerId: tenant?.customerId || null, phone: tenant?.phone || null },
    { error: 'name_required', message: 'Name is required to create a tenant' }
  );
}

export function buildDuplicatePhoneError(existingTenant) {
  return buildEnvelope(
    {
      customerId: existingTenant.customerId,
      name: existingTenant.name,
      phone: existingTenant.phone,
    },
    { error: 'duplicate_phone', message: 'A tenant with this phone number already exists' }
  );
}

export function buildEmptySearchResults() {
  return buildEnvelope(
    [],
    { total: 0, hasMore: false }
  );
}

export function buildProfileNotesProtectedError(tenant, noteId) {
  return buildEnvelope(
    { customerId: tenant.customerId, noteId },
    { error: 'profile_notes_protected', message: 'The system-generated profile note cannot be edited or deleted' }
  );
}

export function buildRentalRequiredError(customerId) {
  return buildEnvelope(
    { customerId },
    { error: 'rental_required', message: 'Tenant does not have an active rental to archive' }
  );
}

export default {
  buildSearchResults,
  buildTenantDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeactivateConfirmation,
  buildFullTenant,
  buildRentalHistory,
  buildRentalHistoryList,
  buildCurrentRentalUpdateConfirmation,
  buildRentalArchiveConfirmation,
  buildNoteCreateConfirmation,
  buildNotesList,
  buildNoteUpdateConfirmation,
  buildNoteDeleteConfirmation,
  buildPhoneLookupResult,
  buildTenantNotFoundError,
  buildPhoneRequiredError,
  buildNameRequiredError,
  buildDuplicatePhoneError,
  buildEmptySearchResults,
  buildProfileNotesProtectedError,
  buildRentalRequiredError,
};
