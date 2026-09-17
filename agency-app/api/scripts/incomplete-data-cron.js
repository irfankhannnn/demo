import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { findIncomplete } from '../dataQualityService.js';
import { sendEmail } from '../emailService.js';
import { sendWhatsAppMessage, isBaileyEnabled } from '../bailey.js';
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
  logger.info('incompleteData.cron.started');
  const tenants = await listActiveTenants();
  let processed = 0;
  let errors = 0;

  for (const sub of tenants) {
    const { tenantId, contactEmail, adminEmail, whatsAppPhoneNumber } = sub;
    const to = contactEmail || adminEmail;

    try {
      const { leads, owners, tenants: incompleteTenants, properties } = await findIncomplete(tenantId);
      const totalIssues = leads.length + owners.length + incompleteTenants.length + properties.length;
      if (totalIssues === 0) continue;

      const lines = [
        `Data Quality Alert (${new Date().toLocaleDateString('en-IN')})`,
        '',
        leads.length > 0 ? `- ${leads.length} leads missing phone/type details` : null,
        owners.length > 0 ? `- ${owners.length} owners missing KYC (PAN/Aadhaar)` : null,
        incompleteTenants.length > 0 ? `- ${incompleteTenants.length} tenants missing Aadhaar/photo docs` : null,
        properties.length > 0 ? `- ${properties.length} properties with incomplete details` : null,
        '',
        'Please complete these records to keep your data clean.',
      ].filter(Boolean).join('\n');

      if (to) {
        await sendEmail({
          to,
          subject: `Data Quality Alert — ${totalIssues} incomplete records`,
          html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${lines}</pre>`,
        });
      }

      if (isBaileyEnabled() && whatsAppPhoneNumber) {
        await sendWhatsAppMessage(whatsAppPhoneNumber, lines, null, whatsAppPhoneNumber);
      }

      processed++;
      logger.info('incompleteData.sent', { tenantId, totalIssues });
    } catch (err) {
      errors++;
      logger.error('incompleteData.error', { tenantId, error: err.message });
    }
  }

  logger.info('incompleteData.cron.done', { processed, errors, total: tenants.length });
  return { ok: true, processed, errors };
}
