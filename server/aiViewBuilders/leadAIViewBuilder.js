/**
 * LeadAIViewBuilder — Transform normalized leads into AI-friendly DTOs.
 *
 * Covers all lead management operations: CRUD, notes, conversion, meetings, metrics.
 * Does not contain business logic or generate English text.
 * Only decides which fields to expose for each AI interaction.
 */

import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveLeadStatus(lead) {
  return {
    status: lead.status || 'new',
    isQualified: ['qualified', 'negotiating'].includes(lead.status),
    isConverted: lead.status === 'converted',
    isLost: lead.status === 'lost',
  };
}

function buildRequirement(lead) {
  const req = lead.buyerRequirement || lead.sellerProperty || lead.tenantRequirement || lead.ownerProperty || {};

  const common = {
    propertyType: req.propertyType || null,
    bhk: req.bhk || null,
    furnishing: req.furnishing || null,
  };

  if (!lead.leadType) {
    return {
      ...common,
      budget: null,
      preferredArea: null,
      requirement: null,
    };
  }

  if (lead.leadType === 'buyer' || lead.leadType === 'tenant') {
    return {
      ...common,
      budget: formatMoney(req.budget),
      preferredArea: req.preferredArea || null,
      requirement: req.requirement || null,
    };
  }

  if (lead.leadType === 'seller') {
    return {
      ...common,
      expectedPrice: formatMoney(req.expectedPrice),
      area: req.area || null,
      city: req.city || null,
      buildingName: req.buildingName || null,
      flatNumber: req.flatNumber || null,
      floor: req.floor || null,
      carpetArea: req.carpetArea || null,
      address: req.address || null,
    };
  }

  if (lead.leadType === 'owner') {
    return {
      ...common,
      rentExpected: formatMoney(req.rentExpected),
      securityDeposit: formatMoney(req.securityDeposit),
      area: req.area || null,
      city: req.city || null,
      buildingName: req.buildingName || null,
      flatNumber: req.flatNumber || null,
      floor: req.floor || null,
      carpetArea: req.carpetArea || null,
      address: req.address || null,
    };
  }

  return {
    ...common,
    budget: null,
    preferredArea: null,
    requirement: null,
  };
}

function buildLeadSummary(lead) {
  const requirement = buildRequirement(lead);

  return {
    leadId: lead.leadId,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    leadType: lead.leadType,
    priority: lead.priority || 'medium',
    score: lead.score || 0,
    assignedTo: lead.assignedTo || null,
    area: requirement?.area || requirement?.preferredArea || null,
    budget: requirement?.budget || requirement?.expectedPrice || requirement?.rentExpected || null,
    propertyType: requirement?.propertyType || null,
    bhk: requirement?.bhk || null,
    hasNotes: lead.hasNotes || false,
  };
}

// ─── View Builders ───────────────────────────────────────────────────────────

/**
 * Build searchResults view for lead lists
 */
export function buildSearchResults(leads, pagination = {}, options = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => {
      const requirement = buildRequirement(lead);
      return {
        leadId: lead.leadId,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        leadType: lead.leadType,
        priority: lead.priority || 'medium',
        score: lead.score || 0,
        source: lead.source,
        assignedTo: lead.assignedTo || null,
        area: requirement?.area || requirement?.preferredArea || null,
        budget: requirement?.budget || requirement?.expectedPrice || requirement?.rentExpected || null,
        propertyType: requirement?.propertyType || null,
        bhk: requirement?.bhk || null,
        lastActivityAt: formatDate(lead.lastActivityAt),
      };
    }),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build details view for single lead
 */
export function buildLeadDetails(lead, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;
  const notes = Array.isArray(lead.notes) ? lead.notes.slice(0, maxNotes) : [];

  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      leadType: lead.leadType,
      priority: lead.priority || 'medium',
      score: lead.score || 0,
      source: lead.source,
      assignedTo: lead.assignedTo || null,
      createdAt: formatDate(lead.createdAt),
      lastActivityAt: formatDate(lead.lastActivityAt),
      requirement: buildRequirement(lead),
      tags: lead.tags || [],
      notes: includeNotes ? notes : undefined,
      history: lead.history || [],
    },
    {
      notes: includeNotes ? {
        total: (lead.notes || []).length,
        shown: notes.length,
        hasMore: (lead.notes || []).length > maxNotes,
      } : null,
    }
  );
}

/**
 * Build createConfirmation view
 */
export function buildCreateConfirmation(lead) {
  const requirement = buildRequirement(lead);

  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      leadType: lead.leadType,
      status: lead.status || 'new',
      area: requirement?.area || requirement?.preferredArea || null,
      budget: requirement?.budget || requirement?.expectedPrice || requirement?.rentExpected || null,
    },
    { action: 'created' }
  );
}

/**
 * Build updateConfirmation view
 */
export function buildUpdateConfirmation(lead, updatedFields = {}) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      status: lead.status,
      leadType: lead.leadType,
    },
    {
      action: 'updated',
      updatedFields: Object.keys(updatedFields),
    }
  );
}

/**
 * Build deleteConfirmation view
 */
export function buildDeleteConfirmation(lead) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      status: 'deleted',
    },
    { action: 'deleted' }
  );
}

/**
 * Build full view with all details
 */
