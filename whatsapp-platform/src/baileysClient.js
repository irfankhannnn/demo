import path from 'path';
import fs from 'fs/promises';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  getHistoryMsg,
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
  BROWSER_NAME,
  HEALTH_PROBE_INTERVAL_MS,
  HEALTH_PROBE_TIMEOUT_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
  LOCAL_STORAGE,
  PROCESS_EXTERNAL_MESSAGES,
} from './config.js';
import { ConnectionController } from './connection-controller.js';
import { STATES } from './connection-state.js';
import { isRetryableError } from './reconnect-policy.js';
import { LRUCache } from 'lru-cache';
import { getAuthState, deleteAuthState as deletePersistedAuthState, listPersistedPhones } from './storage/authState.js';
import { upsertSession, deleteSession } from './storage/sessionRepository.js';
import { events } from './events/index.js';
import {
  acknowledgeInbound,
  drainInbound,
  enqueueInbound,
  failInbound,
} from './inbound-deliveries.js';
import { drainOutbound, enqueueOutbound } from './outbound-deliveries.js';

/** @type {Map<string, import('./types').Session>} */
const sessions = new Map();

/** @type {Map<string, ConnectionController>} */
const connectionControllers = new Map();

// One initializer per phone prevents startup restoration, API pairing, and a
// reconnect timer from constructing multiple sockets for the same account.
const sessionInitializers = new Map();

/** @type {Map<string, NodeJS.Timeout>} */
const sessionHeartbeats = new Map();

/** @type {Map<string, NodeJS.Timeout>} */
const healthProbeTimers = new Map();

// Outbound message dedup (prevents echo loops)
const outboundMessageIds = new LRUCache({ max: 10000, ttl: 24 * 60 * 60 * 1000 });

// All-forwarded message dedup (prevents duplicate webhooks)
const processedMessageIds = new LRUCache({ max: 50000, ttl: 24 * 60 * 60 * 1000 });

// Per-sender debounce buffers
const debounceBuffers = new Map();
const MAX_DEBOUNCE_BUFFER_SIZE = 100;

async function deliverInbound(payload) {
  await events.messageReceived({ ...payload, phone: payload.to });
}

// ─── JID utilities ────────────────────────────────────────────────────────────
function jidToPhone(jid) {
  if (!jid) return '';
  return String(jid).replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
}

function normalizeLid(jid) {
  return jid?.replace(/:\d+(?=@lid)/, '') || '';
}

function normalizeJidForKey(jid) {
  if (!jid) return '';
  return String(jid).replace(/:\d+(?=@)/, '');
}

function isSelfChat(remoteJid, remotePhone, sessionPhone, ownJid, ownLid, ownPhone) {
  return (
    remoteJid === `${sessionPhone}@s.whatsapp.net` ||
    remoteJid === ownJid ||
    (ownLid && normalizeLid(remoteJid) === normalizeLid(ownLid)) ||
    (remotePhone && remotePhone === sessionPhone) ||
    (remotePhone && ownPhone && remotePhone === ownPhone)
  );
}

function normalizePhone(phone) {
  const normalized = String(phone).replace(/\D/g, '');
  if (!normalized) throw new Error('Phone number cannot be empty after normalization');
  return normalized;
}

async function ensureLocalPreKeysAfterConnect(phone, controller) {
  if (!LOCAL_STORAGE || !controller?.preKeyRecovery) return;
  try {
    const authDir = path.join(AUTH_STATE_DIR, normalizePhone(phone));
    const files = await fs.readdir(authDir);
    const preKeyCount = files.filter((f) => f.startsWith('pre-key-')).length;
    if (preKeyCount > 0) return;
    logger.warn({ phone: normalizePhone(phone) }, 'prekey.missing_local.regenerating');
    await controller.preKeyRecovery.rotatePreKeys();
  } catch (err) {
    logger.warn({ phone: normalizePhone(phone), error: err.message }, 'prekey.missing_local.regenerate_failed');
  }
}

function phoneToJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

// ─── Outbound message tracking ────────────────────────────────────────────────
function addOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return;
  outboundMessageIds.set(`${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`, true);
}

function hasOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return false;
  return outboundMessageIds.has(`${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`);
}

function deleteOutboundMessageId(sessionPhone, remoteJid, id) {
  if (!sessionPhone || !remoteJid || !id) return;
  outboundMessageIds.delete(`${normalizePhone(sessionPhone)}:${normalizeJidForKey(remoteJid)}:${id}`);
}

function markMessageProcessed(id) {
  if (!id) return true;
  if (processedMessageIds.has(id)) return false;
  processedMessageIds.set(id, true);
  return true;
}

// ─── Debounce ─────────────────────────────────────────────────────────────────
function shouldSkipDebounce(message) {
  if (!message) return true;
  if (message.message?.imageMessage || message.message?.videoMessage ||
      message.message?.audioMessage || message.message?.documentMessage) return true;
  if (message.message?.locationMessage) return true;
  if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) return true;
  return false;
}

function buildDebounceKey(sessionPhone, remoteJid) {
  const phone = sessionPhone ? normalizePhone(sessionPhone) : '';
  return `${phone}:${normalizeJidForKey(remoteJid)}`;
}

function flushDebounceBuffer(key, session) {
  const buffer = debounceBuffers.get(key);
  if (!buffer) return Promise.resolve();
  debounceBuffers.delete(key);
  if (buffer.messages.length === 0) return Promise.resolve();
  if (buffer.messages.length === 1) {
    return handleIncomingMessage(session, buffer.messages[0]).catch(err => {
      logger.error({ phone: session.phone, key, error: err.message }, 'debounce.handle_failed');
    });
  }
  const latest = buffer.messages[buffer.messages.length - 1];
  const combinedText = buffer.messages.map(getMessageText).filter(Boolean).join('\n');
  const combined = { ...latest, message: { ...latest.message, conversation: combinedText, extendedTextMessage: { text: combinedText } } };
  return handleIncomingMessage(session, combined).catch(err => {
    logger.error({ phone: session.phone, key, error: err.message }, 'debounce.handle_failed');
  });
}

function debounceIncomingMessage(session, message) {
  const remoteJid = message.key?.remoteJid;
  const key = buildDebounceKey(session.phone, remoteJid);
  if (!debounceBuffers.has(key)) debounceBuffers.set(key, { messages: [], timer: null });
  const buffer = debounceBuffers.get(key);
  buffer.messages.push(message);
  if (buffer.messages.length > MAX_DEBOUNCE_BUFFER_SIZE) {
    buffer.messages.shift();
    logger.warn({ phone: session.phone, key }, 'debounce.buffer_capped');
  }
  if (buffer.timer) clearTimeout(buffer.timer);
  buffer.timer = setTimeout(() => flushDebounceBuffer(key, session), MESSAGE_DEBOUNCE_MS);
}

// ─── Heartbeat / health probe ─────────────────────────────────────────────────
function startHeartbeat(session) {
  stopHeartbeat(session.phone);
  const heartbeat = setInterval(() => {
    logger.info({ phone: session.phone, state: session.connectionState }, 'connection.heartbeat');
  }, 60000);
  sessionHeartbeats.set(session.phone, heartbeat);
}

function stopHeartbeat(phone) {
  const h = sessionHeartbeats.get(normalizePhone(phone));
  if (h) { clearInterval(h); sessionHeartbeats.delete(normalizePhone(phone)); }
}

function isHealthProbeFailure(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes('bad mac') || msg.includes('no matching session') ||
    msg.includes('invalid prekey id') || msg.includes('session not found') ||
    msg.includes('mac verification') || error?.output?.statusCode === 408 || error?.statusCode === 408
  );
}

