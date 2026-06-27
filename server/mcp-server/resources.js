/**
 * MCP Resources — Data that AI assistants can read for context
 * 
 * Resources are read-only data sources that Claude/ChatGPT can access without
 * calling tools. They're useful for providing context for conversations.
 * 
 * Available Resources:
 * - crm://recent-leads — Last 10 leads (summary)
 * - crm://upcoming-meetings — Meetings in next 7 days
 * - crm://agency-profile — Agency metrics and stats
 * - crm://hot-leads — High priority leads
 * - crm://active-properties — Active properties (summary)
 */

import {
  getLeads,
  getUpcomingMeetings,
  getCRMMetrics,
  getProperties,
} from '../crmDynamodbService.js';
import { logger } from '../logger.js';

// Validate that all required CRM service functions are exported with the
// expected signatures at module load time. This catches import/contract drift
// early rather than at runtime when an AI client requests a resource.
const REQUIRED_RESOURCE_FUNCTIONS = {
  getLeads,
  getUpcomingMeetings,
  getCRMMetrics,
  getProperties,
};
for (const [name, fn] of Object.entries(REQUIRED_RESOURCE_FUNCTIONS)) {
  if (typeof fn !== 'function') {
    throw new Error(
      `MCP resource dependency missing: crmDynamodbService.${name} must be a function. ` +
        `Check that the export exists and matches the expected signature.`
    );
  }
}

/**
 * Resource definitions
 * Each resource has: uri, name, description, mimeType
 */
export const RESOURCE_DEFINITIONS = [
  {
    uri: 'crm://recent-leads',
    name: 'Recent Leads',
    description: 'Last 10 leads (summary with ID, name, phone, status, budget)',
    mimeType: 'application/json',
  },
  {
    uri: 'crm://upcoming-meetings',
    name: 'Upcoming Meetings',
    description: 'Meetings scheduled in the next 7 days',
    mimeType: 'application/json',
  },
  {
    uri: 'crm://agency-profile',
    name: 'Agency Profile',
    description: 'Agency metrics, stats, and performance data',
    mimeType: 'application/json',
  },
  {
    uri: 'crm://hot-leads',
    name: 'Hot Leads',
    description: 'High priority leads (qualified, high budget, ready to buy)',
    mimeType: 'application/json',
  },
  {
    uri: 'crm://active-properties',
    name: 'Active Properties',
    description: 'Active properties available for sale/rent (summary)',
    mimeType: 'application/json',
  },
];

/**
 * Handler: crm://recent-leads
 * Returns last 10 leads with summary data
 */
