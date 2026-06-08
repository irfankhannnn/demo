// Tenant Configuration
// This tenant ID will be passed with every API request via x-tenant-id header
// Each organization/user gets their own tenant ID for data isolation

import { getUserProfile } from '../utils/authStorage';

// Fallback for dev/legacy cases where auth profile isn't available yet
const FALLBACK_TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined;

// Get tenant headers - derives from authenticated user's profile (primary)
// Falls back to VITE_TENANT_ID only if profile not available
export function getTenantHeaders(): Record<string, string> {
  const profile = getUserProfile();
  const tenantId = profile?.tenantId || FALLBACK_TENANT_ID;

  // Only include header if tenantId exists
  // Server will reject with 400 if missing (safer than sending wrong tenant)
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}
