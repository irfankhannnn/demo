/**
 * Response Formatter Service
 * 
 * Formats CRM data responses based on responseMode parameter
 * 
 * Modes:
 * - summary: Minimal data (IDs, names, key fields)
 * - compact: Key fields (id, name, phone, status, budget)
 * - details: All fields except internal metadata
 * - full: Everything (for admin/debugging)
 */

/**
 * Format a single item based on responseMode
 * @param {Object} item - The item to format
 * @param {string} responseMode - Format mode (summary, compact, details, full)
 * @param {string} entityType - Type of entity (lead, buyer, property, etc.)
 * @returns {Object} Formatted item
 */
export function formatItem(item, responseMode = 'summary', entityType = 'generic') {
  if (!item) return null;

  const modes = {
    summary: () => formatSummary(item, entityType),
    compact: () => formatCompact(item, entityType),
    details: () => formatDetails(item),
    full: () => item,
  };

  const formatter = modes[responseMode] || modes.summary;
  return formatter();
}

/**
 * Format array of items
 * @param {Array} items - Items to format
 * @param {string} responseMode - Format mode
 * @param {string} entityType - Type of entity
 * @returns {Array} Formatted items
 */
export function formatItems(items, responseMode = 'summary', entityType = 'generic') {
  if (!Array.isArray(items)) return [];
  return items.map((item) => formatItem(item, responseMode, entityType));
}

/**
 * Summary mode: Minimal data
 * Returns only IDs and names
 */
function formatSummary(item, entityType) {
  const baseFields = {
    id: item.leadId || item.buyerId || item.ownerId || item.customerId || item.propertyId || item.contactId || item.id,
    name: item.name,
  };

  // Add type-specific fields
  switch (entityType) {
    case 'lead':
      return {
        ...baseFields,
        phone: item.phone,
        status: item.status,
      };
    case 'buyer':
      return {
        ...baseFields,
        phone: item.phone,
        budget: item.budget,
      };
    case 'property':
      return {
        ...baseFields,
        type: item.propertyType,
        price: item.price,
        status: item.status,
      };
    case 'owner':
      return {
        ...baseFields,
        phone: item.phone,
        properties: item.propertyCount || 0,
      };
    default:
      return baseFields;
  }
}

/**
 * Compact mode: Key fields
 * Returns essential information for display
 */
function formatCompact(item, entityType) {
  const summary = formatSummary(item, entityType);

  // Add more fields for compact mode
  const compactFields = {
    ...summary,
    email: item.email,
    createdAt: item.createdAt,
  };

  // Add type-specific fields
  switch (entityType) {
    case 'lead':
      return {
        ...compactFields,
        temperature: item.score,
        source: item.source,
        budget: item.budget,
      };
    case 'buyer':
      return {
        ...compactFields,
        propertyType: item.propertyType,
        bhk: item.bhk,
        timeline: item.timeline,
      };
    case 'property':
      return {
        ...compactFields,
        area: item.area,
        bhk: item.bhk,
        owner: item.ownerName,
      };
    case 'owner':
      return {
        ...compactFields,
        address: item.address,
        areaOfInterest: item.areaOfInterest,
      };
    default:
      return compactFields;
  }
}

/**
 * Details mode: All fields except internal metadata
 * Returns all user-facing fields
 */
function formatDetails(item) {
  // Remove internal fields
  const internalFields = new Set([
    'PK',
    'SK',
    'EntityType',
    'GSI1PK',
    'GSI1SK',
    'GSI2PK',
    'GSI2SK',
    'GSI3PK',
    'GSI3SK',
    'ttl',
    '__typename',
  ]);

  const details = {};
  for (const [key, value] of Object.entries(item)) {
    if (!internalFields.has(key)) {
      details[key] = value;
    }
  }

  return details;
}

/**
 * Apply responseMode to a list response
 * @param {Array} items - Items to format
 * @param {string} responseMode - Format mode
 * @param {string} entityType - Type of entity
 * @returns {Array} Formatted items
 */
export function applyResponseMode(items, responseMode = 'summary', entityType = 'generic') {
  return formatItems(items, responseMode, entityType);
}
