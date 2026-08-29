import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getLeads } from '../crmDynamodbService.js';
import { sendWhatsAppMessage, isBaileyEnabled } from '../bailey.js';
import { sendEmail } from '../emailService.js';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

async function listActiveTenants() {
  const items = [];
  let lastKey;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      ProjectionExpression: 'tenantId, contactEmail, adminEmail, whatsAppPhoneNumber',
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function fetchTeamMembers(tenantId) {
  if (!INTERNAL_API_KEY) return [];
  try {
    const res = await fetch(
      `${AUTH_SERVICE_URL}/internal/users/list?tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

function buildPerMemberSection(leads, members, today) {
  if (members.length === 0) return null;

  const lines = [];
  for (const member of members) {
    const uid = member.userId || member.id;
    const name = member.displayName || member.name || uid;
    const assigned = leads.filter(l => l.assignedTo === uid);
    const active = assigned.filter(l => !['converted', 'lost'].includes(l.status)).length;
    const closedToday = assigned.filter(l =>
      l.status === 'converted' && l.convertedAt && l.convertedAt.startsWith(today)
    ).length;
    lines.push(`  ${name}: ${active} active, ${closedToday} closed today`);
  }
  return lines.join('\n');
}

export async function handler() {
  logger.info('teamSummary.cron.started');
  const tenants = await listActiveTenants();
  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let errors = 0;

  for (const sub of tenants) {
    const { tenantId, contactEmail, adminEmail, whatsAppPhoneNumber } = sub;
    const to = contactEmail || adminEmail;

    try {
      const leadsResult = await getLeads(tenantId, {});
      const leads = leadsResult?.leads || leadsResult || [];

      const activeLeads = leads.filter(l => !['converted', 'lost'].includes(l.status)).length;
      const closedToday = leads.filter(l =>
        l.status === 'converted' && l.convertedAt && l.convertedAt.startsWith(today)
      ).length;
      const newToday = leads.filter(l => l.createdAt && l.createdAt.startsWith(today)).length;

      const members = await fetchTeamMembers(tenantId);
      const perMemberSection = buildPerMemberSection(leads, members, today);

      const lines = [
        `Team Summary — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        '',
        `Total leads: ${leads.length}`,
        `Active leads: ${activeLeads}`,
        `New leads today: ${newToday}`,
        `Deals closed today: ${closedToday}`,
      ];

      if (perMemberSection) {
        lines.push('', 'Per member:', perMemberSection);
      }

      lines.push('', 'Login to RealEstateFlow for detailed analytics.');
      const text = lines.join('\n');

      if (to) {
        await sendEmail({
          to,
          subject: `Daily Team Summary — ${new Date().toLocaleDateString('en-IN')}`,
          html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
        });
      }

      if (isBaileyEnabled() && whatsAppPhoneNumber) {
        await sendWhatsAppMessage(whatsAppPhoneNumber, text, null, whatsAppPhoneNumber);
      }

      processed++;
      logger.info('teamSummary.sent', { tenantId, activeLeads, closedToday, newToday, memberCount: members.length });
    } catch (err) {
      errors++;
      logger.error('teamSummary.error', { tenantId, error: err.message, stack: err.stack?.split('\n')[1] });
    }
  }

  logger.info('teamSummary.cron.done', { processed, errors, total: tenants.length });
  return { ok: true, processed, errors };
}
