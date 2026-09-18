/**
 * Tell a buyer an agency has replied.
 *
 * Email via SES, and only email: the buyer's login identity is their phone,
 * but SMS costs per message and WhatsApp needs an approved template, so
 * neither is wired here yet. Email is optional on a profile, so this is
 * best-effort by design — a thread reply must never fail because the
 * notification did.
 *
 * Disabled entirely when SES_FROM_EMAIL is empty (dev stacks, or before the
 * sender identity is verified), and the Lambda role only gets ses:SendEmail
 * when it is set. Nothing here logs the recipient address.
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { config } from '../config/env.js';
import { esc } from './share.js';
import { logger } from '../logger.js';

let client = null;

function getClient() {
  if (!client) client = new SESv2Client({ region: config.region });
  return client;
}

export function buyerNotifyEnabled() {
  return Boolean(config.sesFromEmail);
}

/**
 * @param {{ email: string|null, name: string|null }} buyer
 * @param {{ threadId: string, agencyName: string|null, propertyTitle: string|null, text: string }} reply
 */
export async function notifyBuyerOfReply(buyer, reply) {
  if (!buyerNotifyEnabled()) return { sent: false, reason: 'disabled' };
  if (!buyer?.email) return { sent: false, reason: 'no_email' };

  const agency = reply.agencyName || 'The agency';
  const title = reply.propertyTitle || 'your enquiry';
  const link = config.webOrigin ? `${config.webOrigin}/me/enquiries/${encodeURIComponent(reply.threadId)}` : null;
  const snippet = String(reply.text || '').slice(0, 400);

  const text = [
    `Hi ${buyer.name || 'there'},`,
    '',
    `${agency} replied about "${title}":`,
    '',
    `"${snippet}"`,
    '',
    link ? `Reply here: ${link}` : 'Open the marketplace to reply.',
    '',
    'RealEstateFlow Marketplace',
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:Manrope,Arial,sans-serif;color:#1C1512;background:#FBF2E4;padding:24px">
<p>Hi ${esc(buyer.name || 'there')},</p>
<p><strong>${esc(agency)}</strong> replied about <strong>${esc(title)}</strong>:</p>
<blockquote style="border-left:4px solid #FF7A1A;margin:16px 0;padding:8px 16px;background:#fff">${esc(snippet)}</blockquote>
${link ? `<p><a href="${esc(link)}" style="background:#FF7A1A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reply now</a></p>` : '<p>Open the marketplace to reply.</p>'}
<p style="color:#777;font-size:12px">RealEstateFlow Marketplace</p>
</body></html>`;

  try {
    await getClient().send(new SendEmailCommand({
      FromEmailAddress: config.sesFromEmail,
      Destination: { ToAddresses: [buyer.email] },
      Content: {
        Simple: {
          Subject: { Data: `${agency} replied about ${title}`.slice(0, 200), Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
        },
      },
    }));
    logger.info('buyerNotify.sent', { threadId: reply.threadId });
    return { sent: true };
  } catch (err) {
    logger.warn('buyerNotify.failed', { threadId: reply.threadId, error: err.message });
    return { sent: false, reason: 'ses_error' };
  }
}
