# Tool Definitions (SyncBot / Gemini)

Source: `server/shared/toolDefinitions.js`

Total tools: **65**

> Descriptions below are what Gemini sees via `descriptions.internal` in tool schemas.

## create_lead

- **Category:** lead
- **Read-only:** false
- **Handler:** createLead

### When to use (internal / WhatsApp)

Use this when the user asks to create a new lead. Triggers: "create lead", "add lead", "new buyer lead", "seller lead Raj", "tenant lead Sarah", "owner lead Imran". Required: name, leadType (buyer|seller|tenant|owner). Optional: phone, email.

### MCP description

Create a new CRM lead. Requires name and leadType (buyer|seller|tenant|owner). Optional: phone, email, priority, buyerRequirement.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Full name of the lead (e.g., "Raj Sharma", "Faizan Khan"). |
| leadType | string (buyer, seller, tenant, owner) | true | Type of lead: "buyer", "seller", "tenant", or "owner". |
| phone | string | false | Phone number (10 digits, e.g., "9876543210"). Optional. |
| email | string | false | Email address (e.g., "raj@example.com"). Optional. |

---

## get_lead

- **Category:** lead
- **Read-only:** true
- **Handler:** getLead

### When to use (internal / WhatsApp)

Get full details of a single lead by leadId. Use this when the user asks for details of a SPECIFIC lead by ID or name after you already have the leadId from a previous search. Triggers: "lead details", "tell me about lead L123", "show lead abc123", "iska details dikhao". Required: leadId. Do NOT use this for searching — use search_leads for that.

### MCP description

Get a single lead by leadId. Use after search_leads when you have a specific leadId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead (e.g., "lead-abc123"). |

---

## search_leads

- **Category:** lead
- **Read-only:** true
- **Handler:** searchLeads

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, show, or find leads. Triggers: "leads dikhao", "show leads", "Kurla ke leads", "buyer leads", "hot leads", "new leads", "leads assigned to Aman", "high priority leads above 1 crore", "sari leads", "all leads". Pass empty parameters {} to list all leads. Extract parameters: query (name/phone/area), leadType (buyer|seller|tenant|owner), status (new|contacted|qualified|negotiating|lost), priority (low|medium|high), assignedTo (agent name), minBudget/maxBudget (in rupees: 80L=8000000, 1Cr=10000000), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Search leads by query, status, leadType, or filters. Supports sorting by budget, score, or recency.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | false | Search by lead name, phone number, or area (e.g., "Kurla", "Faizan", "9876543210"). Leave empty to list all leads. |
| status | string (new, contacted, qualified, negotiating, lost) | false | Filter by lead status. Leave empty for all statuses. |
| leadType | string (buyer, seller, tenant, owner) | false | Filter by lead type. Leave empty for all types. |
| priority | string (low, medium, high) | false | Filter by priority. Leave empty for all priorities. |
| assignedTo | string | false | Filter by agent name (e.g., "Aman"). Leave empty for all agents. |
| minBudget | number | false | Minimum budget in rupees (e.g., 8000000 for 80L). Leave empty for no minimum. |
| maxBudget | number | false | Maximum budget in rupees (e.g., 10000000 for 1Cr). Leave empty for no maximum. |
| sortBy | string (recent_first, budget_desc, budget_asc, score_desc, name_asc) | false | Sort results by field. Leave empty for default order. |
| limit | number | false | Maximum number of leads to return (e.g., 10, 20). Leave empty for default. |
| responseMode | string (summary, compact, details, full) | false | Response detail level: "summary" (names only), "compact" (key fields), "details" (all fields), "full" (everything). Default: summary. |

---

## update_lead

- **Category:** lead
- **Read-only:** false
- **Handler:** updateLead

### When to use (internal / WhatsApp)

Use this when the user asks to update a lead. Triggers: "update lead", "change status", "mark as contacted", "update budget", "assign to Aman", "mark lost". Required: leadId. For structured updates (budget, BHK, area), use buyerRequirement/sellerProperty/ownerProperty/tenantRequirement objects instead of notes. Example: user says "update budget to 1 crore" → update buyerRequirement.budget, not create a note.

### MCP description

Update a lead. Include leadId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead to update (e.g., "lead-abc123"). |
| status | string (new, contacted, qualified, negotiating, lost) | false | New status. |
| priority | string (low, medium, high) | false | New priority. |
| score | string | false | Lead score (e.g., "85", "high"). |
| assignedTo | string | false | Agent name to assign the lead to (e.g., "Aman"). |
| notes | string | false | Free-text notes to add to the lead. Use for unstructured updates only. |

