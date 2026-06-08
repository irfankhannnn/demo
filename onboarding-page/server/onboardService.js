import crypto from 'crypto';
import { putAgencyConfig } from './ddb.js';

/**
 * Slugify agency name for tenantId prefix
 */
function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Generate random hex hash for tenantId suffix
 */
function randomHash(len = 8) {
  return crypto.randomBytes(16).toString('hex').slice(0, len);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Validate phone format (E.164: +countrycode followed by digits)
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(String(phone));
}

/**
 * Onboard a new tenant (agency) into the auth system.
 * This creates an agency record in dev-reality-flow-auth-agency-config.
 * The admin can then login via Google (email) or Phone OTP (phone).
 * 
 * @param {Object} params
 * @param {string} params.agencyName - Required agency name
 * @param {string} [params.adminEmail] - Optional admin email (for Google login)
 * @param {string} [params.adminPhone] - Optional admin phone E.164 (for Phone login)
 * @returns {Promise<Object>} Result with tenantId and agency info
 */
export async function onboardTenant({
  agencyName,
  adminEmail,
  adminPhone,
}) {
  // Validate agency name
  if (!agencyName) {
    throw new Error('agencyName is required');
  }

  const prefix = slugify(agencyName);
  if (!prefix) {
    throw new Error('agencyName must contain letters/numbers');
  }

  // Validate at least one admin identifier is provided
  const hasEmail = adminEmail && String(adminEmail).trim();
  const hasPhone = adminPhone && String(adminPhone).trim();

  if (!hasEmail && !hasPhone) {
    throw new Error('At least one of adminEmail or adminPhone is required');
  }

  // Validate email format if provided
  if (hasEmail && !isValidEmail(adminEmail)) {
    throw new Error('Invalid email format');
  }

  // Validate phone format if provided
  if (hasPhone && !isValidPhone(adminPhone)) {
    throw new Error('Invalid phone format. Use E.164 format (e.g., +919876543210)');
  }

  // Generate tenantId
  const tenantId = `${prefix}-${randomHash(10)}`;
  const now = new Date().toISOString();

  // Build item for auth agency table
  const item = {
    TenantId: tenantId,
    agencyName: String(agencyName).trim(),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  // Add admin identifiers (used for lookup during login)
  if (hasEmail) {
    item.adminEmail = String(adminEmail).toLowerCase().trim();
  }
  if (hasPhone) {
    item.adminPhone = String(adminPhone).trim();
  }

  // Write to DynamoDB
  await putAgencyConfig(item);

  return {
    ok: true,
    tenantId,
    agencyName: item.agencyName,
    adminEmail: item.adminEmail || null,
    adminPhone: item.adminPhone || null,
    message: 'Tenant onboarded. Admin can now login via Google or Phone OTP.',
  };
}
