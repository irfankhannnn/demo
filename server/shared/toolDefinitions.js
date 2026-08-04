/**
 * RealtyFlow MCP — Single Source of Truth for Tool Definitions
 * 
 * This file defines all CRM tools in a neutral format that can be converted to:
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
 * - parameters[].properties: nested fields for object-type parameters
 */

/** Nested requirement/property payloads for update_lead (partial updates merge server-side). */
const LEAD_UPDATE_NESTED_FIELDS = {
  buyerRequirement: {
    description: 'Buyer lead requirements (buyer leads only). Use for budget, BHK, area, etc.',
    properties: {
      budget: { type: 'number', description: 'Budget in rupees (e.g. 28000000 for 2.8Cr).' },
      preferredArea: { type: 'string', description: 'Preferred area or locality.' },
      bhk: { type: 'string', description: 'BHK (e.g. "2", "3").' },
      propertyType: { type: 'string', description: 'Property type (e.g. apartment, villa).' },
      propertySubType: { type: 'string', description: 'Property sub-type.' },
      furnishing: { type: 'string', description: 'Furnishing (furnished, semi-furnished, unfurnished).' },
      requirement: { type: 'string', description: 'Free-text requirement summary.' },
    },
  },
  sellerProperty: {
    description: 'Seller lead property details (seller leads only).',
    properties: {
      expectedPrice: { type: 'number', description: 'Expected sale price in rupees.' },
      area: { type: 'string', description: 'Area or locality.' },
      city: { type: 'string', description: 'City.' },
      propertyType: { type: 'string', description: 'Property type.' },
      propertySubType: { type: 'string', description: 'Property sub-type.' },
      bhk: { type: 'string', description: 'BHK.' },
      furnishing: { type: 'string', description: 'Furnishing.' },
      buildingName: { type: 'string', description: 'Building or society name.' },
      flatNumber: { type: 'string', description: 'Flat or unit number.' },
      floor: { type: 'string', description: 'Floor.' },
      carpetArea: { type: 'number', description: 'Carpet area in sq ft.' },
      address: { type: 'string', description: 'Full address.' },
      timelineValue: { type: 'number', description: 'Sale timeline value (e.g. 3).' },
      timelineUnit: { type: 'string', description: 'Sale timeline unit (e.g. months).' },
    },
  },
  ownerProperty: {
    description: 'Owner lead rental property details (owner leads only).',
    properties: {
      rentExpected: { type: 'number', description: 'Expected monthly rent in rupees.' },
      securityDeposit: { type: 'number', description: 'Security deposit in rupees.' },
      area: { type: 'string', description: 'Area or locality.' },
      city: { type: 'string', description: 'City.' },
      propertyType: { type: 'string', description: 'Property type.' },
      propertySubType: { type: 'string', description: 'Property sub-type.' },
      bhk: { type: 'string', description: 'BHK.' },
      furnishing: { type: 'string', description: 'Furnishing.' },
      buildingName: { type: 'string', description: 'Building or society name.' },
      flatNumber: { type: 'string', description: 'Flat or unit number.' },
      floor: { type: 'string', description: 'Floor.' },
      carpetArea: { type: 'number', description: 'Carpet area in sq ft.' },
      address: { type: 'string', description: 'Full address.' },
    },
  },
  tenantRequirement: {
    description: 'Tenant lead requirements (tenant leads only). Use for rent budget, BHK, area, etc.',
    properties: {
      budget: { type: 'number', description: 'Monthly rent budget in rupees.' },
      preferredArea: { type: 'string', description: 'Preferred area or locality.' },
      bhk: { type: 'string', description: 'BHK (e.g. "2", "3").' },
      propertyType: { type: 'string', description: 'Property type.' },
      propertySubType: { type: 'string', description: 'Property sub-type.' },
      furnishing: { type: 'string', description: 'Furnishing.' },
      requirement: { type: 'string', description: 'Free-text requirement summary.' },
    },
  },
};

/** Canonical property marketing statuses (crmDomainModel.PROPERTY_MARKETING_STATUSES + legacy aliases). */
const PROPERTY_STATUS_ENUM = ['not-listed', 'for-sale', 'for-rent', 'rented', 'sold', 'archived'];