---

## delete_lead

- **Category:** lead
- **Read-only:** false
- **Handler:** deleteLead

### When to use (internal / WhatsApp)

Use this when the user asks to delete a lead. Triggers: "delete lead", "remove lead", "delete lead L123". IMPORTANT: Always ask for confirmation before calling this tool. Example: User says "delete Faizan" → ask "Are you sure you want to delete Faizan's lead? This cannot be undone."

### MCP description

Delete a lead. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead to delete. |

---

## convert_lead

- **Category:** lead
- **Read-only:** false
- **Handler:** convertLead

### When to use (internal / WhatsApp)

Convert a lead into a buyer, tenant, or owner record. Use this when the user asks to convert or promote a lead. Triggers: "convert lead", "make buyer from lead", "convert to owner", "promote lead", "lead ko buyer banao". Required: leadId. The lead must already exist.

### MCP description

Convert a lead to buyer/tenant/owner. Requires leadId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead to convert. |

---

## create_lead_note

- **Category:** lead
- **Read-only:** false
- **Handler:** createLeadNote

### When to use (internal / WhatsApp)

Add a free-text note to a lead. Use this when the user asks to add a note, comment, or remark to a lead (NOT for structured updates like budget/BHK — use update_lead for those). Triggers: "add note to lead", "note on lead L123", "comment on lead", "lead pe note add karo", "remark". Required: leadId, content.

### MCP description

Add a note to a lead. Requires leadId and content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead. |
| content | string | true | The note content. |
| createdBy | string | false | Name of the person creating the note. |

---

## get_lead_notes

- **Category:** lead
- **Read-only:** true
- **Handler:** getLeadNotes

### When to use (internal / WhatsApp)

Get all notes for a lead. Use this when the user asks to see notes, comments, or remarks on a specific lead. Triggers: "show notes for lead", "lead ke notes", "comments on lead L123", "lead ka history". Required: leadId.

### MCP description

Get all notes for a lead. Requires leadId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadId | string | true | The unique ID of the lead. |

---

## create_contact

- **Category:** contact
- **Read-only:** false
- **Handler:** createContact

### When to use (internal / WhatsApp)

Use this when the user asks to create a new contact. Triggers: "create contact", "add contact", "new contact Faizan", "contact Raj with phone 9876543210". Required: name. Optional: phone, email, role (owner|buyer|seller|tenant).

### MCP description

Create a contact. Requires name.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Contact name. |
| phone | string | false | Phone number. |
| email | string | false | Email address. |
| role | string (owner, buyer, seller, tenant) | false | Contact role. |

---

## get_contact

- **Category:** contact
- **Read-only:** true
- **Handler:** getContact

### When to use (internal / WhatsApp)

Get full details of a single contact by contactId. Use this AFTER search_contacts when you have a specific contactId and need full details. Triggers: "contact details", "show contact C123", "tell me about this contact", "iska details". Required: contactId. Do NOT use for searching — use search_contacts for that.

### MCP description

Get a contact by contactId. Use after search_contacts.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact. |

---

## search_contacts

- **Category:** contact
- **Read-only:** true
- **Handler:** getContacts

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, or show contacts. Triggers: "contacts dikhao", "show contacts", "contacts batao", "contacts with role owner", "find contact Faizan", "active contacts". Extract parameters: query (name/phone), role (owner|buyer|seller|tenant), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Search contacts by role or status.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| role | string (owner, buyer, seller, tenant) | false | Filter by role. |
| status | string (active, inactive) | false | Filter by status. |
| query | string | false | Search by name or phone. |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_contact

- **Category:** contact
- **Read-only:** false
- **Handler:** updateContact

### When to use (internal / WhatsApp)

Update a contact's name, phone, email, or status. Use this when the user asks to edit or change contact info. Triggers: "update contact", "change contact phone", "edit contact", "contact ka phone update karo", "mark contact inactive". Required: contactId. Provide only the fields to update.

### MCP description

Update a contact. Requires contactId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact. |
| name | string | false | New name. |
| phone | string | false | New phone. |
| email | string | false | New email. |
| status | string (active, inactive) | false | New status. |

---

## delete_contact

- **Category:** contact
- **Read-only:** false
- **Handler:** deleteContact

### When to use (internal / WhatsApp)

Use this when the user asks to delete a contact. Triggers: "delete contact", "remove contact". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete a contact. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact to delete. |

---

## update_contact_role

- **Category:** contact
- **Read-only:** false
- **Handler:** updateContactRole

