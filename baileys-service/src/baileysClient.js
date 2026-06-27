import fs from 'fs/promises';
import path from 'path';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import { logger } from './logger.js';
import {
  AUTH_STATE_DIR,
  DEFAULT_SESSION_PHONE,
  QR_TIMEOUT_MS,
  SEND_MESSAGE_TIMEOUT_MS,
  MESSAGE_DEBOUNCE_MS,
  CRM_WEBHOOK_URL,
  CRM_WEBHOOK_SECRET,
  BROWSER_NAME,
  HEALTH_PROBE_INTERVAL_MS,
  HEALTH_PROBE_TIMEOUT_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
} from './config.js';
import { forwardWebhook } from './webhookForwarder.js';
import ConnectionController from './connection-controller.js';
import { isRetryableError } from './reconnect-policy.js';
import { LRUCache } from 'lru-cache';

/** @type {Map<string, import('./types').Session>} */
const sessions = new Map();

/** @type {Map<string, ConnectionController>} */
const connectionControllers = new Map();

/** @type {Map<string, NodeJS.Timeout>} */
const sessionHeartbeats = new Map();

/** @type {Map<string, NodeJS.Timeout>} */
const healthProbeTimers = new Map();

// Track outbound message IDs sent by this service to avoid echo loops in self-chat.
// Key format: `${sessionPhone}:${remoteJid}:${messageId}`. The composite key is
// more defensive than messageId alone and matches the OpenClaw pattern for
// outbound idempotency.
const outboundMessageIds = new LRUCache({
  max: 10000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

// Track ALL forwarded message IDs to prevent duplicate webhook calls from
// retry receipts, LID duplicates, or re-deliveries.
const processedMessageIds = new LRUCache({
  max: 50000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

// Per-sender debounce buffers for rapid consecutive messages. Keyed by
// `${sessionPhone}:${remoteJid}` to match the OpenClaw inbound debounce pattern.
const debounceBuffers = new Map();
// Cap the number of messages buffered per sender to avoid unbounded memory
// growth under spam. Older messages are dropped once the cap is exceeded.
const MAX_DEBOUNCE_BUFFER_SIZE = 100;

/**
 * Extract the phone number from a JID.
 * Handles: 918291537522@s.whatsapp.net, 918291537522:94@s.whatsapp.net, 10076144300114@lid
 * Strips @domain and :device suffix, then removes non-digits.
 * @param {string} jid
 * @returns {string}
 */
function jidToPhone(jid) {
  if (!jid) return '';
  return String(jid)
    .replace(/@.*$/, '')        // strip @domain
    .replace(/:\d+$/, '')       // strip :device suffix (e.g. :94)
    .replace(/\D/g, '');        // keep digits only
}

/**
 * Normalize a LID JID by stripping the device suffix.
 * e.g. "10076144300114:2@lid" -> "10076144300114@lid"
 * @param {string} jid
 * @returns {string}
 */
function normalizeLid(jid) {
  return jid?.replace(/:\d+(?=@lid)/, '') || '';
}

/**
 * Canonicalize a JID for use as a cache key. Strips device suffixes so that
 * "918291537522:94@s.whatsapp.net" and "918291537522@s.whatsapp.net" compare
 * equal. This prevents echo-detection misses when Baileys reports the same
 * chat with different device suffixes on send vs. receive.
 * @param {string} jid
 * @returns {string}
 */
function normalizeJidForKey(jid) {
  if (!jid) return '';
  return String(jid).replace(/:\d+(?=@)/, '');
}

/**
 * Determine if an incoming message is a self-chat (message to/from the same
 * WhatsApp account). WhatsApp uses multiple JID formats (phone, LID, device
 * suffix), so we check several strategies.
 * @param {string} remoteJid
 * @param {string} remotePhone
 * @param {string} sessionPhone
 * @param {string} ownJid
 * @param {string} ownLid
 * @param {string} ownPhone
 * @returns {boolean}
 */
function isSelfChat(remoteJid, remotePhone, sessionPhone, ownJid, ownLid, ownPhone) {
  return (
    remoteJid === `${sessionPhone}@s.whatsapp.net` ||
    remoteJid === ownJid ||
    (ownLid && normalizeLid(remoteJid) === normalizeLid(ownLid)) ||
    (remotePhone && remotePhone === sessionPhone) ||
    (remotePhone && ownPhone && remotePhone === ownPhone)
  );
}

/**
 * Add a sent message ID to the outbound idempotency cache.
 * @param {string} sessionPhone
 * @param {string} remoteJid
 * @param {string} id
 */
function addOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return;
  const key = `${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`;
  outboundMessageIds.set(key, true);
}

/**
 * Check if a message ID was sent by this service.
 * @param {string} sessionPhone
 * @param {string} remoteJid
 * @param {string} id
 * @returns {boolean}
 */
function hasOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return false;
  const key = `${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`;
  return outboundMessageIds.has(key);
}

/**
 * Remove a sent message ID from the outbound idempotency cache (after echo skip).
 * @param {string} sessionPhone
 * @param {string} remoteJid
 * @param {string} id
 */
function deleteOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return;
  const key = `${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`;
  outboundMessageIds.delete(key);
}

/**
 * Mark a message ID as processed (webhook already forwarded).
 * Prevents duplicate processing from retry receipts, LID re-deliveries, etc.
 * @param {string} id
 * @returns {boolean} true if the ID was newly added, false if already present
 */
function markMessageProcessed(id) {
  if (!id) return true;
  if (processedMessageIds.has(id)) return false;
  processedMessageIds.set(id, true);
  return true;
}

/**
 * Check if a message should skip debouncing (media, location, replies, etc.).
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} message
 * @returns {boolean}
 */
function shouldSkipDebounce(message) {
  if (!message) return true;
  if (message.message?.imageMessage || message.message?.videoMessage || message.message?.audioMessage || message.message?.documentMessage) return true;
  if (message.message?.locationMessage) return true;
  if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) return true;
  return false;
}