function startHealthProbe(session) {
  stopHealthProbe(session.phone);
  const phone = session.phone;
  const timer = setInterval(async () => {
    const sock = session.socket;
    if (!sock || session.connectionState !== 'open') return;
    const ownJid = sock.user?.id;
    if (!ownJid) return;
    const controller = connectionControllers.get(phone);
    try {
      await Promise.race([
        sock.sendPresenceUpdate('available', ownJid),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Health probe timeout')), HEALTH_PROBE_TIMEOUT_MS)),
      ]);
      if (controller) controller.recordActivity();
    } catch (err) {
      logger.warn({ phone, error: err.message }, 'health_probe.failed');
      if (isHealthProbeFailure(err) && typeof sock.end === 'function') {
        try { sock.end(); } catch (_) {}
      }
    }
  }, HEALTH_PROBE_INTERVAL_MS);
  healthProbeTimers.set(phone, timer);
}

function stopHealthProbe(phone) {
  const t = healthProbeTimers.get(normalizePhone(phone));
  if (t) { clearInterval(t); healthProbeTimers.delete(normalizePhone(phone)); }
}

// ─── Socket logger proxy ──────────────────────────────────────────────────────
function createSocketLogger(session, baseLogger) {
  const child = baseLogger.child({ module: 'baileys-socket' });

  function noteRetryReceipt(args) {
    const meta = args.find((a) => a && typeof a === 'object' && a.msgAttrs);
    const from = meta?.msgAttrs?.from;
    if (from === 'status@broadcast' || String(from || '').endsWith('@broadcast')) {
      return;
    }
    // A retry receipt is scoped to one envelope. Treating three receipts as a
    // whole-account crypto failure erased valid session state and created an
    // endless restart loop.
    logger.debug(
      { phone: session.phone, from, messageId: meta?.msgAttrs?.id },
      'incoming.retry_receipt.sent'
    );
  }

  function detectInitQueryTimeout(args) {
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        const err = arg.err || arg.error || arg;
        if (err && typeof err === 'object') {
          const message = String(err.message || arg.message || '').toLowerCase();
          const statusCode = err.output?.statusCode || err.statusCode || arg.statusCode;
          if (message.includes('init queries') || statusCode === 408) {
            return err instanceof Error ? err : new Error(String(err.message || err));
          }
        }
      }
    }
    return null;
  }

  function isIgnoredBroadcastDecryptError(args) {
    const details = args.find((arg) => arg && typeof arg === 'object' && arg.key);
    return isSkippableJid(details?.key?.remoteJid);
  }

  return new Proxy(child, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if ((prop === 'error' || prop === 'fatal') && typeof original === 'function') {
        return (...args) => {
          if (isIgnoredBroadcastDecryptError(args)) {
            return undefined;
          }
          const timeoutError = detectInitQueryTimeout(args);
          if (timeoutError) logger.warn({ phone: session.phone, error: timeoutError.message }, 'init_queries.timeout');
          return original.apply(target, args);
        };
      }
      if (prop === 'info' && typeof original === 'function') {
        return (...args) => {
          const logMsg = args.find((a) => typeof a === 'string');
          if (logMsg === 'sent retry receipt') noteRetryReceipt(args);
          return original.apply(target, args);
        };
      }
      if (typeof original === 'function') return original.bind(target);
      return original;
    },
  });
}

// ─── Connection state persistence ─────────────────────────────────────────────
async function saveConnectionState(phone, session) {
  try {
    if (LOCAL_STORAGE) {
      const dir = path.join(AUTH_STATE_DIR, normalizePhone(phone));
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, 'connection-state.json');
      await fs.writeFile(file, JSON.stringify({
        phone: normalizePhone(phone),
        connectionState: session.connectionState,
        lastQrAt: session.lastQrAt,
        lastError: session.lastError,
        createdAt: session.createdAt,
        updatedAt: new Date().toISOString(),
      }, null, 2), 'utf-8');
    }
    // In S3 mode the session repo handles status
  } catch (err) {
    logger.warn({ phone: normalizePhone(phone), error: err.message }, 'connection.state.save_failed');
  }
}

function isSkippableJid(jid) {
  if (!jid) return true;
  const normalized = String(jid);
  return (
    normalized === 'status@broadcast' ||
    normalized.endsWith('@newsletter') ||
    normalized.endsWith('@broadcast')
  );
}

/** True when Baileys delivered a stub with no decryptable payload. */
function isUndecryptableMessage(message) {
  if (!message?.message) return true;
  return Object.keys(message.message).length === 0;
}