### When to use (internal / WhatsApp)

Add or remove a role (owner|buyer|seller|tenant) on a unified contact. Use this when the user asks to change a contact's role or add them as an owner/buyer/seller/tenant. Triggers: "make contact an owner", "add buyer role", "remove seller role", "contact ko owner banao", "add as tenant". Required: contactId, role, enabled (true to add, false to remove).

### MCP description

Add or remove a role on a unified contact. Requires contactId, role, enabled.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact. |
| role | string (owner, buyer, seller, tenant) | true | The role to add or remove. |
| enabled | boolean | true | true to add the role, false to remove it. |
| profileData | object | false | Optional role-specific profile data. |

---

## create_contact_note

- **Category:** contact
- **Read-only:** false
- **Handler:** createContactNote

### When to use (internal / WhatsApp)

Add a free-text note to a contact. Triggers: "add note to contact", "note on contact C123", "comment on contact", "contact pe note add karo". Required: contactId, content.

### MCP description

Add a note to a contact. Requires contactId and content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact. |
| content | string | true | The note content. |
| createdBy | string | false | Name of the person creating the note. |

---

## get_contact_notes

- **Category:** contact
- **Read-only:** true
- **Handler:** getContactNotes

### When to use (internal / WhatsApp)

Get all notes for a contact. Triggers: "show notes for contact", "contact ke notes", "comments on contact C123". Required: contactId.

### MCP description

Get all notes for a contact. Requires contactId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| contactId | string | true | The unique ID of the contact. |

---

## find_contact_by_phone

- **Category:** contact
- **Read-only:** true
- **Handler:** findContactByPhone

### When to use (internal / WhatsApp)

Find a contact by phone number. Use this BEFORE creating a new contact to avoid duplicates, or when the user asks to find someone by phone. Triggers: "find contact by phone", "is number ka contact hai?", "check phone 9876543210", "duplicate check". Required: phone. NOTE: Use get_owner_by_phone or get_tenant_by_phone if you specifically need an owner or tenant.

### MCP description

Find a contact by phone number. Requires phone.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone | string | true | Phone number to search for. |

---

## create_property

- **Category:** property
- **Read-only:** false
- **Handler:** createProperty

### When to use (internal / WhatsApp)

Use this when the user asks to create a new property. Triggers: "create property", "add property", "new apartment in Bandra", "property 3BHK in Andheri". Required: title, propertyType (apartment|house|villa|office|land). Optional: city, area, ownerId.

### MCP description

Create a property. Requires title and propertyType.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | true | Property title. |
| propertyType | string (apartment, house, villa, office, land) | true | Type of property. |
| city | string | false | City where the property is located. |
| area | string | false | Area/locality of the property. |
| ownerId | string | false | ID of the owner. |

---

## get_property

- **Category:** property
- **Read-only:** true
- **Handler:** getProperty

### When to use (internal / WhatsApp)

Get full details of a single property by propertyId. Use this AFTER search_properties when you have a specific propertyId. Triggers: "property details", "show property P123", "tell me about this property", "iska full details". Required: propertyId. Do NOT use for searching — use search_properties for that.

### MCP description

Get a property by propertyId. Use after search_properties.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property. |

---

## search_properties

- **Category:** property
- **Read-only:** true
- **Handler:** searchProperties

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, or show properties. Triggers: "properties dikhao", "show properties", "properties in Bandra", "3BHK apartments", "furnished properties", "properties above 1 crore", "properties owned by Raj". Extract parameters: query (title/area), propertyType (apartment|house|villa|office|land), city, bhk (1-5), furnishing (furnished|semi-furnished|unfurnished), status (active|inactive|sold), minPrice/maxPrice (in rupees), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Search properties by status, city, or propertyType.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string (active, inactive, sold) | false | Filter by status. |
| city | string | false | Filter by city. |
| propertyType | string (apartment, house, villa, office, land) | false | Filter by property type. |
| query | string | false | Search by title or area. |
| ownerId | string | false | Filter by owner ID. |
| bhk | string | false | Filter by BHK (1-5). |
| furnishing | string (furnished, semi-furnished, unfurnished) | false | Filter by furnishing. |
| minPrice | number | false | Minimum price in rupees. |
| maxPrice | number | false | Maximum price in rupees. |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_property

- **Category:** property
- **Read-only:** false
- **Handler:** updateProperty

### When to use (internal / WhatsApp)

Update a property's title, status, monthly rent, or sale price. Triggers: "update property", "change rent", "mark property sold", "edit property title", "property ka rent update karo". Required: propertyId. Provide only the fields to update.

