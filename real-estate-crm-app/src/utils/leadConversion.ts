import type { CRMLead } from '../types/crm';

export type ConvertLeadApiResult = {
  entityType?: string;
  role?: string;
  entity?: {
    ownerId?: string;
    buyerId?: string;
    customerId?: string;
  };
  contactId?: string | null;
  convertedTo?: { entityType?: string; entityId?: string; role?: string };
};

/** Route after a successful convert API call — entity profile first, contact only as fallback. */
export function getConvertResultPath(result: ConvertLeadApiResult | null | undefined): string {
  if (!result) return '/crm/leads';

  const role = String(
    result.role || result.entityType || result.convertedTo?.role || result.convertedTo?.entityType || '',
  ).toLowerCase();
  const entity = result.entity;

  if (role === 'buyer') {
    const id = entity?.buyerId || result.convertedTo?.entityId;
    if (id) return `/crm/buyers/${id}`;
  }
  if (role === 'tenant' || role === 'customer') {
    const id = entity?.customerId || result.convertedTo?.entityId;
    if (id) return `/crm/tenants/${id}`;
  }
  if (role === 'owner' || role === 'seller') {
    const id = entity?.ownerId || result.convertedTo?.entityId;
    if (id) return `/crm/owners/${id}`;
  }

  if (result.contactId) return `/crm/contacts/${result.contactId}`;
  const convertedPath = getConvertedEntityPath(result.convertedTo);
  return convertedPath || '/crm/leads';
}

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
