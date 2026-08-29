// Laptop-to-API auth, contract section 2b.
//
// The agent holds no user session, so it presents a per-device HMAC credential
// instead of a bearer token. Four independent checks have to pass, and the
// order matters: cheap local checks first, then the single-item device read,
// then the signature, and only then the nonce claim — claiming a nonce for a
// request that turns out to be unsigned would let an attacker burn nonces.

import {
  HEADERS,
  verifySignature,
  isSkewAcceptable,
} from '../services/hmac.js';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'deviceAuth' });

function unauthorized(res, details) {
  // One shape and one status for every failure mode. Telling the caller which
  // of the four checks failed would hand an attacker a probing oracle.
  return res.status(401).json({ error: 'Unauthorized', details });
}

/**
 * Factory rather than a bare middleware so the route tests can inject a fake
 * dynamoService without touching AWS.
 */
export function createDeviceAuth({ db = defaultDb } = {}) {
  return async function deviceAuth(req, res, next) {
    const deviceId = req.headers[HEADERS.deviceId];
    const timestamp = req.headers[HEADERS.timestamp];
    const nonce = req.headers[HEADERS.nonce];
    const signature = req.headers[HEADERS.signature];

    if (!deviceId || !timestamp || !nonce || !signature) {
      return unauthorized(res, 'Missing device authentication headers');
    }

    const cfg = getConfig();

    if (!isSkewAcceptable(timestamp, Date.now(), cfg.hmacMaxSkewMs)) {
      log.warn('device_auth.skew_rejected', { deviceId });
      return unauthorized(res, 'Request timestamp outside the allowed window');
    }

    try {
      const device = await db.getDeviceById(deviceId);
      if (!device || device.status !== 'active') {
        log.warn('device_auth.unknown_or_revoked', { deviceId, status: device?.status });
        return unauthorized(res, 'Unknown or revoked device');
      }

      // The signature covers the bytes Express actually received, captured by
      // the express.json verify hook — re-serialising req.body would produce a
      // different hash for the same payload (key order, unicode escaping).
      const rawBody = req.rawBody ?? Buffer.alloc(0);

      // req.originalUrl carries the query string; the agent signs the path it
      // requested, so strip anything after '?'.
      const signedPath = (req.originalUrl || req.url || '').split('?')[0];

      const ok = verifySignature({
        secret: device.deviceSecret,
        method: req.method,
        path: signedPath,
        timestamp,
        nonce,
        rawBody,
        signature,
      });

      if (!ok) {
        log.warn('device_auth.bad_signature', { deviceId, path: signedPath });
        return unauthorized(res, 'Signature verification failed');
      }

      const claimed = await db.claimNonce(device.tenantId, deviceId, nonce, cfg.nonceTtlSeconds);
      if (!claimed) {
        log.warn('device_auth.replay_rejected', { deviceId, path: signedPath });
        return unauthorized(res, 'Nonce already used');
      }

      // Tenancy comes from the device record, never from the request.
      req.tenantId = device.tenantId;
      req.device = {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        tenantId: device.tenantId,
        igUserId: device.igUserId,
        igUsername: device.igUsername,
        agentVersion: device.agentVersion,
        status: device.status,
      };

      return next();
    } catch (err) {
      log.error('device_auth.error', { message: err.message, deviceId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Device authentication failed' });
    }
  };
}

export default createDeviceAuth;