### MCP description

Update a property. Requires propertyId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property. |
| title | string | false | New title. |
| status | string (active, inactive, sold) | false | New status. |
| monthlyRent | number | false | Monthly rent in rupees. |
| salePrice | number | false | Sale price in rupees. |

---

## delete_property

- **Category:** property
- **Read-only:** false
- **Handler:** deleteProperty

### When to use (internal / WhatsApp)

Use this when the user asks to delete a property. Triggers: "delete property", "remove property". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete a property. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property to delete. |

---

## get_property_documents

- **Category:** property
- **Read-only:** true
- **Handler:** getPropertyDocuments

### When to use (internal / WhatsApp)

Get all documents for a property. Triggers: "show documents for property", "property ke documents", "papers for P123", "property ka file". Required: propertyId.

### MCP description

Get all documents for a property. Requires propertyId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property. |

---

## create_property_document

- **Category:** property
- **Read-only:** false
- **Handler:** createPropertyDocument

### When to use (internal / WhatsApp)

Add a document (deed, agreement, etc.) to a property. Triggers: "add document to property", "upload deed for P123", "property pe document add karo", "attach agreement". Required: propertyId, title, url. Optional: documentType.

### MCP description

Add a document to a property. Requires propertyId, title, url.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property. |
| title | string | true | Document title. |
| url | string | true | Document URL or S3 key. |
| documentType | string | false | Type of document (e.g., "deed", "agreement"). |

---

## delete_property_document

- **Category:** property
- **Read-only:** false
- **Handler:** deletePropertyDocument

### When to use (internal / WhatsApp)

Delete a property document. Triggers: "delete document", "remove document from property", "document hatao". IMPORTANT: Always ask for confirmation before calling. Required: propertyId, documentId.

### MCP description

Delete a property document. Confirm with user first. Requires propertyId, documentId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| propertyId | string | true | The unique ID of the property. |
| documentId | string | true | The unique ID of the document to delete. |

---

## create_tenant

- **Category:** tenant
- **Read-only:** false
- **Handler:** createCustomer

### When to use (internal / WhatsApp)

Use this when the user asks to create a new tenant/customer. Triggers: "create tenant", "add tenant", "new tenant Sarah", "customer Priya with phone 9876543210". Required: name. Optional: phone, email.

### MCP description

Create a tenant. Requires name.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Tenant name. |
| phone | string | false | Phone number. |
| email | string | false | Email address. |

---

## get_tenant

- **Category:** tenant
- **Read-only:** true
- **Handler:** getCustomer

### When to use (internal / WhatsApp)

Get full details of a single tenant by tenantRecordId. Use this AFTER search_tenants when you have a specific tenantRecordId. Triggers: "tenant details", "show tenant T123", "tell me about this tenant", "iska details". Required: tenantRecordId. Do NOT use for searching — use search_tenants for that.

### MCP description

Get a tenant by tenantRecordId. Use after search_tenants.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tenantRecordId | string | true | The unique ID of the tenant. |

---

## search_tenants

- **Category:** tenant
- **Read-only:** true
- **Handler:** getCustomers

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, or show tenants/customers. Triggers: "tenants dikhao", "show tenants", "customers batao", "tenants with budget under 50k", "find tenant Sarah", "tenant in Powai". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (monthly rent in rupees), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Search tenants by status.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string (active, inactive) | false | Filter by status. |
| query | string | false | Search by name or phone. |
| minBudget | number | false | Minimum budget in rupees. |
| maxBudget | number | false | Maximum budget in rupees. |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_tenant

- **Category:** tenant
- **Read-only:** false
- **Handler:** updateCustomer

### When to use (internal / WhatsApp)

Update a tenant's name, phone, or status. Triggers: "update tenant", "change tenant phone", "edit tenant", "tenant ka phone update karo", "mark tenant inactive". Required: tenantRecordId. Provide only the fields to update.

### MCP description

Update a tenant. Requires tenantRecordId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tenantRecordId | string | true | The unique ID of the tenant. |
| name | string | false | New name. |
| phone | string | false | New phone. |
| status | string (active, inactive) | false | New status. |

---

## delete_tenant

- **Category:** tenant
- **Read-only:** false
- **Handler:** deleteCustomer

### When to use (internal / WhatsApp)

Use this when the user asks to delete a tenant. Triggers: "delete tenant", "remove tenant". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete a tenant. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tenantRecordId | string | true | The unique ID of the tenant to delete. |

---

## create_tenant_note

- **Category:** tenant
- **Read-only:** false
- **Handler:** createCustomerNote

