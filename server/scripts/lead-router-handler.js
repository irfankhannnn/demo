/**
 * Lead Router Handler — triggered by EventBridge 'lead.qualified'.
 * Routes qualified leads to the most appropriate team member.
 * Uses agent runtime for intelligent assignment decisions.
 */
import { invokeSkill } from '../skillInvoker.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { logger } from '../logger.js';
import { shutdownPostHog } from '../lib/posthog.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

async function getTeamMembers(tenantId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${AUTH_SERVICE_URL}/internal/users/list?tenantId=${encodeURIComponent(tenantId)}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
    }
  } catch (err) {
    logger.warn('leadRouter: getTeamMembers failed', { tenantId, error: err.message });
  }
  return [];
}

async function getMemberWorkload(tenantId, memberId) {
  try {
    const result = await invokeSkill(tenantId, 'search_leads', { assignedTo: memberId, status: 'contacted' }, { source: 'cron.lead_router' });
    return result.ok ? (result.data?.items?.length ?? result.data?.length ?? 0) : 0;
  } catch (_) {
    return 0;
  }
}

async function routeLead(tenantId, leadId, score) {
  // Fetch lead
  const leadResult = await invokeSkill(tenantId, 'get_lead', { leadId }, { source: 'cron.lead_router' });
  if (!leadResult.ok) {
    logger.warn('leadRouter: could not fetch lead', { tenantId, leadId });
    return { routed: false, reason: 'lead_not_found' };
  }
  const lead = leadResult.data;

  // Get team members
  const teamMembers = await getTeamMembers(tenantId);
  if (!teamMembers.length) {
    logger.info('leadRouter: no team members, skipping', { tenantId, leadId });
    return { routed: false, reason: 'no_team_members' };
  }

  // Build member workload info — use stable identifiers
  const memberInfo = await Promise.all(
    teamMembers.map(async m => ({
      id: m.userId || m.email || m.username || m.name,
      name: m.displayName || m.name || m.username || m.email,
      email: m.email,
      workload: await getMemberWorkload(tenantId, m.userId || m.email || m.username || m.name),
    }))
  );

  // Ask agent to pick best member
  const agentResult = await invokeAgent(
    tenantId,
    'router',
    `Route this lead to the best team member. Return JSON: {"assignedTo":"member_id","reason":"brief reason"}\nUse the exact "id" field from the team list, not the display name.\n\nLead: ${JSON.stringify(lead)}\nScore: ${score}\nTeam: ${JSON.stringify(memberInfo)}`,
    { leadId }
  );

  let assignedToId;
  let assignedToName;
  if (agentResult.ok) {
    try {
      const parsed = JSON.parse(agentResult.result?.text || '{}');
      const pickedId = parsed.assignedTo;
      const matched = memberInfo.find(m => m.id === pickedId || m.name === pickedId || m.email === pickedId);
      if (matched) {
        assignedToId = matched.id;
        assignedToName = matched.name;
      }
    } catch (_) {}
  }

  // Fallback: least loaded member
  if (!assignedToId) {
    const fallback = memberInfo.reduce((prev, curr) => curr.workload < prev.workload ? curr : prev);
    assignedToId = fallback.id;
    assignedToName = fallback.name;
    logger.info('leadRouter: using fallback assignment', { tenantId, leadId, assignedToId });
  }

  // Update lead
  await invokeSkill(tenantId, 'update_lead', {
    leadId,
    assignedTo: assignedToId,
    assignedToName,
    status: 'assigned',
  }, { source: 'cron.lead_router' });

  logger.info('leadRouter: lead assigned', { tenantId, leadId, assignedToId, assignedToName });
  return { routed: true, assignedTo: assignedToId, assignedToName };
}

export async function handler(event) {
  const results = [];
  const records = event.Records || [event];

  for (const record of records) {
    const detail = typeof record.detail === 'string' ? JSON.parse(record.detail) : record.detail;
    const { tenantId, leadId, score } = detail || {};

    if (!tenantId || !leadId) {
      logger.warn('leadRouter: missing tenantId or leadId', { detail });
      continue;
    }

    // Tenant opt-in check FIRST
    const provisioning = await getProvisioningByTenant(tenantId).catch(() => null);
    if (!provisioning || provisioning.status !== 'live') {
      logger.info('leadRouter: skipped (not provisioned)', { tenantId, leadId });
      results.push({ tenantId, leadId, status: 'skipped', reason: 'not_provisioned' });
      continue;
    }

    const agencyConfig = await getAgencyConfig(tenantId).catch(() => null);
    if (!agencyConfig?.aiEmployeeEnabled) {
      logger.info('leadRouter: skipped (disabled by tenant)', { tenantId, leadId });
      results.push({ tenantId, leadId, status: 'skipped', reason: 'disabled_by_tenant' });
      continue;
    }

    try {
      const result = await routeLead(tenantId, leadId, score);
      results.push({ tenantId, leadId, ...result });
    } catch (err) {
      logger.error('leadRouter.failed', { tenantId, leadId, error: err.message });
      results.push({ tenantId, leadId, status: 'error', error: err.message });
    }
  }

  try { await shutdownPostHog(); } catch (_) {}

  return { statusCode: 200, body: JSON.stringify({ results }) };
}
