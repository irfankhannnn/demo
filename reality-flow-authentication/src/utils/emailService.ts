import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from './logger';

const region = process.env.AWS_REGION || 'ap-south-1';
const sesClient = new SESv2Client({ region });
const TIMEOUT_MS = 5000;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a plain transactional email via SES. Callers decide how to handle a
 * thrown error - for invite emails specifically, the invite record is the
 * source of truth (see inviteController.ts), so a failed send is logged and
 * swallowed there rather than failing the whole request.
 */
async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const from = process.env.AWS_SES_FROM_EMAIL;
  if (!from) {
    logger.warn('emailService.skipped', { reason: 'AWS_SES_FROM_EMAIL not configured', to });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: html, Charset: 'UTF-8' },
              Text: { Data: text, Charset: 'UTF-8' },
            },
          },
        },
      }),
      { abortSignal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Invite emails are identity-matched, not link-based: the invitee just logs
 * into the CRM (Google or Phone) with the exact email/phone the admin
 * invited, and GET /auth/check-invite auto-detects the pending invite from
 * their authenticated claims - see authController.ts. So this email's job is
 * only to tell them an invite exists and where to log in, not to carry a
 * token.
 */
export async function sendInviteEmail(to: string, agencyName: string): Promise<void> {
  const loginUrl = process.env.FRONTEND_LOGIN_URL || 'https://app.realestateflow.in/login';
  const subject = `You've been invited to join ${agencyName} on RealtyFlow`;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #4f46e5;">You've been invited to ${agencyName}</h2>
      <p>An admin at ${agencyName} has invited you to join their team on RealtyFlow.</p>
      <p>To accept, just sign in with this same email address (Google) or your phone number:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Sign in to accept</a>
      </p>
      <p style="color: #64748b; font-size: 14px;">If the button doesn't work, go to ${loginUrl} and sign in with <strong>${to}</strong>.</p>
    </div>
  `.trim();

  const text = `You've been invited to join ${agencyName} on RealtyFlow.\n\nSign in with this same email address (${to}) or your phone number at: ${loginUrl}`;

  await sendEmail({ to, subject, html, text });
}
