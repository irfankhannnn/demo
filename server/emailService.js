import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from './logger.js';
import { metrics } from './observability/cloudwatch.js';

const region = process.env.AWS_REGION || 'ap-south-1';
const sesClient = new SESv2Client({ region });
const SES_FROM = process.env.AWS_SES_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'noreply@realestateflow.in';
const PRIMARY = process.env.EMAIL_PROVIDER_PRIMARY || 'ses';
const TIMEOUT_MS = 5000;

async function sendViaSes({ to, subject, html, text, from }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await sesClient.send(new SendEmailCommand({
      FromEmailAddress: from || SES_FROM,
      Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            ...(html && { Html: { Data: html, Charset: 'UTF-8' } }),
            ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
          },
        },
      },
    }), { abortSignal: controller.signal });
    return { provider: 'ses', messageId: result.MessageId };
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaBrevo({ to, subject, html, text, brevoTemplateId, params, from }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('Brevo API key not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = brevoTemplateId
    ? { templateId: parseInt(brevoTemplateId, 10), to: [{ email: to }], params: params || {} }
    : {
        sender: { email: from || SES_FROM, name: process.env.BREVO_FROM_NAME || 'RealEstateFlow' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Brevo error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    return { provider: 'brevo', messageId: data.messageId || data.id };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send email via SES primary with Brevo fallback.
 */
export async function sendEmail({ to, subject, html, text, brevoTemplateId, params, from }) {
  const start = Date.now();
  const recipient = Array.isArray(to) ? to[0] : to;

  if (!recipient) throw new Error('Recipient required');
  if (!subject && !brevoTemplateId) throw new Error('Subject or brevoTemplateId required');

  const fallbackHtml = html || `<p>${subject || 'Notification from RealEstateFlow'}</p>`;

  if (PRIMARY === 'ses') {
    try {
      const result = await sendViaSes({ to: recipient, subject, html: fallbackHtml, text, from });
      logger.info('email.sent', { to: recipient, subject, provider: result.provider, duration: Date.now() - start });
      metrics.emailSentViaSes();
      return result;
    } catch (sesErr) {
      logger.warn('email.ses.failed', { to: recipient, error: sesErr.message });
      metrics.emailFallbackToBrevo();
    }
  }

  try {
    const result = await sendViaBrevo({ to: recipient, subject, html: fallbackHtml, text, brevoTemplateId, params, from });
    logger.info('email.sent', { to: recipient, subject, provider: result.provider, duration: Date.now() - start });
    return result;
  } catch (brevoErr) {
    logger.error('email.both_failed', { to: recipient, subject, error: brevoErr.message, duration: Date.now() - start });
    await metrics.emailBothFailed();
    throw new Error('Both SES and Brevo failed');
  }
}
