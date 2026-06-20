import crypto from 'crypto';
import axios from 'axios';
import { logger } from './logger.js';

const BAILEY_ENABLED = process.env.BAILEY_ENABLED === 'true';
const BAILEY_API_ENDPOINT = process.env.BAILEY_API_ENDPOINT || 'https://api.bailey.ai';

function disabledResponse(method, fallback = null) {
  logger.debug(`bailey.${method}.skipped`, { reason: 'BAILEY_ENABLED is not true' });
  return fallback;
}

/**
 * Get Bailey pairing QR for WhatsApp connection.
 * Returns no-op shape when Bailey is disabled.
 */
export async function getPairingQr(phone) {
  if (!BAILEY_ENABLED) {
    return disabledResponse('getPairingQr', { enabled: false, qrCode: null, sessionId: null });
  }

  if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ''))) {
    throw new Error('Invalid phone number format');
  }

  try {
    const response = await axios.post(
      `${BAILEY_API_ENDPOINT}/v1/pairing/qr`,
      { phone: phone.replace(/\s/g, '') },
      {
        headers: {
          Authorization: `Bearer ${process.env.BAILEY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return {
      enabled: true,
      qrCode: response.data?.qrCode || response.data?.qr,
      sessionId: response.data?.sessionId,
    };
  } catch (err) {
    logger.error('bailey.getPairingQr.failed', { error: err.message });
    throw err;
  }
}

/**
 * Send WhatsApp message via Bailey API.
 * Returns no-op when disabled.
 */
export async function sendWhatsAppMessage(to, text, media) {
  if (!BAILEY_ENABLED) {
    return disabledResponse('sendWhatsAppMessage', { enabled: false, sent: false, messageId: null });
  }

  if (!to || !text) {
    throw new Error('to and text are required');
  }

  try {
    const payload = { to: to.replace(/\s/g, ''), text };
    if (media) payload.media = media;

    const response = await axios.post(
      `${BAILEY_API_ENDPOINT}/v1/messages/send`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.BAILEY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return {
      enabled: true,
      sent: true,
      messageId: response.data?.messageId || response.data?.id,
    };
  } catch (err) {
    logger.error('bailey.sendWhatsAppMessage.failed', { error: err.message, to });
    throw err;
  }
}

/**
 * Verify Bailey webhook signature (HMAC-SHA256, timing-safe).
 */
export function verifyBaileySignature(rawBody, signature, timestamp) {
  if (!BAILEY_ENABLED) return false;

  const secret = process.env.BAILEY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;

  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

export function isBaileyEnabled() {
  return BAILEY_ENABLED;
}