/**
 * Build a debounce key for a sender in a session. Phone is normalized so that
 * sessions stored with different formatting still collapse to the same buffer.
 */
function buildDebounceKey(sessionPhone, remoteJid) {
  const phone = sessionPhone ? normalizePhone(sessionPhone) : '';
  const jid = normalizeJidForKey(remoteJid);
  return `${phone}:${jid}`;
}

/**
 * Flush a debounce buffer and forward the combined message to the CRM.
 * Returns a Promise that resolves once handleIncomingMessage completes (or
 * rejects on failure) so callers (e.g. shutdown) can await the flush.
 * @returns {Promise<void>}
 */
function flushDebounceBuffer(key, session) {
  const buffer = debounceBuffers.get(key);
  if (!buffer) return Promise.resolve();
  debounceBuffers.delete(key);

  if (buffer.messages.length === 0) return Promise.resolve();

  if (buffer.messages.length === 1) {
    return handleIncomingMessage(session, buffer.messages[0]).catch((err) => {
      logger.error({ phone: session.phone, key, error: err.message }, 'baileys.debounce.handle_failed');
    });
  }

  const latest = buffer.messages[buffer.messages.length - 1];
  const combinedText = buffer.messages
    .map((m) => getMessageText(m))
    .filter(Boolean)
    .join('\n');

  const combined = {
    ...latest,
    message: {
      ...latest.message,
      conversation: combinedText,
      extendedTextMessage: { text: combinedText },
    },
  };

  return handleIncomingMessage(session, combined).catch((err) => {
    logger.error({ phone: session.phone, key, error: err.message }, 'baileys.debounce.handle_failed');
  });
}

/**
 * Buffer an incoming message for debouncing. If no new message arrives from the
 * same sender within MESSAGE_DEBOUNCE_MS, the buffer is flushed and a combined
 * message is forwarded. Default is 0 (disabled) to avoid adding latency.
 */
function debounceIncomingMessage(session, message) {
  const remoteJid = message.key?.remoteJid;
  const key = buildDebounceKey(session.phone, remoteJid);

  if (!debounceBuffers.has(key)) {
    debounceBuffers.set(key, { messages: [], timer: null });
  }

  const buffer = debounceBuffers.get(key);
  buffer.messages.push(message);

  // Cap buffer size to avoid unbounded memory growth under spam. Drop the
  // oldest message so the buffer always reflects the most recent activity.
  if (buffer.messages.length > MAX_DEBOUNCE_BUFFER_SIZE) {
    buffer.messages.shift();
    logger.warn({ phone: session.phone, key, maxSize: MAX_DEBOUNCE_BUFFER_SIZE }, 'baileys.debounce.buffer_capped');
  }

  if (buffer.timer) {
    clearTimeout(buffer.timer);
  }

  buffer.timer = setTimeout(() => {
    flushDebounceBuffer(key, session);
  }, MESSAGE_DEBOUNCE_MS);

  logger.debug({ phone: session.phone, key, count: buffer.messages.length, debounceMs: MESSAGE_DEBOUNCE_MS }, 'baileys.debounce.buffered');
}

/**
 * Start a 60-second heartbeat for a session.
 * Logs the current connection state so dangling states are visible.
 * @param {import('./types').Session} session
 */
function startHeartbeat(session) {
  stopHeartbeat(session.phone);
  const heartbeat = setInterval(() => {
    logger.info({ phone: session.phone, state: session.connectionState }, 'baileys.connection.heartbeat');
  }, 60000);
  sessionHeartbeats.set(session.phone, heartbeat);
}

/**
 * Stop the heartbeat for a given phone number.
 * @param {string} phone
 */
