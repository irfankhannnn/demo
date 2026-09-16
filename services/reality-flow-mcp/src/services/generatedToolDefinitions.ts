/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Source:    apps/crm/server/shared/toolDefinitions.js (canonical registry)
 * Generator: apps/crm/server/scripts/generate-mcp-tools.mjs
 * Regenerate: npm run generate:mcp-tools   (also runs on the MCP prebuild)
 *
 * Any edit here is lost on the next build. Change the canonical registry
 * instead — that is what makes the WhatsApp agent, the CRM backend and this
 * MCP service expose the same 72 tools.
 *
 * The interfaces, the MCP schema conversion and the OAuth scope mapping are
 * NOT generated; they live in ./toolDefinitions.ts, which imports this file.
 */

import type { ToolDefinition } from './toolDefinitions';

/** 72 CRM tools, generated from the canonical registry. */
export const generatedToolDefinitions: ToolDefinition[] = [
  {
    name: "create_lead",
    category: "lead",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new lead. Triggers: \"create lead\", \"add lead\", \"new buyer lead\", \"seller lead Raj\", \"tenant lead Sarah\", \"owner lead Imran\". Required: name, leadType (buyer|seller|tenant|owner). Optional: phone, email, and type-specific nested objects (buyerRequirement, sellerProperty, ownerProperty, tenantRequirement).",
      mcp: "Create a new CRM lead. Requires name and leadType (buyer|seller|tenant|owner). Optional: phone, email, buyerRequirement, sellerProperty, ownerProperty, tenantRequirement.",
    },
    handler: "createLead",
    parameters: [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Full name of the lead (e.g., \"Raj Sharma\", \"Faizan Khan\")."
      },
      {
        "name": "leadType",
        "type": "string",
        "required": true,
        "description": "Type of lead: \"buyer\", \"seller\", \"tenant\", or \"owner\".",
        "enum": [
          "buyer",
          "seller",
          "tenant",
          "owner"
        ]
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "Phone number (10 digits). Required before convert_lead."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "Email address (e.g., \"raj@example.com\"). Optional."
      },
      {
        "name": "buyerRequirement",
        "type": "object",
        "required": false,
        "description": "Buyer lead requirements (buyer leads only). Use for budget, BHK, area, etc.",
        "properties": {
          "budget": {
            "type": "number",
            "description": "Budget in rupees (e.g. 28000000 for 2.8Cr)."
          },
          "preferredArea": {
            "type": "string",
            "description": "Preferred area or locality."
          },
          "bhk": {
            "type": "string",
            "description": "BHK (e.g. \"2\", \"3\")."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type (e.g. apartment, villa)."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing (furnished, semi-furnished, unfurnished)."
          },
          "requirement": {
            "type": "string",
            "description": "Free-text requirement summary."
          }
        }
      },
      {
        "name": "sellerProperty",
        "type": "object",
        "required": false,
        "description": "Seller lead property details (seller leads only).",
        "properties": {
          "expectedPrice": {
            "type": "number",
            "description": "Expected sale price in rupees."
          },
          "area": {
            "type": "string",
            "description": "Area or locality."
          },
          "city": {
            "type": "string",
            "description": "City."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "bhk": {
            "type": "string",
            "description": "BHK."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "buildingName": {
            "type": "string",
            "description": "Building or society name."
          },
          "flatNumber": {
            "type": "string",
            "description": "Flat or unit number."
          },
          "floor": {
            "type": "string",
            "description": "Floor."
          },
          "carpetArea": {
            "type": "number",
            "description": "Carpet area in sq ft."
          },
          "address": {
            "type": "string",
            "description": "Full address."
          },
          "timelineValue": {
            "type": "number",
            "description": "Sale timeline value (e.g. 3)."
          },
          "timelineUnit": {
            "type": "string",
            "description": "Sale timeline unit (e.g. months)."
          }
        }
      },
      {
        "name": "ownerProperty",
        "type": "object",
        "required": false,
        "description": "Owner lead rental property details (owner leads only).",
        "properties": {
          "rentExpected": {
            "type": "number",
            "description": "Expected monthly rent in rupees."
          },
          "securityDeposit": {
            "type": "number",
            "description": "Security deposit in rupees."
          },
          "area": {
            "type": "string",
            "description": "Area or locality."
          },
          "city": {
            "type": "string",
            "description": "City."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "bhk": {
            "type": "string",
            "description": "BHK."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "buildingName": {
            "type": "string",
            "description": "Building or society name."
          },
          "flatNumber": {
            "type": "string",
            "description": "Flat or unit number."
          },
          "floor": {
            "type": "string",
            "description": "Floor."
          },
          "carpetArea": {
            "type": "number",
            "description": "Carpet area in sq ft."
          },
          "address": {
            "type": "string",
            "description": "Full address."
          }
        }
      },
      {
        "name": "tenantRequirement",
        "type": "object",
        "required": false,
        "description": "Tenant lead requirements (tenant leads only). Use for rent budget, BHK, area, etc.",
        "properties": {
          "budget": {
            "type": "number",
            "description": "Monthly rent budget in rupees."
          },
          "preferredArea": {
            "type": "string",
            "description": "Preferred area or locality."
          },
          "bhk": {
            "type": "string",
            "description": "BHK (e.g. \"2\", \"3\")."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "requirement": {
            "type": "string",
            "description": "Free-text requirement summary."
          }
        }
      }
    ],
  },
  {
    name: "get_lead",
    category: "lead",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single lead by leadId. Use this when the user asks for details of a SPECIFIC lead by ID or name after you already have the leadId from a previous search. Triggers: \"lead details\", \"tell me about lead L123\", \"show lead abc123\", \"iska details dikhao\". Required: leadId. Do NOT use this for searching — use search_leads for that.",
      mcp: "Get a single lead by leadId. Use after search_leads when you have a specific leadId.",
    },
    handler: "getLead",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead (e.g., \"lead-abc123\")."
      }
    ],
  },
  {
    name: "search_leads",
    category: "lead",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, show, or find leads. Triggers: \"leads dikhao\", \"show leads\", \"Kurla ke leads\", \"buyer leads\", \"hot leads\", \"new leads\", \"leads assigned to Aman\", \"hot leads above 1 crore\", \"sari leads\", \"all leads\". Pass filters only in parameters — layout is NOT your job. For default business rows omit listTemplate. When user asks for specific columns (e.g. name+phone+type only) set listTemplate \"contact\" OR responseFields \"phone,leadType\". System renders the list; reply empty or one short intro line. One search_leads call per request.",
      mcp: "Search leads by query, status, leadType, or filters. Supports listTemplate for deterministic list layout.",
    },
    handler: "searchLeads",
    parameters: [
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by lead name, phone number, or area (e.g., \"Kurla\", \"Faizan\", \"9876543210\"). Leave empty to list all leads."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by lead status (lowercase). Use \"converted\" for already-converted leads; default lists exclude converted.",
        "enum": [
          "new",
          "contacted",
          "qualified",
          "negotiating",
          "lost",
          "converted"
        ]
      },
      {
        "name": "leadType",
        "type": "string",
        "required": false,
        "description": "Filter by lead type. MUST be lowercase: \"buyer\", \"seller\", \"tenant\", or \"owner\". Leave empty for all types.",
        "enum": [
          "buyer",
          "seller",
          "tenant",
          "owner"
        ]
      },
      {
        "name": "temperature",
        "type": "string",
        "required": false,
        "description": "Filter by lead temperature. MUST be lowercase: \"hot\", \"warm\", \"cold\", or \"unscored\". Leave empty for all.",
        "enum": [
          "hot",
          "warm",
          "cold",
          "unscored"
        ]
      },
      {
        "name": "assignedTo",
        "type": "string",
        "required": false,
        "description": "Filter by agent name (e.g., \"Aman\"). Leave empty for all agents."
      },
      {
        "name": "minBudget",
        "type": "number",
        "required": false,
        "description": "Minimum budget in rupees (e.g., 8000000 for 80L). Leave empty for no minimum."
      },
      {
        "name": "maxBudget",
        "type": "number",
        "required": false,
        "description": "Maximum budget in rupees (e.g., 10000000 for 1Cr). Leave empty for no maximum."
      },
      {
        "name": "sortBy",
        "type": "string",
        "required": false,
        "description": "Sort results by field. Leave empty for default order.",
        "enum": [
          "recent_first",
          "budget_desc",
          "budget_asc",
          "score_desc",
          "name_asc"
        ]
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of leads to return (e.g., 10, 20). Leave empty for default."
      },
      {
        "name": "listTemplate",
        "type": "string",
        "required": false,
        "description": "List layout preset. Default lead_card (type, area, requirement, budget). Use contact for name+phone+type dialing lists; followup for phone+last activity; assignment for owner+status. System renders — do not format in reply.",
        "enum": [
          "lead_card",
          "contact",
          "followup",
          "assignment",
          "name_only"
        ]
      },
      {
        "name": "responseFields",
        "type": "string",
        "required": false,
        "description": "Optional comma-separated field ids for custom columns: phone, leadType, status, area, requirement, budget, assignedTo, lastActivityAt, source, temperature, email. Prefer listTemplate when a preset fits."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Legacy: summary → names only. Prefer listTemplate. Default list uses lead_card.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_lead",
    category: "lead",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to update a lead. Triggers: \"update lead\", \"change status\", \"mark as contacted\", \"update budget\", \"assign to Aman\", \"mark lost\". Required: leadId. For structured updates (budget, BHK, area), use buyerRequirement/sellerProperty/ownerProperty/tenantRequirement objects instead of notes. Example: user says \"update budget to 1 crore\" → update buyerRequirement.budget, not create a note.",
      mcp: "Update a lead. Include leadId.",
    },
    handler: "updateLead",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead to update (e.g., \"lead-abc123\")."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New status.",
        "enum": [
          "new",
          "contacted",
          "qualified",
          "negotiating",
          "lost",
          "archived"
        ]
      },
      {
        "name": "score",
        "type": "string",
        "required": false,
        "description": "Manually set the lead temperature. Setting this is recorded as a human override (scoreSource becomes \"manual\").",
        "enum": [
          "HOT",
          "WARM",
          "COLD"
        ]
      },
      {
        "name": "assignedTo",
        "type": "string",
        "required": false,
        "description": "Agent name to assign the lead to (e.g., \"Aman\")."
      },
      {
        "name": "notes",
        "type": "string",
        "required": false,
        "description": "Free-text notes to add to the lead. Use for unstructured updates only."
      },
      {
        "name": "buyerRequirement",
        "type": "object",
        "required": false,
        "description": "Buyer lead requirements (buyer leads only). Use for budget, BHK, area, etc.",
        "properties": {
          "budget": {
            "type": "number",
            "description": "Budget in rupees (e.g. 28000000 for 2.8Cr)."
          },
          "preferredArea": {
            "type": "string",
            "description": "Preferred area or locality."
          },
          "bhk": {
            "type": "string",
            "description": "BHK (e.g. \"2\", \"3\")."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type (e.g. apartment, villa)."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing (furnished, semi-furnished, unfurnished)."
          },
          "requirement": {
            "type": "string",
            "description": "Free-text requirement summary."
          }
        }
      },
      {
        "name": "sellerProperty",
        "type": "object",
        "required": false,
        "description": "Seller lead property details (seller leads only).",
        "properties": {
          "expectedPrice": {
            "type": "number",
            "description": "Expected sale price in rupees."
          },
          "area": {
            "type": "string",
            "description": "Area or locality."
          },
          "city": {
            "type": "string",
            "description": "City."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "bhk": {
            "type": "string",
            "description": "BHK."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "buildingName": {
            "type": "string",
            "description": "Building or society name."
          },
          "flatNumber": {
            "type": "string",
            "description": "Flat or unit number."
          },
          "floor": {
            "type": "string",
            "description": "Floor."
          },
          "carpetArea": {
            "type": "number",
            "description": "Carpet area in sq ft."
          },
          "address": {
            "type": "string",
            "description": "Full address."
          },
          "timelineValue": {
            "type": "number",
            "description": "Sale timeline value (e.g. 3)."
          },
          "timelineUnit": {
            "type": "string",
            "description": "Sale timeline unit (e.g. months)."
          }
        }
      },
      {
        "name": "ownerProperty",
        "type": "object",
        "required": false,
        "description": "Owner lead rental property details (owner leads only).",
        "properties": {
          "rentExpected": {
            "type": "number",
            "description": "Expected monthly rent in rupees."
          },
          "securityDeposit": {
            "type": "number",
            "description": "Security deposit in rupees."
          },
          "area": {
            "type": "string",
            "description": "Area or locality."
          },
          "city": {
            "type": "string",
            "description": "City."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "bhk": {
            "type": "string",
            "description": "BHK."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "buildingName": {
            "type": "string",
            "description": "Building or society name."
          },
          "flatNumber": {
            "type": "string",
            "description": "Flat or unit number."
          },
          "floor": {
            "type": "string",
            "description": "Floor."
          },
          "carpetArea": {
            "type": "number",
            "description": "Carpet area in sq ft."
          },
          "address": {
            "type": "string",
            "description": "Full address."
          }
        }
      },
      {
        "name": "tenantRequirement",
        "type": "object",
        "required": false,
        "description": "Tenant lead requirements (tenant leads only). Use for rent budget, BHK, area, etc.",
        "properties": {
          "budget": {
            "type": "number",
            "description": "Monthly rent budget in rupees."
          },
          "preferredArea": {
            "type": "string",
            "description": "Preferred area or locality."
          },
          "bhk": {
            "type": "string",
            "description": "BHK (e.g. \"2\", \"3\")."
          },
          "propertyType": {
            "type": "string",
            "description": "Property type."
          },
          "propertySubType": {
            "type": "string",
            "description": "Property sub-type."
          },
          "furnishing": {
            "type": "string",
            "description": "Furnishing."
          },
          "requirement": {
            "type": "string",
            "description": "Free-text requirement summary."
          }
        }
      }
    ],
  },
  {
    name: "archive_lead",
    category: "lead",
    readOnly: false,
    descriptions: {
      internal: "Archive a lead (soft-remove, reversible). Sets status to archived; does not delete the record. Triggers: \"archive lead\", \"stop tracking this lead\", \"hide this lead\", \"delete lead\" (there is no delete tool -- archive is the correct action). Note: cannot archive an already-converted lead (its buyer/seller/tenant/owner record is the live entity at that point).",
      mcp: "Archive a lead by setting its status to archived. Reversible via update_lead.",
    },
    handler: "archiveLead",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead to archive."
      }
    ],
  },
  {
    name: "convert_lead",
    category: "lead",
    readOnly: false,
    descriptions: {
      internal: "Convert a lead into a buyer, seller, tenant, or owner record. REQUIRED: leadId and the lead must have a phone number on file. Use update_lead to add phone first if missing. If you pass purchaseDetails or leaseDetails, propertyId inside that object is REQUIRED. Triggers: \"convert lead\", \"make buyer from lead\", \"lead ko buyer banao\". Do NOT use update_lead with status converted.",
      mcp: "Convert a lead to buyer/seller/tenant/owner. Requires leadId and lead phone. purchaseDetails.propertyId required when purchaseDetails is sent; same for leaseDetails.",
    },
    handler: "convertLead",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead to convert."
      },
      {
        "name": "purchaseDetails",
        "type": "object",
        "required": false,
        "description": "Buyer conversion only. If provided, must include propertyId. Optional: saleAmount, purchaseDate, registrationNumber, notes."
      },
      {
        "name": "leaseDetails",
        "type": "object",
        "required": false,
        "description": "Tenant conversion only. If provided, must include propertyId. Optional: monthlyRent, leaseStartDate, securityDeposit."
      },
      {
        "name": "kycDetails",
        "type": "object",
        "required": false,
        "description": "Optional KYC fields (panNumber, aadharNumber)."
      },
      {
        "name": "existingContactId",
        "type": "string",
        "required": false,
        "description": "Optional existing contact to link when converting."
      },
      {
        "name": "createPropertyListing",
        "type": "boolean",
        "required": false,
        "description": "For seller leads, whether to auto-create a for-sale property (default true)."
      }
    ],
  },
  {
    name: "create_lead_note",
    category: "lead",
    readOnly: false,
    descriptions: {
      internal: "Add a free-text note to a lead. Use this when the user asks to add a note, comment, or remark to a lead (NOT for structured updates like budget/BHK — use update_lead for those). Triggers: \"add note to lead\", \"note on lead L123\", \"comment on lead\", \"lead pe note add karo\", \"remark\". Required: leadId, content.",
      mcp: "Add a note to a lead. Requires leadId and content.",
    },
    handler: "createLeadNote",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead."
      },
      {
        "name": "content",
        "type": "string",
        "required": true,
        "description": "The note content."
      },
      {
        "name": "createdBy",
        "type": "string",
        "required": false,
        "description": "Name of the person creating the note."
      }
    ],
  },
  {
    name: "get_lead_notes",
    category: "lead",
    readOnly: true,
    descriptions: {
      internal: "Get all notes for a lead. Use this when the user asks to see notes, comments, or remarks on a specific lead. Triggers: \"show notes for lead\", \"lead ke notes\", \"comments on lead L123\", \"lead ka history\". Required: leadId.",
      mcp: "Get all notes for a lead. Requires leadId.",
    },
    handler: "getLeadNotes",
    parameters: [
      {
        "name": "leadId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the lead."
      }
    ],
  },
  {
    name: "create_contact",
    category: "contact",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new contact. Triggers: \"create contact\", \"add contact\", \"new contact Faizan\", \"contact Raj with phone 9876543210\". Required: name. Optional: phone, email, role (owner|buyer|seller|tenant).",
      mcp: "Create a contact. Requires name.",
    },
    handler: "createContact",
    parameters: [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Contact name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "Phone number."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "Email address."
      },
      {
        "name": "role",
        "type": "string",
        "required": false,
        "description": "Contact role.",
        "enum": [
          "owner",
          "buyer",
          "seller",
          "tenant"
        ]
      }
    ],
  },
  {
    name: "get_contact",
    category: "contact",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single contact by contactId. Use this AFTER search_contacts when you have a specific contactId and need full details. Triggers: \"contact details\", \"show contact C123\", \"tell me about this contact\", \"iska details\". Required: contactId. Do NOT use for searching — use search_contacts for that.",
      mcp: "Get a contact by contactId. Use after search_contacts.",
    },
    handler: "getContact",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact."
      }
    ],
  },
  {
    name: "search_contacts",
    category: "contact",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, or show contacts. Triggers: \"contacts dikhao\", \"show contacts\", \"contacts batao\", \"contacts with role owner\", \"find contact Faizan\", \"active contacts\". Extract parameters: query (name/phone), role (owner|buyer|seller|tenant), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).",
      mcp: "Search contacts by role or status.",
    },
    handler: "getContacts",
    parameters: [
      {
        "name": "role",
        "type": "string",
        "required": false,
        "description": "Filter by role.",
        "enum": [
          "owner",
          "buyer",
          "seller",
          "tenant"
        ]
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by status. Archived contacts are excluded unless explicitly requested.",
        "enum": [
          "active",
          "inactive",
          "archived"
        ]
      },
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by name or phone."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_contact",
    category: "contact",
    readOnly: false,
    descriptions: {
      internal: "Update a contact's name, phone, or email. Use this when the user asks to edit or change contact info. Triggers: \"update contact\", \"change contact phone\", \"edit contact\", \"contact ka phone update karo\". Required: contactId. Provide only the fields to update.",
      mcp: "Update a contact. Requires contactId.",
    },
    handler: "updateContact",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact."
      },
      {
        "name": "name",
        "type": "string",
        "required": false,
        "description": "New name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "New phone."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "New email."
      }
    ],
  },
  {
    name: "archive_contact",
    category: "contact",
    readOnly: false,
    descriptions: {
      internal: "Archive a contact (soft-remove, reversible). Marks the contact as archived; does not delete the record. Triggers: \"archive contact\", \"stop tracking this contact\", \"hide this contact\", \"delete contact\" (there is no delete tool -- archive is the correct action).",
      mcp: "Archive a contact. Reversible via update_contact.",
    },
    handler: "archiveContact",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact to archive."
      }
    ],
  },
  {
    name: "update_contact_role",
    category: "contact",
    readOnly: false,
    descriptions: {
      internal: "Add or remove a role (owner|buyer|seller|tenant) on a unified contact. Use this when the user asks to change a contact's role or add them as an owner/buyer/seller/tenant. Triggers: \"make contact an owner\", \"add buyer role\", \"remove seller role\", \"contact ko owner banao\", \"add as tenant\". Required: contactId, role, enabled (true to add, false to remove).",
      mcp: "Add or remove a role on a unified contact. Requires contactId, role, enabled.",
    },
    handler: "updateContactRole",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact."
      },
      {
        "name": "role",
        "type": "string",
        "required": true,
        "description": "The role to add or remove.",
        "enum": [
          "owner",
          "buyer",
          "seller",
          "tenant"
        ]
      },
      {
        "name": "enabled",
        "type": "boolean",
        "required": true,
        "description": "true to add the role, false to remove it."
      },
      {
        "name": "profileData",
        "type": "object",
        "required": false,
        "description": "Optional role-specific profile data."
      }
    ],
  },
  {
    name: "create_contact_note",
    category: "contact",
    readOnly: false,
    descriptions: {
      internal: "Add a free-text note to a contact. Triggers: \"add note to contact\", \"note on contact C123\", \"comment on contact\", \"contact pe note add karo\". Required: contactId, content.",
      mcp: "Add a note to a contact. Requires contactId and content.",
    },
    handler: "createContactNote",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact."
      },
      {
        "name": "content",
        "type": "string",
        "required": true,
        "description": "The note content."
      },
      {
        "name": "createdBy",
        "type": "string",
        "required": false,
        "description": "Name of the person creating the note."
      }
    ],
  },
  {
    name: "get_contact_notes",
    category: "contact",
    readOnly: true,
    descriptions: {
      internal: "Get all notes for a contact. Triggers: \"show notes for contact\", \"contact ke notes\", \"comments on contact C123\". Required: contactId.",
      mcp: "Get all notes for a contact. Requires contactId.",
    },
    handler: "getContactNotes",
    parameters: [
      {
        "name": "contactId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the contact."
      }
    ],
  },
  {
    name: "search_khata_entries",
    category: "khata",
    readOnly: true,
    descriptions: {
      internal: "List khata (ledger) entries — paisa lena-dena. Triggers: \"khata dikhao\", \"kitna lena hai\", \"kitna dena hai\", \"pending payments\", \"hisaab dikhao\", \"ledger entries\". Filter by settlementStatus (PENDING/SETTLED), transactionType (RECEIVED/PAID), propertyId, partyId, or a name/description query. Read-only: you cannot add or settle an entry — if the user asks to record or settle money, tell them to do it in the CRM.",
      mcp: "List khata ledger entries. Filter by settlement status, transaction type, property, party, or free text. Read-only.",
    },
    handler: "searchKhataEntries",
    parameters: [
      {
        "name": "settlementStatus",
        "type": "string",
        "required": false,
        "description": "Only entries with this settlement status.",
        "enum": [
          "PENDING",
          "SETTLED"
        ]
      },
      {
        "name": "transactionType",
        "type": "string",
        "required": false,
        "description": "Money received vs money paid out.",
        "enum": [
          "RECEIVED",
          "PAID"
        ]
      },
      {
        "name": "propertyId",
        "type": "string",
        "required": false,
        "description": "Restrict to one property."
      },
      {
        "name": "partyId",
        "type": "string",
        "required": false,
        "description": "Restrict to one owner/tenant/buyer."
      },
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search party name or description."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Max entries to return (default 20)."
      }
    ],
  },
  {
    name: "get_khata_summary",
    category: "khata",
    readOnly: true,
    descriptions: {
      internal: "Khata totals: money received, money paid, net, and how much is still pending (with the biggest pending items). Triggers: \"kitna paisa pending hai\", \"khata summary\", \"total hisaab\", \"net balance\", \"kitna baaki hai\". Optionally scope to one property or party. Read-only.",
      mcp: "Khata ledger summary: total received, total paid, net, pending count/amount and the largest pending entries.",
    },
    handler: "getKhataSummary",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": false,
        "description": "Restrict the summary to one property."
      },
      {
        "name": "partyId",
        "type": "string",
        "required": false,
        "description": "Restrict the summary to one owner/tenant/buyer."
      }
    ],
  },
  {
    name: "find_person",
    category: "contact",
    readOnly: true,
    descriptions: {
      internal: "Resolve WHO a person is when you do not know whether they are still a pipeline lead or an already-converted record. Searches leads AND buyers/owners/tenants/contacts at once, by name or phone, and tells you which forms exist with their IDs. Use this FIRST when the user names a person (\"Rajesh ka detail dikhao\", \"open Sakina\", \"9876543210 kaun hai?\") and you are not sure which entity type they mean -- then call the specific get_* tool with the ID this returns. Do not guess between search_leads and search_buyers when a single named person is meant.",
      mcp: "Resolve a person by name or phone across leads, buyers, owners, tenants and contacts. Returns every matching record with its type and ID.",
    },
    handler: "findPerson",
    parameters: [
      {
        "name": "query",
        "type": "string",
        "required": true,
        "description": "A person name (partial is fine) or a phone number."
      }
    ],
  },
  {
    name: "find_contact_by_phone",
    category: "contact",
    readOnly: true,
    descriptions: {
      internal: "Find a contact by phone number. Use this BEFORE creating a new contact to avoid duplicates, or when the user asks to find someone by phone. Triggers: \"find contact by phone\", \"is number ka contact hai?\", \"check phone 9876543210\", \"duplicate check\". Required: phone. NOTE: Use get_owner_by_phone or get_tenant_by_phone if you specifically need an owner or tenant.",
      mcp: "Find a contact by phone number. Requires phone.",
    },
    handler: "findContactByPhone",
    parameters: [
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "Phone number to search for."
      }
    ],
  },
  {
    name: "create_property",
    category: "property",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new property. Triggers: \"create property\", \"add property\", \"new apartment in Bandra\", \"property 3BHK in Andheri\". Required: title, propertyType (apartment|house|villa|office|land). Optional: city, area, ownerId.",
      mcp: "Create a property. Requires title and propertyType.",
    },
    handler: "createProperty",
    parameters: [
      {
        "name": "title",
        "type": "string",
        "required": true,
        "description": "Property title."
      },
      {
        "name": "propertyType",
        "type": "string",
        "required": true,
        "description": "Type of property.",
        "enum": [
          "apartment",
          "house",
          "villa",
          "office",
          "land"
        ]
      },
      {
        "name": "city",
        "type": "string",
        "required": false,
        "description": "City where the property is located."
      },
      {
        "name": "area",
        "type": "string",
        "required": false,
        "description": "Area/locality of the property."
      },
      {
        "name": "ownerId",
        "type": "string",
        "required": false,
        "description": "ID of the owner."
      }
    ],
  },
  {
    name: "get_property",
    category: "property",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single property by propertyId. Use this AFTER search_properties when you have a specific propertyId. Triggers: \"property details\", \"show property P123\", \"tell me about this property\", \"iska full details\". Required: propertyId. Do NOT use for searching — use search_properties for that.",
      mcp: "Get a property by propertyId. Use after search_properties.",
    },
    handler: "getProperty",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property."
      }
    ],
  },
  {
    name: "search_properties",
    category: "property",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, or show properties. Triggers: \"for-sale properties\", \"rent properties\", \"properties dikhao\", \"3BHK in Bandra\". Status values: not-listed, for-sale, for-rent, rented, sold, archived (lowercase).",
      mcp: "Search properties by status, city, or propertyType. Status: not-listed|for-sale|for-rent|rented|sold|archived.",
    },
    handler: "searchProperties",
    parameters: [
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by property marketing status (lowercase).",
        "enum": [
          "not-listed",
          "for-sale",
          "for-rent",
          "rented",
          "sold",
          "archived"
        ]
      },
      {
        "name": "city",
        "type": "string",
        "required": false,
        "description": "Filter by city."
      },
      {
        "name": "propertyType",
        "type": "string",
        "required": false,
        "description": "Filter by property type.",
        "enum": [
          "apartment",
          "house",
          "villa",
          "office",
          "land"
        ]
      },
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by title or area."
      },
      {
        "name": "ownerId",
        "type": "string",
        "required": false,
        "description": "Filter by owner ID."
      },
      {
        "name": "bhk",
        "type": "string",
        "required": false,
        "description": "Filter by BHK (1-5)."
      },
      {
        "name": "furnishing",
        "type": "string",
        "required": false,
        "description": "Filter by furnishing.",
        "enum": [
          "furnished",
          "semi-furnished",
          "unfurnished"
        ]
      },
      {
        "name": "minPrice",
        "type": "number",
        "required": false,
        "description": "Minimum price in rupees."
      },
      {
        "name": "maxPrice",
        "type": "number",
        "required": false,
        "description": "Maximum price in rupees."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "match_properties",
    category: "property",
    readOnly: true,
    descriptions: {
      internal: "Use this when the customer DESCRIBES what they want in their own words rather than giving exact filters. Triggers: \"kuch acha 3BHK dikhao station ke paas\", \"something quiet with parking\", \"family ke liye badi jagah chahiye\", \"show me something like the last one\". This searches by MEANING, so it finds a property described as \"spacious flat close to the metro\" even when the customer said \"bada ghar station ke paas\". Use search_properties instead when the user gives exact filters or a name/area lookup. Pass the customer's description verbatim as query — do not reduce it to keywords, the wording carries meaning.",
      mcp: "Semantically match properties against a natural-language description of what someone is looking for. Use when the requirement is described in prose; use search_properties for exact filters or name lookups.",
    },
    handler: "matchProperties",
    parameters: [
      {
        "name": "query",
        "type": "string",
        "required": true,
        "description": "The customer's description in their own words, e.g. \"quiet 3BHK near the metro with parking for a family\". Pass it verbatim."
      },
      {
        "name": "propertyType",
        "type": "string",
        "required": false,
        "description": "Filter by property type if the customer was explicit about it.",
        "enum": [
          "apartment",
          "house",
          "villa",
          "office",
          "land"
        ]
      },
      {
        "name": "minPrice",
        "type": "number",
        "required": false,
        "description": "Minimum budget in rupees (e.g. 8000000 for 80 lakhs)."
      },
      {
        "name": "maxPrice",
        "type": "number",
        "required": false,
        "description": "Maximum budget in rupees (e.g. 8000000 for 80 lakhs)."
      },
      {
        "name": "minBedrooms",
        "type": "number",
        "required": false,
        "description": "Minimum bedrooms (the number in \"3 BHK\")."
      },
      {
        "name": "maxBedrooms",
        "type": "number",
        "required": false,
        "description": "Maximum bedrooms."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by property marketing status (lowercase).",
        "enum": [
          "not-listed",
          "for-sale",
          "for-rent",
          "rented",
          "sold",
          "archived"
        ]
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum results to return (default 5)."
      }
    ],
  },
  {
    name: "update_property",
    category: "property",
    readOnly: false,
    descriptions: {
      internal: "Update a property's title, status, monthly rent, or sale price. Triggers: \"update property\", \"change rent\", \"mark property sold\", \"edit property title\", \"property ka rent update karo\". Required: propertyId. Provide only the fields to update.",
      mcp: "Update a property. Requires propertyId.",
    },
    handler: "updateProperty",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property."
      },
      {
        "name": "title",
        "type": "string",
        "required": false,
        "description": "New title."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New marketing status (lowercase): not-listed, for-sale, for-rent, rented, sold, archived.",
        "enum": [
          "not-listed",
          "for-sale",
          "for-rent",
          "rented",
          "sold",
          "archived"
        ]
      },
      {
        "name": "monthlyRent",
        "type": "number",
        "required": false,
        "description": "Monthly rent in rupees."
      },
      {
        "name": "salePrice",
        "type": "number",
        "required": false,
        "description": "Sale price in rupees."
      }
    ],
  },
  {
    name: "archive_property",
    category: "property",
    readOnly: false,
    descriptions: {
      internal: "Archive a property (soft-remove, reversible). Sets status to archived; does not delete the record. Triggers: \"archive property\", \"stop showing this property\", \"hide this property\", \"delete property\" (there is no delete tool -- archive is the correct action for stopping tracking of a listing).",
      mcp: "Archive a property by setting its status to archived. Reversible via update_property.",
    },
    handler: "archiveProperty",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property to archive."
      }
    ],
  },
  {
    name: "get_property_documents",
    category: "property",
    readOnly: true,
    descriptions: {
      internal: "Get all documents for a property. Triggers: \"show documents for property\", \"property ke documents\", \"papers for P123\", \"property ka file\". Required: propertyId.",
      mcp: "Get all documents for a property. Requires propertyId.",
    },
    handler: "getPropertyDocuments",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property."
      }
    ],
  },
  {
    name: "create_property_document",
    category: "property",
    readOnly: false,
    descriptions: {
      internal: "Add a document (deed, agreement, etc.) to a property. Triggers: \"add document to property\", \"upload deed for P123\", \"property pe document add karo\", \"attach agreement\". Required: propertyId, title, url. Optional: documentType.",
      mcp: "Add a document to a property. Requires propertyId, title, url.",
    },
    handler: "createPropertyDocument",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property."
      },
      {
        "name": "title",
        "type": "string",
        "required": true,
        "description": "Document title."
      },
      {
        "name": "url",
        "type": "string",
        "required": true,
        "description": "Document URL or S3 key."
      },
      {
        "name": "documentType",
        "type": "string",
        "required": false,
        "description": "Type of document (e.g., \"deed\", \"agreement\")."
      }
    ],
  },
  {
    name: "archive_property_document",
    category: "property",
    readOnly: false,
    descriptions: {
      internal: "Archive a property document (soft-remove, reversible). Does not delete the file/record. Triggers: \"archive document\", \"hide this document\", \"delete document\" (there is no delete tool -- archive is the correct action). Required: propertyId, documentId.",
      mcp: "Archive a property document. Requires propertyId, documentId.",
    },
    handler: "archivePropertyDocument",
    parameters: [
      {
        "name": "propertyId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the property."
      },
      {
        "name": "documentId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the document to archive."
      }
    ],
  },
  {
    name: "create_tenant",
    category: "tenant",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new tenant/customer. Triggers: \"create tenant\", \"add tenant\", \"new tenant Sarah\". Required: name and phone.",
      mcp: "Create a tenant. Requires name and phone.",
    },
    handler: "createCustomer",
    parameters: [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Tenant name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "Phone number (10 digits, required)."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "Email address."
      }
    ],
  },
  {
    name: "get_tenant",
    category: "tenant",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single tenant by tenantRecordId. Use this AFTER search_tenants when you have a specific tenantRecordId. Triggers: \"tenant details\", \"show tenant T123\", \"tell me about this tenant\", \"iska details\". Required: tenantRecordId. Do NOT use for searching — use search_tenants for that.",
      mcp: "Get a tenant by tenantRecordId. Use after search_tenants.",
    },
    handler: "getCustomer",
    parameters: [
      {
        "name": "tenantRecordId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the tenant."
      }
    ],
  },
  {
    name: "search_tenants",
    category: "tenant",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, or show tenants/customers. Triggers: \"tenants dikhao\", \"show tenants\", \"customers batao\", \"tenants with budget under 50k\", \"find tenant Sarah\", \"tenant in Powai\". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (monthly rent in rupees), limit (max results), responseMode (summary|compact|details|full).",
      mcp: "Search tenants by status.",
    },
    handler: "getCustomers",
    parameters: [
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by status.",
        "enum": [
          "active",
          "inactive"
        ]
      },
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by name or phone."
      },
      {
        "name": "minBudget",
        "type": "number",
        "required": false,
        "description": "Minimum budget in rupees."
      },
      {
        "name": "maxBudget",
        "type": "number",
        "required": false,
        "description": "Maximum budget in rupees."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_tenant",
    category: "tenant",
    readOnly: false,
    descriptions: {
      internal: "Update a tenant's name, phone, or status. Triggers: \"update tenant\", \"change tenant phone\", \"edit tenant\", \"tenant ka phone update karo\", \"mark tenant inactive\". Required: tenantRecordId. Provide only the fields to update.",
      mcp: "Update a tenant. Requires tenantRecordId.",
    },
    handler: "updateCustomer",
    parameters: [
      {
        "name": "tenantRecordId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the tenant."
      },
      {
        "name": "name",
        "type": "string",
        "required": false,
        "description": "New name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "New phone."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New status.",
        "enum": [
          "active",
          "inactive"
        ]
      }
    ],
  },
  {
    name: "archive_tenant",
    category: "tenant",
    readOnly: false,
    descriptions: {
      internal: "Archive a tenant (soft-remove, reversible). Sets status to inactive; does not delete the record. Triggers: \"archive tenant\", \"stop tracking this tenant\", \"delete tenant\" (there is no delete tool -- archive is the correct action).",
      mcp: "Archive a tenant by setting its status to inactive. Reversible via update_tenant.",
    },
    handler: "archiveCustomer",
    parameters: [
      {
        "name": "tenantRecordId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the tenant to archive."
      }
    ],
  },
  {
    name: "create_tenant_note",
    category: "tenant",
    readOnly: false,
    descriptions: {
      internal: "Add a free-text note to a tenant. Triggers: \"add note to tenant\", \"note on tenant T123\", \"comment on tenant\", \"tenant pe note add karo\". Required: tenantRecordId, content.",
      mcp: "Add a note to a tenant. Requires tenantRecordId and content.",
    },
    handler: "createCustomerNote",
    parameters: [
      {
        "name": "tenantRecordId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the tenant."
      },
      {
        "name": "content",
        "type": "string",
        "required": true,
        "description": "The note content."
      },
      {
        "name": "createdBy",
        "type": "string",
        "required": false,
        "description": "Name of the person creating the note."
      }
    ],
  },
  {
    name: "get_tenant_notes",
    category: "tenant",
    readOnly: true,
    descriptions: {
      internal: "Get all notes for a tenant. Triggers: \"show notes for tenant\", \"tenant ke notes\", \"comments on tenant T123\". Required: tenantRecordId.",
      mcp: "Get all notes for a tenant. Requires tenantRecordId.",
    },
    handler: "getCustomerNotes",
    parameters: [
      {
        "name": "tenantRecordId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the tenant."
      }
    ],
  },
  {
    name: "get_tenant_by_phone",
    category: "tenant",
    readOnly: true,
    descriptions: {
      internal: "Find a tenant by phone number. Use this BEFORE creating a new tenant to avoid duplicates, or when the user asks to find a tenant by phone. Triggers: \"find tenant by phone\", \"is number ka tenant hai?\", \"check tenant phone 9876543210\". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.",
      mcp: "Find a tenant by phone number. Requires phone.",
    },
    handler: "getCustomerByPhone",
    parameters: [
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "Phone number to search for."
      }
    ],
  },
  {
    name: "create_owner",
    category: "owner",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new owner. Triggers: \"create owner\", \"add owner\", \"new owner Raj\", \"owner Imran with phone 9876543210\". Required: name. Optional: phone, email.",
      mcp: "Create an owner. Requires name.",
    },
    handler: "createOwner",
    parameters: [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Owner name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "Phone number."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "Email address."
      }
    ],
  },
  {
    name: "get_owner",
    category: "owner",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single owner by ownerId. Use this AFTER get_owners (search) when you have a specific ownerId. Triggers: \"owner details\", \"show owner O123\", \"tell me about this owner\", \"iska details\". Required: ownerId. Do NOT use for listing — use get_owners for that.",
      mcp: "Get an owner by ownerId. Use after get_owners.",
    },
    handler: "getOwner",
    parameters: [
      {
        "name": "ownerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the owner."
      }
    ],
  },
  {
    name: "get_owners",
    category: "owner",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, or show owners. Triggers: \"owners dikhao\", \"show owners\", \"list all owners\", \"owners batao\", \"find owner Raj\", \"owner with phone 9876543210\". Extract parameters: query (name/phone), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).",
      mcp: "List owners with optional status filter.",
    },
    handler: "getOwners",
    parameters: [
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by status.",
        "enum": [
          "active",
          "inactive"
        ]
      },
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by name or phone."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_owner",
    category: "owner",
    readOnly: false,
    descriptions: {
      internal: "Update an owner's name, phone, or status. Triggers: \"update owner\", \"change owner phone\", \"edit owner\", \"owner ka phone update karo\", \"mark owner inactive\". Required: ownerId. Provide only the fields to update.",
      mcp: "Update an owner. Requires ownerId.",
    },
    handler: "updateOwner",
    parameters: [
      {
        "name": "ownerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the owner."
      },
      {
        "name": "name",
        "type": "string",
        "required": false,
        "description": "New name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": false,
        "description": "New phone."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New status.",
        "enum": [
          "active",
          "inactive"
        ]
      }
    ],
  },
  {
    name: "archive_owner",
    category: "owner",
    readOnly: false,
    descriptions: {
      internal: "Archive an owner (soft-remove, reversible). Sets status to inactive; does not delete the record. Triggers: \"archive owner\", \"stop tracking this owner\", \"delete owner\" (there is no delete tool -- archive is the correct action).",
      mcp: "Archive an owner by setting its status to inactive. Reversible via update_owner.",
    },
    handler: "archiveOwner",
    parameters: [
      {
        "name": "ownerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the owner to archive."
      }
    ],
  },
  {
    name: "create_owner_note",
    category: "owner",
    readOnly: false,
    descriptions: {
      internal: "Add a free-text note to an owner. Triggers: \"add note to owner\", \"note on owner O123\", \"comment on owner\", \"owner pe note add karo\". Required: ownerId, content.",
      mcp: "Add a note to an owner. Requires ownerId and content.",
    },
    handler: "createOwnerNote",
    parameters: [
      {
        "name": "ownerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the owner."
      },
      {
        "name": "content",
        "type": "string",
        "required": true,
        "description": "The note content."
      },
      {
        "name": "createdBy",
        "type": "string",
        "required": false,
        "description": "Name of the person creating the note."
      }
    ],
  },
  {
    name: "get_owner_notes",
    category: "owner",
    readOnly: true,
    descriptions: {
      internal: "Get all notes for an owner. Triggers: \"show notes for owner\", \"owner ke notes\", \"comments on owner O123\". Required: ownerId.",
      mcp: "Get all notes for an owner. Requires ownerId.",
    },
    handler: "getOwnerNotes",
    parameters: [
      {
        "name": "ownerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the owner."
      }
    ],
  },
  {
    name: "get_owner_by_phone",
    category: "owner",
    readOnly: true,
    descriptions: {
      internal: "Find an owner by phone number. Use this BEFORE creating a new owner to avoid duplicates, or when the user asks to find an owner by phone. Triggers: \"find owner by phone\", \"is number ka owner hai?\", \"check owner phone 9876543210\". Required: phone. NOTE: Use find_contact_by_phone for general contact lookup.",
      mcp: "Find an owner by phone number. Requires phone.",
    },
    handler: "getOwnerByPhone",
    parameters: [
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "Phone number to search for."
      }
    ],
  },
  {
    name: "create_buyer",
    category: "buyer",
    readOnly: false,
    descriptions: {
      internal: "Use this when the user asks to create a new buyer. Triggers: \"create buyer\", \"add buyer\", \"new buyer Rohan\". Required: name and phone.",
      mcp: "Create a buyer. Requires name and phone.",
    },
    handler: "createBuyer",
    parameters: [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Buyer name."
      },
      {
        "name": "phone",
        "type": "string",
        "required": true,
        "description": "Phone number (10 digits, required)."
      },
      {
        "name": "email",
        "type": "string",
        "required": false,
        "description": "Email address."
      },
      {
        "name": "budget",
        "type": "number",
        "required": false,
        "description": "Budget in rupees."
      },
      {
        "name": "propertyType",
        "type": "string",
        "required": false,
        "description": "Preferred property type."
      },
      {
        "name": "bhk",
        "type": "number",
        "required": false,
        "description": "Preferred BHK."
      },
      {
        "name": "priority",
        "type": "string",
        "required": false,
        "description": "Priority level.",
        "enum": [
          "low",
          "medium",
          "high"
        ]
      }
    ],
  },
  {
    name: "get_buyer",
    category: "buyer",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single buyer by buyerId. Use this AFTER search_buyers when you have a specific buyerId. Triggers: \"buyer details\", \"show buyer B123\", \"tell me about this buyer\", \"iska details\". Required: buyerId. Do NOT use for searching — use search_buyers for that.",
      mcp: "Get a buyer by buyerId. Use after search_buyers.",
    },
    handler: "getBuyer",
    parameters: [
      {
        "name": "buyerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the buyer."
      }
    ],
  },
  {
    name: "search_buyers",
    category: "buyer",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to list, search, or show buyers. Triggers: \"buyers dikhao\", \"show buyers\", \"buyers batao\", \"buyers with budget above 1 crore\", \"find buyer Rohan\", \"high priority buyers\". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (in rupees), limit (max results), responseMode (summary|compact|details|full).",
      mcp: "Search buyers by query, status, or filters.",
    },
    handler: "searchBuyers",
    parameters: [
      {
        "name": "query",
        "type": "string",
        "required": false,
        "description": "Search by name or phone."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "Filter by status.",
        "enum": [
          "active",
          "inactive",
          "purchased"
        ]
      },
      {
        "name": "minBudget",
        "type": "number",
        "required": false,
        "description": "Minimum budget in rupees."
      },
      {
        "name": "maxBudget",
        "type": "number",
        "required": false,
        "description": "Maximum budget in rupees."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_buyer",
    category: "buyer",
    readOnly: false,
    descriptions: {
      internal: "Update a buyer's budget, status, or priority. Triggers: \"update buyer\", \"change buyer budget\", \"edit buyer\", \"buyer ka budget update karo\", \"mark buyer inactive\", \"change priority\". Required: buyerId. Provide only the fields to update.",
      mcp: "Update a buyer. Requires buyerId.",
    },
    handler: "updateBuyer",
    parameters: [
      {
        "name": "buyerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the buyer."
      },
      {
        "name": "budget",
        "type": "number",
        "required": false,
        "description": "New budget in rupees."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New status (purchased = completed a property purchase).",
        "enum": [
          "active",
          "inactive",
          "purchased"
        ]
      },
      {
        "name": "priority",
        "type": "string",
        "required": false,
        "description": "New priority.",
        "enum": [
          "low",
          "medium",
          "high"
        ]
      }
    ],
  },
  {
    name: "archive_buyer",
    category: "buyer",
    readOnly: false,
    descriptions: {
      internal: "Archive a buyer (soft-remove, reversible). Does not delete the record. Triggers: \"archive buyer\", \"stop tracking this buyer\", \"delete buyer\" (there is no delete tool -- archive is the correct action).",
      mcp: "Archive a buyer. Reversible via update_buyer or update_contact_role.",
    },
    handler: "archiveBuyer",
    parameters: [
      {
        "name": "buyerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the buyer to archive."
      }
    ],
  },
  {
    name: "create_buyer_note",
    category: "buyer",
    readOnly: false,
    descriptions: {
      internal: "Add a free-text note to a buyer. Triggers: \"add note to buyer\", \"note on buyer B123\", \"comment on buyer\", \"buyer pe note add karo\". Required: buyerId, content.",
      mcp: "Add a note to a buyer. Requires buyerId and content.",
    },
    handler: "createBuyerNote",
    parameters: [
      {
        "name": "buyerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the buyer."
      },
      {
        "name": "content",
        "type": "string",
        "required": true,
        "description": "The note content."
      },
      {
        "name": "createdBy",
        "type": "string",
        "required": false,
        "description": "Name of the person creating the note."
      }
    ],
  },
  {
    name: "get_buyer_notes",
    category: "buyer",
    readOnly: true,
    descriptions: {
      internal: "Get all notes for a buyer. Triggers: \"show notes for buyer\", \"buyer ke notes\", \"comments on buyer B123\". Required: buyerId.",
      mcp: "Get all notes for a buyer. Requires buyerId.",
    },
    handler: "getBuyerNotes",
    parameters: [
      {
        "name": "buyerId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the buyer."
      }
    ],
  },
  {
    name: "create_meeting",
    category: "meeting",
    readOnly: false,
    descriptions: {
      internal: "Schedule a meeting. REQUIRED: title, scheduledDate (YYYY-MM-DD or YYYY-MM-DDTHH:mm), relatedEntityType, relatedEntityId. scheduledDate is mapped to meetingDate/meetingTime automatically. Triggers: \"meeting with Rahul tomorrow 3pm\".",
      mcp: "Create a meeting. Requires title, scheduledDate, relatedEntityType, relatedEntityId.",
    },
    handler: "createMeeting",
    parameters: [
      {
        "name": "title",
        "type": "string",
        "required": true,
        "description": "Meeting title."
      },
      {
        "name": "scheduledDate",
        "type": "string",
        "required": true,
        "description": "Date/time: YYYY-MM-DD or YYYY-MM-DDTHH:mm (e.g. \"2026-08-01T15:00\"). Time defaults to 10:00 if only date given."
      },
      {
        "name": "relatedEntityType",
        "type": "string",
        "required": true,
        "description": "Entity type this meeting is about.",
        "enum": [
          "lead",
          "buyer",
          "owner",
          "tenant",
          "contact",
          "property"
        ]
      },
      {
        "name": "relatedEntityId",
        "type": "string",
        "required": true,
        "description": "UUID of the related entity from a prior search/get."
      },
      {
        "name": "notes",
        "type": "string",
        "required": false,
        "description": "Meeting notes or description (maps to description field)."
      },
      {
        "name": "location",
        "type": "string",
        "required": false,
        "description": "Meeting location."
      }
    ],
  },
  {
    name: "get_meeting",
    category: "meeting",
    readOnly: true,
    descriptions: {
      internal: "Get full details of a single meeting by meetingId. Use this AFTER get_upcoming_meetings when you have a specific meetingId. Triggers: \"meeting details\", \"show meeting M123\", \"tell me about this meeting\". Required: meetingId. Do NOT use for listing — use get_upcoming_meetings for that.",
      mcp: "Get a meeting by meetingId. Use after get_upcoming_meetings.",
    },
    handler: "getMeeting",
    parameters: [
      {
        "name": "meetingId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the meeting."
      }
    ],
  },
  {
    name: "get_upcoming_meetings",
    category: "meeting",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks to see upcoming meetings. Triggers: \"upcoming meetings\", \"meetings dikhao\", \"meetings for today\", \"meetings for next 7 days\", \"my meetings\". Extract parameters: days (number of days to look ahead, default 7), limit (max results), responseMode (summary|compact|details|full).",
      mcp: "Get upcoming meetings for the next N days.",
    },
    handler: "getUpcomingMeetings",
    parameters: [
      {
        "name": "days",
        "type": "number",
        "required": false,
        "description": "Number of days to look ahead (default 7)."
      },
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Maximum number of results."
      },
      {
        "name": "responseMode",
        "type": "string",
        "required": false,
        "description": "Response detail level.",
        "enum": [
          "summary",
          "compact",
          "details",
          "full"
        ]
      }
    ],
  },
  {
    name: "update_meeting",
    category: "meeting",
    readOnly: false,
    descriptions: {
      internal: "Update a meeting's title, date, notes, or status. Triggers: \"update meeting\", \"reschedule meeting\", \"cancel meeting\", \"meeting ka time change karo\", \"mark meeting completed\". Required: meetingId. Provide only the fields to update.",
      mcp: "Update a meeting. Requires meetingId.",
    },
    handler: "updateMeeting",
    parameters: [
      {
        "name": "meetingId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the meeting."
      },
      {
        "name": "title",
        "type": "string",
        "required": false,
        "description": "New title."
      },
      {
        "name": "scheduledDate",
        "type": "string",
        "required": false,
        "description": "New date/time (YYYY-MM-DD or YYYY-MM-DDTHH:mm). Mapped to meetingDate/meetingTime."
      },
      {
        "name": "notes",
        "type": "string",
        "required": false,
        "description": "New notes."
      },
      {
        "name": "status",
        "type": "string",
        "required": false,
        "description": "New status.",
        "enum": [
          "scheduled",
          "completed",
          "cancelled",
          "archived"
        ]
      }
    ],
  },
  {
    name: "archive_meeting",
    category: "meeting",
    readOnly: false,
    descriptions: {
      internal: "Archive a meeting (soft-remove, reversible). Sets status to archived; does not delete the record. Triggers: \"archive meeting\", \"hide this meeting\", \"delete meeting\", \"cancel meeting\" (there is no delete tool -- archive is the correct action; use update_meeting with status: cancelled for an actual cancellation).",
      mcp: "Archive a meeting by setting its status to archived. Reversible via update_meeting (status: scheduled).",
    },
    handler: "archiveMeeting",
    parameters: [
      {
        "name": "meetingId",
        "type": "string",
        "required": true,
        "description": "The unique ID of the meeting to archive."
      }
    ],
  },
  {
    name: "get_crm_metrics",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks for CRM metrics, statistics, or a summary. Triggers: \"metrics dikhao\", \"show metrics\", \"CRM summary\", \"how many leads\", \"pipeline stats\", \"statistics batao\". Returns: total leads, leads by status, leads by type, total properties, total owners, total tenants, total buyers, total meetings, etc.",
      mcp: "Get CRM metrics and statistics.",
    },
    handler: "getCRMMetrics",
    parameters: [

    ],
  },
  {
    name: "get_leads_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks HOW MANY leads or wants a leads breakdown (not a full list). Triggers: \"how many leads\", \"kitni leads hain\", \"leads breakdown\", \"leads by type\", \"leads summary\", \"total leads\". Returns counts by type (buyer/seller/tenant/owner), by status, by temperature (hot/warm/cold/unscored), and unassigned. Prefer this over search_leads when the user only wants numbers. Prefer this over get_crm_metrics when the question is specifically about leads.",
      mcp: "Get a focused lead summary: totals and breakdown by type, status, and temperature.",
    },
    handler: "getLeadsSummary",
    parameters: [
      {
        "name": "leadType",
        "type": "string",
        "required": false,
        "description": "Optional: restrict the summary to one lead type.",
        "enum": [
          "buyer",
          "seller",
          "tenant",
          "owner"
        ]
      }
    ],
  },
  {
    name: "get_properties_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks about property inventory counts. Triggers: \"how many properties\", \"kitni properties hain\", \"inventory status\", \"available properties count\", \"properties summary\". Returns total, available, on-hold, rented, sold, pending agreements/verifications, and by type. Prefer this over search_properties when the user only wants numbers.",
      mcp: "Get a focused property inventory summary.",
    },
    handler: "getPropertiesSummary",
    parameters: [

    ],
  },
  {
    name: "get_buyers_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks about buyer demand counts. Triggers: \"how many buyers\", \"kitne buyers hain\", \"buyers summary\", \"buyer demand\". Returns total, active, high-priority count, average budget, and by-priority breakdown.",
      mcp: "Get a focused buyer demand summary.",
    },
    handler: "getBuyersSummary",
    parameters: [

    ],
  },
  {
    name: "get_pipeline_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks about the sales pipeline or funnel. Triggers: \"pipeline\", \"funnel\", \"conversion rate\", \"pipeline status\", \"kitne convert hue\". Returns stage counts (new/contacted/qualified/negotiating/converted/lost), active-in-pipeline, and conversion rate.",
      mcp: "Get the sales pipeline funnel and conversion rate.",
    },
    handler: "getPipelineSummary",
    parameters: [

    ],
  },
  {
    name: "get_followup_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks about pending follow-ups. Triggers: \"follow-ups\", \"pending followups\", \"kise call karna hai\", \"overdue leads\", \"kitne followups pending\". Returns overdue lead count, today/tomorrow meeting counts, and the top overdue leads with days since last contact.",
      mcp: "Get pending follow-ups: overdue leads and upcoming meetings.",
    },
    handler: "getFollowupSummary",
    parameters: [
      {
        "name": "staleDays",
        "type": "number",
        "required": false,
        "description": "Days without contact before a lead counts as overdue (default 5)."
      }
    ],
  },
  {
    name: "get_priority_leads",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks who to contact first or for hot leads. Triggers: \"who should I call\", \"aaj kise call karu\", \"priority leads\", \"hot leads\", \"most important leads\". Returns a ranked list of leads (ranked by budget, temperature, status, and days since contact), each with a human-readable reason (e.g. \"high budget, qualified HOT, no contact in 6 days\").",
      mcp: "Get ranked priority leads (by budget, temperature, status, days since contact) with a reason for each.",
    },
    handler: "getPriorityLeads",
    parameters: [
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Max leads to return (default 5)."
      }
    ],
  },
  {
    name: "get_recent_activity",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks what happened recently. Triggers: \"recent activity\", \"kya naya hua\", \"yesterday activity\", \"this week summary\", \"what changed\". Returns counts of new leads, new properties, completed meetings, and conversions over the last N days.",
      mcp: "Get recent CRM activity over the last N days.",
    },
    handler: "getRecentActivity",
    parameters: [
      {
        "name": "days",
        "type": "number",
        "required": false,
        "description": "Look-back window in days (default 7)."
      }
    ],
  },
  {
    name: "get_daily_brief",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this for a morning briefing or when the user greets you at the start of the day. Triggers: \"good morning\", \"daily brief\", \"aaj ka plan\", \"todays snapshot\", \"brief me\". Returns new leads today, meetings today, overdue follow-ups, pending agreements/verifications, and the top hot leads.",
      mcp: "Get a daily briefing snapshot for the agent.",
    },
    handler: "getDailyBrief",
    parameters: [

    ],
  },
  {
    name: "suggest_next_actions",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks what to do next. Triggers: \"what should I do today\", \"kya karu aaj\", \"next actions\", \"what next\", \"suggest tasks\". Returns a prioritised list of concrete actions (call X, attend meeting Y, progress agreement Z) each with a reason.",
      mcp: "Suggest prioritised next actions for the agent.",
    },
    handler: "suggestNextActions",
    parameters: [
      {
        "name": "limit",
        "type": "number",
        "required": false,
        "description": "Max actions to return (default 5)."
      }
    ],
  },
  {
    name: "get_business_health",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks how the business is doing. Triggers: \"business health\", \"how are we doing\", \"business kaisa chal raha hai\", \"trends\". Returns 7-day lead inflow vs previous 7 days (with trend), 30-day conversions, pending follow-ups, and alerts.",
      mcp: "Get business health with week-over-week trends and alerts.",
    },
    handler: "getBusinessHealth",
    parameters: [

    ],
  },
  {
    name: "get_dashboard_snapshot",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user wants a full overview of everything at once. Triggers: \"dashboard\", \"overview\", \"full summary\", \"sab kuch dikhao\", \"complete status\". Returns a combined snapshot: leads summary, properties summary, pipeline, follow-ups, and top priority leads. Use focused tools (get_leads_summary etc.) when the user asks about only one area.",
      mcp: "Get a combined dashboard snapshot across leads, properties, pipeline, and follow-ups.",
    },
    handler: "getDashboardSnapshot",
    parameters: [

    ],
  },
  {
    name: "get_crm_summary",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this for ANY \"how many / what are the numbers\" question about the CRM. Triggers: \"summary\", \"overview\", \"dashboard\", \"sab kuch dikhao\", \"metrics dikhao\", \"kitni properties hain\", \"kitne buyers\", \"pipeline\", \"funnel\", \"conversion rate\", \"full status\". Pick scope: \"all\" for a full overview (default), \"properties\", \"buyers\", \"pipeline\", or \"metrics\" for raw counts. For a LEADS-only count use get_leads_summary instead — it renders a dedicated card.",
      mcp: "CRM counts and breakdowns. scope: all | metrics | properties | buyers | pipeline.",
    },
    handler: "getCrmSummary",
    parameters: [
      {
        "name": "scope",
        "type": "string",
        "required": false,
        "description": "Which part of the CRM to summarise. Defaults to \"all\" (full overview).",
        "enum": [
          "all",
          "metrics",
          "properties",
          "buyers",
          "pipeline"
        ]
      }
    ],
  },
  {
    name: "get_work_queue",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this for ANY \"what should I do / who should I contact\" question. Triggers: \"good morning\", \"aaj ka plan\", \"daily brief\", \"what should I do today\", \"kya karu aaj\", \"next actions\", \"who should I call\", \"aaj kise call karu\", \"priority leads\", \"hot leads\", \"pending followups\", \"overdue leads\", \"kise call karna hai\". Pick focus: \"today\" for the morning brief (default), \"priority_leads\", \"followups\", or \"next_actions\".",
      mcp: "What needs attention now. focus: today | priority_leads | followups | next_actions.",
    },
    handler: "getWorkQueue",
    parameters: [
      {
        "name": "focus",
        "type": "string",
        "required": false,
        "description": "Which work view to return. Defaults to \"today\" (morning brief).",
        "enum": [
          "today",
          "priority_leads",
          "followups",
          "next_actions"
        ]
      },
      {
        "name": "limit",
        "type": "integer",
        "required": false,
        "description": "Max items for priority_leads / next_actions."
      },
      {
        "name": "staleDays",
        "type": "integer",
        "required": false,
        "description": "Days without contact before a lead counts as overdue (followups)."
      }
    ],
  },
  {
    name: "get_business_trends",
    category: "metrics",
    readOnly: true,
    descriptions: {
      internal: "Use this when the user asks how the business is TRENDING or what changed recently. Triggers: \"business kaisa chal raha hai\", \"how are we doing\", \"business health\", \"trends\", \"recent activity\", \"kya naya hua\", \"this week summary\", \"what changed\". Returns week-on-week lead inflow, conversion rate, and recent activity counts together.",
      mcp: "Business trends: week-on-week inflow, conversion rate, and recent activity.",
    },
    handler: "getBusinessTrends",
    parameters: [
      {
        "name": "days",
        "type": "integer",
        "required": false,
        "description": "Look-back window for recent activity. Defaults to 7."
      }
    ],
  },
];
