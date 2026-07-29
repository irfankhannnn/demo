/**
 * Follow-up helpers: auto-open detail when a search returns exactly one row.
 */

import { invokeSkill } from '../skillInvoker.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SEARCH_TO_DETAIL_TOOL = {
  search_leads: 'get_lead',
  search_buyers: 'get_buyer',
  search_owners: 'get_owner',
  search_properties: 'get_property',
  search_contacts: 'get_contact',
  search_tenants: 'get_tenant',
};

const DETAIL_ID_FIELD = {
  get_lead: 'leadId',
  get_buyer: 'buyerId',
  get_owner: 'ownerId',
  get_property: 'propertyId',
  get_contact: 'contactId',
  get_tenant: 'customerId',
};

export function isValidEntityId(id) {
  if (!id || typeof id !== 'string') return false;
  const s = id.trim();
  if (UUID_RE.test(s)) return true;
  return /^[0-9a-f-]{20,}$/i.test(s);
}

function unwrapToolPayload(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.metadata && typeof data.metadata === 'object' && 'data' in data) {
    return data.data;
  }
  return data;
}

export function listItemsFromSearchResult(data) {
  const payload = unwrapToolPayload(data);
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['items', 'leads', 'buyers', 'owners', 'customers', 'properties', 'contacts', 'meetings', 'data']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function entityIdFromItem(item) {
  if (!item || typeof item !== 'object') return null;
  return item.leadId || item.buyerId || item.ownerId || item.propertyId
    || item.contactId || item.customerId || item.tenantRecordId || item.id || null;
}

/**
 * Auto-open detail only when the search was by name/query (user wants a specific record),
 * not when filtering a list (priority, status, leadType, etc.).
 */
export function shouldAutoOpenAfterSearch(searchInput = {}) {
  const q = searchInput?.query;
  return typeof q === 'string' && q.trim().length > 0;
}

/**
 * After search_* with exactly one row, fetch full detail record (same turn).
 * @returns {{ tool: string, result: object } | null}
 */
export async function autoOpenSingleSearchDetail(tenantId, searchToolName, searchResult, context = {}) {
  const detailTool = SEARCH_TO_DETAIL_TOOL[searchToolName];
  if (!detailTool || !searchResult?.ok) return null;

  const items = listItemsFromSearchResult(searchResult.data);
  if (items.length !== 1) return null;

  const id = entityIdFromItem(items[0]);
  if (!isValidEntityId(id)) return null;

  const idField = DETAIL_ID_FIELD[detailTool];
  if (!idField) return null;

  const result = await invokeSkill(tenantId, detailTool, { [idField]: id }, {
    userId: context.userId,
    source: context.source || 'agent.auto_detail',
  });
  return { tool: detailTool, result };
}
