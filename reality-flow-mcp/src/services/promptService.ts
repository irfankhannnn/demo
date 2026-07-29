/**
 * MCP Prompts — Pre-built prompt templates for common workflows
 *
 * Prompts that need data fetch it via the CRM backend HTTP API (tool calls),
 * keeping the MCP service fully decoupled from the data layer.
 *
 * Available Prompts:
 * - qualify-lead — Analyze a lead and determine if they're qualified
 * - draft-followup — Draft a followup message (WhatsApp/Email)
 * - daily-summary — Generate a daily CRM summary
 * - property-match — Find properties matching a buyer's requirements
 * - meeting-prep — Prepare briefing for an upcoming meeting
 */

import { invokeTool } from './crmClient';
import { logger } from '../utils/logger';

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

export interface PromptMessage {
  role: string;
  content: { type: 'text'; text: string };
}

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: 'qualify-lead',
    description: 'Analyze a lead and determine if they are qualified',
    arguments: [
      { name: 'leadId', description: 'The ID of the lead to qualify', required: true },
    ],
  },
  {
    name: 'draft-followup',
    description: 'Draft a followup message for a lead',
    arguments: [
      { name: 'leadId', description: 'The ID of the lead', required: true },
      { name: 'channel', description: 'Communication channel (whatsapp, email, sms)', required: true },
    ],
  },
  {
    name: 'daily-summary',
    description: 'Generate a daily CRM summary for the agency',
    arguments: [],
  },
  {
    name: 'property-match',
    description: "Find properties matching a buyer's requirements",
    arguments: [
      { name: 'buyerId', description: 'The ID of the buyer', required: true },
    ],
  },
  {
    name: 'meeting-prep',
    description: 'Prepare a briefing for an upcoming meeting',
    arguments: [
      { name: 'meetingId', description: 'The ID of the meeting', required: true },
    ],
  },
];

/**
 * Prompt: qualify-lead
 */
async function generateQualifyLeadPrompt(tenantId: string, args: Record<string, any>): Promise<PromptMessage[]> {
  const { leadId } = args;
  if (!leadId) throw new Error('leadId is required');

  const result = await invokeTool(tenantId, 'get_lead', { leadId });
  const lead = result.data || result;

  if (!lead || result.ok === false) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const systemPrompt = `You are a real estate sales expert helping to qualify leads.
Analyze the following lead data and provide:
1. Qualification score (0-100)
2. Key strengths (why they're a good lead)
3. Red flags (concerns)
4. Recommended next steps
5. Estimated deal value

Be concise but thorough. Focus on actionable insights.`;

  const userPrompt = `Qualify this lead:

Name: ${lead.name}
Phone: ${lead.phone}
Email: ${lead.email}
Status: ${lead.status}
Priority: ${lead.priority}
Budget: ${lead.budget ? `₹${lead.budget.toLocaleString('en-IN')}` : 'Not specified'}
Property Type: ${lead.propertyType || 'Not specified'}
BHK: ${lead.bhk || 'Not specified'}
Area: ${lead.area || 'Not specified'}
Timeline: ${lead.timeline || 'Not specified'}
Source: ${lead.source || 'Not specified'}
Created: ${lead.createdAt}
Last Updated: ${lead.updatedAt}

Requirements:
${lead.requirements ? JSON.stringify(lead.requirements, null, 2) : 'Not specified'}`;

  return [{ role: 'user', content: { type: 'text', text: systemPrompt + '\n\n' + userPrompt } }];
}

/**
 * Prompt: draft-followup
 */
async function generateDraftFollowupPrompt(tenantId: string, args: Record<string, any>): Promise<PromptMessage[]> {
  const { leadId, channel } = args;
  if (!leadId || !channel) throw new Error('leadId and channel are required');
  if (!['whatsapp', 'email', 'sms'].includes(channel)) {
    throw new Error('channel must be whatsapp, email, or sms');
  }

  const result = await invokeTool(tenantId, 'get_lead', { leadId });
  const lead = result.data || result;

  if (!lead || result.ok === false) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const channelGuidance: Record<string, string> = {
    whatsapp: 'Keep it casual and friendly. Use Hinglish (mix of English and Hindi). Keep under 160 chars per message.',
    email: 'Professional but warm tone. Include subject line. Personalize with their name and interests.',
    sms: 'Very concise (160 chars). Include call-to-action. Add your name.',
  };

  const systemPrompt = `You are a real estate sales expert drafting ${channel} messages.
${channelGuidance[channel]}
Draft a followup message that:
1. References their previous interaction
2. Provides value (property match, market insight, etc.)
3. Includes a clear call-to-action
4. Feels personal, not generic`;

  const userPrompt = `Draft a ${channel} followup for this lead:

Name: ${lead.name}
Status: ${lead.status}
Budget: ${lead.budget ? `₹${lead.budget.toLocaleString('en-IN')}` : 'Not specified'}
Property Type: ${lead.propertyType || 'Not specified'}
Last Interaction: ${lead.lastInteraction || 'Not specified'}
Days Since Last Contact: ${lead.daysSinceLastContact || 'Unknown'}`;

  return [{ role: 'user', content: { type: 'text', text: systemPrompt + '\n\n' + userPrompt } }];
}

