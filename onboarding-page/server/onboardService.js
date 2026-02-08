import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { putAgencyConfig } from './ddb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse dependencies installed in the main backend (server/node_modules)
const require = createRequire(path.join(__dirname, '..', '..', 'server', 'package.json'));
const bcrypt = require('bcryptjs');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomHash(len = 8) {
  return crypto.randomBytes(16).toString('hex').slice(0, len);
}

export async function onboardTenant({
  agencyName,
  adminUsername,
  adminPassword,
  contactEmail,
  contactPhone,
}) {
  if (!agencyName) throw new Error('agencyName is required');
  if (!adminUsername) throw new Error('adminUsername is required');
  if (!adminPassword || String(adminPassword).length < 6) {
    throw new Error('adminPassword is required (min 6 chars)');
  }

  const prefix = slugify(agencyName);
  if (!prefix) throw new Error('agencyName must contain letters/numbers');

  const tenantId = `${prefix}-${randomHash(10)}`;
  const adminPasswordHash = await bcrypt.hash(String(adminPassword), 10);

  const now = new Date().toISOString();
  const enableTenantMetadata = String(process.env.ENABLE_TENANT_METADATA || 'true') === 'true';

  const item = {
    TenantId: tenantId,
    adminUsername: String(adminUsername),
    adminPasswordHash,
    createdAt: now,
    updatedAt: now,
    ...(enableTenantMetadata
      ? {
          agencyName: String(agencyName),
          contactEmail: contactEmail ? String(contactEmail) : null,
          contactPhone: contactPhone ? String(contactPhone) : null,
        }
      : {}),
  };

  await putAgencyConfig(item);

  return {
    ok: true,
    tenantId,
    adminUsername: String(adminUsername),
    message: 'Tenant onboarded. Use tenantId as x-tenant-id header when logging into CRM.',
  };
}
