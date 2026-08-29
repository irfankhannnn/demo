/**
 * OwnerService — Thin orchestration layer for owner operations.
 *
 * Responsibilities:
 * - Call crmDynamodbService for CRUD operations
 * - Pass results through OwnerNormalizer
 * - Return results ready for OwnerAIViewBuilder
 *
 * Does NOT contain business logic beyond orchestration.
 * Does NOT format data for display.
 */

import {
  createOwner, getOwner, getOwners, updateOwner, deleteOwner,
  getOwnerByPhone, createOwnerNote, getOwnerNotes,
  searchOwners,
} from '../crmDynamodbService.js';
import { normalizeOwner, normalizeOwners } from '../normalizers/ownerNormalizer.js';
import { logger } from '../logger.js';

/**
 * Search owners with optional filters
 */
export async function searchOwners_Service(tenantId, query, filters = {}, options = {}) {
  try {
    const results = await searchOwners(tenantId, query);
    return {
      owners: normalizeOwners(results),
      total: results.length,
    };
  } catch (err) {
    logger.error('ownerService.searchOwners.failed', { tenantId, query, error: err.message });
    throw err;
  }
}

/**
 * Get single owner with optional notes
 */
export async function getOwner_Service(tenantId, ownerId, options = {}) {
  try {
    const owner = await getOwner(tenantId, ownerId);
    if (!owner) return null;
    return normalizeOwner(owner);
  } catch (err) {
    logger.error('ownerService.getOwner.failed', { tenantId, ownerId, error: err.message });
    throw err;
  }
}

/**
 * Get owners list with filters
 */
export async function getOwners_Service(tenantId, filters = {}, options = {}) {
  try {
    const owners = await getOwners(tenantId, filters);
    return {
      owners: normalizeOwners(owners),
      total: owners.length,
    };
  } catch (err) {
    logger.error('ownerService.getOwners.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Create owner
 */
export async function createOwner_Service(tenantId, data) {
  try {
    const owner = await createOwner(tenantId, data);
    return normalizeOwner(owner);
  } catch (err) {
    logger.error('ownerService.createOwner.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Update owner
 */
export async function updateOwner_Service(tenantId, ownerId, data) {
  try {
    const owner = await updateOwner(tenantId, ownerId, data);
    return normalizeOwner(owner);
  } catch (err) {
    logger.error('ownerService.updateOwner.failed', { tenantId, ownerId, error: err.message });
    throw err;
  }
}

/**
 * Delete owner
 */
export async function deleteOwner_Service(tenantId, ownerId) {
  try {
    await deleteOwner(tenantId, ownerId);
    return { success: true };
  } catch (err) {
    logger.error('ownerService.deleteOwner.failed', { tenantId, ownerId, error: err.message });
    throw err;
  }
}

/**
 * Get owner by phone
 */
export async function getOwnerByPhone_Service(tenantId, phone) {
  try {
    const owner = await getOwnerByPhone(tenantId, phone);
    if (!owner) return null;
    return normalizeOwner(owner);
  } catch (err) {
    logger.error('ownerService.getOwnerByPhone.failed', { tenantId, phone, error: err.message });
    throw err;
  }
}

/**
 * Get owner notes
 */
export async function getOwnerNotes_Service(tenantId, ownerId) {
  try {
    const notes = await getOwnerNotes(tenantId, ownerId);
    return notes || [];
  } catch (err) {
    logger.error('ownerService.getOwnerNotes.failed', { tenantId, ownerId, error: err.message });
    throw err;
  }
}

/**
 * Create owner note
 */
export async function createOwnerNote_Service(tenantId, ownerId, data) {
  try {
    const note = await createOwnerNote(tenantId, ownerId, data);
    return note;
  } catch (err) {
    logger.error('ownerService.createOwnerNote.failed', { tenantId, ownerId, error: err.message });
    throw err;
  }
}

export default {
  searchOwners_Service,
  getOwner_Service,
  getOwners_Service,
  createOwner_Service,
  updateOwner_Service,
  deleteOwner_Service,
  getOwnerByPhone_Service,
  getOwnerNotes_Service,
  createOwnerNote_Service,
};
