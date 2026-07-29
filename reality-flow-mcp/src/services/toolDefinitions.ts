/**
 * RealtyFlow MCP — Tool Definitions (MCP Service Copy)
 *
 * Defines all 54 CRM tools in a neutral format, converted to MCP inputSchema.
 * This is a self-contained copy for the isolated MCP microservice.
 * The canonical source lives in server/shared/toolDefinitions.js (CRM backend).
 *
 * Each tool has:
 * - name: tool identifier (e.g., 'search_leads')
 * - category: entity type (lead, contact, property, owner, tenant, buyer, meeting, metrics)
 * - readOnly: true if read-only (search, get), false if write (create, update, delete)
 * - descriptions: { internal: Hinglish for SyncBot, mcp: English for AI apps }
 * - handler: function name in crmDynamodbService.js (kept for reference, not used here)
 * - parameters: array of parameter definitions
 */

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  category: string;
  readOnly: boolean;
  descriptions: { internal: string; mcp: string };
  handler: string;
  parameters: ToolParameter[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

const toolDefinitions: ToolDefinition[] = [
  // ════════════════════════════════════════════════════════════════════════════════
  // LEAD OPS (8 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_lead',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new lead. Triggers: "create lead", "add lead", "new buyer lead", "seller lead Raj", "tenant lead Sarah", "owner lead Imran". Required: name, leadType (buyer|seller|tenant|owner). Optional: phone, email.',
      mcp: 'Create a new CRM lead. Requires name and leadType (buyer|seller|tenant|owner). Optional: phone, email, priority, buyerRequirement.',
    },
    handler: 'createLead',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Full name of the lead (e.g., "Raj Sharma", "Faizan Khan").' },
      { name: 'leadType', type: 'string', required: true, enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Type of lead: "buyer", "seller", "tenant", or "owner".' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number (10 digits, e.g., "9876543210"). Optional.' },
      { name: 'email', type: 'string', required: false, description: 'Email address (e.g., "raj@example.com"). Optional.' },
    ],
  },
  {
    name: 'get_lead',
    category: 'lead',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single lead by leadId. Use this when the user asks for details of a SPECIFIC lead by ID or name after you already have the leadId from a previous search. Triggers: "lead details", "tell me about lead L123", "show lead abc123", "iska details dikhao". Required: leadId. Do NOT use this for searching — use search_leads for that.',
      mcp: 'Get a single lead by leadId. Use after search_leads when you have a specific leadId.',
    },
    handler: 'getLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead (e.g., "lead-abc123").' },
    ],
  },
  {
    name: 'search_leads',
    category: 'lead',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, show, or find leads. Triggers: "leads dikhao", "show leads", "Kurla ke leads", "buyer leads", "hot leads", "new leads", "leads assigned to Aman", "high priority leads above 1 crore", "sari leads", "all leads". Pass empty parameters {} to list all leads. Extract parameters: query (name/phone/area), leadType (buyer|seller|tenant|owner), status (new|contacted|qualified|negotiating|lost), priority (low|medium|high), assignedTo (agent name), minBudget/maxBudget (in rupees: 80L=8000000, 1Cr=10000000), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Search leads by query, status, leadType, or filters. Supports sorting by budget, score, or recency.',
    },
    handler: 'searchLeads',
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Search by lead name, phone number, or area (e.g., "Kurla", "Faizan", "9876543210"). Leave empty to list all leads.' },
      { name: 'status', type: 'string', required: false, enum: ['new', 'contacted', 'qualified', 'negotiating', 'lost'], description: 'Filter by lead status. Leave empty for all statuses.' },
      { name: 'leadType', type: 'string', required: false, enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Filter by lead type. Leave empty for all types.' },
      { name: 'priority', type: 'string', required: false, enum: ['low', 'medium', 'high'], description: 'Filter by priority. Leave empty for all priorities.' },
      { name: 'assignedTo', type: 'string', required: false, description: 'Filter by agent name (e.g., "Aman"). Leave empty for all agents.' },
      { name: 'minBudget', type: 'number', required: false, description: 'Minimum budget in rupees (e.g., 8000000 for 80L). Leave empty for no minimum.' },
      { name: 'maxBudget', type: 'number', required: false, description: 'Maximum budget in rupees (e.g., 10000000 for 1Cr). Leave empty for no maximum.' },
      { name: 'sortBy', type: 'string', required: false, enum: ['recent_first', 'budget_desc', 'budget_asc', 'score_desc', 'name_asc'], description: 'Sort results by field. Leave empty for default order.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of leads to return (e.g., 10, 20). Leave empty for default.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level: "summary" (names only), "compact" (key fields), "details" (all fields), "full" (everything). Default: summary.' },
    ],
  },
  {
    name: 'update_lead',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to update a lead. Triggers: "update lead", "change status", "mark as contacted", "update budget", "assign to Aman", "mark lost". Required: leadId. For structured updates (budget, BHK, area), use buyerRequirement/sellerProperty/ownerProperty/tenantRequirement objects instead of notes. Example: user says "update budget to 1 crore" → update buyerRequirement.budget, not create a note.',
      mcp: 'Update a lead. Include leadId.',
    },
    handler: 'updateLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead to update (e.g., "lead-abc123").' },
      { name: 'status', type: 'string', required: false, enum: ['new', 'contacted', 'qualified', 'negotiating', 'lost'], description: 'New status.' },
      { name: 'priority', type: 'string', required: false, enum: ['low', 'medium', 'high'], description: 'New priority.' },
      { name: 'score', type: 'string', required: false, description: 'Lead score (e.g., "85", "high").' },
      { name: 'assignedTo', type: 'string', required: false, description: 'Agent name to assign the lead to (e.g., "Aman").' },
      { name: 'notes', type: 'string', required: false, description: 'Free-text notes to add to the lead. Use for unstructured updates only.' },
    ],
  },
  {
    name: 'delete_lead',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete a lead. Triggers: "delete lead", "remove lead", "delete lead L123". IMPORTANT: Always ask for confirmation before calling this tool. Example: User says "delete Faizan" → ask "Are you sure you want to delete Faizan\'s lead? This cannot be undone."',
      mcp: 'Delete a lead. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead to delete.' },
    ],
  },
  {
    name: 'convert_lead',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Convert a lead into a buyer, seller, tenant, or owner record. Use this when the user asks to convert or promote a lead. Triggers: "convert lead", "make buyer from lead", "convert to owner", "promote lead", "lead ko buyer banao". Required: leadId. Optional: purchaseDetails, leaseDetails, kycDetails, createPropertyListing.',
      mcp: 'Convert a lead to buyer/seller/tenant/owner. Requires leadId. Optional purchaseDetails, leaseDetails, kycDetails, createPropertyListing.',
    },
    handler: 'convertLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead to convert.' },
      { name: 'purchaseDetails', type: 'object', required: false, description: 'Optional purchase details for buyer conversion.' },
      { name: 'leaseDetails', type: 'object', required: false, description: 'Optional lease details for tenant conversion.' },
      { name: 'kycDetails', type: 'object', required: false, description: 'Optional KYC fields.' },
      { name: 'existingContactId', type: 'string', required: false, description: 'Optional existing contact to link.' },
      { name: 'createPropertyListing', type: 'boolean', required: false, description: 'For seller leads, auto-create for-sale property (default true).' },
    ],
  },
  {
    name: 'create_lead_note',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Add a free-text note to a lead. Use this when the user asks to add a note, comment, or remark to a lead (NOT for structured updates like budget/BHK — use update_lead for those). Triggers: "add note to lead", "note on lead L123", "comment on lead", "lead pe note add karo", "remark". Required: leadId, content.',
      mcp: 'Add a note to a lead. Requires leadId and content.',
    },
    handler: 'createLeadNote',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead.' },
      { name: 'content', type: 'string', required: true, description: 'The note content.' },
      { name: 'createdBy', type: 'string', required: false, description: 'Name of the person creating the note.' },
    ],
  },
  {
    name: 'get_lead_notes',
    category: 'lead',
    readOnly: true,
    descriptions: {
      internal: 'Get all notes for a lead. Use this when the user asks to see notes, comments, or remarks on a specific lead. Triggers: "show notes for lead", "lead ke notes", "comments on lead L123", "lead ka history". Required: leadId.',
      mcp: 'Get all notes for a lead. Requires leadId.',
    },
    handler: 'getLeadNotes',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // CONTACT OPS (9 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_contact',
    category: 'contact',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new contact. Triggers: "create contact", "add contact", "new contact Faizan", "contact Raj with phone 9876543210". Required: name. Optional: phone, email, role (owner|buyer|seller|tenant).',
      mcp: 'Create a contact. Requires name.',
    },
    handler: 'createContact',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Contact name.' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number.' },
      { name: 'email', type: 'string', required: false, description: 'Email address.' },
      { name: 'role', type: 'string', required: false, enum: ['owner', 'buyer', 'seller', 'tenant'], description: 'Contact role.' },
    ],
  },
  {
    name: 'get_contact',
    category: 'contact',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single contact by contactId. Use this AFTER search_contacts when you have a specific contactId and need full details. Triggers: "contact details", "show contact C123", "tell me about this contact", "iska details". Required: contactId. Do NOT use for searching — use search_contacts for that.',
      mcp: 'Get a contact by contactId. Use after search_contacts.',
    },
    handler: 'getContact',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
    ],
  },
  {
    name: 'search_contacts',
    category: 'contact',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, or show contacts. Triggers: "contacts dikhao", "show contacts", "contacts batao", "contacts with role owner", "find contact Faizan", "active contacts". Extract parameters: query (name/phone), role (owner|buyer|seller|tenant), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Search contacts by role or status.',
    },
    handler: 'getContacts',
    parameters: [
      { name: 'role', type: 'string', required: false, enum: ['owner', 'buyer', 'seller', 'tenant'], description: 'Filter by role.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'Filter by status.' },
      { name: 'query', type: 'string', required: false, description: 'Search by name or phone.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_contact',
    category: 'contact',
    readOnly: false,
    descriptions: {
      internal: 'Update a contact\'s name, phone, email, or status. Use this when the user asks to edit or change contact info. Triggers: "update contact", "change contact phone", "edit contact", "contact ka phone update karo", "mark contact inactive". Required: contactId. Provide only the fields to update.',
      mcp: 'Update a contact. Requires contactId.',
    },
    handler: 'updateContact',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
      { name: 'name', type: 'string', required: false, description: 'New name.' },
      { name: 'phone', type: 'string', required: false, description: 'New phone.' },
      { name: 'email', type: 'string', required: false, description: 'New email.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'New status.' },
    ],
  },
  {
    name: 'delete_contact',
    category: 'contact',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete a contact. Triggers: "delete contact", "remove contact". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete a contact. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteContact',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact to delete.' },
    ],
  },
  {
    name: 'update_contact_role',
    category: 'contact',
    readOnly: false,
    descriptions: {
      internal: 'Add or remove a role (owner|buyer|seller|tenant) on a unified contact. Use this when the user asks to change a contact\'s role or add them as an owner/buyer/seller/tenant. Triggers: "make contact an owner", "add buyer role", "remove seller role", "contact ko owner banao", "add as tenant". Required: contactId, role, enabled (true to add, false to remove).',
      mcp: 'Add or remove a role on a unified contact. Requires contactId, role, enabled.',
    },
    handler: 'updateContactRole',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
      { name: 'role', type: 'string', required: true, enum: ['owner', 'buyer', 'seller', 'tenant'], description: 'The role to add or remove.' },
      { name: 'enabled', type: 'boolean', required: true, description: 'true to add the role, false to remove it.' },
      { name: 'profileData', type: 'object', required: false, description: 'Optional role-specific profile data.' },
    ],
  },
  {
    name: 'create_contact_note',
    category: 'contact',
    readOnly: false,
    descriptions: {
      internal: 'Add a free-text note to a contact. Triggers: "add note to contact", "note on contact C123", "comment on contact", "contact pe note add karo". Required: contactId, content.',
      mcp: 'Add a note to a contact. Requires contactId and content.',
    },
    handler: 'createContactNote',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
      { name: 'content', type: 'string', required: true, description: 'The note content.' },
      { name: 'createdBy', type: 'string', required: false, description: 'Name of the person creating the note.' },
    ],
  },
  {
    name: 'get_contact_notes',
    category: 'contact',
    readOnly: true,
    descriptions: {
      internal: 'Get all notes for a contact. Triggers: "show notes for contact", "contact ke notes", "comments on contact C123". Required: contactId.',
      mcp: 'Get all notes for a contact. Requires contactId.',
    },
    handler: 'getContactNotes',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
    ],
  },
  {
    name: 'find_contact_by_phone',
    category: 'contact',
    readOnly: true,
    descriptions: {
      internal: 'Find a contact by phone number. Use this BEFORE creating a new contact to avoid duplicates, or when the user asks to find someone by phone. Triggers: "find contact by phone", "is number ka contact hai?", "check phone 9876543210", "duplicate check". Required: phone. NOTE: Use get_owner_by_phone or get_tenant_by_phone if you specifically need an owner or tenant.',
      mcp: 'Find a contact by phone number. Requires phone.',
    },
    handler: 'findContactByPhone',
    parameters: [
      { name: 'phone', type: 'string', required: true, description: 'Phone number to search for.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // PROPERTY OPS (9 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_property',
    category: 'property',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new property. Triggers: "create property", "add property", "new apartment in Bandra", "property 3BHK in Andheri". Required: title, propertyType (apartment|house|villa|office|land). Optional: city, area, ownerId.',
      mcp: 'Create a property. Requires title and propertyType.',
    },
    handler: 'createProperty',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Property title.' },
      { name: 'propertyType', type: 'string', required: true, enum: ['apartment', 'house', 'villa', 'office', 'land'], description: 'Type of property.' },
      { name: 'city', type: 'string', required: false, description: 'City where the property is located.' },
      { name: 'area', type: 'string', required: false, description: 'Area/locality of the property.' },
      { name: 'ownerId', type: 'string', required: false, description: 'ID of the owner.' },
    ],
  },
  {
    name: 'get_property',
    category: 'property',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single property by propertyId. Use this AFTER search_properties when you have a specific propertyId. Triggers: "property details", "show property P123", "tell me about this property", "iska full details". Required: propertyId. Do NOT use for searching — use search_properties for that.',
      mcp: 'Get a property by propertyId. Use after search_properties.',
    },
    handler: 'getProperty',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property.' },
    ],
  },
  {
    name: 'search_properties',
    category: 'property',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, or show properties. Triggers: "properties dikhao", "show properties", "properties in Bandra", "3BHK apartments", "furnished properties", "properties above 1 crore", "properties owned by Raj". Extract parameters: query (title/area), propertyType (apartment|house|villa|office|land), city, bhk (1-5), furnishing (furnished|semi-furnished|unfurnished), status (active|inactive|sold), minPrice/maxPrice (in rupees), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Search properties by status, city, or propertyType.',
    },
    handler: 'searchProperties',
    parameters: [
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive', 'sold'], description: 'Filter by status.' },
      { name: 'city', type: 'string', required: false, description: 'Filter by city.' },
      { name: 'propertyType', type: 'string', required: false, enum: ['apartment', 'house', 'villa', 'office', 'land'], description: 'Filter by property type.' },
      { name: 'query', type: 'string', required: false, description: 'Search by title or area.' },
      { name: 'ownerId', type: 'string', required: false, description: 'Filter by owner ID.' },
      { name: 'bhk', type: 'string', required: false, description: 'Filter by BHK (1-5).' },
      { name: 'furnishing', type: 'string', required: false, enum: ['furnished', 'semi-furnished', 'unfurnished'], description: 'Filter by furnishing.' },
      { name: 'minPrice', type: 'number', required: false, description: 'Minimum price in rupees.' },
      { name: 'maxPrice', type: 'number', required: false, description: 'Maximum price in rupees.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_property',
    category: 'property',
    readOnly: false,
    descriptions: {
      internal: 'Update a property\'s title, status, monthly rent, or sale price. Triggers: "update property", "change rent", "mark property sold", "edit property title", "property ka rent update karo". Required: propertyId. Provide only the fields to update.',
      mcp: 'Update a property. Requires propertyId.',
    },
    handler: 'updateProperty',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property.' },
      { name: 'title', type: 'string', required: false, description: 'New title.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive', 'sold'], description: 'New status.' },
      { name: 'monthlyRent', type: 'number', required: false, description: 'Monthly rent in rupees.' },
      { name: 'salePrice', type: 'number', required: false, description: 'Sale price in rupees.' },
    ],
  },
  {
    name: 'delete_property',
    category: 'property',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete a property. Triggers: "delete property", "remove property". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete a property. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteProperty',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property to delete.' },
    ],
  },
  {
    name: 'get_property_documents',
    category: 'property',
    readOnly: true,
    descriptions: {
      internal: 'Get all documents for a property. Triggers: "show documents for property", "property ke documents", "papers for P123", "property ka file". Required: propertyId.',
      mcp: 'Get all documents for a property. Requires propertyId.',
    },
    handler: 'getPropertyDocuments',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property.' },
    ],
  },
  {
    name: 'create_property_document',
    category: 'property',
    readOnly: false,
    descriptions: {
      internal: 'Add a document (deed, agreement, etc.) to a property. Triggers: "add document to property", "upload deed for P123", "property pe document add karo", "attach agreement". Required: propertyId, title, url. Optional: documentType.',
      mcp: 'Add a document to a property. Requires propertyId, title, url.',
    },
    handler: 'createPropertyDocument',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property.' },
      { name: 'title', type: 'string', required: true, description: 'Document title.' },
      { name: 'url', type: 'string', required: true, description: 'Document URL or S3 key.' },
      { name: 'documentType', type: 'string', required: false, description: 'Type of document (e.g., "deed", "agreement").' },
    ],
  },
  {
    name: 'delete_property_document',
    category: 'property',
    readOnly: false,
    descriptions: {
      internal: 'Delete a property document. Triggers: "delete document", "remove document from property", "document hatao". IMPORTANT: Always ask for confirmation before calling. Required: propertyId, documentId.',
      mcp: 'Delete a property document. Confirm with user first. Requires propertyId, documentId.',
    },
    handler: 'deletePropertyDocument',
    parameters: [
      { name: 'propertyId', type: 'string', required: true, description: 'The unique ID of the property.' },
      { name: 'documentId', type: 'string', required: true, description: 'The unique ID of the document to delete.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // TENANT OPS (8 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_tenant',
    category: 'tenant',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new tenant/customer. Triggers: "create tenant", "add tenant", "new tenant Sarah", "customer Priya with phone 9876543210". Required: name. Optional: phone, email.',
      mcp: 'Create a tenant. Requires name.',
    },
    handler: 'createCustomer',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Tenant name.' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number.' },
      { name: 'email', type: 'string', required: false, description: 'Email address.' },
    ],
  },
  {
    name: 'get_tenant',
    category: 'tenant',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single tenant by tenantRecordId. Use this AFTER search_tenants when you have a specific tenantRecordId. Triggers: "tenant details", "show tenant T123", "tell me about this tenant", "iska details". Required: tenantRecordId. Do NOT use for searching — use search_tenants for that.',
      mcp: 'Get a tenant by tenantRecordId. Use after search_tenants.',
    },
    handler: 'getCustomer',
    parameters: [
      { name: 'tenantRecordId', type: 'string', required: true, description: 'The unique ID of the tenant.' },
    ],
  },
  {
    name: 'search_tenants',
    category: 'tenant',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, or show tenants/customers. Triggers: "tenants dikhao", "show tenants", "customers batao", "tenants with budget under 50k", "find tenant Sarah", "tenant in Powai". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (monthly rent in rupees), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Search tenants by status.',
    },
    handler: 'getCustomers',
    parameters: [
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'Filter by status.' },
      { name: 'query', type: 'string', required: false, description: 'Search by name or phone.' },
      { name: 'minBudget', type: 'number', required: false, description: 'Minimum budget in rupees.' },
      { name: 'maxBudget', type: 'number', required: false, description: 'Maximum budget in rupees.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_tenant',
    category: 'tenant',
    readOnly: false,
    descriptions: {
      internal: 'Update a tenant\'s name, phone, or status. Triggers: "update tenant", "change tenant phone", "edit tenant", "tenant ka phone update karo", "mark tenant inactive". Required: tenantRecordId. Provide only the fields to update.',
      mcp: 'Update a tenant. Requires tenantRecordId.',
    },
    handler: 'updateCustomer',
    parameters: [
      { name: 'tenantRecordId', type: 'string', required: true, description: 'The unique ID of the tenant.' },
      { name: 'name', type: 'string', required: false, description: 'New name.' },
      { name: 'phone', type: 'string', required: false, description: 'New phone.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'New status.' },
    ],
  },
  {
    name: 'delete_tenant',
    category: 'tenant',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete a tenant. Triggers: "delete tenant", "remove tenant". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete a tenant. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteCustomer',
    parameters: [
      { name: 'tenantRecordId', type: 'string', required: true, description: 'The unique ID of the tenant to delete.' },
    ],
  },
  {
    name: 'create_tenant_note',
    category: 'tenant',
    readOnly: false,
    descriptions: {
      internal: 'Add a free-text note to a tenant. Triggers: "add note to tenant", "note on tenant T123", "comment on tenant", "tenant pe note add karo". Required: tenantRecordId, content.',
      mcp: 'Add a note to a tenant. Requires tenantRecordId and content.',
    },
    handler: 'createCustomerNote',
    parameters: [
      { name: 'tenantRecordId', type: 'string', required: true, description: 'The unique ID of the tenant.' },
      { name: 'content', type: 'string', required: true, description: 'The note content.' },
      { name: 'createdBy', type: 'string', required: false, description: 'Name of the person creating the note.' },
    ],
  },
  {
    name: 'get_tenant_notes',
    category: 'tenant',
    readOnly: true,
    descriptions: {
      internal: 'Get all notes for a tenant. Triggers: "show notes for tenant", "tenant ke notes", "comments on tenant T123". Required: tenantRecordId.',
      mcp: 'Get all notes for a tenant. Requires tenantRecordId.',
    },
    handler: 'getCustomerNotes',
    parameters: [
      { name: 'tenantRecordId', type: 'string', required: true, description: 'The unique ID of the tenant.' },
    ],
  },
  {
    name: 'get_tenant_by_phone',
    category: 'tenant',
    readOnly: true,
    descriptions: {
      internal: 'Find a tenant by phone number. Use this BEFORE creating a new tenant to avoid duplicates, or when the user asks to find a tenant by phone. Triggers: "find tenant by phone", "is number ka tenant hai?", "check tenant phone 9876543210". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.',
      mcp: 'Find a tenant by phone number. Requires phone.',
    },
    handler: 'getCustomerByPhone',
    parameters: [
      { name: 'phone', type: 'string', required: true, description: 'Phone number to search for.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // OWNER OPS (8 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_owner',
    category: 'owner',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new owner. Triggers: "create owner", "add owner", "new owner Raj", "owner Imran with phone 9876543210". Required: name. Optional: phone, email.',
      mcp: 'Create an owner. Requires name.',
    },
    handler: 'createOwner',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Owner name.' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number.' },
      { name: 'email', type: 'string', required: false, description: 'Email address.' },
    ],
  },
  {
    name: 'get_owner',
    category: 'owner',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single owner by ownerId. Use this AFTER get_owners (search) when you have a specific ownerId. Triggers: "owner details", "show owner O123", "tell me about this owner", "iska details". Required: ownerId. Do NOT use for listing — use get_owners for that.',
      mcp: 'Get an owner by ownerId. Use after get_owners.',
    },
    handler: 'getOwner',
    parameters: [
      { name: 'ownerId', type: 'string', required: true, description: 'The unique ID of the owner.' },
    ],
  },
  {
    name: 'get_owners',
    category: 'owner',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, or show owners. Triggers: "owners dikhao", "show owners", "list all owners", "owners batao", "find owner Raj", "owner with phone 9876543210". Extract parameters: query (name/phone), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'List owners with optional status filter.',
    },
    handler: 'getOwners',
    parameters: [
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'Filter by status.' },
      { name: 'query', type: 'string', required: false, description: 'Search by name or phone.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_owner',
    category: 'owner',
    readOnly: false,
    descriptions: {
      internal: 'Update an owner\'s name, phone, or status. Triggers: "update owner", "change owner phone", "edit owner", "owner ka phone update karo", "mark owner inactive". Required: ownerId. Provide only the fields to update.',
      mcp: 'Update an owner. Requires ownerId.',
    },
    handler: 'updateOwner',
    parameters: [
      { name: 'ownerId', type: 'string', required: true, description: 'The unique ID of the owner.' },
      { name: 'name', type: 'string', required: false, description: 'New name.' },
      { name: 'phone', type: 'string', required: false, description: 'New phone.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'New status.' },
    ],
  },
  {
    name: 'delete_owner',
    category: 'owner',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete an owner. Triggers: "delete owner", "remove owner". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete an owner. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteOwner',
    parameters: [
      { name: 'ownerId', type: 'string', required: true, description: 'The unique ID of the owner to delete.' },
    ],
  },
  {
    name: 'create_owner_note',
    category: 'owner',
    readOnly: false,
    descriptions: {
      internal: 'Add a free-text note to an owner. Triggers: "add note to owner", "note on owner O123", "comment on owner", "owner pe note add karo". Required: ownerId, content.',
      mcp: 'Add a note to an owner. Requires ownerId and content.',
    },
    handler: 'createOwnerNote',
    parameters: [
      { name: 'ownerId', type: 'string', required: true, description: 'The unique ID of the owner.' },
      { name: 'content', type: 'string', required: true, description: 'The note content.' },
      { name: 'createdBy', type: 'string', required: false, description: 'Name of the person creating the note.' },
    ],
  },
  {
    name: 'get_owner_notes',
    category: 'owner',
    readOnly: true,
    descriptions: {
      internal: 'Get all notes for an owner. Triggers: "show notes for owner", "owner ke notes", "comments on owner O123". Required: ownerId.',
      mcp: 'Get all notes for an owner. Requires ownerId.',
    },
    handler: 'getOwnerNotes',
    parameters: [
      { name: 'ownerId', type: 'string', required: true, description: 'The unique ID of the owner.' },
    ],
  },
  {
    name: 'get_owner_by_phone',
    category: 'owner',
    readOnly: true,
    descriptions: {
      internal: 'Find an owner by phone number. Use this BEFORE creating a new owner to avoid duplicates, or when the user asks to find an owner by phone. Triggers: "find owner by phone", "is number ka owner hai?", "check owner phone 9876543210". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.',
      mcp: 'Find an owner by phone number. Requires phone.',
    },
    handler: 'getOwnerByPhone',
    parameters: [
      { name: 'phone', type: 'string', required: true, description: 'Phone number to search for.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // BUYER OPS (7 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_buyer',
    category: 'buyer',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new buyer. Triggers: "create buyer", "add buyer", "new buyer Rohan", "buyer Priya with budget 1 crore". Required: name. Optional: phone, email, budget, propertyType, bhk, priority.',
      mcp: 'Create a buyer. Requires name.',
    },
    handler: 'createBuyer',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Buyer name.' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number.' },
      { name: 'email', type: 'string', required: false, description: 'Email address.' },
      { name: 'budget', type: 'number', required: false, description: 'Budget in rupees.' },
      { name: 'propertyType', type: 'string', required: false, description: 'Preferred property type.' },
      { name: 'bhk', type: 'number', required: false, description: 'Preferred BHK.' },
      { name: 'priority', type: 'string', required: false, enum: ['low', 'medium', 'high'], description: 'Priority level.' },
    ],
  },
  {
    name: 'get_buyer',
    category: 'buyer',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single buyer by buyerId. Use this AFTER search_buyers when you have a specific buyerId. Triggers: "buyer details", "show buyer B123", "tell me about this buyer", "iska details". Required: buyerId. Do NOT use for searching — use search_buyers for that.',
      mcp: 'Get a buyer by buyerId. Use after search_buyers.',
    },
    handler: 'getBuyer',
    parameters: [
      { name: 'buyerId', type: 'string', required: true, description: 'The unique ID of the buyer.' },
    ],
  },
  {
    name: 'search_buyers',
    category: 'buyer',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to list, search, or show buyers. Triggers: "buyers dikhao", "show buyers", "buyers batao", "buyers with budget above 1 crore", "find buyer Rohan", "high priority buyers". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (in rupees), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Search buyers by query, status, or filters.',
    },
    handler: 'searchBuyers',
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Search by name or phone.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'Filter by status.' },
      { name: 'minBudget', type: 'number', required: false, description: 'Minimum budget in rupees.' },
      { name: 'maxBudget', type: 'number', required: false, description: 'Maximum budget in rupees.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_buyer',
    category: 'buyer',
    readOnly: false,
    descriptions: {
      internal: 'Update a buyer\'s budget, status, or priority. Triggers: "update buyer", "change buyer budget", "edit buyer", "buyer ka budget update karo", "mark buyer inactive", "change priority". Required: buyerId. Provide only the fields to update.',
      mcp: 'Update a buyer. Requires buyerId.',
    },
    handler: 'updateBuyer',
    parameters: [
      { name: 'buyerId', type: 'string', required: true, description: 'The unique ID of the buyer.' },
      { name: 'budget', type: 'number', required: false, description: 'New budget in rupees.' },
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'], description: 'New status.' },
      { name: 'priority', type: 'string', required: false, enum: ['low', 'medium', 'high'], description: 'New priority.' },
    ],
  },
  {
    name: 'delete_buyer',
    category: 'buyer',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete a buyer. Triggers: "delete buyer", "remove buyer". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete a buyer. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteBuyer',
    parameters: [
      { name: 'buyerId', type: 'string', required: true, description: 'The unique ID of the buyer to delete.' },
    ],
  },
  {
    name: 'create_buyer_note',
    category: 'buyer',
    readOnly: false,
    descriptions: {
      internal: 'Add a free-text note to a buyer. Triggers: "add note to buyer", "note on buyer B123", "comment on buyer", "buyer pe note add karo". Required: buyerId, content.',
      mcp: 'Add a note to a buyer. Requires buyerId and content.',
    },
    handler: 'createBuyerNote',
    parameters: [
      { name: 'buyerId', type: 'string', required: true, description: 'The unique ID of the buyer.' },
      { name: 'content', type: 'string', required: true, description: 'The note content.' },
      { name: 'createdBy', type: 'string', required: false, description: 'Name of the person creating the note.' },
    ],
  },
  {
    name: 'get_buyer_notes',
    category: 'buyer',
    readOnly: true,
    descriptions: {
      internal: 'Get all notes for a buyer. Triggers: "show notes for buyer", "buyer ke notes", "comments on buyer B123". Required: buyerId.',
      mcp: 'Get all notes for a buyer. Requires buyerId.',
    },
    handler: 'getBuyerNotes',
    parameters: [
      { name: 'buyerId', type: 'string', required: true, description: 'The unique ID of the buyer.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // MEETING OPS (5 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_meeting',
    category: 'meeting',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create or schedule a meeting. Triggers: "create meeting", "schedule meeting", "meeting with Rohan tomorrow", "meeting with owner Raj next week". Required: title, scheduledDate. Optional: relatedEntityType, relatedEntityId, notes.',
      mcp: 'Create a meeting. Requires title and scheduledDate.',
    },
    handler: 'createMeeting',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Meeting title.' },
      { name: 'scheduledDate', type: 'string', required: true, description: 'Meeting date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).' },
      { name: 'relatedEntityType', type: 'string', required: false, enum: ['lead', 'buyer', 'owner', 'tenant', 'contact'], description: 'Type of entity the meeting is related to.' },
      { name: 'relatedEntityId', type: 'string', required: false, description: 'ID of the related entity.' },
      { name: 'notes', type: 'string', required: false, description: 'Meeting notes or description.' },
    ],
  },
  {
    name: 'get_meeting',
    category: 'meeting',
    readOnly: true,
    descriptions: {
      internal: 'Get full details of a single meeting by meetingId. Use this AFTER get_upcoming_meetings when you have a specific meetingId. Triggers: "meeting details", "show meeting M123", "tell me about this meeting". Required: meetingId. Do NOT use for listing — use get_upcoming_meetings for that.',
      mcp: 'Get a meeting by meetingId. Use after get_upcoming_meetings.',
    },
    handler: 'getMeeting',
    parameters: [
      { name: 'meetingId', type: 'string', required: true, description: 'The unique ID of the meeting.' },
    ],
  },
  {
    name: 'get_upcoming_meetings',
    category: 'meeting',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks to see upcoming meetings. Triggers: "upcoming meetings", "meetings dikhao", "meetings for today", "meetings for next 7 days", "my meetings". Extract parameters: days (number of days to look ahead, default 7), limit (max results), responseMode (summary|compact|details|full).',
      mcp: 'Get upcoming meetings for the next N days.',
    },
    handler: 'getUpcomingMeetings',
    parameters: [
      { name: 'days', type: 'number', required: false, description: 'Number of days to look ahead (default 7).' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of results.' },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Response detail level.' },
    ],
  },
  {
    name: 'update_meeting',
    category: 'meeting',
    readOnly: false,
    descriptions: {
      internal: 'Update a meeting\'s title, date, notes, or status. Triggers: "update meeting", "reschedule meeting", "cancel meeting", "meeting ka time change karo", "mark meeting completed". Required: meetingId. Provide only the fields to update.',
      mcp: 'Update a meeting. Requires meetingId.',
    },
    handler: 'updateMeeting',
    parameters: [
      { name: 'meetingId', type: 'string', required: true, description: 'The unique ID of the meeting.' },
      { name: 'title', type: 'string', required: false, description: 'New title.' },
      { name: 'scheduledDate', type: 'string', required: false, description: 'New date.' },
      { name: 'notes', type: 'string', required: false, description: 'New notes.' },
      { name: 'status', type: 'string', required: false, enum: ['scheduled', 'completed', 'cancelled'], description: 'New status.' },
    ],
  },
  {
    name: 'delete_meeting',
    category: 'meeting',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to delete or cancel a meeting. Triggers: "delete meeting", "cancel meeting", "remove meeting". IMPORTANT: Always ask for confirmation before calling this tool.',
      mcp: 'Delete a meeting. IMPORTANT: Always ask for confirmation before calling this tool.',
    },
    handler: 'deleteMeeting',
    parameters: [
      { name: 'meetingId', type: 'string', required: true, description: 'The unique ID of the meeting to delete.' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════════
  // METRICS OPS (1 tool)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'get_crm_metrics',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks for CRM metrics, statistics, or a summary. Triggers: "metrics dikhao", "show metrics", "CRM summary", "how many leads", "pipeline stats", "statistics batao". Returns: total leads, leads by status, leads by type, total properties, total owners, total tenants, total buyers, total meetings, etc.',
      mcp: 'Get CRM metrics and statistics.',
    },
    handler: 'getCRMMetrics',
    parameters: [],
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// CONVERTER FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Convert neutral tool definitions to MCP inputSchema format
 */
function convertToMcpTools(toolDefs: ToolDefinition[]): McpTool[] {
  return toolDefs.map(tool => ({
    name: tool.name,
    description: tool.descriptions.mcp,
    inputSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        tool.parameters.map(p => [
          p.name,
          {
            type: p.type,
            description: p.description,
            ...(p.enum && { enum: p.enum }),
            ...(p.default !== undefined && { default: p.default }),
          },
        ])
      ),
      required: tool.parameters.filter(p => p.required).map(p => p.name),
    },
  }));
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