// ─── Message helpers ──────────────────────────────────────────────────────────
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
 * Current-message-only delivery contract.
 *
 * `append` is Baileys' offline/history catch-up channel. It is deliberately
 * ignored: old messages cannot be reliably decrypted or replayed after a
 * restart. A message received while this socket is online arrives as `notify`.
 */
function shouldIngestUpsert(upsert, message) {
  return upsert.type === 'notify' &&
    !getHistoryMsg(message?.message) &&
    !isSkippableJid(message?.key?.remoteJid);
}

// ─── Incoming message handler ─────────────────────────────────────────────────
async function handleIncomingMessage(session, message, upsertType = 'notify') {
  const senderJid = message.key?.participant || message.key?.remoteJid;
  const to = session.phone;
  const text = getMessageText(message);
  const messageId = message.key?.id;
  const fromMe = message.key?.fromMe === true;

  const ownJid = session.socket?.user?.id;
  const ownLid = session.socket?.user?.lid || session.ownLid;
  const remoteJid = message.key?.remoteJid;
  const remotePhone = jidToPhone(remoteJid);
  const ownPhone = jidToPhone(ownJid);
  const isSelfChatResult = isSelfChat(remoteJid, remotePhone, session.phone, ownJid, ownLid, ownPhone);
  const from = isSelfChatResult ? session.phone : jidToPhone(senderJid);

  if (!from || !messageId) {
    logger.warn({ reason: 'missing_from_or_id' }, 'incoming.skip');
    return;
  }

  const controller = connectionControllers.get(to);
  if (controller) controller.handleIncomingMessage();

  if (!text || !text.trim()) {
    const undecryptable = isUndecryptableMessage(message);
    const logLevel = undecryptable && upsertType === 'notify' ? 'warn' : 'debug';
    logger[logLevel]({
      phone: session.phone,
      messageId,
      fromMe,
      remoteJid,
      upsertType,
      undecryptable,
      reason: undecryptable ? 'undecryptable' : 'non_text_message',
    }, 'incoming.empty_text_skip');
    return;
  }

  if (!markMessageProcessed(messageId)) {
    logger.info({ phone: session.phone, messageId }, 'incoming.duplicate_skip');
    return;
  }

  const isGroup = String(remoteJid).endsWith('@g.us');
  const payload = {
    messageId, from, to, text, fromMe, isSelfChat: isSelfChatResult, isGroup,
    fromJid: senderJid, timestamp: new Date().toISOString(),
  };

  // Persist before delivery. A successful CRM acknowledgement removes the item;
  // a restart or transient CRM failure leaves it available for retry.
  await enqueueInbound(payload);
  try {
    await deliverInbound(payload);
    await acknowledgeInbound(messageId);
  } catch (error) {
    await failInbound(messageId, error);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

export function listSessions() {
  return Array.from(sessions.entries()).map(([phone, session]) => ({
    phone,
    ...getSessionStatus(phone),
    createdAt: session.createdAt,
  }));
}

export function createSession(phone, options = {}) {
  const normalized = normalizePhone(phone);
  const existing = sessionInitializers.get(normalized);
  if (existing) return existing;
  const initializer = createSessionInternal(phone, options)
    .finally(() => sessionInitializers.delete(normalized));
  sessionInitializers.set(normalized, initializer);
  return initializer;
}

async function createSessionInternal(phone, options = {}) {
  const normalized = normalizePhone(phone);
  const existing = sessions.get(normalized);

  if (existing && existing.socket && existing.connectionState === 'open') {
    logger.info({ phone: normalized }, 'session.reuse');
    return waitForQrOrConnect(existing, options);
  }

  if (existing && existing.socket) {
    logger.warn({ phone: normalized, state: existing.connectionState }, 'session.dead_socket');
    try {
      existing.socket.ev.removeAllListeners();
      if (typeof existing.socket.end === 'function') existing.socket.end();
    } catch (_) {}
    existing.socket = null;
  }

  // Get auth state (S3 or local filesystem)
  const { state, saveCreds } = await getAuthState(normalized);
  const { version } = await fetchLatestBaileysVersion();

  /** @type {import('./types').Session} */
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

  // Persist initial session record
  upsertSession(normalized, { status: 'CONNECTING' }).catch(err =>
    logger.warn({ phone: normalized, error: err.message }, 'session.repo.upsert_failed')
  );

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

  // Stop any prior controller before replacing it. Reconnect/createSession paths
  // previously left orphaned watchdog timers running (same phone, stale lastActivityTime).
  const priorController = connectionControllers.get(normalized);
  if (priorController) {
    priorController.shutdown();
    connectionControllers.delete(normalized);
  }

  const controller = new ConnectionController(normalized, sock, {
    watchdog: { inactivityTimeout: 10 * 60 * 1000, heartbeatInterval: 60 * 1000 },
    reconnect: { baseDelay: 2000, maxDelay: 30000, multiplier: 1.8, jitterFactor: 0.25 },
  });
  await controller.initialize();
  connectionControllers.set(normalized, controller);
  controller.updateSocket(sock);

  sock.ev.on('creds.update', saveCreds);

  // AI self-chat triggers
  const AI_TRIGGERS = (process.env.AI_SELF_CHAT_TRIGGERS || 'AI:,Bot:,Hey bot')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  function hasAiTrigger(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    return AI_TRIGGERS.some(t => lower.startsWith(t));
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) handleQr(session, qr);

    if (connection) {
      session.connectionState = connection;
      logger.info({ phone: normalized, connection }, 'connection.update');
      const wasReconnecting = connection === 'close' && controller.getState() === STATES.RECONNECTING;
      controller.handleConnectionUpdate(connection);
      saveConnectionState(phone, session).catch(() => {});

      if (connection === 'open') {
        session.qrCode = null;
        // Capture own LID from connection update (WhatsApp's new LID format)
        const ownLid =
          update.me?.lid ||
          sock.user?.lid ||
          state?.creds?.me?.lid;
        if (ownLid) {
          session.ownLid = ownLid;
          logger.info({ phone: normalized, ownLid: session.ownLid }, 'connection.own_lid.captured');
        }
        await ensureLocalPreKeysAfterConnect(normalized, controller);
        startHeartbeat(session);
        startHealthProbe(session);
        resolveOpen(session);
        upsertSession(normalized, { status: 'CONNECTED', connectedAt: new Date().toISOString() })
          .catch(err => logger.warn({ phone: normalized, error: err.message }, 'session.repo.connected_failed'));
        events.sessionConnected({ phone: normalized }).catch(() => {});
        drainInbound(deliverInbound).catch((err) =>
          logger.error({ phone: normalized, error: err.message }, 'inbound_delivery.drain_failed')
        );
        drainOutbound(normalized, (delivery) =>
          sendMessage(delivery.from, delivery.to, delivery.text, delivery.media, delivery.id, true)
        ).catch((err) =>
          logger.error({ phone: normalized, error: err.message }, 'outbound_delivery.drain_failed')
        );

        if (controller?.hasPendingDeliveries()) {
          controller.drainPendingDeliveries(async (p, to, text, media) => sendMessage(p, to, text, media))
            .catch(err => logger.error({ phone: normalized, error: err.message }, 'pending_deliveries.drain_failed'));
        }
      }

      if (connection === 'close') {
        stopHeartbeat(normalized);
        stopHealthProbe(normalized);
        const isIntentionalReconnect = wasReconnecting;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const error = lastDisconnect?.error;
        const shouldReconnect = !isLoggedOut && (
          isIntentionalReconnect ||
          (error instanceof Boom && isRetryableError(error))
        );

        upsertSession(normalized, { status: isLoggedOut ? 'LOGGED_OUT' : 'DISCONNECTED', disconnectedAt: new Date().toISOString() })
          .catch(() => {});
        events.sessionDisconnected({ phone: normalized, reason: error?.message || 'close' }).catch(() => {});

        if (shouldReconnect) {
          controller.recordReconnectAttempt(false, error);
          if (!controller.shouldRetry()) {
            logger.error({ phone: normalized }, 'connection.reconnect_exhausted');
            session.lastError = error?.message || 'reconnect_exhausted';
            cleanup(normalized, session);
            return;
          }
          session.socket = null;
          session.connectionState = 'connecting';
          const delay = controller.getNextReconnectDelay();
          logger.warn({ phone: normalized, reason: error?.message, delay }, 'connection.reconnect');
          setTimeout(() => {
            createSession(phone).catch(err =>
              logger.error({ phone: normalized, error: err.message }, 'reconnect.failed')
            );
          }, delay);
        } else {
          session.lastError = lastDisconnect?.error?.message || 'connection_closed';
          logger.error({ phone: normalized, error: session.lastError }, 'connection.closed');
          if (isLoggedOut) events.sessionAuthFailure({ phone: normalized }).catch(() => {});
          cleanup(normalized, session);
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    for (const message of upsert.messages) {
      if (!shouldIngestUpsert(upsert, message)) continue;
      const remoteJid = message.key?.remoteJid;
      if (isSkippableJid(remoteJid)) continue;
      const ownJid = session.socket?.user?.id;
      const ownLid = session.socket?.user?.lid || session.ownLid;
      const remotePhone = jidToPhone(remoteJid);
      const ownPhone = jidToPhone(ownJid);
      const text = getMessageText(message);
      const fromMe = message.key?.fromMe;
      const isSelfChatResult = isSelfChat(remoteJid, remotePhone, session.phone, ownJid, ownLid, ownPhone);

      // Messages from yourself (fromMe=true) are ALWAYS processed.
      // Messages from other people (fromMe=false) are only processed if PROCESS_EXTERNAL_MESSAGES is enabled.
      const shouldProcess = fromMe
        ? true
        : PROCESS_EXTERNAL_MESSAGES;

      // Capture own LID from first self-message if not already known
      if (fromMe && remoteJid?.endsWith('@lid') && !session.ownLid && !remoteJid.includes('@g.us')) {
        session.ownLid = remoteJid;
        logger.info({ phone: normalized, ownLid: session.ownLid }, 'connection.own_lid.captured_from_message');
      }

      logger.info({
        phone: normalized, fromMe, remoteJid, isSelfChat: isSelfChatResult,
        shouldProcess, processExternal: PROCESS_EXTERNAL_MESSAGES,
        messageId: message.key?.id, text: text?.slice(0, 100),
      }, 'messages.upsert');

      if (hasOutboundMessageId(normalized, remoteJid, message.key?.id)) {
        deleteOutboundMessageId(normalized, remoteJid, message.key?.id);
        logger.info({ phone: normalized, messageId: message.key?.id }, 'messages.upsert.echo_skip');
        continue;
      }
      if (!shouldProcess) {
        logger.info({ phone: normalized, fromMe, reason: fromMe ? 'self_chat_filter' : 'external_messages_disabled' }, 'messages.upsert.skip');
        continue;
      }

      try {
        if (MESSAGE_DEBOUNCE_MS > 0 && !shouldSkipDebounce(message)) {
          debounceIncomingMessage(session, message);
        } else {
          await handleIncomingMessage(session, message, upsert.type);
        }
      } catch (err) {
        const isCounterError = err?.name === 'MessageCounterError' || /MessageCounterError/i.test(err?.message || '');
        if (isCounterError) {
          logger.warn({ phone: normalized, error: err.message }, 'incoming.message_counter_error');
        } else {
          logger.error({ phone: normalized, error: err.message }, 'incoming.handle_failed');
        }
      }
    }
  });

  return waitForQrOrConnect(session, options);
}

function cleanup(phone, session) {
  sessions.delete(phone);
  const controller = connectionControllers.get(phone);
  if (controller) {
    controller.shutdown();
    connectionControllers.delete(phone);
  }
  for (const resolver of session.qrResolvers) resolver({ error: session.lastError });
  for (const resolver of session.openResolvers) resolver({ error: session.lastError });
  session.qrResolvers.clear();
  session.openResolvers.clear();
}

async function handleQr(session, qrString) {
  try {
    const dataUrl = await QRCode.toDataURL(qrString, { margin: 2, width: 400 });
    session.qrCode = dataUrl;
    session.lastQrAt = new Date().toISOString();
    logger.info({ phone: session.phone }, 'qr.generated');
    upsertSession(session.phone, { status: 'WAITING_QR' }).catch(() => {});
    for (const resolver of session.qrResolvers) resolver({ qrCode: dataUrl, sessionId: session.phone });
    session.qrResolvers.clear();
  } catch (err) {
    logger.error({ phone: session.phone, error: err.message }, 'qr.generate_failed');
  }
}

function resolveOpen(session) {
  for (const resolver of session.openResolvers) resolver({ connected: true, sessionId: session.phone });
  session.openResolvers.clear();
}

function waitForQrOrConnect(session, options = {}) {
  const { returnOnOpen = false } = options;
  const status = getSessionStatus(session.phone);
  if (status.connected) return Promise.resolve({ qrCode: null, sessionId: session.phone, connected: true });
  if (status.qrCode && !returnOnOpen) return Promise.resolve({ qrCode: status.qrCode, sessionId: session.phone });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup_resolvers();
      reject(new Error('Timeout waiting for QR code or connection'));
    }, QR_TIMEOUT_MS);

    const qrResolver = (result) => {
      clearTimeout(timeout); cleanup_resolvers();
      result.error ? reject(new Error(result.error)) : resolve({ ...result, connected: false });
    };
    const openResolver = (result) => {
      clearTimeout(timeout); cleanup_resolvers();
      result.error ? reject(new Error(result.error)) : resolve({ ...result, qrCode: null });
    };
    function cleanup_resolvers() {
      session.qrResolvers?.delete(qrResolver);
      session.openResolvers?.delete(openResolver);
    }
    session.qrResolvers.add(qrResolver);
    session.openResolvers.add(openResolver);
  });
}

