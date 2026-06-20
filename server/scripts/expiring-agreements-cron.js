import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { findExpiringAgreements } from '../dataQualityService.js';
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
  logger.info('expiringAgreements.cron.started');
  const tenants = await listActiveTenants();
  let processed = 0;
  let errors = 0;

  for (const sub of tenants) {
    const { tenantId, contactEmail, adminEmail, whatsAppPhoneNumber } = sub;
    const adminTo = contactEmail || adminEmail;

    try {
      const expiring = await findExpiringAgreements(tenantId, 30);
      if (expiring.length === 0) continue;

      for (const agreement of expiring) {
        const endFormatted = new Date(agreement.endDate).toLocaleDateString('en-IN');
        const text = [
          `Lease Expiring Soon`,
          `Property: ${agreement.propertyName || agreement.propertyId}`,
          `Lease ends: ${endFormatted}`,
          `Tenant ID: ${agreement.tenantId}`,
          `Please follow up to renew or relist.`,
        ].join('\n');

        if (adminTo) {
          await sendEmail({
            to: adminTo,
            subject: `Lease expiring — ${agreement.propertyName || agreement.propertyId} (${endFormatted})`,
            html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
          }).catch(err => logger.error('expiringAgreements.email.failed', { tenantId, error: err.message }));
        }

        if (isBaileyEnabled() && whatsAppPhoneNumber) {
          await sendWhatsAppMessage(whatsAppPhoneNumber, text)
            .catch(err => logger.error('expiringAgreements.whatsapp.failed', { tenantId, error: err.message }));
        }
      }

      processed++;
      logger.info('expiringAgreements.sent', { tenantId, count: expiring.length });
    } catch (err) {
      errors++;
      logger.error('expiringAgreements.error', { tenantId, error: err.message });
    }
  }

  logger.info('expiringAgreements.cron.done', { processed, errors, total: tenants.length });
  return { ok: true, processed, errors };
}