/**
 * Prompt: daily-summary
 */
async function generateDailySummaryPrompt(_tenantId: string, _args: Record<string, any>): Promise<PromptMessage[]> {
  const systemPrompt = `You are a real estate CRM analyst. Generate a concise daily summary that includes:
1. New leads (count + top 3 by budget)
2. Meetings today/tomorrow
3. Hot leads (qualified, high budget)
4. Properties added (count + top 3)
5. Key metrics (conversion rate, average deal value)
6. Recommended actions for the team

Format as a brief executive summary (5-7 bullet points).`;

  const userPrompt = `Generate a daily summary for the real estate agency.
Use the available resources (recent-leads, upcoming-meetings, agency-profile, hot-leads, active-properties)
to gather data and provide actionable insights.`;

  return [{ role: 'user', content: { type: 'text', text: systemPrompt + '\n\n' + userPrompt } }];
}

/**
 * Prompt: property-match
 */
async function generatePropertyMatchPrompt(tenantId: string, args: Record<string, any>): Promise<PromptMessage[]> {
  const { buyerId } = args;
  if (!buyerId) throw new Error('buyerId is required');

  const result = await invokeTool(tenantId, 'get_buyer', { buyerId });
  const buyer = result.data || result;

  if (!buyer || result.ok === false) {
    throw new Error(`Buyer not found: ${buyerId}`);
  }

  const systemPrompt = `You are a real estate property matcher. Analyze the buyer's requirements and:
1. Identify key criteria (budget, location, size, amenities)
2. Suggest properties that match (use the active-properties resource)
3. Highlight why each property is a good fit
4. Flag any compromises (e.g., slightly over budget but great location)
5. Recommend next steps (site visit, negotiation, etc.)`;

  const userPrompt = `Find properties for this buyer:

Name: ${buyer.name}
Phone: ${buyer.phone}
Budget: ${buyer.budget ? `₹${buyer.budget.toLocaleString('en-IN')}` : 'Not specified'}
Property Type: ${buyer.propertyType || 'Not specified'}
BHK: ${buyer.bhk || 'Not specified'}
Area Preferences: ${buyer.areaPreferences ? buyer.areaPreferences.join(', ') : 'Not specified'}
Amenities: ${buyer.amenities ? buyer.amenities.join(', ') : 'Not specified'}
Timeline: ${buyer.timeline || 'Not specified'}

Use the active-properties resource to find matching properties.`;

  return [{ role: 'user', content: { type: 'text', text: systemPrompt + '\n\n' + userPrompt } }];
}

/**
 * Prompt: meeting-prep
 */
async function generateMeetingPrepPrompt(tenantId: string, args: Record<string, any>): Promise<PromptMessage[]> {
  const { meetingId } = args;
  if (!meetingId) throw new Error('meetingId is required');

  const result = await invokeTool(tenantId, 'get_meeting', { meetingId });
  const meeting = result.data || result;

  if (!meeting || result.ok === false) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  const systemPrompt = `You are a real estate sales coach preparing a meeting briefing. Create a concise prep guide that includes:
1. Meeting overview (attendees, purpose, duration)
2. Attendee profiles (background, interests, decision-making power)
3. Key talking points (based on their requirements/interests)
4. Potential objections and responses
5. Documents/properties to bring
6. Success metrics (what does a good meeting look like?)`;

  const userPrompt = `Prepare a briefing for this meeting:

Title: ${meeting.title}
Description: ${meeting.description}
Start Time: ${meeting.startTime}
End Time: ${meeting.endTime}
Location: ${meeting.location}
Attendees: ${meeting.attendees ? meeting.attendees.join(', ') : 'Not specified'}
Purpose: ${meeting.purpose || 'Not specified'}
Related Lead/Property: ${meeting.relatedEntityId || 'Not specified'}`;

  return [{ role: 'user', content: { type: 'text', text: systemPrompt + '\n\n' + userPrompt } }];
}

/**
 * Map of prompt names to generator functions
 */
const PROMPT_GENERATORS: Record<string, (tenantId: string, args: Record<string, any>) => Promise<PromptMessage[]>> = {
  'qualify-lead': generateQualifyLeadPrompt,
  'draft-followup': generateDraftFollowupPrompt,
  'daily-summary': generateDailySummaryPrompt,
  'property-match': generatePropertyMatchPrompt,
  'meeting-prep': generateMeetingPrepPrompt,
};

/**
 * Get prompt by name
 */
export async function getPrompt(
  name: string,
  tenantId: string,
  args: Record<string, any> = {}
): Promise<PromptMessage[]> {
  const generator = PROMPT_GENERATORS[name];
  if (!generator) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  try {
    return await generator(tenantId, args);
  } catch (err: any) {
    logger.error('promptService.getPrompt.error', { name, tenantId, error: err.message });
    throw err;
  }
}

/**
 * Check if a prompt name is valid
 */
export function isValidPromptName(name: string): boolean {
  return name in PROMPT_GENERATORS;
}