/** MCP tools array (auto-generated from toolDefinitions) */
export const TOOLS: McpTool[] = convertToMcpTools(toolDefinitions);

/** List of allowed tool names */
export const ALLOWED_TOOL_NAMES: string[] = toolDefinitions.map(t => t.name);

// ════════════════════════════════════════════════════════════════════════════════
// TOOL → SCOPE MAPPING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Map each tool name to the OAuth scope required to invoke it.
 * Tools not listed here require the wildcard 'crm' scope (or no scope check
 * if the caller is the internal mcp-agent service token).
 *
 * Convention:
 *   create_, update_, delete_, convert_ prefix -> write_<entity>
 *   get_, search_ prefix -> read_<entity>
 */
function inferScope(toolName: string): string | null {
  // Lead tools
  if (toolName.includes('lead')) {
    return /^(create|update|delete|convert)_/.test(toolName) ? 'write_leads' : 'read_leads';
  }
  // Contact tools
  if (toolName.includes('contact')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_contacts' : 'read_contacts';
  }
  // Property tools
  if (toolName.includes('property')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_properties' : 'read_properties';
  }
  // Tenant tools
  if (toolName.includes('tenant')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_tenants' : 'read_tenants';
  }
  // Owner tools
  if (toolName.includes('owner')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_owners' : 'read_owners';
  }
  // Buyer tools
  if (toolName.includes('buyer')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_buyers' : 'read_buyers';
  }
  // Meeting tools
  if (toolName.includes('meeting')) {
    return /^(create|update|delete)_/.test(toolName) ? 'write_meetings' : 'read_meetings';
  }
  // Metrics
  if (toolName.includes('metrics')) {
    return 'read_metrics';
  }
  return null;
}

/** Map of tool name → required OAuth scope (null means no scope restriction) */
export const TOOL_SCOPES: Record<string, string | null> = Object.fromEntries(
  toolDefinitions.map(t => [t.name, inferScope(t.name)])
);
