// Agent endpoints, contract section 4 — the laptop's only way in.
//
// Everything here except /register is HMAC-authenticated. /register is the
// exception by design: at that moment the laptop has no device secret yet, so
// the single-use, 15-minute pairing code *is* the credential. That is also why
// the code is consumed with a conditional write before any device row is
// created — a code that races two agents must pair exactly one.

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateDeviceSecret } from '../services/hmac.js';
import {
  toBudgetBracket,
  normalisePhone,
  normaliseIntent,
  normaliseTemperature,
  normaliseStatus,
  normaliseWindowState,
  toDateKey,
  maskPhone,
} from '../services/normalise.js';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/agent' });

function badRequest(res, details) {
  return res.status(400).json({ error: 'Bad Request', details });
}

/** Guards the 500-item ceiling from the contract before anything is written. */
function overBatchLimit(...arrays) {
  const max = getConfig().maxBatchItems;
  const total = arrays.reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  return total > max ? max : 0;
}

export function createAgentRouter({ db = defaultDb, deviceAuth } = {}) {
  const router = express.Router();

  if (typeof deviceAuth !== 'function') {
    throw new Error('createAgentRouter requires a deviceAuth middleware');
  }

  // -------------------------------------------------------------------------
  // POST /agent/register — pairing code auth, no HMAC.
  // -------------------------------------------------------------------------
  router.post('/register', async (req, res) => {
    const { pairingCode, deviceName, platform, agentVersion } = req.body || {};

    if (!pairingCode || typeof pairingCode !== 'string') {
      return badRequest(res, 'pairingCode is required');
    }

    try {
      const record = await db.getPairingCodeByCode(pairingCode);

      // DynamoDB's TTL sweep is best-effort and can lag by hours, so expiry is
      // re-checked here rather than assumed from the item's absence.
      const expired = record && Number(record.expiresAt) * 1000 < Date.now();
      if (!record || expired || record.usedAt) {
        log.warn('agent.register.rejected', { reason: !record ? 'unknown' : expired ? 'expired' : 'used' });
        return res.status(401).json({ error: 'Unauthorized', details: 'Pairing code is invalid, expired or already used' });
      }

      const consumed = await db.consumePairingCode(record.tenantId, record.code);
      if (!consumed) {
        return res.status(409).json({ error: 'Conflict', details: 'Pairing code was already claimed' });
      }

      const deviceId = uuidv4();
      const deviceSecret = generateDeviceSecret();

      await db.createDevice(record.tenantId, {
        deviceId,
        deviceSecret,
        deviceName,
        platform,
        agentVersion,
      });

      await db.putAuditEvent(record.tenantId, { action: 'device.registered', deviceId, platform });

      log.info('agent.register.ok', { tenantId: record.tenantId, deviceId });

      // deviceSecret crosses the wire exactly once, here. It is never returned
      // by any listing endpoint.
      return res.status(201).json({ deviceId, deviceSecret, tenantId: record.tenantId });
    } catch (err) {
      log.error('agent.register.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Registration failed' });
    }
  });

  // Everything below this line requires a valid HMAC signature.
  router.use(deviceAuth);

  // -------------------------------------------------------------------------
  // POST /agent/heartbeat
  // -------------------------------------------------------------------------
  router.post('/heartbeat', async (req, res) => {
    const { igUserId, igUsername, agentVersion, tokenExpiresAt, counters } = req.body || {};

    try {
      await db.updateDevice(req.tenantId, req.device.deviceId, {
        igUserId,
        igUsername,
        agentVersion,
        tokenExpiresAt,
        counters,
        lastSeenAt: new Date().toISOString(),
      });

      // killSwitch is the cheap global stop: the agent polls it on every
      // heartbeat, so flipping one env var halts collection fleet-wide without
      // revoking devices one at a time.
      return res.json({
        ok: true,
        serverTime: new Date().toISOString(),
        killSwitch: getConfig().killSwitch,
      });
    } catch (err) {
      log.error('agent.heartbeat.failed', { message: err.message, deviceId: req.device.deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Heartbeat failed' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /agent/snapshot — batched upsert of account + media state
  // -------------------------------------------------------------------------
  router.post('/snapshot', async (req, res) => {
    const { accounts = [], media = [], mediaSnapshots = [] } = req.body || {};

    if (![accounts, media, mediaSnapshots].every(Array.isArray)) {
      return badRequest(res, 'accounts, media and mediaSnapshots must be arrays');
    }

    const cap = overBatchLimit(accounts, media, mediaSnapshots);
    if (cap) return badRequest(res, `Batch exceeds the ${cap}-item limit`);

    try {
      const today = toDateKey();

      const accountRows = accounts
        .filter((a) => a && a.igUserId)
        .map((a) => ({ ...a, date: a.date || today }));

      const mediaRows = media.filter((m) => m && m.mediaId);

      const mediaSnapRows = mediaSnapshots
        .filter((s) => s && s.mediaId)
        .map((s) => ({ ...s, date: s.date || today }));

      const [accountsWritten, mediaWritten, snapshotsWritten] = await Promise.all([
        db.putAccountSnapshots(req.tenantId, accountRows),
        db.putMediaItems(req.tenantId, mediaRows),
        db.putMediaSnapshots(req.tenantId, mediaSnapRows),
      ]);

      return res.json({
        ok: true,
        accounts: accountsWritten,
        media: mediaWritten,
        mediaSnapshots: snapshotsWritten,
      });
    } catch (err) {
      log.error('agent.snapshot.failed', { message: err.message, deviceId: req.device.deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Snapshot upload failed' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /agent/enquiries — idempotent on enquiryId
  // -------------------------------------------------------------------------
  router.post('/enquiries', async (req, res) => {
    const { enquiries } = req.body || {};
    if (!Array.isArray(enquiries)) return badRequest(res, 'enquiries must be an array');

    const cap = overBatchLimit(enquiries);
    if (cap) return badRequest(res, `Batch exceeds the ${cap}-item limit`);

    const rejected = [];
    const rows = [];

    for (const e of enquiries) {
      if (!e || !e.enquiryId) {
        rejected.push({ enquiryId: e?.enquiryId ?? null, reason: 'enquiryId is required' });
        continue;
      }

      // Normalise server-side as well as on the laptop: an older agent build
      // uploading raw "2.5cr" strings must not poison the dashboard filters.
      rows.push({
        ...e,
        phone: normalisePhone(e.phone),
        intent: normaliseIntent(e.intent),
        temperature: normaliseTemperature(e.temperature),
        status: normaliseStatus(e.status) || 'new',
        budgetBracket: e.budgetBracket && e.budgetBracket !== 'unknown'
          ? e.budgetBracket
          : toBudgetBracket(e.budget ?? e.budgetBracket),
      });
    }

    try {
      const written = await db.putEnquiries(req.tenantId, rows);
      log.info('agent.enquiries.upserted', {
        tenantId: req.tenantId,
        written,
        rejected: rejected.length,
        // Masked, never the full number.
        sample: rows[0] ? maskPhone(rows[0].phone) : null,
      });
      return res.json({ ok: true, written, rejected });
    } catch (err) {
      log.error('agent.enquiries.failed', { message: err.message, deviceId: req.device.deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Enquiry upload failed' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /agent/threads — batched upsert
  // -------------------------------------------------------------------------
  router.post('/threads', async (req, res) => {
    const { threads } = req.body || {};
    if (!Array.isArray(threads)) return badRequest(res, 'threads must be an array');

    const cap = overBatchLimit(threads);
    if (cap) return badRequest(res, `Batch exceeds the ${cap}-item limit`);

    const rows = threads
      .filter((t) => t && t.conversationId)
      // An unrecognised window state is coerced to CLOSED rather than stored
      // verbatim: the sender treats anything it does not understand as
      // un-sendable, which is the safe direction for Meta's 24h rules.
      .map((t) => ({ ...t, windowState: normaliseWindowState(t.windowState) || 'CLOSED' }));

    try {
      const written = await db.putThreads(req.tenantId, rows);
      return res.json({ ok: true, written });
    } catch (err) {
      log.error('agent.threads.failed', { message: err.message, deviceId: req.device.deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Thread upload failed' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /agent/rules
  // -------------------------------------------------------------------------
  router.get('/rules', async (req, res) => {
    try {
      const rules = await db.listRules(req.tenantId);
      const updatedAt = rules.reduce(
        (latest, r) => (r.updatedAt && r.updatedAt > latest ? r.updatedAt : latest),
        ''
      );
      return res.json({ rules, updatedAt: updatedAt || null });
    } catch (err) {
      log.error('agent.rules.failed', { message: err.message, deviceId: req.device.deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to load rules' });
    }
  });

  return router;
}

export default createAgentRouter;
