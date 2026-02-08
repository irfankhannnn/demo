// Tenant Configuration
// This tenant ID will be passed with every API request via x-tenant-id header
// Each organization/user gets their own tenant ID for data isolation

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

if (!TENANT_ID) {
  throw new Error('VITE_TENANT_ID is not defined. Set it in your .env file.');
}

export { TENANT_ID };

// Add tenant_id to request headers
export function getTenantHeaders(): Record<string, string> {
  return {
    'x-tenant-id': TENANT_ID,
  };
}
