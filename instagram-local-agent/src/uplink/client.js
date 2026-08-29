/**
 * A9 - Uplink client. HMAC-signed transport to the RealtyFlow microservice.
 *
 * The signing construction here MUST stay byte-for-byte identical to
 * backend_insta_sol_ms/services/hmac.js. It is specified in
 * docs/insta-sol-ms-docs/03-ARCHITECTURE.md section 2b, and both sides have
 * tests asserting the same fixture vector - if you change one, the paired test
 * on the other side fails, which is the point.
 *
 *   stringToSign = METHOD \n PATH \n TIMESTAMP \n NONCE \n sha256hex(rawBody)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { devicePath } from '../util/paths.js';
import { loadConfig } from '../util/config.js';
import { logger } from '../util/logger.js';

const log = logger('uplink/client');

export const HEADERS = {
  deviceId: 'x-insta-device-id',
  timestamp: 'x-insta-timestamp',
  nonce: 'x-insta-nonce',
  signature: 'x-insta-signature',
};

export function sha256Hex(buf) {
  const input = Buffer.isBuffer(buf) ? buf : Buffer.from(buf ?? '', 'utf8');
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function buildStringToSign({ method, path, timestamp, nonce, rawBody }) {
  return [
    String(method || '').toUpperCase(),
    String(path || ''),
    String(timestamp ?? ''),
    String(nonce ?? ''),
    sha256Hex(rawBody),
  ].join('\n');
}

export function signRequest({ secret, method, path, timestamp, nonce, rawBody }) {
  return crypto
    .createHmac('sha256', String(secret))
    .update(buildStringToSign({ method, path, timestamp, nonce, rawBody }), 'utf8')
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Device credentials
// ---------------------------------------------------------------------------

/**
 * The device secret lives in a 0600 file next to the DB, not in the DB itself:
 * the SQLite file gets copied around for support and backups, and a credential
 * that can authenticate to the tenant's cloud data should not ride along.
 */
export function loadDevice() {
  const p = devicePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    log.error('device file is unreadable', { error: err.message });
    return null;
  }
}

export function saveDevice(device) {
  const p = devicePath();
  fs.writeFileSync(p, JSON.stringify(device, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // Windows does not honour POSIX modes. Not fatal - noted so it is not a mystery.
    log.debug('chmod not supported on this platform');
  }
  return device;
}

export function isPaired() {
  const d = loadDevice();
  return Boolean(d?.deviceId && d?.deviceSecret);
}

export class UplinkError extends Error {
  constructor(message, { status = 0, body = null, retryable = false } = {}) {
    super(message);
    this.name = 'UplinkError';
    this.status = status;
    this.body = body;
    this.retryable = retryable;
  }
}

export class UplinkClient {
  constructor({ config = loadConfig(), device = loadDevice(), fetchImpl = null } = {}) {
    this.baseUrl = String(config.cloud?.baseUrl ?? '').replace(/\/+$/, '');
    this.basePath = config.cloud?.basePath ?? '/api/insta';
    this.timeoutMs = config.cloud?.timeoutMs ?? 15000;
    this.device = device;
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  get paired() {
    return Boolean(this.device?.deviceId && this.device?.deviceSecret);
  }

  /**
   * Pair this laptop using a one-time code from the web app. This is the only
   * call that is not HMAC-signed - the pairing code IS the credential, which is
   * why it is single-use and expires in 15 minutes.
   */
  async register({ pairingCode, deviceName, platform, agentVersion }) {
    const url = `${this.baseUrl}${this.basePath}/agent/register`;
    const res = await this.#fetchJson(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pairingCode, deviceName, platform, agentVersion }),
    });
    // The secret is returned exactly once. If this write fails the pairing is
    // unrecoverable and has to be redone, so it happens before anything else.
    this.device = saveDevice({
      deviceId: res.deviceId,
      deviceSecret: res.deviceSecret,
      tenantId: res.tenantId,
      pairedAt: new Date().toISOString(),
    });
    return this.device;
  }

  async request(method, path, body = null) {
    if (!this.paired) throw new UplinkError('laptop is not paired - run: ig-agent pair <code>');
    if (!this.baseUrl) throw new UplinkError('cloud.baseUrl is not configured');

    const fullPath = `${this.basePath}${path}`;
    const rawBody = body == null ? '' : JSON.stringify(body);
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    const signature = signRequest({
      secret: this.device.deviceSecret,
      method,
      // Sign the path the server sees. The server signs over req.path, which
      // excludes the query string, so a mismatch here is the first thing to
      // check if signatures start failing.
      path: fullPath,
      timestamp,
      nonce,
      rawBody,
    });

    return this.#fetchJson(`${this.baseUrl}${fullPath}`, {
      method,
      headers: {
        'content-type': 'application/json',
        [HEADERS.deviceId]: this.device.deviceId,
        [HEADERS.timestamp]: String(timestamp),
        [HEADERS.nonce]: nonce,
        [HEADERS.signature]: signature,
      },
      body: rawBody || undefined,
    });
  }

  async #fetchJson(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        throw new UplinkError(parsed?.error ?? `HTTP ${res.status}`, {
          status: res.status,
          body: parsed,
          // 5xx and 429 are worth retrying; a 4xx means we sent something wrong
          // and retrying it unchanged just burns the rate budget.
          retryable: res.status >= 500 || res.status === 429,
        });
      }
      return parsed;
    } catch (err) {
      if (err instanceof UplinkError) throw err;
      if (err.name === 'AbortError') {
        throw new UplinkError(`request timed out after ${this.timeoutMs}ms`, { retryable: true });
      }
      throw new UplinkError(err.message, { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  heartbeat(payload) { return this.request('POST', '/agent/heartbeat', payload); }
  pushSnapshot(payload) { return this.request('POST', '/agent/snapshot', payload); }
  pushEnquiries(payload) { return this.request('POST', '/agent/enquiries', payload); }
  pushThreads(payload) { return this.request('POST', '/agent/threads', payload); }
  fetchRules() { return this.request('GET', '/agent/rules'); }
}

export default { UplinkClient, UplinkError, signRequest, buildStringToSign, sha256Hex, loadDevice, saveDevice, isPaired, HEADERS };
