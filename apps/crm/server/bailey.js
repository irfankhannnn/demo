import crypto from 'crypto';
import axios from 'axios';
import { logger } from './logger.js';
import { isNetworkError } from './shared/networkErrors.js';

const VALID_MODES = ['hosted', 'selfhosted'];
const BAILEY_TIMEOUT_MS = parseInt(process.env.BAILEY_TIMEOUT_MS || '10000', 10);

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

  // Endpoint: controlled via env var only; no hardcoded fallback.
  const endpointRaw = process.env.BAILEY_API_ENDPOINT || '';
  if (enabled && !endpointRaw) {
    logger.error('bailey.missing_endpoint', {
      message: 'BAILEY_API_ENDPOINT must be set when BAILEY_ENABLED=true',
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

function baileyHeaders({ includeAdminKey = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.BAILEY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.BAILEY_API_KEY}`;
  }
  // Admin key is required by the Bailey service for destructive operations
  // (forceNew re-linking, deleteAuthState). Sent as a separate header.
  if (includeAdminKey && process.env.BAILEY_ADMIN_API_KEY) {
    headers['x-admin-api-key'] = process.env.BAILEY_ADMIN_API_KEY;
  }
  return headers;
}

const WHATSAPP_MAX_TEXT_LENGTH = 4096;
const WHATSAPP_SAFE_CHUNK_LENGTH = 4000;

/**
 * Split a long message into WhatsApp-sized chunks at word boundaries.
 * WhatsApp text messages have a hard limit of 4096 characters.
 */
export function chunkWhatsAppText(text, maxLength = WHATSAPP_SAFE_CHUNK_LENGTH) {
  if (!text || text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    // Try to break at a newline first, then at the last space before maxLength.
    let breakAt = remaining.lastIndexOf('\n', maxLength);
    if (breakAt <= 0) breakAt = remaining.lastIndexOf(' ', maxLength);
    if (breakAt <= 0) breakAt = maxLength; // hard break if no word boundary found

    chunks.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Send a long WhatsApp message as multiple chunks if needed.
 * Each chunk is retried with backoff. Returns all messageIds.
 *
 * NOTE: If a mid-sequence chunk fails after earlier chunks succeeded, the
 * caller's retry will re-send all chunks, including previously-sent ones.
 * This can result in duplicate chunks being delivered to the recipient.
 * The alternative (tracking per-chunk delivery state in DynamoDB) adds
 * significant complexity and is not warranted given the rarity of partial
 * failures. The dedup claim at the processor level prevents duplicate AI
 * invocations, but duplicate WhatsApp messages may still occur.
 */
export async function sendWhatsAppMessageChunks(to, text, media, from) {
  const { enabled } = getConfig();
  if (!enabled) {
    return disabledResponse('sendWhatsAppMessageChunks', { enabled: false, sent: false, messageIds: [], queued: false });
  }

  if (!to || !text) {
    throw new Error('to and text are required');
  }

  const chunks = chunkWhatsAppText(text);
  const messageIds = [];
  const sentChunks = [];
  let lastError = null;
  let anyQueued = false;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const result = await sendWhatsAppMessage(to, chunk, i === 0 ? media : null, from);
      // Treat queued messages as NOT delivered. The server needs to know the
      // message wasn't actually sent so it can retry via Lambda/EventBridge.
      if (result?.queued) {
        anyQueued = true;
        continue;
      }
      if (result?.messageId) messageIds.push(result.messageId);
      sentChunks.push(i);
    } catch (err) {
      lastError = err;
      // Stop on first failure; remaining chunks are not sent.
      break;
    }
  }

  // If nothing was actually delivered, throw so the caller retries the whole
  // message. The Baileys pending-delivery queue is not reliable enough to
  // treat a queued message as a successful delivery.
  if (messageIds.length === 0) {
    if (lastError) throw lastError;
    if (anyQueued) throw new Error('WhatsApp message was queued but not delivered (connection not ready)');
  }

  return { enabled: true, sent: true, messageIds, totalChunks: chunks.length, sentChunks, queued: false };
}

/**
 * Get Bailey pairing QR for WhatsApp connection.
 * Returns no-op shape when Bailey is disabled.
 */
export async function getPairingQr(phone, forceNew = false) {
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
      { phone: phone.replace(/\s/g, ''), forceNew },
      {
        headers: baileyHeaders({ includeAdminKey: forceNew }),
        timeout: BAILEY_TIMEOUT_MS,
      }
    );
    return {
      enabled: true,
      qrCode: response.data?.qrCode || response.data?.qr,
      sessionId: response.data?.sessionId,
    };
  } catch (err) {
    logger.error('bailey.getPairingQr.failed', { error: err.message, mode, forceNew });
    throw err;
  }
}

/**
 * Determine whether a failed send should be retried.
 * Mirrors the OpenClaw heuristic for transient WhatsApp/Baileys errors.
 */
function isRetryableSendError(err) {
  if (isNetworkError(err)) return true;
  const text = String(err?.message || err?.cause?.message || err?.response?.statusText || '').toLowerCase();
  const status = err?.response?.status;
  const isRetryableStatus = typeof status === 'number' && status >= 500 && status < 600;
  return /fetch failed|closed|reset|timed\s*out|timeout|disconnect|econnreset|socket|network|econnrefused|und_err/.test(text) || isRetryableStatus;
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send WhatsApp message via Bailey API with exponential backoff retry.
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

  const payload = { to: to.replace(/\s/g, ''), text };
  if (media) payload.media = media;
  if (from) payload.from = from.replace(/\s/g, '');

  const maxAttempts = 3;
  const baseDelay = 500;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = baileyUrl(endpoint, prefix, '/messages/send');
      console.log('bailey.sendWhatsAppMessage.attempt', JSON.stringify({ attempt, url, to: payload.to, from: payload.from, timeout: BAILEY_TIMEOUT_MS }));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => { console.log('bailey.sendWhatsAppMessage.aborting', JSON.stringify({ attempt })); controller.abort(); }, BAILEY_TIMEOUT_MS);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.BAILEY_API_KEY ? { Authorization: `Bearer ${process.env.BAILEY_API_KEY}` } : {}) },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log('bailey.sendWhatsAppMessage.response', JSON.stringify({ attempt, status: response.status, ok: response.ok }));
      const data = await response.json();
      console.log('bailey.sendWhatsAppMessage.data', JSON.stringify({ attempt, queued: data.queued, messageId: data.messageId }));
      // If the Baileys service queued the message because the connection is not
      // ready, report it as not sent so the caller can retry.
      if (data?.queued) {
        return {
          enabled: true,
          sent: false,
          queued: true,
          messageId: data?.messageId || null,
        };
      }
      if (!response.ok) {
        throw new Error(`Bailey API returned ${response.status}: ${JSON.stringify(data)}`);
      }
      return {
        enabled: true,
        sent: true,
        queued: false,
        messageId: data?.messageId || data?.id,
      };
    } catch (err) {
      lastErr = err;
      const isLast = attempt === maxAttempts;
      const shouldRetry = isRetryableSendError(err);
      logger.warn('bailey.sendWhatsAppMessage.attempt_failed', {
        attempt, maxAttempts, to, error: err.message,
        code: err?.cause?.code || err?.code,
        willRetry: !isLast && shouldRetry,
      });
      if (isLast || !shouldRetry) break;
      await sleep(baseDelay * attempt); // 500ms, 1000ms
    }
  }

  logger.error('bailey.sendWhatsAppMessage.failed', { error: lastErr.message, to, mode, attempts: maxAttempts });
  throw lastErr;
}

/**
 * Get connection status for a phone number from the Bailey service.
 */
export async function disconnectWhatsApp(phone, deleteAuthState = false) {
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
      { phone: normalized, deleteAuthState },
      {
        headers: baileyHeaders({ includeAdminKey: deleteAuthState }),
        timeout: BAILEY_TIMEOUT_MS,
      }
    );
    return {
      enabled: true,
      disconnected: response.data?.ok || false,
      authStateDeleted: response.data?.authStateDeleted || false,
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
        timeout: BAILEY_TIMEOUT_MS,
      }
    );
    
    // Edge case 7: Detect session expiration by checking state transitions.
    // If state is 'PAIRING_PROMPT_TIMEOUT' or 'DISCONNECTED', session has expired.
    const state = response.data?.state || 'unknown';
    const connected = response.data?.connected || false;
    const isExpired = state === 'PAIRING_PROMPT_TIMEOUT' || state === 'DISCONNECTED';
    
    return {
      enabled: true,
      connected: connected && !isExpired,
      state,
      qrCode: response.data?.qrCode || null,
      sessionId: response.data?.sessionId || null,
      error: response.data?.error || null,
      sessionExpired: isExpired, // New field for frontend to detect expiration
    };
  } catch (err) {
    logger.error('bailey.getConnectionStatus.failed', { error: err.message, phone: normalized, mode });
    // Distinguish network errors from API errors using the shared helper
    // (covers common Node.js network error codes + message-based heuristics).
    return {
      enabled: true,
      connected: false,
      error: err.message,
      networkError: isNetworkError(err), // Flag for frontend to distinguish error types
    };
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

/**
 * List all WhatsApp sessions managed by Bailey service
 */
export async function listWhatsAppSessions() {
  const { enabled, mode, endpoint, prefix } = getConfig();

  if (!enabled) {
    return { enabled: false, sessions: [] };
  }

  if (!endpoint) {
    return { enabled: true, sessions: [], error: 'Bailey API endpoint not configured' };
  }

  try {
    const response = await axios.get(
      baileyUrl(endpoint, prefix, '/pairing/sessions'),
      {
        headers: baileyHeaders(),
        timeout: BAILEY_TIMEOUT_MS,
      }
    );
    return {
      enabled: true,
      sessions: response.data?.sessions || [],
    };
  } catch (err) {
    logger.error('bailey.listWhatsAppSessions.failed', { error: err.message, mode });
    return { enabled: true, sessions: [], error: err.message };
  }
}
