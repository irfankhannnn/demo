/**
 * MCP Resources — Read-only data sources that AI assistants can access
 * for context without calling tools.
 *
 * Resources are implemented as tool calls to the CRM backend. This keeps
 * the MCP service fully decoupled — no direct DynamoDB access needed.
 *
 * Available Resources:
 * - crm://recent-leads — Last 10 leads (summary)
 * - crm://upcoming-meetings — Meetings in next 7 days
 * - crm://agency-profile — Agency metrics and stats
 * - crm://hot-leads — High priority leads
 * - crm://active-properties — Active properties (summary)
 */

import { invokeTool } from './crmClient';
import { logger } from '../utils/logger';

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
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
 */
async function handleRecentLeads(tenantId: string): Promise<ResourceContent> {
  const result = await invokeTool(tenantId, 'search_leads', {
    limit: 10,
    responseMode: 'summary',
  });

  const leads = result.data?.leads || result.data || [];
  return {
    uri: 'crm://recent-leads',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        count: Array.isArray(leads) ? leads.length : 0,
        leads: Array.isArray(leads)
          ? leads.map((lead: any) => ({
              id: lead.leadId,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              status: lead.status,
              budget: lead.budget,
              createdAt: lead.createdAt,
            }))
          : [],
      },
      null,
      2
    ),
  };
}

/**
 * Handler: crm://upcoming-meetings
 */
async function handleUpcomingMeetings(tenantId: string): Promise<ResourceContent> {
  const result = await invokeTool(tenantId, 'get_upcoming_meetings', {
    days: 7,
  });

  const meetings = result.data?.meetings || result.data || [];
  return {
    uri: 'crm://upcoming-meetings',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        count: Array.isArray(meetings) ? meetings.length : 0,
        meetings: Array.isArray(meetings)
          ? meetings.map((meeting: any) => ({
              id: meeting.meetingId,
              title: meeting.title,
              description: meeting.description,
              startTime: meeting.startTime,
              endTime: meeting.endTime,
              location: meeting.location,
              attendees: meeting.attendees,
              status: meeting.status,
            }))
          : [],
      },
      null,
      2
    ),
  };
}

/**
 * Handler: crm://agency-profile
 */
async function handleAgencyProfile(tenantId: string): Promise<ResourceContent> {
  const result = await invokeTool(tenantId, 'get_crm_metrics', {});

  const metrics = result.data || result;
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
}

/**
 * Handler: crm://hot-leads
 */
async function handleHotLeads(tenantId: string): Promise<ResourceContent> {
  const result = await invokeTool(tenantId, 'search_leads', {
    status: 'qualified',
    priority: 'high',
    limit: 20,
    responseMode: 'summary',
  });

  const leads = result.data?.leads || result.data || [];
  const hotLeads = (Array.isArray(leads) ? leads : [])
    .filter(
      (lead: any) =>
        lead.status === 'qualified' &&
        lead.budget &&
        lead.budget >= 5000000 &&
        lead.priority === 'high'
    )
    .slice(0, 10);

  return {
    uri: 'crm://hot-leads',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        count: hotLeads.length,
        leads: hotLeads.map((lead: any) => ({
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
}

/**
 * Handler: crm://active-properties
 */
async function handleActiveProperties(tenantId: string): Promise<ResourceContent> {
  const result = await invokeTool(tenantId, 'search_properties', {
    status: 'active',
    limit: 20,
    responseMode: 'summary',
  });

  const properties = result.data?.properties || result.data || [];
  const activeProperties = (Array.isArray(properties) ? properties : [])
    .filter((prop: any) => prop.status === 'active')
    .slice(0, 15);

  return {
    uri: 'crm://active-properties',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        count: activeProperties.length,
        properties: activeProperties.map((prop: any) => ({
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
}

/**
 * Map of resource URIs to handler functions
 */
const RESOURCE_HANDLERS: Record<string, (tenantId: string) => Promise<ResourceContent>> = {
  'crm://recent-leads': handleRecentLeads,
  'crm://upcoming-meetings': handleUpcomingMeetings,
  'crm://agency-profile': handleAgencyProfile,
  'crm://hot-leads': handleHotLeads,
  'crm://active-properties': handleActiveProperties,
};

/**
 * Read a resource by URI
 */
export async function readResource(uri: string, tenantId: string): Promise<ResourceContent> {
  const handler = RESOURCE_HANDLERS[uri];
  if (!handler) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  try {
    return await handler(tenantId);
  } catch (err: any) {
    logger.error('resourceService.read.error', { uri, tenantId, error: err.message });
    throw err;
  }
}

/**
 * Check if a resource URI is valid
 */
export function isValidResourceUri(uri: string): boolean {
  return uri in RESOURCE_HANDLERS;
}