export const toolDefinitions = [
  // ════════════════════════════════════════════════════════════════════════════════
  // LEAD OPS (8 tools)
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'create_lead',
    category: 'lead',
    readOnly: false,
    descriptions: {
      internal: 'Use this when the user asks to create a new lead. Triggers: "create lead", "add lead", "new buyer lead", "seller lead Raj", "tenant lead Sarah", "owner lead Imran". Required: name, leadType (buyer|seller|tenant|owner). Optional: phone, email, and type-specific nested objects (buyerRequirement, sellerProperty, ownerProperty, tenantRequirement).',
      mcp: 'Create a new CRM lead. Requires name and leadType (buyer|seller|tenant|owner). Optional: phone, email, priority, buyerRequirement, sellerProperty, ownerProperty, tenantRequirement.',
    },
    handler: 'createLead',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Full name of the lead (e.g., "Raj Sharma", "Faizan Khan").' },
      { name: 'leadType', type: 'string', required: true, enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Type of lead: "buyer", "seller", "tenant", or "owner".' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number (10 digits). Required before convert_lead.' },
      { name: 'email', type: 'string', required: false, description: 'Email address (e.g., "raj@example.com"). Optional.' },
      { name: 'buyerRequirement', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.buyerRequirement.description, properties: LEAD_UPDATE_NESTED_FIELDS.buyerRequirement.properties },
      { name: 'sellerProperty', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.sellerProperty.description, properties: LEAD_UPDATE_NESTED_FIELDS.sellerProperty.properties },
      { name: 'ownerProperty', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.ownerProperty.description, properties: LEAD_UPDATE_NESTED_FIELDS.ownerProperty.properties },
      { name: 'tenantRequirement', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.tenantRequirement.description, properties: LEAD_UPDATE_NESTED_FIELDS.tenantRequirement.properties },
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
      internal: 'Use this when the user asks to list, search, show, or find leads. Triggers: "leads dikhao", "show leads", "Kurla ke leads", "buyer leads", "hot leads", "new leads", "leads assigned to Aman", "high priority leads above 1 crore", "sari leads", "all leads". Pass filters only in parameters — layout is NOT your job. For default business rows omit listTemplate. When user asks for specific columns (e.g. name+phone+type only) set listTemplate "contact" OR responseFields "phone,leadType". System renders the list; reply empty or one short intro line. One search_leads call per request.',
      mcp: 'Search leads by query, status, leadType, or filters. Supports listTemplate for deterministic list layout.',
    },
    handler: 'searchLeads',
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Search by lead name, phone number, or area (e.g., "Kurla", "Faizan", "9876543210"). Leave empty to list all leads.' },
      { name: 'status', type: 'string', required: false, enum: ['new', 'contacted', 'qualified', 'negotiating', 'lost', 'converted'], description: 'Filter by lead status (lowercase). Use "converted" for already-converted leads; default lists exclude converted.' },
      { name: 'leadType', type: 'string', required: false, enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Filter by lead type. MUST be lowercase: "buyer", "seller", "tenant", or "owner". Leave empty for all types.' },
      { name: 'priority', type: 'string', required: false, enum: ['low', 'medium', 'high'], description: 'Filter by priority. MUST be lowercase: "low", "medium", or "high". Leave empty for all priorities.' },
      { name: 'assignedTo', type: 'string', required: false, description: 'Filter by agent name (e.g., "Aman"). Leave empty for all agents.' },
      { name: 'minBudget', type: 'number', required: false, description: 'Minimum budget in rupees (e.g., 8000000 for 80L). Leave empty for no minimum.' },
      { name: 'maxBudget', type: 'number', required: false, description: 'Maximum budget in rupees (e.g., 10000000 for 1Cr). Leave empty for no maximum.' },
      { name: 'sortBy', type: 'string', required: false, enum: ['recent_first', 'budget_desc', 'budget_asc', 'score_desc', 'name_asc'], description: 'Sort results by field. Leave empty for default order.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of leads to return (e.g., 10, 20). Leave empty for default.' },
      {
        name: 'listTemplate',
        type: 'string',
        required: false,
        enum: ['lead_card', 'contact', 'followup', 'assignment', 'name_only'],
        description: 'List layout preset. Default lead_card (type, area, requirement, budget). Use contact for name+phone+type dialing lists; followup for phone+last activity; assignment for owner+status. System renders — do not format in reply.',
      },
      {
        name: 'responseFields',
        type: 'string',
        required: false,
        description: 'Optional comma-separated field ids for custom columns: phone, leadType, status, area, requirement, budget, assignedTo, lastActivityAt, source, priority, email. Prefer listTemplate when a preset fits.',
      },
      { name: 'responseMode', type: 'string', required: false, enum: ['summary', 'compact', 'details', 'full'], description: 'Legacy: summary → names only. Prefer listTemplate. Default list uses lead_card.' },
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
      { name: 'buyerRequirement', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.buyerRequirement.description, properties: LEAD_UPDATE_NESTED_FIELDS.buyerRequirement.properties },
      { name: 'sellerProperty', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.sellerProperty.description, properties: LEAD_UPDATE_NESTED_FIELDS.sellerProperty.properties },
      { name: 'ownerProperty', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.ownerProperty.description, properties: LEAD_UPDATE_NESTED_FIELDS.ownerProperty.properties },
      { name: 'tenantRequirement', type: 'object', required: false, description: LEAD_UPDATE_NESTED_FIELDS.tenantRequirement.description, properties: LEAD_UPDATE_NESTED_FIELDS.tenantRequirement.properties },
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
      internal: 'Convert a lead into a buyer, seller, tenant, or owner record. REQUIRED: leadId and the lead must have a phone number on file. Use update_lead to add phone first if missing. If you pass purchaseDetails or leaseDetails, propertyId inside that object is REQUIRED. Triggers: "convert lead", "make buyer from lead", "lead ko buyer banao". Do NOT use update_lead with status converted.',
      mcp: 'Convert a lead to buyer/seller/tenant/owner. Requires leadId and lead phone. purchaseDetails.propertyId required when purchaseDetails is sent; same for leaseDetails.',
    },
    handler: 'convertLead',
    parameters: [
      { name: 'leadId', type: 'string', required: true, description: 'The unique ID of the lead to convert.' },
      { name: 'purchaseDetails', type: 'object', required: false, description: 'Buyer conversion only. If provided, must include propertyId. Optional: saleAmount, purchaseDate, registrationNumber, notes.' },
      { name: 'leaseDetails', type: 'object', required: false, description: 'Tenant conversion only. If provided, must include propertyId. Optional: monthlyRent, leaseStartDate, securityDeposit.' },
      { name: 'kycDetails', type: 'object', required: false, description: 'Optional KYC fields (panNumber, aadharNumber).' },
      { name: 'existingContactId', type: 'string', required: false, description: 'Optional existing contact to link when converting.' },
      { name: 'createPropertyListing', type: 'boolean', required: false, description: 'For seller leads, whether to auto-create a for-sale property (default true).' },
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
      internal: 'Update a contact\'s name, phone, or email. Use this when the user asks to edit or change contact info. Triggers: "update contact", "change contact phone", "edit contact", "contact ka phone update karo". Required: contactId. Provide only the fields to update.',
      mcp: 'Update a contact. Requires contactId.',
    },
    handler: 'updateContact',
    parameters: [
      { name: 'contactId', type: 'string', required: true, description: 'The unique ID of the contact.' },
      { name: 'name', type: 'string', required: false, description: 'New name.' },
      { name: 'phone', type: 'string', required: false, description: 'New phone.' },
      { name: 'email', type: 'string', required: false, description: 'New email.' },
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
      internal: 'Use this when the user asks to list, search, or show properties. Triggers: "for-sale properties", "rent properties", "properties dikhao", "3BHK in Bandra". Status values: not-listed, for-sale, for-rent, rented, sold, archived (lowercase).',
      mcp: 'Search properties by status, city, or propertyType. Status: not-listed|for-sale|for-rent|rented|sold|archived.',
    },
    handler: 'searchProperties',
    parameters: [
      { name: 'status', type: 'string', required: false, enum: PROPERTY_STATUS_ENUM, description: 'Filter by property marketing status (lowercase).' },
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
      { name: 'status', type: 'string', required: false, enum: PROPERTY_STATUS_ENUM, description: 'New marketing status (lowercase): not-listed, for-sale, for-rent, rented, sold, archived.' },
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
      internal: 'Use this when the user asks to create a new tenant/customer. Triggers: "create tenant", "add tenant", "new tenant Sarah". Required: name and phone.',
      mcp: 'Create a tenant. Requires name and phone.',
    },
    handler: 'createCustomer',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Tenant name.' },
      { name: 'phone', type: 'string', required: true, description: 'Phone number (10 digits, required).' },
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
      internal: 'Use this when the user asks to create a new buyer. Triggers: "create buyer", "add buyer", "new buyer Rohan". Required: name and phone.',
      mcp: 'Create a buyer. Requires name and phone.',
    },
    handler: 'createBuyer',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Buyer name.' },
      { name: 'phone', type: 'string', required: true, description: 'Phone number (10 digits, required).' },
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
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive', 'purchased'], description: 'Filter by status.' },
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
      { name: 'status', type: 'string', required: false, enum: ['active', 'inactive', 'purchased'], description: 'New status (purchased = completed a property purchase).' },
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
      internal: 'Schedule a meeting. REQUIRED: title, scheduledDate (YYYY-MM-DD or YYYY-MM-DDTHH:mm), relatedEntityType, relatedEntityId. scheduledDate is mapped to meetingDate/meetingTime automatically. Triggers: "meeting with Rahul tomorrow 3pm".',
      mcp: 'Create a meeting. Requires title, scheduledDate, relatedEntityType, relatedEntityId.',
    },
    handler: 'createMeeting',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Meeting title.' },
      { name: 'scheduledDate', type: 'string', required: true, description: 'Date/time: YYYY-MM-DD or YYYY-MM-DDTHH:mm (e.g. "2026-08-01T15:00"). Time defaults to 10:00 if only date given.' },
      { name: 'relatedEntityType', type: 'string', required: true, enum: ['lead', 'buyer', 'owner', 'tenant', 'contact', 'property'], description: 'Entity type this meeting is about.' },
      { name: 'relatedEntityId', type: 'string', required: true, description: 'UUID of the related entity from a prior search/get.' },
      { name: 'notes', type: 'string', required: false, description: 'Meeting notes or description (maps to description field).' },
      { name: 'location', type: 'string', required: false, description: 'Meeting location.' },
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
      { name: 'scheduledDate', type: 'string', required: false, description: 'New date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm). Mapped to meetingDate/meetingTime.' },
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

  // ════════════════════════════════════════════════════════════════════════════════
  // BUSINESS SUMMARY & INSIGHT TOOLS (10 tools)
  // Layer 2 (summaries) + Layer 3 (insights). These sit on top of CRUD tools and
  // return small, intent-focused aggregates. The LLM curates a 3-layer reply
  // (answer → context → next action) from them — do NOT dump raw metrics.
  // ════════════════════════════════════════════════════════════════════════════════

  {
    name: 'get_leads_summary',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks HOW MANY leads or wants a leads breakdown (not a full list). Triggers: "how many leads", "kitni leads hain", "leads breakdown", "leads by type", "leads summary", "total leads". Returns counts by type (buyer/seller/tenant/owner), by status, by priority, and unassigned. Prefer this over search_leads when the user only wants numbers. Prefer this over get_crm_metrics when the question is specifically about leads.',
      mcp: 'Get a focused lead summary: totals and breakdown by type, status, and priority.',
    },
    handler: 'getLeadsSummary',
    parameters: [
      { name: 'leadType', type: 'string', required: false, enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Optional: restrict the summary to one lead type.' },
    ],
  },
  {
    name: 'get_properties_summary',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks about property inventory counts. Triggers: "how many properties", "kitni properties hain", "inventory status", "available properties count", "properties summary". Returns total, available, on-hold, rented, sold, pending agreements/verifications, and by type. Prefer this over search_properties when the user only wants numbers.',
      mcp: 'Get a focused property inventory summary.',
    },
    handler: 'getPropertiesSummary',
    parameters: [],
  },
  {
    name: 'get_buyers_summary',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks about buyer demand counts. Triggers: "how many buyers", "kitne buyers hain", "buyers summary", "buyer demand". Returns total, active, high-priority count, average budget, and by-priority breakdown.',
      mcp: 'Get a focused buyer demand summary.',
    },
    handler: 'getBuyersSummary',
    parameters: [],
  },
  {
    name: 'get_pipeline_summary',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks about the sales pipeline or funnel. Triggers: "pipeline", "funnel", "conversion rate", "pipeline status", "kitne convert hue". Returns stage counts (new/contacted/qualified/negotiating/converted/lost), active-in-pipeline, and conversion rate.',
      mcp: 'Get the sales pipeline funnel and conversion rate.',
    },
    handler: 'getPipelineSummary',
    parameters: [],
  },
  {
    name: 'get_followup_summary',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks about pending follow-ups. Triggers: "follow-ups", "pending followups", "kise call karna hai", "overdue leads", "kitne followups pending". Returns overdue lead count, today/tomorrow meeting counts, and the top overdue leads with days since last contact.',
      mcp: 'Get pending follow-ups: overdue leads and upcoming meetings.',
    },
    handler: 'getFollowupSummary',
    parameters: [
      { name: 'staleDays', type: 'number', required: false, description: 'Days without contact before a lead counts as overdue (default 5).' },
    ],
  },
  {
    name: 'get_priority_leads',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks who to contact first or for hot/priority leads. Triggers: "who should I call", "aaj kise call karu", "priority leads", "hot leads", "most important leads". Returns a ranked list of leads, each with a human-readable reason (e.g. "high budget, no contact in 6 days").',
      mcp: 'Get ranked priority leads with a reason for each.',
    },
    handler: 'getPriorityLeads',
    parameters: [
      { name: 'limit', type: 'number', required: false, description: 'Max leads to return (default 5).' },
    ],
  },
  {
    name: 'get_recent_activity',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks what happened recently. Triggers: "recent activity", "kya naya hua", "yesterday activity", "this week summary", "what changed". Returns counts of new leads, new properties, completed meetings, and conversions over the last N days.',
      mcp: 'Get recent CRM activity over the last N days.',
    },
    handler: 'getRecentActivity',
    parameters: [
      { name: 'days', type: 'number', required: false, description: 'Look-back window in days (default 7).' },
    ],
  },
  {
    name: 'get_daily_brief',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this for a morning briefing or when the user greets you at the start of the day. Triggers: "good morning", "daily brief", "aaj ka plan", "todays snapshot", "brief me". Returns new leads today, meetings today, overdue follow-ups, pending agreements/verifications, and the top hot leads.',
      mcp: 'Get a daily briefing snapshot for the agent.',
    },
    handler: 'getDailyBrief',
    parameters: [],
  },
  {
    name: 'suggest_next_actions',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks what to do next. Triggers: "what should I do today", "kya karu aaj", "next actions", "what next", "suggest tasks". Returns a prioritised list of concrete actions (call X, attend meeting Y, progress agreement Z) each with a reason.',
      mcp: 'Suggest prioritised next actions for the agent.',
    },
    handler: 'suggestNextActions',
    parameters: [
      { name: 'limit', type: 'number', required: false, description: 'Max actions to return (default 5).' },
    ],
  },
  {
    name: 'get_business_health',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user asks how the business is doing. Triggers: "business health", "how are we doing", "business kaisa chal raha hai", "trends". Returns 7-day lead inflow vs previous 7 days (with trend), 30-day conversions, pending follow-ups, and alerts.',
      mcp: 'Get business health with week-over-week trends and alerts.',
    },
    handler: 'getBusinessHealth',
    parameters: [],
  },
  {
    name: 'get_dashboard_snapshot',
    category: 'metrics',
    readOnly: true,
    descriptions: {
      internal: 'Use this when the user wants a full overview of everything at once. Triggers: "dashboard", "overview", "full summary", "sab kuch dikhao", "complete status". Returns a combined snapshot: leads summary, properties summary, pipeline, follow-ups, and top priority leads. Use focused tools (get_leads_summary etc.) when the user asks about only one area.',
      mcp: 'Get a combined dashboard snapshot across leads, properties, pipeline, and follow-ups.',
    },
    handler: 'getDashboardSnapshot',
    parameters: [],
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// CONVERTER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

function collectParamDescriptions(parameters) {
  const descs = {};
  for (const p of parameters) {
    if (p.description) descs[p.name] = p.description;
    if (p.properties) {
      for (const [key, spec] of Object.entries(p.properties)) {
        descs[`${p.name}.${key}`] = spec.description || `Parameter: ${p.name}.${key}`;
      }
    }
  }
  return descs;
}

function collectNestedSchemas(parameters) {
  const nested = {};
  for (const p of parameters) {
    if (p.type !== 'object' || !p.properties) continue;
    nested[p.name] = Object.fromEntries(
      Object.entries(p.properties).map(([key, spec]) => [key, spec.type || 'string'])
    );
  }
  return nested;
}

function toMcpProperty(param) {
  const prop = {
    type: param.type,
    description: param.description,
    ...(param.enum ? { enum: param.enum } : {}),
    ...(param.default !== undefined ? { default: param.default } : {}),
  };
  if (param.type === 'object' && param.properties) {
    prop.properties = Object.fromEntries(
      Object.entries(param.properties).map(([key, spec]) => [
        key,
        { type: spec.type, description: spec.description, ...(spec.enum ? { enum: spec.enum } : {}) },
      ])
    );
  }
  return prop;
}

/**
 * Convert neutral tool definitions to TOOL_SCHEMAS format (for WhatsApp SyncBot)
 * @param {Array} toolDefs - Tool definitions from this file
 * @returns {Object} TOOL_SCHEMAS object
 */
export function convertToSkillSchemas(toolDefs) {
  const schemas = {};
  for (const tool of toolDefs) {
    const enums = Object.fromEntries(
      tool.parameters.filter((p) => Array.isArray(p.enum) && p.enum.length > 0).map((p) => [p.name, p.enum])
    );
    const nestedSchemas = collectNestedSchemas(tool.parameters);
    schemas[tool.name] = {
      required: tool.parameters.filter(p => p.required).map(p => p.name),
      types: Object.fromEntries(
        tool.parameters.map(p => [p.name, p.type])
      ),
      description: tool.descriptions.internal,
      paramDescriptions: collectParamDescriptions(tool.parameters),
      ...(Object.keys(enums).length > 0 ? { enums } : {}),
      ...(Object.keys(nestedSchemas).length > 0 ? { nestedSchemas } : {}),
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
        tool.parameters.map(p => [p.name, toMcpProperty(p)])
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

// ════════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY META (single source of truth for NLU, business, interaction, render)
//
// Instead of hand-maintaining parallel Sets in agentRuntime.js and
// formatting/routing.js, each tool derives a `meta` block from its existing
// fields (category, readOnly, name). Every downstream layer reads this meta.
//
// meta = {
//   entity,               // 'lead' | 'buyer' | 'property' | ... | 'metrics'
//   operationKind,        // 'list' | 'detail' | 'summary' | 'mutate' | 'delete'
//   replyOwner,           // 'formatter' | 'llm' | 'hybrid_intro'
//   presentationTemplate, // e.g. 'list_lead_card', 'detail_lead', 'confirmation'
//   requiresConfirmation, // true for delete_*
//   slots,                // accepted parameter names (for slot pass-through)
// }
// ════════════════════════════════════════════════════════════════════════════════

/** Summary tools whose reply is rendered deterministically (not by the LLM). */
const FORMATTED_SUMMARY_TOOL_NAMES = new Set(['get_leads_summary']);

/** Read-only list tools whose name does not start with `search_`. */
function isNonSearchListTool(name) {
  return (
    name === 'get_owners'
    || name === 'get_upcoming_meetings'
    || name === 'get_property_documents'
    || name.endsWith('_notes')
  );
}

function deriveOperationKind(tool) {
  const { name, category, readOnly } = tool;
  if (!readOnly) {
    if (name.startsWith('delete_')) return 'delete';
    return 'mutate';
  }
  if (category === 'metrics') return 'summary';
  if (name.startsWith('search_') || isNonSearchListTool(name)) return 'list';
  return 'detail';
}

function deriveReplyOwner(tool, operationKind) {
  switch (operationKind) {
    case 'list':
    case 'detail':
    case 'delete':
      return 'formatter';
    case 'summary':
      return FORMATTED_SUMMARY_TOOL_NAMES.has(tool.name) ? 'formatter' : 'llm';
    case 'mutate':
      // Note create/update replies read better from the LLM; other writes use
      // the deterministic confirmation line.
      return tool.name.includes('_note') ? 'llm' : 'formatter';
    default:
      return 'formatter';
  }
}

function derivePresentationTemplate(tool, operationKind) {
  const entity = tool.category;
  switch (operationKind) {
    case 'list':
      return entity === 'lead' ? 'list_lead_card' : `list_${entity}`;
    case 'detail':
      return `detail_${entity}`;
    case 'mutate':
    case 'delete':
      return 'confirmation';
    case 'summary':
      if (tool.name === 'get_leads_summary') return 'summary_leads_card';
      if (tool.name === 'get_crm_metrics') return 'metrics_card';
      return 'summary_llm';
    default:
      return 'generic';
  }
}

function deriveToolMeta(tool) {
  const operationKind = deriveOperationKind(tool);
  return {
    entity: tool.category,
    operationKind,
    replyOwner: deriveReplyOwner(tool, operationKind),
    presentationTemplate: derivePresentationTemplate(tool, operationKind),
    requiresConfirmation: operationKind === 'delete',
    slots: tool.parameters.map((p) => p.name),
  };
}

// Attach meta to every tool definition so consumers can read `tool.meta`.
for (const tool of toolDefinitions) {
  tool.meta = deriveToolMeta(tool);
}

const TOOL_META_BY_NAME = Object.fromEntries(
  toolDefinitions.map((t) => [t.name, t.meta])
);

/**
 * Get the registry meta for a tool.
 * @param {string} toolName
 * @returns {object|null}
 */
export function getToolMeta(toolName) {
  return TOOL_META_BY_NAME[toolName] || null;
}

function toolNamesWhere(predicate) {
  return new Set(toolDefinitions.filter(predicate).map((t) => t.name));
}

/** Tools whose output is rendered as a numbered list by the formatter. */
export const LIST_TOOLS = toolNamesWhere((t) => t.meta.operationKind === 'list');

/** Single-entity detail tools rendered as a mini-profile card. */
export const DETAIL_ENTITY_TOOLS = toolNamesWhere((t) => t.meta.operationKind === 'detail');

/** Summary/insight tools whose reply the LLM composes (3-layer). */
export const SUMMARY_INSIGHT_TOOLS = toolNamesWhere(
  (t) => t.meta.operationKind === 'summary' && t.meta.replyOwner === 'llm'
);

/** Summary tools rendered deterministically by the formatter. */
export const FORMATTED_SUMMARY_TOOLS = toolNamesWhere(
  (t) => t.meta.operationKind === 'summary' && t.meta.replyOwner === 'formatter'
);

// ════════════════════════════════════════════════════════════════════════════════
// DOMAIN GROUPING (hierarchical tool routing — single source of truth)
//
// The agent does NOT expose all tools to the planner at once. A lightweight
// router first picks the relevant DOMAIN(s) for the user's message, then only
// that domain's tools are given to the planner LLM. This keeps the tool count
// the planner sees well under the accuracy cliff (~<10 per domain) and removes
// cross-domain confusion (e.g. buyer vs owner vs tenant).
//
// Domains map from each tool's `category`. Buyers, Sellers(=Owners), Owners and
// Tenants are intentionally SEPARATE domains per product requirement.
// ════════════════════════════════════════════════════════════════════════════════

/** category (on each tool) → routing domain. */
const DOMAIN_BY_CATEGORY = {
  lead: 'leads',
  buyer: 'buyers',
  owner: 'owners',
  tenant: 'tenants',
  contact: 'contacts',
  property: 'properties',
  meeting: 'meetings',
  metrics: 'analytics',
};

/**
 * Human-readable domain catalog used by the router prompt. Order matters only
 * for display. `aliases` are cheap keyword hints for the rules-based fast path.
 */
export const DOMAIN_CATALOG = [
  {
    id: 'leads',
    label: 'Leads (pipeline / prospects)',
    description:
      'Prospects still in the pipeline who have NOT been converted yet — of ANY type (buyer lead, seller lead, owner lead, tenant lead). Create/search/update/convert leads, lead notes, lead status/priority/assignment. Default home for "leads", "sari leads", "seller leads", "tenant leads", "hot leads", "convert lead".',
    aliases: ['lead', 'leads', 'prospect', 'pipeline', 'convert', 'seller lead', 'buyer lead', 'tenant lead', 'owner lead'],
  },
  {
    id: 'buyers',
    label: 'Buyers (converted buyer records)',
    description:
      'Converted BUYER individuals (post lead-conversion) with budget/requirement. Search/create/update/delete buyers and buyer notes. Use when the user clearly means buyer *records*, not buyer leads.',
    aliases: ['buyer', 'buyers', 'kharidar'],
  },
  {
    id: 'owners',
    label: 'Owners (property owners / converted sellers)',
    description:
      'Property OWNERS — this is what a converted SELLER becomes. Search/create/update/delete owners, owner notes, owner-by-phone. Use for "owners", "malik", "sellers" (as records).',
    aliases: ['owner', 'owners', 'malik', 'seller', 'sellers'],
  },
  {
    id: 'tenants',
    label: 'Tenants (converted rental customers)',
    description:
      'Converted TENANT / rental customer records (leases). Search/create/update/delete tenants, tenant notes, tenant-by-phone. NOTE: "tenant leads" / pipeline lists usually belong to the leads domain instead.',
    aliases: ['tenant', 'tenants', 'kirayedar', 'customer', 'rental', 'lease'],
  },
  {
    id: 'properties',
    label: 'Properties (inventory)',
    description:
      'Property inventory: apartments/houses/villas/office/land, rent/sale price, furnishing, BHK, city/area, and property documents. Search/create/update/delete properties and their documents.',
    aliases: ['property', 'properties', 'flat', 'makan', 'apartment', 'villa', 'plot', 'land', 'document', 'deed'],
  },
  {
    id: 'contacts',
    label: 'Contacts (unified address book)',
    description:
      'Unified contact/address-book records and their roles (owner/buyer/seller/tenant), phone-number lookups, and contact notes. Use for generic "contacts", role changes, or "find by phone" when entity type is unclear.',
    aliases: ['contact', 'contacts', 'sampark', 'phone number', 'role'],
  },
  {
    id: 'meetings',
    label: 'Meetings (calendar)',
    description:
      'Meetings / appointments / calendar. Create/reschedule/cancel meetings and list upcoming meetings.',
    aliases: ['meeting', 'meetings', 'appointment', 'calendar', 'schedule', 'milan'],
  },
  {
    id: 'analytics',
    label: 'Analytics (counts, summaries, insights)',
    description:
      'Aggregate numbers and insights — NOT row lists. Counts ("how many"), lead/property/buyer summaries, pipeline & conversion, pending follow-ups, priority/hot leads, recent activity, daily brief, next actions, business health, dashboard snapshot.',
    aliases: ['how many', 'kitne', 'kitni', 'summary', 'metrics', 'dashboard', 'overview', 'pipeline', 'funnel', 'follow-up', 'followup', 'priority', 'hot leads', 'daily brief', 'business health', 'next action', 'stats'],
  },
];

export const DOMAINS = DOMAIN_CATALOG.map((d) => d.id);

// Attach `domain` to every tool.
for (const tool of toolDefinitions) {
  tool.domain = DOMAIN_BY_CATEGORY[tool.category] || 'contacts';
}

/** domain id → array of tool names. */
export const TOOL_NAMES_BY_DOMAIN = DOMAINS.reduce((acc, domain) => {
  acc[domain] = toolDefinitions.filter((t) => t.domain === domain).map((t) => t.name);
  return acc;
}, {});

/**
 * Return the tool names available for one or more domains.
 * @param {string|string[]} domains
 * @returns {string[]} unique tool names (empty if none/unknown)
 */
export function getToolsForDomain(domains) {
  const list = Array.isArray(domains) ? domains : [domains];
  const names = new Set();
  for (const d of list) {
    for (const name of TOOL_NAMES_BY_DOMAIN[d] || []) names.add(name);
  }
  return [...names];
}

/**
 * Return the full tool definitions for one or more domains.
 * @param {string|string[]} domains
 * @returns {Array}
 */
export function getToolDefsForDomain(domains) {
  const allowed = new Set(getToolsForDomain(domains));
  return toolDefinitions.filter((t) => allowed.has(t.name));
}

/** domain id of a tool, or null. */
export function getToolDomain(toolName) {
  const tool = toolDefinitions.find((t) => t.name === toolName);
  return tool?.domain || null;
}
