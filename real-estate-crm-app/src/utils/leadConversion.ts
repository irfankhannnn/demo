import type { CRMLead } from '../types/crm';

/** Route to the CRM profile created from this lead conversion. */
export function getConvertedEntityPath(
  convertedTo?: { entityType?: string; entityId?: string; role?: string } | null
): string | null {
  if (!convertedTo?.entityId) return null;
  const role = String(convertedTo.role || convertedTo.entityType || '').toLowerCase();
  if (role === 'buyer') return `/crm/buyers/${convertedTo.entityId}`;
  if (role === 'tenant' || role === 'customer') return `/crm/tenants/${convertedTo.entityId}`;
  if (role === 'owner' || role === 'seller') return `/crm/owners/${convertedTo.entityId}`;
  return `/crm/contacts/${convertedTo.entityId}`;
}

/** True when conversion destination metadata is present (successful convert / history row). */
export function hasLeadConversionTarget(
  lead: Pick<CRMLead, 'convertedTo'> | null | undefined
): boolean {
  const convertedTo = lead?.convertedTo;
  return !!(convertedTo && (convertedTo.entityId || convertedTo.contactId));
}

/**
 * True when a lead has left the active pipeline.
 * After atomic conversion, active leads are deleted; residual legacy rows
 * and conversion-history projections may still carry convertedTo.
 */
export function isLeadConverted(
  lead: Pick<CRMLead, 'convertedAt' | 'convertedTo' | 'status' | 'archivedFromSnapshot'> | null | undefined
): boolean {
  if (!lead) return false;
  if (lead.archivedFromSnapshot) return true;
  if (hasLeadConversionTarget(lead)) return true;
  return String(lead.status || '').toLowerCase() === 'converted';
}
