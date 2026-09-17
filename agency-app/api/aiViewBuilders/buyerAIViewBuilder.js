/**
 * BuyerAIViewBuilder — AI DTOs for buyers.
 */

import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';
import { buildBuyerRecommendation } from './recommendations.js';

function latestNote(buyer) {
  const notes = Array.isArray(buyer.notes) ? buyer.notes : [];
  if (!notes.length) return null;
  const n = notes[0];
  return typeof n === 'string' ? n : (n.content || n.text || null);
}

function buildInsightHints(buyer) {
  return {
    priority: buyer.priority || null,
    score: buyer.score || 0,
    budget: buyer.budget || null,
    daysSinceContact: null,
  };
}

export function buildSearchResults(buyers, pagination = {}) {
  const { total = buyers.length, shown = buyers.length, hasMore = false } = pagination;
  return buildEnvelope(
    buyers.map(b => ({
      buyerId: b.buyerId,
      name: b.name,
      phone: b.phone,
      status: b.status || 'active',
      budget: formatMoney(b.budget),
      preferredArea: b.preferredArea || null,
      propertyType: b.propertyType || null,
      bhk: b.bhk || null,
      lastActivityAt: formatDate(b.lastActivityAt),
    })),
    buildPaginationMetadata(total, shown, hasMore),
  );
}

export function buildBuyerDetails(buyer, options = {}) {
  const { includeNotes = true, maxNotes = 5 } = options;
  const notes = Array.isArray(buyer.notes) ? buyer.notes.slice(0, maxNotes) : [];
  return buildEnvelope(
    {
      buyerId: buyer.buyerId,
      name: buyer.name,
      phone: buyer.phone,
      email: buyer.email || null,
      status: buyer.status || 'active',
      budget: formatMoney(buyer.budget),
      budgetMin: buyer.budgetMin || null,
      budgetMax: buyer.budgetMax || null,
      preferredArea: buyer.preferredArea || null,
      propertyType: buyer.propertyType || null,
      bhk: buyer.bhk || null,
      source: buyer.source || null,
      assignedTo: buyer.assignedTo || null,
      createdAt: formatDate(buyer.createdAt),
      lastActivityAt: formatDate(buyer.lastActivityAt),
      nextFollowUpDate: formatDate(buyer.nextFollowUpDate),
      latestNote: latestNote(buyer),
      interactions: Array.isArray(buyer.history) ? buyer.history.length : (buyer.interactions || 0),
      notes: includeNotes ? notes : undefined,
      insightHints: buildInsightHints(buyer),
    },
    {
      notes: includeNotes ? {
        total: (buyer.notes || []).length,
        shown: notes.length,
        hasMore: (buyer.notes || []).length > maxNotes,
      } : null,
      recommendation: buildBuyerRecommendation(buyer),
    },
  );
}

export function buildCreateConfirmation(buyer) {
  return buildEnvelope(
    {
      buyerId: buyer.buyerId,
      name: buyer.name,
      phone: buyer.phone,
      status: buyer.status || 'active',
      budget: formatMoney(buyer.budget),
      preferredArea: buyer.preferredArea || null,
    },
    { action: 'created' },
  );
}

export function buildUpdateConfirmation(buyer, updatedFields = {}) {
  return buildEnvelope(
    {
      buyerId: buyer.buyerId,
      name: buyer.name,
      status: buyer.status || 'active',
    },
    { action: 'updated', updatedFields: Object.keys(updatedFields) },
  );
}

export function buildDeleteConfirmation(buyer) {
  return buildEnvelope(
    { buyerId: buyer.buyerId, name: buyer.name, status: 'deleted' },
    { action: 'deleted' },
  );
}

export function buildNoteCreateConfirmation(buyer, note) {
  return buildEnvelope(
    {
      buyerId: buyer.buyerId,
      buyerName: buyer.name,
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

export function buildBuyerNotFoundError(buyerId) {
  return buildEnvelope(
    { buyerId },
    { error: 'buyer_not_found', message: 'Buyer not found' },
  );
}

export default {
  buildSearchResults,
  buildBuyerDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeleteConfirmation,
  buildNoteCreateConfirmation,
  buildNotesList,
  buildEmptySearchResults,
  buildBuyerNotFoundError,
};
