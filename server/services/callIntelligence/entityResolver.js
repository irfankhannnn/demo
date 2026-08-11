/**
 * Resolves a phone number to the CRM record the call was about.
 *
 * Reuses the existing CRM lookups rather than adding new access patterns:
 *   - getLeads()            → leads (scan + in-memory phone compare, same as search_leads)
 *   - findPersonByPhone()   → buyer / owner / tenant cross-role lookup
 *   - findContactByPhone()  → unified contact identity
 */

import { logger } from '../../logger.js';
import { ENTITY_TYPE } from './constants.js';
import { phonesEqual, normalizePhoneForMatch, toE164 } from './phoneExtractor.js';

/**
 * Priority when a person exists in several roles. A live sales conversation is
 * most useful on the lead record, then the rental/ownership records, and the
 * unified contact is the last resort.
 */
const ENTITY_PRIORITY = [
  ENTITY_TYPE.LEAD,
  ENTITY_TYPE.TENANT,
  ENTITY_TYPE.OWNER,
  ENTITY_TYPE.BUYER,
  ENTITY_TYPE.CONTACT,
];

function displayName(record) {
  return record?.name || record?.fullName || record?.contactName || '';
}

/**
 * Find every CRM record matching a phone number.
 *
 * @param {string} tenantId
 * @param {string} phone raw or normalized phone
 * @param {object} deps injectable CRM service (tests pass a stub)
 * @returns {Promise<{matched: object|null, candidates: object[]}>}
 */
export async function resolveEntityByPhone(tenantId, phone, deps = {}) {
  const result = { matched: null, candidates: [] };
  if (!tenantId || !phone) return result;

  const crm = deps.crmService || (await import('../../crmDynamodbService.js'));
  const normalized = normalizePhoneForMatch(phone);
  const candidates = [];

  // Leads — excluded when already converted, since the converted record
  // (tenant/owner/buyer) is the live one.
  try {
    const leadResult = await crm.getLeads(tenantId, {});
    const leads = Array.isArray(leadResult) ? leadResult : leadResult?.leads || [];
    for (const lead of leads) {
      if (phonesEqual(lead.phone, normalized) || phonesEqual(lead.alternatePhone, normalized)) {
        candidates.push({
          entityType: ENTITY_TYPE.LEAD,
          entityId: lead.leadId,
          name: displayName(lead),
          phone: lead.phone,
          status: lead.status || '',
          updatedAt: lead.updatedAt || lead.createdAt || '',
        });
      }
    }
  } catch (err) {
    logger.warn('callIntelligence.resolve.leads.failed', { tenantId, error: err.message });
  }

  // Buyer / owner / tenant cross-role lookup.
  // findPersonByPhone compares the full digit string, so a record saved as
  // "+91 98765 43210" is only found when the country code is included. Try the
  // national form first, then the country-code form.
  try {
    let person = await crm.findPersonByPhone(tenantId, normalized);
    const withCountryCode = toE164(normalized).replace(/\D/g, '');
    if (!person?.roles?.length && withCountryCode !== normalized) {
      person = await crm.findPersonByPhone(tenantId, withCountryCode);
    }
    for (const role of person?.roles || []) {
      candidates.push({
        entityType: role.role,
        entityId: role.id,
        name: displayName(role.data),
        phone: role.data?.phone || '',
        status: role.data?.status || '',
        updatedAt: role.data?.updatedAt || role.data?.createdAt || '',
      });
    }
  } catch (err) {
    logger.warn('callIntelligence.resolve.person.failed', { tenantId, error: err.message });
  }

  // Unified contact.
  try {
    const contact = await crm.findContactByPhone(tenantId, normalized);
    if (contact?.contactId) {
      candidates.push({
        entityType: ENTITY_TYPE.CONTACT,
        entityId: contact.contactId,
        name: displayName(contact),
        phone: contact.phone || '',
        status: contact.status || '',
        updatedAt: contact.updatedAt || contact.createdAt || '',
      });
    }
  } catch (err) {
    logger.warn('callIntelligence.resolve.contact.failed', { tenantId, error: err.message });
  }

  // De-duplicate (same entity can surface twice via different lookups).
  const seen = new Set();
  const unique = candidates.filter((candidate) => {
    if (!candidate.entityId) return false;
    const key = `${candidate.entityType}:${candidate.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const byType = ENTITY_PRIORITY.indexOf(a.entityType) - ENTITY_PRIORITY.indexOf(b.entityType);
    if (byType !== 0) return byType;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  result.candidates = unique;
  result.matched = unique[0] || null;
  return result;
}

/**
 * Load the CRM record behind a match so the analysis prompt has real context
 * (current status, budget, requirements) instead of only a phone number.
 */
export async function loadEntitySnapshot(tenantId, entityType, entityId, deps = {}) {
  if (!tenantId || !entityType || !entityId) return null;
  const crm = deps.crmService || (await import('../../crmDynamodbService.js'));

  try {
    switch (entityType) {
      case ENTITY_TYPE.LEAD:
        return await crm.getLead(tenantId, entityId);
      case ENTITY_TYPE.TENANT:
        return await crm.getCustomer(tenantId, entityId);
      case ENTITY_TYPE.OWNER:
        return await crm.getOwner(tenantId, entityId);
      case ENTITY_TYPE.BUYER:
        return await crm.getBuyer(tenantId, entityId);
      case ENTITY_TYPE.CONTACT:
        return await crm.getContact(tenantId, entityId);
      default:
        return null;
    }
  } catch (err) {
    logger.warn('callIntelligence.entitySnapshot.failed', { tenantId, entityType, entityId, error: err.message });
    return null;
  }
}

/** Compact projection of a CRM record for the analysis prompt. */
export function summarizeEntityForPrompt(entityType, record) {
  if (!record) return null;
  const base = {
    entityType,
    name: displayName(record),
    phone: record.phone || '',
    status: record.status || '',
  };

  switch (entityType) {
    case ENTITY_TYPE.LEAD:
      return {
        ...base,
        leadType: record.leadType || '',
        priority: record.priority || '',
        source: record.source || '',
        budgetMin: record.budgetMin ?? null,
        budgetMax: record.budgetMax ?? null,
        requirement: record.requirement || record.notes || '',
        preferredAreas: record.preferredAreas || record.area || '',
      };
    case ENTITY_TYPE.TENANT:
      return {
        ...base,
        propertyId: record.propertyId || '',
        rentAmount: record.rentAmount ?? null,
        leaseEndDate: record.leaseEndDate || '',
      };
    case ENTITY_TYPE.OWNER:
      return { ...base, propertiesCount: record.propertiesCount ?? null };
    case ENTITY_TYPE.BUYER:
      return {
        ...base,
        budgetMin: record.budgetMin ?? null,
        budgetMax: record.budgetMax ?? null,
        requirement: record.requirement || '',
      };
    default:
      return base;
  }
}