export async function sendMessage(phone, to, text, media = null, deliveryId = null, skipQueue = false) {
  const sessionPhone = phone ? normalizePhone(phone) : normalizePhone(DEFAULT_SESSION_PHONE);
  if (!sessionPhone) throw new Error('No session phone provided and DEFAULT_SESSION_PHONE not configured');

  const session = sessions.get(sessionPhone);
  const controller = connectionControllers.get(sessionPhone);
  const queueDelivery = async () => {
    const id = deliveryId || `outbound_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await enqueueOutbound({ id, from: sessionPhone, to, text, media });
    logger.info({ phone: sessionPhone, to, messageId: id }, 'message.queued');
    return { queued: true, messageId: id };
  };

  if (!skipQueue && controller && !controller.canAcceptMessages()) {
    const messageId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return queueDelivery(messageId);
  }

  if (!session || !session.socket || session.connectionState !== 'open') {
    if (!skipQueue) return queueDelivery();
    throw new Error(`WhatsApp session ${sessionPhone} is not connected`);
  }

  const jid = to.includes('@') ? to : phoneToJid(to);
  const msgContent = {};
  if (text) msgContent.text = text;

  if (media) {
    if (media.url) {
      msgContent.image = { url: media.url };
      if (text) msgContent.caption = text;
    } else if (media.buffer || media.base64) {
      const buffer = media.buffer || Buffer.from(media.base64, 'base64');
      msgContent.image = buffer;
      if (text) msgContent.caption = text;
    } else {
      throw new Error('Unsupported media format. Use { url } or { base64 }');
    }
  }

  const result = await Promise.race([
    session.socket.sendMessage(jid, msgContent),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Send message timeout')), SEND_MESSAGE_TIMEOUT_MS)),
  ]);

  if (result?.key?.id) addOutboundMessageId(sessionPhone, jid, result.key.id);
  if (controller) controller.handleOutgoingMessage();

  events.messageSent({ phone: sessionPhone, to, messageId: result?.key?.id }).catch(() => {});

  return result;
}

export async function disconnectSession(phone, deleteAuth = false) {
  const normalized = normalizePhone(phone);
  const session = sessions.get(normalized);
  const controller = connectionControllers.get(normalized);

  stopHeartbeat(normalized);
  stopHealthProbe(normalized);

  if (controller) { controller.shutdown(); connectionControllers.delete(normalized); }

  if (session) {
    try {
      if (session.socket) await session.socket.logout();
    } catch (err) {
      logger.warn({ phone: normalized, error: err.message }, 'logout.error');
    } finally {
      sessions.delete(normalized);
    }
  }

  if (deleteAuth) {
    try {
      await deletePersistedAuthState(normalized);
      await deleteSession(normalized);
    } catch (err) {
      logger.warn({ phone: normalized, error: err.message }, 'auth_state.delete_failed');
    }
  } else {
    upsertSession(normalized, { status: 'DISCONNECTED', disconnectedAt: new Date().toISOString() }).catch(() => {});
  }

  events.sessionDisconnected({ phone: normalized }).catch(() => {});
  return true;
}

export async function restoreSessions() {
  const phones = await listPersistedPhones();
  logger.info({ count: phones.length }, 'restore.sessions');

  const results = [];
  const failed = [];

  // Stagger restoration to avoid connection storms (500ms between sessions)
  for (const phone of phones) {
    try {
      await createSession(phone);
      results.push({ phone, status: 'fulfilled' });
    } catch (err) {
      failed.push({ phone, error: err.message });
      results.push({ phone, status: 'rejected', error: err.message });
    }
    // Wait 500ms before next session to avoid overwhelming WhatsApp
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (failed.length > 0) {
    logger.error({
      total: phones.length, failed: failed.length,
      errors: failed.map(f => f.error),
    }, 'restore.partial_failure');
  }

  const restored = results.filter(r => r.status === 'fulfilled').length;
  for (const phone of phones) {
    const status = getSessionStatus(phone);
    if (status.connected) {
      events.sessionRestored({ phone }).catch(() => {});
    }
  }
  return { total: phones.length, restored, failed: failed.length };
}

export async function drainPendingInbound() {
  return drainInbound(deliverInbound);
}

export async function shutdownAllSessions(timeoutMs = 10000) {
  logger.info({ count: sessions.size, timeoutMs }, 'shutdown.start');

  const actualShutdown = async () => {
    for (const [, h] of sessionHeartbeats) clearInterval(h);
    sessionHeartbeats.clear();
    for (const [, t] of healthProbeTimers) clearInterval(t);
    healthProbeTimers.clear();

    for (const [phone, controller] of connectionControllers) {
      try { controller.shutdown(); } catch (err) { logger.warn({ phone, error: err.message }, 'shutdown.controller_error'); }
    }
    connectionControllers.clear();

    for (const [phone, session] of sessions) {
      try {
        if (session.socket?.ev?.removeAllListeners) session.socket.ev.removeAllListeners();
        if (session.socket?.end) session.socket.end();
      } catch (err) { logger.warn({ phone, error: err.message }, 'shutdown.session_error'); }
    }

    // Flush debounce buffers
    const flushPromises = [];
    for (const [key, buffer] of debounceBuffers) {
      if (buffer.timer) clearTimeout(buffer.timer);
      const [sessionPhone] = key.split(':');
      const session = sessions.get(sessionPhone);
      if (session) flushPromises.push(flushDebounceBuffer(key, session));
    }
    if (flushPromises.length > 0) await Promise.all(flushPromises);
    debounceBuffers.clear();

    sessions.clear();
    outboundMessageIds.clear();
    processedMessageIds.clear();
    logger.info('shutdown.complete');
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs)
  );

  try {
    await Promise.race([actualShutdown(), timeout]);
  } catch (err) {
    logger.error({ error: err.message }, 'shutdown.timeout');
    // Force cleanup even if timeout
    sessions.clear();
    outboundMessageIds.clear();
    processedMessageIds.clear();
    throw err;
  }
}

// Test-only exports
export {
  isHealthProbeFailure,
  isSkippableJid,
  shouldIngestUpsert,
  createSocketLogger,
  startHealthProbe,
  stopHealthProbe,
  healthProbeTimers,
};
