import { titleCaseFields } from '../utils/titleCase.js';

const LEAD_TOP_LEVEL_TEXT_FIELDS = ['name'];

const BUYER_REQUIREMENT_TEXT_FIELDS = ['preferredArea', 'city'];

const TENANT_REQUIREMENT_TEXT_FIELDS = ['preferredArea', 'city'];

const PROPERTY_TEXT_FIELDS = ['area', 'buildingName'];

/**
 * Title-case lead text fields before create/update persistence.
 * Skips enums, IDs, email, phone, BHK, flat/floor, and numeric fields.
 */
export function normalizeLeadTextFields(data) {
  if (!data || typeof data !== 'object') return data;

  titleCaseFields(data, LEAD_TOP_LEVEL_TEXT_FIELDS);

  if (data.buyerRequirement) {
    titleCaseFields(data.buyerRequirement, BUYER_REQUIREMENT_TEXT_FIELDS);
  }

  if (data.tenantRequirement) {
    titleCaseFields(data.tenantRequirement, TENANT_REQUIREMENT_TEXT_FIELDS);
  }

  if (data.sellerProperty) {
    titleCaseFields(data.sellerProperty, PROPERTY_TEXT_FIELDS);
  }

  if (data.ownerProperty) {
    titleCaseFields(data.ownerProperty, PROPERTY_TEXT_FIELDS);
  }

  return data;
}

export default { normalizeLeadTextFields };
