export const TOOLS = [
  {
    name: 'create_lead',
    description: 'Create a new CRM lead. Requires name and leadType (buyer|seller|tenant|owner). Optional: phone, email, priority, buyerRequirement.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Lead name' },
        leadType: { type: 'string', enum: ['buyer', 'seller', 'tenant', 'owner'], description: 'Lead type' },
        phone: { type: 'string', description: 'Phone number' },
        email: { type: 'string', description: 'Email address' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Lead priority' },
        buyerRequirement: {
          type: 'object',
          properties: {
            budget: { type: 'number', description: 'Budget in INR' },
            preferredArea: { type: 'string', description: 'Preferred area' },
            bhk: { type: 'number', description: 'BHK requirement' }
          }
        }
      },
      required: ['name', 'leadType']
    }
  },
  {
    name: 'get_lead',
    description: 'Get a single lead by leadId.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string' } },
      required: ['leadId']
    }
  },
  {
    name: 'search_leads',
    description: 'Search leads by query, status, leadType, or filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        status: { type: 'string' },
        leadType: { type: 'string' },
        limit: { type: 'number' },
        responseMode: { type: 'string', enum: ['summary', 'compact', 'details', 'full'] }
      }
    }
  },
  {
    name: 'update_lead',
    description: 'Update a lead. Include leadId.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        assignedTo: { type: 'string' },
        score: { type: 'string' },
        scoreReasons: { type: 'string' }
      },
      required: ['leadId']
    }
  },
  {
    name: 'convert_lead',
    description: 'Convert a lead to buyer/tenant/owner.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string' } },
      required: ['leadId']
    }
  },
  {
    name: 'create_buyer',
    description: 'Create a buyer. Requires name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        budget: { type: 'number' },
        propertyType: { type: 'string' },
        bhk: { type: 'number' },
        priority: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_buyer',
    description: 'Get a buyer by buyerId.',
    inputSchema: {
      type: 'object',
      properties: { buyerId: { type: 'string' } },
      required: ['buyerId']
    }
  },
  {
    name: 'search_buyers',
    description: 'Search buyers by query, status, or filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'update_buyer',
    description: 'Update a buyer.',
    inputSchema: {
      type: 'object',
      properties: {
        buyerId: { type: 'string' },
        budget: { type: 'number' },
        status: { type: 'string' }
      },
      required: ['buyerId']
    }
  },
  {
    name: 'create_contact',
    description: 'Create a contact. Requires name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        roles: { type: 'object' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_contact',
    description: 'Get a contact by contactId.',
    inputSchema: {
      type: 'object',
      properties: { contactId: { type: 'string' } },
      required: ['contactId']
    }
  },
  {
    name: 'search_contacts',
    description: 'Search contacts by role or status.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string' },
        status: { type: 'string' }
      }
    }
  },
  {
    name: 'update_contact',
    description: 'Update a contact.',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        address: { type: 'string' },
        status: { type: 'string' }
      },
      required: ['contactId']
    }
  },
  {
    name: 'create_owner',
    description: 'Create an owner. Requires name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_owner',
    description: 'Get an owner by ownerId.',
    inputSchema: {
      type: 'object',
      properties: { ownerId: { type: 'string' } },
      required: ['ownerId']
    }
  },
  {
    name: 'get_owners',
    description: 'List owners with optional status filter.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string' } }
    }
  },
  {
    name: 'create_property',
    description: 'Create a property. Requires title and propertyType.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        propertyType: { type: 'string' },
        city: { type: 'string' },
        area: { type: 'string' }
      },
      required: ['title', 'propertyType']
    }
  },
  {
    name: 'get_property',
    description: 'Get a property by propertyId.',
    inputSchema: {
      type: 'object',
      properties: { propertyId: { type: 'string' } },
      required: ['propertyId']
    }
  },
  {
    name: 'search_properties',
    description: 'Search properties by status, city, or propertyType.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        city: { type: 'string' },
        propertyType: { type: 'string' }
      }
    }
  },
  {
    name: 'update_property',
    description: 'Update a property.',
    inputSchema: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        status: { type: 'string' }
      },
      required: ['propertyId']
    }
  },
  {
    name: 'create_tenant',
    description: 'Create a tenant. Requires name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_tenant',
    description: 'Get a tenant by tenantRecordId.',
    inputSchema: {
      type: 'object',
      properties: { tenantRecordId: { type: 'string' } },
      required: ['tenantRecordId']
    }
  },
  {
    name: 'search_tenants',
    description: 'Search tenants by status.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' }
      }
    }
  }
];

export const ALLOWED_TOOL_NAMES = TOOLS.map(t => t.name);