### When to use (internal / WhatsApp)

Add a free-text note to a tenant. Triggers: "add note to tenant", "note on tenant T123", "comment on tenant", "tenant pe note add karo". Required: tenantRecordId, content.

### MCP description

Add a note to a tenant. Requires tenantRecordId and content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tenantRecordId | string | true | The unique ID of the tenant. |
| content | string | true | The note content. |
| createdBy | string | false | Name of the person creating the note. |

---

## get_tenant_notes

- **Category:** tenant
- **Read-only:** true
- **Handler:** getCustomerNotes

### When to use (internal / WhatsApp)

Get all notes for a tenant. Triggers: "show notes for tenant", "tenant ke notes", "comments on tenant T123". Required: tenantRecordId.

### MCP description

Get all notes for a tenant. Requires tenantRecordId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tenantRecordId | string | true | The unique ID of the tenant. |

---

## get_tenant_by_phone

- **Category:** tenant
- **Read-only:** true
- **Handler:** getCustomerByPhone

### When to use (internal / WhatsApp)

Find a tenant by phone number. Use this BEFORE creating a new tenant to avoid duplicates, or when the user asks to find a tenant by phone. Triggers: "find tenant by phone", "is number ka tenant hai?", "check tenant phone 9876543210". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.

### MCP description

Find a tenant by phone number. Requires phone.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone | string | true | Phone number to search for. |

---

## create_owner

- **Category:** owner
- **Read-only:** false
- **Handler:** createOwner

### When to use (internal / WhatsApp)

Use this when the user asks to create a new owner. Triggers: "create owner", "add owner", "new owner Raj", "owner Imran with phone 9876543210". Required: name. Optional: phone, email.

### MCP description

Create an owner. Requires name.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Owner name. |
| phone | string | false | Phone number. |
| email | string | false | Email address. |

---

## get_owner

- **Category:** owner
- **Read-only:** true
- **Handler:** getOwner

### When to use (internal / WhatsApp)

Get full details of a single owner by ownerId. Use this AFTER get_owners (search) when you have a specific ownerId. Triggers: "owner details", "show owner O123", "tell me about this owner", "iska details". Required: ownerId. Do NOT use for listing — use get_owners for that.

### MCP description

Get an owner by ownerId. Use after get_owners.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerId | string | true | The unique ID of the owner. |

---

## get_owners

- **Category:** owner
- **Read-only:** true
- **Handler:** getOwners

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, or show owners. Triggers: "owners dikhao", "show owners", "list all owners", "owners batao", "find owner Raj", "owner with phone 9876543210". Extract parameters: query (name/phone), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).

### MCP description

List owners with optional status filter.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string (active, inactive) | false | Filter by status. |
| query | string | false | Search by name or phone. |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_owner

- **Category:** owner
- **Read-only:** false
- **Handler:** updateOwner

### When to use (internal / WhatsApp)

Update an owner's name, phone, or status. Triggers: "update owner", "change owner phone", "edit owner", "owner ka phone update karo", "mark owner inactive". Required: ownerId. Provide only the fields to update.

### MCP description

Update an owner. Requires ownerId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerId | string | true | The unique ID of the owner. |
| name | string | false | New name. |
| phone | string | false | New phone. |
| status | string (active, inactive) | false | New status. |

---

## delete_owner

- **Category:** owner
- **Read-only:** false
- **Handler:** deleteOwner

### When to use (internal / WhatsApp)

Use this when the user asks to delete an owner. Triggers: "delete owner", "remove owner". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete an owner. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerId | string | true | The unique ID of the owner to delete. |

---

## create_owner_note

- **Category:** owner
- **Read-only:** false
- **Handler:** createOwnerNote

### When to use (internal / WhatsApp)

Add a free-text note to an owner. Triggers: "add note to owner", "note on owner O123", "comment on owner", "owner pe note add karo". Required: ownerId, content.

### MCP description

Add a note to an owner. Requires ownerId and content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerId | string | true | The unique ID of the owner. |
| content | string | true | The note content. |
| createdBy | string | false | Name of the person creating the note. |

---

## get_owner_notes

- **Category:** owner
- **Read-only:** true
- **Handler:** getOwnerNotes

### When to use (internal / WhatsApp)

Get all notes for an owner. Triggers: "show notes for owner", "owner ke notes", "comments on owner O123". Required: ownerId.

### MCP description

Get all notes for an owner. Requires ownerId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerId | string | true | The unique ID of the owner. |

---

## get_owner_by_phone

- **Category:** owner
- **Read-only:** true
- **Handler:** getOwnerByPhone

