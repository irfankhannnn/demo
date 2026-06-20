import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getLeads } from '../crmDynamodbService.js';
import { sendWhatsAppMessage, isBaileyEnabled } from '../bailey.js';
import { sendEmail } from '../emailService.js';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

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

      const text = [
        `Team Summary — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        '',
        `Total leads: ${leads.length}`,
        `Active leads: ${activeLeads}`,
        `New leads today: ${newToday}`,
        `Deals closed today: ${closedToday}`,
        '',
        'Login to RealEstateFlow for detailed analytics.',
      ].join('\n');

      if (to) {
        await sendEmail({
          to,
          subject: `Daily Team Summary — ${new Date().toLocaleDateString('en-IN')}`,
          html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
        });
      }

      if (isBaileyEnabled() && whatsAppPhoneNumber) {
        await sendWhatsAppMessage(whatsAppPhoneNumber, text);
      }

      processed++;
      logger.info('teamSummary.sent', { tenantId, activeLeads, closedToday, newToday });
    } catch (err) {
      errors++;
      logger.error('teamSummary.error', { tenantId, error: err.message });
    }
  }

  logger.info('teamSummary.cron.done', { processed, errors, total: tenants.length });
  return { ok: true, processed, errors };
}
