/**
 * Auth-state utilities for safe credential backup and soft session reset.
 *
 * These helpers are designed to recover from corrupted Signal sessions without
 * requiring the customer to re-scan the QR code.  They keep `creds.json` intact
 * (so the WhatsApp device pairing remains valid) and only delete the ephemeral
 * session / pre-key / sender-key files that can be rebuilt on reconnect.
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

/**
 * Resolve the base auth-state directory from the environment at call time.
 * An explicit `baseDir` argument overrides the environment variable and is
 * intended for tests.
 * @param {string} [baseDir]
 * @returns {string}
 */
function getAuthStateBaseDir(baseDir) {
  if (baseDir) {
    return baseDir;
  }
  return process.env.AUTH_STATE_DIR || './auth_state';
}

/**
 * Prefixes of auth-state files that are safe to delete during a soft reset.
 * These are all derived from the pairing credentials and can be re-created.
 */
const RESETTABLE_FILE_PREFIXES = [
  'session-',
  'pre-key-',
  'sender-key-',
  'sender-key-memory-',
  'app-state-sync-key-',
];

/**
 * File names that must NEVER be deleted by a soft reset.  These are the
 * foundation of the WhatsApp device pairing.
 */
const PROTECTED_FILE_NAMES = new Set([
  'creds.json',
  'connection-state.json',
]);

/**
 * Required top-level fields in a valid Baileys credentials object.
 * If any of these are missing, the file is treated as corrupted and the
 * backup will be used.
 */
const REQUIRED_CREDS_FIELDS = [
  'noiseKey',
  'signedIdentityKey',
  'signedPreKey',
  'registrationId',
  'advSecretKey',
  'me',
];

/**
 * Get the auth-state directory for a phone number.
 * @param {string} phone
 * @param {string} [baseDir]
 * @returns {string}
 */
export function getAuthStateDir(phone, baseDir) {
  const normalized = String(phone).replace(/\D/g, '');
  return path.resolve(getAuthStateBaseDir(baseDir), normalized);
}

/**
 * Get the path to the credentials file for a phone number.
 * @param {string} phone
 * @param {string} [baseDir]
 * @returns {string}
 */
export function getCredsPath(phone, baseDir) {
  return path.join(getAuthStateDir(phone, baseDir), 'creds.json');
}

/**
 * Atomically write a JSON file by writing to a temp file and renaming it.
 * This ensures readers never see a partially written file.
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<void>}
 */
async function writeFileAtomically(filePath, content) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp.${Date.now()}`);
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Validate that a credentials object contains the minimum required fields for
 * Baileys to establish a connection.  This is intentionally conservative; a
 * missing field here will cause the handshake to crash.
 * @param {string} content
 * @returns {boolean}
 */
function isValidCredsContent(content) {
  try {
    const creds = JSON.parse(content);
    if (!creds || typeof creds !== 'object') {
      return false;
    }
    return REQUIRED_CREDS_FIELDS.every(field => creds[field] !== undefined && creds[field] !== null);
  } catch {
    return false;
  }
}

/**
 * Check if a file is safe to delete during a soft reset.
 * @param {string} fileName
 * @returns {boolean}
 */
export function isResettableFile(fileName) {
  if (PROTECTED_FILE_NAMES.has(fileName)) {
    return false;
  }
  return RESETTABLE_FILE_PREFIXES.some(prefix => fileName.startsWith(prefix));
}

/**
 * Atomically back up the live creds.json file for a phone number.
 * The backup is written next to the original file as `creds.json.bak`.
 * @param {string} phone
 * @param {string} [baseDir]
 * @returns {Promise<boolean>} true if a backup was written
 */
export async function backupCredsJsonAtomically(phone, baseDir) {
  try {
    const credsPath = getCredsPath(phone, baseDir);
    const backupPath = `${credsPath}.bak`;
    const content = await fs.readFile(credsPath, 'utf-8');
    await writeFileAtomically(backupPath, content);
    logger.info({ phone }, 'auth_state_utils.creds_backup.success');
    return true;
  } catch (err) {
    logger.warn({ phone, error: err.message }, 'auth_state_utils.creds_backup.failed');
    return false;
  }
}

/**
 * Perform a soft reset of the Signal session state for a phone number.
 *
 * This deletes the files that can become corrupted (session, pre-key,
 * sender-key, app-state-sync-key) while preserving the credentials that keep
 * the WhatsApp Web pairing alive.  After the reset, the next reconnect will
 * rebuild the session state from the server without requiring a new QR scan.
 *
 * @param {string} phone
 * @param {string} [baseDir]
 * @returns {Promise<{ deleted: string[]; preserved: string[]; error: string|null }>}
 */
export async function softResetSession(phone, baseDir) {
  const sessionDir = getAuthStateDir(phone, baseDir);
  const deleted = [];
  const preserved = [];

  try {
    await fs.access(sessionDir);
  } catch (err) {
    logger.warn({ phone, error: err.message }, 'auth_state_utils.soft_reset.no_dir');
    return { deleted, preserved, error: 'session_dir_not_found' };
  }

  const backupSuccess = await backupCredsJsonAtomically(phone, baseDir);
  if (!backupSuccess) {
    logger.error({ phone }, 'auth_state_utils.soft_reset.backup_failed_aborting');
    return { deleted, preserved, error: 'backup_failed' };
  }

  try {
    const entries = await fs.readdir(sessionDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fileName = entry.name;
      if (isResettableFile(fileName)) {
        const filePath = path.join(sessionDir, fileName);
        try {
          await fs.unlink(filePath);
          deleted.push(fileName);
        } catch (err) {
          logger.warn({ phone, file: fileName, error: err.message }, 'auth_state_utils.soft_reset.delete_failed');
          preserved.push(fileName);
        }
      } else {
        preserved.push(fileName);
      }
    }
  } catch (err) {
    logger.error({ phone, error: err.message }, 'auth_state_utils.soft_reset.failed');
    return { deleted, preserved, error: err.message };
  }

  logger.info(
    { phone, deletedCount: deleted.length, preservedCount: preserved.length },
    'auth_state_utils.soft_reset.success'
  );
  return { deleted, preserved, error: null };
}

/**
 * Restore the credentials file from the atomic backup if the live file is
 * missing, empty, or structurally invalid.  This is a last-resort recovery path.
 * @param {string} phone
 * @param {string} [baseDir]
 * @returns {Promise<boolean>}
 */
export async function restoreCredsFromBackup(phone, baseDir) {
  try {
    const credsPath = getCredsPath(phone, baseDir);
    const backupPath = `${credsPath}.bak`;
    let needsRestore = false;
    let liveContent = '';
    try {
      liveContent = await fs.readFile(credsPath, 'utf-8');
      if (!isValidCredsContent(liveContent)) {
        needsRestore = true;
      }
    } catch {
      needsRestore = true;
    }
    if (!needsRestore) {
      return false;
    }
    const backup = await fs.readFile(backupPath, 'utf-8');
    // Validate that the backup is a usable Baileys credentials object before
    // restoring.  A corrupt backup would leave the session unrecoverable.
    if (!isValidCredsContent(backup)) {
      throw new Error('Backup is not a valid Baileys credentials object');
    }
    await writeFileAtomically(credsPath, backup);
    logger.info({ phone }, 'auth_state_utils.creds_restore.success');
    return true;
  } catch (err) {
    logger.warn({ phone, error: err.message }, 'auth_state_utils.creds_restore.failed');
    return false;
  }
}
