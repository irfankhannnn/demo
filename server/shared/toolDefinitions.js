/**
 * RealtyFlow MCP — Single Source of Truth for Tool Definitions
 * 
 * This file defines all 54 CRM tools in a neutral format that can be converted to:
 * - TOOL_SCHEMAS (for WhatsApp SyncBot with Hinglish triggers)
 * - MCP inputSchema (for Claude Desktop, ChatGPT, Cursor, etc.)
 * 
 * Each tool has:
 * - name: tool identifier (e.g., 'search_leads')
 * - category: entity type (lead, contact, property, owner, tenant, buyer, meeting, metrics)
 * - readOnly: true if read-only (search, get), false if write (create, update, delete)
 * - descriptions: { internal: Hinglish for SyncBot, mcp: English for AI apps }
 * - handler: function name in crmDynamodbService.js (e.g., 'searchLeads')
 * - parameters: array of parameter definitions
 */

export const toolDefinitions = [
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
      internal: 'Get full details of a single lead by leadId.',
      mcp: 'Get a single lead by leadId.',
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
      internal: 'Convert a lead to a buyer, tenant, or owner record.',
      mcp: 'Convert a lead to buyer/tenant/owner.',
    },
    handler: 'convertLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead to convert.' },
    ],
  },
  {
    name: 'create_lead_note',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Add a note to a lead.',
      mcp: 'Add a note to a lead.',
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
      internal: 'Get all notes for a lead.',
      mcp: 'Get all notes for a lead.',
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
      internal: 'Get full details of a contact by contactId.',
      mcp: 'Get a contact by contactId.',
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
      internal: 'Update a contact.',
      mcp: 'Update a contact.',
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
      internal: 'Add or remove a role (owner|buyer|seller|tenant) on a unified contact.',
      mcp: 'Add or remove a role on a unified contact.',
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
      internal: 'Add a note to a contact.',
      mcp: 'Add a note to a contact.',
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
      internal: 'Get all notes for a contact.',
      mcp: 'Get all notes for a contact.',
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
      internal: 'Find a contact by phone number.',
      mcp: 'Find a contact by phone number.',
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
      internal: 'Get full details of a property by propertyId.',
      mcp: 'Get a property by propertyId.',
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
      internal: 'Update a property.',
      mcp: 'Update a property.',
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
      internal: 'Get all documents for a property.',
      mcp: 'Get all documents for a property.',
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
      internal: 'Add a document to a property.',
      mcp: 'Add a document to a property.',
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
      internal: 'Delete a property document. Confirm with the user before executing.',
      mcp: 'Delete a property document. Confirm with the user before executing.',
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
      internal: 'Get full details of a tenant by tenantRecordId.',
      mcp: 'Get a tenant by tenantRecordId.',
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
      internal: 'Update a tenant.',
      mcp: 'Update a tenant.',
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
      internal: 'Add a note to a tenant.',
      mcp: 'Add a note to a tenant.',
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
      internal: 'Get all notes for a tenant.',
      mcp: 'Get all notes for a tenant.',
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
      internal: 'Find a tenant by phone number.',
      mcp: 'Find a tenant by phone number.',
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
      internal: 'Get full details of an owner by ownerId.',
      mcp: 'Get an owner by ownerId.',
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
      internal: 'Update an owner.',
      mcp: 'Update an owner.',
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
      internal: 'Add a note to an owner.',
      mcp: 'Add a note to an owner.',
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
      internal: 'Get all notes for an owner.',
      mcp: 'Get all notes for an owner.',
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
      internal: 'Find an owner by phone number.',
      mcp: 'Find an owner by phone number.',
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
      internal: 'Get full details of a buyer by buyerId.',
      mcp: 'Get a buyer by buyerId.',
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
      internal: 'Update a buyer.',
      mcp: 'Update a buyer.',
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
      internal: 'Add a note to a buyer.',
      mcp: 'Add a note to a buyer.',
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
      internal: 'Get all notes for a buyer.',
      mcp: 'Get all notes for a buyer.',
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
      internal: 'Get full details of a meeting by meetingId.',
      mcp: 'Get a meeting by meetingId.',
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
      internal: 'Update a meeting.',
      mcp: 'Update a meeting.',
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
// CONVERTER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Convert neutral tool definitions to TOOL_SCHEMAS format (for WhatsApp SyncBot)
 * @param {Array} toolDefs - Tool definitions from this file
 * @returns {Object} TOOL_SCHEMAS object
 */
export function convertToSkillSchemas(toolDefs) {
  const schemas = {};
  for (const tool of toolDefs) {
    schemas[tool.name] = {
      required: tool.parameters.filter(p => p.required).map(p => p.name),
      types: Object.fromEntries(
        tool.parameters.map(p => [p.name, p.type])
      ),
      description: tool.descriptions.internal,
      paramDescriptions: Object.fromEntries(
        tool.parameters.map(p => [p.name, p.description])
      ),
    };
  }
  return schemas;
}

/**
 * Convert neutral tool definitions to MCP inputSchema format
 * @param {Array} toolDefs - Tool definitions from this file
 * @returns {Array} MCP tools array
 */
export function convertToMcpTools(toolDefs) {
  return toolDefs.map(tool => ({
    name: tool.name,
    description: tool.descriptions.mcp,
    inputSchema: {
      type: 'object',
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

/**
 * Get handler function name for a tool
 * @param {string} toolName - Tool name (e.g., 'search_leads')
 * @returns {string|null} Handler function name or null if not found
 */
export function getHandler(toolName) {
  const tool = toolDefinitions.find(t => t.name === toolName);
  return tool?.handler || null;
}

/**
 * Validate that all tools have valid handlers in crmDynamodbService
 * @param {Object} crmService - crmDynamodbService module
 * @throws {Error} If a handler is missing
 */
export function validateToolDefinitions(crmService) {
  const missing = [];
  for (const tool of toolDefinitions) {
    if (typeof crmService[tool.handler] !== 'function') {
      missing.push(`${tool.name} → ${tool.handler}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing handlers in crmDynamodbService:\n${missing.join('\n')}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS FOR CONSUMERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * TOOL_SCHEMAS for skillInvoker.js (WhatsApp SyncBot)
 * Auto-generated from toolDefinitions
 */
export const TOOL_SCHEMAS = convertToSkillSchemas(toolDefinitions);

/**
 * TOOLS for mcp-server/tools.js (MCP clients)
 * Auto-generated from toolDefinitions
 */
export const TOOLS = convertToMcpTools(toolDefinitions);

/**
 * List of allowed tool names
 */
export const ALLOWED_TOOL_NAMES = toolDefinitions.map(t => t.name);

/**
 * Tool count
 */
export const TOOL_COUNT = toolDefinitions.length;
