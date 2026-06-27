/**
 * TenantService — Thin orchestration layer for tenant (customer) operations.
 *
 * Responsibilities:
 * - Call crmDynamodbService for CRUD operations
 * - Pass results through TenantNormalizer
 * - Return results ready for TenantAIViewBuilder
 *
 * Does NOT contain business logic beyond orchestration.
 * Does NOT format data for display.
 */

import {
  createCustomer, getCustomer, getCustomers, updateCustomer, deleteCustomer,
  getCustomerByPhone, createCustomerNote, getCustomerNotes,
  updateCustomerNote, deleteCustomerNote,
  searchCustomers,
} from '../crmDynamodbService.js';
import { updateCurrentRental, moveTenantToHistory } from '../crmHelpers.js';
import { normalizeTenant, normalizeTenants } from '../normalizers/tenantNormalizer.js';
import { logger } from '../logger.js';

/**
 * Search tenants with optional filters
 */
export async function searchTenants_Service(tenantId, query, filters = {}, options = {}) {
  try {
    const results = await searchCustomers(tenantId, query);
    return {
      tenants: normalizeTenants(results),
      total: results.length,
    };
  } catch (err) {
    logger.error('tenantService.searchTenants.failed', { tenantId, query, error: err.message });
    throw err;
  }
}

/**
 * Get single tenant with optional notes and rental
 */
export async function getTenant_Service(tenantId, customerId, options = {}) {
  try {
    const tenant = await getCustomer(tenantId, customerId);
    if (!tenant) return null;
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.getTenant.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Get tenants list with filters
 */
export async function getTenants_Service(tenantId, filters = {}, options = {}) {
  try {
    const tenants = await getCustomers(tenantId, filters);
    return {
      tenants: normalizeTenants(tenants),
      total: tenants.length,
    };
  } catch (err) {
    logger.error('tenantService.getTenants.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Create tenant
 */
export async function createTenant_Service(tenantId, data) {
  try {
    const tenant = await createCustomer(tenantId, data);
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.createTenant.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Update tenant
 */
export async function updateTenant_Service(tenantId, customerId, data) {
  try {
    const tenant = await updateCustomer(tenantId, customerId, data);
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.updateTenant.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Deactivate tenant (prefer over delete)
 */
export async function deactivateTenant_Service(tenantId, customerId) {
  try {
    const tenant = await updateCustomer(tenantId, customerId, { status: 'inactive' });
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.deactivateTenant.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Delete tenant (not recommended, use deactivate instead)
 */
export async function deleteTenant_Service(tenantId, customerId) {
  try {
    await deleteCustomer(tenantId, customerId);
    return { success: true };
  } catch (err) {
    logger.error('tenantService.deleteTenant.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Get tenant by phone
 */
export async function getTenantByPhone_Service(tenantId, phone) {
  try {
    const tenant = await getCustomerByPhone(tenantId, phone);
    if (!tenant) return null;
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.getTenantByPhone.failed', { tenantId, phone, error: err.message });
    throw err;
  }
}

/**
 * Get tenant notes
 */
export async function getTenantNotes_Service(tenantId, customerId) {
  try {
    const notes = await getCustomerNotes(tenantId, customerId);
    return notes || [];
  } catch (err) {
    logger.error('tenantService.getTenantNotes.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Create tenant note
 */
export async function createTenantNote_Service(tenantId, customerId, data) {
  try {
    const note = await createCustomerNote(tenantId, customerId, data);
    return note;
  } catch (err) {
    logger.error('tenantService.createTenantNote.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Update tenant note
 */
export async function updateTenantNote_Service(tenantId, customerId, noteId, data) {
  try {
    const note = await updateCustomerNote(tenantId, customerId, noteId, data);
    return note;
  } catch (err) {
    logger.error('tenantService.updateTenantNote.failed', { tenantId, customerId, noteId, error: err.message });
    throw err;
  }
}

/**
 * Delete tenant note
 */
export async function deleteTenantNote_Service(tenantId, customerId, noteId) {
  try {
    await deleteCustomerNote(tenantId, customerId, noteId);
    return { success: true };
  } catch (err) {
    logger.error('tenantService.deleteTenantNote.failed', { tenantId, customerId, noteId, error: err.message });
    throw err;
  }
}

/**
 * Get tenant rental history
 */
export async function getTenantRentalHistory_Service(tenantId, customerId) {
  try {
    const tenant = await getCustomer(tenantId, customerId);
    if (!tenant) return null;
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.getTenantRentalHistory.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Update current rental
 */
export async function updateCurrentRental_Service(tenantId, customerId, rentalDetails) {
  try {
    await updateCurrentRental(tenantId, customerId, rentalDetails);
    const tenant = await getCustomer(tenantId, customerId);
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.updateCurrentRental.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Archive current rental to history
 */
export async function archiveTenantRental_Service(tenantId, customerId) {
  try {
    await moveTenantToHistory(tenantId, customerId);
    const tenant = await getCustomer(tenantId, customerId);
    return normalizeTenant(tenant);
  } catch (err) {
    logger.error('tenantService.archiveTenantRental.failed', { tenantId, customerId, error: err.message });
    throw err;
  }
}

/**
 * Get tenant metrics
 */
export async function getTenantMetrics_Service(tenantId) {
  try {
    const tenants = await getCustomers(tenantId, {});
    const active = tenants.filter(t => t.status === 'active').length;
    const inactive = tenants.filter(t => t.status === 'inactive').length;
    const past = tenants.filter(t => t.status === 'past').length;

    return {
      tenants: {
        total: tenants.length,
        active,
        inactive,
        past,
      },
    };
  } catch (err) {
    logger.error('tenantService.getTenantMetrics.failed', { tenantId, error: err.message });
    throw err;
  }
}

export default {
  searchTenants_Service,
  getTenant_Service,
  getTenants_Service,
  createTenant_Service,
  updateTenant_Service,
  deactivateTenant_Service,
  deleteTenant_Service,
  getTenantByPhone_Service,
  getTenantNotes_Service,
  createTenantNote_Service,
  updateTenantNote_Service,
  deleteTenantNote_Service,
  getTenantRentalHistory_Service,
  updateCurrentRental_Service,
  archiveTenantRental_Service,
  getTenantMetrics_Service,
};
