import crypto from 'crypto';
import axios from 'axios';
import { logger } from './logger.js';

const VALID_MODES = ['hosted', 'selfhosted'];

/**
 * Read Bailey config lazily so dotenv.config() has time to load .env
 * before we evaluate process.env values. ES module imports are hoisted,
 * so module-level const evaluation runs before dotenv.config() in server.js.
 */
function getConfig() {
  const enabled = process.env.BAILEY_ENABLED === 'true';
  const mode = process.env.BAILEY_MODE || 'hosted';

  if (enabled && !VALID_MODES.includes(mode)) {
    logger.warn('bailey.invalid_mode', { mode, validModes: VALID_MODES });
  }

  // Endpoint: hosted defaults to api.bailey.ai; selfhosted MUST be set explicitly
  const endpointRaw = process.env.BAILEY_API_ENDPOINT || (mode === 'hosted' ? 'https://api.bailey.ai' : '');
  if (enabled && mode === 'selfhosted' && !endpointRaw) {
    logger.error('bailey.missing_endpoint', {
      message: 'BAILEY_API_ENDPOINT must be set when BAILEY_MODE=selfhosted',
    });
  }
  const endpoint = endpointRaw.replace(/\/+$/, ''); // strip trailing slashes

  // Prefix: defaults to '/v1' for hosted, '' for selfhosted; normalize leading/trailing slashes
  const prefixRaw = process.env.BAILEY_API_PREFIX || (mode === 'hosted' ? '/v1' : '');
  const prefix = (() => {
    if (!prefixRaw) return '';
    let p = prefixRaw;
    if (!p.startsWith('/')) p = `/${p}`;
    if (p.endsWith('/')) p = p.slice(0, -1);
    return p;
  })();

  return { enabled, mode, endpoint, prefix };
}

function baileyUrl(endpoint, prefix, path) {
  return `${endpoint}${prefix}${path}`;
}

function disabledResponse(method, fallback = null) {
  logger.debug(`bailey.${method}.skipped`, { reason: 'BAILEY_ENABLED is not true' });
  return fallback;
}

function baileyHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.BAILEY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.BAILEY_API_KEY}`;
  }
  return headers;
}

/**
 * Get Bailey pairing QR for WhatsApp connection.
 * Returns no-op shape when Bailey is disabled.
 */
export async function getPairingQr(phone) {
  const { enabled, mode, endpoint, prefix } = getConfig();

  if (!enabled) {
    return disabledResponse('getPairingQr', { enabled: false, qrCode: null, sessionId: null });
  }

  if (!endpoint) {
    throw new Error('Bailey API endpoint is not configured. Set BAILEY_API_ENDPOINT for selfhosted mode.');
  }

  if (!phone || !/^\+?[1-9]\d{9,15}$/.test(phone.replace(/\s/g, ''))) {
    throw new Error('Invalid phone number format');
  }

  try {
    const response = await axios.post(
      baileyUrl(endpoint, prefix, '/pairing/qr'),
      { phone: phone.replace(/\s/g, '') },
      {
        headers: baileyHeaders(),
        timeout: 10000,
      }
    );
    return {
      enabled: true,
      qrCode: response.data?.qrCode || response.data?.qr,
      sessionId: response.data?.sessionId,
    };
  } catch (err) {
    logger.error('bailey.getPairingQr.failed', { error: err.message, mode });
    throw err;
  }
}

/**
 * Send WhatsApp message via Bailey API.
 * Returns no-op when disabled.
 *
 * In self-hosted mode, `from` is the WhatsApp business number that owns the
 * Baileys session. If omitted, the service uses its DEFAULT_SESSION_PHONE.
 */
export async function sendWhatsAppMessage(to, text, media, from) {
  const { enabled, mode, endpoint, prefix } = getConfig();

  if (!enabled) {
    return disabledResponse('sendWhatsAppMessage', { enabled: false, sent: false, messageId: null });
  }

  if (!endpoint) {
    throw new Error('Bailey API endpoint is not configured. Set BAILEY_API_ENDPOINT for selfhosted mode.');
  }

  if (!to || !text) {
    throw new Error('to and text are required');
  }

  try {
    const payload = { to: to.replace(/\s/g, ''), text };
    if (media) payload.media = media;
    if (from) payload.from = from.replace(/\s/g, '');

    const response = await axios.post(
      baileyUrl(endpoint, prefix, '/messages/send'),
      payload,
      {
        headers: baileyHeaders(),
        timeout: 10000,
      }
    );
    return {
      enabled: true,
      sent: true,
      messageId: response.data?.messageId || response.data?.id,
    };
  } catch (err) {
    logger.error('bailey.sendWhatsAppMessage.failed', { error: err.message, to, mode });
    throw err;
  }
}

/**
 * Get connection status for a phone number from the Bailey service.
 */
export async function disconnectWhatsApp(phone) {
  const { enabled, endpoint, prefix } = getConfig();

  if (!enabled) {
    return { enabled: false, disconnected: false };
  }

  if (!endpoint) {
    return { enabled: true, disconnected: false, error: 'Bailey API endpoint not configured' };
  }

  if (!phone || !/^\+?[1-9]\d{9,15}$/.test(phone.replace(/\s/g, ''))) {
    return { enabled: true, disconnected: false, error: 'Invalid phone number format' };
  }

  const normalized = String(phone).replace(/\s/g, '');

  try {
    const response = await axios.post(
      baileyUrl(endpoint, prefix, '/pairing/logout'),
      { phone: normalized },
      {
        headers: baileyHeaders(),
        timeout: 10000,
      }
    );
    return {
      enabled: true,
      disconnected: response.data?.ok || false,
    };
  } catch (err) {
    logger.error('bailey.disconnectWhatsApp.failed', { error: err.message, phone: normalized });
    return { enabled: true, disconnected: false, error: err.message };
  }
}

export async function getConnectionStatus(phone) {
  const { enabled, mode, endpoint, prefix } = getConfig();

  if (!enabled) {
    return { enabled: false, connected: false };
  }

  if (!endpoint) {
    return { enabled: true, connected: false, error: 'Bailey API endpoint not configured' };
  }

  if (!phone) {
    throw new Error('phone is required');
  }

  const normalized = String(phone).replace(/\s/g, '');

  try {
    const response = await axios.get(
      baileyUrl(endpoint, prefix, `/pairing/status/${normalized}`),
      {
        headers: baileyHeaders(),
        timeout: 5000,
      }
    );
    return {
      enabled: true,
      connected: response.data?.connected || false,
      state: response.data?.state || 'unknown',
      qrCode: response.data?.qrCode || null,
      sessionId: response.data?.sessionId || null,
      error: response.data?.error || null,
    };
  } catch (err) {
    logger.error('bailey.getConnectionStatus.failed', { error: err.message, phone: normalized, mode });
    return { enabled: true, connected: false, error: err.message };
  }
}

/**
 * Verify Bailey webhook signature (HMAC-SHA256, timing-safe).
 * When BAILEY_WEBHOOK_SECRET is not set, verification is skipped with a warning
 * in development so local webhooks still work. In production, missing secret
 * means the signature cannot be verified, so the request is rejected.
 */
export function verifyBaileySignature(rawBody, signature, timestamp) {
  const { enabled } = getConfig();

  if (!enabled) return false;

  const secret = process.env.BAILEY_WEBHOOK_SECRET;
  if (!secret) {
    // Always reject if secret is not configured — no exceptions for dev
    logger.error('bailey.verifySignature.rejected', {
      reason: 'BAILEY_WEBHOOK_SECRET not set',
      env: process.env.NODE_ENV,
    });
    return false;
  }
  if (!signature || !timestamp) return false;

  // Validate timestamp freshness (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    logger.warn('bailey.verifySignature.stale_timestamp', { timestamp, now });
    return false;
  }

  const rawBodyString = rawBody.toString();
  const payload = `${timestamp}.${rawBodyString}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sig = String(signature).replace(/^sha256=/, '');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

export function isBaileyEnabled() {
  return getConfig().enabled;
}

export function getBaileyMode() {
  return getConfig().mode;
}
