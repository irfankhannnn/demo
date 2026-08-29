// Device + account endpoints for the dashboard, contract section 4 (JWT auth).
//
// The deviceSecret column lives on these items and must never leave the
// service, so every response here is built through one redacting projection
// rather than by spreading the raw item.

import express from 'express';
import { generatePairingCode } from '../services/hmac.js';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/devices' });

/** The only shape a device is ever serialised as. deviceSecret is absent by
 *  construction, not by deletion — a future field addition cannot leak it. */
function publicDevice(d) {
  return {
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    platform: d.platform,
    agentVersion: d.agentVersion,
    status: d.status,
    igUserId: d.igUserId,
    igUsername: d.igUsername,
    lastSeenAt: d.lastSeenAt,
    tokenExpiresAt: d.tokenExpiresAt,
    revokedAt: d.revokedAt,
    createdAt: d.createdAt,
  };
}

/** A laptop that has not checked in for 15 minutes is treated as offline; the
 *  agent heartbeats every 5, so this tolerates two missed beats. */
const STALE_AFTER_MS = 15 * 60 * 1000;

function deviceHealth(d, now = Date.now()) {
  if (d.status !== 'active') return 'revoked';
  if (!d.lastSeenAt) return 'never_seen';
  return now - new Date(d.lastSeenAt).getTime() > STALE_AFTER_MS ? 'stale' : 'online';
}

export function createDevicesRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // POST /devices/pair
  router.post('/devices/pair', async (req, res) => {
    try {
      const ttlMinutes = getConfig().pairingCodeTtlMinutes;
      const code = generatePairingCode();

      const item = await db.createPairingCode(req.tenantId, {
        code,
        ttlMinutes,
        createdBy: req.user?.userId || req.user?.email || null,
      });

      await db.putAuditEvent(req.tenantId, { action: 'device.pairing_code_issued' });

      // The code itself is fine to return to the owner who asked for it, but it
      // is never logged — the log line records only that one was issued.
      log.info('devices.pair.issued', { tenantId: req.tenantId, ttlMinutes });

      return res.status(201).json({ pairingCode: item.code, expiresAt: item.expiresAtIso });
    } catch (err) {
      log.error('devices.pair.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to issue pairing code' });
    }
  });

  // GET /devices
  router.get('/devices', async (req, res) => {
    try {
      const devices = await db.listDevices(req.tenantId);
      const now = Date.now();
      return res.json({
        devices: devices.map((d) => ({ ...publicDevice(d), health: deviceHealth(d, now) })),
      });
    } catch (err) {
      log.error('devices.list.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list devices' });
    }
  });

  // DELETE /devices/:deviceId — revoke
  router.delete('/devices/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    try {
      // Revoke rather than delete: the audit trail and the enquiries the device
      // uploaded stay attributable, and deviceAuth's status check is what
      // actually stops it from signing again.
      const updated = await db.revokeDevice(req.tenantId, deviceId);
      if (!updated) {
        return res.status(404).json({ error: 'Not Found', details: 'Device not found' });
      }

      await db.putAuditEvent(req.tenantId, { action: 'device.revoked', deviceId });
      log.info('devices.revoked', { tenantId: req.tenantId, deviceId });

      return res.json({ ok: true, device: publicDevice(updated) });
    } catch (err) {
      if (err?.name === 'ConditionalCheckFailedException') {
        return res.status(404).json({ error: 'Not Found', details: 'Device not found' });
      }
      log.error('devices.revoke.failed', { message: err.message, deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to revoke device' });
    }
  });

  // GET /accounts — connected IG accounts plus the health of the laptop
  // collecting for each. The account list is derived from the devices rather
  // than stored separately: a device is the only thing that can hold an IG
  // token, so there is no such thing as an account without one.
  router.get('/accounts', async (req, res) => {
    try {
      const devices = await db.listDevices(req.tenantId);
      const now = Date.now();

      const accounts = devices
        .filter((d) => d.igUserId)
        .map((d) => ({
          igUserId: d.igUserId,
          igUsername: d.igUsername,
          tokenExpiresAt: d.tokenExpiresAt,
          // Surfacing this lets the dashboard nag before a token dies silently.
          tokenExpiringSoon: d.tokenExpiresAt
            ? new Date(d.tokenExpiresAt).getTime() - now < 7 * 86400 * 1000
            : null,
          device: { ...publicDevice(d), health: deviceHealth(d, now) },
        }));

      return res.json({ accounts, deviceCount: devices.length });
    } catch (err) {
      log.error('accounts.list.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list accounts' });
    }
  });

  return router;
}

export default createDevicesRouter;