### When to use (internal / WhatsApp)

Find an owner by phone number. Use this BEFORE creating a new owner to avoid duplicates, or when the user asks to find an owner by phone. Triggers: "find owner by phone", "is number ka owner hai?", "check owner phone 9876543210". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.

### MCP description

Find an owner by phone number. Requires phone.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| phone | string | true | Phone number to search for. |

---

## create_buyer

- **Category:** buyer
- **Read-only:** false
- **Handler:** createBuyer

### When to use (internal / WhatsApp)

Use this when the user asks to create a new buyer. Triggers: "create buyer", "add buyer", "new buyer Rohan", "buyer Priya with budget 1 crore". Required: name. Optional: phone, email, budget, propertyType, bhk, priority.

### MCP description

Create a buyer. Requires name.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | true | Buyer name. |
| phone | string | false | Phone number. |
| email | string | false | Email address. |
| budget | number | false | Budget in rupees. |
| propertyType | string | false | Preferred property type. |
| bhk | number | false | Preferred BHK. |
| priority | string (low, medium, high) | false | Priority level. |

---

## get_buyer

- **Category:** buyer
- **Read-only:** true
- **Handler:** getBuyer

### When to use (internal / WhatsApp)

Get full details of a single buyer by buyerId. Use this AFTER search_buyers when you have a specific buyerId. Triggers: "buyer details", "show buyer B123", "tell me about this buyer", "iska details". Required: buyerId. Do NOT use for searching — use search_buyers for that.

### MCP description

Get a buyer by buyerId. Use after search_buyers.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| buyerId | string | true | The unique ID of the buyer. |

---

## search_buyers

- **Category:** buyer
- **Read-only:** true
- **Handler:** searchBuyers

### When to use (internal / WhatsApp)

Use this when the user asks to list, search, or show buyers. Triggers: "buyers dikhao", "show buyers", "buyers batao", "buyers with budget above 1 crore", "find buyer Rohan", "high priority buyers". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (in rupees), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Search buyers by query, status, or filters.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | false | Search by name or phone. |
| status | string (active, inactive) | false | Filter by status. |
| minBudget | number | false | Minimum budget in rupees. |
| maxBudget | number | false | Maximum budget in rupees. |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_buyer

- **Category:** buyer
- **Read-only:** false
- **Handler:** updateBuyer

### When to use (internal / WhatsApp)

Update a buyer's budget, status, or priority. Triggers: "update buyer", "change buyer budget", "edit buyer", "buyer ka budget update karo", "mark buyer inactive", "change priority". Required: buyerId. Provide only the fields to update.

### MCP description

Update a buyer. Requires buyerId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| buyerId | string | true | The unique ID of the buyer. |
| budget | number | false | New budget in rupees. |
| status | string (active, inactive) | false | New status. |
| priority | string (low, medium, high) | false | New priority. |

---

## delete_buyer

- **Category:** buyer
- **Read-only:** false
- **Handler:** deleteBuyer

### When to use (internal / WhatsApp)

Use this when the user asks to delete a buyer. Triggers: "delete buyer", "remove buyer". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete a buyer. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| buyerId | string | true | The unique ID of the buyer to delete. |

---

## create_buyer_note

- **Category:** buyer
- **Read-only:** false
- **Handler:** createBuyerNote

### When to use (internal / WhatsApp)

Add a free-text note to a buyer. Triggers: "add note to buyer", "note on buyer B123", "comment on buyer", "buyer pe note add karo". Required: buyerId, content.

### MCP description

Add a note to a buyer. Requires buyerId and content.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| buyerId | string | true | The unique ID of the buyer. |
| content | string | true | The note content. |
| createdBy | string | false | Name of the person creating the note. |

---

## get_buyer_notes

- **Category:** buyer
- **Read-only:** true
- **Handler:** getBuyerNotes

### When to use (internal / WhatsApp)

Get all notes for a buyer. Triggers: "show notes for buyer", "buyer ke notes", "comments on buyer B123". Required: buyerId.

### MCP description

Get all notes for a buyer. Requires buyerId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| buyerId | string | true | The unique ID of the buyer. |

---

## create_meeting

- **Category:** meeting
- **Read-only:** false
- **Handler:** createMeeting

### When to use (internal / WhatsApp)

Use this when the user asks to create or schedule a meeting. Triggers: "create meeting", "schedule meeting", "meeting with Rohan tomorrow", "meeting with owner Raj next week". Required: title, scheduledDate. Optional: relatedEntityType, relatedEntityId, notes.

