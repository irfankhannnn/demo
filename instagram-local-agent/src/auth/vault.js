/**
 * A1 - encrypted token storage.
 *
 * Access tokens are encrypted with AES-256-GCM. The key is 32 random bytes in
 * `~/.ig-agent/vault.key`, created on first use with mode 0600 and never
 * transmitted anywhere. Ciphertext lives in the `tokens` table.
 *
 * Deliberately NO native keychain dependency: a native module is one more thing
 * that fails to build on a broker's laptop, and the threat model here is "the DB
 * file gets copied off the machine", which a file-key defends against. If a real
 * OS keychain is wanted later it slots in behind `loadKey()` alone.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ensureHome, vaultKeyPath } from '../util/paths.js';
import { now, DAY_MS } from '../util/time.js';
import { saveTokenRow, getTokenRow, deleteTokens } from '../store/repos.js';

const ALG = 'aes-256-gcm';
const KEY_BYTES = 32;

/** Long-lived tokens last 60 days; we refresh at day 50 (A1). */
export const REFRESH_LEAD_DAYS = 10;
/** Token health warns this many days before expiry (F64). */
export const WARN_LEAD_DAYS = 10;

let cachedKey = null;

function keyId(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

/** Load (or create) the machine-local vault key. */
export function loadKey() {
  if (cachedKey) return cachedKey;
  ensureHome();
  const p = vaultKeyPath();
  if (!fs.existsSync(p)) {
    const key = crypto.randomBytes(KEY_BYTES);
    fs.writeFileSync(p, key.toString('base64'), { mode: 0o600 });
    if (process.platform !== 'win32') fs.chmodSync(p, 0o600);
    cachedKey = key;
    return key;
  }
  const key = Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`vault.key is corrupt (${key.length} bytes, expected ${KEY_BYTES}). ` +
      'Delete it and reconnect the account to re-issue a token.');
  }
  cachedKey = key;
  return key;
}

/** Reset the in-process key cache. Tests use this when they move IG_AGENT_HOME. */
export function resetKeyCache() {
  cachedKey = null;
}

export function encrypt(plaintext, key = loadKey()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return {
    alg: ALG,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
    keyId: keyId(key),
  };
}

export function decrypt({ iv, tag, ciphertext }, key = loadKey()) {
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Store an access token for an account.
 * `expiresInSec` is what Meta returns for a long-lived token (~5183944).
 */
export function putToken(igUserId, accessToken, { expiresInSec = null, scopes = null, kind = 'long_lived' } = {}) {
  const enc = encrypt(accessToken);
  const issuedAt = now();
  const expiresAt = expiresInSec ? issuedAt + expiresInSec * 1000 : null;
  const refreshAfter = expiresAt ? expiresAt - REFRESH_LEAD_DAYS * DAY_MS : null;
  saveTokenRow({
    igUserId, kind, ...enc,
    scopes: Array.isArray(scopes) ? scopes.join(',') : scopes,
    issuedAt, expiresAt, refreshAfter, lastRefreshedAt: issuedAt,
  });
  return { igUserId, kind, expiresAt, refreshAfter };
}

/** Decrypted token, or null when the account has none. */
export function readToken(igUserId, kind = 'long_lived') {
  const row = getTokenRow(igUserId, kind);
  if (!row) return null;
  return {
    accessToken: decrypt(row),
    expiresAt: row.expires_at,
    refreshAfter: row.refresh_after,
    scopes: row.scopes ? row.scopes.split(',') : [],
    issuedAt: row.issued_at,
  };
}

export function forgetToken(igUserId) {
  deleteTokens(igUserId);
}

/** Token health for the console panel and `doctor` (F64). */
export function tokenHealth(igUserId, at = now()) {
  const row = getTokenRow(igUserId);
  if (!row) return { state: 'missing', message: 'No token stored. Run: ig-agent connect' };
  if (!row.expires_at) return { state: 'unknown', message: 'Token has no recorded expiry.' };
  const daysLeft = Math.floor((row.expires_at - at) / DAY_MS);
  if (daysLeft <= 0) return { state: 'expired', daysLeft, message: 'Token expired. Reconnect the account.' };
  if (daysLeft <= WARN_LEAD_DAYS) {
    return { state: 'expiring', daysLeft, message: `Token expires in ${daysLeft} day(s). A refresh is due.` };
  }
  return { state: 'healthy', daysLeft, message: `Token healthy, ${daysLeft} days left.` };
}