export function buildFullLead(lead) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      leadType: lead.leadType,
      priority: lead.priority || 'medium',
      score: lead.score || 0,
      source: lead.source,
      assignedTo: lead.assignedTo || null,
      createdAt: formatDate(lead.createdAt),
      updatedAt: formatDate(lead.updatedAt),
      lastActivityAt: formatDate(lead.lastActivityAt),
      requirement: buildRequirement(lead),
      tags: lead.tags || [],
      notes: lead.notes || [],
      history: lead.history || [],
      ...deriveLeadStatus(lead),
    },
    { view: 'full' }
  );
}

/**
 * Build convertConfirmation view
 */
export function buildConvertConfirmation(lead, convertedTo) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      convertedTo,
      status: 'converted',
    },
    { action: 'converted' }
  );
}

/**
 * Build noteCreateConfirmation view
 */
export function buildNoteCreateConfirmation(lead, note) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      leadName: lead.name,
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
export function buildNoteUpdateConfirmation(lead, note) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
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
export function buildNoteDeleteConfirmation(lead, noteId) {
  return buildEnvelope(
    {
      leadId: lead.leadId,
      noteId,
    },
    { action: 'note_deleted' }
  );
}

// ─── Rich Query Builders ─────────────────────────────────────────────────────

/**
 * Build metrics summary view
 */
export function buildMetricsSummary(metrics) {
  return buildEnvelope(
    {
      total: metrics.total || 0,
      active: metrics.active || 0,
      converted: metrics.converted || 0,
      lost: metrics.lost || 0,
      byType: metrics.byType || {},
      byStatus: metrics.byStatus || {},
    },
    { view: 'metrics' }
  );
}

/**
 * Build budget ranking view
 */
export function buildBudgetRanking(leads, pagination = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => {
      const requirement = buildRequirement(lead);
      return {
        leadId: lead.leadId,
        name: lead.name,
        phone: lead.phone,
        leadType: lead.leadType,
        budget: requirement?.budget || requirement?.expectedPrice || requirement?.rentExpected || null,
        area: requirement?.area || requirement?.preferredArea || null,
        score: lead.score || 0,
      };
    }),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build stale leads view
 */
export function buildStaleLeads(leads, pagination = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => ({
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      leadType: lead.leadType,
      lastActivityAt: formatDate(lead.lastActivityAt),
      daysStale: lead.daysStale || 0,
    })),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build priority ranking view
 */
export function buildPriorityRanking(leads, pagination = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => ({
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      priority: lead.priority || 'medium',
      score: lead.score || 0,
      status: lead.status,
    })),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build follow-up queue view
 */
export function buildFollowUpQueue(leads, pagination = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => ({
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      nextFollowUpDate: formatDate(lead.nextFollowUpDate),
      lastActivityAt: formatDate(lead.lastActivityAt),
    })),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

/**
 * Build conversion candidates view
 */
export function buildConversionCandidates(leads, pagination = {}) {
  const { total = leads.length, shown = leads.length, hasMore = false } = pagination;

  return buildEnvelope(
    leads.map(lead => ({
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      leadType: lead.leadType,
      score: lead.score || 0,
      status: lead.status,
      conversionScore: lead.conversionScore || 0,
    })),
    buildPaginationMetadata(total, shown, hasMore)
  );
}

// ─── Error DTOs ──────────────────────────────────────────────────────────────

export function buildLeadNotFoundError(leadId) {
  return buildEnvelope(
    { leadId },
    { error: 'lead_not_found', message: 'Lead not found' }
  );
}

export function buildAlreadyConvertedError(lead) {
  return buildEnvelope(
    { leadId: lead?.leadId || null, name: lead?.name || null },
    { error: 'already_converted', message: 'Lead has already been converted' }
  );
}

export function buildCannotDeleteConvertedError(lead) {
  return buildEnvelope(
    { leadId: lead?.leadId || null, name: lead?.name || null },
    { error: 'cannot_delete_converted', message: 'Cannot delete a converted lead' }
  );
}

export function buildPhoneRequiredError(lead) {
  return buildEnvelope(
    { leadId: lead?.leadId || null, name: lead?.name || null },
    { error: 'phone_required', message: 'Phone number is required to create a lead' }
  );
}

export function buildNameRequiredError(lead) {
  return buildEnvelope(
    { leadId: lead?.leadId || null, phone: lead?.phone || null },
    { error: 'name_required', message: 'Name is required to create a lead' }
  );
}

export function buildDuplicatePhoneError(existingLead) {
  return buildEnvelope(
    {
      leadId: existingLead.leadId,
      name: existingLead.name,
      phone: existingLead.phone,
    },
    { error: 'duplicate_phone', message: 'A lead with this phone number already exists' }
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
  buildLeadDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeleteConfirmation,
  buildFullLead,
  buildConvertConfirmation,
  buildNoteCreateConfirmation,
  buildNotesList,
  buildNoteUpdateConfirmation,
  buildNoteDeleteConfirmation,
  buildMetricsSummary,
  buildBudgetRanking,
  buildStaleLeads,
  buildPriorityRanking,
  buildFollowUpQueue,
  buildConversionCandidates,
  buildLeadNotFoundError,
  buildAlreadyConvertedError,
  buildCannotDeleteConvertedError,
  buildPhoneRequiredError,
  buildNameRequiredError,
  buildDuplicatePhoneError,
  buildEmptySearchResults,
};