### MCP description

Create a meeting. Requires title and scheduledDate.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | true | Meeting title. |
| scheduledDate | string | true | Meeting date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss). |
| relatedEntityType | string (lead, buyer, owner, tenant, contact) | false | Type of entity the meeting is related to. |
| relatedEntityId | string | false | ID of the related entity. |
| notes | string | false | Meeting notes or description. |

---

## get_meeting

- **Category:** meeting
- **Read-only:** true
- **Handler:** getMeeting

### When to use (internal / WhatsApp)

Get full details of a single meeting by meetingId. Use this AFTER get_upcoming_meetings when you have a specific meetingId. Triggers: "meeting details", "show meeting M123", "tell me about this meeting". Required: meetingId. Do NOT use for listing — use get_upcoming_meetings for that.

### MCP description

Get a meeting by meetingId. Use after get_upcoming_meetings.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| meetingId | string | true | The unique ID of the meeting. |

---

## get_upcoming_meetings

- **Category:** meeting
- **Read-only:** true
- **Handler:** getUpcomingMeetings

### When to use (internal / WhatsApp)

Use this when the user asks to see upcoming meetings. Triggers: "upcoming meetings", "meetings dikhao", "meetings for today", "meetings for next 7 days", "my meetings". Extract parameters: days (number of days to look ahead, default 7), limit (max results), responseMode (summary|compact|details|full).

### MCP description

Get upcoming meetings for the next N days.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| days | number | false | Number of days to look ahead (default 7). |
| limit | number | false | Maximum number of results. |
| responseMode | string (summary, compact, details, full) | false | Response detail level. |

---

## update_meeting

- **Category:** meeting
- **Read-only:** false
- **Handler:** updateMeeting

### When to use (internal / WhatsApp)

Update a meeting's title, date, notes, or status. Triggers: "update meeting", "reschedule meeting", "cancel meeting", "meeting ka time change karo", "mark meeting completed". Required: meetingId. Provide only the fields to update.

### MCP description

Update a meeting. Requires meetingId.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| meetingId | string | true | The unique ID of the meeting. |
| title | string | false | New title. |
| scheduledDate | string | false | New date. |
| notes | string | false | New notes. |
| status | string (scheduled, completed, cancelled) | false | New status. |

---

## delete_meeting

- **Category:** meeting
- **Read-only:** false
- **Handler:** deleteMeeting

### When to use (internal / WhatsApp)

Use this when the user asks to delete or cancel a meeting. Triggers: "delete meeting", "cancel meeting", "remove meeting". IMPORTANT: Always ask for confirmation before calling this tool.

### MCP description

Delete a meeting. IMPORTANT: Always ask for confirmation before calling this tool.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| meetingId | string | true | The unique ID of the meeting to delete. |

---

## get_crm_metrics

- **Category:** metrics
- **Read-only:** true
- **Handler:** getCRMMetrics

### When to use (internal / WhatsApp)

Use this when the user asks for CRM metrics, statistics, or a summary. Triggers: "metrics dikhao", "show metrics", "CRM summary", "how many leads", "pipeline stats", "statistics batao". Returns: total leads, leads by status, leads by type, total properties, total owners, total tenants, total buyers, total meetings, etc.

### MCP description

Get CRM metrics and statistics.

### Parameters

None.

---

## get_leads_summary

- **Category:** metrics
- **Read-only:** true
- **Handler:** getLeadsSummary

### When to use (internal / WhatsApp)

Use this when the user asks HOW MANY leads or wants a leads breakdown (not a full list). Triggers: "how many leads", "kitni leads hain", "leads breakdown", "leads by type", "leads summary", "total leads". Returns counts by type (buyer/seller/tenant/owner), by status, by priority, and unassigned. Prefer this over search_leads when the user only wants numbers. Prefer this over get_crm_metrics when the question is specifically about leads.

### MCP description

Get a focused lead summary: totals and breakdown by type, status, and priority.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| leadType | string (buyer, seller, tenant, owner) | false | Optional: restrict the summary to one lead type. |

---

## get_properties_summary

- **Category:** metrics
- **Read-only:** true
- **Handler:** getPropertiesSummary

### When to use (internal / WhatsApp)

Use this when the user asks about property inventory counts. Triggers: "how many properties", "kitni properties hain", "inventory status", "available properties count", "properties summary". Returns total, available, on-hold, rented, sold, pending agreements/verifications, and by type. Prefer this over search_properties when the user only wants numbers.

### MCP description

Get a focused property inventory summary.

### Parameters

None.

---

## get_buyers_summary

