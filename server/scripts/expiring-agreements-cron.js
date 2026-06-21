/**
 * Expiring Agreements Cron
 * Scans all tenants for agreements expiring within 30 days.
 *
 * Notification strategy:
 * - Groups agreements by assignedTo (the responsible member)
 * - Sends ONE grouped email to each responsible member
 * - Sends ONE roll-up email to the tenant admin
 * - Optionally sends WhatsApp to tenant admin if Bailey is enabled
 */
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

/**
 * Build a readable email body for a list of expiring agreements.
 */
function buildAgreementListHtml(agreements) {
  const rows = agreements.map(a => {
    const endFormatted = new Date(a.endDate).toLocaleDateString('en-IN');
    return `<tr>
      <td style="padding:4px 8px">${a.propertyName || a.propertyId || 'Unknown'}</td>
      <td style="padding:4px 8px">${endFormatted}</td>
      <td style="padding:4px 8px">${a.tenantName || a.tenantId || '—'}</td>
    </tr>`;
  }).join('');

  return `<table border="1" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:4px 8px">Property</th>
        <th style="padding:4px 8px">Lease Ends</th>
        <th style="padding:4px 8px">Tenant</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Notify a single responsible member with their grouped agreements.
 */
async function notifyMember(memberEmail, memberName, agreements) {
  if (!memberEmail) return;
  const count = agreements.length;
  const tableHtml = buildAgreementListHtml(agreements);
  await sendEmail({
    to: memberEmail,
    subject: `Action Required: ${count} lease${count > 1 ? 's' : ''} expiring within 30 days`,
    html: `
      <p>Hi ${memberName || 'there'},</p>
      <p>You have <strong>${count} lease agreement${count > 1 ? 's' : ''}</strong> expiring within the next 30 days that need your attention:</p>
      ${tableHtml}
      <p>Please follow up with the respective tenants to renew or relist.</p>
      <p>— RealEstateFlow</p>
    `,
  });
}

/**
 * Send admin roll-up notification with all expiring agreements.
 */
async function notifyAdmin(adminTo, agreements) {
  if (!adminTo || agreements.length === 0) return;
  const count = agreements.length;
  const tableHtml = buildAgreementListHtml(agreements);
  await sendEmail({
    to: adminTo,
    subject: `Admin Summary: ${count} lease${count > 1 ? 's' : ''} expiring within 30 days`,
    html: `
      <p>This is your agency-wide summary of expiring lease agreements:</p>
      ${tableHtml}
      <p>Individual notifications have been sent to each responsible team member.</p>
      <p>— RealEstateFlow</p>
    `,
  });
}

export async function handler() {
  try {
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

      // Group by responsible member (assignedTo / memberId / userId)
      const byMember = {};
      for (const agreement of expiring) {
        const memberId = agreement.assignedTo || agreement.memberId || agreement.userId;
        if (memberId) {
          if (!byMember[memberId]) byMember[memberId] = [];
          byMember[memberId].push(agreement);
        }
      }

      // Send per-member notifications
      for (const [memberId, memberAgreements] of Object.entries(byMember)) {
        // memberId may be an email directly, or a userId that needs lookup.
        // For now treat memberId as email if it contains '@', otherwise skip
        // (full member lookup requires a Users/Members table query — add when available).
        const memberEmail = memberId.includes('@') ? memberId : null;
        const memberName = memberEmail ? memberId.split('@')[0] : memberId;
        await notifyMember(memberEmail, memberName, memberAgreements)
          .catch(err => logger.error('expiringAgreements.member.email.failed', { tenantId, memberId, error: err.message }));
      }

      // Admin roll-up
      if (adminTo) {
        await notifyAdmin(adminTo, expiring)
          .catch(err => logger.error('expiringAgreements.admin.email.failed', { tenantId, error: err.message }));
      }

      // WhatsApp to admin (optional — only if Bailey is enabled)
      if (isBaileyEnabled() && whatsAppPhoneNumber) {
        const summary = [
          `*Leases Expiring (${expiring.length})*`,
          ...expiring.slice(0, 5).map(a => {
            const end = new Date(a.endDate).toLocaleDateString('en-IN');
            return `• ${a.propertyName || a.propertyId} — ${end}`;
          }),
          expiring.length > 5 ? `...and ${expiring.length - 5} more. Check your email.` : '',
        ].filter(Boolean).join('\n');

        await sendWhatsAppMessage(whatsAppPhoneNumber, summary)
          .catch(err => logger.error('expiringAgreements.whatsapp.failed', { tenantId, error: err.message }));
      }

      processed++;
      logger.info('expiringAgreements.sent', { tenantId, count: expiring.length, memberGroups: Object.keys(byMember).length });
    } catch (err) {
      errors++;
      logger.error('expiringAgreements.error', { tenantId, error: err.message });
    }
  }

  logger.info('expiringAgreements.cron.done', { processed, errors, total: tenants.length });
  return { ok: true, processed, errors };
  } catch (err) {
    logger.error('expiringAgreements.cron.failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}