function stopHeartbeat(phone) {
  const normalized = normalizePhone(phone);
  const heartbeat = sessionHeartbeats.get(normalized);
  if (heartbeat) {
    clearInterval(heartbeat);
    sessionHeartbeats.delete(normalized);
  }
}

/**
 * Check if an error from the health probe indicates a half-open or
 * crypto-corrupted socket. These are the failure patterns we want to recover
 * from without forcing the customer to re-scan QR.
 * @param {Error} error
 * @returns {boolean}
 */
function isHealthProbeFailure(error) {
  if (!error) return false;
  const message = String(error.message || error).toLowerCase();
  return (
    message.includes('bad mac') ||
    message.includes('no matching session') ||
    message.includes('invalid prekey id') ||
    message.includes('session not found') ||
    message.includes('mac verification') ||
    error?.output?.statusCode === 408 ||
    error?.statusCode === 408
  );
}

/**
 * Start a periodic health probe for a session.
 * While the socket reports 'open', periodically send a lightweight presence
 * update and enforce a short timeout. If the probe fails, force the socket
 * to close so the existing reconnect logic takes over.
 * @param {import('./types').Session} session
 */
function startHealthProbe(session) {
  stopHealthProbe(session.phone);
  const phone = session.phone;
  const timer = setInterval(async () => {
    const sock = session.socket;
    if (!sock || session.connectionState !== 'open') {
      return;
    }

    const ownJid = sock.user?.id;
    if (!ownJid) {
      return;
    }

    const probeId = `probe_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const probeLogger = logger.child({ phone, probeId });
    probeLogger.debug('baileys.health_probe.start');

    const controller = connectionControllers.get(phone);
    const probeTimeout = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Health probe timeout'));
      }, HEALTH_PROBE_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        sock.sendPresenceUpdate('available', ownJid),
        probeTimeout,
      ]);
      probeLogger.debug('baileys.health_probe.success');
      if (controller) {
        controller.recordActivity();
      }
    } catch (err) {
      probeLogger.warn({ error: err.message }, 'baileys.health_probe.failed');
      if (isHealthProbeFailure(err)) {
        probeLogger.warn({ error: err.message }, 'baileys.health_probe.half_open');
        // Force reconnect through the existing connection.update close path
        if (typeof sock.end === 'function') {
          try {
            sock.end();
          } catch (endErr) {
            probeLogger.warn({ error: endErr.message }, 'baileys.health_probe.end_failed');
          }
        }
      }
    }
  }, HEALTH_PROBE_INTERVAL_MS);

  healthProbeTimers.set(phone, timer);
}

/**
 * Stop the health probe for a given phone number.
 * @param {string} phone
 */
function stopHealthProbe(phone) {
  const normalized = normalizePhone(phone);
  const timer = healthProbeTimers.get(normalized);
  if (timer) {
    clearInterval(timer);
    healthProbeTimers.delete(normalized);
  }
}

/**
 * Create a proxy logger that intercepts Baileys internal error logs so we can
 * react to the "init queries timed out" / 408 half-open state immediately.
 * The proxy forwards every call to the underlying pino logger while checking
 * error logs for the known failure signatures.
 * @param {import('./types').Session} session
 * @param {import('pino').Logger} baseLogger
 * @returns {import('pino').Logger}
 */
function createSocketLogger(session, baseLogger) {
  const child = baseLogger.child({ module: 'baileys-socket' });

  /**
   * Detect an init-query timeout or related half-open error from the log payload.
   * @param {any[]} args
   * @returns {Error|null}
   */
  function detectInitQueryTimeout(args) {
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        const err = arg.err || arg.error || arg;
        if (err && typeof err === 'object') {
          const message = String(err.message || arg.message || '').toLowerCase();
          const statusCode = err.output?.statusCode || err.statusCode || arg.statusCode;
          if (
            message.includes('init queries') ||
            statusCode === 408 ||
            (message.includes('timed out') && args.some(a => String(a).toLowerCase().includes('init queries')))
          ) {
            return err instanceof Error ? err : new Error(String(err.message || err));
          }
        }
      }
      if (typeof arg === 'string') {
        const lower = arg.toLowerCase();
        if (lower.includes('init queries')) {
          for (const other of args) {
            if (other && typeof other === 'object') {
              const err = other.err || other.error || other;
              if (err && typeof err === 'object') {
                const msg = String(err.message || '').toLowerCase();
                if (msg.includes('timed out') || msg.includes('timeout') || err.output?.statusCode === 408 || err.statusCode === 408) {
                  return err instanceof Error ? err : new Error(msg);
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  function logInitQueryTimeout(error) {
    // Log the timeout but do not forcibly close the socket here.  A fresh
    // WhatsApp Web link often needs the full 60-second query window for the
    // initial sync, and forcibly ending the socket prevents the connection
    // from completing.  Actual half-open sockets are handled by the health probe.
    logger.warn(
      { phone: session.phone, error: error.message },
      'baileys.init_queries.timeout.half_open'
    );
  }

  return new Proxy(child, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if ((prop === 'error' || prop === 'fatal') && typeof original === 'function') {
        return (...args) => {
          const timeoutError = detectInitQueryTimeout(args);
          if (timeoutError) {
            logInitQueryTimeout(timeoutError);
          }
          return original.apply(target, args);
        };
      }
      if (typeof original === 'function') {
        return original.bind(target);
      }
      return original;
    },
  });
}

async function ensureSessionDir(phone) {
  const dir = path.join(AUTH_STATE_DIR, normalizePhone(phone));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function normalizePhone(phone) {
  const normalized = String(phone).replace(/\D/g, '');
  if (!normalized) {
    throw new Error('Phone number cannot be empty after normalization');
  }
  return normalized;
}

/**
 * Get the path to the connection state file for a phone number
 * @param {string} phone
 * @returns {string}
 */
function getConnectionStateFile(phone) {
  const normalized = normalizePhone(phone);
  return path.join(AUTH_STATE_DIR, normalized, 'connection-state.json');
}

/**
 * Save connection state to file for persistence across restarts
 * @param {string} phone
 * @param {import('./types').Session} session
 * @returns {Promise<void>}
 */
async function saveConnectionState(phone, session) {
  try {
    const stateFile = getConnectionStateFile(phone);
    const state = {
      phone: normalizePhone(phone),
      connectionState: session.connectionState,
      lastQrAt: session.lastQrAt,
      lastError: session.lastError,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    logger.debug({ phone: normalizePhone(phone) }, 'baileys.connection.state.saved');
  } catch (err) {
    logger.warn({ phone: normalizePhone(phone), error: err.message }, 'baileys.connection.state.save_failed');
  }
}

function phoneToJid(phone) {
  const normalized = normalizePhone(phone);
  return `${normalized}@s.whatsapp.net`;
}

/**
 * Extract plain text from a Baileys message object.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} message
 * @returns {string|null}
 */
function getMessageText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    null
  );
}

/**
 * Forward an incoming WhatsApp message to the CRM webhook.
 * @param {import('./types').Session} session
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} message
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(session, message) {
  // For group messages, the actual sender is in key.participant; remoteJid is the group.
  const senderJid = message.key?.participant || message.key?.remoteJid;
  const to = session.phone;
  const text = getMessageText(message);
  const messageId = message.key?.id;
  const fromMe = message.key?.fromMe === true;

  const ownJid = session.socket?.user?.id;
  const ownLid = session.socket?.user?.lid;
  const remoteJid = message.key?.remoteJid;
  const remotePhone = jidToPhone(remoteJid);
  const ownPhone = jidToPhone(ownJid);

  // When self-chat is detected, we use the session phone as the sender so downstream
  // conversation context is stored under the real phone number, not the LID digits.
  const isSelfChatResult = isSelfChat(remoteJid, remotePhone, session.phone, ownJid, ownLid, ownPhone);

  const from = isSelfChatResult ? session.phone : jidToPhone(senderJid);

  if (!from || !messageId) {
    logger.warn({ reason: 'missing_from_or_id' }, 'baileys.incoming.skip');
    return;
  }

  // Record activity in ConnectionController
  const controller = connectionControllers.get(to);
  if (controller) {
    controller.handleIncomingMessage();
  }

  // Deduplication: skip if we've already forwarded this exact message ID.
  // This prevents retry receipts, LID duplicates, and re-deliveries from
  // creating multiple webhooks for the same message.
  if (!markMessageProcessed(messageId)) {
    logger.info({ phone: session.phone, messageId }, 'baileys.incoming.duplicate_skip');
    return;
  }

  // Skip messages with no decryptable text. This commonly happens after a
  // session re-link when old messages encrypted with the previous session's
  // pre-keys cannot be decrypted (Bad MAC / No matching sessions).
  // Do NOT forward null text to the CRM — it confuses the AI agent.
  if (!text || !text.trim()) {
    logger.warn({
      phone: session.phone,
      messageId,
      fromMe,
      remoteJid: message.key?.remoteJid,
      reason: 'undecryptable_or_empty_text'
    }, 'baileys.incoming.empty_text_skip');
    
    // Handle crypto error through ConnectionController
    if (controller) {
      await controller.handleCryptoError(new Error('undecryptable_or_empty_text'));
    }
    return;
  }

  const isGroup = String(remoteJid).endsWith('@g.us');

  const payload = {
    messageId,
    from,
    to,
    text,
    fromMe,
    isSelfChat: isSelfChatResult,
    isGroup,
    fromJid: senderJid,        // original JID (e.g. 10076144300114@lid) for replies
    timestamp: new Date().toISOString(),
  };

  if (!CRM_WEBHOOK_URL) {
    logger.warn({ reason: 'no_crm_webhook_url' }, 'baileys.incoming.skip');
    return;
  }

  await forwardWebhook(CRM_WEBHOOK_URL, payload, CRM_WEBHOOK_SECRET);
}

/**
 * Get status of a session
 * @param {string} phone 
 * @returns {{ connected: boolean, state: string, qrCode: string|null, lastQrAt: string|null, error: string|null }}
 */
export function getSessionStatus(phone) {
  const session = sessions.get(normalizePhone(phone));
  if (!session) return { connected: false, state: 'disconnected' };
  return {
    connected: session.connectionState === 'open',
    state: session.connectionState,
    qrCode: session.qrCode || null,
    lastQrAt: session.lastQrAt || null,
    error: session.lastError || null,
  };
}

/**
 * List all managed sessions
 * @returns {Array}
 */
export function listSessions() {
  return Array.from(sessions.entries()).map(([phone, session]) => ({
    phone,
    ...getSessionStatus(phone),
    createdAt: session.createdAt,
  }));
}

/**
 * Create or reuse a WhatsApp session
 * @param {string} phone 
 * @param {Object} options 
 * @returns {Promise<{ qrCode: string|null, sessionId: string, connected: boolean }>}
 */
export async function createSession(phone, options = {}) {
  const normalized = normalizePhone(phone);
  const existing = sessions.get(normalized);

  // Reuse only if the session is already connected. If the socket is dead,
  // closed, or connecting, force a new socket creation so we don't hang on a
  // dead connection (common after WhatsApp stream-error 515).
  if (existing && existing.socket && existing.connectionState === 'open') {
    logger.info({ phone: normalized }, 'baileys.session.reuse');
    return waitForQrOrConnect(existing, options);
  }

  if (existing && existing.socket) {
    logger.warn({ phone: normalized, state: existing.connectionState }, 'baileys.session.dead_socket');
    try {
      existing.socket.ev.removeAllListeners();
      if (typeof existing.socket.end === 'function') {
        existing.socket.end();
      }
    } catch (err) {
      logger.warn({ phone: normalized, error: err.message }, 'baileys.session.cleanup_failed');
    }
    existing.socket = null;
  }

  const sessionDir = await ensureSessionDir(phone);
  logger.info({ phone: normalized, sessionDir }, 'baileys.session.create');

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const session = {
    phone: normalized,
    socket: null,
    connectionState: 'connecting',
    qrCode: null,
    lastQrAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    qrResolvers: new Set(),
    openResolvers: new Set(),
  };
  sessions.set(normalized, session);

  const sock = makeWASocket({
    version,
    logger: createSocketLogger(session, logger),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS(BROWSER_NAME),
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    defaultQueryTimeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
  });

  session.socket = sock;

  // Initialize ConnectionController for this session
  const controller = new ConnectionController(normalized, sock, {
    watchdog: { inactivityTimeout: 10 * 60 * 1000, heartbeatInterval: 60 * 1000 },
    reconnect: { baseDelay: 2000, maxDelay: 30000, multiplier: 1.8, jitterFactor: 0.25 },
  });
  await controller.initialize();
  connectionControllers.set(normalized, controller);
  
  // Update socket reference in controller (already set in constructor, but explicit for clarity)
  controller.updateSocket(sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      handleQr(session, qr);
    }

    if (connection) {
      session.connectionState = connection;
      logger.info({ phone: normalized, connection }, 'baileys.connection.update');
      
      // Sync with ConnectionController state machine
      controller.handleConnectionUpdate(connection);
      
      // Persist connection state to file for recovery across restarts
      saveConnectionState(phone, session).catch(err =>
        logger.warn({ phone: normalized, error: err.message }, 'baileys.connection.state.persist_failed')
      );

      if (connection === 'open') {
        session.qrCode = null;
        startHeartbeat(session);
        startHealthProbe(session);
        
        // Drain pending deliveries queue (await to ensure completion)
        if (controller && controller.hasPendingDeliveries()) {
          controller.drainPendingDeliveries(async (phone, to, text, media) => {
            return await sendMessage(phone, to, text, media);
          }).catch(err => {
            logger.error({ phone: normalized, error: err.message }, 'baileys.pending_deliveries.drain_failed');
          });
        }
        
        resolveOpen(session);
      }

      if (connection === 'close') {
        stopHeartbeat(normalized);
        stopHealthProbe(normalized);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const error = lastDisconnect?.error;
        const shouldReconnect = error instanceof Boom && !isLoggedOut && isRetryableError(error);

        if (shouldReconnect) {
          // Use ConnectionController's reconnect policy (single source of truth)
          controller.recordReconnectAttempt(false, error);
          
          if (!controller.shouldRetry()) {
            logger.error({ phone: normalized, attempts: controller.reconnectPolicy.attemptCount }, 'baileys.connection.reconnect_exhausted');
            session.lastError = error?.message || 'reconnect_exhausted';
            sessions.delete(normalized);
            connectionControllers.delete(normalized);
            controller.shutdown();
            // Cleanup resolvers
            for (const resolver of session.qrResolvers) {
              resolver({ error: session.lastError });
            }
            for (const resolver of session.openResolvers) {
              resolver({ error: session.lastError });
            }
            session.qrResolvers.clear();
            session.openResolvers.clear();
            return;
          }

          logger.warn({ phone: normalized, reason: lastDisconnect.error.message, statusCode }, 'baileys.connection.reconnect');
          // Force a new socket on the next createSession call.
          session.socket = null;
          session.connectionState = 'connecting';
          
          // Use ConnectionController's backoff delay
          const delay = controller.getNextReconnectDelay();
          logger.info({ phone: normalized, delay }, 'baileys.connection.reconnect_delay');
          
          setTimeout(() => {
            createSession(phone).catch(err =>
              logger.error({ phone: normalized, error: err.message }, 'baileys.reconnect.failed')
            );
          }, delay);
        } else {
          session.lastError = lastDisconnect?.error?.message || 'connection_closed';
          logger.error({ phone: normalized, error: session.lastError }, 'baileys.connection.closed');
          sessions.delete(normalized);
          connectionControllers.delete(normalized);
          controller.shutdown();
          // Cleanup resolvers
          for (const resolver of session.qrResolvers) {
            resolver({ error: session.lastError });
          }
          for (const resolver of session.openResolvers) {
            resolver({ error: session.lastError });
          }
          session.qrResolvers.clear();
          session.openResolvers.clear();
        }
      }
    }
  });

  // Trigger words/phrases that allow processing of fromMe messages (self-chat) when
  // normal self-chat detection fails (e.g. WhatsApp sends self-messages via LID).
  const AI_TRIGGERS = (process.env.AI_SELF_CHAT_TRIGGERS || 'AI:,Bot:,Hey bot')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  function hasAiTrigger(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    return AI_TRIGGERS.some(t => lower.startsWith(t));
  }

  sock.ev.on('messages.upsert', async (upsert) => {
    if (upsert.type !== 'notify') return;
    for (const message of upsert.messages) {
      const ownJid = session.socket?.user?.id;
      const ownLid = session.socket?.user?.lid;  // Baileys may expose user's LID
      const remoteJid = message.key?.remoteJid;
      const remotePhone = jidToPhone(remoteJid);
      const ownPhone = jidToPhone(ownJid);
      const text = getMessageText(message);
      const fromMe = message.key?.fromMe;

      // Self-chat detection (multiple strategies because WhatsApp uses different JID formats).
      const isSelfChatResult = isSelfChat(remoteJid, remotePhone, session.phone, ownJid, ownLid, ownPhone);

      // Only process fromMe messages if they are genuine self-chat or carry
      // an explicit AI trigger prefix. This prevents echo loops where CRM
      // replies sent via Bailey are delivered back as incoming messages.
      const shouldProcessFromMe = isSelfChatResult || hasAiTrigger(text);

      logger.info({
        phone: normalized,
        fromMe,
        remoteJid,
        remotePhone,
        ownJid,
        ownPhone,
        ownLid,
        isSelfChat: isSelfChatResult,
        shouldProcessFromMe,
        hasAiTrigger: hasAiTrigger(text),
        messageId: message.key?.id,
        text: text?.slice(0, 100),
      }, 'baileys.messages.upsert');

      // Skip messages sent by this service (echo replies) to prevent loops.
      if (hasOutboundMessageId(normalized, remoteJid, message.key?.id)) {
        deleteOutboundMessageId(normalized, remoteJid, message.key?.id);
        logger.info({ phone: normalized, messageId: message.key?.id }, 'baileys.messages.upsert.echo_skip');
        continue;
      }
      // Allow self-chat messages, AI-trigger messages, or (in dev) all fromMe messages.
      // Skip fromMe messages that don't qualify (e.g., normal replies to other contacts).
      if (fromMe && !shouldProcessFromMe) {
        logger.info({ phone: normalized, remoteJid, remotePhone, sessionPhone: session.phone }, 'baileys.messages.upsert.fromMe_skip');
        continue;
      }
      try {
        if (MESSAGE_DEBOUNCE_MS > 0 && !shouldSkipDebounce(message)) {
          debounceIncomingMessage(session, message);
        } else {
          await handleIncomingMessage(session, message);
        }
      } catch (err) {
        // MessageCounterError is a known, non-fatal Baileys decryption error.
        // Log it as a warning so we don't crash the message processing loop.
        const isMessageCounterError = err?.name === 'MessageCounterError' || /MessageCounterError/i.test(err?.message || '');
        if (isMessageCounterError) {
          logger.warn({ phone: normalized, error: err.message }, 'baileys.incoming.handle.message_counter_error');
        } else {
          logger.error({ phone: normalized, error: err.message }, 'baileys.incoming.handle.failed');
        }
      }
    }
  });

  return waitForQrOrConnect(session, options);
}

async function handleQr(session, qrString) {
  try {
    const dataUrl = await QRCode.toDataURL(qrString, { margin: 2, width: 400 });
    session.qrCode = dataUrl;
    session.lastQrAt = new Date().toISOString();
    logger.info({ phone: session.phone }, 'baileys.qr.generated');
    for (const resolver of session.qrResolvers) {
      resolver({ qrCode: dataUrl, sessionId: session.phone });
    }
    session.qrResolvers.clear();
  } catch (err) {
    logger.error({ phone: session.phone, error: err.message }, 'baileys.qr.generate.failed');
  }
}

function resolveOpen(session) {
  for (const resolver of session.openResolvers) {
    resolver({ connected: true, sessionId: session.phone });
  }
  session.openResolvers.clear();
}

/**
 * Wait for QR code or connection to open
 * @param {import('./types').Session} session 
 * @param {Object} options 
 * @returns {Promise<{ qrCode: string|null, sessionId: string, connected: boolean }>}
 */
function waitForQrOrConnect(session, options = {}) {
  const { returnOnOpen = false } = options;
  const status = getSessionStatus(session.phone);
  if (status.connected) {
    return Promise.resolve({ qrCode: null, sessionId: session.phone, connected: true });
  }
  if (status.qrCode && !returnOnOpen) {
    return Promise.resolve({ qrCode: status.qrCode, sessionId: session.phone });
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for QR code or connection'));
    }, QR_TIMEOUT_MS);

    const qrResolver = (result) => {
      clearTimeout(timeout);
      cleanup();
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve({ ...result, connected: false });
      }
    };

    const openResolver = (result) => {
      clearTimeout(timeout);
      cleanup();
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve({ ...result, qrCode: null });
      }
    };

    function cleanup() {
      session.qrResolvers?.delete(qrResolver);
      session.openResolvers?.delete(openResolver);
    }

    session.qrResolvers.add(qrResolver);
    session.openResolvers.add(openResolver);
  });
}

/**
 * Send a WhatsApp message
 * @param {string} phone - FROM number
 * @param {string} to - TO number (JID or number)
 * @param {string} text - Message text
 * @param {Object} media - Optional media { url, buffer, base64 }
 * @returns {Promise<any>}
 */
export async function sendMessage(phone, to, text, media = null) {
  const sessionPhone = phone ? normalizePhone(phone) : normalizePhone(DEFAULT_SESSION_PHONE);
  if (!sessionPhone) {
    throw new Error('No session phone provided and no DEFAULT_SESSION_PHONE configured');
  }

  const session = sessions.get(sessionPhone);
  const controller = connectionControllers.get(sessionPhone);
  
  // Use ConnectionController to check if messages can be sent
  if (controller && !controller.canAcceptMessages()) {
    // Queue message for later delivery
    const messageId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enqueued = controller.enqueuePendingDelivery(messageId, to, text, media);
    if (enqueued) {
      logger.info({ phone: sessionPhone, messageId, queueSize: controller.getPendingDeliveriesSize() }, 'baileys.message.queued');
      return { queued: true, messageId };
    } else {
      throw new Error(`WhatsApp session ${sessionPhone} queue is full (state: ${controller.getState()})`);
    }
  }

  if (!session || !session.socket || session.connectionState !== 'open') {
    throw new Error(`WhatsApp session ${sessionPhone} is not connected`);
  }

  // NOTE: Currently assumes all recipients are individual users (@s.whatsapp.net).
  // For groups, use @g.us suffix.
  const jid = to.includes('@') ? to : phoneToJid(to);
  const message = {};
  if (text) message.text = text;

  if (media) {
    if (media.url) {
      message.image = { url: media.url };
      if (text) message.caption = text;
    } else if (media.buffer || media.base64) {
      const buffer = media.buffer || Buffer.from(media.base64, 'base64');
      message.image = buffer;
      if (text) message.caption = text;
    } else {
      throw new Error('Unsupported media format. Use { url } or { base64 }');
    }
  }

  const result = await Promise.race([
    session.socket.sendMessage(jid, message),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send message timeout')), SEND_MESSAGE_TIMEOUT_MS)
    ),
  ]);

  // Track sent message ID so we don't process our own replies as new incoming messages.
  if (result?.key?.id) {
    addOutboundMessageId(sessionPhone, jid, result.key.id);
  }
  
  // Record activity in ConnectionController
  if (controller) {
    controller.handleOutgoingMessage();
  }
  
  return result;
}

/**
 * Disconnect and logout a session. Optionally deletes persisted auth state
 * so the next pairing starts with a clean slate (recommended for re-linking).
 * @param {string} phone
 * @param {boolean} deleteAuthState - Whether to delete auth_state files after logout
 * @returns {Promise<boolean>}
 */
export async function disconnectSession(phone, deleteAuthState = false) {
  const normalized = normalizePhone(phone);
  const session = sessions.get(normalized);
  const controller = connectionControllers.get(normalized);

  stopHeartbeat(normalized);
  stopHealthProbe(normalized);

  // Shutdown ConnectionController
  if (controller) {
    controller.shutdown();
    connectionControllers.delete(normalized);
  }

  if (session) {
    try {
      if (session.socket) {
        await session.socket.logout();
      }
    } catch (err) {
      logger.warn({ phone: normalized, error: err.message }, 'baileys.logout.error');
    } finally {
      sessions.delete(normalized);
    }
  }

  if (deleteAuthState) {
    try {
      const sessionDir = path.join(AUTH_STATE_DIR, normalized);
      await fs.rm(sessionDir, { recursive: true, force: true });
      logger.info({ phone: normalized, sessionDir }, 'baileys.auth_state.deleted');
    } catch (err) {
      logger.warn({ phone: normalized, error: err.message }, 'baileys.auth_state.delete_failed');
    }
  }

  return true;
}

/**
 * Restore sessions from auth_state directory on startup
 * @returns {Promise<void>}
 */
export async function restoreSessions() {
  try {
    const entries = await fs.readdir(AUTH_STATE_DIR, { withFileTypes: true });
    const phones = entries
      .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map(entry => entry.name);

    logger.info({ count: phones.length }, 'baileys.restore.sessions');

    const results = await Promise.allSettled(phones.map(phone => createSession(phone)));
    
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error({
        total: phones.length,
        failed: failed.length,
        errors: failed.map(f => f.reason.message)
      }, 'baileys.restore.partial_failure');
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ error: err.message }, 'baileys.restore.error');
    }
  }
}

/**
 * Gracefully stop all sessions and heartbeats without deleting credentials.
 * Intended to be called from the process shutdown handler (e.g. SIGTERM/SIGINT).
 * @returns {Promise<void>}
 */
export async function shutdownAllSessions() {
  logger.info('baileys.shutdown.start', { count: sessions.size });

  // Stop all heartbeats and health probes first so they don't fire during shutdown.
  for (const [phone, heartbeat] of sessionHeartbeats.entries()) {
    clearInterval(heartbeat);
    sessionHeartbeats.delete(phone);
  }
  for (const [phone, timer] of healthProbeTimers.entries()) {
    clearInterval(timer);
    healthProbeTimers.delete(phone);
  }

  // Shutdown all ConnectionControllers
  for (const [phone, controller] of connectionControllers.entries()) {
    try {
      controller.shutdown();
    } catch (err) {
      logger.warn({ phone, error: err.message }, 'baileys.shutdown.controller_error');
    }
  }
  connectionControllers.clear();

  for (const [phone, session] of sessions.entries()) {
    try {
      if (session.socket && typeof session.socket.ev?.removeAllListeners === 'function') {
        session.socket.ev.removeAllListeners();
      }
      if (session.socket && typeof session.socket.end === 'function') {
        session.socket.end();
      }
    } catch (err) {
      logger.warn({ phone, error: err.message }, 'baileys.shutdown.session_error');
    }
  }

  // Flush any pending debounce buffers so messages are not lost on shutdown.
  // Await all flushes so the process does not exit before webhooks are sent.
  const flushPromises = [];
  for (const [key, buffer] of debounceBuffers.entries()) {
    if (buffer.timer) clearTimeout(buffer.timer);
    const [sessionPhone] = key.split(':');
    const session = sessions.get(sessionPhone);
    if (session) {
      flushPromises.push(flushDebounceBuffer(key, session));
    }
  }
  if (flushPromises.length > 0) {
    await Promise.all(flushPromises);
  }
  debounceBuffers.clear();

  sessions.clear();
  outboundMessageIds.clear();
  processedMessageIds.clear();

  logger.info('baileys.shutdown.complete', { count: 0 });
}

// Test-only exports for internal helpers. These are not part of the public API
// and may change without notice.
export {
  isHealthProbeFailure,
  createSocketLogger,
  startHealthProbe,
  stopHealthProbe,
  healthProbeTimers,
};

// The exported shutdownAllSessions() must be called by the process lifecycle
// manager (e.g. baileys-service/src/index.js). Do NOT register signal handlers
// here to avoid double shutdown races when index.js also registers handlers.