- **Category:** metrics
- **Read-only:** true
- **Handler:** getBuyersSummary

### When to use (internal / WhatsApp)

Use this when the user asks about buyer demand counts. Triggers: "how many buyers", "kitne buyers hain", "buyers summary", "buyer demand". Returns total, active, high-priority count, average budget, and by-priority breakdown.

### MCP description

Get a focused buyer demand summary.

### Parameters

None.

---

## get_pipeline_summary

- **Category:** metrics
- **Read-only:** true
- **Handler:** getPipelineSummary

### When to use (internal / WhatsApp)

Use this when the user asks about the sales pipeline or funnel. Triggers: "pipeline", "funnel", "conversion rate", "pipeline status", "kitne convert hue". Returns stage counts (new/contacted/qualified/negotiating/converted/lost), active-in-pipeline, and conversion rate.

### MCP description

Get the sales pipeline funnel and conversion rate.

### Parameters

None.

---

## get_followup_summary

- **Category:** metrics
- **Read-only:** true
- **Handler:** getFollowupSummary

### When to use (internal / WhatsApp)

Use this when the user asks about pending follow-ups. Triggers: "follow-ups", "pending followups", "kise call karna hai", "overdue leads", "kitne followups pending". Returns overdue lead count, today/tomorrow meeting counts, and the top overdue leads with days since last contact.

### MCP description

Get pending follow-ups: overdue leads and upcoming meetings.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| staleDays | number | false | Days without contact before a lead counts as overdue (default 5). |

---

## get_priority_leads

- **Category:** metrics
- **Read-only:** true
- **Handler:** getPriorityLeads

### When to use (internal / WhatsApp)

Use this when the user asks who to contact first or for hot/priority leads. Triggers: "who should I call", "aaj kise call karu", "priority leads", "hot leads", "most important leads". Returns a ranked list of leads, each with a human-readable reason (e.g. "high budget, no contact in 6 days").

### MCP description

Get ranked priority leads with a reason for each.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | false | Max leads to return (default 5). |

---

## get_recent_activity

- **Category:** metrics
- **Read-only:** true
- **Handler:** getRecentActivity

### When to use (internal / WhatsApp)

Use this when the user asks what happened recently. Triggers: "recent activity", "kya naya hua", "yesterday activity", "this week summary", "what changed". Returns counts of new leads, new properties, completed meetings, and conversions over the last N days.

### MCP description

Get recent CRM activity over the last N days.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| days | number | false | Look-back window in days (default 7). |

---

## get_daily_brief

- **Category:** metrics
- **Read-only:** true
- **Handler:** getDailyBrief

### When to use (internal / WhatsApp)

Use this for a morning briefing or when the user greets you at the start of the day. Triggers: "good morning", "daily brief", "aaj ka plan", "todays snapshot", "brief me". Returns new leads today, meetings today, overdue follow-ups, pending agreements/verifications, and the top hot leads.

### MCP description

Get a daily briefing snapshot for the agent.

### Parameters

None.

---

## suggest_next_actions

- **Category:** metrics
- **Read-only:** true
- **Handler:** suggestNextActions

### When to use (internal / WhatsApp)

Use this when the user asks what to do next. Triggers: "what should I do today", "kya karu aaj", "next actions", "what next", "suggest tasks". Returns a prioritised list of concrete actions (call X, attend meeting Y, progress agreement Z) each with a reason.

### MCP description

Suggest prioritised next actions for the agent.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | false | Max actions to return (default 5). |

---

## get_business_health

- **Category:** metrics
- **Read-only:** true
- **Handler:** getBusinessHealth

### When to use (internal / WhatsApp)

Use this when the user asks how the business is doing. Triggers: "business health", "how are we doing", "business kaisa chal raha hai", "trends". Returns 7-day lead inflow vs previous 7 days (with trend), 30-day conversions, pending follow-ups, and alerts.

### MCP description

Get business health with week-over-week trends and alerts.

### Parameters

None.

---

## get_dashboard_snapshot

- **Category:** metrics
- **Read-only:** true
- **Handler:** getDashboardSnapshot

### When to use (internal / WhatsApp)

Use this when the user wants a full overview of everything at once. Triggers: "dashboard", "overview", "full summary", "sab kuch dikhao", "complete status". Returns a combined snapshot: leads summary, properties summary, pipeline, follow-ups, and top priority leads. Use focused tools (get_leads_summary etc.) when the user asks about only one area.

### MCP description

Get a combined dashboard snapshot across leads, properties, pipeline, and follow-ups.

### Parameters

None.

---

