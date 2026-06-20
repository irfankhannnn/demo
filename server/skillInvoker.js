import {
  createLead,
  getLead,
  getLeads,
  updateLead,
  createContact,
  getContacts,
  createOwner,
  getOwners,
  createProperty,
  getProperties,
  createCustomer,
  getCustomers,
  createBuyer,
} from './crmDynamodbService.js';
import { logger } from './logger.js';

const TOOL_MAP = {
  create_lead: { fn: createLead, entity: 'lead' },
  get_lead: { fn: getLead, entity: 'lead', read: true },
  search_leads: { fn: getLeads, entity: 'lead', read: true },
  update_lead: { fn: updateLead, entity: 'lead' },
  create_contact: { fn: createContact, entity: 'contact' },
  search_contacts: { fn: getContacts, entity: 'contact', read: true },
  create_owner: { fn: createOwner, entity: 'owner' },
  get_owners: { fn: getOwners, entity: 'owner', read: true },
  create_property: { fn: createProperty, entity: 'property' },
  search_properties: { fn: getProperties, entity: 'property', read: true },
  create_tenant: { fn: createCustomer, entity: 'tenant' },
  search_tenants: { fn: getCustomers, entity: 'tenant', read: true },
  create_buyer: { fn: createBuyer, entity: 'buyer' },
};

const ALLOWED_TOOLS = Object.keys(TOOL_MAP);

/**
 * Invoke a CRM skill action for a tenant (in-Lambda direct DynamoDB path).
 */
export async function invokeSkill(tenantId, toolName, input, { userId } = {}) {
  if (!tenantId) return { ok: false, error: 'tenantId required' };
  if (!ALLOWED_TOOLS.includes(toolName)) {
    return { ok: false, error: `Tool not allowed: ${toolName}` };
  }

  const tool = TOOL_MAP[toolName];

  try {
    if (toolName === 'get_lead') {
      const data = await tool.fn(tenantId, input.leadId || input.id);
      return { ok: true, data };
    }

    if (toolName === 'update_lead') {
      const data = await tool.fn(tenantId, input.leadId || input.id, input);
      return { ok: true, data };
    }

    if (toolName === 'search_leads') {
      const data = await tool.fn(tenantId, input.filters || input);
      return { ok: true, data };
    }

    if (tool.read) {
      const data = await tool.fn(tenantId, input.filters || {});
      return { ok: true, data };
    }

    const data = await tool.fn(tenantId, { ...input, createdBy: userId || 'agent' });
    logger.info('skillInvoker.success', { tenantId, toolName });
    return { ok: true, data };
  } catch (err) {
    logger.error('skillInvoker.failed', { tenantId, toolName, error: err.message });
    return { ok: false, error: err.message };
  }
}

export { ALLOWED_TOOLS };
