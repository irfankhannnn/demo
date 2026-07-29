import type { CRMLead, LeadType, BuyerRequirement } from '../types/crm';
import { normalizeBuyerRequirement } from './buyerRequirementSchema';

const LEAD_REQUIREMENT_FIELD: Record<LeadType, keyof CRMLead> = {
  buyer: 'buyerRequirement',
  seller: 'sellerProperty',
  tenant: 'tenantRequirement',
  owner: 'ownerProperty',
};

function hasRequirementData(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).length > 0;
}

/** Build a lead create/update payload with only the requirement object for the active lead type. */
export function buildLeadSavePayload(lead: Partial<CRMLead>) {
  const payload: Record<string, unknown> = {
    leadType: lead.leadType,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    status: lead.status,
    priority: lead.priority,
    lostReason: lead.status === 'lost' ? lead.lostReason : null,
    lostAt: lead.status === 'lost' ? (lead.lostAt || new Date().toISOString()) : null,
    notes: lead.notes,
  };

  const leadType = lead.leadType as LeadType | undefined;
  if (leadType) {
    const field = LEAD_REQUIREMENT_FIELD[leadType];
    if (field && hasRequirementData(lead[field])) {
      if (field === 'buyerRequirement') {
        payload[field] = normalizeBuyerRequirement(lead[field] as BuyerRequirement);
      } else {
        payload[field] = lead[field];
      }
    }
  }

  return payload;
}