async function handleRecentLeads(tenantId) {
  try {
    const leads = await getLeads(tenantId, {
      limit: 10,
      responseMode: 'summary',
    });

    return {
      uri: 'crm://recent-leads',
      mimeType: 'application/json',
      text: JSON.stringify(
        {
          count: leads.length,
          leads: leads.map((lead) => ({
            id: lead.leadId,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            status: lead.status,
            budget: lead.budget,
            createdAt: lead.createdAt,
          })),
        },
        null,
        2
      ),
    };
  } catch (err) {
    logger.error('mcp.resource.recent_leads.error', {
      tenantId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Handler: crm://upcoming-meetings
 * Returns meetings in next 7 days
 */
async function handleUpcomingMeetings(tenantId) {
  try {
    const meetings = await getUpcomingMeetings(tenantId, 7);

    return {
      uri: 'crm://upcoming-meetings',
      mimeType: 'application/json',
      text: JSON.stringify(
        {
          count: meetings.length,
          meetings: meetings.map((meeting) => ({
            id: meeting.meetingId,
            title: meeting.title,
            description: meeting.description,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            location: meeting.location,
            attendees: meeting.attendees,
            status: meeting.status,
          })),
        },
        null,
        2
      ),
    };
  } catch (err) {
    logger.error('mcp.resource.upcoming_meetings.error', {
      tenantId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Handler: crm://agency-profile
 * Returns agency metrics and stats
 */
async function handleAgencyProfile(tenantId) {
  try {
    const metrics = await getCRMMetrics(tenantId);

    return {
      uri: 'crm://agency-profile',
      mimeType: 'application/json',
      text: JSON.stringify(
        {
          metrics: {
            totalLeads: metrics.totalLeads,
            totalBuyers: metrics.totalBuyers,
            totalSellers: metrics.totalSellers,
            totalOwners: metrics.totalOwners,
            totalCustomers: metrics.totalCustomers,
            totalProperties: metrics.totalProperties,
            totalMeetings: metrics.totalMeetings,
            activeLeads: metrics.activeLeads,
            convertedLeads: metrics.convertedLeads,
            conversionRate: metrics.conversionRate,
            averageBudget: metrics.averageBudget,
            highPriorityLeads: metrics.highPriorityLeads,
          },
        },
        null,
        2
      ),
    };
  } catch (err) {
    logger.error('mcp.resource.agency_profile.error', {
      tenantId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Handler: crm://hot-leads
 * Returns high priority leads (qualified, high budget, ready to buy)
 */
async function handleHotLeads(tenantId) {
  try {
    const leads = await getLeads(tenantId, {
      limit: 20,
      responseMode: 'summary',
    });

    // Filter for hot leads: qualified, high budget, recent activity
    const hotLeads = leads
      .filter(
        (lead) =>
          lead.status === 'qualified' &&
          lead.budget &&
          lead.budget >= 5000000 && // 50 lakhs+
          lead.priority === 'high'
      )
      .slice(0, 10);

    return {
      uri: 'crm://hot-leads',
      mimeType: 'application/json',
      text: JSON.stringify(
        {
          count: hotLeads.length,
          leads: hotLeads.map((lead) => ({
            id: lead.leadId,
            name: lead.name,
            phone: lead.phone,
            budget: lead.budget,
            priority: lead.priority,
            status: lead.status,
            requirements: lead.requirements,
            lastInteraction: lead.lastInteraction,
          })),
        },
        null,
        2
      ),
    };
  } catch (err) {
    logger.error('mcp.resource.hot_leads.error', {
      tenantId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Handler: crm://active-properties
 * Returns active properties available for sale/rent
 */
async function handleActiveProperties(tenantId) {
  try {
    const properties = await getProperties(tenantId, {
      limit: 20,
      responseMode: 'summary',
    });

    // Filter for active properties
    const activeProperties = properties
      .filter((prop) => prop.status === 'active')
      .slice(0, 15);

    return {
      uri: 'crm://active-properties',
      mimeType: 'application/json',
      text: JSON.stringify(
        {
          count: activeProperties.length,
          properties: activeProperties.map((prop) => ({
            id: prop.propertyId,
            title: prop.title,
            type: prop.propertyType,
            area: prop.area,
            price: prop.price,
            bhk: prop.bhk,
            status: prop.status,
            owner: prop.ownerName,
            createdAt: prop.createdAt,
          })),
        },
        null,
        2
      ),
    };
  } catch (err) {
    logger.error('mcp.resource.active_properties.error', {
      tenantId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Map of resource URIs to handler functions
 */
export const RESOURCE_HANDLERS = {
  'crm://recent-leads': handleRecentLeads,
  'crm://upcoming-meetings': handleUpcomingMeetings,
  'crm://agency-profile': handleAgencyProfile,
  'crm://hot-leads': handleHotLeads,
  'crm://active-properties': handleActiveProperties,
};

/**
 * Get resource by URI
 * @param {string} uri - Resource URI (e.g., 'crm://recent-leads')
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Resource content
 */
export async function getResource(uri, tenantId) {
  const handler = RESOURCE_HANDLERS[uri];
  if (!handler) {
    throw new Error(`Unknown resource: ${uri}`);
  }
  return handler(tenantId);
}
