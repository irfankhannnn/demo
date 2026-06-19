import axios from 'axios';
import { getLeads } from './crmDynamodbService.js';
import { logger } from './logger.js';

/**
 * Fetch team members from auth service using forwarded admin token.
 */
async function fetchTeamMembers(authHeader) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  const response = await axios.get(`${authServiceUrl}/users`, {
    headers: { Authorization: authHeader },
    timeout: 5000,
  });
  return response.data?.users || response.data || [];
}

function inDateRange(isoDate, startDate, endDate) {
  if (!isoDate) return false;
  const t = new Date(isoDate).getTime();
  if (startDate && t < new Date(startDate).getTime()) return false;
  if (endDate && t > new Date(endDate).getTime()) return false;
  return true;
}

/**
 * Aggregate per-member performance metrics for a tenant.
 */
export async function getTeamAnalytics(tenantId, { startDate, endDate, authHeader }) {
  const [members, leadsResult] = await Promise.all([
    fetchTeamMembers(authHeader),
    getLeads(tenantId, {}),
  ]);

  const leads = leadsResult?.leads || leadsResult || [];
  const metricsByUser = {};

  for (const member of members) {
    metricsByUser[member.userId] = {
      userId: member.userId,
      name: member.displayName,
      email: member.email,
      phone: member.phoneNumber,
      role: member.role,
      status: member.status,
      lastLoginAt: member.lastLoginAt,
      whatsAppPhoneNumber: member.whatsAppPhoneNumber,
      dealsClosed: 0,
      activeLeads: 0,
      totalAssigned: 0,
      conversionRate: 0,
      contactedRate: 0,
      lastActivityAt: member.lastLoginAt,
    };
  }

  for (const lead of leads) {
    const userId = lead.assignedTo;
    if (!userId || !metricsByUser[userId]) continue;

    const createdInRange = inDateRange(lead.createdAt, startDate, endDate);
    if (!createdInRange && startDate) continue;

    metricsByUser[userId].totalAssigned++;

    if (lead.status === 'converted' && inDateRange(lead.convertedAt, startDate, endDate)) {
      metricsByUser[userId].dealsClosed++;
    }

    if (!['converted', 'lost'].includes(lead.status)) {
      metricsByUser[userId].activeLeads++;
    }

    if (lead.status !== 'new') {
      metricsByUser[userId]._contacted = (metricsByUser[userId]._contacted || 0) + 1;
    }

    const activityAt = lead.updatedAt || lead.createdAt;
    if (activityAt && (!metricsByUser[userId].lastActivityAt || activityAt > metricsByUser[userId].lastActivityAt)) {
      metricsByUser[userId].lastActivityAt = activityAt;
    }
  }

  const items = Object.values(metricsByUser).map((m) => {
    const contacted = m._contacted || 0;
    delete m._contacted;
    m.conversionRate = m.totalAssigned > 0 ? Math.round((m.dealsClosed / m.totalAssigned) * 100) : 0;
    m.contactedRate = m.totalAssigned > 0 ? Math.round((contacted / m.totalAssigned) * 100) : 0;
    return m;
  });

  logger.info('teamAnalytics.computed', { tenantId, memberCount: items.length });
  return { items };
}
