/**
 * LeadService — Thin orchestration layer for lead operations.
 *
 * Responsibilities:
 * - Call crmDynamodbService for CRUD operations
 * - Pass results through LeadNormalizer
 * - Return results ready for LeadAIViewBuilder
 *
 * Does NOT contain business logic beyond orchestration.
 * Does NOT format data for display.
 */

import {
  createLead, getLead, getLeads, updateLead, deleteLead, convertLead,
  createLeadNote, getLeadNotes,
  searchLeads, unwrapLeadsList,
} from '../crmDynamodbService.js';
import { normalizeLead, normalizeLeads } from '../normalizers/leadNormalizer.js';
import { logger } from '../logger.js';

/**
 * Search leads with optional filters
 */
export async function searchLeads_Service(tenantId, query, filters = {}, options = {}) {
  try {
    const results = await searchLeads(tenantId, query);
    return {
      leads: normalizeLeads(results),
      total: results.length,
    };
  } catch (err) {
    logger.error('leadService.searchLeads.failed', { tenantId, query, error: err.message });
    throw err;
  }
}

/**
 * Get single lead with optional notes
 */
export async function getLead_Service(tenantId, leadId, options = {}) {
  try {
    const lead = await getLead(tenantId, leadId);
    if (!lead) return null;
    return normalizeLead(lead);
  } catch (err) {
    logger.error('leadService.getLead.failed', { tenantId, leadId, error: err.message });
    throw err;
  }
}

/**
 * Get leads list with filters
 */
export async function getLeads_Service(tenantId, filters = {}, options = {}) {
  try {
    const result = await getLeads(tenantId, filters);
    const leads = unwrapLeadsList(result);
    return {
      leads: normalizeLeads(leads),
      total: result?.total ?? leads.length,
      limit: result?.limit,
      offset: result?.offset,
    };
  } catch (err) {
    logger.error('leadService.getLeads.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Create lead
 */
export async function createLead_Service(tenantId, data) {
  try {
    const lead = await createLead(tenantId, data);
    return normalizeLead(lead);
  } catch (err) {
    logger.error('leadService.createLead.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Update lead
 */
export async function updateLead_Service(tenantId, leadId, data) {
  try {
    const lead = await updateLead(tenantId, leadId, data);
    return normalizeLead(lead);
  } catch (err) {
    logger.error('leadService.updateLead.failed', { tenantId, leadId, error: err.message });
    throw err;
  }
}

/**
 * Delete lead
 */
export async function deleteLead_Service(tenantId, leadId) {
  try {
    await deleteLead(tenantId, leadId);
    return { success: true };
  } catch (err) {
    logger.error('leadService.deleteLead.failed', { tenantId, leadId, error: err.message });
    throw err;
  }
}

/**
 * Convert lead to contact/buyer/owner
 */
export async function convertLead_Service(tenantId, leadId, convertTo) {
  try {
    const result = await convertLead(tenantId, leadId, convertTo);
    return result;
  } catch (err) {
    logger.error('leadService.convertLead.failed', { tenantId, leadId, convertTo, error: err.message });
    throw err;
  }
}

/**
 * Get lead notes
 */
export async function getLeadNotes_Service(tenantId, leadId) {
  try {
    const notes = await getLeadNotes(tenantId, leadId);
    return notes || [];
  } catch (err) {
    logger.error('leadService.getLeadNotes.failed', { tenantId, leadId, error: err.message });
    throw err;
  }
}

/**
 * Create lead note
 */
export async function createLeadNote_Service(tenantId, leadId, data) {
  try {
    const note = await createLeadNote(tenantId, leadId, data);
    return note;
  } catch (err) {
    logger.error('leadService.createLeadNote.failed', { tenantId, leadId, error: err.message });
    throw err;
  }
}

export default {
  searchLeads_Service,
  getLead_Service,
  getLeads_Service,
  createLead_Service,
  updateLead_Service,
  deleteLead_Service,
  convertLead_Service,
  getLeadNotes_Service,
  createLeadNote_Service,
};
