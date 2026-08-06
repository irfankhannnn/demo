import type { CRMLead } from '../types/crm';
import { titleCaseFields } from './titleCase';

const LEAD_TOP_LEVEL_TEXT_FIELDS = ['name'] as const;

const BUYER_REQUIREMENT_TEXT_FIELDS = ['preferredArea', 'city'] as const;

const TENANT_REQUIREMENT_TEXT_FIELDS = ['preferredArea', 'city'] as const;

const PROPERTY_TEXT_FIELDS = ['area', 'buildingName'] as const;

export function normalizeLeadTextFields(lead: Partial<CRMLead>): Partial<CRMLead> {
  titleCaseFields(lead as Record<string, unknown>, LEAD_TOP_LEVEL_TEXT_FIELDS);

  if (lead.buyerRequirement) {
    titleCaseFields(
      lead.buyerRequirement as Record<string, unknown>,
      BUYER_REQUIREMENT_TEXT_FIELDS,
    );
  }

  if (lead.tenantRequirement) {
    titleCaseFields(
      lead.tenantRequirement as Record<string, unknown>,
      TENANT_REQUIREMENT_TEXT_FIELDS,
    );
  }

  if (lead.sellerProperty) {
    titleCaseFields(lead.sellerProperty as Record<string, unknown>, PROPERTY_TEXT_FIELDS);
  }

  if (lead.ownerProperty) {
    titleCaseFields(lead.ownerProperty as Record<string, unknown>, PROPERTY_TEXT_FIELDS);
  }

  return lead;
}
